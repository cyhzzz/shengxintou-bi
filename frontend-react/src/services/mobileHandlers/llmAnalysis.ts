/**
 * 移动端 AI 分析报告 handler（v4.2.6）——与后端 backend/utils/llm.py 同口径复刻。
 *
 * - 配置存本机 localStorage（移动端无 USER_DATA_DIR；PWA 端禁用 Capacitor 插件，
 *   Android 端 fetch 已被 CapacitorHttp 接管，直连 LLM Provider 免 CORS）
 * - 分析复用 diagnosis 数据链路（runDiagnosis × 目标月与前 3 月）；business 三包
 *   （vendor/note/appmarket）由 llmEvidence.ts 同口径移植，随 prompt 传入、随响应 evidence 透传
 * - v4.2.8 新增流式 handleLlmAnalysisStream（meta → delta* → done 事件回调）：
 *   PWA/浏览器走真流式（resp.body 增量解析）；Android CapacitorHttp 缓冲整包、
 *   delta 结束时一次性到齐（结果正确，仅非增量）。
 * - SYSTEM_PROMPT / PROMPT_VERSION 与后端 llm.py 两端同步维护：修改任一侧必须同步另一侧，
 *   否则两端报告口径漂移且缓存失效行为不一致
 * - 错误处理：throw Error(消息)，由 http.ts 移动端包装为失败响应；消息文本与后端一致，
 *   且不含 'not implemented' / 'database' / 'connection' 等错误替换触发词
 */
import { Capacitor } from '@capacitor/core';
import { runDiagnosis, type DiagnosisResult } from './diagnosis';
import { buildBusinessEvidence, type BusinessEvidence } from './llmEvidence';

const CONFIG_STORAGE_KEY = 'sxt_mobile_llm_config';
const CACHE_STORAGE_PREFIX = 'sxt_mobile_llm_cache_';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
// v4.2.8：业务证据包入 prompt 后生成时长普遍超过 60s，默认 60 → 180（与后端 llm.py 同步）
const DEFAULT_TIMEOUT = 180;
const TREND_MONTHS = 4;

// prompt 结构性变更时递增；缓存命中需校验，避免旧缓存掩盖新 prompt 效果（与 llm.py PROMPT_VERSION 一致）
const PROMPT_VERSION = 4;

