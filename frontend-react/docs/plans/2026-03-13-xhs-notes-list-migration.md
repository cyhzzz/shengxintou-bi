# 小红书笔记列表页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的小红书笔记列表页面迁移至React前端，实现笔记搜索、筛选、分页功能

**Architecture:** React组件化架构，使用FilterBar筛选器、DataTable数据表格，支持按日期、创作者、生产者筛选

**Tech Stack:** React 19, TypeScript 5, Ant Design (Table, Input, Select, DatePicker), Zustand, SCSS Modules

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 添加笔记列表相关类型

export interface XhsNotesListItem {
  note_id: string;
  note_title: string;
  note_url: string;
  note_publish_time: string;
  creator_name: string;
  producer: string;
  ad_strategy: string;
  note_type: string;
  total_impressions: number;
  total_reads: number;
  total_interactions: number;
  cost: number;
  lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
}

export interface GetXhsNotesListParams {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
  creator_name?: string;
  producer?: string;
  ad_strategy?: string;
  note_type?: string;
  keyword?: string;
}

export interface XhsNotesListResponse {
  success: boolean;
  data: {
    total: number;
    page: number;
    page_size: number;
    items: XhsNotesListItem[];
  };
}
```

---

## Task 2: 创建Hooks

**Files:**
- Create: `src/pages/XhsNotes/List/hooks/useXhsNotesList.ts`
- Create: `src/pages/XhsNotes/List/hooks/useNotesFilters.ts`

```typescript
// useXhsNotesList.ts
import { useState, useCallback } from 'react';
import { apiClient } from '@/utils/api';
import type { GetXhsNotesListParams, XhsNotesListItem } from '@/types/api.schemas';

interface UseXhsNotesListReturn {
  data: XhsNotesListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  fetchData: (params: GetXhsNotesListParams) => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export function useXhsNotesList(): UseXhsNotesListReturn {
  const [data, setData] = useState<XhsNotesListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async (params: GetXhsNotesListParams) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/xhs-notes-list', { params });
      if (response.success) {
        setData(response.data.items);
        setTotal(response.data.total);
        setPage(response.data.page);
        setPageSize(response.data.page_size);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取笔记列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, total, loading, error, page, pageSize, fetchData, setPage, setPageSize };
}
```

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/XhsNotes/List/index.tsx`
- Create: `src/pages/XhsNotes/List/index.module.scss`

```typescript
/**
 * 小红书笔记列表页面
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Input, Select, Button, Space, Tag, Typography } from 'antd';
import { SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { FilterBar } from '@/components';
import { useXhsNotesList, useNotesFilters } from './hooks';
import styles from './index.module.scss';

const { Title } = Typography;
const { Search } = Input;

const XhsNotesListPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const { data, total, loading, page, pageSize, fetchData, setPage, setPageSize } = useXhsNotesList();

  useEffect(() => {
    fetchData({ page: 1, page_size: 50 });
  }, []);

  const handleSearch = useCallback(() => {
    fetchData({ page: 1, page_size: pageSize, keyword });
  }, [fetchData, pageSize, keyword]);

  const handleExport = useCallback(() => {
    // 导出逻辑
  }, []);

  const columns = [
    { title: '笔记ID', dataIndex: 'note_id', key: 'note_id', width: 120 },
    { title: '笔记标题', dataIndex: 'note_title', key: 'note_title', ellipsis: true },
    { title: '创作者', dataIndex: 'creator_name', key: 'creator_name', width: 100 },
    { title: '生产者', dataIndex: 'producer', key: 'producer', width: 80 },
    { title: '投放策略', dataIndex: 'ad_strategy', key: 'ad_strategy', width: 100 },
    { title: '笔记类型', dataIndex: 'note_type', key: 'note_type', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '曝光量', dataIndex: 'total_impressions', key: 'total_impressions', width: 100, align: 'right' as const },
    { title: '阅读量', dataIndex: 'total_reads', key: 'total_reads', width: 100, align: 'right' as const },
    { title: '互动量', dataIndex: 'total_interactions', key: 'total_interactions', width: 80, align: 'right' as const },
    { title: '花费', dataIndex: 'cost', key: 'cost', width: 100, align: 'right' as const, render: (v: number) => `¥${v?.toFixed(2)}` },
    { title: '线索', dataIndex: 'lead_users', key: 'lead_users', width: 60, align: 'right' as const },
    { title: '开户', dataIndex: 'opened_account_users', key: 'opened_account_users', width: 60, align: 'right' as const },
  ];

  return (
    <div className={styles.notesListPage}>
      {/* 筛选器 */}
      <Card className={styles.filterCard}>
        <Space wrap>
          <Search
            placeholder="搜索笔记标题/创作者"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 300 }}
            enterButton={<SearchOutlined />}
          />
          <Select placeholder="生产者" style={{ width: 120 }} allowClear />
          <Select placeholder="投放策略" style={{ width: 120 }} allowClear />
          <Select placeholder="笔记类型" style={{ width: 120 }} allowClear />
          <Button type="primary" onClick={handleSearch}>查询</Button>
          <Button onClick={handleExport} icon={<ExportOutlined />}>导出</Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <Title level={4}>笔记列表</Title>
          <span>共 {total} 条记录</span>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="note_id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={(pagination) => {
            setPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 50);
            fetchData({ page: pagination.current, page_size: pagination.pageSize });
          }}
        />
      </Card>
    </div>
  );
};

export default XhsNotesListPage;
```

---

## Task 4: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import XhsNotesListPage from '@/pages/XhsNotes/List';

// 在小红书报表二级路由中添加
{
  path: '/xhs-notes/list',
  element: <XhsNotesListPage />,
}
```

---

## 验收标准

- [ ] 搜索功能正常
- [ ] 筛选器功能正常
- [ ] 分页功能正常
- [ ] 导出功能正常
- [ ] 响应式布局正常

---

**最后更新**: 2026-03-13