/**
 * 省心投 BI - 账号管理报表
 * 显示各平台广告账号对应的代理商和业务模式映射关系
 * 支持增删改操作
 *
 * v2.0 - 使用 Vaadin Web Components
 */

class AccountManagementReport {
    constructor() {
        this.mappingData = null;
        this.editingId = null; // 当前编辑的记录 {platform, account_id}
        this.vaadinReady = false; // Vaadin 组件加载状态

        this.init();
    }

    /**
     * 初始化报表
     */
    async init() {
        console.log('初始化账号管理报表');

        // 加载 Vaadin 组件
        await this.loadVaadinComponents();

        // 隐藏全局筛选器
        const globalFilterBar = document.getElementById('filterBar');
        if (globalFilterBar) {
            globalFilterBar.style.display = 'none';
        }

        // 隐藏数据卡片区域
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = 'none';
        }

        // 渲染报表
        this.render();

        // 加载映射数据
        await this.loadMappingData();

        // 重新渲染（带数据）
        this.render();
    }

    /**
     * 加载 Vaadin 组件
     */
    async loadVaadinComponents() {
        if (this.vaadinReady) return;

        try {
            // 加载按钮、文本框、下拉框组件
            await window.VaadinLoader.loadComponents(['button', 'textField', 'select', 'item']);
            this.vaadinReady = true;
            console.log('[Vaadin] 账号管理报表组件加载完成');
        } catch (error) {
            console.error('[Vaadin] 组件加载失败:', error);
            // 继续使用原生组件作为降级方案
        }
    }

    /**
     * 加载账号代理商映射数据
     */
    async loadMappingData() {
        try {
            this.showLoading();

            const response = await API.getAccountAgencyMapping();

            if (response.error) {
                throw new Error(response.error);
            }

            this.mappingData = response.data || [];
            console.log('账号映射数据加载成功:', this.mappingData.length, '条记录');

        } catch (error) {
            console.error('加载账号映射数据失败:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
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

        const totalCount = this.mappingData ? this.mappingData.length : 0;
        const useVaadin = this.vaadinReady;

        // 按平台分组的卡片
        const platformCards = this.renderPlatformSections();

        // 按Type B规范: 不使用wrapper容器,直接放置卡片
        container.innerHTML = `
            <!-- 表格头部卡片 -->
            <div class="card card--filter card--full-width">
                <div class="card__header">
                    <h3 class="card__title">账号代理商映射</h3>
                    <div class="card__actions">
                        <span class="stat-label">共 ${totalCount} 个账号</span>
                        ${useVaadin ? `
                        <vaadin-button theme="aura primary" class="add-account-btn">
                            + 添加账号
                        </vaadin-button>
                        ` : `
                        <button class="btn btn--primary btn--sm add-account-btn">
                            + 添加账号
                        </button>
                        `}
                    </div>
                </div>
            </div>

            <!-- 平台分组列表 -->
            ${platformCards}
        `;

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 添加账号按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-account-btn')) {
                this.openAddModal();
            }
        });
    }

    /**
     * 按平台分组渲染映射表
     */
    renderPlatformSections() {
        const useVaadin = this.vaadinReady;

        // 加载状态
        if (!this.mappingData) {
            return `
                <div class="table-loading">
                    <div class="spinner"></div>
                    <p>加载中...</p>
                </div>
            `;
        }

        // 空状态
        if (this.mappingData.length === 0) {
            return `
                <div class="card card--full-width">
                    <div class="card__body">
                        <div class="table-empty">
                            <div class="table-empty-icon">📊</div>
                            <p>暂无映射数据</p>
                            ${useVaadin ? `
                            <vaadin-button theme="aura primary" class="add-account-btn" style="margin-top: 16px;">
                                + 添加第一条映射
                            </vaadin-button>
                            ` : `
                            <button class="btn btn--primary btn--sm add-account-btn" style="margin-top: 16px;">
                                + 添加第一条映射
                            </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        // 按平台分组
        const groupedData = {};
        this.mappingData.forEach(row => {
            const platform = row.platform || '未知平台';
            if (!groupedData[platform]) {
                groupedData[platform] = [];
            }
            groupedData[platform].push(row);
        });

        // 为每个平台创建卡片
        let html = '';
        for (const [platform, accounts] of Object.entries(groupedData)) {
            const platformColor = this.getPlatformColor(platform);
            const platformIcon = this.getPlatformIcon(platform);

            html += `
                <!-- 平台卡片 -->
                <div class="card card--full-width" style="margin-bottom: 20px;">
                    <!-- 平台标题头部 -->
                    <div class="card__header" style="
                        background: ${platformColor.light};
                        border-left: 4px solid ${platformColor.main};
                        padding: 12px 16px;
                    ">
                        <h4 class="card__title" style="
                            color: ${platformColor.main};
                            margin: 0;
                            font-size: 14px;
                            font-weight: 600;
                        ">
                            ${platformIcon} ${platform} <span style="opacity: 0.6;">(${accounts.length} 个账号)</span>
                        </h4>
                    </div>

                    <!-- 账号列表 -->
                    <div class="card__body" style="padding: 0;">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    ${this.renderTableHeader(platform)}
                                </thead>
                                <tbody>
                                    ${this.renderAccountRows(accounts, platform)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    /**
     * 渲染表头
     */
    renderTableHeader(platform) {
        if (platform === '小红书') {
            return `
                <tr>
                    <th>账户名称</th>
                    <th style="width: 250px;">主账号ID</th>
                    <th style="width: 250px;">代理商子账号ID</th>
                    <th>代理商子账户名称</th>
                    <th>账户类型</th>
                    <th style="width: 140px;">操作</th>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <th style="width: 350px;">账号ID</th>
                    <th>账号名称</th>
                    <th>代理商</th>
                    <th>业务模式</th>
                    <th style="width: 140px;">操作</th>
                </tr>
            `;
        }
    }

    /**
     * 渲染账号行
     */
    renderAccountRows(accounts, platform) {
        const useVaadin = this.vaadinReady;

        // 按代理商和业务模式排序
        const sortedAccounts = [...accounts].sort((a, b) => {
            if (a.agency !== b.agency) {
                return a.agency.localeCompare(b.agency);
            }
            if (a.business_model !== b.business_model) {
                return a.business_model.localeCompare(b.business_model);
            }
            return (a.account_id || '').localeCompare(b.account_id || '');
        });

        return sortedAccounts.map(row => {
            if (platform === '小红书') {
                // 小红书：显示账户名称、主账号ID、代理商子账号ID、代理商子账户名称、账户类型
                const accountName = row.account_name || '-';
                const mainAccountId = row.main_account_id || '-';
                const subAccountId = row.account_id || '-';
                const subAccountName = row.sub_account_name || '-';

                // 判断账户类型
                let accountType = '';
                if (!row.account_id && row.main_account_id) {
                    accountType = '<span class="tag tag--primary">品牌主账户</span>';
                } else if (row.account_id && row.main_account_id) {
                    accountType = '<span class="tag tag--success">代理商子账户</span>';
                } else {
                    accountType = '<span class="tag">-</span>';
                }

                return `
                    <tr>
                        <td>${accountName}</td>
                        <td class="table-cell-monospace" style="font-size: 12px;">${mainAccountId}</td>
                        <td class="table-cell-monospace" style="font-size: 12px;">${subAccountId}</td>
                        <td>${subAccountName}</td>
                        <td>${accountType}</td>
                        <td>
                            <div class="table-actions">
                                ${useVaadin ? `
                                <vaadin-button theme="aura" class="btn-edit"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="${row.main_account_id || ''}">
                                    编辑
                                </vaadin-button>
                                <vaadin-button theme="aura error" class="btn-delete"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="${row.main_account_id || ''}">
                                    删除
                                </vaadin-button>
                                ` : `
                                <button class="btn btn--sm btn--ghost btn-edit"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="${row.main_account_id || ''}">
                                    编辑
                                </button>
                                <button class="btn btn--sm btn--ghost is-error btn-delete"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="${row.main_account_id || ''}">
                                    删除
                                </button>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                // 腾讯/抖音：显示账号ID、账号名称、代理商、业务模式
                const accountIdDisplay = this.formatAccountId(row.account_id);
                const accountName = row.account_name || '-';
                const agency = row.agency || '-';
                const businessModel = row.business_model || '-';

                return `
                    <tr>
                        <td class="table-cell-monospace" style="font-size: 12px;">${accountIdDisplay}</td>
                        <td>${accountName}</td>
                        <td><span class="tag">${agency}</span></td>
                        <td><span class="tag tag--primary">${businessModel}</span></td>
                        <td>
                            <div class="table-actions">
                                ${useVaadin ? `
                                <vaadin-button theme="aura" class="btn-edit"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="">
                                    编辑
                                </vaadin-button>
                                <vaadin-button theme="aura error" class="btn-delete"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="">
                                    删除
                                </vaadin-button>
                                ` : `
                                <button class="btn btn--sm btn--ghost btn-edit"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="">
                                    编辑
                                </button>
                                <button class="btn btn--sm btn--ghost is-error btn-delete"
                                        data-platform="${row.platform}"
                                        data-account-id="${row.account_id || ''}"
                                        data-main-account-id="">
                                    删除
                                </button>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    }

    /**
     * 格式化账号ID（去除小数点）
     */
    formatAccountId(accountId) {
        if (!accountId || accountId === '-') {
            return '-';
        }

        // 如果是数字字符串（可能带小数点），转换为整数
        if (!isNaN(accountId)) {
            const num = parseFloat(accountId);
            if (Number.isInteger(num)) {
                return num.toString();
            }
        }

        return accountId;
    }

    /**
     * 格式化账号ID（去除小数点）
     */
    formatAccountId(accountId) {
        if (!accountId || accountId === '-') {
            return '-';
        }

        // 如果是数字字符串（可能带小数点），转换为整数
        if (!isNaN(accountId)) {
            const num = parseFloat(accountId);
            if (Number.isInteger(num)) {
                return num.toString();
            }
        }

        return accountId;
    }

    /**
     * 获取平台颜色
     */
    getPlatformColor(platform) {
        const colors = {
            '腾讯': { main: '#52c41a', light: '#e6f7e6' },
            '小红书': { main: '#f5222d', light: '#fff1f0' },
            '抖音': { main: '#722ed1', light: '#f9f0ff' }
        };
        return colors[platform] || { main: '#999999', light: '#f0f0f0' };
    }

    /**
     * 获取平台图标
     */
    getPlatformIcon(platform) {
        const icons = {
            '腾讯': '🟢',
            '小红书': '🔴',
            '抖音': '🟣'
        };
        return icons[platform] || '⚪';
    }

    /**
     * 打开添加账号模态框
     */
    openAddModal() {
        this.editingId = null;
        this.showModal();
    }

    /**
     * 打开编辑账号模态框
     */
    openEditModal(platform, accountId, mainAccountId = null) {
        this.editingId = { platform, accountId, mainAccountId };

        // 判断是否为小红书直投
        const isDirectInvestment = !accountId || accountId === 'null' || accountId === '';

        // 查找要编辑的记录
        const record = this.mappingData.find(r => {
            if (r.platform !== platform) return false;

            // 如果是直投，通过 main_account_id 匹配
            if (isDirectInvestment) {
                return r.main_account_id === mainAccountId && !r.account_id;
            }

            // 否则通过 account_id 匹配
            return r.account_id === accountId;
        });

        if (!record) {
            console.error('找不到要编辑的记录', { platform, accountId, mainAccountId });
            return;
        }

        this.showModal(record);
    }

    /**
     * 显示模态框
     */
    showModal(record = null) {
        const isEdit = !!record;
        const title = isEdit ? '编辑账号' : '添加账号';
        const isXiaohongshu = record?.platform === '小红书';
        const useVaadin = this.vaadinReady;

        // 创建模态框
        const modalHtml = `
            <div class="modal-overlay" id="accountModal">
                <div class="modal-container">
                    <!-- 头部 -->
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" id="closeModal">&times;</button>
                    </div>

                    <!-- 主体 -->
                    <div class="modal-body">
                        <div id="accountForm">
                            <!-- 平台 -->
                            <div class="form-group">
                                <label class="form-label">平台</label>
                                ${useVaadin ? `
                                <vaadin-select id="formPlatform" theme="aura" ${isEdit ? 'disabled' : ''}>
                                    <vaadin-item value="">请选择平台</vaadin-item>
                                    <vaadin-item value="腾讯" ${record?.platform === '腾讯' ? 'selected' : ''}>腾讯</vaadin-item>
                                    <vaadin-item value="抖音" ${record?.platform === '抖音' ? 'selected' : ''}>抖音</vaadin-item>
                                    <vaadin-item value="小红书" ${record?.platform === '小红书' ? 'selected' : ''}>小红书</vaadin-item>
                                </vaadin-select>
                                ` : `
                                <select class="form-control" id="formPlatform" ${isEdit ? 'disabled' : ''}>
                                    <option value="">请选择平台</option>
                                    <option value="腾讯" ${record?.platform === '腾讯' ? 'selected' : ''}>腾讯</option>
                                    <option value="抖音" ${record?.platform === '抖音' ? 'selected' : ''}>抖音</option>
                                    <option value="小红书" ${record?.platform === '小红书' ? 'selected' : ''}>小红书</option>
                                </select>
                                `}
                            </div>

                            <!-- 账号ID/代理商子账号ID -->
                            <div class="form-group" id="accountIdGroup">
                                <label class="form-label" for="formAccountId">
                                    ${isXiaohongshu ? '代理商子账号ID' : '账号ID'}
                                    ${isXiaohongshu ? '' : '<span class="form-required">*</span>'}
                                </label>
                                ${useVaadin ? `
                                <vaadin-text-field
                                    id="formAccountId"
                                    theme="aura"
                                    value="${record?.account_id || ''}"
                                    ${isEdit ? 'disabled' : ''}
                                    placeholder="${isXiaohongshu ? '代理商子账号ID（直投账号留空）' : '请输入账号ID'}"
                                ></vaadin-text-field>
                                ` : `
                                <input type="text"
                                       class="form-control"
                                       id="formAccountId"
                                       value="${record?.account_id || ''}"
                                       ${!isXiaohongshu && !isEdit ? 'required' : ''}
                                       ${isEdit ? 'disabled' : ''}
                                       placeholder="${isXiaohongshu ? '代理商子账号ID（直投账号留空）' : '请输入账号ID'}">
                                `}
                                ${isEdit ? '<small class="form-hint">账号ID不可修改</small>' : ''}
                            </div>

                            <!-- 账号名称 -->
                            <div class="form-group">
                                <label class="form-label" for="formAccountName">账号名称</label>
                                ${useVaadin ? `
                                <vaadin-text-field
                                    id="formAccountName"
                                    theme="aura"
                                    value="${record?.account_name || ''}"
                                    placeholder="请输入账号名称"
                                ></vaadin-text-field>
                                ` : `
                                <input type="text"
                                       class="form-control"
                                       id="formAccountName"
                                       value="${record?.account_name || ''}"
                                       placeholder="请输入账号名称">
                                `}
                            </div>

                            <!-- 小红书特有字段 -->
                            <div id="xiaohongshuFields" style="display: ${isXiaohongshu ? 'block' : 'none'};">
                                <!-- 主账号ID -->
                                <div class="form-group">
                                    <label class="form-label" for="formMainAccountId">
                                        主账号ID <span class="form-required">*</span>
                                    </label>
                                    ${useVaadin ? `
                                    <vaadin-text-field
                                        id="formMainAccountId"
                                        theme="aura"
                                        value="${record?.main_account_id || ''}"
                                        ${isEdit ? 'disabled' : ''}
                                        placeholder="请输入主账号ID（广告主账户ID）"
                                    ></vaadin-text-field>
                                    ` : `
                                    <input type="text"
                                           class="form-control"
                                           id="formMainAccountId"
                                           value="${record?.main_account_id || ''}"
                                           required
                                           ${isEdit ? 'disabled' : ''}
                                           placeholder="请输入主账号ID（广告主账户ID）">
                                    `}
                                    ${isEdit ? '<small class="form-hint">主账号ID不可修改</small>' : '<small class="form-hint">小红书广告主账户ID</small>'}
                                </div>

                                <!-- 代理商子账户名称 -->
                                <div class="form-group">
                                    <label class="form-label" for="formSubAccountName">代理商子账户名称</label>
                                    ${useVaadin ? `
                                    <vaadin-text-field
                                        id="formSubAccountName"
                                        theme="aura"
                                        value="${record?.sub_account_name || ''}"
                                        placeholder="代理商子账户名称"
                                    ></vaadin-text-field>
                                    ` : `
                                    <input type="text"
                                           class="form-control"
                                           id="formSubAccountName"
                                           value="${record?.sub_account_name || ''}"
                                           placeholder="代理商子账户名称">
                                    `}
                                </div>
                            </div>

                            <!-- 代理商 -->
                            <div class="form-group">
                                <label class="form-label" for="formAgency">代理商</label>
                                ${useVaadin ? `
                                <vaadin-text-field
                                    id="formAgency"
                                    theme="aura"
                                    value="${record?.agency || ''}"
                                    placeholder="请输入代理商名称"
                                ></vaadin-text-field>
                                ` : `
                                <input type="text"
                                       class="form-control"
                                       id="formAgency"
                                       value="${record?.agency || ''}"
                                       placeholder="请输入代理商名称">
                                `}
                            </div>

                            <!-- 业务模式 -->
                            <div class="form-group">
                                <label class="form-label" for="formBusinessModel">业务模式</label>
                                ${useVaadin ? `
                                <vaadin-select id="formBusinessModel" theme="aura">
                                    <vaadin-item value="信息流" ${record?.business_model === '信息流' ? 'selected' : ''}>信息流</vaadin-item>
                                    <vaadin-item value="直播" ${record?.business_model === '直播' ? 'selected' : ''}>直播</vaadin-item>
                                </vaadin-select>
                                ` : `
                                <select class="form-control" id="formBusinessModel">
                                    <option value="信息流" ${record?.business_model === '信息流' ? 'selected' : ''}>信息流</option>
                                    <option value="直播" ${record?.business_model === '直播' ? 'selected' : ''}>直播</option>
                                </select>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- 底部 -->
                    <div class="modal-footer">
                        ${useVaadin ? `
                        <vaadin-button id="cancelBtn" theme="aura secondary">取消</vaadin-button>
                        <vaadin-button id="saveAccountBtn" theme="aura primary">保存</vaadin-button>
                        ` : `
                        <button class="btn btn--secondary" id="cancelBtn">取消</button>
                        <button class="btn btn--primary" id="saveAccountBtn">保存</button>
                        `}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 绑定事件
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveAccountBtn');

        // Vaadin button 使用 click 事件，与原生相同
        cancelBtn.addEventListener('click', () => {
            this.closeModal();
        });

        saveBtn.addEventListener('click', () => {
            this.saveAccount();
        });

        // 点击遮罩层关闭
        document.getElementById('accountModal').addEventListener('click', (e) => {
            if (e.target.id === 'accountModal') {
                this.closeModal();
            }
        });

        // 平台选择变化时动态显示/隐藏小红书字段
        if (!isEdit) {
            const platformSelect = document.getElementById('formPlatform');
            const handleChange = (e) => {
                // 获取值（Vaadin 使用 e.detail.value，原生使用 e.target.value）
                const platform = useVaadin && e.detail ? e.detail.value : e.target.value;
                const xiaohongshuFields = document.getElementById('xiaohongshuFields');
                const accountIdGroup = document.getElementById('accountIdGroup');
                const accountIdLabel = accountIdGroup.querySelector('.form-label');
                const accountIdInput = document.getElementById('formAccountId');

                if (platform === '小红书') {
                    xiaohongshuFields.style.display = 'block';
                    accountIdLabel.innerHTML = '代理商子账号ID';
                    if (useVaadin) {
                        accountIdInput.placeholder = '代理商子账号ID（直投账号留空）';
                    } else {
                        accountIdInput.placeholder = '代理商子账号ID（直投账号留空）';
                        accountIdInput.removeAttribute('required');
                    }
                } else {
                    xiaohongshuFields.style.display = 'none';
                    accountIdLabel.innerHTML = '账号ID <span class="form-required">*</span>';
                    if (useVaadin) {
                        accountIdInput.placeholder = '请输入账号ID';
                    } else {
                        accountIdInput.placeholder = '请输入账号ID';
                        accountIdInput.setAttribute('required', 'required');
                    }
                }
            };

            // Vaadin 使用 value-changed 事件，原生使用 change 事件
            if (useVaadin) {
                platformSelect.addEventListener('value-changed', handleChange);
            } else {
                platformSelect.addEventListener('change', handleChange);
            }
        }
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        const modal = document.getElementById('accountModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * 保存账号
     */
    async saveAccount() {
        const useVaadin = this.vaadinReady;

        // 获取表单值（Vaadin 使用 value 属性）
        const getFormValue = (id) => {
            const el = document.getElementById(id);
            return el ? (useVaadin ? el.value : el.value).trim() : '';
        };

        const platform = getFormValue('formPlatform');
        const accountId = getFormValue('formAccountId');
        const accountName = getFormValue('formAccountName');
        const agency = getFormValue('formAgency');
        const businessModel = getFormValue('formBusinessModel');

        // 小红书特有字段
        let mainAccountId = null;
        let subAccountName = null;

        if (platform === '小红书') {
            mainAccountId = getFormValue('formMainAccountId');
            subAccountName = getFormValue('formSubAccountName');

            // 小红书验证：主账号ID必填
            if (!mainAccountId) {
                alert('请填写主账号ID');
                return;
            }
        } else {
            // 腾讯/抖音验证：账号ID必填
            if (!accountId) {
                alert('请填写账号ID');
                return;
            }
        }

        try {
            if (this.editingId) {
                // 更新
                const updateData = {
                    account_name: accountName,
                    agency,
                    business_model: businessModel
                };

                // 小红书额外字段
                if (platform === '小红书') {
                    updateData.main_account_id = mainAccountId;
                    updateData.sub_account_name = subAccountName;
                }

                const response = await API.updateAccountMapping(
                    this.editingId.platform,
                    this.editingId.accountId,
                    updateData
                );

                console.log('更新请求参数:', {
                    platform: this.editingId.platform,
                    account_id: this.editingId.accountId,
                    updateData: updateData
                });

                if (response.error) {
                    throw new Error(response.error);
                }

                alert('更新成功');
            } else {
                // 创建
                const createData = {
                    platform,
                    account_id: accountId || null,  // 小红书直投时为null
                    account_name: accountName,
                    agency,
                    business_model: businessModel
                };

                // 小红书额外字段
                if (platform === '小红书') {
                    createData.main_account_id = mainAccountId;
                    createData.sub_account_name = subAccountName || null;
                }

                const response = await API.createAccountMapping(createData);

                if (response.error) {
                    throw new Error(response.error);
                }

                alert('添加成功');
            }

            // 关闭模态框
            this.closeModal();

            // 重新加载数据
            await this.loadMappingData();
            this.render();

        } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败: ' + error.message);
        }
    }

    /**
     * 删除账号
     */
    async deleteAccount(platform, accountId, mainAccountId = null) {
        // 构建删除提示信息
        let confirmMsg = '';
        // 判断是否为小红书直投（accountId为null、'null'或空字符串）
        const isDirectInvestment = !accountId || accountId === 'null' || accountId === '';

        if (isDirectInvestment) {
            confirmMsg = `确定要删除 ${platform} 平台的品牌主账户 ${mainAccountId} 吗？`;
        } else {
            confirmMsg = `确定要删除 ${platform} 平台的账号 ${accountId} 吗？`;
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            // 如果是小红书直投，通过 main_account_id 删除
            if (isDirectInvestment) {
                const response = await API.deleteAccountMappingByMainAccount(platform, mainAccountId);

                if (response.error) {
                    throw new Error(response.error);
                }

                alert('删除成功');
            } else {
                // 正常删除
                const response = await API.deleteAccountMapping(platform, accountId);

                if (response.error) {
                    throw new Error(response.error);
                }

                alert('删除成功');
            }

            // 重新加载数据
            await this.loadMappingData();
            this.render();

        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败: ' + error.message);
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const container = document.getElementById('mainContent');
        if (container) {
            const cardBody = container.querySelector('.card__body');
            if (cardBody) {
                cardBody.innerHTML = `
                    <div class="table-loading">
                        <div class="spinner"></div>
                        <p>加载中...</p>
                    </div>
                `;
            }
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // Loading state is replaced by render()
    }

    /**
     * 显示错误
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div class="card">
                    <div class="card__body">
                        <div class="error-state">
                            <div class="error-icon">⚠️</div>
                            <h3>加载失败</h3>
                            <p>${message}</p>
                            <button class="btn btn--primary" onclick="location.reload()">重新加载</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        // 恢复全局筛选器显示
        const globalFilterBar = document.getElementById('filterBar');
        if (globalFilterBar) {
            globalFilterBar.style.display = '';
        }

        // 恢复数据卡片显示
        const metricsContainer = document.getElementById('metricCardsContainer');
        if (metricsContainer) {
            metricsContainer.style.display = '';
        }

        // 移除模态框
        this.closeModal();
    }
}

// 导出到全局
window.AccountManagementReport = AccountManagementReport;

// 事件委托处理编辑和删除按钮
document.addEventListener('click', async (e) => {
    // 使用 closest 查找按钮（处理点击按钮内部元素的情况）
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();

        const platform = editBtn.dataset.platform;
        const accountId = editBtn.dataset.accountId;
        const mainAccountId = editBtn.dataset.mainAccountId;

        console.log('编辑按钮点击:', { platform, accountId, mainAccountId });

        // 找到当前的 AccountManagementReport 实例
        if (window.app && window.app.currentReportInstance instanceof AccountManagementReport) {
            window.app.currentReportInstance.openEditModal(platform, accountId, mainAccountId);
        }
    }

    if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();

        const platform = deleteBtn.dataset.platform;
        const accountId = deleteBtn.dataset.accountId;
        const mainAccountId = deleteBtn.dataset.mainAccountId;

        console.log('删除按钮点击:', { platform, accountId, mainAccountId });

        // 找到当前的 AccountManagementReport 实例
        if (window.app && window.app.currentReportInstance instanceof AccountManagementReport) {
            window.app.currentReportInstance.deleteAccount(platform, accountId, mainAccountId);
        }
    }
});
