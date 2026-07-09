/**
 * 员工转化分析页面 (Bug 4 修复)
 *
 * Bug 4 修复:
 * 1. 后端响应 trend 包成 {weeks:[], periods:[]} 结构，前端按新结构取数
 * 2. 之前 fetchEmployeeRateTrendOnly 函数未定义导致 React 报错卡死
 *    -> 现在粒度切换直接走 fetchData，不再调用未定义函数
 * 3. 整体走势 + 员工开户转化率走势图都能正常渲染
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Select, Button, Space, message, Spin, Radio, Typography, Row, Col, Tag, Empty,
} from 'antd';
import {
  UserOutlined, TeamOutlined, DollarOutlined, RiseOutlined,
  DownloadOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import MetricCard from '@/pages/Dashboard/components/MetricCard';
const { Text } = Typography;
import type { EChartsOption } from 'echarts';
import EChartsComponent from '@/components/Chart/ECharts';
import { DateRangePicker } from '@/components/Filter';
import { http } from '@/services/http';
import styles from './Analysis.module.scss';

const LEAD_TYPE_OPTIONS = [
  { label: '全部线索', value: 'all' },
  { label: '存量线索', value: 'existing' },
  { label: '新增线索', value: 'new' },
];

interface TrendItem {
  period: string;
  leads: number;
  opened: number;
  valid: number;
}
interface ApiShape {
  conversion_trend: { weeks: TrendItem[] } | TrendItem[];
  employee_rate_trend: { periods: TrendItem[] } | TrendItem[];
  ranking: any[];
  core_metrics: any;
  platform_overview: any[];
  channel_overview?: any;
}

const EmployeeConversionAnalysisPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [leadType, setLeadType] = useState<string>('all');
  const [rateTrendGranularity, setRateTrendGranularity] = useState<'weekly' | 'monthly'>('weekly');

  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [data, setData] = useState<ApiShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [channelOverview, setChannelOverview] = useState<any>(null);

  const loadFilterOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res: any = await http.get('/employee-conversion/filter-options');
      if (res?.success && res.data) {
        setPlatformOptions(res.data.platforms || []);
        setEmployeeOptions(res.data.employees || []);
      }
    } catch (err) {
      console.error('load filter options failed', err);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        lead_type: leadType,
        granularity: rateTrendGranularity,
      };
      if (dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0];
        params.end_date = dateRange[1];
      }
      if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms;
      if (selectedEmployees.length > 0) params.employees = selectedEmployees;

      const res: any = await http.post('/employee-conversion/analysis', params);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        message.error(res?.message || '加载数据失败');
      }
    } catch (err) {
      console.error('analysis fetch failed', err);
      message.error('加载数据异常');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedEmployees, leadType, rateTrendGranularity]);

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
    } catch (err) {
      console.warn('channel overview fetch failed', err);
    }
  }, [dateRange, selectedEmployees, leadType]);

  // 初始加载 + 任何筛选项变化都重取
  useEffect(() => {
    fetchData();
    fetchChannelOverview();
  }, [fetchData, fetchChannelOverview]);

  // Bug 4 关键修复: 之前监听 rateTrendGranularity 调 fetchEmployeeRateTrendOnly 未定义
  // 改: 上面 useEffect 已包含 fetchData 依赖 granularity，自动重取
  // 单独写一个 useEffect 不需要了（fetchData 已通过 useCallback 依赖 granularity）

  // 取数辅助: 兼容新旧两种格式
  const conversionTrendItems: TrendItem[] = useMemo(() => {
    const v: any = data?.conversion_trend;
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.weeks)) return v.weeks;
    return [];
  }, [data]);

  const rateTrendItems: TrendItem[] = useMemo(() => {
    const v: any = data?.employee_rate_trend;
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.periods)) return v.periods;
    return [];
  }, [data]);

  // 整体走势 option
  const conversionTrendOption: EChartsOption = useMemo(() => {
    if (!conversionTrendItems.length) return {};
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => Number(v || 0).toLocaleString() },
      legend: { data: ['线索量', '开户量', '有效户'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: conversionTrendItems.map((t) => t.period), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '人数' },
      series: [
        { name: '线索量', type: 'bar', itemStyle: { color: '#1890ff' }, data: conversionTrendItems.map((t) => t.leads) },
        { name: '开户量', type: 'bar', itemStyle: { color: '#fa8c16' }, data: conversionTrendItems.map((t) => t.opened) },
        { name: '有效户', type: 'bar', itemStyle: { color: '#52c41a' }, data: conversionTrendItems.map((t) => t.valid) },
      ],
    };
  }, [conversionTrendItems]);

  // 员工开户转化率走势 option (基于 weekly/monthly 的 trend)
  const employeeRateTrendOption: EChartsOption = useMemo(() => {
    if (!rateTrendItems.length) return {};
    const rates = rateTrendItems.map((t) => (t.leads > 0 ? Number(((t.opened / t.leads) * 100).toFixed(2)) : 0));
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
      legend: { data: ['员工开户转化率'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: rateTrendItems.map((t) => t.period), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '转化率(%)', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: '员工开户转化率', type: 'line', smooth: true,
          itemStyle: { color: '#722ed1' }, lineStyle: { width: 3 },
          areaStyle: { color: 'rgba(114,46,209,0.15)' },
          symbol: 'circle', symbolSize: 6,
          data: rates,
          label: { show: true, formatter: (p: any) => `${p.value}%`, position: 'top', fontSize: 11 },
        },
      ],
    };
  }, [rateTrendItems]);

  const handleSearch = () => {
    fetchData();
    fetchChannelOverview();
  };

  const handleReset = () => {
    setDateRange(['', '']);
    setSelectedPlatforms([]);
    setSelectedEmployees([]);
    setLeadType('all');
  };

  const exportRanking = () => {
    const ranking = data?.ranking || [];
    if (!ranking.length) return;
    const headers = ['员工姓名', '平台', '线索量', '开口量', '有效线索', '开户量', '有效户', '开户率%', '资产'];
    const rows = ranking.map((r: any) => [
      r.employee_name, r.platform, r.total_leads, r.mouth_count, r.valid_lead_count,
      r.opened_count, r.valid_customer_count, r.opening_rate, r.total_assets,
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `员工转化分析_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rankingColumns = [
    { title: '排名', width: 60, align: 'center' as const, render: (_: any, __: any, idx: number) => (
      <Tag color={idx < 3 ? 'gold' : idx < 10 ? 'blue' : 'default'}>{idx + 1}</Tag>
    ) },
    { title: '员工姓名', dataIndex: 'employee_name', width: 100 },
    { title: '平台', dataIndex: 'platform', width: 90 },
    { title: '线索量', dataIndex: 'total_leads', align: 'right' as const, sorter: (a: any, b: any) => a.total_leads - b.total_leads },
    { title: '开口量', dataIndex: 'mouth_count', align: 'right' as const },
    { title: '有效线索', dataIndex: 'valid_lead_count', align: 'right' as const },
    { title: '开户量', dataIndex: 'opened_count', align: 'right' as const, sorter: (a: any, b: any) => a.opened_count - b.opened_count },
    { title: '有效户', dataIndex: 'valid_customer_count', align: 'right' as const },
    { title: '开户率%', dataIndex: 'opening_rate', align: 'right' as const, sorter: (a: any, b: any) => a.opening_rate - b.opening_rate, render: (v: number) => (
      <span style={{ color: v > 30 ? '#52c41a' : v > 10 ? '#fa8c16' : '#999' }}>{v?.toFixed(2)}%</span>
    ) },
    { title: '总资产', dataIndex: 'total_assets', align: 'right' as const, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
  ];

  return (
    <div className={styles.employeeConversionPage}>
      <Card className={styles.filterCard} size='small'>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>日期:</span>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>平台:</span>
            <Select mode='multiple' allowClear placeholder='全部' value={selectedPlatforms}
              onChange={setSelectedPlatforms} loading={optionsLoading}
              options={platformOptions.map((p) => ({ label: p, value: p }))}
              style={{ minWidth: 180 }} maxTagCount='responsive' />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>员工:</span>
            <Select mode='multiple' allowClear placeholder='全部' value={selectedEmployees}
              onChange={setSelectedEmployees} loading={optionsLoading}
              options={employeeOptions.map((e) => ({ label: e, value: e }))}
              style={{ minWidth: 180 }} maxTagCount='responsive' showSearch />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>线索类型:</span>
            <Radio.Group value={leadType} onChange={(e) => setLeadType(e.target.value)} optionType='button' buttonStyle='solid'>
              {LEAD_TYPE_OPTIONS.map((o) => <Radio.Button key={o.value} value={o.value}>{o.label}</Radio.Button>)}
            </Radio.Group>
          </div>
          <div className={styles.filterActions}>
            <Button type='primary' icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </div>
        </div>
      </Card>

      {/* 顶部核心指标 */}
      <div className={styles.metricsRow} style={{ marginTop: 16 }}>
        <MetricCard title='总线索' value={data?.core_metrics?.total_leads || 0} formatter='number' icon={<UserOutlined style={{ color: '#1890ff' }} />} />
        <MetricCard title='总开口' value={data?.core_metrics?.total_mouth || 0} formatter='number' icon={<UserOutlined style={{ color: '#13c2c2' }} />} />
        <MetricCard title='总开户' value={data?.core_metrics?.total_opened || 0} formatter='number' icon={<TeamOutlined style={{ color: '#fa8c16' }} />} />
        <MetricCard title='总有效户' value={data?.core_metrics?.total_valid_customer || 0} formatter='number' icon={<RiseOutlined style={{ color: '#52c41a' }} />} />
      </div>

      {/* 双源对比卡片 */}
      {channelOverview && (
        <Card size='small' style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <Text strong>📊 双源数据对比（员工明细 vs 渠道口径）</Text>
            <Tag color='blue'>{channelOverview.detail_caliber?.source || 'fact_conv_content'}</Tag>
            <Tag color='orange'>{channelOverview.channel_caliber?.source || 'agg_daily_channel_open'}</Tag>
          </div>
          <Row gutter={16}>
            <Col span={5}><MetricCard title='明细·线索' value={channelOverview.detail_caliber?.leads || 0} formatter='number' icon={<UserOutlined />} /></Col>
            <Col span={5}><MetricCard title='明细·开户' value={channelOverview.detail_caliber?.opened || 0} formatter='number' icon={<TeamOutlined />} /></Col>
            <Col span={5}><MetricCard title='明细·有效户' value={channelOverview.detail_caliber?.valid || 0} formatter='number' icon={<RiseOutlined />} /></Col>
            <Col span={5}><MetricCard title='渠道·总开户' value={channelOverview.channel_caliber?.opens || 0} formatter='number' icon={<DollarOutlined />} /></Col>
            <Col span={4}><MetricCard title='渠道·总有效户' value={channelOverview.channel_caliber?.valid || 0} formatter='number' icon={<RiseOutlined />} /></Col>
          </Row>
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            {channelOverview.note || '两个口径数字不一致是正常的（按用户口径"独立数据源"），仅作参考并列展示。'}
          </div>
        </Card>
      )}

      <Spin spinning={loading}>
        {/* 整体走势 */}
        <Card className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <Text type='secondary' className={styles.cardTitle}>📊 整体转化走势（月度）</Text>
            <Text type='secondary' className={styles.cardDesc}>各周期线索/开户/有效户趋势</Text>
          </div>
          {conversionTrendItems.length ? (
            <EChartsComponent option={conversionTrendOption} height={300} />
          ) : (
            <Empty description='暂无走势数据' />
          )}
        </Card>

        {/* 员工开户转化率走势 */}
        <Card className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <Text type='secondary' className={styles.cardTitle}>📈 员工开户转化率走势</Text>
            <Text type='secondary' className={styles.cardDesc}>按周/月汇总</Text>
            <Radio.Group
              value={rateTrendGranularity}
              onChange={(e) => setRateTrendGranularity(e.target.value)}
              size='small' optionType='button' buttonStyle='solid' style={{ marginLeft: 'auto' }}
            >
              <Radio.Button value='weekly'>周</Radio.Button>
              <Radio.Button value='monthly'>月</Radio.Button>
            </Radio.Group>
          </div>
          {rateTrendItems.length ? (
            <EChartsComponent option={employeeRateTrendOption} height={300} />
          ) : (
            <Empty description='暂无转化率数据' />
          )}
        </Card>

        {/* 排行榜 */}
        <Card className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <Text type='secondary' className={styles.cardTitle}>🏆 员工转化排行榜</Text>
            <Text type='secondary' className={styles.cardDesc}>共 {data?.ranking?.length || 0} 人</Text>
            <Space style={{ marginLeft: 'auto' }}>
              <Button icon={<DownloadOutlined />} onClick={exportRanking} disabled={!data?.ranking?.length}>导出 CSV</Button>
            </Space>
          </div>
          <Table
            columns={rankingColumns}
            dataSource={data?.ranking || []}
            rowKey={(r: any) => `${r.employee_name}-${r.platform}`}
            scroll={{ x: 1100 }}
            pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`, pageSizeOptions: ['10', '20', '50', '100'] }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default EmployeeConversionAnalysisPage;
