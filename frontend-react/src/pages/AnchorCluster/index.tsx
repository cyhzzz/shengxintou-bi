/**
 * 主播分析页面（v3.1.26 重构）
 *
 * 数据源: fact_conv_content.客户来源
 * 端点: POST /api/v1/leads-detail/anchor-clusters
 *
 * 解析 客户来源 中的 "[平台]引流-[主播名字]" 模式，按 (平台, 主播) 聚合。
 * 前端再按 anchor 名跨平台聚合（同名主播合并为一行，覆盖平台展开为多 Tag）。
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
import { sanitizeText, sanitizeList } from '@/utils/sanitizeText';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

interface AnchorItem {
  platform: string;
  anchor: string;
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

// 同名主播跨平台聚合行（v3.1.26）
interface AnchorAggRow {
  anchor: string;
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

const AnchorClusterPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [anchorFilter, setAnchorFilter] = useState<string[]>([]);
  const [items, setItems] = useState<AnchorItem[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    platforms: platformFilter.length ? platformFilter : undefined,
  }), [dateRange, platformFilter]);

  const resetFilters = () => {
    setDateRange([dayjs('2026-01-01'), dayjs('2026-12-31')]);
    setPlatformFilter([]);
    setAnchorFilter([]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataServiceLeadsAnchor.getAnchorClusters({ filters, top_n: 200 });
      if (res?.success) {
        setItems((res.data.items || []) as AnchorItem[]);
        setPlatforms(res.data.platforms || []);
      }
    } catch (err) {
      console.error('[AnchorCluster] load failed:', err);
      message.error('主播分析数据加载失败，请重试');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // v3.1.26 问题2: 同名主播跨平台聚合（支持平台多选筛选 + 主播多选筛选）
  const anchorAggRows: AnchorAggRow[] = useMemo(() => {
    const map = new Map<string, AnchorAggRow>();
    items.forEach((it) => {
      // 平台筛选：选中平台时只聚合命中平台的主播行
      if (platformFilter.length && !platformFilter.includes(it.platform)) return;
      // 主播筛选：选中主播时只聚合命中主播
      if (anchorFilter.length && !anchorFilter.includes(it.anchor)) return;
      const r = map.get(it.anchor) || {
        anchor: it.anchor, platforms: [], leads: 0, existing_leads: 0, new_leads: 0, mouth: 0,
        valid_lead: 0, new_valid_lead: 0,
        opened: 0, new_opened: 0, existing_opened: 0,
        valid: 0, new_valid: 0, existing_valid: 0,
        assets: 0, new_assets: 0, existing_assets: 0,
        opening_rate: 0, valid_rate: 0, sources: [],
      };
      if (!r.platforms.includes(it.platform)) r.platforms.push(it.platform);
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
    });
    rows.sort((a, b) => b.leads - a.leads);
    return rows;
  }, [items, platformFilter, anchorFilter]);

  // 概览 totals（基于 anchorAggRows 去重后聚合，与明细表口径一致）
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

  // 主播选项（去重后）
  const anchorOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.anchor));
    return Array.from(set).sort();
  }, [items]);

  const exportCsv = () => {
    if (!anchorAggRows.length) return;
    const headers = [
      '主播', '覆盖平台', '平台数',
      '线索量', '存量客户', '新客户',
      '开口量', '有效线索', '有效线索(非存量)',
      '开户量(全)', '新开户', '存量开户',
      '有效户(全)', '新有效户', '存量有效户',
      '新开户率%', '新有效率%',
      '新开户资产', '存量资产', '总资产',
      '线索来源(原始)',
    ];
    const rows = anchorAggRows.map((r) => [
      r.anchor, r.platforms.join(' / '), r.platforms.length,
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
      // CSV 转义：含 , " \n 的字段用双引号包裹，内部 " 翻倍
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

  // v3.1.26 问题2: 主播详情表改为同名跨平台聚合，"平台"列改为"覆盖平台"多 Tag
  const anchorAggColumns = [
    { title: '主播', dataIndex: 'anchor', width: 130, fixed: 'left' as const, render: (v: string) => <strong>{sanitizeText(v)}</strong> },
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
            onChange={setAnchorFilter} options={anchorOptions.map((a) => ({ label: a, value: a }))}
            style={{ minWidth: 200 }} maxTagCount='responsive' showSearch optionFilterProp='label' />
          <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <MetricSection title="主播分析概览" description="主播引流链路的线索、开口、有效线索与成功开户核心表现（v3.1.26 起新开户作为核心获客产出，存量客户线索与资产分项辅助呈现）">
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

        <Card title={`主播分析明细（${anchorAggRows.length} 位主播·同名跨平台聚合）`} size='small'
          extra={
            <Space>
              <Tooltip title='同名主播跨平台自动聚合，覆盖平台列展开为多 Tag；支持上方平台/主播多选筛选'>
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

        <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_conv_content.客户来源 字段中符合 [平台]引流-[主播名字] 模式的记录（例如 视频号引流-姚立琦、抖音引流-赵茜、财联社引流-谭记恩 等）' },
            { label: '端点', value: 'POST /api/v1/leads-detail/anchor-clusters' },
            { label: '默认 top_n', value: '200' },
            { label: '存量剔除口径', value: '非存量 = 是否为存量客户==0 OR IS NULL，与 cost_analysis/conversion-funnel/split 一致' },
            { label: '主播聚合', value: '同名主播跨平台聚合（覆盖平台 + 平台数列展开），支持上方平台/主播多选筛选' },
          ]}
          notes={'v3.1.26 起新开户作为核心获客产出：指标卡区分存量客户/新客户/新开户/新有效户/新开户资产/存量资产；明细表新增 存量客户/新客户/有效(非存量)/新开户/存量开户/新有效户/新开户资产/存量资产 列。非引流类客户来源（如 广告投放-新客权益）不参与聚类。'}
        />
      </Spin>
    </div>
  );
};

export default AnchorClusterPage;
