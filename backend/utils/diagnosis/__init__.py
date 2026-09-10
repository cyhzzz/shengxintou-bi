# -*- coding: utf-8 -*-
"""智能辅助诊断（L1 规则引擎）

入口：backend.utils.diagnosis.run_diagnosis(month)
输出契约见 docs/superpowers/specs/2026-09-09-智能辅助诊断.md 第 5.3 节。
"""
from backend.utils.diagnosis.engine import run_diagnosis

__all__ = ['run_diagnosis']
