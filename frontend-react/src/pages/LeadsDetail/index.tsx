/**
 * 线索明细页面
 * 展示客户线索到转化的数据明细
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Select,
  Tag,
  Modal,
  Descriptions,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue } from 'antd/es/table/interface';
import { DateRangePicker } from '@/components/Filter';
import { getLeadsDetail } from '@/types/api';
import type { LeadsDetailItem, LeadsDetailResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

// 平台选项
const PLATFORM_OPTIONS = [
  { label: '全部', value: '' },
  { label: '腾讯', value: '腾讯' },
  { label: '抖音', value: '抖音' },
  { label: '小红书', value: '小红书' },
];

// 客户状态选项
const CUSTOMER_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '是客户', value: 'true' },
  { label: '非客户', value: 'false' },
];

// 开户状态选项
const ACCOUNT_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '已开户', value: 'true' },
  { label: '未开户', value: 'false' },
];

const LeadsDetailPage: React.FC = () => {
  // 筛选状态
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [platform, setPlatform] = useState<string>('');
  const [isCustomer, setIsCustomer] = useState<string>('');
  const [isOpenedAccount, setIsOpenedAccount] = useState<string>('');

  // 数据状态
  const [data, setData] = useState<LeadsDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 详情弹窗状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LeadsDetailItem | null>(null);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: currentPage,
        page_size: pageSize,
      };

      if (dateRange[0]) {
        params.start_date = dateRange[0];
      }
      if (dateRange[1]) {
        params.end_date = dateRange[1];
      }
      if (platform) {
        params.platform = platform;
      }
      if (isCustomer === 'true') {
        params.is_customer = true;
      } else if (isCustomer === 'false') {
        params.is_customer = false;
      }
      if (isOpenedAccount === 'true') {
        params.is_opened_account = true;
      } else if (isOpenedAccount === 'false') {
        params.is_opened_account = false;
      }

      const response: LeadsDetailResponse = await getLeadsDetail(params);

      if (response.success && response.data) {
        setData(response.data.items || []);
        setTotal(response.data.total || 0);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取线索明细失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, dateRange, platform, isCustomer, isOpenedAccount]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 处理查询
  const handleSearch = () => {
    setCurrentPage(1);
    fetchData();
  };

  // 处理重置
  const handleReset = () => {
    setDateRange(['', '']);
    setPlatform('');
    setIsCustomer('');
    setIsOpenedAccount('');
    setCurrentPage(1);
  };

  // 处理分页变化
  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: unknown
  ) => {
    if (pagination.current) {
      setCurrentPage(pagination.current);
    }
    if (pagination.pageSize) {
      setPageSize(pagination.pageSize);
    }
  };

  // 查看详情
  const handleViewDetail = (record: LeadsDetailItem) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // 导出数据
  const handleExport = () => {
    message.info('导出功能开发中...');
  };

  // 渲染状态标签
  const renderStatusTag = (value?: boolean) => {
    if (value === true) {
      return <Tag color="success">是</Tag>;
    } else if (value === false) {
      return <Tag color="default">否</Tag>;
    }
    return <Tag>-</Tag>;
  };

  // 表格列配置
  const columns: ColumnsType<LeadsDetailItem> = [
    {
      title: '线索日期',
      dataIndex: 'lead_date',
      key: 'lead_date',
      width: 110,
      fixed: 'left',
    },
    {
      title: '平台',
      dataIndex: 'platform_source',
      key: 'platform_source',
      width: 90,
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
      width: 140,
      ellipsis: true,
    },
    {
      title: '资金账号',
      dataIndex: 'capital_account',
      key: 'capital_account',
      width: 120,
      ellipsis: true,
    },
    {
      title: '是否客户',
      dataIndex: 'is_customer',
      key: 'is_customer',
      width: 90,
      align: 'center',
      render: renderStatusTag,
    },
    {
      title: '有效线索',
      dataIndex: 'is_valid_lead',
      key: 'is_valid_lead',
      width: 90,
      align: 'center',
      render: renderStatusTag,
    },
    {
      title: '已开户',
      dataIndex: 'is_opened_account',
      key: 'is_opened_account',
      width: 90,
      align: 'center',
      render: renderStatusTag,
    },
    {
      title: '有效户',
      dataIndex: 'is_valid_customer',
      key: 'is_valid_customer',
      width: 90,
      align: 'center',
      render: renderStatusTag,
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
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.leadsDetailPage}>
      {/* 筛选器 */}
      <Card className={styles.filterCard} size="small">
        <div className={styles.filterRow}>
          {/* 日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>日期范围:</span>
            <DateRangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
            />
          </div>

          {/* 平台筛选 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>平台:</span>
            <Select
              value={platform}
              onChange={setPlatform}
              options={PLATFORM_OPTIONS}
              style={{ width: 120 }}
            />
          </div>

          {/* 客户状态 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>客户状态:</span>
            <Select
              value={isCustomer}
              onChange={setIsCustomer}
              options={CUSTOMER_STATUS_OPTIONS}
              style={{ width: 100 }}
            />
          </div>

          {/* 开户状态 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>开户状态:</span>
            <Select
              value={isOpenedAccount}
              onChange={setIsOpenedAccount}
              options={ACCOUNT_STATUS_OPTIONS}
              style={{ width: 100 }}
            />
          </div>

          {/* 操作按钮 */}
          <div className={styles.filterActions}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>
        </div>
      </Card>

      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>线索明细</span>
          <Space>
            <span className={styles.statText}>共 {total} 条</span>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) =>
            `${record.lead_date}-${record.platform_source}-${record.wechat_nickname}-${record.capital_account}`
          }
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="线索详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
        className={styles.detailModal}
      >
        {selectedRecord && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="线索日期" span={1}>
              {selectedRecord.lead_date || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="平台" span={1}>
              {selectedRecord.platform_source || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="广告账号" span={2}>
              {selectedRecord.ad_account || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="代理商" span={1}>
              {selectedRecord.agency || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="微信昵称" span={1}>
              {selectedRecord.wechat_nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资金账号" span={2}>
              {selectedRecord.capital_account || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="是否客户">
              {renderStatusTag(selectedRecord.is_customer)}
            </Descriptions.Item>
            <Descriptions.Item label="有效线索">
              {renderStatusTag(selectedRecord.is_valid_lead)}
            </Descriptions.Item>
            <Descriptions.Item label="已开户">
              {renderStatusTag(selectedRecord.is_opened_account)}
            </Descriptions.Item>
            <Descriptions.Item label="有效户">
              {renderStatusTag(selectedRecord.is_valid_customer)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default LeadsDetailPage;