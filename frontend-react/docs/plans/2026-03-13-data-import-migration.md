# 系统配置-数据导入页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的数据导入页面迁移至React前端，实现文件拖拽上传、多种数据类型导入、进度显示

**Architecture:** React组件化架构，使用Ant Design Upload组件，支持拖拽上传、进度条、导入结果展示

**Tech Stack:** React 19, TypeScript 5, Ant Design (Upload, Progress, Modal, Alert), SCSS Modules

---

## ⚠️ 关键迁移点

### 支持的数据类型

| 数据类型 | 说明 | 目标表 |
|---------|------|--------|
| `tencent_ads` | 腾讯广告数据 | raw_ad_data_tencent |
| `douyin_ads` | 抖音广告数据 | raw_ad_data_douyin |
| `xiaohongshu_ads` | 小红书广告数据 | raw_ad_data_xiaohongshu |
| `xhs_notes_list` | 小红书笔记列表 | xhs_note_info |
| `xhs_notes_daily` | 小红书笔记投放数据 | xhs_notes_daily |
| `xhs_notes_content` | 小红书笔记运营数据 | xhs_notes_content_daily |
| `conversion` | 后端转化数据 | backend_conversions |

### 文件上传特性

- 支持格式：.xlsx, .xls, .csv
- 支持拖拽上传
- 显示上传进度
- 显示导入结果（成功/失败行数）
- 支持覆盖模式

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 数据导入API类型

export type DataType =
  | 'tencent_ads'
  | 'douyin_ads'
  | 'xiaohongshu_ads'
  | 'xhs_notes_list'
  | 'xhs_notes_daily'
  | 'xhs_notes_content'
  | 'conversion';

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    total_rows: number;
    success_count: number;
    failed_count: number;
    failed_rows: number[];
    errors: string[];
  };
}

export interface DataTypeInfo {
  type: DataType;
  label: string;
  description: string;
  requiredFields: string[];
  documentLink: string;
}

export const DATA_TYPES: DataTypeInfo[] = [
  {
    type: 'tencent_ads',
    label: '腾讯广告数据',
    description: '腾讯广告平台投放数据',
    requiredFields: ['日期', '账户ID', '花费', '曝光量', '点击量'],
    documentLink: '/docs/tencent_ads_import.md',
  },
  {
    type: 'douyin_ads',
    label: '抖音广告数据',
    description: '抖音广告平台投放数据',
    requiredFields: ['日期', '账户ID', '消耗', '展示数', '点击数'],
    documentLink: '/docs/douyin_ads_import.md',
  },
  {
    type: 'xiaohongshu_ads',
    label: '小红书广告数据',
    description: '小红书广告平台投放数据',
    requiredFields: ['周期', '广告主账户ID', '总消耗', '总展现', '总点击'],
    documentLink: '/docs/xiaohongshu_ads_import.md',
  },
  {
    type: 'xhs_notes_list',
    label: '小红书笔记列表',
    description: '小红书笔记基础信息',
    requiredFields: ['笔记ID', '笔记标题'],
    documentLink: '/docs/xhs_notes_list_import.md',
  },
  {
    type: 'xhs_notes_daily',
    label: '小红书笔记投放数据',
    description: '小红书笔记日级投放数据',
    requiredFields: ['日期', '笔记ID', '消耗'],
    documentLink: '/docs/xhs_notes_daily_import.md',
  },
  {
    type: 'xhs_notes_content',
    label: '小红书笔记运营数据',
    description: '小红书笔记日级运营数据',
    requiredFields: ['数据日期', '笔记ID'],
    documentLink: '/docs/xhs_notes_content_import.md',
  },
  {
    type: 'conversion',
    label: '后端转化数据',
    description: '客户转化明细数据',
    requiredFields: ['线索日期'],
    documentLink: '/docs/conversion_import.md',
  },
];
```

---

## Task 2: 创建数据导入组件

**Files:**
- Create: `src/pages/System/DataImport/components/FileUploader.tsx`
- Create: `src/pages/System/DataImport/components/DataTypeSelector.tsx`
- Create: `src/pages/System/DataImport/components/ImportResult.tsx`

```typescript
// FileUploader.tsx
import React, { useState } from 'react';
import { Upload, message, Progress, Switch, Space, Alert } from 'antd';
import { InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { DataType, UploadResponse } from '@/types/api.schemas';
import styles from './FileUploader.module.scss';

const { Dragger } = Upload;

interface FileUploaderProps {
  dataType: DataType;
  onImportSuccess: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ dataType, onImportSuccess }) => {
  const [overwrite, setOverwrite] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async (options) => {
      const { file } = options;
      setUploading(true);
      setProgress(0);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('data_type', dataType);
      formData.append('auto_process', 'true');
      formData.append('overwrite', String(overwrite));

      try {
        // 模拟进度
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch('/api/v1/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);

        const data: UploadResponse = await response.json();
        setResult(data);

        if (data.success) {
          message.success(`导入成功！共 ${data.data.success_count} 条数据`);
          onImportSuccess();
        } else {
          message.error(data.message || '导入失败');
        }
      } catch (err) {
        message.error('上传失败，请检查网络');
      } finally {
        setUploading(false);
      }
    },
  };

  return (
    <div className={styles.uploader}>
      <div className={styles.options}>
        <Space>
          <span>覆盖模式:</span>
          <Switch checked={overwrite} onChange={setOverwrite} />
          <span className={styles.hint}>开启后将删除已有数据再导入</span>
        </Space>
      </div>

      <Dragger {...uploadProps} disabled={uploading} className={styles.dragger}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
      </Dragger>

      {uploading && (
        <div className={styles.progress}>
          <Progress percent={progress} status="active" />
        </div>
      )}

      {result && (
        <ImportResult result={result} />
      )}
    </div>
  );
};

