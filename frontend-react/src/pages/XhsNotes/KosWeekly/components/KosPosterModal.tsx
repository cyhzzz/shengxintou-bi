/**
 * 分支KOS转化周报 · 海报组件（v3.8.0）
 *
 * 样式与员工转化周报 PosterModal 对齐：masthead + 3 张榜单表（总榜/新增周榜/存量新开户周榜）
 * + 底部 Notes。
 */
import React, { useRef, useState } from 'react';
import { Modal, message, Spin } from 'antd';
import {
  KOS_ROSTER,
  withKosRoster,
  type KosPlatformRankings,
  type KosRankingItem,
} from '../kosRoster';
import { saveBlobFile, buildMobileSaveMessage, captureElement } from '@/utils/saveBlob';
import styles from './PosterModal.module.scss';

interface KosPosterModalProps {
  open?: boolean;
  startDate: string;
  endDate: string;
  rankings: KosPlatformRankings;
  onCancel?: () => void;
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
const renderTableRow = (item: KosRankingItem, index: number, isTotal = false) => {
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

  const rank = index + 1;
  const rowClass = rank <= 3 ? `${styles.dataRow} ${styles[`top${rank}`]}` : styles.dataRow;

  return (
    <tr key={index} className={rowClass}>
      <td>
        <span className={getRankClass(rank)}>{rank}</span>
      </td>
      <td className={styles.employeeName}>{item.kos_name}</td>
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
  data: KosRankingItem[],
  title: string,
  indexLabel: string
) => {
  // 固定名单内保留榜单原始降序，缺少数据的投顾补 0 后置。
  data = withKosRoster(data);
  // 计算合计
  const total = {
    total_leads: data.reduce((sum, item) => sum + (item.total_leads || 0), 0),
    opened_count: data.reduce((sum, item) => sum + (item.opened_count || 0), 0),
    valid_customer_count: data.reduce((sum, item) => sum + (item.valid_customer_count || 0), 0),
    total_assets: data.reduce((sum, item) => sum + (item.total_assets || 0), 0),
    opening_rate: 0,
    valid_customer_rate: 0,
    kos_name: '',
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
        <span className={styles.rankingBadge}>{indexLabel}</span>
        <span className={styles.rankingTitle}>{title}</span>
        <span className={styles.rankingMeta}>固定 {KOS_ROSTER.length} 名投顾</span>
      </div>
      <table className={styles.rankingTable}>
        <thead>
          <tr>
            <th style={{ width: '48px' }}>#</th>
            <th style={{ width: '110px' }}>投顾</th>
            <th>微信线索数</th>
            <th>开户数</th>
            <th>有效户数</th>
            <th>引入资产</th>
            <th>开户率</th>
            <th>有效户率</th>
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
              {renderTableRow(total as KosRankingItem, 0, true)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};

// 渲染底部说明
const renderFooterNote = (startDate: string, endDate: string) => {
  // 格式化日期为 YYYY.M.D 格式
  const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()}`;
  };
  // start_date 前一天
  const prevDay = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()}`;
  };

  const notes = [
    `①微信线索数：小红书笔记关联线索数（创作者=分支KOS投顾名单，截至时间：${fmtDate(endDate)}）`,
    `②开户数：开户成功线索数（是否开户=1）`,
    `③开户率=开户数/微信线索数；有效户率=有效户数/开户数`,
    `④资产单位：万元`,
    `⑤存量线索新开户榜：线索日期在${prevDay(startDate)}前+开户时间落在${fmtDate(startDate)}--${fmtDate(endDate)}内的户数`,
    `⑥分支KOS投顾名单：${KOS_ROSTER.join(' / ')}`,
  ];

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

const KosPosterModal: React.FC<KosPosterModalProps> = ({
  open,
  startDate,
  endDate,
  rankings,
  onCancel,
  mode = 'modal',
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);

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
      const canvas = await captureElement(posterRef.current!, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const imageUrl = canvas.toDataURL('image/png');

      if (canvas.width === 0 || imageUrl.length < 100) {
        throw new Error(
          `画布尺寸异常（canvasW=${canvas.width}, canvasH=${canvas.height}），` +
            `请检查浏览器窗口是否过窄导致海报容器塌陷后重试。`
        );
      }

      const fileName = `分支KOS转化周报_${startDate}_${endDate}.png`;
      const savedUri = await saveBlobFile({ filename: fileName, data: imageUrl });
      message.success(savedUri ? buildMobileSaveMessage(fileName, savedUri) : '海报导出成功');
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
      const jsPDF = await loadJsPdf();

      const canvas = await captureElement(posterRef.current!, {
        scale: 2,
        backgroundColor: null,
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

      const fileName = `分支KOS转化周报_${startDate}_${endDate}.pdf`;
      const pdfDataUrl = pdf.output('datauristring');
      const savedUri = await saveBlobFile({ filename: fileName, data: pdfDataUrl });
      message.success(savedUri ? buildMobileSaveMessage(fileName, savedUri) : '海报 PDF 导出成功');
    } catch (error) {
      console.error('导出PDF失败:', error);
      message.error('导出PDF失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  // 小红书配色（与员工转化周报 小红书 一致）
  const inner = (
    <>
      {/* 浮动工具栏 */}
      <div className={`${styles.floatingToolbar} ${styles.xiaohongshuToolbar}`}>
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
        <div ref={posterRef} className={`${styles.posterContainer} ${styles.xiaohongshu}`}>
          {/* 头部 — masthead */}
          <div className={styles.header}>
            <div className={styles.platformLabel}>小红书 · Weekly Report</div>
            <h1 className={styles.platformTitle}>小红书渠道 · 开户榜</h1>
            <div className={styles.subTitle}>分支KOS转化周报 · KOS Conversion Weekly Ranking</div>
            <div className={styles.dateRange}>
              <span className={styles.label}>Period</span>
              <span className={styles.value}>
                {formatDateDisplay(startDate)} — {formatDateDisplay(endDate)}
              </span>
            </div>
          </div>

          {/* 内容区域 */}
          <div className={styles.content}>
            {renderRankingTable(rankings.total, '投顾开户总榜', '01')}
            {renderRankingTable(rankings.new, '投顾新增线索开户周榜', '02')}
            {renderRankingTable(rankings.existing_new_open || [], '投顾存量线索新开户周榜', '03')}
            {renderFooterNote(startDate, endDate)}
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

export default KosPosterModal;
