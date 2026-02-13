/**
 * 数据新鲜度状态指示器组件 - v2.0
 * 基于 Structured Clarity 设计系统
 * 极简美学：无卡片包裹，标签式设计，状态徽章
 */
class DataFreshnessIndicator {
    /**
     * 构造函数
     * @param {string|HTMLElement} container - 容器元素ID或DOM元素
     * @param {Object} options - 配置选项
     */
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;

        this.isExpanded = false;
        this.data = null;
        this.options = {
            refreshInterval: 5 * 60 * 1000, // 5分钟自动刷新
            autoRefresh: true,
            onUpdateClick: null,
            ...options
        };

        // 状态配置
        this.statusConfig = {
            'normal': {
                icon: '●',
                color: 'var(--color-success)',
                label: '正常',
                badgeClass: 'freshness-badge--normal'
            },
            'warning': {
                icon: '●',
                color: 'var(--color-warning)',
                label: '建议更新',
                badgeClass: 'freshness-badge--warning'
            },
            'critical': {
                icon: '●',
                color: 'var(--color-error)',
                label: '需立即更新',
                badgeClass: 'freshness-badge--critical'
            },
            'no_data': {
                icon: '○',
                color: 'var(--color-text-tertiary)',
                label: '无数据',
                badgeClass: ''
            },
            'error': {
                icon: '!',
                color: 'var(--color-error)',
                label: '查询失败',
                badgeClass: ''
            }
        };

