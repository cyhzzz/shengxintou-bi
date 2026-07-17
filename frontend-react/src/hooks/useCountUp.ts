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
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const targetRef = useRef(target ?? 0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (disabled || prefersReduced || target === undefined || target === null || Number.isNaN(target)) {
      setDisplayValue(target ?? 0);
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
  }, [target, duration, disabled]);

  return Number(displayValue.toFixed(decimals));
}

export default useCountUp;
