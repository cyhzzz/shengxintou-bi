import React from 'react';

export interface FadeInSectionProps {
  children: React.ReactNode;
  /** 兼容旧调用，已忽略 */
  delay?: number;
  /** 兼容旧调用，已忽略 */
  duration?: number;
  /** 兼容旧调用，已忽略 */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** 兼容旧调用，已忽略 */
  distance?: number;
  /** 兼容旧调用，已忽略 */
  fullWidth?: boolean;
  /** 兼容旧调用，已忽略 */
  once?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 大容器顺序浮现组件（v3.3.6 起：取消动画，直接渲染 children）
 *
 * 历史背景：v3.2.5 引入基于 IntersectionObserver 的滚动浮现动画，1-2 秒延迟 + 0.4s 间隔。
 * 实际使用中反馈存在视觉问题（中间蓝色渐变、节奏过慢），v3.3.6 起改为 passthrough。
 * 保留组件与 props 签名，仅去掉动画效果，避免 22 个调用方代码改动。
 */
export const FadeInSection: React.FC<FadeInSectionProps> = ({
  children,
  fullWidth = true,
  className = '',
  style,
}) => {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};

export default FadeInSection;