        this.refreshTimer = null;
        this.init();
    }

    /**
     * 初始化组件
     */
    async init() {
        try {
            await this.loadData();
            this.render();
            this.bindEvents();

            if (this.options.autoRefresh) {
                this.startAutoRefresh();
            }
        } catch (error) {
            console.error('[DataFreshnessIndicator] init failed:', error);
            this.renderError();
        }
    }

    /**
     * 加载数据
     */
    async loadData() {
        const response = await API.get('/api/v1/data-freshness');

        if (!response.success) {
            throw new Error(response.error || '加载数据失败');
        }

        this.data = response.data;

        // 如果有紧急警告，自动展开
        const hasCritical = Object.values(this.data).some(
            source => source.status === 'critical'
        );

        if (hasCritical && !this.isExpanded) {
            this.isExpanded = true;
        }
    }

    /**
     * 渲染组件
     */
    render() {
        if (!this.data) {
            this.renderLoading();
            return;
        }

        // 检查是否有严重警告，添加特殊样式类
        const hasCritical = Object.values(this.data).some(
            source => source.status === 'critical'
        );

        this.container.innerHTML = `
            <div class="data-freshness-indicator ${hasCritical ? 'freshness-indicator--critical' : ''}">
                ${this.renderSummary()}
                ${this.renderDetails()}
            </div>
        `;
    }

    /**
     * 渲染摘要行
     */
    renderSummary() {
        const summary = this.calculateSummary();

        // 判断是否有警告状态（黄色或红色）
        const hasWarning = Object.values(this.data).some(
            source => source.status === 'warning' || source.status === 'critical'
        );

        // 选择图标
        const iconName = hasWarning ? '警告' : '成功';
        const iconPath = `/icon/${iconName}.svg`;

        return `
            <div class="freshness-summary ${this.isExpanded ? 'freshness-summary--expanded' : ''}">
                <div class="freshness-summary__left">
                    <div class="freshness-summary__icon">
                        <img src="${iconPath}" class="freshness-summary__icon-img" alt="${iconName}">
                    </div>
                    <span class="freshness-summary__text">数据状态</span>
                    <div class="freshness-summary__dots">
                        ${this.renderDots(summary)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染状态点 - 显示所有数据源的状态
     */
    renderDots(summary) {
        const dots = [];

        // 为每个数据源生成一个状态点
        Object.values(this.data).forEach(source => {
            const statusClass = `freshness-dot--${source.status || 'no_data'}`;
            dots.push(`<div class="freshness-dot ${statusClass}"></div>`);
        });

        return dots.join('');
    }

    /**
     * 计算汇总统计
     */
    calculateSummary() {
        const summary = {
            total: 0,
            normal: 0,
            warning: 0,
            critical: 0
        };

        Object.values(this.data).forEach(source => {
            summary.total++;
            if (source.status) {
                summary[source.status]++;
            }
        });

        return summary;
    }

    /**
     * 渲染详情列表 - 按业务属性分组显示（紧凑横向布局）
     */
    renderDetails() {
        if (!this.isExpanded) {
            return '<div class="freshness-details" style="display: none;"></div>';
        }

        // 按分组和顺序排序数据
        const sortedData = Object.values(this.data).sort((a, b) => a.order - b.order);

        // 分组标签
        const groupLabels = {
            'account_ads': '账号数据',
            'xhs_notes': '笔记数据',
            'backend_conversions': '转化数据'
        };

        // 按分组渲染（单行紧凑横向布局）
        const groupsHTML = ['account_ads', 'xhs_notes', 'backend_conversions'].map(groupKey => {
            const groupItems = sortedData.filter(item => item.group === groupKey);

            if (groupItems.length === 0) return '';

            // 生成卡片布局（每个卡片占满空间）
            const itemsHTML = groupItems.map(source => {
                const config = this.statusConfig[source.status] || this.statusConfig['error'];
                const dateText = source.latest_date
                    ? this.formatDate(source.latest_date)
                    : '无数据';

                return `
                    <div class="freshness-item freshness-item--compact">
                        <span class="freshness-item__dot freshness-dot--${source.status}"></span>
                        <span class="freshness-item__name">${source.name}</span>
                        <span class="freshness-item__date">${dateText}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="freshness-group">
                    <div class="freshness-group__icon-spacer"></div>
                    <span class="freshness-group__label">${groupLabels[groupKey]}</span>
                    <div class="freshness-group__content">
                        ${itemsHTML}
                    </div>
                </div>
            `;
        }).join('');

        const hasWarning = Object.values(this.data).some(
            source => source.status === 'warning' || source.status === 'critical'
        );

        const actionsHTML = hasWarning ? `
            <div class="freshness-actions">
                <button class="btn btn--primary btn--sm freshness-update-btn">
                    立即更新
                </button>
                <button class="btn btn--secondary btn--sm freshness-close-btn">
                    收起
                </button>
            </div>
        ` : `
            <div class="freshness-actions">
                <button class="btn btn--secondary btn--sm freshness-close-btn">
                    收起
                </button>
            </div>
        `;

        return `
            <div class="freshness-details">
                <div class="freshness-list">
                    ${groupsHTML}
                </div>
                ${actionsHTML}
            </div>
        `;
    }

    /**
     * 格式化日期显示 - 显示"最新数据日期:MM-DD"
     */
    formatDate(dateStr) {
        if (!dateStr) return '--';

        const date = new Date(dateStr);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `最新数据日期:${month}-${day}`;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 摘要行点击事件
        const summary = this.container.querySelector('.freshness-summary');
        if (summary) {
            summary.addEventListener('click', () => this.toggle());
        }

        // 更新按钮
        const updateBtn = this.container.querySelector('.freshness-update-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.handleUpdateClick());
        }

        // 关闭按钮
        const closeBtn = this.container.querySelector('.freshness-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.collapse());
        }
    }

    /**
     * 切换展开/折叠状态
     */
    toggle() {
        this.isExpanded = !this.isExpanded;
        this.render();
        this.bindEvents();
    }

    /**
     * 展开详情
     */
    expand() {
        this.isExpanded = true;
        this.render();
        this.bindEvents();
    }

    /**
     * 折叠详情
     */
    collapse() {
        this.isExpanded = false;
        this.render();
        this.bindEvents();
    }

    /**
     * 处理"立即更新"按钮点击
     * 跳转到"系统配置-数据导入"页面
     */
    handleUpdateClick() {
        if (this.options.onUpdateClick) {
            this.options.onUpdateClick();
        } else {
            // 展开"系统配置"子菜单并跳转到"数据导入"
            const systemConfigItem = document.querySelector('.nav-item[data-report="system-config"]');
            if (systemConfigItem) {
                const submenu = systemConfigItem.querySelector('.submenu');
                if (submenu && !systemConfigItem.classList.contains('expanded')) {
                    submenu.style.display = 'block';
                    systemConfigItem.classList.add('expanded');
                }

                // 找到"数据导入"菜单项并模拟点击
                setTimeout(() => {
                    const dataImportItem = document.querySelector('.submenu .nav-item[data-report="data-import"]');
                    if (dataImportItem) {
                        dataImportItem.click();
                    } else {
                        console.error('[DataFreshnessIndicator] 未找到数据导入菜单项');
                    }
                }, 150);
            } else {
                console.error('[DataFreshnessIndicator] 未找到系统配置菜单项');
                window.location.hash = 'data-import';
            }
        }
    }

    /**
     * 渲染加载状态
     */
    renderLoading() {
        this.container.innerHTML = `
            <div class="freshness-loading">
                <span>加载数据状态...</span>
            </div>
        `;
    }

    /**
     * 渲染错误状态
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="freshness-error">
                <span>⚠️</span>
                <span>数据状态加载失败${message ? ': ' + message : ''}</span>
            </div>
        `;
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        this.stopAutoRefresh();

        this.refreshTimer = setInterval(() => {
            this.refresh().catch(error => {
                console.error('[DataFreshnessIndicator] 自动刷新失败:', error);
            });
        }, this.options.refreshInterval);
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * 刷新数据
     */
    async refresh() {
        try {
            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('[DataFreshnessIndicator] 刷新失败:', error);
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stopAutoRefresh();
        this.container.innerHTML = '';
        this.data = null;
    }
}

// 导出
window.DataFreshnessIndicator = DataFreshnessIndicator;
