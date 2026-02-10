/**
 * 省心投 BI - 线索明细报表
 * 显示后端转化数据的完整列表，支持多维度筛选和导出为Excel
 */

class LeadsDetailReport {
    /**
     * 创建线索明细报表实例
     */
    constructor() {
        this.currentData = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.totalRecords = 0;
        this.filters = this.getDefaultFilters();

        // Phase 1: 修复事件监听器泄漏
        this.eventManager = new EventManager();

        // 初始化元数据管理器
        this.metadataManager = new MetadataManager();

        this.init();
    }

    /**
     * 获取默认筛选条件（默认为全量数据）
     */
    getDefaultFilters() {
        return {
            start_date: '',
            end_date: '',
            platforms: [],
            agencies: []
        };
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化线索明细报表');

        // 加载元数据
        await this.metadataManager.loadMetadata();

        // 渲染筛选器（使用动态元数据）
        this.renderFilters();

        // 加载数据
        await this.loadData();

        // 渲染报表
        this.render();
    }

    /**
     * 渲染筛选器
     */
    renderFilters() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        // 筛选器HTML
        const filterHTML = `
            <div class="card card--filter card--full-width">
                <div class="filter-bar-content" style="
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    align-items: center;
                ">
                    <!-- 日期范围 -->
                    <div class="filter-group">
                        <label class="filter-label">线索日期:</label>
                        <div class="date-range-inputs" style="display: flex; gap: 8px; align-items: center;">
                            <input type="date" id="filterStartDate" class="form-control" value="">
                            <span>至</span>
                            <input type="date" id="filterEndDate" class="form-control" value="">
                        </div>
                    </div>

                    <!-- 多选框容器，将通过JS动态创建 -->
                    <div id="platformFilterContainer"></div>
                    <div id="agencyFilterContainer"></div>

                    <!-- 操作按钮 -->
                    <div class="filter-actions" style="
                        display: flex;
                        gap: 8px;
                        margin-left: auto;
                    ">
                        <button class="btn btn--primary" id="searchBtn">查询</button>
                        <button class="btn btn--secondary" id="resetBtn">重置</button>
                        <button class="btn btn--outline" id="exportBtn">导出Excel</button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = filterHTML;

        // 创建多选下拉框组件（使用元数据管理器动态加载选项）
        this.platformFilter = new MultiSelectDropdown({
            container: 'platformFilterContainer',
            id: 'platformFilter',
            label: '平台',
            placeholder: '选择平台',
            options: this.metadataManager.getPlatformOptions(),
            onChange: () => {}
        });

        this.agencyFilter = new MultiSelectDropdown({
            container: 'agencyFilterContainer',
            id: 'agencyFilter',
            label: '代理商',
            placeholder: '选择代理商',
            options: this.metadataManager.getAgencyOptions(),
            onChange: () => {}
        });

        // 绑定筛选器事件
        this.bindFilterEvents();
    }

    /**
     * 解绑事件（Phase 1: 修复事件监听器泄漏）
     * 在 bindFilterEvents() 之前调用，防止重复绑定
     */
    unbindEvents() {
        // 使用 EventManager 清理所有事件监听器
        if (this.eventManager) {
            this.eventManager.off();
        }
    }

    /**
     * 绑定筛选器事件
     */
    bindFilterEvents() {
        // Phase 1: 先解绑之前的事件，防止重复绑定
        this.unbindEvents();

        // 查询按钮
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            this.eventManager.on(searchBtn, 'click', () => {
                this.updateFilters();
                this.currentPage = 1;
                this.loadData();
                this.render();
            });
        }

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            this.eventManager.on(resetBtn, 'click', () => {
                this.filters = this.getDefaultFilters();
                this.currentPage = 1;
                this.renderFilters();
                this.loadData();
                this.render();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            this.eventManager.on(exportBtn, 'click', () => {
                this.exportToExcel();
            });
        }
    }

    /**
     * 更新筛选条件
     */
    updateFilters() {
        this.filters.start_date = document.getElementById('filterStartDate')?.value || '';
        this.filters.end_date = document.getElementById('filterEndDate')?.value || '';

        // 从 MultiSelectDropdown 组件获取选中的值
        this.filters.platforms = this.platformFilter ? this.platformFilter.getSelectedValues() : [];
        this.filters.agencies = this.agencyFilter ? this.agencyFilter.getSelectedValues() : [];
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            // 构建查询参数
            const params = new URLSearchParams({
                page: this.currentPage,
                page_size: this.pageSize
            });

            // 添加日期筛选（如果设置了）
            if (this.filters.start_date) {
                params.append('start_date', this.filters.start_date);
            }
            if (this.filters.end_date) {
                params.append('end_date', this.filters.end_date);
            }

            // 添加多选参数
            if (this.filters.platforms.length > 0) {
                params.append('platforms', this.filters.platforms.join(','));
            }
            if (this.filters.agencies.length > 0) {
                params.append('agencies', this.filters.agencies.join(','));
            }

            const response = await fetch(getAPIUrl(`/leads-detail?${params}`));
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || '查询失败');
            }

            this.currentData = result.data || [];
            this.totalPages = result.total_pages || 1;
            this.totalRecords = result.total || 0;

            console.log('线索明细数据加载成功:', this.currentData.length, '条记录，总计', this.totalRecords, '条');

        } catch (error) {
            console.error('加载线索明细数据失败:', error);
            this.showError(error.message);
        }
    }

    /**
     * 字段定义（与Excel文件0119.xlsx保持一致）
     */
    getFieldDefinitions() {
        return [
            { chinese: '微信昵称', field: 'wechat_nickname' },
            { chinese: '资金账号', field: 'capital_account' },
            { chinese: '开户营业部', field: 'opening_branch' },
            { chinese: '客户性别', field: 'customer_gender' },
            { chinese: '平台来源', field: 'platform_source' },
            { chinese: '流量类型', field: 'traffic_type' },
            { chinese: '客户来源', field: 'customer_source' },
            { chinese: '是否客户开口', field: 'is_customer_mouth', type: 'boolean' },
            { chinese: '是否有效线索', field: 'is_valid_lead', type: 'boolean' },
            { chinese: '是否开户中断', field: 'is_open_account_interrupted', type: 'boolean' },
            { chinese: '开户中断日期', field: 'open_account_interrupted_date', type: 'date' },
            { chinese: '是否开户', field: 'is_opened_account', type: 'boolean' },
            { chinese: '是否为有效户', field: 'is_valid_customer', type: 'boolean' },
            { chinese: '是否为存量客户', field: 'is_existing_customer', type: 'boolean' },
            { chinese: '是否为存量有效户', field: 'is_existing_valid_customer', type: 'boolean' },
            { chinese: '是否删除企微', field: 'is_delete_enterprise_wechat', type: 'boolean' },
            { chinese: '线索日期', field: 'lead_date', type: 'date' },
            { chinese: '首次触达时间', field: 'first_contact_time', type: 'datetime' },
            { chinese: '最近互动时间', field: 'last_contact_time', type: 'datetime' },
            { chinese: '互动次数', field: 'interaction_count', type: 'number' },
            { chinese: '营销人员互动次数', field: 'sales_interaction_count', type: 'number' },
            { chinese: '添加员工号', field: 'add_employee_no' },
            { chinese: '添加员工姓名', field: 'add_employee_name' },
            { chinese: '开户时间', field: 'account_opening_time', type: 'datetime' },
            { chinese: '微信认证状态', field: 'wechat_verify_status' },
            { chinese: '微信认证时间', field: 'wechat_verify_time', type: 'datetime' },
            { chinese: '有效户时间', field: 'valid_customer_time', type: 'datetime' },
            { chinese: '资产', field: 'assets', type: 'currency' },
            { chinese: '客户贡献', field: 'customer_contribution', type: 'currency' },
            { chinese: '广告账号', field: 'ad_account' },
            { chinese: '广告代理商', field: 'agency' },
            { chinese: '广告ID', field: 'ad_id' },
            { chinese: '创意ID', field: 'creative_id' },
            { chinese: '笔记ID', field: 'note_id' },
            { chinese: '笔记名称', field: 'note_title' },
            { chinese: '平台用户ID', field: 'platform_user_id' },
            { chinese: '平台用户昵称', field: 'platform_user_nickname' },
            { chinese: '广告点击日期', field: 'ad_click_date', type: 'date' },
            { chinese: '生产者', field: 'producer' },
            { chinese: '企微标签', field: 'enterprise_wechat_tags' }
        ];
    }

    /**
     * 格式化字段值
     */
    formatFieldValue(value, type) {
        if (value === null || value === undefined || value === '') {
            return '-';
        }

        switch (type) {
            case 'boolean':
                return value ? '是' : '否';
            case 'date':
                if (value instanceof Date) {
                    return value.toISOString().split('T')[0];
                }
                return value;
            case 'datetime':
                if (value instanceof Date) {
                    return value.toISOString().replace('T', ' ').substring(0, 19);
                }
                return value;
            case 'currency':
                return FormatHelper.formatCurrency(value);
            case 'number':
                return value;
            default:
                return value;
        }
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

        // 如果没有筛选器，先渲染筛选器
        const filterSection = container.querySelector('.card--filter');
        if (!filterSection) {
            this.renderFilters();
        }

        // 移除旧的表格部分（保留筛选器）
        const oldTableSection = container.querySelector('.data-section');
        if (oldTableSection) {
            oldTableSection.remove();
        }

        // 获取字段定义
        const fields = this.getFieldDefinitions();

        // 添加新的数据表格部分
        const tableHTML = `
            <div class="data-section">
                <!-- 数据表格卡片 -->
                <div class="card card--full-width">
                    <div class="card__header">
                        <h3 class="card__title">线索明细数据</h3>
                        <div class="card__actions">
                            <span class="stat-label">共 <strong id="totalRecords">${this.totalRecords || 0}</strong> 条记录</span>
                        </div>
                    </div>
                    <div class="card__body">
                        <div class="table-container" style="overflow-x: auto;">
                            <table class="data-table" id="leadsDetailTable" style="min-width: max-content;">
                                <thead>
                                    <tr>
                                        ${fields.map(f => `<th>${f.chinese}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>

                        <!-- 分页 -->
                        <div class="pagination" id="pagination"></div>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', tableHTML);

        this.renderTable();
        this.renderPagination();
        this.bindTableEvents();
    }

    /**
     * 渲染表格
     */
    renderTable() {
        const fields = this.getFieldDefinitions();

        if (!this.currentData || this.currentData.length === 0) {
            const tbody = document.querySelector('#leadsDetailTable tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="${fields.length}" class="table-empty">暂无数据</td>
                    </tr>
                `;
            }
            return;
        }

