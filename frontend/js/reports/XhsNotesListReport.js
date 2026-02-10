/**
 * 省心投 BI - 小红书笔记列表报表
 * 基于 PRD 文档规范实现
 * 提供7个筛选字段、12列数据表格、分页和导出功能
 *
 * v2.0 - 按照标准UI规范重新调整
 * - 筛选器使用标准筛选器样式
 * - 创作者、内容类型、广告策略使用多选下拉框组件
 * - 笔记类型改为笔记账号筛选器
 * - 编辑功能使用单选下拉框样式
 */

class XhsNotesListReport {
    constructor() {
        this.currentData = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalRecords = 0;
        this.totalPages = 1;
        this.filters = this.getDefaultFilters();
        this.sortField = null;
        this.sortOrder = 'asc'; // 'asc' or 'desc'

        // 行内编辑相关
        this.editingCell = null; // 当前正在编辑的单元格
        this.enums = {
            creators: [],
            ad_strategies: []
        };

        // 多选组件实例
        this.multiSelectInstances = {
            creator: null,
            contentType: null,
            adStrategy: null
        };

        this.init();
    }

    /**
     * 获取默认筛选条件
     */
    getDefaultFilters() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return {
            publishTimeRange: '', // 不设置默认值，用户手动选择时才设置
            publishStartDate: '', // 不设置默认值
            publishEndDate: '',   // 不设置默认值
            dataTimeRange: '30', // 默认近30天
            dataStartDate: thirtyDaysAgo.toISOString().split('T')[0],
            dataEndDate: today.toISOString().split('T')[0],
            creator: [], // 多选创作者
            contentType: [], // 多选内容类型
            adStrategy: [], // 多选广告策略
            account: '全部' // 笔记账号（单选）
        };
    }

    /**
     * 初始化
     */
    async init() {
        console.log('小红书笔记列表报表初始化...');

        // 加载枚举值
        await this.loadEnums();

        // 加载数据
        await this.loadData();

        // 渲染报表（包括筛选器）
        this.render();

        // 绑定事件
        this.bindEvents();

        console.log('小红书笔记列表报表加载完成');
    }

    /**
     * 创建筛选器
     */
    createFilterBar() {
        // 不再在这里创建筛选器，统一在 render() 中创建
        // 避免 DOM 重复操作
    }

    /**
     * 加载枚举值
     */
    async loadEnums() {
        try {
            const response = await fetch('/api/v1/xhs-note-info/enums');
            const data = await response.json();

            if (data.success) {
                this.enums.creators = data.data.creators || [];
                this.enums.ad_strategies = data.data.ad_strategies || [];
                console.log('枚举值加载成功:', this.enums);
            }
        } catch (error) {
            console.error('加载枚举值失败:', error);
        }
    }

    /**
     * 初始化多选组件
     */
    initMultiSelectComponents() {
        // 创作者多选
        this.multiSelectInstances.creator = new MultiSelectForm({
            container: 'creatorMultiSelect',
            options: this.enums.creators,
            placeholder: '选择创作者',
            selectedValues: this.filters.creator || [],
            onChange: (selectedValues) => {
                this.filters.creator = selectedValues;
            }
        });

        // 内容类型多选
        this.multiSelectInstances.contentType = new MultiSelectForm({
            container: 'contentTypeMultiSelect',
            options: ['图文', '视频'],
            placeholder: '选择内容类型',
            selectedValues: this.filters.contentType || [],
            onChange: (selectedValues) => {
                this.filters.contentType = selectedValues;
            }
        });

        // 广告策略多选
        this.multiSelectInstances.adStrategy = new MultiSelectForm({
            container: 'adStrategyMultiSelect',
            options: this.enums.ad_strategies,
            placeholder: '选择广告策略',
            selectedValues: this.filters.adStrategy || [],
            onChange: (selectedValues) => {
                this.filters.adStrategy = selectedValues;
            }
        });

        console.log('多选组件初始化完成');
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            // 调用后端API获取小红书笔记数据
            const filters = this.buildApiFilters();
            console.log('=== [DEBUG] 发送API请求 ===');
            console.log('[DEBUG] 请求URL:', '/api/v1/xhs-notes-list');
            console.log('[DEBUG] 筛选条件:', JSON.stringify(filters, null, 2));
            console.log('[DEBUG] 分页信息:', `page=${this.currentPage}, pageSize=${this.pageSize}`);

            const response = await API.getXhsNotesList(filters, this.currentPage, this.pageSize);

            console.log('=== [DEBUG] API响应 ===');
            console.log('[DEBUG] success:', response.success);
            console.log('[DEBUG] 返回记录数:', response.notes?.length || 0);
            console.log('[DEBUG] 总记录数:', response.pagination?.total || 0);

            if (!response.success) {
                throw new Error(response.error || '加载数据失败');
            }

            // 更新筛选选项
            console.log('[DEBUG] API 返回的 filters:', response.filters);

            if (response.filters && response.filters.creators) {
                this.updateCreatorOptions(response.filters.creators);
            }
            if (response.filters && response.filters.note_types) {
                this.updateNoteTypeOptions(response.filters.note_types);
            }
            // 尝试从 filters 中获取账号列表
            if (response.filters && response.filters.publish_accounts) {
                const accounts = response.filters.publish_accounts;
                console.log('[DEBUG] 从 filters 获取到账号列表:', accounts);
                this.updateAccountOptionsFromFilters(accounts);
            }

            this.currentData = response.notes || [];
            this.totalRecords = response.pagination?.total || 0;
            this.totalPages = response.pagination?.total_pages || 1;

            console.log('小红书笔记数据加载成功:', this.currentData.length, '条');

        } catch (error) {
            console.error('数据加载失败:', error);
            this.currentData = [];
            this.totalRecords = 0;
            this.totalPages = 0;
        }
    }

    /**
     * 构建API筛选条件
     */
    buildApiFilters() {
        const filters = {
            date_range: [this.filters.dataStartDate, this.filters.dataEndDate]
        };

        // 只有当用户手动点击了快捷选择按钮时，才应用发布时间筛选
        // 避免默认值过滤掉大量 note_publish_time 为 NULL 的记录
        if (this.filters.publishTimeRange && this.filters.publishStartDate && this.filters.publishEndDate) {
            filters.publish_date_range = [this.filters.publishStartDate, this.filters.publishEndDate];
        }

        // 创作者筛选（多选）
        if (this.filters.creator && this.filters.creator.length > 0) {
            filters.creators = this.filters.creator;
        }

        // 广告策略筛选（多选）
        if (this.filters.adStrategy && this.filters.adStrategy.length > 0) {
            filters.ad_strategies = this.filters.adStrategy;
        }

        // 内容类型筛选（多选）
        if (this.filters.contentType && this.filters.contentType.length > 0) {
            filters.content_types = this.filters.contentType;
        }

        // 笔记账号筛选（单选）
        if (this.filters.account && this.filters.account !== '全部') {
            filters.account = this.filters.account;
        }

        console.log('构建的API筛选条件:', filters);
        return filters;
    }

    /**
     * 更新创作者选项
     */
    updateCreatorOptions(creators) {
        const select = document.getElementById('creatorSelect');
        if (!select) return;

        // 保存当前选择
        const currentValue = select.value;

        // 清空现有选项（保留"全部"）
        select.innerHTML = '<option value="全部">全部</option>';

        // 添加新选项
        creators.forEach(creator => {
            const option = document.createElement('option');
            option.value = creator;
            option.textContent = creator;
            select.appendChild(option);
        });

        // 恢复选择
        if (creators.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * 更新笔记类型选项
     */
    updateNoteTypeOptions(noteTypes) {
        const select = document.getElementById('adStrategySelect');
        if (!select) return;

        // 保存当前选择
        const currentValue = select.value;

        // 清空现有选项（保留"全部"）
        select.innerHTML = '<option value="全部">全部</option>';

        // 添加新选项
        noteTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });

        // 恢复选择
        if (noteTypes.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * 从 filters 更新笔记账号选项（推荐方式）
     */
    updateAccountOptionsFromFilters(accounts) {
        const select = document.getElementById('accountSelect');
        if (!select) {
            console.log('[updateAccountOptionsFromFilters] 未找到 accountSelect 元素');
            return;
        }

        console.log('[updateAccountOptionsFromFilters] 接收到账号列表:', accounts);

        // 保存当前选择
        const currentValue = select.value;

        // 清空现有选项（保留"全部"）
        select.innerHTML = '<option value="全部">全部</option>';

        // 添加新选项（按字母顺序排序）
        if (Array.isArray(accounts) && accounts.length > 0) {
            accounts.sort().forEach(account => {
                const option = document.createElement('option');
                option.value = account;
                option.textContent = account;
                select.appendChild(option);
            });

            // 恢复选择
            if (accounts.includes(currentValue) || currentValue === '全部') {
                select.value = currentValue;
            }

            console.log('笔记账号选项已更新（从 filters）:', accounts.length, '个账号');
        } else {
            console.warn('[updateAccountOptionsFromFilters] 账号列表为空或不是数组');
        }
    }

    /**
     * 更新笔记账号选项（从 currentData 中提取 - 备用方式）
     */
    updateAccountOptions() {
        const select = document.getElementById('accountSelect');
        if (!select) {
            console.log('[updateAccountOptions] 未找到 accountSelect 元素');
            return;
        }

        console.log('[updateAccountOptions] currentData 长度:', this.currentData?.length);

        // 检查第一行数据的字段
        if (this.currentData && this.currentData.length > 0) {
            console.log('[updateAccountOptions] 第一条数据示例:', this.currentData[0]);
            console.log('[updateAccountOptions] publish_account 字段值:', this.currentData[0].publish_account);
        }

        // 保存当前选择
        const currentValue = select.value;

        // 从当前数据中提取账号列表（去重）
        const accounts = [...new Set(this.currentData.map(note => note.publish_account).filter(Boolean))];

        console.log('[updateAccountOptions] 提取到的账号列表:', accounts);

        // 清空现有选项（保留"全部"）
        select.innerHTML = '<option value="全部">全部</option>';

        // 添加新选项（按字母顺序排序）
        accounts.sort().forEach(account => {
            const option = document.createElement('option');
            option.value = account;
            option.textContent = account;
            select.appendChild(option);
        });

        // 恢复选择
        if (accounts.includes(currentValue) || currentValue === '全部') {
            select.value = currentValue;
        }

        console.log('笔记账号选项已更新:', accounts.length, '个账号');
    }

    /**
     * 渲染报表
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        // 按Type A规范: 带筛选器的数据列表报表
        // 使用标准 Data Filter 样式：包含标题、操作按钮在 header，筛选项在 body
        container.innerHTML = `
            <!-- 筛选器卡片 (标准 Data Filter 样式) -->
            <div class="card card--filter card--full-width" id="xhsNotesFilterBar">
                <!-- Header: 标题 + 操作按钮 -->
                <div class="card__header">
                    <h3 class="card__title">数据筛选</h3>
                    <div class="card__actions">
                        <button class="btn btn--secondary btn--sm" id="resetBtn">重置</button>
                        <button class="btn btn--primary btn--sm" id="searchBtn">查询</button>
                    </div>
                </div>

                <!-- Body: 筛选项 -->
                <div class="card__body">
                    <div class="filter-bar-content" style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: 16px;
                        align-items: flex-end;
                    ">
                        <!-- 发布时间 (标准 Date Range with Quick Select 样式) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto;">
                            <label class="form-label">发布时间</label>
                            <!-- 日期输入框和快速选择按钮在同一行 -->
                            <div style="display: flex; gap: 12px; align-items: center; white-space: nowrap;">
                                <!-- 日期输入框 -->
                                <div style="display: inline-flex; gap: 8px; align-items: center;">
                                    <input type="date" id="publishStartDate" class="form-control"
                                           value="${this.filters.publishStartDate || ''}"
                                           style="height: 32px; width: 140px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="publishEndDate" class="form-control"
                                           value="${this.filters.publishEndDate || ''}"
                                           style="height: 32px; width: 140px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" data-filter-type="publishTime" style="display: inline-flex;">
                                    <button class="btn is-active" data-days="7" style="height: 32px; white-space: nowrap;">近7天</button>
                                    <button class="btn" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn" data-days="90" style="height: 32px; white-space: nowrap;">近90天</button>
                                </div>
                            </div>
                        </div>

                        <!-- 数据时间 (标准 Date Range with Quick Select 样式) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto;">
                            <label class="form-label">数据时间</label>
                            <!-- 日期输入框和快速选择按钮在同一行 -->
                            <div style="display: flex; gap: 12px; align-items: center; white-space: nowrap;">
                                <!-- 日期输入框 -->
                                <div style="display: inline-flex; gap: 8px; align-items: center;">
                                    <input type="date" id="dataStartDate" class="form-control"
                                           value="${this.filters.dataStartDate || ''}"
                                           style="height: 32px; width: 140px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="dataEndDate" class="form-control"
                                           value="${this.filters.dataEndDate || ''}"
                                           style="height: 32px; width: 140px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" data-filter-type="dataTime" style="display: inline-flex;">
                                    <button class="btn is-active" data-days="7" style="height: 32px; white-space: nowrap;">近7天</button>
                                    <button class="btn" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn" data-days="90" style="height: 32px; white-space: nowrap;">近90天</button>
                                </div>
                            </div>
                        </div>

                        <!-- 创作者 (多选) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 160px;">
                            <label class="form-label">创作者</label>
                            <div id="creatorMultiSelect" class="multi-select-form-container"></div>
                        </div>

                        <!-- 内容类型 (多选) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 160px;">
                            <label class="form-label">内容类型</label>
                            <div id="contentTypeMultiSelect" class="multi-select-form-container"></div>
                        </div>

                        <!-- 广告策略 (多选) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto; min-width: 160px;">
                            <label class="form-label">广告策略</label>
                            <div id="adStrategyMultiSelect" class="multi-select-form-container"></div>
                        </div>

                        <!-- 笔记账号 (单选) -->
                        <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto;">
                            <label class="form-label">笔记账号</label>
                            <select id="accountSelect" class="form-control" style="width: 160px;">
                                <option value="全部">全部</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 数据表格卡片 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">笔记列表</h3>
                    <div class="card__actions">
                        <span class="stat-label">共 <strong id="totalRecords">${this.totalRecords}</strong> 条记录</span>
                        <button class="btn btn--primary btn--sm" id="exportBtn">
                            <i class="icon-download"></i> 导出
                        </button>
                    </div>
                </div>
                <div class="card__body">
                    <div class="table-container">
                        <table class="data-table" id="notesTable">
                            <thead>
                                <tr>
                                    <th class="sortable" data-field="note_id">笔记ID</th>
                                    <th class="sortable" data-field="title">笔记标题</th>
                                    <th class="sortable" data-field="note_type">笔记类型</th>
                                    <th class="sortable" data-field="content_type">内容类型</th>
                                    <th class="sortable" data-field="creator">创作者</th>
                                    <th class="sortable" data-field="ad_strategy">广告策略</th>
                                    <th class="sortable" data-field="account">笔记账号</th>
                                    <th class="sortable" data-field="publish_time">发布时间</th>
                                    <th class="sortable" data-field="cost">总展现量</th>
                                    <th class="sortable" data-field="impressions">总点击量</th>
                                    <th class="sortable" data-field="clicks">总点击率</th>
                                    <th class="sortable" data-field="click_rate">总互动量</th>
                                    <th class="sortable" data-field="ad_spend">消费金额</th>
                                    <th class="sortable" data-field="ad_impressions">推广展现量</th>
                                    <th class="sortable" data-field="ad_clicks">推广点击量</th>
                                    <th class="sortable" data-field="ad_click_rate">推广点击率</th>
                                    <th class="sortable" data-field="ad_interactions">推广互动量</th>
                                    <th class="sortable" data-field="private_messages">私信进线人数</th>
                                    <th class="sortable" data-field="lead_users">添加企微人数</th>
                                    <th class="sortable" data-field="customer_mouth_users">企微成功添加人数</th>
                                    <th class="sortable" data-field="add_wechat_cost">加微成本</th>
                                    <th class="sortable" data-field="opened_account_users">开户人数</th>
                                    <th class="sortable" data-field="open_account_cost">开户成本</th>
                                    <th class="actions">操作</th>
                                </tr>
                            </thead>
                            <tbody id="notesTableBody">
                                ${this.renderTableRows()}
                            </tbody>
                        </table>
                    </div>

                    <!-- 分页 -->
                    <div class="pagination-wrapper" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 16px;
                    ">
                        <div class="pagination-info">
                            共 ${this.totalRecords} 条，第 ${this.currentPage} / ${this.totalPages} 页
                        </div>
                        <div class="pagination-controls" id="paginationControls" style="
                            display: flex;
                            gap: 8px;
                        ">
                            ${this.renderPagination()}
                        </div>
                        <div class="page-size-selector" style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <span>每页</span>
                            <select id="pageSizeSelect" class="form-control" style="width: auto;">
                                <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20</option>
                                <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
                            </select>
                            <span>条</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 初始化多选组件
        this.initMultiSelectComponents();

        // 绑定表格排序事件
        this.bindSortEvents();

        // 恢复筛选条件的选中状态
        this.restoreFilterValues();

        // 绑定可编辑单元格事件（延迟执行，确保DOM已渲染）
        setTimeout(() => {
            this.bindEditableCellEvents();
        }, 0);

        // 更新笔记账号选项（在 DOM 渲染完成后）
        this.updateAccountOptions();
    }

    /**
     * 更新表格显示（不重新渲染整个页面）
     */
    updateTable() {
        // 更新表格内容
        const tableBody = document.getElementById('notesTableBody');
        if (tableBody) {
            tableBody.innerHTML = this.renderTableRows();
        }

        // 更新总记录数显示
        const totalRecordsEl = document.getElementById('totalRecords');
        if (totalRecordsEl) {
            totalRecordsEl.textContent = this.totalRecords;
        }

        // 更新分页信息
        const paginationInfo = document.querySelector('.pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = `共 ${this.totalRecords} 条，第 ${this.currentPage} / ${this.totalPages} 页`;
        }

        // 重新绑定可编辑单元格事件
        setTimeout(() => {
            this.bindEditableCellEvents();
        }, 0);
    }

    /**
     * 更新分页控件（不重新渲染整个页面）
     */
    updatePagination() {
        const paginationControls = document.getElementById('paginationControls');
        if (paginationControls) {
            paginationControls.innerHTML = this.renderPagination();
        }

        // 更新分页信息
        const paginationInfo = document.querySelector('.pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = `共 ${this.totalRecords} 条，第 ${this.currentPage} / ${this.totalPages} 页`;
        }
    }

    /**
     * 渲染表格行
     */
    renderTableRows() {
        if (!this.currentData || this.currentData.length === 0) {
            return `
                <tr>
                    <td colspan="23" class="text-center empty-state">
                        <div class="empty-icon">📝</div>
                        <div class="empty-text">暂无数据</div>
                    </td>
                </tr>
            `;
        }

        return this.currentData.map(note => {
            const noteTitle = this.truncateText(note.note_name || '-', 50);
            const displayTitle = note.note_name || '-';
            const isAdBadge = note.is_ad
                ? '<span class="badge badge-ad">投放</span>'
                : '<span class="badge badge-community">社区</span>';

            const creatorValue = note.producer || '-';
            const adStrategyValue = note.ad_strategy || '-';

            return `
                <tr class="data-row" data-note-id="${note.note_id}">
                    <td class="note-id">
                        ${note.note_id || '-'}
                    </td>
                    <td class="title">
                        <a href="${note.note_link || '#'}" target="_blank" class="title-link" title="${displayTitle}">
                            ${noteTitle}
                        </a>
                        ${isAdBadge}
                    </td>
                    <td class="note-type">
                        <span class="note-type-badge">${note.note_type || '-'}</span>
                    </td>
                    <td class="content-type">${this.getContentTypeLabel(note.content_type)}</td>
                    <td class="creator editable-cell" data-field="producer" data-note-id="${note.note_id}" data-current-value="${creatorValue}">
                        <span class="editable-value ${creatorValue === '-' ? 'empty' : ''}">
                            ${creatorValue}
                        </span>
                        <span class="edit-icon">✎</span>
                    </td>
                    <td class="ad-strategy editable-cell" data-field="ad_strategy" data-note-id="${note.note_id}" data-current-value="${adStrategyValue}">
                        <span class="editable-value ${adStrategyValue === '-' ? 'empty' : ''}">
                            ${adStrategyValue}
                        </span>
                        <span class="edit-icon">✎</span>
                    </td>
                    <td class="account">${note.publish_account || '-'}</td>
                    <td class="publish-time">${note.publish_time || '-'}</td>
                    <td class="impressions">${FormatHelper.formatNumber(note.exposure || 0)}</td>
                    <td class="clicks">${FormatHelper.formatNumber(note.reads || 0)}</td>
                    <td class="click-rate">${note.click_rate ? note.click_rate.toFixed(2) + '%' : '-'}</td>
                    <td class="interactions">${FormatHelper.formatNumber(note.interactions || 0)}</td>
                    <td class="cost">${FormatHelper.formatCurrency(note.ad_spend || 0)}</td>
                    <td class="ad-impressions">${FormatHelper.formatNumber(note.ad_impressions || 0)}</td>
                    <td class="ad-clicks">${FormatHelper.formatNumber(note.ad_clicks || 0)}</td>
                    <td class="ad-click-rate">${note.ad_click_rate ? note.ad_click_rate.toFixed(2) + '%' : '-'}</td>
                    <td class="ad-interactions">${FormatHelper.formatNumber(note.ad_interactions || 0)}</td>
                    <td class="private-messages">${FormatHelper.formatNumber(note.private_messages || 0)}</td>
                    <td class="lead-users">${FormatHelper.formatNumber(note.lead_users || 0)}</td>
                    <td class="customer-mouth-users">${FormatHelper.formatNumber(note.customer_mouth_users || 0)}</td>
                    <td class="add-wechat-cost">${FormatHelper.formatCurrency(note.add_wechat_cost || 0)}</td>
                    <td class="opened-account-users">${FormatHelper.formatNumber(note.opened_account_users || 0)}</td>
                    <td class="open-account-cost">${FormatHelper.formatCurrency(note.open_account_cost || 0)}</td>
                    <td class="actions">
                        ${note.note_link ? `<a href="${note.note_link}" target="_blank" class="note-link-btn">查看笔记</a>` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * 获取内容类型标签
     */
    getContentTypeLabel(contentType) {
        // 根据内容类型返回标签
        if (!contentType || contentType === '未知') return '-';

        // 如果内容类型包含"视频"，返回"视频"
        if (contentType.includes('视频')) {
            return '视频';
        }
        // 如果内容类型包含"图文"，返回"图文"
        if (contentType.includes('图文')) {
            return '图文';
        }

        // 默认返回原始值
        return contentType;
    }

    /**
     * 渲染分页控件
     */
    renderPagination() {
        const totalPages = this.totalPages;
        const currentPage = this.currentPage;

        if (totalPages <= 1) {
            return '';
        }

        let html = '';

        // 首页
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="1">首页</button>`;

        // 上一页
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>`;

        // 页码（简化版本，只显示部分页码）
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }

        // 下一页
        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;

        // 末页
        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">末页</button>`;

        return html;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 日期快捷按钮 - 修复：正确获取 filter-type 和更新对应的日期输入框
        const dateButtons = document.querySelectorAll('.btn[data-days]');
        dateButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.getAttribute('data-days'));
                const btnGroup = e.target.closest('.btn-group');
                const filterType = btnGroup.getAttribute('data-filter-type');

                // 更新按钮状态 - 使用 .is-active
                btnGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('is-active'));
                e.target.classList.add('is-active');

                // 设置日期范围
                this.setDateRangeByType(filterType, days);
            });
        });

        // 搜索按钮
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                this.updateFiltersFromUI();
                this.currentPage = 1;
                await this.loadData();
                this.updateTable();
                this.updatePagination();
            });
        }

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // 每页条数选择
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', async (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                await this.loadData();
                this.updateTable();
                this.updatePagination();
            });
        }

        // 分页按钮事件委托
        const paginationControls = document.getElementById('paginationControls');
        if (paginationControls) {
            paginationControls.addEventListener('click', (e) => {
                if (e.target.classList.contains('pagination-btn') && !e.target.disabled) {
                    const page = parseInt(e.target.getAttribute('data-page'));
                    this.goToPage(page);
                }
            });
        }
    }

    /**
     * 绑定可编辑单元格事件
     */
    bindEditableCellEvents() {
        console.log('[DEBUG] bindEditableCellEvents 开始执行');
        const editableCells = document.querySelectorAll('.editable-cell');
        console.log('[DEBUG] 找到可编辑单元格数量:', editableCells.length);

        editableCells.forEach((cell, index) => {
            console.log(`[DEBUG] 绑定事件到单元格 ${index + 1}:`, cell.getAttribute('data-field'), cell.textContent.trim());
            cell.addEventListener('click', (e) => {
                console.log('[DEBUG] 单元格被点击:', cell.getAttribute('data-field'), cell.textContent.trim());

                // 如果已经在编辑这个单元格，则不处理
                if (this.editingCell === cell) {
                    console.log('[DEBUG] 跳过：正在编辑此单元格');
                    return;
                }

                // 如果点击了编辑界面内的元素，不处理
                if (e.target.closest('.editable-select-wrapper')) {
                    console.log('[DEBUG] 跳过：点击了编辑界面');
                    return;
                }

                // 关闭之前打开的编辑器
                if (this.editingCell) {
                    console.log('[DEBUG] 关闭之前的编辑器');
                    this.closeEditor(this.editingCell);
                }

                // 打开编辑器
                console.log('[DEBUG] 打开编辑器');
                this.openEditor(cell);
            });
            console.log(`[DEBUG] 单元格 ${index + 1} 事件绑定完成`);
        });

        console.log('[DEBUG] 所有可编辑单元格事件绑定完成');

        // 点击其他地方关闭编辑器
        document.addEventListener('click', (e) => {
            if (this.editingCell && !e.target.closest('.editable-cell')) {
                this.closeEditor(this.editingCell);
                this.editingCell = null;
            }
        });
    }

    /**
     * 打开编辑器（使用单选下拉框样式）
     */
    openEditor(cell) {
        this.editingCell = cell;

        const field = cell.getAttribute('data-field');
        const noteId = cell.getAttribute('data-note-id');
        const currentValue = cell.getAttribute('data-current-value');

        // 获取枚举值
        const enums = field === 'producer' ? this.enums.creators : this.enums.ad_strategies;
        const fieldName = field === 'producer' ? '创作者' : '广告策略';

        // 创建编辑器HTML（使用标准单选下拉框样式）
        const editorHtml = `
            <div class="editable-select-wrapper" style="
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <select class="form-control editable-select" style="
                    width: 160px;
                    padding: 4px 8px;
                    font-size: 14px;
                ">
                    <option value="" ${currentValue === '-' ? 'selected' : ''}>-- 请选择${fieldName} --</option>
                    ${enums.map(value => `
                        <option value="${value}" ${value === currentValue ? 'selected' : ''}>${value}</option>
                    `).join('')}
                    <option value="__custom__">✎ 自定义...</option>
                </select>
                <input type="text" class="form-control editable-input" style="
                    width: 160px;
                    padding: 4px 8px;
                    font-size: 14px;
                    display: none;
                " placeholder="输入自定义${fieldName}" value="${currentValue !== '-' ? currentValue : ''}">
                <button class="btn btn--primary btn--sm editable-confirm">确认</button>
                <button class="btn btn--secondary btn--sm editable-cancel">取消</button>
            </div>
        `;

        // 插入编辑器到单元格中
        cell.innerHTML = editorHtml;

        // 绑定编辑器事件
        const select = cell.querySelector('.editable-select');
        const input = cell.querySelector('.editable-input');
        const confirmBtn = cell.querySelector('.editable-confirm');
        const cancelBtn = cell.querySelector('.editable-cancel');

        // 选择框改变事件
        select.addEventListener('change', () => {
            if (select.value === '__custom__') {
                // 显示自定义输入框
                input.style.display = 'inline-block';
                input.focus();
            } else if (select.value) {
                // 选择了已有值，隐藏输入框
                input.style.display = 'none';
                input.value = select.value;
            } else {
                // 选择了"请选择"，隐藏输入框
                input.style.display = 'none';
            }
        });

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            this.closeEditor(cell);
            this.editingCell = null;
        });

        // 确认按钮
        confirmBtn.addEventListener('click', () => {
            let newValue;

            if (select.value === '__custom__') {
                // 自定义值
                newValue = input.value.trim();
            } else if (select.value) {
                // 选择的已有值
                newValue = select.value;
            } else {
                // 未选择
                newValue = input.value.trim() || '-';
            }

            if (!newValue || newValue === '-') {
                alert('请输入值');
                return;
            }

            this.updateNoteField(noteId, field, newValue);
        });

        // 聚焦选择框
        select.focus();
    }

    /**
     * 关闭编辑器
     */
    closeEditor(cell) {
        const currentValue = cell.getAttribute('data-current-value');
        const isEmpty = currentValue === '-';

        // 恢复原始显示
        cell.innerHTML = `
            <span class="editable-value ${isEmpty ? 'empty' : ''}">
                ${currentValue}
            </span>
            <span class="edit-icon">✎</span>
        `;
    }

    /**
     * 更新笔记字段
     */
    async updateNoteField(noteId, field, value) {
        try {
            const response = await fetch('/api/v1/xhs-note-info/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    note_id: noteId,
                    updates: {
                        [field]: value
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                // 更新本地数据
                const note = this.currentData.find(n => n.note_id === noteId);
                if (note) {
                    note[field] = value;
                }

                // 更新单元格显示
                const cell = this.editingCell;
                cell.setAttribute('data-current-value', value);
                this.closeEditor(cell);
                this.editingCell = null;

                // 重新加载枚举值（如果添加了新值）
                await this.loadEnums();

                // 显示成功提示
                this.showNotification('更新成功', 'success');
            } else {
                this.showNotification('更新失败: ' + (result.error || '未知错误'), 'error');
            }

        } catch (error) {
            console.error('更新失败:', error);
            this.showNotification('更新失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#52c41a' : type === 'error' ? '#f5222d' : '#1890ff'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 绑定排序事件
     */
    bindSortEvents() {
        const sortableHeaders = document.querySelectorAll('.data-table th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-field');
                this.sortData(field);
            });
        });
    }

    /**
     * 设置日期范围
     */
    setDateRange(filterGroup, days) {
        const endDate = new Date();
        const startDate = new Date();
        const dateInputs = filterGroup.querySelector('.date-range-inputs');
        const startDateInput = dateInputs.querySelector('input[type="date"]:first-child');
        const endDateInput = dateInputs.querySelector('input[type="date"]:last-child');

        if (days === 0) {
            // 今日
            startDate.setTime(endDate.getTime());
        } else if (days === 1) {
            // 昨日
            endDate.setDate(endDate.getDate() - 1);
            startDate.setTime(endDate.getTime());
        } else {
            // 近N天
            startDate.setDate(endDate.getDate() - days);
        }

        if (startDateInput && endDateInput) {
            startDateInput.value = startDate.toISOString().split('T')[0];
            endDateInput.value = endDate.toISOString().split('T')[0];
        }
    }

    /**
     * 根据筛选器类型设置日期范围（新增方法）
     */
    setDateRangeByType(filterType, days) {
        const endDate = new Date();
        const startDate = new Date();

        // 计算日期范围
        startDate.setDate(endDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // 根据 filterType 更新对应的输入框和筛选条件
        if (filterType === 'publishTime') {
            // 更新发布时间
            const publishStartInput = document.getElementById('publishStartDate');
            const publishEndInput = document.getElementById('publishEndDate');
            if (publishStartInput) publishStartInput.value = startDateStr;
            if (publishEndInput) publishEndInput.value = endDateStr;

            // 更新筛选条件
            this.filters.publishStartDate = startDateStr;
            this.filters.publishEndDate = endDateStr;
            this.filters.publishTimeRange = days.toString();

        } else if (filterType === 'dataTime') {
            // 更新数据时间
            const dataStartInput = document.getElementById('dataStartDate');
            const dataEndInput = document.getElementById('dataEndDate');
            if (dataStartInput) dataStartInput.value = startDateStr;
            if (dataEndInput) dataEndInput.value = endDateStr;

            // 更新筛选条件
            this.filters.dataStartDate = startDateStr;
            this.filters.dataEndDate = endDateStr;
            this.filters.dataTimeRange = days.toString();
        }

        console.log(`[${filterType}] 日期范围已更新: ${startDateStr} 至 ${endDateStr}`);
    }

    /**
     * 从UI更新筛选条件
     */
    updateFiltersFromUI() {
        this.filters.publishStartDate = document.getElementById('publishStartDate')?.value || this.filters.publishStartDate;
        this.filters.publishEndDate = document.getElementById('publishEndDate')?.value || this.filters.publishEndDate;
        this.filters.dataStartDate = document.getElementById('dataStartDate')?.value || this.filters.dataStartDate;
        this.filters.dataEndDate = document.getElementById('dataEndDate')?.value || this.filters.dataEndDate;

        // 从多选组件获取值
        if (this.multiSelectInstances.creator) {
            this.filters.creator = this.multiSelectInstances.creator.getSelected();
        }
        if (this.multiSelectInstances.contentType) {
            this.filters.contentType = this.multiSelectInstances.contentType.getSelected();
        }
        if (this.multiSelectInstances.adStrategy) {
            this.filters.adStrategy = this.multiSelectInstances.adStrategy.getSelected();
        }

        // 笔记账号（单选）
        this.filters.account = document.getElementById('accountSelect')?.value || '全部';
    }

    /**
     * 恢复筛选条件的选中状态（在render()之后调用）
     */
    restoreFilterValues() {
        // 恢复日期选择器的值
        const publishStartDate = document.getElementById('publishStartDate');
        if (publishStartDate) publishStartDate.value = this.filters.publishStartDate;

        const publishEndDate = document.getElementById('publishEndDate');
        if (publishEndDate) publishEndDate.value = this.filters.publishEndDate;

        const dataStartDate = document.getElementById('dataStartDate');
        if (dataStartDate) dataStartDate.value = this.filters.dataStartDate;

        const dataEndDate = document.getElementById('dataEndDate');
        if (dataEndDate) dataEndDate.value = this.filters.dataEndDate;

        // 恢复笔记账号的选中值
        const accountSelect = document.getElementById('accountSelect');
        if (accountSelect) accountSelect.value = this.filters.account || '全部';

        // 多选组件的值已在 initMultiSelectComponents 中通过 selectedValues 参数设置
    }

    /**
     * 重置筛选条件
     */
    resetFilters() {
        this.filters = this.getDefaultFilters();
        this.currentPage = 1;
        this.loadData();
        this.render();
        this.bindEvents();
    }

    /**
     * 跳转到指定页
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages) {
            return;
        }
        this.currentPage = page;
        await this.loadData();
        this.updateTable();
        this.updatePagination();
    }

    /**
     * 排序数据
     */
    sortData(field) {
        if (this.sortField === field) {
            // 切换排序方向
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortOrder = 'asc';
        }

        // 排序数据
        this.currentData.sort((a, b) => {
            let aVal = a[field] || '';
            let bVal = b[field] || '';

            // 数值字段特殊处理
            if (['cost', 'impressions', 'clicks', 'click_rate'].includes(field)) {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        // 重新渲染表格
        const tbody = document.getElementById('notesTableBody');
        if (tbody) {
            tbody.innerHTML = this.renderTableRows();
            // 重新绑定可编辑单元格事件
            this.bindEditableCellEvents();
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            // 获取所有数据（使用大页面大小）
            const filters = this.buildApiFilters();
            const response = await API.getXhsNotesList(filters, 1, 999999);

            if (!response.success) {
                throw new Error(response.error || '获取数据失败');
            }

            const allData = response.notes || [];

            if (allData.length === 0) {
                alert('没有数据可导出');
                return;
            }

            // 生成CSV内容
            const headers = ['笔记ID', '标题', '类型', '创作者', '发布账号', '发布时间', '花费', '曝光量', '阅读量', '互动量', '是否投放', '链接'];
            const csvRows = [headers.join(',')];

            allData.forEach(note => {
                const row = [
                    note.note_id || '',
                    note.note_name || '',
                    note.note_type || '',
                    note.producer || '',  // 创作者姓名
                    note.publish_account || '',  // 发布账号名称
                    note.publish_time || '',
                    note.ad_spend || 0,
                    note.exposure || 0,
                    note.reads || 0,
                    note.interactions || 0,
                    note.is_ad ? '投放' : '社区',
                    note.note_link || ''
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = '\uFEFF' + csvRows.join('\n');

            // 创建下载链接
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `小红书笔记列表_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log('数据已导出，共', allData.length, '条记录');

        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        }
    }

    /**
     * 获取笔记类型标签
     */
    getNoteTypeLabel(type) {
        const typeMap = {
            1: '图文',
            2: '视频',
            'image': '图文',
            'video': '视频'
        };
        return typeMap[type] || type || '-';
    }

    /**
     * 格式化日期时间
     */
    formatDateTime(dateStr) {
        if (!dateStr) return '-';

        try {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * 计算点击率
     */
    calculateClickRate(impressions, clicks) {
        if (!impressions || impressions === 0) {
            return '-';
        }
        const rate = ((clicks || 0) / impressions * 100).toFixed(2);
        return rate + '%';
    }

    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 销毁实例
     */
    destroy() {
        // 清理工作
    }
}

// 导出到全局
window.XhsNotesListReport = XhsNotesListReport;
