/**
 * 省心投 BI - API请求封装
 */

class API {
    /**
     * 发送GET请求
     * @param {string} endpoint - API端点
     * @param {Object} params - 查询参数
     * @returns {Promise}
     */
    static async get(endpoint, params = {}) {
        try {
            const url = new URL(window.getAPIUrl(endpoint));
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GET请求失败:', error);
            throw error;
        }
    }

    /**
     * 发送POST请求
     * @param {string} endpoint - API端点
     * @param {Object} data - 请求数据
     * @returns {Promise}
     */
    static async post(endpoint, data = {}) {
        try {
            const response = await fetch(window.getAPIUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('POST请求失败:', error);
            throw error;
        }
    }

    /**
     * 发送PUT请求
     * @param {string} endpoint - API端点
     * @param {Object} data - 请求数据
     * @returns {Promise}
     */
    static async put(endpoint, data = {}) {
        try {
            const response = await fetch(window.getAPIUrl(endpoint), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('PUT请求失败:', error);
            throw error;
        }
    }

    /**
     * 发送DELETE请求
     * @param {string} endpoint - API端点
     * @returns {Promise}
     */
    static async delete(endpoint) {
        try {
            const response = await fetch(window.getAPIUrl(endpoint), {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('DELETE请求失败:', error);
            throw error;
        }
    }

    /**
     * 上传文件（内部方法）
     * @param {string} endpoint - API端点
     * @param {FormData} formData - 表单数据
     * @returns {Promise}
     * @private
     */
    static async _uploadFormData(endpoint, formData) {
        try {
            const response = await fetch(window.getAPIUrl(endpoint), {
                method: 'POST',
                body: formData
                // 不设置Content-Type，让浏览器自动设置（包含boundary）
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('文件上传失败:', error);
            throw error;
        }
    }

    /**
     * 获取元数据
     * @returns {Promise}
     */
    static async getMetadata() {
        const response = await this.get('/metadata');
        // 如果响应包含 success 和 data 字段，提取 data
        if (response && response.success && response.data) {
            return response.data;
        }
        // 否则返回整个响应（向后兼容）
        return response;
    }

    /**
     * 查询数据
     * @param {Object} query - 查询参数
     * @returns {Promise}
     */
    static async queryData(query) {
        return this.post('/query', query);
    }

    /**
     * 获取汇总数据
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getSummary(filters) {
        return this.post('/summary', { filters });
    }

    /**
     * 获取趋势数据
     * @param {Object} filters - 筛选条件
     * @param {Array} metrics - 指标列表
     * @returns {Promise}
     */
    static async getTrend(filters, metrics) {
        return this.post('/trend', { filters, metrics });
    }

    /**
     * 获取数据概览报表的账号列表
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getDashboardAccounts(filters = {}) {
        return this.post('/dashboard/accounts', { filters });
    }

    /**
     * 上传数据文件
     * @param {File} file - 文件对象
     * @param {boolean} autoProcess - 是否自动处理
     * @returns {Promise}
     */
    static async uploadFile(file, autoProcess = false) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('auto_process', autoProcess);

        return this._uploadFormData('/upload', formData);
    }

    /**
     * 获取处理状态
     * @param {string} taskId - 任务ID
     * @returns {Promise}
     */
    static async getTaskStatus(taskId) {
        return this.get(`/status/${taskId}`);
    }

    /**
     * 上传数据文件（带数据类型）
     * @param {FormData} formData - 包含file和data_type的表单数据
     * @returns {Promise}
     */
    static async upload(formData) {
        return this._uploadFormData('/upload', formData);
    }

    /**
     * 获取代理商分析数据
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getAgencyAnalysis(filters) {
        return this.post('/agency-analysis', { filters });
    }

    /**
     * 获取小红书笔记分析数据
     * @param {Object} filters - 筛选条件
     * @param {number} page - 页码
     * @param {number} pageSize - 每页大小
     * @returns {Promise}
     */
    static async getXhsNotesAnalysis(filters, page = 1, pageSize = 50) {
        return this.post('/xhs-notes-analysis', {
            filters,
            page,
            page_size: pageSize
        });
    }

    /**
     * 获取小红书笔记列表
     * @param {Object} filters - 筛选条件
     * @param {number} page - 页码
     * @param {number} pageSize - 每页大小
     * @returns {Promise}
     */
    static async getXhsNotesList(filters, page = 1, pageSize = 50) {
        return this.post('/xhs-notes-list', {
            filters,
            page,
            page_size: pageSize
        });
    }

    /**
     * 获取成本分析数据
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getCostAnalysis(filters) {
        return this.post('/cost-analysis', { filters });
    }

    /**
     * 获取转化漏斗数据
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getConversionFunnel(filters) {
        return this.post('/conversion-funnel', { filters });
    }

    /**
     * 获取外部数据分析
     * @param {Object} filters - 筛选条件
     * @returns {Promise}
     */
    static async getExternalDataAnalysis(filters) {
        return this.post('/external-data-analysis', { filters });
    }

    /**
     * 获取账号代理商映射数据
     * @returns {Promise}
     */
    static async getAccountAgencyMapping() {
        return this.get('/account-agency-mapping');
    }

    /**
     * 创建账号代理商映射
     * @param {Object} data - 映射数据
     * @returns {Promise}
     */
    static async createAccountMapping(data) {
        return this.post('/account-mapping', data);
    }

    /**
     * 更新账号代理商映射
     * @param {string} platform - 平台
     * @param {string} accountId - 账号ID
     * @param {Object} data - 更新数据
     * @returns {Promise}
     */
    static async updateAccountMapping(platform, accountId, data) {
        return this.put(`/account-mapping/${encodeURIComponent(platform)}/${encodeURIComponent(accountId)}`, data);
    }

    /**
     * 删除账号代理商映射
     * @param {string} platform - 平台
     * @param {string} accountId - 账号ID
     * @returns {Promise}
     */
    static async deleteAccountMapping(platform, accountId) {
        return this.delete(`/account-mapping/${encodeURIComponent(platform)}/${encodeURIComponent(accountId)}`);
    }

    /**
     * 通过主账号ID删除账号代理商映射（用于小红书直投）
     * @param {string} platform - 平台
     * @param {string} mainAccountId - 主账号ID
     * @returns {Promise}
     */
    static async deleteAccountMappingByMainAccount(platform, mainAccountId) {
        return this.delete(`/account-mapping/${encodeURIComponent(platform)}/main/${encodeURIComponent(mainAccountId)}`);
    }

    /**
     * 获取所有配置
     * @param {string} category - 配置分类（可选）
     * @returns {Promise}
     */
    static async getConfigs(category = null) {
        const params = category ? { category } : {};
        return this.get('/api/v1/config', params);
    }

    /**
     * 获取单个配置
     * @param {string} configKey - 配置键
     * @returns {Promise}
     */
    static async getConfig(configKey) {
        return this.get(`/api/v1/config/${configKey}`);
    }

    /**
     * 创建配置
     * @param {Object} data - 配置数据
     * @returns {Promise}
     */
    static async createConfig(data) {
        return this.post('/api/v1/config', data);
    }

    /**
     * 更新配置
     * @param {string} configKey - 配置键
     * @param {Object} data - 更新数据
     * @returns {Promise}
     */
    static async updateConfig(configKey, data) {
        return this.put(`/api/v1/config/${configKey}`, data);
    }

    /**
     * 删除配置
     * @param {string} configKey - 配置键
     * @returns {Promise}
     */
    static async deleteConfig(configKey) {
        return this.delete(`/api/v1/config/${configKey}`);
    }

    /**
     * 批量更新配置
     * @param {Array} configs - 配置数组
     * @returns {Promise}
     */
    static async batchUpdateConfigs(configs) {
        return this.put('/api/v1/config/batch', { configs });
    }
}

// 导出
window.API = API;
