/**
 * 简称管理组件
 *
 * 用于管理代理商简称映射表 (agency_abbreviation_mapping)
 * 维护转化明细表 (backend_conversions) 中 agency 字段的拼音简称到全称的映射关系
 *
 * v2.0 - 使用 Vaadin Web Components (条件渲染，支持降级)
 */

class AbbreviationManagement {
    constructor() {
        this.currentData = [];
        this.filteredData = [];
        this.editingItem = null;
        this.filterType = 'all'; // all, agency, platform
        this.filterStatus = 'all'; // all, active, inactive
        this.vaadinReady = false; // Vaadin 组件是否加载完成

        this.init();
    }

    async init() {
        console.log('[简称管理] 初始化...');

        // 尝试加载 Vaadin 组件
        await this.loadVaadinComponents();

        this.render();
        await this.loadData();
    }

    /**
     * 加载 Vaadin 组件
     */
    async loadVaadinComponents() {
        try {
            // 检查 VaadinLoader 是否存在
            if (typeof VaadinLoader === 'undefined') {
                console.log('[简称管理] VaadinLoader 未找到，使用原生组件');
                this.vaadinReady = false;
                return;
            }

            // 加载需要的组件：select, text-field, button, checkbox, text-area
            await VaadinLoader.loadComponents([
                'textField',
                'select',
                'item',
                'button',
                'checkbox',
                'textArea'
            ]);

            this.vaadinReady = true;
            console.log('[简称管理] Vaadin 组件加载成功');
        } catch (error) {
            console.warn('[简称管理] Vaadin 组件加载失败，使用原生组件:', error);
            this.vaadinReady = false;
        }
    }

    async loadData() {
        try {
            const response = await API.get('/abbreviation-mapping');

            if (response.success) {
                this.currentData = response.data || [];
                this.applyFilters();
                this.renderTable();
                this.updateStats();
                console.log(`[简称管理] 加载了 ${this.currentData.length} 条数据`);
            } else {
                this.showError('加载数据失败');
            }
        } catch (error) {
            console.error('[简称管理] 加载失败:', error);
            this.showError('加载数据失败，请检查网络连接');
        }
    }

    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const useVaadin = this.vaadinReady;

