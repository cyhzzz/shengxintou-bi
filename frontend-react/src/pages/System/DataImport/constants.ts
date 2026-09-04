/**
 * 数据导入相关常量和类型定义（v2，原样导入）
 *
 * 新类型 → 新表（原样导入，无中间计算）：
 *   account_mapping       → dim_account + dim_vendor
 *   conversion_content    → fact_conv_content
 *   conversion_appmarket  → fact_conv_appmarket
 *   vendor_daily          → agg_vendor_daily
 *   xhs_note              → agg_xhs_note
 *   channel_open          → agg_daily_channel_open
 *   appmarket_plan_class   → dim_ad_plan_class
 *   plan_daily           → fact_plan_daily
 */

import type { ComponentType, CSSProperties } from 'react';
import {
  BarChartOutlined,
  TableOutlined,
  ReadOutlined,
  LinkOutlined,
  DownloadOutlined,
  PhoneOutlined,
  BankOutlined,
  TagsOutlined,
  PartitionOutlined,
  ContactsOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';

/** 图标组件类型 */
type IconCmp = ComponentType<{ style?: CSSProperties }>;

// 数据类型
export type DataType =
  | 'account_mapping'
  | 'conversion_content'
  | 'conversion_appmarket_h1'
  | 'conversion_appmarket_q3'
  | 'conversion_appmarket_q4'
  | 'vendor_daily'
  | 'xhs_note'
  | 'channel_open'
  | 'appmarket_plan_class'
  | 'plan_daily';

// 分组键
export type DataGroupKey = 'delivery' | 'leads' | 'open' | 'dimension';

// 分组定义（顺序即展示顺序）
export const DATA_GROUPS: { key: DataGroupKey; label: string; icon: IconCmp }[] = [
  { key: 'delivery', label: '投放数据', icon: BarChartOutlined },
  { key: 'leads', label: '线索数据', icon: ContactsOutlined },
  { key: 'open', label: '开户数据', icon: BankOutlined },
  { key: 'dimension', label: '维度关联', icon: ApartmentOutlined },
];

// 应用市场下载链路：区间拆分（1-6月 / 7-9月 / 10-12月）
// UI 上合并为一项展示，选择后在右侧用 Segmented 切换具体区间
export const APPMARKET_DOWNLOAD_TYPE = 'conversion_appmarket_h1';
export const APPMARKET_PREFIX = 'conversion_appmarket_';
export const APPMARKET_INTERVALS: { type: DataType; label: string; desc: string }[] = [
  { type: 'conversion_appmarket_h1', label: '1-6月', desc: '1月1日-6月30日' },
  { type: 'conversion_appmarket_q3', label: '7-9月', desc: '7月1日-9月30日' },
  { type: 'conversion_appmarket_q4', label: '10-12月', desc: '10月1日-12月31日' },
];

// 占位数据源（开发中，不可选择）
export interface PlaceholderConfig {
  group: DataGroupKey;
  label: string;
  icon: IconCmp;
}
export const PLACEHOLDER_ITEMS: PlaceholderConfig[] = [
  { group: 'leads', label: '手机号明细数据', icon: PhoneOutlined },
];

// 数据类型配置
export interface DataTypeConfig {
  type: DataType;
  label: string;
  description: string;
  targetTables: string[];
  guideFile: string;
  icon: IconCmp;
  group: DataGroupKey;
}

// 数据类型列表
export const DATA_TYPES: DataTypeConfig[] = [
  {
    type: 'account_mapping',
    label: '投放账号映射',
    description: '账号 → 代理商/业务模式映射（合并写入 dim_account + dim_vendor）',
    targetTables: ['dim_account', 'dim_vendor'],
    guideFile: 'account_mapping_guide.md',
    icon: TagsOutlined,
    group: 'dimension',
  },
  {
    type: 'conversion_content',
    label: '企微明细数据',
    description: '抖音/腾讯/小红书/快手企微加微明细（1 行 = 1 企微）',
    targetTables: ['fact_conv_content'],
    guideFile: 'conversion_content_guide.md',
    icon: LinkOutlined,
    group: 'leads',
  },
  {
    type: 'conversion_appmarket_h1',
    label: 'APP下载明细数据(1-6月)',
    description: '1月1日-6月30日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: DownloadOutlined,
    group: 'leads',
  },
  {
    type: 'conversion_appmarket_q3',
    label: 'APP下载明细数据(7-9月)',
    description: '7月1日-9月30日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: DownloadOutlined,
    group: 'leads',
  },
  {
    type: 'conversion_appmarket_q4',
    label: 'APP下载明细数据(10-12月)',
    description: '10月1日-12月31日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: DownloadOutlined,
    group: 'leads',
  },
  {
    type: 'vendor_daily',
    label: '厂商广告投放分析',
    description: '日×平台×厂商×业务模式 统一漏斗超集',
    targetTables: ['agg_vendor_daily'],
    guideFile: 'vendor_daily_guide.md',
    icon: BarChartOutlined,
    group: 'delivery',
  },
  {
    type: 'xhs_note',
    label: '小红书笔记维度明细',
    description: '笔记级 + 笔记聚合（自动丢弃 Unnamed: 24 脏列）',
    targetTables: ['agg_xhs_note'],
    guideFile: 'xhs_note_guide.md',
    icon: ReadOutlined,
    group: 'delivery',
  },
  {
    type: 'channel_open',
    label: '开户渠道分析',
    description: '非广告渠道开户日聚合（互联网引流/合作机构/员工开户/自然流入）',
    targetTables: ['agg_daily_channel_open'],
    guideFile: 'channel_open_guide.md',
    icon: BankOutlined,
    group: 'open',
  },
  {
    type: 'appmarket_plan_class',
    label: '应用市场计划分解',
    description: '广告分组按应用市场/版位/子版位/出价方式分类（关联下载链路拆解获客贡献）',
    targetTables: ['dim_ad_plan_class'],
    guideFile: 'appmarket_plan_class_guide.md',
    icon: PartitionOutlined,
    group: 'dimension',
  },
  {
    type: 'plan_daily',
    label: '广告计划维度明细',
    description: '全渠道计划级日维度：日×计划×关键词 消耗/展示/点击/下载（9.3）',
    targetTables: ['fact_plan_daily'],
    guideFile: 'plan_daily_guide.md',
    icon: TableOutlined,
    group: 'delivery',
  },
];