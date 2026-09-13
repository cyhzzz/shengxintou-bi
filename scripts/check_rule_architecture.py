#!/usr/bin/env python3
'''Read-only checks for the repository rule architecture.'''

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / 'AGENTS.md'
CLAUDE = ROOT / 'CLAUDE.md'
WORKSPACE_MEMORY = ROOT / '.workbuddy' / 'memory' / 'MEMORY.md'
RULES = ROOT / 'docs' / 'rules'
PROMPT = ROOT / 'docs' / '6a2aaa141b82ca7bef7bccb8_AI项目Spec规则构建Prompt.md'
MAX_LINES = 220
MAX_BYTES = 18_000

REQUIRED = (
    AGENTS,
    CLAUDE,
    PROMPT,
    RULES / 'README.md',
    RULES / 'overview.md',
    RULES / 'business-invariants.md',
    RULES / 'backend.md',
    RULES / 'frontend.md',
    RULES / 'cross-platform.md',
    RULES / 'testing-and-delivery.md',
    RULES / 'toolchain.md',
    RULES / 'workflows' / 'feature.md',
    RULES / 'workflows' / 'bugfix.md',
    RULES / 'templates' / 'tech-spec.md',
    ROOT / 'website' / 'index.html',
    ROOT / 'website' / 'app.js',
    ROOT / 'website' / 'styles.css',
)

ROOT_REFERENCES = (
    'version.json',
    'docs/rules/README.md',
    'docs/rules/overview.md',
    'docs/rules/business-invariants.md',
    'docs/rules/backend.md',
    'docs/rules/frontend.md',
    'docs/rules/cross-platform.md',
    'docs/rules/testing-and-delivery.md',
    'docs/rules/toolchain.md',
    'docs/rules/workflows/feature.md',
    'docs/rules/workflows/bugfix.md',
    'docs/rules/templates/tech-spec.md',
    'backend/config/anchor_live_types.json',
    'backend/processors/v2/raw_import.py',
    'frontend-react/src/types/api.ts',
    'website/',
    'scripts/check_filter_bar_usage.py',
    '.workbuddy/memory/MEMORY.md',
)

COVERAGE = {
    RULES / 'README.md': (
        '单一权威源',
        'version.json',
        'AGENTS.md',
        'CLAUDE.md',
        'docs/_archive/',
    ),
    RULES / 'business-invariants.md': (
        '_funnel_filters',
        '是否新开户 == 1',
        '是否为存量客户 == 0 OR IS NULL',
        'anchor_live_types.json',
        'qingniao_leads',
        'dim_account',
    ),
    RULES / 'backend.md': (
        'models_v2.py',
        'journal_mode=DELETE',
        'application context',
        'UPSTREAM_UNAVAILABLE',
    ),
    RULES / 'frontend.md': (
        'MetricCard',
        'ReportFooter',
        'FilterBar',
        'sanitizeText',
        'dataIndex',
        'api.ts',
        'check_filter_bar_usage.py',
    ),
    RULES / 'cross-platform.md': (
        'mobileRouteHandler',
        'featureFlags',
        'check_api_contract.py',
        'check_route_drift.py',
        'check_feature_flags.py',
        'check_mobile_routes_coverage.py',
        'KNOWN_DRIFT',
    ),
    RULES / 'testing-and-delivery.md': (
        'tests/api/test_smoke.py',
        'frontend-react/tests/smoke/',
        'scripts/pre-commit-check.bat',
        'version.json',
    ),
    RULES / 'toolchain.md': (
        'tools/jdk17/',
        'tools/platform-tools/',
        'assembleDebug',
        'build-installer.ps1',
    ),
}

PROMPT_MARKERS = (
    'Windows/PowerShell',
    'macOS/Linux/WSL',
    'AGENTS.md',
    'CLAUDE.md',
    'Cursor',
    'Trae',
    'GitHub Copilot',
    '单一权威源',
    '非破坏迁移',
    '可重复执行',
    '未经用户明确授权',
)

INTEGRATIONS = {
    ROOT / 'scripts' / 'pre-commit-check.bat': '%PY% scripts\\check_rule_architecture.py',
    ROOT / '.github' / 'workflows' / 'ci.yml': 'python scripts/check_rule_architecture.py',
    ROOT / '.github' / 'PULL_REQUEST_TEMPLATE.md': 'python scripts/check_rule_architecture.py',
}

# 跨端对账脚本必须在 CI workflow 中被引用
CROSS_PLATFORM_SCRIPTS_IN_CI = (
    'scripts/check_api_contract.py',
    'scripts/check_route_drift.py',
    'scripts/check_feature_flags.py',
    'scripts/check_mobile_routes_coverage.py',
)

# Encoding defense (root cause: Windows consoles default to cp1252; a missing
# PYTHONIOENCODING and a BOM-less Chinese ps1 each caused a real incident).
# PowerShell 5.1 relies solely on the UTF-8 BOM to decode sources — a
# Python-style `# -*- coding` comment is ineffective there. Note that .md files
# are the opposite: read_text() rejects their BOM, so ps1 checks stand alone.
PS1_DIRS = (
    ROOT / 'scripts',
    ROOT / 'android' / 'scripts',
)
PYTHON_WINDOWS_WORKFLOWS = (
    ROOT / '.github' / 'workflows' / 'ci.yml',
    ROOT / '.github' / 'workflows' / 'release.yml',
)

