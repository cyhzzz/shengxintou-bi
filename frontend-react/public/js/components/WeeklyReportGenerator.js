/**
 * 周报生成器组件
 *
 * 功能：
 * - 左右分栏布局
 * - 左侧：报告类型选择、报告期选择、格式选择、操作按钮
 * - 右侧：竖版画布预览
 * - 支持生成、编辑、导出周报
 */

class WeeklyReportGenerator {
    constructor() {
        this.currentReport = null;
        this.selectedPeriod = null;
        this.selectedFormat = 'pdf';
        this.reportType = 'weekly';  // weekly | monthly

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('周报生成器初始化...');
        this.render();
        await this.loadWeekOptions();
        this.bindEvents();
    }

    /**
     * 渲染界面
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="report-generator-container">
                <!-- 左侧控制面板 -->
                <div class="report-controls card">
                    <div class="card__header">
                        <h3 class="card__title">报告配置</h3>
                    </div>
                    <div class="card__body">
                        <!-- 报告类型选择 -->
                        <div class="control-group">
                            <label class="control-label">报告类型</label>
                            <div class="btn-group">
                                <button class="btn is-active" data-type="weekly" data-report-type>
                                    周报
                                </button>
                                <button class="btn is-disabled" data-type="monthly" data-report-type>
                                    月报
                                </button>
                            </div>
                        </div>

                        <!-- 报告期选择 -->
                        <div class="control-group">
                            <label class="control-label" for="reportPeriodSelect">报告期</label>
                            <select class="form-control" id="reportPeriodSelect">
                                <option value="">请选择报告期</option>
                            </select>
                            <div class="period-info" id="periodInfo" style="display: none;">
                                <span class="period-date" id="periodDate"></span>
                                <span class="period-cumulative" id="periodSequence"></span>
                            </div>
                        </div>

                        <!-- 报告格式选择 -->
                        <div class="control-group">
                            <label class="control-label">报告格式</label>
                            <div class="btn-group">
                                <button class="btn is-active" data-format="pdf" data-report-format>
                                    PDF
                                </button>
                                <button class="btn" data-format="html" data-report-format>
                                    HTML
                                </button>
                            </div>
                        </div>

                        <!-- 操作按钮 -->
                        <div class="control-actions">
                            <button class="btn btn--primary btn--lg" id="generateReportBtn">
                                <i class="icon-generate"></i>
                                <span>生成报告</span>
                            </button>
                            <button class="btn btn--secondary btn--lg" id="exportReportBtn" disabled>
                                <i class="icon-download"></i>
                                <span>导出报告</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 右侧预览画布 -->
                <div class="report-preview card">
                    <div class="preview-header">
                        <span class="preview-title">报告预览</span>
                        <div class="preview-actions">
                            <button class="btn btn--sm btn--ghost" id="editReportBtn" title="编辑报告" disabled>
                                <i class="icon-edit"></i>
                            </button>
                            <button class="btn btn--sm btn--primary" id="saveReportBtn" title="保存报告" disabled>
                                <i class="icon-save"></i>
                                <span>保存</span>
                            </button>
                            <button class="btn btn--sm btn--ghost" id="fullscreenBtn" title="全屏预览">
                                <i class="icon-fullscreen"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 预览画布 -->
                    <div class="preview-canvas" id="previewCanvas">
                        <div class="preview-placeholder">
                            <div class="placeholder-icon">📄</div>
                            <div class="placeholder-text">选择报告期并点击"生成报告"</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 样式 -->
            <style>
                .report-generator-container {
                    display: flex;
                    gap: 20px;
                    height: calc(100vh - 140px);
                    padding: 0;
                }

                /* 左侧控制面板 */
                .report-controls {
                    width: 320px;
                    flex-shrink: 0;
                }

                .control-group {
                    margin-bottom: 24px;
                }

