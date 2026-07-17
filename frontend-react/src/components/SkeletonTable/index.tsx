/**
 * 表格骨架屏组件
 * 在数据加载时呈现与真实表格结构一致的 shimmer 占位，避免 Spin 遮挡表头。
 */
import React from 'react';
import { Skeleton } from 'antd';
import type { TableProps } from 'antd';
import styles from './SkeletonTable.module.scss';

export interface SkeletonTableProps<T = any> {
  columns?: TableProps<T>['columns'];
  rowCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonTable<T = any>({
  columns = [],
  rowCount = 5,
  className,
  style,
}: SkeletonTableProps<T>) {
  const effectiveColumns = columns.length > 0 ? columns : Array.from({ length: 4 }, (_, i) => ({ key: i }));

  return (
    <div className={`${styles.skeletonTable} ${className || ''}`} style={style}>
      {/* 表头 */}
      <div className={styles.headerRow}>
        {effectiveColumns.map((col, idx) => (
          <div key={String((col as any).key ?? idx)} className={styles.headerCell}>
            <Skeleton.Input active size="small" style={{ width: `${50 + (idx % 3) * 20}%`, height: 14 }} />
          </div>
        ))}
      </div>
      {/* 行 */}
      {Array.from({ length: rowCount }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={styles.bodyRow}
          style={{ animationDelay: `${rowIdx * 80}ms` } as React.CSSProperties}
        >
          {effectiveColumns.map((col, colIdx) => (
            <div key={`${rowIdx}-${String((col as any).key ?? colIdx)}`} className={styles.bodyCell}>
              <Skeleton.Input active size="small" style={{ width: `${40 + ((rowIdx + colIdx) % 4) * 15}%`, height: 14 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SkeletonTable;
