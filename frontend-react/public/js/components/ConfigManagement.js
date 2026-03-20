/**
 * 省心投 BI - 系统配置管理组件
 * 管理系统各类配置参数
 */

class ConfigManagement {
    /**
     * 创建配置管理实例
     */
    constructor() {
        this.configs = [];
        this.categories = [];
        this.currentCategory = 'all';
        this.editingConfig = null;

        this.init();
    }

    /**
     * 初始化组件
     */
    async init() {
        console.log('初始化系统配置管理组件');

        // 渲染HTML
        this.render();

        // 绑定事件
        this.bindEvents();

        // 加载配置数据
        await this.loadConfigs();
    }

    /**
     * 更新日期输入框（配置管理不需要）
     */
    updateDateInputs() {
        // 配置管理组件不需要日期输入框
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
            <div class="config-management-page">
                <div class="page-header">
                    <h2>系统配置管理</h2>
                    <p class="page-description">管理系统运行参数和业务配置</p>
                </div>

                <!-- 分类筛选 -->
                <div class="card card--filter">
                    <div class="btn-group">
                        <button class="btn is-active" data-category="all">
                            <span>⚙️ 全部配置</span>
                        </button>
                        <button class="btn" data-category="general">
                            <span>🔧 通用设置</span>
                        </button>
                        <button class="btn" data-category="budget">
                            <span>💰 预算配置</span>
                        </button>
                        <button class="btn" data-category="alert">
                            <span>🔔 告警设置</span>
                        </button>
                        <button class="btn" data-category="api">
                            <span>🔌 API配置</span>
                        </button>
                    </div>
                </div>

                <!-- 配置列表 -->
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">配置列表</h3>
                        <div class="card__actions">
                            <button id="addConfigBtn" class="btn btn--primary btn--sm">
                                + 添加配置
                            </button>
                        </div>
                    </div>

                    <div id="configList" class="card__body">
                        <!-- 配置项将通过 JavaScript 动态生成 -->
                    </div>
                </div>
            </div>

            <!-- 添加/编辑配置弹窗 -->
            <div id="configModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">添加配置</h3>
                        <button class="modal-close" id="closeModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="configForm">
                            <div class="form-group">
                                <label class="form-label">配置键 <span class="required">*</span></label>
                                <input type="text" id="configKey" class="form-control" placeholder="如: max_upload_size" required>
                                <small class="form-hint">唯一标识，只能包含字母、数字和下划线</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label">配置值 <span class="required">*</span></label>
                                <input type="text" id="configValue" class="form-control" placeholder="配置值" required>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">配置类型 <span class="required">*</span></label>
                                    <select id="configType" class="form-control" required>
                                        <option value="string">字符串</option>
                                        <option value="number">数字</option>
                                        <option value="boolean">布尔值</option>
                                        <option value="json">JSON</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">配置分类 <span class="required">*</span></label>
                                    <select id="configCategory" class="form-control" required>
                                        <option value="general">通用设置</option>
                                        <option value="budget">预算配置</option>
                                        <option value="alert">告警设置</option>
                                        <option value="api">API配置</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">配置说明</label>
                                <textarea id="configDescription" class="form-control" rows="3" placeholder="描述此配置的作用"></textarea>
                            </div>

                            <div class="form-group">
                                <label class="form-checkbox">
                                    <input type="checkbox" id="configEditable" checked>
                                    <span>允许编辑</span>
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn--secondary" id="cancelBtn">取消</button>
                        <button type="button" class="btn btn--primary" id="saveConfigBtn">保存</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 分类筛选
        document.querySelectorAll('.btn[data-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleCategoryChange(btn.dataset.category);
            });
        });

        // 添加配置
        document.getElementById('addConfigBtn').addEventListener('click', () => {
            this.openAddModal();
        });

        // 关闭弹窗
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // 保存配置
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            this.saveConfig();
        });

        // 点击弹窗外部关闭
        document.getElementById('configModal').addEventListener('click', (e) => {
            if (e.target.id === 'configModal') {
                this.closeModal();
            }
        });
    }

    /**
     * 加载配置数据
     */
    async loadConfigs() {
        try {
            this.showLoading();

            const response = await API.get('/config');

            if (response.success) {
                this.configs = response.data;
                this.extractCategories();
                this.renderConfigList();
            } else {
                this.showError('加载配置失败: ' + response.error);
            }

            this.hideLoading();
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showError('加载配置失败: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * 提取分类列表
     */
    extractCategories() {
        const categories = new Set(this.configs.map(c => c.category || 'general'));
        this.categories = Array.from(categories);
    }

    /**
     * 处理分类变化
     */
    handleCategoryChange(category) {
        this.currentCategory = category;

        // 更新按钮状态
        document.querySelectorAll('.btn[data-category]').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.category === category);
        });

        this.renderConfigList();
    }

    /**
     * 渲染配置列表
     */
    renderConfigList() {
        const container = document.getElementById('configList');

        // 筛选配置
        let filteredConfigs = this.configs;
        if (this.currentCategory !== 'all') {
            filteredConfigs = this.configs.filter(c => c.category === this.currentCategory);
        }

        if (filteredConfigs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>暂无配置项</p>
                </div>
            `;
            return;
        }

        // 按分类分组
        const grouped = {};
        filteredConfigs.forEach(config => {
            const category = config.category || 'general';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(config);
        });

        // 渲染
        let html = '';
        for (const [category, configs] of Object.entries(grouped)) {
            const categoryNames = {
                'general': '通用设置',
                'budget': '预算配置',
                'alert': '告警设置',
                'api': 'API配置'
            };

            html += `
                <div class="config-category">
                    <h4 class="category-title">${categoryNames[category] || category}</h4>
                    <div class="config-items">
            `;

            configs.forEach(config => {
                html += `
                    <div class="config-item" data-id="${config.id}">
                        <div class="config-header">
                            <div class="config-key">${this.escapeHtml(config.config_key)}</div>
                            <div class="config-actions">
                                ${config.is_editable ? `
                                    <button class="btn-icon btn-edit" onclick="window.app.currentReportInstance.editConfig('${config.config_key}')" title="编辑">
                                        <i class="icon-edit"></i>
                                    </button>
                                    <button class="btn-icon btn-delete" onclick="window.app.currentReportInstance.deleteConfig('${config.config_key}')" title="删除">
                                        <i class="icon-delete"></i>
                                    </button>
                                ` : `
                                    <span class="badge-readonly">只读</span>
                                `}
                            </div>
                        </div>
                        <div class="config-value">
                            <span class="value-label">值:</span>
                            <span class="value-text">${this.formatValue(config.config_value, config.config_type)}</span>
                            <span class="value-type">${this.getTypeLabel(config.config_type)}</span>
                        </div>
                        ${config.description ? `
                            <div class="config-description">
                                <span class="description-icon">💡</span>
                                ${this.escapeHtml(config.description)}
                            </div>
                        ` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * 格式化配置值显示
     */
    formatValue(value, type) {
        if (value === null || value === undefined || value === '') {
            return '<span class="empty-value">(未设置)</span>';
        }

        if (type === 'boolean') {
            return value ? '<span class="badge-true">是</span>' : '<span class="badge-false">否</span>';
        } else if (type === 'json') {
            try {
                const obj = typeof value === 'string' ? JSON.parse(value) : value;
                return `<code class="json-value">${JSON.stringify(obj, null, 2)}</code>`;
            } catch (e) {
                return this.escapeHtml(String(value));
            }
        } else if (type === 'number') {
            return `<span class="number-value">${Number(value).toLocaleString()}</span>`;
        } else {
            return this.escapeHtml(String(value));
        }
    }

    /**
     * 获取类型标签
     */
    getTypeLabel(type) {
        const labels = {
            'string': '字符串',
            'number': '数字',
            'boolean': '布尔值',
            'json': 'JSON'
        };
        return labels[type] || type;
    }

    /**
     * 打开添加弹窗
     */
    openAddModal() {
        this.editingConfig = null;
        document.getElementById('modalTitle').textContent = '添加配置';
        document.getElementById('configForm').reset();
        document.getElementById('configKey').disabled = false;
        document.getElementById('configModal').style.display = 'block';
    }

    /**
     * 编辑配置
     */
    async editConfig(configKey) {
        try {
            const response = await API.get(`/config/${configKey}`);

            if (response.success) {
                const config = response.data;
                this.editingConfig = config;

                document.getElementById('modalTitle').textContent = '编辑配置';
                document.getElementById('configKey').value = config.config_key;
                document.getElementById('configKey').disabled = true;
                document.getElementById('configValue').value = this.valueToString(config.config_value, config.config_type);
                document.getElementById('configType').value = config.config_type;
                document.getElementById('configCategory').value = config.category || 'general';
                document.getElementById('configDescription').value = config.description || '';
                document.getElementById('configEditable').checked = config.is_editable;

                document.getElementById('configModal').style.display = 'block';
            } else {
                this.showError('获取配置失败: ' + response.error);
            }
        } catch (error) {
            console.error('获取配置失败:', error);
            this.showError('获取配置失败: ' + error.message);
        }
    }

    /**
     * 删除配置
     */
    async deleteConfig(configKey) {
        if (!confirm('确定要删除此配置吗？')) {
            return;
        }

        try {
            const response = await API.delete(`/config/${configKey}`);

            if (response.success) {
                this.showSuccess('配置删除成功');
                await this.loadConfigs();
            } else {
                this.showError('删除失败: ' + response.error);
            }
        } catch (error) {
            console.error('删除配置失败:', error);
            this.showError('删除失败: ' + error.message);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        const configKey = document.getElementById('configKey').value.trim();
        const configValue = document.getElementById('configValue').value.trim();
        const configType = document.getElementById('configType').value;
        const configCategory = document.getElementById('configCategory').value;
        const configDescription = document.getElementById('configDescription').value.trim();
        const configEditable = document.getElementById('configEditable').checked;

        if (!configKey || !configValue) {
            this.showError('配置键和配置值不能为空');
            return;
        }

        try {
            const data = {
                config_key: configKey,
                config_value: configValue,
                config_type: configType,
                category: configCategory,
                description: configDescription,
                is_editable: configEditable
            };

            let response;
            if (this.editingConfig) {
                // 更新
                response = await API.put(`/config/${configKey}`, {
                    config_value: configValue,
                    config_type: configType,
                    category: configCategory,
                    description: configDescription
                });
            } else {
                // 创建
                response = await API.post('/config', data);
            }

            if (response.success) {
                this.showSuccess(this.editingConfig ? '配置更新成功' : '配置创建成功');
                this.closeModal();
                await this.loadConfigs();
            } else {
                this.showError('保存失败: ' + response.error);
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    /**
     * 关闭弹窗
     */
    closeModal() {
        document.getElementById('configModal').style.display = 'none';
        this.editingConfig = null;
    }

    /**
     * 将值转换为字符串
     */
    valueToString(value, type) {
        if (value === null || value === undefined) {
            return '';
        }
        if (type === 'json') {
            return typeof value === 'string' ? value : JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const container = document.getElementById('configList');
        if (container) {
            container.innerHTML = '<div class="loading">加载中...</div>';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // Loading state is replaced by renderConfigList
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        alert(message); // 可以改用更友好的提示
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        alert('错误: ' + message); // 可以改用更友好的提示
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 清理工作
        this.configs = [];
        this.editingConfig = null;
    }
}

// 导出到全局
window.ConfigManagement = ConfigManagement;
