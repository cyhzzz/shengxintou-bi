/**
 * 带 shimmer 骨架屏的表格包装组件
 * loading 时展示 SkeletonTable，否则展示 antd Table
 */
import { Table } from 'antd';
import type { TableProps } from 'antd';
import SkeletonTable from '@/components/SkeletonTable';

export interface AnimatedTableProps<T = any> extends TableProps<T> {}

export function AnimatedTable<T = any>({
  loading,
  columns,
  ...rest
}: AnimatedTableProps<T>) {
  if (loading) {
    return <SkeletonTable<T> columns={columns} rowCount={rest.dataSource?.length || 5} />;
  }
  return <Table<T> columns={columns} loading={false} {...rest} />;
}

export default AnimatedTable;
