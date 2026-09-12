/**
 * 应用市场 · 归因转化率分析（v3.8.1）
 * 数据源: fact_conv_appmarket 数据库表（1 行=1 APP 下载）
 * 按周（周一~周日）聚合各步骤转化率：
 *   激活 → 开户注册 → 身份证 → 银行卡 → 提交开户 → 开户成功 → 广告开户
 *
 * 布局：
 *   1. 筛选器（FilterBar 日期范围 + 平台单选）
 *   2. 周度转化率趋势折线图（6 个独立量程，支持按应用市场筛选）
 *   3. 归因转化率明细（按周折叠，可展开查看每日，降序排列）
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Spin, Table, Tag, Select, Button, Space } from 'antd';
import { RiseOutlined } from '@ant-design/icons';
import EChartsComponent from '@/components/Chart/ECharts';
import { FadeInSection, ReportFooter, FilterBar } from '@/components';
import { dataServiceReports } from '@/services/dataService';
import { useReportData } from '@/hooks/useReportData';
import { useFilterStore } from '@/stores';
import type { EChartsOption } from 'echarts';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import styles from './index.module.scss';

// 转化率颜色（高绿中橙低红）
function rateColor(rate: number): string {
  if (rate >= 0.5) return '#52c41a';
  if (rate >= 0.2) return '#faad14';
  if (rate > 0) return '#ff4d4f';
  return '#999';
}

function fmtRate(rate: number): string {
  if (!rate || rate === 0) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

interface DailyRow {
  date: string;
  weekday: string;
  week_start: string;
  activate: number;
  register: number;
  id_card: number;
  bank_card: number;
  submit: number;
  success: number;
  rate_activate_register: number;
  rate_register_idcard: number;
  rate_idcard_bankcard: number;
  rate_bankcard_submit: number;
  rate_submit_success: number;
  ad_account: number;
  rate_success_adaccount: number;
}

interface WeeklyRow {
  week_start: string;
  week_end: string;
  activate: number;
  register: number;
  id_card: number;
  bank_card: number;
  submit: number;
  success: number;
  rate_activate_register: number;
  rate_register_idcard: number;
  rate_idcard_bankcard: number;
  rate_bankcard_submit: number;
  rate_submit_success: number;
  ad_account: number;
  rate_success_adaccount: number;
}

// 树形表格行：周合计为父行，每日数据为子行
interface TableRow {
  key: string;
  rowType: 'daily' | 'weekly';
  date: string;
  weekday: string;
  weekLabel: string;
  activate: number;
  register: number;
  id_card: number;
  bank_card: number;
  submit: number;
  success: number;
  rate_activate_register: number;
  rate_register_idcard: number;
  rate_idcard_bankcard: number;
  rate_bankcard_submit: number;
  rate_submit_success: number;
  ad_account: number;
  rate_success_adaccount: number;
  children?: TableRow[];
}

/**
 * 构建树形数据：周合计为父行（降序），每日数据为子行（降序）
 */
function buildTreeData(daily: DailyRow[], weekly: WeeklyRow[]): TableRow[] {
  // 周合计按 week_start 降序排列（最近的周在最上面）
  const weeklySorted = [...weekly].sort((a, b) =>
    b.week_start.localeCompare(a.week_start)
  );

  return weeklySorted.map((w) => {
    // 找到该周对应的每日数据，按日期降序排列
    const dailyChildren: TableRow[] = daily
      .filter((d) => d.week_start === w.week_start)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({
        key: `daily-${d.date}`,
        rowType: 'daily' as const,
        date: dayjs(d.date).format('MM/DD'),
        weekday: d.weekday,
        weekLabel: d.week_start,
        activate: d.activate,
        register: d.register,
        id_card: d.id_card,
        bank_card: d.bank_card,
        submit: d.submit,
        success: d.success,
        rate_activate_register: d.rate_activate_register,
        rate_register_idcard: d.rate_register_idcard,
        rate_idcard_bankcard: d.rate_idcard_bankcard,
        rate_bankcard_submit: d.rate_bankcard_submit,
        rate_submit_success: d.rate_submit_success,
        ad_account: d.ad_account,
        rate_success_adaccount: d.rate_success_adaccount,
      }));

    return {
      key: `weekly-${w.week_start}`,
      rowType: 'weekly' as const,
      date: `${dayjs(w.week_start).format('MM/DD')} - ${dayjs(w.week_end).format('MM/DD')}`,
      weekday: '本周合计',
      weekLabel: w.week_start,
      activate: w.activate,
      register: w.register,
      id_card: w.id_card,
      bank_card: w.bank_card,
      submit: w.submit,
      success: w.success,
      rate_activate_register: w.rate_activate_register,
      rate_register_idcard: w.rate_register_idcard,
      rate_idcard_bankcard: w.rate_idcard_bankcard,
      rate_bankcard_submit: w.rate_bankcard_submit,
      rate_submit_success: w.rate_submit_success,
      ad_account: w.ad_account,
      rate_success_adaccount: w.rate_success_adaccount,
      children: dailyChildren,
    };
  });
}

