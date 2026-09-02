/**
 * 账号管理页面
 * 管理各平台账号与代理商的映射关系
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Tag, Popconfirm, message, Typography, Modal, Form, Select } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { metadataService } from '@/services/metadataService';
import type { AccountMapping } from '@/types/api.schemas';
import styles from './AccountManagement.module.scss';

const { Title } = Typography;

interface AccountMappingForm {
  platform: string;
  account_id: string;
  account_name: string;
  agency: string;
  agency_short?: string;
  business_model: string;
}

const AccountManagementPage: React.FC = () => {
  const [data, setData] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AccountMapping | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await metadataService.getAccountMappings();
      if (response.success && response.data) {
        setData(response.data as AccountMapping[]);
      } else {
        message.error('获取数据失败');
      }
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = (platform: string) => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ platform });
    setModalVisible(true);
  };

  const handleEdit = (record: AccountMapping) => {
    setEditingRecord(record);
    form.setFieldsValue({
      platform: record.platform,
      account_id: record.account_id,
      account_name: record.account_name,
      agency: record.agency,
      agency_short: record.agency_short,
      business_model: record.business_model,
    });
    setModalVisible(true);
  };

  const handleDelete = async (platform: string, accountId: string) => {
    try {
      const response = await metadataService.deleteAccountMapping(platform, accountId);
      if (response.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error('删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: AccountMappingForm) => {
    setSubmitting(true);
    try {
      if (editingRecord) {
        const response = await metadataService.updateAccountMapping(
          values.platform,
          editingRecord.account_id || '',
          values
        );
        if (response.success) {
          message.success('更新成功');
          setModalVisible(false);
          fetchData();
        } else {
          message.error('更新失败');
        }
      } else {
        const response = await metadataService.createAccountMapping(values as any);
        if (response.success) {
          message.success('添加成功');
          setModalVisible(false);
          fetchData();
        } else {
          message.error('添加失败');
        }
      }
    } catch {
      message.error(editingRecord ? '更新失败' : '添加失败');
    } finally {
      setSubmitting(false);
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
      const plat = item.platform || '';
      if (groups[plat]) {
        groups[plat].push(item);
      }
    });
    return groups;
  }, [data]);

  const getColumns = () => {
    return [
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
        title: '代理商（简称）',
        dataIndex: 'agency_short',
        key: 'agency_short',
        render: (v: string) => <Tag color="blue">{v || '-'}</Tag>,
      },
      {
        title: '代理商全称',
        dataIndex: 'agency',
        key: 'agency',
        width: 200,
        render: (v: string) => v || '-',
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
        render: (_: unknown, record: AccountMapping) => (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定删除此映射？"
              onConfirm={() => handleDelete(record.platform || '', record.account_id || '')}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];
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
            columns={getColumns()}
            dataSource={items.filter(
              (item) =>
                !searchText ||
                item.account_id?.includes(searchText) ||
                item.account_name?.includes(searchText) ||
                item.agency?.includes(searchText) || item.agency_short?.includes(searchText)
            )}
            rowKey={(record) => `${record.platform}-${record.account_id}`}
            loading={loading}
            pagination={false}
            size="small"
          />
        </Card>
      ))}

      {/* 表单弹窗 */}
      <Modal
        title={editingRecord ? '编辑账号映射' : '添加账号映射'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="platform" label="平台" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="account_id"
            label="账号ID"
            rules={[{ required: true, message: '请输入账号ID' }]}
          >
            <Input placeholder="账号ID（单层广告账号）" />
          </Form.Item>
          <Form.Item
            name="account_name"
            label="账号名称"
            rules={[{ required: true, message: '请输入账号名称' }]}
          >
            <Input placeholder="账号名称" />
          </Form.Item>

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
    </div>
  );
};

export default AccountManagementPage;
