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

// Icon names for remaining custom icons (brand and UI elements only)
// Menu/report icons are now handled by Ant Design icons in MainLayout
export const ICONS = {
  // Brand
  LOGO: 'LOGO',
  省心投: '省心投',

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

  // UI elements
  展开: '展开',
  收起: '收起',
  关闭: '关闭',
  主题切换: '主题切换',
  help: 'help',
} as const;

export type IconName = typeof ICONS[keyof typeof ICONS];