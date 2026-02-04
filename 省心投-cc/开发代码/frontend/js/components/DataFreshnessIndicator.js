/**
 * 数据新鲜度状态指示器组件
 *
 * 功能：
 * 1. 显示所有数据源的最新更新状态
 * 2. 按数据新鲜度分级显示（正常/警告/严重）
 * 3. 支持折叠/展开交互
 * 4. 提供快速跳转到数据导入页面的功能
 *
 * API 接口：GET /api/v1/data-freshness
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

class DataFreshnessIndicator {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 容器ID
     * @param {number} options.refreshInterval - 自动刷新间隔（毫秒），默认 5 分钟
     * @param {Function} options.onUpdateClick - 点击"立即更新"按钮的回调
     */
    constructor(options = {}) {
        this.containerId = options.containerId || 'data-freshness-indicator';
        this.refreshInterval = options.refreshInterval || 5 * 60 * 1000; // 5 分钟
        this.onUpdateClick = options.onUpdateClick || null;

        // 内部状态
        this.data = null;
        this.isExpanded = false;
        this.refreshTimer = null;
        this.isLoading = false;

        // 状态定义
        this.statusConfig = {
            normal: {
                icon: '✅',
                label: '正常',
                className: 'status-normal',
                color: '#52c41a'
            },
            warning: {
                icon: '⚠️',
                label: '建议更新',
                className: 'status-warning',
                color: '#faad14'
            },
            critical: {
                icon: '❌',
                label: '急需更新',
                className: 'status-critical',
                color: '#f5222d'
            }
        };

        // 数据源显示名称映射
        this.dataSourceNames = {
            tencent_ads: '腾讯广告',
            douyin_ads: '抖音广告',
            xiaohongshu_ads: '小红书广告',
            xhs_notes_daily: '小红书笔记投放',
            xhs_notes_content_daily: '小红书笔记运营',
            backend_conversions: '后端转化数据'
        };

        this.init();
    }

    /**
     * 初始化组件
     */
    async init() {
        try {
            this.render();
            await this.loadData();
            this.startAutoRefresh();
        } catch (error) {
            console.error('[DataFreshnessIndicator] 初始化失败:', error);
            this.renderError('加载数据状态失败');
        }
    }

    /**
     * 加载数据
     */
    async loadData() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.showLoading();

            const response = await API.get('/api/v1/data-freshness');

            if (response.success) {
                this.data = response.data;
                this.renderContent();

                // 如果有 critical 状态，自动展开
                if (this.hasCriticalStatus()) {
                    this.expand();
                }
            } else {
                throw new Error(response.message || '加载数据失败');
            }
        } catch (error) {
            console.error('[DataFreshnessIndicator] 加载数据失败:', error);
            this.renderError('无法获取数据状态信息');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 渲染组件结构
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[DataFreshnessIndicator] 容器不存在: ${this.containerId}`);
            return;
        }

        container.innerHTML = `
            <div class="data-freshness-indicator" id="dataFreshnessWidget">
                <!-- 加载状态 -->
                <div class="freshness-loading">
                    <span class="loading-spinner"></span>
                    <span>正在检查数据状态...</span>
                </div>
            </div>
        `;
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const widget = document.getElementById('dataFreshnessWidget');
        if (!widget) return;

        widget.innerHTML = `
            <div class="freshness-loading">
                <span class="loading-spinner"></span>
                <span>正在检查数据状态...</span>
            </div>
        `;
    }

    /**
     * 渲染内容
     */
    renderContent() {
        if (!this.data) {
            this.renderError('无数据');
            return;
        }

        const summary = this.buildSummary();
        const detailList = this.buildDetailList();

        const widget = document.getElementById('dataFreshnessWidget');
        if (!widget) return;

        widget.innerHTML = `
            <!-- 摘要行 -->
            <div class="freshness-summary" id="freshnessSummary">
                ${summary}
            </div>

            <!-- 详情列表（默认折叠） -->
            <div class="freshness-details" id="freshnessDetails" style="display: none;">
                <div class="freshness-list">
                    ${detailList}
                </div>
                <div class="freshness-actions">
                    <button class="btn btn--primary btn--sm" id="btnUpdateData">
                        📥 立即更新过期的数据
                    </button>
                    <button class="btn btn--secondary btn--sm" id="btnCloseDetails">
                        ✕ 关闭
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    /**
     * 构建摘要行
     */
    buildSummary() {
        const stats = this.calculateStats();
        const statusIcon = this.getOverallStatusIcon(stats);
        const toggleIcon = this.isExpanded ? '▲' : '▼';

        return `
            <span class="freshness-icon">📊</span>
            <span class="freshness-text">数据状态: ${stats.total} 个数据源</span>
            ${stats.needsUpdate > 0 ? `
                <span class="freshness-warning">(${stats.needsUpdate} 项建议更新)</span>
            ` : ''}
            <span class="freshness-status-icon">${statusIcon}</span>
            <span class="freshness-toggle">${toggleIcon}</span>
        `;
    }

    /**
     * 构建详情列表
     */
    buildDetailList() {
        const items = Object.entries(this.data).map(([key, item]) => {
            const statusInfo = this.statusConfig[item.status];
            const dataSourceName = this.dataSourceNames[key] || key;

            return `
                <div class="freshness-item ${statusInfo.className}">
                    <div class="item-status">${statusInfo.icon}</div>
                    <div class="item-info">
                        <div class="item-name">${dataSourceName}</div>
                        <div class="item-date">
                            ${item.latest_date ? `最后更新: ${item.latest_date}` : '暂无数据'}
                        </div>
                    </div>
                    <div class="item-meta">
                        <span class="item-days-ago">${item.days_ago !== null ? `${item.days_ago} 天前` : '-'}</span>
                        <span class="item-status-label">${statusInfo.label}</span>
                    </div>
                </div>
            `;
        }).join('');

        return items;
    }

    /**
     * 计算统计信息
     */
    calculateStats() {
        const total = Object.keys(this.data).length;
        const needsUpdate = Object.values(this.data).filter(
            item => item.status === 'warning' || item.status === 'critical'
        ).length;

        return { total, needsUpdate };
    }

    /**
     * 获取整体状态图标
     */
    getOverallStatusIcon(stats) {
        if (stats.needsUpdate === 0) {
            return '🟢';
        }

        // 检查是否有 critical 状态
        const hasCritical = Object.values(this.data).some(
            item => item.status === 'critical'
        );

        return hasCritical ? '🔴' : '🟡';
    }

    /**
     * 检查是否有严重状态
     */
    hasCriticalStatus() {
        return Object.values(this.data).some(item => item.status === 'critical');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const summary = document.getElementById('freshnessSummary');
        const btnUpdateData = document.getElementById('btnUpdateData');
        const btnCloseDetails = document.getElementById('btnCloseDetails');

        // 点击摘要行切换展开/折叠
        if (summary) {
            summary.addEventListener('click', () => {
                this.toggle();
            });
        }

        // 点击"立即更新"按钮
        if (btnUpdateData) {
            btnUpdateData.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleUpdateClick();
            });
        }

        // 点击"关闭"按钮
        if (btnCloseDetails) {
            btnCloseDetails.addEventListener('click', (e) => {
                e.stopPropagation();
                this.collapse();
            });
        }
    }

    /**
     * 切换展开/折叠状态
     */
    toggle() {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    /**
     * 展开详情
     */
    expand() {
        const details = document.getElementById('freshnessDetails');
        const toggle = document.querySelector('.freshness-toggle');

        if (details) {
            details.style.display = 'block';
        }
        if (toggle) {
            toggle.textContent = '▲';
        }

        this.isExpanded = true;
    }

    /**
     * 折叠详情
     */
    collapse() {
        const details = document.getElementById('freshnessDetails');
        const toggle = document.querySelector('.freshness-toggle');

        if (details) {
            details.style.display = 'none';
        }
        if (toggle) {
            toggle.textContent = '▼';
        }

        this.isExpanded = false;
    }

    /**
     * 处理"立即更新"按钮点击
     * 跳转到"系统配置-数据导入"页面
     */
    handleUpdateClick() {
        if (this.onUpdateClick) {
            this.onUpdateClick();
        } else {
            // 默认行为：展开"系统配置"菜单并跳转到"数据导入"
            const systemConfigItem = document.querySelector('.nav-item[data-report="system-config"]');
            if (systemConfigItem) {
                // 展开系统配置子菜单
                const submenu = systemConfigItem.querySelector('.submenu');
                if (submenu) {
                    submenu.style.display = 'block';
                    systemConfigItem.classList.add('expanded');
                }

                // 跳转到数据导入页面
                setTimeout(() => {
                    window.location.hash = 'data-import';
                }, 100);
            } else {
                // 如果找不到菜单项，直接跳转
                window.location.hash = 'data-import';
            }
        }
    }

    /**
     * 渲染错误状态
     */
    renderError(message) {
        const widget = document.getElementById('dataFreshnessWidget');
        if (!widget) return;

        widget.innerHTML = `
            <div class="freshness-error">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${message}</span>
                <button class="btn btn--secondary btn--sm" id="btnRetry">
                    🔄 重试
                </button>
            </div>
        `;

        const btnRetry = document.getElementById('btnRetry');
        if (btnRetry) {
            btnRetry.addEventListener('click', () => {
                this.loadData();
            });
        }
    }

    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        this.refreshTimer = setInterval(() => {
            this.loadData();
        }, this.refreshInterval);
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
     * 手动刷新数据
     */
    async refresh() {
        await this.loadData();
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stopAutoRefresh();

        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }

        this.data = null;
        this.isExpanded = false;
    }
}

// 导出给全局使用
if (typeof window !== 'undefined') {
    window.DataFreshnessIndicator = DataFreshnessIndicator;
}
