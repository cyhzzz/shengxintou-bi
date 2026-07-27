import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Input, Form, message, Space } from 'antd';
import { CloudSyncOutlined, SettingOutlined } from '@ant-design/icons';
import {
  syncFromWebDAV,
  saveWebDAVCredentials,
  testWebDAVConnection,
  hasWebDAVCredentials,
  getWebDAVCredentials,
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

  // 打开配置 Modal 时把已存配置回填
  const openSettings = useCallback(async () => {
    const creds = await getWebDAVCredentials();
    form.setFieldsValue({
      url: creds?.url || 'https://dav.jianguoyun.com/dav/',
      username: creds?.username || '',
      password: creds?.password || '',
      remoteDir: creds?.remoteDir || '',
    });
    setSettingsOpen(true);
  }, [form]);

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
        // v3.6.0：未配置时自动弹出配置 Modal
        if (result.message.includes('尚未配置 WebDAV')) {
          openSettings();
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
      values.remoteDir || '',
      values.url || ''
    );
    if (testResult.success) {
      await saveWebDAVCredentials(
        values.username,
        values.password,
        values.remoteDir || '',
        values.url || ''
      );
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
          onClick={openSettings}
          size="small"
        >
          WebDAV 配置
        </Button>
      </Space>
      <Modal
        title="WebDAV 配置"
        open={settingsOpen}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="url"
            label="WebDAV 服务器地址"
            rules={[{ required: true, message: '请输入服务器地址' }]}
            extra="坚果云默认 https://dav.jianguoyun.com/dav/"
          >
            <Input placeholder="https://dav.jianguoyun.com/dav/" />
          </Form.Item>
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
            extra="在坚果云官网 → 安全选项 → 第三方应用管理 中生成（不是登录密码）"
          >
            <Input.Password placeholder="应用密码" />
          </Form.Item>
          <Form.Item
            name="remoteDir"
            label="备份目录（可选）"
            extra="WebDAV 服务器上的备份目录路径，如 shengxintou-backup"
          >
            <Input placeholder="如：shengxintou-backup" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
