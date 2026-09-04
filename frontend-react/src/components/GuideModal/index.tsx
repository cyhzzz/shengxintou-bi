/**
 * Markdown 指南弹窗组件
 * v3.2.3：放弃 fetch 后端 markdown 文档（路径/格式/兜底易踩坑），改为内置 GUIDE_CONTENTS 直接渲染
 * 保留 remark-gfm 表格支持 + rehype-sanitize XSS 兜底
 */
import React from 'react';
import { Modal, Empty } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import styles from './index.module.scss';

interface GuideModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 指南文件名（不含路径，作为 GUIDE_CONTENTS 的 key） */
  guideFile: string;
  /** 弹窗标题 */
  title?: string;
}

// 指南标题映射（v2 - 6 个新数据类型 + 7 个旧 v1 类型保留兜底）
const GUIDE_TITLES: Record<string, string> = {
  // v2 新数据类型
  'account_mapping_guide.md': '投放账号映射导入指南',
  'conversion_content_guide.md': '内容平台加微链路导入指南',
  'conversion_appmarket_guide.md': '应用市场下载链路导入指南',
  'vendor_daily_guide.md': '厂商广告投放分析导入指南',
  'xhs_note_guide.md': '小红书笔记导入指南',
  'channel_open_guide.md': '开户渠道分析导入指南',
  'appmarket_plan_class_guide.md': '应用市场计划分解导入指南',
  'plan_daily_guide.md': '广告计划维度明细导入指南',
  // 旧 v1 类型（已 410 Gone，保留映射防止老用户点老入口炸）
  'tencent_ads_guide.md': '腾讯广告数据导入指南（已下线）',
  'douyin_ads_guide.md': '抖音广告数据导入指南（已下线）',
  'xiaohongshu_ads_guide.md': '小红书广告数据导入指南（已下线）',
  'xhs_notes_list_guide.md': '小红书笔记列表导入指南（已下线）',
  'xhs_notes_daily_guide.md': '小红书笔记投放数据导入指南（已下线）',
  'xhs_notes_content_guide.md': '小红书笔记运营数据导入指南（已下线）',
  'backend_conversion_guide.md': '后端转化数据导入指南（已下线）',
};

// 内置指南内容（v3.2.3：直接硬编码，避免后端文档加载失败）
const GUIDE_CONTENTS: Record<string, string> = {
  'account_mapping_guide.md': `# 投放账号映射导入指南

## 数据来源
**统一报表平台 → 省心投 → 1000.7广告代理商映射表数据查询**

直接从上述源表原样导出 Excel 上传即可。
`,

  'conversion_content_guide.md': `# 内容平台加微链路导入指南

## 数据来源
**统一报表平台 → 省心投 → 4线索明细表**

直接从上述源表原样导出 Excel 上传即可。
`,

  'conversion_appmarket_guide.md': `# 应用市场下载链路导入指南

## 数据来源
**统一报表平台 → 省心投 → 8.1应用市场归因明细表**

直接从上述源表原样导出 Excel 上传即可。
`,

  'vendor_daily_guide.md': `# 厂商广告投放分析导入指南

## 数据来源
**统一报表平台 → 省心投 → 9.2厂商广告投放分析**

直接从上述源表原样导出 Excel 上传即可。
`,

  'xhs_note_guide.md': `# 小红书笔记导入指南

## 数据来源
**统一报表平台 → 省心投 → 6.1小红书笔记表**

直接从上述源表原样导出 Excel 上传即可。
`,

  'channel_open_guide.md': `# 开户渠道分析导入指南

## 数据来源
**统一报表平台 → 省心投 → 0.1开户渠道分析明细**

直接从上述源表原样导出 Excel 上传即可。
`,

  'appmarket_plan_class_guide.md': `# 应用市场计划分解导入指南

## 数据来源
**由运营人员手动维护**（非统一报表平台导出，需人工整理广告分组与版位/子版位/出价的对齐）

广告分组按 应用市场 / 版位 / 子版位 / 出价 分类的映射维度表，关联下载链路 fact_conv_appmarket.广告计划ID 拆解获客贡献。原样覆盖写入（replace）。

### 表头（按列名匹配，顺序不强制）

| 列名 | 说明 |
| --- | --- |
| 应用市场 | 所属应用市场（OPPO/VIVO 大写落库转小写 oppo/vivo） |
| 广告分组ID | 广告分组唯一 ID（关联下载链路 广告计划ID） |
| 广告分组名称 | 分组名称 |
| 版位 | 投放版位（如 搜索 / 推荐） |
| 子版位 | 子版位（如 品牌词 / 竞品词） |
| 出价 | 出价方式（如 ocpd付费 / 开始开户） |

仅保留 7 大应用市场（oppo / vivo / 荣耀 / 小米 / 华为 / 鸿蒙 / 苹果），覆盖写入整表。
`,

  'plan_daily_guide.md': `# 广告计划维度明细导入指南

## 数据来源
**统一报表平台 → 省心投 → 9.3 厂商广告计划维度明细**

全互联网渠道计划级日维度（含应用市场 oppo/vivo/荣耀/小米/华为/鸿蒙/苹果 与 小红书等内容平台）。提供计划级 消耗/展示/点击/下载 指标。应用市场侧 计划ID 与「应用市场计划分解」的 广告分组ID 关联；内容平台侧与企微明细的 广告ID 关联。原样覆盖写入（replace）。

### 表头（按列名匹配，顺序不强制）

| 列名 | 说明 |
| --- | --- |
| 日期 | 投放日期（YYYY-MM-DD） |
| 平台 | 投放渠道（OPPO/VIVO 大写落库转小写 oppo/vivo；小红书等中文原样） |
| 厂商名称 | 投放厂商 |
| 业务模式 | 业务模式（如 APP下载） |
| 计划ID | 计划唯一 ID |
| 计划名称 | 计划名称 |
| 关键词ID / 关键词名称 | 关键词维度 |
| 展示量 / 点击量 / 下载量 | 投放次数 |
| 花费 | 消耗金额 |

覆盖写入整表（全渠道，不做平台过滤）。
`,
};

const GuideModal: React.FC<GuideModalProps> = ({
  open,
  onClose,
  guideFile,
  title,
}) => {
  const modalTitle = title || GUIDE_TITLES[guideFile] || '导入指南';
  const content = GUIDE_CONTENTS[guideFile] || '';

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      className={styles.guideModal}
      centered
    >
      {content ? (
        <div className={styles.markdownBody}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <Empty description="暂无导入指南" />
      )}
    </Modal>
  );
};

export default GuideModal;
