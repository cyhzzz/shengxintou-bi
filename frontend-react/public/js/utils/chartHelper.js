/**
 * 省心投 BI - ECharts图表辅助工具
 */

class ChartHelper {
    // js-cache-function-results: 缓存平台颜色和业务模式颜色配置
    static #PLATFORM_COLORS = {
        '腾讯': '#1890ff',
        '抖音': '#f5222d',
        '小红书': '#eb2f96'
    };

    static #BUSINESS_MODEL_COLORS = {
        '直播': '#52c41a',
        '信息流': '#faad14'
    };

    /**
     * 创建折线图
     * @param {HTMLElement} container - 容器元素
     * @param {Object} data - 图表数据
     * @param {Object} options - 配置选项
     * @returns {ECharts}
     */
    static createLineChart(container, data, options = {}) {
        const chart = echarts.init(container);

        const defaultOptions = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.xAxis || [],
                boundaryGap: false
            },
            yAxis: {
                type: 'value'
            },
            series: data.series || []
        };

        const chartOptions = this.mergeOptions(defaultOptions, options);
        chart.setOption(chartOptions);

        return chart;
    }

    /**
     * 创建柱状图
     * @param {HTMLElement} container - 容器元素
     * @param {Object} data - 图表数据
     * @param {Object} options - 配置选项
     * @returns {ECharts}
     */
    static createBarChart(container, data, options = {}) {
        const chart = echarts.init(container);

        const defaultOptions = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.xAxis || []
            },
            yAxis: {
                type: 'value'
            },
            series: data.series || []
        };

        const chartOptions = this.mergeOptions(defaultOptions, options);
        chart.setOption(chartOptions);

        return chart;
    }

    /**
     * 创建饼图
     * @param {HTMLElement} container - 容器元素
     * @param {Object} data - 图表数据
     * @param {Object} options - 配置选项
     * @returns {ECharts}
     */
    static createPieChart(container, data, options = {}) {
        const chart = echarts.init(container);

        const defaultOptions = {
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left'
            },
            series: [
                {
                    type: 'pie',
                    radius: '50%',
                    data: data.series || [],
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };

        const chartOptions = this.mergeOptions(defaultOptions, options);
        chart.setOption(chartOptions);

        return chart;
    }

    /**
     * 合并配置选项
     * @param {Object} defaults - 默认配置
     * @param {Object} options - 用户配置
     * @returns {Object}
     */
    static mergeOptions(defaults, options) {
        const theme = document.body.getAttribute('data-theme') || 'light';
        const themeOptions = window.APP_CONFIG.CHART_THEMES[theme];

        return Object.assign({}, defaults, themeOptions, options);
    }

    /**
     * 销毁图表
     * @param {ECharts} chart - 图表实例
     */
    static destroy(chart) {
        if (chart) {
            chart.dispose();
        }
    }

    /**
     * 调整图表大小
     * @param {ECharts} chart - 图表实例
     */
    static resize(chart) {
        if (chart) {
            chart.resize();
        }
    }

    /**
     * 获取平台颜色配置（从缓存返回）
     * @returns {Object}
     */
    static getPlatformColors() {
        // 返回缓存的配置（避免每次都创建新对象）
        return this.#PLATFORM_COLORS;
    }

    /**
     * 获取业务模式颜色配置（从缓存返回）
     * @returns {Object}
     */
    static getBusinessModelColors() {
        // 返回缓存的配置（避免每次都创建新对象）
        return this.#BUSINESS_MODEL_COLORS;
    }
}

// 导出
window.ChartHelper = ChartHelper;
