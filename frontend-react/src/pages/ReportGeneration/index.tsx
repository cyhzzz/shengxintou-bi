/**
 * 报告生成页面
 * 基于旧版 WeeklyReportGenerator.js 复刻
 *
 * 功能：
 * - 左右分栏布局
 * - 左侧：报告类型选择、报告期选择、格式选择、操作按钮
 * - 右侧：竖版画布预览
 * - 支持生成、编辑、保存、导出周报
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Select, message, Spin, Popconfirm } from 'antd';
import {
  FilePdfOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import styles from './index.module.scss';
import { generateWeeklyReportHTML } from './utils/weeklyReportTemplate';

// 类型定义
interface WorkItem {
  work_id: string | null;
  work_num: string;
  work_category: string;
  work_description: string;
}

interface PeriodOption {
  value: string;
  label: string;
  report_year: number;
  report_week: number;
  date_range: string;
  sequence: number;
  disabled?: boolean;
  disabled_reason?: string;
}

interface ReportData {
  report_id: string;
  report_name: string;
  report_year: number;
  report_week: number;
  date_range: string;
  is_new: boolean;
  key_works: WorkItem[];
  content_count: number;
  content_count_cumulative: number;
  content_views: number;
  content_views_cumulative: number;
  live_sessions: number;
  live_sessions_cumulative: number;
  live_viewers: number;
  live_viewers_cumulative: number;
  ad_impressions: number;
  ad_impressions_cumulative: number;
  ad_clicks: number;
  ad_clicks_cumulative: number;
  new_accounts: number;
  new_accounts_cumulative: number;
  enterprise_wechat_add: number;
  enterprise_wechat_add_cumulative: number;
  subscription_count: number;
  subscription_count_cumulative: number;
  branch_new_accounts: number;
  branch_new_accounts_cumulative: number;
}

const ReportGeneration: React.FC = () => {
  // 状态
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'html'>('pdf');
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 加载报告期选项
  const loadWeekOptions = useCallback(async () => {
    try {
      setPeriodsLoading(true);
      const response = await fetch('/api/v1/reports/weekly/periods');
      const result = await response.json();

      if (result.success) {
        setPeriodOptions(result.data || []);
      } else {
        message.error('加载报告期失败');
      }
    } catch (error) {
      console.error('加载报告期失败:', error);
      message.error('加载报告期失败');
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekOptions();
  }, [loadWeekOptions]);

  // 检查报告是否存在
  const checkReportExists = useCallback(async (info: PeriodOption) => {
    try {
      const response = await fetch('/api/v1/reports/weekly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_year: info.report_year,
          report_week: info.report_week,
        }),
      });
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        if (data.is_new) {
          // 新报告，清空预览
          setCurrentReport(null);
          setHasChanges(false);
        } else {
          // 已存在报告
          setCurrentReport(data);
          setHasChanges(false);
        }
      }
    } catch (error) {
      console.error('检查报告失败:', error);
      setCurrentReport(null);
    }
  }, []);

  // 生成报告
  const handleGenerateReport = useCallback(async () => {
    if (!selectedPeriod) {
      message.warning('请先选择报告期');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/v1/reports/weekly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_year: selectedPeriod.report_year,
          report_week: selectedPeriod.report_week,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setCurrentReport(result.data);
        setHasChanges(false);
        message.success(result.data.is_new ? '报告生成成功' : '报告已加载');
      } else {
        message.error(result.error || '生成报告失败');
      }
    } catch (error) {
      console.error('生成报告失败:', error);
      message.error('生成报告失败');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // 保存报告
  const handleSaveReport = useCallback(async () => {
    if (!currentReport || !iframeRef.current) {
      message.warning('没有可保存的报告');
      return;
    }

    try {
      // 从 iframe 提取数据
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;

      const iframeBody = iframeDoc.body;

      // 提取重点工作数据
      const workItems = iframeBody.querySelectorAll('.work-item');
      const keyWorks: WorkItem[] = [];

      workItems.forEach((item) => {
        const workId = (item as HTMLElement).dataset.workId || '';
        const workNum = item.querySelector('.work-num')?.textContent?.trim() || '';
        const workCat = item.querySelector('.work-cat')?.textContent?.trim() || '';
        const workDesc = item.querySelector('.work-desc')?.textContent?.trim() || '';

        if (workNum || workCat || workDesc) {
          keyWorks.push({
            work_id: workId || null,
            work_num: workNum,
            work_category: workCat,
            work_description: workDesc,
          });
        }
      });

      // 提取指标数据
      const extractNumber = (element: Element | null): number => {
        if (!element) return 0;
        const text = element.textContent?.trim() || '';
        return parseInt(text.replace(/[+,/\s]/g, '').replace(/\D.*/g, '')) || 0;
      };

      const metrics: Record<string, number> = {};

      // 内容运营
      metrics.content_count = extractNumber(iframeBody.querySelector('.source-body .data-row:nth-child(1) .editable-num'));
      metrics.content_views = extractNumber(iframeBody.querySelector('.source-body .data-row:nth-child(2) .editable-num'));

      // 直播获客
      const liveCard = iframeBody.querySelector('.layer-sources .layer-card:last-child');
      if (liveCard) {
        metrics.live_sessions = extractNumber(liveCard.querySelector('.source-body .data-row:nth-child(1) .editable-num'));
        metrics.live_viewers = extractNumber(liveCard.querySelector('.source-body .data-row:nth-child(2) .editable-num'));
      }

      // 广告投放
      const adsCard = iframeBody.querySelector('.ads-layer');
      if (adsCard) {
        metrics.ad_impressions = extractNumber(adsCard.querySelector('.ads-body .data-row:nth-child(1) .editable-num'));
        metrics.ad_clicks = extractNumber(adsCard.querySelector('.ads-body .data-row:nth-child(2) .editable-num'));
      }

      // 转化结果
      const convCard = iframeBody.querySelector('.conversion-layer');
      if (convCard) {
        metrics.new_accounts = extractNumber(convCard.querySelector('.conv-big-number'));
        const convItems = convCard.querySelectorAll('.conv-small-item');
        metrics.enterprise_wechat_add = extractNumber(convItems[0]?.querySelector('.editable-num'));
        metrics.subscription_count = extractNumber(convItems[1]?.querySelector('.editable-num'));
        metrics.branch_new_accounts = extractNumber(convItems[2]?.querySelector('.editable-num'));
      }

      // 调用保存 API
      const response = await fetch(`/api/v1/reports/weekly/${encodeURIComponent(currentReport.report_id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_works: keyWorks,
          ...metrics,
        }),
      });
      const result = await response.json();

      if (result.success) {
        // 更新本地数据
        setCurrentReport((prev) =>
          prev
            ? {
                ...prev,
                key_works: keyWorks,
                ...metrics,
              }
            : null
        );
        setHasChanges(false);
        message.success('保存成功');
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存报告失败:', error);
      message.error('保存报告失败');
    }
  }, [currentReport]);

  // 导出报告
  const handleExportReport = useCallback(() => {
    if (!currentReport) {
      message.warning('请先生成报告');
      return;
    }

    const html = generateWeeklyReportHTML(currentReport);

    if (selectedFormat === 'html') {
      // 导出 HTML 文件
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPeriod?.label || '周报'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PDF 格式 - 使用浏览器打印
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
  }, [currentReport, selectedFormat, selectedPeriod]);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // 处理报告期选择
  const handlePeriodChange = useCallback(
    (value: string) => {
      const option = periodOptions.find((opt) => opt.value === value);
      if (option) {
        setSelectedPeriod(option);
        checkReportExists(option);
      } else {
        setSelectedPeriod(null);
        setCurrentReport(null);
      }
    },
    [periodOptions, checkReportExists]
  );

  return (
    <div className={styles.container}>
      {/* 左侧控制面板 */}
      <div className={styles.controlPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>⚙️ 报告配置</span>
          </div>
        </div>

        <div className={styles.panelBody}>
          {/* 报告类型选择 */}
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>报告类型</label>
            <div className={styles.btnGroup}>
              <Button
                type={reportType === 'weekly' ? 'primary' : 'default'}
                onClick={() => setReportType('weekly')}
              >
                周报
              </Button>
              <Button type={reportType === 'monthly' ? 'primary' : 'default'} disabled>
                月报
              </Button>
            </div>
          </div>

          {/* 报告期选择 */}
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>报告期</label>
            <Select
              className={styles.periodSelect}
              placeholder="请选择报告期"
              value={selectedPeriod?.value}
              onChange={handlePeriodChange}
              loading={periodsLoading}
              options={periodOptions.map((opt) => ({
                value: opt.value,
                label: opt.disabled ? `${opt.label} - ${opt.disabled_reason}` : opt.label,
                disabled: opt.disabled,
              }))}
            />
            {selectedPeriod && (
              <div className={styles.periodInfo}>
                <span className={styles.periodDate}>{selectedPeriod.date_range}</span>
                <span className={styles.periodSequence}>全年第{selectedPeriod.sequence}次周报</span>
              </div>
            )}
          </div>

          {/* 报告格式选择 */}
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>报告格式</label>
            <div className={styles.btnGroup}>
              <Button
                type={selectedFormat === 'pdf' ? 'primary' : 'default'}
                icon={<FilePdfOutlined />}
                onClick={() => setSelectedFormat('pdf')}
              >
                PDF
              </Button>
              <Button
                type={selectedFormat === 'html' ? 'primary' : 'default'}
                icon={<FileTextOutlined />}
                onClick={() => setSelectedFormat('html')}
              >
                HTML
              </Button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className={styles.controlActions}>
            <Button type="primary" size="large" block onClick={handleGenerateReport} loading={loading}>
              生成报告
            </Button>
            <Button
              type="default"
              size="large"
              block
              disabled={!currentReport}
              onClick={handleExportReport}
            >
              导出报告
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧预览画布 */}
      <div className={`${styles.previewPanel} ${isFullscreen ? styles.fullscreen : ''}`} ref={previewRef}>
        <div className={styles.previewHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>👁️ 报告预览</span>
          </div>
          <div className={styles.previewActions}>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              disabled={!currentReport}
              onClick={handleSaveReport}
            >
              保存
            </Button>
            <Button
              type="text"
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏预览'}
            />
          </div>
        </div>

        <div className={styles.previewCanvas}>
          {loading ? (
            <div className={styles.previewPlaceholder}>
              <Spin size="large" />
              <span>正在生成报告...</span>
            </div>
          ) : currentReport ? (
            <iframe
              ref={iframeRef}
              className={styles.reportFrame}
              srcDoc={generateWeeklyReportHTML(currentReport)}
              title="报告预览"
            />
          ) : selectedPeriod ? (
            <div className={styles.previewPlaceholder}>
              <FileTextOutlined style={{ fontSize: 64, color: '#999' }} />
              <span>该报告期尚未生成</span>
              <span className={styles.placeholderHint}>点击"生成报告"按钮开始生成</span>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <FilePdfOutlined style={{ fontSize: 64, color: '#999' }} />
              <span>选择报告期并点击"生成报告"</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;