import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Input, Form, message, Space, Alert } from 'antd';
import { CloudSyncOutlined, SettingOutlined } from '@ant-design/icons';
import {
  syncFromWebDAV,
  saveWebDAVCredentials,
  saveWebDAVProxyUrl,
  testWebDAVConnection,
  hasWebDAVCredentials,
  getWebDAVCredentials,
} from '@/services/mobileSync';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';

export default function MobileSyncButton() {
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form] = Form.useForm();
  const [hasCreds, setHasCreds] = useState(false);

  const pwaMode = isPwaClient();
  const showComponent = isMobileClient() || pwaMode;

  // 挂载时检查是否已配置凭据（仅在移动端 / PWA 端）
  useEffect(() => {
    if (showComponent) {
      hasWebDAVCredentials().then(setHasCreds);
    }
  }, [showComponent]);

  // 打开配置 Modal 时把已存配置回填
  const openSettings = useCallback(async () => {
    const creds = await getWebDAVCredentials();
    form.setFieldsValue({
      url: creds?.url || 'https://dav.jianguoyun.com/dav/',
      username: creds?.username || '',
      password: creds?.password || '',
      remoteDir: creds?.remoteDir || '',
      // v3.7.0：PWA 端 Cloudflare Worker 代理 URL
      proxyUrl: creds?.proxyUrl || '',
    });
    setSettingsOpen(true);
  }, [form]);

  // 仅在移动端 / PWA 端渲染
  if (!showComponent) return null;

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
    // v3.7.0：PWA 端先保存代理 URL，再测试连接（testWebDAVConnection 会读取 localStorage）
    if (pwaMode && values.proxyUrl) {
      await saveWebDAVProxyUrl(values.proxyUrl);
    }
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
      if (pwaMode && values.proxyUrl) {
        await saveWebDAVProxyUrl(values.proxyUrl);
      }
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
          {pwaMode && (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="iOS PWA 需要配置 Cloudflare Worker 代理"
                description={
                  <>
                    坚果云 WebDAV 不支持浏览器 CORS，PWA 端必须通过 Cloudflare Worker 代理转发。
                    请按 <code>scripts/cloudflare-worker-webdav-proxy.js</code> 文件头部说明部署 Worker，
                    然后把 Worker URL（形如 <code>https://xxx.workers.dev</code>）填入下方。
                  </>
                }
              />
              <Form.Item
                name="proxyUrl"
                label="Cloudflare Worker 代理 URL（PWA 专用）"
                rules={[{ required: true, message: 'PWA 模式必须填入 Worker 代理 URL' }]}
                extra="代理仅做 CORS 转发，不存储凭据；凭据通过 HTTPS 直传 Worker → 坚果云"
              >
                <Input placeholder="https://your-worker-name.your-subdomain.workers.dev" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}