// ==== 以下 SYSTEM_PROMPT 与 backend/utils/llm.py 逐字一致（两端同步维护）====
const SYSTEM_PROMPT = `你是一名券商投放运营团队的经营分析搭档。读者是一线投放与运营同学：请用大白话，先给结论再给证据，避免专业黑话；首次出现的指标（开口率、零互动占比、新开户率、户均资产等）顺带一句话解释。报告的重心是「下一步怎么投」，数据质量问题只作可信度提示，不要喧宾夺主。

你会收到两部分输入：
1. diagnosis：自动体检的异常信号清单（chain 链路 / level 级别 / title / detail / evidence / suggestion），以及最后一个月的 content_evidence（分平台当月 vs 前 3 月、逐日、旬级、月末恢复判定）。这部分主要回答「数据有没有问题、可信度如何」。
2. business：经营证据包（仅当月视角，当月 vs 前 3 月对比在包内部）。三个子包，任一为 null 表示该维度数据缺失，跳过对应解读、不要编造：
   - vendor：厂商经营（量子、绩牛等）。current=当月、prev3=前 3 月合计、platforms_current=当月平台拆分。注意该表是统一漏斗超集：leads/opened/valid/accounts 是内容平台值，app_downloads/app_activations 是应用市场值，同一厂商可能只占其中一类。派生指标：open_rate 开口率、lead_cost 线索成本、account_cost 开户成本、eff_account_cost 有效户成本。
   - note：小红书笔记分层。watch_top=当月开口线索最多的笔记（值得加投/模仿）；declining=前 3 月月均开口 ≥10 且当月跌破 30% 的衰退笔记（对应选题需要补充）；stop_candidates=累计消费 ≥1000 且企微加微 ≤2 的停投候选；content_types=按内容类型的聚合表现（选题方向参考）；new_notes=当月新发笔记。注意：笔记归属仅部分线索携带（主要为小红书链路）；snapshot 是累计快照无月度趋势，衰退判定基于转化侧月度开口。
   - appmarket：应用市场经营。stores=各商店（oppo/vivo/华为/小米/荣耀/鸿蒙/苹果）当月 vs 前 3 月漏斗（downloads 下载→activated 激活→registered 注册→funded 完资金账号→opened_accounts 开户成功→new_accounts 新开户→deposited 入金→eff_accounts 有效户）+ 资产/创收；placement_potential=当月新开户最多的商店×版位组合；placement_watchlist=下载 ≥30 但新开户率最低的组合（需关注）；plans_top=当月下载 TOP 计划。口径：仅互联网引流，新开户为漏斗末段。客群质量看 asset_per_new_account / revenue_per_new_account（户均资产/户均创收）。

经营解读规则：
- 厂商对比：钱花得值不值看「线索成本 / 开口率 / 有效户成本」当月 vs 前 3 月变化，别只看花费绝对值。
- 笔记建议：watch_top 给「值得继续投/放大」的理由，declining 给「选题正在衰退、需要补新内容」的具体方向（从标题归纳选题），stop_candidates 给停投理由。
- 应用市场：商店间比新开户率与客群质量，版位比效率，区分「量大的」和「质量好的」。

归因与置信度（涉及数据问题或经营判断的原因时）：
- 所有归因必须以「疑似」开头，置信度只允许 高 / 中 / 低 三档并引用具体数值。
- 数据侧形态参考：开口率下降且多平台零互动占比同步抬升 → 疑似上游回写缺失；单平台恶化且无零互动抬升 → 疑似素材或运营问题；证据矛盾 → 转入「需要人工核对」。

铁律：
- 引用任何数字必须来自输入数据，禁止编造或推算输入中不存在的数字。
- 内容合规：遵守证券行业宣传规范，不给投资建议，不承诺收益。
- 行动建议面向投放运营（预算分配、素材与选题、渠道与版位取舍、跟单核对），按优先级排序，注明对应月份与数据依据。

输出使用 Markdown，固定包含以下章节（按顺序）：
## 总体判断
第一句大白话给本月最重要的经营结论（谁做得好、哪里该动），再用一句话说明数据可信度（体检有无 error/warn、是否影响结论）。
## 内容平台经营解读
### 厂商对比
哪家厂商（量子/绩牛等）当月表现好/差：线索成本、开口率、有效户成本的变化，钱花得值不值。
### 笔记表现与选题
值得关注的笔记（watch_top）、衰退笔记与选题补充方向（declining）、停投候选（stop_candidates）、内容类型选题参考（content_types）。
## 应用市场经营解读
### 渠道（商店）对比
各商店当月 vs 前 3 月：下载量、新开户率、客群质量（户均资产/创收），哪家强、哪家弱。
### 版位与计划
有潜力的版位组合（placement_potential）、需关注的低效组合（placement_watchlist）、下载 TOP 计划（plans_top）。
## 跨月趋势对比
逐链路对比最近三个月走势，指出拐点月份与对应信号。
## 需要人工核对的事项
数据质量问题与无法从数据确认的疑问（上游回写、平台口径、抽样核对）集中在此。
## 行动建议
按优先级列 4-6 条，聚焦投放动作（预算、素材/选题、渠道/版位取舍），注明对应月份与数据依据。`;

// ==== 日期与基础辅助 ====

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localNowIsoSeconds(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
    + `T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

// 与 diagnosis.ts shiftMonth 同实现（原函数未导出，本地复刻）
function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${pad2((total % 12) + 1)}`;
}

function parseIntStrict(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && /^[+-]?\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return null;
}

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ==== 配置读写（localStorage 版 load_config / save_config / config_view / resolve_config）====

interface LlmStoredConfig {
  base_url: string;
  api_key: string;
  model: string;
  timeout_seconds: number;
  updated_at?: string;
}

function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function loadConfig(): LlmStoredConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data as LlmStoredConfig;
  } catch {
    return null;
  }
}

