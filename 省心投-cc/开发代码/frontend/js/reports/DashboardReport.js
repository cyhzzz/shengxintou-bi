/**
 * 省心投 BI - 数据概览报表 (Structured Clarity v2.1 业务层级优化)
 * 基于 PRD 文档规范实现
 * 使用 daily_metrics_unified 数据源
 * 支持深色模式
 *
 * 更新内容 (v2.1):
 * - 新增业务层级分组展示：投入效果、业务成果、效率指标
 * - 参考 Business Metrics Components 设计风格
 * - 新增"服务存量客户资产"指标卡片
 * - 客户资产和客户创收仅统计新开客户(is_opened_account=1)
 * - 新增总展示数指标
 */

class DashboardReport {
    constructor() {
        this.currentData = null;
        this.trendData = null;
        this.chartInstance = null;
        this.currentMetricType = 'cost_per_lead'; // 当前选中的指标类型
        this.currentGranularity = 'daily'; // 当前粒度: daily/weekly/monthly

        // 初始化筛选条件
        this.currentFilters = {
            platforms: [],
            agencies: [],
            business_models: [],
            start_date: null,
            end_date: null
        };

        // 初始化多选组件实例
        this.platformMultiSelect = null;
        this.agencyMultiSelect = null;
        this.businessModelMultiSelect = null;

        // Phase 1: 修复事件监听器泄漏
        this.eventManager = new EventManager();

        // 初始化元数据管理器
        this.metadataManager = new MetadataManager();

        this.init();
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化数据概览报表 (Structured Clarity v1.2)');

        // 隐藏数据卡片区域
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = 'none';
        }

        // 加载元数据
        await this.metadataManager.loadMetadata();

        // 渲染筛选器
        this.renderFilters();

        // 绑定事件
        this.bindFilterEvents();

        // 加载初始数据（"全部"模式）
        await this.loadData();

        // 渲染报表
        this.render();

