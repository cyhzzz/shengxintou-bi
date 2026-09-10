/**
 * AI 分析报告证据卡（P2-B）：llm-analysis 响应附带的业务证据摘要
 * （backend/utils/llm_evidence 三包：厂商经营 / 小红书笔记 / 应用市场），
 * 供人工核验 LLM 结论的数据支撑；完整证据同时是 LLM user prompt 的输入。
 *
 * Glance 风格：折叠面板默认收起 + 紧凑小表；经营数值统一「当月 / 前3月」并排；
 * 单包取数失败（null）或为空不渲染对应面板，整体缺失（老缓存响应）不渲染组件。
 */
import React from 'react';
import { Collapse, Table } from 'antd';
import type { CollapseProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { LlmEvidence } from '@/services/dataService';
import styles from './index.module.scss';

type VendorRow = NonNullable<LlmEvidence['vendor']>[number];
type NotePack = NonNullable<LlmEvidence['note']>;
type WatchRow = NotePack['watch_top'][number];
type DeclineRow = NotePack['declining'][number];
type StopRow = NotePack['stop_candidates'][number];
type StoreRow = NonNullable<LlmEvidence['appmarket']>['stores'][number];

const num = (v: number | null | undefined): string =>
  v == null ? '—' : Number(v).toLocaleString('zh-CN');

// 经营数值统一「当月 / 前3月」并排展示
const pair = (cur: number | null, prev: number | null): string => `${num(cur)} / ${num(prev)}`;

// ratio() 返回小数（保留 4 位），展示时转为百分比
const pct = (v: number | null): string => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

const vendorColumns: ColumnsType<VendorRow> = [
  { title: '厂商', dataIndex: 'vendor', ellipsis: true },
  { title: '花费', key: 'cost', align: 'right', render: (_, r) => pair(r.current.cost, r.prev3.cost) },
  { title: '开口', key: 'opened', align: 'right', render: (_, r) => pair(r.current.opened, r.prev3.opened) },
  { title: '开户', key: 'accounts', align: 'right', render: (_, r) => pair(r.current.accounts, r.prev3.accounts) },
  { title: '有效户', key: 'eff_accounts', align: 'right', render: (_, r) => pair(r.current.eff_accounts, r.prev3.eff_accounts) },
];

const watchColumns: ColumnsType<WatchRow> = [
  { title: '笔记', dataIndex: 'note', ellipsis: true },
  { title: '开口', dataIndex: 'opened', align: 'right' },
  { title: '线索', dataIndex: 'leads', align: 'right' },
  { title: '开户', dataIndex: 'accounts', align: 'right' },
];

const declineColumns: ColumnsType<DeclineRow> = [
  { title: '笔记', dataIndex: 'note', ellipsis: true },
  { title: '前3月均开口', dataIndex: 'prev3_avg_opened', align: 'right' },
  { title: '当月开口', dataIndex: 'current_opened', align: 'right' },
];

const stopColumns: ColumnsType<StopRow> = [
  { title: '笔记', dataIndex: 'note', ellipsis: true },
  { title: '花费', dataIndex: 'cost', align: 'right', render: (v) => num(v) },
  { title: '加微', dataIndex: 'adds', align: 'right' },
];

const storeColumns: ColumnsType<StoreRow> = [
  { title: '商店', dataIndex: 'store', ellipsis: true },
  { title: '下载', key: 'downloads', align: 'right', render: (_, r) => pair(r.current.downloads, r.prev3.downloads) },
  { title: '注册', key: 'registered', align: 'right', render: (_, r) => pair(r.current.registered, r.prev3.registered) },
  { title: '新开户', key: 'new_accounts', align: 'right', render: (_, r) => pair(r.current.new_accounts, r.prev3.new_accounts) },
  { title: '有效户', key: 'eff_accounts', align: 'right', render: (_, r) => pair(r.current.eff_accounts, r.prev3.eff_accounts) },
  { title: '激活率', key: 'activation_rate', align: 'right', render: (_, r) => pct(r.current.activation_rate) },
  { title: '新开户率', key: 'new_account_rate', align: 'right', render: (_, r) => pct(r.current.new_account_rate) },
];

const smallTableProps = { size: 'small' as const, pagination: false as const };

const EvidenceCards: React.FC<{ evidence?: LlmEvidence | null }> = ({ evidence }) => {
  if (!evidence) return null;
  const items: CollapseProps['items'] = [];
  if (evidence.vendor && evidence.vendor.length) {
    items.push({
      key: 'vendor',
      label: `厂商经营（${evidence.vendor.length} 家）`,
      children: (
        <Table rowKey="vendor" columns={vendorColumns} dataSource={evidence.vendor} {...smallTableProps} />
      ),
    });
  }
  const note = evidence.note;
  if (note && (note.watch_top.length || note.declining.length || note.stop_candidates.length)) {
    items.push({
      key: 'note',
      label: `小红书笔记（值得关注 ${note.watch_top.length} · 衰退 ${note.declining.length} · 停投候选 ${note.stop_candidates.length}）`,
      children: (
        <div className={styles.evidenceStack}>
          {note.watch_top.length > 0 && (
            <>
              <div className={styles.evidenceGroupTitle}>值得关注 TOP（按当月开口）</div>
              <Table rowKey={(_, i) => String(i)} columns={watchColumns} dataSource={note.watch_top} {...smallTableProps} />
            </>
          )}
          {note.declining.length > 0 && (
            <>
              <div className={styles.evidenceGroupTitle}>衰退笔记（当月跌破前3月均值）</div>
              <Table rowKey={(_, i) => String(i)} columns={declineColumns} dataSource={note.declining} {...smallTableProps} />
            </>
          )}
          {note.stop_candidates.length > 0 && (
            <>
              <div className={styles.evidenceGroupTitle}>停投候选（花费达标但加微趋零，累计快照）</div>
              <Table rowKey={(_, i) => String(i)} columns={stopColumns} dataSource={note.stop_candidates} {...smallTableProps} />
            </>
          )}
        </div>
      ),
    });
  }
  if (evidence.appmarket && evidence.appmarket.stores.length) {
    items.push({
      key: 'appmarket',
      label: `应用市场（${evidence.appmarket.stores.length} 商店）`,
      children: (
        <Table
          rowKey="store"
          columns={storeColumns}
          dataSource={evidence.appmarket.stores}
          scroll={{ x: 680 }}
          {...smallTableProps}
        />
      ),
    });
  }
  if (!items.length) return null;
  return <Collapse className={styles.evidenceCollapse} size="small" items={items} />;
};

export default EvidenceCards;
