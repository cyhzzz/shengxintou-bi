/**
 * 数据导入相关常量和类型定义
 */

// 数据类型
export type DataType =
  | 'tencent_ads'
  | 'douyin_ads'
  | 'xiaohongshu_ads'
  | 'xhs_notes_list'
  | 'xhs_notes_daily'
  | 'xhs_notes_content_daily'
  | 'backend_conversion';

// 数据类型配置
export interface DataTypeConfig {
  type: DataType;
  label: string;
  description: string;
}

// 数据类型列表
export const DATA_TYPES: DataTypeConfig[] = [
  {
    type: 'tencent_ads',
    label: '腾讯广告',
    description: '腾讯广告投放数据',
  },
  {
    type: 'douyin_ads',
    label: '抖音广告',
    description: '抖音广告投放数据',
  },
  {
    type: 'xiaohongshu_ads',
    label: '小红书广告',
    description: '小红书广告投放数据',
  },
  {
    type: 'xhs_notes_list',
    label: '小红书笔记列表',
    description: '笔记基础信息列表',
  },
  {
    type: 'xhs_notes_daily',
    label: '小红书笔记投放',
    description: '笔记日级投放数据',
  },
  {
    type: 'xhs_notes_content_daily',
    label: '小红书笔记运营',
    description: '笔记日级运营数据',
  },
  {
    type: 'backend_conversion',
    label: '后端转化',
    description: '后端转化明细数据',
  },
];