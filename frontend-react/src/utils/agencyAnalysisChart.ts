/**
 * 代理商分析图表工具函数
 * 从旧版前端 AgencyAnalysisReport.js 迁移，最大程度复用原有代码
 */

// 平台颜色配置 - 与旧版完全一致
export const PLATFORM_COLORS: Record<string, string> = {
  '腾讯': '#52c41a',
  '小红书': '#f5222d',
  '抖音': '#722ed1',
  '云极': '#D4A574',
  'YJ': '#D4A574',
  '高德': '#1890ff',
};

// 指标配置 - 与旧版完全一致
export const METRICS_CONFIG: Record<string, { name: string; unit: string; precision: number }> = {
  cost: { name: '花费', unit: '元', precision: 2 },
  impressions: { name: '曝光', unit: '次', precision: 0 },
  clicks: { name: '点击次数', unit: '次', precision: 0 },
  lead_users: { name: '线索人数', unit: '人', precision: 0 },
  valid_customer_users: { name: '有效户人数', unit: '人', precision: 0 },
  opened_account_users: { name: '开户人数', unit: '人', precision: 0 }
};

/**
 * 构建堆叠柱状图的 ECharts option
 * 完全复制自旧版前端 AgencyAnalysisReport.js renderChart 方法
 */
export function buildTrendChartOption(
  dates: string[],
  series: Array<{
    date: string;
    platform: string;
    agency: string;
    business_model: string;
    metrics: Record<string, number>;
  }>,
  metric: string
): Record<string, unknown> {
  console.log('[buildTrendChartOption] 入参:', {
    datesLength: dates?.length,
    seriesLength: series?.length,
    metric,
    firstDate: dates?.[0],
    lastDate: dates?.[dates?.length - 1],
    firstSeries: series?.[0],
  });

  if (!dates?.length || !series?.length) {
    console.warn('[buildTrendChartOption] 数据为空，返回空配置', {
      hasDates: !!dates,
      datesLength: dates?.length,
      hasSeries: !!series,
      seriesLength: series?.length,
    });
    return {};
  }

  console.log('[buildTrendChartOption] 数据检查通过，开始处理');

  // 安全检查：限制数据量，防止内存溢出
  const MAX_SERIES = 50;
  const MAX_DATES = 90;

  // 限制日期数量
  const limitedDates = dates.length > MAX_DATES ? dates.slice(-MAX_DATES) : dates;

  // 获取所有唯一日期并排序
  const allDates = [...new Set(limitedDates)].sort();

  // 按平台+代理商+业务模式分组
  // 系列名称格式:
  //   - 有代理商+业务模式: 平台-代理商-业务模式 (例如: 小红书-信息流-量子)
  //   - 只有代理商: 平台-代理商 (例如: 腾讯-量子)
  //   - 只有平台: 平台 (例如: YJ)
  const groupedData: Record<string, {
    name: string;
    platform: string;
    agency: string;
    business_model: string;
    data: Array<{ date: string; value: number }>;
  }> = {};

  // 限制系列数量
  const limitedSeries = series.length > MAX_SERIES ? series.slice(0, MAX_SERIES) : series;

  limitedSeries.forEach((record) => {
    const key = `${record.platform}_${record.agency}_${record.business_model}`;

    // 构建系列名称：只在有值时用"-"连接
    const nameParts = [record.platform];
    if (record.agency) nameParts.push(record.agency);
    if (record.business_model) nameParts.push(record.business_model);

    // 为未归因数据添加明确标识
    let displayName = nameParts.join('-');
    if (!record.agency && !record.business_model) {
      // 完全未归因（无代理商、无业务模式）
      displayName = `${record.platform}-未归因`;
    } else if (!record.agency || !record.business_model) {
      // 部分未归因（有业务模式但无代理商，或有代理商但无业务模式）
      displayName = `${displayName} (未归因)`;
    }

    if (!groupedData[key]) {
      groupedData[key] = {
        name: displayName,
        platform: record.platform,
        agency: record.agency,
        business_model: record.business_model,
        data: []
      };
    }
    groupedData[key].data.push({
      date: record.date,
      value: record.metrics?.[metric] || 0
    });
  });

  console.log('[buildTrendChartOption] 分组后系列数:', Object.keys(groupedData).length);
  console.log('[buildTrendChartOption] 日期范围:', allDates[0], '到', allDates[allDates.length - 1]);

  // 构建系列数据
  const chartSeries = Object.values(groupedData).map((group) => {
    const dataMap = new Map(group.data.map((d) => [d.date, d.value]));
    const data = allDates.map((date) => dataMap.get(date) || 0);

    return {
      name: group.name,
      type: 'bar' as const,
      stack: 'total',
      data: data,
      itemStyle: {
        color: PLATFORM_COLORS[group.platform] || '#999'
      },
      emphasis: {
        focus: 'series' as const
      }
    };
  });

  const metricInfo = METRICS_CONFIG[metric] || { name: metric, unit: '', precision: 0 };

  // 完全复制旧版 ECharts 配置（移除 dataZoom，不需要底部的滑动条）
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';

        const date = params[0].axisValue;

        // 过滤掉值为0的系列
        const validParams = params.filter((param: any) => (param.value || 0) > 0);

        if (validParams.length === 0) {
          return `<div style="margin-bottom: 5px;"><strong>${date}</strong></div><div style="color: #999;">当日无数据</div>`;
        }

        let total = 0;
        let tooltip = `<div style="margin-bottom: 5px;"><strong>${date}</strong></div>`;

        validParams.forEach((param: any) => {
          const value = param.value || 0;
          total += value;
          const formattedValue = value.toLocaleString('zh-CN', {
            minimumFractionDigits: metricInfo.precision,
            maximumFractionDigits: metricInfo.precision
          });
          tooltip += `<div style="display: flex; justify-content: space-between; gap: 20px;">
            <span>${param.marker} ${param.seriesName}</span>
            <span>${formattedValue} ${metricInfo.unit}</span>
          </div>`;
        });

        // 显示合计
        const formattedTotal = total.toLocaleString('zh-CN', {
          minimumFractionDigits: metricInfo.precision,
          maximumFractionDigits: metricInfo.precision
        });
        tooltip += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee;">
          <strong>合计: ${formattedTotal} ${metricInfo.unit}</strong>
        </div>`;

        return tooltip;
      }
    },
    legend: {
      data: Object.values(groupedData).map((g) => g.name),
      top: 0,
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '60px',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: allDates,
      axisLabel: {
        rotate: 45,
        formatter: function(value: string) {
          return value.substring(5); // 只显示 MM-DD
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: function(value: number) {
          if (value >= 10000) {
            return (value / 10000).toFixed(1) + 'w';
          }
          return value;
        }
      }
    },
    series: chartSeries
  };

  console.log('[buildTrendChartOption] 图表配置完成，系列数:', chartSeries.length);

  return option;
}