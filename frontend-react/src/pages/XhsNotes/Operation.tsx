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
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownOutlined,
  FileImageOutlined,
  FilePdfOutlined,
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
  XhsCreatorAnnualRankingItem,
  XhsAgencyDataItem,
  XhsCreatorCreationItem,
  XhsCreatorInteractionItem,
  XhsEmployeeConversionItem,
} from '@/types/api.schemas';
import styles from './Operation.module.scss';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

  // 导出功能 - 导出整个报表为图片或PDF
  const handleExportReport = async (type: 'image' | 'pdf') => {
    if (!pageRef.current) {
      message.error('无法获取页面内容');
      return;
    }

    try {
      message.loading({ content: '正在生成报表...', key: 'export' });

      const element = pageRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f5f5f5',
      });

      if (type === 'image') {
        // 导出为图片
        const link = document.createElement('a');
        link.download = `小红书运营分析报表_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        message.success({ content: '导出图片成功', key: 'export' });
      } else {
        // 导出为PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        const imgX = (pageWidth - imgWidth * ratio) / 2;
        const imgY = 10;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        pdf.save(`小红书运营分析报表_${new Date().toISOString().split('T')[0]}.pdf`);
        message.success({ content: '导出PDF成功', key: 'export' });
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error({ content: '导出失败，请重试', key: 'export' });
    }
  };

  // 导出菜单配置
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'image',
      icon: <FileImageOutlined />,
      label: '导出为图片 (PNG)',
      onClick: () => handleExportReport('image'),
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '导出为 PDF',
      onClick: () => handleExportReport('pdf'),
    },
  ];

  // 获取默认日期范围的辅助函数（基于数据可用日期）
  const getDefaultDateRangeFromData = (
    _dataStart: string | null,
    dataEnd: string | null,
    fallbackDays: number = 30
  ): [string, string] => {
    // 如果有实际数据日期范围，使用数据结束日期往前30天
    if (dataEnd) {
      const endDate = new Date(dataEnd);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - fallbackDays);
      return [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ];
    }
    // 否则使用当前日期往前30天
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - fallbackDays);
    return [
      startDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  const getDefaultDateRange = (days: number): [string, string] => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    return [
      startDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  const getDefaultYTDDateRange = (): [string, string] => {
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    return [
      yearStart.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ];
  };

  // 数据可用日期范围（从元数据获取）
  const [xhsDataDateRange, setXhsDataDateRange] = useState<{ start: string | null; end: string | null } | null>(null);

  // 主筛选日期范围 - 初始为空，等待元数据加载后设置
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  // 笔记排行榜日期范围
  const [topNotesDateRange, setTopNotesDateRange] = useState<[string, string] | null>(null);
  // 创作者年度排行日期范围
  const [creatorAnnualDateRange, setCreatorAnnualDateRange] = useState<[string, string] | null>(null);

  // 数据状态
  const [data, setData] = useState<XhsOperationAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // 独立模块加载状态 - 用于优秀笔记排行榜和创作者年度排行
  const [topNotesLoading, setTopNotesLoading] = useState(false);
  const [creatorAnnualLoading, setCreatorAnnualLoading] = useState(false);

  // 当前选中的图表Tab
  const [creationChartType, setCreationChartType] = useState<string>('impressions');

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

          // 创作者年度排行使用数据范围或年度
          if (xhsRange.end) {
            const yearStart = new Date(new Date(xhsRange.end).getFullYear(), 0, 1);
            setCreatorAnnualDateRange([
              yearStart.toISOString().split('T')[0],
              xhsRange.end
            ]);
          } else {
            setCreatorAnnualDateRange(getDefaultYTDDateRange());
          }
        } else {
          // 回退到默认30天
          const defaultRange = getDefaultDateRange(30);
          setDateRange(defaultRange);
          setTopNotesDateRange(defaultRange);
          setCreatorAnnualDateRange(getDefaultYTDDateRange());
        }
        setMetadataLoaded(true);
      } catch (error) {
        console.error('获取元数据失败:', error);
        // 回退到默认30天
        const defaultRange = getDefaultDateRange(30);
        setDateRange(defaultRange);
        setTopNotesDateRange(defaultRange);
        setCreatorAnnualDateRange(getDefaultYTDDateRange());
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
      if (creatorAnnualDateRange?.[0] && creatorAnnualDateRange?.[1]) {
        filters.creator_annual_date_range = creatorAnnualDateRange as [string, string];
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

  // 独立获取创作者年度排行数据
  const fetchCreatorAnnualData = useCallback(async (annualDateRange: [string, string]) => {
    setCreatorAnnualLoading(true);
    try {
      const filters: Record<string, unknown> = {
        creator_annual_date_range: annualDateRange,
      };
      const response = await postXhsOperationAnalysis({ filters });
      if (response.success && response.data) {
        setData(prev => prev ? { ...prev, creator_annual_ranking: response.data.creator_annual_ranking } : response.data);
      }
    } catch (error) {
      console.error('获取创作者年度排行数据失败:', error);
    } finally {
      setCreatorAnnualLoading(false);
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

  // 快速选择日期 - 独立筛选器
  const handleQuickDateSelect = async (type: 'topNotes' | 'creatorAnnual', option: 'days30' | 'ytd') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (option === 'days30') {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      const startStr = startDate.toISOString().split('T')[0];
      if (type === 'topNotes') {
        const newRange: [string, string] = [startStr, todayStr];
        setTopNotesDateRange(newRange);
        // 独立获取笔记排行榜数据
        await fetchTopNotesData(newRange);
      } else {
        const newRange: [string, string] = [startStr, todayStr];
        setCreatorAnnualDateRange(newRange);
        // 独立获取创作者年度排行数据
        await fetchCreatorAnnualData(newRange);
      }
    } else if (option === 'ytd') {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const startStr = yearStart.toISOString().split('T')[0];
      if (type === 'topNotes') {
        const newRange: [string, string] = [startStr, todayStr];
        setTopNotesDateRange(newRange);
        // 独立获取笔记排行榜数据
        await fetchTopNotesData(newRange);
      } else {
        const newRange: [string, string] = [startStr, todayStr];
        setCreatorAnnualDateRange(newRange);
        // 独立获取创作者年度排行数据
        await fetchCreatorAnnualData(newRange);
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

    // 创作者年度排行使用数据范围或年度
    if (xhsDataDateRange?.end) {
      const yearStart = new Date(new Date(xhsDataDateRange.end).getFullYear(), 0, 1);
      setCreatorAnnualDateRange([
        yearStart.toISOString().split('T')[0],
        xhsDataDateRange.end
      ]);
    } else {
      setCreatorAnnualDateRange(getDefaultYTDDateRange());
    }
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
        background: 'white',
        border: '1px solid #E8E9EB',
        borderRadius: 6,
        padding: 12,
        textAlign: 'center',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ fontSize: 10, color: '#8A8D99', marginBottom: 4 }}>{subtitle}</div>
        <div style={{ fontSize: 11, color: '#5A5C66', fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>
          {value.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>%</span>
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
        <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#171A23' }}>
          ¥{formatNumber(value, 2)}
          <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 4, color: '#8A8D99' }}>{unit}</span>
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
      case 'creator_content':
        csvContent = exportCreatorContentData(data.creator_content_data ?? []);
        filename = `创作者内容数据_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      case 'creator_conversion':
        csvContent = exportCreatorConversionData(data.creator_conversion_data ?? []);
        filename = `创作者转化数据_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      case 'creator_creation':
        csvContent = exportCreatorCreationData(data.creator_creation_data ?? []);
        filename = `创作者创作数据_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
        break;
      case 'creator_interaction':
        csvContent = exportCreatorInteractionData(data.creator_interaction_data ?? []);
        filename = `创作者互动数据_${safeDateRange[0]}_${safeDateRange[1]}.csv`;
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

  // 导出创作者内容数据
  const exportCreatorContentData = (items: XhsCreatorContentItem[]) => {
    const headers = ['生产者', '笔记数', '曝光量', '点击量', '互动量', '消耗', '平均点击率', '平均互动率'];
    const rows = items.map(item => [
      item.producer,
      item.note_count,
      item.total_impressions,
      item.total_clicks,
      item.total_interactions,
      item.total_cost,
      `${item.avg_click_rate.toFixed(2)}%`,
      `${item.avg_interaction_rate.toFixed(2)}%`,
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

  // 导出创作者转化数据
  const exportCreatorConversionData = (items: XhsCreatorConversionItem[]) => {
    const headers = ['生产者', '私信量', '加微数', '开口数', '有效线索', '开户数', '有效户'];
    const rows = items.map(item => [
      item.producer,
      item.private_messages,
      item.lead_users,
      item.customer_mouth_users,
      item.valid_lead_users,
      item.opened_account_users,
      item.valid_customer_users,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出创作者创作数据
  const exportCreatorCreationData = (items: XhsCreatorCreationItem[]) => {
    const headers = ['生产者', '笔记数', '曝光量'];
    const rows = items.map(item => [
      item.producer,
      item.note_count,
      item.impressions,
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // 导出创作者互动数据
  const exportCreatorInteractionData = (items: XhsCreatorInteractionItem[]) => {
    const headers = ['生产者', '点赞', '收藏', '评论', '分享', '总互动'];
    const rows = items.map(item => [
      item.producer,
      item.likes,
      item.favorites,
      item.comments,
      item.shares,
      item.total_interactions,
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
    const headers = ['代理商', '消耗', '曝光量', '点击量', '加微数', '潜客数', '开口数', '有效线索', '开户数', '有效户'];
    const rows = items.map(item => [
      item.agency,
      item.total_cost,
      item.total_impressions,
      item.total_clicks,
      item.lead_users,
      item.potential_customers,
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
        data: data.conversion_trend.weeks,
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

  // 创作量趋势图表配置 - ECharts 柱状图（原样复制旧版 XhsNotesOperationReport.js）
  const creationVolumeOption = useMemo((): EChartsOption => {
    if (!data?.creation_trend?.dates?.length) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
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
      yAxis: {
        type: 'value',
        name: '笔记数',
      },
      series: [{
        name: '笔记数',
        type: 'bar',
        data: data.creation_trend.note_counts,
        itemStyle: { color: '#1890ff' },
      }],
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

  // 创作者创作量图表配置 - ECharts 横向双X轴柱状图（原样复制旧版）
  const creatorCreationOption = useMemo((): EChartsOption => {
    if (!data?.creator_creation_data?.length) return {};

    // 按生产者聚合数据
    const aggregatedMap = new Map<string, { note_count: number; impressions: number }>();
    data.creator_creation_data.forEach(item => {
      const producer = item.producer || '未知';
      const existing = aggregatedMap.get(producer);
      if (existing) {
        existing.note_count += item.note_count || 0;
        existing.impressions += item.impressions || 0;
      } else {
        aggregatedMap.set(producer, {
          note_count: item.note_count || 0,
          impressions: item.impressions || 0,
        });
      }
    });

    const sortedData = Array.from(aggregatedMap.entries())
      .map(([producer, values]) => ({ producer, ...values }))
      .sort((a, b) => (b.note_count || 0) - (a.note_count || 0))
      .slice(0, 10)
      .reverse();

    const producers = sortedData.map(item => item.producer);
    const noteCounts = sortedData.map(item => item.note_count);
    const impressions = sortedData.map(item => item.impressions);

    const formatNumber = (value: number): string => {
      if (value >= 10000) {
        return (value / 10000).toFixed(1) + '万';
      }
      return value.toString();
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex ?? 0;
          const creator = producers[idx] || '未知';
          let result = `${creator}<br/>`;
          params.forEach((p: any) => {
            const value = p.value;
            if (p.seriesName === '笔记发布量') {
              result += `${p.marker} ${p.seriesName}: ${value} 篇<br/>`;
            } else {
              result += `${p.marker} ${p.seriesName}: ${formatNumber(value)}<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        show: false,
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: [
        {
          type: 'value',
          name: '笔记发布量',
          position: 'top' as const,
          axisLabel: {
            formatter: '{value} 篇',
          },
        },
        {
          type: 'value',
          name: '笔记曝光量',
          position: 'bottom' as const,
          axisLabel: {
            formatter: formatNumber,
          },
        },
      ],
      yAxis: {
        type: 'category',
        data: producers,
        axisLabel: {
          width: 100,
          overflow: 'truncate' as const,
        },
      },
      series: [
        {
          name: '笔记发布量',
          type: 'bar',
          data: noteCounts,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#1890ff',
          },
        },
        {
          name: '笔记曝光量',
          type: 'bar',
          data: impressions,
          xAxisIndex: 1,
          yAxisIndex: 0,
          itemStyle: {
            color: '#52c41a',
          },
        },
      ],
    };
  }, [data?.creator_creation_data]);

  // 创作者互动量图表配置 - ECharts 横向堆叠条形图（原样复制旧版）
  const creatorInteractionOption = useMemo((): EChartsOption => {
    if (!data?.creator_interaction_data?.length) return {};

    // 按生产者聚合数据
    const aggregatedMap = new Map<string, { likes: number; favorites: number; comments: number; shares: number; total_interactions: number }>();
    data.creator_interaction_data.forEach(item => {
      const producer = item.producer || '未知';
      const existing = aggregatedMap.get(producer);
      if (existing) {
        existing.likes += item.likes || 0;
        existing.favorites += item.favorites || 0;
        existing.comments += item.comments || 0;
        existing.shares += item.shares || 0;
        existing.total_interactions += item.total_interactions || 0;
      } else {
        aggregatedMap.set(producer, {
          likes: item.likes || 0,
          favorites: item.favorites || 0,
          comments: item.comments || 0,
          shares: item.shares || 0,
          total_interactions: item.total_interactions || 0,
        });
      }
    });

    const sortedData = Array.from(aggregatedMap.entries())
      .map(([producer, values]) => ({ producer, ...values }))
      .sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0))
      .slice(0, 10)
      .reverse();

    const producers = sortedData.map(item => item.producer);
    const likes = sortedData.map(item => item.likes);
    const favorites = sortedData.map(item => item.favorites);
    const comments = sortedData.map(item => item.comments);
    const shares = sortedData.map(item => item.shares);

    const formatNumber = (value: number): string => {
      if (value >= 10000) {
        return (value / 10000).toFixed(1) + '万';
      }
      return value.toString();
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex ?? 0;
          const creator = producers[idx] || '未知';
          let result = `${creator}<br/>`;
          params.forEach((p: any) => {
            const value = p.value;
            result += `${p.marker} ${p.seriesName}: ${formatNumber(value)}<br/>`;
          });
          const total = sortedData[idx]?.total_interactions || 0;
          result += `总互动量: ${formatNumber(total)}`;
          return result;
        },
      },
      legend: {
        data: ['点赞', '收藏', '评论', '分享'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: '互动量',
        axisLabel: {
          formatter: formatNumber,
        },
      },
      yAxis: {
        type: 'category',
        data: producers,
        axisLabel: {
          width: 100,
          overflow: 'truncate' as const,
        },
      },
      series: [
        {
          name: '点赞',
          type: 'bar' as const,
          stack: 'interaction',
          data: likes,
          itemStyle: { color: '#ff4d4f' },
        },
        {
          name: '收藏',
          type: 'bar' as const,
          stack: 'interaction',
          data: favorites,
          itemStyle: { color: '#faad14' },
        },
        {
          name: '评论',
          type: 'bar' as const,
          stack: 'interaction',
          data: comments,
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '分享',
          type: 'bar' as const,
          stack: 'interaction',
          data: shares,
          itemStyle: { color: '#52c41a' },
        },
      ],
    };
  }, [data?.creator_interaction_data]);

  // 员工周转化率趋势图表配置 - ECharts 多折线图（原样复制旧版）
  const employeeWeeklyRateOption = useMemo((): EChartsOption => {
    if (!data?.employee_weekly_conversion?.weeks?.length) return {};

    const employees = data.employee_weekly_conversion.employees;
    const weeks = data.employee_weekly_conversion.weeks;
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

    // 颜色映射函数
    const getRateColor = (rate: number): string => {
      if (rate >= 10) return '#52c41a';
      if (rate >= 5) return '#1890ff';
      if (rate >= 2) return '#faad14';
      if (rate > 0) return '#f5222d';
      return '#999';
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const title = params[0].axisValue;
          let result = `<div style="font-weight: 600; margin-bottom: 10px; font-size: 13px; color: #1a1a1a;">${title}</div>`;
          params.forEach((p: any) => {
            result += `<div style="margin: 5px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
              <span style="color: #5a5c66;">${p.seriesName}:</span>
              <span style="float: right; font-weight: 600; color: ${getRateColor(p.value)};">${p.value.toFixed(2)}%</span>
            </div>`;
          });
          return result;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e8e9eb',
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;',
      },
      legend: {
        data: employees,
        bottom: '2%',
        left: 'center',
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 16,
        textStyle: {
          fontSize: 12,
          color: '#5a5c66',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: {
          fontSize: 11,
          color: '#8a8d99',
          interval: 0,
          margin: 12,
          rotate: 30,
        },
        axisLine: {
          lineStyle: { color: '#e8e9eb' },
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: '转化率',
        nameTextStyle: {
          fontSize: 12,
          color: '#8a8d99',
          padding: [0, 0, 0, -8],
        },
        axisLabel: {
          fontSize: 11,
          color: '#8a8d99',
          formatter: '{value}%',
        },
        axisLine: {
          lineStyle: { color: '#e8e9eb' },
        },
        splitLine: {
          lineStyle: {
            color: '#f0f1f3',
            type: 'dashed' as const,
          },
        },
      },
      series: employees.map((employee: string, empIndex: number) => ({
        name: employee,
        type: 'line' as const,
        smooth: true,
        data: data.employee_weekly_conversion!.series[empIndex] || [],
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        itemStyle: { color: colors[empIndex % colors.length] },
        lineStyle: { width: 2.5, color: colors[empIndex % colors.length] },
        emphasis: {
          focus: 'series' as const,
          itemStyle: {
            borderColor: colors[empIndex % colors.length],
            borderWidth: 2,
            symbolSize: 8,
          },
        },
      })),
    };
  }, [data?.employee_weekly_conversion]);

  // 创作者内容表格列配置
  const creatorContentColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 90,
      ellipsis: true,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.total_impressions - b.total_impressions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '互动量',
      dataIndex: 'total_interactions',
      key: 'total_interactions',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      sorter: (a: XhsCreatorContentItem, b: XhsCreatorContentItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '平均点击率',
      dataIndex: 'avg_click_rate',
      key: 'avg_click_rate',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => <span className={value >= 5 ? styles.positive : ''}>{value?.toFixed(2)}%</span>,
    },
    {
      title: '平均互动率',
      dataIndex: 'avg_interaction_rate',
      key: 'avg_interaction_rate',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => <span className={value >= 10 ? styles.positive : ''}>{value?.toFixed(2)}%</span>,
    },
  ];

  // 创作者转化表格列配置
  const creatorConversionColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 90,
      ellipsis: true,
    },
    {
      title: '私信量',
      dataIndex: 'private_messages',
      key: 'private_messages',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      sorter: (a: XhsCreatorConversionItem, b: XhsCreatorConversionItem) => a.lead_users - b.lead_users,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
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
          color: index < 3 ? '#1890ff' : 'inherit',
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

  // 创作者年度排行表格列配置
  const creatorAnnualColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: XhsCreatorAnnualRankingItem, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
        }}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '生产者',
      dataIndex: 'producer',
      key: 'producer',
      width: 90,
      ellipsis: true,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorAnnualRankingItem, b: XhsCreatorAnnualRankingItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 90,
      align: 'right' as const,
      sorter: (a: XhsCreatorAnnualRankingItem, b: XhsCreatorAnnualRankingItem) => a.total_cost - b.total_cost,
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
          color: index < 3 ? '#1890ff' : 'inherit',
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
      title: '消耗',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      sorter: (a: XhsAgencyDataItem, b: XhsAgencyDataItem) => a.total_cost - b.total_cost,
      render: (value: number) => value ? `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: '曝光量',
      dataIndex: 'total_impressions',
      key: 'total_impressions',
      width: 90,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '点击量',
      dataIndex: 'total_clicks',
      key: 'total_clicks',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '加微数',
      dataIndex: 'lead_users',
      key: 'lead_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '潜客数',
      dataIndex: 'potential_customers',
      key: 'potential_customers',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开口数',
      dataIndex: 'customer_mouth_users',
      key: 'customer_mouth_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效线索',
      dataIndex: 'valid_lead_users',
      key: 'valid_lead_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '开户数',
      dataIndex: 'opened_account_users',
      key: 'opened_account_users',
      width: 80,
      ellipsis: true,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '有效户',
      dataIndex: 'valid_customer_users',
      key: 'valid_customer_users',
      width: 80,
      ellipsis: true,
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
          color: index < 3 ? '#1890ff' : 'inherit',
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
        <span className={value >= 10 ? styles.positive : ''}>
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
        <span className={value >= 30 ? styles.positive : ''}>
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

  // 创作者创作数据表格列配置
  const creatorCreationColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
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
      ellipsis: true,
    },
    {
      title: '笔记数',
      dataIndex: 'note_count',
      key: 'note_count',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorCreationItem, b: XhsCreatorCreationItem) => a.note_count - b.note_count,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '曝光量',
      dataIndex: 'impressions',
      key: 'impressions',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  // 创作者互动数据表格列配置
  const creatorInteractionColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{
          fontWeight: index < 3 ? 'bold' : 'normal',
          color: index < 3 ? '#1890ff' : 'inherit',
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
      ellipsis: true,
    },
    {
      title: '点赞',
      dataIndex: 'likes',
      key: 'likes',
      width: 70,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '收藏',
      dataIndex: 'favorites',
      key: 'favorites',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '评论',
      dataIndex: 'comments',
      key: 'comments',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '分享',
      dataIndex: 'shares',
      key: 'shares',
      width: 80,
      align: 'right' as const,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '总互动',
      dataIndex: 'total_interactions',
      key: 'total_interactions',
      width: 80,
      align: 'right' as const,
      sorter: (a: XhsCreatorInteractionItem, b: XhsCreatorInteractionItem) => a.total_interactions - b.total_interactions,
      render: (value: number) => value?.toLocaleString() || '-',
    },
  ];

  return (
    <div className={styles.operationPage} ref={pageRef}>
      {/* 筛选器 */}
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
        {/* 第一行：基础指标 */}
        <Row gutter={12} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #E8E9EB' }}>
          <Col span={8}>
            <div style={{ background: '#6366F115', borderLeft: '3px solid #6366F1', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, marginBottom: 6 }}>新增笔记数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                {formatNumber(data?.core_metrics?.new_notes_count || 0)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>篇</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ background: '#8B5CF615', borderLeft: '3px solid #8B5CF6', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600, marginBottom: 6 }}>投放笔记数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                {formatNumber(data?.core_metrics?.ad_notes_count || 0)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>篇</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ background: '#F59E0B15', borderLeft: '3px solid #F59E0B', padding: '14px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginBottom: 6 }}>投放金额</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#171A23' }}>
                ¥{formatNumber(data?.core_metrics?.total_cost || 0, 2)}
              </div>
              <div style={{ fontSize: 11, color: '#8A8D99', marginTop: 2 }}>元</div>
            </div>
          </Col>
        </Row>

        {/* 第二行：业务转化漏斗 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#1890FF', borderRadius: 2 }}></span>
            业务转化漏斗
          </div>
          <Row gutter={10}>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#E8F4FF', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#1890FF', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ fontSize: 10, color: '#1890FF', fontWeight: 600, marginBottom: 4 }}>曝光量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_impressions || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#FFF7E6', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#FA8C16', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: 10, color: '#FA8C16', fontWeight: 600, marginBottom: 4 }}>点击量</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_clicks || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#FFF0F6', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#C41D7F', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                <div style={{ fontSize: 10, color: '#C41D7F', fontWeight: 600, marginBottom: 4 }}>私信进线</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_private_messages || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#F6FFED', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#52C41A', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
                <div style={{ fontSize: 10, color: '#52C41A', fontWeight: 600, marginBottom: 4 }}>加企微</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_lead_users || 0)}</div>
              </div>
            </Col>
            <Col span={4.8} style={{ width: '20%' }}>
              <div style={{ background: '#F9F0FF', borderRadius: 6, padding: 12, textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#722ED1', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</div>
                <div style={{ fontSize: 10, color: '#722ED1', fontWeight: 600, marginBottom: 4 }}>开户数</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#171A23' }}>{formatNumber(data?.core_metrics?.total_opened_accounts || 0)}</div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 第三行：转化率指标 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#52C41A', borderRadius: 2 }}></span>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5C66', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3, height: 14, background: '#F59E0B', borderRadius: 2 }}></span>
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

      {loading ? (
        <Spin spinning={loading} description="加载中...">
          <div style={{ height: 300 }} />
        </Spin>
      ) : (
        <>
          {/* 创作者内容与转化数据 */}
          <div className={styles.twoColGrid}>
            <Card
              className={styles.sectionCard}
              title={<CardTitle icon="📝" plain>创作者内容数据</CardTitle>}
              extra={
                <Space>
                  <span className={styles.statText}>
                    共 {data?.creator_content_data?.length || 0} 条
                  </span>
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={() => handleExport('creator_content')}
                    disabled={!data?.creator_content_data?.length}
                  >
                    导出CSV
                  </Button>
                </Space>
              }
            >
              <Table
                columns={creatorContentColumns}
                dataSource={data?.creator_content_data || []}
                rowKey="producer"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            </Card>

            <Card
              className={styles.sectionCard}
              title={<CardTitle icon="📊" plain>创作者转化数据</CardTitle>}
              extra={
                <Space>
                  <span className={styles.statText}>
                    共 {data?.creator_conversion_data?.length || 0} 条
                  </span>
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={() => handleExport('creator_conversion')}
                    disabled={!data?.creator_conversion_data?.length}
                  >
                    导出CSV
                  </Button>
                </Space>
              }
            >
              <Table
                columns={creatorConversionColumns}
                dataSource={data?.creator_conversion_data || []}
                rowKey="producer"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            </Card>
          </div>

          {/* 创作者创作与互动数据 - 表格区域 */}
          <div className={styles.twoColGrid}>
            <Card
              className={styles.sectionCard}
              title={<CardTitle icon="✍️" plain>创作者创作数据</CardTitle>}
              extra={
                <Space>
                  <span className={styles.statText}>
                    共 {data?.creator_creation_data?.length || 0} 条
                  </span>
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={() => handleExport('creator_creation')}
                    disabled={!data?.creator_creation_data?.length}
                  >
                    导出CSV
                  </Button>
                </Space>
              }
            >
              <Table
                columns={creatorCreationColumns}
                dataSource={data?.creator_creation_data || []}
                rowKey="producer"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            </Card>

            <Card
              className={styles.sectionCard}
              title={<CardTitle icon="💬" plain>创作者互动数据</CardTitle>}
              extra={
                <Space>
                  <span className={styles.statText}>
                    共 {data?.creator_interaction_data?.length || 0} 条
                  </span>
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={() => handleExport('creator_interaction')}
                    disabled={!data?.creator_interaction_data?.length}
                  >
                    导出CSV
                  </Button>
                </Space>
              }
            >
              <Table
                columns={creatorInteractionColumns}
                dataSource={data?.creator_interaction_data || []}
                rowKey="producer"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            </Card>
          </div>

          {/* 内容运营数据 - 2x2图表网格 */}
          <Card className={styles.chartCard}>
            <CardTitle icon="📈">内容运营数据</CardTitle>
            <div className={styles.contentChartGrid}>
              <div>
                <h4 className={styles.sectionTitle}>创作量趋势</h4>
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
            <div className={styles.contentChartGrid} style={{ marginTop: 20 }}>
              <div>
                <h4 className={styles.sectionTitle}>笔记创作量</h4>
                <div className={styles.chartContainer}>
                  {data?.creator_creation_data?.length ? (
                    <EChartsComponent option={creatorCreationOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>笔记互动量</h4>
                <div className={styles.chartContainer}>
                  {data?.creator_interaction_data?.length ? (
                    <EChartsComponent option={creatorInteractionOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

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
            </Spin>
          </Card>

          {/* 创作者年度排行 - 独立筛选器 */}
          <Card
            className={styles.tableCard}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Text type="secondary" className={styles.cardTitle}>创作者年度排行</Text>
                <DateRangePicker
                  value={creatorAnnualDateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setCreatorAnnualDateRange(dates);
                      fetchCreatorAnnualData(dates);
                    }
                  }}
                  style={{ width: 240, height: 32 }}
                />
                <Space size={4}>
                  <Button
                    type={isDateRangeActive(creatorAnnualDateRange, 'days30') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('creatorAnnual', 'days30')}
                  >
                    近30天
                  </Button>
                  <Button
                    type={isDateRangeActive(creatorAnnualDateRange, 'ytd') ? 'primary' : 'default'}
                    onClick={() => handleQuickDateSelect('creatorAnnual', 'ytd')}
                  >
                    今年以来
                  </Button>
                </Space>
              </div>
            }
          >
            <Spin spinning={creatorAnnualLoading}>
              <Table
                columns={creatorAnnualColumns}
                dataSource={data?.creator_annual_ranking || []}
                rowKey="producer"
                size="small"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                }}
              />
            </Spin>
          </Card>

          {/* 代理商数据 */}
          <Card
            className={styles.tableCard}
            title={<CardTitle icon="🏢" plain>代理商数据</CardTitle>}
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
          </Card>

          {/* 转化运营数据 - 左右等分图表布局 + 员工转化排行表格 */}
          <Card className={styles.chartCard}>
            <CardTitle icon="📊">转化运营数据</CardTitle>
            <div className={styles.chartGrid}>
              <div className={styles.chartGridItem}>
                <h4 className={styles.sectionTitle}>整体转化走势（周度）</h4>
                <div className={styles.chartContainer}>
                  {data?.conversion_trend?.weeks?.length ? (
                    <EChartsComponent option={conversionTrendOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
              <div className={styles.chartGridItem}>
                <h4 className={styles.sectionTitle}>小助手开户转化率走势（周度）</h4>
                <div className={styles.chartContainer}>
                  {data?.employee_weekly_conversion?.weeks?.length ? (
                    <EChartsComponent option={employeeWeeklyRateOption} height={280} />
                  ) : (
                    <div className={styles.chartEmpty}>暂无数据</div>
                  )}
                </div>
              </div>
            </div>

            {/* 员工转化量排行榜 - 在图表下方 */}
            <div className={styles.tableSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 className={styles.sectionTitle}>员工转化量排行榜</h4>
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() => handleExport('employee_conversion')}
                  disabled={!data?.employee_conversion_ranking?.length}
                >
                  导出CSV
                </Button>
              </div>
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
              />
            </div>
          </Card>

        </>
      )}
    </div>
  );
};

export default XhsNotesOperationPage;