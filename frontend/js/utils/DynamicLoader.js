/**
 * 动态加载器 - 按需加载 JS 模块
 * Vercel 规则: bundle-dynamic-imports
 *
 * 功能:
 * - 动态加载报表组件，减少初始加载量
 * - ECharts 按需加载
 * - 预加载关键资源
 *
 * 版本: v1.0
 * 日期: 2026-02-05
 */

class DynamicLoader {
    // 已加载模块缓存
    static loadedModules = new Map();

    // 正在加载的 Promise
    static loadingPromises = new Map();

    /**
     * 动态加载脚本
     * @param {string} src - 脚本路径
     * @returns {Promise<void>}
     */
    static async loadScript(src) {
        // 如果已加载，直接返回
        if (this.loadedModules.has(src)) {
            console.log(`[DynamicLoader] Module already loaded: ${src}`);
            return Promise.resolve();
        }

        // 如果正在加载，返回现有 Promise
        if (this.loadingPromises.has(src)) {
            console.log(`[DynamicLoader] Module already loading: ${src}`);
            return this.loadingPromises.get(src);
        }

        console.log(`[DynamicLoader] Loading module: ${src}`);

        // 创建加载 Promise
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;

            script.onload = () => {
                console.log(`[DynamicLoader] Module loaded successfully: ${src}`);
                this.loadedModules.set(src, true);
                this.loadingPromises.delete(src);
                resolve();
            };

            script.onerror = () => {
                console.error(`[DynamicLoader] Failed to load module: ${src}`);
                this.loadingPromises.delete(src);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });

        this.loadingPromises.set(src, promise);
        return promise;
    }

    /**
     * 动态加载报表组件
     * @param {string} reportId - 报表ID
     * @returns {Promise<Class>} 报表类
     */
    static async loadReport(reportId) {
        console.log(`[DynamicLoader] Loading report: ${reportId}`);

        const scriptPath = this.getReportScriptPath(reportId);
        if (!scriptPath) {
            throw new Error(`Unknown report ID: ${reportId}`);
        }

        // 特殊处理：report-generation 需要先加载 WeeklyReportTemplate
        if (reportId === 'report-generation') {
            await this.loadScript('js/templates/WeeklyReportTemplate.js');
        }

        // 加载脚本
        await this.loadScript(scriptPath);

        // 获取报表类名
        const className = this.getReportClassName(reportId);

        // 验证类是否存在
        if (typeof window[className] === 'undefined') {
            throw new Error(`Report class not found: ${className}. Check if ${scriptPath} defines it.`);
        }

        console.log(`[DynamicLoader] Report loaded successfully: ${reportId} (${className})`);
        return window[className];
    }

    /**
     * 获取报表脚本路径
     * @param {string} reportId - 报表ID
     * @returns {string} 脚本路径
     */
    static getReportScriptPath(reportId) {
        const reportMap = {
            // 核心报表
            'dashboard': 'js/reports/DashboardReport.js',
            'agency-analysis': 'js/reports/AgencyAnalysisReport.js',

            // 配置管理
            'account-management': 'js/reports/AccountManagementReport.js',
            'abbreviation-management': 'js/components/AbbreviationManagement.js',
            'database-backup': 'js/components/DatabaseBackup.js',
            'data-import': 'js/components/DataImport.js',

            // 小红书报表
            'xhs-notes-list': 'js/reports/XhsNotesListReport.js',
            'xhs-notes-operation': 'js/reports/XhsNotesOperationReport.js',  // 单文件版本

            // 其他报表
            'leads-detail': 'js/reports/LeadsDetailReport.js',
            'cost-analysis': 'js/reports/CostAnalysisReport.js',
            'conversion-funnel': 'js/reports/ConversionFunnelReport.js',
            'external-data': 'js/reports/ExternalDataAnalysisReport.js',

            // 报告生成
            'report-generation': 'js/components/WeeklyReportGenerator.js'
        };

        const path = reportMap[reportId];
        if (!path) {
            console.warn(`[DynamicLoader] No script path for report: ${reportId}`);
        }
        return path;
    }

    /**
     * 获取报表类名
     * @param {string} reportId - 报表ID
     * @returns {string} 类名
     */
    static getReportClassName(reportId) {
        const classNameMap = {
            'dashboard': 'DashboardReport',
            'agency-analysis': 'AgencyAnalysisReport',
            'account-management': 'AccountManagementReport',
            'abbreviation-management': 'AbbreviationManagement',
            'database-backup': 'DatabaseBackup',
            'data-import': 'DataImport',
            'xhs-notes-list': 'XhsNotesListReport',
            'xhs-notes-operation': 'XhsNotesOperationReport',  // v2.0: 类名保持不变，向后兼容
            'leads-detail': 'LeadsDetailReport',
            'cost-analysis': 'CostAnalysisReport',
            'conversion-funnel': 'ConversionFunnelReport',
            'external-data': 'ExternalDataAnalysisReport',
            'report-generation': 'WeeklyReportGenerator'
        };

        const className = classNameMap[reportId];
        if (!className) {
            console.warn(`[DynamicLoader] No class name found for: ${reportId}`);
        }
        return className;
    }

    /**
     * 预加载 ECharts（仅在需要图表时）
     * Vercel 规则: bundle-defer-third-party
     * @returns {Promise<void>}
     */
    static async loadECharts() {
        // 如果已加载，直接返回
        if (window.echarts) {
            console.log('[DynamicLoader] ECharts already loaded');
            return Promise.resolve();
        }

        console.log('[DynamicLoader] Loading ECharts...');
        return this.loadScript('libs/echarts.min.js');
    }

    /**
     * 预加载报表脚本（hover 时预加载）
     * Vercel 规则: bundle-preload
     * @param {string} reportId - 报表ID
     */
    static preloadReport(reportId) {
        const scriptPath = this.getReportScriptPath(reportId);
        if (!scriptPath || this.loadedModules.has(scriptPath)) {
            return;
        }

        console.log(`[DynamicLoader] Preloading report: ${reportId} (${scriptPath})`);

        // 创建预加载链接
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = scriptPath;

        // 加载完成后移除预加载标签
        link.onload = () => {
            document.head.removeChild(link);
        };

        document.head.appendChild(link);
    }

    /**
     * 检查模块是否已加载
     * @param {string} src - 脚本路径
     * @returns {boolean} 是否已加载
     */
    static isLoaded(src) {
        return this.loadedModules.has(src);
    }

    /**
     * 清除所有缓存（用于测试或重置）
     */
    static clearCache() {
        this.loadedModules.clear();
        this.loadingPromises.clear();
        console.log('[DynamicLoader] Cache cleared');
    }

    /**
     * 获取加载统计信息
     * @returns {Object} 统计信息
     */
    static getStats() {
        return {
            loaded: Array.from(this.loadedModules.keys()),
            loading: Array.from(this.loadingPromises.keys()),
            totalLoaded: this.loadedModules.size,
            totalLoading: this.loadingPromises.size
        };
    }
}

// 导出到全局（确保在所有页面加载后可用）
if (typeof window !== 'undefined') {
    window.DynamicLoader = DynamicLoader;
}
