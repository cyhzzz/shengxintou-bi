/**
 * 省心投 BI - 图表卡片组件
 * 封装 ECharts 图表功能
 */

class ChartCard {
    /**
     * 创建图表卡片实例
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 容器元素ID
     * @param {string} options.title - 图表标题
     * @param {string} options.type - 图表类型（line、bar、pie、funnel等）
     * @param {Object} options.data - 图表数据
     * @param {Object} options.options - ECharts 配置项
     */
    constructor(options = {}) {
        this.containerId = options.containerId;
        this.title = options.title || '未命名图表';
        this.type = options.type || 'line';
        this.data = options.data || {};
        this.options = options.options || {};
        this.chartInstance = null;

        // 用于防抖的resize处理（避免频繁resize）
        this._resizeTimeout = null;

        this.init();
    }

    /**
     * 初始化图表
     */
    init() {
        if (typeof echarts === 'undefined') {
            console.error('ECharts 未加载');
            return;
        }

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`找不到容器: ${this.containerId}`);
            return;
        }

        // 初始化 ECharts 实例
        this.chartInstance = echarts.init(container);

        // 设置默认配置
        this.setOption();

        // 监听窗口大小变化（使用passive监听器优化滚动性能）
        window.addEventListener('resize', this._handleResize.bind(this), { passive: true });
    }

    /**
     * 处理窗口大小变化（带防抖）
     * @private
     */
    _handleResize() {
        // 清除之前的定时器
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }

        // 防抖：150ms后执行resize
        this._resizeTimeout = setTimeout(() => {
            if (this.chartInstance) {
                this.chartInstance.resize();
            }
        }, 150);
    }

    /**
     * 获取图表默认配置
     * @returns {Object} ECharts 配置对象
     */
    getDefaultOption() {
        const theme = document.body.getAttribute('data-theme') || 'light';
        const textColor = theme === 'dark' ? '#ffffff' : '#333333';
        const gridColor = theme === 'dark' ? '#444444' : '#e0e0e0';

        return {
            title: {
                text: this.title,
                textStyle: {
                    color: textColor,
                    fontSize: 16,
                    fontWeight: 'normal'
                },
                left: 10,
                top: 10
            },
            tooltip: {
                trigger: this.type === 'pie' || this.type === 'funnel' ? 'item' : 'axis',
                confine: true
            },
            legend: {
                textStyle: {
                    color: textColor
                },
                bottom: 10
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '15%',
                top: '60px',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: this.type === 'bar',
                axisLine: {
                    lineStyle: { color: gridColor }
                },
                axisLabel: {
                    color: textColor
                }
            },
            yAxis: {
                type: 'value',
                axisLine: {
                    lineStyle: { color: gridColor }
                },
                axisLabel: {
                    color: textColor
                },
                splitLine: {
                    lineStyle: { color: gridColor }
                }
            }
        };
    }

    /**
     * 生成图表配置
     * @returns {Object} ECharts 配置对象
     */
    generateOption() {
        const defaultOption = this.getDefaultOption();
        const customOption = this.options || {};

        // 根据图表类型生成配置
        switch (this.type) {
            case 'line':
                return this.generateLineOption(defaultOption, customOption);
            case 'bar':
                return this.generateBarOption(defaultOption, customOption);
            case 'pie':
                return this.generatePieOption(defaultOption, customOption);
            case 'funnel':
                return this.generateFunnelOption(defaultOption, customOption);
            default:
                return { ...defaultOption, ...customOption };
        }
    }

    /**
     * 生成折线图配置
     */
    generateLineOption(defaultOption, customOption) {
        const option = {
            ...defaultOption,
            xAxis: {
                ...defaultOption.xAxis,
                data: this.data.dates || []
            },
            yAxis: {
                ...defaultOption.yAxis,
                type: 'value'
            },
            series: []
        };

        // 处理系列数据
        if (this.data.series) {
            option.series = Object.keys(this.data.series).map(key => ({
                name: key,
                type: 'line',
                smooth: true,
                data: this.data.series[key],
                areaStyle: customOption.areaStyle || {},
                ...customOption.seriesStyle
            }));
        }

        return { ...option, ...customOption };
    }

    /**
     * 生成柱状图配置
     */
    generateBarOption(defaultOption, customOption) {
        const option = {
            ...defaultOption,
            xAxis: {
                ...defaultOption.xAxis,
                data: this.data.categories || []
            },
            yAxis: {
                ...defaultOption.yAxis,
                type: 'value'
            },
            series: []
        };

        // 处理系列数据
        if (this.data.series) {
            option.series = Object.keys(this.data.series).map(key => ({
                name: key,
                type: 'bar',
                data: this.data.series[key],
                stack: customOption.stack ? 'total' : null,
                ...customOption.seriesStyle
            }));
        }

        return { ...option, ...customOption };
    }

    /**
     * 生成饼图配置
     */
    generatePieOption(defaultOption, customOption) {
        return {
            ...defaultOption,
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            series: [{
                name: this.title,
                type: 'pie',
                radius: customOption.radius || ['40%', '70%'],
                avoidLabelOverlap: false,
                label: {
                    show: true,
                    formatter: '{b}: {d}%'
                },
                data: this.data.data || []
            }]
        };
    }

    /**
     * 生成漏斗图配置
     */
    generateFunnelOption(defaultOption, customOption) {
        return {
            ...defaultOption,
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c}'
            },
            series: [{
                name: this.title,
                type: 'funnel',
                left: '10%',
                top: 60,
                bottom: 60,
                width: '80%',
                min: '0%',
                max: '100%',
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 2,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}: {c}'
                },
                labelLine: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid'
                    }
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 1
                },
                emphasis: {
                    label: {
                        fontSize: 20
                    }
                },
                data: this.data.data || []
            }]
        };
    }

    /**
     * 设置图表配置
     * @param {Object} options - ECharts 配置项
     */
    setOption(options) {
        if (!this.chartInstance) {
            return;
        }

        const config = options || this.generateOption();
        this.chartInstance.setOption(config, true);
    }

    /**
     * 更新图表数据
     * @param {Object} data - 新数据
     */
    updateData(data) {
        this.data = data;
        this.setOption();
    }

    /**
     * 更新图表配置
     * @param {Object} options - 新配置
     */
    updateOptions(options) {
        this.options = { ...this.options, ...options };
        this.setOption();
    }

    /**
     * 更新图表类型
     * @param {string} type - 新类型
     */
    updateType(type) {
        this.type = type;
        this.setOption();
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        if (this.chartInstance) {
            this.chartInstance.showLoading();
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (this.chartInstance) {
            this.chartInstance.hideLoading();
        }
    }

    /**
     * 调整图表大小
     */
    resize() {
        if (this.chartInstance) {
            this.chartInstance.resize();
        }
    }

    /**
     * 销毁图表实例
     */
    dispose() {
        // 清理防抖定时器
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = null;
        }

        // 移除resize监听器
        window.removeEventListener('resize', this._handleResize);

        // 销毁图表实例
        if (this.chartInstance) {
            this.chartInstance.dispose();
            this.chartInstance = null;
        }
    }

    /**
     * 渲染图表卡片容器HTML
     * @returns {string} HTML字符串
     */
    renderContainer() {
        return `
            <div class="chart-card">
                <div id="${this.containerId}" class="chart-container"></div>
            </div>
        `;
    }
}

// 导出到全局
window.ChartCard = ChartCard;
