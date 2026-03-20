/**
 * 省心投 BI - 小红书笔记分析报表
 * 显示笔记互动数据和效果分析
 * 支持三种子报表类型:
 * - xhs-notes-list: 笔记列表
 * - xhs-notes-operation: 运营分析
 * - xhs-notes-creation: 创作分析
 */

class XhsNotesReport {
    /**
     * 创建小红书笔记报表实例
     * @param {string} reportType - 报表类型 (list/operation/creation)
     */
    constructor(reportType = 'xhs-notes-list') {
        this.reportType = reportType;
        this.currentData = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.filters = {};

        this.init();
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化小红书笔记分析报表 - 类型:', this.reportType);
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

            const response = await API.getXhsNotesAnalysis(this.filters, this.currentPage, this.pageSize);

            if (response.error) {
                throw new Error(response.error);
            }

            this.currentData = response;
            console.log('小红书笔记数据加载成功:', this.currentData);

        } catch (error) {
            console.error('加载小红书笔记数据失败:', error);
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

        return filters;
    }

    /**
     * 获取报表标题
     */
    getReportTitle() {
        const titles = {
            'xhs-notes-list': '笔记列表',
            'xhs-notes-operation': '运营分析',
            'xhs-notes-creation': '创作分析'
        };
        return titles[this.reportType] || '小红书报表';
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

        const title = this.getReportTitle();

        container.innerHTML = `
            <div class="xhs-notes-report">
                <h3 class="report-title">${title}</h3>

                <!-- 汇总卡片区域 -->
                <div class="metrics-cards" id="xhsMetrics"></div>

                <!-- 主内容区域 -->
                <div class="chart-section" id="mainSection">
                    <!-- 内容根据报表类型动态生成 -->
                </div>
            </div>
        `;

        this.renderMetrics();

        // 根据报表类型渲染不同内容
        switch (this.reportType) {
            case 'xhs-notes-list':
                this.renderNotesList();
                break;
            case 'xhs-notes-operation':
                this.renderOperationAnalysis();
                break;
            case 'xhs-notes-creation':
                this.renderCreationAnalysis();
                break;
            default:
                this.renderNotesList();
        }
    }

