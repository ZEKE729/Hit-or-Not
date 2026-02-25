// 使用 ES6 模块，便于维护和扩展
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'; // 使用 esm.sh CDN

// ==================== 配置 ====================
// Supabase 项目信息
const SUPABASE_URL = 'https://jyskkcjwpcoohyzupngk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uSKzxiyt1MjGArOacNW8tQ_MXogPbYQ';

// 初始化 Supabase 客户端
let supabase;
try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    console.error('Supabase 初始化失败:', error);
    alert('配置错误：请检查 Supabase URL 和 Key');
}

// ==================== DOM 元素 ====================
const homeView = document.getElementById('homeView');
const detailView = document.getElementById('detailView');
const qqInput = document.getElementById('qqInput');
const backBtn = document.getElementById('backBtn');
const qqDisplay = document.getElementById('qqDisplay');
const contentText = document.getElementById('contentText');
const editBtn = document.getElementById('editBtn');

// ==================== 状态管理 ====================
let currentQQ = null;          // 当前查看的QQ号
let isEditing = false;         // 是否处于编辑模式
let saveInProgress = false;    // 防止重复提交

// ==================== 工具函数 ====================
const showHome = () => {
    detailView.classList.add('hidden');
    homeView.classList.remove('hidden');
    qqInput.value = '';
    currentQQ = null;
    isEditing = false;
    contentText.value = '';
    contentText.readOnly = true;
    editBtn.textContent = '编辑';
};

const showDetail = (qq) => {
    homeView.classList.add('hidden');
    detailView.classList.remove('hidden');
    qqDisplay.textContent = qq;
    // 重置编辑状态
    isEditing = false;
    contentText.readOnly = true;
    editBtn.textContent = '编辑';
};

// 加载数据 (带缓存优化)
let dataCache = new Map(); // 简单内存缓存
const loadQQContent = async (qq) => {
    if (!supabase) return;
    
    // 先从缓存读取
    if (dataCache.has(qq)) {
        contentText.value = dataCache.get(qq);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('qq_data')
            .select('content')
            .eq('qq', qq)
            .maybeSingle();

        if (error) {
            console.error('查询失败:', error);
            alert('数据加载失败，请稍后重试');
            return;
        }

        const content = data?.content || '';
        contentText.value = content;
        dataCache.set(qq, content); // 存入缓存
    } catch (err) {
        console.error('加载异常:', err);
        alert('发生异常，无法加载数据');
    }
};

// 保存数据 (带乐观锁/防并发)
const saveContent = async () => {
    if (!currentQQ || !supabase) return;
    if (saveInProgress) {
        alert('正在保存中，请稍候...');
        return;
    }

    const newContent = contentText.value;

    // 简单前端校验
    if (newContent.length > 500) { // 限制长度，避免滥用
        alert('内容过长，请限制在500字以内');
        return;
    }

    saveInProgress = true;
    editBtn.disabled = true; // 防止多次点击

    try {
        // 使用 upsert，如果有并发，最后写入的会覆盖 (对于极简场景足够)
        const { error } = await supabase
            .from('qq_data')
            .upsert({ qq: currentQQ, content: newContent }, { onConflict: 'qq' });

        if (error) {
            console.error('保存失败:', error);
            alert('保存失败，请重试');
            return;
        }

        // 更新缓存
        dataCache.set(currentQQ, newContent);

        // 退出编辑状态
        isEditing = false;
        contentText.readOnly = true;
        editBtn.textContent = '编辑';
    } catch (err) {
        console.error('保存异常:', err);
        alert('保存时发生异常');
    } finally {
        saveInProgress = false;
        editBtn.disabled = false;
    }
};

// ==================== 事件绑定 ====================
// 输入框回车：数字校验 + 跳转
qqInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const rawQQ = qqInput.value.trim();
        if (!rawQQ) {
            alert('请输入QQ号');
            return;
        }
        if (!/^\d+$/.test(rawQQ)) {
            alert('QQ号应为纯数字');
            return;
        }
        currentQQ = rawQQ;
        showDetail(currentQQ);
        loadQQContent(currentQQ);
    }
});

// 输入框实时过滤非数字（提升体验）
qqInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
});

// 返回首页
backBtn.addEventListener('click', showHome);

// 编辑/保存切换
editBtn.addEventListener('click', async () => {
    if (!currentQQ) {
        alert('QQ号丢失，请返回重新搜索');
        return;
    }

    if (!isEditing) {
        // 进入编辑模式
        isEditing = true;
        contentText.readOnly = false;
        editBtn.textContent = '保存';
        contentText.focus();
    } else {
        // 保存
        await saveContent();
    }
});

// 可选：在编辑时按 ESC 取消编辑 (提升体验)
contentText.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEditing) {
        // 恢复为之前的内容 (从缓存或重新加载)
        loadQQContent(currentQQ); // 重新加载丢弃未保存更改
        isEditing = false;
        contentText.readOnly = true;
        editBtn.textContent = '编辑';
        e.preventDefault();
    }
});

// 初始化
showHome();