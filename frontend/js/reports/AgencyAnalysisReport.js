/**
 * 省心投 BI - 代理商投放分析报表
 * 完全按照参考项目重新实现
 */

class AgencyAnalysisReport {
    constructor() {
        this.filterBar = null;
        this.currentData = null;
        this.chartInstance = null;
        this.currentMetric = 'cost'; // 当前图表指标

        // 多选组件引用
        this.platformMultiSelect = null;
        this.businessModelMultiSelect = null;
        this.agencyMultiSelect = null;

        // 平台颜色配置
        this.platformColors = {
            '腾讯': { main: '#52c41a', light: '#e6f7e6' },
            '小红书': { main: '#f5222d', light: '#fff1f0' },
            '抖音': { main: '#722ed1', light: '#f9f0ff' },
            '云极': { main: '#D4A574', light: '#F5EDE4' },
            'YJ': { main: '#D4A574', light: '#F5EDE4' },
            '高德': { main: '#1890ff', light: '#e6f7ff' }
        };

        // 指标配置（v3.0字段名）
        this.metrics = {
            cost: { name: '花费', unit: '元', precision: 2 },
            impressions: { name: '曝光', unit: '次', precision: 0 },
            click_users: { name: '点击人数', unit: '人', precision: 0 },
            lead_users: { name: '线索人数', unit: '人', precision: 0 },
            valid_customer_users: { name: '有效户人数', unit: '人', precision: 0 },
            opened_account_users: { name: '开户人数', unit: '人', precision: 0 }
        };

        // 初始化事件管理器（Phase 1: 修复事件监听器泄漏）
        this.eventManager = new EventManager();

        // 初始化元数据管理器
        this.metadataManager = new MetadataManager();

        this.init();
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化代理商投放分析报表');

        // 隐藏数据卡片区域
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = 'none';
        }

        // 0. 加载元数据
        await this.metadataManager.loadMetadata();

        // 1. 渲染独立筛选器（使用动态元数据）
        this.renderFilters();

        // 2. 绑定事件
        this.bindEvents();

        // 3. 立即加载全量数据（空筛选条件）
        console.log('[init] 开始加载全量数据');
        await this.loadData({});

