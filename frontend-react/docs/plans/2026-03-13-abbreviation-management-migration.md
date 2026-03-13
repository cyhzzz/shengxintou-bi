# 简称管理页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的简称管理页面迁移至React前端，实现简称映射的CRUD操作

**Architecture:** React组件化架构，支持类型筛选、状态筛选、添加/编辑/启用/禁用映射

**Tech Stack:** React 19, TypeScript 5, Ant Design (Table, Modal, Form, Input, Select, Switch, Tag)

---

## ⚠️ 关键迁移点

### 简称映射表字段

| 字段 | 类型 | 说明 |
|-----|------|------|
| `abbreviation` | string | 拼音简称（如 lz, fs, YJ）|
| `full_name` | string | 全称（如 量子, 风声, 云极）|
| `mapping_type` | string | 映射类型（agency/platform）|
| `platform` | string | 适用平台（腾讯/抖音/小红书，可选）|
| `display_name` | string | 显示名称（可选）|
| `description` | string | 说明备注（可选）|
| `is_active` | boolean | 是否启用 |

### CRUD操作

- **查询**: GET /api/v1/abbreviation-mapping
- **创建**: POST /api/v1/abbreviation-mapping
- **更新**: PUT /api/v1/abbreviation-mapping/{id}
- **切换状态**: PUT /api/v1/abbreviation-mapping/{id} (仅更新 is_active)

### 特殊逻辑

- **编辑时简称不可修改**: 简称作为业务主键，编辑模式下禁用简称输入框
- **平台可选**: 留空表示适用于所有平台

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 简称映射API类型

export type MappingType = 'agency' | 'platform';

