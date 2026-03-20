/**
 * Markdown 指南弹窗组件
 * 用于展示数据导入指南
 */
import React, { useState, useEffect } from 'react';
import { Modal, Spin, Alert } from 'antd';
import ReactMarkdown from 'react-markdown';
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

// 指南标题映射
const GUIDE_TITLES: Record<string, string> = {
  'tencent_ads_guide.md': '腾讯广告数据导入指南',
  'douyin_ads_guide.md': '抖音广告数据导入指南',
  'xiaohongshu_ads_guide.md': '小红书广告数据导入指南',
  'xhs_notes_list_guide.md': '小红书笔记列表导入指南',
  'xhs_notes_daily_guide.md': '小红书笔记投放数据导入指南',
  'xhs_notes_content_guide.md': '小红书笔记运营数据导入指南',
  'backend_conversion_guide.md': '后端转化数据导入指南',
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
  }, [open, guideFile]);

  const loadGuide = async () => {
    setLoading(true);
    setError(null);
    setContent('');

    try {
      const response = await fetch(`/documents/${guideFile}`);
      if (!response.ok) {
        throw new Error('文档加载失败');
      }
      const text = await response.text();
      setContent(text);
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
          <Spin description="加载中..." />
        </div>
      )}

      {error && (
        <Alert
          type="error"
          message="文档加载失败"
          description={error}
          showIcon
        />
      )}

      {!loading && !error && content && (
        <div className={styles.markdownBody}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </Modal>
  );
};

export default GuideModal;