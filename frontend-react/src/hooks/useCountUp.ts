/**
 * 数字增长动画 hook
 * 从 0 平滑增长到目标值，支持 prefix/suffix、小数、货币、百分比格式化
 */
import { useState, useEffect, useRef } from 'react';

export interface UseCountUpOptions {
  /** 动画时长（ms），默认 800 */
  duration?: number;
  /** 是否禁用动画 */
  disabled?: boolean;
  /** 保留小数位 */
  decimals?: number;
  /** 千分位分隔 */
  useGrouping?: boolean;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(
  target: number | undefined | null,
  options: UseCountUpOptions = {}
): number {
  const { duration = 1500, disabled = false, decimals = 0 } = options;
  const [displayValue, setDisplayValue] = useState(0);
  // prefers-reduced-motion 在 lazy initializer 中读取一次，避免在 effect 中同步 setState
  const [prefersReduced] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const targetRef = useRef(target ?? 0);

  useEffect(() => {
    // 跳过动画的情况在 render 阶段处理（见下方 skipAnimation），effect 直接返回
    if (disabled || prefersReduced || target === undefined || target === null || Number.isNaN(target)) {
      return;
    }

    fromRef.current = displayValue;
    targetRef.current = target;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = fromRef.current + (targetRef.current - fromRef.current) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, disabled, prefersReduced]);

  // 跳过动画时直接返回目标值（derived value），避免在 effect 中同步 setState
  const skipAnimation = disabled || prefersReduced ||
    target === undefined || target === null || Number.isNaN(target);
  const value = skipAnimation ? (target ?? 0) : displayValue;
  return Number(value.toFixed(decimals));
}

export default useCountUp;
