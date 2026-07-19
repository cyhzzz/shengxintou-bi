/**
 * 主播分析页面（v3.3.0 加入直播类型筛选）
 *
 * 数据源: fact_conv_content.客户来源 + dim_anchor_live_type
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 解析 客户来源 中的 "[平台]引流-[主播名字]" 模式，按 (平台, 主播) 聚合。
 * 前端再按 anchor 名跨平台聚合（同名主播合并为一行，覆盖平台展开为多 Tag）。
 * v3.3.0: 新增 dim_anchor_live_type 映射表，按 source_token 给每个聚类项打 live_type 标签：
 *   - 分析师 / 投顾IP / 投顾配合做带货 / 带货直播
 * 支持 live_types 多选筛选 + 按直播类型分组 breakdown 概览。
 *
 * v3.1.26 业务口径（与 Live/Funnel + conversion-funnel/split 对齐）:
 * - 存量客户（是否为存量客户==1）线索计入 existing_leads，其资产计入 existing_assets
 * - 非存量 = 是否为存量客户==0 OR IS NULL，其开户/有效户/资产计入 new_* 主指标
 * - 新开户作为核心获客产出，存量客户线索与资产作为辅助呈现
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Tooltip, Empty, message } from 'antd';
import {
  ReloadOutlined, SearchOutlined, VideoCameraOutlined, UserOutlined,
  RiseOutlined, DollarOutlined, DownloadOutlined, AimOutlined, CheckCircleOutlined,
  UserAddOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceLeadsAnchor } from '@/services/dataService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { FadeInSection } from '@/components';
import { sanitizeText, sanitizeList } from '@/utils/sanitizeText';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

type LiveType = '分析师' | '投顾IP' | '投顾配合做带货' | '带货直播';

// v3.3.0: live_type 配色
const LIVE_TYPE_COLOR: Record<string, string> = {
  '分析师': 'purple',
  '投顾IP': 'geekblue',
  '投顾配合做带货': 'gold',
  '带货直播': 'magenta',
  '未映射': 'default',
};

interface AnchorItem {
  platform: string;
  anchor: string;
  live_type: LiveType | null;
  live_types: LiveType[];
  secondary_live_types: LiveType[];
  leads: number;
  existing_leads: number;
  new_leads: number;
  mouth: number;
  valid_lead: number;
  new_valid_lead: number;
  opened: number;
  new_opened: number;
  existing_opened: number;
  valid: number;
  new_valid: number;
  existing_valid: number;
  assets: number;
  new_assets: number;
  existing_assets: number;
  opening_rate: number;
  valid_rate: number;
  sources: string[];
}

// 同名主播跨平台聚合行
interface AnchorAggRow {
  anchor: string;
  live_type: LiveType | null;
  live_types: LiveType[];
  secondary_live_types: LiveType[];
  platforms: string[];
  leads: number;
  existing_leads: number;
  new_leads: number;
  mouth: number;
  valid_lead: number;
  new_valid_lead: number;
  opened: number;
  new_opened: number;
  existing_opened: number;
  valid: number;
  new_valid: number;
  existing_valid: number;
  assets: number;
  new_assets: number;
  existing_assets: number;
  opening_rate: number;
  valid_rate: number;
  sources: string[];
}

interface LiveTypeBreakdown {
  live_type: string;
  anchors: number;
  leads: number;
  new_leads: number;
  new_opened: number;
  new_valid: number;
  new_assets: number;
  opening_rate: number;
  valid_rate: number;
}

const AnchorClusterPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [anchorFilter, setAnchorFilter] = useState<string[]>([]);
  // v3.3.0: 直播类型筛选
  const [liveTypeFilter, setLiveTypeFilter] = useState<LiveType[]>([]);
  const [items, setItems] = useState<AnchorItem[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [liveTypeOptions, setLiveTypeOptions] = useState<string[]>([]);
  const [breakdown, setBreakdown] = useState<LiveTypeBreakdown[]>([]);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
    // v3.3.0: 把直播类型筛选传给后端
    live_types: liveTypeFilter.length ? liveTypeFilter : undefined,
  }), [dateRange, platformFilter, liveTypeFilter]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setPlatformFilter([]);
    setAnchorFilter([]);
    setLiveTypeFilter([]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceLeadsAnchor.getAnchorClusters({ filters, top_n: 200 });
      if (res?.success) {
        setItems((res.data.items || []) as AnchorItem[]);
        setPlatforms(res.data.platforms || []);
        setLiveTypeOptions(res.data.live_types || []);
        setBreakdown(res.data.live_type_breakdown || []);
      }
    } catch (err) {
      console.error('[AnchorCluster] load failed:', err);
      message.error('主播分析数据加载失败，请重试');
      setItems([]);
      setBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // 同名主播跨平台聚合
  const anchorAggRows: AnchorAggRow[] = useMemo(() => {
    const map = new Map<string, AnchorAggRow>();
    items.forEach((it) => {
      if (platformFilter.length && !platformFilter.includes(it.platform)) return;
      if (anchorFilter.length && !anchorFilter.includes(it.anchor)) return;
      const r = map.get(it.anchor) || {
        anchor: it.anchor, platforms: [], live_type: null, live_types: [], secondary_live_types: [],
        leads: 0, existing_leads: 0, new_leads: 0, mouth: 0,
        valid_lead: 0, new_valid_lead: 0,
        opened: 0, new_opened: 0, existing_opened: 0,
        valid: 0, new_valid: 0, existing_valid: 0,
        assets: 0, new_assets: 0, existing_assets: 0,
        opening_rate: 0, valid_rate: 0, sources: [],
      };
      if (!r.platforms.includes(it.platform)) r.platforms.push(it.platform);
      // v3.3.0: 主播级 live_type 取所有 token 的并集，primary 取第一个非空
      const mergedTypes = Array.from(new Set([...r.live_types, ...(it.live_types || [])]));
      r.live_types = mergedTypes;
      if (!r.live_type && it.live_type) r.live_type = it.live_type;
      r.leads += it.leads;
      r.existing_leads += it.existing_leads || 0;
      r.new_leads += it.new_leads || 0;
      r.mouth += it.mouth;
      r.valid_lead += it.valid_lead;
      r.new_valid_lead += it.new_valid_lead || 0;
      r.opened += it.opened;
      r.new_opened += it.new_opened || 0;
      r.existing_opened += it.existing_opened || 0;
      r.valid += it.valid;
      r.new_valid += it.new_valid || 0;
      r.existing_valid += it.existing_valid || 0;
      r.assets += it.assets;
      r.new_assets += it.new_assets || 0;
      r.existing_assets += it.existing_assets || 0;
      r.sources = Array.from(new Set([...r.sources, ...(it.sources || [])]));
      map.set(it.anchor, r);
    });
    const rows = Array.from(map.values());
    rows.forEach((r) => {
      r.opening_rate = r.leads ? +(r.new_opened / r.leads * 100).toFixed(2) : 0;
      r.valid_rate = r.leads ? +(r.new_valid / r.leads * 100).toFixed(2) : 0;
      // v3.3.0: 二级类型 = 全部类型去掉 primary 后剩下的
      r.secondary_live_types = r.live_types.filter((t) => t !== r.live_type);
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [items, platformFilter, anchorFilter]);

  // 概览 totals（基于 anchorAggRows 去重后聚合）
  const totals = useMemo(() => {
    const sum = (sel: (r: AnchorAggRow) => number) => anchorAggRows.reduce((s, r) => s + (sel(r) || 0), 0);
    return {
      anchors: anchorAggRows.length,
      leads: sum((r) => r.leads),
      existing_leads: sum((r) => r.existing_leads),
      new_leads: sum((r) => r.new_leads),
      mouth: sum((r) => r.mouth),
      valid_lead: sum((r) => r.valid_lead),
      new_valid_lead: sum((r) => r.new_valid_lead),
      opened: sum((r) => r.opened),
      new_opened: sum((r) => r.new_opened),
      existing_opened: sum((r) => r.existing_opened),
      valid: sum((r) => r.valid),
      new_valid: sum((r) => r.new_valid),
      existing_valid: sum((r) => r.existing_valid),
      assets: sum((r) => r.assets),
      new_assets: sum((r) => r.new_assets),
      existing_assets: sum((r) => r.existing_assets),
    };
  }, [anchorAggRows]);

  const anchorOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.anchor));
    return Array.from(set).sort();
  }, [items]);

  const exportCsv = () => {
    if (!anchorAggRows.length) return;
    const headers = [
      '主播', '直播类型', '次要类型', '覆盖平台', '平台数',
      '线索量', '存量客户', '新客户',
      '开口量', '有效线索', '有效线索(非存量)',
      '开户量(全)', '新开户', '存量开户',
      '有效户(全)', '新有效户', '存量有效户',
      '新开户率%', '新有效率%',
      '新开户资产', '存量资产', '总资产',
      '线索来源(原始)',
    ];
    const rows = anchorAggRows.map((r) => [
      r.anchor,
      r.live_type || '',
      (r.secondary_live_types || []).join(' | '),
      r.platforms.join(' / '), r.platforms.length,
      r.leads, r.existing_leads, r.new_leads,
      r.mouth, r.valid_lead, r.new_valid_lead,
      r.opened, r.new_opened, r.existing_opened,
      r.valid, r.new_valid, r.existing_valid,
      r.opening_rate, r.valid_rate,
      r.new_assets, r.existing_assets, r.assets,
      (r.sources || []).join(' | '),
    ]);
    const csv = '\ufeff' + [headers.join(','), ...rows.map((row) => row.map((c) => {
      const s = String(c ?? '');
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `主播分析_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // v3.3.0: 直播类型 Tag 渲染
  const renderLiveTypeTag = (lt: string | null) => {
    if (!lt) return <Tag color="default">未映射</Tag>;
    return <Tag color={LIVE_TYPE_COLOR[lt] || 'default'}>{lt}</Tag>;
  };

  const anchorAggColumns = [
    { title: '主播', dataIndex: 'anchor', width: 130, fixed: 'left' as const, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
    // v3.3.0: 新增「直播类型」列
    {
      title: '直播类型',
      dataIndex: 'live_type',
      width: 130,
      render: (_: any, r: AnchorAggRow) => (
        <Space direction="vertical" size={2}>
          {renderLiveTypeTag(r.live_type)}
          {(r.secondary_live_types || []).length > 0 && (
            <Tooltip title={`该主播跨 token 涉及多种直播类型：${r.live_types.join('、')}`}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                +{r.secondary_live_types.length} 类型
              </span>
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: '覆盖平台', dataIndex: 'platforms', width: 200, render: (v: string[]) => (
      <Space size={[4, 4]} wrap>
        {v.map((p) => <Tag key={p} color="cyan">{sanitizeText(p)}</Tag>)}
      </Space>
    ) },
    { title: '平台数', width: 80, align: 'center' as const, render: (_: any, r: AnchorAggRow) => <Tag color="blue">{r.platforms.length}</Tag> },
    { title: '线索量', dataIndex: 'leads', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
    { title: '存量客户', dataIndex: 'existing_leads', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.existing_leads - b.existing_leads, render: (v: number) => v.toLocaleString() },
    { title: '新客户', dataIndex: 'new_leads', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_leads - b.new_leads, render: (v: number) => v.toLocaleString() },
    { title: '开口量', dataIndex: 'mouth', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效线索', dataIndex: 'valid_lead', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '有效(非存量)', dataIndex: 'new_valid_lead', align: 'right' as const, width: 110, render: (v: number) => v.toLocaleString() },
    { title: '开户量(全)', dataIndex: 'opened', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.opened - b.opened, render: (v: number) => v.toLocaleString() },
    { title: '新开户', dataIndex: 'new_opened', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_opened - b.new_opened, render: (v: number) => v.toLocaleString() },
    { title: '存量开户', dataIndex: 'existing_opened', align: 'right' as const, width: 90, render: (v: number) => v.toLocaleString() },
    { title: '有效户(全)', dataIndex: 'valid', align: 'right' as const, width: 100, render: (v: number) => v.toLocaleString() },
    { title: '新有效户', dataIndex: 'new_valid', align: 'right' as const, width: 90, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_valid - b.new_valid, render: (v: number) => v.toLocaleString() },
    { title: '新开户率', dataIndex: 'opening_rate', align: 'right' as const, width: 100, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新有效率', dataIndex: 'valid_rate', align: 'right' as const, width: 100, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
    { title: '新开户资产', dataIndex: 'new_assets', align: 'right' as const, width: 140, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.new_assets - b.new_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
    { title: '存量资产', dataIndex: 'existing_assets', align: 'right' as const, width: 140, sorter: (a: AnchorAggRow, b: AnchorAggRow) => a.existing_assets - b.existing_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
    { title: '总资产', dataIndex: 'assets', align: 'right' as const, width: 140, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
    { title: '线索来源(原始)', dataIndex: 'sources', width: 280, render: (v: string[]) => {
      const cleaned = sanitizeList(v);
      return (
        <Tooltip title={cleaned.join(', ')}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>{cleaned.slice(0, 2).join(', ')}{cleaned.length > 2 ? ` +${cleaned.length - 2}` : ''}</span>
        </Tooltip>
      );
    } },
  ];

  // v3.3.0: 直播类型 breakdown 按线索量降序
  const sortedBreakdown = useMemo(() => {
    return [...breakdown].sort((a, b) => (b.leads || 0) - (a.leads || 0));
  }, [breakdown]);

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={0.8}>
        <Card className={styles.filterCard} size='small'>
          <Space size='middle' wrap>
            <span className={styles.label}>日期区间</span>
            <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            <span className={styles.label}>主播平台</span>
            <Select mode='multiple' allowClear placeholder='全部' value={platformFilter}
              onChange={setPlatformFilter} options={platforms.map((p) => ({ label: p, value: p }))}
              style={{ minWidth: 180 }} maxTagCount='responsive' />
            <span className={styles.label}>直播类型</span>
            <Select mode='multiple' allowClear placeholder='全部类型' value={liveTypeFilter}
              onChange={(v) => setLiveTypeFilter(v as LiveType[])}
              options={liveTypeOptions.map((t) => ({ label: t, value: t }))}
              style={{ minWidth: 200 }} maxTagCount='responsive' />
            <span className={styles.label}>主播</span>
            <Select mode='multiple' allowClear placeholder='全部' value={anchorFilter}
              onChange={setAnchorFilter} options={anchorOptions.map((a) => ({ label: a, value: a }))}
              style={{ minWidth: 200 }} maxTagCount='responsive' showSearch optionFilterProp='label' />
            <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
        </Card>
      </FadeInSection>

      <Spin spinning={loading}>
        {/* v3.3.0: 直播类型分组对比卡片 */}
        {sortedBreakdown.length > 0 && (
          <FadeInSection delay={0.2} duration={0.8}>
            <Card title={
              <Space>
                <VideoCameraOutlined />
                <span>按直播类型分组对比</span>
                <Tooltip title="按直播类型对主播进行分组：分析师 / 投顾IP / 投顾配合做带货 / 带货直播。点击上方「直播类型」筛选可只看某一类。">
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
              </Space>
            } size='small' style={{ marginBottom: 16 }}>
              <Table<LiveTypeBreakdown>
                size='small'
                rowKey='live_type'
                dataSource={sortedBreakdown}
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: '直播类型', dataIndex: 'live_type', width: 160, fixed: 'left' as const,
                    render: (v: string) => renderLiveTypeTag(v),
                  },
                  { title: '主播数', dataIndex: 'anchors', width: 90, align: 'right' as const, render: (v: number) => <Tag color="blue">{v}</Tag> },
                  { title: '线索量', dataIndex: 'leads', width: 110, align: 'right' as const, sorter: (a: LiveTypeBreakdown, b: LiveTypeBreakdown) => a.leads - b.leads, defaultSortOrder: 'descend' as const, render: (v: number) => v.toLocaleString() },
                  { title: '新客户', dataIndex: 'new_leads', width: 110, align: 'right' as const, render: (v: number) => v.toLocaleString() },
                  { title: '新开户', dataIndex: 'new_opened', width: 110, align: 'right' as const, sorter: (a: LiveTypeBreakdown, b: LiveTypeBreakdown) => a.new_opened - b.new_opened, render: (v: number) => v.toLocaleString() },
                  { title: '新有效户', dataIndex: 'new_valid', width: 110, align: 'right' as const, render: (v: number) => v.toLocaleString() },
                  { title: '新开户率', dataIndex: 'opening_rate', width: 100, align: 'right' as const, sorter: (a: LiveTypeBreakdown, b: LiveTypeBreakdown) => a.opening_rate - b.opening_rate, render: (v: number) => <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
                  { title: '新有效率', dataIndex: 'valid_rate', width: 100, align: 'right' as const, sorter: (a: LiveTypeBreakdown, b: LiveTypeBreakdown) => a.valid_rate - b.valid_rate, render: (v: number) => <Tag color={v > 3 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag> },
                  { title: '新开户资产', dataIndex: 'new_assets', width: 150, align: 'right' as const, sorter: (a: LiveTypeBreakdown, b: LiveTypeBreakdown) => a.new_assets - b.new_assets, render: (v: number) => v ? `¥${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-' },
                ]}
              />
            </Card>
          </FadeInSection>
        )}

        <FadeInSection delay={0.4} duration={0.8}>
          <MetricSection title="主播分析概览" description="主播引流链路的线索、开口、有效线索与成功开户核心表现（v3.3.0 起按直播类型分组筛选；v3.1.26 起新开户作为核心获客产出，存量客户线索与资产分项辅助呈现）">
          <MetricCard
            title="主播数"
            value={totals.anchors}
            suffix="位"
            valueColor="var(--color-brand)"
            icon={<VideoCameraOutlined style={{ color: 'var(--color-brand)' }} />}
            description={`当前期间活跃主播数量·同名跨平台去重`}
            showWowChange={false}
          />
          <MetricCard
            title="线索量"
            value={totals.leads}
            valueColor="var(--color-success)"
            icon={<UserOutlined style={{ color: 'var(--color-success)' }} />}
            description={`主播引流客户线索总数`}
            showWowChange={false}
          />
          <MetricCard
            title="存量客户"
            value={totals.existing_leads}
            valueColor="var(--color-text-tertiary)"
            icon={<UserOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
            description={`线索中已在他处开户的存量客户数·辅助指标`}
            showWowChange={false}
          />
          <MetricCard
            title="新客户"
            value={totals.new_leads}
            valueColor="var(--color-brand)"
            icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />}
            description={`非存量客户线索数·核心获客容量`}
            showWowChange={false}
          />
          <MetricCard
            title="客户开口"
            value={totals.mouth}
            valueColor="var(--chart-color-7)"
            icon={<RiseOutlined style={{ color: 'var(--chart-color-7)' }} />}
            description={`线索中已口头回复或沟通的客户`}
            showWowChange={false}
          />
          <MetricCard
            title="有效线索"
            value={totals.valid_lead}
            valueColor="var(--chart-color-5)"
            icon={<RiseOutlined style={{ color: 'var(--chart-color-5)' }} />}
            description={`已确认有意向的有效线索（含存量）`}
            showWowChange={false}
          />
          <MetricCard
            title="有效线索(剔除存量)"
            value={totals.new_valid_lead}
            valueColor="var(--color-brand)"
            icon={<UserAddOutlined style={{ color: 'var(--color-brand)' }} />}
            description={`剔除存量客户后的有效线索·核心获客产出`}
            showWowChange={false}
          />
          <MetricCard
            title="新开户"
            value={totals.new_opened}
            valueColor="var(--color-error)"
            icon={<AimOutlined style={{ color: 'var(--color-error)' }} />}
            description={`非存量且成功开户人数·主指标（存量客户已在别处开户，通常=0）`}
            showWowChange={false}
          />
          <MetricCard
            title="新有效户"
            value={totals.new_valid}
            valueColor="var(--color-success)"
            icon={<CheckCircleOutlined style={{ color: 'var(--color-success)' }} />}
            description={`非存量且有效户人数·主指标`}
            showWowChange={false}
          />
          <MetricCard
            title="新开户资产"
            value={totals.new_assets}
            prefix="¥"
            formatter="currency"
            valueColor="var(--color-warning)"
            icon={<DollarOutlined style={{ color: 'var(--color-warning)' }} />}
            description={`非存量且开户成功客户的总资产·主指标`}
            showWowChange={false}
          />
          <MetricCard
            title="存量资产"
            value={totals.existing_assets}
            prefix="¥"
            formatter="currency"
            valueColor="var(--color-text-tertiary)"
            icon={<DollarOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
            description={`存量客户资产·辅助指标（存量客户虽不再开户，但资产仍呈现）`}
            showWowChange={false}
          />
        </MetricSection>
        </FadeInSection>

        <FadeInSection delay={0.8} duration={0.8}>
          <Card title={`主播分析明细（${anchorAggRows.length} 位主播·同名跨平台聚合）`} size='small'
            extra={
              <Space>
                <Tooltip title='同名主播跨平台自动聚合，覆盖平台列展开为多 Tag；支持上方平台/直播类型/主播多选筛选'>
                  <InfoCircleOutlined style={{ color: 'var(--color-text-tertiary)' }} />
                </Tooltip>
                <Tooltip title='导出为 CSV'>
                  <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!anchorAggRows.length}>导出 CSV</Button>
                </Tooltip>
              </Space>
            }>
            {anchorAggRows.length > 0 ? (
              <Table<AnchorAggRow> size='small' rowKey='anchor' dataSource={anchorAggRows}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 位主播` }}
                columns={anchorAggColumns as any} scroll={{ x: 'max-content' }} />
            ) : (
              <Empty description={'暂无主播聚类数据（请检查日期区间是否覆盖主播引流时段）'} />
            )}
          </Card>
        </FadeInSection>

        <FadeInSection delay={1.2} duration={0.8}>
          <ReportFooter
            sources={[
              { label: '数据源', value: 'fact_conv_content.客户来源 + dim_anchor_live_type（v3.3.0 新增配置表）' },
              { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters' },
              { label: '默认 top_n', value: '200' },
              { label: '存量剔除口径', value: '非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 一致' },
              { label: '主播聚合', value: '同名主播跨平台聚合（覆盖平台 + 平台数列展开），支持上方平台/直播类型/主播多选筛选' },
              { label: '直播类型', value: '4 类：分析师 / 投顾IP / 投顾配合做带货 / 带货直播，由 dim_anchor_live_type 表按 source_token 映射' },
              { label: '配置入口', value: '系统配置 → 主播直播类型（管理 source_token → 主播名/直播类型 映射）' },
            ]}
            notes={'v3.3.0 起新增直播类型筛选与按类型分组对比：指标卡区分存量客户/新客户/新开户/新有效户/新开户资产/存量资产；明细表新增「直播类型」列。主播名通过 dim_anchor_live_type 表归一化（含错字校正，如「直播带货-吴晓字」→ 吴晓宇）。非引流类客户来源（如 广告投放-新客权益）不参与聚类。'}
          />
        </FadeInSection>
      </Spin>
    </div>
  );
};

export default AnchorClusterPage;
