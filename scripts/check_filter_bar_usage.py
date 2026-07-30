#!/usr/bin/env python3
"""
对账 frontend-react/src/pages 下页面是否手写 antd 原生 RangePicker
（而非使用 FilterBar / DateRangeFilter 共享组件）。

规范见 docs/rules/frontend.md 第 9 节：
  - 报表筛选器统一使用 FilterBar（内置查询/重置按钮 + 近 x 天快速选择）
  - 禁止页面内手写 <RangePicker> + 自定义按钮
  - 既有手写 RangePicker 的页面属历史债务，记录在 KNOWN_VIOLATIONS

检测逻辑：
  扫描 pages/**/*.tsx，匹配以下任一模式即判定为「手写 RangePicker」：
    - `const { RangePicker } = DatePicker`
    - `<RangePicker`
    - `<DatePicker.RangePicker`
  排除 components/Filter/ 目录（共享组件本身允许使用 antd 原生 RangePicker）

退出码：
  0 = 无新增违规
  1 = 检测到新增违规（不在 KNOWN_VIOLATIONS 中的手写 RangePicker）

详细规则见 docs/rules/frontend.md 第 9 节。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, Set

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / 'frontend-react' / 'src' / 'pages'

# 手写 RangePicker 的特征模式
PATTERNS = [
    re.compile(r'const\s*\{\s*RangePicker\s*\}\s*=\s*DatePicker'),
    re.compile(r'<RangePicker\b'),
    re.compile(r'<DatePicker\.RangePicker\b'),
]

# 已知违规（历史债务，记录在此供后续逐步迁移到 FilterBar）
# 新增页面不得加入此列表，必须使用 FilterBar
# 格式：{相对路径: 迁移说明}
KNOWN_VIOLATIONS: Dict[str, str] = {
    'frontend-react/src/pages/DataReconciliation/DouyinQingniao.tsx': '对账页，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/ConversionFunnel/index.tsx': '转化漏斗，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/AnchorCluster/index.tsx': '主播聚类，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Live/Funnel.tsx': '直播漏斗，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Live/DirectSales.tsx': '直播带货，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/XhsNotes/List.tsx': '小红书列表，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/EmployeeConversion/Weekly/index.tsx': '员工转化周报，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/OmniChannel/index.tsx': '全渠道，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/AppMarket/Comparison.tsx': '应用市场对比，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/Xhs/PlanAnalysis.tsx': '小红书计划分析，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/AppMarket/Detail.tsx': '应用市场明细，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/AppMarket/Funnel.tsx': '应用市场漏斗，迁移到 FilterBar 待排期',
    'frontend-react/src/pages/Reports/AppMarket/PlanAnalysis.tsx': '应用市场计划分析，迁移到 FilterBar 待排期',
}


def extract_violations() -> Dict[str, list]:
    """扫描 pages/**/*.tsx，返回手写 RangePicker 的文件 {相对路径: [匹配行号]}。"""
    violations: Dict[str, list] = {}
    if not PAGES_DIR.exists():
        return violations
    for tsx_file in PAGES_DIR.rglob('*.tsx'):
        try:
            text = tsx_file.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        rel = tsx_file.relative_to(ROOT).as_posix()
        for i, line in enumerate(text.splitlines(), 1):
            for pat in PATTERNS:
                if pat.search(line):
                    violations.setdefault(rel, []).append(i)
                    break
    return violations


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 72)
    print('check_filter_bar_usage.py — 页面手写 RangePicker 对账')
    print('=' * 72)
    print()

    violations = extract_violations()
    known = set(KNOWN_VIOLATIONS.keys())
    found = set(violations.keys())

    known_present = found & known
    new_violations = found - known

    print(f'手写 RangePicker 的页面文件数: {len(found)}')
    print(f'KNOWN_VIOLATIONS 记录数: {len(known)}')
    print()

    if known_present:
        print(f'--- 已知违规（{len(known_present)} 个，历史债务，不影响 CI） ---')
        for f in sorted(known_present):
            note = KNOWN_VIOLATIONS.get(f, '')
            lines = violations[f]
            print(f'  {f:<50}  L{lines[0]}  {note}')
        print()

    if new_violations:
        print('--- DRIFT: 新增违规（手写 RangePicker 但未记录在 KNOWN_VIOLATIONS） ---')
        for f in sorted(new_violations):
            lines = violations[f]
            print(f'  {f}  (行 {", ".join(str(l) for l in lines)})')
        print('  → 改用 FilterBar 共享组件，或将历史页面加入 KNOWN_VIOLATIONS')
        print('  → 规则见 docs/rules/frontend.md 第 9 节')
        print()

    # 检查 KNOWN_VIOLATIONS 中已迁移的条目（文件不再违规但列表还在）
    migrated = known - found
    if migrated:
        print(f'--- 提示: {len(migrated)} 个 KNOWN_VIOLATIONS 条目已迁移，可从列表删除 ---')
        for f in sorted(migrated):
            print(f'  {f}')
        print()

    # 退出码
    if new_violations:
        print(f'❌ 检测到 {len(new_violations)} 个新增违规')
        print('   规则见 docs/rules/frontend.md 第 9 节')
        return 1

    if known_present:
        print(f'⚠️  有 {len(known_present)} 个已知违规待逐步迁移到 FilterBar（不影响 CI）')
    print('✅ 无新增违规，新增报表筛选器符合 FilterBar 规范')
    return 0


if __name__ == '__main__':
    sys.exit(main())

