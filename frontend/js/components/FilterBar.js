/**
 * 省心投 BI - 筛选器组件
 */

class FilterBar {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.filters = {
            dateRange: { start: null, end: null },
            platforms: [],
            agencies: [],
            businessModels: []
        };

        // 创建防抖的筛选变化处理函数（500ms延迟）
        this.debouncedFilterChange = PerformanceHelper.debounce(
            () => this._onFilterChangeImmediate(),
            500
        );

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.initDateButtons();
        this.initDateInputs();
        this.initFilters();
        this.bindEvents();
    }

    /**
     * 初始化日期按钮
     */
    initDateButtons() {
        const dateButtons = this.container.querySelectorAll('.date-btn');
        dateButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有激活状态
                dateButtons.forEach(b => b.classList.remove('active'));
                // 添加当前激活状态
                btn.classList.add('active');

                const days = parseInt(btn.getAttribute('data-days'));
                this.setDateRange(days);
            });
        });
    }

    /**
     * 初始化日期输入框
     */
    initDateInputs() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        // 设置默认日期范围（近7天）
        const { start, end } = DateHelper.getDateRange(7);
        startDateInput.value = DateHelper.formatDate(start);
        endDateInput.value = DateHelper.formatDate(end);

        // 更新筛选条件
        this.filters.dateRange = {
            start: startDateInput.value,
            end: endDateInput.value
        };

        // 绑定日期变化事件（不再自动触发查询）
        const onDateChange = () => {
            this.filters.dateRange = {
                start: startDateInput.value,
                end: endDateInput.value
            };

            // 移除日期按钮的激活状态
            const dateButtons = this.container.querySelectorAll('.date-btn');
            dateButtons.forEach(b => b.classList.remove('active'));

            // 不再自动触发查询，需要用户点击查询按钮
        };

        startDateInput.addEventListener('change', onDateChange);
        endDateInput.addEventListener('change', onDateChange);
    }

    /**
     * 初始化筛选器
     */
    initFilters() {
        // 平台和代理商筛选器将在获取元数据后动态生成
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 查询按钮
        const queryBtn = document.getElementById('queryBtn');
        if (queryBtn) {
            queryBtn.addEventListener('click', () => {
                this.triggerFilterChange();
            });
        }

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.reset();
                // 重置后自动触发查询
                this.triggerFilterChange();
            });
        }

        // 监听筛选器变化事件
        this.container.addEventListener('filterChange', () => {
            // 日期按钮和输入框变化时不再自动触发查询
            // 只有点击查询按钮才会触发
        });
    }

    /**
     * 设置日期范围
     * @param {number} days - 天数
     * @param {boolean} triggerQuery - 是否触发查询
     */
    setDateRange(days, triggerQuery = false) {
        const { start, end } = DateHelper.getDateRange(days);

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        startDateInput.value = DateHelper.formatDate(start);
        endDateInput.value = DateHelper.formatDate(end);

        this.filters.dateRange = {
            start: DateHelper.formatDate(start),
            end: DateHelper.formatDate(end)
        };

        // 只有明确指定triggerQuery=true时才触发查询
        if (triggerQuery) {
            this.triggerFilterChange();
        }
    }

    /**
     * 添加平台标签
     * @param {string} platform - 平台名称
     */
    addPlatformTag(platform) {
        if (!this.filters.platforms.includes(platform)) {
            this.filters.platforms.push(platform);
            this.renderPlatformTags();
        }
    }

    /**
     * 移除平台标签
     * @param {string} platform - 平台名称
     */
    removePlatformTag(platform) {
        this.filters.platforms = this.filters.platforms.filter(p => p !== platform);
        this.renderPlatformTags();
    }

    /**
     * 渲染平台标签
     */
    renderPlatformTags() {
        const container = document.getElementById('platformTags');
        if (!container) return;

        if (this.filters.platforms.length === 0) {
            container.innerHTML = '<span class="tag">全部平台</span>';
            return;
        }

        container.innerHTML = this.filters.platforms.map(platform => `
            <span class="tag">
                ${platform}
                <span class="tag-close" data-platform="${platform}">×</span>
            </span>
        `).join('');

        // 绑定删除事件
        container.querySelectorAll('.tag-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                const platform = closeBtn.getAttribute('data-platform');
                this.removePlatformTag(platform);
            });
        });
    }

    /**
     * 添加代理商标签
     * @param {string} agency - 代理商名称
     */
    addAgencyTag(agency) {
        if (!this.filters.agencies.includes(agency)) {
            this.filters.agencies.push(agency);
            this.renderAgencyTags();
        }
    }

    /**
     * 移除代理商标签
     * @param {string} agency - 代理商名称
     */
    removeAgencyTag(agency) {
        this.filters.agencies = this.filters.agencies.filter(a => a !== agency);
        this.renderAgencyTags();
    }

    /**
     * 渲染代理商标签
     */
    renderAgencyTags() {
        const container = document.getElementById('agencyTags');
        if (!container) return;

        if (this.filters.agencies.length === 0) {
            container.innerHTML = '<span class="tag">全部代理商</span>';
            return;
        }

        container.innerHTML = this.filters.agencies.map(agency => `
            <span class="tag">
                ${agency}
                <span class="tag-close" data-agency="${agency}">×</span>
            </span>
        `).join('');

        // 绑定删除事件
        container.querySelectorAll('.tag-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                const agency = closeBtn.getAttribute('data-agency');
                this.removeAgencyTag(agency);
            });
        });
    }

    /**
     * 获取当前筛选条件
     * @returns {Object}
     */
    getFilters() {
        return this.filters;
    }

    /**
     * 重置筛选条件
     */
    reset() {
        this.filters = {
            dateRange: { start: null, end: null },
            platforms: [],
            agencies: [],
            businessModels: []
        };

        // 重置日期范围（不自动触发查询）
        const { start, end } = DateHelper.getDateRange(7);
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        startDateInput.value = DateHelper.formatDate(start);
        endDateInput.value = DateHelper.formatDate(end);

        this.filters.dateRange = {
            start: DateHelper.formatDate(start),
            end: DateHelper.formatDate(end)
        };

        // 重置日期按钮激活状态
        const dateButtons = this.container.querySelectorAll('.date-btn');
        dateButtons.forEach(b => b.classList.remove('active'));
        dateButtons[0].classList.add('active'); // 激活第一个（近7天）

        // 重置标签
        this.renderPlatformTags();
        this.renderAgencyTags();
    }

    /**
     * 筛选条件变化回调（使用防抖）
     */
    onFilterChange() {
        // 使用防抖函数，避免频繁触发
        this.debouncedFilterChange();
    }

    /**
     * 立即执行筛选条件变化（内部方法）
     * @private
     */
    _onFilterChangeImmediate() {
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('filterChange', {
            detail: { filters: this.filters }
        }));
    }

    /**
     * 强制立即触发筛选变化（跳过防抖）
     */
    triggerFilterChange() {
        this._onFilterChangeImmediate();
    }
}

// 导出
window.FilterBar = FilterBar;
