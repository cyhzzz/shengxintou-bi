/**
 * 省心投 BI - 数据导入组件
 * 处理文件上传和数据导入
 */

class DataImport {
    /**
     * 创建数据导入实例
     */
    constructor() {
        this.selectedDataType = null;
        this.selectedFile = null;
        this.currentTaskId = null;
        this.pollInterval = null;

        this.init();
    }

    /**
     * 初始化组件
     */
    async init() {
        console.log('初始化数据导入组件');

        // 隐藏全局筛选器（数据导入页面不需要）
        const filterBar = document.getElementById('filterBar');
        if (filterBar) {
            filterBar.style.display = 'none';
        }

        // 隐藏数据卡片区域
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = 'none';
        }

        // 渲染HTML
        this.render();

        // 绑定事件
        this.bindEvents();

        // 更新日期输入
        this.updateDateInputs();
    }

    /**
     * 渲染组件HTML
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('找不到主内容容器');
            return;
        }

        container.innerHTML = `
            <!-- 数据类型选择卡片 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">选择数据类型</h3>
                </div>
                <div class="card__body">
                    <div class="type-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 12px;
                    ">
                        <div class="type-card" data-type="tencent" style="
                            position: relative;
                            background: var(--bg-content);
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            padding: 12px;
                            text-align: center;
                            cursor: pointer;
                            transition: all var(--transition-fast);
                        ">
                            <button class="doc-btn" data-doc="tencent_ads_guide.md" style="
                                position: absolute;
                                top: 6px;
                                right: 6px;
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                font-size: 14px;
                                line-height: 20px;
                                color: var(--text-secondary);
                                cursor: pointer;
                                padding: 0;
                                transition: all var(--transition-fast);
                                z-index: 1;
                                font-weight: bold;
                            " title="查看导入说明">?</button>
                            <div style="font-size: 28px; margin-bottom: 6px;">🅰️</div>
                            <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">腾讯广告</h4>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">腾讯广告投放数据</p>
                        </div>
                        <div class="type-card" data-type="douyin" style="
                            position: relative;
                            background: var(--bg-content);
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            padding: 12px;
                            text-align: center;
                            cursor: pointer;
                            transition: all var(--transition-fast);
                        ">
                            <button class="doc-btn" data-doc="douyin_ads_guide.md" style="
                                position: absolute;
                                top: 6px;
                                right: 6px;
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                font-size: 14px;
                                line-height: 20px;
                                color: var(--text-secondary);
                                cursor: pointer;
                                padding: 0;
                                transition: all var(--transition-fast);
                                z-index: 1;
                                font-weight: bold;
                            " title="查看导入说明">?</button>
                            <div style="font-size: 28px; margin-bottom: 6px;">🎵</div>
                            <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">抖音广告</h4>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">抖音广告投放数据</p>
                        </div>
                        <div class="type-card" data-type="xiaohongshu" style="
                            position: relative;
                            background: var(--bg-content);
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            padding: 12px;
                            text-align: center;
                            cursor: pointer;
                            transition: all var(--transition-fast);
                        ">
                            <button class="doc-btn" data-doc="xiaohongshu_ads_guide.md" style="
                                position: absolute;
                                top: 6px;
                                right: 6px;
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                font-size: 14px;
                                line-height: 20px;
                                color: var(--text-secondary);
                                cursor: pointer;
                                padding: 0;
                                transition: all var(--transition-fast);
                                z-index: 1;
                                font-weight: bold;
                            " title="查看导入说明">?</button>
                            <div style="font-size: 28px; margin-bottom: 6px;">📕</div>
                            <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">小红书广告</h4>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">账号级别投放数据</p>
                        </div>

                        <!-- 小红书笔记数据分组 -->
                        <div style="grid-column: span 2; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                            <div class="type-card" data-type="xhs_notes_list" style="
                                position: relative;
                                background: var(--bg-content);
                                border: 1px solid var(--border-color);
                                border-radius: var(--border-radius);
                                padding: 12px;
                                text-align: center;
                                cursor: pointer;
                                transition: all var(--transition-fast);
                            ">
                                <button class="doc-btn" data-doc="xhs_notes_list_guide.md" style="
                                    position: absolute;
                                    top: 6px;
                                    right: 6px;
                                    background: transparent;
                                    border: 1px solid var(--border-color);
                                    border-radius: 50%;
                                    width: 22px;
                                    height: 22px;
                                    font-size: 14px;
                                    line-height: 20px;
                                    color: var(--text-secondary);
                                    cursor: pointer;
                                    padding: 0;
                                    transition: all var(--transition-fast);
                                    z-index: 1;
                                    font-weight: bold;
                                " title="查看导入说明">?</button>
                                <div style="font-size: 24px; margin-bottom: 6px;">📋</div>
                                <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">笔记列表</h4>
                                <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">笔记基础信息映射</p>
                            </div>
                            <div class="type-card" data-type="xhs_notes_daily" style="
                                position: relative;
                                background: var(--bg-content);
                                border: 1px solid var(--border-color);
                                border-radius: var(--border-radius);
                                padding: 12px;
                                text-align: center;
                                cursor: pointer;
                                transition: all var(--transition-fast);
                            ">
                                <button class="doc-btn" data-doc="xhs_notes_daily_guide.md" style="
                                    position: absolute;
                                    top: 6px;
                                    right: 6px;
                                    background: transparent;
                                    border: 1px solid var(--border-color);
                                    border-radius: 50%;
                                    width: 22px;
                                    height: 22px;
                                    font-size: 14px;
                                    line-height: 20px;
                                    color: var(--text-secondary);
                                    cursor: pointer;
                                    padding: 0;
                                    transition: all var(--transition-fast);
                                    z-index: 1;
                                    font-weight: bold;
                                " title="查看导入说明">?</button>
                                <div style="font-size: 24px; margin-bottom: 6px;">📊</div>
                                <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">笔记日级投放</h4>
                                <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">笔记级别投放数据</p>
                            </div>
                            <div class="type-card" data-type="xhs_notes_content" style="
                                position: relative;
                                background: var(--bg-content);
                                border: 1px solid var(--border-color);
                                border-radius: var(--border-radius);
                                padding: 12px;
                                text-align: center;
                                cursor: pointer;
                                transition: all var(--transition-fast);
                            ">
                                <button class="doc-btn" data-doc="xhs_notes_content_guide.md" style="
                                    position: absolute;
                                    top: 6px;
                                    right: 6px;
                                    background: transparent;
                                    border: 1px solid var(--border-color);
                                    border-radius: 50%;
                                    width: 22px;
                                    height: 22px;
                                    font-size: 14px;
                                    line-height: 20px;
                                    color: var(--text-secondary);
                                    cursor: pointer;
                                    padding: 0;
                                    transition: all var(--transition-fast);
                                    z-index: 1;
                                    font-weight: bold;
                                " title="查看导入说明">?</button>
                                <div style="font-size: 24px; margin-bottom: 6px;">📈</div>
                                <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">笔记日级业务</h4>
                                <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">笔记业务数据</p>
                            </div>
                        </div>
                        <div class="type-card" data-type="conversion" style="
                            position: relative;
                            background: var(--bg-content);
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            padding: 12px;
                            text-align: center;
                            cursor: pointer;
                            transition: all var(--transition-fast);
                        ">
                            <button class="doc-btn" data-doc="backend_conversion_guide.md" style="
                                position: absolute;
                                top: 6px;
                                right: 6px;
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 50%;
                                width: 22px;
                                height: 22px;
                                font-size: 14px;
                                line-height: 20px;
                                color: var(--text-secondary);
                                cursor: pointer;
                                padding: 0;
                                transition: all var(--transition-fast);
                                z-index: 1;
                                font-weight: bold;
                            " title="查看导入说明">?</button>
                            <div style="font-size: 28px; margin-bottom: 6px;">📊</div>
                            <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">后端转化</h4>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">后端转化明细数据</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 文件上传和导入选项合并卡片 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">上传文件</h3>
                </div>
                <div class="card__body">
                    <div style="
                        display: grid;
                        grid-template-columns: 1fr 280px;
                        gap: 20px;
                        align-items: start;
                    ">
                        <!-- 左侧：文件上传区域 -->
                        <div>
                            <div id="dropzone" style="
                                border: 2px dashed var(--border-color);
                                border-radius: var(--border-radius);
                                padding: 24px 20px;
                                text-align: center;
                                cursor: pointer;
                                transition: all var(--transition-fast);
                                background: var(--bg-hover);
                            ">
                                <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display: none;">
                                <div style="font-size: 36px; margin-bottom: 12px;">📁</div>
                                <p style="margin: 6px 0; color: var(--text-primary); font-size: 14px;">点击选择文件或拖拽到此处</p>
                                <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">支持 .csv, .xlsx, .xls 格式，最大 50MB</p>
                            </div>

                            <!-- 文件信息 -->
                            <div id="fileInfo" style="
                                display: none;
                                margin-top: 12px;
                                padding: 12px;
                                background: var(--bg-hover);
                                border-radius: var(--border-radius);
                            ">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 20px;">📄</span>
                                    <div style="flex: 1;">
                                        <div id="fileName" style="font-size: 13px; font-weight: 600; color: var(--text-primary);"></div>
                                        <div id="fileSize" style="font-size: 11px; color: var(--text-secondary);"></div>
                                    </div>
                                    <div id="dataType" style="
                                        padding: 3px 10px;
                                        background: var(--primary-color);
                                        color: white;
                                        border-radius: var(--border-radius-sm);
                                        font-size: 11px;
                                    "></div>
                                    <button id="clearFile" class="btn btn--ghost btn--sm">✕</button>
                                </div>
                            </div>
                        </div>

                        <!-- 右侧：导入选项 -->
                        <div style="
                            border-left: 1px solid var(--border-color);
                            padding-left: 20px;
                        ">
                            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">导入选项</h4>

                            <label style="
                                display: flex;
                                align-items: flex-start;
                                gap: 8px;
                                cursor: pointer;
                                padding: 10px;
                                background: var(--bg-hover);
                                border-radius: var(--border-radius);
                                margin-bottom: 12px;
                            ">
                                <input type="checkbox" id="overwriteMode" checked style="
                                    width: 16px;
                                    height: 16px;
                                    cursor: pointer;
                                    margin-top: 2px;
                                ">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 3px; font-size: 13px;">覆盖模式</div>
                                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">数据已存在时更新而非跳过</div>
                                </div>
                            </label>

                            <div style="
                                padding: 12px;
                                background: var(--bg-page);
                                border-radius: var(--border-radius);
                                font-size: 11px;
                                color: var(--text-secondary);
                                line-height: 1.6;
                            ">
                                <strong style="color: var(--text-primary); display: block; margin-bottom: 6px;">💡 导入提示</strong>
                                • 系统会自动为新账号创建映射<br>
                                • 导入完成后请在账号管理中补充信息
                            </div>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div style="
                        display: flex;
                        justify-content: center;
                        margin-top: 20px;
                        padding-top: 16px;
                        border-top: 1px solid var(--border-color);
                    ">
                        <button id="startImport" class="btn btn--primary" disabled style="min-width: 200px;">
                            📤 开始导入
                        </button>
                    </div>
                </div>
            </div>

            <!-- 导入进度卡片 -->
            <div id="importProgress" class="card card--full-width" style="display: none;">
                <div class="card__header">
                    <h3 class="card__title">导入进度</h3>
                </div>
                <div class="card__body">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                    ">
                        <span style="color: var(--text-primary);">导入进度</span>
                        <span id="progressStatus" style="color: var(--text-secondary);">准备中...</span>
                    </div>
                    <div style="
                        width: 100%;
                        height: 8px;
                        background: var(--bg-hover);
                        border-radius: 4px;
                        overflow: hidden;
                    ">
                        <div id="progressFill" style="
                            width: 0%;
                            height: 100%;
                            background: var(--primary-color);
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                </div>
            </div>

            <!-- 导入结果卡片 -->
            <div id="importResult" class="card card--full-width" style="display: none;">
                <div class="card__body">
                    <div id="resultContent"></div>
                    <div style="
                        margin-top: var(--spacing);
                        text-align: right;
                    ">
                        <button id="closeResult" class="btn btn--secondary">关闭</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 更新日期输入框（数据导入组件不需要）
     */
    updateDateInputs() {
        // 数据导入组件不需要日期输入框
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 数据类型选择
        document.querySelectorAll('.type-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是文档按钮，不触发卡片选择
                if (e.target.classList.contains('doc-btn')) {
                    return;
                }
                this.selectDataType(card.dataset.type);
            });
        });

        // 文档按钮点击事件
        document.querySelectorAll('.doc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到卡片
                const docFile = btn.dataset.doc;
                this.openDocumentation(docFile);
            });
        });

        // 文件拖拽
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-color)';
            dropzone.style.background = 'var(--bg-selected)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'var(--bg-hover)';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'var(--bg-hover)';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // 文件选择
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // 清除文件
        document.getElementById('clearFile').addEventListener('click', () => {
            this.clearFile();
        });

        // 开始导入
        document.getElementById('startImport').addEventListener('click', () => {
            this.startImport();
        });

        // 关闭结果
        document.getElementById('closeResult').addEventListener('click', () => {
            this.hideResult();
        });

        // 添加数据类型卡片悬停效果
        this.addCardHoverStyles();
    }

    /**
     * 添加卡片悬停样式
     */
    addCardHoverStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .type-card:hover {
                border-color: var(--primary-color) !important;
                background: var(--bg-selected) !important;
                transform: translateY(-2px);
                box-shadow: var(--shadow-hover) !important;
            }

            .doc-btn:hover {
                background: var(--primary-hover) !important;
                color: white !important;
                transform: scale(1.15);
                box-shadow: 0 2px 8px rgba(24, 144, 255, 0.4);
            }

            /* 文档弹窗内容样式 */
            #docModalBody h1 {
                font-size: 28px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 24px 0 16px 0;
                padding-bottom: 12px;
                border-bottom: 2px solid var(--border-color);
            }

            #docModalBody h2 {
                font-size: 22px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 28px 0 12px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            #docModalBody h3 {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 20px 0 10px 0;
            }

            #docModalBody h4 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 16px 0 8px 0;
            }

            #docModalBody p {
                margin: 12px 0;
                line-height: 1.6;
                color: var(--text-secondary);
            }

            #docModalBody ul {
                margin: 12px 0;
                padding-left: 24px;
            }

            #docModalBody li {
                margin: 8px 0;
                line-height: 1.6;
                color: var(--text-secondary);
            }

            #docModalBody table {
                width: 100%;
                border-collapse: collapse;
                margin: 16px 0;
                font-size: 14px;
            }

            #docModalBody table th {
                background: var(--bg-hover);
                padding: 12px;
                text-align: left;
                font-weight: 600;
                color: var(--text-primary);
                border-bottom: 2px solid var(--border-color);
            }

            #docModalBody table td {
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-secondary);
            }

            #docModalBody table tr:hover {
                background: var(--bg-hover);
            }

            #docModalBody pre {
                background: var(--bg-page);
                padding: 16px;
                border-radius: var(--border-radius);
                overflow-x: auto;
                margin: 16px 0;
                border: 1px solid var(--border-color);
            }

            #docModalBody code {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.5;
            }

            #docModalBody strong {
                color: var(--text-primary);
                font-weight: 600;
            }

            #docModalBody a {
                color: var(--primary-color);
                text-decoration: none;
            }

            #docModalBody a:hover {
                text-decoration: underline;
            }

            #docModalBody hr {
                border: none;
                border-top: 1px solid var(--border-color);
                margin: 24px 0;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 选择数据类型
     * @param {string} dataType - 数据类型
     */
    selectDataType(dataType) {
        this.selectedDataType = dataType;

        // 更新UI选中状态
        document.querySelectorAll('.type-card').forEach(card => {
            if (card.dataset.type === dataType) {
                card.style.borderColor = 'var(--primary-color)';
                card.style.background = 'var(--bg-selected)';
                card.style.boxShadow = 'var(--shadow-card)';
            } else {
                card.style.borderColor = 'var(--border-color)';
                card.style.background = 'var(--bg-content)';
                card.style.boxShadow = 'none';
            }
        });

        // 更新文件类型提示
        const typeNames = {
            'tencent': '腾讯广告数据',
            'douyin': '抖音广告数据',
            'xiaohongshu': '小红书广告数据（账号级别）',
            'xhs_notes_list': '小红书笔记列表',
            'xhs_notes_daily': '小红书笔记日级投放数据（笔记级别）',
            'xhs_notes_content': '小红书笔记日级业务数据',
            'conversion': '后端转化数据'
        };

        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            const hintEl = dropzone.querySelector('p:last-child');
            if (hintEl) {
                hintEl.textContent = `请选择 ${typeNames[dataType]} 文件 (.csv, .xlsx, .xls)`;
            }
        }

        // 检查是否可以开始导入
        this.checkCanStartImport();
    }

    /**
     * 处理文件选择
     * @param {File} file - 选择的文件
     */
    handleFileSelect(file) {
        // 验证文件类型 - 支持 CSV 和 Excel 格式
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const isValidFile = validExtensions.some(ext => file.name.endsWith(ext));

        if (!isValidFile) {
            alert('请选择 CSV 或 Excel 文件 (.csv, .xlsx, .xls)');
            return;
        }

        this.selectedFile = file;

        // 显示文件信息
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const dataType = document.getElementById('dataType');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);

        const typeNames = {
            'tencent': '腾讯广告数据',
            'douyin': '抖音广告数据',
            'xiaohongshu': '小红书广告数据（账号级别）',
            'xhs_notes_list': '小红书笔记列表',
            'xhs_notes_daily': '小红书笔记日级投放数据（笔记级别）',
            'xhs_notes_content': '小红书笔记日级业务数据',
            'conversion': '后端转化数据'
        };

        dataType.textContent = typeNames[this.selectedDataType] || '未选择';

        fileInfo.style.display = 'block';

        // 更新拖拽区域
        const dropzone = document.getElementById('dropzone');
        dropzone.innerHTML = `
            <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display: none;">
            <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
            <p style="margin: 8px 0; color: var(--text-primary);">已选择: ${file.name}</p>
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">点击更换文件</p>
        `;

        // 检查是否可以开始导入
        this.checkCanStartImport();
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else if (bytes < 1024 * 1024 * 1024) {
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        } else {
            return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        }
    }

    /**
     * 检查是否可以开始导入
     */
    checkCanStartImport() {
        const startBtn = document.getElementById('startImport');
        if (this.selectedDataType && this.selectedFile) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
    }

    /**
     * 清除文件
     */
    clearFile() {
        this.selectedFile = null;
        this.selectedDataType = null;

        // 隐藏文件信息
        document.getElementById('fileInfo').style.display = 'none';

        // 重置拖拽区域
        const dropzone = document.getElementById('dropzone');
        dropzone.innerHTML = `
            <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display: none;">
            <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
            <p style="margin: 8px 0; color: var(--text-primary);">点击选择文件或拖拽文件到此处</p>
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">支持 .csv, .xlsx, .xls 格式文件，最大 50MB</p>
        `;

        // 重新绑定文件选择事件
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // 清除类型选中状态
        document.querySelectorAll('.type-card').forEach(card => {
            card.style.borderColor = 'var(--border-color)';
            card.style.background = 'var(--bg-content)';
            card.style.boxShadow = 'none';
        });

        // 禁用开始按钮
        document.getElementById('startImport').disabled = true;
    }

    /**
     * 开始导入
     */
    async startImport() {
        if (!this.selectedDataType || !this.selectedFile) {
            alert('请先选择数据类型和文件');
            return;
        }

        // 显示进度
        this.showProgress();
        this.updateProgress(10, '正在上传文件...');

        try {
            // 数据类型映射：前端简短名称 -> 后端完整名称
            const dataTypeMapping = {
                'tencent': 'tencent_ads',
                'douyin': 'douyin_ads',
                'xiaohongshu': 'xiaohongshu_ads',
                'xhs_notes_list': 'xhs_notes_list',
                'xhs_notes_daily': 'xhs_notes_daily',
                'xhs_notes_content': 'xhs_notes_content_daily',
                'conversion': 'backend_conversion',
                'mapping': 'account_mapping'
            };

            // 获取正确的数据类型
            const dataType = dataTypeMapping[this.selectedDataType] || this.selectedDataType;

            // 创建FormData
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            formData.append('data_type', dataType);

            // 获取覆盖模式选项
            const overwriteMode = document.getElementById('overwriteMode').checked;
            formData.append('overwrite', overwriteMode.toString());

            // 上传并处理文件
            const response = await API.upload(formData);

            if (response.success && response.data && response.data.task_id) {
                this.currentTaskId = response.data.task_id;
                this.pollTaskStatus();
            } else {
                throw new Error(response.message || '上传失败：未获取到任务ID');
            }

        } catch (error) {
            this.hideProgress();
            this.showError(error.message);
        }
    }

    /**
     * 轮询任务状态
     */
    pollTaskStatus() {
        this.pollInterval = setInterval(async () => {
            try {
                const response = await API.getTaskStatus(this.currentTaskId);

                // 检查响应结构
                if (!response.success || !response.data) {
                    throw new Error(response.message || '获取任务状态失败');
                }

                const status = response.data;

                if (status.status === 'processing') {
                    this.updateProgress(status.progress || 50, status.message || '处理中...');
                } else if (status.status === 'completed') {
                    this.stopPolling();
                    this.updateProgress(100, '处理完成');
                    this.showSuccess(status);
                } else if (status.status === 'failed') {
                    this.stopPolling();
                    this.hideProgress();
                    this.showError(status.error_message || '处理失败');
                }

            } catch (error) {
                this.stopPolling();
                this.hideProgress();
                this.showError(error.message);
            }
        }, 1000);
    }

    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * 显示进度
     */
    showProgress() {
        document.getElementById('importProgress').style.display = 'block';
        document.getElementById('importResult').style.display = 'none';
        this.updateProgress(0, '准备中...');
    }

    /**
     * 更新进度
     * @param {number} progress - 进度百分比
     * @param {string} status - 状态文本
     */
    updateProgress(progress, status) {
        const progressFill = document.getElementById('progressFill');
        const progressStatus = document.getElementById('progressStatus');

        progressFill.style.width = progress + '%';
        progressStatus.textContent = status;
    }

    /**
     * 隐藏进度
     */
    hideProgress() {
        document.getElementById('importProgress').style.display = 'none';
    }

    /**
     * 显示成功结果
     * @param {Object} result - 处理结果
     */
    showSuccess(result) {
        this.hideProgress();

        const resultContent = document.getElementById('resultContent');
        resultContent.innerHTML = `
            <div style="
                text-align: center;
                padding: var(--spacing);
            ">
                <div style="
                    font-size: 48px;
                    color: var(--success-color);
                    margin-bottom: 16px;
                ">✓</div>
                <h3 style="
                    margin: 0 0 8px 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                ">导入成功！</h3>
                <div style="
                    margin-bottom: var(--spacing);
                    color: var(--text-secondary);
                ">
                    ${result.message || '处理完成'}
                </div>
                ${result.total_rows ? `
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: var(--spacing);
                        text-align: left;
                        margin-top: var(--spacing);
                    ">
                        <div style="
                            padding: var(--spacing);
                            background: var(--bg-hover);
                            border-radius: var(--border-radius);
                        ">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">总行数</div>
                            <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${result.total_rows.toLocaleString()}</div>
                        </div>
                        <div style="
                            padding: var(--spacing);
                            background: var(--bg-hover);
                            border-radius: var(--border-radius);
                        ">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">处理行数</div>
                            <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${result.processed_rows.toLocaleString()}</div>
                        </div>
                        ${result.inserted_rows !== undefined ? `
                            <div style="
                                padding: var(--spacing);
                                background: var(--bg-hover);
                                border-radius: var(--border-radius);
                            ">
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">新增记录</div>
                                <div style="font-size: 20px; font-weight: 600; color: var(--success-color);">${result.inserted_rows.toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${result.updated_rows !== undefined ? `
                            <div style="
                                padding: var(--spacing);
                                background: var(--bg-hover);
                                border-radius: var(--border-radius);
                            ">
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">更新记录</div>
                                <div style="font-size: 20px; font-weight: 600; color: var(--warning-color);">${result.updated_rows.toLocaleString()}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('importResult').style.display = 'block';

        // 刷新元数据（数据导入后需要更新筛选器选项）
        console.log('数据导入成功，正在刷新元数据...');
        metadataManager.refresh().then(() => {
            console.log('元数据刷新完成，平台/业务模式/代理商选项已更新');
        }).catch(error => {
            console.error('元数据刷新失败:', error);
        });
    }

    /**
     * 显示错误
     * @param {string} message - 错误消息
     */
    showError(message) {
        const resultContent = document.getElementById('resultContent');
        resultContent.innerHTML = `
            <div class="error-state" style="
                padding: 60px 20px;
                text-align: center;
                color: var(--error-color);
            ">
                <div style="
                    font-size: 48px;
                    margin-bottom: 20px;
                ">✗</div>
                <div style="
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: var(--text-primary);
                ">导入失败</div>
                <div style="color: var(--text-secondary);">${message}</div>
            </div>
        `;

        document.getElementById('importResult').style.display = 'block';
    }

    /**
     * 隐藏结果
     */
    hideResult() {
        document.getElementById('importResult').style.display = 'none';
        this.clearFile();
    }

    /**
     * 打开说明文档
     * @param {string} docFile - 文档文件名
     */
    async openDocumentation(docFile) {
        // 显示加载中的弹窗
        this.showDocModal('加载中...');

        try {
            // 加载 Markdown 文件
            const response = await fetch(`documents/${docFile}`);
            if (!response.ok) {
                throw new Error('文档加载失败');
            }

            const markdown = await response.text();

            // 转换 Markdown 为 HTML
            const html = this.markdownToHtml(markdown);

            // 更新弹窗内容
            this.updateDocModalContent(docFile, html);

        } catch (error) {
            console.error('加载文档失败:', error);
            this.showDocModal(`
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--text-primary);">
                        文档加载失败
                    </div>
                    <div style="color: var(--text-secondary);">${error.message}</div>
                    <div style="margin-top: 20px; font-size: 14px; color: var(--text-tertiary);">
                        文档路径: documents/${docFile}
                    </div>
                </div>
            `);
        }
    }

    /**
     * 显示文档弹窗
     * @param {string} content - 弹窗内容（HTML或标题）
     */
    showDocModal(content) {
        // 检查是否已存在文档弹窗
        let modal = document.getElementById('docModal');

        // 如果不存在，创建弹窗
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'docModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-container" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="docModalTitle">数据导入说明</h3>
                        <button class="modal-close" id="closeDocModal">&times;</button>
                    </div>
                    <div class="modal-body" id="docModalBody" style="max-height: 70vh; overflow-y: auto;">
                        ${typeof content === 'string' && content.startsWith('<') ? content : '<p>' + content + '</p>'}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn--secondary" id="closeDocModalBtn">关闭</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // 绑定关闭事件
            document.getElementById('closeDocModal').addEventListener('click', () => {
                this.closeDocModal();
            });
            document.getElementById('closeDocModalBtn').addEventListener('click', () => {
                this.closeDocModal();
            });

            // 点击遮罩层关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDocModal();
                }
            });
        } else {
            // 更新已有弹窗的内容
            if (typeof content === 'string' && content.startsWith('<')) {
                document.getElementById('docModalBody').innerHTML = content;
            } else {
                document.getElementById('docModalBody').innerHTML = '<p>' + content + '</p>';
            }
        }

        // 显示弹窗
        modal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 更新文档弹窗内容
     * @param {string} title - 标题
     * @param {string} content - HTML内容
     */
    updateDocModalContent(title, content) {
        const titleMap = {
            'tencent_ads_guide.md': '腾讯广告数据导入指南',
            'douyin_ads_guide.md': '抖音广告数据导入指南',
            'xiaohongshu_ads_guide.md': '小红书广告数据导入指南',
            'xhs_notes_list_guide.md': '小红书笔记列表导入指南',
            'xhs_notes_daily_guide.md': '小红书笔记日级投放数据导入指南',
            'xhs_notes_content_guide.md': '小红书笔记日级业务数据导入指南',
            'backend_conversion_guide.md': '后端转化数据导入指南'
        };

        document.getElementById('docModalTitle').textContent = titleMap[title] || '数据导入说明';
        document.getElementById('docModalBody').innerHTML = content;
    }

    /**
     * 关闭文档弹窗
     */
    closeDocModal() {
        const modal = document.getElementById('docModal');
        if (modal) {
            modal.classList.remove('is-active');
            document.body.style.overflow = '';
        }
    }

    /**
     * 简单的 Markdown 转 HTML
     * @param {string} markdown - Markdown 文本
     * @returns {string} HTML
     */
    markdownToHtml(markdown) {
        let html = markdown;

        // 标题
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

        // 粗体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // 代码块
        html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>');

        // 行内代码
        html = html.replace(/`([^`]+)`/g, '<code style="background: var(--bg-hover); padding: 2px 6px; border-radius: 3px; font-family: monospace;">$1</code>');

        // 列表
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // 表格（简单处理）
        const tableRegex = /\|(.+)\|\n\|[-|\s]+\|\n((?:\|.+\|\n?)+)/g;
        html = html.replace(tableRegex, (match, header, body) => {
            const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
            const rows = body.trim().split('\n').map(row => {
                const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
        });

        // 分隔线
        html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;">');

        // 段落
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // 清理空段落
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<h[1-4]>)/g, '$1');
        html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p>(<table>)/g, '$1');
        html = html.replace(/(<\/table>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr[^>]*>)<\/p>/g, '$1');

        // 链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--primary-color);">$1</a>');

        return html;
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 关闭文档弹窗
        this.closeDocModal();

        // 恢复全局筛选器显示
        const filterBar = document.getElementById('filterBar');
        if (filterBar) {
            filterBar.style.display = '';
        }

        // 恢复数据卡片区域显示
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = '';
        }
    }
}

// 导出到全局
window.DataImport = DataImport;
