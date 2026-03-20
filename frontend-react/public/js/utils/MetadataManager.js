/**
 * 省心投 BI - 元数据管理器
 * 统一管理平台、业务模式、代理商等元数据
 * 所有筛选器选项应从此管理器获取
 */

class MetadataManager {
    constructor() {
        this.metadata = {
            platforms: [],
            businessModels: [],
            agencies: [],
            dateRange: {
                min: null,
                max: null
            }
        };
        this.listeners = [];
        this.isLoading = false;
        this.loadPromise = null;
    }

    /**
     * 加载元数据
     * @param {boolean} force - 是否强制重新加载
     * @returns {Promise<Object>}
     */
    async loadMetadata(force = false) {
        // 如果正在加载，返回相同的 Promise
        if (this.isLoading && !force) {
            return this.loadPromise;
        }

        // 如果已经加载过且不强制刷新，直接返回缓存
        if (this.metadata.platforms.length > 0 && !force) {
            return this.metadata;
        }

        this.isLoading = true;
        this.loadPromise = this._fetchMetadata();

        try {
            const data = await this.loadPromise;
            this.metadata = data;
            this._notifyListeners();
            return this.metadata;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    /**
     * 从 API 获取元数据
     * @private
     */
    async _fetchMetadata() {
        try {
            const response = await API.get('/metadata');

            if (response.success && response.data) {
                console.log('元数据加载成功:', response.data);
                return response.data;
            } else {
                console.error('元数据加载失败:', response.message);
                return this._getFallbackMetadata();
            }
        } catch (error) {
            console.error('获取元数据异常:', error);
            return this._getFallbackMetadata();
        }
    }

    /**
     * 获取备用元数据（当 API 调用失败时使用）
     * @private
     */
    _getFallbackMetadata() {
        return {
            platforms: ['腾讯', '抖音', '小红书'],
            business_models: ['直播', '信息流'],
            agencies: ['量子', '众联', '其他'],
            date_range: {
                min: '2024-01-01',
                max: new Date().toISOString().split('T')[0]
            }
        };
    }

    /**
     * 获取平台列表
     * @returns {Array<string>}
     */
    getPlatforms() {
        return this.metadata.platforms || [];
    }

    /**
     * 获取业务模式列表
     * @returns {Array<string>}
     */
    getBusinessModels() {
        return this.metadata.business_models || [];
    }

    /**
     * 获取代理商列表
     * @returns {Array<string>}
     */
    getAgencies() {
        return this.metadata.agencies || [];
    }

    /**
     * 获取日期范围
     * @returns {Object}
     */
    getDateRange() {
        return this.metadata.date_range || { min: null, max: null };
    }

    /**
     * 获取平台选项（用于 MultiSelectDropdown）
     * @returns {Array<Object>}
     */
    getPlatformOptions() {
        return this.getPlatforms().map(p => ({ value: p, label: p }));
    }

    /**
     * 获取业务模式选项（用于 MultiSelectDropdown）
     * @returns {Array<Object>}
     */
    getBusinessModelOptions() {
        return this.getBusinessModels().map(bm => ({ value: bm, label: bm }));
    }

    /**
     * 获取代理商选项（用于 MultiSelectDropdown）
     * @returns {Array<Object>}
     */
    getAgencyOptions() {
        return this.getAgencies().map(a => ({ value: a, label: a }));
    }

    /**
     * 刷新元数据
     * @returns {Promise<Object>}
     */
    async refresh() {
        return this.loadMetadata(true);
    }

    /**
     * 添加监听器
     * @param {Function} callback - 元数据更新时的回调函数
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * 移除监听器
     * @param {Function} callback
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    /**
     * 通知所有监听器
     * @private
     */
    _notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.metadata);
            } catch (error) {
                console.error('元数据监听器回调失败:', error);
            }
        });
    }

    /**
     * 重置元数据（清除缓存）
     */
    reset() {
        this.metadata = {
            platforms: [],
            businessModels: [],
            agencies: [],
            dateRange: {
                min: null,
                max: null
            }
        };
    }
}

// 创建全局单例
const metadataManager = new MetadataManager();

// 导出到全局作用域
window.metadataManager = metadataManager;