HISTORY_RE = re.compile(
    r'^#{1,6}\s+(?:v?\d+\.\d+\.\d+\b.*|.*(?:版本历史|已落地).*)$',
    re.MULTILINE | re.IGNORECASE,
)
LINK_RE = re.compile(r'(?<!!)\[[^\]]+\]\(([^)]+)\)')


def relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def read_text(path: Path, errors: list[str]) -> str:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        errors.append(f'cannot read {relative(path)}: {exc}')
        return ''
    if raw.startswith(b'\xef\xbb\xbf'):
        errors.append(f'UTF-8 BOM found: {relative(path)}')
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError as exc:
        errors.append(f'invalid UTF-8 in {relative(path)}: {exc}')
        return ''


def check_files_and_root(passes: list[str], errors: list[str]) -> None:
    missing = [relative(path) for path in REQUIRED if not path.is_file()]
    if missing:
        errors.append('missing required files: ' + ', '.join(missing))
    else:
        passes.append(f'required files present ({len(REQUIRED)})')

    if not AGENTS.is_file() or not CLAUDE.is_file():
        return
    agents_bytes = AGENTS.read_bytes()
    claude_bytes = CLAUDE.read_bytes()
    if agents_bytes != claude_bytes:
        errors.append('AGENTS.md and CLAUDE.md differ')
    else:
        digest = hashlib.sha256(agents_bytes).hexdigest()
        passes.append(f'root mirrors match ({digest[:12]}...)')

    # .workbuddy/memory/MEMORY.md 是工作区级镜像（不在 git 仓库内）
    # 存在时必须与 AGENTS.md 字节一致；不存在时跳过（CI / 其他开发者环境）
    if WORKSPACE_MEMORY.is_file():
        memory_bytes = WORKSPACE_MEMORY.read_bytes()
        if memory_bytes != agents_bytes:
            errors.append(
                f'.workbuddy/memory/MEMORY.md differs from AGENTS.md '
                f'({len(memory_bytes)} vs {len(agents_bytes)} bytes); '
                f'run: copy AGENTS.md to .workbuddy/memory/MEMORY.md'
            )
        else:
            passes.append(f'workspace memory mirror matches ({digest[:12]}...)')
    else:
        passes.append('workspace memory mirror not present (skipped)')

    text = read_text(AGENTS, errors)
    if not text:
        return
    line_count = len(text.splitlines())
    byte_count = len(text.encode('utf-8'))
    if line_count > MAX_LINES:
        errors.append(f'AGENTS.md has {line_count} lines; limit is {MAX_LINES}')
    else:
        passes.append(f'root rule lines controlled ({line_count}/{MAX_LINES})')
    if byte_count > MAX_BYTES:
        errors.append(f'AGENTS.md has {byte_count} bytes; limit is {MAX_BYTES}')
    else:
        passes.append(f'root rule bytes controlled ({byte_count}/{MAX_BYTES})')

    missing_refs = [item for item in ROOT_REFERENCES if item not in text]
    if missing_refs:
        errors.append('root rule missing references: ' + ', '.join(missing_refs))
    else:
        passes.append('root rule navigation is complete')
    if HISTORY_RE.search(text):
        errors.append('version history heading found in root rule')
    else:
        passes.append('root rule has no version history headings')

    try:
        version_data = json.loads((ROOT / 'version.json').read_text(encoding='utf-8'))
        version = str(version_data['version'])
        release_date = str(version_data.get('release_date') or '')
        version_re = re.compile(rf'(?<![\d.])v?{re.escape(version)}(?![\d.])')
        if version_re.search(text) or (release_date and release_date in text):
            errors.append('root rule hard-codes the current version or release date')
        else:
            passes.append('root rule does not copy dynamic version data')
    except (OSError, json.JSONDecodeError, KeyError) as exc:
        errors.append(f'cannot read version.json: {exc}')


def check_links(passes: list[str], errors: list[str]) -> None:
    broken: list[str] = []
    checked = 0
    # 校验 docs/rules/*.md 和根 AGENTS.md（CLAUDE.md 字节一致，不重复扫描）
    markdown_files = sorted(RULES.rglob('*.md'))
    if AGENTS.is_file():
        markdown_files.append(AGENTS)
    for markdown in markdown_files:
        text = read_text(markdown, errors)
        for match in LINK_RE.finditer(text):
            target = match.group(1).strip()
            if not target or target.startswith(('#', 'http://', 'https://', 'mailto:')):
                continue
            target = unquote(target.split('#', 1)[0])
            resolved = (markdown.parent / target).resolve()
            try:
                resolved.relative_to(ROOT.resolve())
            except ValueError:
                broken.append(f'{relative(markdown)} -> {target} (outside repo)')
                continue
            checked += 1
            if not resolved.exists():
                broken.append(f'{relative(markdown)} -> {target}')
    if broken:
        errors.append('broken rule links: ' + '; '.join(broken))
    else:
        passes.append(f'rule links valid ({checked} checked)')