function saveConfig(payload: Record<string, unknown>): LlmStoredConfig {
  const stored = loadConfig() || ({} as Partial<LlmStoredConfig>);
  const body = payload || {};
  const base_url = stripTrailingSlash(String(body.base_url || stored.base_url || DEFAULT_BASE_URL));
  if (!base_url.startsWith('http://') && !base_url.startsWith('https://')) {
    throw new Error('base_url 必须以 http:// 或 https:// 开头');
  }
  const api_key = String(body.api_key || '').trim() || String(stored.api_key || '');
  const model = String(body.model || stored.model || '').trim();
  const timeout = parseIntStrict(body.timeout_seconds || stored.timeout_seconds || DEFAULT_TIMEOUT);
  if (timeout === null) throw new Error('timeout_seconds 必须为整数');
  if (!api_key) throw new Error('api_key 不能为空');
  if (!model) throw new Error('model 不能为空');
  if (timeout < 5 || timeout > 600) throw new Error('timeout_seconds 需在 5~600 之间');
  const data: LlmStoredConfig = {
    base_url, api_key, model, timeout_seconds: timeout, updated_at: localNowIsoSeconds(),
  };
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new Error('配置保存失败：本机存储不可用（隐私模式或存储已满）');
  }
  return data;
}

function maskKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '***';
  return apiKey.slice(0, 3) + '***' + apiKey.slice(-4);
}

function configView(): Record<string, unknown> {
  const cfg = loadConfig();
  if (!cfg || !cfg.api_key) {
    return {
      configured: false,
      base_url: DEFAULT_BASE_URL,
      api_key_masked: '',
      model: '',
      timeout_seconds: DEFAULT_TIMEOUT,
    };
  }
  return {
    configured: true,
    base_url: cfg.base_url || DEFAULT_BASE_URL,
    api_key_masked: maskKey(cfg.api_key || ''),
    model: cfg.model || '',
    timeout_seconds: cfg.timeout_seconds || DEFAULT_TIMEOUT,
  };
}

interface ResolvedConfig {
  base_url: string;
  api_key: string;
  model: string;
  timeout_seconds: number;
}

function resolveConfig(payload?: Record<string, unknown> | null): ResolvedConfig {
  const stored = loadConfig() || ({} as Partial<LlmStoredConfig>);
  const body = payload || {};
  const timeout = parseIntStrict(body.timeout_seconds || stored.timeout_seconds || DEFAULT_TIMEOUT);
  return {
    base_url: stripTrailingSlash(String(body.base_url || stored.base_url || DEFAULT_BASE_URL)),
    api_key: String(body.api_key || '').trim() || String(stored.api_key || ''),
    model: String(body.model || stored.model || '').trim(),
    timeout_seconds: timeout === null ? DEFAULT_TIMEOUT : timeout,
  };
}

// ==== LLM 上游调用（call_chat 移植版，返回 [content, latency_ms]）====

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

function timeoutErrorMessage(timeout: number): string {
  return `LLM 生成超时（${timeout} 秒）：可在「LLM 配置」调大超时时间或换用更快的模型`;
}

async function callChat(
  cfg: ResolvedConfig,
  messages: ChatMessage[],
  maxTokens?: number,
  allowEmptyContent = false,
): Promise<[string, number]> {
  const timeout = cfg.timeout_seconds || DEFAULT_TIMEOUT;
  const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
  const payload: Record<string, unknown> = { model: cfg.model, messages, temperature: 0.3 };
  if (maxTokens) payload.max_tokens = maxTokens;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeout * 1000);
  // v4.2.8：Android CapacitorHttp 接管 fetch 后不支持 AbortSignal，controller.abort() 形同虚设，
  // 请求会无限挂起（页面转圈无报错）。叠加 JS 层 race 超时兜底：任何平台超时都必然触发。
  let raceTimer: ReturnType<typeof setTimeout> | null = null;
  const started = Date.now();
  let resp: Response;
  try {
    resp = await Promise.race([
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${String(cfg.api_key || '')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        raceTimer = setTimeout(() => reject(new Error(timeoutErrorMessage(timeout))), timeout * 1000);
      }),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message.includes('生成超时')) throw e;
    throw new Error('LLM 请求失败：网络错误或超时，请检查 base_url / api_key / 超时配置');
  } finally {
    clearTimeout(abortTimer);
    if (raceTimer) clearTimeout(raceTimer);
  }
  if (resp.status !== 200) {
    throw new Error(`LLM 返回异常状态 ${resp.status}，请检查模型名称与 api_key`);
  }
  // 200 + 结构合法即解析成功；content 合法值仅 string 或 null（与 llm.call_chat 对齐）
  let content: string | null = null;
  let parsed = false;
  try {
    const data = await resp.json();
    const message = data?.choices?.[0]?.message;
    if (message && typeof message === 'object'
      && (message.content === null || typeof message.content === 'string')) {
      content = message.content;
      parsed = true;
    }
  } catch {
    parsed = false;
  }
  if (!parsed) throw new Error('LLM 响应格式无法解析');
  // 思考型模型（GLM 系列）小预算下 content 可能为空：连通性测试允许空，正式分析严格要求非空
  if (!content && !allowEmptyContent) throw new Error('LLM 返回内容为空');
  return [content || '', Date.now() - started];
}

