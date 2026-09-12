#!/usr/bin/env python3
"""
对账「人工双写清单」在后端与前端的一致性，防双写漂移。

当前守护两类清单：

A. 逐表同步表清单（三处双写）：
   1. 表名与顺序：backend table_sync.SYNC_TABLES（权威源）
      ↔ frontend dataService.SYNC_TABLE_META
      ↔ frontend mobileTableSync.MOBILE_SYNC_TABLES 三方必须完全一致
   2. 后端内部自洽：SYNC_TABLES = DIM_TABLES ∪ TABLE_DATE_COLS 键集合（不重不漏）
   3. 前端 type 与后端一致：dim 表 ∈ DIM_TABLES；fact 表 ∈ TABLE_DATE_COLS
   4. 前端 dateCol 与后端 TABLE_DATE_COLS 值一致（dim 表不得带 dateCol）

B. 员工转化坐席名单（两处双写，v3.1.30 起已知知情项，2027 人员变动时需人工更新，
   本脚本只守护「两端一致」，不解决名单本身过时）：
   5. backend employee_conversion.WEEKLY_ASSISTANTS
      ↔ frontend mobileHandlers/employee.EMP_WEEKLY_ASSISTANTS 顺序与内容完全一致

以上清单此前仅靠注释人工对齐，无脚本守护。改动任一清单时必须跑本脚本收尾；
见 docs/rules/cross-platform.md 第 2、3 节。

退出码：
  0 = 无 drift
  1 = 检测到 drift
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
BACKEND_TABLE_SYNC = ROOT / 'backend' / 'utils' / 'table_sync.py'
MOBILE_TABLE_SYNC = ROOT / 'frontend-react' / 'src' / 'services' / 'mobileTableSync.ts'
DATA_SERVICE = ROOT / 'frontend-react' / 'src' / 'services' / 'dataService.ts'
EMPLOYEE_PY = ROOT / 'backend' / 'routes' / 'data' / 'employee_conversion.py'
EMPLOYEE_TS = ROOT / 'frontend-react' / 'src' / 'services' / 'mobileHandlers' / 'employee.ts'


def _parse_py_str_list(path: Path, var_name: str) -> List[str]:
    """AST 解析 Python 模块级 `VAR = ['a', 'b', ...]` 字符串列表（不 import，零环境依赖）。"""
    tree = ast.parse(path.read_text(encoding='utf-8'))
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
        if var_name in targets and isinstance(node.value, ast.List):
            return [ast.literal_eval(e) for e in node.value.elts]
    return []


def _parse_py_str_dict(path: Path, var_name: str) -> Dict[str, str]:
    """AST 解析 Python 模块级 `VAR = {'k': 'v', ...}` 字符串字典。"""
    tree = ast.parse(path.read_text(encoding='utf-8'))
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
        if var_name in targets and isinstance(node.value, ast.Dict):
            return {
                ast.literal_eval(k): ast.literal_eval(v)
                for k, v in zip(node.value.keys, node.value.values)
            }
    return {}


# 匹配 TS 条目：{ name: 'x', [label: 'y',] type: 'dim'|'fact' [, dateCol: 'z'] }
_ENTRY_RE = re.compile(
    r"\{\s*name:\s*'([^']+)'\s*,\s*(?:label:\s*'[^']*'\s*,\s*)?"
    r"type:\s*'(dim|fact)'\s*(?:,\s*dateCol:\s*'([^']*)')?\s*,?\s*\}"
)


def _parse_ts_tables(path: Path, const_name: str) -> List[Tuple[str, str, Optional[str]]]:
    """从 TS 文件提取 const <const_name> 数组内的 (name, type, dateCol) 列表。"""
    text = path.read_text(encoding='utf-8')
    m = re.search(r'const\s+' + const_name + r'[^=]*=\s*\[(.*?)\];', text, re.DOTALL)
    if not m:
        return []
    return [
        (name, typ, date_col if date_col else None)
        for name, typ, date_col in _ENTRY_RE.findall(m.group(1))
    ]


def _parse_ts_str_list(path: Path, const_name: str) -> List[str]:
    """从 TS 文件提取 const <const_name> = ['a', 'b', ...] 的字符串列表。"""
    text = path.read_text(encoding='utf-8')
    m = re.search(r'const\s+' + const_name + r'[^=]*=\s*\[(.*?)\];', text, re.DOTALL)
    if not m:
        return []
    return re.findall(r"'([^']+)'", m.group(1))


def check_sync_tables(errors: List[str]) -> Tuple[List[str], Dict[str, str]]:
    """A 组：逐表同步表清单三处对账，返回 (后端表序, 后端类型映射) 供表格输出。"""
    backend_tables = _parse_py_str_list(BACKEND_TABLE_SYNC, 'SYNC_TABLES')
    backend_dims = _parse_py_str_list(BACKEND_TABLE_SYNC, 'DIM_TABLES')
    backend_date_cols = _parse_py_str_dict(BACKEND_TABLE_SYNC, 'TABLE_DATE_COLS')
    web_tables = _parse_ts_tables(DATA_SERVICE, 'SYNC_TABLE_META')
    mobile_tables = _parse_ts_tables(MOBILE_TABLE_SYNC, 'MOBILE_SYNC_TABLES')

    backend_names = list(backend_tables)
    web_names = [name for name, _, _ in web_tables]
    mobile_names = [name for name, _, _ in mobile_tables]

    if not backend_names:
        errors.append('后端 SYNC_TABLES 解析结果为空（解析失败或文件缺失）')
    if not web_names:
        errors.append('dataService.SYNC_TABLE_META 解析结果为空（解析失败或文件缺失）')
    if not mobile_names:
        errors.append('mobileTableSync.MOBILE_SYNC_TABLES 解析结果为空（解析失败或文件缺失）')
    if not backend_names:
        return backend_names, {}

    # 1. 三方表名与顺序一致
    if backend_names != web_names:
        errors.append(
            f'表清单不一致 backend vs dataService.SYNC_TABLE_META：'
            f' backend={backend_names} web={web_names}'
        )
    if backend_names != mobile_names:
        errors.append(
            f'表清单不一致 backend vs mobileTableSync.MOBILE_SYNC_TABLES：'
            f' backend={backend_names} mobile={mobile_names}'
        )

    # 2. 后端内部自洽：DIM_TABLES ∪ TABLE_DATE_COLS 不重不漏覆盖 SYNC_TABLES
    dim_set, fact_set = set(backend_dims), set(backend_date_cols)
    overlap = dim_set & fact_set
    if overlap:
        errors.append(f'后端内部：DIM_TABLES 与 TABLE_DATE_COLS 重复定义: {sorted(overlap)}')
    covered = dim_set | fact_set
    if covered != set(backend_names):
        errors.append(
            f'后端内部：DIM_TABLES ∪ TABLE_DATE_COLS 未恰好覆盖 SYNC_TABLES'
            f' missing={sorted(set(backend_names) - covered)}'
            f' extra={sorted(covered - set(backend_names))}'
        )
    backend_type = {t: ('dim' if t in dim_set else 'fact') for t in backend_names}

    # 3. 前端 type 对账（SYNC_TABLE_META 与 MOBILE_SYNC_TABLES 都查）
    for label, entries in (('SYNC_TABLE_META', web_tables), ('MOBILE_SYNC_TABLES', mobile_tables)):
        for name, typ, _ in entries:
            if name not in backend_type:
                continue  # 名单差异已在第 1 步报过，避免重复噪音
            if typ != backend_type[name]:
                errors.append(f'{label}: {name} type={typ}，后端应为 {backend_type[name]}')

    # 4. dateCol 对账：仅 MOBILE_SYNC_TABLES 有 dateCol 字段
    #    （SYNC_TABLE_META 接口只有 name/label/type，职责是 Sync 页展示，无 dateCol 属正常）
    for name, _, date_col in mobile_tables:
        if name not in backend_type:
            continue
        expect_date = backend_date_cols.get(name)
        if date_col != expect_date:
            errors.append(
                f'MOBILE_SYNC_TABLES: {name} dateCol={date_col!r}，后端 TABLE_DATE_COLS={expect_date!r}'
            )
    return backend_names, backend_type


def check_weekly_assistants(errors: List[str]) -> Tuple[List[str], List[str]]:
    """B 组：坐席名单两端对账，返回 (后端名单, 移动端名单) 供表格输出。"""
    backend = _parse_py_str_list(EMPLOYEE_PY, 'WEEKLY_ASSISTANTS')
    mobile = _parse_ts_str_list(EMPLOYEE_TS, 'EMP_WEEKLY_ASSISTANTS')
    if not backend:
        errors.append('后端 WEEKLY_ASSISTANTS 解析结果为空（解析失败或文件缺失）')
    if not mobile:
        errors.append('移动端 EMP_WEEKLY_ASSISTANTS 解析结果为空（解析失败或文件缺失）')
    if backend and mobile and backend != mobile:
        only_b = [x for x in backend if x not in mobile]
        only_m = [x for x in mobile if x not in backend]
        errors.append(
            f'坐席名单不一致 backend WEEKLY_ASSISTANTS vs mobile EMP_WEEKLY_ASSISTANTS'
            f'（仅后端={only_b} 仅移动端={only_m} 顺序或数量差异需人工比对）'
        )
    return backend, mobile


def main() -> int:
    print('检查范围：人工双写清单对账（A 逐表同步表清单 × 3 处 / B 坐席名单 × 2 处）')
    print(f'  A 权威: backend/utils/table_sync.py (SYNC_TABLES / DIM_TABLES / TABLE_DATE_COLS)')
    print(f'  A Web:  frontend-react/src/services/dataService.ts (SYNC_TABLE_META)')
    print(f'  A 移动: frontend-react/src/services/mobileTableSync.ts (MOBILE_SYNC_TABLES)')
    print(f'  B 后端: backend/routes/data/employee_conversion.py (WEEKLY_ASSISTANTS)')
    print(f'  B 移动: frontend-react/src/services/mobileHandlers/employee.ts (EMP_WEEKLY_ASSISTANTS)')
    print()

    errors: List[str] = []
    backend_names, backend_type = check_sync_tables(errors)
    assistants, assistants_mobile = check_weekly_assistants(errors)

    # A 组对账表格
    web_names = [n for n, _, _ in _parse_ts_tables(DATA_SERVICE, 'SYNC_TABLE_META')]
    mobile_names = [n for n, _, _ in _parse_ts_tables(MOBILE_TABLE_SYNC, 'MOBILE_SYNC_TABLES')]
    web_set, mobile_set = set(web_names), set(mobile_names)
    backend_date_cols = _parse_py_str_dict(BACKEND_TABLE_SYNC, 'TABLE_DATE_COLS')
    print('A. 逐表同步表清单：')
    print(f'  {"表名":<26}{"类型":<6}{"日期列":<10}{"Web":<6}{"移动":<6}')
    print('  ' + '-' * 56)
    for name in backend_names:
        typ = backend_type.get(name, '?')
        date_col = backend_date_cols.get(name, '-')
        in_web = '✓' if name in web_set else '✗'
        in_mobile = '✓' if name in mobile_set else '✗'
        print(f'  {name:<26}{typ:<6}{date_col:<10}{in_web:<6}{in_mobile:<6}')
    extra_rows = (web_set | mobile_set) - set(backend_names)
    for name in sorted(extra_rows):
        print(f'  {name:<26}{"?":<6}{"-":<10}{"✓" if name in web_set else "✗":<6}'
              f'{"✓" if name in mobile_set else "✗":<6}  <- 仅前端存在')
    print()

    # B 组对账表格
    print('B. 员工转化坐席名单（知情项：2027 人员变动时需人工更新，本脚本只守护两端一致）：')
    print(f'  后端 {len(assistants)} 人 / 移动端 {len(assistants_mobile)} 人')
    print(f'  名单: {assistants}')
    print()

    if errors:
        print(f'[FAIL] 检测到 {len(errors)} 处 drift：')
        for e in errors:
            print(f'  - {e}')
        return 1
    print(f'[PASS] 全部双写清单一致（{len(backend_names)} 张同步表 + {len(assistants)} 人坐席名单）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
