/**
 * 报告生成器
 * 支持生成和导出各类分析报告
 */

class ReportGenerator {
    constructor() {
        this.currentReport = null;
        this.reportConfig = {
            title: '省心投 BI 分析报告',
            includeSummary: true,
            includeTrends: true,
            includeComparison: true,
            includeCharts: true,
            dateRange: null,
            format: 'pdf' // pdf, excel, html
        };
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        console.log('报告生成器初始化...');
        this.render();
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 生成报告按钮
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }

        // 导出报告按钮
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        const exportExcelBtn = document.getElementById('exportExcelBtn');
        const exportHtmlBtn = document.getElementById('exportHtmlBtn');

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportReport('pdf'));
        }
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportReport('excel'));
        }
        if (exportHtmlBtn) {
            exportHtmlBtn.addEventListener('click', () => this.exportReport('html'));
        }

        // 配置选项变化
        const checkboxes = document.querySelectorAll('.report-config input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const key = e.target.name;
                this.reportConfig[key] = e.target.checked;
            });
        });

        // 格式选择
        const formatRadios = document.querySelectorAll('input[name="reportFormat"]');
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.reportConfig.format = e.target.value;
            });
        });
    }

    /**
     * 渲染报告生成器界面
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <!-- 报告配置卡片 -->
            <div class="card card--filter">
                <div class="card__header">
                    <h3 class="card__title">报告配置</h3>
                </div>
                <div class="card__body">
                    <form id="reportConfigForm">
                        <div class="form-group">
                            <label class="form-label" for="reportTitle">报告标题:</label>
                            <input type="text" id="reportTitle" class="form-control"
                                   value="${this.reportConfig.title}"
                                   placeholder="请输入报告标题">
                        </div>

                        <div class="form-group">
                            <label class="form-label">报告格式:</label>
                            <div style="display: flex; gap: var(--spacing);">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="reportFormat" value="pdf" checked>
                                    <span>PDF</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="reportFormat" value="excel">
                                    <span>Excel</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="radio" name="reportFormat" value="html">
                                    <span>HTML</span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">包含内容:</label>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" name="includeSummary" checked>
                                    <span>数据概览</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" name="includeTrends" checked>
                                    <span>趋势分析</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" name="includeComparison" checked>
                                    <span>对比分析</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" name="includeCharts" checked>
                                    <span>图表展示</span>
                                </label>
                            </div>
                        </div>

                        <div style="margin-top: var(--spacing);">
                            <button id="generateReportBtn" class="btn btn--primary btn--lg">
                                生成报告
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 报告预览卡片 -->
            <div class="card">
                <div class="card__header">
                    <h3 class="card__title">报告预览</h3>
                </div>
                <div class="card__body">
                    <div id="reportPreview" style="min-height: 400px;">
                        <div class="preview-placeholder" style="
                            text-align: center;
                            padding: 60px 20px;
                            color: var(--text-secondary);
                        ">
                            <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                            <p>点击"生成报告"按钮开始生成报告</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 导出操作卡片 -->
            <div class="card" style="display: none;" id="exportSection">
                <div class="card__header">
                    <h3 class="card__title">导出报告</h3>
                </div>
                <div class="card__body">
                    <div style="display: flex; gap: var(--spacing-sm);">
                        <button id="exportPdfBtn" class="btn btn--primary">
                            导出 PDF
                        </button>
                        <button id="exportExcelBtn" class="btn btn--primary">
                            导出 Excel
                        </button>
                        <button id="exportHtmlBtn" class="btn btn--outline">
                            导出 HTML
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成报告
     */
    async generateReport() {
        try {
            // 更新标题
            const titleInput = document.getElementById('reportTitle');
            if (titleInput) {
                this.reportConfig.title = titleInput.value;
            }

            // 获取筛选条件
            const filters = window.app.filterBar.getFilters();

            // 显示加载状态
            const previewContainer = document.getElementById('reportPreview');
            if (previewContainer) {
                previewContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>正在生成报告...</p>
                    </div>
                `;
            }

            // 收集报告数据
            const reportData = await this.collectReportData(filters);

            // 生成报告内容
            this.currentReport = this.buildReport(reportData, filters);

            // 渲染预览
            this.renderPreview();

            // 显示导出按钮
            const exportSection = document.getElementById('exportSection');
            if (exportSection) {
                exportSection.style.display = 'block';
            }

            console.log('报告生成成功');
        } catch (error) {
            console.error('报告生成失败:', error);
            this.showError('报告生成失败: ' + error.message);
        }
    }

    /**
     * 收集报告数据
     */
    async collectReportData(filters) {
        const data = {
            summary: null,
            trend: null,
            comparison: null,
            funnel: null,
            external: null
        };

        // 收集汇总数据
        if (this.reportConfig.includeSummary) {
            try {
                data.summary = await API.getSummary(filters);
            } catch (e) {
                console.error('获取汇总数据失败:', e);
            }
        }

        // 收集趋势数据
        if (this.reportConfig.includeTrends) {
            try {
                data.trend = await API.getTrend(filters, ['cost', 'impressions', 'clicks', 'leads', 'new_accounts']);
            } catch (e) {
                console.error('获取趋势数据失败:', e);
            }
        }

        // 收集对比数据
        if (this.reportConfig.includeComparison) {
            try {
                data.comparison = await API.getConversionFunnel(filters);
            } catch (e) {
                console.error('获取对比数据失败:', e);
            }
        }

        // 收集外部分析数据
        try {
            data.external = await API.getExternalDataAnalysis(filters);
        } catch (e) {
            console.error('获取外部分析数据失败:', e);
        }

        return data;
    }

    /**
     * 构建报告
     */
    buildReport(data, filters) {
        const now = new Date();
        const reportDate = now.toLocaleDateString('zh-CN');
        const reportTime = now.toLocaleTimeString('zh-CN');

        let html = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>${this.reportConfig.title}</title>
                <style>
                    body {
                        font-family: 'Microsoft YaHei', Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .report-container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: white;
                        padding: 40px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .report-header {
                        text-align: center;
                        border-bottom: 2px solid #409EFF;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .report-title {
                        font-size: 32px;
                        color: #303133;
                        margin: 0 0 10px 0;
                    }
                    .report-meta {
                        color: #909399;
                        font-size: 14px;
                    }
                    .report-section {
                        margin-bottom: 40px;
                    }
                    .section-title {
                        font-size: 24px;
                        color: #409EFF;
                        border-left: 4px solid #409EFF;
                        padding-left: 12px;
                        margin-bottom: 20px;
                    }
                    .metric-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .metric-card {
                        background: #f9f9f9;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                    }
                    .metric-value {
                        font-size: 28px;
                        font-weight: bold;
                        color: #409EFF;
                        margin: 10px 0;
                    }
                    .metric-label {
                        color: #606266;
                        font-size: 14px;
                    }
                    .data-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    .data-table th,
                    .data-table td {
                        border: 1px solid #e0e0e0;
                        padding: 12px;
                        text-align: left;
                    }
                    .data-table th {
                        background: #f5f7fa;
                        font-weight: bold;
                        color: #303133;
                    }
                    .data-table tr:nth-child(even) {
                        background: #fafafa;
                    }
                    .chart-placeholder {
                        background: #f9f9f9;
                        border: 1px dashed #ccc;
                        height: 300px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #909399;
                    }
                    .report-footer {
                        text-align: center;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e0e0e0;
                        color: #909399;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="report-header">
                        <h1 class="report-title">${this.reportConfig.title}</h1>
                        <div class="report-meta">
                            生成时间: ${reportDate} ${reportTime}
                            <br>
                            数据范围: ${filters.date_range ? filters.date_range[0] + ' 至 ' + filters.date_range[1] : '全部'}
                        </div>
                    </div>
        `;

        // 数据概览
        if (this.reportConfig.includeSummary && data.summary && data.summary.data) {
            html += this.buildSummarySection(data.summary);
        }

        // 趋势分析
        if (this.reportConfig.includeTrends && data.trend) {
            html += this.buildTrendSection(data.trend);
        }

        // 对比分析
        if (this.reportConfig.includeComparison && data.comparison) {
            html += this.buildComparisonSection(data.comparison);
        }

        // 外部分析
        if (data.external) {
            html += this.buildExternalSection(data.external);
        }

        html += `
                    <div class="report-footer">
                        <p>本报告由省心投 BI 系统自动生成</p>
                        <p>© ${now.getFullYear()} 省心投. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return html;
    }

    /**
     * 构建数据概览部分
     */
    buildSummarySection(summary) {
        const totals = summary.data.reduce((acc, item) => {
            acc.cost += item.metrics.cost || 0;
            acc.impressions += item.metrics.impressions || 0;
            acc.clicks += item.metrics.clicks || 0;
            acc.leads += item.metrics.leads || 0;
            acc.accounts += item.metrics.new_accounts || 0;
            return acc;
        }, { cost: 0, impressions: 0, clicks: 0, leads: 0, accounts: 0 });

        return `
            <div class="report-section">
                <h2 class="section-title">一、数据概览</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-label">总花费</div>
                        <div class="metric-value">¥${totals.cost.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">总曝光</div>
                        <div class="metric-value">${totals.impressions.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">总点击</div>
                        <div class="metric-value">${totals.clicks.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">线索数</div>
                        <div class="metric-value">${totals.leads.toLocaleString()}</div>
                    </div>
                </div>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-label">开户数</div>
                        <div class="metric-value">${totals.accounts.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">点击率</div>
                        <div class="metric-value">${(totals.clicks / totals.impressions * 100).toFixed(2)}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">线索转化率</div>
                        <div class="metric-value">${(totals.leads / totals.clicks * 100).toFixed(2)}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">单线索成本</div>
                        <div class="metric-value">¥${(totals.cost / totals.leads).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 构建趋势分析部分
     */
    buildTrendSection(trend) {
        // 检查trend数据格式，确保兼容性
        if (!trend || !trend.dates) {
            return `
                <div class="report-section">
                    <h2 class="section-title">二、趋势分析</h2>
                    <p>暂无趋势数据</p>
                </div>
            `;
        }

        // 确保series是数组
        const series = Array.isArray(trend.series) ? trend.series : [];

        // 创建数据查找辅助函数
        const getValue = (metricName, dateIndex) => {
            if (!Array.isArray(series)) return 0;
            const metricSeries = series.find(s => s.name === metricName || s.metric === metricName);
            if (metricSeries && Array.isArray(metricSeries.data)) {
                return metricSeries.data[dateIndex] || 0;
            }
            return 0;
        };

        return `
            <div class="report-section">
                <h2 class="section-title">二、趋势分析</h2>
                ${this.reportConfig.includeCharts ? '<div class="chart-placeholder">趋势图表区域（PDF导出时需要图表截图）</div>' : ''}
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>花费(¥)</th>
                            <th>曝光</th>
                            <th>点击</th>
                            <th>线索</th>
                            <th>开户</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trend.dates.map((date, i) => {
                            const cost = getValue('cost', i);
                            const impressions = getValue('impressions', i);
                            const clicks = getValue('clicks', i);
                            const leads = getValue('leads', i);
                            const accounts = getValue('new_accounts', i);

                            return `
                                <tr>
                                    <td>${date}</td>
                                    <td>${cost.toLocaleString()}</td>
                                    <td>${impressions.toLocaleString()}</td>
                                    <td>${clicks.toLocaleString()}</td>
                                    <td>${leads.toLocaleString()}</td>
                                    <td>${accounts.toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * 构建对比分析部分
     */
    buildComparisonSection(comparison) {
        return `
            <div class="report-section">
                <h2 class="section-title">三、转化漏斗分析</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>平台</th>
                            <th>曝光</th>
                            <th>点击</th>
                            <th>线索</th>
                            <th>开户</th>
                            <th>总转化率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparison.platform_funnel.map(p => `
                            <tr>
                                <td>${p.platform}</td>
                                <td>${p.impressions.toLocaleString()}</td>
                                <td>${p.clicks.toLocaleString()}</td>
                                <td>${p.leads.toLocaleString()}</td>
                                <td>${p.new_accounts.toLocaleString()}</td>
                                <td>${p.rates.overall_conversion_rate.toFixed(2)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * 构建外部分析部分
     */
    buildExternalSection(external) {
        let html = `
            <div class="report-section">
                <h2 class="section-title">四、外部数据分析</h2>
        `;

        if (external.roi_analysis) {
            const roi = external.roi_analysis;
            html += `
                <h3>ROI分析</h3>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-label">投资回报率</div>
                        <div class="metric-value">${roi.roi.toFixed(2)}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">总投入</div>
                        <div class="metric-value">¥${roi.total_investment.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">总回报</div>
                        <div class="metric-value">¥${roi.total_returns.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">获客成本</div>
                        <div class="metric-value">¥${roi.metrics.cost_per_account.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }

        if (external.agency_ranking && external.agency_ranking.length > 0) {
            html += `
                <h3>代理商排名</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>排名</th>
                            <th>代理商</th>
                            <th>综合评分</th>
                            <th>开户数</th>
                            <th>单开户成本</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${external.agency_ranking.slice(0, 10).map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${a.agency}</td>
                                <td>${a.score}</td>
                                <td>${a.metrics.new_accounts.toLocaleString()}</td>
                                <td>¥${a.metrics.cost_per_account.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;
        return html;
    }

    /**
     * 渲染报告预览
     */
    renderPreview() {
        const previewContainer = document.getElementById('reportPreview');
        if (!previewContainer || !this.currentReport) return;

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '800px';
        iframe.style.border = '1px solid #e0e0e0';
        iframe.srcdoc = this.currentReport;

        previewContainer.innerHTML = '';
        previewContainer.appendChild(iframe);
    }

    /**
     * 导出报告
     */
    exportReport(format) {
        if (!this.currentReport) {
            alert('请先生成报告');
            return;
        }

        const filename = `${this.reportConfig.title}_${new Date().getTime()}`;

        switch (format) {
            case 'html':
                this.downloadHtml(this.currentReport, filename);
                break;
            case 'pdf':
                alert('PDF导出功能需要后端支持，当前已生成HTML预览。请使用浏览器的打印功能（Ctrl+P）并选择"另存为PDF"来导出PDF。');
                break;
            case 'excel':
                alert('Excel导出功能正在开发中，请使用HTML格式导出。');
                break;
            default:
                console.error('不支持的导出格式:', format);
        }
    }

    /**
     * 下载HTML文件
     */
    downloadHtml(content, filename) {
        const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const previewContainer = document.getElementById('reportPreview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="error-state" style="
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
                    ">生成失败</div>
                    <div style="color: var(--text-secondary);">${message}</div>
                </div>
            `;
        }
    }
}

// 导出
window.ReportGenerator = ReportGenerator;
