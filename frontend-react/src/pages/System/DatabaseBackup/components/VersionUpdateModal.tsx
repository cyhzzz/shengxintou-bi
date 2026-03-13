/**
 * 版本更新提示弹窗
 */
import React from 'react';
import { Modal, Button } from 'antd';

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
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ marginBottom: 16 }}>版本更新提示</h3>
        <p style={{ color: '#666', marginBottom: 16 }}>{message}</p>
        {cloudVersion && (
          <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>
            云端版本: v{cloudVersion}
          </p>
        )}
        {supportContact && (
          <p style={{ color: '#666', fontSize: 13 }}>
            支持联系: {supportContact}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default VersionUpdateModal;