/**
 * 员工转化效果分析页面组件
 *
 * 功能：
 * 1. 支持多平台筛选（小红书、腾讯、抖音）
 * 2. 支持日期范围筛选
 * 3. 支持服务人员筛选
 * 4. 显示核心指标卡片
 * 5. 显示整体转化走势图（周度）
 * 6. 显示开户转化率走势图（周度）
 * 7. 显示服务人员转化排行榜
 */

class EmployeeConversionAnalysis {
    constructor() {
        this.platforms = ['小红书', '腾讯', '抖音'];
        this.startDate = null;
        this.endDate = null;
        this.selectedEmployees = [];
        this.leadType = 'all';
        this.currentData = null;
        this.charts = {};
        this.employeeMultiSelect = null;
        this.platformMultiSelect = null;
        this.employeesList = [];

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('员工转化效果分析报表初始化...');

        this.setDefaultDateRange();
        this.render();
        this.bindEvents();
        await this.loadFilterOptions();
        await this.loadData();

        console.log('员工转化效果分析报表加载完成');
    }

    /**
     * 设置默认日期范围（近30天）
     */
    setDefaultDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        this.endDate = today.toISOString().split('T')[0];
        this.startDate = thirtyDaysAgo.toISOString().split('T')[0];
    }

    /**
     * 渲染页面
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <!-- 筛选器卡片 -->
            <div class="card card--filter card--full-width">
                <div class="card__body">
                    <div class="filter-bar-content" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
                        <!-- 平台选择 -->
                        <div class="filter-group">
                            <label class="filter-label">平台:</label>
                            <div id="platformMultiSelect" class="multi-select-form" style="min-width: 200px;"></div>
                        </div>

                        <!-- 日期范围 -->
                        <div class="filter-group">
                            <label class="filter-label">日期范围:</label>
                            <div class="date-range-picker">
                                <input type="date" id="employeeConversionStartDate" class="date-input" value="${this.startDate}">
                                <span class="date-separator">至</span>
                                <input type="date" id="employeeConversionEndDate" class="date-input" value="${this.endDate}">
                            </div>
                        </div>

                        <!-- 服务人员 -->
                        <div class="filter-group">
                            <label class="filter-label">服务人员:</label>
                            <div id="employeeMultiSelect" class="multi-select-form" style="min-width: 200px;"></div>
                        </div>

                        <!-- 线索类型 -->
                        <div class="filter-group">
                            <label class="filter-label">线索类型:</label>
                            <select id="leadTypeSelect" class="form-control">
                                <option value="all">全部线索</option>
                                <option value="existing">存量线索</option>
                                <option value="new">新增线索</option>
                            </select>
                        </div>

                        <!-- 操作按钮 -->
                        <div class="filter-actions" style="margin-left: auto;">
                            <button class="btn btn--primary" id="queryBtn">查询</button>
                            <button class="btn btn--secondary" id="resetBtn">重置</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 核心指标卡片区域 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">核心指标</h3>
                </div>
                <div class="card__body">
                    <div class="metrics-cards" id="metricsCards" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                        <!-- 总线索量 -->
                        <div class="metric-card" style="
                            background: #FFFFFF;
                            border: 1px solid #E8EAED;
                            padding: 16px 20px;
                            border-radius: 8px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            min-height: 88px;
                        ">
                            <div style="font-size: 12px; color: #8A8D99; font-weight: 500;">总线索量</div>
                            <div id="totalLeadsValue" style="font-size: 28px; font-weight: 600; color: #0969DA; line-height: 1; letter-spacing: -0.5px;">-</div>
                            <div style="font-size: 11px; color: #8A8D99;">个</div>
                        </div>
                        <!-- 总开户量 -->
                        <div class="metric-card" style="
                            background: #FFFFFF;
                            border: 1px solid #E8EAED;
                            padding: 16px 20px;
                            border-radius: 8px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            min-height: 88px;
                        ">
                            <div style="font-size: 12px; color: #8A8D99; font-weight: 500;">总开户量</div>
                            <div id="totalOpenedValue" style="font-size: 28px; font-weight: 600; color: #0969DA; line-height: 1; letter-spacing: -0.5px;">-</div>
                            <div style="font-size: 11px; color: #8A8D99;">户</div>
                        </div>
                        <!-- 平均开户率 -->
                        <div class="metric-card" style="
                            background: #FFFFFF;
                            border: 1px solid #E8EAED;
                            padding: 16px 20px;
                            border-radius: 8px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            min-height: 88px;
                        ">
                            <div style="font-size: 12px; color: #8A8D99; font-weight: 500;">平均开户率</div>
                            <div id="avgOpeningRateValue" style="font-size: 28px; font-weight: 600; color: #277D4F; line-height: 1; letter-spacing: -0.5px;">-</div>
                            <div style="font-size: 11px; color: #8A8D99;">百分比</div>
                        </div>
                        <!-- 总资产 -->
                        <div class="metric-card" style="
                            background: #FFFFFF;
                            border: 1px solid #E8EAED;
                            padding: 16px 20px;
                            border-radius: 8px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            min-height: 88px;
                        ">
                            <div style="font-size: 12px; color: #8A8D99; font-weight: 500;">总资产</div>
                            <div id="totalAssetsValue" style="font-size: 28px; font-weight: 600; color: #277D4F; line-height: 1; letter-spacing: -0.5px;">-</div>
                            <div style="font-size: 11px; color: #8A8D99;">元</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 图表区域 -->
            <div class="charts-grid card--full-width">
                <!-- 整体转化走势 -->
                <div class="card card--chart">
                    <div class="card__header">
                        <h3 class="card__title">整体转化走势（周度）</h3>
                    </div>
                    <div class="card__body">
                        <div id="conversionTrendChart" style="width: 100%; height: 300px;"></div>
                    </div>
                </div>

                <!-- 员工开户转化率走势 -->
                <div class="card card--chart">
                    <div class="card__header">
                        <h3 class="card__title">员工开户转化率走势</h3>
                    </div>
                    <div class="card__body">
                        <div id="employeeRateTrendChart" style="width: 100%; height: 300px;"></div>
                    </div>
                </div>
            </div>

            <!-- 排行榜区域 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">服务人员转化排行榜</h3>
                    <div class="card__actions">
                        <span class="stat-label" id="rankingCount">共 0 人</span>
                        <button class="btn btn--sm btn--outline" id="exportRankingBtn">导出</button>
                    </div>
                </div>
                <div class="card__body">
                    <div class="table-container">
                        <table class="data-table" id="rankingTable">
                            <thead>
                                <tr>
                                    <th>排名</th>
                                    <th>服务人员</th>
                                    <th>线索量</th>
                                    <th>开口量</th>
                                    <th>有效线索</th>
                                    <th>开户量</th>
                                    <th>开户率</th>
                                    <th>有效户</th>
                                    <th>有效户率</th>
                                    <th>总资产</th>
                                </tr>
                            </thead>
                            <tbody id="rankingTableBody">
                                <tr>
                                    <td colspan="10" style="text-align: center; padding: 40px; color: #999;">
                                        暂无数据，请选择筛选条件后点击"查询"
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 查询按钮
        const queryBtn = document.getElementById('queryBtn');
        if (queryBtn) {
            queryBtn.addEventListener('click', () => this.handleQuery());
        }

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportRankingBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }
    }

    /**
     * 加载筛选器选项
     */
    async loadFilterOptions() {
        // 初始化平台多选组件（不需要从API加载）
        this.initPlatformMultiSelect();

        try {
            const response = await fetch('/api/v1/employee-conversion/filter-options');
            const result = await response.json();

            if (result.success && result.data) {
                this.employeesList = result.data.employees || [];
                this.initEmployeeMultiSelect();
            }
        } catch (error) {
            console.error('加载筛选器选项失败:', error);
        }
    }

    /**
     * 初始化平台多选组件
     */
    initPlatformMultiSelect() {
        const container = document.getElementById('platformMultiSelect');
        if (!container || typeof MultiSelectForm === 'undefined') return;

        this.platformMultiSelect = new MultiSelectForm({
            container: container,
            options: ['小红书', '腾讯', '抖音'],
            selectedValues: ['小红书', '腾讯', '抖音'],
            placeholder: '选择平台',
            onChange: (selected) => {
                this.platforms = selected;
            }
        });
    }

    /**
     * 初始化员工多选组件
     */
    initEmployeeMultiSelect() {
        const container = document.getElementById('employeeMultiSelect');
        if (!container || typeof MultiSelectForm === 'undefined') return;

        this.employeeMultiSelect = new MultiSelectForm({
            container: container,
            options: this.employeesList,
            placeholder: '全部人员',
            onChange: (selected) => {
                this.selectedEmployees = selected;
            }
        });
    }

    /**
     * 获取选中的平台
     */
    getSelectedPlatforms() {
        if (this.platformMultiSelect) {
            return this.platformMultiSelect.getSelected();
        }
        return this.platforms;
    }

    /**
     * 处理查询
     */
    async handleQuery() {
        // 获取筛选参数
        this.platforms = this.getSelectedPlatforms();
        this.startDate = document.getElementById('employeeConversionStartDate')?.value;
        this.endDate = document.getElementById('employeeConversionEndDate')?.value;
        this.leadType = document.getElementById('leadTypeSelect')?.value || 'all';

        // 获取选中的员工
        if (this.employeeMultiSelect) {
            this.selectedEmployees = this.employeeMultiSelect.getSelected();
        }

        // 验证参数
        if (!this.startDate || !this.endDate) {
            alert('请选择日期范围');
            return;
        }

        if (this.platforms.length === 0) {
            alert('请至少选择一个平台');
            return;
        }

        // 加载数据
        await this.loadData();
    }

    /**
     * 处理重置
     */
    handleReset() {
        // 重置日期
        this.setDefaultDateRange();
        document.getElementById('employeeConversionStartDate').value = this.startDate;
        document.getElementById('employeeConversionEndDate').value = this.endDate;

        // 重置平台
        if (this.platformMultiSelect) {
            this.platformMultiSelect.setSelected(['小红书', '腾讯', '抖音']);
        }
        this.platforms = ['小红书', '腾讯', '抖音'];

        // 重置线索类型
        document.getElementById('leadTypeSelect').value = 'all';
        this.leadType = 'all';

        // 重置员工选择
        if (this.employeeMultiSelect) {
            this.employeeMultiSelect.clear();
        }
        this.selectedEmployees = [];

        // 重新加载数据
        this.loadData();
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            // 显示加载状态
            this.showLoading();

            const response = await fetch('/api/v1/employee-conversion/analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platforms: this.platforms,
                    start_date: this.startDate,
                    end_date: this.endDate,
                    employees: this.selectedEmployees,
                    lead_type: this.leadType
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentData = result.data;
                this.updateUI();
            } else {
                console.error('加载员工转化数据失败:', result.error);
                this.showError(result.message || '加载失败');
            }

        } catch (error) {
            console.error('加载员工转化数据失败:', error);
            this.showError('加载数据失败，请稍后重试');
        }
    }

    /**
     * 更新UI
     */
    updateUI() {
        if (!this.currentData) return;

        // 更新核心指标
        this.updateMetrics();

        // 更新图表
        this.renderCharts();

        // 更新排行榜
        this.updateRankingTable();
    }

    /**
     * 更新核心指标卡片
     */
    updateMetrics() {
        const metrics = this.currentData.core_metrics || {};

        document.getElementById('totalLeadsValue').textContent = this.formatNumber(metrics.total_leads || 0);
        document.getElementById('totalOpenedValue').textContent = this.formatNumber(metrics.total_opened || 0);
        document.getElementById('avgOpeningRateValue').textContent = (metrics.avg_opening_rate || 0).toFixed(2) + '%';
        document.getElementById('totalAssetsValue').textContent = this.formatCurrency(metrics.total_assets || 0);
    }

    /**
     * 渲染图表
     */
    async renderCharts() {
        // 延迟加载 ECharts
        if (typeof loadECharts === 'function') {
            await loadECharts();
        }

        if (typeof echarts === 'undefined') {
            console.error('ECharts 未加载');
            return;
        }

        this.renderConversionTrendChart();
        this.renderEmployeeRateTrendChart();
    }

    /**
     * 渲染整体转化走势图（与小红书报表格式一致）
     * 横坐标：周度格式（YYYY-第X周）
     * 纵坐标：个数
     * 指标：加微数、开口客户数、有效线索数、开户数
     */
    renderConversionTrendChart() {
        const container = document.getElementById('conversionTrendChart');
        if (!container) return;

        const chartData = this.currentData?.conversion_trend;
        console.log('[ConversionTrend] chartData:', chartData);

        // 后端已聚合为周度数据，直接使用
        if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
            console.warn('[ConversionTrend] No data available');
            // 显示空状态
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                    <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <p style="margin: 0; font-size: 14px;">暂无数据</p>
                </div>
            `;
            return;
        }

        // 后端数据已经是周度聚合，转换为前端需要的格式
        const weeklyData = {
            weeks: chartData.weeks.map(w => {
                // 将 "2025-03" 转换为 "2025-第3周"
                const [year, week] = w.split('-');
                return `${year}-第${week}周`;
            }),
            dateRanges: (chartData.dateRanges || []).map(dr => {
                // 将 "0106-0112" 转换为 {start: "01-06", end: "01-12"}
                const [start, end] = dr.split('-');
                return {
                    start: `${start.substring(0, 2)}-${start.substring(2)}`,
                    end: `${end.substring(0, 2)}-${end.substring(2)}`
                };
            }),
            lead_users: chartData.lead_users || [],
            customer_mouth_users: chartData.customer_mouth_users || [],
            valid_lead_users: chartData.valid_lead_users || [],
            opened_account_users: chartData.opened_account_users || []
        };
        console.log('[ConversionTrend] weeklyData:', weeklyData);

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            if (typeof loadECharts === 'function') {
                await loadECharts();
            }

            if (typeof echarts === 'undefined') {
                console.error('ECharts 未加载');
                return;
            }

            if (this.charts.conversionTrend) {
                this.charts.conversionTrend.dispose();
            }

            this.charts.conversionTrend = echarts.init(container);

            const option = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    formatter: (params) => {
                        const idx = params[0].dataIndex;
                        const week = weeklyData.weeks[idx];
                        const dateRange = weeklyData.dateRanges[idx];
                        let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                        if (dateRange) {
                            result += `<div style="font-size: 11px; color: #8a8d99; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e8e9eb;">
                                <span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #6366f1; margin-right: 6px;"></span>
                                ${dateRange.start} ~ ${dateRange.end}
                            </div>`;
                        }
                        params.forEach(p => {
                            result += `<div style="margin: 5px 0;">
                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                                <span style="color: #5a5c66;">${p.seriesName}:</span>
                                <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value} 个</span>
                            </div>`;
                        });
                        return result;
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#e8e9eb',
                    borderWidth: 1,
                    padding: [12, 16],
                    textStyle: {
                        fontSize: 12
                    },
                    extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
                },
                legend: {
                    data: ['加微数', '开口客户数', '有效线索数', '开户数'],
                    bottom: '2%',
                    left: 'center',
                    itemWidth: 16,
                    itemHeight: 16,
                    itemGap: 24,
                    textStyle: {
                        fontSize: 13,
                        color: '#5a5c66'
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '12%',
                    top: '8%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: weeklyData.weeks,
                    axisLabel: {
                        rotate: 30,
                        fontSize: 11,
                        color: '#8a8d99',
                        interval: 0,
                        margin: 12
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#e8e9eb'
                        }
                    },
                    axisTick: {
                        show: false
                    }
                },
                yAxis: {
                    type: 'value',
                    name: '个数',
                    nameTextStyle: {
                        fontSize: 12,
                        color: '#8a8d99',
                        padding: [0, 0, 0, -8]
                    },
                    axisLabel: {
                        fontSize: 11,
                        color: '#8a8d99',
                        formatter: (value) => {
                            if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#e8e9eb'
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: '#f0f1f3',
                            type: 'dashed'
                        }
                    }
                },
                series: [
                    {
                        name: '加微数',
                        type: 'bar',
                        data: weeklyData.lead_users,
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#6366f1' },
                                    { offset: 1, color: '#818cf8' }
                                ]
                            },
                            borderRadius: [4, 4, 0, 0]
                        },
                        barMaxWidth: 48,
                        emphasis: {
                            itemStyle: {
                                color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                        { offset: 0, color: '#4f46e5' },
                                        { offset: 1, color: '#6366f1' }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        name: '开口客户数',
                        type: 'bar',
                        data: weeklyData.customer_mouth_users,
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#10b981' },
                                    { offset: 1, color: '#34d399' }
                                ]
                            },
                            borderRadius: [4, 4, 0, 0]
                        },
                        barMaxWidth: 48,
                        emphasis: {
                            itemStyle: {
                                color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                        { offset: 0, color: '#059669' },
                                        { offset: 1, color: '#10b981' }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        name: '有效线索数',
                        type: 'bar',
                        data: weeklyData.valid_lead_users,
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#f59e0b' },
                                    { offset: 1, color: '#fbbf24' }
                                ]
                            },
                            borderRadius: [4, 4, 0, 0]
                        },
                        barMaxWidth: 48,
                        emphasis: {
                            itemStyle: {
                                color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                        { offset: 0, color: '#d97706' },
                                        { offset: 1, color: '#f59e0b' }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        name: '开户数',
                        type: 'bar',
                        data: weeklyData.opened_account_users,
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#ec4899' },
                                    { offset: 1, color: '#f472b6' }
                                ]
                            },
                            borderRadius: [4, 4, 0, 0]
                        },
                        barMaxWidth: 48,
                        emphasis: {
                            itemStyle: {
                                color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                        { offset: 0, color: '#db2777' },
                                        { offset: 1, color: '#ec4899' }
                                    ]
                                }
                            }
                        }
                    }
                ],
                animationDuration: 1000,
                animationEasing: 'cubicOut',
                animationDelay: (idx) => idx * 50
            };

            this.charts.conversionTrend.setOption(option);

            // 响应式
            window.addEventListener('resize', () => {
                if (this.charts.conversionTrend) {
                    this.charts.conversionTrend.resize();
                }
            });
        })();
    }

    /**
     * 渲染员工开户转化率走势图（与小红书报表格式一致）
     * 横坐标：YYYY-第X周
     * 纵坐标：转化率（开户数/加微数 × 100%）
     * 系列：按 add_employee_name 区分
     */
    renderEmployeeRateTrendChart() {
        const container = document.getElementById('employeeRateTrendChart');
        if (!container) return;

        const chartData = this.currentData?.employee_rate_trend;
        console.log('[EmployeeRateTrend] chartData:', chartData);

        if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
            console.warn('[EmployeeRateTrend] No data available');
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                    <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    <p style="margin: 0; font-size: 14px;">暂无数据</p>
                </div>
            `;
            return;
        }

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            if (typeof loadECharts === 'function') {
                await loadECharts();
            }

            if (typeof echarts === 'undefined') {
                console.error('ECharts 未加载');
                return;
            }

            if (this.charts.employeeRateTrend) {
                this.charts.employeeRateTrend.dispose();
            }

            this.charts.employeeRateTrend = echarts.init(container);

            // 格式化周标签（YYYY-第X周）
            const weekLabels = chartData.weeks.map(w => {
                const [year, week] = w.split('-');
                return `${year}-第${week}周`;
            });

            // 构建系列数据（每个员工一条曲线）
            const series = [];
            const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

            chartData.employees.forEach((empName, idx) => {
                series.push({
                    name: empName,
                    type: 'line',
                    data: chartData.series[idx] || [],
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    showSymbol: true,
                    itemStyle: { color: colors[idx % colors.length] },
                    lineStyle: { width: 2.5, color: colors[idx % colors.length] },
                    emphasis: {
                        focus: 'series',
                        itemStyle: {
                            borderColor: colors[idx % colors.length],
                            borderWidth: 2,
                            symbolSize: 8
                        }
                    }
                });
            });

            const option = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'cross' },
                    formatter: (params) => {
                        const idx = params[0].dataIndex;
                        const week = weekLabels[idx];
                        let result = `<div style="font-weight: 600; margin-bottom: 10px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                        params.forEach(p => {
                            result += `<div style="margin: 5px 0;">
                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                                <span style="color: #5a5c66;">${p.seriesName}:</span>
                                <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value.toFixed(2)}%</span>
                            </div>`;
                        });
                        return result;
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#e8e9eb',
                    borderWidth: 1,
                    padding: [12, 16],
                    extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
                },
                legend: {
                    data: chartData.employees,
                    bottom: '2%',
                    left: 'center',
                    itemWidth: 14,
                    itemHeight: 14,
                    itemGap: 16,
                    textStyle: {
                        fontSize: 12,
                        color: '#5a5c66'
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '12%',
                    top: '5%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: weekLabels,
                    axisLabel: {
                        fontSize: 11,
                        color: '#8a8d99',
                        interval: 0,
                        margin: 12,
                        rotate: 30
                    },
                    axisLine: {
                        lineStyle: { color: '#e8e9eb' }
                    },
                    axisTick: { show: false }
                },
                yAxis: {
                    type: 'value',
                    name: '转化率 (%)',
                    nameTextStyle: {
                        fontSize: 12,
                        color: '#8a8d99',
                        padding: [0, 0, 0, -8]
                    },
                    axisLabel: {
                        fontSize: 11,
                        color: '#8a8d99',
                        formatter: '{value}%'
                    },
                    axisLine: {
                        lineStyle: { color: '#e8e9eb' }
                    },
                    splitLine: {
                        lineStyle: { color: '#f0f1f3', type: 'dashed' }
                    }
                },
                series: series,
                animationDuration: 1000,
                animationEasing: 'cubicOut'
            };

            this.charts.employeeRateTrend.setOption(option);

            // 响应式
            window.addEventListener('resize', () => {
                if (this.charts.employeeRateTrend) {
                    this.charts.employeeRateTrend.resize();
                }
            });
        })();
    }

    /**
     * 更新排行榜表格
     */
    updateRankingTable() {
        const tbody = document.getElementById('rankingTableBody');
        const countEl = document.getElementById('rankingCount');

        if (!tbody) return;

        const ranking = this.currentData.ranking || [];

        if (countEl) {
            countEl.textContent = `共 ${ranking.length} 人`;
        }

        if (ranking.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #999;">
                        暂无数据
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ranking.map(item => `
            <tr>
                <td>${item.rank || '-'}</td>
                <td>${item.employee_name || '-'}</td>
                <td>${this.formatNumber(item.total_leads)}</td>
                <td>${this.formatNumber(item.mouth_count)}</td>
                <td>${this.formatNumber(item.valid_lead_count)}</td>
                <td>${this.formatNumber(item.opened_count)}</td>
                <td>${item.opening_rate.toFixed(2)}%</td>
                <td>${this.formatNumber(item.valid_customer_count)}</td>
                <td>${item.valid_customer_rate.toFixed(2)}%</td>
                <td>${this.formatCurrency(item.total_assets)}</td>
            </tr>
        `).join('');
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const tbody = document.getElementById('rankingTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #999;">
                        加载中...
                    </td>
                </tr>
            `;
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        const tbody = document.getElementById('rankingTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #f56c6c;">
                        ${message}
                    </td>
                </tr>
            `;
        }
    }

    /**
     * 处理导出
     */
    handleExport() {
        if (!this.currentData || !this.currentData.ranking) {
            alert('暂无数据可导出');
            return;
        }

        const ranking = this.currentData.ranking;
        const headers = ['排名', '服务人员', '线索量', '开口量', '有效线索', '开户量', '开户率', '有效户', '有效户率', '总资产'];
        const rows = ranking.map(item => [
            item.rank,
            item.employee_name,
            item.total_leads,
            item.mouth_count,
            item.valid_lead_count,
            item.opened_count,
            item.opening_rate.toFixed(2) + '%',
            item.valid_customer_count,
            item.valid_customer_rate.toFixed(2) + '%',
            item.total_assets.toFixed(2)
        ]);

        // 创建CSV内容
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

        // 创建Blob并下载
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `员工转化排行榜_${this.startDate}_${this.endDate}.csv`;
        link.click();
    }

    /**
     * 格式化数字
     */
    formatNumber(value) {
        if (value === null || value === undefined) return '-';
        return value.toLocaleString();
    }

    /**
     * 格式化货币
     */
    formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        return '¥' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 销毁图表实例
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.dispose();
            }
        });
        this.charts = {};

        // 清理数据
        this.currentData = null;
    }
}

// 导出组件
window.EmployeeConversionAnalysis = EmployeeConversionAnalysis;