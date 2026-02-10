/**
 * 转化漏斗报表 (7层漏斗)
 * 使用 daily_metrics_unified 表数据
 * 1. 曝光 → 2. 点击人数 → 3. 线索人数 → 4. 开口人数 → 5. 有效线索 → 6. 开户人数 → 7. 有效户人数
 */

class ConversionFunnelReport {
    constructor() {
        this.data = null;
        this.filterBar = null;
        this.charts = {};

        // Phase 1: 修复事件监听器泄漏
        this.eventManager = new EventManager();

        // 初始化元数据管理器
        this.metadataManager = new MetadataManager();

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('转化漏斗报表初始化...');

        // 加载元数据
        await this.metadataManager.loadMetadata();

        // 创建筛选器（使用动态元数据）
        this.createFilterBar();

        // 绑定事件
        this.bindEvents();

        // 加载初始数据（空筛选条件，加载全量数据）
        await this.loadData();

        // 渲染报表
        this.render();
    }

    /**
     * 创建筛选器（独立的代理商筛选器）
     */
    createFilterBar() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <!-- 筛选器卡片 -->
            <div class="card card--filter card--full-width">
                <div class="card__body">
                    <!-- 筛选器内容容器 - 使用 flex + wrap -->
                    <div class="filter-bar-content" style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: 16px;
                        align-items: center;
                    ">
                        <!-- 平台筛选容器 -->
                        <div id="platformFilterContainer"></div>

                        <!-- 业务模式筛选容器 -->
                        <div id="businessModelFilterContainer"></div>

                        <!-- 代理商筛选 -->
                        <div class="filter-group">
                            <label class="filter-label">代理商:</label>
                            <div id="filterAgency" style="min-width: 200px;"></div>
                        </div>

                        <!-- 日期范围 -->
                        <div class="filter-group">
                            <label class="filter-label">日期范围:</label>
                            <div class="btn-group">
                                <button class="btn is-active" data-days="7">近7天</button>
                                <button class="btn" data-days="30">近30天</button>
                                <button class="btn" data-days="90">近90天</button>
                            </div>
                            <div class="date-range-picker" style="display: none; margin-left: 8px;">
                                <input type="date" id="startDate" class="form-control">
                                <span class="date-separator">至</span>
                                <input type="date" id="endDate" class="form-control">
                            </div>
                        </div>

                        <!-- 操作按钮 - 靠右对齐 -->
                        <div class="filter-actions" style="
                            display: flex;
                            gap: 8px;
                            margin-left: auto;
                        ">
                            <button class="btn btn--primary" id="btnQuery">查询</button>
                            <button class="btn btn--secondary" id="btnReset">重置</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 初始化平台多选下拉框（使用元数据管理器）
        this.platformFilter = new MultiSelectDropdown({
            container: 'platformFilterContainer',
            id: 'platformFilter',
            label: '平台',
            placeholder: '选择平台',
            options: this.metadataManager.getPlatformOptions(),
            onChange: () => {}
        });

        // 初始化业务模式多选下拉框（使用元数据管理器）
        this.businessModelFilter = new MultiSelectDropdown({
            container: 'businessModelFilterContainer',
            id: 'businessModelFilter',
            label: '业务模式',
            placeholder: '选择业务模式',
            options: this.metadataManager.getBusinessModelOptions(),
            onChange: () => {}
        });

        // 初始化代理商多选下拉框（使用元数据管理器）
        this.agencyDropdown = new MultiSelectDropdown({
            container: 'filterAgency',
            id: 'agencyFilter',
            label: '代理商',
            placeholder: '选择代理商',
            options: this.metadataManager.getAgencyOptions(),
            onChange: (selected) => {
                console.log('已选择代理商:', selected);
            }
        });

