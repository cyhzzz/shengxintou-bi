/**
 * 员工转化周报页面
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, DatePicker, Button, Select, Space, message, Typography, Segmented } from 'antd';
import { CopyOutlined, FileWordOutlined, FileExcelOutlined, PictureOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import WeeklyReportPreview from './components/WeeklyReportPreview';
import PosterModal from './components/PosterModal';
import { getEmployeeConversionFilterOptions, postEmployeeConversionWeekly } from '@/types/api';
import type { EmployeeConversionWeeklyData } from '@/types/api.schemas';
import styles from './index.module.scss';

const { Text } = Typography;

const { RangePicker } = DatePicker;

// 平台选项
const PLATFORM_OPTIONS = [
  { label: '小红书', value: '小红书' },
  { label: '腾讯', value: '腾讯' },
  { label: '抖音', value: '抖音' },
];

// TOP数量选项
const TOP_COUNT_OPTIONS = [
  { label: 'TOP 5', value: 5 },
  { label: 'TOP 10', value: 10 },
  { label: 'TOP 20', value: 20 },
];

interface WeeklyDefaultDateOptions {
  default_week_start?: string;
  default_week_end?: string;
}

const EmployeeConversionWeeklyPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [platforms, setPlatforms] = useState<string[]>(['小红书', '腾讯', '抖音']);
  const [topCount, setTopCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<EmployeeConversionWeeklyData | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  // v3.1.25: 默认以海报为主视图，文本为备选
  const [viewMode, setViewMode] = useState<'poster' | 'text'>('poster');
  const [posterPlatform, setPosterPlatform] = useState<string>('小红书');
  // v3.1.27: 进页面即自动生成一次海报，参考 ReportGeneration 进页面默认预览的模式
  const didAutoGenRef = useRef(false);

  // 生成周报（必须在 useEffect 之前定义，否则 TDZ ReferenceError: Cannot access 'handleGenerateReport' before initialization）
  const handleGenerateReport = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('请选择日期范围');
      return;
    }

    if (platforms.length === 0) {
      message.warning('请至少选择一个平台');
      return;
    }

    setLoading(true);
    try {
      const response = await postEmployeeConversionWeekly({
        start_date: dateRange[0],
        end_date: dateRange[1],
        platforms,
        top_count: topCount,
      });

      if (response.success && response.data) {
        setReportData(response.data);
        const content = formatReportContent(response.data, dateRange[0], dateRange[1], topCount);
        setReportContent(content);
        message.success('周报生成成功');
      } else {
        message.error(response.message || '生成周报失败');
      }
    } catch (error) {
      console.error('生成周报失败:', error);
      message.error('生成周报失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, platforms, topCount]);

  // Bug 5 修复: 默认日期取数据库最新有数据的一周，避免自然周晚于数据刷新日导致生成 0 行
  useEffect(() => {
    getEmployeeConversionFilterOptions()
      .then((res) => {
        const defaultDates = res?.data as WeeklyDefaultDateOptions | undefined;
        const start = defaultDates?.default_week_start;
        const end = defaultDates?.default_week_end;
        if (start && end) {
          setDateRange([start, end]);
        } else {
          setDateRange(['2026-01-01', '2026-12-31']);
        }
      })
      .catch(() => setDateRange(['2026-01-01', '2026-12-31']));
  }, []);

  // 进页面默认视图为海报时，dateRange 加载完后自动 generate 一次，以避免看到 Empty 空预览
  useEffect(() => {
    if (didAutoGenRef.current) return;
    if (viewMode !== 'poster') return;
    if (!dateRange[0] || !dateRange[1]) return;
    if (reportData || loading) return;
    didAutoGenRef.current = true;
    handleGenerateReport();
  }, [viewMode, dateRange, reportData, loading, handleGenerateReport]);

  // 复制报告
  const handleCopy = useCallback(async () => {
    if (!reportContent) {
      message.warning('请先生成周报');
      return;
    }

    try {
      await navigator.clipboard.writeText(reportContent);
      message.success('周报已复制到剪贴板');
    } catch (error) {
      message.error('复制失败，请手动选择内容复制');
    }
  }, [reportContent]);

  // 导出Word
  const handleExportWord = useCallback(() => {
    if (!reportContent) {
      message.warning('请先生成周报');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>员工转化周报</title>
    <style>
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; line-height: 1.8; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <pre>${reportContent}</pre>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `员工转化周报_${dateRange[0]}_${dateRange[1]}.doc`;
    link.click();
  }, [reportContent, dateRange]);

  // 导出Excel
  const handleExportExcel = useCallback(() => {
    if (!reportData) {
      message.warning('请先生成周报');
      return;
    }

    const rankings = reportData.rankings || {};
    const platformKeys = Object.keys(rankings);

    // 构建CSV内容
    let csvContent = '';

    platformKeys.forEach((platform) => {
      csvContent += `\n${platform}平台 - 全部线索转化榜\n`;
      csvContent += '排名,服务人员,线索量,开口量,有效线索,开户量,开户率,有效户,有效户率,总资产\n';

      const totalList = rankings[platform]?.total || [];
      totalList.forEach((item, idx) => {
        csvContent += `${idx + 1},${item.employee_name},${item.total_leads},${item.mouth_count || 0},${item.valid_lead_count || 0},${item.opened_count},${(item.opening_rate || 0).toFixed(2)}%,${item.valid_customer_count || 0},${(item.valid_customer_rate || 0).toFixed(2)}%,${item.total_assets || 0}\n`;
      });
    });

    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `员工转化周报_${dateRange[0]}_${dateRange[1]}.csv`;
    link.click();
  }, [reportData, dateRange]);

  return (
    <div className={styles.weeklyPage}>
      {/* 配置卡片 */}
      <Card className={styles.configCard}>
        <div className={styles.configContent}>
          <Space wrap size={16}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>日期范围</label>
              <RangePicker
                value={dateRange[0] && dateRange[1] ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                  }
                }}
                format="YYYY-MM-DD"
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>平台</label>
              <Select
                mode="multiple"
                value={platforms}
                onChange={setPlatforms}
                options={PLATFORM_OPTIONS}
                style={{ minWidth: 200 }}
                placeholder="选择平台"
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>榜单人数</label>
              <Select
                value={topCount}
                onChange={setTopCount}
                options={TOP_COUNT_OPTIONS}
                style={{ width: 120 }}
              />
            </div>
          </Space>
          <Button type="primary" onClick={handleGenerateReport} loading={loading}>
            生成周报
          </Button>
        </div>
      </Card>

      {/* 周报内容卡片 */}
      <Card className={styles.reportCard}>
        <div className={styles.cardHeader}>
          <Text type="secondary" className={styles.cardTitle}>
            📋 周报内容
          </Text>
          <Text type="secondary" className={styles.cardDesc}>
            员工转化周报详情
          </Text>
          {reportData && (
            <Space style={{ marginLeft: 'auto' }}>
              <Button icon={<CopyOutlined />} onClick={handleCopy}>
                复制报告
              </Button>
              <Button icon={<FileWordOutlined />} onClick={handleExportWord}>
                导出Word
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                导出Excel
              </Button>
            </Space>
          )}
        </div>
        {/* v3.1.25: 视图切换 + 海报平台选择 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <Space size={12} wrap>
            <Text type="secondary">视图：</Text>
            <Segmented
              options={[{ label: '海报视图', value: 'poster' }, { label: '文本模式', value: 'text' }]}
              value={viewMode}
              onChange={(v) => setViewMode(v as 'poster' | 'text')}
            />
            {viewMode === 'poster' && reportData && (
              <Space size={8}>
                <Text type="secondary">平台：</Text>
                <Select
                  value={posterPlatform}
                  onChange={setPosterPlatform}
                  options={Object.keys(reportData?.overview || {})
                    .filter((p) => (reportData?.overview?.[p]?.leads ?? reportData?.overview?.[p]?.total_leads ?? 0) > 0)
                    .map((p) => ({ label: p, value: p }))}
                  style={{ minWidth: 120 }}
                />
              </Space>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {viewMode === 'poster'
              ? '海报视图 · 点击浮动工具栏【导出图片 / PDF】即可。'
              : '文本模式 · 复制或导出 Word/Excel。'}
          </Text>
        </div>

        {/* v3.1.25: 视图主体 */}
        {viewMode === 'poster' ? (
          reportData && dateRange[0] && dateRange[1] && (reportData?.overview?.[posterPlatform]?.leads ?? reportData?.overview?.[posterPlatform]?.total_leads ?? 0) > 0 ? (
            <PosterModal
              mode="inline"
              platform={posterPlatform}
              startDate={dateRange[0]}
              endDate={dateRange[1]}
              rankings={reportData.rankings?.[posterPlatform] || { total: [], existing: [], new: [] }}
            />
          ) : (
            <WeeklyReportPreview content="" loading={loading} mode="poster" />
          )
        ) : (
          <WeeklyReportPreview content={reportContent} loading={loading} mode="text" />
        )}
      </Card>
    </div>
  );
};

