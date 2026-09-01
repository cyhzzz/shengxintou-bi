/**
 * 数据导入相关常量和类型定义（v2 - 7 个新 type，原样导入）
 *
 * 新类型 → 新表（原样导入，无中间计算）：
 *   account_mapping       → dim_account + dim_vendor
 *   conversion_content    → fact_conv_content
 *   conversion_appmarket  → fact_conv_appmarket
 *   vendor_daily          → agg_vendor_daily
 *   xhs_note              → agg_xhs_note
 *   channel_open          → agg_daily_channel_open
 *   appmarket_plan_class   → dim_ad_plan_class
 */

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
  | 'appmarket_plan_class';

// 数据类型配置
export interface DataTypeConfig {
  type: DataType;
  label: string;
  description: string;
  targetTables: string[];
  guideFile: string;
  icon: string;
}

// 数据类型列表
export const DATA_TYPES: DataTypeConfig[] = [
  {
    type: 'account_mapping',
    label: '投放账号映射',
    description: '账号 → 代理商/业务模式映射（合并写入 dim_account + dim_vendor）',
    targetTables: ['dim_account', 'dim_vendor'],
    guideFile: 'account_mapping_guide.md',
    icon: '🗂️',
  },
  {
    type: 'conversion_content',
    label: '内容平台加微链路',
    description: '抖音/腾讯/小红书/快手加微链路明细（1 行 = 1 企微）',
    targetTables: ['fact_conv_content'],
    guideFile: 'conversion_content_guide.md',
    icon: '🔗',
  },
  {
    type: 'conversion_appmarket_h1',
    label: '应用市场下载链路(1-6月)',
    description: '1月1日-6月30日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: '📱',
  },
  {
    type: 'conversion_appmarket_q3',
    label: '应用市场下载链路(7-9月)',
    description: '7月1日-9月30日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: '📱',
  },
  {
    type: 'conversion_appmarket_q4',
    label: '应用市场下载链路(10-12月)',
    description: '10月1日-12月31日 下载→开户归因明细（仅替换该区间）',
    targetTables: ['fact_conv_appmarket'],
    guideFile: 'conversion_appmarket_guide.md',
    icon: '📱',
  },
  {
    type: 'vendor_daily',
    label: '厂商广告投放分析',
    description: '日×平台×厂商×业务模式 统一漏斗超集',
    targetTables: ['agg_vendor_daily'],
    guideFile: 'vendor_daily_guide.md',
    icon: '📊',
  },
  {
    type: 'xhs_note',
    label: '小红书笔记',
    description: '笔记级 + 笔记聚合（自动丢弃 Unnamed: 24 脏列）',
    targetTables: ['agg_xhs_note'],
    guideFile: 'xhs_note_guide.md',
    icon: '📕',
  },
  {
    type: 'channel_open',
    label: '开户渠道分析',
    description: '非广告渠道开户日聚合（互联网引流/合作机构/员工开户/自然流入）',
    targetTables: ['agg_daily_channel_open'],
    guideFile: 'channel_open_guide.md',
    icon: '🏦',
  },
  {
    type: 'appmarket_plan_class',
    label: '应用市场计划分解',
    description: '广告分组按应用市场/版位/子版位/出价方式分类（关联下载链路拆解获客贡献）',
    targetTables: ['dim_ad_plan_class'],
    guideFile: 'appmarket_plan_class_guide.md',
    icon: '📋',
  },
];