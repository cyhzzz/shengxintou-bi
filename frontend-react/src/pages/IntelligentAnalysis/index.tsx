/**
 * AI 分析报告（智能分析，v4.2.0；v4.2.8 改为流式输出）
 *
 * 数据源: POST /api/v1/reports/llm-analysis/stream（SSE 流式；移动端/PWA 经
 *   services/llmStream.ts 直连本地 handler 流式，非流式端点保留兼容）。
 * 取数: 目标月 + 前 3 个月的智能诊断信号（backend/utils/diagnosis 规则引擎）
 *   + business 业务证据三包，使用内置 prompt 交由 OpenAI 协议 LLM 生成 Markdown 分析。
 * LLM Provider 在「LLM 配置」弹窗配置（桌面存 USER_DATA_DIR，移动端存本机 localStorage）。
 * 体验（v4.2.8）：取数 → LLM 生成两阶段提示；meta 事件先回证据包（生成期间即可核验），
 *   delta 事件增量渲染 Markdown 并显示已耗时；Android CapacitorHttp 缓冲为整包到达
 *   （显示阶段进度 + 计时，结束时一次性渲染）；超时必然触发（不再无限转圈）。
 * 结果按（信号哈希 + 模型 + prompt 版本）缓存，信号未变时秒回；「重新生成」强制绕过缓存。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Empty, Popconfirm, Space, Spin, Tag, Typography } from 'antd';
import { SettingOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { FadeInSection } from '@/components';
import { ReportFooter } from '@/components/ReportFooter';
import { dataServiceLlm } from '@/services/dataService';
import type { LlmEvidence } from '@/services/dataService';
import { streamLlmAnalysis } from '@/services/llmStream';
import EvidenceCards from './EvidenceCards';
import LlmConfigModal from './LlmConfigModal';
import styles from './index.module.scss';

interface StreamMeta {
  months_used: string[];
  model: string;
  cached: boolean;
  evidence?: LlmEvidence;
  generated_at?: string;
}

type Phase = 'idle' | 'collecting' | 'generating';

const IntelligentAnalysisPage: React.FC = () => {
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [meta, setMeta] = useState<StreamMeta | null>(null);
  const [content, setContent] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const loading = phase !== 'idle';

  useEffect(() => {
    dataServiceLlm.getConfig().then((res) => {
      if (res?.success && res.data) setConfigured(!!res.data.configured);
    });
  }, []);

  // 生成阶段计时（秒）：直观区分「取数慢」还是「LLM 生成慢」
  useEffect(() => {
    if (phase !== 'generating') return;
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const stopGeneration = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setPhase('idle');
  }, []);

  const runAnalysis = useCallback(
    async (m: Dayjs | null, force = false) => {
      cancelledRef.current = false;
      setPhase('collecting');
      setElapsed(0);
      setMeta(null);
      setContent('');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamLlmAnalysis(
          {
            ...(m ? { month: m.format('YYYY-MM') } : {}),
            ...(force ? { force: true } : {}),
          },
          (evt) => {
            if (cancelledRef.current) return;
            if (evt.type === 'meta') {
              setMeta({ months_used: evt.months_used, model: evt.model, cached: evt.cached, evidence: evt.evidence });
              setPhase('generating');
              setConfigured(true);
            } else if (evt.type === 'delta') {
              setContent((prev) => prev + evt.text);
            } else if (evt.type === 'done') {
              setMeta((prev) => (prev ? { ...prev, generated_at: evt.generated_at } : prev));
            }
          },
          controller.signal,
        );
        if (!cancelledRef.current) setPhase('idle');
      } catch (e) {
        if (cancelledRef.current) return;
        const msg = e instanceof Error ? e.message : '分析失败';
        message.error(msg);
        if (msg.includes('尚未配置 LLM')) {
          setConfigured(false);
          setConfigOpen(true);
        }
        // 保留已流出的部分内容供人工查看，仅结束转圈
        setPhase('idle');
      }
    },
    [message],
  );

  const showResult = !!meta || !!content;

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
            loading={phase === 'collecting'}
            disabled={loading && phase !== 'collecting'}
            onClick={() => runAnalysis(month)}
          >
            生成分析
          </Button>
          {showResult && (
            <Popconfirm
              title="重新生成将忽略缓存并重新调用 LLM，确认继续？"
              okText="重新生成"
              cancelText="取消"
              onConfirm={() => runAnalysis(month, true)}
            >
              <Button disabled={loading}>重新生成</Button>
            </Popconfirm>
          )}
          {phase === 'generating' && (
            <Button icon={<StopOutlined />} onClick={stopGeneration}>
              停止等待
            </Button>
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
          description="点击「LLM 配置」填写 OpenAI 协议参数（Base URL / API Key / 模型名称），配置仅保存在本机。"
          action={
            <Button type="primary" size="small" onClick={() => setConfigOpen(true)}>
              立即配置
            </Button>
          }
        />
      )}

      {phase === 'collecting' && !showResult && (
        <Card size="small" className={styles.resultCard}>
          <Spin tip="正在汇总近 4 个月诊断信号与业务证据（本地查询，通常数秒）...">
            <div style={{ minHeight: 120 }} />
          </Spin>
        </Card>
      )}

      {showResult && (
        <FadeInSection>
          <Card
            size="small"
            className={styles.resultCard}
            title={`AI 分析报告 · ${meta?.months_used?.[meta.months_used.length - 1] || ''}`}
          >
            <div className={styles.metaBar}>
              {meta?.cached ? <Tag color="blue">缓存命中</Tag> : <Tag color="processing">新生成</Tag>}
              {meta?.model && <span className={styles.metaText}>模型：{meta.model}</span>}
              {meta?.months_used && <span className={styles.metaText}>趋势窗口：{meta.months_used.join(' → ')}</span>}
              {meta?.generated_at && <span className={styles.metaText}>生成时间：{meta.generated_at}</span>}
            </div>
            {phase === 'generating' && (
              <div className={styles.generatingBar}>
                <Typography.Text type="secondary">
                  LLM 生成中：流式输出，已耗时 {elapsed} 秒（安卓端整包返回，结束前仅有计时）...
                </Typography.Text>
              </div>
            )}
            {meta?.evidence && <EvidenceCards evidence={meta.evidence} />}
            <div className={styles.markdown}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {content + (phase === 'generating' ? ' ▌' : '')}
              </ReactMarkdown>
            </div>
          </Card>
        </FadeInSection>
      )}

      {phase === 'idle' && !showResult && (
        <Card size="small" className={styles.resultCard}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                选择月份后点击「生成分析」：系统将对目标月及前 3 个月的智能诊断信号与业务证据运行内置
                prompt，由配置好的 LLM 流式输出含「跨月趋势对比」章节的 Markdown 分析报告
              </span>
            }
          />
        </Card>
      )}

      <ReportFooter
        sources={[
          { label: '数据接口', value: 'POST /api/v1/reports/llm-analysis/stream（SSE 流式：meta→delta*→done；非流式端点 /reports/llm-analysis 保留兼容）' },
          { label: 'LLM 配置', value: 'PUT /api/v1/system/llm-config（OpenAI 协议；桌面/Web 存 USER_DATA_DIR，移动端存本机 localStorage，api_key 脱敏）' },
          { label: '分析取数', value: '目标月 + 前 3 个月的智能诊断信号 + 业务证据三包，无信号月份自动剔除；证据包随 meta 事件先行下发' },
          { label: '输出口径', value: '内置 prompt 强制含「跨月趋势对比」章节；结果按（信号哈希 + 模型 + prompt 版本）缓存于本机，信号未变秒回' },
          { label: '流式说明', value: 'Web/桌面/PWA 为增量流式渲染；安卓端 CapacitorHttp 整包缓冲，显示阶段进度 + 计时，结束后一次性渲染；超时在「LLM 配置」调整（默认 180 秒）' },
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
