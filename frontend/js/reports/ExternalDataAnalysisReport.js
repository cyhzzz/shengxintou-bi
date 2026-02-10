/**
 * 外部数据分析报表
 * 提供高级分析和对比洞察
 */

class ExternalDataAnalysisReport {
    constructor() {
        this.filterBar = window.app.filterBar;
        this.data = null;
        this.charts = {};

        // Phase 1: 修复事件监听器泄漏
        this.eventManager = new EventManager();

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('外部数据分析报表初始化...');

        // 加载数据
        await this.loadData();

        // 渲染报表
        this.render();
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
     * 加载数据
     */
    async loadData() {
        try {
            const filters = this.filterBar.getFilters();
            const response = await API.getExternalDataAnalysis(filters);

            if (response.error) {
                throw new Error(response.error);
            }

            this.data = response;
            console.log('外部数据分析加载成功:', this.data);
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

        container.innerHTML = `
            <div class="external-data-analysis-report">
                <!-- ROI分析总览 -->
                <section class="roi-overview">
                    <h2 class="section-title">投资回报率分析</h2>
                    <div class="roi-cards">
                        ${this.renderROIOverview()}
                    </div>
                </section>

                <!-- 趋势洞察 -->
                <section class="trend-insights">
                    <h2 class="section-title">趋势洞察</h2>
                    <div class="insights-cards">
                        ${this.renderTrendInsights()}
                    </div>
                </section>

                <!-- 平台对比分析 -->
                <section class="platform-comparison">
                    <h2 class="section-title">平台对比分析</h2>
                    <div id="platformComparisonChart" style="width:100%;height:400px;"></div>
                    <div id="platformComparisonTable"></div>
                </section>

                <!-- 代理商排名 -->
                <section class="agency-ranking">
                    <h2 class="section-title">代理商综合评分排名</h2>
                    <div id="agencyRankingChart" style="width:100%;height:500px;"></div>
                    <div id="agencyRankingTable"></div>
                </section>

                <!-- 业务模式分析 -->
                <section class="business-model-analysis">
                    <h2 class="section-title">业务模式分析</h2>
                    <div id="businessModelChart" style="width:100%;height:400px;"></div>
                    <div id="businessModelTable"></div>
                </section>

                <!-- 性能矩阵 -->
                <section class="performance-matrix">
                    <h2 class="section-title">平台-代理商性能矩阵</h2>
                    <div id="performanceMatrixTable"></div>
                </section>
            </div>
        `;

        // 渲染图表
        this.renderPlatformComparison();
        this.renderAgencyRanking();
        this.renderBusinessModelAnalysis();
        this.renderPerformanceMatrix();
    }

    /**
     * 渲染ROI总览
     */
    renderROIOverview() {
        if (!this.data || !this.data.roi_analysis) return '';

        const roi = this.data.roi_analysis;
        const isProfitable = roi.profit_loss > 0;

        return `
            <div class="roi-card metric-card ${isProfitable ? 'card-success' : 'card-danger'}">
                <div class="card-icon">${isProfitable ? '💰' : '⚠️'}</div>
                <div class="card-content">
                    <div class="card-title">投资回报率 (ROI)</div>
                    <div class="card-value">${roi.roi.toFixed(2)}%</div>
                    <div class="card-description">
                        ${isProfitable ? '盈利' : '亏损'}: ¥${Math.abs(roi.profit_loss).toLocaleString()}
                    </div>
                </div>
            </div>
            <div class="roi-card metric-card card-primary">
                <div class="card-icon">📊</div>
                <div class="card-content">
                    <div class="card-title">总投入</div>
                    <div class="card-value">¥${roi.total_investment.toLocaleString()}</div>
                    <div class="card-description">
                        回报: ¥${roi.total_returns.toLocaleString()}
                    </div>
                </div>
            </div>
            <div class="roi-card metric-card card-info">
                <div class="card-icon">🎯</div>
                <div class="card-content">
                    <div class="card-title">开户数</div>
                    <div class="card-value">${roi.current_accounts}</div>
                    <div class="card-description">
                        盈亏平衡: ${roi.break_even_accounts.toFixed(1)}户
                    </div>
                </div>
            </div>
            <div class="roi-card metric-card card-warning">
                <div class="card-icon">💡</div>
                <div class="card-content">
                    <div class="card-title">获客成本 (CAC)</div>
                    <div class="card-value">¥${roi.metrics.cost_per_account.toFixed(2)}</div>
                    <div class="card-description">
                        LTV/CAC比率: ${roi.metrics.ltv_ratio}x
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染趋势洞察
     */
    renderTrendInsights() {
        if (!this.data || !this.data.trend_insights) return '';

        const insights = this.data.trend_insights;
        const costTrendPositive = insights.cost_trend > 0;
        const ctrTrendPositive = insights.ctr_trend > 0;

        return `
            <div class="insight-card metric-card card-${costTrendPositive ? 'warning' : 'success'}">
                <div class="card-icon">${costTrendPositive ? '📈' : '📉'}</div>
                <div class="card-content">
                    <div class="card-title">成本趋势</div>
                    <div class="card-value">${costTrendPositive ? '+' : ''}${insights.cost_trend}%</div>
                    <div class="card-description">${insights.insights[0] || ''}</div>
                </div>
            </div>
            <div class="insight-card metric-card card-${ctrTrendPositive ? 'success' : 'warning'}">
                <div class="card-icon">${ctrTrendPositive ? '📈' : '📉'}</div>
                <div class="card-content">
                    <div class="card-title">点击率趋势</div>
                    <div class="card-value">${ctrTrendPositive ? '+' : ''}${insights.ctr_trend}%</div>
                    <div class="card-description">${insights.insights[1] || ''}</div>
                </div>
            </div>
            <div class="insight-card metric-card card-info" style="flex: 2;">
                <div class="card-icon">💡</div>
                <div class="card-content">
                    <div class="card-title">优化建议</div>
                    <div class="insight-list">
                        ${insights.recommendations && insights.recommendations.length > 0
                            ? insights.recommendations.map(rec => `<div class="insight-item">• ${rec}</div>`).join('')
                            : `<div class="insight-item">• ${insights.insights[2] || '当前表现稳定，继续保持'}</div>`
                        }
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染平台对比
     */
    renderPlatformComparison() {
        if (!this.data || !this.data.platform_comparison) return;

        // 渲染表格
        const tableContainer = document.getElementById('platformComparisonTable');
        if (tableContainer) {
            const table = new DataTable({
                data: this.data.platform_comparison.map(item => ({
                    '平台': item.platform,
                    '花费': `¥${item.metrics.cost.toLocaleString()}`,
                    '曝光': item.metrics.impressions.toLocaleString(),
                    '点击': item.metrics.clicks.toLocaleString(),
                    '点击率': item.metrics.ctr.toFixed(2) + '%',
                    '线索': item.metrics.leads.toLocaleString(),
                    '线索率': item.metrics.lead_rate.toFixed(2) + '%',
                    '开户': item.metrics.new_accounts.toLocaleString(),
                    '开户率': item.metrics.account_rate.toFixed(2) + '%',
                    '单线索成本': `¥${item.metrics.cost_per_lead.toFixed(2)}`,
                    '单开户成本': `¥${item.metrics.cost_per_account.toFixed(2)}`
                })),
                pagination: false
            });
            tableContainer.innerHTML = table.render();
        }

        // 渲染雷达图
        const chartDom = document.getElementById('platformComparisonChart');
        if (!chartDom || this.data.platform_comparison.length === 0) return;

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const myChart = echarts.init(chartDom);
        const platforms = this.data.platform_comparison.map(p => p.platform);

        // 归一化数据（0-100）
        const normalizeData = (data, max) => data.map(v => max > 0 ? (v / max * 100) : 0);

        const maxCost = Math.max(...this.data.platform_comparison.map(p => p.metrics.cost));
        const maxCTR = Math.max(...this.data.platform_comparison.map(p => p.metrics.ctr));
        const maxLeadRate = Math.max(...this.data.platform_comparison.map(p => p.metrics.lead_rate));
        const maxAccountRate = Math.max(...this.data.platform_comparison.map(p => p.metrics.account_rate));

        const series = this.data.platform_comparison.map(platform => ({
            value: [
                normalizeData([platform.metrics.cost], maxCost)[0],
                normalizeData([platform.metrics.ctr], maxCTR)[0],
                normalizeData([platform.metrics.lead_rate], maxLeadRate)[0],
                normalizeData([platform.metrics.account_rate], maxAccountRate)[0]
            ],
            name: platform.platform
        }));

        const option = {
            title: {
                text: '平台性能对比（归一化）',
                left: 'center'
            },
            tooltip: {
                trigger: 'item'
            },
            legend: {
                data: platforms,
                top: 30
            },
            radar: {
                indicator: [
                    { name: '花费规模', max: 100 },
                    { name: '点击率', max: 100 },
                    { name: '线索率', max: 100 },
                    { name: '开户率', max: 100 }
                ],
                radius: '60%'
            },
            series: [{
                type: 'radar',
                data: series
            }]
        };

        myChart.setOption(option);
        this.charts.platform = myChart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染代理商排名
     */
    renderAgencyRanking() {
        if (!this.data || !this.data.agency_ranking) return;

        // 渲染表格
        const tableContainer = document.getElementById('agencyRankingTable');
        if (tableContainer) {
            const table = new DataTable({
                data: this.data.agency_ranking.map((item, index) => ({
                    '排名': index + 1,
                    '代理商': item.agency,
                    '综合评分': item.score,
                    '花费': `¥${item.metrics.cost.toLocaleString()}`,
                    '开户': item.metrics.new_accounts.toLocaleString(),
                    '点击率': item.metrics.ctr.toFixed(2) + '%',
                    '线索率': item.metrics.lead_rate.toFixed(2) + '%',
                    '开户率': item.metrics.account_rate.toFixed(2) + '%',
                    '单线索成本': `¥${item.metrics.cost_per_lead.toFixed(2)}`,
                    '单开户成本': `¥${item.metrics.cost_per_account.toFixed(2)}`
                })),
                pagination: false
            });
            tableContainer.innerHTML = table.render();
        }

        // 渲染柱状图
        const chartDom = document.getElementById('agencyRankingChart');
        if (!chartDom || this.data.agency_ranking.length === 0) return;

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const myChart = echarts.init(chartDom);
        const agencies = this.data.agency_ranking.map(a => a.agency);
        const scores = this.data.agency_ranking.map(a => a.score);
        const accounts = this.data.agency_ranking.map(a => a.metrics.new_accounts);

        const option = {
            title: {
                text: '代理商综合评分与开户数',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                }
            },
            legend: {
                data: ['综合评分', '开户数'],
                top: 30
            },
            xAxis: {
                type: 'category',
                data: agencies,
                axisLabel: {
                    rotate: 45
                }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '综合评分',
                    position: 'left'
                },
                {
                    type: 'value',
                    name: '开户数',
                    position: 'right'
                }
            ],
            series: [
                {
                    name: '综合评分',
                    type: 'bar',
                    data: scores,
                    itemStyle: {
                        color: '#409EFF'
                    }
                },
                {
                    name: '开户数',
                    type: 'line',
                    yAxisIndex: 1,
                    data: accounts,
                    itemStyle: {
                        color: '#67C23A'
                    }
                }
            ]
        };

        myChart.setOption(option);
        this.charts.agency = myChart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染业务模式分析
     */
    renderBusinessModelAnalysis() {
        if (!this.data || !this.data.business_model_analysis) return;

        // 渲染表格
        const tableContainer = document.getElementById('businessModelTable');
        if (tableContainer) {
            const table = new DataTable({
                data: this.data.business_model_analysis.map(item => ({
                    '业务模式': item.business_model,
                    '花费': `¥${item.metrics.cost.toLocaleString()}`,
                    '曝光': item.metrics.impressions.toLocaleString(),
                    '点击': item.metrics.clicks.toLocaleString(),
                    '点击率': item.metrics.ctr.toFixed(2) + '%',
                    '线索': item.metrics.leads.toLocaleString(),
                    '线索率': item.metrics.lead_rate.toFixed(2) + '%',
                    '开户': item.metrics.new_accounts.toLocaleString(),
                    '开户率': item.metrics.account_rate.toFixed(2) + '%',
                    'ROI': item.metrics.roi.toFixed(2) + '%'
                })),
                pagination: false
            });
            tableContainer.innerHTML = table.render();
        }

        // 渲染饼图（花费分布）
        const chartDom = document.getElementById('businessModelChart');
        if (!chartDom || this.data.business_model_analysis.length === 0) return;

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const myChart = echarts.init(chartDom);
        const businessModels = this.data.business_model_analysis.map(bm => bm.business_model);
        const costs = this.data.business_model_analysis.map(bm => bm.metrics.cost);
        const rois = this.data.business_model_analysis.map(bm => bm.metrics.roi);

        const option = {
            title: {
                text: '业务模式花费分布',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: ¥{c} ({d}%)'
            },
            legend: {
                data: businessModels,
                top: 30
            },
            series: [
                {
                    name: '花费',
                    type: 'pie',
                    radius: '60%',
                    data: this.data.business_model_analysis.map(bm => ({
                        value: bm.metrics.cost,
                        name: bm.business_model
                    })),
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };

        myChart.setOption(option);
        this.charts.businessModel = myChart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染性能矩阵
     */
    renderPerformanceMatrix() {
        if (!this.data || !this.data.performance_matrix) return;

        const tableContainer = document.getElementById('performanceMatrixTable');
        if (!tableContainer) return;

        const table = new DataTable({
            data: this.data.performance_matrix.map(item => ({
                '平台': item.platform,
                '代理商': item.agency,
                '花费': `¥${item.metrics.cost.toLocaleString()}`,
                '曝光': item.metrics.impressions.toLocaleString(),
                '点击': item.metrics.clicks.toLocaleString(),
                '线索': item.metrics.leads.toLocaleString(),
                '开户': item.metrics.new_accounts.toLocaleString(),
                '点击率': item.metrics.ctr.toFixed(2) + '%',
                '线索率': item.metrics.lead_rate.toFixed(2) + '%',
                '开户率': item.metrics.account_rate.toFixed(2) + '%',
                '单开户成本': `¥${item.metrics.cost_per_account.toFixed(2)}`
            })),
            pagination: true,
            pageSize: 20
        });

        tableContainer.innerHTML = table.render();
    }

    /**
     * 显示错误信息
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

        // 销毁所有图表
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.dispose) {
                chart.dispose();
            }
        });
        this.charts = {};

        // 清理数据
        this.data = null;
        this.filterBar = null;
    }
}

// 导出到全局（确保 DynamicLoader 能找到此类）
if (typeof window !== 'undefined') {
    window.ExternalDataAnalysisReport = ExternalDataAnalysisReport;
}
