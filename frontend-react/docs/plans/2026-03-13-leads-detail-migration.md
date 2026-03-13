# 线索明细页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的线索明细页面完整迁移至React前端，实现分页表格、筛选器、导出功能

**Architecture:** React组件化架构，使用FilterBar筛选器、DataTable数据表格组件，通过自定义Hooks管理状态和分页

**Tech Stack:** React 19, TypeScript 5, Ant Design (Table, Pagination, Button), Zustand, SCSS Modules

---

## ⚠️ 迁移前必读：常见问题检查清单

### 1. API参数完整性检查

| 参数名 | 是否必需 | 默认值 | 说明 |
|--------|---------|--------|------|
| `page` | ✅ 是 | 1 | 当前页码 |
| `page_size` | ✅ 是 | 50 | 每页条数 |
| `start_date` | ❌ 否 | - | 开始日期 |
| `end_date` | ❌ 否 | - | 结束日期 |
| `platforms` | ❌ 否 | [] | 平台筛选 |
| `agencies` | ❌ 否 | [] | 代理商筛选 |
| `is_customer` | ❌ 否 | - | 是否成单 |
| `has_open_account` | ❌ 否 | - | 是否开户 |

### 2. 表格列定义验证

- [ ] 所有列都有正确的dataIndex
- [ ] 日期列使用render格式化
- [ ] 布尔列使用Tag组件显示
- [ ] 操作列有查看详情按钮

### 3. 分页功能验证

- [ ] 分页器显示总数
- [ ] 切换页码正确加载数据
- [ ] 修改每页条数重新加载

### 4. 导出功能验证

- [ ] 导出按钮正确触发
- [ ] 导出包含当前筛选条件
- [ ] 导出文件格式正确

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

**Step 1: 添加线索明细API类型**

```typescript
// 在 src/types/api.schemas.ts 中添加

/**
 * 线索明细API请求参数
 */
export interface GetLeadsDetailParams {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
  platforms?: string[];
  agencies?: string[];
  is_customer?: boolean;
  has_open_account?: boolean;
}

/**
 * 线索明细数据项
 */
export interface LeadsDetailItem {
  id: number;
  lead_date: string;
  platform_source: string;
  ad_account: string;
  agency: string;
  wechat_nickname: string;
  capital_account: string;
  is_customer: boolean;
  has_open_account: boolean;
  is_valid_lead: boolean;
  is_valid_customer: boolean;
  first_contact_time: string | null;
  last_contact_time: string | null;
  account_opening_time: string | null;
  assets: number | null;
  customer_contribution: number | null;
  add_employee_name: string | null;
  note_id: string | null;
  note_title: string | null;
}

/**
 * 线索明细API响应
 */
export interface LeadsDetailResponse {
  success: boolean;
  data: {
    total: number;
    page: number;
    page_size: number;
    items: LeadsDetailItem[];
  };
}
```

**Step 2: 验证类型定义**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 2: 创建API调用Hook

**Files:**
- Create: `src/pages/LeadsDetail/hooks/useLeadsDetail.ts`

**Step 1: 编写useLeadsDetail Hook**

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/utils/api';
import type { GetLeadsDetailParams, LeadsDetailResponse, LeadsDetailItem } from '@/types/api.schemas';