        // 4. 渲染报表
        console.log('[init] 开始渲染报表');
        this.render();
    }

    /**
     * 渲染独立筛选器
     */
    renderFilters() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        // 筛选器HTML（与数据概览保持一致的样式）
        const filterHTML = `
            <div class="card card--filter card--full-width">
                <div class="card__header">
                    <h3 class="card__title">代理商投放分析</h3>
                    <div class="card__actions">
                        <button class="btn btn--secondary btn--sm" id="agencyResetBtn">重置</button>
                        <button class="btn btn--primary btn--sm" id="agencyQueryBtn">查询</button>
                    </div>
                </div>
                <div class="card__body">
                    <div style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: var(--space-md);
                        align-items: flex-end;
                    ">
                        <!-- 平台选择 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">平台</label>
                            <div id="agencyPlatformMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 业务模式 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">业务模式</label>
                            <div id="agencyBusinessModelMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 代理商 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 200px;">
                            <label class="form-label">代理商</label>
                            <div id="agencyAgencyMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 日期范围 - 与数据概览保持一致 -->
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
                                    <input type="date" id="agencyStartDate" class="form-control" style="height: 32px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="agencyEndDate" class="form-control" style="height: 32px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" style="display: inline-flex;">
                                    <button class="btn is-active" data-days="all" style="height: 32px; white-space: nowrap;">全部</button>
                                    <button class="btn" data-days="7" style="height: 32px; white-space: nowrap;">近7天</button>
                                    <button class="btn" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
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
                console.error('[AgencyAnalysis] 错误: MultiSelectForm 类未加载！请检查 MultiSelectForm.js 是否正确加载');
                return;
            }

            // 初始化平台多选下拉框
            // 注意：this.metadataManager.getPlatformOptions() 返回对象数组，需要转换为字符串数组
            const platformObjects = this.metadataManager.getPlatformOptions();
            const platforms = platformObjects.map(obj => obj.value || obj);
            console.log('[AgencyAnalysis] 初始化平台多选框，选项:', platforms);
            this.platformMultiSelect = new MultiSelectForm({
                container: 'agencyPlatformMultiSelect',
                options: platforms,
                placeholder: '全部平台',
                onChange: (selectedValues) => {
                    console.log('[AgencyAnalysis] 平台选择变化:', selectedValues);
                }
            });

            // 初始化业务模式多选下拉框
            const businessModelObjects = this.metadataManager.getBusinessModelOptions();
            const businessModels = businessModelObjects.map(obj => obj.value || obj);
            console.log('[AgencyAnalysis] 初始化业务模式多选框，选项:', businessModels);
            this.businessModelMultiSelect = new MultiSelectForm({
                container: 'agencyBusinessModelMultiSelect',
                options: businessModels,
                placeholder: '全部业务模式',
                onChange: (selectedValues) => {
                    console.log('[AgencyAnalysis] 业务模式选择变化:', selectedValues);
                }
            });

            // 初始化代理商多选下拉框
            const agencyObjects = this.metadataManager.getAgencyOptions();
            const agencies = agencyObjects.map(obj => obj.value || obj);
            console.log('[AgencyAnalysis] 初始化代理商多选框，选项:', agencies);
            this.agencyMultiSelect = new MultiSelectForm({
                container: 'agencyAgencyMultiSelect',
                options: agencies,
                placeholder: '全部代理商',
                onChange: (selectedValues) => {
                    console.log('[AgencyAnalysis] 代理商选择变化:', selectedValues);
                }
            });

            console.log('[AgencyAnalysis] 多选组件初始化完成');
        }, 0);

        // 设置默认日期（全部，与HTML中的激活状态一致）
        this.setDateRange('all');

        // 绑定筛选器事件
        this.bindFilterEvents();
    }

    /**
     * 绑定筛选器事件
     */
    bindFilterEvents() {
        // 日期快速选择按钮（全部、近7天、近30天、近90天）
        const dateButtons = document.querySelectorAll('.btn[data-days]');
        dateButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const days = btn.dataset.days;
                if (days === 'all') {
                    // 全部：清空日期输入框，激活"全部"按钮
                    dateButtons.forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');

                    const startDateInput = document.getElementById('agencyStartDate');
                    const endDateInput = document.getElementById('agencyEndDate');
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
        const startDateInput = document.getElementById('agencyStartDate');
        const endDateInput = document.getElementById('agencyEndDate');

        const handleDateChange = () => {
            // 清除快速按钮的激活状态
            const allDateButtons = document.querySelectorAll('.btn[data-days]');
            allDateButtons.forEach(btn => btn.classList.remove('is-active'));
        };

        startDateInput?.addEventListener('change', handleDateChange);
        endDateInput?.addEventListener('change', handleDateChange);

        // 查询按钮
        document.getElementById('agencyQueryBtn')?.addEventListener('click', async () => {
            await this.handleFilterChange();
        });

        // 重置按钮
        document.getElementById('agencyResetBtn')?.addEventListener('click', async () => {
            await this.resetFilters();
        });
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
        const startDateInput = document.getElementById('agencyStartDate');
        const endDateInput = document.getElementById('agencyEndDate');
        if (startDateInput && endDateInput) {
            startDateInput.value = startDateStr;
            endDateInput.value = endDateStr;
        }

        // 更新按钮激活状态
        const dateButtons = document.querySelectorAll('.btn[data-days]');
        dateButtons.forEach(btn => {
            const btnDays = btn.dataset.days;
            if (btnDays === String(days)) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        // 从 MultiSelectForm 组件获取选中的值
        const platforms = this.platformMultiSelect ? this.platformMultiSelect.getSelected() : [];
        const businessModels = this.businessModelMultiSelect ? this.businessModelMultiSelect.getSelected() : [];
        const agencies = this.agencyMultiSelect ? this.agencyMultiSelect.getSelected() : [];

        const filters = {
            platforms,
            business_models: businessModels,
            agencies
        };

        // 获取日期范围
        const startDate = document.getElementById('agencyStartDate')?.value;
        const endDate = document.getElementById('agencyEndDate')?.value;
        if (startDate && endDate) {
            filters.date_range = [startDate, endDate];
        }

        return filters;
    }

    /**
     * 重置筛选器
     */
    async resetFilters() {
        // 重置多选下拉框
        this.platformMultiSelect?.clear();
        this.businessModelMultiSelect?.clear();
        this.agencyMultiSelect?.clear();

        // 重置日期为默认（全部）
        this.setDateRange('all');

        // 重新加载数据
        await this.loadData({});
        // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
        this.updateData();
    }

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

    /**
     * 绑定事件
     */
    bindEvents() {
        // Phase 1: 先解绑之前的事件，防止重复绑定
        this.unbindEvents();

        // 监听筛选器变化
        this.eventManager.on(window, 'agencyFilterChange', (e) => {
            this.handleFilterChange(e.detail.filters);
        });

        // 导出按钮
        const exportBtn = document.getElementById('exportTableBtn');
        if (exportBtn) {
            this.eventManager.on(exportBtn, 'click', () => {
                this.exportTableToExcel();
            });
        }
    }

    /**
     * 处理筛选器变化
     */
    async handleFilterChange() {
        const filters = this.getFilters();
        console.log('筛选条件变化:', filters);
        this.filters = filters;
        await this.loadData(filters);
        // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
        this.updateData();
    }

    /**
     * 加载数据
     */
    async loadData(filters = null) {
        try {
            // 使用传入的filters，如果没有传入则使用空对象获取全量数据
            const finalFilters = filters !== null ? filters : {};

            console.log('[loadData] 使用筛选条件:', finalFilters);
            if (finalFilters.date_range) {
                console.log('[loadData] 日期范围:', finalFilters.date_range[0], '到', finalFilters.date_range[1]);
            }
            if (finalFilters.platforms) {
                console.log('[loadData] 平台筛选:', finalFilters.platforms);
            }
            if (finalFilters.agencies) {
                console.log('[loadData] 代理商筛选:', finalFilters.agencies);
            }
            if (finalFilters.business_models) {
                console.log('[loadData] 业务模式筛选:', finalFilters.business_models);
            }

            // 调用API获取代理商分析数据
            const response = await API.getAgencyAnalysis(finalFilters);

            if (response.error) {
                throw new Error(response.error);
            }

            this.currentData = response;
            console.log('代理商分析数据加载成功');

            if (this.currentData.summary) {
                // 按平台统计summary数据
                const platformSummary = {};
                this.currentData.summary.forEach(record => {
                    if (record.is_total || record.is_subtotal) return;
                    if (!platformSummary[record.platform]) {
                        platformSummary[record.platform] = 0;
                    }
                    platformSummary[record.platform] += record.metrics.lead_users || 0;
                });
                console.log('[loadData] Summary数据按平台统计（线索）:', platformSummary);
            }

            if (this.currentData.trend) {
                console.log('[loadData] 趋势数据:', this.currentData.trend.dates?.length, '个日期,', this.currentData.trend.series?.length, '条记录');

                // 按平台统计trend数据
                const platformTrendSummary = {};
                this.currentData.trend.series.forEach(record => {
                    if (!platformTrendSummary[record.platform]) {
                        platformTrendSummary[record.platform] = 0;
                    }
                    platformTrendSummary[record.platform] += record.metrics.lead_users || 0;
                });
                console.log('[loadData] Trend数据按平台统计（线索）:', platformTrendSummary);
            }

        } catch (error) {
            console.error('加载代理商分析数据失败:', error);
            this.showError(error.message);
        }
    }

    /**
     * 更新数据（Phase 2优化：局部更新，避免全量重渲染）
     */
    updateData() {
        if (!this.currentData) {
            console.warn('[updateData] 没有数据可更新');
            return;
        }

        console.log('[updateData] 开始更新数据');

        // 更新图表（如果数据已变化）
        this.renderChart();

        // 更新表格
        this.renderTable();

        console.log('[updateData] 数据更新完成');
    }

    /**
     * 渲染报表（Phase 2优化：只创建一次DOM结构）
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('找不到主内容容器');
            return;
        }

        // Phase 2: 检查是否已经渲染过内容区域
        if (container.querySelector('.data-section')) {
            console.log('[render] 内容区域已存在，只更新数据');
            // DOM结构已存在，只需要更新数据
            this.updateData();
            return;
        }

        console.log('[render] 首次渲染，创建DOM结构');

        // 保留筛选器部分，移除旧内容
        const filterSection = container.querySelector('.card--filter');
        const oldContent = container.querySelectorAll('.data-section');
        oldContent.forEach(el => el.remove());

        // 添加新的内容（全宽布局）
        const contentHTML = `
            <div class="data-section">
                <!-- 趋势图表卡片 -->
                <div class="card card--chart card--full-width">
                    <div class="card__header">
                        <h3 class="card__title">日级趋势图</h3>
                        <div class="card__actions">
                            <div class="btn-group" id="chartMetricSelector">
                                <button class="btn is-active" data-metric="cost">花费</button>
                                <button class="btn" data-metric="impressions">曝光</button>
                                <button class="btn" data-metric="click_users">点击</button>
                                <button class="btn" data-metric="lead_users">线索</button>
                                <button class="btn" data-metric="opened_account_users">开户</button>
                                <button class="btn" data-metric="valid_customer_users">有效户</button>
                            </div>
                        </div>
                    </div>
                    <div class="card__body">
                        <div id="trendChart" style="width: 100%; height: 350px;"></div>
                    </div>
                </div>

                <!-- 平台×代理商聚合数据表格卡片 -->
                <div class="card card--full-width">
                    <div class="card__header">
                        <h3 class="card__title">平台×代理商聚合数据</h3>
                        <div class="card__actions" id="tableStats">
                            <span class="stat-label">代理商数量:</span>
                            <span class="stat-value" id="agencyCount">-</span>
                            <span class="stat-divider">|</span>
                            <span class="stat-label">平台数量:</span>
                            <span class="stat-value" id="platformCount">-</span>
                        </div>
                    </div>
                    <div class="card__body">
                        <div class="table-container">
                            <table class="data-table" id="agencyTable">
                                <thead>
                                    <tr>
                                        <th>平台</th>
                                        <th>业务模式</th>
                                        <th>代理商</th>
                                        <th>花费</th>
                                        <th>曝光</th>
                                        <th>点击</th>
                                        <th>线索</th>
                                        <th>开户</th>
                                        <th>CTR</th>
                                        <th>线索成本</th>
                                        <th>开户成本</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card__footer">
                        <button class="btn btn--outline" id="exportTableBtn">
                            <i class="icon-download"></i>
                            导出数据
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', contentHTML);

        // 渲染各部分（使用setTimeout确保DOM完全创建）
        this.initChartMetricSelector();

        // 重新绑定导出按钮事件（因为render()重新创建了DOM）
        const exportBtn = document.getElementById('exportTableBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportTableToExcel();
            });
        }

        // 延迟渲染图表，确保DOM元素已完全创建
        setTimeout(async () => {
            await this.renderChart();
        }, 50);

        this.renderTable();
    }

    /**
     * 渲染指标卡片
     */
    renderMetrics() {
        if (!this.currentData || !this.currentData.summary) {
            return;
        }

        const container = document.getElementById('agencyMetrics');
        if (!container) {
            return;
        }

        // 计算总体指标
        let totalCost = 0;
        let totalImpressions = 0;
        let totalClickUsers = 0;
        let totalLeadUsers = 0;
        let totalOpenedAccountUsers = 0;
        let totalValidCustomerUsers = 0;

        this.currentData.summary.forEach(item => {
            totalCost += item.metrics.cost || 0;
            totalImpressions += item.metrics.impressions || 0;
            totalClickUsers += item.metrics.click_users || 0;
            totalLeadUsers += item.metrics.lead_users || 0;
            totalOpenedAccountUsers += item.metrics.opened_account_users || 0;
            totalValidCustomerUsers += item.metrics.valid_customer_users || 0;
        });

        // 计算衍生指标
        const clickRate = totalImpressions > 0 ? (totalClickUsers / totalImpressions * 100).toFixed(2) : '0.00';
        const leadRate = totalClickUsers > 0 ? (totalLeadUsers / totalClickUsers * 100).toFixed(2) : '0.00';
        const accountRate = totalLeadUsers > 0 ? (totalOpenedAccountUsers / totalLeadUsers * 100).toFixed(2) : '0.00';
        const validCustomerRate = totalOpenedAccountUsers > 0 ? (totalValidCustomerUsers / totalOpenedAccountUsers * 100).toFixed(2) : '0.00';
        const costPerLead = totalLeadUsers > 0 ? (totalCost / totalLeadUsers).toFixed(2) : '0.00';
        const costPerAccount = totalOpenedAccountUsers > 0 ? (totalCost / totalOpenedAccountUsers).toFixed(2) : '0.00';

        const metrics = [
            {
                title: '总花费',
                value: totalCost,
                prefix: '¥',
                type: 'primary'
            },
            {
                title: '总曝光',
                value: totalImpressions,
                format: 'number',
                type: 'info'
            },
            {
                title: '点击人数',
                value: totalClickUsers,
                format: 'number',
                type: 'success'
            },
            {
                title: '线索人数',
                value: totalLeadUsers,
                format: 'number',
                type: 'warning'
            },
            {
                title: '开户人数',
                value: totalOpenedAccountUsers,
                format: 'number',
                type: 'danger'
            },
            {
                title: '有效户人数',
                value: totalValidCustomerUsers,
                format: 'number',
                type: 'primary'
            },
            {
                title: '点击率',
                value: clickRate,
                suffix: '%',
                type: 'info'
            },
            {
                title: '线索转化率',
                value: leadRate,
                suffix: '%',
                type: 'warning'
            },
            {
                title: '线索成本',
                value: costPerLead,
                prefix: '¥',
                type: 'primary'
            }
        ];

        // 使用MetricCard组件渲染
        metrics.forEach(metric => {
            const card = new MetricCard(metric);
            container.appendChild(card.element);
        });
    }

    /**
     * 初始化图表指标切换器
     */
    initChartMetricSelector() {
        const selector = document.getElementById('chartMetricSelector');
        if (!selector) return;

        selector.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                console.log('[initChartMetricSelector] 切换指标到:', btn.dataset.metric);

                // 使用新的统一状态类
                selector.querySelectorAll('.btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this.currentMetric = btn.dataset.metric;

                // 强制重新渲染图表，确保使用最新数据
                // 销毁旧图表实例
                if (this.chartInstance) {
                    console.log('[initChartMetricSelector] 销毁旧图表实例');
                    this.chartInstance.dispose();
                    this.chartInstance = null;
                }

                // 重新渲染图表
                await this.renderChart();
            });
        });
    }

    /**
     * 渲染趋势图表（完全参考 agency_analysis.html 的实现）
     * 🔧 性能优化: 异步方法，支持延迟加载 ECharts
     */
    async renderChart() {
        console.log('[renderChart] Starting renderChart');

        if (!this.currentData || !this.currentData.trend) {
            console.warn('[renderChart] 没有趋势数据可渲染');
            return;
        }

        const { dates, series } = this.currentData.trend;

        console.log('[renderChart] dates:', dates ? dates.length : 0, 'series:', series ? series.length : 0);

        if (!dates || dates.length === 0) {
            console.warn('[renderChart] dates 为空');
            return;
        }

        if (!series || series.length === 0) {
            console.warn('[renderChart] series 为空');
            return;
        }

        const chartContainer = document.getElementById('trendChart');
        if (!chartContainer) {
            console.error('[renderChart] 找不到图表容器 #trendChart');
            return;
        }

        console.log('[renderChart] 图表容器尺寸:', {
            width: chartContainer.offsetWidth,
            height: chartContainer.offsetHeight,
            clientWidth: chartContainer.clientWidth,
            clientHeight: chartContainer.clientHeight
        });

        // 销毁旧图表实例，创建新实例（确保完全重新渲染）
        if (this.chartInstance) {
            console.log('[renderChart] 销毁旧图表实例');
            this.chartInstance.dispose();
            this.chartInstance = null;
        }

        console.log('[renderChart] 创建新图表实例');

        // 🔧 性能优化: 延迟加载 ECharts
        const echarts = await window.loadECharts();

        this.chartInstance = echarts.init(chartContainer);

        console.log('[renderChart] 开始处理数据，series 长度:', series.length);
        console.log('[renderChart] 第一条数据:', series[0]);
        console.log('[renderChart] 最后一条数据:', series[series.length - 1]);

        // 检查数据是否有非零值
        let hasNonZeroData = false;
        series.forEach(record => {
            if (record.metrics[this.currentMetric] && record.metrics[this.currentMetric] > 0) {
                hasNonZeroData = true;
            }
        });
        console.log('[renderChart] 是否有非零数据:', hasNonZeroData);
        console.log('[renderChart] 当前指标:', this.currentMetric);

        // 按日期和平台+代理商+业务模式分组
        // 系列名称格式:
        //   - 有代理商+业务模式: 平台-代理商-业务模式 (例如: 小红书-信息流-量子)
        //   - 只有代理商: 平台-代理商 (例如: 腾讯-量子)
        //   - 只有平台: 平台 (例如: YJ)
        const groupedData = {};
        series.forEach(record => {
            const key = `${record.platform}_${record.agency}_${record.business_model}`;

            // 构建系列名称：只在有值时用"-"连接
            const nameParts = [record.platform];
            if (record.agency) nameParts.push(record.agency);
            if (record.business_model) nameParts.push(record.business_model);

            // 为未归因数据添加明确标识
            let displayName = nameParts.join('-');
            if (!record.agency && !record.business_model) {
                // 完全未归因（无代理商、无业务模式）
                displayName = `${record.platform}-未归因`;
            } else if (!record.agency || !record.business_model) {
                // 部分未归因（有业务模式但无代理商，或有代理商但无业务模式）
                displayName = `${displayName} (未归因)`;
            }

            if (!groupedData[key]) {
                groupedData[key] = {
                    name: displayName,
                    platform: record.platform,
                    agency: record.agency,
                    business_model: record.business_model,
                    data: []
                };
            }
            groupedData[key].data.push({
                date: record.date,
                value: record.metrics[this.currentMetric] || 0
            });
        });

        console.log('[renderChart] 分组后数据:', Object.keys(groupedData).length, '个系列');

        // 列出所有未归因的系列
        const unattributedSeries = Object.values(groupedData).filter(g => !g.agency || !g.business_model);
        if (unattributedSeries.length > 0) {
            console.log('[renderChart] 未归因系列:', unattributedSeries.map(s => ({
                name: s.name,
                agency: s.agency === '' ? "''" : s.agency,
                business_model: s.business_model === '' ? "''" : s.business_model,
                dataPoints: s.data.length
            })));
        }

        // 获取所有日期（从 dates 数组中）
        const allDates = [...new Set(dates)].sort();

        console.log('[renderChart] 日期范围:', allDates[0], '到', allDates[allDates.length - 1]);

        // 构建系列数据
        const chartSeries = Object.values(groupedData).map(group => {
            const dataMap = new Map(group.data.map(d => [d.date, d.value]));
            const data = allDates.map(date => dataMap.get(date) || 0);

            return {
                name: group.name,
                type: 'bar',
                stack: 'total',
                data: data,
                itemStyle: {
                    color: this.platformColors[group.platform]?.main || '#999'
                },
                emphasis: {
                    focus: 'series'
                }
            };
        });

        console.log('[renderChart] 图表系列数量:', chartSeries.length);

        // 显示包含非零数据的未归因系列
        const unattributedSeriesWithData = chartSeries.filter(s =>
            s.name.includes('未归因') && s.data.some(v => v > 0)
        );
        if (unattributedSeriesWithData.length > 0) {
            console.log('[renderChart] 包含非零数据的未归因系列:', unattributedSeriesWithData.map(s => ({
                name: s.name,
                totalValue: s.data.reduce((a, b) => a + b, 0)
            })));
        }

        console.log('[renderChart] 第一个系列数据点数:', chartSeries[0]?.data.length);

        const metricInfo = this.metrics[this.currentMetric];

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                formatter: function(params) {
                    if (!params || params.length === 0) return '';

                    const date = params[0].axisValue;
                    let tooltip = `<div style="margin-bottom: 5px;"><strong>${date}</strong></div>`;
                    let total = 0;

                    // 过滤掉值为0的系列
                    const validParams = params.filter(param => (param.value || 0) > 0);

                    if (validParams.length === 0) {
                        return `<div style="margin-bottom: 5px;"><strong>${date}</strong></div><div style="color: #999;">当日无数据</div>`;
                    }

                    validParams.forEach(param => {
                        const value = param.value || 0;
                        total += value;
                        tooltip += `<div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>${param.marker} ${param.seriesName}</span>
                            <span>${FormatHelper.formatNumber(value, metricInfo.precision)} ${metricInfo.unit}</span>
                        </div>`;
                    });

                    tooltip += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee;">
                        <strong>合计: ${FormatHelper.formatNumber(total, metricInfo.precision)} ${metricInfo.unit}</strong>
                    </div>`;

                    return tooltip;
                }
            },
            legend: {
                data: Object.values(groupedData).map(g => g.name),
                top: 0,
                type: 'scroll'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '60px',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: allDates,
                axisLabel: {
                    rotate: 45,
                    formatter: function(value) {
                        return value.substring(5); // 只显示 MM-DD
                    }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    formatter: function(value) {
                        if (value >= 10000) {
                            return (value / 10000).toFixed(1) + 'w';
                        }
                        return value;
                    }
                }
            },
            series: chartSeries,
            dataZoom: [
                {
                    type: 'slider',
                    show: allDates.length > 60,
                    start: 0,
                    end: 100
                }
            ]
        };

        console.log('[renderChart] 图表配置:', {
            legendData: option.legend.data.length,
            xAxisDataLength: option.xAxis.data.length,
            seriesCount: option.series.length,
            firstSeriesDataLength: option.series[0].data.length,
            firstSeriesDataSample: option.series[0].data.slice(0, 5)
        });

        this.chartInstance.setOption(option, true);
        console.log('[renderChart] 图表渲染完成');

        // 验证图表是否真的渲染了
        setTimeout(() => {
            const chartInstance = this.chartInstance;
            if (chartInstance) {
                const renderedOption = chartInstance.getOption();
                console.log('[renderChart] 验证渲染结果:', {
                    hasSeries: !!renderedOption.series,
                    seriesCount: renderedOption.series ? renderedOption.series.length : 0,
                    hasXAxis: !!renderedOption.xAxis,
                    xAxisDataLength: renderedOption.xAxis ? (renderedOption.xAxis[0]?.data?.length || 0) : 0
                });
            }
        }, 100);
    }

    /**
     * 渲染表格
     */
    renderTable() {
        if (!this.currentData || !this.currentData.summary) {
            return;
        }

        const tbody = document.querySelector('#agencyTable tbody');
        if (!tbody) return;

        const data = this.currentData.summary;

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div>暂无数据，请调整筛选条件</div>
                    </td>
                </tr>
            `;
            this.updateStats([]);
            return;
        }

        // 使用统一的排序方法
        const sortedData = this.getSortedData(data);

        tbody.innerHTML = sortedData.map(record => {
            const m = record.metrics;
            const ctr = m.impressions > 0 ? (m.click_users / m.impressions * 100) : 0;
            // 使用后端返回的成本数据，如果没有则本地计算
            const leadCost = m.lead_cost !== undefined ? m.lead_cost : (m.lead_users > 0 ? (m.cost / m.lead_users) : 0);
            const accountCost = m.account_cost !== undefined ? m.account_cost : (m.opened_account_users > 0 ? (m.cost / m.opened_account_users) : 0);

            const platformClass = this.getPlatformClass(record.platform);
            // agency 为空时显示为"未归因"
            const agencyDisplay = record.agency || '未归因';

            // 判断是否为小计或合计行
            const isSubtotal = record.is_subtotal;
            const isTotal = record.is_total;
            const isSummaryRow = isSubtotal || isTotal;

            // 小计或合计行的特殊样式
            const rowClass = isSubtotal ? 'subtotal-row' : (isTotal ? 'total-row' : '');

            return `
                <tr class="${rowClass}">
                    <td>${isTotal ? '<strong>全部</strong>' : (isSubtotal ? `<strong>${record.platform}</strong>` : `<span class="platform-tag platform-${platformClass}">${record.platform}</span>`)}</td>
                    <td>${isTotal || isSubtotal ? '-' : `<span class="business-model-tag">${record.business_model || '-'}</span>`}</td>
                    <td><strong>${agencyDisplay}</strong></td>
                    <td class="number">${this.formatTableCellValue(m.cost, isSummaryRow, 2)}</td>
                    <td class="number">${this.formatTableCellValue(m.impressions, isSummaryRow, 0)}</td>
                    <td class="number">${this.formatTableCellValue(m.click_users, isSummaryRow, 0)}</td>
                    <td class="number">${this.formatTableCellValue(m.lead_users, isSummaryRow, 0)}</td>
                    <td class="number">${this.formatTableCellValue(m.opened_account_users, isSummaryRow, 0)}</td>
                    <td class="number">${ctr > 0 || isSummaryRow ? ctr.toFixed(2) + '%' : '<span style="color: #999;">-</span>'}</td>
                    <td class="number">${this.formatTableCellValue(leadCost, isSummaryRow, 2)}</td>
                    <td class="number">${this.formatTableCellValue(accountCost, isSummaryRow, 2)}</td>
                </tr>
            `;
        }).join('');

        // 更新统计信息（传入排序后的数据）
        this.updateStats(sortedData);
    }

    /**
     * 更新统计信息
     */
    updateStats(data) {
        if (!data || data.length === 0) {
            const agencyCountEl = document.getElementById('agencyCount');
            const platformCountEl = document.getElementById('platformCount');
            if (agencyCountEl) agencyCountEl.textContent = '0';
            if (platformCountEl) platformCountEl.textContent = '0';
            return;
        }

        // 统计不重复的代理商（排除空值和小计/合计行）
        const agencies = new Set();
        const platforms = new Set();

        data.forEach(record => {
            // 排除小计和合计行
            if (record.is_subtotal || record.is_total) return;

            // 统计平台
            if (record.platform) {
                platforms.add(record.platform);
            }

            // 统计代理商（排除未归因的空值）
            if (record.agency && record.agency !== '未归因') {
                agencies.add(record.agency);
            }
        });

        const agencyCountEl = document.getElementById('agencyCount');
        const platformCountEl = document.getElementById('platformCount');

        if (agencyCountEl) {
            agencyCountEl.textContent = agencies.size.toLocaleString();
        }
        if (platformCountEl) {
            platformCountEl.textContent = platforms.size.toLocaleString();
        }
    }

    /**
     * 格式化表格单元格数值
     * @param {number} value - 要格式化的数值
     * @param {boolean} isSummaryRow - 是否为小计/合计行
     * @param {number} decimals - 小数位数
     * @returns {string} 格式化后的字符串
     */
    formatTableCellValue(value, isSummaryRow, decimals = 0) {
        // 如果是小计/合计行，正常显示数值（包括0）
        if (isSummaryRow) {
            return FormatHelper.formatNumber(value || 0, decimals);
        }

        // 如果是0值，显示为"-"（代表可能未归因）
        if (value === 0 || value === null || value === undefined) {
            return '<span style="color: #999;">-</span>';
        }

        // 其他情况正常格式化
        return FormatHelper.formatNumber(value, decimals);
    }

    /**
     * 获取平台CSS类
     */
    getPlatformClass(platform) {
        const classMap = {
            '腾讯': 'tencent',
            '小红书': 'xiaohongshu',
            '抖音': 'douyin'
        };
        return classMap[platform] || '';
    }

    /**
     * 获取排序后的数据（供表格渲染和导出使用）
     * 重要：不过滤任何数据，保留所有记录（包括未归因的数据）
     */
    getSortedData(data) {
        if (!data || data.length === 0) {
            return [];
        }

        // 按平台、业务模式和代理商排序（不进行任何过滤）
        return [...data].sort((a, b) => {
            if (a.platform !== b.platform) {
                return a.platform.localeCompare(b.platform);
            }
            if (a.business_model !== b.business_model) {
                return a.business_model.localeCompare(b.business_model);
            }
            // agency 为空时排在最后
            if (!a.agency) return 1;
            if (!b.agency) return -1;
            return a.agency.localeCompare(b.agency);
        });
    }

    /**
     * 导出平台×代理商聚合数据为Excel（CSV格式）
     */
    exportTableToExcel() {
        if (!this.currentData || !this.currentData.summary || this.currentData.summary.length === 0) {
            alert('暂无数据可导出');
            return;
        }

        // 获取当前显示的数据（已排序）
        const sortedData = this.getSortedData(this.currentData.summary);

        if (sortedData.length === 0) {
            alert('暂无数据可导出');
            return;
        }

        // CSV表头
        const headers = ['平台', '业务模式', '代理商', '花费', '曝光', '点击', '线索', '开户', 'CTR', '线索成本', '开户成本'];

        // 构建CSV内容
        const csvRows = [headers.join(',')];

        sortedData.forEach(record => {
            const m = record.metrics;
            const ctr = m.impressions > 0 ? (m.click_users / m.impressions * 100).toFixed(2) : '0.00';
            const leadCost = m.lead_cost !== undefined ? m.lead_cost :
                           (m.lead_users > 0 ? (m.cost / m.lead_users).toFixed(2) : '0.00');
            const accountCost = m.account_cost !== undefined ? m.account_cost :
                              (m.opened_account_users > 0 ? (m.cost / m.opened_account_users).toFixed(2) : '0.00');

            // 判断是否为小计/合计行
            const isSubtotal = record.is_subtotal;
            const isTotal = record.is_total;

            // 平台显示
            const platform = isTotal ? '全部' : (isSubtotal ? `${record.platform}（小计）` : record.platform);
            // 业务模式显示
            const businessModel = (isTotal || isSubtotal) ? '' : (record.business_model || '');
            // 代理商显示
            const agency = isTotal ? '' : (isSubtotal ? '' : (record.agency || '未归因'));

            const row = [
                platform,
                businessModel,
                agency,
                m.cost.toFixed(2),
                m.impressions,
                m.click_users,
                m.lead_users,
                m.opened_account_users,
                ctr + '%',
                leadCost,
                accountCost
            ];

            // 处理包含逗号的字段，用双引号包裹
            csvRows.push(row.map(cell =>
                typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
                    ? `"${cell.replace(/"/g, '""')}"`
                    : cell
            ).join(','));
        });

        const csvContent = csvRows.join('\n');

        // 创建Blob对象（添加UTF-8 BOM以支持Excel正确显示中文）
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

        // 创建下载链接
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);

        // 生成文件名（包含日期时间）
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        link.setAttribute('download', `厂商分析聚合数据_${dateStr}_${timeStr}.csv`);

        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 释放URL对象
        URL.revokeObjectURL(url);

        console.log('[exportTableToExcel] 导出完成');
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
     * 销毁实例
     */
    destroy() {
        // Phase 1: 解绑所有事件监听器
        this.unbindEvents();

        // 销毁事件管理器
        if (this.eventManager) {
            this.eventManager.destroy();
            this.eventManager = null;
        }

        // 销毁图表
        if (this.chartInstance) {
            this.chartInstance.dispose();
            this.chartInstance = null;
        }

        // 清理数据
        this.currentData = null;
    }
}

// 导出到全局
window.AgencyAnalysisReport = AgencyAnalysisReport;
