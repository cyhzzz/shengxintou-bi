/**
 * 散点图组件
 * 用于素材效果分析
 */
class ScatterChart {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            width: '100%',
            height: '500px',
            xAxis: { name: 'X轴', type: 'value' },
            yAxis: { name: 'Y轴', type: 'value' },
            data: [],
            symbolSizeField: null,  // 气泡大小对应的字段
            colorField: null,      // 颜色对应的字段
            onClick: null
        };

        this.chart = null;
    }

    /**
     * 初始化图表
     */
    init() {
        if (!this.container) {
            console.error('[ScatterChart] 容器不存在');
            return;
        }

        // 如果ECharts未加载，动态加载
        if (typeof echarts === 'undefined') {
            console.log('[ScatterChart] 动态加载ECharts');
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
            console.warn('[ScatterChart] 图表未初始化');
            return;
        }

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const { data } = params;
                    return `
                        <div style="padding: 10px;">
                            <strong>${data[3]?.title || ''}</strong><br/>
                            投放金额：¥${this._formatNumber(data[0])}<br/>
                            有效户人数：${this._formatNumber(data[1])}<br/>
                            综合评分：${data[2]}<br/>
                        </div>
                    `;
                }
            },
            grid: {
                left: '10%',
                right: '10%',
                bottom: '10%',
                top: '10%'
            },
            xAxis: {
                type: this.options.xAxis.type === 'log' ? 'log' : 'value',
                name: this.options.xAxis.name,
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: {
                    fontSize: 12,
                    fontWeight: 'bold'
                },
                axisLabel: {
                    formatter: (value) => this._formatNumber(value)
                }
            },
            yAxis: {
                type: this.options.yAxis.type === 'log' ? 'log' : 'value',
                name: this.options.yAxis.name,
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    fontSize: 12,
                    fontWeight: 'bold'
                },
                axisLabel: {
                    formatter: (value) => this._formatNumber(value)
                }
            },
            visualMap: {
                min: 0,
                max: 100,
                dimension: 2,
                inRange: {
                    color: ['#50a3ba', '#eac736', '#d94e5d']
                },
                show: true,
                right: 10,
                top: 10,
                textStyle: {
                    fontSize: 11
                }
            },
            series: [{
                type: 'scatter',
                symbolSize: (data) => {
                    return Math.sqrt(data[2]) * 2;  // 气泡大小基于评分
                },
                data: this.options.data,
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(120, 36, 50, 0.5)',
                    shadowOffsetY: 5,
                    borderColor: '#fff',
                    borderWidth: 1
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 20,
                        scale: 1.2
                    }
                }
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
            console.log('[ScatterChart] 点击:', params.data);
            if (this.options.onClick) {
                this.options.onClick(params.data);
            }
        });
    }

    /**
     * 更新数据
     */
    updateData(newData) {
        this.options.data = newData;
        this.render();
    }

    /**
     * 更新轴配置
     */
    updateAxes(xAxis, yAxis) {
        this.options.xAxis = xAxis;
        this.options.yAxis = yAxis;
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
     * 格式化数字
     * @private
     */
    _formatNumber(num) {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }
}

// 导出到全局
window.ScatterChart = ScatterChart;
