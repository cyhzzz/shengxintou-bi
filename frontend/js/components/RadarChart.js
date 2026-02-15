/**
 * 雷达图组件
 * 用于多维度对比
 */
class RadarChart {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            width: '100%',
            height: '400px',
            indicators: [],  // 雷达图维度
            series: [],      // 系列数据
            onClick: null,
            ...options
        };

        this.chart = null;
    }

    /**
     * 初始化图表
     */
    init() {
        if (!this.container) {
            console.error('[RadarChart] 容器不存在');
            return;
        }

        // 如果ECharts未加载，动态加载
        if (typeof echarts === 'undefined') {
            console.log('[RadarChart] 动态加载ECharts');
            window.DynamicLoader.loadUtilityModule('echarts', 'frontend/libs/echarts.min.js')
                .then(() => {
                    this._createChart();
                });
        } else {
            this._createChart();
        }
    }

    /**
     * 创建ECharts实例
     * @private
     */
    _createChart() {
        this.chart = echarts.init(this.container);
        this.render();
        this.bindEvents();
    }

    /**
     * 渲染图表
     */
    render() {
        if (!this.chart) {
            console.warn('[RadarChart] 图表未初始化');
            return;
        }

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const { name, value, seriesName } = params;
                    return `
                        <div style="padding: 10px;">
                            <strong>${seriesName}</strong><br/>
                            ${name}: ${value.toFixed(2)}
                        </div>
                    `;
                }
            },
            legend: {
                data: this.options.series.map(s => s.name),
                top: 10,
                textStyle: {
                    fontSize: 12
                }
            },
            radar: {
                indicator: this.options.indicators.map(ind => ({
                    name: ind.name,
                    max: ind.max,
                    axisLabel: {
                        color: '#666',
                        fontSize: 11
                    }
                })),
                radius: '60%',
                splitNumber: 4,
                axisName: {
                    color: '#333'
                },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(114, 172, 209, 0.1)', 'rgba(114, 172, 209, 0.2)'],
                        shadowColor: 'rgba(0, 0, 0, 0.1)',
                        shadowBlur: 10
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: '#999'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#ddd'
                    }
                }
            },
            series: [{
                type: 'radar',
                data: this.options.series.map((s, index) => ({
                    value: s.value,
                    name: s.name,
                    symbolSize: 6,
                    lineStyle: {
                        width: 2
                    },
                    areaStyle: {
                        color: this._getRgbaColor(this._getColor(index), 0.2)
                    },
                    itemStyle: {
                        color: this._getColor(index)
                    }
                }))
            }]
        };

        this.chart.setOption(option);
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        if (!this.chart) return;

        this.chart.on('click', (params) => {
            console.log('[RadarChart] 点击:', params);
            if (this.options.onClick) {
                this.options.onClick(params);
            }
        });
    }

    /**
     * 更新数据
     */
    updateData(newSeries) {
        this.options.series = newSeries;
        this.render();
    }

    /**
     * 更新指示器
     */
    updateIndicators(newIndicators) {
        this.options.indicators = newIndicators;
        this.render();
    }

    /**
     * 调整图表大小
     */
    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }

    /**
     * 销毁图表
     */
    dispose() {
        if (this.chart) {
            this.chart.dispose();
            this.chart = null;
        }
    }

    /**
     * 获取颜色
     * @private
     */
    _getColor(index) {
        const colors = [
            '#5470C6', // 蓝色
            '#91CC75', // 绿色
            '#FAC858', // 黄色
            '#EE6666', // 红色
            '#73C0DE', // 浅蓝色
            '#3BA272', // 深绿色
            '#FC8452'  // 橙色
        ];
        return colors[index % colors.length];
    }

    /**
     * 转换为RGBA颜色
     * @private
     */
    _getRgbaColor(hexColor, alpha) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// 导出到全局
window.RadarChart = RadarChart;