// ==== 流式调用（v4.2.8，llm.stream_chat 同口径移植）====

/** SSE data: 行解析器（跨 chunk 缓冲；feed 喂入文本，onData 收到去前缀后的 data 载荷） */
function createSseParser(onData: (dataText: string) => void) {
  let buffer = '';
  return {
    feed(text: string) {
      buffer += text;
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.startsWith('data:')) onData(line.slice(5).trim());
        idx = buffer.indexOf('\n');
      }
    },
    flush() {
      if (buffer.startsWith('data:')) onData(buffer.slice(5).trim());
      buffer = '';
    },
  };
}

/**
 * 流式调用 OpenAI 协议 /chat/completions（stream: true + SSE）。
 * 返回完整 content；onDelta 逐段回调（PWA/浏览器为增量；Android CapacitorHttp 缓冲，结束时一次性到齐）。
 * 超时口径：Android（原生 fetch 被接管、无增量且 abort 失效）→ 总时长 race；
 * 其余环境 → 相邻 chunk 间空闲看门狗（每个 chunk 重置，长生成不误杀）。
 */
async function streamChat(
  cfg: ResolvedConfig,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<string> {
  const timeout = cfg.timeout_seconds || DEFAULT_TIMEOUT;
  const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
  const payload: Record<string, unknown> = { model: cfg.model, messages, temperature: 0.3, stream: true };
  const nativeFetch = Capacitor.isNativePlatform?.() ?? false;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeout * 1000);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    let resp: Response;
    if (nativeFetch) {
      // Android：无增量也无 abort，用总时长 race 保证超时必然触发（v4.2.8 转圈修复核心）
      resp = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${String(cfg.api_key || '')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          idleTimer = setTimeout(() => reject(new Error(timeoutErrorMessage(timeout))), timeout * 1000);
        }),
      ]);
    } else {
      resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${String(cfg.api_key || '')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    }
    if (resp.status !== 200) {
      throw new Error(`LLM 返回异常状态 ${resp.status}，请检查模型名称与 api_key`);
    }
    let content = '';
    const parser = createSseParser((dataText) => {
      if (!dataText || dataText === '[DONE]') return;
      try {
        const delta = JSON.parse(dataText)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          content += delta;
          onDelta(delta);
        }
      } catch {
        // 心跳/非 JSON 行忽略
      }
    });
    if (resp.body && typeof resp.body.getReader === 'function') {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        if (idleTimer) clearTimeout(idleTimer);
        const readPromise = reader.read();
        const result = nativeFetch
          ? await readPromise
          : await Promise.race([
              readPromise,
              new Promise<never>((_, reject) => {
                idleTimer = setTimeout(
                  () => reject(new Error(`LLM 流式响应超时（${timeout} 秒无新增内容），可调大超时或换用更快的模型`)),
                  timeout * 1000,
                );
              }),
            ]);
        if (result.done) break;
        parser.feed(decoder.decode(result.value, { stream: true }));
      }
      parser.feed(decoder.decode()); // 多字节字符跨 chunk 冲刷
      parser.flush();
    } else {
      // 兜底：Response 无流式 body 时整体取回后解析（事件一次性分发）
      parser.feed(await resp.text());
      parser.flush();
    }
    if (!content) throw new Error('LLM 返回内容为空');
    return content;
  } catch (e) {
    if (e instanceof Error && (e.message.includes('超时') || e.name === 'AbortError')) {
      throw new Error(e.message.includes('超时') ? e.message : timeoutErrorMessage(timeout));
    }
    throw new Error('LLM 请求失败：网络错误或超时，请检查 base_url / api_key / 超时配置');
  } finally {
    clearTimeout(abortTimer);
    if (idleTimer) clearTimeout(idleTimer);
  }
}

// ==== 跨月取数与 prompt 组装（collect_trend_data / build_user_prompt 移植版）====

const ITEM_SLIM_KEYS = ['id', 'chain', 'level', 'title', 'detail', 'evidence', 'suggestion'] as const;

