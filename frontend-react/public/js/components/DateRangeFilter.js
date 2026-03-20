/**
 * 省心投 BI - 标准日期筛选器组件
 *
 * 功能说明：
 * - 左侧：日期自定义选择的时间区间（开始日期 - 结束日期）
 * - 右侧：快速选择按钮（全部、近7天、近30天、今年以来）
 * - 使用统一的按钮系统和表单组件
 */

class DateRangeFilter {
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.startDateInputId = options.startDateInputId || 'startDate';
        this.endDateInputId = options.endDateInputId || 'endDate';
        this.defaultRange = options.defaultRange || 'all'; // 'all', 7, 30, 'ytd'
        this.onChange = options.onChange || (() => {});

        this.dateButtons = [];
        this.currentRange = this.defaultRange;

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        console.log('初始化标准日期筛选器');

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('找不到容器:', this.containerId);
            return;
        }

        // 创建筛选器组件
        container.innerHTML = this.render();
        this.bindEvents();

        // 设置默认值
        this.setDefaultRange();
    }

    /**
     * 渲染 HTML
     */
    render() {
        return `
            <div class="filter-group" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label class="filter-label">日期范围:</label>

                <!-- 日期选择器容器 -->
                <div class="date-range-selector" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-right: 16px;
                    border-right: 1px solid var(--border-color);
                ">
                    <input
                        type="date"
                        id="${this.startDateInputId}"
                        class="form-control"
                        style="width: 140px;"
                        aria-label="开始日期"
                    >
                    <span style="color: var(--text-secondary); white-space: nowrap;">至</span>
                    <input
                        type="date"
                        id="${this.endDateInputId}"
                        class="form-control"
                        style="width: 140px;"
                        aria-label="结束日期"
                    >
                </div>

                <!-- 快速选择按钮组 -->
                <div class="btn-group">
                    <button class="btn" data-range="all" aria-label="全部日期">
                        全部
                    </button>
                    <button class="btn" data-days="7" aria-label="近7天">
                        近7天
                    </button>
                    <button class="btn" data-days="30" aria-label="近30天">
                        近30天
                    </button>
                    <button class="btn" data-type="ytd" aria-label="今年以来">
                        今年以来
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const container = document.getElementById(this.containerId);

        // 绑定快速选择按钮事件
        container.querySelectorAll('.btn-group .btn').forEach(btn => {
            this.dateButtons.push(btn);

            btn.addEventListener('click', () => {
                this.handleQuickSelect(btn);
            });
        });

        // 绑定日期输入框事件
        const startDateInput = document.getElementById(this.startDateInputId);
        const endDateInput = document.getElementById(this.endDateInputId);

        startDateInput.addEventListener('change', () => {
            this.handleDateInputChange();
        });

        endDateInput.addEventListener('change', () => {
            this.handleDateInputChange();
        });
    }

    /**
     * 设置默认日期范围
     */
    setDefaultRange() {
        // 根据配置的默认范围设置
        switch (this.defaultRange) {
            case 'all':
                // 清空日期输入框
                this.clearDateInputs();
                // 激活"全部"按钮
                this.activateButton('all');
                break;
            case 7:
            case 30:
                this.setDateRange(this.defaultRange);
                // 激活对应按钮
                const btn = this.dateButtons.find(b => b.dataset.days == this.defaultRange);
                if (btn) {
                    this.activateButton(null, btn);
                }
                break;
            case 'ytd':
                this.setDateRangeYTD();
                // 激活"今年以来"按钮
                const ytdBtn = this.dateButtons.find(b => b.dataset.type === 'ytd');
                if (ytdBtn) {
                    this.activateButton(null, ytdBtn);
                }
                break;
            default:
                // 默认"全部"
                this.clearDateInputs();
                this.activateButton('all');
        }

        // 触发回调
        this.onChange(this.getDateRange());
    }

    /**
     * 处理快速选择按钮点击
     */
    handleQuickSelect(clickedBtn) {
        const range = clickedBtn.dataset.range;
        const days = clickedBtn.dataset.days;
        const type = clickedBtn.dataset.type;

        // 激活当前按钮
        this.activateButton(null, clickedBtn);

        // 根据按钮类型设置日期
        if (range === 'all') {
            // 全部：清空日期输入框
            this.clearDateInputs();
            this.currentRange = 'all';
        } else if (days) {
            // 近N天
            this.setDateRange(parseInt(days));
            this.currentRange = parseInt(days);
        } else if (type === 'ytd') {
            // 今年以来
            this.setDateRangeYTD();
            this.currentRange = 'ytd';
        }

        // 触发回调
        this.onChange(this.getDateRange());
    }

    /**
     * 处理日期输入框变化
     */
    handleDateInputChange() {
        // 用户手动修改日期时，移除所有快速按钮的激活状态
        this.dateButtons.forEach(btn => {
            btn.classList.remove('is-active');
        });

        this.currentRange = 'custom';

        // 触发回调
        this.onChange(this.getDateRange());
    }

    /**
     * 设置日期范围（近N天）
     */
    setDateRange(days) {
        const { start, end } = this.getDateRangeByDays(days);

        const startDateInput = document.getElementById(this.startDateInputId);
        const endDateInput = document.getElementById(this.endDateInputId);

        startDateInput.value = this.formatDate(start);
        endDateInput.value = this.formatDate(end);
    }

    /**
     * 设置日期范围（今年以来）
     */
    setDateRangeYTD() {
        const end = new Date();
        const start = new Date(end.getFullYear(), 0, 1); // 当年1月1日

        const startDateInput = document.getElementById(this.startDateInputId);
        const endDateInput = document.getElementById(this.endDateInputId);

        startDateInput.value = this.formatDate(start);
        endDateInput.value = this.formatDate(end);
    }

    /**
     * 清空日期输入框
     */
    clearDateInputs() {
        const startDateInput = document.getElementById(this.startDateInputId);
        const endDateInput = document.getElementById(this.endDateInputId);

        startDateInput.value = '';
        endDateInput.value = '';
    }

    /**
     * 激活指定按钮
     */
    activateButton(range, targetBtn = null) {
        // 移除所有按钮的激活状态
        this.dateButtons.forEach(btn => {
            btn.classList.remove('is-active');
        });

        // 激活目标按钮
        if (targetBtn) {
            targetBtn.classList.add('is-active');
        } else if (range) {
            const btn = this.dateButtons.find(b => {
                if (range === 'all') return b.dataset.range === 'all';
                if (range === 'ytd') return b.dataset.type === 'ytd';
                return b.dataset.days == range;
            });
            if (btn) {
                btn.classList.add('is-active');
            }
        }
    }

    /**
     * 获取日期范围（用于API请求）
     */
    getDateRange() {
        const startDateInput = document.getElementById(this.startDateInputId);
        const endDateInput = document.getElementById(this.endDateInputId);

        const start = startDateInput.value;
        const end = endDateInput.value;

        // 如果选择了"全部"或日期为空，返回 null
        if (this.currentRange === 'all' || !start || !end) {
            return { start: null, end: null, range: 'all' };
        }

        return {
            start: start,
            end: end,
            range: this.currentRange
        };
    }

    /**
     * 获取日期范围对象（近N天）
     */
    getDateRangeByDays(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        return { start, end };
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 重置为默认状态
     */
    reset() {
        this.setDefaultRange();
    }

    /**
     * 销毁组件
     */
    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
        this.dateButtons = [];
    }
}

// 导出
window.DateRangeFilter = DateRangeFilter;
