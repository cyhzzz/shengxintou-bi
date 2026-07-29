#!/usr/bin/env python3
"""
对账 frontend-react/src/config/features.ts 中声明的 featureFlag 与实际使用点。

检测三类 drift：
  1. 声明但未使用：features.ts 接口声明了字段，但 router/MainLayout/components 从未引用
     → 死代码，应删除字段或补使用点
  2. 使用但未声明：代码中 featureFlags.showXxx 引用了接口中未声明的字段
     → TS 应该已经报错，但脚本作为冗余检查保留
  3. 桌面/Web 配置和移动端配置不对称：desktopAndWebFlags / mobileFlags 中某个 flag
     的存在性应一致（值可以不同，但字段必须同时存在）
     → 防止新增 flag 时漏配某一端

退出码：
  0 = 无 drift
  1 = 检测到 drift

详细规则见 docs/rules/cross-platform.md 第 4.3 节。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, Set

ROOT = Path(__file__).resolve().parents[1]
FEATURES_TS = ROOT / 'frontend-react' / 'src' / 'config' / 'features.ts'
# 扫描实际使用 featureFlags.<name> 的源码目录
SCAN_DIRS = [
    ROOT / 'frontend-react' / 'src',
]

# 已知不使用但保留的 flag（注释说明原因，等价于 KNOWN_DRIFT）
# 新增 drift 不允许加入此列表，必须修复（删除字段或补使用点）
KNOWN_UNUSED: Dict[str, str] = {
    # 'showXxx': '原因说明',
}


def extract_declared_flags() -> Set[str]:
    """从 features.ts 的 FeatureFlags 接口中提取所有声明的字段名。"""
    if not FEATURES_TS.exists():
        return set()
    text = FEATURES_TS.read_text(encoding='utf-8')
    # 匹配 interface FeatureFlags { ... } 块内 `xxx: boolean;` 形式
    # 仅取接口块（从 interface FeatureFlags { 到下一个 }）
    m = re.search(r'interface\s+FeatureFlags\s*\{([^}]+)\}', text, re.DOTALL)
    if not m:
        return set()
    body = m.group(1)
    flags: Set[str] = set()
    for line in body.splitlines():
        # 形如 `  /** 注释 */` 跳过
        # 形如 `  showXxx: boolean;`
        fm = re.search(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*boolean\s*;', line)
        if fm:
            flags.add(fm.group(1))
    return flags


def extract_flag_usage() -> Dict[str, list]:
    """扫描 frontend-react/src 下所有 .ts/.tsx 文件中 featureFlags.<name> 的引用。

    返回 {flag_name: [文件:行号, ...]}（不含 features.ts 本身）。
    """
    usage: Dict[str, list] = {}
    # 匹配 featureFlags.showXxx（不含 .ts 文件本身的声明和注释）
    usage_re = re.compile(r'\bfeatureFlags\.([a-zA-Z][a-zA-Z0-9_]*)\b')
    for scan_dir in SCAN_DIRS:
        for ts_file in scan_dir.rglob('*.ts*'):
            # 跳过 features.ts 本身（声明文件）
            if ts_file.resolve() == FEATURES_TS.resolve():
                continue
            try:
                text = ts_file.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError):
                continue
            for i, line in enumerate(text.splitlines(), 1):
                # 跳过注释行
                stripped = line.strip()
                if stripped.startswith('//') or stripped.startswith('*'):
                    continue
                for m in usage_re.finditer(line):
                    flag = m.group(1)
                    rel = ts_file.relative_to(ROOT).as_posix()
                    usage.setdefault(flag, []).append(f"{rel}:{i}")
    return usage


def extract_config_objects() -> Dict[str, Set[str]]:
    """提取 desktopAndWebFlags 和 mobileFlags 两个配置对象中赋值的字段名集合。"""
    if not FEATURES_TS.exists():
        return {}
    text = FEATURES_TS.read_text(encoding='utf-8')
    result: Dict[str, Set[str]] = {}
    # 匹配 const xxxFlags: FeatureFlags = { ... }
    obj_re = re.compile(
        r'const\s+(\w+Flags)\s*:\s*FeatureFlags\s*=\s*\{([^}]+)\}',
        re.DOTALL,
    )
    for m in obj_re.finditer(text):
        name, body = m.group(1), m.group(2)
        flags: Set[str] = set()
        for line in body.splitlines():
            fm = re.search(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(?:true|false)\s*,?\s*$', line)
            if fm:
                flags.add(fm.group(1))
        result[name] = flags
    return result


def main() -> int:
    print('=' * 72)
    print('check_feature_flags.py — features.ts 声明 vs 实际使用对账')
    print('=' * 72)
    print()

    declared = extract_declared_flags()
    usage = extract_flag_usage()
    configs = extract_config_objects()

    print(f'FeatureFlags 接口声明字段数: {len(declared)}')
    print(f'配置对象数: {len(configs)}（{" / ".join(configs.keys())}）')
    print(f'实际使用文件位置引用总数: {sum(len(v) for v in usage.values())}')
    print()

    # 检测 1：声明但未使用
    unused = declared - set(usage.keys())
    new_unused = unused - set(KNOWN_UNUSED.keys())
    known_unused_present = unused & set(KNOWN_UNUSED.keys())

    # 检测 2：使用但未声明
    used_not_declared = set(usage.keys()) - declared

    # 检测 3：配置对象不对称
    config_names = list(configs.keys())
    asymmetry: list = []
    if len(config_names) >= 2:
        base = configs[config_names[0]]
        for name in config_names[1:]:
            other = configs[name]
            only_in_base = base - other
            only_in_other = other - base
            if only_in_base or only_in_other:
                asymmetry.append((config_names[0], name, only_in_base, only_in_other))

    # 输出
    if known_unused_present:
        print('--- 已知未使用（记录在 KNOWN_UNUSED，不影响 CI） ---')
        for flag in sorted(known_unused_present):
            reason = KNOWN_UNUSED.get(flag, '')
            print(f'  {flag:<30}  {reason}')
        print()

    if new_unused:
        print('--- DRIFT: 声明但未使用的 flag（死代码） ---')
        for flag in sorted(new_unused):
            print(f'  {flag}')
        print('  → 删除该字段，或在 router/MainLayout 中补使用点')
        print()

    if used_not_declared:
        print('--- DRIFT: 使用但未声明的 flag ---')
        for flag in sorted(used_not_declared):
            locs = usage[flag][:3]  # 只显示前3处
            print(f'  {flag}  →  {", ".join(locs)}')
        print('  → 在 features.ts 的 FeatureFlags 接口中补声明')
        print()

    if asymmetry:
        print('--- DRIFT: 配置对象字段不对称 ---')
        for base_name, other_name, only_base, only_other in asymmetry:
            if only_base:
                print(f'  仅 {base_name} 有: {sorted(only_base)}')
            if only_other:
                print(f'  仅 {other_name} 有: {sorted(only_other)}')
        print('  → 两个配置对象的字段集必须一致（值可以不同）')
        print()

    # 退出码
    has_drift = bool(new_unused) or bool(used_not_declared) or bool(asymmetry)
    if has_drift:
        print('❌ 检测到 featureFlags drift，需按上面提示修复')
        print('   规则见 docs/rules/cross-platform.md 第 4.3 节')
        return 1

    if known_unused_present:
        print(f'⚠️  有 {len(known_unused_present)} 个已知未使用 flag（不影响 CI）')
    print('✅ featureFlags 声明与使用对齐')
    return 0


if __name__ == '__main__':
    sys.exit(main())
