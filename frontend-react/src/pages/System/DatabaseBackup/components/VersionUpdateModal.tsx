/**
 * 版本更新提示弹窗（v3.1.6 design token 化：去除 inline style + emoji 改 WarningOutlined）
 */
import React from 'react';
import { Modal, Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import styles from './VersionUpdateModal.module.scss';

interface VersionUpdateModalProps {
  visible: boolean;
  message: string;
  cloudVersion?: string;
  supportContact?: string;
  onClose: () => void;
}

const VersionUpdateModal: React.FC<VersionUpdateModalProps> = ({
  visible,
  message,
  cloudVersion,
  supportContact,
  onClose,
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="ok" type="primary" onClick={onClose}>
          我知道了
        </Button>,
      ]}
      centered
      width={400}
    >
      <div className={styles.modalBody}>
        <WarningOutlined
          className={styles.warningIcon}
          style={{ color: 'var(--color-warning)' }}
        />
        <h3 className={styles.title}>版本更新提示</h3>
        <p className={styles.message}>{message}</p>
        {cloudVersion && (
          <p className={styles.meta}>云端版本: v{cloudVersion}</p>
        )}
        {supportContact && (
          <p className={styles.metaLast}>支持联系: {supportContact}</p>
        )}
      </div>
    </Modal>
  );
};

export default VersionUpdateModal;