        // 初始化数据新鲜度指示器
        this.initDataFreshnessIndicator();
    }

    /**
     * 初始化数据新鲜度指示器
     */
    initDataFreshnessIndicator() {
        try {
            this.dataFreshnessIndicator = new DataFreshnessIndicator('dataFreshnessContainer');
            console.log('[Dashboard] 数据新鲜度指示器初始化成功');
        } catch (error) {
            console.error('[Dashboard] 数据新鲜度指示器初始化失败:', error);
        }
    }

    /**
     * 计算上一周期的日期范围
     */
    getPreviousDateRange() {
        // 从筛选器获取当前日期范围
        const activeDateBtn = document.querySelector('.btn[data-days].is-active');
        const dateMode = activeDateBtn ? activeDateBtn.dataset.days : 'all';

        // 如果是"全部"模式，则无法计算上一周期
        if (dateMode === 'all') {
            return null;
        }

        // 获取当前选择的日期
        const startDateInput = document.getElementById('dashboardStartDate');
        const endDateInput = document.getElementById('dashboardEndDate');
        const startDate = startDateInput?.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput?.value ? new Date(endDateInput.value) : null;

        // 如果日期为空，则无法计算上一周期
        if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return null;
        }

        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);

        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - daysDiff + 1);

        // 再次检查计算后的日期是否有效
        if (isNaN(prevStartDate.getTime()) || isNaN(prevEndDate.getTime())) {
            return null;
        }

        return {
            start_date: prevStartDate.toISOString().split('T')[0],
            end_date: prevEndDate.toISOString().split('T')[0]
        };
    }

    /**
     * 渲染筛选器
     */
    renderFilters() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const filterHTML = `
            <div class="card card--filter card--full-width">
                <!-- 卡片头部：标题 + 操作按钮 -->
                <div class="card__header">
                    <h3 class="card__title">筛选条件</h3>
                    <div class="card__actions">
                        <button class="btn btn--secondary" id="resetBtn">重置</button>
                        <button class="btn btn--primary" id="queryBtn">查询</button>
                    </div>
                </div>

                <!-- 卡片主体：筛选器内容 -->
                <div class="card__body">
                    <div style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: var(--space-md);
                        align-items: flex-end;
                    ">
                        <!-- 平台筛选 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">平台</label>
                            <div id="platformMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 代理商筛选 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">代理商</label>
                            <div id="agencyMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 业务模式筛选 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">业务模式</label>
                            <div id="businessModelMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 日期范围 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 480px;">
                            <label class="form-label">日期范围</label>
                            <div style="
                                display: flex;
                                gap: 12px;
                                align-items: center;
                                white-space: nowrap;
                            ">
                                <!-- 日期输入 -->
                                <div style="display: inline-flex; gap: var(--space-sm); align-items: center;">
                                    <input type="date" id="dashboardStartDate" class="form-control" style="height: 32px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="dashboardEndDate" class="form-control" style="height: 32px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" style="display: inline-flex;">
                                    <button class="btn" data-days="all" style="height: 32px; white-space: nowrap;">全部</button>
                                    <button class="btn" data-days="7" style="height: 32px; white-space: nowrap;">近7天</button>
                                    <button class="btn is-active" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn" data-days="90" style="height: 32px; white-space: nowrap;">近90天</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = filterHTML;

        // 使用 setTimeout 确保 DOM 已经渲染
        setTimeout(() => {
            // 安全检查：确保 MultiSelectForm 类已加载
            if (typeof MultiSelectForm === 'undefined') {
                console.error('[Dashboard] 错误: MultiSelectForm 类未加载！请检查 MultiSelectForm.js 是否正确加载');
                console.error('[Dashboard] 当前页面URL:', window.location.href);
                return;
            }

            // 初始化平台多选下拉框
            const platforms = this.metadataManager.getPlatforms();
            console.log('[Dashboard] 初始化平台多选框，选项:', platforms);
            this.platformMultiSelect = new MultiSelectForm({
                container: 'platformMultiSelect',
                options: platforms,
                placeholder: '全部平台',
                onChange: (selectedValues) => {
                    this.currentFilters.platforms = selectedValues;
                }
            });

            // 初始化代理商多选下拉框
            const agencies = this.metadataManager.getAgencies();
            console.log('[Dashboard] 初始化代理商多选框，选项:', agencies);
            this.agencyMultiSelect = new MultiSelectForm({
                container: 'agencyMultiSelect',
                options: agencies,
                placeholder: '全部代理商',
                onChange: (selectedValues) => {
                    this.currentFilters.agencies = selectedValues;
                }
            });

            // 初始化业务模式多选下拉框
            const businessModels = this.metadataManager.getBusinessModels();
            console.log('[Dashboard] 初始化业务模式多选框，选项:', businessModels);
            this.businessModelMultiSelect = new MultiSelectForm({
                container: 'businessModelMultiSelect',
                options: businessModels,
                placeholder: '全部业务模式',
                onChange: (selectedValues) => {
                    this.currentFilters.business_models = selectedValues;
                }
            });

            console.log('[Dashboard] 多选组件初始化完成');
        }, 0);

        // 设置默认日期（近30天，与HTML中的激活状态一致）
        this.setDateRange(30);
    }

    /**
     * 解绑事件（Phase 1: 修复事件监听器泄漏）
     * 在 bindFilterEvents() 之前调用，防止重复绑定
     */
    unbindEvents() {
        // 使用 EventManager 清理所有事件监听器
        if (this.eventManager) {
            this.eventManager.off();
        }
    }

    /**
     * 绑定筛选器事件
     */
    bindFilterEvents() {
        // Phase 1: 先解绑之前的事件，防止重复绑定
        this.unbindEvents();

        // 日期快速选择按钮
        const dateButtons = document.querySelectorAll('.btn[data-days]');
        dateButtons.forEach(btn => {
            this.eventManager.on(btn, 'click', () => {
                const days = btn.dataset.days;
                if (days === 'all') {
                    // 全部：不设置日期输入框，清空激活状态
                    dateButtons.forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');

                    const startDateInput = document.getElementById('dashboardStartDate');
                    const endDateInput = document.getElementById('dashboardEndDate');
                    if (startDateInput && endDateInput) {
                        startDateInput.value = '';
                        endDateInput.value = '';
                    }
                } else {
                    // 近7天、近30天、近90天：设置对应的日期
                    this.setDateRange(parseInt(days));
                }
            });
        });

        // 自定义日期输入框变化事件
        const startDateInput = document.getElementById('dashboardStartDate');
        const endDateInput = document.getElementById('dashboardEndDate');

        const handleDateChange = () => {
            // 清除快速按钮的激活状态
            const allDateButtons = document.querySelectorAll('.btn[data-days]');
            allDateButtons.forEach(btn => btn.classList.remove('is-active'));
        };

        if (startDateInput) {
            this.eventManager.on(startDateInput, 'change', handleDateChange);
        }
        if (endDateInput) {
            this.eventManager.on(endDateInput, 'change', handleDateChange);
        }

        // 查询按钮
        const queryBtn = document.getElementById('queryBtn');
        if (queryBtn) {
            this.eventManager.on(queryBtn, 'click', async () => {
                await this.loadData();
                // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
                this.updateData();
            });
        }

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            this.eventManager.on(resetBtn, 'click', async () => {
                this.currentFilters = {
                    platforms: [],
                    agencies: [],
                    business_models: []
                };

                // 重置日期为默认（全部）
                const dateButtons = document.querySelectorAll('.btn[data-days]');
                dateButtons.forEach(btn => btn.classList.remove('is-active'));
                dateButtons[0].classList.add('is-active'); // 激活"全部"按钮

                const startDateInput = document.getElementById('dashboardStartDate');
                const endDateInput = document.getElementById('dashboardEndDate');
                if (startDateInput && endDateInput) {
                    startDateInput.value = '';
                    endDateInput.value = '';
                }

                // 重置多选下拉框
                this.platformMultiSelect?.clear();
                this.agencyMultiSelect?.clear();
                this.businessModelMultiSelect?.clear();

                // 重新加载数据
                await this.loadData();
                // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
                this.updateData();
            });
        }
    }

    /**
     * 设置日期范围（用于近7天、近30天、近90天快速选择）
     */
    setDateRange(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days + 1);

        // 格式化日期为 YYYY-MM-DD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        // 设置日期输入框的值
        const startDateInput = document.getElementById('dashboardStartDate');
        const endDateInput = document.getElementById('dashboardEndDate');
        if (startDateInput && endDateInput) {
            startDateInput.value = startDateStr;
            endDateInput.value = endDateStr;
        }

        // 更新按钮激活状态
        const dateButtons = document.querySelectorAll('.btn[data-days]');
        dateButtons.forEach(btn => {
            const btnDays = parseInt(btn.dataset.days);
            if (btnDays === days) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }

    /**
     * 获取筛选条件（参考厂商分析报表的实现）
     */
    getFilters() {
        // 检查哪个日期按钮被激活
        const activeDateBtn = document.querySelector('.btn[data-days].is-active');
        const dateMode = activeDateBtn ? activeDateBtn.dataset.days : 'all';

        // 从 MultiSelectForm 实例获取选中的值
        const platforms = this.platformMultiSelect?.getSelected() || [];
        const agencies = this.agencyMultiSelect?.getSelected() || [];
        const businessModels = this.businessModelMultiSelect?.getSelected() || [];

        const filters = {
            platforms,
            agencies,
            business_models: businessModels  // 修复：使用正确的变量名
        };

        // 参考厂商分析报表：只有当不是"全部"模式时才传日期
        if (dateMode !== 'all') {
            const startDate = document.getElementById('dashboardStartDate')?.value;
            const endDate = document.getElementById('dashboardEndDate')?.value;
            if (startDate && endDate) {
                filters.date_range = [startDate, endDate];
            }
        }

        console.log('[Dashboard] 获取筛选条件:', filters);
        return filters;
    }

    /**
     * 更新筛选条件（保留以兼容现有代码）
     */
    updateFilters() {
        const filters = this.getFilters();

        // 更新 currentFilters
        this.currentFilters.platforms = filters.platforms || [];
        this.currentFilters.agencies = filters.agencies || [];
        this.currentFilters.business_models = filters.business_models || [];
        this.currentFilters.start_date = filters.date_range?.[0] || null;
        this.currentFilters.end_date = filters.date_range?.[1] || null;
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            console.log('[Dashboard] 开始加载数据');

            // 获取当前筛选条件
            const filters = this.getFilters();
            console.log('[Dashboard] 使用筛选条件:', filters);

            // 并行加载当前周期和上一周期的数据
            const prevDateRange = this.getPreviousDateRange();

            // 构建请求列表（添加客户资产、客户贡献、存量客户资产和总展示数指标）
            const metricsList = ['cost', 'impressions', 'lead_users', 'opened_account_users', 'valid_customer_users', 'click_users', 'customer_assets', 'customer_contribution', 'existing_customers_assets'];
            console.log('[Dashboard] 请求的metrics列表:', metricsList);

            const requests = [
                API.queryData({
                    dimensions: [],
                    metrics: metricsList,
                    filters: filters,
                    granularity: 'summary'
                })
            ];

            // 如果有上一周期日期，则添加上一周期数据请求
            if (prevDateRange) {
                requests.push(
                    API.queryData({
                        dimensions: [],
                        metrics: ['cost', 'impressions', 'lead_users', 'opened_account_users', 'valid_customer_users', 'click_users', 'customer_assets', 'customer_contribution', 'existing_customers_assets'],
                        filters: {
                            date_range: [prevDateRange.start_date, prevDateRange.end_date],
                            ...(filters.platforms && { platforms: filters.platforms }),
                            ...(filters.agencies && { agencies: filters.agencies }),
                            ...(filters.business_models && { business_models: filters.business_models })
                        },
                        granularity: 'summary'
                    })
                );
            }

            // 🔧 性能优化: 并行加载趋势数据和核心数据 (Eliminating Waterfalls)
            const [currentResponse, previousResponse] = await Promise.all([
                Promise.all(requests),
                this.loadTrendData()
            ]);

            console.log('[Dashboard] 当前周期响应:', currentResponse[0]);
            console.log('[Dashboard] 上一周期响应:', previousResponse);

            if (!currentResponse[0].success) {
                throw new Error(currentResponse[0].error || '加载数据失败');
            }

            // 处理数据 (传递完整响应对象，而不是 .data)
            this.currentData = this.processDashboardData(currentResponse[0], previousResponse);

            // 趋势数据已在并行加载中完成

            console.log('[Dashboard] 数据加载成功', this.currentData);
            console.log('[Dashboard] 客户资产:', this.currentData.core_metrics?.customer_assets);
            console.log('[Dashboard] 客户贡献:', this.currentData.core_metrics?.customer_contribution);

        } catch (error) {
            console.error('[Dashboard] 数据加载失败:', error);
            this.showError('数据加载失败: ' + error.message);
        }
    }

    /**
     * 处理仪表盘数据
     */
    processDashboardData(currentData, previousData) {
        // 提取当前周期数据
        const current = currentData?.data?.[0] || {};
        const previous = previousData?.data?.[0] || {};

        const cost = parseFloat(current.metrics?.cost || 0);
        const impressions = parseInt(current.metrics?.impressions || 0);
        const leads = parseInt(current.metrics?.lead_users || 0);
        const opened = parseInt(current.metrics?.opened_account_users || 0);
        const valid = parseInt(current.metrics?.valid_customer_users || 0);
        const clicks = parseInt(current.metrics?.click_users || 0);
        const assets = parseFloat(current.metrics?.customer_assets || 0);
        const contribution = parseFloat(current.metrics?.customer_contribution || 0);
        const existingAssets = parseFloat(current.metrics?.existing_customers_assets || 0);

        const prevCost = parseFloat(previous.metrics?.cost || 0);
        const prevImpressions = parseInt(previous.metrics?.impressions || 0);
        const prevLeads = parseInt(previous.metrics?.lead_users || 0);
        const prevOpened = parseInt(previous.metrics?.opened_account_users || 0);
        const prevValid = parseInt(previous.metrics?.valid_customer_users || 0);
        const prevAssets = parseFloat(previous.metrics?.customer_assets || 0);
        const prevContribution = parseFloat(previous.metrics?.customer_contribution || 0);
        const prevExistingAssets = parseFloat(previous.metrics?.existing_customers_assets || 0);

        // 计算环比
        const calcWoW = (curr, prev, isCostMetric = false) => {
            if (prev === 0) return { value: 0, trend: 'up', color: 'green' };
            const percent = ((curr - prev) / prev) * 100;
            const trend = percent >= 0 ? 'up' : 'down';
            const color = isCostMetric ? (percent >= 0 ? 'red' : 'green') : (percent >= 0 ? 'green' : 'red');
            // 限制小数位数不超过2位
            return { value: parseFloat(Math.abs(percent).toFixed(2)), trend, color };
        };

        const costPerLead = leads > 0 ? cost / leads : 0;
        const costPerCustomer = opened > 0 ? cost / opened : 0;
        const costPerValidAccount = valid > 0 ? cost / valid : 0;

        const prevCostPerLead = prevLeads > 0 ? prevCost / prevLeads : 0;
        const prevCostPerCustomer = prevOpened > 0 ? prevCost / prevOpened : 0;
        const prevCostPerValidAccount = prevValid > 0 ? prevCost / prevValid : 0;

        return {
            core_metrics: {
                new_customers: opened,
                investment: cost,
                new_valid_accounts: valid,
                total_leads: leads,
                total_impressions: impressions,
                total_clicks: clicks,
                customer_assets: assets,
                customer_contribution: contribution,
                existing_customers_assets: existingAssets,
                cost_per_valid_account: parseFloat(costPerValidAccount.toFixed(2)),
                cost_per_lead: parseFloat(costPerLead.toFixed(2))
            },
            wow_changes: {
                new_customers: calcWoW(opened, prevOpened, false),
                investment: calcWoW(cost, prevCost, true),
                new_valid_accounts: calcWoW(valid, prevValid, false),
                total_leads: calcWoW(leads, prevLeads, false),
                total_impressions: calcWoW(impressions, prevImpressions, false),
                total_clicks: calcWoW(clicks, 0, true),
                customer_assets: calcWoW(assets, prevAssets, false),
                customer_contribution: calcWoW(contribution, prevContribution, false),
                existing_customers_assets: calcWoW(existingAssets, prevExistingAssets, false),
                cost_per_valid_account: calcWoW(costPerValidAccount, prevCostPerValidAccount, true),
                cost_per_lead: calcWoW(costPerLead, prevCostPerLead, true)
            }
        };
    }

    /**
     * 加载趋势数据
     */
    async loadTrendData() {
        try {
            const params = this.getFilters();

            const metricMap = {
                'cost_per_lead': ['cost', 'lead_users'],
                'cost_per_customer': ['cost', 'opened_account_users'],
                'cost_per_valid_account': ['cost', 'valid_customer_users']
            };

            // 添加粒度参数
            params.granularity = this.currentGranularity;

            const response = await API.getTrend(params, metricMap[this.currentMetricType] || metricMap['cost_per_lead']);

            if (!response.success) {
                throw new Error(response.error || '加载趋势数据失败');
            }

            // 处理趋势数据
            this.trendData = this.processTrendData(response.data);

        } catch (error) {
            console.error('[Dashboard] 趋势数据加载失败:', error);
            this.trendData = { trend_data: [] };
        }
    }

    /**
     * 处理趋势数据
     */
    processTrendData(data) {
        if (!data || !data.series) {
            return { trend_data: [] };
        }

        const dates = data.dates || [];
        const costSeries = data.series?.find(s => s.name === 'cost')?.data || [];
        const metricSeries = data.series?.find(s => s.name !== 'cost')?.data || [];

        const trendData = [];
        for (let i = 0; i < dates.length; i++) {
            const cost = costSeries[i] || 0;
            const metric = metricSeries[i] || 0;
            const value = metric > 0 ? cost / metric : 0;
            trendData.push({
                date: dates[i],
                value: parseFloat(value.toFixed(2))
            });
        }

        return { trend_data: trendData };
    }

    /**
     * 渲染报表（Phase 2优化：只创建一次DOM结构）
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        // 检查是否已经渲染过DOM结构
        if (container.querySelector('.dashboard-report')) {
            // DOM结构已存在，只需要更新数据
            this.updateData();
            return;
        }

        // 保留筛选器，移除旧内容
        const filterSection = container.querySelector('.card--filter');
        const oldContent = container.querySelectorAll('.dashboard-report, .card:not(.card--filter), #dataFreshnessContainer');
        oldContent.forEach(el => el.remove());

        // 在筛选器之前插入数据新鲜度指示器容器
        if (filterSection && !document.getElementById('dataFreshnessContainer')) {
            const freshnessDiv = document.createElement('div');
            freshnessDiv.id = 'dataFreshnessContainer';
            container.insertBefore(freshnessDiv, filterSection);
        }

        const contentHTML = `
            <div class="dashboard-report">
                <!-- 核心指标卡片区域 -->
                <div class="card card--full-width">
                    <div class="card__header">
                        <h3 class="card__title">核心指标</h3>
                    </div>
                    <div class="card__body">
                        <div class="metrics-cards" id="metricsCardsGrid">
                            ${this.renderMetricsCards()}
                        </div>
                    </div>
                </div>

                <!-- 趋势分析区域 -->
                <div class="card card--chart card--full-width">
                    <div class="card__header">
                        <h3 class="card__title">趋势分析</h3>
                    </div>
                    <div class="card__body">
                        <!-- 标签切换 -->
                        <div class="chart-controls" style="
                            margin-bottom: var(--space-lg);
                            display: flex;
                            gap: var(--space-xl);
                            align-items: center;
                            flex-wrap: wrap;
                        ">
                            <!-- 指标类型选择 -->
                            <div class="btn-group">
                                <button class="btn ${this.currentMetricType === 'cost_per_lead' ? 'is-active' : ''}"
                                        data-metric="cost_per_lead">单线索成本</button>
                                <button class="btn ${this.currentMetricType === 'cost_per_customer' ? 'is-active' : ''}"
                                        data-metric="cost_per_customer">单客户成本</button>
                                <button class="btn ${this.currentMetricType === 'cost_per_valid_account' ? 'is-active' : ''}"
                                        data-metric="cost_per_valid_account">单有效户成本</button>
                            </div>

                            <!-- 粒度选择 -->
                            <div style="display: flex; gap: var(--space-sm); align-items: center;">
                                <span class="chart-controls-label" style="
                                    font-size: var(--font-size-sm);
                                    color: var(--color-text-secondary);
                                ">粒度:</span>
                                <div class="btn-group">
                                    <button class="btn ${this.currentGranularity === 'daily' ? 'is-active' : ''}"
                                            data-granularity="daily">日级</button>
                                    <button class="btn ${this.currentGranularity === 'weekly' ? 'is-active' : ''}"
                                            data-granularity="weekly">周级</button>
                                    <button class="btn ${this.currentGranularity === 'monthly' ? 'is-active' : ''}"
                                            data-granularity="monthly">月级</button>
                                </div>
                            </div>
                        </div>

                        <!-- 图表容器 -->
                        <div id="trendChart" class="chart-container" style="width: 100%; height: 350px;"></div>

                        <!-- 核心指标明细 -->
                        <div class="metric-summary" style="
                            display: flex;
                            gap: var(--space-xl);
                            padding: var(--space-md);
                            background: var(--color-bg-secondary);
                            border-radius: var(--border-radius);
                            margin-top: var(--space-lg);
                            flex-wrap: wrap;
                        ">
                            <div class="summary-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span class="summary-label" style="
                                    font-size: var(--font-size-sm);
                                    color: var(--color-text-secondary);
                                ">单线索成本:</span>
                                <span class="summary-value" style="
                                    font-size: var(--font-size-md);
                                    font-weight: var(--font-weight-semibold);
                                    color: var(--color-primary);
                                ">
                                    ${this.formatCurrency(this.currentData?.core_metrics?.cost_per_lead || 0)}
                                </span>
                            </div>
                            <div class="summary-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span class="summary-label" style="
                                    font-size: var(--font-size-sm);
                                    color: var(--color-text-secondary);
                                ">单客户成本:</span>
                                <span class="summary-value" style="
                                    font-size: var(--font-size-md);
                                    font-weight: var(--font-weight-semibold);
                                    color: var(--color-primary);
                                ">
                                    ${this.formatCurrency(this.currentData?.core_metrics?.investment / this.currentData?.core_metrics?.new_customers || 0)}
                                </span>
                            </div>
                            <div class="summary-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span class="summary-label" style="
                                    font-size: var(--font-size-sm);
                                    color: var(--color-text-secondary);
                                ">单有效户成本:</span>
                                <span class="summary-value" style="
                                    font-size: var(--font-size-md);
                                    font-weight: var(--font-weight-semibold);
                                    color: var(--color-primary);
                                ">
                                    ${this.formatCurrency(this.currentData?.core_metrics?.cost_per_valid_account || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', contentHTML);

        // 渲染图表（异步加载 ECharts）
        setTimeout(async () => {
            await this.renderChart();
            this.bindTabEvents();
        }, 100);
    }

    /**
     * 更新数据（Phase 2优化：局部更新，避免全量重渲染）
     * 只更新数据部分，保留DOM结构
     */
    async updateData() {
        if (!this.currentData) return;

        // 更新指标卡片
        const metricsContainer = document.getElementById('metricsCardsGrid');
        if (metricsContainer) {
            metricsContainer.innerHTML = this.renderMetricsCards();
        }

        // 更新指标摘要
        this.updateMetricSummary();

        // 更新图表（异步加载 ECharts）
        if (this.chartInstance) {
            this.chartInstance.dispose();
        }
        await this.renderChart();
    }

    /**
     * 更新指标摘要（Phase 2新增）
     */
    updateMetricSummary() {
        if (!this.currentData || !this.currentData.core_metrics) return;

        const metrics = this.currentData.core_metrics;
        const summaryContainer = document.querySelector('.metric-summary');
        if (!summaryContainer) return;

        // 更新单线索成本
        const costPerLead = summaryContainer.querySelector('.summary-item:nth-child(1) .summary-value');
        if (costPerLead) {
            costPerLead.textContent = this.formatCurrency(metrics.cost_per_lead || 0);
        }

        // 更新单客户成本
        const costPerCustomer = summaryContainer.querySelector('.summary-item:nth-child(2) .summary-value');
        if (costPerCustomer) {
            const value = metrics.investment / metrics.new_customers || 0;
            costPerCustomer.textContent = this.formatCurrency(value);
        }

        // 更新单有效户成本
        const costPerValidAccount = summaryContainer.querySelector('.summary-item:nth-child(3) .summary-value');
        if (costPerValidAccount) {
            costPerValidAccount.textContent = this.formatCurrency(metrics.cost_per_valid_account || 0);
        }
    }

    /**
     * 渲染核心指标卡片 (Business Metrics Components v2.0 - 业务层级优化)
     */
    renderMetricsCards() {
        if (!this.currentData || !this.currentData.core_metrics) {
            return '<div class="loading-state">加载中...</div>';
        }

        const metrics = this.currentData.core_metrics;
        const wowChanges = this.currentData.wow_changes || {};

        // 定义三个业务层级的指标组
        const businessGroups = [
            {
                name: '前端投放',
                icon: '📊',
                description: '广告投放与获取效果',
                metrics: [
                    {
                        title: '阶段投入金额',
                        key: 'investment',
                        unit: '元',
                        value: this.formatCurrency(metrics.investment || 0),
                        wow: wowChanges.investment,
                        isPrimary: true,
                        isCostMetric: true
                    },
                    {
                        title: '总展示数',
                        key: 'impressions',
                        unit: '次',
                        value: this.formatNumber(metrics.total_impressions || 0),
                        wow: wowChanges.total_impressions
                    },
                    {
                        title: '总点击数',
                        key: 'total_clicks',
                        unit: '次',
                        value: this.formatNumber(metrics.total_clicks || 0),
                        wow: wowChanges.total_clicks
                    },
                    {
                        title: '总线索数',
                        key: 'total_leads',
                        unit: '个',
                        value: this.formatNumber(metrics.total_leads || 0),
                        wow: wowChanges.total_leads,
                        isPrimary: true
                    }
                ]
            },
            {
                name: '后端转化',
                icon: '💼',
                description: '客户获取与价值创造',
                metrics: [
                    {
                        title: '新开客户数',
                        key: 'new_customers',
                        unit: '户',
                        value: this.formatNumber(metrics.new_customers || 0),
                        wow: wowChanges.new_customers,
                        isPrimary: true
                    },
                    {
                        title: '新增有效户数',
                        key: 'new_valid_accounts',
                        unit: '户',
                        value: this.formatNumber(metrics.new_valid_accounts || 0),
                        wow: wowChanges.new_valid_accounts,
                        isPrimary: true
                    },
                    {
                        title: '客户资产',
                        key: 'customer_assets',
                        unit: '元',
                        value: this.formatCurrency(metrics.customer_assets || 0),
                        wow: wowChanges.customer_assets,
                        isHighlight: true
                    },
                    {
                        title: '客户今年创收',
                        key: 'customer_contribution',
                        unit: '元',
                        value: this.formatCurrency(metrics.customer_contribution || 0),
                        wow: wowChanges.customer_contribution,
                        isHighlight: true
                    },
                    {
                        title: '服务存量客户资产',
                        key: 'existing_customers_assets',
                        unit: '元',
                        value: this.formatCurrency(metrics.existing_customers_assets || 0),
                        wow: wowChanges.existing_customers_assets,
                        isHighlight: true
                    }
                ]
            },
            {
                name: '运营效率',
                icon: '⚡',
                description: '单位成本分析',
                metrics: [
                    {
                        title: '单线索成本',
                        key: 'cost_per_lead',
                        unit: '元',
                        value: this.formatCurrency(metrics.cost_per_lead || 0),
                        wow: wowChanges.cost_per_lead,
                        isCostMetric: true
                    },
                    {
                        title: '单开户成本',
                        key: 'cost_per_account',
                        unit: '元',
                        value: this.formatCurrency(metrics.investment / (metrics.new_customers || 1) || 0),
                        wow: { value: 0, trend: 'neutral', color: 'gray' },
                        isCostMetric: true
                    },
                    {
                        title: '单有效户成本',
                        key: 'cost_per_valid_account',
                        unit: '元',
                        value: this.formatCurrency(metrics.cost_per_valid_account || 0),
                        wow: wowChanges.cost_per_valid_account,
                        isCostMetric: true,
                        isPrimary: true
                    }
                ]
            }
        ];

        // 渲染业务层级分组
        return businessGroups.map(group => this.renderBusinessGroup(group)).join('');
    }

    /**
     * 渲染单个业务层级组
     */
    renderBusinessGroup(group) {
        const metricsCards = group.metrics.map(metric => this.renderMetricCard(metric)).join('');

        return `
            <div class="metrics-business-section">
                <div class="metrics-section-header">
                    <span style="font-size: 12px; font-weight: 500; color: #8A8D99; text-transform: uppercase; letter-spacing: 1px;">${group.name}</span>
                </div>
                <div class="metrics-section-content">
                    ${metricsCards}
                </div>
            </div>
        `;
    }

    /**
     * 渲染单个指标卡片 - 极简设计，无左侧色条
     */
    renderMetricCard(metric) {
        const wow = metric.wow || { value: 0, trend: 'up', color: 'green' };
        const trendIcon = wow.trend === 'up' ? '↑' : wow.trend === 'down' ? '↓' : '→';
        const trendSign = wow.value > 0 ? '+' : '';

        // 根据指标类型设置颜色
        let valueColor, labelColor, trendColor;
        if (metric.isHighlight) {
            // 资产类指标 - 绿色
            valueColor = '#277D4F';
            labelColor = '#8A8D99';
            trendColor = wow.color === 'green' ? '#277D4F' : wow.color === 'red' ? '#D5453D' : '#8A8D99';
        } else if (metric.isCostMetric) {
            // 成本指标 - 橙色
            valueColor = '#C2661F';
            labelColor = '#8A8D99';
            trendColor = wow.color === 'green' ? '#277D4F' : wow.color === 'red' ? '#D5453D' : '#8A8D99';
        } else if (metric.isPrimary) {
            // 核心指标 - 蓝色
            valueColor = '#0969DA';
            labelColor = '#8A8D99';
            trendColor = wow.color === 'green' ? '#277D4F' : wow.color === 'red' ? '#D5453D' : '#8A8D99';
        } else {
            // 普通指标 - 深灰色
            valueColor = '#171A23';
            labelColor = '#8A8D99';
            trendColor = wow.color === 'green' ? '#277D4F' : wow.color === 'red' ? '#D5453D' : '#8A8D99';
        }

        return `
            <div class="metric-card" style="
                background: #FFFFFF;
                border: 1px solid #E8EAED;
                padding: 16px 20px;
                border-radius: 8px;
                transition: all 0.2s ease;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-height: 88px;
            " onmouseover="this.style.borderColor='#0969DA'; this.style.boxShadow='0 2px 8px rgba(9, 105, 218, 0.08)'"
               onmouseout="this.style.borderColor='#E8EAED'; this.style.boxShadow='none'">
                <div style="font-size: 12px; color: ${labelColor}; font-weight: 500;">
                    ${metric.title}
                </div>
                <div style="font-size: 28px; font-weight: 600; color: ${valueColor}; line-height: 1; letter-spacing: -0.5px;">
                    ${metric.value}
                </div>
                <div style="font-size: 11px; color: #8A8D99; display: flex; align-items: center; gap: 4px;">
                    <span style="color: ${trendColor}; font-weight: 500;">${trendIcon}</span>
                    <span>${trendSign}${wow.value}%</span>
                    <span style="margin-left: 4px;">环比</span>
                </div>
            </div>
        `;
    }

    /**
     * 绑定标签切换事件
     */
    bindTabEvents() {
        // 指标类型切换
        const tabs = document.querySelectorAll('.btn-group .btn[data-metric]');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const metricType = e.target.dataset.metric;
                this.currentMetricType = metricType;

                // 更新标签状态
                tabs.forEach(t => t.classList.remove('is-active'));
                e.target.classList.add('is-active');

                // 重新加载趋势数据
                await this.loadTrendData();

                // 重新渲染图表（异步加载 ECharts）
                await this.renderChart();
            });
        });

        // 粒度切换
        const granularityTabs = document.querySelectorAll('.btn-group .btn[data-granularity]');
        granularityTabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const granularity = e.target.dataset.granularity;
                this.currentGranularity = granularity;

                // 更新标签状态
                granularityTabs.forEach(t => t.classList.remove('is-active'));
                e.target.classList.add('is-active');

                // 重新加载趋势数据
                await this.loadTrendData();

                // 重新渲染图表（异步加载 ECharts）
                await this.renderChart();
            });
        });
    }

    /**
     * 渲染图表
     */
    async renderChart() {
        const container = document.getElementById('trendChart');
        if (!container || !this.trendData || !this.trendData.trend_data) {
            return;
        }

        // 销毁旧图表
        if (this.chartInstance) {
            this.chartInstance.dispose();
        }

        // 🔧 性能优化: 延迟加载 ECharts
        const echarts = await window.loadECharts();

        const chartDom = container;
        this.chartInstance = echarts.init(chartDom);

        const trendData = this.trendData.trend_data;

        // 根据粒度格式化日期标签
        const dates = trendData.map(d => {
            const dateStr = d.date;

            if (this.currentGranularity === 'daily') {
                // 日级: MM/DD 格式
                const date = new Date(dateStr);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            } else if (this.currentGranularity === 'weekly') {
                // 周级: 2025-W01 格式
                return dateStr.replace('-W', '年第') + '周';
            } else if (this.currentGranularity === 'monthly') {
                // 月级: 2025-01 格式
                const [year, month] = dateStr.split('-');
                return `${month}月`;
            }
            return dateStr;
        });

        const values = trendData.map(d => d.value);

        // 指标名称映射
        const metricNames = {
            'cost_per_lead': '单线索成本',
            'cost_per_customer': '单客户成本',
            'cost_per_valid_account': '单有效户成本'
        };

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: '{b}<br/>{a}: {c} 元'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    formatter: '{value}'
                }
            },
            series: [{
                name: metricNames[this.currentMetricType] || '成本',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                data: values,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [{
                            offset: 0,
                            color: 'rgba(24, 144, 255, 0.3)'
                        }, {
                            offset: 1,
                            color: 'rgba(24, 144, 255, 0.05)'
                        }]
                    }
                },
                itemStyle: {
                    color: '#1890FF'
                },
                lineStyle: {
                    color: '#1890FF',
                    width: 2
                }
            }]
        };

        this.chartInstance.setOption(option);
    }

    /**
     * 格式化数字（千分位）
     */
    formatNumber(num) {
        if (!num || num === 0) return '0';
        return Number(num).toLocaleString();
    }

    /**
     * 格式化金额
     */
    formatCurrency(num) {
        if (!num || num === 0) return '¥0';
        return '¥' + Number(num).toFixed(2);
    }

    /**
     * 显示错误
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div class="card card--full-width">
                    <div class="card__body" style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <h3>加载失败</h3>
                        <p>${message}</p>
                        <button class="btn btn--primary" onclick="location.reload()">重新加载</button>
                    </div>
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

        // 销毁数据新鲜度指示器
        if (this.dataFreshnessIndicator) {
            this.dataFreshnessIndicator.destroy();
            this.dataFreshnessIndicator = null;
        }

        // 销毁多选下拉框组件
        this.platformMultiSelect?.destroy();
        this.agencyMultiSelect?.destroy();
        this.businessModelMultiSelect?.destroy();

        // 销毁图表
        if (this.chartInstance) {
            this.chartInstance.dispose();
            this.chartInstance = null;
        }

        // 清理数据
        this.currentData = null;
        this.trendData = null;
        this.currentFilters = null;
    }
}

// 导出到全局
window.DashboardReport = DashboardReport;
