# 小红书运营分析页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的小红书运营分析页面迁移至React前端，实现7个子模块的完整功能

**Architecture:** React组件化架构，包含7个独立子模块，每个模块有独立筛选器和图表

**Tech Stack:** React 19, TypeScript 5, Ant Design, ECharts/@ant-design/charts, EventManager

---

## ⚠️ 关键迁移点

### 7个子模块列表

1. **TOP笔记榜** - 按曝光/互动/转化排名的笔记列表
2. **创作者年度报表** - 创作者年度数据汇总
3. **投放策略分析** - 不同投放策略的效果对比
4. **笔记类型分析** - 图文/视频笔记效果对比
5. **发布时间分析** - 不同发布时段效果分析
6. **互动趋势分析** - 点赞/评论/收藏/分享趋势
7. **转化漏斗分析** - 从曝光到开户的转化漏斗

### 独立日期筛选器

- `topNotesDateRange` - TOP笔记榜日期范围
- `creatorAnnualDateRange` - 创作者年度报表日期范围
- 其他模块使用全局日期范围

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 小红书运营分析API类型

export interface PostXhsNotesOperationAnalysisBody {
  start_date: string;
  end_date: string;
  analysis_type: 'top_notes' | 'creator_annual' | 'ad_strategy' | 'note_type' | 'publish_time' | 'interaction_trend' | 'conversion_funnel';
  metric?: string;
  limit?: number;
}

export interface XhsTopNote {
  note_id: string;
  note_title: string;
  creator_name: string;
  metric_value: number;
  rank: number;
}

export interface XhsCreatorAnnual {
  creator_name: string;
  note_count: number;
  total_impressions: number;
  total_interactions: number;
  total_leads: number;
  total_accounts: number;
}

export interface XhsOperationAnalysisResponse {
  top_notes?: XhsTopNote[];
  creator_annual?: XhsCreatorAnnual[];
  ad_strategy_analysis?: any[];
  note_type_analysis?: any[];
  publish_time_analysis?: any[];
  interaction_trend?: any;
  conversion_funnel?: any[];
}
```

---

## Task 2: 创建子模块组件

**Files:**
- Create: `src/pages/XhsNotes/Operation/components/TopNotesChart.tsx`
- Create: `src/pages/XhsNotes/Operation/components/CreatorAnnualTable.tsx`
- Create: `src/pages/XhsNotes/Operation/components/AdStrategyAnalysis.tsx`
- Create: `src/pages/XhsNotes/Operation/components/NoteTypeAnalysis.tsx`
- Create: `src/pages/XhsNotes/Operation/components/PublishTimeAnalysis.tsx`
- Create: `src/pages/XhsNotes/Operation/components/InteractionTrend.tsx`
- Create: `src/pages/XhsNotes/Operation/components/ConversionFunnelAnalysis.tsx`

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/XhsNotes/Operation/index.tsx`

```typescript
/**
 * 小红书运营分析页面
 * 包含7个子模块
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Tabs, Typography } from 'antd';
import TopNotesChart from './components/TopNotesChart';
import CreatorAnnualTable from './components/CreatorAnnualTable';
import AdStrategyAnalysis from './components/AdStrategyAnalysis';
import NoteTypeAnalysis from './components/NoteTypeAnalysis';
import PublishTimeAnalysis from './components/PublishTimeAnalysis';
import InteractionTrend from './components/InteractionTrend';
import ConversionFunnelAnalysis from './components/ConversionFunnelAnalysis';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const XhsNotesOperationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('top_notes');

  const tabItems = [
    { key: 'top_notes', label: 'TOP笔记榜', children: <TopNotesChart /> },
    { key: 'creator_annual', label: '创作者年度报表', children: <CreatorAnnualTable /> },
    { key: 'ad_strategy', label: '投放策略分析', children: <AdStrategyAnalysis /> },
    { key: 'note_type', label: '笔记类型分析', children: <NoteTypeAnalysis /> },
    { key: 'publish_time', label: '发布时间分析', children: <PublishTimeAnalysis /> },
    { key: 'interaction_trend', label: '互动趋势分析', children: <InteractionTrend /> },
    { key: 'conversion_funnel', label: '转化漏斗分析', children: <ConversionFunnelAnalysis /> },
  ];

  return (
    <div className={styles.operationPage}>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default XhsNotesOperationPage;
```

---

## Task 4: 事件管理器

**Files:**
- Create: `src/pages/XhsNotes/Operation/utils/EventManager.ts`

```typescript
/**
 * 事件管理器
 * 用于管理子模块的事件监听，防止内存泄漏
 */
export class EventManager {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  destroy() {
    this.listeners.clear();
  }
}
```

---

## Task 5: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import XhsNotesOperationPage from '@/pages/XhsNotes/Operation';

// 在小红书报表二级路由中添加
{
  path: '/xhs-notes/operation',
  element: <XhsNotesOperationPage />,
}
```

---

## 验收标准

- [ ] 7个子模块全部功能正常
- [ ] 独立日期筛选器正常工作
- [ ] 事件管理器无内存泄漏
- [ ] 响应式布局正常
- [ ] 无TypeScript编译错误

---

**最后更新**: 2026-03-13