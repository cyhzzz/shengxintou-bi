/**
 * ECharts React 封装组件
 * 支持自动 resize、主题切换、响应式更新
 */
import React, { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import { mergeChartTheme } from './themes';
import styles from './index.module.scss';

/** 简易 debounce */
function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export interface EChartsProps {
  /** ECharts 原生配置 */
  option: EChartsOption;
  /** 图表高度，默认 300px */
  height?: number;
  /** 加载状态 */
  loading?: boolean;
  /** 自动调整大小，默认 true */
  autoResize?: boolean;
  /** 主题：light/dark，不传则跟随 data-theme 属性 */
  theme?: 'light' | 'dark';
  /** 图表初始化完成回调 */
  onChartReady?: (chart: ECharts) => void;
  /** 容器样式 */
  style?: React.CSSProperties;
  /** 容器类名 */
  className?: string;
  /** 是否禁用入场动画（如导出海报） */
  disableAnimation?: boolean;
}

const EChartsComponent: React.FC<EChartsProps> = ({
  option,
  height = 300,
  loading = false,
  autoResize = true,
  theme,
  onChartReady,
  style,
  className,
  disableAnimation = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 获取当前主题
  const getCurrentTheme = useCallback((): 'light' | 'dark' => {
    if (theme) return theme;
    // 跟随 data-theme 属性
    const dataTheme = document.documentElement.getAttribute('data-theme');
    if (dataTheme === 'dark') return 'dark';
    return 'light';
  }, [theme]);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    // 销毁旧实例
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }

    // 创建新实例
    chartRef.current = echarts.init(containerRef.current);

    // 回调通知
    if (onChartReady && chartRef.current) {
      onChartReady(chartRef.current);
    }

    // 清理函数
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []); // 仅初始化一次

  // 更新配置
  useEffect(() => {
    if (!chartRef.current || !option) return;

    // 合并主题配置
    const currentTheme = getCurrentTheme();
    const mergedOption = mergeChartTheme(option, currentTheme);

    // v3.2.5：让线/柱缓慢绘制出现（非整图淡入）
    // - 折线图默认入场动画是 clip：clipRect 从左到右展开，线被逐渐"绘制"出来
    // - 柱状图默认入场动画是 scaleY：柱子从底部往上生长
    // - 只设置 option 级别的 animationDuration，不在 series 级别覆盖，让 ECharts 用默认入场动画类型
    // - 多 series 用短 stagger（idx * 60ms），避免最后一个等太久
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!disableAnimation && !prefersReduced) {
      (mergedOption as any).animation = true;
      (mergedOption as any).animationDuration = 1500;
      (mergedOption as any).animationDurationUpdate = 800;
      (mergedOption as any).animationEasing = 'cubicOut';
      (mergedOption as any).animationEasingUpdate = 'cubicOut';

      // series 级别只设置 stagger delay，不覆盖 animationDuration
      // 这样 ECharts 会用默认的入场动画类型（line: clip, bar: scaleY）
      const series = (mergedOption as any).series;
      if (Array.isArray(series)) {
        (mergedOption as any).series = series.map((s, idx) => ({
          ...s,
          animation: true,
          animationDelay: idx * 60,
          animationDelayUpdate: idx * 60,
        }));
      }
    } else {
      (mergedOption as any).animation = false;
    }

    // notMerge: true 确保每次 setOption 都触发完整入场动画（线/柱重新绘制）
    chartRef.current.setOption(mergedOption, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [option, getCurrentTheme]);

  // 自动 resize（v3.2.5：debounce 100ms，避免连续触发重绘）
  useEffect(() => {
    if (!autoResize || !containerRef.current) return;

    const debouncedResize = debounce(() => {
      chartRef.current?.resize();
    }, 100);

    resizeObserverRef.current = new ResizeObserver(debouncedResize);
    resizeObserverRef.current.observe(containerRef.current);

    const handleWindowResize = () => debouncedResize();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [autoResize]);

  // 监听主题变化（data-theme 属性变化）
  useEffect(() => {
    if (theme) return; // 如果手动指定了主题，不需要监听

    const observer = new MutationObserver(() => {
      if (!chartRef.current || !option) return;
      const currentTheme = getCurrentTheme();
      const mergedOption = mergeChartTheme(option, currentTheme);
      chartRef.current.setOption(mergedOption, { notMerge: true });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, [option, theme, getCurrentTheme]);

  // 监听主题变化时强制全量刷新（notMerge），普通数据更新走 merge 以提升性能
  useEffect(() => {
    if (!chartRef.current || !option) return;
    // 仅当 theme  prop 变化时强制刷新；data-theme 监听已在上一个 effect 处理
    const mergedOption = mergeChartTheme(option, getCurrentTheme());
    chartRef.current.setOption(mergedOption, { notMerge: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
      style={{ height, ...style }}
    >
      {loading && (
        <div className={styles.skeletonOverlay}>
          <div className={styles.skeletonShimmer} />
        </div>
      )}
    </div>
  );
};

export default EChartsComponent;
