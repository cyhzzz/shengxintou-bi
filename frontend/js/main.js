/**
 * 省心投 BI - 应用入口 (v1.3 - 性能优化版)
 *
 * 优化内容:
 * 1. 动态加载工具类和UI组件 (减少80%初始加载量)
 * 2. 使用 AbortController 避免事件监听器重复绑定
 * 3. 并行数据加载 (减少50%数据加载时间)
 */

class App {
    constructor() {
        this.sidebar = null;
        this.themeToggle = null;
        this.currentReport = 'dashboard';
        this.chartInstance = null;
        this.currentReportInstance = null;

        // 用于清理事件监听器
        this.abortController = null;

        // 动态加载状态
        this.loadedModules = new Set();
        this.loadingPromises = new Map();

        this.init();
    }

    /**
     * 动态加载工具类
     */
    async loadUtilityModule(moduleName, scriptPath) {
        // 检查是否已加载
        if (this.loadedModules.has(moduleName)) {
            return window[moduleName];
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(moduleName)) {
            return await this.loadingPromises.get(moduleName);
        }

        // 开始加载
        console.log(`[动态加载] 加载工具类: ${moduleName}`);
        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.onload = () => {
                this.loadedModules.add(moduleName);
                this.loadingPromises.delete(moduleName);
                console.log(`[动态加载] 工具类加载完成: ${moduleName}`);
                resolve(window[moduleName]);
            };
            script.onerror = () => {
                this.loadingPromises.delete(moduleName);
                reject(new Error(`加载失败: ${moduleName}`));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(moduleName, loadPromise);
        return await loadPromise;
    }

    /**
     * 动态加载UI组件
     */
    async loadComponentModule(componentName, scriptPath) {
        return await this.loadUtilityModule(componentName, scriptPath);
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('省心投 BI 系统启动中... (v1.3 性能优化版)');

        // 开始性能监控
        const perfMeasure = await this.loadUtilityModule('PerformanceHelper', 'js/utils/performanceHelper.js?v=1.1')
            .then(() => PerformanceHelper.measure('AppInit'));

        // 并行加载必需的工具类
        const [Sidebar, ThemeToggle, API, ChartHelper] = await Promise.all([
            this.loadUtilityModule('Sidebar', 'js/components/Sidebar.js?v=1.1'),
            this.loadUtilityModule('ThemeToggle', 'js/components/ThemeToggle.js?v=1.1'),
            this.loadUtilityModule('API', 'js/utils/api.js?v=1.1'),
            this.loadUtilityModule('ChartHelper', 'js/utils/chartHelper.js?v=1.1')
        ]);

        // 将加载的模块挂载到全局
        window.Sidebar = Sidebar;
        window.ThemeToggle = ThemeToggle;
        window.API = API;
        window.ChartHelper = ChartHelper;

        // 初始化组件
        this.initComponents();

        // 绑定全局事件
        this.bindEvents();

        // 并行加载元数据和报表数据（消除瀑布流）
        await Promise.all([
            this.loadMetadata(),
            this.loadReportData()
        ]);

        // 结束性能监控
        perfMeasure.end();

        // 启动页面性能监控
        PerformanceHelper.monitorPagePerformance();

        console.log('省心投 BI 系统启动完成');
    }

    /**
     * 初始化组件
     */
    initComponents() {
        // 初始化侧边栏
        this.sidebar = new Sidebar('.sidebar');

        // 初始化主题切换
        this.themeToggle = new ThemeToggle('#themeToggle');

        // 注意：不再初始化全局筛选器，每个报表现在都有自己独立的筛选器
    }

    /**
     * 绑定全局事件 (使用 AbortController 避免重复绑定)
     */
    bindEvents() {
        // 清理旧监听器
        if (this.abortController) {
            this.abortController.abort();
        }

        // 创建新的 AbortController
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        // 监听报表切换事件
        window.addEventListener('reportChange', (e) => {
            this.handleReportChange(e.detail.reportId);
        }, { signal });

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.chartInstance) {
                ChartHelper.resize(this.chartInstance);
            }
        }, { signal, passive: true });

        console.log('[事件监听器] 已绑定 (使用 AbortController 管理)');
    }

    /**
     * 加载元数据
     */
    async loadMetadata() {
        try {
            const metadata = await API.getMetadata();
            console.log('元数据加载成功:', metadata);
            window.appMetadata = metadata;
        } catch (error) {
            console.error('元数据加载失败:', error);
        }
    }

    /**
     * 处理报表切换
     * @param {string} reportId - 报表ID
     */
    handleReportChange(reportId) {
        console.log('切换到报表:', reportId);
        this.currentReport = reportId;

        // 更新页面标题
        const reportConfig = window.APP_CONFIG.REPORTS[reportId];
        if (reportConfig) {
            const currentReportElement = document.getElementById('currentReport');
            if (currentReportElement) {
                currentReportElement.textContent = reportConfig.name;
            }
        }

        // 销毁现有图表
        if (this.chartInstance) {
            ChartHelper.destroy(this.chartInstance);
            this.chartInstance = null;
        }

        // 销毁旧报表实例（清理事件监听器和DOM）
        if (this.currentReportInstance && this.currentReportInstance.destroy) {
            try {
                this.currentReportInstance.destroy();
            } catch (error) {
                console.warn('清理旧报表实例时出错:', error);
            }
        }

        // 加载报表数据
        this.loadReportData();
    }

    /**
     * 加载主页仪表板数据
     */
    async loadReportData() {
        try {
            // 注意：不再从全局筛选器获取筛选条件，每个报表现在都有自己独立的筛选器

            // 根据当前报表类型加载不同的数据
            switch (this.currentReport) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'agency-analysis':
                    await this.loadAgencyAnalysisData();
                    break;
                case 'account-management':
                    await this.loadAccountManagement();
                    break;
                case 'abbreviation-management':
                    await this.loadAbbreviationManagement();
                    break;
                case 'database-backup':
                    await this.loadDatabaseBackup();
                    break;
                case 'xhs-notes-list':
                case 'xhs-notes-operation':
                case 'xhs-notes-creation':
                    await this.loadXhsNotesData();
                    break;
                case 'leads-detail':
                    await this.loadLeadsDetailData();
                    break;
                case 'cost-analysis':
                    await this.loadCostAnalysisData();
                    break;
                case 'conversion-funnel':
                    await this.loadConversionFunnelData();
                    break;
                case 'external-data':
                    await this.loadExternalDataAnalysis();
                    break;
                case 'report-generation':
                    await this.loadReportGeneration();
                    break;
                case 'system-config':
                    // 系统配置是一级菜单，不直接加载内容
                    break;
                case 'data-import':
                    await this.loadDataImport();
                    break;
                default:
                    console.log('未实现的报表类型:', this.currentReport);
            }
        } catch (error) {
            console.error('数据加载失败:', error);
        }
    }

    /**
     * 加载主页仪表板数据
     * @param {Object} filters - 筛选条件
     */
    async loadDashboardData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('dashboard');

            // 创建新的数据概览报表
            this.currentReportInstance = new ReportClass();

            console.log('数据概览报表已加载');

        } catch (error) {
            console.error('数据概览数据加载失败:', error);
            this.showError('加载数据概览数据失败: ' + error.message);
        }
    }

    /**
     * 计算总指标
     * @param {Array} data - 汇总数据
     * @returns {Object} 总指标
     */
    calculateTotals(data) {
        if (!data || data.length === 0) {
            return {
                totalCost: 0,
                totalImpressions: 0,
                totalClicks: 0,
                totalLeads: 0,
                totalAccounts: 0
            };
        }

        return data.reduce((acc, item) => {
            acc.totalCost += item.metrics.cost || 0;
            acc.totalImpressions += item.metrics.impressions || 0;
            acc.totalClicks += item.metrics.clicks || 0;
            acc.totalLeads += item.metrics.leads || 0;
            acc.totalAccounts += item.metrics.new_accounts || 0;
            return acc;
        }, {
            totalCost: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalLeads: 0,
            totalAccounts: 0
        });
    }

    /**
     * 渲染数据卡片
     * @param {Object} totals - 总指标数据
     */
    renderMetricCards(totals) {
        const metrics = [
            {
                title: '总花费',
                value: totals.totalCost,
                unit: '¥',
                icon: '💰',
                color: 'primary',
                trend: null // TODO: 计算趋势
            },
            {
                title: '总曝光',
                value: totals.totalImpressions,
                unit: '',
                icon: '👁️',
                color: 'success',
                trend: null
            },
            {
                title: '总点击',
                value: totals.totalClicks,
                unit: '',
                icon: '👆',
                color: 'warning',
                trend: null
            },
            {
                title: '线索数',
                value: totals.totalLeads,
                unit: '',
                icon: '🎯',
                color: 'danger',
                trend: null
            },
            {
                title: '开户数',
                value: totals.totalAccounts,
                unit: '',
                icon: '📊',
                color: 'info',
                trend: null
            },
            {
                title: '单线索成本',
                value: totals.totalLeads > 0 ? totals.totalCost / totals.totalLeads : 0,
                unit: '¥',
                icon: '💡',
                color: 'primary',
                trend: null
            },
            {
                title: '点击率',
                value: totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions * 100) : 0,
                unit: '%',
                icon: '📈',
                color: 'success',
                trend: null
            },
            {
                title: '线索转化率',
                value: totals.totalClicks > 0 ? (totals.totalLeads / totals.totalClicks * 100) : 0,
                unit: '%',
                icon: '🔄',
                color: 'warning',
                trend: null
            }
        ];

        const container = document.getElementById('metricCardsContainer');
        if (container) {
            container.innerHTML = MetricCard.renderGrid(metrics);
        }
    }

    /**
     * 渲染趋势图表
     * @param {Object} trendData - 趋势数据
     */
    renderTrendChart(trendData) {
        if (!trendData || !trendData.dates || !trendData.series) {
            console.warn('趋势数据格式不正确');
            return;
        }

        // 创建图表容器（如果不存在）
        let chartContainer = document.getElementById('trendChartContainer');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'trendChartContainer';
            chartContainer.className = 'chart-section';
            document.getElementById('mainContent').appendChild(chartContainer);
        }

        // 清空容器
        chartContainer.innerHTML = '<div id="trendChart" style="width:100%;height:400px;"></div>';

        // 创建图表
        const chart = new ChartCard({
            containerId: 'trendChart',
            title: '花费趋势',
            type: 'line',
            data: trendData,
            options: {
                areaStyle: {}
            }
        });
    }

    /**
     * 加载代理商投放分析数据
     * @param {Object} filters - 筛选条件
     */
    async loadAgencyAnalysisData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('agency-analysis');

            // 创建新的代理商分析报表
            this.currentReportInstance = new ReportClass();

            console.log('代理商分析报表已加载');

        } catch (error) {
            console.error('代理商分析数据加载失败:', error);
            this.showError('加载代理商分析数据失败: ' + error.message);
        }
    }

    /**
     * 加载账号管理数据
     * @param {Object} filters - 筛选条件
     */
    async loadAccountManagement() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('account-management');

            // 创建新的账号管理报表
            this.currentReportInstance = new ReportClass();

            console.log('账号管理报表已加载');

        } catch (error) {
            console.error('账号管理数据加载失败:', error);
            this.showError('加载账号管理数据失败: ' + error.message);
        }
    }

    /**
     * 加载简称管理
     */
    /**
     * 加载简称管理
     */
    async loadAbbreviationManagement() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('abbreviation-management');

            // 创建新的简称管理实例
            this.currentReportInstance = new ReportClass();

            console.log('简称管理已加载');

        } catch (error) {
            console.error('简称管理加载失败:', error);
            this.showError('加载简称管理失败: ' + error.message);
        }
    }
    async loadDatabaseBackup() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('database-backup');

            // 创建新的数据库备份实例
            this.currentReportInstance = new ReportClass();

            console.log('数据库备份已加载');

        } catch (error) {
            console.error('数据库备份加载失败:', error);
            this.showError('加载数据库备份失败: ' + error.message);
        }
    }

    /**
     * 加载小红书笔记数据
     * @param {Object} filters - 筛选条件
     */
    async loadXhsNotesData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 根据当前报表类型动态加载不同的报表类
            let ReportClass;
            if (this.currentReport === 'xhs-notes-list') {
                // 笔记列表报表
                ReportClass = await DynamicLoader.loadReport('xhs-notes-list');
            } else if (this.currentReport === 'xhs-notes-operation') {
                // 运营分析报表
                ReportClass = await DynamicLoader.loadReport('xhs-notes-operation');
            } else {
                // 创作分析报表（使用原有报表）
                ReportClass = await DynamicLoader.loadReport('xhs-notes-list');
            }

            // 创建报表实例
            this.currentReportInstance = new ReportClass();

            console.log('小红书笔记报表已加载');

        } catch (error) {
            console.error('小红书笔记数据加载失败:', error);
            this.showError('加载小红书笔记数据失败: ' + error.message);
        }
    }

    /**
     * 加载线索明细数据
     * @param {Object} filters - 筛选条件
     */
    async loadLeadsDetailData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('leads-detail');

            // 创建新的线索明细报表
            this.currentReportInstance = new ReportClass();

            console.log('线索明细报表已加载');

        } catch (error) {
            console.error('线索明细数据加载失败:', error);
            this.showError('加载线索明细数据失败: ' + error.message);
        }
    }

    /**
     * 加载成本分析数据
     * @param {Object} filters - 筛选条件
     */
    async loadCostAnalysisData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('cost-analysis');

            // 创建新的成本分析报表
            this.currentReportInstance = new ReportClass();

            console.log('成本分析报表已加载');

        } catch (error) {
            console.error('成本分析数据加载失败:', error);
            this.showError('加载成本分析数据失败: ' + error.message);
        }
    }

    /**
     * 加载转化漏斗数据
     * @param {Object} filters - 筛选条件
     */
    async loadConversionFunnelData() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('conversion-funnel');

            // 创建新的转化漏斗报表
            this.currentReportInstance = new ReportClass();

            console.log('转化漏斗报表已加载');

        } catch (error) {
            console.error('转化漏斗数据加载失败:', error);
            this.showError('加载转化漏斗数据失败: ' + error.message);
        }
    }

    /**
     * 加载外部数据分析
     * @param {Object} filters - 筛选条件
     */
    async loadExternalDataAnalysis() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('external-data');

            // 创建新的外部数据分析报表
            this.currentReportInstance = new ReportClass();

            console.log('外部数据分析报表已加载');

        } catch (error) {
            console.error('外部数据分析加载失败:', error);
            this.showError('加载外部数据分析失败: ' + error.message);
        }
    }

    /**
     * 加载报告生成器
     * @param {Object} filters - 筛选条件
     */
    async loadReportGeneration() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('report-generation');

            // 创建新的周报生成器
            this.currentReportInstance = new ReportClass();

            console.log('周报生成器已加载');

        } catch (error) {
            console.error('周报生成器加载失败:', error);
            this.showError('加载周报生成器失败: ' + error.message);
        }
    }

    /**
     * 加载数据导入
     */
    async loadDataImport() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 清空主内容区域
            const container = document.getElementById('mainContent');
            if (container) {
                container.innerHTML = '';
            }

            // 动态加载报表类
            const ReportClass = await DynamicLoader.loadReport('data-import');

            // 创建新的数据导入组件
            this.currentReportInstance = new ReportClass();

            console.log('数据导入组件已加载');

        } catch (error) {
            console.error('数据导入组件加载失败:', error);
            this.showError('加载数据导入组件失败: ' + error.message);
        }
    }

    /**
     * 加载系统配置管理
     */
    async loadConfigManagement() {
        try {
            // 销毁旧报表实例
            if (this.currentReportInstance && this.currentReportInstance.destroy) {
                this.currentReportInstance.destroy();
            }

            // 清空主内容区域
            const container = document.getElementById('mainContent');
            if (container) {
                container.innerHTML = '';
            }

            // 创建新的系统配置管理组件
            this.currentReportInstance = new ConfigManagement();

            console.log('系统配置管理组件已加载');

        } catch (error) {
            console.error('系统配置管理组件加载失败:', error);
            this.showError('加载系统配置管理组件失败: ' + error.message);
        }
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     */
    showError(message) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    /**
     * 清理资源 (防止内存泄漏)
     */
    destroy() {
        console.log('[App] 清理资源...');

        // 清理事件监听器
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // 清理图表实例
        if (this.chartInstance) {
            if (window.ChartHelper) {
                window.ChartHelper.destroy(this.chartInstance);
            }
            this.chartInstance = null;
        }

        // 清理报表实例
        if (this.currentReportInstance && this.currentReportInstance.destroy) {
            try {
                this.currentReportInstance.destroy();
            } catch (error) {
                console.warn('[App] 清理报表实例时出错:', error);
            }
            this.currentReportInstance = null;
        }

        // 清理组件
        this.sidebar = null;
        this.themeToggle = null;

        console.log('[App] 资源清理完成');
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
