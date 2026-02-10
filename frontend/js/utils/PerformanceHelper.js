/**
 * PerformanceHelper - 性能优化工具类
 * Vercel 规则: client-events, performance
 *
 * 功能:
 * - 防抖 (debounce): 延迟函数执行，直到等待时间结束后才执行
 * - 节流 (throttle): 限制函数执行频率，确保指定时间内只执行一次
 * - 优化高频事件处理，提升性能
 *
 * 版本: v1.0
 * 日期: 2026-02-05
 */

class PerformanceHelper {
    /**
     * 防抖函数
     * 延迟执行函数，如果在等待时间内再次调用，则重新计时
     *
     * 使用场景:
     * - 搜索输入框输入事件
     * - 窗口 resize 事件
     * - 自动保存功能
     *
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间（毫秒）
     * @param {boolean} immediate - 是否立即执行（第一次调用时立即执行）
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, wait = 300, immediate = false) {
        if (typeof func !== 'function') {
            console.warn('[PerformanceHelper] debounce: func must be a function');
            return () => {};
        }

        let timeout;
        let result;

        const debounced = function(...args) {
            const context = this;

            const later = function() {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                }
            };

            const callNow = immediate && !timeout;

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) {
                result = func.apply(context, args);
            }

            return result;
        };

        // 添加取消方法
        debounced.cancel = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };

        // 添加立即执行方法
        debounced.flush = function() {
            if (timeout) {
                const context = this;
                const args = arguments;
                clearTimeout(timeout);
                timeout = null;
                func.apply(context, args);
            }
        };

        return debounced;
    }

    /**
     * 节流函数
     * 限制函数执行频率，确保指定时间内只执行一次
     *
     * 使用场景:
     * - 滚动事件处理
     * - 鼠标移动事件
     * - 窗口 resize 事件
     *
     * @param {Function} func - 要执行的函数
     * @param {number} limit - 限制时间（毫秒）
     * @param {Object} options - 配置选项
     * @returns {Function} 节流后的函数
     */
    static throttle(func, limit = 100, options = {}) {
        if (typeof func !== 'function') {
            console.warn('[PerformanceHelper] throttle: func must be a function');
            return () => {};
        }

        let inThrottle;
        let lastFunc;
        let lastRunc;
        let result;

        const {
            leading = true,   // 首次调用是否立即执行
            trailing = true   // 结束后是否最后一次执行
        } = options;

        const throttled = function(...args) {
            const context = this;

            if (inThrottle) {
                return;
            }

            if (leading) {
                result = func.apply(context, args);
                inThrottle = true;

                // 设置重置计时器
                lastFunc = setTimeout(() => {
                    inThrottle = false;
                }, limit);
            } else {
                lastFunc = setTimeout(() => {
                    inThrottle = false;
                    if (trailing) {
                        lastRunc = Date.now();
                        result = func.apply(context, args);
                    }
                }, limit);
            }
        };

        // 添加取消方法
        throttled.cancel = function() {
            clearTimeout(lastFunc);
            clearTimeout(lastRunc);
            inThrottle = false;
        };

        // 添加立即执行方法
        throttled.flush = function() {
            const context = this;
            const args = arguments;

            clearTimeout(lastFunc);
            clearTimeout(lastRunc);

            if (inThrottle && leading) {
                // 如果在节流期间，立即执行并重置
                inThrottle = false;
                func.apply(context, args);
            }
        };

        return throttled;
    }

