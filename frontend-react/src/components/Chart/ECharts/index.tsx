/**
 * ECharts React 封装组件
 * 支持自动 resize、主题切换、响应式更新
 */
import React, { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import { Spin } from 'antd';
import { mergeChartTheme } from './themes';
import styles from './index.module.scss';

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 获取当前主题
  const getCurrentTheme = useCallback((): 'light' | 'dark' => {
    if (theme) return theme;
    // 跟随 data-theme 属性
    const dataTheme = document.body.getAttribute('data-theme');
    if (dataTheme === 'dark') return 'dark';
    return 'light';
  }, [theme]);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) {
      console.log('[EChartsComponent] containerRef.current is null, cannot init');
      return;
    }

    console.log('[EChartsComponent] Initializing chart, container:', {
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
    });

    // 销毁旧实例
    if (chartRef.current) {
      console.log('[EChartsComponent] Disposing old chart instance');
      chartRef.current.dispose();
      chartRef.current = null;
    }

    // 创建新实例
    chartRef.current = echarts.init(containerRef.current);
    console.log('[ChartsComponent] Chart initialized successfully');

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
    if (!chartRef.current) {
      console.log('[EChartsComponent] chartRef.current is null, skipping setOption');
      return;
    }
    if (!option) {
      console.log('[EChartsComponent] option is empty, skipping setOption');
      return;
    }

    console.log('[EChartsComponent] Updating option:', {
      hasOption: !!option,
      optionKeys: Object.keys(option as object),
      seriesCount: (option as any)?.series?.length,
    });

    // 合并主题配置
    const currentTheme = getCurrentTheme();
    const mergedOption = mergeChartTheme(option, currentTheme);

    console.log('[EChartsComponent] Merged option, setting on chart');
    chartRef.current.setOption(mergedOption, {
      notMerge: true,  // 不合并，完全替换
    });
  }, [option, getCurrentTheme]);

  // 自动 resize
  useEffect(() => {
    if (!autoResize || !containerRef.current) return;

    // ResizeObserver 监听容器变化
    resizeObserverRef.current = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserverRef.current.observe(containerRef.current);

    // 窗口 resize 备用
    const handleWindowResize = () => {
      chartRef.current?.resize();
    };
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

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [option, theme, getCurrentTheme]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
      style={{ height, ...style }}
    >
      {loading && (
        <div className={styles.loadingOverlay}>
          <Spin />
        </div>
      )}
    </div>
  );
};

export default EChartsComponent;