# -*- coding: utf-8 -*-
"""
SQL 方言工具：SQLite 与 Postgres 的日期函数差异在这里集中处理。

feat-desktop-supabase：切到 Supabase PG 后，原 SQLite 专属语法会报错：
- func.strftime('%Y-%W', col)          → PG 无 strftime
- func.date(col, 'weekday 0', '-6 days') → PG date() 不接受修饰符

集中在本模块，让报表路由保持 dialect 无关。
"""
from sqlalchemy import func, literal, cast, case, text
from sqlalchemy.types import Date
from sqlalchemy.sql.elements import ColumnElement

from backend.database import db


def _dialect() -> str:
    """返回当前 dialect 字符串（'sqlite' / 'postgresql' / ...）。"""
    try:
        return db.session.get_bind().dialect.name
    except Exception:
        # 直跑脚本无 session 时兜底：读 config 全局
        try:
            import config as _cfg
            return getattr(_cfg, 'DATABASE_DIALECT', 'sqlite')
        except Exception:
            return 'sqlite'


def make_period_expr(col, granularity: str):
    """按粒度返回周期分组表达式。

    granularity:
      - 'daily'   → 原值（'YYYY-MM-DD' 字符串）
      - 'weekly'  → 'YYYY-WW'（ISO 周号；SQLite %W 与 PG IW 略有差异，但报表口径自洽）
      - 'monthly' → 'YYYY-MM'

    返回值可直接 .label('period') 使用。
    """
    if granularity == 'daily':
        return col

    d = _dialect()
    if granularity == 'monthly':
        # 两种 dialect 都支持 substr（PG 内置 substr(text,int,int)）
        return func.substr(col, 1, 7)

    # weekly
    if d == 'postgresql':
        # PG: to_char(col, 'YYYY-IW') 返回 ISO 周号（4 位年 + 2 位周号）
        return func.to_char(col, 'YYYY-IW')
    # SQLite: strftime('%Y-%W', col)，%W = 周一为周首日、00-53
    return func.strftime('%Y-%W', col)


def make_week_start_expr(col):
    """返回 col 所在周的周一表达式（用于 plan-analysis 按周聚合）。

    SQLite: date(col, 'weekday 0', '-6 days') = col 所在周周一（周一为 weekday 0）
    PG:     date_trunc('week', col::date) = 所在周周一（PG 默认周一为周首日）

    feat-cloud-supabase：日期字段在 ORM 里是 Text（'YYYY-MM-DD'），
    PG 必须显式 ::date cast 才能传给 date_trunc；SQLite 直接 date() 自带隐式转换。
    """
    d = _dialect()
    if d == 'postgresql':
        # PG date_trunc 接收 timestamp/date；Text 必须显式 cast
        return func.date_trunc('week', cast(col, Date))
    # SQLite 专属修饰符，PG 不支持
    return func.date(col, 'weekday 0', '-6 days')


def make_friday_week_start_expr(col):
    """返回 col 所在「周五起始周」（上周五 → 本周四）的起始日表达式。

    广告计划分析的周度口径统一为「上周五 ~ 本周四」：
      - SQLite: date(col, 'weekday 4', '-6 days')
        = 该周最后一天(周四)往前 6 天 -> 本周五（周五为该周起始日）
      - PG: date_trunc('week') 得到 ISO 周一；col 落在周一~周四 -> 上周五（周一-3 天），
        col 落在周五~周日 -> 本周五（周一+4 天）
    """
    d = _dialect()
    if d == 'postgresql':
        col_date = cast(col, Date)
        return (
            func.date_trunc('week', col_date)
            + case(
                (func.extract('isodow', col_date) <= 4, text("interval '-3 days'")),
                else_=text("interval '4 days'"),
            )
        )
    # SQLite 专属修饰符，PG 不支持
    return func.date(col, 'weekday 4', '-6 days')
