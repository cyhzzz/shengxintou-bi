/**
 * 省心投 BI - 数据格式化工具
 */

class FormatHelper {
    // js-hoist-regexp: 将RegExp提升到模块级别，避免重复创建
    static #NUMBER_FORMAT_REGEX = /\B(?=(\d{3})+(?!\d))/g;

    /**
     * 格式化数字（添加千分位）
     * @param {number} num - 数字
     * @param {number} decimals - 小数位数
     * @returns {string}
     */
    static formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || num === '') {
            return '-';
        }

        // 转换为数字
        const number = typeof num === 'string' ? parseFloat(num) : num;

        if (isNaN(number)) {
            return '-';
        }

        const fixed = number.toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(FormatHelper.#NUMBER_FORMAT_REGEX, ',');

        return parts.join('.');
    }

    /**
     * 格式化金额
     * @param {number} amount - 金额
     * @returns {string}
     */
    static formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '-';
        }

        return '¥' + this.formatNumber(amount, 2);
    }

    /**
     * 格式化百分比
     * @param {number} value - 数值
     * @param {number} decimals - 小数位数
     * @returns {string}
     */
    static formatPercent(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '-';
        }

        return this.formatNumber(value, decimals) + '%';
    }

    /**
     * 格式化趋势
     * @param {number} value - 变化值
     * @returns {Object} {value: string, direction: 'up'|'down'|'flat'}
     */
    static formatTrend(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return { value: '-', direction: 'flat' };
        }

        const formatted = this.formatPercent(Math.abs(value));
        const direction = value > 0 ? 'up' : (value < 0 ? 'down' : 'flat');

        return { value: formatted, direction };
    }

    // js-cache-function-results: 缓存大数字格式化的阈值计算
    static #LARGE_NUMBER_THRESHOLDS = {
        B: 1000000000,
        M: 1000000,
        K: 1000
    };

    /**
     * 格式化大数字（K/M/B）
     * @param {number} num - 数字
     * @returns {string}
     */
    static formatLargeNumber(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '-';
        }

        // js-early-exit: 使用早期退出优化
        if (num >= this.#LARGE_NUMBER_THRESHOLDS.B) {
            return (num / this.#LARGE_NUMBER_THRESHOLDS.B).toFixed(1) + 'B';
        } else if (num >= this.#LARGE_NUMBER_THRESHOLDS.M) {
            return (num / this.#LARGE_NUMBER_THRESHOLDS.M).toFixed(1) + 'M';
        } else if (num >= this.#LARGE_NUMBER_THRESHOLDS.K) {
            return (num / this.#LARGE_NUMBER_THRESHOLDS.K).toFixed(1) + 'K';
        }

        return this.formatNumber(num);
    }

    /**
     * 截断文本
     * @param {string} text - 文本
     * @param {number} maxLength - 最大长度
     * @returns {string}
     */
    static truncateText(text, maxLength = 50) {
        if (!text || text.length <= maxLength) {
            return text;
        }

        return text.substring(0, maxLength) + '...';
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }
}

// 导出
window.FormatHelper = FormatHelper;
