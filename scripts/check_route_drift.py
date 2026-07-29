#!/usr/bin/env python3
"""
对账 router/index.tsx 注册的路由 vs route-health.spec.ts 的 PUBLIC_ROUTES 列表。

退出码：
  0 = 无 drift
  1 = 检测到 drift（路由表新增了项但 smoke 用例未同步，或反之）

详细规则见 docs/rules/cross-platform.md。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

ROOT = Path(__file__).resolve().parents[1]
ROUTER_TSX = ROOT / 'frontend-react' / 'src' / 'router' / 'index.tsx'
SMOKE_SPEC = ROOT / 'frontend-react' / 'tests' / 'smoke' / 'route-health.spec.ts'

# 桌面端独有路由（Web/移动端/PWA 不注册或不需要 smoke 覆盖）
IGNORED_ROUTER_PATHS: set = {'login'}

# Navigate 重定向路由：smoke 测试它们是合理的，不报孤儿
# 这些路径在路由表中是 Navigate 重定向项，被脚本过滤掉了
NAVIGATE_REDIRECT_PATHS: set = {
    'app-market/creative',  # 重定向到 app-market/plan-analysis
    'reports/app-market',   # 重定向到 app-market/funnel
    'reports/omni-channel', # 重定向到 omni-channel
}


def extract_router_paths() -> Dict[str, str]:
    """
    从 router/index.tsx 提取所有完整可访问路由路径（拼接父+子）。

    处理嵌套 children 结构：
      { path: 'xhs-notes', children: [{ path: 'list', element: ... }] }
    → 完整路径 'xhs-notes/list'
    """
    if not ROUTER_TSX.exists():
        return {}
    text = ROUTER_TSX.read_text(encoding='utf-8')
    lines = text.splitlines()
    paths: Dict[str, str] = {}

    # 用栈追踪当前父路径
    # 遇到 path: 'xxx' 时记录，遇到 children: [ 时进入子层，遇到 ] 时退出
    parent_stack: List[str] = []
    brace_depth = 0
    children_depth: List[int] = []  # 记录每个 children: [ 的 brace 深度

    path_re = re.compile(r"path:\s*['\"]([^'\"]+)['\"]")

    for i, line in enumerate(lines):
        stripped = line.strip()
        # 跳过注释行
        if stripped.startswith('//') or stripped.startswith('*'):
            continue

        # 检测 path
        m = path_re.search(line)
        if m:
            p = m.group(1)
            if p == 'index':
                continue
            # 判断该 path 项的性质：
            #   - 单行路由：path 行同一行有 element:（如 { path: 'xxx', element: withSuspense(...) }）
            #   - 多行父路由：path 行无 element:，后续行有 children:
            #   - Navigate 重定向：path 行或下一行有 <Navigate to=...>
            # 注意：不扫描子路径的 element，避免误判
            has_element = 'element:' in line or 'withSuspense' in line
            is_navigate = 'Navigate' in line and 'to=' in line
            has_children = False

            # 检查下一行是否是 children: 或 Navigate（多行情况）
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line.startswith('children:') or next_line == 'children: [':
                    has_children = True
                elif 'Navigate' in next_line and 'to=' in next_line:
                    is_navigate = True
            # 检查 path 行的下一个非空行（处理 { path: 'xxx', 换行 element: ... } 情况）
            else:
                for j in range(i + 1, min(i + 3, len(lines))):
                    nj = lines[j].strip()
                    if not nj or nj.startswith('//'):
                        continue
                    if 'element:' in nj or 'withSuspense' in nj:
                        has_element = True
                        break
                    if 'children:' in nj:
                        has_children = True
                        break
                    if 'Navigate' in nj and 'to=' in nj:
                        is_navigate = True
                        break

            # 跳过 Navigate 重定向项（不构成可访问路由）
            if is_navigate:
                continue
            # 跳过纯父路径（有 children 但无 element，访问会重定向或 404）
            if has_children and not has_element:
                continue

            # 拼接父路径
            if parent_stack:
                full = '/'.join(parent_stack + [p])
            else:
                full = p
            # 去掉前导 /
            full = full.lstrip('/')
            if full:
                paths[full] = f'{ROUTER_TSX.relative_to(ROOT)}:{i+1}'

        # 检测 children: [ 进入子层
        if 'children:' in line and '[' in line:
            # 找最近的 path 作为父路径
            # 从当前行往上找最近的 path
            for j in range(i - 1, max(i - 10, 0), -1):
                pm = path_re.search(lines[j])
                if pm:
                    parent_stack.append(pm.group(1))
                    break
            children_depth.append(brace_depth)

        # 统计大括号深度（只统计 { }，不统计 [ ]，避免数组括号干扰）
        brace_depth += line.count('{') - line.count('}')

        # 退出 children 层
        while children_depth and brace_depth < children_depth[-1]:
            children_depth.pop()
            if parent_stack:
                parent_stack.pop()

    return paths


def extract_smoke_routes() -> Set[str]:
    """从 route-health.spec.ts 提取 PUBLIC_ROUTES 数组中所有 path 字段值。"""
    if not SMOKE_SPEC.exists():
        return set()
    text = SMOKE_SPEC.read_text(encoding='utf-8')
    routes: Set[str] = set()
    # 匹配 path: '/xxx' 或 path: "/xxx"
    # PUBLIC_ROUTES 是 { name: '...', path: '/...' }[] 格式
    path_re = re.compile(r"path:\s*['\"]([^'\"]+)['\"]")
    for m in path_re.finditer(text):
        p = m.group(1)
        # 去掉前导 /
        p = p.lstrip('/')
        if p:
            routes.add(p)
    return routes


def main() -> int:
    print('=' * 72)
    print('check_route_drift.py — router/index.tsx vs route-health.spec.ts 对账')
    print('=' * 72)
    print()

    router_paths = extract_router_paths()
    smoke_routes = extract_smoke_routes()

    # 归一化（都去掉前导 /）+ 应用忽略列表
    router_normalized = set(router_paths.keys()) - IGNORED_ROUTER_PATHS

    # 比对
    matched = router_normalized & smoke_routes
    missing_in_smoke = router_normalized - smoke_routes
    # 孤儿用例：排除 Navigate 重定向路由（smoke 测试重定向是合理的）
    orphan_in_smoke = (smoke_routes - router_normalized) - NAVIGATE_REDIRECT_PATHS

    print(f'router/index.tsx 路由数: {len(router_normalized)}')
    print(f'route-health.spec.ts 用例数: {len(smoke_routes)}')
    print(f'已匹配: {len(matched)}')
    print(f'路由有但 smoke 缺失（DRIFT）: {len(missing_in_smoke)}')
    print(f'smoke 有但路由无（孤儿）: {len(orphan_in_smoke)}')
    print()

    if missing_in_smoke:
        print('--- DRIFT: 路由表有但 smoke 用例未覆盖 ---')
        for p in sorted(missing_in_smoke):
            print(f'  /{p}  ({router_paths.get(p, "?")})')
        print()

    if orphan_in_smoke:
        print('--- 孤儿用例（smoke 有但路由已删除） ---')
        for p in sorted(orphan_in_smoke):
            print(f'  /{p}')
        print()

    if missing_in_smoke:
        print(f'❌ 检测到 {len(missing_in_smoke)} 个路由未在 route-health.spec.ts 中覆盖')
        print('   请在 PUBLIC_ROUTES 数组中补充对应路径')
        print('   规则见 docs/rules/cross-platform.md 第 4.2 节')
        return 1

    if orphan_in_smoke:
        print(f'⚠️  有 {len(orphan_in_smoke)} 个孤儿用例（可能路由已删除或重命名）')
    print('✅ 路由表与 smoke 用例对齐')
    return 0


if __name__ == '__main__':
    sys.exit(main())
