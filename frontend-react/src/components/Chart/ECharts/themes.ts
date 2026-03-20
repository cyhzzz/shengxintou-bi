/**
 * ECharts 主题配置
 * 从旧前端 chartHelper.js 迁移
 */

// 平台颜色配置 - 与旧前端 AgencyAnalysisReport.js 完全一致
export const PLATFORM_COLORS: Record<string, string> = {
  '腾讯': '#52c41a',    // 绿色
  '小红书': '#f5222d',  // 红色
  '抖音': '#722ed1',    // 紫色
  '云极': '#D4A574',    // 棕色
  'YJ': '#D4A574',      // 棕色
  '高德': '#1890ff',    // 蓝色
};

// 业务模式颜色配置
export const BUSINESS_MODEL_COLORS: Record<string, string> = {
  '直播': '#52c41a',
  '信息流': '#faad14',
  '搜索': '#722ed1',
};

// 亮色主题配置
const LIGHT_THEME = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#333',
  },
  title: {
    textStyle: {
      color: '#333',
    },
  },
  legend: {
    textStyle: {
      color: '#333',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#eee',
    borderWidth: 1,
    textStyle: {
      color: '#333',
    },
  },
  axisPointer: {
    lineStyle: {
      color: '#999',
    },
    crossStyle: {
      color: '#999',
    },
  },
  // 坐标轴
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#ddd',
      },
    },
    axisLabel: {
      color: '#666',
    },
    splitLine: {
      lineStyle: {
        color: '#eee',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#ddd',
      },
    },
    axisLabel: {
      color: '#666',
    },
    splitLine: {
      lineStyle: {
        color: '#eee',
      },
    },
  },
};

// 暗色主题配置
const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#fff',
  },
  title: {
    textStyle: {
      color: '#fff',
    },
  },
  legend: {
    textStyle: {
      color: '#fff',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderColor: '#444',
    borderWidth: 1,
    textStyle: {
      color: '#fff',
    },
  },
  axisPointer: {
    lineStyle: {
      color: '#999',
    },
    crossStyle: {
      color: '#999',
    },
  },
  // 坐标轴
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#444',
      },
    },
    axisLabel: {
      color: '#aaa',
    },
    splitLine: {
      lineStyle: {
        color: '#333',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#444',
      },
    },
    axisLabel: {
      color: '#aaa',
    },
    splitLine: {
      lineStyle: {
        color: '#333',
      },
    },
  },
};

/**
 * 合并主题配置到图表 option
 */
export function mergeChartTheme(
  option: Record<string, unknown>,
  theme: 'light' | 'dark'
): Record<string, unknown> {
  const themeConfig = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

  // 深度合并（简单实现，仅处理一级嵌套）
  const merged: Record<string, unknown> = { ...option };

  Object.keys(themeConfig).forEach((key) => {
    const themeVal = themeConfig[key as keyof typeof themeConfig];
    if (merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key]) && typeof themeVal === 'object') {
      merged[key] = {
        ...themeVal,
        ...(merged[key] as Record<string, unknown>),
      };
    } else if (!merged[key]) {
      merged[key] = themeVal;
    }
  });

  return merged;
}

export { LIGHT_THEME, DARK_THEME };