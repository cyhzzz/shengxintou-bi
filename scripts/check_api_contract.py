#!/usr/bin/env python3
"""
对账后端 Flask API 与前端 mobileRouteHandler 的 case 分支。

退出码：
  0 = 无 drift
  1 = 检测到 drift（后端有但 mobileRouteHandler 没有，或反之）

详细规则见 docs/rules/cross-platform.md。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

ROOT = Path(__file__).resolve().parents[1]
ROUTES_DIR = ROOT / 'backend' / 'routes'
APP_PY = ROOT / 'app.py'
MOBILE_HANDLER = ROOT / 'frontend-react' / 'src' / 'services' / 'mobileRouteHandler.ts'

# 移动端/PWA 故意不实现的端点（见 docs/rules/cross-platform.md 第 7 节）
MOBILE_IGNORED_PREFIXES: Tuple[str, ...] = (
    '/upload',
    '/status/',           # upload status
    '/history',           # upload history
    '/data-types',
    '/webdav',            # WebDAV 管理（仅桌面端）
    '/version',           # 版本检查（仅桌面端）
    '/system/self-update',
    '/system/data-sync',  # Supabase 同步（已封存）
    '/data-sync',         # Supabase 同步（蓝图 url_prefix=/api/v1/data-sync）
    '/data-reconciliation',  # 抖音青鸟对账（仅桌面端）
    '/account-mapping',
    '/account-agency-mapping',
    '/config',            # 系统配置（仅桌面端）
    '/weekly-report/poster',  # 海报预览/导出（仅桌面端）
    '/external-data-analysis',  # 外部数据分析（移动端无此页面）
    '/employees',         # query.py 旧员工列表接口（已被 employee-conversion/employees 替代）
    '/query',             # query.py 通用查询接口（旧）
    '/summary',           # query.py 通用摘要接口（旧；不影响 reports/*/summary）
)

# 周报 periods/data 是公共端点，移动端通过 reports/weekly/* 路径访问
WEEKLY_OVERRIDE: Dict[str, str] = {
    '/periods': 'reports/weekly/periods',
    '/data': 'reports/weekly/data',
}

# 已知 drift：历史遗留的未实现端点，记录在此供后续逐步补齐
# 新增 drift 不允许加入此列表，必须在 mobileRouteHandler 补实现
# 格式：{端点路径: 补实现优先级（high/medium/low）}
KNOWN_DRIFT: Dict[str, str] = {
    'conversion-funnel': 'high',              # 漏斗主接口，ConversionFunnel 页面用
    'dashboard/accounts': 'medium',            # Dashboard 账户列表
    'data-freshness': 'low',                  # 数据更新时间显示
    'employee-conversion/employees': 'medium', # 员工下拉选项
    'trend': 'medium',                        # 趋势主接口
    'trend/daily': 'medium',                  # 日趋势
}

# mobileRouteHandler 中 case 路径与后端路由的别名映射
# key = 后端归一化路径，value = mobileRouteHandler case 路径
CASE_ALIASES: Dict[str, str] = {
    'xhs-notes-list': 'xhs-notes-list',  # 同时支持两种写法，case 已覆盖
    'xhs-notes/list': 'xhs-notes/list',
}


def extract_blueprint_prefixes() -> Dict[str, str]:
    """从 app.py 提取蓝图名 → url_prefix 映射。"""
    prefixes: Dict[str, str] = {}
    if not APP_PY.exists():
        return prefixes
    text = APP_PY.read_text(encoding='utf-8')
    # 匹配 register_blueprint(xxx.bp, url_prefix='/api/v1/yyy')
    for m in re.finditer(
        r'register_blueprint\(\s*([\w.]+)\.bp\s*,\s*url_prefix\s*=\s*[\'"]([^\'"]+)[\'"]',
        text,
    ):
        module_path, prefix = m.group(1), m.group(2)
        # module_path 形如 reports.app_market 或 webdav_backup，取最后一段作 key
        blueprint_name = module_path.split('.')[-1]
        prefixes[blueprint_name] = prefix
    return prefixes


def extract_routes_from_python(file_path: Path, blueprint_prefix: str) -> List[Tuple[str, str]]:
    """
    从 Python 路由文件提取所有 @bp.route('/xxx', methods=[...])。

    返回 [(完整 URL, 文件:行号), ...]
    """
    routes: List[Tuple[str, str]] = []
    if not file_path.exists():
        return routes
    text = file_path.read_text(encoding='utf-8')
    lines = text.splitlines()
    bp_def_re = re.compile(
        r'Blueprint\(\s*[\'"][\w_]+[\'"]\s*,\s*__name__\s*(?:,\s*url_prefix\s*=\s*[\'"]([^\'"]+)[\'"])?'
    )
    # 文件内 url_prefix（Blueprint 定义时）
    file_prefix = blueprint_prefix
    for i, line in enumerate(lines):
        m = bp_def_re.search(line)
        if m and m.group(1):
            file_prefix = m.group(1)

    route_re = re.compile(r'@bp\.route\(\s*[\'"]([^\'"]+)[\'"]\s*(?:,\s*methods\s*=\s*\[[^\]]*\])?\s*\)')
    for i, line in enumerate(lines):
        m = route_re.search(line)
        if m:
            path = m.group(1)
            # 跳过含 <...> 的动态路由（如 /<config_key>）—— 移动端不实现这些
            if '<' in path and '>' in path:
                continue
            # 拼接完整 URL
            if path.startswith('/api/v1/'):
                full = path
            elif file_prefix and not path.startswith('/'):
                # file_prefix 已含 /api/v1/xxx
                full = f"{file_prefix.rstrip('/')}/{path.lstrip('/')}"
            elif file_prefix and path.startswith('/'):
                full = f"{file_prefix.rstrip('/')}{path}"
            else:
                full = path
            # 去重（同一 URL 可能多个 methods 共用一行）
            routes.append((full, f"{file_path.relative_to(ROOT)}:{i+1}"))
    return routes


def collect_backend_routes() -> Dict[str, str]:
    """收集所有后端 API 端点。返回 {归一化路径: 文件:行号}。"""
    prefixes = extract_blueprint_prefixes()
    all_routes: Dict[str, str] = {}

    # 遍历 routes/ 下所有 .py
    for py in ROUTES_DIR.rglob('*.py'):
        if py.name == '__init__.py':
            continue
        # 找出文件所属的蓝图 url_prefix
        # 通过文件路径推断：routes/data/dashboard.py 的蓝图名是 'dashboard'
        # 实际 app.py 用 import xxx as xxx 形式，从文件名推断更稳
        module_name = py.stem  # 'dashboard'
        # 从 app.py register_blueprint 调用中找对应的 url_prefix
        # 简化：在 app.py 中搜索 'from backend.routes.xxx import yyy as yyy'
        # 但实际上多数蓝图在文件内 Blueprint() 不带 url_prefix，由 app.py 注册时传入
        # 所以用 extract_routes_from_python 时先读文件内的 url_prefix，没有就空
        # 然后用 app.py 中的 register_blueprint(bp, url_prefix=...) 找
        # 这里简化：从文件内 Blueprint() 提取 url_prefix；如果文件内没设，用 app.py 中的
        file_text = py.read_text(encoding='utf-8')
        bp_match = re.search(
            r'Blueprint\(\s*[\'"][\w_]+[\'"]\s*,\s*__name__\s*(?:,\s*url_prefix\s*=\s*[\'"]([^\'"]+)[\'"])?',
            file_text,
        )
        if bp_match and bp_match.group(1):
            prefix = bp_match.group(1)
        else:
            # 从 app.py 找：register_blueprint(module_name.bp, url_prefix='/api/v1/xxx')
            # app.py 的 import 形如 'from backend.routes.data.dashboard import bp as dashboard_bp' 等
            # 简化：在 app.py 文本中查找 'register_blueprint(<module_name>.bp, url_prefix=...)'
            app_text = APP_PY.read_text(encoding='utf-8') if APP_PY.exists() else ''
            m2 = re.search(
                rf'register_blueprint\(\s*(?:[\w.]+\.)*{re.escape(module_name)}\.bp\s*,\s*url_prefix\s*=\s*[\'"]([^\'"]+)[\'"]',
                app_text,
            )
            prefix = m2.group(1) if m2 else '/api/v1'

        routes = extract_routes_from_python(py, prefix)
        for url, loc in routes:
            # 归一化：去掉 /api/v1/ 前缀
            norm = url
            if norm.startswith('/api/v1/'):
                norm = norm[len('/api/v1/'):]
            elif norm == '/api/v1':
                norm = ''
            # 跳过空路径
            if not norm:
                continue
            all_routes[norm] = loc

    return all_routes


def extract_mobile_cases() -> Set[str]:
    """从 mobileRouteHandler.ts 提取所有 case 路径。"""
    if not MOBILE_HANDLER.exists():
        return set()
    text = MOBILE_HANDLER.read_text(encoding='utf-8')
    # 匹配 case 'xxx': 或 case "xxx":
    case_re = re.compile(r"^\s*case\s+['\"]([^'\"]+)['\"]\s*:", re.MULTILINE)
    return set(case_re.findall(text))


def is_ignored(path: str) -> bool:
    """判断后端路径是否在移动端忽略列表中。"""
    full = f'/{path}' if not path.startswith('/') else path
    for prefix in MOBILE_IGNORED_PREFIXES:
        if full.startswith(prefix):
            return True
        # 周报特殊处理：后端 /reports/weekly/periods 移动端是 reports/weekly/periods
        # 这里 prefix 不包含 weekly，单独处理
    return False


def normalize_for_compare(path: str) -> str:
    """统一比较用的归一化（去尾部斜杠）。"""
    return path.rstrip('/')


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    print('=' * 72)
    print('check_api_contract.py — 后端 API vs mobileRouteHandler 对账')
    print('=' * 72)
    print()

    backend_routes = collect_backend_routes()
    mobile_cases = extract_mobile_cases()

    # 后端有、mobileRouteHandler 也实现了的（匹配）
    matched: List[Tuple[str, str, str]] = []
    # 后端有、mobileRouteHandler 没实现、但在忽略列表中（OK）
    ignored: List[Tuple[str, str]] = []
    # 已知 drift（历史遗留，记录在 KNOWN_DRIFT 中）
    known_drifts: List[Tuple[str, str, str]] = []
    # 新 drift（必须修复）
    new_drifts: List[Tuple[str, str]] = []
    # mobileRouteHandler 有、后端没有（可能已删除，或手写的辅助端点）
    orphan_in_mobile: List[str] = []

    for path, loc in backend_routes.items():
        if path in mobile_cases:
            matched.append((path, loc, 'mobileRouteHandler.ts'))
            continue
        if is_ignored(path):
            ignored.append((path, loc))
            continue
        # 周报覆盖
        if path in WEEKLY_OVERRIDE:
            target = WEEKLY_OVERRIDE[path]
            if target in mobile_cases:
                matched.append((path, loc, 'mobileRouteHandler.ts (alias)'))
                continue
        # 检查是否为已知 drift
        if path in KNOWN_DRIFT:
            known_drifts.append((path, loc, KNOWN_DRIFT[path]))
            continue
        # 新 drift！
        new_drifts.append((path, loc))

    for case in mobile_cases:
        if case not in backend_routes and case not in WEEKLY_OVERRIDE.values():
            # 一些移动端独有的辅助 case（如 metadata）是手写的，不算 drift
            # 这里只标记真正孤立的
            orphan_in_mobile.append(case)

    # 输出
    print(f'后端 API 端点总数: {len(backend_routes)}')
    print(f'mobileRouteHandler case 总数: {len(mobile_cases)}')
    print(f'已匹配: {len(matched)}')
    print(f'忽略（移动端不需要）: {len(ignored)}')
    print(f'已知 drift（历史遗留，待逐步补齐）: {len(known_drifts)}')
    print(f'新 drift（必须修复）: {len(new_drifts)}')
    print(f'mobile 有但后端无（孤儿）: {len(orphan_in_mobile)}')
    print()

    if known_drifts:
        print('--- 已知 drift（历史遗留，记录在 KNOWN_DRIFT，不影响 CI） ---')
        print(f'{"端点路径":<45} {"优先级":<10} {"后端位置":<40}')
        print('-' * 95)
        for path, loc, prio in sorted(known_drifts, key=lambda x: x[0]):
            print(f'{path:<45} {prio:<10} {loc:<40}')
        print()

    if new_drifts:
        print('--- 新 drift（必须修复） ---')
        print(f'{"端点路径":<50} {"后端位置":<40}')
        print('-' * 92)
        for path, loc in sorted(new_drifts):
            print(f'{path:<50} {loc:<40}')
        print()

    if orphan_in_mobile:
        print('--- 孤儿 case（mobile 有但后端无对应 @bp.route） ---')
        for c in sorted(orphan_in_mobile):
            print(f'  {c}')
        print()
        print('说明：mobileRouteHandler 手写的辅助 case（如 metadata）属正常孤儿，')
        print('      仅当出现真正应删除的旧 case 时需要处理。')
        print()

    # 退出码：只有新 drift 才报错
    if new_drifts:
        print(f'❌ 检测到 {len(new_drifts)} 个新 drift，需在 mobileRouteHandler.ts 补充对应 case')
        print('   规则见 docs/rules/cross-platform.md 第 4.1 节')
        print('   若确属移动端不需要的端点，应加入 MOBILE_IGNORED_PREFIXES 而非 KNOWN_DRIFT')
        return 1

    if known_drifts:
        print(f'⚠️  有 {len(known_drifts)} 个已知 drift 待逐步补齐（不影响 CI）')
    print('✅ 无新 drift，后端 API 与 mobileRouteHandler 对齐')
    return 0


if __name__ == '__main__':
    sys.exit(main())
