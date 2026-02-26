import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== 配置====================
const SUPABASE_URL = 'https://jyskkcjwpcoohyzupngk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uSKzxiyt1MjGArOacNW8tQ_MXogPbYQ';

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
const listView = document.getElementById('listView');
const qqInput = document.getElementById('qqInput');
const backBtn = document.getElementById('backBtn');
const backFromListBtn = document.getElementById('backFromListBtn');
const listBtn = document.getElementById('listBtn');
const qqDisplay = document.getElementById('qqDisplay');
const contentText = document.getElementById('contentText');
const editBtn = document.getElementById('editBtn');
const listContainer = document.getElementById('listContainer');

// ==================== 状态管理 ====================
let currentQQ = null;
let isEditing = false;
let saveInProgress = false;
const dataCache = new Map(); // 单个QQ内容缓存

// 列表相关状态
let listData = null;              // 缓存的所有列表数据
let listScrollTop = 0;            // 保存的滚动位置
let fromListToDetail = false;     // 是否从列表进入详情

// ==================== 视图切换函数 ====================
const showHome = () => {
    homeView.classList.remove('hidden');
    detailView.classList.add('hidden');
    listView.classList.add('hidden');
    qqInput.value = '';
    // 重置详情状态
    currentQQ = null;
    isEditing = false;
    contentText.value = '';
    contentText.readOnly = true;
    editBtn.textContent = '编辑';
    fromListToDetail = false;      // 回到首页清除标记
};

const showDetail = (qq) => {
    homeView.classList.add('hidden');
    detailView.classList.remove('hidden');
    listView.classList.add('hidden');
    qqDisplay.textContent = qq;
    // 重置编辑状态
    isEditing = false;
    contentText.readOnly = true;
    editBtn.textContent = '编辑';
};

const showList = () => {
    homeView.classList.add('hidden');
    detailView.classList.add('hidden');
    listView.classList.remove('hidden');

    if (listData) {
        // 有缓存，直接渲染
        renderList(listData);
        // 恢复滚动位置（需要在渲染后执行）
        setTimeout(() => {
            listContainer.scrollTop = listScrollTop;
        }, 0);
    } else {
        // 无缓存，请求数据
        fetchAllQQData();
    }
};

// ==================== 数据操作 ====================
// 加载单个QQ的内容
const loadQQContent = async (qq) => {
    if (!supabase) return;
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
        dataCache.set(qq, content);
    } catch (err) {
        console.error('加载异常:', err);
        alert('发生异常，无法加载数据');
    }
};

// 保存当前QQ的内容
const saveContent = async () => {
    if (!currentQQ || !supabase) return;
    if (saveInProgress) {
        alert('正在保存中，请稍候...');
        return;
    }
    const newContent = contentText.value;
    if (newContent.length > 500) {
        alert('内容过长，请限制在500字以内');
        return;
    }
    saveInProgress = true;
    editBtn.disabled = true;
    try {
        const { error } = await supabase
            .from('qq_data')
            .upsert({ qq: currentQQ, content: newContent }, { onConflict: 'qq' });
        if (error) {
            console.error('保存失败:', error);
            alert('保存失败，请重试');
            return;
        }
        dataCache.set(currentQQ, newContent);
        // 同时更新列表缓存中的内容预览（保持一致性）
        if (listData) {
            const item = listData.find(i => i.qq === currentQQ);
            if (item) item.content = newContent;
        }
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

// 获取所有QQ数据（用于列表页）
const fetchAllQQData = async () => {
    if (!supabase) return;
    listContainer.innerHTML = '<div style="color:#555; text-align:center;">加载中...</div>';
    try {
        const { data, error } = await supabase
            .from('qq_data')
            .select('qq, content')
            .order('qq', { ascending: true });
        if (error) {
            console.error('获取列表失败:', error);
            listContainer.innerHTML = '<div style="color:#f66; text-align:center;">加载失败，请重试</div>';
            return;
        }
        listData = data || []; // 存入缓存
        renderList(listData);
        // 如果有保存的滚动位置，恢复（但首次加载时可能没有，所以设为0）
        listContainer.scrollTop = listScrollTop;
    } catch (err) {
        console.error('获取列表异常:', err);
        listContainer.innerHTML = '<div style="color:#f66; text-align:center;">发生异常</div>';
    }
};

// 渲染列表
const renderList = (items) => {
    if (items.length === 0) {
        listContainer.innerHTML = '<div style="color:#555; text-align:center;">暂无在案人员</div>';
        return;
    }
    const html = items.map(item => {
        const preview = item.content ? (item.content.length > 30 ? item.content.slice(0, 30) + '…' : item.content) : '（空）';
        return `
            <div class="list-item" data-qq="${item.qq}">
                <div class="list-item-qq">${item.qq}</div>
                <div class="list-item-preview">${preview}</div>
            </div>
        `;
    }).join('');
    listContainer.innerHTML = html;
    // 为每个列表项添加点击事件
    document.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => {
            const qq = el.dataset.qq;
            // 保存滚动位置，并标记从列表进入
            listScrollTop = listContainer.scrollTop;
            fromListToDetail = true;
            currentQQ = qq;
            showDetail(qq);
            loadQQContent(qq);
        });
    });
};

// ==================== 事件绑定 ====================
// 首页输入框回车
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
        fromListToDetail = false; // 从首页进入，清除标记
        currentQQ = rawQQ;
        showDetail(currentQQ);
        loadQQContent(currentQQ);
    }
});
qqInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
});

// 返回按钮（详情页返回）
backBtn.addEventListener('click', () => {
    if (fromListToDetail) {
        showList(); // 返回列表页
    } else {
        showHome();
    }
});

// 列表页返回按钮（始终回首页）
backFromListBtn.addEventListener('click', () => {
    fromListToDetail = false; // 从列表页直接返回首页，清除标记
    showHome();
});

// 查看在案人员按钮
listBtn.addEventListener('click', () => {
    showList();
});

// 编辑/保存按钮
editBtn.addEventListener('click', async () => {
    if (!currentQQ) {
        alert('QQ号丢失，请返回重新搜索');
        return;
    }
    if (!isEditing) {
        isEditing = true;
        contentText.readOnly = false;
        editBtn.textContent = '保存';
        contentText.focus();
    } else {
        await saveContent();
    }
});

// 按ESC取消编辑
contentText.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEditing) {
        loadQQContent(currentQQ); // 丢弃更改，重新加载
        isEditing = false;
        contentText.readOnly = true;
        editBtn.textContent = '编辑';
        e.preventDefault();
    }
});

// 初始化：显示首页
showHome();