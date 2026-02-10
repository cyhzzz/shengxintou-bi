/**
 * EventManager - 事件监听器管理器
 * Vercel 规则: client-event-listeners, memory-leaks
 *
 * 功能:
 * - 统一管理事件监听器的绑定、解绑和清理
 * - 防止内存泄漏
 * - 简化组件的事件管理逻辑
 *
 * 版本: v1.0
 * 日期: 2026-02-05
 */

class EventManager {
    constructor() {
        // 存储所有事件监听器
        this.eventListeners = [];
    }

    /**
     * 绑定事件监听器
     * @param {HTMLElement} element - DOM元素
     * @param {string} event - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {boolean|Object} options - 事件选项
     */
    on(element, event, handler, options = false) {
        if (!element || !event || typeof handler !== 'function') {
            console.warn('[EventManager] Invalid event binding:', { element, event, handler, options });
            return;
        }

        element.addEventListener(event, handler, options);

        // 记录监听器以便后续清理
        this.eventListeners.push({
            element,
            event,
            handler,
            options,
            id: this._generateId()
        });
    }

    /**
     * 批量绑定事件监听器
     * @param {Array} bindings - 绑定配置数组
     */
    onBatch(bindings) {
        bindings.forEach(({ element, event, handler, options }) => {
            this.on(element, event, handler, options);
        });
    }

    /**
     * 解绑所有事件监听器
     */
    off() {
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('[EventManager] Error removing event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    /**
     * 解绑特定元素的所有事件
     * @param {HTMLElement} element - DOM元素
     */
    offByElement(element) {
        if (!element) return;

        const beforeCount = this.eventListeners.length;
        this.eventListeners = this.eventListeners.filter(({ element: el }) => {
            if (el === element) {
                try {
                    el.removeEventListener(el.event, el.handler, el.options);
                } catch (error) {
                    console.warn('[EventManager] Error removing event listener:', error);
                }
                return false;
            }
            return true;
        });

        const removedCount = beforeCount - this.eventListeners.length;
        if (removedCount > 0) {
            console.log(`[EventManager] Removed ${removedCount} listeners from element`);
        }
    }

    /**
     * 解绑特定类型的所有事件
     * @param {string} event - 事件类型
     */
    offByEvent(event) {
        if (!event) return;

        const beforeCount = this.eventListeners.length;
        this.eventListeners = this.eventListeners.filter(({ event: evt }) => {
            if (evt === event) {
                try {
                    evt.element.removeEventListener(evt.event, evt.handler, evt.options);
                } catch (error) {
                    console.warn('[EventManager] Error removing event listener:', error);
                }
                return false;
            }
            return true;
        });

        const removedCount = beforeCount - this.eventListeners.length;
        if (removedCount > 0) {
            console.log(`[EventManager] Removed ${removedCount} listeners for event: ${event}`);
        }
    }

    /**
     * 销毁事件管理器，清理所有监听器
     */
    destroy() {
        this.off();
    }

    /**
     * 获取当前监听器数量（用于调试）
     * @returns {number}
     */
    getListenerCount() {
        return this.eventListeners.length;
    }

    /**
     * 获取监听器列表（用于调试）
     * @returns {Array}
     */
    getListeners() {
        return [...this.eventListeners];
    }

    /**
     * 生成唯一ID
     * @private
     */
    _generateId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 导出到全局（确保在其他脚本中可用）
if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
}