    /**
     * 渲染指标卡片
     */
    renderMetrics() {
        if (!this.currentData || !this.currentData.summary) {
            return;
        }

        const container = document.getElementById('xhsMetrics');
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
                title: '笔记总数',
                value: summary.total_notes,
                format: 'number',
                type: 'info'
            },
            {
                title: '总曝光量',
                value: summary.total_impressions,
                format: 'number',
                type: 'success'
            },
            {
                title: '总点击量',
                value: summary.total_clicks,
                format: 'number',
                type: 'warning'
            },
            {
                title: '总互动量',
                value: summary.total_interactions,
                format: 'number',
                type: 'danger'
            },
            {
                title: '平均互动率',
                value: summary.avg_interaction_rate,
                suffix: '%',
                decimals: 2,
                type: 'primary'
            },
            {
                title: '平均单笔记成本',
                value: summary.avg_cost_per_note,
                prefix: '¥',
                decimals: 2,
                type: 'success'
            },
            {
                title: '平均转化成本',
                value: summary.avg_conversion_cost,
                prefix: '¥',
                decimals: 2,
                type: 'warning'
            }
        ];

        metrics.forEach(metric => {
            const card = new MetricCard(metric);
            container.appendChild(card.element);
        });
    }

    /**
     * 渲染笔记列表
     */
    renderNotesList() {
        const section = document.getElementById('mainSection');
        if (!section) {
            return;
        }

        section.innerHTML = `
            <div class="section-header">
                <h3 class="section-title">笔记列表</h3>
                <div class="table-info">
                    共 <span class="total-count" id="totalCount">${this.currentData?.pagination?.total || 0}</span> 条笔记
                </div>
            </div>
            <div class="data-table-wrapper">
                <div class="data-table-container">
                    <table class="data-table" id="notesTable">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>笔记ID</th>
                                <th>花费</th>
                                <th>曝光量</th>
                                <th>点击量</th>
                                <th>互动量</th>
                                <th>转化数</th>
                                <th>互动率</th>
                                <th>单互动成本</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                <div class="table-pagination" id="pagination"></div>
            </div>
        `;

        this.renderNotesTable();
        this.renderPagination();
    }

    /**
     * 渲染运营分析
     */
    renderOperationAnalysis() {
        const section = document.getElementById('mainSection');
        if (!section) {
            return;
        }

        // TODO: 实现运营分析的具体内容
        section.innerHTML = `
            <div class="operation-analysis">
                <p>运营分析功能正在开发中...</p>
                <p>将包含以下内容:</p>
                <ul>
                    <li>笔记发布时间分析</li>
                    <li>标题关键词分析</li>
                    <li>互动趋势分析</li>
                    <li>成本效益分析</li>
                </ul>
            </div>
        `;
    }

    /**
     * 渲染创作分析
     */
    renderCreationAnalysis() {
        const section = document.getElementById('mainSection');
        if (!section) {
            return;
        }

        // TODO: 实现创作分析的具体内容
        section.innerHTML = `
            <div class="creation-analysis">
                <p>创作分析功能正在开发中...</p>
                <p>将包含以下内容:</p>
                <ul>
                    <li>2026年目标追踪</li>
                    <li>优质笔记分析</li>
                    <li>创作趋势洞察</li>
                    <li>内容优化建议</li>
                </ul>
            </div>
        `;
    }

    /**
     * 渲染笔记表格
     */
    renderNotesTable() {
        if (!this.currentData || !this.currentData.notes) {
            return;
        }

        const tbody = document.querySelector('#notesTable tbody');
        if (!tbody) {
            return;
        }

        this.currentData.notes.forEach(note => {
            const row = document.createElement('tr');

            const clickRate = note.rates.click_rate.toFixed(2);
            const interactionCost = note.rates.avg_interaction_cost.toFixed(2);

            row.innerHTML = `
                <td>${note.date}</td>
                <td>
                    <a href="${note.note_url}" target="_blank" class="note-link">
                        ${note.note_id.substring(0, 12)}...
                    </a>
                </td>
                <td>${FormatHelper.formatCurrency(note.metrics.cost)}</td>
                <td>${FormatHelper.formatNumber(note.metrics.impressions)}</td>
                <td>${FormatHelper.formatNumber(note.metrics.clicks)}</td>
                <td>${FormatHelper.formatNumber(note.metrics.total_interactions)}</td>
                <td>${FormatHelper.formatNumber(note.metrics.action_button_clicks)}</td>
                <td>${clickRate}%</td>
                <td>¥${FormatHelper.formatNumber(interactionCost)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * 渲染分页
     */
    renderPagination() {
        if (!this.currentData || !this.currentData.pagination) {
            return;
        }

        const container = document.getElementById('pagination');
        if (!container) {
            return;
        }

        const pagination = this.currentData.pagination;
        const { page, total_pages } = pagination;

        container.innerHTML = `
            <div class="pagination-info">
                <span>第 ${page} / ${total_pages} 页</span>
                <span>共 ${pagination.total} 条</span>
            </div>
            <div class="pagination-buttons">
                <button class="pagination-btn" id="prevPage" ${page <= 1 ? 'disabled' : ''}>
                    上一页
                </button>
                <button class="pagination-btn" id="nextPage" ${page >= total_pages ? 'disabled' : ''}>
                    下一页
                </button>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 分页按钮
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.refresh();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            const totalPages = this.currentData?.pagination?.total_pages || 1;
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.refresh();
            }
        });
    }

    /**
     * 刷新数据
     */
    async refresh() {
        await this.loadData();
        this.render();
        this.bindEvents();
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
        // 清理工作
    }
}

// 导出到全局
window.XhsNotesReport = XhsNotesReport;
