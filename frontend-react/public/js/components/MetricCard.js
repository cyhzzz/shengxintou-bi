/**
 * 省心投 BI - 数据卡片组件
 * 用于展示关键指标（花费、线索、开户数等）
 */

class MetricCard {
    /**
     * 创建数据卡片实例
     * @param {Object} options - 配置选项
     * @param {string} options.title - 指标标题
     * @param {number} options.value - 指标数值
     * @param {number} options.trend - 趋势值（正数表示增长，负数表示下降）
     * @param {string} options.unit - 单位（如：¥、人、%）
     * @param {string} options.icon - 图标（emoji或SVG）
     * @param {string} options.color - 主题颜色（如：primary、success、warning、danger）
     */
    constructor(options = {}) {
        this.title = options.title || '未命名指标';
        this.value = options.value || 0;
        this.trend = options.trend !== undefined ? options.trend : null;
        this.unit = options.unit || '';
        this.prefix = options.prefix || '';
        this.suffix = options.suffix || '';
        this.icon = options.icon || '';
        this.color = options.color || 'primary';
        this.format = options.format || null;

        // 创建DOM元素
        this.element = this.createElement();
    }

    /**
     * 创建DOM元素
     * @returns {HTMLElement} DOM元素
     */
    createElement() {
        const card = document.createElement('div');
        card.className = `metric-card metric-card-${this.color}`;
        card.dataset.metric = this.title;

        const formattedValue = this.formatValue(this.value);
        const formattedTrend = this.formatTrend(this.trend);
        const trendIcon = this.getTrendIcon(this.trend);
        const trendClass = this.getTrendClass(this.trend);

        card.innerHTML = `
            <div class="metric-header">
                <div class="metric-icon">${this.icon}</div>
                <div class="metric-title">${this.title}</div>
            </div>
            <div class="metric-value">${formattedValue}</div>
            ${this.trend !== null ? `
                <div class="metric-trend ${trendClass}">
                    ${trendIcon}
                    <span>${formattedTrend}</span>
                    <span class="trend-label">较上期</span>
                </div>
            ` : ''}
        `;

        return card;
    }

    /**
     * 格式化数值显示
     * @param {number} value - 数值
     * @param {string} unit - 单位
     * @returns {string} 格式化后的字符串
     */
    formatValue(value, unit) {
        if (value === null || value === undefined) {
            return '-';
        }

        // 使用 FormatHelper 格式化
        const unitToUse = unit || this.suffix || this.unit;
        const prefixToUse = this.prefix;

        if (this.format === 'number') {
            const formatted = FormatHelper.formatNumber(value, 2);
            return `${prefixToUse}${formatted}${unitToUse}`;
        }

        // 默认格式化
        const formatted = FormatHelper.formatNumber(value, 2);
        return `${prefixToUse}${formatted}${unitToUse}`;
    }

    /**
     * 格式化趋势值
     * @param {number} trend - 趋势值
     * @returns {string} 格式化后的趋势字符串
     */
    formatTrend(trend) {
        if (trend === null || trend === undefined) {
            return '';
        }

        const percentage = Math.abs(trend).toFixed(1);
        const sign = trend > 0 ? '+' : '';
        return `${sign}${percentage}%`;
    }

    /**
     * 获取趋势图标
     * @param {number} trend - 趋势值
     * @returns {string} 趋势图标
     */
    getTrendIcon(trend) {
        if (trend === null || trend === undefined) {
            return '';
        }

        if (trend > 0) {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 15l-6-6-6 6"/>
            </svg>`;
        } else if (trend < 0) {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
            </svg>`;
        }

        return '';
    }

    /**
     * 获取趋势类名
     * @param {number} trend - 趋势值
     * @returns {string} CSS类名
     */
    getTrendClass(trend) {
        if (trend === null || trend === undefined) {
            return '';
        }

        if (trend > 0) {
            return 'trend-up';
        } else if (trend < 0) {
            return 'trend-down';
        }

        return 'trend-flat';
    }

    /**
     * 更新卡片数据
     * @param {Object} data - 新数据
     */
    update(data) {
        if (data.title !== undefined) this.title = data.title;
        if (data.value !== undefined) this.value = data.value;
        if (data.trend !== undefined) this.trend = data.trend;
        if (data.unit !== undefined) this.unit = data.unit;
        if (data.icon !== undefined) this.icon = data.icon;
        if (data.color !== undefined) this.color = data.color;

        // 重新渲染
        const container = document.querySelector(`[data-metric="${this.title}"]`);
        if (container) {
            container.innerHTML = this.render();
        }
    }

    /**
     * 渲染卡片HTML
     * @returns {string} HTML字符串
     */
    render() {
        const formattedValue = this.formatValue(this.value, this.unit);
        const formattedTrend = this.formatTrend(this.trend);
        const trendIcon = this.getTrendIcon(this.trend);
        const trendClass = this.getTrendClass(this.trend);

        return `
            <div class="metric-card metric-card-${this.color}" data-metric="${this.title}">
                <div class="metric-header">
                    <div class="metric-icon">${this.icon}</div>
                    <div class="metric-title">${this.title}</div>
                </div>
                <div class="metric-value">${formattedValue}</div>
                ${this.trend !== null ? `
                    <div class="metric-trend ${trendClass}">
                        ${trendIcon}
                        <span>${formattedTrend}</span>
                        <span class="trend-label">较上期</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 批量创建多个卡片
     * @param {Array} metrics - 指标数组
     * @returns {string} 所有卡片的HTML
     */
    static renderGrid(metrics) {
        return metrics.map(metric => {
            const card = new MetricCard(metric);
            return card.render();
        }).join('');
    }
}

// 导出到全局
window.MetricCard = MetricCard;
