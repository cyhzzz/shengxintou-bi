/**
 * 厂商分析页面 - 混合迁移版本
 *
 * 迁移策略：
 * 1. 筛选器：使用 Ant Design FilterBar 组件
 * 2. 日级趋势图：复用旧版 AgencyAnalysisReport.js 的图表渲染逻辑
 * 3. 平台×代理商聚合表格：复用旧版 AgencyAnalysisReport.js 的表格渲染逻辑
 *
 * 技术实现：
 * - 使用 useLegacyReport Hook 管理旧版类实例
 * - 通过 convertToLegacyFormat 适配器转换筛选器数据
 * - 旧版类直接操作 DOM 容器渲染图表和表格
 */
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Segmented, Space, message, Button, Tooltip, Spin } from 'antd';
import { DollarOutlined, EyeOutlined, UserOutlined, TeamOutlined, AimOutlined, DownloadOutlined } from '@ant-design/icons';
import { FilterBar } from '@/components';
import { useFilterStore } from '@/stores';
import { useLegacyReport } from '@/hooks/useLegacyReport';
import { convertToLegacyFormat } from '@/utils/filterAdapter';
import { getAgencyAnalysis } from '@/types/api';
import type { AgencyAnalysisResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

// 指标类型
type MetricType = 'cost' | 'impressions' | 'clicks' | 'lead_users' | 'opened_account_users' | 'valid_customer_users';

// 指标标签映射
const METRIC_LABELS: Record<MetricType, string> = {
  cost: '花费',
  impressions: '曝光',
  clicks: '点击',
  lead_users: '线索',
  opened_account_users: '开户',
  valid_customer_users: '有效户',
};

// 展平后的数据类型
interface FlattenedSummaryItem {
  platform: string;
  business_model: string;
  agency: string;
  is_subtotal?: boolean;
  is_total?: boolean;
  cost: number;
  impressions: number;
  clicks: number;
  lead_users: number;
  opened_account_users: number;
  valid_customer_users: number;
  opened_account_assets: number;
  existing_customer_assets: number;
  lead_cost: number;
  account_cost: number;
}

const AgencyAnalysisPage: React.FC = () => {
  const [summary, setSummary] = useState<FlattenedSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('cost');

  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
    resetAll,
  } = useFilterStore();

  // 使用 Hook 管理旧版报表实例
  const { report, isLoading: legacyLoading, refresh, exportData } = useLegacyReport('AgencyAnalysisReport');

  // 加载汇总数据（用于顶部统计卡片）
  const fetchSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};

      if (dateRange.startDate && dateRange.endDate) {
        params.start_date = dateRange.startDate;
        params.end_date = dateRange.endDate;
      }
      if (selectedPlatforms.length > 0) {
        params.platforms = selectedPlatforms.join(',');
      }
      if (selectedAgencies.length > 0) {
        params.agencies = selectedAgencies.join(',');
      }
      if (selectedBusinessModels.length > 0) {
        params.business_models = selectedBusinessModels.join(',');
      }

      const response: AgencyAnalysisResponse = await getAgencyAnalysis(params);

      if (response.success && response.data) {
        const flattenedSummary = (response.data.summary || []).map((item: any) => {
          const m = item.metrics || {};
          return {
            platform: item.platform || '',
            business_model: item.business_model || '',
            agency: item.agency || '',
            is_subtotal: item.is_subtotal,
            is_total: item.is_total,
            cost: m.cost || 0,
            impressions: m.impressions || 0,
            clicks: m.clicks || 0,
            lead_users: m.lead_users || 0,
            opened_account_users: m.opened_account_users || 0,
            valid_customer_users: m.valid_customer_users || 0,
            opened_account_assets: m.opened_account_assets || 0,
            existing_customer_assets: m.existing_customer_assets || 0,
            lead_cost: m.lead_cost || 0,
            account_cost: m.account_cost || 0,
          };
        }) as FlattenedSummaryItem[];

        setSummary(flattenedSummary);
      }
    } catch (error) {
      console.error('获取汇总数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  // 初始加载
  useEffect(() => {
    fetchSummaryData();
  }, []);

  // 处理筛选器查询
  const handleSearch = useCallback(() => {
    // 刷新汇总数据
    fetchSummaryData();

    // 刷新旧版图表和表格
    if (report) {
      const legacyFilters = convertToLegacyFormat({
        dateRange,
        selectedPlatforms,
        selectedAgencies,
        selectedBusinessModels,
        selectedEmployees: [],
      });
      refresh(legacyFilters);
    }
  }, [report, refresh, fetchSummaryData, dateRange, selectedPlatforms, selectedAgencies, selectedBusinessModels]);

  // 处理筛选器重置
  const handleReset = useCallback(() => {
    resetAll();
    fetchSummaryData();

    // 重置旧版图表和表格
    if (report) {
      refresh({});
    }
  }, [report, refresh, fetchSummaryData, resetAll]);

  // 计算汇总数据
  const totals = useMemo(() => {
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeadUsers = 0;
    let totalOpenedAccountUsers = 0;
    let totalValidCustomerUsers = 0;

    summary.forEach(item => {
      if (item.is_subtotal || item.is_total) return;
      totalCost += item.cost || 0;
      totalImpressions += item.impressions || 0;
      totalClicks += item.clicks || 0;
      totalLeadUsers += item.lead_users || 0;
      totalOpenedAccountUsers += item.opened_account_users || 0;
      totalValidCustomerUsers += item.valid_customer_users || 0;
    });

    return {
      cost: totalCost,
      impressions: totalImpressions,
      clicks: totalClicks,
      leadUsers: totalLeadUsers,
      openedAccounts: totalOpenedAccountUsers,
      validCustomers: totalValidCustomerUsers,
    };
  }, [summary]);

  // 统计数据
  const stats = useMemo(() => {
    const agencies = new Set<string>();
    const platforms = new Set<string>();

    summary.forEach(item => {
      if (item.is_subtotal || item.is_total) return;
      if (item.platform) platforms.add(item.platform);
      if (item.agency && item.agency !== '未归因' && item.agency !== '[小计]' && item.agency !== '[合计]') {
        agencies.add(item.agency);
      }
    });

    return { agencyCount: agencies.size, platformCount: platforms.size };
  }, [summary]);

  return (
    <div className={styles.agencyAnalysisPage}>
      {/* Ant Design 筛选器 */}
      <FilterBar
        showPlatform
        showAgency
        showBusinessModel
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* 汇总统计卡片 */}
      <Row gutter={16} className={styles.summaryRow}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="总花费"
              value={totals.cost}
              precision={2}
              prefix={<DollarOutlined />}
              formatter={(value) => `¥${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="总曝光" value={totals.impressions} prefix={<EyeOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="总点击" value={totals.clicks} prefix={<AimOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="线索人数" value={totals.leadUsers} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="开户人数" value={totals.openedAccounts} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="有效户人数" value={totals.validCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* 日级趋势图容器 - 由旧版 JS 渲染 */}
      <Card className={styles.chartCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>日级趋势图</h3>
          <Space size="middle">
            <span className={styles.controlLabel}>指标:</span>
            <Segmented
              value={metric}
              onChange={(value) => {
                setMetric(value as MetricType);
                // 同步到旧版报表
                if (report && report.setCurrentMetric) {
                  report.setCurrentMetric(value);
                }
              }}
              options={Object.entries(METRIC_LABELS).map(([key, label]) => ({
                label,
                value: key,
              }))}
            />
          </Space>
        </div>
        <Spin spinning={legacyLoading}>
          {/* 旧版 ECharts 图表容器 */}
          <div id="trendChart" className={styles.chartContainer} />
        </Spin>
      </Card>

      {/* 平台×代理商聚合数据表格容器 - 由旧版 JS 渲染 */}
      <Card className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>平台×代理商聚合数据</h3>
          <Space>
            <span>代理商数量: <strong>{stats.agencyCount}</strong></span>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <span>平台数量: <strong>{stats.platformCount}</strong></span>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <Tooltip title="导出为Excel格式">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={exportData}
                disabled={!report}
              >
                导出Excel
              </Button>
            </Tooltip>
          </Space>
        </div>
        <Spin spinning={loading || legacyLoading}>
          {/* 旧版表格容器 */}
          <div id="agencyTable" className={styles.tableContainer} />
        </Spin>
      </Card>
    </div>
  );
};

export default AgencyAnalysisPage;