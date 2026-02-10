/**
 * 修复小红书运营分析报表 - 转化运营数据卡片的3个图表
 *
 * 修复内容：
 * 1. 整体转化走势图（周度）- 使用 conversion_trend 数据
 * 2. 小助手开户转化率走势（周度）- 使用 employee_weekly_conversion 数据，按员工分系列
 * 3. 员工转化量排行榜 - 使用 employee_conversion_ranking 数据
 *
 * 数据口径（从 backend_conversions 表，platform_source='小红书'）：
 * - 企微数 = 所有行数（每行1个加微）
 * - 开口客户数 = is_customer_mouth = 1 的行数
 * - 有效线索数 = is_valid_lead = 1 的行数
 * - 开户数 = is_opened_account = 1 的行数
 * - 有效户数 = is_valid_customer = 1 的行数
 */

// ============================================
// 修复方法1: 整体转化走势图（周度）
// ============================================
/**
 * 渲染整体转化走势图（周度）- 组合图
 * 横坐标：YYYY-第X周
 * 悬浮显示：日期范围 MM-DD ~ MM-DD
 * 数据来源：this.currentData.conversion_trend
 */
function renderConversionTrendChart_FIXED() {
    const container = document.getElementById('conversionTrendChart');
    if (!container) return;

    const chartData = this.currentData?.conversion_trend;
    console.log('[ConversionTrend] chartData:', chartData);

    if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
        console.warn('[ConversionTrend] No data available');
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <p style="margin: 0; font-size: 14px;">暂无数据</p>
            </div>
        `;
        return;
    }

    // 后端数据已经是周度聚合，转换为前端需要的格式
    const weeklyData = {
        weeks: chartData.weeks.map(w => {
            // 将 "2025-03" 转换为 "2025-第3周"
            const [year, week] = w.split('-');
            return `${year}-第${week}周`;
        }),
        dateRanges: chartData.dateRanges.map(dr => {
            // 将 "0106-0112" 转换为 "01-06 ~ 01-12"
            const [start, end] = dr.split('-');
            return `${start.substring(0, 2)}-${start.substring(2)} ~ ${end.substring(0, 2)}-${end.substring(2)}`;
        }),
        lead_users: chartData.lead_users,              // 企微数（加微数）
        customer_mouth_users: chartData.customer_mouth_users,  // 开口客户数
        valid_lead_users: chartData.valid_lead_users,  // 有效线索数
        opened_account_users: chartData.opened_account_users  // 开户数
    };
    console.log('[ConversionTrend] weeklyData:', weeklyData);

    const chart = echarts.init(container);
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const idx = params[0].dataIndex;
                const week = weeklyData.weeks[idx];
                const dateRange = weeklyData.dateRanges[idx];
                let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                result += `<div style="font-size: 11px; color: #8a8d99; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e8e9eb;">
                    <span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #6366f1; margin-right: 6px;"></span>
                    ${dateRange}
                </div>`;
                params.forEach(p => {
                    result += `<div style="margin: 5px 0;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                        <span style="color: #5a5c66;">${p.seriesName}:</span>
                        <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value} 个</span>
                    </div>`;
                });
                return result;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: '#e8e9eb',
            borderWidth: 1,
            padding: [12, 16],
            textStyle: { fontSize: 12 },
            extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
        },
        legend: {
            data: ['企微数', '开口客户数', '有效线索数', '开户数'],
            bottom: '2%',
            left: 'center',
            itemWidth: 16,
            itemHeight: 16,
            itemGap: 24,
            textStyle: {
                fontSize: 13,
                color: '#5a5c66'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '12%',
            top: '8%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: weeklyData.weeks,
            axisLabel: {
                rotate: 30,
                fontSize: 11,
                color: '#8a8d99',
                interval: 0,
                margin: 12
            },
            axisLine: {
                lineStyle: { color: '#e8e9eb' }
            },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: '个数',
            nameTextStyle: {
                fontSize: 12,
                color: '#8a8d99',
                padding: [0, 0, 0, -8]
            },
            axisLabel: {
                fontSize: 11,
                color: '#8a8d99',
                formatter: (value) => {
                    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                    return value;
                }
            },
            axisLine: {
                lineStyle: { color: '#e8e9eb' }
            },
            splitLine: {
                lineStyle: { color: '#f0f1f3', type: 'dashed' }
            }
        },
        series: [
            {
                name: '企微数',
                type: 'bar',
                data: weeklyData.lead_users,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(99, 102, 241, 0.8)' },
                        { offset: 1, color: 'rgba(99, 102, 241, 0.2)' }
                    ])
                },
                barMaxWidth: 40
            },
            {
                name: '开口客户数',
                type: 'bar',
                data: weeklyData.customer_mouth_users,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.8)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.2)' }
                    ])
                },
                barMaxWidth: 40
            },
            {
                name: '有效线索数',
                type: 'bar',
                data: weeklyData.valid_lead_users,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 158, 11, 0.8)' },
                        { offset: 1, color: 'rgba(245, 158, 11, 0.2)' }
                    ])
                },
                barMaxWidth: 40
            },
            {
                name: '开户数',
                type: 'line',
                data: weeklyData.opened_account_users,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                showSymbol: true,
                itemStyle: { color: '#ec4899', borderColor: '#fff', borderWidth: 2 },
                lineStyle: { width: 3, color: '#ec4899' },
                emphasis: {
                    focus: 'series',
                    itemStyle: { symbolSize: 10, borderWidth: 3 }
                }
            }
        ],
        animationDuration: 1000,
        animationEasing: 'cubicOut'
    };

    chart.setOption(option);
    this.charts.conversionTrend = chart;

    // 响应式
    window.addEventListener('resize', () => {
        if (this.charts.conversionTrend) {
            this.charts.conversionTrend.resize();
        }
    });
}

// ============================================
// 修复方法2: 小助手开户转化率走势（周度）
// ============================================
/**
 * 渲染小助手开户转化率走势图（周度）
 * 横坐标：YYYY-第X周
 * 纵坐标：转化率（开户数/加微数 × 100%）
 * 系列：按 add_employee_name 区分
 * 数据来源：this.currentData.employee_weekly_conversion
 */
function renderEmployeeWeeklyRateChart_FIXED() {
    const container = document.getElementById('employeeWeeklyRateChart');
    if (!container) return;

    const chartData = this.currentData?.employee_weekly_conversion;
    console.log('[EmployeeWeeklyRate] chartData:', chartData);

    if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
        console.warn('[EmployeeWeeklyRate] No data available');
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                <p style="margin: 0; font-size: 14px;">暂无数据</p>
            </div>
        `;
        return;
    }

    const chart = echarts.init(container);

    // 格式化周标签（YYYY-第X周）
    const weekLabels = chartData.weeks.map(w => {
        const [year, week] = w.split('-');
        return `${year}-第${week}周`;
    });

    // 构建系列数据（每个员工一条曲线）
    const series = [];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

    chartData.employees.forEach((empName, idx) => {
        series.push({
            name: empName,
            type: 'line',
            data: chartData.series[idx] || [],
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: true,
            itemStyle: { color: colors[idx % colors.length] },
            lineStyle: { width: 2.5, color: colors[idx % colors.length] },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    borderColor: colors[idx % colors.length],
                    borderWidth: 2,
                    symbolSize: 8
                }
            }
        });
    });

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params) => {
                const idx = params[0].dataIndex;
                const week = weekLabels[idx];
                let result = `<div style="font-weight: 600; margin-bottom: 10px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                params.forEach(p => {
                    result += `<div style="margin: 5px 0;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                        <span style="color: #5a5c66;">${p.seriesName}:</span>
                        <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value.toFixed(2)}%</span>
                    </div>`;
                });
                return result;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: '#e8e9eb',
            borderWidth: 1,
            padding: [12, 16],
            extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
        },
        legend: {
            data: chartData.employees,
            bottom: '2%',
            left: 'center',
            itemWidth: 14,
            itemHeight: 14,
            itemGap: 16,
            textStyle: {
                fontSize: 12,
                color: '#5a5c66'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '12%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: weekLabels,
            axisLabel: {
                fontSize: 11,
                color: '#8a8d99',
                interval: 0,
                margin: 12,
                rotate: 30
            },
            axisLine: {
                lineStyle: { color: '#e8e9eb' }
            },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            name: '转化率 (%)',
            nameTextStyle: {
                fontSize: 12,
                color: '#8a8d99',
                padding: [0, 0, 0, -8]
            },
            axisLabel: {
                fontSize: 11,
                color: '#8a8d99',
                formatter: '{value}%'
            },
            axisLine: {
                lineStyle: { color: '#e8e9eb' }
            },
            splitLine: {
                lineStyle: { color: '#f0f1f3', type: 'dashed' }
            }
        },
        series: series,
        animationDuration: 1000,
        animationEasing: 'cubicOut'
    };

    chart.setOption(option);
    this.charts.employeeWeeklyRate = chart;

    // 响应式
    window.addEventListener('resize', () => {
        if (this.charts.employeeWeeklyRate) {
            this.charts.employeeWeeklyRate.resize();
        }
    });
}

// ============================================
// 修复方法3: 员工转化量排行榜表格渲染
// ============================================
/**
 * 渲染员工转化量排行榜行
 * 数据来源：this.currentData.employee_conversion_ranking
 *
 * 数据口径：
 * - 企微数 = 行数（每行1个加微）
 * - 有效线索数 = is_valid_lead = 1 的行数
 * - 开户数 = is_opened_account = 1 的行数
 * - 有效户数 = is_valid_customer = 1 的行数
 */
function renderEmployeeConversionRows_FIXED() {
    const data = this.currentData?.employee_conversion_ranking || [];
    if (data.length === 0) {
        return '<tr><td colspan="9" class="table-empty">暂无数据</td></tr>';
    }

    return data.map((item, index) => `
        <tr>
            <td class="table-rank ${index < 3 ? 'table-rank--top' : ''}" style="text-align: center;">${index + 1}</td>
            <td style="white-space: nowrap;">${item.employee_name || '-'}</td>
            <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.lead_users || 0)}</td>
            <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.valid_lead_users || 0)}</td>
            <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.opened_account_users || 0)}</td>
            <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.valid_customer_users || 0)}</td>
            <td style="text-align: right; white-space: nowrap;">
                <span style="color: ${this.getRateColor(item.opening_rate || 0)}; font-weight: 600;">
                    ${(item.opening_rate || 0).toFixed(2)}%
                </span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
                <span style="color: ${this.getRateColor(item.valid_customer_rate || 0)}; font-weight: 600;">
                    ${(item.valid_customer_rate || 0).toFixed(2)}%
                </span>
            </td>
        </tr>
    `).join('');
}

// ============================================
// 导出说明
// ============================================
/**
 * 使用说明：
 *
 * 将 XhsNotesOperationReport.js 中的以下三个方法替换为上述修复版本：
 *
 * 1. 查找方法名：renderConversionTrendChart()
 *    替换为：renderConversionTrendChart_FIXED()
 *    然后去掉 _FIXED 后缀
 *
 * 2. 查找方法名：renderEmployeeWeeklyRateChart()
 *    替换为：renderEmployeeWeeklyRateChart_FIXED()
 *    然后去掉 _FIXED 后缀
 *
 * 3. 查找方法名：renderEmployeeConversionRows()
 *    替换为：renderEmployeeConversionRows_FIXED()
 *    然后去掉 _FIXED 后缀
 *
 * 关键修改点：
 * - 整体转化走势图：使用 conversion_trend 数据，已正确
 * - 小助手开户转化率走势：改用 employee_weekly_conversion 数据（原错误使用 conversion_trend）
 * - 员工转化量排行榜：使用 employee_conversion_ranking 数据，已正确
 */