def check_content(passes: list[str], errors: list[str]) -> None:
    missing: list[str] = []
    for path, markers in COVERAGE.items():
        text = read_text(path, errors)
        missing.extend(
            f'{relative(path)} missing {marker}' for marker in markers if marker not in text
        )
    if missing:
        errors.append('rule migration coverage incomplete: ' + '; '.join(missing))
    else:
        passes.append('critical rules migrated to topic files')

    prompt_text = read_text(PROMPT, errors)
    prompt_missing = [marker for marker in PROMPT_MARKERS if marker not in prompt_text]
    if prompt_missing:
        errors.append('portable prompt missing markers: ' + ', '.join(prompt_missing))
    else:
        passes.append('portable prompt covers platforms, agents, and safe migration')

    integration_missing = []
    for path, marker in INTEGRATIONS.items():
        if marker not in read_text(path, errors):
            integration_missing.append(f'{relative(path)} missing {marker}')
    if integration_missing:
        errors.append('rule checks not fully integrated: ' + '; '.join(integration_missing))
    else:
        passes.append('rule checks integrated into pre-commit, CI, PR, and release')

    # 跨端对账脚本必须被 CI workflow 引用，否则 CI 无法发现跨端 drift
    ci_text = read_text(ROOT / '.github' / 'workflows' / 'ci.yml', errors)
    ci_missing = [s for s in CROSS_PLATFORM_SCRIPTS_IN_CI if s not in ci_text]
    if ci_missing:
        errors.append('cross-platform scripts not wired into CI: ' + ', '.join(ci_missing))
    else:
        passes.append('cross-platform contract scripts wired into CI')

    history_files = []
    dynamic_version_files = []
    try:
        current_version = str(
            json.loads((ROOT / 'version.json').read_text(encoding='utf-8'))['version']
        )
        version_re = re.compile(rf'(?<![\d.])v?{re.escape(current_version)}(?![\d.])')
    except (OSError, json.JSONDecodeError, KeyError):
        version_re = None
    for markdown in sorted(RULES.rglob('*.md')):
        text = read_text(markdown, errors)
        if HISTORY_RE.search(text):
            history_files.append(relative(markdown))
        if version_re and version_re.search(text):
            dynamic_version_files.append(relative(markdown))
    if history_files:
        errors.append('version history headings found in: ' + ', '.join(history_files))
    else:
        passes.append('topic rules have no version history headings')
    if dynamic_version_files:
        errors.append('current version copied into topic rules: ' + ', '.join(dynamic_version_files))
    else:
        passes.append('topic rules do not copy the current version')


def check_encoding_defense(passes: list[str], errors: list[str]) -> None:
    """ps1 must carry a UTF-8 BOM without fake coding lines; python-running
    Windows workflows must set PYTHONIOENCODING: utf-8."""
    ps1_files = sorted(p for d in PS1_DIRS for p in d.glob('*.ps1'))
    no_bom = [
        relative(p) for p in ps1_files
        if not p.read_bytes().startswith(b'\xef\xbb\xbf')
    ]
    if no_bom:
        errors.append(
            'ps1 scripts missing UTF-8 BOM (PowerShell 5.1 decodes them as ANSI): '
            + ', '.join(no_bom)
        )
    else:
        passes.append(f'ps1 scripts carry UTF-8 BOM ({len(ps1_files)} checked)')

    fake_coding = [
        relative(p) for p in ps1_files
        if re.search(
            r'^#\s*(-\*-\s*)?coding\s*:',
            p.read_text(encoding='utf-8-sig', errors='replace'),
            re.MULTILINE,
        )
    ]
    if fake_coding:
        errors.append(
            'ps1 scripts use ineffective Python-style coding lines: '
            + ', '.join(fake_coding)
        )
    else:
        passes.append('ps1 scripts have no fake coding lines')

    missing_env = [
        relative(wf) for wf in PYTHON_WINDOWS_WORKFLOWS
        if 'PYTHONIOENCODING: utf-8' not in wf.read_text(encoding='utf-8')
    ]
    if missing_env:
        errors.append(
            'python-running Windows workflows missing env PYTHONIOENCODING: utf-8: '
            + ', '.join(missing_env)
        )
    else:
        passes.append(
            'python Windows workflows set PYTHONIOENCODING '
            f'({len(PYTHON_WINDOWS_WORKFLOWS)} checked)'
        )


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    passes: list[str] = []
    errors: list[str] = []
    check_files_and_root(passes, errors)
    check_links(passes, errors)
    check_content(passes, errors)
    check_encoding_defense(passes, errors)

    print('Shengxintou BI rule architecture check')
    print('=' * 38)
    for message in passes:
        print(f'[PASS] {message}')
    for message in errors:
        print(f'[FAIL] {message}')
    result_label = 'FAIL' if errors else 'PASS'
    print(f'\nResult: {result_label}')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