export default FileUploader;
```

---

## Task 3: 创建主页面

**Files:**
- Create: `src/pages/System/DataImport/index.tsx`

```typescript
/**
 * 数据导入页面
 */
import React, { useState } from 'react';
import { Card, Row, Col, Typography, Alert, Collapse } from 'antd';
import DataTypeSelector from './components/DataTypeSelector';
import FileUploader from './components/FileUploader';
import { DATA_TYPES, type DataType } from '@/types/api.schemas';
import styles from './index.module.scss';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const DataImportPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<DataType>('tencent_ads');

  const selectedTypeInfo = DATA_TYPES.find((t) => t.type === selectedType);

  const handleImportSuccess = () => {
    // 刷新页面数据或触发其他操作
  };

  return (
    <div className={styles.dataImportPage}>
      <Title level={3}>数据导入</Title>

      <Alert
        message="导入须知"
        description="请确保上传的文件格式正确，第一行为表头。大数据量导入可能需要较长时间，请耐心等待。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card className={styles.selectorCard}>
            <Title level={4}>选择数据类型</Title>
            <DataTypeSelector
              selected={selectedType}
              onChange={setSelectedType}
            />
          </Card>

          <Card className={styles.guideCard}>
            <Title level={4}>导入指南</Title>
            <Collapse accordion>
              {DATA_TYPES.map((type) => (
                <Panel header={type.label} key={type.type}>
                  <Paragraph>{type.description}</Paragraph>
                  <Paragraph>
                    <Text strong>必需字段：</Text>
                    {type.requiredFields.join('、')}
                  </Paragraph>
                </Panel>
              ))}
            </Collapse>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className={styles.uploadCard}>
            <Title level={4}>
              上传文件 - {selectedTypeInfo?.label}
            </Title>
            <FileUploader
              dataType={selectedType}
              onImportSuccess={handleImportSuccess}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DataImportPage;
```

---

## Task 4: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import DataImportPage from '@/pages/System/DataImport';

{
  path: '/system/data-import',
  element: <DataImportPage />,
}
```

---

## 验收标准

- [ ] 7种数据类型全部支持
- [ ] 拖拽上传功能正常
- [ ] 进度条显示正确
- [ ] 导入结果展示正确
- [ ] 覆盖模式开关正常
- [ ] 响应式布局正常

---

**最后更新**: 2026-03-13