/**
 * 格式化周报内容
 */
function formatReportContent(
  data: EmployeeConversionWeeklyData,
  startDate: string,
  endDate: string,
  topCount: number = 10,
): string {
  const overview = data.overview || {};
  const rankings = data.rankings || {};
  const stars = data.stars || {};

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  let content = `═══════════════════════════════════════════════════════════
                    员工转化周报
═══════════════════════════════════════════════════════════

📅 报告周期：${formatDate(startDate)} - ${formatDate(endDate)}

`;

  // 各平台概览
  for (const platform of Object.keys(overview)) {
    const platformData = overview[platform] || {};
    const totalLeads = platformData.total_leads ?? platformData.leads ?? 0;
    const openedCount = platformData.opened_count ?? platformData.opened ?? 0;
    const openingRate = platformData.opening_rate ?? platformData.rate ?? 0;
    content += `
┌───────────────────────────────────────────────────────────┐
│ 【${platform}平台概览】
├───────────────────────────────────────────────────────────┤
│ 线索量：${formatNum(totalLeads)} 条
│ 开户量：${formatNum(openedCount)} 户
│ 开户率：${Number(openingRate || 0).toFixed(2)}%
└───────────────────────────────────────────────────────────┘

`;
  }

  // 各平台榜单
  for (const platform of Object.keys(rankings)) {
    const platformRankings = rankings[platform] || {};

    content += `
═══════════════════════════════════════════════════════════
              【${platform}平台转化榜单】
═══════════════════════════════════════════════════════════

`;

    // 全部线索榜单
    const totalList = platformRankings.total || [];
    if (totalList.length > 0) {
      content += `【全部线索转化榜 TOP${Math.min(totalList.length, topCount)}】\n`;
      content += `排名  服务人员    线索量  开户量  开户率\n`;
      content += `──────────────────────────────────────\n`;
      totalList.slice(0, topCount).forEach((item, idx) => {
        content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
      });
      content += `\n`;
    }

    // 存量线索榜单
    const existingList = platformRankings.existing || [];
    if (existingList.length > 0) {
      content += `【存量线索转化榜 TOP${Math.min(existingList.length, topCount)}】\n`;
      content += `排名  服务人员    线索量  开户量  开户率\n`;
      content += `──────────────────────────────────────\n`;
      existingList.slice(0, topCount).forEach((item, idx) => {
        content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
      });
      content += `\n`;
    }

    // 新增线索榜单
    const newList = platformRankings.new || [];
    if (newList.length > 0) {
      content += `【新增线索转化榜 TOP${Math.min(newList.length, topCount)}】\n`;
      content += `排名  服务人员    线索量  开户量  开户率\n`;
      content += `──────────────────────────────────────\n`;
      newList.slice(0, topCount).forEach((item, idx) => {
        content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
      });
      content += `\n`;
    }
  }

  // 转化之星
  content += `
═══════════════════════════════════════════════════════════
                  【本周转化之星】
═══════════════════════════════════════════════════════════

`;
  for (const platform of Object.keys(stars)) {
    const star = stars[platform] || {};
    content += `⭐ ${platform}：${star.name || '-'}，开户率 ${(star.rate || 0).toFixed(2)}%\n`;
  }

  content += `
═══════════════════════════════════════════════════════════
                    报告结束
═══════════════════════════════════════════════════════════
`;

  return content;
}

/**
 * 格式化数字
 */
function formatNum(value: number | undefined | null): string {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString();
}

/**
 * 字符串右填充空格
 */
function padRight(str: string, length: number): string {
  str = String(str || '');
  const chineseCount = (str.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalLength = str.length + chineseCount;
  if (totalLength >= length) return str;
  return str + ' '.repeat(length - totalLength);
}

export default EmployeeConversionWeeklyPage;
