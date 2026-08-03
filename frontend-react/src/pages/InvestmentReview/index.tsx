/**
 * 投放评审页面 (v3.3.10)
 *
 * 需求：按厂商分表展示月度数据，便于导出"信息流广告：XX 厂商 1 月初至 7 月 15 日数据明细表"
 * 数据源：agg_vendor_daily（与厂商分析共用）
 * 端点：GET /api/v1/investment-review
 *
 * 展示形态：按厂商分表（每个厂商一个 Card，含趋势图 + 月度明细表）
 * 指标切换：消耗 / 企微 / 开口 / 开户 / 加微成本 / 开户成本
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Segmented, Button, Spin, Table, Empty, Tooltip } from 'antd';
import { DownloadOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { EChartsOption } from 'echarts';
import { FilterBar, FadeInSection } from '@/components';
import { ReportFooter } from '@/components/ReportFooter';
import EChartsComponent from '@/components/Chart/ECharts';
import { useFilterStore } from '@/stores';
import { http } from '@/services/http';
import { pickEChartsColor } from '@/utils/echartsColors';
import styles from './index.module.scss';

type MetricType = 'cost' | 'leads' | 'opened_conversation' | 'opened_account' | 'lead_cost' | 'account_cost' | 'app_activation' | 'app_activation_cost';

const METRIC_LABELS: Record<MetricType, string> = {
  cost: '消耗',
  leads: '企微',
  opened_conversation: '开口',
  opened_account: '开户',
  lead_cost: '加微成本',
  account_cost: '开户成本',
  app_activation: 'APP激活',
  app_activation_cost: 'APP激活成本',
};

interface MonthRow {
  month: string;
  cost: number;
  leads: number;
  opened_conversation: number;
  opened_account: number;
  lead_cost: number | null;
  account_cost: number | null;
  // v3.7.1：APP 下载链路指标
  app_activation: number;
  app_activation_cost: number | null;
  is_total?: boolean;
}

interface ApiResponse {
  success: boolean;
  data: {
    agencies: string[];
    agency_short_map: Record<string, string>;
    monthly: Record<string, MonthRow[]>;
    trend: Record<string, MonthRow[]>;
    meta: { agency_count: number; month_count: number };
  };
}

const InvestmentReviewPage: React.FC = () => {
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const { dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels } = useFilterStore();

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (dateRange.startDate && dateRange.endDate) {
      params.start_date = dateRange.startDate;
      params.end_date = dateRange.endDate;
    }
    if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms.join(',');
    if (selectedAgencies.length > 0) params.agencies = selectedAgencies.join(',');
    if (selectedBusinessModels.length > 0) params.business_models = selectedBusinessModels.join(',');
    return params;
  }, [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await http.get('/investment-review', buildParams())) as unknown as ApiResponse;
      if (res?.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('[InvestmentReview] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildTrendOption = useCallback(
    (agency: string): EChartsOption => {
      const rows = data?.trend[agency] || [];
      if (!rows.length) {
        return {
          title: {
            text: '暂无趋势数据',
            left: 'center',
            top: 'middle',
            textStyle: { color: '#999', fontSize: 14 },
          },
        };
      }
      const months = rows.map((r) => r.month);
      const values = rows.map((r) => {
        const v = r[metric];
        return v == null ? 0 : Number(v);
      });
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter: (v: any) => {
            const n = Number(v || 0);
            return metric === 'cost' || metric === 'lead_cost' || metric === 'account_cost'
              ? `¥${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : n.toLocaleString();
          },
        },
        // v3.3.10: 单系列柱状图不需要图例
        legend: { show: false },
        grid: { left: '3%', right: '4%', bottom: '8%', top: '12%', containLabel: true },
        xAxis: {
          type: 'category',
          data: months,
          axisLabel: { fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          name: METRIC_LABELS[metric],
          nameTextStyle: { fontSize: 12, color: '#8a8d99' },
          axisLabel: {
            formatter: (v: number) =>
              metric === 'cost' && v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v.toFixed(0),
          },
        },
        series: [
          {
            name: METRIC_LABELS[metric],
            type: 'bar',
            barMaxWidth: 32,
            itemStyle: { color: pickEChartsColor(0) },
            data: values,
          },
        ],
      };
    },
    [data, metric],
  );

  const columns: ColumnsType<MonthRow> = useMemo(
    () => [
      {
        title: '月份',
        dataIndex: 'month',
        key: 'month',
        width: 100,
        render: (v: string, r) => (r.is_total ? <strong>{v}</strong> : v),
      },
      {
        title: '消耗',
        dataIndex: 'cost',
        key: 'cost',
        width: 130,
        align: 'right',
        render: (v: number, r) =>
          r.is_total ? (
            <strong>{`¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</strong>
          ) : (
            `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          ),
      },
      {
        title: '企微',
        dataIndex: 'leads',
        key: 'leads',
        width: 80,
        align: 'right',
        render: (v: number, r) => (r.is_total ? <strong>{v}</strong> : v),
      },
      {
        title: '开口',
        dataIndex: 'opened_conversation',
        key: 'opened_conversation',
        width: 80,
        align: 'right',
        render: (v: number, r) => (r.is_total ? <strong>{v}</strong> : v),
      },
      {
        title: '开户',
        dataIndex: 'opened_account',
        key: 'opened_account',
        width: 80,
        align: 'right',
        render: (v: number, r) => (r.is_total ? <strong>{v}</strong> : v),
      },
      {
        title: 'APP激活',
        dataIndex: 'app_activation',
        key: 'app_activation',
        width: 90,
        align: 'right',
        render: (v: number, r) => (r.is_total ? <strong>{v}</strong> : v),
      },
      {
        title: '加微成本',
        dataIndex: 'lead_cost',
        key: 'lead_cost',
        width: 110,
        align: 'right',
        render: (v: number | null, r) => {
          if (v == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
          const text = `¥${Number(v).toFixed(2)}`;
          return r.is_total ? <strong>{text}</strong> : text;
        },
      },
      {
        title: '开户成本',
        dataIndex: 'account_cost',
        key: 'account_cost',
        width: 110,
        align: 'right',
        render: (v: number | null, r) => {
          if (v == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
          const text = `¥${Number(v).toFixed(2)}`;
          return r.is_total ? <strong>{text}</strong> : text;
        },
      },
      {
        title: 'APP激活成本',
        dataIndex: 'app_activation_cost',
        key: 'app_activation_cost',
        width: 120,
        align: 'right',
        render: (v: number | null, r) => {
          if (v == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
          const text = `¥${Number(v).toFixed(2)}`;
          return r.is_total ? <strong>{text}</strong> : text;
        },
      },
    ],
    [],
  );

  const exportCsv = (agency: string) => {
    const rows = data?.monthly[agency] || [];
    if (!rows.length) return;
    const headers = ['月份', '消耗', '企微', '开口', '开户', 'APP激活', '加微成本', '开户成本', 'APP激活成本'];
    const csvRows = rows.map((r) => [
      r.month,
      r.cost,
      r.leads,
      r.opened_conversation,
      r.opened_account,
      r.app_activation,
      r.lead_cost ?? '',
      r.account_cost ?? '',
      r.app_activation_cost ?? '',
    ]);
    const csv = '\ufeff' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const short = data?.agency_short_map[agency] || agency;
    const range =
      dateRange.startDate && dateRange.endDate
        ? `${dateRange.startDate}_${dateRange.endDate}`
        : 'all';
    link.href = url;
    link.download = `投放评审_${short}_${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAllCsv = () => {
    if (!data) return;
    const headers = ['月份', '消耗', '企微', '开口', '开户', 'APP激活', '加微成本', '开户成本', 'APP激活成本'];
    const lines: string[] = [headers.join(',')];
    data.agencies.forEach((agency) => {
      const short = data.agency_short_map[agency] || agency;
      lines.push(`# ${short}`);
      (data.monthly[agency] || []).forEach((r) => {
        lines.push(
          [r.month, r.cost, r.leads, r.opened_conversation, r.opened_account, r.app_activation, r.lead_cost ?? '', r.account_cost ?? '', r.app_activation_cost ?? ''].join(','),
        );
      });
      lines.push('');
    });
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const range =
      dateRange.startDate && dateRange.endDate ? `${dateRange.startDate}_${dateRange.endDate}` : 'all';
    link.href = url;
    link.download = `投放评审_全部厂商_${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.investmentReviewPage}>
      <FadeInSection delay={0} duration={0.8}>
        <FilterBar
          showPlatform
          showAgency
          showBusinessModel
          onSearch={() => fetchData()}
          onReset={() => fetchData()}
        />
      </FadeInSection>

      <FadeInSection delay={0.4} duration={0.8}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <FileSearchOutlined className={styles.toolbarIcon} />
            <span className={styles.toolbarTitle}>
              投放评审 · 厂商月度明细
            </span>
            {data?.meta && (
              <span className={styles.toolbarMeta}>
                {data.meta.agency_count} 个厂商 · {data.meta.month_count} 个月份
              </span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            <Segmented
              value={metric}
              onChange={(v) => setMetric(v as MetricType)}
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({ label, value: key }))}
              size="small"
            />
            <Tooltip title="导出全部厂商的月度明细 CSV（带厂商分隔）">
              <Button icon={<DownloadOutlined />} onClick={exportAllCsv} size="small">
                导出全部
              </Button>
            </Tooltip>
          </div>
        </div>
      </FadeInSection>

      <Spin spinning={loading} tip="加载中...">
        {data && data.agencies.length > 0 ? (
          data.agencies.map((agency, idx) => {
            const short = data.agency_short_map[agency] || agency;
            const rows = data.monthly[agency] || [];
            return (
              <FadeInSection key={agency} delay={0.6 + idx * 0.4} duration={0.8}>
                <Card
                  className={styles.agencyCard}
                  title={
                    <div className={styles.cardTitleRow}>
                      <span className={styles.cardTitleMain}>{short}</span>
                      <span className={styles.cardTitleSub}>{agency}</span>
                    </div>
                  }
                  extra={
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => exportCsv(agency)}
                    >
                      导出 CSV
                    </Button>
                  }
                >
                  <div className={styles.chartContainer}>
                    <EChartsComponent option={buildTrendOption(agency)} height={280} />
                  </div>
                  <Table<MonthRow>
                    columns={columns}
                    dataSource={rows}
                    rowKey={(r) => r.month}
                    pagination={false}
                    size="small"
                    rowClassName={(r) => (r.is_total ? styles.totalRow : '')}
                    className={styles.monthTable}
                  />
                </Card>
              </FadeInSection>
            );
          })
        ) : (
          !loading && (
            <Empty
              description="所选时间范围内暂无厂商月度数据"
              style={{ padding: '64px 0' }}
            />
          )
        )}
      </Spin>

      <ReportFooter
        sources={[
          { label: '数据源', value: 'agg_vendor_daily 表 × 月聚合' },
        ]}
        notes="按厂商分表展示月度数据，便于导出信息流广告投放评审明细"
      />
    </div>
  );
};

export default InvestmentReviewPage;