        container.innerHTML = `
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">简称映射管理</h3>
                    <div class="card__actions">
                        <span class="stat-label" id="totalCount">共 0 条</span>
                        ${useVaadin ? `
                            <vaadin-button id="addAbbreviationBtn" theme="primary">
                                <span style="margin-right: 4px;">+</span>添加简称
                            </vaadin-button>
                        ` : `
                            <button class="btn btn--primary btn--sm" id="addAbbreviationBtn">
                                <span style="margin-right: 4px;">+</span>添加简称
                            </button>
                        `}
                    </div>
                </div>
                <div class="card__body">
                    <!-- 筛选器 -->
                    <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                        <div class="filter-group">
                            <label class="filter-label">类型:</label>
                            ${useVaadin ? `
                                <vaadin-select id="filterType" theme="aura" style="width: 120px;">
                                    <vaadin-item value="all">全部</vaadin-item>
                                    <vaadin-item value="agency">代理商</vaadin-item>
                                    <vaadin-item value="platform">平台</vaadin-item>
                                </vaadin-select>
                            ` : `
                                <select id="filterType" class="form-control" style="width: 120px;">
                                    <option value="all">全部</option>
                                    <option value="agency">代理商</option>
                                    <option value="platform">平台</option>
                                </select>
                            `}
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">状态:</label>
                            ${useVaadin ? `
                                <vaadin-select id="filterStatus" theme="aura" style="width: 120px;">
                                    <vaadin-item value="all">全部</vaadin-item>
                                    <vaadin-item value="active">启用</vaadin-item>
                                    <vaadin-item value="inactive">禁用</vaadin-item>
                                </vaadin-select>
                            ` : `
                                <select id="filterStatus" class="form-control" style="width: 120px;">
                                    <option value="all">全部</option>
                                    <option value="active">启用</option>
                                    <option value="inactive">禁用</option>
                                </select>
                            `}
                        </div>
                    </div>

                    <!-- 表格 -->
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">简称</th>
                                    <th style="width: 150px;">全称</th>
                                    <th style="width: 100px;">类型</th>
                                    <th style="width: 100px;">平台</th>
                                    <th style="width: 150px;">显示名称</th>
                                    <th style="width: 200px;">说明</th>
                                    <th style="width: 80px;">状态</th>
                                    <th style="width: 150px;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="abbreviationTableBody">
                                <tr>
                                    <td colspan="8" class="text-center">加载中...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 编辑/添加模态框 -->
            <div class="modal-overlay" id="editModal" style="display: none;">
                <div class="modal-container" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="modalTitle">添加简称</h3>
                        ${useVaadin ? `
                            <vaadin-button id="closeModal" theme="tertiary-inline" style="font-size: 24px;">&times;</vaadin-button>
                        ` : `
                            <button class="modal-close" id="closeModal">&times;</button>
                        `}
                    </div>
                    <div class="modal-body">
                        <form id="abbreviationForm">
                            <input type="hidden" id="editId">

                            <div class="form-group">
                                <label class="form-label" for="abbreviation">
                                    简称 <span class="form-required">*</span>
                                </label>
                                ${useVaadin ? `
                                    <vaadin-text-field id="abbreviation" theme="aura"
                                        placeholder="如: lz, fs, YJ" required style="width: 100%;"></vaadin-text-field>
                                ` : `
                                    <input type="text" id="abbreviation" class="form-control" placeholder="如: lz, fs, YJ" required>
                                `}
                                <small class="form-hint">拼音简称，对应转化表中的 agency 字段</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="fullName">
                                    全称 <span class="form-required">*</span>
                                </label>
                                ${useVaadin ? `
                                    <vaadin-text-field id="fullName" theme="aura"
                                        placeholder="如: 量子, 风声, 云极" required style="width: 100%;"></vaadin-text-field>
                                ` : `
                                    <input type="text" id="fullName" class="form-control" placeholder="如: 量子, 风声, 云极" required>
                                `}
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="mappingType">
                                    类型 <span class="form-required">*</span>
                                </label>
                                ${useVaadin ? `
                                    <vaadin-select id="mappingType" theme="aura" required style="width: 100%;">
                                        <vaadin-item value="">请选择</vaadin-item>
                                        <vaadin-item value="agency">代理商</vaadin-item>
                                        <vaadin-item value="platform">平台</vaadin-item>
                                    </vaadin-select>
                                ` : `
                                    <select id="mappingType" class="form-control" required>
                                        <option value="">请选择</option>
                                        <option value="agency">代理商</option>
                                        <option value="platform">平台</option>
                                    </select>
                                `}
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="platform">适用平台</label>
                                ${useVaadin ? `
                                    <vaadin-select id="platform" theme="aura" style="width: 100%;">
                                        <vaadin-item value="">通用（所有平台）</vaadin-item>
                                        <vaadin-item value="腾讯">腾讯</vaadin-item>
                                        <vaadin-item value="抖音">抖音</vaadin-item>
                                        <vaadin-item value="小红书">小红书</vaadin-item>
                                    </vaadin-select>
                                ` : `
                                    <select id="platform" class="form-control">
                                        <option value="">通用（所有平台）</option>
                                        <option value="腾讯">腾讯</option>
                                        <option value="抖音">抖音</option>
                                        <option value="小红书">小红书</option>
                                    </select>
                                `}
                                <small class="form-hint">留空表示适用于所有平台</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="displayName">显示名称</label>
                                ${useVaadin ? `
                                    <vaadin-text-field id="displayName" theme="aura"
                                        placeholder="默认与全称相同" style="width: 100%;"></vaadin-text-field>
                                ` : `
                                    <input type="text" id="displayName" class="form-control" placeholder="默认与全称相同">
                                `}
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="description">说明</label>
                                ${useVaadin ? `
                                    <vaadin-text-area id="description" theme="aura"
                                        placeholder="可选的说明备注" style="width: 100%; height: 60px;"></vaadin-text-area>
                                ` : `
                                    <textarea id="description" class="form-control" rows="2" placeholder="可选的说明备注"></textarea>
                                `}
                            </div>

                            <div class="form-group">
                                ${useVaadin ? `
                                    <vaadin-checkbox id="isActive" theme="aura" checked>启用此简称映射</vaadin-checkbox>
                                ` : `
                                    <label class="form-label">
                                        <input type="checkbox" id="isActive" checked>
                                        启用此简称映射
                                    </label>
                                `}
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        ${useVaadin ? `
                            <vaadin-button id="cancelBtn" theme="secondary">取消</vaadin-button>
                            <vaadin-button id="saveBtn" theme="primary">保存</vaadin-button>
                        ` : `
                            <button class="btn btn--secondary" id="cancelBtn">取消</button>
                            <button class="btn btn--primary" id="saveBtn">保存</button>
                        `}
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const useVaadin = this.vaadinReady;

        // 筛选器事件
        const filterTypeEl = document.getElementById('filterType');
        const filterStatusEl = document.getElementById('filterStatus');

        if (useVaadin) {
            // Vaadin 使用 value-changed 事件
            filterTypeEl.addEventListener('value-changed', (e) => {
                this.filterType = e.detail.value;
                this.applyFilters();
                this.renderTable();
            });

            filterStatusEl.addEventListener('value-changed', (e) => {
                this.filterStatus = e.detail.value;
                this.applyFilters();
                this.renderTable();
            });
        } else {
            // 原生使用 change 事件
            filterTypeEl.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                this.applyFilters();
                this.renderTable();
            });

            filterStatusEl.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.applyFilters();
                this.renderTable();
            });
        }

        // 添加按钮
        const addBtn = document.getElementById('addAbbreviationBtn');
        if (useVaadin) {
            addBtn.addEventListener('click', () => {
                this.openEditModal();
            });
        } else {
            addBtn.addEventListener('click', () => {
                this.openEditModal();
            });
        }

        // 模态框事件
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveItem();
        });

        // 点击模态框外部关闭
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeEditModal();
            }
        });
    }

    applyFilters() {
        this.filteredData = this.currentData.filter(item => {
            // 类型筛选
            if (this.filterType !== 'all' && item.mapping_type !== this.filterType) {
                return false;
            }

            // 状态筛选
            if (this.filterStatus === 'active' && !item.is_active) {
                return false;
            }
            if (this.filterStatus === 'inactive' && item.is_active) {
                return false;
            }

            return true;
        });
    }

    renderTable() {
        const tbody = document.getElementById('abbreviationTableBody');
        if (!tbody) return;

        if (this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div style="padding: 40px; text-align: center; color: #999;">
                            <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                            <div>暂无数据</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredData.map(item => {
            const typeTag = this.getTypeTag(item.mapping_type);
            const platformTag = item.platform ? `<span class="tag">${item.platform}</span>` : '<span style="color: #999;">通用</span>';
            const statusBadge = item.is_active
                ? '<span class="tag tag--success">启用</span>'
                : '<span class="tag tag--error">禁用</span>';

            return `
                <tr>
                    <td><strong>${item.abbreviation}</strong></td>
                    <td>${item.full_name}</td>
                    <td>${typeTag}</td>
                    <td>${platformTag}</td>
                    <td>${item.display_name || item.full_name}</td>
                    <td><small style="color: #666;">${item.description || '-'}</small></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn--sm btn--ghost btn-edit-abbreviation"
                                    data-id="${item.id}">
                                编辑
                            </button>
                            <button class="btn btn--sm btn--ghost ${item.is_active ? 'is-error' : ''} btn-toggle-abbreviation"
                                    data-id="${item.id}"
                                    data-is-active="${item.is_active}">
                                ${item.is_active ? '禁用' : '启用'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getTypeTag(type) {
        if (type === 'agency') {
            return '<span class="tag tag--primary">代理商</span>';
        } else if (type === 'platform') {
            return '<span class="tag tag--info">平台</span>';
        }
        return `<span class="tag">${type}</span>`;
    }

    updateStats() {
        const totalEl = document.getElementById('totalCount');
        if (totalEl) {
            totalEl.textContent = `共 ${this.filteredData.length} 条`;
        }
    }

    /**
     * 获取表单元素值（兼容 Vaadin 和原生组件）
     */
    getFormValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return (this.vaadinReady ? el.value : el.value).trim();
    }

