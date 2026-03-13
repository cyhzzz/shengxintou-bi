/**
 * 员工转化分析页面
 * 分析员工维度的转化效果数据
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { Column, Line } from '@ant-design/charts';
import { DateRangePicker } from '@/components/Filter';
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

  // 筛选选项
  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 数据状态
  const [data, setData] = useState<EmployeeConversionAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

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

  // 加载数据
  const fetchData = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('请选择日期范围');
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        start_date: dateRange[0],
        end_date: dateRange[1],
        lead_type: leadType,
      };

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
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取员工转化分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedEmployees, leadType]);

  // 处理查询
  const handleSearch = () => {
    fetchData();
  };

  // 处理重置
  const handleReset = () => {
    setDateRange(['', '']);
    setSelectedPlatforms([]);
    setSelectedEmployees([]);
    setLeadType('all');
    setData(null);
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
    link.download = `员工转化排行_${dateRange[0]}_${dateRange[1]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 转化趋势柱状图配置
  const conversionTrendConfig = {
    data: data?.conversion_trend
      ? data.conversion_trend.weeks.map((week, index) => ({
          week,
          dateRange: data.conversion_trend?.dateRanges?.[index] || '',
          加微数: data.conversion_trend?.lead_users?.[index] || 0,
          开户数: data.conversion_trend?.opened_account_users?.[index] || 0,
        }))
      : [],
    xField: 'week',
    yField: '加微数',
    seriesField: 'type',
    isGroup: true,
    height: 300,
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      shared: true,
      showCrosshairs: true,
    },
  };

  // 员工转化率走势图配置
  const employeeRateTrendConfig = {
    data: data?.employee_rate_trend
      ? data.employee_rate_trend.map((item) => ({
          date: item.dateRange || item.week,
          value: item.opening_rate,
          category: item.employee_name,
        }))
      : [],
    xField: 'date',
    yField: 'value',
    seriesField: 'category',
    height: 300,
    smooth: true,
    point: {
      size: 3,
      shape: 'circle',
    },
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      shared: true,
      showCrosshairs: true,
    },
  };

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

      {/* 核心指标卡片 */}
      <Row gutter={16} className={styles.metricsRow}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="总线索数"
              value={data?.core_metrics?.total_leads || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="开户数"
              value={data?.core_metrics?.total_opened || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="平均开户率"
              value={data?.core_metrics?.avg_opening_rate || 0}
              suffix="%"
              precision={2}
              prefix={<RiseOutlined />}
              valueStyle={{
                color: (data?.core_metrics?.avg_opening_rate || 0) >= 10 ? '#52c41a' : '#666',
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="总资产"
              value={data?.core_metrics?.total_assets || 0}
              precision={2}
              prefix={<DollarOutlined />}
              formatter={(value) => `¥${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      {loading ? (
        <Spin spinning={loading} tip="加载中...">
          <div style={{ height: 300 }} />
        </Spin>
      ) : (
        <>
          {/* 转化趋势图 */}
          <Card className={styles.chartCard} title="转化趋势">
            {data?.conversion_trend?.weeks?.length ? (
              <Column
                {...conversionTrendConfig}
                data={[
                  ...conversionTrendConfig.data.map((d: Record<string, unknown>) => ({
                    ...d,
                    type: '加微数',
                  })),
                  ...conversionTrendConfig.data.map((d: Record<string, unknown>) => ({
                    ...d,
                    type: '开户数',
                    yField: '开户数',
                    加微数: undefined,
                    yValue: d['开户数'],
                  })),
                ]}
                xField="week"
                yField="加微数"
                isGroup={true}
                seriesField="type"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据，请选择日期范围后点击查询
              </div>
            )}
          </Card>

          {/* 员工转化率走势图 */}
          <Card className={styles.chartCard} title="员工转化率走势">
            {data?.employee_rate_trend?.length ? (
              <Line {...employeeRateTrendConfig} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 排行榜表格 */}
          <Card className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <span className={styles.tableTitle}>员工转化排行榜</span>
              <Space>
                <span className={styles.statText}>
                  共 {data?.ranking?.length || 0} 人
                </span>
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