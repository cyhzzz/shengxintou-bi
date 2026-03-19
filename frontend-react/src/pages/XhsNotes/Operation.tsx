/**
 * 小红书运营分析页面
 * 分析笔记运营效果、创作者内容和转化数据
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Space,
  message,
  Spin,
  Typography,
} from 'antd';
import {
  FileTextOutlined,
  EyeOutlined,
  HeartOutlined,
  MessageOutlined,
  UserAddOutlined,
  AccountBookOutlined,
  DollarOutlined,
  RiseOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import EChartsComponent from '@/components/Chart/ECharts';
import { DateRangePicker } from '@/components/Filter';
import { postXhsOperationAnalysis } from '@/types/api';
import { metadataService } from '@/services/metadataService';
import type {
  XhsOperationAnalysisData,
  XhsCreatorContentItem,
  XhsCreatorConversionItem,
  XhsTopNoteItem,
  XhsCreatorAnnualRankingItem,
  XhsAgencyDataItem,
  XhsNoteConversionItem,
  XhsCreatorCreationItem,
  XhsCreatorInteractionItem,
  XhsEmployeeConversionItem,
} from '@/types/api.schemas';
import styles from './Operation.module.scss';

const { Link } = Typography;

const XhsNotesOperationPage: React.FC = () => {
  // 获取默认日期范围的辅助函数（基于数据可用日期）
  const getDefaultDateRangeFromData = (
    dataStart: string | null,
    dataEnd: string | null,
    fallbackDays: number = 30
  ): [string, string] => {
    // 如果有实际数据日期范围，使用数据结束日期往前30天
    if (dataEnd) {
      const endDate = new Date(dataEnd);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - fallbackDays);
      return [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ];
    }
    // 否则使用当前日期往前30天
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - fallbackDays);
    return [
      startDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  const getDefaultDateRange = (days: number): [string, string] => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    return [
      startDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  const getDefaultYTDDateRange = (): [string, string] => {
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    return [
      yearStart.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  // 数据可用日期范围（从元数据获取）
  const [xhsDataDateRange, setXhsDataDateRange] = useState<{ start: string | null; end: string | null } | null>(null);

  // 主筛选日期范围 - 初始为空，等待元数据加载后设置
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  // 笔记排行榜日期范围
  const [topNotesDateRange, setTopNotesDateRange] = useState<[string, string] | null>(null);
  // 创作者年度排行日期范围
  const [creatorAnnualDateRange, setCreatorAnnualDateRange] = useState<[string, string] | null>(null);

  // 数据状态
  const [data, setData] = useState<XhsOperationAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // 当前选中的图表Tab
  const [creationChartType, setCreationChartType] = useState<string>('impressions');

  // 加载元数据获取日期范围
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await metadataService.getMetadata();
        if (response.success && response.data?.xhs_notes_date_range) {
          const xhsRange = response.data.xhs_notes_date_range;
          setXhsDataDateRange(xhsRange);

          // 设置默认日期范围（基于数据可用日期）
          const defaultRange = getDefaultDateRangeFromData(xhsRange.start, xhsRange.end, 30);
          setDateRange(defaultRange);
          setTopNotesDateRange(defaultRange);

          // 创作者年度排行使用数据范围或年度
          if (xhsRange.end) {
            const yearStart = new Date(new Date(xhsRange.end).getFullYear(), 0, 1);
            setCreatorAnnualDateRange([
              yearStart.toISOString().split('T')[0],
              xhsRange.end
            ]);
          } else {
            setCreatorAnnualDateRange(getDefaultYTDDateRange());
          }
        } else {
          // 回退到默认30天
          const defaultRange = getDefaultDateRange(30);
          setDateRange(defaultRange);
          setTopNotesDateRange(defaultRange);
          setCreatorAnnualDateRange(getDefaultYTDDateRange());
        }
        setMetadataLoaded(true);
      } catch (error) {
        console.error('获取元数据失败:', error);
        // 回退到默认30天
        const defaultRange = getDefaultDateRange(30);
        setDateRange(defaultRange);
        setTopNotesDateRange(defaultRange);
        setCreatorAnnualDateRange(getDefaultYTDDateRange());
        setMetadataLoaded(true);
      }
    };

    fetchMetadata();
  }, []);

  // 加载数据
  const fetchData = useCallback(async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning('请选择主日期范围');
      return;
    }

    setLoading(true);
    try {
      const filters: Record<string, unknown> = {
        date_range: dateRange,
      };

      // 添加可选日期范围
      if (topNotesDateRange[0] && topNotesDateRange[1]) {
        filters.top_notes_date_range = topNotesDateRange;
      }
      if (creatorAnnualDateRange[0] && creatorAnnualDateRange[1]) {
        filters.creator_annual_date_range = creatorAnnualDateRange;
      }

      const response = await postXhsOperationAnalysis({ filters });

      // 后端返回格式: { success: true, data: { core_metrics, creator_content_data, ... } }
      // response.data 已经是 XhsOperationAnalysisData 类型
      if (response.success && response.data) {
        setData(response.data);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取小红书运营分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, topNotesDateRange, creatorAnnualDateRange]);

  // 处理查询
  const handleSearch = () => {
    fetchData();
  };

  // 组件加载时自动获取数据（等待元数据加载完成）
  useEffect(() => {
    if (metadataLoaded && dateRange) {
      fetchData();
    }
  }, [metadataLoaded, fetchData]);

  // 检查日期范围是否匹配（用于高亮快速日期按钮）
  const isDateRangeActive = (range: [string, string] | null, type: 'days30' | 'ytd'): boolean => {
    // 防止 null 值导致崩溃
    if (!range || !range[0] || !range[1]) {
      return false;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      const expectedStart = startDate.toISOString().split('T')[0];
      return range[0] === expectedStart && range[1] === todayStr;
    } else if (type === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const expectedStart = yearStart.toISOString().split('T')[0];
      return range[0] === expectedStart && range[1] === todayStr;
    }
    return false;
  };

  // 快速选择日期
  const handleQuickDateSelect = (type: 'topNotes' | 'creatorAnnual', option: 'days30' | 'ytd') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (option === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      const startStr = startDate.toISOString().split('T')[0];
      if (type === 'topNotes') {
        setTopNotesDateRange([startStr, todayStr]);
      } else {
        setCreatorAnnualDateRange([startStr, todayStr]);
      }
    } else if (option === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const startStr = yearStart.toISOString().split('T')[0];
      if (type === 'topNotes') {
        setTopNotesDateRange([startStr, todayStr]);
      } else {
        setCreatorAnnualDateRange([startStr, todayStr]);
      }
    }
  };

  // 处理重置
  const handleReset = () => {
    // 重置为基于数据的默认日期范围
    const defaultRange = getDefaultDateRangeFromData(
      xhsDataDateRange?.start,
      xhsDataDateRange?.end,
      30
    );
    setDateRange(defaultRange);
    setTopNotesDateRange(defaultRange);

    // 创作者年度排行使用数据范围或年度
    if (xhsDataDateRange?.end) {
      const yearStart = new Date(new Date(xhsDataDateRange.end).getFullYear(), 0, 1);
      setCreatorAnnualDateRange([
        yearStart.toISOString().split('T')[0],
        xhsDataDateRange.end
      ]);
    } else {
      setCreatorAnnualDateRange(getDefaultYTDDateRange());
    }
    setData(null);
  };

  // 格式化数字（添加千分位）
  const formatNumber = (value: number, decimals: number = 0): string => {
    if (decimals > 0) {
      return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 渲染转化率卡片（动态颜色）
  const renderRateCard = (title: string, value: number, subtitle: string) => {
    // 根据数值大小动态设置颜色
    let color = '#171A23';
    if (value >= 10) {
      color = '#52C41A'; // 绿色 - 优秀
    } else if (value >= 5) {
      color = '#1890FF'; // 蓝色 - 良好
    } else if (value >= 2) {
      color = '#FA8C16'; // 橙色 - 一般
    } else if (value > 0) {
      color = '#F5222D'; // 红色 - 较低
    }

    return (
      <div style={{
        background: 'white',
        border: '1px solid #E8E9EB',
        borderRadius: 6,
        padding: 12,
        textAlign: 'center',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ fontSize: 10, color: '#8A8D99', marginBottom: 4 }}>{subtitle}</div>
        <div style={{ fontSize: 11, color: '#5A5C66', fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>
          {value.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>%</span>
        </div>
      </div>
    );
  };

  // 渲染成本卡片（动态颜色）
  const renderCostCard = (title: string, value: number, unit: string) => {
    // 根据成本大小动态设置颜色
    let color = '#52C41A';
    let bgColor = '#F6FFED';

    if (value >= 1000) {
      color = '#F5222D'; // 红色 - 成本高
      bgColor = '#FFF1F0';
    } else if (value >= 500) {
      color = '#FA8C16'; // 橙色 - 成本中等偏高
      bgColor = '#FFF7E6';
    } else if (value >= 100) {
      color = '#1890FF'; // 蓝色 - 成本中等
      bgColor = '#E8F4FF';
    }

    return (
      <div style={{
        background: bgColor,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 12,
        transition: 'all 0.2s ease'
      }}>
        <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#171A23' }}>
          ¥{formatNumber(value, 2)}
          <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 4, color: '#8A8D99' }}>{unit}</span>
        </div>
      </div>
    );
  };

  // 导出CSV
  const handleExport = (exportType: string) => {
    if (!data) {
      message.warning('暂无数据可导出');
      return;
    }

    let csvContent = '';
    let filename = '';

    switch (exportType) {
      case 'creator_content':
        csvContent = exportCreatorContentData(data.creator_content_data);
        filename = `创作者内容数据_${dateRange[0]}_${dateRange[1]}.csv`;
        break;
      case 'top_notes':
        csvContent = exportTopNotesData(data.top_notes);
        filename = `笔记排行榜_${topNotesDateRange[0] || dateRange[0]}_${topNotesDateRange[1] || dateRange[1]}.csv`;
        break;
      case 'employee_conversion':
        csvContent = exportEmployeeConversionData(data.employee_conversion_ranking);
        filename = `员工转化排行_${dateRange[0]}_${dateRange[1]}.csv`;
        break;
      default:
        return;
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 导出创作者内容数据
  const exportCreatorContentData = (items: XhsCreatorContentItem[]) => {
    const headers = ['生产者', '笔记数', '曝光量', '点击量', '互动量', '消耗', '平均点击率', '平均互动率'];
    const rows = items.map(item => [
      item.producer,
      item.note_count,
      item.total_impressions,
      item.total_clicks,
      item.total_interactions,
      item.total_cost,
      `${item.avg_click_rate.toFixed(2)}%`,
      `${item.avg_interaction_rate.toFixed(2)}%`,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出笔记排行榜数据
  const exportTopNotesData = (items: XhsTopNoteItem[]) => {
    const headers = ['笔记ID', '笔记标题', '发布时间', '生产者', '投放策略', '消耗', '曝光量', '点击量', '私信量', '加微数', '开户数'];
    const rows = items.map(item => [
      item.note_id,
      item.note_title,
      item.note_publish_time,
      item.producer,
      item.ad_strategy,
      item.total_cost,
      item.total_impressions,
      item.total_clicks,
      item.total_private_messages,
      item.lead_users,
      item.opened_account_users,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出员工转化数据
  const exportEmployeeConversionData = (items: XhsEmployeeConversionItem[]) => {
    const headers = ['员工姓名', '加微数', '企微添加数', '有效线索数', '开户数', '有效户数', '开户率', '有效户率', '总资产'];
    const rows = items.map(item => [
      item.employee_name,
      item.lead_users,
      item.wechat_adds,
      item.valid_lead_users,
      item.opened_account_users,
      item.valid_customer_users,
      `${item.opening_rate.toFixed(2)}%`,
      `${item.valid_customer_rate.toFixed(2)}%`,
      item.total_assets || 0,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 创作趋势图表配置 - ECharts
  const creationTrendOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    const yField = creationChartType === 'impressions' ? '曝光量' :
                   creationChartType === 'interactions' ? '互动量' :
                   creationChartType === 'cost' ? '消耗' : '笔记数';

    const seriesData = data.creation_trend.dates.map((date, index) => {
      const value = creationChartType === 'impressions' ? data.creation_trend?.impression_series[index] || 0 :
                   creationChartType === 'interactions' ? data.creation_trend?.interaction_series[index] || 0 :
                   creationChartType === 'cost' ? data.creation_trend?.cost_series[index] || 0 :
                   data.creation_trend?.note_counts[index] || 0;
      return [date, value];
    });

    return {
      tooltip: {
        trigger: 'axis',
        showContent: true,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.creation_trend.dates,
        axisLabel: {
          rotate: data.creation_trend.dates.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        name: yField,
      },
      series: [{
        name: yField,
        type: 'line',
        smooth: true,
        data: seriesData.map(d => d[1]),
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: { color: '#1890ff' },
        lineStyle: { color: '#1890ff' },
      }],
    };
  }, [data?.creation_trend, creationChartType]);

  // 转化趋势图表配置 - ECharts 分组柱状图
  const conversionTrendOption = useMemo((): EChartsOption => {
    if (!data?.conversion_trend?.weeks?.length) return {};

    const types = ['加微数', '开口数', '有效线索', '开户数'];
    const colors = ['#1890ff', '#52c41a', '#faad14', '#eb2f96'];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        bottom: 0,
        data: types,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.conversion_trend.weeks,
      },
      yAxis: {
        type: 'value',
      },
      series: types.map((type, index) => ({
        name: type,
        type: 'bar' as const,
        data: type === '加微数' ? data.conversion_trend?.lead_users :
              type === '开口数' ? data.conversion_trend?.customer_mouth_users :
              type === '有效线索' ? data.conversion_trend?.valid_lead_users :
              data.conversion_trend?.opened_account_users || [],
        itemStyle: { color: colors[index] },
      })),
    };
  }, [data?.conversion_trend]);

  // 创作量趋势图表配置 - ECharts 柱状图
  const creationVolumeOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.creation_trend.dates,
        axisLabel: {
          rotate: data.creation_trend.dates.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '笔记数',
      },
      series: [{
        name: '笔记数',
        type: 'bar',
        data: data.creation_trend.note_counts,
        itemStyle: { color: '#1890ff' },
      }],
    };
  }, [data?.creation_trend]);

  // 互动量趋势图表配置 - ECharts 双轴折线图
  const interactionTrendOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    const colors = ['#52c41a', '#faad14'];

    return {
      tooltip: {
        trigger: 'axis',
        showContent: true,
      },
      legend: {
        bottom: 0,
        data: ['曝光量', '互动量'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.creation_trend.dates,
        axisLabel: {
          rotate: data.creation_trend.dates.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '曝光量',
          type: 'line',
          smooth: true,
          data: data.creation_trend.impression_series,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: colors[0] },
          lineStyle: { color: colors[0] },
          areaStyle: { opacity: 0.3 },
        },
        {
          name: '互动量',
          type: 'line',
          smooth: true,
          data: data.creation_trend.interaction_series,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: colors[1] },
          lineStyle: { color: colors[1] },
          areaStyle: { opacity: 0.3 },
        },
      ],
    };
  }, [data?.creation_trend]);

  // 创作者创作量图表配置 - ECharts 水平分组条形图
  const creatorCreationOption = useMemo((): EChartsOption => {
    if (!data?.creator_creation_data?.length) return {};

    const sortedData = [...data.creator_creation_data]
      .sort((a, b) => b.note_count - a.note_count)
      .slice(0, 10)
      .reverse();

    const producers = sortedData.map(item => item.producer);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        bottom: 0,
        data: ['笔记数', '曝光量'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
      },
      yAxis: {
        type: 'category',
        data: producers,
      },
      series: [
        {
          name: '笔记数',
          type: 'bar',
          data: sortedData.map(item => item.note_count),
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '曝光量',
          type: 'bar',
          data: sortedData.map(item => item.impressions || 0),
          itemStyle: { color: '#52c41a' },
        },
      ],
    };
  }, [data?.creator_creation_data]);

  // 创作者互动量图表配置 - ECharts 水平堆叠条形图
  const creatorInteractionOption = useMemo((): EChartsOption => {
    if (!data?.creator_interaction_data?.length) return {};

    const sortedData = [...data.creator_interaction_data]
      .sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0))
      .slice(0, 10)
      .reverse();

    const producers = sortedData.map(item => item.producer);
    const types = ['点赞', '收藏', '评论', '分享'];
    const colors = ['#ff4d4f', '#faad14', '#1890ff', '#52c41a'];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        bottom: 0,
        data: types,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
      },
      yAxis: {
        type: 'category',
        data: producers,
      },
      series: types.map((type, index) => ({
        name: type,
        type: 'bar' as const,
        stack: 'total',
        data: sortedData.map(item =>
          type === '点赞' ? item.likes || 0 :
          type === '收藏' ? item.favorites || 0 :
          type === '评论' ? item.comments || 0 :
          item.shares || 0
        ),
        itemStyle: { color: colors[index] },
      })),
    };
  }, [data?.creator_interaction_data]);

  // 员工周转化率趋势图表配置 - ECharts 多折线图
  const employeeWeeklyRateOption = useMemo((): EChartsOption => {
    if (!data?.employee_weekly_conversion?.weeks?.length) return {};

    const employees = data.employee_weekly_conversion.employees;
    const weeks = data.employee_weekly_conversion.weeks;
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

    // 颜色映射函数
    const getRateColor = (rate: number): string => {
      if (rate >= 10) return '#52c41a';
      if (rate >= 5) return '#1890ff';
      if (rate >= 2) return '#faad14';
      if (rate > 0) return '#f5222d';
      return '#999';
    };

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const title = params[0].axisValue;
          const content = params.map((item: any) => {
            const rateColor = getRateColor(item.value);
            return `<div style="display: flex; justify-content: space-between; gap: 16px; padding: 2px 0;">
              <span style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; margin-right: 8px;"></span>
                ${item.seriesName}
              </span>
              <span style="font-weight: 600; color: ${rateColor};">${item.value.toFixed(2)}%</span>
            </div>`;
          }).join('');
          return `<div style="padding: 8px 12px;">
            <div style="font-weight: 600; margin-bottom: 8px;">${title}</div>
            ${content}
          </div>`;
        },
      },
      legend: {
        bottom: 0,
        data: employees,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: weeks,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series: employees.map((employee: string, empIndex: number) => ({
        name: employee,
        type: 'line' as const,
        smooth: true,
        data: data.employee_weekly_conversion!.series[empIndex] || [],
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: { color: colors[empIndex % colors.length] },
        lineStyle: { color: colors[empIndex % colors.length] },
      })),
    };
  }, [data?.employee_weekly_conversion]);

  // 创作者内容表格列配置
  const creatorContentColumns = [
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.total_impressions - b.total_impressions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '互动量',
      dataIndex: 'total_interactions',
      key: 'total_interactions',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '平均点击率',
      dataIndex: 'avg_click_rate',
      key: 'avg_click_rate',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className={value >= 5 ? styles.positive : ''}>{value?.toFixed(2)}%</span>,
    },
    {
      title: '平均互动率',
      dataIndex: 'avg_interaction_rate',
      key: 'avg_interaction_rate',
      width: 100,
      align: 'right' as const,
      render: (value: number) => <span className={value >= 10 ? styles.positive : ''}>{value?.toFixed(2)}%</span>,
    },
  ];

  // 创作者转化表格列配置
  const creatorConversionColumns = [
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '私信量',
      dataIndex: 'private_messages',
      key: 'private_messages',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorConversionItem, b: XhsCreatorConversionItem) => a.lead_users - b.lead_users,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 笔记排行榜表格列配置
  const topNotesColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: XhsTopNoteItem, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '笔记标题',
      dataIndex: 'note_title',
      key: 'note_title',
      width: 200,
      fixed: 'left' as const,
      ellipsis: true,
      render: (text: string, record: XhsTopNoteItem) => (
        record.note_url ? (
          <Link href={record.note_url} target="_blank" className={styles.noteLink}>
            {text}
          </Link>
        ) : text
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'note_publish_time',
      key: 'note_publish_time',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 80,
    },
    {
      title: '投放策略',
      dataIndex: 'ad_strategy',
      key: 'ad_strategy',
      width: 100,
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsTopNoteItem, b: XhsTopNoteItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsTopNoteItem, b: XhsTopNoteItem) => a.total_impressions - b.total_impressions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '私信量',
      dataIndex: 'total_private_messages',
      key: 'total_private_messages',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 创作者年度排行表格列配置
  const creatorAnnualColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: XhsCreatorAnnualRankingItem, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorAnnualRankingItem, b: XhsCreatorAnnualRankingItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsCreatorAnnualRankingItem, b: XhsCreatorAnnualRankingItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '私信量',
      dataIndex: 'total_private_messages',
      key: 'total_private_messages',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 代理商数据表格列配置
  const agencyDataColumns = [
    {
      title: '代理商',
      dataIndex: 'agency',
      key: 'agency',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsAgencyDataItem, b: XhsAgencyDataItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '潜客数',
      dataIndex: 'potential_customers',
      key: 'potential_customers',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 笔记转化排行表格列配置
  const noteConversionColumns = [
    {
      title: '笔记标题',
      dataIndex: 'note_title',
      key: 'note_title',
      width: 200,
      fixed: 'left' as const,
      ellipsis: true,
      render: (text: string, record: XhsNoteConversionItem) => (
        record.note_url ? (
          <Link href={record.note_url} target="_blank" className={styles.noteLink}>
            {text}
          </Link>
        ) : text
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 80,
    },
    {
      title: '投放策略',
      dataIndex: 'ad_strategy',
      key: 'ad_strategy',
      width: 100,
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '私信量',
      dataIndex: 'total_private_messages',
      key: 'total_private_messages',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 员工转化排行表格列配置
  const employeeConversionColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsEmployeeConversionItem, b: XhsEmployeeConversionItem) => a.lead_users - b.lead_users,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '企微添加',
      dataIndex: 'wechat_adds',
      key: 'wechat_adds',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户率',
      dataIndex: 'opening_rate',
      key: 'opening_rate',
      width: 90,
      align: 'right' as const,
      render: (value: number) => (
        <span className={value >= 10 ? styles.positive : ''}>
          {value?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '有效户率',
      dataIndex: 'valid_customer_rate',
      key: 'valid_customer_rate',
      width: 90,
      align: 'right' as const,
      render: (value: number) => (
        <span className={value >= 30 ? styles.positive : ''}>
          {value?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '总资产',
      dataIndex: 'total_assets',
      key: 'total_assets',
      width: 120,
      align: 'right' as const,
      sorter: (a: XhsEmployeeConversionItem, b: XhsEmployeeConversionItem) => (a.total_assets || 0) - (b.total_assets || 0),
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  // 创作者创作数据表格列配置
  const creatorCreationColumns = [
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorCreationItem, b: XhsCreatorCreationItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '曝光量',
      dataIndex: 'impressions',
      key: 'impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 创作者互动数据表格列配置
  const creatorInteractionColumns = [
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
    },
    {
      title: '点赞',
      dataIndex: 'likes',
      key: 'likes',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '收藏',
      dataIndex: 'favorites',
      key: 'favorites',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '评论',
      dataIndex: 'comments',
      key: 'comments',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '分享',
      dataIndex: 'shares',
      key: 'shares',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '总互动',
      dataIndex: 'total_interactions',
      key: 'total_interactions',
      width: 90,
      align: 'right' as const,
      sorter: (a: XhsCreatorInteractionItem, b: XhsCreatorInteractionItem) => a.total_interactions - b.total_interactions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  return (
    <div className={styles.operationPage}>
      {/* 筛选器 */}
      <Card className={styles.filterCard} size="small">
        <div className={styles.filterRow}>
          {/* 主日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>主日期范围:</span>
            <DateRangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
            />
          </div>

          {/* 笔记排行榜日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>笔记排行榜:</span>
            <DateRangePicker
              value={topNotesDateRange}
              onChange={(dates) => setTopNotesDateRange(dates)}
            />
          </div>

          {/* 创作者年度日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>创作者年度:</span>
            <DateRangePicker
              value={creatorAnnualDateRange}
              onChange={(dates) => setCreatorAnnualDateRange(dates)}
            />
          </div>

          {/* 操作按钮 */}
          <div className={styles.filterActions}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>
        </div>
      </Card>

      {/* 核心运营数据 - 4行结构 */}
      <Card className={styles.sectionCard}>
        {/* 第一行：基础指标 */}
        <Row gutter={12} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #E8E9EB' }}>
          <Col span={8}>
            <div style={{ background: '#6366F115', borderLeft: '3px solid #6366F1', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, marginBottom: 6 }}>新增笔记数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                {formatNumber(data?.core_metrics?.new_notes_count || 0)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>篇</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ background: '#8B5CF615', borderLeft: '3px solid #8B5CF6', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600, marginBottom: 6 }}>投放笔记数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                {formatNumber(data?.core_metrics?.ad_notes_count || 0)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>篇</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ background: '#F59E0B15', borderLeft: '3px solid #F59E0B', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginBottom: 6 }}>投放金额</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                ¥{formatNumber(data?.core_metrics?.total_cost || 0, 2)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>元</div>
            </div>
          </Col>
        </Row>

        {/* 第二行：业务转化漏斗 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#1890FF', borderRadius: 2 }}></span>
            业务转化漏斗
          </div>
          <Row gutter={10}>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#E8F4FF', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#1890FF', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ fontSize: 10, color: '#1890FF', fontWeight: 600, marginBottom: 4 }}>曝光量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_impressions || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#FFF7E6', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#FA8C16', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: 10, color: '#FA8C16', fontWeight: 600, marginBottom: 4 }}>点击量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_clicks || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#FFF0F6', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#C41D7F', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                <div style={{ fontSize: 10, color: '#C41D7F', fontWeight: 600, marginBottom: 4 }}>私信进线</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_private_messages || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#F6FFED', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#52C41A', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
                <div style={{ fontSize: 10, color: '#52C41A', fontWeight: 600, marginBottom: 4 }}>加企微</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_lead_users || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#F9F0FF', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#722ED1', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</div>
                <div style={{ fontSize: 10, color: '#722ED1', fontWeight: 600, marginBottom: 4 }}>开户数</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_opened_accounts || 0)}</div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 第三行：转化率指标 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#52C41A', borderRadius: 2 }}></span>
            转化率指标
          </div>
          <Row gutter={10}>
            <Col span={6}>
              {renderRateCard('曝光点击率', data?.core_metrics?.impression_click_rate || 0, '曝光 → 点击')}
            </Col>
            <Col span={6}>
              {renderRateCard('点击进线率', data?.core_metrics?.click_lead_rate || 0, '点击 → 私信')}
            </Col>
            <Col span={6}>
              {renderRateCard('进线加微率', data?.core_metrics?.lead_to_wechat_rate || 0, '私信 → 加微')}
            </Col>
            <Col span={6}>
              {renderRateCard('线索开户率', data?.core_metrics?.wechat_to_account_rate || 0, '加微 → 开户')}
            </Col>
          </Row>
        </div>

        {/* 第四行：成本效率指标 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#F59E0B', borderRadius: 2 }}></span>
            成本效率指标
          </div>
          <Row gutter={10}>
            <Col span={6}>
              {renderCostCard('千次曝光成本', data?.core_metrics?.cost_per_mille || 0, '元/千次')}
            </Col>
            <Col span={6}>
              {renderCostCard('点击成本', data?.core_metrics?.cost_per_click || 0, '元/次')}
            </Col>
            <Col span={6}>
              {renderCostCard('单企微成本', data?.core_metrics?.cost_per_lead_user || 0, '元/人')}
            </Col>
            <Col span={6}>
              {renderCostCard('单开户成本', data?.core_metrics?.cost_per_opened_account || 0, '元/户')}
            </Col>
          </Row>
        </div>
      </Card>

      {loading ? (
        <Spin spinning={loading} description="加载中...">
          <div style={{ height: 300 }} />
        </Spin>
      ) : (
        <>
          {/* 创作者内容与转化数据 */}
          <div className={styles.rowTwoCols}>
            <Card className={styles.sectionCard} title="创作者内容数据">
              <Table
                columns={creatorContentColumns}
                dataSource={data?.creator_content_data || []}
                rowKey="producer"
                scroll={{ x: 800 }}
                size="small"
                pagination={false}
              />
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('creator_content')}
                  disabled={!data?.creator_content_data?.length}
                >
                  导出CSV
                </Button>
              </div>
            </Card>

            <Card className={styles.sectionCard} title="创作者转化数据">
              <Table
                columns={creatorConversionColumns}
                dataSource={data?.creator_conversion_data || []}
                rowKey="producer"
                scroll={{ x: 700 }}
                size="small"
                pagination={false}
              />
            </Card>
          </div>

          {/* 创作趋势图 */}
          <Card className={styles.chartCard} title="创作趋势">
            <div style={{ marginBottom: 16 }}>
              <Select
                value={creationChartType}
                onChange={setCreationChartType}
                style={{ width: 120 }}
                options={[
                  { label: '笔记数', value: 'notes' },
                  { label: '曝光量', value: 'impressions' },
                  { label: '互动量', value: 'interactions' },
                  { label: '消耗', value: 'cost' },
                ]}
              />
            </div>
            {data?.creation_trend?.dates?.length ? (
              <EChartsComponent option={creationTrendOption} height={300} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据，请选择日期范围后点击查询
              </div>
            )}
          </Card>

          {/* 笔记排行榜 */}
          <Card
            className={styles.tableCard}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>优秀笔记排行榜</span>
                <Space size={4}>
                  <Button
                    size="small"
                    type={isDateRangeActive(topNotesDateRange, 'days30') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('topNotes', 'days30')}
                  >
                    近30天
                  </Button>
                  <Button
                    size="small"
                    type={isDateRangeActive(topNotesDateRange, 'ytd') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('topNotes', 'ytd')}
                  >
                    今年以来
                  </Button>
                </Space>
              </div>
            }
            extra={
              <Space>
                <span className={styles.statText}>
                  共 {data?.top_notes?.length || 0} 条
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('top_notes')}
                  disabled={!data?.top_notes?.length}
                >
                  导出CSV
                </Button>
              </Space>
            }
          >
            <Table
              columns={topNotesColumns}
              dataSource={data?.top_notes || []}
              rowKey="note_id"
              scroll={{ x: 1000 }}
              size="small"
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
            />
          </Card>

          {/* 创作者年度排行 */}
          <Card
            className={styles.tableCard}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>创作者年度排行</span>
                <Space size={4}>
                  <Button
                    size="small"
                    type={isDateRangeActive(creatorAnnualDateRange, 'days30') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('creatorAnnual', 'days30')}
                  >
                    近30天
                  </Button>
                  <Button
                    size="small"
                    type={isDateRangeActive(creatorAnnualDateRange, 'ytd') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('creatorAnnual', 'ytd')}
                  >
                    今年以来
                  </Button>
                </Space>
              </div>
            }
          >
            <Table
              columns={creatorAnnualColumns}
              dataSource={data?.creator_annual_ranking || []}
              rowKey="producer"
              scroll={{ x: 800 }}
              size="small"
              pagination={false}
            />
          </Card>

          {/* 代理商数据 */}
          <Card className={styles.tableCard} title="代理商数据">
            <Table
              columns={agencyDataColumns}
              dataSource={data?.agency_data || []}
              rowKey="agency"
              scroll={{ x: 900 }}
              size="small"
              pagination={false}
            />
          </Card>

          {/* 转化趋势图 */}
          <Card className={styles.chartCard} title="转化趋势">
            {data?.conversion_trend?.weeks?.length ? (
              <EChartsComponent option={conversionTrendOption} height={300} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 笔记转化排行 */}
          <Card className={styles.tableCard} title="笔记转化排行">
            <Table
              columns={noteConversionColumns}
              dataSource={data?.note_conversion_ranking || []}
              rowKey="note_id"
              scroll={{ x: 1000 }}
              size="small"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50'],
              }}
            />
          </Card>

          {/* 内容运营数据 - 图表区域 */}
          <Card className={styles.chartCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>内容运营数据</h3>
            </div>
            <div className={styles.chartGrid}>
              <div>
                <h4 className={styles.sectionTitle}>创作量趋势</h4>
                <div className={styles.chartContainer}>
                  {data?.creation_trend?.dates?.length ? (
                    <EChartsComponent option={creationVolumeOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>互动量趋势</h4>
                <div className={styles.chartContainer}>
                  {data?.creation_trend?.dates?.length ? (
                    <EChartsComponent option={interactionTrendOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.chartGrid} style={{ marginTop: 24 }}>
              <div>
                <h4 className={styles.sectionTitle}>笔记创作量</h4>
                <div className={styles.chartContainer}>
                  {data?.creator_creation_data?.length ? (
                    <EChartsComponent option={creatorCreationOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>笔记互动量</h4>
                <div className={styles.chartContainer}>
                  {data?.creator_interaction_data?.length ? (
                    <EChartsComponent option={creatorInteractionOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* 创作者创作与互动数据 - 表格区域 */}
          <div className={styles.rowTwoCols}>
            <Card className={styles.sectionCard} title="创作者创作数据">
              <Table
                columns={creatorCreationColumns}
                dataSource={data?.creator_creation_data || []}
                rowKey="producer"
                scroll={{ x: 300 }}
                size="small"
                pagination={false}
              />
            </Card>

            <Card className={styles.sectionCard} title="创作者互动数据">
              <Table
                columns={creatorInteractionColumns}
                dataSource={data?.creator_interaction_data || []}
                rowKey="producer"
                scroll={{ x: 500 }}
                size="small"
                pagination={false}
              />
            </Card>
          </div>

          {/* 员工转化排行 */}
          <Card className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <span className={styles.tableTitle}>员工转化排行</span>
              <Space>
                <span className={styles.statText}>
                  共 {data?.employee_conversion_ranking?.length || 0} 人
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('employee_conversion')}
                  disabled={!data?.employee_conversion_ranking?.length}
                >
                  导出CSV
                </Button>
              </Space>
            </div>
            <Table
              columns={employeeConversionColumns}
              dataSource={data?.employee_conversion_ranking || []}
              rowKey="employee_name"
              scroll={{ x: 900 }}
              size="small"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
            />
          </Card>

          {/* 员工周转化率趋势图 */}
          <Card className={styles.chartCard} title="员工周转化率趋势">
            {data?.employee_weekly_conversion?.weeks?.length ? (
              <EChartsComponent option={employeeWeeklyRateOption} height={320} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default XhsNotesOperationPage;