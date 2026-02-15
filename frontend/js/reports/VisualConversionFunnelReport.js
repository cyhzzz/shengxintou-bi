class VisualConversionFunnelReport {
    constructor(containerId) {
        this.container = containerId ? document.querySelector(containerId) : document.getElementById('mainContent');
        this.charts = {};
        this.loading = false;
        this.startDate = null;
        this.endDate = null;
        this.compareBy = 'all';
        this.init();
    }

    async init() {
        console.log('[VisualConversionFunnel] 初始化');
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
        html += '<div class="filter-group">';
        html += '<label>对比维度</label>';
        html += '<select id="compareBy" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">';
        html += '<option value="all">整体</option>';
        html += '<option value="platform">按平台</option>';
        html += '<option value="agency">按代理商</option>';
        html += '<option value="business_model">按业务模式</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="metrics-cards">';
        html += '<div class="metric-card" data-metric="cost">';
        html += '<div class="metric-label">总投放金额</div>';
        html += '<div class="metric-value" id="totalCost">-</div>';
        html += '</div>';
        html += '<div class="metric-card" data-metric="leads">';
        html += '<div class="metric-label">总转化率</div>';
        html += '<div class="metric-value" id="totalConversionRate">-</div>';
        html += '</div>';
        html += '<div class="metric-card" data-metric="accounts">';
        html += '<div class="metric-label">单有效户成本</div>';
        html += '<div class="metric-value" id="costPerValidCustomer">-</div>';
        html += '</div>';
        html += '<div class="metric-card" data-metric="conversion">';
        html += '<div class="metric-label">问题环节</div>';
        html += '<div class="metric-value" id="problemStage">-</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="charts-grid">';
        html += '<div class="chart-card full-width">';
        html += '<h3>可视化转化漏斗</h3>';
        html += '<div id="funnelChart" style="width:100%;height:600px;"></div>';
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

        var compareBySelect = this.container.querySelector('#compareBy');
        compareBySelect.addEventListener('change', function(e) {
            this.compareBy = e.target.value;
            this.loadData();
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
            var result = await window.APIManager.getConversionFunnel(filters, this.compareBy);
            if (result.success) {
                this.renderData(result.data);
            }
        } catch (error) {
            console.error('[VisualConversionFunnel] 加载失败:', error);
        } finally {
            this.loading = false;
        }
    }

    renderData(data) {
        var metrics = data.metrics;
        var stages = data.stages;

        var totalCostEl = this.container.querySelector('#totalCost');
        var totalRateEl = this.container.querySelector('#totalConversionRate');
        var costPerValidEl = this.container.querySelector('#costPerValidCustomer');
        var problemStageEl = this.container.querySelector('#problemStage');

        if (totalCostEl) {
            totalCostEl.textContent = '¥' + (metrics.total_cost || 0).toLocaleString();
        }
        if (totalRateEl) {
            totalRateEl.textContent = (metrics.total_conversion_rate * 100 || 0).toFixed(2) + '%';
        }
        if (costPerValidEl) {
            costPerValidEl.textContent = '¥' + (metrics.cost_per_valid_customer || 0).toFixed(2);
        }
        if (problemStageEl) {
            problemStageEl.textContent = metrics.problem_stage || '-';
        }

        if (stages && stages.length > 0) {
            if (this.charts.funnel) {
                this.charts.funnel.dispose();
            }

            var seriesData = [{
                name: '转化漏斗',
                value: stages.map(function(s) { return s.value || 0; }),
                labels: stages.map(function(s) { return s.name; })
            }];

            this.charts.funnel = new FunnelChart('#funnelChart', {
                data: seriesData,
                label: { show: true, position: 'top' }
            });

            this.charts.funnel.init();
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

window.VisualConversionFunnelReport = VisualConversionFunnelReport;
