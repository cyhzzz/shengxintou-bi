/**
 * 省心投 BI - 成本分析报表
 * 显示单线索成本、单客成本、单有效户成本分析
 */

class CostAnalysisReport {
    /**
     * 创建成本分析报表实例
     */
    constructor() {
        this.currentData = null;
        this.currentTab = 'cost-per-lead'; // cost-per-lead, cost-per-account, cpm
        this.filters = {};

        // 初始化事件管理器（Phase 1: 修复事件监听器泄漏）
        this.eventManager = new EventManager();

        this.init();
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化成本分析报表');
        await this.loadData();
        this.render();
        this.bindEvents();
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            this.filters = this.getCurrentFilters();

            const response = await API.getCostAnalysis(this.filters);

            if (response.error) {
                throw new Error(response.error);
            }

            this.currentData = response;
            console.log('成本分析数据加载成功:', this.currentData);

        } catch (error) {
            console.error('加载成本分析数据失败:', error);
            this.showError(error.message);
        }
    }

    /**
     * 获取当前筛选条件
     */
    getCurrentFilters() {
        const filters = {};

        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        if (startDate && endDate) {
            filters.date_range = [startDate, endDate];
        }

        const platformTags = document.querySelectorAll('#platformTags .tag.active');
        if (platformTags.length > 0 && !platformTags[0].textContent.includes('全部')) {
            filters.platforms = Array.from(platformTags).map(tag => tag.textContent);
        }

        const agencyTags = document.querySelectorAll('#agencyTags .tag.active');
        if (agencyTags.length > 0 && !agencyTags[0].textContent.includes('全部')) {
            filters.agencies = Array.from(agencyTags).map(tag => tag.textContent);
        }

        return filters;
    }

    /**
     * 渲染报表
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('找不到主内容容器');
            return;
        }

        container.innerHTML = `
            <div class="cost-analysis-report">
                <!-- 选项卡 -->
                <div class="tab-buttons">
                    <button class="tab-btn ${this.currentTab === 'cost-per-lead' ? 'active' : ''}" data-tab="cost-per-lead">
                        单线索成本
                    </button>
                    <button class="tab-btn ${this.currentTab === 'cost-per-account' ? 'active' : ''}" data-tab="cost-per-account">
                        单客成本
                    </button>
                    <button class="tab-btn ${this.currentTab === 'cpm' ? 'active' : ''}" data-tab="cpm">
                        千次曝光成本
                    </button>
                </div>

                <!-- 汇总卡片 -->
                <div class="metrics-cards" id="costMetrics"></div>

                <!-- 成本表格 -->
                <div class="chart-section">
                    <div class="section-header">
                        <h3 class="section-title" id="tableTitle">账号成本明细</h3>
                    </div>
                    <div class="data-table-wrapper">
                        <div class="data-table-container">
                            <table class="data-table" id="costTable">
                                <thead></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderMetrics();
        this.renderCostTable();
    }

    /**
     * 渲染指标卡片
     */
    renderMetrics() {
        if (!this.currentData || !this.currentData.summary) {
            return;
        }

        const container = document.getElementById('costMetrics');
        if (!container) {
            return;
        }

        const summary = this.currentData.summary;

        const metrics = [
            {
                title: '总花费',
                value: summary.total_cost,
                prefix: '¥',
                type: 'primary'
            },
            {
                title: '总线索数',
                value: summary.total_leads,
                format: 'number',
                type: 'success'
            },
            {
                title: '总开户数',
                value: summary.total_accounts,
                format: 'number',
                type: 'info'
            },
            {
                title: '平均单线索成本',
                value: summary.avg_cost_per_lead,
                prefix: '¥',
                decimals: 2,
                type: 'warning'
            },
            {
                title: '平均单客成本',
                value: summary.avg_cost_per_account,
                prefix: '¥',
                decimals: 2,
                type: 'danger'
            }
        ];

        metrics.forEach(metric => {
            const card = new MetricCard(metric);
            container.appendChild(card.element);
        });
    }

    /**
     * 渲染成本表格
     */
    renderCostTable() {
        if (!this.currentData || !this.currentData.data) {
            return;
        }

        const thead = document.querySelector('#costTable thead');
        const tbody = document.querySelector('#costTable tbody');
        const tableTitle = document.getElementById('tableTitle');

        if (!thead || !tbody || !tableTitle) {
            return;
        }

        // 根据当前选项卡设置表头和标题
        let headers = [];
        let sortField = '';

        switch (this.currentTab) {
            case 'cost-per-lead':
                tableTitle.textContent = '单线索成本明细';
                headers = ['平台', '代理商', '账号ID', '账号名称', '花费', '线索数', '单线索成本'];
                sortField = 'cost_per_lead';
                break;
            case 'cost-per-account':
                tableTitle.textContent = '单客成本明细';
                headers = ['平台', '代理商', '账号ID', '账号名称', '花费', '开户数', '单客成本'];
                sortField = 'cost_per_account';
                break;
            case 'cpm':
                tableTitle.textContent = '千次曝光成本明细';
                headers = ['平台', '代理商', '账号ID', '账号名称', '花费', '曝光量', 'CPM'];
                sortField = 'cpm';
                break;
        }

        // 渲染表头
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        // 按成本指标排序
        const sortedData = [...this.currentData.data].sort((a, b) =>
            b.cost_metrics[sortField] - a.cost_metrics[sortField]
        );

        // 渲染表格内容
        sortedData.forEach(item => {
            const row = document.createElement('tr');

            switch (this.currentTab) {
                case 'cost-per-lead':
                    row.innerHTML = `
                        <td>${item.platform}</td>
                        <td>${item.agency}</td>
                        <td>${item.account_id}</td>
                        <td>${item.account_name || '-'}</td>
                        <td>${FormatHelper.formatCurrency(item.metrics.cost)}</td>
                        <td>${FormatHelper.formatNumber(item.metrics.leads)}</td>
                        <td>${FormatHelper.formatCurrency(item.cost_metrics.cost_per_lead)}</td>
                    `;
                    break;
                case 'cost-per-account':
                    row.innerHTML = `
                        <td>${item.platform}</td>
                        <td>${item.agency}</td>
                        <td>${item.account_id}</td>
                        <td>${item.account_name || '-'}</td>
                        <td>${FormatHelper.formatCurrency(item.metrics.cost)}</td>
                        <td>${FormatHelper.formatNumber(item.metrics.new_accounts)}</td>
                        <td>${FormatHelper.formatCurrency(item.cost_metrics.cost_per_account)}</td>
                    `;
                    break;
                case 'cpm':
                    row.innerHTML = `
                        <td>${item.platform}</td>
                        <td>${item.agency}</td>
                        <td>${item.account_id}</td>
                        <td>${item.account_name || '-'}</td>
                        <td>${FormatHelper.formatCurrency(item.metrics.cost)}</td>
                        <td>${FormatHelper.formatNumber(item.metrics.impressions)}</td>
                        <td>${FormatHelper.formatCurrency(item.cost_metrics.cpm)}</td>
                    `;
                    break;
            }

            tbody.appendChild(row);
        });
    }

    /**
     * 绑定事件
     */

    /**
     * 解绑事件（Phase 1: 修复事件监听器泄漏）
     * 在 bindEvents() 之前调用，防止重复绑定
     */
    unbindEvents() {
        // 使用 EventManager 清理所有事件监听器
        if (this.eventManager) {
            this.eventManager.off();
        }
    }

    bindEvents() {
        // Phase 1: 先解绑之前的事件，防止重复绑定
        this.unbindEvents();

        // 选项卡切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            this.eventManager.on(btn, 'click', () => {
                const tab = btn.dataset.tab;
                if (tab !== this.currentTab) {
                    this.currentTab = tab;
                    this.render();
                    // Phase 1: 移除递归调用 bindEvents()，改用局部重新绑定
                    this.bindTabEvents();
                }
            });
        });
    }

    /**
     * 绑定选项卡事件（Phase 1: 新增方法，避免递归调用 bindEvents）
     */
    bindTabEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            this.eventManager.on(btn, 'click', () => {
                const tab = btn.dataset.tab;
                if (tab !== this.currentTab) {
                    this.currentTab = tab;
                    this.render();
                    // 重新绑定选项卡事件（因为 DOM 已经重新渲染）
                    this.bindTabEvents();
                }
            });
        });
    }

    /**
     * 刷新数据
     */
    async refresh() {
        await this.loadData();
        this.render();
        // Phase 1: 移除递归调用 bindEvents()，改用局部重新绑定
        this.bindTabEvents();
    }

    /**
     * 显示错误
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    /**
     * 销毁实例（Phase 1: 完善事件监听器清理）
     */
    destroy() {
        // Phase 1: 解绑所有事件监听器
        this.unbindEvents();

        // 销毁事件管理器
        if (this.eventManager) {
            this.eventManager.destroy();
            this.eventManager = null;
        }

        // 清理数据
        this.currentData = null;
    }
}

// 导出到全局
window.CostAnalysisReport = CostAnalysisReport;
