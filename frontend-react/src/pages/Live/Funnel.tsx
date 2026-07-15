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
import { ReloadOutlined, VideoCameraOutlined, UserOutlined, RiseOutlined, DollarOutlined, FireOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { FunnelChart } from '@/components/Chart';
import { ReportFooter } from '@/components/ReportFooter';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { sanitizeText } from '@/utils/sanitizeText';
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
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
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
    return [
      { name: '客户线索', count: total.leads, rate: 100 },
      { name: '客户开口', count: total.mouth, rate: total.leads ? +(total.mouth / total.leads * 100).toFixed(2) : 0 },
      { name: '有效线索', count: total.valid_lead, rate: total.leads ? +(total.valid_lead / total.leads * 100).toFixed(2) : 0 },
      { name: '成功开户', count: total.opened, rate: total.leads ? +(total.opened / total.leads * 100).toFixed(2) : 0 },
      { name: '有效户', count: total.valid, rate: total.leads ? +(total.valid / total.leads * 100).toFixed(2) : 0 },
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

  const platformColumns = [
    { title: '平台', dataIndex: 'platform', width: 120, render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: '主播数', dataIndex: 'anchors', align: 'right' as const, width: 100, sorter: (a: PlatformRow, b: PlatformRow) => a.anchors - b.anchors, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '线索', dataIndex: 'leads', align: 'right' as const, width: 110, sorter: (a: PlatformRow, b: PlatformRow) => a.leads - b.leads, render: (v: number) => v.toLocaleString() },
    { title: '开口', dataIndex: 'mouth', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '开户', dataIndex: 'opened', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效户', dataIndex: 'valid', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '开口率', dataIndex: 'mouth_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 60 ? 'green' : v > 30 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '有效率', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '总资产', dataIndex: 'assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  const anchorColumns = [
    { title: '平台', dataIndex: 'platform', width: 100, render: (v: string) => <Tag color="cyan">{sanitizeText(v)}</Tag> },
    { title: '主播', dataIndex: 'anchor', width: 120, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
    { title: '线索量', dataIndex: 'leads', align: 'right' as const, width: 90, sorter: (a: AnchorItem, b: AnchorItem) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '开口量', dataIndex: 'mouth', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '开户量', dataIndex: 'opened', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效户', dataIndex: 'valid', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 100, sorter: (a: AnchorItem, b: AnchorItem) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '有效率', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '总资产', dataIndex: 'assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size="small">
        <Space size="middle" wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <span className={styles.label}>主播平台</span>
          <Select
            mode="multiple"
            allowClear
            placeholder={'全部'}
            value={platformFilter}
            onChange={setPlatformFilter}
            options={platforms.map((p) => ({ label: p, value: p }))}
            style={{ minWidth: 200 }}
            maxTagCount="responsive"
          />
          <span className={styles.label}>排名限制</span>
          <Select
            value={'200'}
            options={[{ label: 'Top 200', value: '200' }]}
            disabled
            style={{ minWidth: 100 }}
          />
          <a onClick={load}><ReloadOutlined /> 刷新</a>
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

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="5 阶段主播引流业务漏斗" size="small" extra={<Tooltip title="占比 = 当前阶段人数 ÷ 最大阶段人数（条形长度按比例绘制）；阶段间百分比 = 上一阶段 → 当前阶段的转化率"><InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} /></Tooltip>}>
              {funnelStages[0].count > 0 ? (
                <FunnelChart data={funnelStages} height={440} />
              ) : (
                <Empty description="该日期区间内无主播引流记录" />
              )}
            </Card>
          </Col>
          <Col span={24}>
            <Card title="阶段转化明细" size="small">
              <div className={styles.stageList}>
                {funnelStages.map((s, idx) => (
                  <div key={s.name} className={styles.stageItem}>
                    <div className={styles.stageRow}>
                      <Tag color="blue">{idx + 1}. {s.name}</Tag>
                      <span className={styles.stageValue}>{s.count.toLocaleString()} 人</span>
                    </div>
                    <div className={styles.stageRow}>
                      <span className={styles.stageRateLabel}>累计转化率（对线索）</span>
                      <Tag color={s.rate > 30 ? 'green' : s.rate > 5 ? 'gold' : 'default'}>{s.rate.toFixed(2)}%</Tag>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="主播平台对比" size="small" style={{ marginBottom: 16 }}>
          <Table<PlatformRow> size="small" rowKey="platform" dataSource={platformRows} pagination={false} columns={platformColumns as any} scroll={{ x: 'max-content' }} />
        </Card>

        <Card title={"主播详情（Top " + items.length + "）"} size="small" extra={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>按线索量降序</span>}>
          {items.length > 0 ? (
            <Table<AnchorItem> size="small" rowKey={(r) => `${r.platform}-${r.anchor}`} dataSource={items} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 位主播` }} columns={anchorColumns as any} scroll={{ x: 'max-content' }} />
          ) : (
            <Empty description={'暂无主播聚类数据（请检查日期区间是否覆盖主播引流时段）'} />
          )}
        </Card>

        <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_conv_content.客户来源 中“平台引流-主播”模式的记录（如 视频号引流-姚立琦、抖音引流-赵芳、财联社引流-谭记恩）' },
            { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters' },
            { label: '粒度', value: 'Top 200 主播引流聚合' },
          ]}
          notes={'直播明细表数据源未接入（v3.2 待补 观看UV 阶段）；现以主播引流链路作为“直播业务漏斗”替代口径。'}
        />
      </Spin>
    </div>
  );
};

export default LiveFunnelPage;
