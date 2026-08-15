#!/usr/bin/env python3
"""
对账 mobileRouteHandler.ts 的 case 分支 vs test_mobile_routes.py 的测试用例。

检测：
  - case 总数 vs 测试用例数
  - 每个 case 路径是否在 test_mobile_routes.py 中有对应测试（按 basename 匹配）

退出码：
  0 = 全部 case 都有测试覆盖
  1 = 有 case 未被测试覆盖（不算 KNOWN_UNTESTED）

详细规则见 docs/rules/cross-platform.md 第 4.4 节。

注意：本脚本不强制 1:1 严格匹配，只检测 case 的最后一段（basename）是否在测试用例 name 中出现。
      例如 case 'reports/omni-channel/summary' 与 test name 'omni-channel/summary' 视为匹配。
      新增 case 必须同时新增测试，否则 CI 失败。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, Set

ROOT = Path(__file__).resolve().parents[1]
MOBILE_HANDLER = ROOT / 'frontend-react' / 'src' / 'services' / 'mobileRouteHandler.ts'
# v3.8.x：handler 按报表域拆分到 mobileHandlers/ 目录，case 分发仍在主文件
MOBILE_HANDLERS_DIR = MOBILE_HANDLER.parent / 'mobileHandlers'
TEST_ROUTES = ROOT / 'scripts' / 'test_mobile_routes.py'


def read_mobile_text() -> str:
    """读取移动端路由处理器全文（分发器 + mobileHandlers/ 各报表域模块）。"""
    parts = []
    if MOBILE_HANDLER.exists():
        parts.append(MOBILE_HANDLER.read_text(encoding='utf-8'))
    if MOBILE_HANDLERS_DIR.is_dir():
        for f in sorted(MOBILE_HANDLERS_DIR.glob('*.ts')):
            parts.append(f.read_text(encoding='utf-8'))
    return '\n'.join(parts)

# 已知未测试的 case（历史遗留，记录在此供后续逐步补齐）
# 新增 case 不允许加入此列表，必须同步补测试
# 格式：{case 路径: 补测试优先级}
KNOWN_UNTESTED: Dict[str, str] = {
    # 历史 case：v3.5 之前的 case，多数有页面级回归测试覆盖
    'reports/omni-channel/summary': 'low',
    'reports/omni-channel/filter-options': 'low',
    'reports/omni-channel/daily-calendar': 'low',
    'reports/omni-channel/daily-trend': 'low',
    'reports/omni-channel/by-channel': 'low',
    'reports/app-market/funnel': 'low',
    'reports/app-market/summary': 'medium',
    'reports/app-market/detail': 'medium',
    'reports/app-market/filter-options': 'low',
    'dashboard/core-metrics': 'low',
    'dashboard/trend-data': 'low',
    'cost-analysis': 'low',
    'agency-analysis': 'medium',
    'conversion-funnel/split': 'medium',
    'leads-detail': 'medium',
    'leads-detail/filter-options': 'low',
    'leads-detail/anchor-clusters': 'medium',
    'leads-detail/anchor-clusters-trend': 'medium',
    'leads-detail/anchor-weekly-analysis': 'medium',
    'investment-review': 'medium',
    'reports/app-market/plan-analysis': 'medium',
    'reports/app-market/creative': 'low',  # Navigate 重定向，仍可调用
    'xhs-notes-list': 'low',
    'xhs-notes/list': 'low',
    'xhs-notes/filter-options': 'low',
    'xhs-notes-operation-analysis': 'medium',
    'reports/xhs/plan-analysis': 'medium',
    'employee-conversion/analysis': 'medium',
    'employee-conversion/weekly': 'medium',
    'employee-conversion/analysis-channel-overview': 'medium',
    'employee-conversion/filter-options': 'low',
    'reports/weekly/periods': 'low',
    'reports/weekly/data': 'medium',
    'metadata': 'low',
    # v3.6.4：返回构建时注入的 __APP_VERSION_INFO__，不走 SQL 查询，无需/无法在 SQL 测试框架中覆盖
    'version/local': 'low',
}


def extract_mobile_cases() -> Set[str]:
    """从 mobileRouteHandler.ts 提取所有 case 路径。"""
    if not MOBILE_HANDLER.exists():
        return set()
    text = read_mobile_text()
    case_re = re.compile(r"^\s*case\s+['\"]([^'\"]+)['\"]\s*:", re.MULTILINE)
    return set(case_re.findall(text))


def extract_test_names() -> Set[str]:
    """从 test_mobile_routes.py 提取所有测试用例的 name 字段。"""
    if not TEST_ROUTES.exists():
        return set()
    text = TEST_ROUTES.read_text(encoding='utf-8')
    names: Set[str] = set()
    # 匹配 'name': 'xxx' 或 "name": "xxx"
    name_re = re.compile(r"['\"]name['\"]\s*:\s*['\"]([^'\"]+)['\"]")
    for m in name_re.finditer(text):
        names.add(m.group(1))
    return names


def check_handler_return_shape() -> list[str]:
    """检查 mobileRouteHandler 的 handler 是否误包了 API 响应外壳。

    历史事故（v3.8.1）：handleAppMarketAttributionConversion 返回了
    `{ success: true, data: {...}, meta: {...} }`（照抄后端 Flask 返回格式），
    而 http.ts 移动端路径已经统一包装 `{ success: true, data: handlerResult }`，
    导致页面 res.data 多包一层 → 取不到 daily_data/weekly_data → 报表显示「暂无周度数据」。

    约定：mobileRouteHandler 的所有 handler 必须返回**纯数据对象**（与其他 handler 一致），
    不允许出现顶层 `success:` 键。此处检测文件中 handler 返回的 success: 出现次数。

    注意：仅检测代码行中的 `success:`（排除注释），`meta:` 是合法数据字段不检测。
    """
    if not MOBILE_HANDLER.exists():
        return []
    violations: list[str] = []
    for lineno, line in enumerate(read_mobile_text().splitlines(), start=1):
        stripped = line.strip()
        # 跳过注释行
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        # 检测 success: true / success: false 等响应包装（布尔字面量；数据字段如 success: toInt() 不匹配）
        if re.search(r"['\"]?success['\"]?\s*:\s*(true|false)\b", stripped) and not stripped.startswith('//'):
            violations.append(f'  L{lineno}: {stripped[:80]}')
    return violations


def case_matches_test(case: str, test_names: Set[str]) -> bool:
    """判断 case 是否被测试覆盖。

    匹配规则：
      1. 完全匹配：case 'xhs-notes/list' 与 test name 'xhs-notes/list'
      2. basename 匹配：case 'reports/omni-channel/summary' 与 test name 'omni-channel/summary'
         （case 去掉最前面一段 reports/ 前缀后与 test name 比较）
    """
    if case in test_names:
        return True
    # 去掉最前面一段（reports/ 前缀），再比较
    if '/' in case:
        parts = case.split('/', 1)
        if len(parts) == 2:
            stripped = parts[1]
            if stripped in test_names:
                return True
    return False


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 72)
    print('check_mobile_routes_coverage.py — mobileRouteHandler case 测试覆盖对账')
    print('=' * 72)
    print()

    cases = extract_mobile_cases()
    test_names = extract_test_names()

    print(f'mobileRouteHandler case 总数: {len(cases)}')
    print(f'test_mobile_routes.py 用例数: {len(test_names)}')
    print()

    # 防回归：handler 返回值不得带 success 响应包装（http.ts 已统一包装）
    shape_violations = check_handler_return_shape()
    if shape_violations:
        print('--- DRIFT: handler 返回值出现 success 响应包装（应返回纯数据对象） ---')
        for v in shape_violations:
            print(v)
        print('  → http.ts 移动端路径已包装 { success, data }，handler 必须返回纯数据对象，否则页面取不到 res.data.xxx')
        print()
        print(f'❌ 检测到 {len(shape_violations)} 处 success 包装')
        return 1

    matched: Set[str] = set()
    untested: Set[str] = set()
    for case in cases:
        if case_matches_test(case, test_names):
            matched.add(case)
        else:
            untested.add(case)

    known_untested = untested & set(KNOWN_UNTESTED.keys())
    new_untested = untested - set(KNOWN_UNTESTED.keys())

    if known_untested:
        print(f'--- 已知未测试（{len(known_untested)} 个，记录在 KNOWN_UNTESTED，不影响 CI） ---')
        for case in sorted(known_untested):
            prio = KNOWN_UNTESTED.get(case, '')
            print(f'  {case:<50}  {prio}')
        print()

    if new_untested:
        print('--- DRIFT: 新增 case 未补测试 ---')
        for case in sorted(new_untested):
            print(f'  {case}')
        print('  → 在 scripts/test_mobile_routes.py 中补对应 SQL 测试用例')
        print()

    # 退出码
    if new_untested:
        print(f'❌ 检测到 {len(new_untested)} 个新 case 未补测试')
        print('   规则见 docs/rules/cross-platform.md 第 4.4 节')
        return 1

    if known_untested:
        print(f'⚠️  有 {len(known_untested)} 个已知未测试 case 待逐步补齐（不影响 CI）')
    print(f'✅ mobileRouteHandler case 与 test_mobile_routes.py 用例对齐')
    return 0


if __name__ == '__main__':
    sys.exit(main())
