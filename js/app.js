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
const lastUpdatedSpan = document.getElementById('lastUpdated'); // 新增
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

// ==================== 工具函数 ====================
const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
};

const updateLastUpdated = (isoString) => {
    if (lastUpdatedSpan) {
        lastUpdatedSpan.textContent = isoString ? `上次更改：${formatDateTime(isoString)}` : '';
    }
};

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
    updateLastUpdated(null); // 清空时间
    fromListToDetail = false;
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
    // 时间会在 loadQQContent 中更新
};

const showList = () => {
    homeView.classList.add('hidden');
    detailView.classList.add('hidden');
    listView.classList.remove('hidden');

    if (listData) {
        renderList(listData);
        setTimeout(() => {
            listContainer.scrollTop = listScrollTop;
        }, 0);
    } else {
        fetchAllQQData();
    }
};

// ==================== 数据操作 ====================
// 加载单个QQ的内容
const loadQQContent = async (qq) => {
    if (!supabase) return;
    // 即使有缓存，也需要查询时间（时间会变），所以每次都请求完整数据
    try {
        const { data, error } = await supabase
            .from('qq_data')
            .select('content, updated_at')
            .eq('qq', qq)
            .maybeSingle();
        if (error) {
            console.error('查询失败:', error);
            alert('数据加载失败，请稍后重试');
            return;
        }
        if (data) {
            contentText.value = data.content || '';
            dataCache.set(qq, data.content || '');
            updateLastUpdated(data.updated_at);
        } else {
            // 新QQ号，无记录
            contentText.value = '';
            dataCache.set(qq, '');
            updateLastUpdated(null);
        }
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
        // 使用 .select() 返回更新后的记录，包含 updated_at
        const { data, error } = await supabase
            .from('qq_data')
            .upsert({ qq: currentQQ, content: newContent }, { onConflict: 'qq' })
            .select();
        if (error) {
            console.error('保存失败:', error);
            alert('保存失败，请重试');
            return;
        }
        if (data && data[0]) {
            const updatedRecord = data[0];
            dataCache.set(currentQQ, updatedRecord.content);
            updateLastUpdated(updatedRecord.updated_at);
            // 同时更新列表缓存中的内容预览
            if (listData) {
                const item = listData.find(i => i.qq === currentQQ);
                if (item) item.content = updatedRecord.content;
            }
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
        listData = data || [];
        renderList(listData);
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
    document.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => {
            const qq = el.dataset.qq;
            listScrollTop = listContainer.scrollTop;
            fromListToDetail = true;
            currentQQ = qq;
            showDetail(qq);
            loadQQContent(qq);
        });
    });
};

// ==================== 事件绑定 ====================
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
        fromListToDetail = false;
        currentQQ = rawQQ;
        showDetail(currentQQ);
        loadQQContent(currentQQ);
    }
});
qqInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
});

backBtn.addEventListener('click', () => {
    if (fromListToDetail) {
        showList();
    } else {
        showHome();
    }
});

backFromListBtn.addEventListener('click', () => {
    fromListToDetail = false;
    showHome();
});

listBtn.addEventListener('click', showList);

editBtn.addEventListener('click', async () => {
    if (!currentQQ) {
        alert('EOR，请返回重新搜索');
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

contentText.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEditing) {
        loadQQContent(currentQQ);
        isEditing = false;
        contentText.readOnly = true;
        editBtn.textContent = '编辑';
        e.preventDefault();
    }
});

// 初始化
showHome();