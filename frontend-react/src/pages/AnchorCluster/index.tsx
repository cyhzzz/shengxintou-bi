/**
 * 主播分析页面（v3.1.3 重构）
 *
 * 数据源: fact_conv_content.客户来源
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 解析 客户来源 中的 "[平台]引流-[主播名字]" 模式，按 (平台, 主播) 聚合。
 * 例: 视频号引流-姚立琦、抖音引流-赵茜、财联社引流-谭记恩
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip, Empty, message } from 'antd';
import { ReloadOutlined, VideoCameraOutlined, UserOutlined, TeamOutlined, RiseOutlined, DollarOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceLeadsAnchor } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { sanitizeText, sanitizeList } from '@/utils/sanitizeText';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AnchorClusterPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [anchorFilter, setAnchorFilter] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [anchors, setAnchors] = useState<string[]>([]);
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
        setAnchors(res.data.anchors || Array.from(new Set((res.data.items || []).map((i: any) => i.anchor))));
        }
      } catch (err) {
        console.error('[AnchorCluster] load failed:', err);
        message.error('主播分析数据加载失败，请重试');
        setItems([]);
        setTotals({});
      } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const exportCsv = () => {
    if (!items.length) return;
    const headers = ['平台', '主播', '线索量', '开口量', '有效线索', '开户量', '有效户', '开户率%', '有效率%', '总创收资产（仅开户）'];
    const rows = items.map((r) => [
      r.platform, r.anchor, r.leads, r.mouth, r.valid_lead, r.opened, r.valid,
      r.opening_rate, r.valid_rate, r.assets,
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `主播分析_${new Date().toISOString().slice(0, 10)}.csv`;
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
          <span className={styles.label}>主播</span>
          <Select mode='multiple' allowClear placeholder='全部' value={anchorFilter}
            onChange={setAnchorFilter} options={anchors.map((a) => ({ label: a, value: a }))}
            style={{ minWidth: 200 }} maxTagCount='responsive' showSearch optionFilterProp='label' />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <MetricSection title="主播分析概览" description="按客户来源引流模式聚合、同名主播按平台汇总的主播获客表现（顶部支持平台/主播筛选）">
          <MetricCard
            title="主播数量"
            value={totals.total_anchors || 0}
            suffix="位"
            valueColor="var(--color-brand)"
            icon={<VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />}
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

        <Card title='主播分析明细（同名主播按平台汇总，支持平台/主播筛选）' size='small'
          extra={<Tooltip title='导出为 CSV'><Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!items.length}>导出 CSV</Button></Tooltip>}>
          {(() => {
            const filtered = items.filter((r: any) => {
              if (platformFilter.length && !platformFilter.includes(r.platform)) return false;
              if (anchorFilter.length && !anchorFilter.includes(r.anchor)) return false;
              return true;
            });
            const grouped = new Map<string, any>();
            for (const r of filtered) {
              const k = r.anchor;
              const g = grouped.get(k);
              if (g) {
                g.platforms = Array.from(new Set([...g.platforms, r.platform])).join(' / ');
                g.leads += r.leads || 0;
                g.mouth += r.mouth || 0;
                g.valid_lead += r.valid_lead || 0;
                g.opened += r.opened || 0;
                g.valid += r.valid || 0;
                // v3.1.4: 总创收资产只累加「开户成功」的行，避免未开户粉丝资产抹平平均
                g.assets += (r.opened || 0) > 0 ? (r.assets || 0) : 0;
                g.sources = Array.from(new Set([...(g.sources || []), ...(r.sources || [])]));
              } else {
                grouped.set(k, { ...r, platforms: r.platform, sources: [...(r.sources || [])] });
              }
            }
            const aggregated = Array.from(grouped.values()).map((g) => ({
              ...g,
              opening_rate: g.opened && g.leads ? (g.opened / g.leads) * 100 : 0,
              valid_rate: g.valid && g.leads ? (g.valid / g.leads) * 100 : 0,
            }));
            if (!aggregated.length) return null;
            return (
            <Table size='small' rowKey={(r: any) => r.anchor}
              dataSource={aggregated} pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '主播名字', dataIndex: 'anchor', width: 130, fixed: 'left' as const, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
                { title: '覆盖平台', dataIndex: 'platforms', width: 220, render: (v: string) => (
                  <Space size={[4, 4]} wrap>
                    {Array.from(new Set(v.split(' / ').map((p) => sanitizeText(p)))).map((p) => <Tag key={p} color='cyan'>{p}</Tag>)}
                  </Space>
                ) },
                { title: '平台数', width: 80, align: 'center', render: (_: any, r: any) => (
                  <Tag color='blue'>{Array.from(new Set(r.platforms.split(' / '))).length}</Tag>
                ) },
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
                { title: '总创收资产（仅开户）', dataIndex: 'assets', align: 'right', render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
                { title: '线索来源（原始）', dataIndex: 'sources', width: 280, render: (v: string[]) => {
                  const cleaned = sanitizeList(v);
                  return (
                  <Tooltip title={cleaned.join(', ')}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{cleaned.slice(0, 2).join(', ')}{cleaned.length > 2 ? ` +${cleaned.length - 2}` : ''}</span>
                  </Tooltip>
                );
                } },
              ]}
            />
            );
          })()}
        </Card>

                <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_conv_content.客户来源 字段中符合 [平台]引流-[主播名字] 模式的记录（例如 视频号引流-姚立琦、抖音引流-赵芳、财联社引流-谭记恩 等）' },
            { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters' },
            { label: '默认 top_n', value: '100' },
          ]}
          notes={'非引流类客户来源（如 广告投放-新客权益）不参与聚类。同名主播按平台自动聚合（覆盖平台 + 平台数列展开）。'}
        />
      </Spin>
    </div>
  );
};

export default AnchorClusterPage;



