/**
 * 海报模态框组件
 * 参照旧版前端的海报模板实现
 * 在弹窗中展示海报，支持导出图片和PDF
 */
import React, { useRef, useState } from 'react';
import { Modal, message, Spin } from 'antd';
import {
  FIXED_ASSISTANTS,
  withFixedAssistants,
  type WeeklyPlatformRankings,
  type WeeklyRankingItem,
} from '../weeklyRanking';
import styles from './PosterModal.module.scss';

interface PosterModalProps {
  open?: boolean;
  platform: string;
  startDate: string;
  endDate: string;
  rankings: WeeklyPlatformRankings;
  onCancel?: () => void;
  // v3.1.25: 'modal' = 原貌 Modal 包装（PosterExportButtons 调用）；'inline' = 直接渲染与主页面作为海报视图（Weekly 主页面调用）
  mode?: 'modal' | 'inline';
}

// 格式化数字
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
};

// 格式化资产（转换为万元）
const formatAssets = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const wan = value / 10000;
  return wan.toFixed(2);
};

// 格式化日期显示
const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

// 获取排名样式类
const getRankClass = (rank: number): string => {
  const baseClass = styles.rank;
  if (rank === 1) return `${baseClass} ${styles.rank1}`;
  if (rank === 2) return `${baseClass} ${styles.rank2}`;
  if (rank === 3) return `${baseClass} ${styles.rank3}`;
  return `${baseClass} ${styles.rankOther}`;
};

// 渲染表格行
const renderTableRow = (
  item: WeeklyRankingItem,
  index: number,
  isTotal = false
) => {
  if (isTotal) {
    return (
      <tr className={styles.totalRow} key="total">
        <td>总计</td>
        <td>-</td>
        <td className={styles.number}>{formatNumber(item.total_leads)}</td>
        <td className={styles.highlight}>{formatNumber(item.opened_count)}</td>
        <td className={styles.number}>{formatNumber(item.valid_customer_count)}</td>
        <td className={styles.number}>{formatAssets(item.total_assets)}</td>
        <td className={styles.rate}>{(item.opening_rate || 0).toFixed(2)}%</td>
        <td className={styles.rate}>{(item.valid_customer_rate || 0).toFixed(2)}%</td>
      </tr>
    );
  }

  return (
    <tr key={index}>
      <td>
        <span className={getRankClass(index + 1)}>{index + 1}</span>
      </td>
      <td className={styles.employeeName}>{item.employee_name}</td>
      <td className={styles.number}>{formatNumber(item.total_leads)}</td>
      <td className={styles.highlight}>{formatNumber(item.opened_count)}</td>
      <td className={styles.number}>{formatNumber(item.valid_customer_count)}</td>
      <td className={styles.number}>{formatAssets(item.total_assets)}</td>
      <td className={styles.rate}>{(item.opening_rate || 0).toFixed(2)}%</td>
      <td className={styles.rate}>{(item.valid_customer_rate || 0).toFixed(2)}%</td>
    </tr>
  );
};

