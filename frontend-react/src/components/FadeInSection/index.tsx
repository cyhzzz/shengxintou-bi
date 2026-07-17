import React from 'react';
import styles from './FadeInSection.module.scss';

export interface FadeInSectionProps {
  children: React.ReactNode;
  /**
   * 延迟出现的秒数，默认 0
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
   * 初始偏移像素
   */
  distance?: number;
  /**
   * 是否占满宽度
   */
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 大容器顺序浮现组件（v3.2.7）
 * - 用于包裹整张报表的「指标卡组 / 图表区 / 表格区」等大模块
 * - 通过 delay 形成从上到下、从左到右的层次浮现
 * - 仅使用 transform + opacity，GPU 友好
 */
export const FadeInSection: React.FC<FadeInSectionProps> = ({
  children,
  delay = 0,
  duration = 1,
  direction = 'up',
  distance = 20,
  fullWidth = true,
  className = '',
  style,
}) => {
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
      className={`${styles.fadeInSection} ${fullWidth ? styles.fullWidth : ''} ${className}`}
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
