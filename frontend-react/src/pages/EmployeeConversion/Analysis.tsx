/**
 * 员工转化分析页面
 * 分析员工维度的转化效果数据
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Select,
  Button,
  Space,
  message,
  Spin,
  Radio,
  Typography,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  RiseOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import MetricCard from '@/pages/Dashboard/components/MetricCard';

const { Text } = Typography;
import type { EChartsOption } from 'echarts';
import EChartsComponent from '@/components/Chart/ECharts';
import { DateRangePicker } from '@/components/Filter';
import { http } from '@/services/http';
import {
  postEmployeeConversionAnalysis,
  getEmployeeConversionFilterOptions,
} from '@/types/api';
import type {
  EmployeeConversionAnalysisData,
  EmployeeConversionAnalysisResponse,
  EmployeeConversionFilterOptionsResponse,
  EmployeeConversionRankingItem,
} from '@/types/api.schemas';
import styles from './Analysis.module.scss';

// 线索类型选项
const LEAD_TYPE_OPTIONS = [
  { label: '全部线索', value: 'all' },
  { label: '存量线索', value: 'existing' },
  { label: '新增线索', value: 'new' },
];

const EmployeeConversionAnalysisPage: React.FC = () => {
  // 筛选状态
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [leadType, setLeadType] = useState<string>('all');
  // 员工转化率走势粒度
  const [rateTrendGranularity, setRateTrendGranularity] = useState<'weekly' | 'monthly'>('weekly');

  // 筛选选项
  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 数据状态
  const [data, setData] = useState<EmployeeConversionAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  // 员工转化率走势数据（独立状态，避免切换粒度时刷新整个页面）
  const [employeeRateTrendData, setEmployeeRateTrendData] = useState<EmployeeConversionAnalysisData['employee_rate_trend'] | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  // v3.1 §四: 渠道口径（agg_daily_channel_open，独立数据源）
  const [channelOverview, setChannelOverview] = useState<any>(null);

  // 加载筛选选项
  const loadFilterOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const response: EmployeeConversionFilterOptionsResponse =
        await getEmployeeConversionFilterOptions();

      if (response.success && response.data) {
        setPlatformOptions(response.data.platforms || []);
        setEmployeeOptions(response.data.employees || []);
      }
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  // 初始加载筛选选项
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // 初始加载数据（默认查询全部数据，不限制日期）+ 渠道口径
  useEffect(() => {
    fetchData();
    fetchChannelOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在组件挂载时执行一次

  // 监听粒度变化，只刷新员工转化率走势数据
  useEffect(() => {
    // 跳过首次挂载（首次挂载由上面的 useEffect 处理）
    if (data !== null) {
      fetchEmployeeRateTrendOnly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateTrendGranularity]);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        lead_type: leadType,
        granularity: rateTrendGranularity,
      };

      // 只有在有日期时才传递日期参数
      if (dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0];
        params.end_date = dateRange[1];
      }

      if (selectedPlatforms.length > 0) {
        params.platforms = selectedPlatforms;
      }
      if (selectedEmployees.length > 0) {
        params.employees = selectedEmployees;
      }

      const response: EmployeeConversionAnalysisResponse =
        await postEmployeeConversionAnalysis(params);

      if (response.success && response.data) {
        setData(response.data);
        setEmployeeRateTrendData(response.data.employee_rate_trend);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取员工转化分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedEmployees, leadType, rateTrendGranularity]);

  // 仅获取员工转化率走势数据（用于粒度切换）
  const fetchEmployeeRateTrendOnly = useCallback(async () => {
    setTrendLoading(true);
    try {
      const params: Record<string, unknown> = {
        lead_type: leadType,
        granularity: rateTrendGranularity,
      };

      if (dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0];
        params.end_date = dateRange[1];
      }

      if (selectedPlatforms.length > 0) {
        params.platforms = selectedPlatforms;
      }
      if (selectedEmployees.length > 0) {
        params.employees = selectedEmployees;
      }

      const response: EmployeeConversionAnalysisResponse =
        await postEmployeeConversionAnalysis(params);

      if (response.success && response.data) {
        setEmployeeRateTrendData(response.data.employee_rate_trend);
      }
    } catch (error) {
      console.error('获取员工转化率走势数据失败:', error);
    } finally {
      setTrendLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedEmployees, leadType, rateTrendGranularity]);

  // v3.1 §四: 同时拉取渠道口径（agg_daily_channel_open，独立数据源）
  const fetchChannelOverview = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { lead_type: leadType };
      if (dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0];
        params.end_date = dateRange[1];
      }
      if (selectedEmployees.length > 0) params.employees = selectedEmployees;
      const res: any = await http.post('/employee-conversion/analysis-channel-overview', params);
      if (res?.success) setChannelOverview(res.data);
    } catch { /* ignore */ }
  }, [dateRange, selectedEmployees, leadType]);

  // 处理查询
  const handleSearch = () => {
    fetchData();
    fetchChannelOverview();
  };

  // 处理重置
  const handleReset = () => {
    setDateRange(['', '']);
    setSelectedPlatforms([]);
    setSelectedEmployees([]);
    setLeadType('all');
    setData(null);
    setEmployeeRateTrendData(null);
    // 重置后重新加载数据（查询全部数据）
    setTimeout(() => {
      fetchData();
      fetchChannelOverview();
    }, 0);
  };

  // 导出CSV
  const handleExport = () => {
    if (!data?.ranking?.length) {
      message.warning('暂无数据可导出');
      return;
    }

    const headers = [
      '排名',
      '员工姓名',
      '总线索数',
      '开口数',
      '有效线索数',
      '开户数',
      '有效户数',
      '开户率',
      '有效户率',
      '总资产',
    ];

    const csvContent = [
      headers.join(','),
      ...data.ranking.map((item) =>
        [
          item.rank,
          item.employee_name,
          item.total_leads,
          item.mouth_count,
          item.valid_lead_count,
          item.opened_count,
          item.valid_customer_count,
          `${item.opening_rate}%`,
          `${item.valid_customer_rate}%`,
          item.total_assets || 0,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 如果没有选择日期，使用"全部"作为文件名
    const dateStr = dateRange[0] && dateRange[1]
      ? `${dateRange[0]}_${dateRange[1]}`
      : '全部';
    link.download = `员工转化排行_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 转化趋势柱状图配置
  // 后端返回格式: { weeks: string[], dateRanges: string[], lead_users: number[], customer_mouth_users: number[], valid_lead_users: number[], opened_account_users: number[] }
  // 需要转换为图表需要的分组柱状图格式
  const getConversionTrendData = () => {
    if (!data?.conversion_trend?.weeks?.length) return [];

    const { weeks, dateRanges, lead_users, customer_mouth_users, valid_lead_users, opened_account_users } = data.conversion_trend;
    const result: Array<{
      week: string;
      dateRange: string;
      metric: string;
      value: number;
    }> = [];

    weeks.forEach((week, index) => {
      // 格式化周标签：将 "2025-03" 转换为 "2025-第3周"
      const [year, weekNum] = week.split('-');
      const weekLabel = `${year}-第${weekNum}周`;

      // 格式化日期范围：将 "0106-0112" 转换为 "01-06 ~ 01-12"
      let dateRangeLabel = '';
      if (dateRanges?.[index]) {
        const dr = dateRanges[index];
        const [start, end] = dr.split('-');
        dateRangeLabel = `${start.substring(0, 2)}-${start.substring(2)} ~ ${end.substring(0, 2)}-${end.substring(2)}`;
      }

      // 加微数
      result.push({
        week: weekLabel,
        dateRange: dateRangeLabel,
        metric: '加微数',
        value: lead_users?.[index] || 0,
      });
      // 开口客户数
      result.push({
        week: weekLabel,
        dateRange: dateRangeLabel,
        metric: '开口客户数',
        value: customer_mouth_users?.[index] || 0,
      });
      // 有效线索数
      result.push({
        week: weekLabel,
        dateRange: dateRangeLabel,
        metric: '有效线索数',
        value: valid_lead_users?.[index] || 0,
      });
      // 开户数
      result.push({
        week: weekLabel,
        dateRange: dateRangeLabel,
        metric: '开户数',
        value: opened_account_users?.[index] || 0,
      });
    });

    return result;
  };

  // 柱状图渐变颜色配置（与旧版 ECharts 渐变一致）
  const METRIC_COLORS: Record<string, string[]> = {
    '加微数': ['#6366f1', '#818cf8'],
    '开口客户数': ['#10b981', '#34d399'],
    '有效线索数': ['#f59e0b', '#fbbf24'],
    '开户数': ['#ec4899', '#f472b6'],
  };

  // 转化趋势柱状图 ECharts 配置
  const conversionTrendOption = useMemo((): EChartsOption => {
    const trendData = getConversionTrendData();
    if (!trendData.length) return {};

    const weeks = [...new Set(trendData.map(d => d.week))];
    const metrics = ['加微数', '开口客户数', '有效线索数', '开户数'];

    // 构建每个指标的数据
    const series = metrics.map(metric => ({
      name: metric,
      type: 'bar' as const,
      data: weeks.map(week => {
        const item = trendData.find(d => d.week === week && d.metric === metric);
        return item?.value || 0;
      }),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: METRIC_COLORS[metric]?.[0] || '#1890ff' },
            { offset: 1, color: METRIC_COLORS[metric]?.[1] || '#40a9ff' },
          ],
        },
        borderRadius: [4, 4, 0, 0],
      },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: {
          rotate: 30,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: '个数',
        nameTextStyle: { fontSize: 12, color: '#8a8d99' },
        axisLabel: {
          formatter: (value: number) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : String(value),
        },
        splitLine: {
          lineStyle: { type: 'dashed', color: '#f0f1f3' },
        },
      },
      series,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      timeline: {
        show: false,
      },
    };
  }, [data?.conversion_trend]);

  // 员工转化率走势图配置
  // 后端返回格式: { periods: string[], employees: string[], series: number[][] }
  // periods 格式: weekly="2025-03", monthly="2025-03"
  // 需要转换为图表需要的数组格式
  // 剔除总线索数低于50的员工
  const getEmployeeRateTrendData = () => {
    if (!employeeRateTrendData?.periods?.length) return [];

    const { periods, employees, series } = employeeRateTrendData;
    const result: Array<{ date: string; value: number; category: string }> = [];

    // 从 ranking 数据中构建员工总线索数映射
    const employeeLeadsMap: Record<string, number> = {};
    if (data?.ranking) {
      data.ranking.forEach((item) => {
        employeeLeadsMap[item.employee_name] = item.total_leads;
      });
    }

    // 过滤掉总线索数低于50的员工
    const filteredEmployees = employees.filter((empName) => {
      const totalLeads = employeeLeadsMap[empName] || 0;
      return totalLeads >= 50;
    });

    filteredEmployees.forEach((empName) => {
      // 找到原始员工索引
      const empIdx = employees.indexOf(empName);
      if (empIdx === -1) return;

      periods.forEach((period, periodIdx) => {
        // 格式化周期标签
        const [year, num] = period.split('-');
        let periodLabel: string;
        if (rateTrendGranularity === 'monthly') {
          // 月度: "2025-03" -> "2025年03月"
          periodLabel = `${year}年${num}月`;
        } else {
          // 周度: "2025-03" -> "2025-第3周"
          periodLabel = `${year}-第${num}周`;
        }

        result.push({
          date: periodLabel,
          value: series[empIdx]?.[periodIdx] ?? 0,
          category: empName,
        });
      });
    });

    return result;
  };

  // 折线图颜色配置（与旧版 ECharts 一致）
  const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

  // 员工转化率走势图 ECharts 配置
  const employeeRateTrendOption = useMemo((): EChartsOption => {
    const trendData = getEmployeeRateTrendData();
    if (!trendData.length) return {};

    const dates = [...new Set(trendData.map(d => d.date))].sort();
    const categories = [...new Set(trendData.map(d => d.category))];

    // 构建每个员工的数据
    const series = categories.map((cat, index) => ({
      name: cat,
      type: 'line' as const,
      smooth: true,
      data: dates.map(date => {
        const item = trendData.find(d => d.date === date && d.category === cat);
        return item?.value ?? null;
      }),
      symbol: 'circle',
      symbolSize: 5,
      connectNulls: true,
      lineStyle: {
        color: LINE_COLORS[index % LINE_COLORS.length],
        width: 2.5,
      },
      itemStyle: {
        color: LINE_COLORS[index % LINE_COLORS.length],
      },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          let html = `<div style="font-weight:600;margin-bottom:10px;font-size:13px;color:#1a1a1a;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            if (param.value !== null && param.value !== undefined) {
              html += `<div style="margin:5px 0;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${param.color};margin-right:8px;"></span>
                <span style="color:#5a5c66;">${param.seriesName}:</span>
                <span style="float:right;font-weight:600;color:#1a1a1a;">${param.value.toFixed(2)}%</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 30,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: '转化率 (%)',
        nameTextStyle: { fontSize: 12, color: '#8a8d99' },
        axisLabel: {
          formatter: '{value}%',
        },
        splitLine: {
          lineStyle: { type: 'dashed', color: '#f0f1f3' },
        },
      },
      series,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      timeline: {
        show: false,
      },
    };
  }, [employeeRateTrendData, data?.ranking, rateTrendGranularity]);

  // 排行榜表格列配置
  const rankingColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      align: 'center' as const,
    },
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '总线索数',
      dataIndex: 'total_leads',
      key: 'total_leads',
      width: 100,
      align: 'right' as const,
      sorter: (a: EmployeeConversionRankingItem, b: EmployeeConversionRankingItem) =>
        a.total_leads - b.total_leads,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'mouth_count',
      key: 'mouth_count',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索数',
      dataIndex: 'valid_lead_count',
      key: 'valid_lead_count',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_count',
      key: 'opened_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: EmployeeConversionRankingItem, b: EmployeeConversionRankingItem) =>
        a.opened_count - b.opened_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户数',
      dataIndex: 'valid_customer_count',
      key: 'valid_customer_count',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户率',
      dataIndex: 'opening_rate',
      key: 'opening_rate',
      width: 100,
      align: 'right' as const,
      sorter: (a: EmployeeConversionRankingItem, b: EmployeeConversionRankingItem) =>
        a.opening_rate - b.opening_rate,
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
      width: 100,
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
      sorter: (a: EmployeeConversionRankingItem, b: EmployeeConversionRankingItem) =>
        (a.total_assets || 0) - (b.total_assets || 0),
      render: (value: number) =>
        value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  return (
    <div className={styles.employeeConversionPage}>
      {/* 筛选器 */}
      <Card className={styles.filterCard} size="small">
        <div className={styles.filterRow}>
          {/* 日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>日期范围:</span>
            <DateRangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
            />
          </div>

          {/* 平台筛选 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>平台:</span>
            <Select
              mode="multiple"
              value={selectedPlatforms}
              onChange={setSelectedPlatforms}
              options={platformOptions.map((p) => ({ label: p, value: p }))}
              placeholder="全部平台"
              allowClear
              style={{ minWidth: 150 }}
              loading={optionsLoading}
              maxTagCount="responsive"
            />
          </div>

          {/* 员工筛选 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>服务人员:</span>
            <Select
              mode="multiple"
              value={selectedEmployees}
              onChange={setSelectedEmployees}
              options={employeeOptions.map((e) => ({ label: e, value: e }))}
              placeholder="全部人员"
              allowClear
              style={{ minWidth: 200 }}
              loading={optionsLoading}
              maxTagCount="responsive"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* 线索类型 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>线索类型:</span>
            <Select
              value={leadType}
              onChange={setLeadType}
              options={LEAD_TYPE_OPTIONS}
              style={{ width: 120 }}
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

      {/* 核心指标卡片 - 使用 MetricCard 保持与数据概览一致的风格 */}
      <div className={styles.metricsRow}>
        <MetricCard
          title="总线索数"
          value={data?.core_metrics?.total_leads || 0}
          formatter="number"
          icon={<UserOutlined style={{ color: '#f5222d' }} />}
          showWowChange={false}
        />
        <MetricCard
          title="开户数"
          value={data?.core_metrics?.total_opened || 0}
          formatter="number"
          icon={<TeamOutlined style={{ color: '#722ed1' }} />}
          showWowChange={false}
        />
        <MetricCard
          title="平均开户率"
          value={data?.core_metrics?.avg_opening_rate || 0}
          formatter="percent"
          icon={<RiseOutlined style={{ color: '#52c41a' }} />}
          showWowChange={false}
        />
        <MetricCard
          title="总资产"
          value={data?.core_metrics?.total_assets || 0}
          formatter="currency"
          icon={<DollarOutlined style={{ color: '#fa8c16' }} />}
          showWowChange={false}
        />
      </div>

      {/* v3.1 §四: 数据双口径对照 (员工明细口径 vs 渠道口径) */}
      <Card className={styles.chartCard} size='small' style={{ marginTop: 16 }}>
        <div className={styles.cardHeader}>
          <Text type='secondary' className={styles.cardTitle}>
            📊 数据双口径对照
          </Text>
          <Text type='secondary' className={styles.cardDesc}>
            员工明细 (fact_conv_content) vs 渠道口径 (agg_daily_channel_open，独立数据源)
          </Text>
        </div>
        <div className={styles.metricsRow}>
          <MetricCard title='员工明细·线索' value={channelOverview?.detail_caliber?.leads || 0} formatter='number' icon={<UserOutlined style={{ color: '#1890ff' }} />} showWowChange={false} />
          <MetricCard title='员工明细·开户' value={channelOverview?.detail_caliber?.opened || 0} formatter='number' icon={<TeamOutlined style={{ color: '#13c2c2' }} />} showWowChange={false} />
          <MetricCard title='员工明细·有效户' value={channelOverview?.detail_caliber?.valid || 0} formatter='number' icon={<RiseOutlined style={{ color: '#52c41a' }} />} showWowChange={false} />
          <MetricCard title='渠道口径·总开户' value={channelOverview?.channel_caliber?.opens || 0} formatter='number' icon={<DollarOutlined style={{ color: '#fa8c16' }} />} showWowChange={false} />
          <MetricCard title='渠道口径·总有效户' value={channelOverview?.channel_caliber?.valid || 0} formatter='number' icon={<RiseOutlined style={{ color: '#722ed1' }} />} showWowChange={false} />
        </div>
        <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          {channelOverview?.note || '两个口径数字不一致是正常的（按用户口径"独立数据源"），仅作参考并列展示。'}
        </div>
      </Card>

      {loading ? (
        <Spin spinning={loading} description="加载中...">
          <div style={{ height: 300 }} />
        </Spin>
      ) : (
        <>
          {/* 转化趋势图 */}
          <Card className={styles.chartCard}>
            <div className={styles.cardHeader}>
              <Text type="secondary" className={styles.cardTitle}>
                📊 整体转化走势（周度）
              </Text>
              <Text type="secondary" className={styles.cardDesc}>
                各周期转化数据趋势
              </Text>
            </div>
            {data?.conversion_trend?.weeks?.length ? (
              <EChartsComponent option={conversionTrendOption} height={300} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据，请选择日期范围后点击查询
              </div>
            )}
          </Card>

          {/* 员工转化率走势图 */}
          <Card className={styles.chartCard}>
            <div className={styles.cardHeader}>
              <Text type="secondary" className={styles.cardTitle}>
                📈 员工开户转化率走势
              </Text>
              <Text type="secondary" className={styles.cardDesc}>
                各员工转化率变化
              </Text>
              <Radio.Group
                value={rateTrendGranularity}
                onChange={(e) => setRateTrendGranularity(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
                style={{ marginLeft: 'auto' }}
              >
                <Radio.Button value="weekly">周</Radio.Button>
                <Radio.Button value="monthly">月</Radio.Button>
              </Radio.Group>
            </div>
            {trendLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                加载中...
              </div>
            ) : employeeRateTrendData?.periods?.length ? (
              <EChartsComponent option={employeeRateTrendOption} height={300} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 排行榜表格 */}
          <Card className={styles.tableCard}>
            <div className={styles.cardHeader}>
              <Text type="secondary" className={styles.cardTitle}>
                🏆 员工转化排行榜
              </Text>
              <Text type="secondary" className={styles.cardDesc}>
                共 {data?.ranking?.length || 0} 人
              </Text>
              <Space style={{ marginLeft: 'auto' }}>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  disabled={!data?.ranking?.length}
                >
                  导出CSV
                </Button>
              </Space>
            </div>
            <Table
              columns={rankingColumns}
              dataSource={data?.ranking || []}
              rowKey="employee_name"
              scroll={{ x: 1000 }}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default EmployeeConversionAnalysisPage;