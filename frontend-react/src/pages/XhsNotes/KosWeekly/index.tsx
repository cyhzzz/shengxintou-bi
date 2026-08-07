/**
 * 分支KOS转化周报页面（v3.8.0）
 *
 * 数据口径：fact_conv_content.笔记ID 关联 agg_xhs_note.创作者（分支KOS投顾名单）。
 * 能力对齐员工转化周报：海报视图（默认）/ 文本模式 / 复制 / 导出 Word / Excel。
 * 海报样式与员工转化-转化周报一致（小红书配色 + 3 张榜单 + 年度拆分 + Notes）。
 * 筛选器统一使用 FilterBar（日期范围变化自动生成周报）。
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Space, message, Typography, Segmented } from 'antd';
import { CopyOutlined, FileWordOutlined, FileExcelOutlined } from '@ant-design/icons';
import WeeklyReportPreview from './components/WeeklyReportPreview';
import KosPosterModal from './components/KosPosterModal';
import { dataServiceXhsKos } from '@/services/dataService';
import { ReportFooter } from '@/components/ReportFooter';
import { FadeInSection, FilterBar } from '@/components';
import { useFilterStore } from '@/stores';
import { withKosRoster, type KosWeeklyData } from './kosRoster';
import styles from './index.module.scss';

const { Text } = Typography;

const PLATFORM = '小红书';

interface KosDefaultDateOptions {
  default_week_start?: string;
  default_week_end?: string;
}

const KosWeeklyPage: React.FC = () => {
  const { dateRange, setDateRange } = useFilterStore();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<KosWeeklyData | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  // 默认以海报为主视图，文本为备选（对齐员工转化周报）
  const [viewMode, setViewMode] = useState<'poster' | 'text'>('poster');
  // 默认周范围加载完成后再自动生成，避免用全局持久化日期先发一次无效请求
  const readyRef = useRef(false);

  // 生成周报
  const handleGenerateReport = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      message.warning('请选择日期范围');
      return;
    }

    setLoading(true);
    try {
      const response = await dataServiceXhsKos.getXhsKosWeekly({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      });

      if (response.success && response.data) {
        const weeklyData = response.data as unknown as KosWeeklyData;
        setReportData(weeklyData);
        const content = formatReportContent(weeklyData, dateRange.startDate, dateRange.endDate);
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
  }, [dateRange.startDate, dateRange.endDate]);

  // 挂载：默认日期取数据库最新有数据的一周（对齐员工转化周报 Bug 5 修复）
  useEffect(() => {
    let cancelled = false;
    dataServiceXhsKos.getXhsKosWeeklyFilterOptions()
      .then((res) => {
        if (cancelled) return;
        const defaultDates = res?.data as KosDefaultDateOptions | undefined;
        const start = defaultDates?.default_week_start;
        const end = defaultDates?.default_week_end;
        if (start && end) {
          setDateRange({ startDate: start, endDate: end });
        }
      })
      .catch(() => {
        // 拉默认周失败时保留全局默认日期范围
      })
      .finally(() => {
        readyRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 日期范围变化 → 自动生成周报（对齐 CostAnalysis 等 FilterBar 页面的行为）
  useEffect(() => {
    if (!readyRef.current) return;
    if (!dateRange.startDate || !dateRange.endDate) return;
    handleGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate, handleGenerateReport]);

  // 复制报告
  const handleCopy = useCallback(async () => {
    if (!reportContent) {
      message.warning('请先生成周报');
      return;
    }

    try {
      await navigator.clipboard.writeText(reportContent);
      message.success('周报已复制到剪贴板');
    } catch {
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
    <title>分支KOS转化周报</title>
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
    link.download = `分支KOS转化周报_${dateRange.startDate}_${dateRange.endDate}.doc`;
    link.click();
  }, [reportContent, dateRange.startDate, dateRange.endDate]);

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
      csvContent += '排名,投顾,线索量,开口量,有效线索,开户量,开户率,有效户,有效户率,总资产\n';

      const totalList = withKosRoster(rankings[platform]?.total || []);
      totalList.forEach((item, idx) => {
        csvContent += `${idx + 1},${item.kos_name},${item.total_leads},${item.mouth_count || 0},${item.valid_lead_count || 0},${item.opened_count},${(item.opening_rate || 0).toFixed(2)}%,${item.valid_customer_count || 0},${(item.valid_customer_rate || 0).toFixed(2)}%,${item.total_assets || 0}\n`;
      });
    });

    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `分支KOS转化周报_${dateRange.startDate}_${dateRange.endDate}.csv`;
    link.click();
  }, [reportData, dateRange.startDate, dateRange.endDate]);

  return (
    <div className={styles.weeklyPage}>
      {/* 筛选器（统一 FilterBar：日期范围变化自动生成周报） */}
      <FadeInSection delay={0} duration={0.8}>
        <FilterBar
          showPlatform={false}
          showAgency={false}
          onSearch={() => handleGenerateReport()}
          onReset={() => handleGenerateReport()}
        />
      </FadeInSection>

      {/* 周报内容卡片 */}
      <FadeInSection delay={0.4} duration={0.8}>
      <Card className={styles.reportCard}>
        <div className={styles.cardHeader}>
          <Text type="secondary" className={styles.cardTitle}>
            📋 周报内容
          </Text>
          <Text type="secondary" className={styles.cardDesc}>
            分支KOS转化周报详情（小红书 · 固定 {reportData?.roster_count ?? 10} 名投顾）
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
        {/* 视图切换 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <Space size={12} wrap>
            <Text type="secondary">视图：</Text>
            <Segmented
              options={[{ label: '海报视图', value: 'poster' }, { label: '文本模式', value: 'text' }]}
              value={viewMode}
              onChange={(v) => setViewMode(v as 'poster' | 'text')}
            />
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {viewMode === 'poster'
              ? '海报视图 · 点击浮动工具栏【导出图片 / PDF】即可。'
              : '文本模式 · 复制或导出 Word/Excel。'}
          </Text>
        </div>

        {/* 视图主体 */}
        {viewMode === 'poster' ? (
          reportData && dateRange.startDate && dateRange.endDate && (reportData?.overview?.[PLATFORM]?.total_leads ?? reportData?.overview?.[PLATFORM]?.leads ?? 0) > 0 ? (
            <KosPosterModal
              mode="inline"
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              rankings={reportData.rankings?.[PLATFORM] || { total: [], existing: [], new: [], existing_new_open: [] }}
              yearBreakdown={reportData.year_breakdown?.[PLATFORM]}
            />
          ) : (
            <WeeklyReportPreview content="" loading={loading} mode="poster" />
          )
        ) : (
          <WeeklyReportPreview content={reportContent} loading={loading} mode="text" />
        )}
      </Card>
      </FadeInSection>

      <FadeInSection delay={0.8} duration={0.8}>
      <ReportFooter
        sources={[
          { label: '口径', value: '小红书笔记关联线索（创作者=分支KOS投顾名单：何慧敏 / 刘贝 / 张永强 / 张靖月 / 李荣志 / 汤凯 / 盛睿雪 / 陈小芳 / 黄天平 / 赵茜）' },
          { label: '数据源', value: 'fact_conv_content（笔记ID 关联 agg_xhs_note.创作者）' },
          { label: '主端点', value: 'POST /api/v1/xhs/kos-weekly' },
        ]}
        notes={'周报的概览、趋势和榜单仅统计固定 10 位分支KOS投顾；名单内按各榜单原有指标降序，无数据成员补 0 后置。榜单口径与员工转化周报对齐（总榜累计 / 新增 / 存量 / 存量线索新开户）。'}
      />
      </FadeInSection>
    </div>
  );
};