        const tbody = document.querySelector('#leadsDetailTable tbody');
        if (!tbody) {
            return;
        }

        tbody.innerHTML = this.currentData.map(item => `
            <tr>
                ${fields.map(f => `
                    <td style="${f.type === 'currency' ? 'text-align: right;' : ''}">
                        ${this.formatFieldValue(item[f.field], f.type)}
                    </td>
                `).join('')}
            </tr>
        `).join('');
    }

    /**
     * 渲染分页
     */
    renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) {
            return;
        }

        const totalPages = this.totalPages;
        const currentPage = this.currentPage;

        let html = '<div class="pagination-controls">';

        // 上一页按钮
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}
                 data-page="${currentPage - 1}">上一页</button>`;

        // 页码信息
        html += `<span class="pagination-info">第 ${currentPage} / ${totalPages} 页，共 ${this.totalRecords || 0} 条</span>`;

        // 下一页按钮
        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}
                 data-page="${currentPage + 1}">下一页</button>`;

        html += '</div>';

        pagination.innerHTML = html;
    }

    /**
     * 绑定表格事件（Phase 1: 修复事件监听器泄漏）
     */
    bindTableEvents() {
        // Phase 1: 先解绑之前的分页按钮事件
        // 注意：只解绑分页按钮，不影响筛选器按钮
        const paginationBtns = document.querySelectorAll('.pagination-btn');
        paginationBtns.forEach(btn => {
            // 移除旧的事件监听器（如果有）
            btn.removeEventListener('click', this._paginationHandler);
            // 保存新的处理器引用（用于后续解绑）
            this._paginationHandler = (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.loadData();
                    this.render();
                }
            };
            // 绑定新的事件监听器
            btn.addEventListener('click', this._paginationHandler);
        });

        // Phase 1: 使用 EventManager 管理筛选器事件（已在 bindFilterEvents 中处理）
    }

    /**
     * 导出为Excel（与0119.xlsx格式保持一致）
     */
    exportToExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            alert('暂无数据可导出');
            return;
        }

        const fields = this.getFieldDefinitions();

        // 构建CSV内容（包含所有40个字段）
        const headers = fields.map(f => f.chinese);
        const csvContent = [
            headers.join(','),
            ...this.currentData.map(item => fields.map(f => {
                const value = item[f.field];
                const formatted = this.formatFieldValue(value, f.type);
                // 对于CSV导出，空值显示为空字符串，日期时间字段需要格式化
                if (value === null || value === undefined || value === '') {
                    return '';
                }
                if (f.type === 'boolean') {
                    return value ? '是' : '否';
                }
                if (f.type === 'date' && value instanceof Date) {
                    return value.toISOString().split('T')[0];
                }
                if (f.type === 'datetime' && value instanceof Date) {
                    return value.toISOString().replace('T', ' ').substring(0, 19);
                }
                return value;
            }).join(','))
        ].join('\n');

        // 创建Blob对象
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

        // 创建下载链接
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `线索明细_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="
                    padding: 60px 20px;
                    text-align: center;
                    color: var(--error-color);
                ">
                    <div class="error-icon" style="
                        font-size: 48px;
                        margin-bottom: 20px;
                    ">⚠️</div>
                    <div style="
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 10px;
                        color: var(--text-primary);
                    ">加载失败</div>
                    <div style="color: var(--text-secondary);">${message}</div>
                    <button class="btn btn--primary" style="margin-top: 20px;" onclick="location.reload()">重新加载</button>
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

        // 清理分页处理器引用
        this._paginationHandler = null;

        // 清理事件监听器和数据
        this.currentData = null;
        this.filters = null;
    }
}

window.LeadsDetailReport = LeadsDetailReport;
