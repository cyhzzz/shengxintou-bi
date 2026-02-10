/**
 * 省心投 BI - 全局配置
 */

// API配置
const API_CONFIG = {
    baseURL: 'http://127.0.0.1:5000',
    version: 'v1',
    timeout: 30000  // 30秒超时
};

// 构建完整的API URL
function getAPIUrl(endpoint) {
    // 如果endpoint已经包含/api/路径，则直接拼接baseURL，避免重复
    if (endpoint.startsWith('/api/')) {
        return `${API_CONFIG.baseURL}${endpoint}`;
    }
    return `${API_CONFIG.baseURL}/api/${API_CONFIG.version}${endpoint}`;
}

// 报表配置
const REPORTS = {
    'dashboard': {
        id: 'dashboard',
        name: '数据概览',
        title: '数据概览',
        icon: 'icon-home'
    },
    'agency-analysis': {
        id: 'agency-analysis',
        name: '厂商分析',
        title: '厂商分析',
        icon: 'icon-chart'
    },
    'account-management': {
        id: 'account-management',
        name: '账号管理',
        title: '账号管理',
        icon: 'icon-list'
    },
    'xhs-notes': {
        id: 'xhs-notes',
        name: '小红书报表',
        title: '小红书报表',
        icon: 'icon-document',
        hasSubmenu: true
    },
    'xhs-notes-list': {
        id: 'xhs-notes-list',
        name: '笔记列表',
        title: '笔记列表',
        icon: 'icon-document',
        parent: 'xhs-notes'
    },
    'xhs-notes-operation': {
        id: 'xhs-notes-operation',
        name: '运营分析',
        title: '运营分析',
        icon: 'icon-chart',
        parent: 'xhs-notes'
    },
    // 创作分析菜单（已禁用）
    /*
    'xhs-notes-creation': {
        id: 'xhs-notes-creation',
        name: '创作分析',
        title: '创作分析',
        icon: 'icon-create',
        parent: 'xhs-notes'
    },
    */
    'leads-detail': {
        id: 'leads-detail',
        name: '线索明细',
        title: '线索明细',
        icon: 'icon-list'
    },
    'conversion-funnel': {
        id: 'conversion-funnel',
        name: '转化漏斗',
        title: '转化漏斗',
        icon: 'icon-funnel'
    },
    'report-generation': {
        id: 'report-generation',
        name: '报告生成',
        title: '报告生成',
        icon: 'icon-report'
    }
};

// 日期快捷选项
const DATE_RANGES = {
    7: '近7天',
    30: '近30天',
    90: '近90天'
};

// 图表主题配置
const CHART_THEMES = {
    light: {
        backgroundColor: 'transparent',
        textStyle: {
            color: '#333333'
        },
        title: {
            textStyle: {
                color: '#333333'
            }
        }
    },
    dark: {
        backgroundColor: 'transparent',
        textStyle: {
            color: '#ffffff'
        },
        title: {
            textStyle: {
                color: '#ffffff'
            }
        }
    }
};

// 导出配置
window.APP_CONFIG = {
    API_CONFIG,
    REPORTS,
    DATE_RANGES,
    CHART_THEMES,
    getAPIUrl
};

// 导出getAPIUrl到全局作用域，供api.js使用
window.getAPIUrl = getAPIUrl;
