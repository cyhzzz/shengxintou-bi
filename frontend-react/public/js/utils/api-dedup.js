/**
 * API 请求去重工具类
 *
 * 功能:
 * 1. 防止重复请求相同端点
 * 2. 缓存请求结果
 * 3. 自动管理缓存生命周期
 *
 * 使用示例:
 * const data = await APIDedup.request('/api/v1/summary', { filters: {} });
 */

class APIDedup {
    static cache = new Map();
    static loading = new Map();
    static cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

    /**
     * 发起去重请求
     * @param {string} endpoint - API端点
     * @param {object} options - 请求选项
     * @param {number} cacheDuration - 缓存时长(毫秒),0表示不缓存
     * @returns {Promise} 请求结果
     */
    static async request(endpoint, options = {}, cacheDuration = null) {
        // 生成缓存键
        const cacheKey = this._generateCacheKey(endpoint, options);

        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < (cacheDuration || this.cacheTimeout)) {
                console.log(`[API Cache] 缓存命中: ${endpoint}`);
                return cached.data;
            } else {
                // 缓存过期,删除
                this.cache.delete(cacheKey);
            }
        }

        // 检查是否正在加载
        if (this.loading.has(cacheKey)) {
            console.log(`[API Cache] 等待正在加载的请求: ${endpoint}`);
            return await this.loading.get(cacheKey);
        }

        // 发起新请求
        console.log(`[API Cache] 发起新请求: ${endpoint}`);
        const promise = this._executeRequest(endpoint, options);

        // 保存加载中的Promise
        this.loading.set(cacheKey, promise);

        try {
            const result = await promise;

            // 缓存结果
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } finally {
            // 清理加载中的Promise
            this.loading.delete(cacheKey);
        }
    }

    /**
     * 执行实际API请求
     * @private
     */
    static async _executeRequest(endpoint, options) {
        // 使用全局API对象
        if (window.API) {
            return await window.API.post(endpoint, options);
        } else {
            throw new Error('API对象未加载');
        }
    }

    /**
     * 生成缓存键
     * @private
     */
    static _generateCacheKey(endpoint, options) {
        const optionsStr = JSON.stringify(options);
        return `${endpoint}:${optionsStr}`;
    }

    /**
     * 清除所有缓存
     */
    static clearCache() {
        this.cache.clear();
        console.log('[API Cache] 已清除所有缓存');
    }

    /**
     * 清除指定端点的缓存
     * @param {string} endpoint - API端点
     */
    static clearEndpoint(endpoint) {
        // 删除所有以该endpoint开头的缓存
        for (const key of this.cache.keys()) {
            if (key.startsWith(endpoint)) {
                this.cache.delete(key);
            }
        }
        console.log(`[API Cache] 已清除端点缓存: ${endpoint}`);
    }

    /**
     * 获取缓存统计
     */
    static getStats() {
        return {
            cached: this.cache.size,
            loading: this.loading.size
        };
    }
}

// 导出到全局
window.APIDedup = APIDedup;