/**
 * 格式化周报内容（文本模式）
 */
function formatReportContent(
  data: KosWeeklyData,
  startDate: string,
  endDate: string,
): string {
  const overview = data.overview || {};
  const rankings = data.rankings || {};

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  let content = `═══════════════════════════════════════════════════════════
                    分支KOS转化周报
═══════════════════════════════════════════════════════════

📅 报告周期：${formatDate(startDate)} - ${formatDate(endDate)}

`;

  // 概览
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

  // 榜单
  for (const platform of Object.keys(rankings)) {
    const platformRankings = rankings[platform] || {};

    content += `
═══════════════════════════════════════════════════════════
              【${platform}平台KOS转化榜单】
═══════════════════════════════════════════════════════════

`;

    const totalList = withKosRoster(platformRankings.total || []);
    content += `【全部线索转化榜】\n`;
    content += `排名  投顾        线索量  开户量  开户率\n`;
    content += `──────────────────────────────────────\n`;
    totalList.forEach((item, idx) => {
      content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.kos_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
    });
    content += `\n`;

    const newList = withKosRoster(platformRankings.new || []);
    content += `【新增线索转化榜】\n`;
    content += `排名  投顾        线索量  开户量  开户率\n`;
    content += `──────────────────────────────────────\n`;
    newList.forEach((item, idx) => {
      content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.kos_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
    });
    content += `\n`;

    const existingNewOpenList = withKosRoster(platformRankings.existing_new_open || []);
    content += `【存量线索新开户榜】\n`;
    content += `排名  投顾        线索量  开户量  开户率\n`;
    content += `──────────────────────────────────────\n`;
    existingNewOpenList.forEach((item, idx) => {
      content += `${String(idx + 1).padStart(2, '0')}    ${padRight(item.kos_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
    });
    content += `\n`;
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
  const chineseCount = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalLength = str.length + chineseCount;
  if (totalLength >= length) return str;
  return str + ' '.repeat(length - totalLength);
}

export default KosWeeklyPage;
