# 账号管理页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-step.

**Goal:** 将原生JS版本的账号管理页面迁移至React前端，实现账号-代理商映射的CRUD操作

**Architecture:** React组件化架构，支持按平台分组显示、搜索、添加、编辑、删除映射关系

**Tech Stack:** React 19, TypeScript 5, Ant Design (Table, Modal, Form, Input, Select, Button)

---

## ⚠️ 关键迁移点

### 平台差异字段

**小红书**:
- `main_account_id` - 主账号ID（广告主账户ID）
- `account_id` - 子账户ID（代理商子账户ID）
- `sub_account_name` - 子账户名称
- `account_type` - 账号类型（直投/代理商）

**腾讯/抖音**:
- `account_id` - 账号ID
- `account_name` - 账号名称
- `agency` - 代理商
- `business_model` - 业务模式

### CRUD操作

- **查询**: GET /api/v1/account-agency-mapping
- **创建**: POST /api/v1/account-mapping
- **更新**: PUT /api/v1/account-mapping/{platform}/{account_id}
- **删除**: DELETE /api/v1/account-mapping/{platform}/{account_id}

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 账号管理API类型

export interface AccountMapping {
  id: number;
  platform: '腾讯' | '抖音' | '小红书';
  account_id: string | null;
  account_name: string;
  main_account_id: string | null;
  agency: string;
  business_model: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountMappingBody {
  platform: string;
  account_id?: string;
  account_name: string;
  main_account_id?: string;
  agency: string;
  business_model: string;
}

export interface UpdateAccountMappingBody {
  account_name?: string;
  agency?: string;
  business_model?: string;
}

export interface AccountMappingListResponse {
  success: boolean;
  data: AccountMapping[];
}
```

---

## Task 2: 创建表单组件

**Files:**
- Create: `src/pages/System/AccountManagement/components/AccountFormModal.tsx`

```typescript
/**
 * 账号映射表单弹窗
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Space, Button } from 'antd';
import type { AccountMapping, CreateAccountMappingBody } from '@/types/api.schemas';

interface AccountFormModalProps {
  visible: boolean;
  editingRecord: AccountMapping | null;
  platform: string;
  onCancel: () => void;
  onSubmit: (values: CreateAccountMappingBody) => Promise<void>;
}

const AccountFormModal: React.FC<AccountFormModalProps> = ({
  visible,
  editingRecord,
  platform,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (visible) {
      if (editingRecord) {
        form.setFieldsValue(editingRecord);
      } else {
        form.resetFields();
        form.setFieldsValue({ platform });
      }
    }
  }, [visible, editingRecord, platform]);

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

  const isXiaohongshu = platform === '小红书';

  return (
    <Modal
      title={editingRecord ? '编辑账号映射' : '添加账号映射'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="platform" label="平台" hidden>
          <Input />
        </Form.Item>

        {isXiaohongshu ? (
          <>
            <Form.Item
              name="main_account_id"
              label="主账号ID"
              rules={[{ required: true, message: '请输入主账号ID' }]}
            >
              <Input placeholder="广告主账户ID" />
            </Form.Item>
            <Form.Item name="account_id" label="子账户ID">
              <Input placeholder="代理商子账户ID（直投时留空）" />
            </Form.Item>
            <Form.Item name="account_name" label="账号名称">
              <Input placeholder="账号名称" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="account_id"
              label="账号ID"
              rules={[{ required: true, message: '请输入账号ID' }]}
            >
              <Input placeholder="账号ID" />
            </Form.Item>
            <Form.Item
              name="account_name"
              label="账号名称"
              rules={[{ required: true, message: '请输入账号名称' }]}
            >
              <Input placeholder="账号名称" />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="agency"
          label="代理商"
          rules={[{ required: true, message: '请选择代理商' }]}
        >
          <Select placeholder="选择代理商">
            <Select.Option value="量子">量子</Select.Option>
            <Select.Option value="众联">众联</Select.Option>
            <Select.Option value="风声">风声</Select.Option>
            <Select.Option value="申万宏源直投">申万宏源直投</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="business_model"
          label="业务模式"
          rules={[{ required: true, message: '请选择业务模式' }]}
        >
          <Select placeholder="选择业务模式">
            <Select.Option value="直播">直播</Select.Option>
            <Select.Option value="信息流">信息流</Select.Option>
            <Select.Option value="搜索">搜索</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AccountFormModal;
```

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/System/AccountManagement/index.tsx`

```typescript
/**
 * 账号管理页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Tag, Popconfirm, message, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import AccountFormModal from './components/AccountFormModal';
import { apiClient } from '@/utils/api';
import type { AccountMapping, CreateAccountMappingBody } from '@/types/api.schemas';
import styles from './index.module.scss';

const { Title } = Typography;

const AccountManagementPage: React.FC = () => {
  const [data, setData] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AccountMapping | null>(null);
  const [currentPlatform, setCurrentPlatform] = useState<string>('腾讯');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<AccountMapping[]>('/api/v1/account-agency-mapping');
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

  const handleAdd = (platform: string) => {
    setCurrentPlatform(platform);
    setEditingRecord(null);
    setModalVisible(true);
  };

  const handleEdit = (record: AccountMapping) => {
    setCurrentPlatform(record.platform);
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleDelete = async (platform: string, accountId: string) => {
    try {
      await apiClient.delete(`/api/v1/account-mapping/${platform}/${accountId}`);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: CreateAccountMappingBody) => {
    try {
      if (editingRecord) {
        await apiClient.put(
          `/api/v1/account-mapping/${values.platform}/${editingRecord.account_id}`,
          values
        );
        message.success('更新成功');
      } else {
        await apiClient.post('/api/v1/account-mapping', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (err) {
      message.error(editingRecord ? '更新失败' : '添加失败');
    }
  };

  // 按平台分组
  const groupedData = React.useMemo(() => {
    const groups: { [key: string]: AccountMapping[] } = {
      '腾讯': [],
      '抖音': [],
      '小红书': [],
    };
    data.forEach((item) => {
      if (groups[item.platform]) {
        groups[item.platform].push(item);
      }
    });
    return groups;
  }, [data]);

  const getColumns = (platform: string) => {
    const baseColumns = [
      {
        title: '账号ID',
        dataIndex: 'account_id',
        key: 'account_id',
        render: (v: string) => v || '-',
      },
      {
        title: '账号名称',
        dataIndex: 'account_name',
        key: 'account_name',
      },
      {
        title: '代理商',
        dataIndex: 'agency',
        key: 'agency',
        render: (v: string) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: '业务模式',
        dataIndex: 'business_model',
        key: 'business_model',
        render: (v: string) => <Tag color="green">{v}</Tag>,
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_: any, record: AccountMapping) => (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定删除此映射？"
              onConfirm={() => handleDelete(record.platform, record.account_id || '')}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    if (platform === '小红书') {
      return [
        {
          title: '主账号ID',
          dataIndex: 'main_account_id',
          key: 'main_account_id',
        },
        ...baseColumns,
      ];
    }

    return baseColumns;
  };

  return (
    <div className={styles.accountManagementPage}>
      <Title level={3}>账号代理商映射管理</Title>

      {/* 搜索栏 */}
      <Card className={styles.searchCard}>
        <Space>
          <Input
            placeholder="搜索账号ID/名称/代理商"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </Space>
      </Card>

      {/* 各平台账号列表 */}
      {Object.entries(groupedData).map(([platform, items]) => (
        <Card
          key={platform}
          className={styles.platformCard}
          title={
            <Space>
              <span>{platform}</span>
              <Tag color="blue">{items.length} 个账号</Tag>
            </Space>
          }
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd(platform)}>
              添加账号
            </Button>
          }
        >
          <Table
            columns={getColumns(platform)}
            dataSource={items.filter(
              (item) =>
                !searchText ||
                item.account_id?.includes(searchText) ||
                item.account_name?.includes(searchText) ||
                item.agency?.includes(searchText)
            )}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
          />
        </Card>
      ))}

      {/* 表单弹窗 */}
      <AccountFormModal
        visible={modalVisible}
        editingRecord={editingRecord}
        platform={currentPlatform}
        onCancel={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default AccountManagementPage;
```

---

## Task 4: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import AccountManagementPage from '@/pages/System/AccountManagement';

{
  path: '/system/account-management',
  element: <AccountManagementPage />,
}
```

---

## 验收标准

- [ ] 按平台分组显示
- [ ] 搜索功能正常
- [ ] 添加/编辑/删除功能正常
- [ ] 小红书特殊字段处理正确
- [ ] 响应式布局正常

---

**最后更新**: 2026-03-13