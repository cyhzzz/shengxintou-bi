/**
 * 主播聚类页面 (Bug 6)
 *
 * 数据源: fact_conv_content.客户来源
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 解析 客户来源 中的 "[平台]引流-[主播名字]" 模式，按 (平台, 主播) 聚合。
 * 例: 视频号引流-姚立琦、抖音引流-赵茜、财联社引流-谭记恩
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip, Empty } from 'antd';
import { ReloadOutlined, VideoCameraOutlined, UserOutlined, TeamOutlined, RiseOutlined, DollarOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceLeadsAnchor } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AnchorClusterPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
  }), [dateRange, platformFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceLeadsAnchor.getAnchorClusters({ filters, top_n: 100 });
      if (res?.success) {
        setItems(res.data.items || []);
        setTotals(res.data.totals || {});
        setPlatforms(res.data.platforms || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const exportCsv = () => {
    if (!items.length) return;
    const headers = ['平台', '主播', '线索量', '开口量', '有效线索', '开户量', '有效户', '开户率%', '有效率%', '总资产'];
    const rows = items.map((r) => [
      r.platform, r.anchor, r.leads, r.mouth, r.valid_lead, r.opened, r.valid,
      r.opening_rate, r.valid_rate, r.assets,
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `主播聚类_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size='small'>
        <Space size='middle' wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <span className={styles.label}>主播平台</span>
          <Select mode='multiple' allowClear placeholder='全部' value={platformFilter}
            onChange={setPlatformFilter} options={platforms.map((p) => ({ label: p, value: p }))}
            style={{ minWidth: 180 }} maxTagCount='responsive' />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <MetricSection title="主播聚类概览" description="按客户来源引流模式聚合的主播获客表现">
          <MetricCard
            title="主播数量"
            value={totals.total_anchors || 0}
            valueColor="var(--color-brand)"
            icon={<VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />}
            description="按 客户来源 引流模式聚类"
            showWowChange={false}
          />
          <MetricCard
            title="总线索"
            value={totals.total_leads || 0}
            valueColor="var(--color-success)"
            icon={<UserOutlined style={{ color: 'var(--color-success)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总开户"
            value={totals.total_opened || 0}
            valueColor="var(--chart-color-7)"
            icon={<TeamOutlined style={{ color: 'var(--chart-color-7)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总有效户"
            value={totals.total_valid || 0}
            valueColor="var(--chart-color-5)"
            icon={<RiseOutlined style={{ color: 'var(--chart-color-5)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总创收资产"
            value={totals.total_assets || 0}
            prefix="¥"
            formatter="currency"
            valueColor="var(--color-error)"
            icon={<DollarOutlined style={{ color: 'var(--color-error)' }} />}
            showWowChange={false}
          />
        </MetricSection>

        <Card title='主播聚类明细（按 客户来源 引流-主播名 聚合）' size='small'
          extra={<Tooltip title='导出为 CSV'><Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!items.length}>导出 CSV</Button></Tooltip>}>
          {items.length ? (
            <Table size='small' rowKey={(r: any) => `${r.platform}-${r.anchor}`}
              dataSource={items} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 位主播` }}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '排名', width: 60, align: 'center', render: (_: any, __: any, idx: number) => (
                  <Tag color={idx < 3 ? 'gold' : idx < 10 ? 'blue' : 'default'}>{idx + 1}</Tag>
                ) },
                { title: '主播平台', dataIndex: 'platform', width: 110, render: (v: string) => <Tag color='cyan'>{v}</Tag> },
                { title: '主播名字', dataIndex: 'anchor', width: 120, render: (v: string) => <strong>{v}</strong> },
                { title: '线索量', dataIndex: 'leads', align: 'right', sorter: (a: any, b: any) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
                { title: '开口量', dataIndex: 'mouth', align: 'right', render: (v: number) => v.toLocaleString() },
                { title: '有效线索', dataIndex: 'valid_lead', align: 'right', render: (v: number) => v.toLocaleString() },
                { title: '开户量', dataIndex: 'opened', align: 'right', sorter: (a: any, b: any) => a.opened - b.opened, render: (v: number) => v.toLocaleString() },
                { title: '有效户', dataIndex: 'valid', align: 'right', render: (v: number) => v.toLocaleString() },
                { title: '开户率', dataIndex: 'opening_rate', align: 'right', sorter: (a: any, b: any) => a.opening_rate - b.opening_rate, render: (v: number) => (
                  <Tag color={v > 30 ? 'green' : v > 10 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
                ) },
                { title: '有效率', dataIndex: 'valid_rate', align: 'right', render: (v: number) => (
                  <Tag color={v > 15 ? 'green' : v > 5 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
                ) },
                { title: '总资产', dataIndex: 'assets', align: 'right', render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
                { title: '线索来源（原始）', dataIndex: 'sources', width: 280, render: (v: string[]) => (
                  <Tooltip title={v.join(', ')}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{v.slice(0, 2).join(', ')}{v.length > 2 ? ` +${v.length - 2}` : ''}</span>
                  </Tooltip>
                ) },
              ]}
            />
          ) : (
            <Empty description='暂无主播聚类数据（请检查日期范围是否覆盖有主播引流的时段）' />
          )}
        </Card>

        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
          数据源: fact_conv_content.客户来源 字段中符合 [平台]引流-[主播名字] 模式的记录（如 视频号引流-姚立琦、抖音引流-赵茜、财联社引流-谭记恩 等）。
          非引流类客户来源（如 广告投放-新客权益）不参与聚类。
        </div>
      </Spin>
    </div>
  );
};

export default AnchorClusterPage;