interface UseLeadsDetailReturn {
  data: LeadsDetailItem[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  fetchData: (params: GetLeadsDetailParams) => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export function useLeadsDetail(): UseLeadsDetailReturn {
  const [data, setData] = useState<LeadsDetailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async (params: GetLeadsDetailParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<LeadsDetailResponse>(
        '/api/v1/leads-detail',
        { params }
      );

      if (response.success && response.data) {
        setData(response.data.items);
        setTotal(response.data.total);
        setPage(response.data.page);
        setPageSize(response.data.page_size);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取线索明细数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    total,
    loading,
    error,
    page,
    pageSize,
    fetchData,
    setPage,
    setPageSize,
  };
}
```

**Step 2: 验证Hook功能**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 3: 创建筛选器Hook

**Files:**
- Create: `src/pages/LeadsDetail/hooks/useLeadsFilters.ts`

**Step 1: 编写useLeadsFilters Hook**

```typescript
import { useState, useCallback } from 'react';
import type { GetLeadsDetailParams } from '@/types/api.schemas';

interface LeadsFilters {
  start_date: string;
  end_date: string;
  platforms: string[];
  agencies: string[];
  is_customer: boolean | null;
  has_open_account: boolean | null;
}

interface UseLeadsFiltersReturn {
  filters: LeadsFilters;
  updateFilters: (newFilters: Partial<LeadsFilters>) => void;
  resetFilters: () => void;
  getApiParams: (page?: number, pageSize?: number) => GetLeadsDetailParams;
}

const DEFAULT_FILTERS: LeadsFilters = {
  start_date: '',
  end_date: '',
  platforms: [],
  agencies: [],
  is_customer: null,
  has_open_account: null,
};

export function useLeadsFilters(): UseLeadsFiltersReturn {
  const [filters, setFilters] = useState<LeadsFilters>(DEFAULT_FILTERS);

  const updateFilters = useCallback((newFilters: Partial<LeadsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const getApiParams = useCallback((page = 1, pageSize = 50): GetLeadsDetailParams => {
    const params: GetLeadsDetailParams = {
      page,
      page_size: pageSize,
    };

    // 添加可选参数
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.platforms.length > 0) params.platforms = filters.platforms;
    if (filters.agencies.length > 0) params.agencies = filters.agencies;
    if (filters.is_customer !== null) params.is_customer = filters.is_customer;
    if (filters.has_open_account !== null) params.has_open_account = filters.has_open_account;

    return params;
  }, [filters]);

  return { filters, updateFilters, resetFilters, getApiParams };
}
```

**Step 2: 验证Hook功能**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 4: 创建表格列配置

**Files:**
- Create: `src/pages/LeadsDetail/config/tableColumns.tsx`

**Step 1: 编写表格列配置**

```typescript
import React from 'react';
import { Tag, Button, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LeadsDetailItem } from '@/types/api.schemas';

/**
 * 线索明细表格列配置
 */
export const getTableColumns = (
  onViewDetail: (record: LeadsDetailItem) => void
): ColumnsType<LeadsDetailItem> => [
  {
    title: '线索日期',
    dataIndex: 'lead_date',
    key: 'lead_date',
    width: 110,
    fixed: 'left',
    sorter: true,
  },
  {
    title: '平台来源',
    dataIndex: 'platform_source',
    key: 'platform_source',
    width: 100,
    filters: [
      { text: '腾讯', value: '腾讯' },
      { text: '抖音', value: '抖音' },
      { text: '小红书', value: '小红书' },
    ],
  },
  {
    title: '广告账号',
    dataIndex: 'ad_account',
    key: 'ad_account',
    width: 120,
    ellipsis: true,
  },
  {
    title: '代理商',
    dataIndex: 'agency',
    key: 'agency',
    width: 100,
  },
  {
    title: '微信昵称',
    dataIndex: 'wechat_nickname',
    key: 'wechat_nickname',
    width: 120,
    ellipsis: true,
  },
  {
    title: '资金账号',
    dataIndex: 'capital_account',
    key: 'capital_account',
    width: 120,
  },
  {
    title: '是否成单',
    dataIndex: 'is_customer',
    key: 'is_customer',
    width: 90,
    render: (value: boolean) => (
      <Tag color={value ? 'success' : 'default'}>
        {value ? '是' : '否'}
      </Tag>
    ),
    filters: [
      { text: '是', value: true },
      { text: '否', value: false },
    ],
  },
  {
    title: '是否开户',
    dataIndex: 'has_open_account',
    key: 'has_open_account',
    width: 90,
    render: (value: boolean) => (
      <Tag color={value ? 'success' : 'default'}>
        {value ? '是' : '否'}
      </Tag>
    ),
    filters: [
      { text: '是', value: true },
      { text: '否', value: false },
    ],
  },
  {
    title: '有效线索',
    dataIndex: 'is_valid_lead',
    key: 'is_valid_lead',
    width: 90,
    render: (value: boolean) => (
      <Tag color={value ? 'success' : 'default'}>
        {value ? '是' : '否'}
      </Tag>
    ),
  },
  {
    title: '有效户',
    dataIndex: 'is_valid_customer',
    key: 'is_valid_customer',
    width: 80,
    render: (value: boolean) => (
      <Tag color={value ? 'success' : 'default'}>
        {value ? '是' : '否'}
      </Tag>
    ),
  },
  {
    title: '资产',
    dataIndex: 'assets',
    key: 'assets',
    width: 100,
    align: 'right',
    render: (value: number | null) => value ? `¥${value.toLocaleString()}` : '-',
  },
  {
    title: '操作',
    key: 'action',
    width: 80,
    fixed: 'right',
    render: (_, record) => (
      <Button
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={() => onViewDetail(record)}
      >
        详情
      </Button>
    ),
  },
];
```

**Step 2: 验证配置**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 5: 创建详情弹窗组件

**Files:**
- Create: `src/pages/LeadsDetail/components/LeadsDetailModal.tsx`

**Step 1: 编写详情弹窗组件**

```typescript
/**
 * 线索详情弹窗组件
 */
import React from 'react';
import { Modal, Descriptions, Tag } from 'antd';
import type { LeadsDetailItem } from '@/types/api.schemas';

interface LeadsDetailModalProps {
  visible: boolean;
  record: LeadsDetailItem | null;
  onClose: () => void;
}

const LeadsDetailModal: React.FC<LeadsDetailModalProps> = ({
  visible,
  record,
  onClose,
}) => {
  if (!record) return null;

  return (
    <Modal
      title="线索详情"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="线索日期">{record.lead_date}</Descriptions.Item>
        <Descriptions.Item label="平台来源">{record.platform_source}</Descriptions.Item>
        <Descriptions.Item label="广告账号">{record.ad_account}</Descriptions.Item>
        <Descriptions.Item label="代理商">{record.agency}</Descriptions.Item>
        <Descriptions.Item label="微信昵称">{record.wechat_nickname}</Descriptions.Item>
        <Descriptions.Item label="资金账号">{record.capital_account}</Descriptions.Item>
        <Descriptions.Item label="是否成单">
          <Tag color={record.is_customer ? 'success' : 'default'}>
            {record.is_customer ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="是否开户">
          <Tag color={record.has_open_account ? 'success' : 'default'}>
            {record.has_open_account ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="有效线索">
          <Tag color={record.is_valid_lead ? 'success' : 'default'}>
            {record.is_valid_lead ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="有效户">
          <Tag color={record.is_valid_customer ? 'success' : 'default'}>
            {record.is_valid_customer ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="首次触达时间">
          {record.first_contact_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="最近互动时间">
          {record.last_contact_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="开户时间">
          {record.account_opening_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="添加员工">
          {record.add_employee_name || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="资产">
          {record.assets ? `¥${record.assets.toLocaleString()}` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="客户贡献">
          {record.customer_contribution ? `¥${record.customer_contribution.toLocaleString()}` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="笔记ID">{record.note_id || '-'}</Descriptions.Item>
        <Descriptions.Item label="笔记标题">{record.note_title || '-'}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default LeadsDetailModal;
```

**Step 2: 验证组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 6: 创建主页面组件

**Files:**
- Modify: `src/pages/LeadsDetail/index.tsx`
- Create: `src/pages/LeadsDetail/index.module.scss`
- Create: `src/pages/LeadsDetail/hooks/index.ts`

**Step 1: 导出Hooks**

```typescript
// src/pages/LeadsDetail/hooks/index.ts
export { useLeadsDetail } from './useLeadsDetail';
export { useLeadsFilters } from './useLeadsFilters';
```

**Step 2: 编写主页面组件**

```typescript
/**
 * 线索明细页面
 * 展示所有客户线索到转化的数据明细
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { FilterBar } from '@/components';
import LeadsDetailModal from './components/LeadsDetailModal';
import { getTableColumns } from './config/tableColumns';
import { useLeadsDetail, useLeadsFilters } from './hooks';
import { useMetadata } from '@/hooks/useMetadata';
import { exportToExcel } from '@/utils/export';
import type { LeadsDetailItem } from '@/types/api.schemas';
import styles from './index.module.scss';

const { Title } = Typography;

const LeadsDetailPage: React.FC = () => {
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LeadsDetailItem | null>(null);

  const { metadata, loading: metadataLoading } = useMetadata();
  const { filters, updateFilters, resetFilters, getApiParams } = useLeadsFilters();
  const {
    data,
    total,
    loading,
    error,
    page,
    pageSize,
    fetchData,
    setPage,
    setPageSize,
  } = useLeadsDetail();

  // 初始加载
  useEffect(() => {
    fetchData(getApiParams());
  }, []);

  // 查看详情
  const handleViewDetail = useCallback((record: LeadsDetailItem) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  }, []);

  // 关闭详情
  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedRecord(null);
  }, []);

  // 筛选器查询
  const handleSearch = useCallback((searchFilters: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
  }) => {
    updateFilters({
      start_date: searchFilters.startDate,
      end_date: searchFilters.endDate,
      platforms: searchFilters.platforms,
      agencies: searchFilters.agencies,
    });
    setPage(1);
    fetchData(getApiParams(1, pageSize));
  }, [updateFilters, setPage, fetchData, getApiParams, pageSize]);

  // 筛选器重置
  const handleReset = useCallback(() => {
    resetFilters();
    setPage(1);
    fetchData(getApiParams(1, pageSize));
  }, [resetFilters, setPage, fetchData, getApiParams, pageSize]);

  // 分页变化
  const handleTableChange = useCallback((pagination: any) => {
    const { current, pageSize: newPageSize } = pagination;
    setPage(current);
    setPageSize(newPageSize);
    fetchData(getApiParams(current, newPageSize));
  }, [setPage, setPageSize, fetchData, getApiParams]);

  // 导出
  const handleExport = useCallback(async () => {
    // 获取全部数据
    const exportParams = { ...getApiParams(), page: 1, page_size: 10000 };
    const response = await fetch('/api/v1/leads-detail?' + new URLSearchParams(exportParams as any));
    const result = await response.json();

    if (result.success) {
      exportToExcel(result.data.items, '线索明细');
    }
  }, [getApiParams]);

  // 表格列配置
  const columns = getTableColumns(handleViewDetail);

  return (
    <div className={styles.leadsDetailPage}>
      {/* 筛选器 */}
      <FilterBar
        showPlatform
        showAgency
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <Title level={4}>线索明细</Title>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 详情弹窗 */}
      <LeadsDetailModal
        visible={detailVisible}
        record={selectedRecord}
        onClose={handleCloseDetail}
      />
    </div>
  );
};

export default LeadsDetailPage;
```

**Step 3: 编写样式文件**

```scss
// index.module.scss
.leadsDetailPage {
  padding: 20px;
}

.tableCard {
  margin-top: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h4 {
    margin: 0;
  }
}
```

**Step 4: 验证页面组件**

运行: `npm run type-check`
预期: 无类型错误

---

## Task 7: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

**Step 1: 添加路由配置**

```typescript
import LeadsDetailPage from '@/pages/LeadsDetail';

// 在路由配置中添加
{
  path: '/leads-detail',
  element: <LeadsDetailPage />,
  meta: {
    title: '线索明细',
    icon: 'UnorderedListOutlined',
  },
}
```

**Step 2: 验证路由**

运行: `npm run dev`
访问: `http://localhost:5173/leads-detail`
预期: 页面正常渲染

---

## Task 8: 功能验证

**Step 1: 验证API参数完整性**

打开浏览器 Network 面板，检查请求参数：
- [ ] `page` 参数存在
- [ ] `page_size` 参数存在
- [ ] 筛选参数正确传递

**Step 2: 验证分页功能**

- [ ] 分页器显示总数
- [ ] 切换页码正确加载数据
- [ ] 修改每页条数重新加载

**Step 3: 验证筛选功能**

- [ ] 平台筛选正常
- [ ] 代理商筛选正常
- [ ] 日期范围筛选正常

**Step 4: 验证导出功能**

- [ ] 导出按钮触发下载
- [ ] 导出文件格式正确
- [ ] 导出数据完整

**Step 5: 验证详情功能**

- [ ] 详情按钮正常显示
- [ ] 弹窗内容正确
- [ ] 关闭弹窗正常

---

## Task 9: 提交代码

**Step 1: 检查代码质量**

```bash
npm run lint
npm run type-check
npm run build
```

**Step 2: 提交代码**

```bash
git add src/pages/LeadsDetail src/types/api.schemas.ts src/router/index.tsx
git commit -m "feat: 迁移线索明细页面至React前端

- 添加线索明细API类型定义
- 创建useLeadsDetail和useLeadsFilters自定义Hooks
- 实现分页表格和筛选功能
- 添加线索详情弹窗组件
- 支持数据导出功能

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

- [ ] 分页功能正常
- [ ] 筛选功能完整
- [ ] 表格列配置正确
- [ ] 详情弹窗正常显示
- [ ] 导出功能正常
- [ ] 响应式布局正常
- [ ] 无TypeScript编译错误
- [ ] 无ESLint警告

---

**最后更新**: 2026-03-13
**维护者**: Claude AI