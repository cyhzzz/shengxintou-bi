/**
 * 省心投 BI - 日期处理工具
 */

class DateHelper {
    // js-cache-function-results: 缓存日期格式化结果（相同日期对象多次调用时）
    static #formatCache = new WeakMap();

    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {Date} date - 日期对象
     * @returns {string}
     */
    static formatDate(date) {
        // 检查缓存
        if (this.#formatCache.has(date)) {
            return this.#formatCache.get(date);
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;

        // 缓存结果
        this.#formatCache.set(date, formatted);
        return formatted;
    }

    /**
     * 解析日期字符串
     * @param {string} dateStr - 日期字符串
     * @returns {Date}
     */
    static parseDate(dateStr) {
        return new Date(dateStr);
    }

    /**
     * 获取几天前的日期
     * @param {number} days - 天数
     * @returns {Date}
     */
    static getDateBefore(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }

    /**
     * 获取日期范围
     * @param {number} days - 天数
     * @returns {Object} {start: Date, end: Date}
     */
    static getDateRange(days) {
        const end = new Date();
        const start = this.getDateBefore(days - 1);
        return { start, end };
    }

    /**
     * 计算两个日期之间的天数差
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @returns {number}
     */
    static daysBetween(startDate, endDate) {
        const oneDay = 24 * 60 * 60 * 1000;
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.round(Math.abs((start - end) / oneDay));
    }

    /**
     * 判断是否是有效的日期范围
     * @param {string} startDate - 开始日期
     * @param {string} endDate - 结束日期
     * @returns {boolean}
     */
    static isValidRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return start <= end;
    }

    /**
     * 获取日期数组（用于图表X轴）
     * @param {string} startDate - 开始日期
     * @param {string} endDate - 结束日期
     * @returns {Array<string>}
     */
    static getDateArray(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // js-combine-iterations: 预分配数组大小，避免动态扩展
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        dates.length = diffDays;

        const current = new Date(start);
        let index = 0;

        while (current <= end) {
            dates[index++] = this.formatDate(current);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }
}

// 导出
window.DateHelper = DateHelper;