// 渲染榜单表格
const renderRankingTable = (
  data: WeeklyRankingItem[],
  title: string,
  indexLabel: string,
  platform: string
) => {
  // 固定名单内保留榜单原始降序，缺少数据的员工补 0 后置。
  data = withFixedAssistants(data, platform);
  // 计算合计
  const total = {
    total_leads: data.reduce((sum, item) => sum + (item.total_leads || 0), 0),
    opened_count: data.reduce((sum, item) => sum + (item.opened_count || 0), 0),
    valid_customer_count: data.reduce((sum, item) => sum + (item.valid_customer_count || 0), 0),
    total_assets: data.reduce((sum, item) => sum + (item.total_assets || 0), 0),
    opening_rate: 0,
    valid_customer_rate: 0,
    employee_name: '',
  };

  if (total.total_leads > 0) {
    total.opening_rate = (total.opened_count / total.total_leads) * 100;
  }
  if (total.opened_count > 0) {
    total.valid_customer_rate = (total.valid_customer_count / total.opened_count) * 100;
  }

  return (
    <div className={styles.rankingSection}>
      <div className={styles.rankingHeader}>
        <span className={styles.rankingIndex}>{indexLabel}</span>
        <span className={styles.rankingTitle}>{title}</span>
        <span className={styles.rankingMeta}>固定 {FIXED_ASSISTANTS.length} 名员工</span>
      </div>
      <table className={styles.rankingTable}>
        <thead>
          <tr>
            <th style={{ width: '48px' }}>#</th>
            <th style={{ width: '110px' }}>员工</th>
            <th>线索</th>
            <th>开户</th>
            <th>有效户</th>
            <th>资产(万)</th>
            <th>开户率</th>
            <th>有效率</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '24px 6px', color: '#8c8c8c', textAlign: 'center' }}>
                暂无数据
              </td>
            </tr>
          ) : (
            <>
              {data.map((item, index) => renderTableRow(item, index))}
              {renderTableRow(total as WeeklyRankingItem, 0, true)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};

// 渲染底部说明
const renderFooterNote = (platform: string) => {
  const notes = [
    '微信线索数指添加企业微信后留存线索量',
    '开户数据指开户营业部归属为 10 / 30（即成都天府四街 / 二营业部）',
    '开户率 = 开户数 / 微信线索数；有效率 = 有效户数 / 开户数',
    '资产单位：万元',
    '存量线索新开户榜：线索日期在统计周期前 + 开户时间落在周期内的户数（与新增线索开户周榜分别覆盖"老企微线索新开户"与"本周新增线索开户"两组增量业绩）',
  ];

  if (platform === '小红书') {
    notes.push('存量开户线索指添加企业微信时间在统计周期开始前');
  }

  return (
    <div className={styles.footerNote}>
      <div className={styles.footerNoteTitle}>Notes · 数据说明</div>
      <ul>
        {notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </div>
  );
};

const PosterModal: React.FC<PosterModalProps> = ({
  open,
  platform,
  startDate,
  endDate,
  rankings,
  onCancel,
  mode = 'modal',
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);

  // 动态加载 html2canvas
  const loadHtml2Canvas = async (): Promise<typeof import('html2canvas').default> => {
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas;
  };

  // 动态加载 jspdf
  const loadJsPdf = async (): Promise<typeof import('jspdf').jsPDF> => {
    const { jsPDF } = await import('jspdf');
    return jsPDF;
  };

  // 导出图片
  const handleExportImage = async () => {
    if (!posterRef.current) {
      message.error('海报容器未找到');
      return;
    }

    setExporting('image');
    try {
      const html2canvas = await loadHtml2Canvas();

      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imageUrl = canvas.toDataURL('image/png');

      // v3.1.28 安全检查：canvas 宽度为 0 或 dataURL 异常时抛出明确错误，
      // 避免静默下载 0 字节 PNG（典型触发场景：窄视口下 flex 容器塌陷）
      if (canvas.width === 0 || imageUrl.length < 100) {
        throw new Error(
          `画布尺寸异常（canvasW=${canvas.width}, canvasH=${canvas.height}），` +
            `请检查浏览器窗口是否过窄导致海报容器塌陷后重试。`
        );
      }

      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${platform}开户榜_${startDate}_${endDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success(`${platform}海报导出成功`);
    } catch (error) {
      console.error('导出海报失败:', error);
      message.error(`导出海报失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  // 导出PDF
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
        backgroundColor: null,
        logging: false,
      });

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
      pdf.save(`${platform}开户榜_${startDate}_${endDate}.pdf`);

      message.success(`${platform} PDF 导出成功`);
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error('导出PDF失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  // 获取平台样式类
  const getPlatformClass = () => {
    switch (platform) {
      case '小红书':
        return styles.xiaohongshu;
      case '腾讯':
        return styles.tencent;
      case '抖音':
        return styles.douyin;
      default:
        return styles.xiaohongshu;
    }
  };

  // 获取工具栏样式类
  const getToolbarClass = () => {
    switch (platform) {
      case '小红书':
        return `${styles.floatingToolbar} ${styles.xiaohongshuToolbar}`;
      case '腾讯':
        return `${styles.floatingToolbar} ${styles.tencentToolbar}`;
      case '抖音':
        return `${styles.floatingToolbar} ${styles.douyinToolbar}`;
      default:
        return `${styles.floatingToolbar} ${styles.xiaohongshuToolbar}`;
    }
  };

  // 获取平台标题
  const getPlatformTitle = () => {
    return `${platform}渠道`;
  };

  // 获取榜单标题前缀
  const getRankingPrefix = () => {
    return platform === '小红书' ? '小助手' : '';
  };

  // v3.1.25: mode='inline' 直接渲染与主页面合并；mode='modal' 保留 Modal 包装供 PosterExportButtons 使用
  const inner = (
    <>
      {/* 浮动工具栏 */}
      <div className={getToolbarClass()}>
        <button
          className={styles.toolbarBtn}
          onClick={handleExportImage}
          disabled={exporting !== null}
        >
          {exporting === 'image' ? <Spin size="small" /> : null}
          <span>导出图片</span>
        </button>
        <button
          className={styles.toolbarBtn}
          onClick={handleExportPDF}
          disabled={exporting !== null}
        >
          {exporting === 'pdf' ? <Spin size="small" /> : null}
          <span>导出 PDF</span>
        </button>
      </div>

      {/* 海报内容 */}
      <div className={styles.posterWrapper}>
        <div ref={posterRef} className={`${styles.posterContainer} ${getPlatformClass()}`}>
          {/* 头部 — masthead */}
          <div className={styles.header}>
            <div className={styles.platformLabel}>{platform} · Weekly Report</div>
            <h1 className={styles.platformTitle}>{getPlatformTitle()} · 开户榜</h1>
            <div className={styles.subTitle}>员工转化周报 · Employee Conversion Weekly Ranking</div>
            <div className={styles.dateRange}>
              <span className={styles.label}>Period</span>
              <span className={styles.value}>
                {formatDateDisplay(startDate)} — {formatDateDisplay(endDate)}
              </span>
            </div>
          </div>

          {/* 内容区域 */}
          <div className={styles.content}>
            {renderRankingTable(rankings.total, `${getRankingPrefix()}开户总榜`, '01', platform)}
            {renderRankingTable(
              rankings.new,
              `${getRankingPrefix()}新增线索开户周榜`,
              '02',
              platform
            )}
            {renderRankingTable(
              rankings.existing_new_open || [],
              `${getRankingPrefix()}存量线索新开户周榜`,
              '03',
              platform
            )}
            {renderFooterNote(platform)}
          </div>
        </div>
      </div>
    </>
  );

  if (mode === 'inline') return inner;
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      centered
      className={styles.posterModal}
      title={null}
      closable={true}
    >
      {inner}
    </Modal>
  );
};

export default PosterModal;
