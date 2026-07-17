/**
 * 小红书运营分析页面
 * 分析笔记运营效果、创作者内容和转化数据
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Select,
  Button,
  Space,
  message,
  Spin,
  Typography,
  Dropdown,
  Segmented,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  DesktopOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import EChartsComponent from '@/components/Chart/ECharts';
import { DateRangePicker } from '@/components/Filter';
import { postXhsOperationAnalysis } from '@/types/api';
import { metadataService } from '@/services/metadataService';
import type {
  XhsOperationAnalysisData,
  XhsCreatorContentItem,
  XhsCreatorConversionItem,
  XhsTopNoteItem,
  XhsAgencyDataItem,
  XhsEmployeeConversionItem,
} from '@/types/api.schemas';
import styles from './Operation.module.scss';
import html2canvas from 'html2canvas';

const { Link, Text } = Typography;

// 精致卡片标题组件 - 参考数据概览页样式
// plain=true 时仅返回文本，不包含cardHeader包装（用于Card组件的title prop）
const CardTitle: React.FC<{ icon?: string; children: React.ReactNode; plain?: boolean }> = ({ icon, children, plain }) => {
  if (plain) {
    return (
      <Text type="secondary" className={styles.cardTitle}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {children}
      </Text>
    );
  }
  return (
    <div className={styles.cardHeader}>
      <Text type="secondary" className={styles.cardTitle}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {children}
      </Text>
    </div>
  );
};

const XhsNotesOperationPage: React.FC = () => {
  // 页面内容ref - 用于导出
  const pageRef = useRef<HTMLDivElement>(null);

  // 导出功能 - 手机友好长图 / PDF
  // v3.2.3：切到 H5 模式（480px poster 布局）截图，截图后恢复原模式
  const handleExportReport = async (type: 'image' | 'pdf') => {
    if (!pageRef.current) {
      message.error('无法获取页面内容');
      return;
    }

    // 记录原模式，截图后恢复
    const originalMode = viewMode;
    try {
      message.loading({ content: '正在生成报表...', key: 'export' });

      // 1. 切到 H5 模式（如果还没在）
      if (originalMode !== 'h5') {
        setViewMode('h5');
        // 等两帧让 React 重渲染 + ECharts 重绘
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const element = pageRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f1419' : '#ffffff',
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = `小红书运营分析报表_${dateStr}`;

      if (type === 'image') {
        const link = document.createElement('a');
        link.download = `${baseName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        message.success({ content: '导出图片成功（H5 手机友好长图）', key: 'export' });
      } else {
        const jsPDF = (await import('jspdf')).jsPDF;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 5;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;

        const imgHeightInPdf = (canvas.height / canvas.width) * usableWidth;
        const sliceHeightInCanvas = Math.round((usableHeight / imgHeightInPdf) * canvas.width);
        const totalSlices = Math.ceil(canvas.height / sliceHeightInCanvas);

        for (let i = 0; i < totalSlices; i++) {
          const startY = i * sliceHeightInCanvas;
          const actualSliceHeight = Math.min(sliceHeightInCanvas, canvas.height - startY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = actualSliceHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(canvas, 0, startY, canvas.width, actualSliceHeight, 0, 0, canvas.width, actualSliceHeight);

          const imgData = sliceCanvas.toDataURL('image/png');
          const sliceHeightInPdf = (actualSliceHeight / canvas.width) * usableWidth;

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, sliceHeightInPdf);
        }

        pdf.save(`${baseName}.pdf`);
        message.success({ content: `导出PDF成功（H5 手机友好 · 共 ${totalSlices} 页）`, key: 'export' });
      }
    } catch (error) {
      console.error('[XhsNotes/Operation] 导出失败:', error);
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      message.error({ content: `导出失败 · ${detail}。如重试仍失败请刷新本页重试。`, key: 'export', duration: 6 });
    } finally {
      // 2. 恢复原模式
      if (originalMode !== viewMode) {
        setViewMode(originalMode);
      }
    }
  };

  // 导出菜单配置
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'image',
      icon: <FileImageOutlined />,
      label: '导出图片 · 手机友好长图',
      onClick: () => handleExportReport('image'),
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '导出 PDF · 手机友好分页',
      onClick: () => handleExportReport('pdf'),
    },
  ];

  // v3.1.10: 全局日期默认值统一为 2026-01-01 ~ 2026-12-31（与所有报表保持一致）
  const getDefaultDateRangeFromData = (
    _dataStart?: string | null,
    _dataEnd?: string | null,
    _fallbackDays?: number
  ): [string, string] => ['2026-01-01', '2026-12-31'];

  const getDefaultDateRange = (_days?: number): [string, string] =>
    ['2026-01-01', '2026-12-31'];

  // 数据可用日期范围（从元数据获取）
  const [xhsDataDateRange, setXhsDataDateRange] = useState<{ start: string | null; end: string | null } | null>(null);

  // 主筛选日期范围 - 初始为空，等待元数据加载后设置
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  // 笔记排行榜日期范围
  const [topNotesDateRange, setTopNotesDateRange] = useState<[string, string] | null>(null);

  // 数据状态
  const [data, setData] = useState<XhsOperationAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // 独立模块加载状态 - 用于优秀笔记排行榜
  const [topNotesLoading, setTopNotesLoading] = useState(false);

  // 当前选中的图表Tab
  const [creationChartType, setCreationChartType] = useState<string>('impressions');

  // v3.2.3：视图模式 - Web 桌面布局 / H5 手机布局（480px poster）
  // H5 模式参考报告生成页 poster 容器，所有双列改单列，导出截图即手机友好长图
  const [viewMode, setViewMode] = useState<'web' | 'h5'>('web');

  // 加载元数据获取日期范围
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await metadataService.getMetadata();
        if (response.success && response.data?.xhs_notes_date_range) {
          const xhsRange = response.data.xhs_notes_date_range;
          setXhsDataDateRange(xhsRange);

          // 设置默认日期范围（基于数据可用日期）
          const defaultRange = getDefaultDateRangeFromData(xhsRange.start, xhsRange.end, 30);
          setDateRange(defaultRange);
          setTopNotesDateRange(defaultRange);
        } else {
          // 回退到默认30天
          const defaultRange = getDefaultDateRange(30);
          setDateRange(defaultRange);
          setTopNotesDateRange(defaultRange);
        }
        setMetadataLoaded(true);
      } catch (error) {
        console.error('获取元数据失败:', error);
        // 回退到默认30天
        const defaultRange = getDefaultDateRange(30);
        setDateRange(defaultRange);
        setTopNotesDateRange(defaultRange);
        setMetadataLoaded(true);
      }
    };

    fetchMetadata();
  }, []);

  // 加载数据
  const fetchData = useCallback(async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning('请选择主日期范围');
      return;
    }

    setLoading(true);
    try {
      const filters: Record<string, unknown> = {
        date_range: dateRange,
      };

      // 添加可选日期范围
      if (topNotesDateRange?.[0] && topNotesDateRange?.[1]) {
        filters.top_notes_date_range = topNotesDateRange as [string, string];
      }

      const response = await postXhsOperationAnalysis({ filters });

      // 后端返回格式: { success: true, data: { core_metrics, creator_content_data, ... } }
      // response.data 已经是 XhsOperationAnalysisData 类型
      if (response.success && response.data) {
        setData(response.data);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取小红书运营分析数据失败:', error);
      message.error('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 处理查询
  const handleSearch = () => {
    fetchData();
  };

  // 独立获取笔记排行榜数据
  const fetchTopNotesData = useCallback(async (notesDateRange: [string, string]) => {
    setTopNotesLoading(true);
    try {
      const filters: Record<string, unknown> = {
        top_notes_date_range: notesDateRange,
      };
      const response = await postXhsOperationAnalysis({ filters });
      if (response.success && response.data) {
        setData(prev => prev ? { ...prev, top_notes: response.data.top_notes } : response.data);
      }
    } catch (error) {
      console.error('获取笔记排行榜数据失败:', error);
    } finally {
      setTopNotesLoading(false);
    }
  }, []);

  // 组件加载时自动获取数据（等待元数据加载完成）
  useEffect(() => {
    if (metadataLoaded && dateRange) {
      fetchData();
    }
  }, [metadataLoaded, fetchData]);

  // 检查日期范围是否匹配（用于高亮快速日期按钮）
  const isDateRangeActive = (range: [string, string] | null, type: 'days30' | 'ytd'): boolean => {
    // 防止 null 值导致崩溃
    if (!range || !range[0] || !range[1]) {
      return false;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'days7') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      const expectedStart = startDate.toISOString().split('T')[0];
      return range[0] === expectedStart && range[1] === todayStr;
    } else if (type === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      const expectedStart = startDate.toISOString().split('T')[0];
      return range[0] === expectedStart && range[1] === todayStr;
    } else if (type === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const expectedStart = yearStart.toISOString().split('T')[0];
      return range[0] === expectedStart && range[1] === todayStr;
    } else if (type === 'all') {
      // 全部选项：比较当前范围是否等于元数据全量范围
      if (xhsDataDateRange?.start && xhsDataDateRange?.end) {
        return range[0] === xhsDataDateRange.start && range[1] === xhsDataDateRange.end;
      }
      return false;
    }
    return false;
  };

  // 快速选择日期 - 笔记排行榜独立筛选器
  const handleQuickDateSelect = async (type: 'topNotes', option: 'days30' | 'ytd') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (option === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      const startStr = startDate.toISOString().split('T')[0];
      if (type === 'topNotes') {
        const newRange: [string, string] = [startStr, todayStr];
        setTopNotesDateRange(newRange);
        await fetchTopNotesData(newRange);
      }
    } else if (option === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const startStr = yearStart.toISOString().split('T')[0];
      if (type === 'topNotes') {
        const newRange: [string, string] = [startStr, todayStr];
        setTopNotesDateRange(newRange);
        await fetchTopNotesData(newRange);
      }
    }
  };

  // 顶部筛选器快速选择日期
  const handleQuickDateSelectTop = (option: 'days7' | 'days30' | 'ytd' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (option === 'days7') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      setDateRange([startDate.toISOString().split('T')[0], todayStr]);
    } else if (option === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      setDateRange([startDate.toISOString().split('T')[0], todayStr]);
    } else if (option === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      setDateRange([yearStart.toISOString().split('T')[0], todayStr]);
    } else if (option === 'all') {
      // 使用元数据全量范围
      if (xhsDataDateRange?.start && xhsDataDateRange?.end) {
        setDateRange([xhsDataDateRange.start, xhsDataDateRange.end]);
      } else {
        setDateRange([xhsDataDateRange?.start || todayStr, xhsDataDateRange?.end || todayStr]);
      }
    }
  };

  // 处理重置
  const handleReset = () => {
    // 重置为基于数据的默认日期范围
    const defaultRange = getDefaultDateRangeFromData(
      xhsDataDateRange?.start,
      xhsDataDateRange?.end,
      30
    );
    setDateRange(defaultRange);
    setTopNotesDateRange(defaultRange);
    setData(null);
  };

  // 格式化数字（添加千分位）
  const formatNumber = (value: number, decimals: number = 0): string => {
    if (decimals > 0) {
      return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 渲染转化率卡片（动态颜色）
  const renderRateCard = (title: string, value: number, subtitle: string) => {
    // 根据数值大小动态设置颜色
    let color = '#171A23';
    if (value >= 10) {
      color = '#52C41A'; // 绿色 - 优秀
    } else if (value >= 5) {
      color = '#1890FF'; // 蓝色 - 良好
    } else if (value >= 2) {
      color = '#FA8C16'; // 橙色 - 一般
    } else if (value > 0) {
      color = '#F5222D'; // 红色 - 较低
    }

    return (
      <div style={{
        background: 'var(--bg-content)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacer-12)',
        textAlign: 'center',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacer-4)' }}>{subtitle}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacer-6)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color }}>
          {value.toFixed(2)}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', marginLeft: 'var(--spacer-2)' }}>%</span>
        </div>
      </div>
    );
  };

  // 渲染成本卡片（动态颜色）
  const renderCostCard = (title: string, value: number, unit: string) => {
    // 根据成本大小动态设置颜色
    let color = '#52C41A';
    let bgColor = '#F6FFED';

    if (value >= 1000) {
      color = '#F5222D'; // 红色 - 成本高
      bgColor = '#FFF1F0';
    } else if (value >= 500) {
      color = '#FA8C16'; // 橙色 - 成本中等偏高
      bgColor = '#FFF7E6';
    } else if (value >= 100) {
      color = '#1890FF'; // 蓝色 - 成本中等
      bgColor = '#E8F4FF';
    }

    return (
      <div style={{
        background: bgColor,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 12,
        transition: 'all 0.2s ease'
      }}>
        <div style={{ fontSize: 'var(--text-sm)', color, fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacer-6)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          ¥{formatNumber(value, 2)}
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', marginLeft: 'var(--spacer-4)', color: 'var(--color-text-tertiary)' }}>{unit}</span>
        </div>
      </div>
    );
  };

  // 导出CSV
  const handleExport = (exportType: string) => {
    if (!data) {
      message.warning('暂无数据可导出');
      return;
    }

    let csvContent = '';
    let filename = '';

    const safeDateRange = dateRange ?? ['', ''];
    const safeTopNotesRange = topNotesDateRange ?? ['', ''];

    switch (exportType) {
      case 'creator_summary':
        csvContent = exportCreatorSummaryData(creatorSummaryData);
        filename = `创作者综合分析_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      case 'top_notes':
        csvContent = exportTopNotesData(data.top_notes ?? []);
        filename = `笔记排行榜_${safeTopNotesRange[0] || safeDateRange[0]}_${safeTopNotesRange[1] || safeDateRange[1]}.csv`;
        break;
      case 'employee_conversion':
        csvContent = exportEmployeeConversionData(data.employee_conversion_ranking ?? []);
        filename = `员工转化排行_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      case 'agency_data':
        csvContent = exportAgencyData(data.agency_data ?? []);
        filename = `代理商数据_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      default:
        return;
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 导出创作者综合分析数据（合并原 4 表：内容 / 转化 / 创作 / 互动）
  const exportCreatorSummaryData = (items: typeof creatorSummaryData) => {
    const headers = ['生产者', '笔记数', '曝光量', '点击量', '互动量', '点击率', '互动率', '私信', '加微数', '企微添加', '开户数', '消耗'];
    const rows = items.map(item => [
      item.producer,
      item.note_count,
      item.total_impressions,
      item.total_clicks,
      item.total_interactions,
      `${item.avg_click_rate != null ? item.avg_click_rate.toFixed(2) : '0.00'}%`,
      `${item.avg_interaction_rate != null ? item.avg_interaction_rate.toFixed(2) : '0.00'}%`,
      item.private_messages,
      item.lead_users,
      item.customer_mouth_users,
      item.opened_account_users,
      item.total_cost,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出笔记排行榜数据
  const exportTopNotesData = (items: XhsTopNoteItem[]) => {
    const headers = ['笔记ID', '笔记标题', '发布时间', '生产者', '投放策略', '消耗', '曝光量', '点击量', '私信量', '加微数', '开户数'];
    const rows = items.map(item => [
      item.note_id,
      item.note_title,
      item.note_publish_time,
      item.producer,
      item.ad_strategy,
      item.total_cost,
      item.total_impressions,
      item.total_clicks,
      item.total_private_messages,
      item.lead_users,
      item.opened_account_users,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出员工转化数据
  const exportEmployeeConversionData = (items: XhsEmployeeConversionItem[]) => {
    const headers = ['员工姓名', '加微数', '有效线索数', '开户数', '有效户数', '开户率', '有效户率', '总资产'];
    const rows = items.map(item => [
      item.employee_name,
      item.lead_users,
      item.valid_lead_users,
      item.opened_account_users,
      item.valid_customer_users,
      `${item.opening_rate.toFixed(2)}%`,
      `${item.valid_customer_rate.toFixed(2)}%`,
      item.total_assets || 0,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出代理商数据
  const exportAgencyData = (items: XhsAgencyDataItem[]) => {
    const headers = ['代理商', '投放金额', '曝光量', '点击量', '加微数', '开口数', '有效线索', '开户数', '有效户'];
    const rows = items.map(item => [
      item.agency,
      item.total_cost,
      item.total_impressions,
      item.total_clicks,
      item.lead_users,
      item.customer_mouth_users,
      item.valid_lead_users,
      item.opened_account_users,
      item.valid_customer_users,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 创作趋势图表配置 - ECharts
  const creationTrendOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    const yField = creationChartType === 'impressions' ? '曝光量' :
                   creationChartType === 'interactions' ? '互动量' :
                   creationChartType === 'cost' ? '消耗' : '笔记数';

    const seriesData = data.creation_trend.dates.map((date, index) => {
      const value = creationChartType === 'impressions' ? data.creation_trend?.impression_series[index] || 0 :
                   creationChartType === 'interactions' ? data.creation_trend?.interaction_series[index] || 0 :
                   creationChartType === 'cost' ? data.creation_trend?.cost_series[index] || 0 :
                   data.creation_trend?.note_counts[index] || 0;
      return [date, value];
    });

    return {
      tooltip: {
        trigger: 'axis',
        showContent: true,
      },
      legend: {
        show: false,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.creation_trend.dates,
        axisLabel: {
          rotate: data.creation_trend.dates.length > 30 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        name: yField,
      },
      series: [{
        name: yField,
        type: 'line',
        smooth: true,
        data: seriesData.map(d => d[1]),
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: { color: '#1890ff' },
        lineStyle: { color: '#1890ff' },
      }],
    };
  }, [data?.creation_trend, creationChartType]);

  // 转化趋势图表配置 - ECharts 分组柱状图（原样复制旧版）
  const conversionTrendOption = useMemo((): EChartsOption => {
    if (!data?.conversion_trend?.weeks?.length) return {};

    const types = ['加微数', '开口客户数', '有效线索数', '开户数'];
    const colorSets = [
      ['#6366f1', '#818cf8'],
      ['#10b981', '#34d399'],
      ['#f59e0b', '#fbbf24'],
      ['#ec4899', '#f472b6'],
    ];

    // v3.2.3: 周维度（上周五到本周四），把 YYYY-MM-DD 转为 MM-DD~MM-DD 友好显示
    const formatWeekLabel = (weekStart: string): string => {
      try {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fmt = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        return `${fmt(start)}~${fmt(end)}`;
      } catch {
        return weekStart;
      }
    };
    const weekLabels = data.conversion_trend.weeks.map(formatWeekLabel);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const week = params[0]?.axisValue || '';
          let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
          params.forEach((p: any) => {
            result += `<div style="margin: 5px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
              <span style="color: #5a5c66;">${p.seriesName}:</span>
              <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value} 个</span>
            </div>`;
          });
          return result;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e8e9eb',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          fontSize: 12,
        },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;',
      },
      legend: {
        data: types,
        bottom: '2%',
        left: 'center',
        itemWidth: 16,
        itemHeight: 16,
        itemGap: 24,
        textStyle: {
          fontSize: 13,
          color: '#5a5c66',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: weekLabels,
        axisLabel: {
          rotate: 30,
          fontSize: 11,
          color: '#8a8d99',
          interval: 0,
          margin: 12,
        },
        axisLine: {
          lineStyle: {
            color: '#e8e9eb',
          },
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: '个数',
        nameTextStyle: {
          fontSize: 12,
          color: '#8a8d99',
          padding: [0, 0, 0, -8],
        },
        axisLabel: {
          fontSize: 11,
          color: '#8a8d99',
          formatter: (value: number) => {
            if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'k';
            }
            return value.toString();
          },
        },
        axisLine: {
          lineStyle: {
            color: '#e8e9eb',
          },
        },
        splitLine: {
          lineStyle: {
            color: '#f0f1f3',
            type: 'dashed' as const,
          },
        },
      },
      series: types.map((type, index) => ({
        name: type,
        type: 'bar' as const,
        data: type === '加微数' ? data.conversion_trend?.lead_users :
              type === '开口客户数' ? data.conversion_trend?.customer_mouth_users :
              type === '有效线索数' ? data.conversion_trend?.valid_lead_users :
              data.conversion_trend?.opened_account_users || [],
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colorSets[index][0] },
              { offset: 1, color: colorSets[index][1] },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 48,
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colorSets[index][0] },
                { offset: 1, color: colorSets[index][1] },
              ],
            },
          },
        },
      })),
      animationDuration: 1000,
      animationEasing: 'cubicOut' as const,
      animationDelay: (idx: number) => idx * 50,
    };
  }, [data?.conversion_trend]);

  // 创作量趋势图表配置 - v3.2.3：按创作者堆叠柱状图
  const creationVolumeOption = useMemo((): EChartsOption => {
    const matrix = data?.creation_trend?.producer_matrix;
    if (!matrix?.months?.length || !matrix?.producers?.length) return {};

    // ECharts 调色板（10 色）
    const palette = [
      '#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E86452',
      '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3',
    ];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: matrix.producers,
        bottom: '2%',
        type: 'scroll',
        textStyle: { fontSize: 11, color: '#5a5c66' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: matrix.months,
        axisLabel: {
          fontSize: 11,
          color: '#8a8d99',
        },
      },
      yAxis: {
        type: 'value',
        name: '笔记数',
        nameTextStyle: { fontSize: 12, color: '#8a8d99' },
        axisLabel: { fontSize: 11, color: '#8a8d99' },
        splitLine: { lineStyle: { color: '#f0f1f3', type: 'dashed' as const } },
      },
      series: matrix.producers.map((producer, idx) => ({
        name: producer,
        type: 'bar' as const,
        stack: 'total',
        data: matrix.matrix[producer] || [],
        itemStyle: { color: palette[idx % palette.length] },
        emphasis: { focus: 'series' as const },
        barMaxWidth: 40,
      })),
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
    };
  }, [data?.creation_trend]);

  // 互动量趋势图表配置 - ECharts 双Y轴折线图（原样复制旧版）
  const interactionTrendOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    const formatNumber = (value: number): string => {
      if (value >= 10000) {
        return (value / 10000).toFixed(1) + '万';
      }
      return value.toString();
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        show: false,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.creation_trend.dates,
        axisLabel: {
          rotate: data.creation_trend.dates.length > 30 ? 45 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '曝光量',
          position: 'left' as const,
          axisLabel: {
            formatter: formatNumber,
          },
        },
        {
          type: 'value',
          name: '互动量',
          position: 'right' as const,
          axisLabel: {
            formatter: formatNumber,
          },
        },
      ],
      series: [
        {
          name: '曝光量',
          type: 'line',
          yAxisIndex: 0,
          data: data.creation_trend.impression_series,
          smooth: true,
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
                { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
              ],
            },
          },
        },
        {
          name: '互动量',
          type: 'line',
          yAxisIndex: 1,
          data: data.creation_trend.interaction_series,
          smooth: true,
          itemStyle: { color: '#faad14' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(250, 173, 20, 0.3)' },
                { offset: 1, color: 'rgba(250, 173, 20, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [data?.creation_trend]);

  // 创作者综合分析数据 - 合并 creator_content_data + creator_conversion_data
  const creatorSummaryData = useMemo(() => {
    const contentList = data?.creator_content_data ?? [];
    const conversionList = data?.creator_conversion_data ?? [];
    const contentMap = new Map<string, XhsCreatorContentItem>();
    contentList.forEach(item => {
      if (item.producer) contentMap.set(item.producer, item);
    });
    const merged: Array<{
      producer: string;
      note_count: number;
      total_impressions: number;
      total_clicks: number;
      total_interactions: number;
      avg_click_rate: number | null;
      avg_interaction_rate: number | null;
      private_messages: number;
      lead_users: number;
      customer_mouth_users: number;
      opened_account_users: number;
      total_cost: number;
    }> = [];
    const conversionMap = new Map<string, XhsCreatorConversionItem>();
    conversionList.forEach(item => {
      if (item.producer) conversionMap.set(item.producer, item);
    });
    // 以 content 为主，转化数据合并进来；转化有但 content 没有的也补上
    const seenProducers = new Set<string>();
    contentList.forEach(c => {
      const cv = conversionMap.get(c.producer);
      seenProducers.add(c.producer);
      merged.push({
        producer: c.producer,
        note_count: c.note_count || 0,
        total_impressions: c.total_impressions || 0,
        total_clicks: c.total_clicks || 0,
        total_interactions: c.total_interactions || 0,
        avg_click_rate: c.avg_click_rate ?? null,
        avg_interaction_rate: c.avg_interaction_rate ?? null,
        private_messages: cv?.private_messages || 0,
        lead_users: cv?.lead_users || 0,
        customer_mouth_users: cv?.customer_mouth_users || 0,
        opened_account_users: cv?.opened_account_users || 0,
        total_cost: c.total_cost || 0,
      });
    });
    conversionList.forEach(cv => {
      if (!seenProducers.has(cv.producer)) {
        merged.push({
          producer: cv.producer,
          note_count: 0,
          total_impressions: 0,
          total_clicks: 0,
          total_interactions: 0,
          avg_click_rate: null,
          avg_interaction_rate: null,
          private_messages: cv.private_messages || 0,
          lead_users: cv.lead_users || 0,
          customer_mouth_users: cv.customer_mouth_users || 0,
          opened_account_users: cv.opened_account_users || 0,
          total_cost: cv.total_cost || 0,
        });
      }
    });
    // 默认按消耗降序（与原创作者内容表口径一致）
    return merged.sort((a, b) => b.total_cost - a.total_cost);
  }, [data?.creator_content_data, data?.creator_conversion_data]);

  // 创作者综合分析表格列配置（合并原 4 表：内容 / 转化 / 创作 / 互动）
  const creatorSummaryColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? 'var(--color-text-brand)' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 100,
      fixed: 'left' as const,
      ellipsis: true,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: { note_count: number }, b: { note_count: number }) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 90,
      align: 'right' as const,
      sorter: (a: { total_impressions: number }, b: { total_impressions: number }) => a.total_impressions - b.total_impressions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 80,
      align: 'right' as const,
      sorter: (a: { total_clicks: number }, b: { total_clicks: number }) => a.total_clicks - b.total_clicks,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '互动量',
      dataIndex: 'total_interactions',
      key: 'total_interactions',
      width: 80,
      align: 'right' as const,
      sorter: (a: { total_interactions: number }, b: { total_interactions: number }) => a.total_interactions - b.total_interactions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击率',
      dataIndex: 'avg_click_rate',
      key: 'avg_click_rate',
      width: 80,
      align: 'right' as const,
      render: (value: number | null) => value != null ? <span className={value >= 5 ? styles.positive : ''}>{value.toFixed(2)}%</span> : '-',
    },
    {
      title: '互动率',
      dataIndex: 'avg_interaction_rate',
      key: 'avg_interaction_rate',
      width: 80,
      align: 'right' as const,
      render: (value: number | null) => value != null ? <span className={value >= 10 ? styles.positive : ''}>{value.toFixed(2)}%</span> : '-',
    },
    {
      title: '私信',
      dataIndex: 'private_messages',
      key: 'private_messages',
      width: 80,
      align: 'right' as const,
      sorter: (a: { private_messages: number }, b: { private_messages: number }) => (a.private_messages || 0) - (b.private_messages || 0),
      render: (value: number) => value?.toLocaleString() || '0',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      sorter: (a: { lead_users: number }, b: { lead_users: number }) => (a.lead_users || 0) - (b.lead_users || 0),
      render: (value: number) => value?.toLocaleString() || '0',
    },
    {
      title: '企微添加',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 90,
      align: 'right' as const,
      sorter: (a: { customer_mouth_users: number }, b: { customer_mouth_users: number }) => (a.customer_mouth_users || 0) - (b.customer_mouth_users || 0),
      render: (value: number) => value?.toLocaleString() || '0',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      sorter: (a: { opened_account_users: number }, b: { opened_account_users: number }) => (a.opened_account_users || 0) - (b.opened_account_users || 0),
      render: (value: number) => value?.toLocaleString() || '0',
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      align: 'right' as const,
      sorter: (a: { total_cost: number }, b: { total_cost: number }) => (a.total_cost || 0) - (b.total_cost || 0),
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  // 笔记排行榜表格列配置
  const topNotesColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: XhsTopNoteItem, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? 'var(--color-text-brand)' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '笔记标题',
      dataIndex: 'note_title',
      key: 'note_title',
      width: 160,
      ellipsis: true,
      render: (text: string, record: XhsTopNoteItem) => (
        record.note_url ? (
          <Link href={record.note_url} target="_blank" className={styles.noteLink}>
            {text}
          </Link>
        ) : text
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'note_publish_time',
      key: 'note_publish_time',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 90,
      ellipsis: true,
    },
    {
      title: '投放策略',
      dataIndex: 'ad_strategy',
      key: 'ad_strategy',
      width: 90,
      ellipsis: true,
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 90,
      align: 'right' as const,
      sorter: (a: XhsTopNoteItem, b: XhsTopNoteItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 90,
      align: 'right' as const,
      sorter: (a: XhsTopNoteItem, b: XhsTopNoteItem) => a.total_impressions - b.total_impressions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '私信量',
      dataIndex: 'total_private_messages',
      key: 'total_private_messages',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 代理商数据表格列配置
  const agencyDataColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? 'var(--color-text-brand)' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '代理商',
      dataIndex: 'agency',
      key: 'agency',
      width: 100,
      ellipsis: true,
    },
    {
      title: '投放金额',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 110,
      align: 'right' as const,
      sorter: (a: XhsAgencyDataItem, b: XhsAgencyDataItem) => (a.total_cost || 0) - (b.total_cost || 0),
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 90,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 员工转化排行表格列配置
  const employeeConversionColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? 'var(--color-text-brand)' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 90,
      ellipsis: true,
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 70,
      align: 'right' as const,
      sorter: (a: XhsEmployeeConversionItem, b: XhsEmployeeConversionItem) => a.lead_users - b.lead_users,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 70,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 70,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户率',
      dataIndex: 'opening_rate',
      key: 'opening_rate',
      width: 80,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ color: 'var(--color-error, #cf1322)', fontWeight: 500 }}>
          {value?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '有效户率',
      dataIndex: 'valid_customer_rate',
      key: 'valid_customer_rate',
      width: 80,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ color: 'var(--color-error, #cf1322)', fontWeight: 500 }}>
          {value?.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '总资产',
      dataIndex: 'total_assets',
      key: 'total_assets',
      width: 100,
      align: 'right' as const,
      sorter: (a: XhsEmployeeConversionItem, b: XhsEmployeeConversionItem) => (a.total_assets || 0) - (b.total_assets || 0),
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  // v3.2.3：H5 数据块 - 表格在 H5 模式下改用数据块呈现，每块 3 个核心字段，避免滚动条
  const renderH5Block = (
    items: any[],
    titleKey: string,
    stats: { label: string; key: string; format?: (v: any) => string }[]
  ) => {
    if (!items || items.length === 0) {
      return <div className={styles.h5Empty}>暂无数据</div>;
    }
    return (
      <div className={styles.h5DataBlock}>
        {items.map((item, idx) => (
          <div key={`${item[titleKey] || ''}-${idx}`} className={styles.h5DataBlockItem}>
            <div className={styles.h5DataBlockTitle}>{item[titleKey] || '-'}</div>
            <div className={styles.h5DataBlockStats}>
              {stats.map((s) => (
                <div key={s.key} className={styles.h5DataBlockStat}>
                  <div className={styles.h5DataBlockStatLabel}>{s.label}</div>
                  <div className={styles.h5DataBlockStatValue}>
                    {s.format ? s.format(item[s.key]) : (item[s.key] ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // H5 数据块配置 - 4 个表格各自的核心 3 字段
  // v3.2.3 修复：创作者综合分析数据源改为前端合并的 creatorSummaryData（useMemo），
  // 后端无 creator_summary_data 字段，原写法导致 H5 模式无数据
  const h5CreatorSummary = creatorSummaryData.slice(0, 20).map((item) => ({
    创作者: item.producer,
    笔记数: item.note_count,
    开户数: item.opened_account_users,
    消耗: item.total_cost,
  }));
  // v3.2.3 优化：优秀笔记 H5 模式只显示前 10 条，避免过长
  const h5TopNotes = (data?.top_notes || []).slice(0, 10).map((item: any) => ({
    笔记标题: item.note_title,
    消费: item.total_cost,
    开户数: item.opened_account_users,
    私信: item.total_private_messages,
  }));
  const h5AgencyData = (data?.agency_data || []).map((item: any) => ({
    代理商: item.agency,
    投放金额: item.total_cost,
    开户数: item.opened_account_users,
    曝光量: item.total_impressions,
  }));
  const h5EmployeeConversion = (data?.employee_conversion_ranking || []).map((item: any) => ({
    员工: item.employee_name,
    开户数: item.opened_account_users,
    开户率: item.opening_rate,
    有效户: item.valid_customer_users,
  }));

  const fmtInt = (v: any) => v != null ? Number(v).toLocaleString('zh-CN') : '-';
  const fmtMoney = (v: any) => v != null ? `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtPct = (v: any) => v != null ? `${Number(v).toFixed(2)}%` : '-';

  return (
    <div className={`${styles.operationPage} ${viewMode === 'h5' ? styles.h5Mode : ''} xhsReportRoot`} ref={pageRef}>
      {/* 筛选器 */}
      <FadeInSection delay={0} duration={1}>
        <Card className={styles.filterCard} size="small">
        <div className={styles.filterRow}>
          {/* 主日期范围 */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>日期范围:</span>
            <DateRangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
            />
            <Space size={4} style={{ marginLeft: 8 }}>
              <Button
                type={isDateRangeActive(dateRange, 'days7') ? 'primary' : 'default'}
                onClick={() => handleQuickDateSelectTop('days7')}
              >
                近7天
              </Button>
              <Button
                type={isDateRangeActive(dateRange, 'days30') ? 'primary' : 'default'}
                onClick={() => handleQuickDateSelectTop('days30')}
              >
                近30天
              </Button>
              <Button
                type={isDateRangeActive(dateRange, 'ytd') ? 'primary' : 'default'}
                onClick={() => handleQuickDateSelectTop('ytd')}
              >
                今年以来
              </Button>
              <Button
                type={isDateRangeActive(dateRange, 'all') ? 'primary' : 'default'}
                onClick={() => handleQuickDateSelectTop('all')}
              >
                全部
              </Button>
            </Space>
          </div>

          {/* 操作按钮 */}
          <div className={styles.filterActions}>
            {/* v3.2.3：视图模式切换 - Web 桌面布局 / H5 手机布局 */}
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'web' | 'h5')}
              options={[
                { label: 'Web', value: 'web', icon: <DesktopOutlined /> },
                { label: 'H5', value: 'h5', icon: <MobileOutlined /> },
              ]}
              size="small"
            />
            <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
              <Button icon={<DownloadOutlined />}>
                导出报表 <DownOutlined />
              </Button>
            </Dropdown>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>
        </div>
      </Card>

      {/* 核心运营数据 - 4行结构 */}
      <Card className={styles.sectionCard}>
        {/* 第一行：基础指标（v3.2.3 删除"投放笔记数"卡片，2 列布局） */}
        <Row gutter={12} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-default)' }}>
          <Col span={12}>
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', borderLeft: '3px solid var(--chart-color-5)', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--chart-color-5)', fontWeight: 600, marginBottom: 6 }}>新增笔记数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {formatNumber(data?.core_metrics?.new_notes_count || 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>篇</div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', borderLeft: '3px solid var(--color-warning)', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 600, marginBottom: 6 }}>投放金额</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                ¥{formatNumber(data?.core_metrics?.total_cost || 0, 2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>元</div>
            </div>
          </Col>
        </Row>

        {/* 第二行：业务转化漏斗 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-text-brand)', borderRadius: 2 }}></span>
            业务转化漏斗
          </div>
          <Row gutter={10}>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: 'var(--color-brand-bg)', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: 'var(--color-text-brand)', color: 'var(--bg-content)', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-brand)', fontWeight: 600, marginBottom: 4 }}>曝光量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatNumber(data?.core_metrics?.total_impressions || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: 'rgba(226, 121, 0, 0.1)', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: 'var(--chart-color-7)', color: 'var(--bg-content)', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: 10, color: 'var(--chart-color-7)', fontWeight: 600, marginBottom: 4 }}>点击量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatNumber(data?.core_metrics?.total_clicks || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: 'rgba(235, 47, 199, 0.08)', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: 'var(--chart-color-8)', color: 'var(--bg-content)', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                <div style={{ fontSize: 10, color: 'var(--chart-color-8)', fontWeight: 600, marginBottom: 4 }}>私信进线</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatNumber(data?.core_metrics?.total_private_messages || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: 'rgba(21, 168, 119, 0.1)', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: 'var(--color-success)', color: 'var(--bg-content)', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
                <div style={{ fontSize: 10, color: 'var(--color-success)', fontWeight: 600, marginBottom: 4 }}>加企微</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatNumber(data?.core_metrics?.total_lead_users || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: 'rgba(114, 46, 209, 0.08)', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: 'var(--chart-color-5)', color: 'var(--bg-content)', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</div>
                <div style={{ fontSize: 10, color: 'var(--chart-color-5)', fontWeight: 600, marginBottom: 4 }}>开户数</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatNumber(data?.core_metrics?.total_opened_accounts || 0)}</div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 第三行：转化率指标 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-success)', borderRadius: 2 }}></span>
            转化率指标
          </div>
          <Row gutter={10}>
            <Col span={6}>
              {renderRateCard('曝光点击率', data?.core_metrics?.impression_click_rate || 0, '曝光 → 点击')}
            </Col>
            <Col span={6}>
              {renderRateCard('点击进线率', data?.core_metrics?.click_lead_rate || 0, '点击 → 私信')}
            </Col>
            <Col span={6}>
              {renderRateCard('进线加微率', data?.core_metrics?.lead_to_wechat_rate || 0, '私信 → 加微')}
            </Col>
            <Col span={6}>
              {renderRateCard('线索开户率', data?.core_metrics?.wechat_to_account_rate || 0, '加微 → 开户')}
            </Col>
          </Row>
        </div>

        {/* 第四行：成本效率指标 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-warning)', borderRadius: 2 }}></span>
            成本效率指标
          </div>
          <Row gutter={10}>
            <Col span={6}>
              {renderCostCard('千次曝光成本', data?.core_metrics?.cost_per_mille || 0, '元/千次')}
            </Col>
            <Col span={6}>
              {renderCostCard('点击成本', data?.core_metrics?.cost_per_click || 0, '元/次')}
            </Col>
            <Col span={6}>
              {renderCostCard('单企微成本', data?.core_metrics?.cost_per_lead_user || 0, '元/人')}
            </Col>
            <Col span={6}>
              {renderCostCard('单开户成本', data?.core_metrics?.cost_per_opened_account || 0, '元/户')}
            </Col>
          </Row>
        </div>
      </Card>
      </FadeInSection>

      {loading ? (
        <Spin spinning={loading} description="加载中...">
          <div style={{ height: 300 }} />
        </Spin>
      ) : (
        <>
          <FadeInSection delay={0.30} duration={1}>
          {/* 创作者综合分析 - 合并原 4 表（内容/转化/创作/互动） */}
          <Card
            className={styles.tableCard}
            title={<CardTitle icon="📝" plain>创作者综合分析</CardTitle>}
            extra={
              <Space>
                <span className={styles.statText}>
                  共 {creatorSummaryData.length} 条
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('creator_summary')}
                  disabled={!creatorSummaryData.length}
                >
                  导出CSV
                </Button>
              </Space>
            }
          >
            {viewMode === 'h5' ? (
              renderH5Block(h5CreatorSummary, '创作者', [
                { label: '笔记数', key: '笔记数', format: fmtInt },
                { label: '开户数', key: '开户数', format: fmtInt },
                { label: '消耗', key: '消耗', format: fmtMoney },
              ])
            ) : (
              <Table
                columns={creatorSummaryColumns}
                dataSource={creatorSummaryData}
                rowKey="producer"
                size="small"
                scroll={{ x: 1200 }}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            )}
          </Card>
          </FadeInSection>

          <FadeInSection delay={0.45} duration={1}>
          {/* 内容运营趋势 - 2 图（删除笔记创作量横向图，与综合表重复） */}
          <Card className={styles.chartCard}>
            <CardTitle icon="📈">内容运营趋势</CardTitle>
            <div className={styles.contentChartGrid}>
              <div>
                <h4 className={styles.sectionTitle}>创作量趋势（按创作者堆叠）</h4>
                <div className={styles.chartContainer}>
                  {data?.creation_trend?.dates?.length ? (
                    <EChartsComponent option={creationVolumeOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>互动量趋势</h4>
                <div className={styles.chartContainer}>
                  {data?.creation_trend?.dates?.length ? (
                    <EChartsComponent option={interactionTrendOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
            </div>
          </Card>
          </FadeInSection>

          <FadeInSection delay={0.60} duration={1}>
          {/* 笔记排行榜 - 独立筛选器 */}
          <Card
            className={styles.tableCard}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Text type="secondary" className={styles.cardTitle}>优秀笔记排行榜</Text>
                <DateRangePicker
                  value={topNotesDateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setTopNotesDateRange(dates);
                      fetchTopNotesData(dates);
                    }
                  }}
                  style={{ width: 240, height: 32 }}
                />
                <Space size={4}>
                  <Button
                    type={isDateRangeActive(topNotesDateRange, 'days30') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('topNotes', 'days30')}
                  >
                    近30天
                  </Button>
                  <Button
                    type={isDateRangeActive(topNotesDateRange, 'ytd') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('topNotes', 'ytd')}
                  >
                    今年以来
                  </Button>
                </Space>
              </div>
            }
            extra={
              <Space>
                <span className={styles.statText}>
                  共 {data?.top_notes?.length || 0} 条
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('top_notes')}
                  disabled={!data?.top_notes?.length}
                >
                  导出CSV
                </Button>
              </Space>
            }
          >
            <Spin spinning={topNotesLoading}>
              {viewMode === 'h5' ? (
                renderH5Block(h5TopNotes, '笔记标题', [
                  { label: '消费', key: '消费', format: fmtMoney },
                  { label: '开户数', key: '开户数', format: fmtInt },
                  { label: '私信', key: '私信', format: fmtInt },
                ])
              ) : (
                <Table
                  columns={topNotesColumns}
                  dataSource={data?.top_notes || []}
                  rowKey="note_id"
                  size="small"
                  pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                  }}
                />
              )}
            </Spin>
          </Card>
          </FadeInSection>

          <FadeInSection delay={0.75} duration={1}>
            {/* 整体转化走势 - v3.2.3：周维度（上周五到本周四），数据源 fact_conv_content 小红书 */}
            <Card className={styles.chartCard}>
              <CardTitle icon="📊">整体转化走势（按周 · 上周五到本周四）</CardTitle>
              <div className={styles.chartContainer}>
                {data?.conversion_trend?.weeks?.length ? (
                  <EChartsComponent option={conversionTrendOption} height={300} />
                ) : (
                  <div className={styles.chartEmpty}>暂无数据</div>
                )}
              </div>
            </Card>
          </FadeInSection>

          <FadeInSection delay={0.90} duration={1}>
          {/* 代理商数据 - 上 */}
          <Card
            className={styles.tableCard}
            title={<CardTitle icon="🏢" plain>代理商投放数据</CardTitle>}
            extra={
              <Space>
                <span className={styles.statText}>
                  共 {data?.agency_data?.length || 0} 条
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('agency_data')}
                  disabled={!data?.agency_data?.length}
                >
                  导出CSV
                </Button>
              </Space>
            }
          >
            {viewMode === 'h5' ? (
              renderH5Block(h5AgencyData, '代理商', [
                { label: '投放金额', key: '投放金额', format: fmtMoney },
                { label: '开户数', key: '开户数', format: fmtInt },
                { label: '曝光量', key: '曝光量', format: fmtInt },
              ])
            ) : (
              <Table
                columns={agencyDataColumns}
                dataSource={data?.agency_data || []}
                rowKey="agency"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
                scroll={{ y: 400 }}
              />
            )}
          </Card>
          </FadeInSection>

          <FadeInSection delay={1.05} duration={1}>
          {/* 员工转化排行 - 下 */}
          <Card
            className={styles.tableCard}
            title={<CardTitle icon="👥" plain>员工转化排行</CardTitle>}
            extra={
              <Space>
                <span className={styles.statText}>
                  共 {data?.employee_conversion_ranking?.length || 0} 条
                </span>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('employee_conversion')}
                  disabled={!data?.employee_conversion_ranking?.length}
                >
                  导出CSV
                </Button>
              </Space>
            }
          >
            {viewMode === 'h5' ? (
              renderH5Block(h5EmployeeConversion, '员工', [
                { label: '开户数', key: '开户数', format: fmtInt },
                { label: '开户率', key: '开户率', format: fmtPct },
                { label: '有效户', key: '有效户', format: fmtInt },
              ])
            ) : (
              <Table
                columns={employeeConversionColumns}
                dataSource={data?.employee_conversion_ranking || []}
                rowKey="employee_name"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
                scroll={{ y: 400 }}
              />
            )}
          </Card>
          </FadeInSection>

        </>
      )}
    </div>
  );
};

export default XhsNotesOperationPage;