/**
 * AI 分析报告流式服务（v4.2.8）
 *
 * - 移动端/PWA：动态 import 直连 mobileHandlers/llmAnalysis 的流式 handler
 *   （回调式事件，不经 http.ts 拦截层）；Android CapacitorHttp 缓冲整包，
 *   delta 结束时一次性到齐（非增量但结果正确），超时由 handler 内 race 兜底。
 * - Web/桌面：POST /api/v1/reports/llm-analysis/stream，解析后端 SSE
 *   （event: meta → delta* → done / error），resp.body 增量读取。
 * - 失败统一 throw Error(message)，由页面 catch 展示；signal 仅对 fetch 路径生效
 *   （移动端为本地调用，取消由页面停止订阅事件实现）。
 */
import { API_URL } from './config';
import type { LlmEvidence } from './dataService';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';
import { useAuthStore } from '@/stores/useAuthStore';

export interface LlmStreamMeta {
  months_used: string[];
  model: string;
  cached: boolean;
  evidence?: LlmEvidence;
}

export type LlmStreamEvent =
  | ({ type: 'meta' } & LlmStreamMeta)
  | { type: 'delta'; text: string }
  | { type: 'done'; generated_at: string }
  | { type: 'error'; message: string };

export async function streamLlmAnalysis(
  params: { month?: string; force?: boolean },
  onEvent: (evt: LlmStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isMobileClient() || isPwaClient()) {
    const { handleLlmAnalysisStream } = await import('./mobileHandlers/llmAnalysis');
    await handleLlmAnalysisStream('', params as Record<string, unknown>, (evt) => onEvent(evt));
    return;
  }
  const token = useAuthStore.getState().accessToken;
  const resp = await fetch(`${API_URL}/reports/llm-analysis/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
    signal,
  });
  // 生成前失败：后端返回 JSON（400/502，与非流式端点一致）
  if (!resp.ok) {
    let message = `请求失败: ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.message) message = String(data.message);
    } catch { /* 非 JSON 响应体 */ }
    throw new Error(message);
  }
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    throw new Error('当前浏览器不支持流式响应，请改用「重新生成」（非流式）');
  }
  // 命名事件 SSE 解析（跨 chunk 缓冲；event: 行记录事件名，data: 行分发载荷）
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  const dispatch = (name: string, dataText: string) => {
    if (!name || !dataText) return;
    try {
      const data = JSON.parse(dataText);
      if (name === 'meta') onEvent({ type: 'meta', ...data });
      else if (name === 'delta') onEvent({ type: 'delta', text: String(data.text || '') });
      else if (name === 'done') onEvent({ type: 'done', generated_at: String(data.generated_at || '') });
      else if (name === 'error') throw new Error(String(data.message || 'LLM 生成失败'));
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      // JSON 解析异常：忽略该事件（与移动端心跳行容错一致）
    }
  };
  const feedLine = (line: string) => {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dispatch(eventName, line.slice(5).trim());
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      feedLine(buffer.slice(0, idx).replace(/\r$/, ''));
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf('\n');
    }
  }
  if (buffer) feedLine(buffer.replace(/\r$/, ''));
}
