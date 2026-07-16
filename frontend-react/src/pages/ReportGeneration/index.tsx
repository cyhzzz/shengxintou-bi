/**
 * 报告生成页面 — v3.1.30 纯数据周报
 *
 * 改造点：
 * - 去除文案/重点工作（key_works）手工编辑
 * - 去除 contenteditable + 保存到 DB 逻辑
 * - 数据全部自动聚合（POST /api/v1/reports/weekly/data）
 * - 加日走势堆叠柱状图（ECharts）
 * - 保留 PNG + PDF 导出
 * - 保留 editorial 竖版报刊风格
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Select, message, Spin, Segmented } from 'antd';
import {
  FilePdfOutlined,
  FileImageOutlined,
  SettingOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import styles from './index.module.scss';

// 类型定义
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

interface WeeklyData {
  period: {
    start_date: string;
    end_date: string;
    report_year: number;
    report_week: number;
    report_name: string;
    report_sequence: number;
  };
  summary: {
    ad: {
      impressions: number;
      clicks: number;
      cost: number;
      leads: number;
      new_accounts: number;
      cpc: number;
      cpa: number;
      ctr: number;
      cumulative: {
        impressions: number;
        clicks: number;
        cost: number;
        leads: number;
        new_accounts: number;
      };
    };
    channel: {
      opens: number;
      deposits: number;
      valid: number;
      deposit_rate: number;
      valid_rate: number;
      cumulative: {
        opens: number;
        deposits: number;
        valid: number;
      };
    };
    funnel: {
      content_total: number;
      content_opened: number;
      content_rate: number;
      appmarket_total: number;
      appmarket_opened: number;
      appmarket_rate: number;
    };
  };
  daily: Array<{
    date: string;
    ad_impressions: number;
    ad_clicks: number;
    ad_cost: number;
    ad_leads: number;
    ad_new_accounts: number;
    ch_opens: number;
    ch_deposits: number;
    ch_valid: number;
  }>;
  by_platform: Array<{
    platform: string;
    impressions: number;
    clicks: number;
    cost: number;
    leads: number;
    new_accounts: number;
  }>;
  by_channel: Array<{
    channel: string;
    opens: number;
    deposits: number;
    valid: number;
  }>;
}

// 格式化数字（千分位）
const fmtNum = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('zh-CN');
};

// 格式化大数字（万为单位）
const fmtLarge = (n: number | null | undefined): string => {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(2) + '万';
  return fmtNum(n);
};

// 格式化金额
const fmtMoney = (n: number | null | undefined): string => {
  if (!n) return '0';
  return '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
};

// 格式化日期
const fmtDate = (s: string): string => {
  if (!s) return '';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
};

const ReportGeneration: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'pdf'>('png');
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  // 图表类型：ad = 广告投放日走势，channel = 渠道开户日走势
  const [chartType, setChartType] = useState<'ad' | 'channel'>('ad');

  const posterRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // 加载报告期选项
  const loadWeekOptions = useCallback(async () => {
    try {
      setPeriodsLoading(true);
      const response = await fetch('/api/v1/reports/weekly/periods');
      const result = await response.json();
      if (result.success) {
        setPeriodOptions(result.data || []);
        // 默认选第一个可用周次
        const first = (result.data || []).find((o: PeriodOption) => !o.disabled);
        if (first) {
          setSelectedPeriod(first);
          handleLoadData(first);
        }
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

  // 加载周报数据
  const handleLoadData = useCallback(async (period: PeriodOption) => {
    if (!period) return;
    try {
      setLoading(true);
      const response = await fetch('/api/v1/reports/weekly/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_year: period.report_year,
          report_week: period.report_week,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setWeeklyData(result.data);
      } else {
        message.error(result.error || '生成周报失败');
      }
    } catch (error) {
      console.error('生成周报失败:', error);
      message.error('生成周报失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekOptions();
  }, [loadWeekOptions]);

  // 渲染日走势堆叠柱状图
  useEffect(() => {
    if (!weeklyData || !chartRef.current) return;

    // 销毁旧实例
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const dates = weeklyData.daily.map((d) => fmtDate(d.date));

    let option: echarts.EChartsOption;
    if (chartType === 'ad') {
      // 广告投放日走势：展示量 + 点击量（双 series 堆叠）+ 开户数（折线）
      option = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['展示量', '点击量', '开户数'], top: 0, textStyle: { fontSize: 10 } },
        grid: { top: 32, left: 40, right: 40, bottom: 24 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9 } },
        yAxis: [
          { type: 'value', name: '展示/点击', axisLabel: { fontSize: 9 } },
          { type: 'value', name: '开户数', axisLabel: { fontSize: 9 } },
        ],
        series: [
          {
            name: '展示量',
            type: 'bar',
            stack: 'ad',
            data: weeklyData.daily.map((d) => d.ad_impressions),
            itemStyle: { color: '#0052D9' },
          },
          {
            name: '点击量',
            type: 'bar',
            stack: 'ad',
            data: weeklyData.daily.map((d) => d.ad_clicks),
            itemStyle: { color: '#409EFF' },
          },
          {
            name: '开户数',
            type: 'line',
            yAxisIndex: 1,
            data: weeklyData.daily.map((d) => d.ad_new_accounts),
            itemStyle: { color: '#E8A0A0' },
            lineStyle: { width: 2 },
          },
        ],
      };
    } else {
      // 渠道开户日走势：开户 + 入金 + 有效户（堆叠）
      option = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['开户数', '入金户数', '有效户数'], top: 0, textStyle: { fontSize: 10 } },
        grid: { top: 32, left: 40, right: 20, bottom: 24 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
        series: [
          {
            name: '开户数',
            type: 'bar',
            stack: 'ch',
            data: weeklyData.daily.map((d) => d.ch_opens),
            itemStyle: { color: '#1f4e79' },
          },
          {
            name: '入金户数',
            type: 'bar',
            stack: 'ch',
            data: weeklyData.daily.map((d) => d.ch_deposits),
            itemStyle: { color: '#4A90D9' },
          },
          {
            name: '有效户数',
            type: 'bar',
            stack: 'ch',
            data: weeklyData.daily.map((d) => d.ch_valid),
            itemStyle: { color: '#8a3a3c' },
          },
        ],
      };
    }

    chart.setOption(option);

    // resize
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [weeklyData, chartType]);

  // 处理报告期选择
  const handlePeriodChange = useCallback(
    (value: string) => {
      const option = periodOptions.find((opt) => opt.value === value);
      if (option) {
        setSelectedPeriod(option);
        handleLoadData(option);
      }
    },
    [periodOptions, handleLoadData]
  );

  // 动态加载 html2canvas
  const loadHtml2Canvas = async () => (await import('html2canvas')).default;
  // 动态加载 jspdf
  const loadJsPdf = async () => (await import('jspdf')).jsPDF;

  // 导出 PNG
  const handleExportPNG = async () => {
    if (!posterRef.current) {
      message.error('海报容器未找到');
      return;
    }
    setExporting('png');
    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      if (canvas.width === 0) {
        throw new Error('画布尺寸异常，请检查浏览器窗口是否过窄');
      }
      const imageUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `互联网渠道周报_${selectedPeriod?.report_year}W${selectedPeriod?.report_week}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('PNG 导出成功');
    } catch (error) {
      console.error('导出 PNG 失败:', error);
      message.error(`导出 PNG 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  // 导出 PDF
  const handleExportPDF = async () => {
    if (!posterRef.current) {
      message.error('海报容器未找到');
      return;
    }
    setExporting('pdf');
    try {
      const html2canvas = await loadHtml2Canvas();
      const jsPDF = await loadJsPdf();
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      if (canvas.width === 0) {
        throw new Error('画布尺寸异常');
      }
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210;
      const pdfHeight = (imgHeight / imgWidth) * pdfWidth;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`互联网渠道周报_${selectedPeriod?.report_year}W${selectedPeriod?.report_week}.pdf`);
      message.success('PDF 导出成功');
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      message.error(`导出 PDF 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* 左侧控制面板 */}
      <div className={styles.controlPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <SettingOutlined style={{ color: 'var(--color-brand)', marginRight: 8 }} />
              报告配置
            </span>
          </div>
        </div>

        <div className={styles.panelBody}>
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

          {/* 导出格式选择 */}
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>导出格式</label>
            <div className={styles.controlActions}>
              <Button
                type={selectedFormat === 'png' ? 'primary' : 'default'}
                icon={<FileImageOutlined />}
                onClick={handleExportPNG}
                loading={exporting === 'png'}
                disabled={!weeklyData}
                block
              >
                导出 PNG
              </Button>
              <Button
                type={selectedFormat === 'pdf' ? 'primary' : 'default'}
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
                loading={exporting === 'pdf'}
                disabled={!weeklyData}
                block
              >
                导出 PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧预览画布 */}
      <div className={`${styles.previewPanel}`}>
        <div className={styles.previewHeader}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <EyeOutlined style={{ color: 'var(--color-brand)', marginRight: 8 }} />
              报告预览
            </span>
          </div>
        </div>

        <div className={styles.previewCanvas}>
          {loading ? (
            <div className={styles.previewPlaceholder}>
              <Spin size="large" />
              <span>正在生成周报...</span>
            </div>
          ) : weeklyData ? (
            <div className={styles.reportScroll}>
              <div ref={posterRef} className={styles.reportPage}>
                {/* 刊头 */}
                <header className={styles.masthead}>
                  <div className={styles.kicker}>WEEKLY REPORT · 互联网渠道</div>
                  <h1 className={styles.headline}>互联网渠道周报</h1>
                  <div className={styles.dateline}>
                    {fmtDate(weeklyData.period.start_date)} — {fmtDate(weeklyData.period.end_date)} ·{' '}
                    {weeklyData.period.report_name}
                  </div>
                </header>

                {/* 1. 广告投放层 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>广告投放</span>
                    <span className={styles.layerTag}>agg_vendor_daily</span>
                  </div>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>展示量</div>
                      <div className={styles.metricValue}>{fmtLarge(weeklyData.summary.ad.impressions)}</div>
                      <div className={styles.metricCum}>累计 {fmtLarge(weeklyData.summary.ad.cumulative.impressions)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>点击量</div>
                      <div className={styles.metricValue}>{fmtLarge(weeklyData.summary.ad.clicks)}</div>
                      <div className={styles.metricCum}>累计 {fmtLarge(weeklyData.summary.ad.cumulative.clicks)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>花费</div>
                      <div className={styles.metricValue}>{fmtMoney(weeklyData.summary.ad.cost)}</div>
                      <div className={styles.metricCum}>累计 {fmtMoney(weeklyData.summary.ad.cumulative.cost)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>线索数</div>
                      <div className={styles.metricValue}>{fmtNum(weeklyData.summary.ad.leads)}</div>
                      <div className={styles.metricCum}>累计 {fmtNum(weeklyData.summary.ad.cumulative.leads)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>开户数</div>
                      <div className={styles.metricValue}>{fmtNum(weeklyData.summary.ad.new_accounts)}</div>
                      <div className={styles.metricCum}>累计 {fmtNum(weeklyData.summary.ad.cumulative.new_accounts)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>CPC</div>
                      <div className={styles.metricValue}>{fmtMoney(weeklyData.summary.ad.cpc)}</div>
                      <div className={styles.metricCum}>CTR {weeklyData.summary.ad.ctr}%</div>
                    </div>
                  </div>
                </section>

                {/* 2. 渠道开户层 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>互联网渠道开户</span>
                    <span className={styles.layerTag}>agg_daily_channel_open · 互联网引流</span>
                  </div>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>开户数</div>
                      <div className={styles.metricValue}>{fmtNum(weeklyData.summary.channel.opens)}</div>
                      <div className={styles.metricCum}>累计 {fmtNum(weeklyData.summary.channel.cumulative.opens)}</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>入金户数</div>
                      <div className={styles.metricValue}>{fmtNum(weeklyData.summary.channel.deposits)}</div>
                      <div className={styles.metricCum}>入金率 {weeklyData.summary.channel.deposit_rate}%</div>
                    </div>
                    <div className={styles.metricCell}>
                      <div className={styles.metricLabel}>有效户数</div>
                      <div className={styles.metricValue}>{fmtNum(weeklyData.summary.channel.valid)}</div>
                      <div className={styles.metricCum}>有效率 {weeklyData.summary.channel.valid_rate}%</div>
                    </div>
                  </div>
                </section>

                {/* 3. 漏斗转化率 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>漏斗整体转化率</span>
                    <span className={styles.layerTag}>线索 → 开户</span>
                  </div>
                  <div className={styles.funnelRow}>
                    <div className={styles.funnelCell}>
                      <div className={styles.funnelLabel}>内容平台</div>
                      <div className={styles.funnelValue}>{weeklyData.summary.funnel.content_rate}%</div>
                      <div className={styles.funnelMeta}>
                        {fmtNum(weeklyData.summary.funnel.content_opened)} / {fmtNum(weeklyData.summary.funnel.content_total)}
                      </div>
                    </div>
                    <div className={styles.funnelCell}>
                      <div className={styles.funnelLabel}>应用市场</div>
                      <div className={styles.funnelValue}>{weeklyData.summary.funnel.appmarket_rate}%</div>
                      <div className={styles.funnelMeta}>
                        {fmtNum(weeklyData.summary.funnel.appmarket_opened)} / {fmtNum(weeklyData.summary.funnel.appmarket_total)}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. 日走势堆叠柱状图 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>日走势</span>
                    <Segmented
                      size="small"
                      value={chartType}
                      onChange={(v) => setChartType(v as 'ad' | 'channel')}
                      options={[
                        { label: '广告投放', value: 'ad' },
                        { label: '渠道开户', value: 'channel' },
                      ]}
                    />
                  </div>
                  <div ref={chartRef} className={styles.chartBox} />
                </section>

                {/* 5. 按平台拆分（广告投放） */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>按平台拆分 · 广告投放</span>
                  </div>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>平台</th>
                        <th>展示量</th>
                        <th>点击量</th>
                        <th>花费</th>
                        <th>线索</th>
                        <th>开户</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.by_platform.map((p, i) => (
                        <tr key={i}>
                          <td className={styles.cellName}>{p.platform}</td>
                          <td className={styles.cellNum}>{fmtLarge(p.impressions)}</td>
                          <td className={styles.cellNum}>{fmtLarge(p.clicks)}</td>
                          <td className={styles.cellNum}>{fmtMoney(p.cost)}</td>
                          <td className={styles.cellNum}>{fmtNum(p.leads)}</td>
                          <td className={styles.cellNum}>{fmtNum(p.new_accounts)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* 6. 按渠道拆分（互联网开户） */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>按渠道拆分 · 互联网开户</span>
                  </div>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>渠道</th>
                        <th>开户数</th>
                        <th>入金户数</th>
                        <th>有效户数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.by_channel.map((c, i) => (
                        <tr key={i}>
                          <td className={styles.cellName}>{c.channel}</td>
                          <td className={styles.cellNum}>{fmtNum(c.opens)}</td>
                          <td className={styles.cellNum}>{fmtNum(c.deposits)}</td>
                          <td className={styles.cellNum}>{fmtNum(c.valid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* 脚注 */}
                <footer className={styles.reportFooter}>
                  <div className={styles.footerLabel}>Notes · 数据说明</div>
                  <ul>
                    <li>广告投放数据来自 agg_vendor_daily（按日期聚合）</li>
                    <li>互联网开户数据来自 agg_daily_channel_open（仅互联网引流）</li>
                    <li>累计范围：年初至周末</li>
                    <li>漏斗转化率 = 开户数 / 线索数，内容平台按线索日期筛选，应用市场限互联网引流</li>
                  </ul>
                </footer>
              </div>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <FilePdfOutlined style={{ fontSize: 64, color: 'var(--color-text-tertiary)' }} />
              <span>选择报告期自动生成周报</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;
