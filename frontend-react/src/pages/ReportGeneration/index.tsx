/**
 * 报告生成页面 — v3.1.31 纯数据周报（本周 + 全年 + 环比 + 两堆叠图 + 互联网占比）
 *
 * 改造点（相对 v3.1.30）：
 * - 数据结构按业务维度重梳：6 指标 × 3 套时间区间（本周/全年累计/上周环比）
 * - 去掉 tab 切换，两个堆叠图直接平铺（开户数 + 有效户数，按渠道堆叠日走势）
 * - 加互联网渠道占公司开户占比（互联网引流 / 全渠道类别）
 * - 6 指标：消耗金额 / 品牌曝光 / 线索数 / 开户数 / 新增有效户数 / 新增客户资产
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Select, message, Spin } from 'antd';
import {
  FilePdfOutlined,
  FileImageOutlined,
  SettingOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { pickEChartsColor } from '@/utils/echartsColors';
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

interface MetricSet {
  cost: number;          // 消耗金额
  impressions: number;   // 品牌曝光
  leads_wx: number;      // 企微数（内容平台）
  leads_app: number;     // APP激活数（应用市场）
  opens: number;         // 开户数
  valid: number;         // 新增有效户数
  assets: number;        // 新增客户资产
}

interface WeeklyData {
  period: {
    start_date: string;
    end_date: string;
    prev_start: string;
    prev_end: string;
    report_year: number;
    report_week: number;
    report_name: string;
    report_sequence: number;
  };
  current_week: MetricSet;
  year_to_date: MetricSet;
  prev_week: MetricSet;
  week_over_week: { [K in keyof MetricSet]: number | null };
  daily_opens_stacked: Array<Record<string, number | string>>;
  weekly_opens_stacked: Array<Record<string, number | string>>;
  channels: string[];
  internet_ratio: {
    opens_ratio: number;
    valid_ratio: number;
    year_opens_ratio: number;
    year_valid_ratio: number;
  };
  kpi: {
    time_progress: number;
    opens: { target: number; actual: number; rate: number };
    valid: { target: number; actual: number; rate: number };
    assets: { target: number; actual: number; rate: number };
  };
}

// 7 个核心指标定义（v3.1.32：线索数拆分为企微数 + APP激活数）
const METRICS: Array<{ key: keyof MetricSet; label: string; fmt: (n: number) => string }> = [
  { key: 'cost', label: '消耗金额', fmt: fmtMoney },
  { key: 'impressions', label: '品牌曝光', fmt: fmtLarge },
  { key: 'leads_wx', label: '企微数', fmt: fmtNum },
  { key: 'leads_app', label: 'APP激活数', fmt: fmtNum },
  { key: 'opens', label: '开户数', fmt: fmtNum },
  { key: 'valid', label: '新增有效户数', fmt: fmtNum },
  { key: 'assets', label: '新增客户资产', fmt: fmtMoney },
];

// 格式化数字（千分位）
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('zh-CN');
}

// 格式化大数字（万为单位）
function fmtLarge(n: number | null | undefined): string {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(2) + '万';
  return fmtNum(n);
}

// 格式化金额
function fmtMoney(n: number | null | undefined): string {
  if (!n) return '¥0';
  return '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// 格式化日期
function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 格式化环比（带正负号）
function fmtWow(n: number | null | undefined): { text: string; positive: boolean | null } {
  if (n === null || n === undefined) return { text: '—', positive: null };
  const sign = n >= 0 ? '+' : '';
  return { text: `${sign}${n.toFixed(2)}%`, positive: n >= 0 };
}

// 渠道 → 大类映射（与后端 CHANNEL_CATEGORY_MAP 一致）
const CHANNEL_CATEGORY_MAP: Record<string, string> = {
  小红书: '内容平台', 腾讯: '内容平台', 抖音: '内容平台',
  快手: '内容平台', 财联社: '内容平台', yj: '内容平台',
  云极: '内容平台', 其他: '内容平台',
  华为: '应用市场', 荣耀: '应用市场', 小米: '应用市场',
  oppo: '应用市场', vivo: '应用市场', 苹果: '应用市场', 鸿蒙: '应用市场',
  高德: '本地生活',
};

// 各大类的色系（同色系内按索引取深浅，越深 = 越靠前（开户数越大））
const CONTENT_REDS = [
  '#8b0000', '#a52a2a', '#c0392b', '#d63031',
  '#e74c3c', '#e57373', '#ef9a9a', '#ffcdd2',
];
const APPMARKET_BLUES = [
  '#0d47a1', '#1565c0', '#1976d2', '#1e88e5',
  '#2196f3', '#42a5f5', '#64b5f6', '#90caf9',
];
const LOCAL_GREEN = '#27ae60';

// 渠道索引缓存（按同色系内的排序分配深浅）
function buildChannelColorMap(channels: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const contentChs = channels.filter((c) => CHANNEL_CATEGORY_MAP[c] === '内容平台');
  const appChs = channels.filter((c) => CHANNEL_CATEGORY_MAP[c] === '应用市场');
  const localChs = channels.filter((c) => CHANNEL_CATEGORY_MAP[c] === '本地生活');

  contentChs.forEach((ch, i) => {
    map[ch] = CONTENT_REDS[Math.min(i, CONTENT_REDS.length - 1)];
  });
  appChs.forEach((ch, i) => {
    map[ch] = APPMARKET_BLUES[Math.min(i, APPMARKET_BLUES.length - 1)];
  });
  localChs.forEach((ch) => {
    map[ch] = LOCAL_GREEN;
  });
  return map;
}

// 3 大类的代表色（用于自定义图例）
const CATEGORY_REP_COLORS: Record<string, string> = {
  内容平台: '#c0392b',
  应用市场: '#1976d2',
  本地生活: '#27ae60',
};

// v3.1.35 微型 KPI 环形图（SVG，尺寸 ~44x32，与原 layerTag 灰字占用空间相近）
function KpiRing({ label, rate }: { label: string; rate: number }) {
  // rate 为百分比，>100 时截断到 100 用于画环
  const pct = Math.min(100, Math.max(0, rate || 0));
  const r = 10;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const color = rate >= 100 ? '#27ae60' : rate >= 75 ? '#0052d9' : rate >= 50 ? '#d97706' : '#c0392b';
  return (
    <div className={styles.kpiRing}>
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e8e8e8" strokeWidth="3" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
        />
      </svg>
      <div className={styles.kpiRingText}>
        <div className={styles.kpiRingLabel}>{label}</div>
        <div className={styles.kpiRingRate} style={{ color }}>
          {rate.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

const ReportGeneration: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  const posterRef = useRef<HTMLDivElement>(null);
  const opensChartRef = useRef<HTMLDivElement>(null);
  const yearlyChartRef = useRef<HTMLDivElement>(null);
  const opensChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const yearlyChartInstanceRef = useRef<echarts.ECharts | null>(null);

  // 加载报告期选项
  const loadWeekOptions = useCallback(async () => {
    try {
      setPeriodsLoading(true);
      const response = await fetch('/api/v1/reports/weekly/periods');
      const result = await response.json();
      if (result.success) {
        setPeriodOptions(result.data || []);
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

  // 渲染开户数 · 本周内按日堆叠柱状图
  useEffect(() => {
    if (!weeklyData || !opensChartRef.current) return;
    if (opensChartInstanceRef.current) {
      opensChartInstanceRef.current.dispose();
      opensChartInstanceRef.current = null;
    }
    const chart = echarts.init(opensChartRef.current);
    opensChartInstanceRef.current = chart;

    const dates = weeklyData.daily_opens_stacked.map((d) => fmtDate(String(d.date)));
    const channels = weeklyData.channels;
    const colorMap = buildChannelColorMap(channels);

    const option: echarts.EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: false },
      grid: { top: 8, left: 36, right: 16, bottom: 24, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: dates.length > 7 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
      series: channels.map((ch) => ({
        name: ch,
        type: 'bar',
        stack: 'opens',
        barMaxWidth: 36,
        emphasis: { focus: 'series' },
        data: weeklyData.daily_opens_stacked.map((d) => Number(d[ch] || 0)),
        itemStyle: { color: colorMap[ch] || '#999' },
      })),
    };
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      opensChartInstanceRef.current = null;
    };
  }, [weeklyData]);

  // 渲染开户数 · 年内按周次堆叠柱状图（参考厂商分析报表样式）
  useEffect(() => {
    if (!weeklyData || !yearlyChartRef.current) return;
    if (yearlyChartInstanceRef.current) {
      yearlyChartInstanceRef.current.dispose();
      yearlyChartInstanceRef.current = null;
    }
    const chart = echarts.init(yearlyChartRef.current);
    yearlyChartInstanceRef.current = chart;

    const weeks = weeklyData.weekly_opens_stacked.map((d) => String(d.week));
    const channels = weeklyData.channels;
    const colorMap = buildChannelColorMap(channels);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
        valueFormatter: (v: any) => Number(v || 0).toLocaleString(),
      },
      legend: { show: false },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: weeks,
        axisLabel: { fontSize: 9, rotate: weeks.length > 12 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        name: '开户数',
        nameTextStyle: { fontSize: 11, color: '#8a8d99' },
        axisLabel: {
          fontSize: 9,
          formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v.toFixed(0)),
        },
      },
      series: channels.map((ch) => ({
        name: ch,
        type: 'bar',
        stack: '总量',
        barMaxWidth: 36,
        emphasis: { focus: 'series' },
        data: weeklyData.weekly_opens_stacked.map((d) => Number(d[ch] || 0)),
        itemStyle: { color: colorMap[ch] || '#999' },
      })),
    };
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      yearlyChartInstanceRef.current = null;
    };
  }, [weeklyData]);

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

  // 动态加载 html2canvas / jspdf
  const loadHtml2Canvas = async () => (await import('html2canvas')).default;
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

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>导出格式</label>
            <div className={styles.controlActions}>
              <Button
                icon={<FileImageOutlined />}
                onClick={handleExportPNG}
                loading={exporting === 'png'}
                disabled={!weeklyData}
                block
              >
                导出 PNG
              </Button>
              <Button
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
      <div className={styles.previewPanel}>
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

                {/* 1. 核心指标：7 指标 × 3 列（本周/全年/环比） */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>核心指标</span>
                    <div className={styles.kpiRow}>
                      <KpiRing label="开户数" rate={weeklyData.kpi.opens.rate} />
                      <KpiRing label="有效户" rate={weeklyData.kpi.valid.rate} />
                      <KpiRing label="资产" rate={weeklyData.kpi.assets.rate} />
                    </div>
                  </div>
                  <table className={styles.metricTable}>
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>本周</th>
                        <th>全年累计</th>
                        <th>环比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((m) => {
                        const cw = weeklyData.current_week[m.key];
                        const ytd = weeklyData.year_to_date[m.key];
                        const wow = weeklyData.week_over_week[m.key];
                        const wowFmt = fmtWow(wow);
                        return (
                          <tr key={m.key}>
                            <td className={styles.cellName}>{m.label}</td>
                            <td className={styles.cellNum}>{m.fmt(cw)}</td>
                            <td className={styles.cellNum}>{m.fmt(ytd)}</td>
                            <td
                              className={`${styles.cellNum} ${styles.wowCell}`}
                              data-positive={wowFmt.positive === null ? 'na' : wowFmt.positive ? 'up' : 'down'}
                            >
                              {wowFmt.text}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>

                {/* 2. 互联网渠道占公司开户占比 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>互联网渠道占公司开户占比</span>
                    <span className={styles.layerTag}>互联网引流 / 全渠道类别</span>
                  </div>
                  <table className={styles.ratioTable}>
                    <colgroup>
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>本周</th>
                        <th>全年累计</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.cellName}>开户占比</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.opens_ratio.toFixed(2)}%</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.year_opens_ratio.toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className={styles.cellName}>有效户占比</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.valid_ratio.toFixed(2)}%</td>
                        <td className={styles.cellNum}>{weeklyData.internet_ratio.year_valid_ratio.toFixed(2)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* 3. 开户数 · 本周按日 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>开户数 · 本周</span>
                    <div className={styles.catLegend}>
                      {['内容平台', '应用市场', '本地生活'].map((cat) => (
                        <span key={cat} className={styles.catLegendItem}>
                          <span
                            className={styles.catLegendDot}
                            style={{ background: CATEGORY_REP_COLORS[cat] }}
                          />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div ref={opensChartRef} className={styles.chartBox} />
                </section>

                {/* 4. 开户数 · 全年按周次 */}
                <section className={styles.layerCard}>
                  <div className={styles.layerHeader}>
                    <span className={styles.layerTitle}>开户数 · 全年</span>
                    <div className={styles.catLegend}>
                      {['内容平台', '应用市场', '本地生活'].map((cat) => (
                        <span key={cat} className={styles.catLegendItem}>
                          <span
                            className={styles.catLegendDot}
                            style={{ background: CATEGORY_REP_COLORS[cat] }}
                          />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div ref={yearlyChartRef} className={styles.chartBox} />
                </section>
              </div>

              {/* 数据说明（海报外） */}
              <footer className={styles.reportFooter}>
                <div className={styles.footerLabel}>Notes · 数据说明</div>
                <ul>
                  <li>消耗金额 / 品牌曝光 / APP激活数：来自 agg_vendor_daily（广告投放日聚合）</li>
                  <li>企微数：来自 fact_conv_content COUNT（内容平台线索明细，1 行=1 企微）</li>
                  <li>开户数 / 新增有效户数：来自 agg_daily_channel_open，仅统计渠道类别=互联网引流</li>
                  <li>新增客户资产：内容平台 fact_conv_content（是否开户=1 AND 非存量）+ 应用市场 fact_conv_appmarket（是否新开户=1 AND 渠道类型=互联网引流）</li>
                  <li>全年累计：年初至周末；环比：与上一周对比</li>
                  <li>互联网渠道占公司开户占比：互联网引流 / 全渠道类别（互联网引流+合作机构+员工开户+自然流入），分本周与全年累计两个口径</li>
                  <li>年度 KPI 完成率：年初至今实际值 / (年度目标 × 时间进度)，时间进度 = 当前周末日 / 全年天数（{weeklyData?.kpi?.time_progress.toFixed(0)}%）；目标：开户数 2 万、有效户 1 万、资产 5 亿</li>
                  <li>两图均为开户数堆叠（按渠道分色，内容平台红色系/应用市场蓝色系/本地生活绿色系，同大类渠道挨在一起）：上图本周按日，下图全年按周次</li>
                </ul>
              </footer>
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
