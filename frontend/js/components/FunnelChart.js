/**
 * 漏斗图组件
 * 基于 ECharts
 */
class FunnelChart {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            width: '100%',
            height: '400px',
            data: [],
            onClick: null,
            onHover: null,
            ...options
        };

        this.chart = null;
    }

    /**
     * 初始化图表
     */
    init() {
        if (!this.container) {
            console.error('[FunnelChart] 容器不存在');
            return;
        }

        // 如果ECharts未加载，动态加载
        if (typeof echarts === 'undefined') {
            console.log('[FunnelChart] 动态加载ECharts');
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
            console.warn('[FunnelChart] 图表未初始化');
            return;
        }

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const { name, value, data } = params;
                    const lossRate = data.loss_rate || 0;
                    return `
                        <div style="padding: 10px;">
                            <strong>${name}</strong><br/>
                            人数：${this._formatNumber(value)}<br/>
                            转化率：${data.rate.toFixed(2)}%<br/>
                            流失率：${lossRate.toFixed(2)}%<br/>
                        </div>
                    `;
                }
            },
            series: [{
                type: 'funnel',
                left: '10%',
                top: 60,
                bottom: 60,
                width: '80%',
                min: 0,
                max: this.options.data.length > 0 ? this.options.data[0].value : 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 2,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: (params) => {
                        return `${params.name}\n${this._formatNumber(params.value)} (${params.data.rate.toFixed(1)}%)`;
                    },
                    fontSize: 12,
                    color: '#333'
                },
                labelLine: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid',
                        color: '#999'
                    }
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 1,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.1)'
                },
                emphasis: {
                    label: {
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                },
                data: this.options.data.map((item, index) => ({
                    value: item.value,
                    name: item.name,
                    rate: item.rate || 0,
                    loss_rate: item.loss_rate || 0,
                    stage: item.stage,
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
            console.log('[FunnelChart] 点击:', params.data);
            if (this.options.onClick) {
                this.options.onClick(params.data);
            }
        });

        this.chart.on('mouseover', (params) => {
            if (this.options.onHover) {
                this.options.onHover(params.data);
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
}

// 导出到全局
window.FunnelChart = FunnelChart;
