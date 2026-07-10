/**
 * 直播获客 · 业务漏斗 (v3.2)
 * 数据源: fact_conv_content.客户来源（识别 [平台]引流-[主播] 模式的主播引流量）
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 5 阶段漏斗（业务口径，主播引流链路）:
 *   客户线索 → 客户开口 → 有效线索 → 成功开户 → 有效户
 *
 * 直播明细表数据源暂未接入（v3.1 占位已下线，v3.2 接入后补 观看UV 阶段）
 * 当前以主播引流链路作为"直播业务漏斗"的替代口径。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, DatePicker, Space, Spin, Table, Tag, Select, Empty, Tooltip } from 'antd';
import { ReloadOutlined, VideoCameraOutlined, UserOutlined, RiseOutlined, DollarOutlined, FireOutlined, AlertOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { EChartsOption } from 'echarts';
import { EChartsComponent } from '@/components/Chart';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { http } from '@/services/http';
import styles from './Funnel.module.scss';

const { RangePicker } = DatePicker;

interface AnchorItem {
  platform: string;
  anchor: string;
  leads: number;
  mouth: number;
  valid_lead: number;
  opened: number;
  valid: number;
  assets: number;
  opening_rate: number;
  valid_rate: number;
  sources: string[];
}

interface PlatformRow {
  platform: string;
  anchors: number;
  leads: number;
  mouth: number;
  valid_lead: number;
  opened: number;
  valid: number;
  assets: number;
  mouth_rate: number;
  valid_lead_rate: number;
  opening_rate: number;
  valid_rate: number;
}

const LiveFunnelPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [items, setItems] = useState<AnchorItem[]>([]);
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
      const res: any = await http.post('/leads-detail/anchor-clusters', { filters, top_n: 200 });
      if (res?.success) {
        setItems(res.data.items || []);
        setPlatforms(res.data.platforms || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // 5 阶段漏斗（按口径聚合: 线索 → 开口 → 有效线索 → 开户 → 有效户）
  const funnelStages = useMemo(() => {
    const total = items.reduce((acc, it) => ({
      leads: acc.leads + it.leads,
      mouth: acc.mouth + it.mouth,
      valid_lead: acc.valid_lead + it.valid_lead,
      opened: acc.opened + it.opened,
      valid: acc.valid + it.valid,
    }), { leads: 0, mouth: 0, valid_lead: 0, opened: 0, valid: 0 });
    const max = total.leads || 1;
    return [
      { name: '客户线索', value: total.leads, rawValue: total.leads, rate: 100, scaled: 100 },
      { name: '客户开口', value: total.mouth, rawValue: total.mouth, rate: total.leads ? +(total.mouth / total.leads * 100).toFixed(2) : 0, scaled: max ? Math.round(Math.log10(total.mouth + 1) / Math.log10(max + 1) * 100) : 0 },
      { name: '有效线索', value: total.valid_lead, rawValue: total.valid_lead, rate: total.leads ? +(total.valid_lead / total.leads * 100).toFixed(2) : 0, scaled: max ? Math.round(Math.log10(total.valid_lead + 1) / Math.log10(max + 1) * 100) : 0 },
      { name: '成功开户', value: total.opened, rawValue: total.opened, rate: total.leads ? +(total.opened / total.leads * 100).toFixed(2) : 0, scaled: max ? Math.round(Math.log10(total.opened + 1) / Math.log10(max + 1) * 100) : 0 },
      { name: '有效户', value: total.valid, rawValue: total.valid, rate: total.leads ? +(total.valid / total.leads * 100).toFixed(2) : 0, scaled: max ? Math.round(Math.log10(total.valid + 1) / Math.log10(max + 1) * 100) : 0 },
    ];
  }, [items]);

  const totals = useMemo(() => ({
    anchors: items.length,
    leads: items.reduce((s, i) => s + i.leads, 0),
    mouth: items.reduce((s, i) => s + i.mouth, 0),
    valid_lead: items.reduce((s, i) => s + i.valid_lead, 0),
    opened: items.reduce((s, i) => s + i.opened, 0),
    valid: items.reduce((s, i) => s + i.valid, 0),
    assets: items.reduce((s, i) => s + i.assets, 0),
  }), [items]);

  const platformRows: PlatformRow[] = useMemo(() => {
    const map = new Map<string, PlatformRow>();
    items.forEach((it) => {
      const r = map.get(it.platform) || { platform: it.platform, anchors: 0, leads: 0, mouth: 0, valid_lead: 0, opened: 0, valid: 0, assets: 0, mouth_rate: 0, valid_lead_rate: 0, opening_rate: 0, valid_rate: 0 };
      r.anchors += 1;
      r.leads += it.leads;
      r.mouth += it.mouth;
      r.valid_lead += it.valid_lead;
      r.opened += it.opened;
      r.valid += it.valid;
      r.assets += it.assets;
      map.set(it.platform, r);
    });
    const rows = Array.from(map.values());
    rows.forEach((r) => {
      r.mouth_rate = r.leads ? +(r.mouth / r.leads * 100).toFixed(2) : 0;
      r.valid_lead_rate = r.leads ? +(r.valid_lead / r.leads * 100).toFixed(2) : 0;
      r.opening_rate = r.leads ? +(r.opened / r.leads * 100).toFixed(2) : 0;
      r.valid_rate = r.leads ? +(r.valid / r.leads * 100).toFixed(2) : 0;
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [items]);

  // 5 阶段漏斗 ECharts 配置（对数缩放）
  const funnelOption: EChartsOption = useMemo(() => {
    const colors = ['#1677ff', '#52c41a', '#722ed1', '#fa8c16', '#f5222d'];
    return {
      color: colors,
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const d = p.data || {};
          return [
            d.name,
            `\u4eba\u6570\uff1a${Number(d.rawValue || 0).toLocaleString()}`,
            `\u8f6c\u5316\u7387\uff1a${typeof d.rate === 'number' ? d.rate.toFixed(2) + '%' : '-'}`,
          ].join('<br/>');
        },
      },
      series: [{
        name: '\u4e3b\u64ad\u5f15\u6d41\u6f0f\u6597',
        type: 'funnel',
        left: '5%',
        top: 16,
        bottom: 16,
        width: '90%',
        minSize: '15%',
        maxSize: '100%',
        sort: 'descending',
        gap: 6,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          formatter: (params: any) => {
            const d = params.data || {};
            return `${d.name}\n${Number(d.rawValue || 0).toLocaleString()} \u4eba`;
          },
        },
        labelLine: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: funnelStages.map((s, i) => ({ name: s.name, value: s.scaled, rawValue: s.rawValue, rate: s.rate, itemStyle: { color: colors[i] } })),
      }],
    };
  }, [funnelStages]);

  const platformColumns = [
    { title: '\u5e73\u53f0', dataIndex: 'platform', width: 120, render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: '\u4e3b\u64ad\u6570', dataIndex: 'anchors', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.anchors - b.anchors, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '\u7ebf\u7d22', dataIndex: 'leads', align: 'right' as const, width: 110, sorter: (a: PlatformRow, b: PlatformRow) => a.leads - b.leads, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u53e3', dataIndex: 'mouth', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '\u6709\u6548\u7ebf\u7d22', dataIndex: 'valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u6237', dataIndex: 'opened', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '\u6709\u6548\u6237', dataIndex: 'valid', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u53e3\u7387', dataIndex: 'mouth_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 60 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '\u5f00\u6237\u7387', dataIndex: 'opening_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '\u6709\u6548\u7387', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '\u603b\u8d44\u4ea7', dataIndex: 'assets', align: 'right' as const, width: 140, render: (v: number) => v ? `\u00a5${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  const anchorColumns = [
    { title: '\u5e73\u53f0', dataIndex: 'platform', width: 100, render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: '\u4e3b\u64ad', dataIndex: 'anchor', width: 120, render: (v: string) => <strong>{v}</strong> },
    { title: '\u7ebf\u7d22\u91cf', dataIndex: 'leads', align: 'right' as const, width: 90, sorter: (a: AnchorItem, b: AnchorItem) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u53e3\u91cf', dataIndex: 'mouth', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '\u6709\u6548\u7ebf\u7d22', dataIndex: 'valid_lead', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u6237\u91cf', dataIndex: 'opened', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '\u6709\u6548\u6237', dataIndex: 'valid', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '\u5f00\u6237\u7387', dataIndex: 'opening_rate', align: 'right' as const, width: 100, sorter: (a: AnchorItem, b: AnchorItem) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '\u6709\u6548\u7387', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '\u603b\u8d44\u4ea7', dataIndex: 'assets', align: 'right' as const, width: 140, render: (v: number) => v ? `\u00a5${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size="small">
        <Space size="middle" wrap>
          <span className={styles.label}>\u65e5\u671f\u533a\u95f4</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <span className={styles.label}>\u4e3b\u64ad\u5e73\u53f0</span>
          <Select
            mode="multiple"
            allowClear
            placeholder={'\u5168\u90e8'}
            value={platformFilter}
            onChange={setPlatformFilter}
            options={platforms.map((p) => ({ label: p, value: p }))}
            style={{ minWidth: 200 }}
            maxTagCount="responsive"
          />
          <span className={styles.label}>\u6392\u540d\u9650\u5236</span>
          <Select
            value={'200'}
            options={[{ label: 'Top 200', value: '200' }]}
            disabled
            style={{ minWidth: 100 }}
          />
          <span className={styles.tip}>
            \u6570\u636e\u6e90\uff1afact_conv_content.\u5ba2\u6237\u6765\u6e90 \u4e2d\u201c\u5e73\u53f0\u5f15\u6d41-\u4e3b\u64ad\u201d\u6a21\u5f0f
          </span>
          <a onClick={load}><ReloadOutlined /> \u5237\u65b0</a>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <MetricSection title="直播获客概览" description="主播引流链路的线索、开口、开户与资产表现">
          <MetricCard
            title="主播数"
            value={totals.anchors}
            valueColor="var(--color-brand)"
            icon={<VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总线索"
            value={totals.leads}
            valueColor="var(--color-success)"
            icon={<UserOutlined style={{ color: 'var(--color-success)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="开口"
            value={totals.mouth}
            valueColor="var(--chart-color-7)"
            icon={<RiseOutlined style={{ color: 'var(--chart-color-7)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="有效线索"
            value={totals.valid_lead}
            valueColor="var(--chart-color-5)"
            showWowChange={false}
          />
          <MetricCard
            title="开户"
            value={totals.opened}
            valueColor="var(--color-error)"
            icon={<FireOutlined style={{ color: 'var(--color-error)' }} />}
            showWowChange={false}
          />
          <MetricCard
            title="总资产"
            value={totals.assets}
            prefix="¥"
            formatter="currency"
            valueColor="var(--color-warning)"
            icon={<DollarOutlined style={{ color: 'var(--color-warning)' }} />}
            showWowChange={false}
          />
        </MetricSection>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={14}>
            <Card title="5 \u9636\u6bb5\u4e3b\u64ad\u5f15\u6d41\u4e1a\u52a1\u6f0f\u6597" size="small" extra={<Tooltip title="\u5360\u6bd4 = \u8be5\u9636\u6bb5 / \u7ebf\u7d22\u91cf\uff08\u5168\u51b6\u7a3f\uff09\u3002\u5bf9\u6570\u7f29\u653e\u4f7f\u5404\u9636\u6bb5\u6f0f\u6597\u5bbd\u5ea6\u5e73\u6ed1\u3002"><AlertOutlined style={{ color: 'var(--color-text-tertiary)' }} /></Tooltip>}>
              {funnelStages[0].rawValue > 0 ? (
                <EChartsComponent option={funnelOption} height={420} />
              ) : (
                <Empty description="\u8be5\u65e5\u671f\u533a\u95f4\u5185\u65e0\u4e3b\u64ad\u5f15\u6d41\u8bb0\u5f55" />
              )}
            </Card>
          </Col>
          <Col span={10}>
            <Card title="\u9636\u6bb5\u8f6c\u5316\u660e\u7ec6" size="small">
              <div className={styles.stageList}>
                {funnelStages.map((s, idx) => (
                  <div key={s.name} className={styles.stageItem}>
                    <div className={styles.stageRow}>
                      <Tag color="blue">{idx + 1}. {s.name}</Tag>
                      <span className={styles.stageValue}>{s.rawValue.toLocaleString()} \u4eba</span>
                    </div>
                    <div className={styles.stageRow}>
                      <span className={styles.stageRateLabel}>\u7d2f\u8ba1\u8f6c\u5316\u7387\uff08\u5bf9\u7ebf\u7d22\uff09</span>
                      <Tag color={s.rate > 30 ? 'green' : s.rate > 5 ? 'gold' : 'default'}>{s.rate.toFixed(2)}%</Tag>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="\u4e3b\u64ad\u5e73\u53f0\u5bf9\u6bd4" size="small" style={{ marginBottom: 16 }}>
          <Table<PlatformRow> size="small" rowKey="platform" dataSource={platformRows} pagination={false} columns={platformColumns as any} scroll={{ x: 'max-content' }} />
        </Card>

        <Card title={"\u4e3b\u64ad\u8be6\u60c5\uff08Top " + items.length + "\uff09"} size="small" extra={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>\u6309\u7ebf\u7d22\u91cf\u964d\u5e8f</span>}>
          {items.length > 0 ? (
            <Table<AnchorItem> size="small" rowKey={(r) => `${r.platform}-${r.anchor}`} dataSource={items} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `\u5171 ${t} \u4f4d\u4e3b\u64ad` }} columns={anchorColumns as any} scroll={{ x: 'max-content' }} />
          ) : (
            <Empty description={'\u6682\u65e0\u4e3b\u64ad\u805a\u7c7b\u6570\u636e\uff08\u8bf7\u68c0\u67e5\u65e5\u671f\u533a\u95f4\u662f\u5426\u8986\u76d6\u4e3b\u64ad\u5f15\u6d41\u65f6\u6bb5\uff09'} />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default LiveFunnelPage;
