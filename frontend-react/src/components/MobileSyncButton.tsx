import { useState, useEffect } from 'react';
import { Button, Modal, Input, Form, message, Space } from 'antd';
import { CloudSyncOutlined, SettingOutlined } from '@ant-design/icons';
import {
  syncFromWebDAV,
  saveWebDAVCredentials,
  testWebDAVConnection,
  hasWebDAVCredentials,
} from '@/services/mobileSync';
import { isMobileClient } from '@/utils/isDesktop';

export default function MobileSyncButton() {
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form] = Form.useForm();
  const [hasCreds, setHasCreds] = useState(false);

  // 挂载时检查是否已配置凭据（仅在移动端）
  useEffect(() => {
    if (isMobileClient()) {
      hasWebDAVCredentials().then(setHasCreds);
    }
  }, []);

  // 仅在移动端渲染
  if (!isMobileClient()) return null;

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await syncFromWebDAV();
      if (result.success) {
        message.success(result.message);
        setHasCreds(true);
        // 重新加载页面以刷新数据
        setTimeout(() => window.location.reload(), 1000);
      } else {
        message.error(result.message);
        if (result.message.includes('配置坚果云')) {
          setSettingsOpen(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const values = await form.validateFields();
    const testResult = await testWebDAVConnection(
      values.username,
      values.password,
      values.remoteDir || ''
    );
    if (testResult.success) {
      await saveWebDAVCredentials(values.username, values.password, values.remoteDir || '');
      message.success('保存成功');
      setSettingsOpen(false);
      setHasCreds(true);
    } else {
      message.error(testResult.message);
    }
  };

  return (
    <>
      <Space style={{ marginRight: 12 }}>
        <Button
          type="primary"
          icon={<CloudSyncOutlined />}
          loading={loading}
          onClick={handleSync}
          size="small"
          disabled={!hasCreds}
        >
          同步数据
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={() => setSettingsOpen(true)}
          size="small"
        />
      </Space>
      <Modal
        title="坚果云同步设置"
        open={settingsOpen}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="坚果云账号"
            rules={[{ required: true, message: '请输入坚果云账号邮箱' }]}
          >
            <Input placeholder="your@email.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="应用密码"
            rules={[{ required: true, message: '请输入应用密码' }]}
            extra="在坚果云官网 → 安全选项 → 第三方应用管理 中生成"
          >
            <Input.Password placeholder="应用密码（不是登录密码）" />
          </Form.Item>
          <Form.Item
            name="remoteDir"
            label="远程目录（可选）"
            extra="留空则从根目录查找 shengxintou.db"
          >
            <Input placeholder="如：省心投BI" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