export interface AbbreviationMapping {
  id: number;
  abbreviation: string;
  full_name: string;
  mapping_type: MappingType;
  platform: string | null;
  display_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAbbreviationMappingBody {
  abbreviation: string;
  full_name: string;
  mapping_type: MappingType;
  platform?: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateAbbreviationMappingBody {
  full_name?: string;
  mapping_type?: MappingType;
  platform?: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface AbbreviationMappingListResponse {
  success: boolean;
  data: AbbreviationMapping[];
}
```

---

## Task 2: 创建表单组件

**Files:**
- Create: `src/pages/System/AbbreviationManagement/components/AbbreviationFormModal.tsx`

```typescript
/**
 * 简称映射表单弹窗
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Space, Button } from 'antd';
import type { AbbreviationMapping, CreateAbbreviationMappingBody, MappingType } from '@/types/api.schemas';

interface AbbreviationFormModalProps {
  visible: boolean;
  editingRecord: AbbreviationMapping | null;
  onCancel: () => void;
  onSubmit: (values: CreateAbbreviationMappingBody) => Promise<void>;
}

const AbbreviationFormModal: React.FC<AbbreviationFormModalProps> = ({
  visible,
  editingRecord,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (visible) {
      if (editingRecord) {
        form.setFieldsValue({
          abbreviation: editingRecord.abbreviation,
          full_name: editingRecord.full_name,
          mapping_type: editingRecord.mapping_type,
          platform: editingRecord.platform || undefined,
          display_name: editingRecord.display_name || undefined,
          description: editingRecord.description || undefined,
          is_active: editingRecord.is_active,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ is_active: true });
      }
    }
  }, [visible, editingRecord, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onSubmit(values);
      form.resetFields();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingRecord ? '编辑简称' : '添加简称'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={500}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="abbreviation"
          label="简称"
          rules={[{ required: true, message: '请输入简称' }]}
          extra="拼音简称，对应转化表中的 agency 字段"
        >
          <Input
            placeholder="如: lz, fs, YJ"
            disabled={!!editingRecord}
          />
        </Form.Item>

        <Form.Item
          name="full_name"
          label="全称"
          rules={[{ required: true, message: '请输入全称' }]}
        >
          <Input placeholder="如: 量子, 风声, 云极" />
        </Form.Item>

        <Form.Item
          name="mapping_type"
          label="类型"
          rules={[{ required: true, message: '请选择类型' }]}
        >
          <Select placeholder="请选择">
            <Select.Option value="agency">代理商</Select.Option>
            <Select.Option value="platform">平台</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="platform"
          label="适用平台"
          extra="留空表示适用于所有平台"
        >
          <Select placeholder="通用（所有平台）" allowClear>
            <Select.Option value="腾讯">腾讯</Select.Option>
            <Select.Option value="抖音">抖音</Select.Option>
            <Select.Option value="小红书">小红书</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="display_name"
          label="显示名称"
          extra="默认与全称相同"
        >
          <Input placeholder="可选" />
        </Form.Item>

        <Form.Item
          name="description"
          label="说明"
        >
          <Input.TextArea rows={2} placeholder="可选的说明备注" />
        </Form.Item>

        <Form.Item
          name="is_active"
          label="启用状态"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AbbreviationFormModal;
```

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/System/AbbreviationManagement/index.tsx`

```typescript
/**
 * 简称管理页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Select, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import AbbreviationFormModal from './components/AbbreviationFormModal';
import { apiClient } from '@/utils/api';
import type { AbbreviationMapping, CreateAbbreviationMappingBody, MappingType } from '@/types/api.schemas';
import styles from './index.module.scss';

const AbbreviationManagementPage: React.FC = () => {
  const [data, setData] = useState<AbbreviationMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AbbreviationMapping | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<AbbreviationMapping[]>('/abbreviation-mapping');
      setData(response);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    setModalVisible(true);
  };

  const handleEdit = (record: AbbreviationMapping) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleToggleStatus = async (record: AbbreviationMapping) => {
    try {
      await apiClient.put(`/abbreviation-mapping/${record.id}`, {
        is_active: !record.is_active,
      });
      message.success(record.is_active ? '禁用成功' : '启用成功');
      fetchData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values: CreateAbbreviationMappingBody) => {
    try {
      if (editingRecord) {
        await apiClient.put(`/abbreviation-mapping/${editingRecord.id}`, values);
        message.success('更新成功');
      } else {
        await apiClient.post('/abbreviation-mapping', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (err) {
      message.error(editingRecord ? '更新失败' : '添加失败');
    }
  };

  // 筛选数据
  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      if (filterType !== 'all' && item.mapping_type !== filterType) {
        return false;
      }
      if (filterStatus === 'active' && !item.is_active) {
        return false;
      }
      if (filterStatus === 'inactive' && item.is_active) {
        return false;
      }
      return true;
    });
  }, [data, filterType, filterStatus]);

  const getTypeTag = (type: MappingType) => {
    const typeConfig: Record<MappingType, { color: string; label: string }> = {
      agency: { color: 'blue', label: '代理商' },
      platform: { color: 'cyan', label: '平台' },
    };
    const config = typeConfig[type];
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const columns = [
    {
      title: '简称',
      dataIndex: 'abbreviation',
      key: 'abbreviation',
      width: 100,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '全称',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 150,
    },
    {
      title: '类型',
      dataIndex: 'mapping_type',
      key: 'mapping_type',
      width: 100,
      render: (type: MappingType) => getTypeTag(type),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <span style={{ color: '#999' }}>通用</span>,
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
      render: (v: string | null, record: AbbreviationMapping) => v || record.full_name,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (v: string | null) => v ? <small style={{ color: '#666' }}>{v}</small> : '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'error'}>
          {v ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: AbbreviationMapping) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={record.is_active ? '确定禁用此映射？' : '确定启用此映射？'}
            onConfirm={() => handleToggleStatus(record)}
          >
            <Button
              type="link"
              size="small"
              danger={record.is_active}
            >
              {record.is_active ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.abbreviationManagementPage}>
      <Card>
        <div className={styles.header}>
          <h3>简称映射管理</h3>
          <Space>
            <span className={styles.statLabel}>共 {filteredData.length} 条</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加简称
            </Button>
          </Space>
        </div>

        {/* 筛选器 */}
        <div className={styles.filters}>
          <Space>
            <div className={styles.filterGroup}>
              <label>类型:</label>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: 120 }}
              >
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="agency">代理商</Select.Option>
                <Select.Option value="platform">平台</Select.Option>
              </Select>
            </div>
            <div className={styles.filterGroup}>
              <label>状态:</label>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: 120 }}
              >
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="inactive">禁用</Select.Option>
              </Select>
            </div>
          </Space>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      {/* 表单弹窗 */}
      <AbbreviationFormModal
        visible={modalVisible}
        editingRecord={editingRecord}
        onCancel={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default AbbreviationManagementPage;
```

---

## Task 4: 创建样式文件

**Files:**
- Create: `src/pages/System/AbbreviationManagement/index.module.scss`

```scss
.abbreviationManagementPage {
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .statLabel {
    color: #666;
    margin-right: 16px;
  }

  .filters {
    margin-bottom: 16px;
    padding: 16px;
    background: #fafafa;
    border-radius: 4px;
  }

  .filterGroup {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      color: #666;
      white-space: nowrap;
    }
  }
}
```

---

## Task 5: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import AbbreviationManagementPage from '@/pages/System/AbbreviationManagement';

{
  path: '/system/abbreviation-management',
  element: <AbbreviationManagementPage />,
}
```

---

## 验收标准

- [ ] 类型筛选功能正常
- [ ] 状态筛选功能正常
- [ ] 添加功能正常（简称必填）
- [ ] 编辑功能正常（简称不可修改）
- [ ] 启用/禁用切换正常
- [ ] 表格展示正确
- [ ] 无TypeScript编译错误

---

## API参数检查清单

| API端点 | 参数 | 状态 |
|--------|------|------|
| GET /abbreviation-mapping | 无 | ✅ |
| POST /abbreviation-mapping | abbreviation, full_name, mapping_type, platform?, display_name?, description?, is_active? | ✅ |
| PUT /abbreviation-mapping/{id} | full_name?, mapping_type?, platform?, display_name?, description?, is_active? | ✅ |

---

**最后更新**: 2026-03-13