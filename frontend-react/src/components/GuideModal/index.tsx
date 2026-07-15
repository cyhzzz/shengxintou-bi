/**
 * Markdown 指南弹窗组件（v3.1.6：加 remark-gfm 支持表格 + rehype-sanitize 兜底 XSS + content 走 sanitizeText）
 */
import React, { useState, useEffect } from 'react';
import { Modal, Spin, Alert } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeText } from '@/utils/sanitizeText';
import styles from './index.module.scss';

interface GuideModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 指南文件名（不含路径） */
  guideFile: string;
  /** 弹窗标题 */
  title?: string;
}

// 指南标题映射（v2 - 6 个新数据类型 + 7 个旧 v1 类型保留兜底）
const GUIDE_TITLES: Record<string, string> = {
  // v2 新数据类型（v3.1.2 起支持）
  'account_mapping_guide.md': '投放账号映射导入指南',
  'conversion_content_guide.md': '内容平台加微链路导入指南',
  'conversion_appmarket_guide.md': '应用市场下载链路导入指南',
  'vendor_daily_guide.md': '厂商广告投放分析导入指南',
  'xhs_note_guide.md': '小红书笔记导入指南',
  'channel_open_guide.md': '渠道开户汇总导入指南',
  // 旧 v1 类型（已 410 Gone，保留映射防止老用户点老入口炸）
  'tencent_ads_guide.md': '腾讯广告数据导入指南（已下线）',
  'douyin_ads_guide.md': '抖音广告数据导入指南（已下线）',
  'xiaohongshu_ads_guide.md': '小红书广告数据导入指南（已下线）',
  'xhs_notes_list_guide.md': '小红书笔记列表导入指南（已下线）',
  'xhs_notes_daily_guide.md': '小红书笔记投放数据导入指南（已下线）',
  'xhs_notes_content_guide.md': '小红书笔记运营数据导入指南（已下线）',
  'backend_conversion_guide.md': '后端转化数据导入指南（已下线）',
};

const GuideModal: React.FC<GuideModalProps> = ({
  open,
  onClose,
  guideFile,
  title,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    if (open && guideFile) {
      loadGuide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guideFile]);

  const loadGuide = async () => {
    setLoading(true);
    setError(null);
    setContent('');

    try {
      const response = await fetch(/documents/);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/markdown')) {
        throw new Error(
          response.ok
            ? '文档格式异常（可能尚未生成导入指南）'
            : `文档加载失败（HTTP ${response.status}）`
        );
      }
      const text = await response.text();
      setContent(sanitizeText(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = title || GUIDE_TITLES[guideFile] || '导入指南';

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      className={styles.guideModal}
      centered
    >
      {loading && (
        <div className={styles.loading}>
          <Spin tip="加载中..." size="large">
            <div style={{ minHeight: 120 }} />
          </Spin>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          title="文档加载失败"
          description={error}
          showIcon
        />
      )}

      {!loading && !error && content && (
        <div className={styles.markdownBody}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </Modal>
  );
};

export default GuideModal;