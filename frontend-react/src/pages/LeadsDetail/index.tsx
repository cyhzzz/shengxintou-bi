/**
 * 线索明细页面
 * 展示客户线索到转化的数据明细
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { http } from '@/services/http';
import styles from './index.module.scss';
import { FadeInSection } from '@/components';

// 筛选选项类型
interface FilterOption {
  value: string;
  label: string;
}

// 筛选选项响应
interface FilterOptionsResponse {
  success: boolean;
  data: {
    platforms: FilterOption[];
    agencies: FilterOption[];
    employees: FilterOption[];
  };
}

const LeadsDetailPage: React.FC = () => {
  // 筛选状态
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-01-01', '2026-12-31']);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [employeeName, setEmployeeName] = useState<string>('');  // 服务员工
  const [isOpenedAccount, setIsOpenedAccount] = useState<string>('');

  // 筛选选项（从API加载）
  const [platformOptions, setPlatformOptions] = useState<FilterOption[]>([]);
  const [agencyOptions, setAgencyOptions] = useState<FilterOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<FilterOption[]>([]);

  // 开户状态选项（固定）
  const ACCOUNT_STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '已开户', value: 'true' },
    { label: '未开户', value: 'false' },
  ];

  // 数据状态
  const [data, setData] = useState<LeadsDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 详情弹窗状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LeadsDetailItem | null>(null);

  // 使用 ref 来追踪是否需要触发查询
  const shouldFetchRef = useRef(false);
  // 使用 ref 来存储最新的筛选条件
  const filtersRef = useRef({
    page: 1,
    pageSize: 20,
    dateRange: ['2026-01-01', '2026-12-31'] as [string, string],
    platform: '',
    employeeName: '',
    isOpenedAccount: '',
  });

  // 加载筛选选项
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response: FilterOptionsResponse = await http.get('/leads-detail/filter-options');
        if (response.success && response.data) {
          // 添加"全部"选项
          setPlatformOptions(response.data.platforms || []);
          setAgencyOptions(response.data.agencies || []);
          setEmployeeOptions([
            { value: '', label: '全部' },
            ...response.data.employees
          ]);
        }
      } catch (error) {
        console.error('加载筛选选项失败:', error);
        // 使用默认选项
        setPlatformOptions([
          { value: '', label: '全部' },
          { value: '腾讯', label: '腾讯' },
          { value: '抖音', label: '抖音' },
          { value: '小红书', label: '小红书' },
        ]);
        setEmployeeOptions([{ value: '', label: '全部' }]);
      }
    };
    loadFilterOptions();
  }, []);

  // 加载数据 - 使用 ref 来避免闭包问题
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = filtersRef.current;
      const params: Record<string, unknown> = {
        page: filters.page,
        page_size: filters.pageSize,
      };

      if (filters.dateRange[0]) {
        params.start_date = filters.dateRange[0];
      }
      if (filters.dateRange[1]) {
        params.end_date = filters.dateRange[1];
      }
      if (filters.platforms && filters.platforms.length > 0) {
        params.platforms = filters.platforms.join(',');
      }
      if (filters.agencies && filters.agencies.length > 0) {
        params.agencies = filters.agencies.join(',');
      }
      if (filters.employeeName) {
        params.employee_name = filters.employeeName;
      }
      if (filters.isOpenedAccount === 'true') {
        params.is_opened_account = true;
      } else if (filters.isOpenedAccount === 'false') {
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
  }, []);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 处理查询
  const handleSearch = () => {
    // 更新 ref 中的筛选条件
    filtersRef.current = {
      ...filtersRef.current,
      page: 1,
      dateRange,
      platforms,
      agencies,
      employeeName,
      isOpenedAccount,
    };
    setCurrentPage(1);
    fetchData();
  };

  // 处理重置
  const handleReset = () => {
    setDateRange(['', '']);
    setPlatforms([]);
    setAgencies([]);
    setEmployeeName('');
    setIsOpenedAccount('');
    setCurrentPage(1);
    // 重置 ref 中的筛选条件
    filtersRef.current = {
      page: 1,
      pageSize: filtersRef.current.pageSize,
      dateRange: ['', ''],
      platforms: [],
      agencies: [],
      employeeName: '',
      isOpenedAccount: '',
    };
    fetchData();
  };

  // 处理分页变化
  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: unknown
  ) => {
    const newPage = pagination.current || 1;
    const newPageSize = pagination.pageSize || 20;

    // 更新 ref 和 state
    filtersRef.current = {
      ...filtersRef.current,
      page: newPage,
      pageSize: newPageSize,
    };
    setCurrentPage(newPage);
    setPageSize(newPageSize);
    fetchData();
  };

  // 查看详情
  const handleViewDetail = (record: LeadsDetailItem) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // 获取筛选后的全部数据（用于导出）
  const fetchAllDataForExport = useCallback(async (): Promise<LeadsDetailItem[]> => {
    const filters = filtersRef.current;
    const allItems: LeadsDetailItem[] = [];
    const pageSize = 10000;
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, unknown> = {
        page: currentPage,
        page_size: pageSize,
      };

      if (filters.dateRange[0]) {
        params.start_date = filters.dateRange[0];
      }
      if (filters.dateRange[1]) {
        params.end_date = filters.dateRange[1];
      }
      if (filters.platforms && filters.platforms.length > 0) {
        params.platforms = filters.platforms.join(',');
      }
      if (filters.agencies && filters.agencies.length > 0) {
        params.agencies = filters.agencies.join(',');
      }
      if (filters.employeeName) {
        params.employee_name = filters.employeeName;
      }
      if (filters.isOpenedAccount === 'true') {
        params.is_opened_account = true;
      } else if (filters.isOpenedAccount === 'false') {
        params.is_opened_account = false;
      }

      const response: LeadsDetailResponse = await getLeadsDetail(params);

      if (response.success && response.data) {
        const items = response.data.items || [];
        allItems.push(...items);
        const returnedTotal = response.data.total || 0;
        // 如果已经获取了所有数据，或者返回的数据少于 page_size，说明是最后一页
        if (allItems.length >= returnedTotal || items.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
      } else {
        hasMore = false;
      }
    }

    return allItems;
  }, []);

  // 导出数据
  const handleExport = async () => {
    if (total === 0) {
      message.warning('暂无数据可导出');
      return;
    }

    const hideLoading = message.loading('正在导出，请稍候...', 0);

    try {
      // 获取筛选后的全部数据
      const allData = await fetchAllDataForExport();

      if (allData.length === 0) {
        message.warning('暂无数据可导出');
        return;
      }

      // 定义所有字段（与后端API返回一致）
      const exportFields = [
        { key: 'lead_date', label: '线索日期' },
        { key: 'platform_source', label: '平台来源' },
        { key: 'wechat_nickname', label: '微信昵称' },
        { key: 'capital_account', label: '资金账号' },
        { key: 'opening_branch', label: '开户营业部' },
        { key: 'customer_gender', label: '客户性别' },
        { key: 'traffic_type', label: '流量类型' },
        { key: 'customer_source', label: '客户来源' },
        { key: 'is_customer_mouth', label: '是否客户开口' },
        { key: 'is_valid_lead', label: '是否有效线索' },
        { key: 'is_open_account_interrupted', label: '是否开户中断' },
        { key: 'open_account_interrupted_date', label: '开户中断日期' },
        { key: 'is_opened_account', label: '是否开户' },
        { key: 'is_valid_customer', label: '是否为有效户' },
        { key: 'is_existing_customer', label: '是否为存量客户' },
        { key: 'is_existing_valid_customer', label: '是否为存量有效户' },
        { key: 'is_delete_enterprise_wechat', label: '是否删除企微' },
        { key: 'first_contact_time', label: '首次触达时间' },
        { key: 'last_contact_time', label: '最近互动时间' },
        { key: 'interaction_count', label: '互动次数' },
        { key: 'sales_interaction_count', label: '营销人员互动次数' },
        { key: 'add_employee_no', label: '添加员工号' },
        { key: 'add_employee_name', label: '添加员工姓名' },
        { key: 'account_opening_time', label: '开户时间' },
        { key: 'wechat_verify_status', label: '微信认证状态' },
        { key: 'wechat_verify_time', label: '微信认证时间' },
        { key: 'valid_customer_time', label: '有效户时间' },
        { key: 'assets', label: '资产' },
        { key: 'customer_contribution', label: '客户贡献' },
        { key: 'ad_account', label: '广告账号' },
        { key: 'agency', label: '代理商' },
        { key: 'ad_id', label: '广告ID' },
        { key: 'creative_id', label: '创意ID' },
        { key: 'note_id', label: '笔记ID' },
        { key: 'note_title', label: '笔记名称' },
        { key: 'platform_user_id', label: '平台用户ID' },
        { key: 'platform_user_nickname', label: '平台用户昵称' },
        { key: 'ad_click_date', label: '广告点击日期' },
        { key: 'producer', label: '生产者' },
        { key: 'enterprise_wechat_tags', label: '企微标签' },
      ];

      // 格式化布尔值
      const formatBool = (value?: boolean) => (value ? '是' : '否');
      // 格式化空值
      const formatValue = (value: unknown) =>
        value === null || value === undefined || value === '' ? '-' : String(value);

      // 生成CSV内容
      const header = exportFields.map(f => f.label).join(',');
      const rows = allData.map(item =>
        exportFields.map(f => {
          const value = item[f.key as keyof LeadsDetailItem];
          // 布尔值特殊处理
          if (typeof value === 'boolean') {
            return formatBool(value);
          }
          // 数字直接输出
          if (typeof value === 'number') {
            return value;
          }
          // 字符串需要处理逗号和引号
          const str = formatValue(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      );

      const csvContent = '\uFEFF' + header + '\n' + rows.join('\n'); // 添加BOM以支持中文

      // 创建下载
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `线索明细_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success(`导出成功，共 ${allData.length} 条数据`);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请重试');
    } finally {
      hideLoading();
    }
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
      <FadeInSection delay={0} duration={1}>
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
              mode="multiple"
              value={platforms}
              onChange={setPlatforms}
              options={platformOptions}
              allowClear
              maxTagCount="responsive"
              style={{ width: 200 }}
              placeholder="请选择平台"
            />
          </div>

          {/* 服务员工 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>服务员工:</span>
            <Select
              value={employeeName}
              onChange={setEmployeeName}
              options={employeeOptions}
              style={{ width: 120 }}
              placeholder="请选择员工"
              showSearch
              optionFilterProp="label"
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
      </FadeInSection>

      {/* 数据表格 */}
      <FadeInSection delay={0.15} duration={1}>
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
      </FadeInSection>

      {/* 详情弹窗 */}
      <Modal
        title="线索详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
        className={styles.detailModal}
      >
        {selectedRecord && (
          <Descriptions column={2} bordered size="small">
            {/* 基本信息 */}
            <Descriptions.Item label="线索日期">
              {selectedRecord.lead_date || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="平台来源">
              {selectedRecord.platform_source || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="微信昵称">
              {selectedRecord.wechat_nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资金账号">
              {selectedRecord.capital_account || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开户营业部">
              {selectedRecord.opening_branch || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="客户性别">
              {selectedRecord.customer_gender || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="流量类型">
              {selectedRecord.traffic_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="客户来源">
              {selectedRecord.customer_source || '-'}
            </Descriptions.Item>

            {/* 状态字段 */}
            <Descriptions.Item label="是否客户开口">
              {renderStatusTag(selectedRecord.is_customer_mouth)}
            </Descriptions.Item>
            <Descriptions.Item label="是否有效线索">
              {renderStatusTag(selectedRecord.is_valid_lead)}
            </Descriptions.Item>
            <Descriptions.Item label="是否开户中断">
              {renderStatusTag(selectedRecord.is_open_account_interrupted)}
            </Descriptions.Item>
            <Descriptions.Item label="开户中断日期">
              {selectedRecord.open_account_interrupted_date || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="是否开户">
              {renderStatusTag(selectedRecord.is_opened_account)}
            </Descriptions.Item>
            <Descriptions.Item label="是否为有效户">
              {renderStatusTag(selectedRecord.is_valid_customer)}
            </Descriptions.Item>
            <Descriptions.Item label="是否为存量客户">
              {renderStatusTag(selectedRecord.is_existing_customer)}
            </Descriptions.Item>
            <Descriptions.Item label="是否为存量有效户">
              {renderStatusTag(selectedRecord.is_existing_valid_customer)}
            </Descriptions.Item>
            <Descriptions.Item label="是否删除企微">
              {renderStatusTag(selectedRecord.is_delete_enterprise_wechat)}
            </Descriptions.Item>

            {/* 时间字段 */}
            <Descriptions.Item label="首次触达时间">
              {selectedRecord.first_contact_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最近互动时间">
              {selectedRecord.last_contact_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开户时间">
              {selectedRecord.account_opening_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="微信认证状态">
              {selectedRecord.wechat_verify_status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="微信认证时间">
              {selectedRecord.wechat_verify_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="有效户时间">
              {selectedRecord.valid_customer_time || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="广告点击日期">
              {selectedRecord.ad_click_date || '-'}
            </Descriptions.Item>

            {/* 互动数据 */}
            <Descriptions.Item label="互动次数">
              {selectedRecord.interaction_count ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="营销人员互动次数">
              {selectedRecord.sales_interaction_count ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资产">
              {selectedRecord.assets != null ? `¥${selectedRecord.assets.toLocaleString()}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="客户贡献">
              {selectedRecord.customer_contribution != null ? `¥${selectedRecord.customer_contribution.toLocaleString()}` : '-'}
            </Descriptions.Item>

            {/* 人员信息 */}
            <Descriptions.Item label="添加员工号">
              {selectedRecord.add_employee_no || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="添加员工姓名">
              {selectedRecord.add_employee_name || '-'}
            </Descriptions.Item>

            {/* 广告投放信息 */}
            <Descriptions.Item label="广告账号">
              {selectedRecord.ad_account || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="代理商">
              {selectedRecord.agency || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="广告ID">
              {selectedRecord.ad_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创意ID">
              {selectedRecord.creative_id || '-'}
            </Descriptions.Item>

            {/* 小红书笔记信息 */}
            <Descriptions.Item label="笔记ID">
              {selectedRecord.note_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="笔记名称">
              {selectedRecord.note_title || '-'}
            </Descriptions.Item>

            {/* 平台用户信息 */}
            <Descriptions.Item label="平台用户ID">
              {selectedRecord.platform_user_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="平台用户昵称">
              {selectedRecord.platform_user_nickname || '-'}
            </Descriptions.Item>

            {/* 其他信息 */}
            <Descriptions.Item label="生产者">
              {selectedRecord.producer || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="企微标签">
              {selectedRecord.enterprise_wechat_tags || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default LeadsDetailPage;