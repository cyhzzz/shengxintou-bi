# -*- coding: utf-8 -*-
"""
SQL 方言工具：SQLite 与 Postgres 的日期函数差异在这里集中处理。

全仓周口径统一为「周五业务周」（上周五 ~ 本周四）：任何周分组一律走
make_friday_week_start_expr（或 make_period_expr('weekly')），不要新增
周一起始周表达式。

切到 Supabase PG 后，原 SQLite 专属语法会报错：
- func.strftime('%Y-%W', col)          → PG 无 strftime
- func.date(col, 'weekday 4', ...)     → PG date() 不接受修饰符

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
      - 'weekly'  → 周五业务周起始日 'YYYY-MM-DD'（上周五 ~ 本周四）
      - 'monthly' → 'YYYY-MM'

    返回值可直接 .label('period') 使用。
    """
    if granularity == 'daily':
        return col

    if granularity == 'monthly':
        # 两种 dialect 都支持 substr（PG 内置 substr(text,int,int)）
        return func.substr(col, 1, 7)

    # weekly：统一为周五业务周（上周五 ~ 本周四），与周报/广告计划分析口径一致
    return make_friday_week_start_expr(col)


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