function slimResult(result: DiagnosisResult): Record<string, unknown> {
  return {
    month: result.month,
    snapshot_dates: result.snapshot_dates,
    summary: result.summary,
    items: (result.items || []).map((item) => {
      const slim: Record<string, unknown> = {};
      for (const key of ITEM_SLIM_KEYS) slim[key] = (item as unknown as Record<string, unknown>)[key];
      return slim;
    }),
    // 与后端差异：移动端诊断链路不产出 content_evidence，user prompt 中该字段整体缺省
  };
}

async function collectTrendData(month?: string): Promise<[string, DiagnosisResult[]]> {
  let base: string;
  if (!month) {
    base = (await runDiagnosis()).month;
    if (!base) return ['', []];
  } else {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month 参数格式必须为 YYYY-MM');
    base = month;
  }
  const results: DiagnosisResult[] = [];
  for (let delta = -(TREND_MONTHS - 1); delta <= 0; delta++) {
    const result = await runDiagnosis(shiftMonth(base, delta));
    if (result.items && result.items.length > 0) results.push(result);
  }
  return [base, results];
}

// business 证据包由 llmEvidence.ts 同口径构建；null 子包按 SYSTEM_PROMPT 规则跳过解读、不编造
function buildUserPrompt(results: DiagnosisResult[], business: BusinessEvidence): string {
  return JSON.stringify({ diagnosis: results.map(slimResult), business });
}

// ==== 结果缓存（localStorage 版 load_cache / save_cache，键 = prompt sha1 + model）====

interface LlmCacheEntry {
  month: string;
  signals_hash: string;
  model: string;
  prompt_version: number;
  content: string;
  generated_at: string;
}

function loadCache(month: string, signalsHash: string, model: string): LlmCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_PREFIX + month);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.content) return null;
    if (data.prompt_version !== PROMPT_VERSION) return null;
    if (data.signals_hash !== signalsHash || data.model !== model) return null;
    return data as LlmCacheEntry;
  } catch {
    return null;
  }
}

function saveCache(month: string, signalsHash: string, model: string, content: string): void {
  try {
    const data: LlmCacheEntry = {
      month, signals_hash: signalsHash, model, prompt_version: PROMPT_VERSION,
      content, generated_at: localNowIsoSeconds(),
    };
    localStorage.setItem(CACHE_STORAGE_PREFIX + month, JSON.stringify(data));
  } catch {
    // 缓存写入失败（配额/隐私模式）不影响结果返回，与后端 save_cache 静默吞 OSError 一致
  }
}

// ==== 分析主入口（run_analysis / prepare_analysis 移植版）====

interface AnalysisPrep {
  cfg: LlmStoredConfig;
  target: string;
  monthsUsed: string[];
  business: BusinessEvidence;
  userPrompt: string;
  signalsHash: string;
  model: string;
  cached: LlmCacheEntry | null;
}

/** 与后端 llm.prepare_analysis 同口径：配置校验 → 跨月取数 → 证据包 → 缓存判定 */
async function prepareAnalysis(month?: string, force = false): Promise<AnalysisPrep> {
  const cfg = loadConfig();
  if (!cfg || !cfg.api_key) {
    throw new Error('尚未配置 LLM，请先在「AI 分析报告」页点击「LLM 配置」完成设置');
  }
  const [target, results] = await collectTrendData(month);
  // v4.3.2：移动端本地库缺表/空库时数据退化为空，补充自愈指引（后端无此场景，后缀为移动端专属）
  if (!results.length) {
    throw new Error('目标月及前 3 个月均无诊断数据，无法生成分析；请先到「数据同步」页更新全部分表后重试');
  }
  const business = await buildBusinessEvidence(target);
  const userPrompt = buildUserPrompt(results, business);
  // 缓存键覆盖整个 user prompt：诊断信号或业务证据任一变化均触发失效
  const signalsHash = await sha1Hex(userPrompt);
  const model = cfg.model || '';
  return {
    cfg,
    target,
    monthsUsed: results.map((r) => r.month),
    business,
    userPrompt,
    signalsHash,
    model,
    cached: force ? null : loadCache(target, signalsHash, model),
  };
}

