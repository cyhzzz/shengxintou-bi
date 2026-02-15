class CrossChannelComparisonReport {
    constructor(containerId) {
        this.container = containerId ? document.querySelector(containerId) : document.getElementById('mainContent');
        this.charts = {};
        this.loading = false;
        this.startDate = null;
        this.endDate = null;
        this.init();
    }

    async init() {
        console.log('[CrossChannelComparison] 初始化');
        this.renderStructure();
        this.bindEvents();
        await this.loadData();
    }

    renderStructure() {
        var html = '<div class="filter-bar">';
        html += '<div class="filter-section">';
        html += '<div class="filter-group">';
        html += '<label>快速筛选</label>';
        html += '<div class="btn-group">';
        html += '<button class="btn btn-sm active" data-days="all">全部</button>';
        html += '<button class="btn btn-sm" data-days="7">近7天</button>';
        html += '<button class="btn btn-sm" data-days="30">近30天</button>';
        html += '<button class="btn btn-sm" data-days="90">近90天</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="metrics-cards">';
        html += '<div class="metric-card" data-metric="cost">';
        html += '<div class="metric-label">总投放金额</div>';
        html += '<div class="metric-value" id="totalCost">-</div>';
        html += '</div>';
        html += '<div class="metric-card" data-metric="leads">';
        html += '<div class="metric-label">最优成本平台</div>';
        html += '<div class="metric-value" id="bestCostPlatform">-</div>';
        html += '</div>';
        html += '<div class="metric-card" data-metric="accounts">';
        html += '<div class="metric-label">最优转化平台</div>';
        html += '<div class="metric-value" id="bestConversionPlatform">-</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="charts-grid">';
        html += '<div class="chart-card full-width">';
        html += '<h3>多维度对比</h3>';
        html += '<div id="radarChart" style="width:100%;height:500px;"></div>';
        html += '</div>';
        html += '</div>';

        this.container.innerHTML = html;
    }

    bindEvents() {
        var dateBtns = this.container.querySelectorAll('[data-days]');
        dateBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var days = btn.dataset.days;
                dateBtns.forEach(function(b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                if (days === 'all') {
                    this.startDate = null;
                    this.endDate = null;
                } else if (window.DateHelper) {
                    var range = window.DateHelper.getDateRange(parseInt(days));
                    this.startDate = range.startDate;
                    this.endDate = range.endDate;
                }
                this.loadData();
            }.bind(this));
        }.bind(this));

        window.addEventListener('resize', function() {
            Object.values(this.charts).forEach(function(chart) {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }.bind(this));
    }

    async loadData() {
        if (this.loading) return;
        this.loading = true;

        var filters = { date_range: this.startDate ? [this.startDate, this.endDate] : null };

        try {
            var result = await window.APIManager.getCrossChannelSummary(filters);
            if (result.success) {
                this.renderData(result.data);
            }
        } catch (error) {
            console.error('[CrossChannelComparison] 加载失败:', error);
        } finally {
            this.loading = false;
        }
    }

    renderData(data) {
        var metrics = data.comparison_metrics;
        var totalCostEl = this.container.querySelector('#totalCost');
        var bestCostEl = this.container.querySelector('#bestCostPlatform');
        var bestConversionEl = this.container.querySelector('#bestConversionPlatform');

        if (totalCostEl) {
            totalCostEl.textContent = '¥' + (metrics.total_cost || 0).toLocaleString();
        }
        if (bestCostEl) {
            bestCostEl.textContent = metrics.best_cost_platform || '-';
        }
        if (bestConversionEl) {
            bestConversionEl.textContent = metrics.best_conversion_platform || '-';
        }

        if (data.derived_metrics && data.platform_summary) {
            var indicators = [
                { name: '成本控制', max: 100 },
                { name: '曝光效率', max: 100 },
                { name: '点击转化', max: 100 },
                { name: '开户转化', max: 100 }
            ];

            var series = data.platform_summary.map(function(p, i) {
                var m = data.derived_metrics[i];
                return {
                    name: p.platform,
                    value: [
                        100 - Math.min(m.cost_per_lead * 2, 100),
                        m.click_rate * 100,
                        m.lead_conversion_rate * 100,
                        80
                    ]
                };
            });

            if (this.charts.radar) {
                this.charts.radar.dispose();
            }

            this.charts.radar = new RadarChart('#radarChart', {
                indicators: indicators,
                series: series
            });
            this.charts.radar.init();
        }
    }

    destroy() {
        Object.values(this.charts).forEach(function(chart) {
            if (chart && chart.dispose) {
                chart.dispose();
            }
        });
        this.charts = {};
    }
}

window.CrossChannelComparisonReport = CrossChannelComparisonReport;