        // 初始化日期
        this.initializeDateFilters();
    }

    /**
     * 初始化日期筛选器
     */
    initializeDateFilters() {
        const dateButtons = document.querySelectorAll('.btn-group .btn');
        const dateRangePicker = document.querySelector('.date-range-picker');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        // 设置默认日期范围（近7天）
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);

        this.startDate = start.toISOString().split('T')[0];
        this.endDate = end.toISOString().split('T')[0];

        if (startDateInput) startDateInput.value = this.startDate;
        if (endDateInput) endDateInput.value = this.endDate;

        // 快速日期按钮点击事件
        dateButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 移除所有激活状态
                dateButtons.forEach(b => b.classList.remove('is-active'));
                // 激活当前按钮
                e.target.classList.add('is-active');

                // 隐藏自定义日期选择器
                if (dateRangePicker) {
                    dateRangePicker.style.display = 'none';
                }

                // 计算日期范围
                const days = parseInt(e.target.dataset.days);
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - days);

                this.startDate = start.toISOString().split('T')[0];
                this.endDate = end.toISOString().split('T')[0];
            });
        });

        // 自定义日期输入事件
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.startDate = e.target.value;
                // 移除快速按钮的激活状态
                dateButtons.forEach(b => b.classList.remove('is-active'));
                // 显示自定义日期选择器
                if (dateRangePicker) {
                    dateRangePicker.style.display = 'flex';
                }
            });

            endDateInput.addEventListener('change', (e) => {
                this.endDate = e.target.value;
                // 移除快速按钮的激活状态
                dateButtons.forEach(b => b.classList.remove('is-active'));
                // 显示自定义日期选择器
                if (dateRangePicker) {
                    dateRangePicker.style.display = 'flex';
                }
            });
        }
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

        // 查询按钮
        const btnQuery = document.getElementById('btnQuery');
        if (btnQuery) {
            this.eventManager.on(btnQuery, 'click', () => {
                this.handleQuery();
            });
        }

        // 重置按钮
        const btnReset = document.getElementById('btnReset');
        if (btnReset) {
            this.eventManager.on(btnReset, 'click', () => {
                this.handleReset();
            });
        }
    }

    /**
     * 处理查询
     */
    async handleQuery() {
        const filters = this.getFilters();
        console.log('执行查询，筛选条件:', filters);
        await this.loadData(filters);
        this.render();
    }

    /**
     * 处理重置
     */
    async handleReset() {
        // 重置平台筛选
        if (this.platformFilter) {
            this.platformFilter.clearAll();
        }

        // 重置业务模式筛选
        if (this.businessModelFilter) {
            this.businessModelFilter.clearAll();
        }

        // 重置代理商筛选
        if (this.agencyDropdown) {
            this.agencyDropdown.clearAll();
        }

        // 重置日期筛选
        const dateButtons = document.querySelectorAll('.btn-group .btn');
        dateButtons.forEach(btn => btn.classList.remove('is-active'));
        dateButtons[0].classList.add('is-active'); // 默认选中"近7天"

        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        this.startDate = start.toISOString().split('T')[0];
        this.endDate = end.toISOString().split('T')[0];

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput) startDateInput.value = this.startDate;
        if (endDateInput) endDateInput.value = this.endDate;

        // 重新加载数据（空筛选条件）
        await this.loadData({});
        this.render();
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        // 从 MultiSelectDropdown 组件获取选中的值
        const platforms = this.platformFilter ? this.platformFilter.getSelectedValues() : [];
        const businessModels = this.businessModelFilter ? this.businessModelFilter.getSelectedValues() : [];
        const agencies = this.agencyDropdown ? this.agencyDropdown.getSelectedValues() : [];

        return {
            platforms: platforms.length > 0 ? platforms : null,
            business_models: businessModels.length > 0 ? businessModels : null,
            agencies: agencies.length > 0 ? agencies : null,
            date_range: [this.startDate, this.endDate]
        };
    }

    /**
     * 加载数据
     */
    async loadData(filters = {}) {
        try {
            // 如果没有筛选条件，设置默认日期范围
            if (!filters.date_range) {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7);
                filters.date_range = [
                    start.toISOString().split('T')[0],
                    end.toISOString().split('T')[0]
                ];
            }

            console.log('加载数据，筛选条件:', filters);
            const response = await API.post('/conversion-funnel', { filters });

            if (response.error) {
                throw new Error(response.error);
            }

            this.data = response.data;
            console.log('转化漏斗数据加载成功:', this.data);
        } catch (error) {
            console.error('数据加载失败:', error);
            this.showError('数据加载失败: ' + error.message);
        }
    }

    /**
     * 渲染报表
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        // 移除旧的报表内容（保留筛选器）
        const oldContent = container.querySelectorAll(':scope > .card:not(.card--filter)');
        oldContent.forEach(el => el.remove());

        // 创建报表内容HTML（两列布局，全宽）
        container.insertAdjacentHTML('beforeend', `
            <!-- 报表内容区域（两列布局） -->
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 20px;
            ">
                <!-- 左侧卡片：转化率数据 -->
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">转化率数据</h3>
                    </div>
                    <div class="card__body">
                        <div id="conversionRateList"></div>
                    </div>
                </div>

                <!-- 右侧卡片：核心数据 + 转化漏斗 -->
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">转化核心数据 & 漏斗</h3>
                    </div>
                    <div class="card__body">
                        <!-- 核心数据指标 -->
                        <div id="coreMetrics" style="margin-bottom: 20px;"></div>
                        <!-- 转化漏斗图 -->
                        <div id="funnelChart" style="width: 100%; height: 400px;"></div>
                        <!-- 合并转化率 -->
                        <div id="combinedRates" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
        `);

        // 渲染各部分内容
        this.renderConversionRateList();
        this.renderCoreMetrics();
        this.renderFunnelChart(); // 🔧 性能优化: 异步调用
        this.renderCombinedRates();
    }

    /**
     * 渲染转化率数据列表（7步）
     */
    renderConversionRateList() {
        const container = document.getElementById('conversionRateList');
        if (!container) return;

        if (!this.data || !this.data.funnel || this.data.funnel.length < 7) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">暂无数据</p>';
            return;
        }

        const funnel = this.data.funnel;

        // 7层漏斗步骤名称
        const stepNames = [
            '广告曝光',
            '客户点击',
            '客户线索',
            '客户开口',
            '有效线索',
            '成功开户',
            '有效户'
        ];

        let html = '<div class="conversion-steps">';

        funnel.forEach((step, index) => {
            const currentValue = step.value || 0;
            const currentRate = step.rate || 0;

            // 计算到下一步的转化率
            let nextStepRate = null;
            let nextStepName = '';
            if (index < funnel.length - 1) {
                const nextValue = funnel[index + 1].value || 0;
                nextStepRate = currentValue > 0 ? (nextValue / currentValue * 100) : 0;
                nextStepName = stepNames[index + 1];
            }

            // 转化率颜色
            const rateColor = currentRate >= 50 ? 'var(--success-color)' :
                            currentRate >= 20 ? 'var(--warning-color)' :
                            'var(--error-color)';

            // 进度条宽度
            const barWidth = Math.min(currentRate, 100);

            html += `
                <div class="conversion-step" style="
                    display: flex;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border-color-light);
                ">
                    <div style="flex: 0 0 100px; font-size: 13px; color: var(--text-primary); font-weight: 500;">
                        ${stepNames[index]}
                    </div>
                    <div style="flex: 0 0 80px; text-align: right; font-size: 14px; color: ${rateColor}; font-weight: 600;">
                        ${currentRate.toFixed(2)}%
                    </div>
                    <div style="flex: 1; margin: 0 12px;">
                        <div style="
                            width: 100%;
                            height: 8px;
                            background: var(--bg-page);
                            border-radius: 4px;
                            overflow: hidden;
                        ">
                            <div style="
                                width: ${barWidth}%;
                                height: 100%;
                                background: ${rateColor};
                                border-radius: 4px;
                                transition: width 0.3s ease;
                            "></div>
                        </div>
                    </div>
                    <div style="flex: 0 0 100px; text-align: right; font-size: 13px; color: var(--text-secondary);">
                        ${currentValue.toLocaleString()} 人
                    </div>
                </div>
            `;

            // 如果有下一步，显示到下一步的转化率
            if (nextStepRate !== null) {
                html += `
                    <div style="
                        padding: 8px 0 8px 100px;
                        font-size: 12px;
                        color: var(--text-secondary);
                        border-bottom: 1px solid var(--border-color-light);
                    ">
                        ↓ 至 ${nextStepName}: ${nextStepRate.toFixed(2)}%
                    </div>
                `;
            }
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * 渲染核心数据指标
     */
    renderCoreMetrics() {
        const container = document.getElementById('coreMetrics');
        if (!container) return;

        if (!this.data || !this.data.core_metrics) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">暂无数据</p>';
            return;
        }

        const metrics = this.data.core_metrics;

        const metricCards = [
            {
                label: '投入金额',
                value: '¥' + (metrics.cost || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                color: 'var(--primary-color)'
            },
            {
                label: '新增线索',
                value: (metrics.lead_users || 0).toLocaleString(),
                color: 'var(--success-color)'
            },
            {
                label: '新开客户数',
                value: (metrics.opened_account_users || 0).toLocaleString(),
                color: 'var(--warning-color)'
            },
            {
                label: '新增有效户数',
                value: (metrics.valid_customer_users || 0).toLocaleString(),
                color: 'var(--error-color)'
            }
        ];

        const html = `
            <div style="
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            ">
                ${metricCards.map(metric => `
                    <div style="
                        padding: 12px;
                        background: var(--bg-hover);
                        border-radius: var(--border-radius);
                        border-left: 3px solid ${metric.color};
                    ">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${metric.label}</div>
                        <div style="font-size: 18px; font-weight: 600; color: ${metric.color};">${metric.value}</div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * 渲染漏斗图
     * 🔧 性能优化: 异步方法，支持延迟加载 ECharts
     */
    async renderFunnelChart() {
        const chartDom = document.getElementById('funnelChart');
        if (!chartDom) return;

        if (!this.data || !this.data.funnel || this.data.funnel.length === 0) {
            chartDom.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 100px 20px;">暂无数据</p>';
            return;
        }

        const funnelData = this.data.funnel;

        // 🔧 性能优化: 延迟加载 ECharts
        const echarts = await window.loadECharts();

        const myChart = echarts.init(chartDom);
        this.charts.funnel = myChart;

        // 7层漏斗颜色配置
        const colors = [
            '#5470C6', // 广告曝光 - 深蓝
            '#91CC75', // 客户点击 - 绿色
            '#FAC858', // 客户线索 - 黄色
            '#EE6666', // 客户开口 - 红色
            '#73C0DE', // 有效线索 - 浅蓝
            '#3BA272', // 成功开户 - 青绿
            '#FC8452'  // 有效户 - 橙色
        ];

        const stepNames = [
            '广告曝光',
            '客户点击',
            '客户线索',
            '客户开口',
            '有效线索',
            '成功开户',
            '有效户'
        ];

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const dataIndex = params.dataIndex;
                    const stage = funnelData[dataIndex];
                    const rate = stage.rate ? stage.rate.toFixed(2) : '0.00';
                    return `
                        <strong>${params.name}</strong><br/>
                        人数: ${params.value.toLocaleString()}<br/>
                        转化率: ${rate}%
                    `;
                }
            },
            series: [
                {
                    name: '转化漏斗',
                    type: 'funnel',
                    left: '10%',
                    top: 10,
                    bottom: 10,
                    width: '80%',
                    min: 0,
                    max: 100,
                    minSize: '0%',
                    maxSize: '100%',
                    sort: 'descending',
                    gap: 0,
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: (params) => {
                            const dataIndex = params.dataIndex;
                            const stage = funnelData[dataIndex];
                            const rate = stage.rate ? stage.rate.toFixed(1) : '0.0';
                            return `${params.name}\n${params.value.toLocaleString()}\n(${rate}%)`;
                        },
                        fontSize: 11,
                        color: '#fff'
                    },
                    labelLine: {
                        show: false
                    },
                    itemStyle: {
                        borderColor: '#fff',
                        borderWidth: 1
                    },
                    emphasis: {
                        label: {
                            fontSize: 13,
                            fontWeight: 'bold'
                        }
                    },
                    data: funnelData.map((stage, index) => ({
                        value: stage.value,
                        name: stepNames[index],
                        itemStyle: { color: colors[index] }
                    }))
                }
            ]
        };

        myChart.setOption(option);
    }

    /**
     * 渲染合并转化率
     */
    renderCombinedRates() {
        const container = document.getElementById('combinedRates');
        if (!container) return;

        if (!this.data || !this.data.funnel || this.data.funnel.length < 7) {
            container.innerHTML = '';
            return;
        }

        const funnel = this.data.funnel;

        // 计算合并转化率
        const impressions = funnel[0].value || 0;
        const leadUsers = funnel[2].value || 0; // 客户线索
        const openedUsers = funnel[5].value || 0; // 成功开户
        const validUsers = funnel[6].value || 0; // 有效户

        const impressionToLeadRate = impressions > 0 ? (leadUsers / impressions * 100) : 0;
        const leadToOpenRate = leadUsers > 0 ? (openedUsers / leadUsers * 100) : 0;
        const openToValidRate = openedUsers > 0 ? (validUsers / openedUsers * 100) : 0;
        const overallRate = impressions > 0 ? (validUsers / impressions * 100) : 0;

        const html = `
            <div style="
                padding: 16px;
                background: var(--bg-hover);
                border-radius: var(--border-radius);
            ">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">合并转化率</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">曝光-线索率:</span>
                        <span style="color: var(--primary-color); font-weight: 600;">${impressionToLeadRate.toFixed(2)}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">线索-开户率:</span>
                        <span style="color: var(--success-color); font-weight: 600;">${leadToOpenRate.toFixed(2)}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">开户-有效户率:</span>
                        <span style="color: var(--warning-color); font-weight: 600;">${openToValidRate.toFixed(2)}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">全链路转化率:</span>
                        <span style="color: var(--error-color); font-weight: 600;">
                            ${overallRate.toFixed(2)}%
                            <span style="color: var(--text-tertiary); font-size: 11px;">(曝光-有效户)</span>
                        </span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div style="
                    padding: 60px 20px;
                    text-align: center;
                    color: var(--error-color);
                ">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 20px;
                    ">⚠️</div>
                    <div style="
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 10px;
                        color: var(--text-primary);
                    ">加载失败</div>
                    <div style="color: var(--text-secondary); margin-bottom: 20px;">${message}</div>
                    <button class="btn btn--primary" onclick="location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    /**
     * 销毁报表（Phase 1: 完善事件监听器清理）
     */
    destroy() {
        // Phase 1: 解绑所有事件监听器
        this.unbindEvents();

        // 销毁事件管理器
        if (this.eventManager) {
            this.eventManager.destroy();
            this.eventManager = null;
        }

        // 销毁图表实例
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.dispose();
            }
        });
        this.charts = {};

        // 清理代理商下拉框
        if (this.agencyDropdown) {
            this.agencyDropdown.destroy();
            this.agencyDropdown = null;
        }

        // 清理数据
        this.data = null;
    }
}

window.ConversionFunnelReport = ConversionFunnelReport;
