class MaterialEffectivenessReport {
    constructor(containerId) {
        this.container = containerId ? document.querySelector(containerId) : document.getElementById('mainContent');
        this.charts = {};
        this.loading = false;
        this.currentPage = 1;
        this.pageSize = 20;
        this.total = 0;
        this.filters = {};
        this.init();
    }

    async init() {
        console.log('[MaterialEffectiveness] 初始化');
        this.renderStructure();
        this.bindEvents();
        await this.loadMaterialList();
    }

    renderStructure() {
        var html = '<div class="filter-bar">';
        html += '<div class="filter-section">';
        html += '<div class="filter-group">';
        html += '<label>搜索</label>';
        html += '<input type="text" id="searchInput" placeholder="搜索素材名称..." style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">';
        html += '</div>';
        html += '<div class="filter-group">';
        html += '<label>排序</label>';
        html += '<select id="sortBy" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">';
        html += '<option value="overall_score">综合评分</option>';
        html += '<option value="cost">投放金额</option>';
        html += '<option value="lead_users">线索人数</option>';
        html += '<option value="valid_customer_users">有效户人数</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="charts-grid">';
        html += '<div class="chart-card" style="grid-column: 1 / -1;">';
        html += '<h3>投放金额 vs 有效户人数</h3>';
        html += '<div id="scatterChart" style="width:100%;height:500px;"></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="table-section">';
        html += '<h3>素材列表</h3>';
        html += '<div id="materialTable"></div>';
        html += '</div>';

        this.container.innerHTML = html;
    }

    bindEvents() {
        var searchInput = this.container.querySelector('#searchInput');
        var searchTimeout;

        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                this.filters.search = e.target.value;
                this.currentPage = 1;
                this.loadMaterialList();
            }.bind(this), 500);
        }.bind(this));

        var sortSelect = this.container.querySelector('#sortBy');
        sortSelect.addEventListener('change', function(e) {
            this.filters.sort_by = e.target.value;
            this.currentPage = 1;
            this.loadMaterialList();
        }.bind(this));
    }

    async loadMaterialList() {
        if (this.loading) return;
        this.loading = true;

        try {
            var result = await window.APIManager.getMaterialList(
                this.filters,
                this.currentPage,
                this.pageSize,
                this.filters.sort_by || 'overall_score'
            );

            if (result.success) {
                this.total = result.data.total;
                this.renderTable(result.data.items);
                this.renderScatterChart(result.data.items);
            }
        } catch (error) {
            console.error('[MaterialEffectiveness] 加载失败:', error);
        } finally {
            this.loading = false;
        }
    }

    renderTable(items) {
        var tableContainer = this.container.querySelector('#materialTable');
        
        if (!items || items.length === 0) {
            tableContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">暂无数据</div>';
            return;
        }

        var headers = ['素材名称', '综合评分', '投放金额', '线索数', '有效户数', '转化率'];
        
        var html = '<div class="data-table-container">';
        html += '<table class="data-table">';
        html += '<thead>';
        html += '<tr>';
        html += headers.map(function(h) { return '<th>' + h + '</th>'; }).join('');
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';

        items.forEach(function(item) {
            html += '<tr>';
            html += '<td>' + (item.material_name || '-') + '</td>';
            html += '<td>' + (item.overall_score ? item.overall_score.toFixed(1) : '-') + '</td>';
            html += '<td>¥' + (item.cost || 0).toLocaleString() + '</td>';
            html += '<td>' + (item.lead_users || 0) + '</td>';
            html += '<td>' + (item.valid_customer_users || 0) + '</td>';
            var conversionRate = item.lead_users ? ((item.valid_customer_users / item.lead_users) * 100).toFixed(2) : 0);
            html += '<td>' + conversionRate + '%</td>';
            html += '</tr>';
        });

        html += '</tbody>';
        html += '</table>';

        html += '<div class="table-pagination">';
        html += '<div class="pagination-info">共 ' + this.total + ' 条记录</div>';
        html += '<div class="pagination-buttons">';
        html += '<button id="prevPageBtn" ' + (this.currentPage === 1 ? 'disabled' : '') + '>上一页</button>';
        html += '<span>第 ' + this.currentPage + ' 页</span>';
        html += '<button id="nextPageBtn" ' + (this.currentPage * this.pageSize >= this.total ? 'disabled' : '') + '>下一页</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        tableContainer.innerHTML = html;

        this.container.querySelector('#prevPageBtn').addEventListener('click', function() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadMaterialList();
            }
        }.bind(this));

        this.container.querySelector('#nextPageBtn').addEventListener('click', function() {
            if (this.currentPage * this.pageSize < this.total) {
                this.currentPage++;
                this.loadMaterialList();
            }
        }.bind(this));
    }

    renderScatterChart(items) {
        if (this.charts.scatter) {
            this.charts.scatter.dispose();
        }

        var chartData = items.map(function(item) {
            return {
                name: item.material_name || '-',
                value: [item.cost || 0, item.valid_customer_users || 0],
                score: item.overall_score || 0
            };
        });

        this.charts.scatter = new ScatterChart('#scatterChart', {
            data: chartData,
            xAxisName: '投放金额',
            yAxisName: '有效户人数',
            bubbleSizeKey: 'score'
        });

        this.charts.scatter.init();
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

window.MaterialEffectivenessReport = MaterialEffectivenessReport;
