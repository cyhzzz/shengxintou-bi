/**
 * AI 分析报告（智能分析，v4.2.0；v4.2.0 菜单更名并移至「报告生成」下方）
 *
 * 数据源: POST /api/v1/reports/llm-analysis（手动触发）。
 * 取数: 目标月 + 前 3 个月的智能诊断信号（backend/utils/diagnosis 规则引擎），
 *   使用内置 prompt（强制含「跨月趋势对比」章节）交由 OpenAI 协议 LLM 生成 Markdown 分析。
 * LLM Provider 在「LLM 配置」弹窗配置（存后端 USER_DATA_DIR/llm_config.json 本机文件）。
 * 结果按（信号哈希 + 模型 + prompt 版本）缓存，信号未变时秒回；「重新生成」强制绕过缓存。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Empty, Popconfirm, Space, Spin, Tag } from 'antd';
import { SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { FadeInSection } from '@/components';
import { ReportFooter } from '@/components/ReportFooter';
import { dataServiceLlm } from '@/services/dataService';
import type { LlmAnalysisResult } from '@/services/dataService';
import LlmConfigModal from './LlmConfigModal';
import styles from './index.module.scss';

const IntelligentAnalysisPage: React.FC = () => {
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [result, setResult] = useState<LlmAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dataServiceLlm.getConfig().then((res) => {
      if (res?.success && res.data) setConfigured(!!res.data.configured);
    });
  }, []);

  const runAnalysis = useCallback(
    async (m: Dayjs | null, force = false) => {
      setLoading(true);
      try {
        const res = await dataServiceLlm.runAnalysis({
          ...(m ? { month: m.format('YYYY-MM') } : {}),
          ...(force ? { force: true } : {}),
        });
        if (res?.success && res.data) {
          setResult(res.data);
          setConfigured(true);
        } else {
          message.error(res?.message || '分析失败');
          if (res?.error === 'LLM_NOT_CONFIGURED') {
            setConfigured(false);
            setConfigOpen(true);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  return (
    <div className={styles.page}>
      <Card size="small" className={styles.filterCard}>
        <Space size="middle" wrap>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>分析月份:</span>
            <DatePicker
              picker="month"
              value={month}
              allowClear
              placeholder="缺省取库内最新月份"
              onChange={(v) => setMonth(v)}
            />
          </div>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={() => runAnalysis(month)}
          >
            生成分析
          </Button>
          {result && (
            <Popconfirm
              title="重新生成将忽略缓存并重新调用 LLM，确认继续？"
              okText="重新生成"
              cancelText="取消"
              onConfirm={() => runAnalysis(month, true)}
            >
              <Button loading={loading}>重新生成</Button>
            </Popconfirm>
          )}
          <Button icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>
            LLM 配置
          </Button>
          {configured === true && <Tag color="green">LLM 已配置</Tag>}
          {configured === false && <Tag color="red">LLM 未配置</Tag>}
        </Space>
      </Card>

      {configured === false && (
        <Alert
          className={styles.alert}
          type="warning"
          showIcon
          message="尚未配置 LLM Provider"
          description="点击「LLM 配置」填写 OpenAI 协议参数（Base URL / API Key / 模型名称），配置仅保存在本机用户数据目录。"
          action={
            <Button type="primary" size="small" onClick={() => setConfigOpen(true)}>
              立即配置
            </Button>
          }
        />
      )}

      <Spin spinning={loading} tip="LLM 生成中：基于近 4 个月诊断信号分析，通常需要数十秒...">
        {result ? (
          <FadeInSection>
            <Card
              size="small"
              className={styles.resultCard}
              title={`AI 分析报告 · ${result.months_used?.[result.months_used.length - 1] || ''}`}
            >
              <div className={styles.metaBar}>
                {result.cached ? <Tag color="blue">缓存命中</Tag> : <Tag color="processing">新生成</Tag>}
                <span className={styles.metaText}>模型：{result.model}</span>
                <span className={styles.metaText}>趋势窗口：{result.months_used?.join(' → ')}</span>
                <span className={styles.metaText}>生成时间：{result.generated_at}</span>
              </div>
              <div className={styles.markdown}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {result.content}
                </ReactMarkdown>
              </div>
            </Card>
          </FadeInSection>
        ) : (
          !loading && (
            <Card size="small" className={styles.resultCard}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    选择月份后点击「生成分析」：系统将对目标月及前 3 个月的智能诊断信号运行内置
                    prompt，由配置好的 LLM 输出含「跨月趋势对比」章节的 Markdown 分析报告
                  </span>
                }
              />
            </Card>
          )
        )}
      </Spin>

      <ReportFooter
        sources={[
          { label: '数据接口', value: 'POST /api/v1/reports/llm-analysis（手动触发，body: {month?, force?}）' },
          { label: 'LLM 配置', value: 'PUT /api/v1/system/llm-config（OpenAI 协议，存本机 USER_DATA_DIR/llm_config.json，api_key 脱敏）' },
          { label: '分析取数', value: '目标月 + 前 3 个月的智能诊断信号（backend/utils/diagnosis），无信号月份自动剔除' },
          { label: '输出口径', value: '内置 prompt 强制含「跨月趋势对比」章节；结果按（信号哈希 + 模型 + prompt 版本）缓存于本机 llm_analysis_cache' },
        ]}
      />

      <LlmConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={(ok) => setConfigured(ok)}
      />
    </div>
  );
};

export default IntelligentAnalysisPage;
