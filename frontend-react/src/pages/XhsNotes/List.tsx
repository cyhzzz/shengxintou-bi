/**
 * 小红书笔记列表页面
 * 提供笔记搜索、筛选、分页和导出功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Select,
  Button,
  Space,
  message,
  Typography,
  DatePicker,
  Tag,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dataService } from '@/services/dataService';
import type { XhsNotesListItem } from '@/types/api.schemas';
import styles from './List.module.scss';

const { Link } = Typography;
const { RangePicker } = DatePicker;

// 内容类型选项
const CONTENT_TYPE_OPTIONS = [
  { label: '图文', value: '图文' },
  { label: '视频', value: '视频' },
];

// 快速选择日期选项
const QUICK_DATE_OPTIONS = [
  { label: '近7天', value: 7 },
  { label: '近30天', value: 30 },
  { label: '近90天', value: 90 },
];

const XhsNotesListPage: React.FC = () => {
  // 数据状态
  const [data, setData] = useState<XhsNotesListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选状态
  const [dataDateRange, setDataDateRange] = useState<[string, string]>(() => {
    const today = dayjs();
    const thirtyDaysAgo = today.subtract(30, 'day');
    return [thirtyDaysAgo.format('YYYY-MM-DD'), today.format('YYYY-MM-DD')];
  });
  const [publishDateRange, setPublishDateRange] = useState<[string, string]>(['', '']);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedAdStrategies, setSelectedAdStrategies] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // 枚举选项
  const [creatorOptions, setCreatorOptions] = useState<string[]>([]);
  const [adStrategyOptions, setAdStrategyOptions] = useState<string[]>([]);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);

  // 加载枚举值（从后端API响应中获取）
  const loadEnums = useCallback(async () => {
    try {
      // 先获取一次数据来获取筛选选项
      const response = await dataService.getXhsNotesList({
        filters: {},
        page: 1,
        page_size: 1,
      });

      if (response.success && response.data) {
        const responseData = response.data as {
          notes?: XhsNotesListItem[];
          pagination?: { page: number; page_size: number; total: number; total_pages?: number };
          filters?: {
            creators?: string[];
            producers?: string[];
            note_types?: string[];
            content_types?: string[];
            publish_accounts?: string[];
          };
        };
        setCreatorOptions(responseData.filters?.creators || responseData.filters?.producers || []);
        setAdStrategyOptions(responseData.filters?.note_types || []);
        setAccountOptions(responseData.filters?.publish_accounts || []);
      }
    } catch (error) {
      console.error('加载枚举值失败:', error);
    }
  }, []);

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 构建筛选条件
      const filters: Record<string, unknown> = {};

      // 数据时间范围
      if (dataDateRange[0] && dataDateRange[1]) {
        filters.start_date = dataDateRange[0];
        filters.end_date = dataDateRange[1];
      }

      // 发布时间范围
      if (publishDateRange[0] && publishDateRange[1]) {
        filters.publish_start_date = publishDateRange[0];
        filters.publish_end_date = publishDateRange[1];
      }

      // 创作者筛选
      if (selectedCreators.length > 0) {
        filters.creators = selectedCreators;
      }

      // 内容类型筛选
      if (selectedContentTypes.length > 0) {
        filters.content_types = selectedContentTypes;
      }

      // 广告策略筛选
      if (selectedAdStrategies.length > 0) {
        filters.ad_strategies = selectedAdStrategies;
      }

      // 账号筛选
      if (selectedAccount && selectedAccount !== '全部') {
        filters.account = selectedAccount;
      }

      // 后端期望的请求格式: { filters: {...}, page, page_size }
      const requestBody = {
        filters,
        page,
        page_size: pageSize,
      };

      const response = await dataService.getXhsNotesList({
        filters,
        page,
        page_size: pageSize,
      });

      // 后端返回格式: { success, notes, pagination: { page, page_size, total, total_pages } }
      // http 客户端将响应包装在 response.data 中
      if (response.success && response.data) {
        const responseData = response.data as {
          notes?: XhsNotesListItem[];
          pagination?: { page: number; page_size: number; total: number; total_pages?: number };
        };
        setData(responseData.notes || []);
        setTotal(responseData.pagination?.total || 0);
        setPage(responseData.pagination?.page || 1);
        setPageSize(responseData.pagination?.page_size || 50);
      } else {
        message.error('获取数据失败');
      }
    } catch (error) {
      console.error('获取笔记列表数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dataDateRange, publishDateRange, selectedCreators, selectedContentTypes, selectedAdStrategies, selectedAccount]);

  // 初始加载
  useEffect(() => {
    loadEnums();
  }, [loadEnums]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 处理查询
  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  // 处理重置
  const handleReset = () => {
    const today = dayjs();
    const thirtyDaysAgo = today.subtract(30, 'day');
    setDataDateRange([thirtyDaysAgo.format('YYYY-MM-DD'), today.format('YYYY-MM-DD')]);
    setPublishDateRange(['', '']);
    setSelectedCreators([]);
    setSelectedContentTypes([]);
    setSelectedAdStrategies([]);
    setSelectedAccount('');
    setPage(1);
  };

  // 快速选择日期
  const handleQuickDateSelect = (days: number, type: 'data' | 'publish') => {
    const today = dayjs();
    const startDate = today.subtract(days, 'day').format('YYYY-MM-DD');
    const endDate = today.format('YYYY-MM-DD');

    if (type === 'data') {
      setDataDateRange([startDate, endDate]);
    } else {
      setPublishDateRange([startDate, endDate]);
    }
  };

  // 导出CSV（包含所有24列）
  const handleExport = () => {
    if (!data.length) {
      message.warning('暂无数据可导出');
      return;
    }

    const headers = [
      '笔记ID',
      '笔记标题',
      '笔记类型',
      '内容类型',
      '创作者',
      '广告策略',
      '笔记账号',
      '发布时间',
      '总展现量',
      '总点击量',
      '总点击率',
      '总互动量',
      '消费金额',
      '推广展现量',
      '推广点击量',
      '推广点击率',
      '推广互动量',
      '私信进线人数',
      '添加企微人数',
      '企微成功添加人数',
      '加微成本',
      '开户人数',
      '开户成本',
    ];

    const csvContent = [
      headers.join(','),
      ...data.map((item) =>
        [
          item.note_id || '',
          `"${(item.note_title || '').replace(/"/g, '""')}"`,
          item.note_type || '',
          item.content_type || '',
          item.creator_name || item.producer || '',
          item.ad_strategy || '',
          item.publish_account || '',
          item.publish_time || '',
          item.impressions || 0,
          item.clicks || 0,
          item.click_rate ? `${item.click_rate.toFixed(2)}%` : '',
          item.interactions || 0,
          item.cost || 0,
          item.ad_impressions || 0,
          item.ad_clicks || 0,
          item.ad_click_rate ? `${item.ad_click_rate.toFixed(2)}%` : '',
          item.ad_interactions || 0,
          item.private_messages || 0,
          item.lead_users || 0,
          item.customer_mouth_users || 0,
          item.add_wechat_cost || '',
          item.opened_account_users || 0,
          item.open_account_cost || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `小红书笔记列表_${dataDateRange[0]}_${dataDateRange[1]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 表格列配置（24列，与旧版前端一致）
  const columns = [
    {
      title: '笔记ID',
      dataIndex: 'note_id',
      key: 'note_id',
      width: 120,
      fixed: 'left' as const,
      render: (text: string) => text || '-',
    },
    {
      title: '笔记标题',
      dataIndex: 'note_title',
      key: 'note_title',
      ellipsis: true,
      width: 200,
      render: (text: string, record: XhsNotesListItem) => {
        if (record.note_url) {
          return (
            <Link href={record.note_url} target="_blank">
              {text || '-'}
            </Link>
          );
        }
        return text || '-';
      },
    },
    {
      title: '笔记类型',
      dataIndex: 'note_type',
      key: 'note_type',
      width: 80,
      render: (text: string) => text ? <Tag color={text === '视频' ? 'blue' : 'green'}>{text}</Tag> : '-',
    },
    {
      title: '内容类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 80,
      render: (text: string) => text ? <Tag color={text === '视频' ? 'blue' : 'green'}>{text}</Tag> : '-',
    },
    {
      title: '创作者',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
      ellipsis: true,
      render: (text: string, record: XhsNotesListItem) => text || record.producer || '-',
    },
    {
      title: '广告策略',
      dataIndex: 'ad_strategy',
      key: 'ad_strategy',
      width: 120,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '笔记账号',
      dataIndex: 'publish_account',
      key: 'publish_account',
      width: 100,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '发布时间',
      dataIndex: 'publish_time',
      key: 'publish_time',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '总展现量',
      dataIndex: 'impressions',
      key: 'impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '总点击量',
      dataIndex: 'clicks',
      key: 'clicks',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '总点击率',
      dataIndex: 'click_rate',
      key: 'click_rate',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value ? `${value.toFixed(2)}%` : '-',
    },
    {
      title: '总互动量',
      dataIndex: 'interactions',
      key: 'interactions',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '消费金额',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
    },
    {
      title: '推广展现量',
      dataIndex: 'ad_impressions',
      key: 'ad_impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '推广点击量',
      dataIndex: 'ad_clicks',
      key: 'ad_clicks',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '推广点击率',
      dataIndex: 'ad_click_rate',
      key: 'ad_click_rate',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value ? `${value.toFixed(2)}%` : '-',
    },
    {
      title: '推广互动量',
      dataIndex: 'ad_interactions',
      key: 'ad_interactions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '私信进线人数',
      dataIndex: 'private_messages',
      key: 'private_messages',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '添加企微人数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 110,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '企微成功添加人数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 130,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微成本',
      dataIndex: 'add_wechat_cost',
      key: 'add_wechat_cost',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
    },
    {
      title: '开户人数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户成本',
      dataIndex: 'open_account_cost',
      key: 'open_account_cost',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value ? `¥${value.toFixed(2)}` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, record: XhsNotesListItem) => (
        <Space>
          {record.note_url && (
            <Tooltip title="查看笔记">
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                href={record.note_url}
                target="_blank"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.notesListPage}>
      {/* 筛选器卡片 */}
      <Card className={styles.filterCard} size="small">
        <Space wrap size="middle">
          {/* 数据时间 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>数据时间:</span>
            <RangePicker
              value={[dataDateRange[0] ? dayjs(dataDateRange[0]) : null, dataDateRange[1] ? dayjs(dataDateRange[1]) : null]}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDataDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                } else {
                  setDataDateRange(['', '']);
                }
              }}
              allowClear
              style={{ width: 240 }}
            />
            <Space size={4}>
              {QUICK_DATE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="small"
                  type={dataDateRange[0] === dayjs().subtract(opt.value, 'day').format('YYYY-MM-DD') ? 'primary' : 'default'}
                  onClick={() => handleQuickDateSelect(opt.value, 'data')}
                >
                  {opt.label}
                </Button>
              ))}
            </Space>
          </div>

          {/* 发布时间 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>发布时间:</span>
            <RangePicker
              value={[publishDateRange[0] ? dayjs(publishDateRange[0]) : null, publishDateRange[1] ? dayjs(publishDateRange[1]) : null]}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setPublishDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                } else {
                  setPublishDateRange(['', '']);
                }
              }}
              allowClear
              style={{ width: 240 }}
              placeholder={['发布开始', '发布结束']}
            />
          </div>

          {/* 创作者 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>创作者:</span>
            <Select
              mode="multiple"
              value={selectedCreators}
              onChange={setSelectedCreators}
              options={creatorOptions.map((c) => ({ label: c, value: c }))}
              placeholder="全部"
              allowClear
              style={{ minWidth: 150 }}
              maxTagCount="responsive"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* 内容类型 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>内容类型:</span>
            <Select
              mode="multiple"
              value={selectedContentTypes}
              onChange={setSelectedContentTypes}
              options={CONTENT_TYPE_OPTIONS}
              placeholder="全部"
              allowClear
              style={{ minWidth: 120 }}
              maxTagCount="responsive"
            />
          </div>

          {/* 广告策略 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>广告策略:</span>
            <Select
              mode="multiple"
              value={selectedAdStrategies}
              onChange={setSelectedAdStrategies}
              options={adStrategyOptions.map((s) => ({ label: s, value: s }))}
              placeholder="全部"
              allowClear
              style={{ minWidth: 150 }}
              maxTagCount="responsive"
            />
          </div>

          {/* 笔记账号 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>笔记账号:</span>
            <Select
              value={selectedAccount}
              onChange={setSelectedAccount}
              options={[{ label: '全部', value: '' }, ...accountOptions.map((a) => ({ label: a, value: a }))]}
              placeholder="全部"
              allowClear
              style={{ minWidth: 150 }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>


          {/* 操作按钮 */}
          <div className={styles.filterActions}>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>
        </Space>
      </Card>

      {/* 数据表格卡片 */}
      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>笔记列表</span>
          <Space>
            <span className={styles.statText}>共 {total.toLocaleString()} 条</span>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data.length}>
              导出
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="note_id"
          loading={loading}
          scroll={{ x: 2500 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={(pagination) => {
            setPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 50);
          }}
        />
      </Card>
    </div>
  );
};

export default XhsNotesListPage;