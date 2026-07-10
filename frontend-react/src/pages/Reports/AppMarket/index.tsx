/**
 * AppMarket 主页 v3.1：redirect 到 /app-market/funnel
 * 4 子页（funnel / comparison / detail / creative）由 router/index.tsx 直接导入。
 * 保留本文件仅为兼容旧路径 /reports/app-market 的回跳。
 */
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const AppMarketIndex: React.FC = () => {
  useEffect(() => {
    // 静默落地到漏斗子页
  }, []);
  return <Navigate to="/app-market/funnel" replace />;
};

export default AppMarketIndex;
