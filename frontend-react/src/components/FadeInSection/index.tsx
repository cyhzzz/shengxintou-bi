import React, { useRef, useState, useEffect } from 'react';
import styles from './FadeInSection.module.scss';

export interface FadeInSectionProps {
  children: React.ReactNode;
  /**
   * 延迟出现的秒数，默认 0
   * 在元素进入视口后才开始计时
   */
  delay?: number;
  /**
   * 动画持续秒数，默认 1（大容器适合 1~2 秒）
   */
  duration?: number;
  /**
   * 入场方向
   */
  direction?: 'up' | 'down' | 'left' | 'right';
  /**
   * 初始偏移像素，默认 16（过大易触发滚动条变化导致宽度跳变）
   */
  distance?: number;
  /**
   * 是否占满宽度
   */
  fullWidth?: boolean;
  /**
   * 一次性触发，默认 true（进入视口后动画不再回退）
   * false 时离开视口会重置，再次进入重播
   */
  once?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 大容器顺序浮现组件（v3.2.7 → v3.2.8 重构）
 *
 * 设计要点：
 * 1. 使用 IntersectionObserver 滚动触发，视口外的容器不开始动画
 *    —— 解决「页面所有大卡片同时浮现」的问题，真正实现从上到下依次浮现
 * 2. 进入视口后再按 delay 依次浮现，让节奏更自然
 * 3. 仅用 transform + opacity，GPU 友好；distance 默认 16px，避免过大偏移触发滚动条变化
 * 4. 支持 prefers-reduced-motion
 */
export const FadeInSection: React.FC<FadeInSectionProps> = ({
  children,
  delay = 0,
  duration = 1,
  direction = 'up',
  distance = 16,
  fullWidth = true,
  once = true,
  className = '',
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 支持 prefers-reduced-motion：直接显示
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      {
        // 进入视口 10% 即触发，提前一点启动动画让滚动更流畅
        threshold: 0.1,
        // rootMargin: '0px 0px -10% 0px', // 底部留点余量，让元素更靠近视口中央才触发
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  const getInitialTransform = () => {
    switch (direction) {
      case 'up':
        return `translateY(${distance}px)`;
      case 'down':
        return `translateY(-${distance}px)`;
      case 'left':
        return `translateX(${distance}px)`;
      case 'right':
        return `translateX(-${distance}px)`;
      default:
        return `translateY(${distance}px)`;
    }
  };

  return (
    <div
      ref={ref}
      className={`${styles.fadeInSection} ${fullWidth ? styles.fullWidth : ''} ${
        visible ? styles.visible : ''
      } ${className}`}
      style={{
        ['--reveal-delay' as string]: `${delay}s`,
        ['--reveal-duration' as string]: `${duration}s`,
        ['--reveal-translate' as string]: getInitialTransform(),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default FadeInSection;
