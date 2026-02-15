/**
 * 数据加载器
 * 并行加载多个数据源
 */
class DataLoader {
    constructor() {
        this.loadQueue = [];
    }

    /**
     * 并行加载多个数据
     * @param {Array} requests - 请求数组，每个元素包含name和requestFn
     * @returns {Promise<{success: Array, failed: Array, allSuccess: boolean}>}
     */
    async loadAll(requests) {
        console.log(`[DataLoader] 开始并行加载 ${requests.length} 个数据源`);

        const promises = requests.map(req => this.loadOne(req));
        const results = await Promise.allSettled(promises);

        const success = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);

        if (failed.length > 0) {
            console.error('[DataLoader] 部分请求失败:', failed);
        }

        console.log(`[DataLoader] 加载完成: 成功 ${success.length}/${requests.length}`);

        return {
            success,
            failed,
            allSuccess: failed.length === 0
        };
    }

    /**
     * 加载单个数据
     * @param {Object} request - 请求对象
     * @returns {Promise<{name: string, data: any}>}
     * @private
     */
    async loadOne({ name, requestFn, retryCount = 0 }) {
        try {
            const startTime = PerformanceHelper ? PerformanceHelper.now() : Date.now();
            const data = await requestFn();
            const endTime = PerformanceHelper ? PerformanceHelper.now() : Date.now();

            const duration = endTime - startTime;
            console.log(`[DataLoader] ${name} 加载完成: ${duration.toFixed(2)}ms`);

            return { name, data };
        } catch (error) {
            console.error(`[DataLoader] ${name} 加载失败:`, error);

            // 自动重试
            if (retryCount < 2) {
                console.log(`[DataLoader] ${name} 重试 (${retryCount + 1}/2)...`);
                await this.sleep(1000);
                return this.loadOne({ name, requestFn, retryCount: retryCount + 1 });
            }

            throw error;
        }
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     * @private
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 全局单例
window.DataLoader = new DataLoader();
