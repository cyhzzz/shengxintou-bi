/**
 * 简称管理页面
 * 管理简称映射的CRUD操作
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Select, Tag, message, Popconfirm, Modal, Form, Input, Switch } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { metadataService } from '@/services/metadataService';
import type { AbbreviationMapping, MappingType } from '@/types/api.schemas';
import styles from './AbbreviationManagement.module.scss';

const AbbreviationManagementPage: React.FC = () => {
  const [data, setData] = useState<AbbreviationMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AbbreviationMapping | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await metadataService.getAbbreviationMappings();
      if (response.success && response.data) {
        setData(response.data);
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

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalVisible(true);
  };

  const handleEdit = (record: AbbreviationMapping) => {
    setEditingRecord(record);
    form.setFieldsValue({
      abbreviation: record.abbreviation,
      full_name: record.full_name,
      mapping_type: record.mapping_type,
      platform: record.platform || undefined,
      display_name: record.display_name || undefined,
      description: record.description || undefined,
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const handleToggleStatus = async (record: AbbreviationMapping) => {
    try {
      const response = await metadataService.updateAbbreviationMapping(record.id, {
        is_active: !record.is_active,
      });
      if (response.success) {
        message.success(record.is_active ? '禁用成功' : '启用成功');
        fetchData();
      } else {
        message.error('操作失败');
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await metadataService.deleteAbbreviationMapping(id);
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

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editingRecord) {
        const response = await metadataService.updateAbbreviationMapping(editingRecord.id, values);
        if (response.success) {
          message.success('更新成功');
          setModalVisible(false);
          fetchData();
        } else {
          message.error('更新失败');
        }
      } else {
        const response = await metadataService.createAbbreviationMapping(values as Omit<AbbreviationMapping, 'id'>);
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
          <Popconfirm
            title="确定删除此映射？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              size="small"
              danger
            >
              删除
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
      <Modal
        title={editingRecord ? '编辑简称' : '添加简称'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
    </div>
  );
};

export default AbbreviationManagementPage;