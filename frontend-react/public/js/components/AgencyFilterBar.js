/**
 * 省心投 BI - 代理商分析报表筛选器
 * 独立的筛选器组件，包含平台、业务模式、代理商多选
 */

class AgencyFilterBar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.platformFilter = null;
        this.businessModelFilter = null;
        this.agencyFilter = null;
        this.dateRangeFilter = null;
        this.dateButtons = [];

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('初始化代理商筛选器');

        // 清空容器
        this.container.innerHTML = '';

        // 创建筛选器栏 - 使用统一的卡片系统
        const filterBar = document.createElement('div');
        filterBar.className = 'card card--filter';
        filterBar.style.maxWidth = '1154px';
        filterBar.style.margin = '0 auto';

        // 创建筛选器内容容器 - 使用 flex 布局实现自动换行
        const filterContent = document.createElement('div');
        filterContent.className = 'filter-bar-content';
        filterContent.style.display = 'flex';
        filterContent.style.flexWrap = 'wrap';
        filterContent.style.gap = '16px';
        filterContent.style.alignItems = 'center';

        // 创建平台筛选器
        this.platformFilter = new MultiSelectDropdown({
            id: 'platformFilter',
            label: '平台',
            placeholder: '全部平台',
            options: [],
            onChange: () => this.handleFilterChange()
        });

        // 创建业务模式筛选器
        this.businessModelFilter = new MultiSelectDropdown({
            id: 'businessModelFilter',
            label: '业务模式',
            placeholder: '全部业务模式',
            options: [],
            onChange: () => this.handleFilterChange()
        });

        // 创建代理商筛选器
        this.agencyFilter = new MultiSelectDropdown({
            id: 'agencyFilter',
            label: '代理商',
            placeholder: '全部代理商',
            options: [],
            onChange: () => this.handleFilterChange()
        });

        // 添加到容器
        filterContent.appendChild(this.platformFilter.container);
        filterContent.appendChild(this.businessModelFilter.container);
        filterContent.appendChild(this.agencyFilter.container);

        // 创建日期按钮组（包含快速选择按钮）
        const dateGroup = this.createDateButtons();
        filterContent.appendChild(dateGroup);

        // 创建快速日期选择按钮
        const quickDateGroup = this.createQuickDateButtons();
        filterContent.appendChild(quickDateGroup);

        // 创建操作按钮
        const actionsGroup = this.createActionButtons();
        filterContent.appendChild(actionsGroup);

        filterBar.appendChild(filterContent);
        this.container.appendChild(filterBar);

        // 加载元数据并填充选项
        await this.loadFilterOptions();
    }

    /**
     * 创建日期按钮组
     */
    createDateButtons() {
        const group = document.createElement('div');
        group.className = 'filter-group';
        group.innerHTML = `
            <label class="filter-label">日期范围:</label>
            <div class="btn-group">
                <button class="btn is-active" data-range="all">全部</button>
                <button class="btn" data-range="custom">自定义</button>
            </div>
            <div class="date-range-inputs" style="display: none; gap: 8px; align-items: center; margin-left: 10px;">
                <input type="date" id="agencyStartDate" class="date-input">
                <span>至</span>
                <input type="date" id="agencyEndDate" class="date-input">
            </div>
        `;

        // 设置默认日期范围（最近30天），但默认选择"全部"
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        const startDateInput = group.querySelector('#agencyStartDate');
        const endDateInput = group.querySelector('#agencyEndDate');

        startDateInput.value = startDate.toISOString().split('T')[0];
        endDateInput.value = endDate.toISOString().split('T')[0];

        // 绑定日期按钮事件（不自动触发查询，等待点击查询按钮）
        group.querySelectorAll('.btn').forEach(btn => {
            this.dateButtons.push(btn);
            btn.addEventListener('click', () => {
                // 使用新的统一状态类
                group.querySelectorAll('.btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');

                const range = btn.dataset.range;
                const inputs = group.querySelector('.date-range-inputs');

                if (range === 'all') {
                    inputs.style.display = 'none';
                } else {
                    inputs.style.display = 'inline-flex';
                }

                // 不自动触发查询，等待用户点击"查询"按钮
            });
        });

        // 日期输入框变化也不自动触发查询
        startDateInput.addEventListener('change', () => {
            // 只更新值，不触发查询
        });
        endDateInput.addEventListener('change', () => {
            // 只更新值，不触发查询
        });

        return group;
    }

    /**
     * 创建快速日期选择按钮
     */
    createQuickDateButtons() {
        const group = document.createElement('div');
        group.className = 'filter-group';
        group.innerHTML = `
            <label class="filter-label">快速选择:</label>
            <div class="btn-group">
                <button class="btn quick-date-btn" data-days="7">近7天</button>
                <button class="btn quick-date-btn" data-days="30">近30天</button>
                <button class="btn quick-date-btn" data-type="ytd">今年以来</button>
            </div>
        `;

        // 绑定快速日期按钮事件
        group.querySelectorAll('.quick-date-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = btn.dataset.days;
                const type = btn.dataset.type;

                const endDate = new Date();
                let startDate = new Date();

                if (days) {
                    // 近N天
                    startDate.setDate(endDate.getDate() - parseInt(days));
                } else if (type === 'ytd') {
                    // 今年以来
                    startDate = new Date(endDate.getFullYear(), 0, 1);
                }

                // 设置日期输入框的值
                const startDateInput = document.getElementById('agencyStartDate');
                const endDateInput = document.getElementById('agencyEndDate');

                if (startDateInput && endDateInput) {
                    startDateInput.value = startDate.toISOString().split('T')[0];
                    endDateInput.value = endDate.toISOString().split('T')[0];

                    // 切换到自定义模式
                    this.dateButtons.forEach(b => b.classList.remove('is-active'));
                    this.dateButtons[1].classList.add('is-active'); // 自定义按钮

                    // 显示日期输入框
                    const inputs = this.container.querySelector('.date-range-inputs');
                    if (inputs) {
                        inputs.style.display = 'inline-flex';
                    }

                    // 移除所有快速日期按钮的is-active状态
                    group.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('is-active'));
                    // 为当前点击的按钮添加is-active状态
                    btn.classList.add('is-active');

                    // 自动触发查询
                    this.handleFilterChange();
                }
            });
        });

        return group;
    }

    /**
     * 创建操作按钮
     */
    createActionButtons() {
        const actions = document.createElement('div');
        actions.className = 'filter-actions';
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        actions.style.marginLeft = 'auto'; // 靠右对齐
        actions.innerHTML = `
            <button class="btn btn--primary" id="agencyQueryBtn">
                查询
            </button>
            <button class="btn btn--secondary" id="agencyResetBtn">
                重置
            </button>
        `;

        actions.querySelector('#agencyQueryBtn').addEventListener('click', () => {
            this.handleFilterChange();
        });

        actions.querySelector('#agencyResetBtn').addEventListener('click', () => {
            this.reset();
        });

        return actions;
    }

    /**
     * 加载筛选器选项
     */
    async loadFilterOptions() {
        try {
            const metadata = await API.getMetadata();
            console.log('加载筛选器元数据:', metadata);

            // 保存元数据供后续使用
            this.metadata = metadata;

            // 填充平台选项
            if (metadata.platforms) {
                this.platformFilter.options = metadata.platforms.map(p => ({
                    value: p,
                    label: p
                }));
                // 重新渲染选项
                this.updateFilterOptions(this.platformFilter);
            }

            // 填充业务模式选项
            if (metadata.business_models) {
                this.businessModelFilter.options = metadata.business_models.map(bm => ({
                    value: bm,
                    label: bm
                }));
                this.updateFilterOptions(this.businessModelFilter);
            }

            // 填充代理商选项
            if (metadata.agencies) {
                this.agencyFilter.options = metadata.agencies.map(a => ({
                    value: a,
                    label: a
                }));
                this.updateFilterOptions(this.agencyFilter);
            }

            // 默认全选所有选项，但不自动触发查询
            // 使用 silent=true 静默模式，不触发 onChange
            this.platformFilter.selectAll(true);
            this.businessModelFilter.selectAll(true);
            this.agencyFilter.selectAll(true);

        } catch (error) {
            console.error('加载筛选器选项失败:', error);
        }
    }

    /**
     * 更新筛选器选项
     */
    updateFilterOptions(filter) {
        const optionsContainer = filter.container.querySelector('.multi-select-options');
        optionsContainer.innerHTML = '';

        filter.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'multi-select-option';
            optionDiv.innerHTML = `
                <input type="checkbox" id="${filter.id}_${option.value}" value="${option.value}">
                <label for="${filter.id}_${option.value}">${option.label}</label>
            `;

            const checkbox = optionDiv.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    filter.selectedValues.add(option.value);
                } else {
                    filter.selectedValues.delete(option.value);
                }
                filter.updateDisplay();
                filter.onChange(Array.from(filter.selectedValues));
            });

            optionsContainer.appendChild(optionDiv);
        });
    }

    /**
     * 处理筛选条件变化
     */
    handleFilterChange() {
        const filters = this.getFilters();
        window.dispatchEvent(new CustomEvent('agencyFilterChange', {
            detail: { filters }
        }));
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        const activeDateBtn = this.dateButtons.find(btn => btn.classList.contains('active'));
        const dateRange = activeDateBtn ? activeDateBtn.dataset.range : 'custom';

        const filters = {
            platforms: this.platformFilter.getSelectedValues(),
            business_models: this.businessModelFilter.getSelectedValues(),
            agencies: this.agencyFilter.getSelectedValues()
        };

        // 只有当选择了自定义日期范围时才传日期
        if (dateRange === 'custom') {
            const startDate = document.getElementById('agencyStartDate')?.value;
            const endDate = document.getElementById('agencyEndDate')?.value;
            if (startDate && endDate) {
                filters.date_range = [startDate, endDate];
            }
        }
        // 如果选择"全部"，不传date_range，后端返回所有数据

        return filters;
    }

    /**
     * 重置筛选器
     */
    reset() {
        // 全选所有选项（使用静默模式）
        this.platformFilter.selectAll(true);
        this.businessModelFilter.selectAll(true);
        this.agencyFilter.selectAll(true);

        // 重置日期为默认（全部）
        this.dateButtons.forEach(btn => btn.classList.remove('active'));
        this.dateButtons[0].classList.add('active'); // 默认选全部

        // 清除快速日期按钮的active状态
        this.container.querySelectorAll('.quick-date-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const startDateInput = document.getElementById('agencyStartDate');
        const endDateInput = document.getElementById('agencyEndDate');

        if (startDateInput && endDateInput) {
            // 设置日期输入框为默认值（最近30天），但不显示
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);

            startDateInput.value = startDate.toISOString().split('T')[0];
            endDateInput.value = endDate.toISOString().split('T')[0];

            // 隐藏日期输入框
            startDateInput.parentElement.style.display = 'none';
        }

        // 重置后手动触发一次查询
        this.handleFilterChange();
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.platformFilter) this.platformFilter.destroy();
        if (this.businessModelFilter) this.businessModelFilter.destroy();
        if (this.agencyFilter) this.agencyFilter.destroy();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// 导出
window.AgencyFilterBar = AgencyFilterBar;
