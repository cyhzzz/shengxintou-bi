/**
 * 统一API管理器
 * 封装所有API调用，支持缓存、错误处理
 */
class APIManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;  // 5分钟缓存
        this.pendingRequests = new Map();  // 请求去重
    }

    /**
     * 通用API调用方法
     * @param {string} endpoint - API端点（不含/api/v1前缀）
     * @param {object} data - 请求数据
     * @param {object} options - 配置选项
     * @returns {Promise} API响应
     */
    async request(endpoint, data = {}, options = {}) {
        const {
            method = 'POST',
            useCache = false,
            cacheKey = null,
            timeout = 30000
        } = options;

        // 检查缓存
        if (useCache && cacheKey) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`[APIManager] 使用缓存: ${cacheKey}`);
                return cached.data;
            }
        }

        // 请求去重
        const requestKey = JSON.stringify({ endpoint, data });
        if (this.pendingRequests.has(requestKey)) {
            console.log(`[APIManager] 请求去重: ${endpoint}`);
            return this.pendingRequests.get(requestKey);
        }

        // 发送请求
        const requestPromise = this._makeRequest(endpoint, data, method, timeout)
            .then(response => {
                // 缓存结果
                if (useCache && cacheKey && response.success) {
                    this.cache.set(cacheKey, {
                        data: response,
                        timestamp: Date.now()
                    });
                }
                return response;
            })
            .finally(() => {
                this.pendingRequests.delete(requestKey);
            });

        this.pendingRequests.set(requestKey, requestPromise);
        return requestPromise;
    }

    /**
     * 发送HTTP请求
     * @private
     */
    async _makeRequest(endpoint, data, method, timeout) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`/api/v1/${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: method === 'POST' ? JSON.stringify(data) : undefined,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || '请求失败');
            }

            return result;

        } catch (error) {
            console.error(`[APIManager] API请求失败: ${endpoint}`, error);
            throw error;
        }
    }

    // ==================== 跨渠道对比API ====================

    /**
     * 获取各平台汇总数据
     */
    async getCrossChannelSummary(filters) {
        return this.request(
            'cross-channel-comparison/summary',
            { filters },
            { useCache: true, cacheKey: `cross_channel_summary_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取跨渠道趋势数据
     */
    async getCrossChannelTrend(filters, metric) {
        return this.request(
            'cross-channel-comparison/trend',
            { filters, metric },
            { useCache: true, cacheKey: `cross_channel_trend_${metric}_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取跨渠道漏斗对比
     */
    async getCrossChannelFunnel(filters) {
        return this.request(
            'cross-channel-comparison/funnel',
            { filters },
            { useCache: true, cacheKey: `cross_channel_funnel_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取平台×业务模式×代理商矩阵
     */
    async getCrossChannelMatrix(filters, metric) {
        return this.request(
            'cross-channel-comparison/matrix',
            { filters, metric },
            { useCache: true, cacheKey: `cross_channel_matrix_${metric}_${JSON.stringify(filters)}` }
        );
    }

    // ==================== 素材效果分析API ====================

    /**
     * 获取素材列表
     */
    async getMaterialList(filters, page = 1, pageSize = 20, sortBy = 'overall_score') {
        return this.request(
            'material-effectiveness/list',
            { filters, page, page_size: pageSize, sort_by: sortBy },
            { useCache: false }  // 列表不缓存
        );
    }

    /**
     * 获取素材详情
     */
    async getMaterialDetail(noteId, filters = {}) {
        return this.request(
            'material-effectiveness/detail',
            { note_id: noteId, filters },
            { useCache: true, cacheKey: `material_detail_${noteId}` }
        );
    }

    /**
     * 获取散点图数据
     */
    async getMaterialScatterData(filters, xAxis, yAxis) {
        return this.request(
            'material-effectiveness/scatter',
            { filters, x_axis: xAxis, y_axis: yAxis },
            { useCache: true, cacheKey: `material_scatter_${xAxis}_${yAxis}_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取素材评分分布
     */
    async getMaterialScoreDistribution(filters) {
        return this.request(
            'material-effectiveness/score-distribution',
            { filters },
            { useCache: true, cacheKey: `material_score_dist_${JSON.stringify(filters)}` }
        );
    }

    // ==================== 可视化转化漏斗API ====================

    /**
     * 获取7层漏斗数据
     */
    async getConversionFunnel(filters, compareBy = 'all') {
        return this.request(
            'conversion-funnel-enhanced/funnel',
            { filters, compare_by: compareBy },
            { useCache: true, cacheKey: `conversion_funnel_${compareBy}_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取转化率趋势
     */
    async getConversionTrend(filters, stages) {
        return this.request(
            'conversion-funnel-enhanced/trend',
            { filters, stages },
            { useCache: true, cacheKey: `conversion_trend_${JSON.stringify(filters)}` }
        );
    }

    /**
     * 获取流失分析
     */
    async getConversionLossAnalysis(filters) {
        return this.request(
            'conversion-funnel-enhanced/loss-analysis',
            { filters },
            { useCache: true, cacheKey: `conversion_loss_${JSON.stringify(filters)}` }
        );
    }

    // ==================== UpdateManager API ====================

    /**
     * 获取当前版本
     */
    async getCurrentVersion() {
        return this.request('update/version', {});
    }

    /**
     * 检查更新
     */
    async checkUpdate() {
        return this.request('update/check', {}, { useCache: false });
    }

    /**
     * 下载更新包
     */
    async downloadUpdate(version) {
        return this.request('update/download', { version }, { timeout: 60000 });
    }

    /**
     * 备份当前版本
     */
    async backupCurrentVersion() {
        return this.request('update/backup', {}, { timeout: 60000 });
    }

    /**
     * 安装更新
     */
    async installUpdate(version) {
        return this.request('update/install', { version }, { timeout: 60000 });
    }

    /**
     * 回滚到备份版本
     */
    async rollbackUpdate(backupPath) {
        return this.request('update/rollback', { backup_path: backupPath });
    }

    /**
     * 列出所有备份
     */
    async listBackups() {
        return this.request('update/backups', {});
    }

    // ==================== 缓存管理 ====================

    /**
     * 清除缓存
     * @param {string} cacheKey - 缓存键，不传则清除所有缓存
     */
    clearCache(cacheKey) {
        if (cacheKey) {
            this.cache.delete(cacheKey);
            console.log(`[APIManager] 清除缓存: ${cacheKey}`);
        } else {
            this.cache.clear();
            console.log('[APIManager] 清除所有缓存');
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        const stats = {
            total: this.cache.size,
            expired: 0,
            active: 0
        };

        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= this.cacheTimeout) {
                stats.expired++;
            } else {
                stats.active++;
            }
        }

        return stats;
    }
}

// 全局单例
window.APIManager = new APIManager();