    /**
     * 请求动画帧节流
     * 使用 requestAnimationFrame 优化节流函数
     * 适用于需要高性能的场景（如滚动、动画）
     *
     * @param {Function} func - 要执行的函数
     * @returns {Function} 节流后的函数
     */
    static throttleByRAF(func) {
        if (typeof func !== 'function') {
            console.warn('[PerformanceHelper] throttleByRAF: func must be a function');
            return () => {};
        }

        let rafId = null;
        let lastArgs = null;

        const throttled = function(...args) {
            lastArgs = args;

            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    func.apply(this, lastArgs);
                    rafId = null;
                    lastArgs = null;
                });
            }
        };

        // 添加取消方法
        throttled.cancel = function() {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
                lastArgs = null;
            }
        };

        return throttled;
    }

    /**
     * 批处理函数
     * 将多次调用合并为一次批量执行
     *
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 批处理后的函数
     */
    static batch(func, wait = 0) {
        if (typeof func !== 'function') {
            console.warn('[PerformanceHelper] batch: func must be a function');
            return () => {};
        }

        let argsQueue = [];
        let timeout = null;

        const batched = function(...args) {
            argsQueue.push(...args);

            if (timeout === null) {
                timeout = setTimeout(() => {
                    func.apply(this, argsQueue);
                    argsQueue = [];
                    timeout = null;
                }, wait);
            }
        };

        // 添加立即执行方法
        batched.flush = function() {
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }

            if (argsQueue.length > 0) {
                func.apply(this, argsQueue);
                argsQueue = [];
            }
        };

        return batched;
    }

    /**
     * 延迟执行函数
     *
     * @param {Function} func - 要执行的函数
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function} 延迟后的函数
     */
    static delay(func, delay = 0) {
        if (typeof func !== 'function') {
            console.warn('[PerformanceHelper] delay: func must be a function');
            return () => {};
        }

        let timeout = null;

        const delayed = function(...args) {
            timeout = setTimeout(() => {
                func.apply(this, args);
                timeout = null;
            }, delay);
        };

        // 添加取消方法
        delayed.cancel = function() {
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }
        };

        return delayed;
    }

    /**
     * 性能测量工具
     * 用于测量函数执行时间
     *
     * @param {Function} func - 要测量的函数
     * @param {string} label - 标签名称
     * @returns {Function} 包装后的函数
     */
    static measure(funcOrLabel, label = 'Performance') {
        // 单参数模式: PerformanceHelper.measure('Label') -> 返回测量对象
        if (typeof funcOrLabel === 'string') {
            const labelText = funcOrLabel;
            const start = performance.now();

            return {
                end: () => {
                    const end = performance.now();
                    console.log(`[${labelText}] Execution time: ${(end - start).toFixed(2)}ms`);
                }
            };
        }

        // 双参数模式: PerformanceHelper.measure(func, 'Label') -> 返回包装函数(向后兼容)
        if (typeof funcOrLabel !== 'function') {
            console.warn('[PerformanceHelper] measure: first arg must be a function or string');
            return () => {};
        }

        return function(...args) {
            const start = performance.now();
            const result = funcOrLabel.apply(this, args);
            const end = performance.now();

            console.log(`[${label}] Execution time: ${(end - start).toFixed(2)}ms`);

            return result;
        };
    }

    /**
     * 创建防抖的搜索处理器
     * 专门为搜索输入框优化的防抖函数
     *
     * @param {Function} searchCallback - 搜索回调函数
     * @param {number} wait - 等待时间（毫秒），默认300ms
     * @returns {Function} 防抖后的搜索处理函数
     */
    static createDebouncedSearch(searchCallback, wait = 300) {
        const debouncedCallback = PerformanceHelper.debounce(searchCallback, wait);

        return function(event) {
            const searchValue = event.target.value;
            debouncedCallback(searchValue);
        };
    }

    /**
     * 创建节流的滚动处理器
     * 专门为滚动事件优化的节流函数
     *
     * @param {Function} scrollCallback - 滚动回调函数
     * @param {number} limit - 限制时间（毫秒），默认100ms
     * @returns {Function} 节流后的滚动处理函数
     */
    static createThrottledScroll(scrollCallback, limit = 100) {
        const throttledCallback = PerformanceHelper.throttle(scrollCallback, limit);

        return function(event) {
            throttledCallback(event);
        };
    }

    /**
     * 监控页面性能指标
     * Vercel 规则: performance
     * 使用 Performance API 收集关键性能指标
     *
     * @returns {Object} 性能指标对象
     */
    static monitorPagePerformance() {
        if (!window.performance || !window.performance.memory) {
            console.warn('[PerformanceHelper] Performance API not supported');
            return null;
        }

        const perfData = window.performance.getEntriesByType('navigation')[0];
        const memoryInfo = window.performance.memory;

        const metrics = {
            // 导航时序指标
            domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart,
            loadComplete: perfData?.loadEventEnd - perfData?.loadEventStart,
            domInteractive: perfData?.domInteractive - perfData?.fetchStart,

            // 资源加载指标
            firstPaint: this._getFirstPaint(),
            firstContentfulPaint: this._getFirstContentfulPaint(),

            // 内存使用指标
            memory: {
                used: memoryInfo?.usedJSHeapSize,
                total: memoryInfo?.totalJSHeapSize,
                limit: memoryInfo?.jsHeapSizeLimit,
                percentage: memoryInfo ? (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit * 100).toFixed(2) : 0
            },

            // 自定义性能指标
            timestamp: Date.now()
        };

        console.log('[PerformanceHelper] Page performance metrics:', metrics);
        return metrics;
    }

    /**
     * 获取首次绘制时间
     * @returns {number} FP时间（毫秒）
     * @private
     */
    static _getFirstPaint() {
        const paintEntries = window.performance.getEntriesByType('paint');
        const fpEntry = paintEntries.find(entry => entry.name === 'first-paint');
        return fpEntry ? fpEntry.startTime : 0;
    }

    /**
     * 获取首次内容绘制时间
     * @returns {number} FCP时间（毫秒）
     * @private
     */
    static _getFirstContentfulPaint() {
        const paintEntries = window.performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : 0;
    }
}

// 导出到全局（确保在其他脚本中可用）
if (typeof window !== 'undefined') {
    window.PerformanceHelper = PerformanceHelper;
}