async function runAnalysis(month?: string, force = false): Promise<Record<string, unknown>> {
  const prep = await prepareAnalysis(month, force);
  if (prep.cached) {
    return {
      content: prep.cached.content,
      months_used: prep.monthsUsed,
      model: prep.model,
      generated_at: prep.cached.generated_at || '',
      cached: true,
      evidence: prep.business,
    };
  }
  const [content] = await callChat(prep.cfg, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prep.userPrompt },
  ]);
  saveCache(prep.target, prep.signalsHash, prep.model, content);
  return {
    content,
    months_used: prep.monthsUsed,
    model: prep.model,
    generated_at: localNowIsoSeconds(),
    cached: false,
    evidence: prep.business,
  };
}

// ==== mobileRouteHandler 分发入口（必须返回纯数据对象，禁止 success 包装）====

/** GET /api/v1/system/llm-config —— 查看配置（api_key 脱敏） */
export async function handleLlmConfigGet(): Promise<Record<string, unknown>> {
  return configView();
}

/** PUT /api/v1/system/llm-config —— 保存后回读 config_view（与后端返回结构一致） */
export async function handleLlmConfigSave(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  saveConfig(body || {});
  return configView();
}

/** POST /api/v1/system/llm-config/test —— 连通性测试（max_tokens=16 + 允许空 content） */
export async function handleLlmConfigTest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const merged = resolveConfig(body || {});
  if (!merged.api_key || !merged.model) throw new Error('请先填写 api_key 与 model');
  const [, latencyMs] = await callChat(merged, [{ role: 'user', content: 'ping' }], 16, true);
  return { ok: true, latency_ms: latencyMs };
}

/** POST /api/v1/reports/llm-analysis —— 跨月趋势分析（body: {month?, force?}） */
export async function handleLlmAnalysis(_url: string, body: Record<string, unknown> | null): Promise<Record<string, unknown>> {
  const payload = body || {};
  const month = typeof payload.month === 'string' ? payload.month : undefined;
  return runAnalysis(month, payload.force === true);
}

// ==== 流式入口（v4.2.8）：meta（取数完成，含证据包）→ delta*（增量文本）→ done ====

export type LlmStreamEvent =
  | { type: 'meta'; months_used: string[]; model: string; cached: boolean; evidence: BusinessEvidence }
  | { type: 'delta'; text: string }
  | { type: 'done'; generated_at: string };

/**
 * POST /api/v1/reports/llm-analysis/stream —— 流式版（body: {month?, force?}）。
 * 事件经 onEvent 回调（不经 http.ts 拦截层，页面经 services/llmStream.ts 直连）；
 * 失败仍走 throw（调用方统一 catch 展示）；最终返回值与非流式 handleLlmAnalysis 完全一致
 * （供 mobileRouteHandler case 降级复用：跑完整个流、回最终结果）。
 */
export async function handleLlmAnalysisStream(
  _url: string,
  body: Record<string, unknown> | null,
  onEvent?: (evt: LlmStreamEvent) => void,
): Promise<Record<string, unknown>> {
  const emit: (evt: LlmStreamEvent) => void = onEvent || (() => { /* 非流式调用方不订阅事件 */ });
  const payload = body || {};
  const month = typeof payload.month === 'string' ? payload.month : undefined;
  const prep = await prepareAnalysis(month, payload.force === true);
  if (prep.cached) {
    const generatedAt = prep.cached.generated_at || '';
    emit({ type: 'meta', months_used: prep.monthsUsed, model: prep.model, cached: true, evidence: prep.business });
    emit({ type: 'delta', text: prep.cached.content });
    emit({ type: 'done', generated_at: generatedAt });
    return {
      content: prep.cached.content,
      months_used: prep.monthsUsed,
      model: prep.model,
      generated_at: generatedAt,
      cached: true,
      evidence: prep.business,
    };
  }
  // meta 先行：证据包随事件下发，页面在 LLM 生成期间即可核验证据卡
  emit({ type: 'meta', months_used: prep.monthsUsed, model: prep.model, cached: false, evidence: prep.business });
  const content = await streamChat(
    prep.cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prep.userPrompt },
    ],
    (text) => emit({ type: 'delta', text }),
  );
  saveCache(prep.target, prep.signalsHash, prep.model, content);
  const generatedAt = localNowIsoSeconds();
  emit({ type: 'done', generated_at: generatedAt });
  return {
    content,
    months_used: prep.monthsUsed,
    model: prep.model,
    generated_at: generatedAt,
    cached: false,
    evidence: prep.business,
  };
}