                .control-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                }

                .period-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 12px;
                    background: var(--bg-hover);
                    border-radius: var(--border-radius);
                    margin-top: 8px;
                }

                .period-date {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .period-cumulative {
                    font-size: 12px;
                    color: var(--text-secondary);
                }

                .control-actions {
                    margin-top: 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .btn--lg {
                    height: 44px;
                    font-size: 15px;
                }

                /* 右侧预览画布 */
                .report-preview {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                }

                .preview-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .preview-actions {
                    display: flex;
                    gap: 8px;
                }

                .preview-canvas {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    padding: 40px;
                    overflow-y: auto;
                    background: #e8e8e8;
                }

                .preview-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                    color: var(--text-muted);
                }

                .placeholder-icon {
                    font-size: 64px;
                    margin-bottom: 16px;
                }

                .placeholder-text {
                    font-size: 14px;
                }

                .placeholder-hint {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: 8px;
                }

                .report-frame {
                    width: 480px;
                    min-height: 800px;
                    background: white;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    border: none;
                }

                /* 全屏模式 */
                .preview-canvas.fullscreen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 9999;
                    padding: 20px;
                }
            </style>
        `;
    }

    /**
     * 加载周次选项
     */
    async loadWeekOptions() {
        try {
            const response = await API.get('/api/v1/reports/weekly/periods');

            if (response.success) {
                this.populatePeriodSelect(response.data);
            }
        } catch (error) {
            console.error('加载周次选项失败:', error);
            this.showError('加载周次选项失败');
        }
    }

    /**
     * 填充报告期下拉框
     */
    populatePeriodSelect(options) {
        const select = document.getElementById('reportPeriodSelect');
        if (!select) return;

        // 清空现有选项
        select.innerHTML = '<option value="">请选择报告期</option>';

        // 添加新选项
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option.value;

            // 如果有禁用原因，显示在选项文本中
            if (option.disabled && option.disabled_reason) {
                // 禁用选项：label + 禁用原因
                optElement.textContent = `${option.label} - ${option.disabled_reason}`;
                optElement.disabled = true;
            } else {
                // 正常选项：直接使用 label（label 已包含日期范围）
                optElement.textContent = option.label;
            }

            optElement.dataset.info = JSON.stringify(option);
            select.appendChild(optElement);
        });
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 报告类型选择
        const typeButtons = document.querySelectorAll('[data-report-type]');
        typeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('is-disabled')) return;

                typeButtons.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');

                this.reportType = btn.dataset.type;
            });
        });

        // 报告期选择
        const periodSelect = document.getElementById('reportPeriodSelect');
        if (periodSelect) {
            periodSelect.addEventListener('change', async (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                if (selectedOption.value) {
                    const info = JSON.parse(selectedOption.dataset.info);
                    this.selectedPeriod = info;
                    this.updatePeriodInfo(info);

                    // 检查数据库中是否已存在该报告期的数据
                    await this.checkReportExists(info);
                } else {
                    this.selectedPeriod = null;
                    this.hidePeriodInfo();
                    this.showGeneratePrompt();
                }
            });
        }

        // 报告格式选择
        const formatButtons = document.querySelectorAll('[data-report-format]');
        formatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                formatButtons.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');

                this.selectedFormat = btn.dataset.format;
            });
        });

        // 生成报告按钮
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }

        // 导出报告按钮
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }

        // 全屏预览按钮
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // 保存报告按钮
        const saveBtn = document.getElementById('saveReportBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveReport());
        }
    }

    /**
     * 更新报告期信息显示
     */
    updatePeriodInfo(info) {
        const periodInfo = document.getElementById('periodInfo');
        const periodDate = document.getElementById('periodDate');
        const periodSequence = document.getElementById('periodSequence');

        if (periodInfo) {
            periodInfo.style.display = 'flex';
            periodDate.textContent = `${info.date_range}`;
            periodSequence.textContent = `全年第${info.sequence}次周报`;
        }
    }

    /**
     * 隐藏报告期信息
     */
    hidePeriodInfo() {
        const periodInfo = document.getElementById('periodInfo');
        if (periodInfo) {
            periodInfo.style.display = 'none';
        }
    }

    /**
     * 检查报告是否存在并更新UI
     */
    async checkReportExists(info) {
        try {
            const response = await API.post('/api/v1/reports/weekly/generate', {
                report_year: info.report_year,
                report_week: info.report_week
            });

            if (response.success) {
                const data = response.data;

                if (data.is_new) {
                    // 新报告，显示"点击生成"提示
                    this.showGeneratePrompt();
                } else {
                    // 已存在报告，使用模板生成HTML并显示预览
                    this.currentReport = data;
                    this.renderPreviewFromData(data.report_data);
                    this.enableExport();
                }
            }
        } catch (error) {
            console.error('检查报告失败:', error);
            // 出错时显示生成提示
            this.showGeneratePrompt();
        }
    }

    /**
     * 显示"点击生成"提示
     */
    showGeneratePrompt() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        canvas.innerHTML = `
            <div class="preview-placeholder">
                <div class="placeholder-icon">📝</div>
                <div class="placeholder-text">该报告期尚未生成</div>
                <div class="placeholder-hint">点击"生成报告"按钮开始生成</div>
            </div>
        `;

        // 禁用导出按钮
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.disabled = true;
        }
    }

    /**
     * 生成报告
     */
    async generateReport() {
        if (!this.selectedPeriod) {
            this.showError('请先选择报告期');
            return;
        }

        try {
            this.showLoading();

            const response = await API.post('/api/v1/reports/weekly/generate', {
                report_year: this.selectedPeriod.report_year,
                report_week: this.selectedPeriod.report_week
            });

            if (response.success) {
                this.currentReport = response.data;
                this.renderPreviewFromData(response.data.report_data);
                this.enableExport();
            } else {
                this.showError(response.error || '生成报告失败');
            }
        } catch (error) {
            console.error('生成报告失败:', error);
            this.showError('生成报告失败: ' + error.message);
        }
    }

    /**
     * 渲染预览
     */
    renderPreview(html) {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        // 创建iframe显示HTML
        canvas.innerHTML = `
            <iframe id="reportFrame" class="report-frame"></iframe>
        `;

        const iframe = document.getElementById('reportFrame');
        if (iframe) {
            iframe.srcdoc = html;

            // 等待 iframe 加载完成后绑定事件
            iframe.onload = () => {
                console.log('iframe 加载完成，绑定事件...');
                this.bindWorkItemActions();
            };
        }
    }

    /**
     * 从数据渲染预览（使用前端模板）
     */
    renderPreviewFromData(data) {
        // 使用前端模板生成HTML
        const html = WeeklyReportTemplate.generateHTML({ report_data: data });
        this.renderPreview(html);

        // 注意：不要在这里直接调用 bindWorkItemActions()
        // 因为 iframe 内容可能还没加载完成
        // 事件绑定在 iframe.onload 回调中进行
    }

    /**
     * 绑定重点工作行的操作按钮事件
     */
    bindWorkItemActions() {
        const iframe = document.getElementById('reportFrame');
        if (!iframe || !iframe.contentDocument) {
            console.error('iframe 未找到或未加载');
            return;
        }

        const iframeDoc = iframe.contentDocument;
        const iframeBody = iframeDoc.body;

        // 新增按钮
        const addButtons = iframeBody.querySelectorAll('.work-add-btn');
        console.log('找到的新增按钮数量:', addButtons.length);

        addButtons.forEach((btn, index) => {
            // 移除旧的事件监听器（避免重复绑定）
            btn.replaceWith(btn.cloneNode(true));
        });

        // 重新获取按钮元素（替换后的）
        const newAddButtons = iframeBody.querySelectorAll('.work-add-btn');
        newAddButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                console.log('点击新增按钮，索引:', index);
                this.addWorkItem(index);
            });
        });

        // 删除按钮
        const deleteButtons = iframeBody.querySelectorAll('.work-delete-btn');
        console.log('找到的删除按钮数量:', deleteButtons.length);

        deleteButtons.forEach((btn, index) => {
            // 移除旧的事件监听器
            btn.replaceWith(btn.cloneNode(true));
        });

        const newDeleteButtons = iframeBody.querySelectorAll('.work-delete-btn');
        newDeleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                console.log('点击删除按钮，索引:', index);
                this.deleteWorkItem(index);
            });
        });
    }

    /**
     * 新增重点工作行
     */
    addWorkItem(afterIndex) {
        const iframe = document.getElementById('reportFrame');
        if (!iframe || !iframe.contentDocument) return;

        const iframeDoc = iframe.contentDocument;
        const iframeBody = iframeDoc.body;

        const workList = iframeBody.querySelector('.work-list');
        if (!workList) return;

        // 获取当前所有行
        const workItems = iframeBody.querySelectorAll('.work-item');
        const currentIndex = afterIndex !== undefined ? afterIndex : workItems.length - 1;

        // 计算新行的序号
        const newNum = (currentIndex + 2).toString().padStart(2, '0');

        // 创建新的工作项HTML
        const newWorkItem = document.createElement('div');
        newWorkItem.className = 'work-item';
        newWorkItem.dataset.workId = '';
        newWorkItem.dataset.index = currentIndex + 1;

        newWorkItem.innerHTML = `
            <div class="work-num" contenteditable="true">${newNum}</div>
            <div class="work-cat" contenteditable="true"></div>
            <div class="work-desc" contenteditable="true" data-field="work_description"></div>
            <div class="work-actions">
                <button class="work-add-btn" data-index="${currentIndex + 1}" title="在下方添加一行">+</button>
                <button class="work-delete-btn" data-index="${currentIndex + 1}" title="删除这一行">−</button>
            </div>
        `;

        // 插入到指定位置之后
        if (workItems[currentIndex]) {
            workItems[currentIndex].after(newWorkItem);
        } else {
            workList.appendChild(newWorkItem);
        }

        // 重新编号所有行
        this.renumberWorkItems(iframeBody);

        // 重新绑定事件
        this.bindWorkItemActions();

        // 更新当前报告数据
        this.updateReportDataFromDOM();

        console.log('新增工作项，索引:', currentIndex + 1);
    }

    /**
     * 删除重点工作行
     */
    deleteWorkItem(index) {
        const iframe = document.getElementById('reportFrame');
        if (!iframe || !iframe.contentDocument) return;

        const iframeDoc = iframe.contentDocument;
        const iframeBody = iframeDoc.body;

        const workItems = iframeBody.querySelectorAll('.work-item');
        if (!workItems[index]) return;

        // 删除确认
        const workDesc = workItems[index].querySelector('.work-desc')?.textContent?.trim();
        if (workDesc && !confirm(`确定要删除"${workDesc || '这项工作'}"吗？`)) {
            return;
        }

        // 删除行
        workItems[index].remove();

        // 重新编号所有行
        this.renumberWorkItems(iframeBody);

        // 重新绑定事件
        this.bindWorkItemActions();

        // 更新当前报告数据
        this.updateReportDataFromDOM();

        console.log('删除工作项，索引:', index);
    }

    /**
     * 重新编号所有重点工作行
     */
    renumberWorkItems(iframeBody) {
        const workItems = iframeBody.querySelectorAll('.work-item');
        workItems.forEach((item, index) => {
            const workNum = item.querySelector('.work-num');
            if (workNum) {
                workNum.textContent = (index + 1).toString().padStart(2, '0');
            }

            // 更新按钮的 data-index
            const addButton = item.querySelector('.work-add-btn');
            const deleteButton = item.querySelector('.work-delete-btn');
            if (addButton) addButton.dataset.index = index;
            if (deleteButton) deleteButton.dataset.index = index;

            item.dataset.index = index;
        });
    }

    /**
     * 从 DOM 更新报告数据
     */
    updateReportDataFromDOM() {
        const iframe = document.getElementById('reportFrame');
        if (!iframe || !iframe.contentDocument || !this.currentReport) return;

        const iframeDoc = iframe.contentDocument;
        const iframeBody = iframeDoc.body;

        // 提取所有重点工作数据
        const workItems = iframeBody.querySelectorAll('.work-item');
        const keyWorks = [];

        workItems.forEach(item => {
            const workId = item.dataset.workId || '';
            const workNum = item.querySelector('.work-num')?.textContent?.trim() || '';
            const workCat = item.querySelector('.work-cat')?.textContent?.trim() || '';
            const workDesc = item.querySelector('.work-desc')?.textContent?.trim() || '';

            if (workNum || workCat || workDesc) {
                keyWorks.push({
                    work_id: workId || null,
                    work_num: workNum,
                    work_category: workCat,
                    work_description: workDesc
                });
            }
        });

        // 更新当前报告数据
        if (this.currentReport && this.currentReport.report_data) {
            this.currentReport.report_data.key_works = keyWorks;
        }

        console.log('从DOM更新的 key_works:', keyWorks);
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        canvas.innerHTML = `
            <div class="preview-placeholder">
                <div class="loading-spinner"></div>
                <div class="placeholder-text">正在生成报告...</div>
            </div>
        `;
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        canvas.innerHTML = `
            <div class="preview-placeholder">
                <div class="placeholder-icon" style="color: var(--error-color);">⚠️</div>
                <div class="placeholder-text">${message}</div>
            </div>
        `;
    }

    /**
     * 启用导出和保存按钮
     */
    enableExport() {
        const exportBtn = document.getElementById('exportReportBtn');
        const editBtn = document.getElementById('editReportBtn');
        const saveBtn = document.getElementById('saveReportBtn');

        if (exportBtn) {
            exportBtn.disabled = false;
        }
        if (editBtn) {
            editBtn.disabled = false;
        }
        if (saveBtn) {
            saveBtn.disabled = false;
        }

        console.log('已启用保存按钮，currentReport:', this.currentReport);
    }

    /**
     * 导出报告
     */
    async exportReport() {
        if (!this.currentReport) {
            this.showError('请先生成报告');
            return;
        }

        try {
            // 使用前端模板生成HTML
            const html = WeeklyReportTemplate.generateHTML({
                report_data: this.currentReport.report_data
            });

            if (this.selectedFormat === 'html') {
                // 导出HTML文件
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${this.selectedPeriod.report_name || '周报'}.html`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                // PDF格式 - 使用浏览器打印
                const printWindow = window.open('', '_blank');
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }
        } catch (error) {
            console.error('导出报告失败:', error);
            this.showError('导出报告失败: ' + error.message);
        }
    }

    /**
     * 切换全屏预览
     */
    toggleFullscreen() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        canvas.classList.toggle('fullscreen');
    }

    /**
     * 保存报告
     */
    async saveReport() {
        if (!this.currentReport || !this.currentReport.report_id) {
            this.showError('没有可保存的报告');
            return;
        }

        try {
            // 获取 iframe 内容
            const iframe = document.getElementById('reportFrame');
            if (!iframe || !iframe.contentDocument) {
                this.showError('无法获取报告内容');
                return;
            }

            const iframeDoc = iframe.contentDocument;
            const iframeBody = iframeDoc.body;

            // 提取重点工作数据（使用 updateReportDataFromDOM 方法，确保数据一致）
            const workItems = iframeBody.querySelectorAll('.work-item');
            const keyWorks = [];

            workItems.forEach(item => {
                const workId = item.dataset.workId || '';
                const workNum = item.querySelector('.work-num')?.textContent?.trim() || '';
                const workCat = item.querySelector('.work-cat')?.textContent?.trim() || '';
                const workDesc = item.querySelector('.work-desc')?.textContent?.trim() || '';

                if (workNum || workCat || workDesc) {
                    keyWorks.push({
                        work_id: workId || null,
                        work_num: workNum,
                        work_category: workCat,
                        work_description: workDesc
                    });
                }
            });

            console.log('保存时的 key_works:', keyWorks);

            // 提取所有可编辑的指标字段
            // 使用精确的 CSS 选择器，确保能正确提取每个字段

            // 辅助函数：从元素提取数字
            const extractNumber = (element) => {
                if (!element) return 0;
                const text = element.textContent?.trim() || '';
                return parseInt(text.replace(/[+,/\s]/g, '').replace(/\D.*/g, '')) || 0;
            };

            const metrics = {};

            // ===== 内容运营数据 =====
            // 内容数量
            metrics.content_count = extractNumber(iframeBody.querySelector('.source-body .data-row:nth-child(1) .editable-num'));
            // 阅读播放
            metrics.content_views = extractNumber(iframeBody.querySelector('.source-body .data-row:nth-child(2) .editable-num'));

            // ===== 直播获客数据 =====
            // 直播场次（第1个 layer-card 的 source-body 第1行）
            const liveCard = iframeBody.querySelector('.layer-card:not(.ads-layer):not(.conversion-layer)');
            if (liveCard) {
                metrics.live_sessions = extractNumber(liveCard.querySelector('.source-body .data-row:nth-child(1) .editable-num'));
                metrics.live_viewers = extractNumber(liveCard.querySelector('.source-body .data-row:nth-child(2) .editable-num'));
            }

            // ===== 广告投放数据 =====
            const adsCard = iframeBody.querySelector('.ads-layer');
            if (adsCard) {
                metrics.ad_impressions = extractNumber(adsCard.querySelector('.ads-body .data-row:nth-child(1) .editable-num'));
                metrics.ad_clicks = extractNumber(adsCard.querySelector('.ads-body .data-row:nth-child(2) .editable-num'));
            }

            // ===== 转化结果数据 =====
            const convCard = iframeBody.querySelector('.conversion-layer');
            if (convCard) {
                // 互联网营业部新开户（大数字）
                metrics.new_accounts = extractNumber(convCard.querySelector('.conv-big-number'));

                // 企业微信添加
                metrics.enterprise_wechat_add = extractNumber(convCard.querySelectorAll('.conv-small-item')[0]?.querySelector('.editable-num'));

                // 投顾产品订阅
                metrics.subscription_count = extractNumber(convCard.querySelectorAll('.conv-small-item')[1]?.querySelector('.editable-num'));

                // 助力分支新开户
                metrics.branch_new_accounts = extractNumber(convCard.querySelectorAll('.conv-small-item')[2]?.querySelector('.editable-num'));
            }

            console.log('提取的指标数据:', metrics);

            // 调用后端 API 更新报告（使用字符串 report_id）
            const response = await API.put(
                `/api/v1/reports/weekly/${encodeURIComponent(this.currentReport.report_id)}`,
                {
                    key_works: keyWorks,
                    ...metrics  // 包含所有指标字段
                }
            );

            if (response.success) {
                // 更新当前报告数据（包含 key_works 和所有 metrics）
                this.currentReport.report_data = {
                    ...this.currentReport.report_data,
                    key_works: keyWorks,
                    ...metrics  // ✅ 确保合并所有指标字段，这样渲染时才会显示新值
                };

                console.log('更新后的报告数据:', this.currentReport.report_data);

                // 重新渲染预览，显示最新数据
                this.renderPreviewFromData(this.currentReport.report_data);

                // 显示保存成功提示
                this.showSaveSuccess();
            } else {
                this.showError(response.message || '保存失败');
            }
        } catch (error) {
            console.error('保存报告失败:', error);
            this.showError('保存报告失败: ' + error.message);
        }
    }

    /**
     * 提取指标值
     */
    _extractMetric(iframeBody, selector) {
        const element = iframeBody.querySelector(selector);
        if (!element) return 0;

        const text = element.textContent?.trim() || '';
        // 移除逗号、加号、斜杠等，只保留数字
        const num = parseInt(text.replace(/[+,/]/g, '').replace(/\D.*/g, '')) || 0;
        return num;
    }

    /**
     * 显示保存成功提示
     */
    showSaveSuccess() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;

        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'save-success-toast';
        toast.innerHTML = `
            <div class="toast-icon">✓</div>
            <div class="toast-message">保存成功</div>
        `;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #52c41a;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理事件监听器和资源
        this.currentReport = null;
        this.selectedPeriod = null;
    }
}

// 导出
window.WeeklyReportGenerator = WeeklyReportGenerator;
