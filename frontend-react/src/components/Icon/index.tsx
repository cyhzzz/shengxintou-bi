import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Custom Icon component for SVG icons
 * Icons are served from /icons/ directory in public folder
 *
 * Note: Menu icons now use Ant Design icons directly in MainLayout.
 * This component is kept for other UI elements (buttons, status indicators, etc.)
 */
export const Icon: React.FC<IconProps> = ({ name, className, style, alt }) => {
  return (
    <img
      src={`/icons/${name}.svg`}
      className={className}
      style={{ width: 20, height: 20, ...style }}
      alt={alt || name}
    />
  );
};

// Icon names for custom icons
// Menu icons are also available here for cases where custom styling is needed
export const ICONS = {
  // Brand
  LOGO: 'LOGO',
  省心投: '省心投',
  省心投1: '省心投1',
  省心投1比1: '省心投1比1',

  // Menu/Navigation
  主页: '主页',
  数据概览: '数据概览',
  厂商分析: '厂商分析',
  小红书报表: '小红书报表',
  笔记列表: '笔记列表',
  运营分析: '运营分析',
  创作分析: '创作分析',
  线索明细: '线索明细',
  转化漏斗: '转化漏斗',
  员工转化报表: '员工转化报表',
  转化效果分析: '转化效果分析',
  转化周报生成: '转化周报生成',
  报告生成: '报告生成',

  // Configuration
  数据导入: '数据导入',
  账号管理: '账号管理',
  预算管理: '预算管理',
  外部接口: '外部接口',
  简称管理: '简称管理',
  系统配置: '系统配置',
  数据同步: '数据同步',

  // Common actions
  刷新: '刷新',
  导出: '导出',
  搜索: '搜索',
  筛选: '筛选',
  添加: '添加',
  编辑: '编辑',
  删除: '删除',
  上传: '上传',
  下载: '下载',

  // Status
  成功: '成功',
  警告: '警告',
  错误: '错误',
  加载中: '加载中',
  空状态: '空状态',
  信息: '信息',

  // UI elements
  展开: '展开',
  收起: '收起',
  关闭: '关闭',
  主题切换: '主题切换',
  帮助: '帮助',
  help: 'help',

  // Utility icons
  'icon-calendar': 'icon-calendar',
  'icon-menu-unfold': 'icon-menu-unfold',
} as const;

export type IconName = typeof ICONS[keyof typeof ICONS];