interface AttributionQuery {
  start_date: string;
  end_date: string;
  platform: string;
}

const fetchAttributionConversion = async (query: AttributionQuery): Promise<any> => {
  const res: any = await dataServiceReports.getAppMarketAttributionConversion({
    start_date: query.start_date,
    end_date: query.end_date,
    platforms: query.platform === '全部' ? [] : [query.platform],
  });
  if (!res?.success || !res.data) throw new Error(res?.message || '加载归因转化率失败');
  return res.data;
};

const AttributionConversionPage: React.FC = () => {
  const { dateRange } = useFilterStore();
  const [platform, setPlatform] = useState<string>('全部');
  // 控制表格展开的行 key（周合计行）
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const { data, loading, load } = useReportData(fetchAttributionConversion, {
    errorMessage: '加载归因转化率失败',
  });

  useEffect(() => {
    load({ start_date: dateRange.startDate, end_date: dateRange.endDate, platform });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate, platform]);

  // 数据更新后重置展开状态
  useEffect(() => {
    setExpandedKeys([]);
  }, [data]);

  // 树形表格数据
  const tableData = useMemo<TableRow[]>(() => {
    if (!data?.daily_data) return [];
    return buildTreeData(data.daily_data, data.weekly_data || []);
  }, [data]);

  // 所有周合计行的 key（用于展开全部/收起全部）
  const allParentKeys = useMemo(
    () => tableData.map((r) => r.key),
    [tableData]
  );
  const allExpanded =
    expandedKeys.length === allParentKeys.length && allParentKeys.length > 0;

  // 周度数据按 week_start 升序排列用于 X 轴（折线图从左到右时间递增）
  const sortedWeekly = useMemo(() => {
    if (!data?.weekly_data?.length) return [];
    return [...data.weekly_data].sort((a: WeeklyRow, b: WeeklyRow) =>
      a.week_start.localeCompare(b.week_start)
    );
  }, [data]);

  const weeks = useMemo(
    () => sortedWeekly.map((w: WeeklyRow) =>
      `${dayjs(w.week_start).format('MM/DD')}~${dayjs(w.week_end).format('MM/DD')}`
    ),
    [sortedWeekly]
  );

  // 通用 tooltip formatter
  const tooltipFormatter = (params: any) => {
    const lines = params.map((p: any) => {
      const val = p.value as number;
      return `${p.marker} ${p.seriesName}: <strong>${Math.round(val * 100)}%</strong>`;
    });
    return `${params[0].axisValue}<br/>${lines.join('<br/>')}`;
  };

  // 6 个步骤定义（各自独立 Y 轴量程，量程按数据动态计算）
  const rateSteps = [
    { name: '激活→开户注册', key: 'rate_activate_register', color: '#E15759' },
    { name: '开户注册→身份证', key: 'rate_register_idcard', color: '#4E79A7' },
    { name: '身份证→银行卡', key: 'rate_idcard_bankcard', color: '#59A14F' },
    { name: '银行卡→提交开户', key: 'rate_bankcard_submit', color: '#F28E2B' },
    { name: '提交开户→开户成功', key: 'rate_submit_success', color: '#B07AA1' },
    { name: '开户成功→广告开户', key: 'rate_success_adaccount', color: '#76B7B2' },
  ];

  // 生成单条折线图的 option（每个步骤独立量程 + 数据标注）
  // Y 轴上下限动态计算：上限 = 最大值 + 10%，下限 = 最低值 - 10%（限制在比率区间 [0,1]）
  const buildChartOption = useCallback((step: typeof rateSteps[number]): EChartsOption => {
    if (!sortedWeekly.length) return {};
    const values = sortedWeekly.map((w: WeeklyRow) => w[step.key as keyof WeeklyRow] as number);
    const dataMax = Math.max(...values);
    const dataMin = Math.min(...values);
    let yMax = Math.min(1, +(dataMax * 1.1).toFixed(4));
    let yMin = Math.max(0, +(dataMin * 0.9).toFixed(4));
    // 防止数据过平时量程退化：保证至少 10% 的显示窗口
    if (yMax - yMin < 0.1) {
      const mid = (dataMax + dataMin) / 2;
      yMax = Math.min(1, +(mid + 0.05).toFixed(4));
      yMin = Math.max(0, +(mid - 0.05).toFixed(4));
    }
    const yAxis: any = {
      type: 'value',
      min: yMin,
      max: yMax,
      axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` },
      splitLine: { show: true, lineStyle: { type: 'dashed', color: '#e8e8e8' } },
    };
    return {
      tooltip: { trigger: 'axis', formatter: tooltipFormatter },
      grid: { left: 55, right: 20, top: 15, bottom: 28 },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { rotate: 45, fontSize: 10, hideOverlap: true },
      },
      yAxis,
      series: [{
        name: step.name,
        type: 'line',
        data: sortedWeekly.map((w: WeeklyRow) => w[step.key as keyof WeeklyRow] as number),
        itemStyle: { color: step.color },
        lineStyle: { width: 2.5, color: step.color },
        symbol: 'circle',
        symbolSize: 6,
        smooth: true,
        // 数据点标注：XX%（无小数）
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: step.color,
          fontWeight: 'bold',
          formatter: (p: any) => `${Math.round(p.value * 100)}%`,
        },
      }],
    };
  }, [sortedWeekly, weeks]);

  // 6 个图表 option
  const chartOptions = useMemo(
    () => rateSteps.map((s) => buildChartOption(s)),
    [buildChartOption]
  );

  // 表格列定义
  const columns: ColumnsType<TableRow> = [
    {
      title: '下载日期',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      fixed: 'left',
      render: (v: string, row: TableRow) =>
        row.rowType === 'weekly' ? (
          <strong style={{ color: '#333' }}>{v}</strong>
        ) : (
          <span style={{ color: '#666' }}>{v}</span>
        ),
    },
    {
      title: '星期',
      dataIndex: 'weekday',
      key: 'weekday',
      width: 80,
      fixed: 'left',
      render: (v: string, row: TableRow) =>
        row.rowType === 'weekly' ? (
          <Tag color="blue">{v}</Tag>
        ) : (
          v
        ),
    },
    { title: '激活', dataIndex: 'activate', key: 'activate', width: 80, align: 'center' as const,
      sorter: (a, b) => a.activate - b.activate },
    { title: '开户注册', dataIndex: 'register', key: 'register', width: 90, align: 'center' as const },
    { title: '身份证', dataIndex: 'id_card', key: 'id_card', width: 80, align: 'center' as const },
    { title: '银行卡', dataIndex: 'bank_card', key: 'bank_card', width: 80, align: 'center' as const },
    { title: '提交开户', dataIndex: 'submit', key: 'submit', width: 90, align: 'center' as const },
    { title: '开户成功', dataIndex: 'success', key: 'success', width: 90, align: 'center' as const },
    { title: '广告开户', dataIndex: 'ad_account', key: 'ad_account', width: 90, align: 'center' as const },
    {
      title: '激活→开户注册',
      dataIndex: 'rate_activate_register',
      key: 'rate_activate_register',
      width: 120,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
    {
      title: '开户注册→身份证',
      dataIndex: 'rate_register_idcard',
      key: 'rate_register_idcard',
      width: 130,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
    {
      title: '身份证→银行卡',
      dataIndex: 'rate_idcard_bankcard',
      key: 'rate_idcard_bankcard',
      width: 120,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
    {
      title: '银行卡→提交开户',
      dataIndex: 'rate_bankcard_submit',
      key: 'rate_bankcard_submit',
      width: 130,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
    {
      title: '提交开户→开户成功',
      dataIndex: 'rate_submit_success',
      key: 'rate_submit_success',
      width: 140,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
    {
      title: '开户成功→广告开户',
      dataIndex: 'rate_success_adaccount',
      key: 'rate_success_adaccount',
      width: 150,
      align: 'center' as const,
      render: (v: number, row: TableRow) => (
        <span style={{ color: rateColor(v), fontWeight: row.rowType === 'weekly' ? 'bold' : 'normal' }}>
          {fmtRate(v)}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {/* 筛选器：FilterBar（日期范围 + 查询/重置）+ 平台单选 */}
      <FadeInSection>
        <FilterBar
          showPlatform={false}
          showAgency={false}
          onSearch={() => load({ start_date: dateRange.startDate, end_date: dateRange.endDate, platform })}
          onReset={() => load({ start_date: dateRange.startDate, end_date: dateRange.endDate, platform })}
        />
        <Card size="small" style={{ marginBottom: 16, marginTop: 8 }}>
          <Space wrap>
            <span style={{ color: 'var(--color-text-secondary)' }}>应用市场:</span>
            <Select
              value={platform}
              onChange={setPlatform}
              style={{ width: 140 }}
              options={[
                { value: '全部', label: '全部应用市场' },
                ...(data?.platforms || []).map((p: string) => ({
                  value: p,
                  label: p,
                })),
              ]}
            />
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        {/* 1. 周度转化率趋势折线图（最上方） */}
        <FadeInSection>
          <Card
            title={
              <span>
                <RiseOutlined style={{ marginRight: 8 }} />
                周度转化率趋势
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
            extra={<Tag color="blue">{platform}</Tag>}
          >
            {data?.weekly_data?.length ? (
              <>
                {rateSteps.map((step, i) => (
                  <div key={step.key} style={{ marginBottom: i < rateSteps.length - 1 ? 14 : 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, marginBottom: 2, paddingLeft: 8,
                      color: step.color, borderLeft: `3px solid ${step.color}`,
                    }}>
                      {step.name}
                    </div>
                    <EChartsComponent option={chartOptions[i]} style={{ height: 200 }} />
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无周度数据</div>
            )}
          </Card>
        </FadeInSection>

        {/* 2. 归因转化率明细（按周折叠，降序排列） */}
        <FadeInSection>
          <Card
            title={
              <span>
                <RiseOutlined style={{ marginRight: 8 }} />
                归因转化率明细（按周折叠 · 由近到远）
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <span style={{ color: '#999', fontSize: 12 }}>
                  共 {allParentKeys.length} 周
                </span>
                <Button
                  size="small"
                  onClick={() => {
                    setExpandedKeys(allExpanded ? [] : allParentKeys);
                  }}
                >
                  {allExpanded ? '收起全部' : '展开全部'}
                </Button>
              </Space>
            }
          >
            <Table<TableRow>
              dataSource={tableData}
              columns={columns}
              rowKey="key"
              size="small"
              pagination={false}
              scroll={{ x: 1400, y: 600 }}
              expandable={{
                expandedRowKeys: expandedKeys,
                onExpandedRowsChange: (keys: readonly React.Key[]) => setExpandedKeys([...keys]),
              }}
              rowClassName={(row: TableRow) =>
                row.rowType === 'weekly' ? 'weekly-summary-row' : 'daily-row'
              }
            />
          </Card>
        </FadeInSection>

        <FadeInSection>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'fact_conv_appmarket 数据库表（1 行=1 APP 下载）' },
              { label: '端点', value: 'POST /api/v1/reports/app-market/attribution-conversion' },
              { label: '口径', value: '按下载日期做下载 cohort（与应用市场漏斗口径一致，避免按开户完成时间切出的幸存者偏差），统计各步骤"是"的数量；转化率 = 下一步数量 ÷ 上一步数量；周按周一~周日划分。"开户成功→广告开户"为复合节点：是否创建完资金账号=是 且 渠道类型=互联网引流 且 是否新开户=是' },
              { label: '移动端', value: '已支持（mobileRouteHandler 同步实现）' },
            ]}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default AttributionConversionPage;