    /**
     * 获取复选框状态（兼容 Vaadin 和原生组件）
     */
    getCheckboxValue(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        return this.vaadinReady ? el.checked : el.checked;
    }

    /**
     * 设置表单元素值（兼容 Vaadin 和原生组件）
     */
    setFormValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value || '';
    }

    /**
     * 设置复选框状态（兼容 Vaadin 和原生组件）
     */
    setCheckboxValue(id, checked) {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = checked;
    }

    /**
     * 设置表单元素禁用状态（兼容 Vaadin 和原生组件）
     */
    setFormDisabled(id, disabled) {
        const el = document.getElementById(id);
        if (!el) return;
        if (this.vaadinReady) {
            el.disabled = disabled;
        } else {
            el.disabled = disabled;
        }
    }

    openEditModal(item = null) {
        const modal = document.getElementById('editModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('abbreviationForm');

        if (item) {
            // 编辑模式
            title.textContent = '编辑简称';
            this.setFormValue('editId', item.id);
            this.setFormValue('abbreviation', item.abbreviation);
            this.setFormValue('fullName', item.full_name);
            this.setFormValue('mappingType', item.mapping_type);
            this.setFormValue('platform', item.platform || '');
            this.setFormValue('displayName', item.display_name || '');
            this.setFormValue('description', item.description || '');
            this.setCheckboxValue('isActive', item.is_active);

            // 编辑模式下简称不可修改（因为是主键）
            this.setFormDisabled('abbreviation', true);
        } else {
            // 添加模式
            title.textContent = '添加简称';
            form.reset();
            this.setFormValue('editId', '');
            this.setCheckboxValue('isActive', true);
            this.setFormDisabled('abbreviation', false);
        }

        modal.style.display = 'flex';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    async saveItem() {
        const form = document.getElementById('abbreviationForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            abbreviation: this.getFormValue('abbreviation'),
            full_name: this.getFormValue('fullName'),
            mapping_type: this.getFormValue('mappingType'),
            platform: this.getFormValue('platform') || null,
            display_name: this.getFormValue('displayName') || null,
            description: this.getFormValue('description') || null,
            is_active: this.getCheckboxValue('isActive')
        };

        const editId = document.getElementById('editId').value;

        try {
            let response;
            if (editId) {
                // 更新
                response = await API.put(`/abbreviation-mapping/${editId}`, data);
            } else {
                // 添加
                response = await API.post('/abbreviation-mapping', data);
            }

            if (response.success) {
                this.closeEditModal();
                await this.loadData();
                this.showSuccess(editId ? '更新成功' : '添加成功');
            } else {
                this.showError(response.message || '操作失败');
            }
        } catch (error) {
            console.error('[简称管理] 保存失败:', error);
            this.showError('操作失败，请检查网络连接');
        }
    }

    async editItem(id) {
        const item = this.currentData.find(i => i.id == id);
        if (item) {
            this.openEditModal(item);
        }
    }

    async toggleStatus(id) {
        const item = this.currentData.find(i => i.id == id);
        if (!item) return;

        const newStatus = !item.is_active;
        const action = newStatus ? '启用' : '禁用';

        try {
            const response = await API.put(`/abbreviation-mapping/${id}`, {
                is_active: newStatus
            });

            if (response.success) {
                await this.loadData();
                this.showSuccess(`${action}成功`);
            } else {
                this.showError(response.message || `${action}失败`);
            }
        } catch (error) {
            console.error('[简称管理] 切换状态失败:', error);
            this.showError(`${action}失败，请检查网络连接`);
        }
    }

    showSuccess(message) {
        // 简单提示
        alert(message);
    }

    showError(message) {
        alert(message);
    }

    destroy() {
        // 清理资源
        this.currentData = null;
        this.filteredData = null;
        this.editingItem = null;
    }
}

// 事件委托处理编辑和禁用按钮
document.addEventListener('click', async (e) => {
    // 使用 closest 查找按钮（处理点击按钮内部元素的情况）
    const editBtn = e.target.closest('.btn-edit-abbreviation');
    const toggleBtn = e.target.closest('.btn-toggle-abbreviation');

    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();

        const id = editBtn.dataset.id;
        console.log('[简称管理] 编辑按钮点击:', id);

        // 找到当前的 AbbreviationManagement 实例
        if (window.app && window.app.currentReportInstance instanceof AbbreviationManagement) {
            window.app.currentReportInstance.editItem(id);
        } else {
            console.error('[简称管理] 找不到 AbbreviationManagement 实例');
        }
    }

    if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();

        const id = toggleBtn.dataset.id;
        console.log('[简称管理] 禁用/启用按钮点击:', id);

        // 找到当前的 AbbreviationManagement 实例
        if (window.app && window.app.currentReportInstance instanceof AbbreviationManagement) {
            window.app.currentReportInstance.toggleStatus(id);
        } else {
            console.error('[简称管理] 找不到 AbbreviationManagement 实例');
        }
    }
});

// 导出到全局（确保 DynamicLoader 能找到此类）
if (typeof window !== 'undefined') {
    window.AbbreviationManagement = AbbreviationManagement;
}