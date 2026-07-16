import React from 'react';
import { Card, Button, Space, Typography, Alert } from 'antd';
import { ReloadOutlined, HomeOutlined, BugOutlined } from '@ant-design/icons';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  // 区分错误类型：路由层 (404/500) vs 业务层 (lazy import / 渲染崩溃)
  let title = '页面加载出错';
  let description = '页面加载过程中出现错误，请刷新或重试。';
  let technical = '';
  let isReloadable = true;

  if (isRouteErrorResponse(error)) {
    const status = error.status;
    if (status === 404) {
      title = '404 页面不存在';
      description = '请检查 URL 是否正确，或者返回首页。';
      isReloadable = false;
    } else if (status && status >= 500) {
      title = `${status} 服务器异常`;
      description = '后端不可用或资源加载失败。如重试仍失败，请检查是否需要重建前端资源 (npm run build)。';
    }
    technical = `Route ${status} ${error.statusText}`;
  } else if (error instanceof Error) {
    // chunkLoadError / Failed to fetch dynamically imported module 等
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message)) {
      title = '资源版本不匹配，需重新加载';
      description = '前端资源 hash 已变更，原本打开的页面资源已不存在。点击下方【刷新本页】重试或【返回首页】。';
      technical = error.message;
    } else {
      technical = error.message;
    }
  } else {
    technical = String(error);
  }

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
      <Card style={{ maxWidth: 640, width: '100%' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>
            <BugOutlined style={{ color: 'var(--color-error)', marginRight: 8 }} />
            {title}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Paragraph>
          {isReloadable && (
            <Alert
              type="warning"
              showIcon
              message="常见原因：Vite 资源 hash 变更 / 会话过期 / 接口无响应。"
            />
          )}
          {technical && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: 12,
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                overflow: 'auto',
                maxHeight: 160,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>技术细节：</Text>
              <div>{technical}</div>
            </div>
          )}
          <Space wrap>
            {isReloadable && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleReload}>
                刷新本页
              </Button>
            )}
            <Button icon={<HomeOutlined />} onClick={handleHome}>
              返回首页
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default RouteErrorBoundary;
