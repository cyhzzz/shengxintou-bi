/**
 * 省心投 BI - 数据表格组件
 * 支持排序、分页、筛选等功能
 */

class DataTable {
    /**
     * 创建数据表格实例
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 容器元素ID
     * @param {Array} options.columns - 列配置
     * @param {Array} options.data - 表格数据
     * @param {Object} options.pagination - 分页配置
     */
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.columns = options.columns || [];
        this.data = options.data || [];
        this.filteredData = [...this.data];
        this.sortColumn = null;
        this.sortDirection = 'asc'; // 'asc' or 'desc'
        this.currentPage = 1;
        this.pageSize = options.pagination?.pageSize || 10;
        this.showPagination = options.pagination?.show !== false;

        this.init();
    }

    /**
     * 初始化表格
     */
    init() {
        this.render();
    }

    /**
     * 渲染表格（优化版：只更新数据部分）
     * @param {boolean} fullRender - 是否完全重渲染（默认false）
     */
    render(fullRender = false) {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`找不到容器: ${this.containerId}`);
            return;
        }

        if (fullRender || !container.querySelector('.data-table')) {
            // 首次渲染或需要完全重渲染时
            container.innerHTML = this.renderHTML();
            this.bindEvents();
        } else {
            // 只更新数据部分（避免重渲染整个表格）
            this.updateTableBody();
            this.updatePagination();
        }
    }

    /**
     * 只更新表格主体（优化性能）
     */
    updateTableBody() {
        const tbody = document.querySelector(`#${this.containerId} .data-table tbody`);
        if (!tbody) return;

        const paginatedData = this.getPaginatedData();

        tbody.innerHTML = paginatedData.length > 0
            ? paginatedData.map(row => this.renderRow(row)).join('')
            : `<tr><td colspan="${this.columns.length}" class="empty-state">暂无数据</td></tr>`;
    }

    /**
     * 只更新分页器（优化性能）
     */
    updatePagination() {
        const paginationContainer = document.querySelector(`#${this.containerId} .table-pagination`);
        const tableInfo = document.querySelector(`#${this.containerId} .total-count`);

        // 更新记录数
        if (tableInfo) {
            tableInfo.textContent = this.filteredData.length;
        }

        // 更新或移除分页器
        if (this.showPagination) {
            const newPaginationHTML = this.renderPagination();
            if (paginationContainer) {
                paginationContainer.innerHTML = newPaginationHTML;
                this.bindPaginationEvents();
            } else {
                // 如果分页器不存在，重新渲染整个表格
                this.render(true);
                return;
            }
        }
    }

    /**
     * 生成表格HTML
     * @returns {string} HTML字符串
     */
    renderHTML() {
        const paginatedData = this.getPaginatedData();

        return `
            <div class="data-table-wrapper">
                <div class="data-table-header">
                    <div class="table-title">数据表格</div>
                    <div class="table-info">
                        共 <span class="total-count">${this.filteredData.length}</span> 条记录
                    </div>
                </div>
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                ${this.columns.map(col => this.renderHeader(col)).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${paginatedData.length > 0
                                ? paginatedData.map(row => this.renderRow(row)).join('')
                                : `<tr><td colspan="${this.columns.length}" class="empty-state">暂无数据</td></tr>`
                            }
                        </tbody>
                    </table>
                </div>
                ${this.showPagination ? this.renderPagination() : ''}
            </div>
        `;
    }

    /**
     * 渲染表头
     * @param {Object} column - 列配置
     * @returns {string} HTML字符串
     */
    renderHeader(column) {
        const sortable = column.sortable !== false;
        const sortClass = this.sortColumn === column.key
            ? `sort-${this.sortDirection}`
            : '';
        const sortIcon = this.sortColumn === column.key
            ? (this.sortDirection === 'asc' ? '↑' : '↓')
            : (sortable ? '↕' : '');

        return `
            <th class="${sortable ? 'sortable' : ''} ${sortClass}"
                data-column="${column.key}"
                data-sortable="${sortable}">
                <div class="th-content">
                    <span>${column.title}</span>
                    ${sortable ? `<span class="sort-icon">${sortIcon}</span>` : ''}
                </div>
            </th>
        `;
    }

    /**
     * 渲染数据行
     * @param {Object} row - 行数据
     * @returns {string} HTML字符串
     */
    renderRow(row) {
        return `
            <tr class="data-row">
                ${this.columns.map(col => `
                    <td class="column-${col.key}">
                        ${this.renderCell(row, col)}
                    </td>
                `).join('')}
            </tr>
        `;
    }

    /**
     * 渲染单元格
     * @param {Object} row - 行数据
     * @param {Object} column - 列配置
     * @returns {string} HTML字符串
     */
    renderCell(row, column) {
        const value = row[column.key];

        // 自定义渲染函数
        if (column.render) {
            return column.render(value, row);
        }

        // 格式化函数
        if (column.formatter) {
            return column.formatter(value);
        }

        // 默认渲染
        return value !== null && value !== undefined ? String(value) : '-';
    }

    /**
     * 渲染分页器
     * @returns {string} HTML字符串
     */
    renderPagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

        if (totalPages <= 1) {
            return '';
        }

        return `
            <div class="table-pagination">
                <button class="pagination-btn" data-action="prev"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                    上一页
                </button>
                <div class="pagination-info">
                    <span>${this.currentPage}</span> / <span>${totalPages}</span>
                </div>
                <button class="pagination-btn" data-action="next"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                    下一页
                </button>
                <select class="page-size-selector">
                    <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10条/页</option>
                    <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20条/页</option>
                    <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50条/页</option>
                    <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100条/页</option>
                </select>
            </div>
        `;
    }

    /**
     * 获取当前页数据
     * @returns {Array} 分页后的数据
     */
    getPaginatedData() {
        if (!this.showPagination) {
            return this.filteredData;
        }

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredData.slice(start, end);
    }

    /**
     * 绑定事件（只在首次渲染时调用）
     */
    bindEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // 排序事件（使用事件委托，避免重复绑定）
        if (!this._sortEventsBound) {
            container.addEventListener('click', (e) => {
                const th = e.target.closest('th.sortable');
                if (th) {
                    const column = th.dataset.column;
                    this.sort(column);
                }
            });
            this._sortEventsBound = true;
        }

        // 每页显示数量选择
        const sizeSelector = container.querySelector('.page-size-selector');
        if (sizeSelector && !this._sizeSelectorBound) {
            sizeSelector.addEventListener('change', (e) => {
                this.setPageSize(parseInt(e.target.value));
            });
            this._sizeSelectorBound = true;
        }
    }

    /**
     * 绑定分页事件（每次更新分页器时调用）
     */
    bindPaginationEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // 分页按钮事件（使用事件委托）
        const paginationContainer = container.querySelector('.table-pagination');
        if (paginationContainer && !this._paginationEventsBound) {
            paginationContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.pagination-btn');
                if (btn && !btn.disabled) {
                    const action = btn.dataset.action;
                    if (action === 'prev') {
                        this.prevPage();
                    } else if (action === 'next') {
                        this.nextPage();
                    }
                }
            });
            this._paginationEventsBound = true;
        }
    }

    /**
     * 排序
     * @param {string} column - 排序列的key
     */
    sort(column) {
        if (this.sortColumn === column) {
            // 切换排序方向
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // 新的排序列
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // 执行排序
        this.filteredData.sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];

            if (aVal === bVal) return 0;

            const comparison = aVal > bVal ? 1 : -1;
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        // 重置到第一页
        this.currentPage = 1;

        // 重新渲染
        this.render();
    }

    /**
     * 上一页
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
        }
    }

    /**
     * 下一页
     */
    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
        }
    }

    /**
     * 跳转到指定页
     * @param {number} page - 页码
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.render();
        }
    }

    /**
     * 设置每页显示数量
     * @param {number} size - 每页显示数量
     */
    setPageSize(size) {
        this.pageSize = size;
        this.currentPage = 1;
        this.render();
    }

    /**
     * 更新表格数据（优化版：使用局部更新）
     * @param {Array} data - 新数据
     */
    updateData(data) {
        this.data = data;
        this.filteredData = [...data];
        this.currentPage = 1;
        this.render(false); // 使用局部更新，避免完全重渲染
    }

    /**
     * 筛选数据（优化版：使用局部更新）
     * @param {Function} filterFn - 筛选函数
     */
    filter(filterFn) {
        this.filteredData = this.data.filter(filterFn);
        this.currentPage = 1;
        this.render(false); // 使用局部更新
    }

    /**
     * 重置筛选（优化版：使用局部更新）
     */
    resetFilter() {
        this.filteredData = [...this.data];
        this.currentPage = 1;
        this.render(false); // 使用局部更新
    }

    /**
     * 刷新表格（优化版：使用局部更新）
     */
    refresh() {
        this.render(false); // 使用局部更新
    }

    /**
     * 销毁表格
     */
    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
}

// 导出到全局
window.DataTable = DataTable;
