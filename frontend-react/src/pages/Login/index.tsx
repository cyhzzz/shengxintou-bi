/**
 * 登录页（feat-cloud-supabase）。
 * - POST /api/v1/auth/login
 * - 拿到 token 后跳 ?next=<url>，默认 /
 * - 网络或凭证错误给出提示
 */
import { useState } from 'react';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '@/services/auth';

const { Title } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(location.search);
  const nextPath = (() => {
    const raw = params.get('next');
    if (!raw) return '/omni-channel';
    try {
      return decodeURIComponent(raw);
    } catch {
      return '/omni-channel';
    }
  })();

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(nextPath, { replace: true });
    } catch (e) {
      // feat-cloud-supabase：按 error code 区分（auth.ts throw 时带了 code 字段）
      const err = e as Error & { code?: string };
      const code = err.code || '';
      if (code === 'AUTH_UNAVAILABLE') {
        setError('认证服务暂时不可达（可能是网络问题），请稍后再试或联系管理员');
      } else if (code === 'INVALID_CREDENTIALS') {
        setError('邮箱或密码不正确');
      } else {
        setError(err.message || '登录失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-layout, #f0f2f5)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 32,
          background: 'var(--color-bg-container, #fff)',
          borderRadius: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>省心投 BI</Title>
          <Typography.Text type="secondary">请登录</Typography.Text>
        </div>

        {error && (
          <Alert type="error" message={error} style={{ marginBottom: 16 }} />
        )}

        <Form<{ email: string; password: string }>
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ email: '', password: '' }}
          disabled={loading}
        >
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" placeholder="admin@shengxintou.local" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="••••••" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary, #999)', fontSize: 12 }}>
          feat-cloud-supabase 第一阶段
        </div>
      </div>
    </div>
  );
}
