# -*- coding: utf-8 -*-
"""
周报生成API路由

提供周报相关的所有接口：
- 获取周次列表
- 生成周报
- 保存/更新周报
- 导出周报
- v3.1.30: 纯数据周报 /api/v1/reports/weekly/data —— 聚合 agg_vendor_daily + agg_daily_channel_open + 漏斗转化率
"""

from flask import Blueprint, request, jsonify
from datetime import date, datetime
import json
import logging

from backend.database import db
from backend.models import WeeklyReport
from backend.models_v2 import AggVendorDaily, AggDailyChannelOpen, FactConvContent, FactConvAppmarket
from backend.utils.weekly_utils import get_week_info, generate_week_options, validate_week_period, get_all_fridays_in_year
from backend.utils.decorators import handle_exceptions
from sqlalchemy import func, and_, or_, case

logger = logging.getLogger(__name__)

bp = Blueprint('weekly_reports', __name__, url_prefix='/api/v1/reports/weekly')

# Diagnostic endpoint to test if code loading works
@bp.route('/test-code-loading', methods=['GET'])
@handle_exceptions
def test_code_loading():
    """Test if updated code is being loaded"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info("VERSION MARKER v3.0 - test_code_loading endpoint called!")
    print("[v3.0] test_code_loading endpoint called!")

    return jsonify({
        'success': True,
        'message': 'Code loading test - if you see this, updated code IS being loaded!',
        'version': 'v3.0',
        'timestamp': '2026-02-04 18:15:00'
    })


@bp.route('/periods', methods=['GET'])
@handle_exceptions
def get_periods():
    """获取可选周次列表"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        weeks_count = request.args.get('weeks_count', 12, type=int)
        logger.info(f"开始获取周次列表，weeks_count={weeks_count}")
        logger.info(f"VERSION MARKER: v2.5 - THIS IS THE UPDATED CODE")
        print("[v2.5] WEEKLY_REPORTS.PY - get_periods called")  # Console output

        # 1. 生成过去N周的选项
        generated_options = generate_week_options(weeks_count)

        # 2. 从数据库中获取已存在的周报
        # 使用原始 SQL 查询，避免 SQLAlchemy tuple 访问问题
        query_sql = """
            SELECT report_year, report_week, report_month, report_month_week,
                   report_name, start_date, end_date, report_sequence
            FROM weekly_reports
            ORDER BY report_year DESC, report_week DESC
        """
        result = db.session.execute(db.text(query_sql))
        existing_reports = result.fetchall()

        # 3. 将已存在的周报转换为选项格式
        existing_options = []
        for report in existing_reports:
            # Helper function to convert date regardless of type
            def to_date(date_val):
                """Convert to date object if it's a string, otherwise return as-is"""
                if isinstance(date_val, str):
                    from datetime import datetime
                    return datetime.strptime(date_val, '%Y-%m-%d').date()
                return date_val

            def to_date_str(date_val):
                """Convert date to string in MM/DD format"""
                if isinstance(date_val, str):
                    from datetime import datetime
                    date_val = datetime.strptime(date_val, '%Y-%m-%d').date()
                return date_val.strftime('%m/%d')
            # 使用索引访问 tuple：(report_year, report_week, report_month, report_month_week, report_name, start_date, end_date, report_sequence)
            # 注意: raw SQL 返回的日期是字符串，需要转换为 date 对象
            from datetime import datetime

            report_year = report[0]
            report_week = report[1]
            report_month = report[2]
            report_month_week = report[3]
            report_name = report[4]

            # 处理日期：使用helper函数处理字符串或date对象
            logger.info(f"DEBUG: start_date raw = {repr(report[5])}, type = {type(report[5])}")
            start_date = to_date(report[5]) if report[5] else None
            end_date = to_date(report[6]) if report[6] else None

            logger.info(f"DEBUG: start_date converted = {start_date}, type = {type(start_date)}")
            logger.info(f"DEBUG: end_date converted = {end_date}, type = {type(end_date)}")
            report_sequence = report[7]
            week_key = f"{report_year}-{report_week:02d}"

            # 检查是否已经在生成选项中
            if not any(opt['value'] == week_key for opt in generated_options):
                # 检查必需字段是否为空
                if not start_date or not end_date or not report_month:
                    logger.warning(f"跳过记录 {week_key}: 缺少必需字段")
                    continue

                # 统一日期格式为：YYYY年MM月第X周(MM/DD-MM/DD)
                date_range_short = f"{to_date_str(start_date)}-{to_date_str(end_date)}"
                date_range_cn = f"{report_year}年{report_month}月第{report_month_week}周({date_range_short})"

                existing_options.append({
                    'value': week_key,
                    'label': date_range_cn,
                    'date_range': date_range_cn,
                    'sequence': report_sequence,
                    'report_year': report_year,
                    'report_week': report_week,
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d'),
                    'is_existing': True
                })

        # 4. 合并选项并去重
        all_options = generated_options.copy()
        for existing_opt in existing_options:
            if not any(opt['value'] == existing_opt['value'] for opt in all_options):
                all_options.append(existing_opt)

        # 5. 按报告期降序排序（最近的在前）
        all_options.sort(key=lambda x: (x['report_year'], x['report_week']), reverse=True)

        return jsonify({
            'success': True,
            'data': all_options
        })

    except Exception as e:
        logger.error(f"获取周次列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/generate', methods=['POST'])
@handle_exceptions
def generate_report():
    """生成周报数据"""
    try:
        data = request.get_json()
        report_year = data.get('report_year')
        report_week = data.get('report_week')

        if not report_year or not report_week:
            return jsonify({
                'success': False,
                'error': '缺少必需参数: report_year, report_week'
            }), 400

        # 验证周次
        if not validate_week_period(report_year, report_week):
            return jsonify({
                'success': False,
                'error': f'无效的周次: {report_year}年第{report_week}周'
            }), 400

        # 计算周信息
        from datetime import timedelta
        fridays_in_year = get_all_fridays_in_year(report_year)
        if report_week - 1 < len(fridays_in_year):
            friday = fridays_in_year[report_week - 1]
            week_info = get_week_info(friday)
        else:
            return jsonify({
                'success': False,
                'error': f'无效的周次: {report_year}年第{report_week}周'
            }), 400

        # 检查是否已存在该周的报告
        existing_report = db.session.query(WeeklyReport).filter_by(
            report_year=report_year,
            report_week=report_week
        ).first()

        # 无论新旧报告，都重新聚合数据（广告投放 + 互联网营业部新开户）
        report_data = _aggregate_weekly_data(week_info)

        if existing_report:
            # 已存在报告，返回重新计算的数据（不更新数据库）
            # 保留原有的 key_works（重点工作）和其他用户可能修改过的内容
            # 只更新自动计算的字段：广告投放、新开户等
            existing_data = _serialize_report(existing_report)

            # 更新自动计算的字段
            existing_data.update({
                'ad_impressions': report_data.get('ad_impressions', 0),
                'ad_impressions_cumulative': report_data.get('ad_impressions_cumulative', 0),
                'ad_clicks': report_data.get('ad_clicks', 0),
                'ad_clicks_cumulative': report_data.get('ad_clicks_cumulative', 0),
                'new_accounts': report_data.get('new_accounts', 0),
                'new_accounts_cumulative': report_data.get('new_accounts_cumulative', 0),
            })

            return jsonify({
                'success': True,
                'data': {
                    'report_id': existing_report.report_id,
                    'report_data': existing_data,
                    'is_new': False,
                    'recalculated': True  # 标记为重新计算的数据
                }
            })

        # 不存在，生成新报告（只返回数据，不保存）
        # 生成 report_id: YYYY-MM-weeknum (MM是报告期所在月份，如 2025-12-52)
        report_id = f"{report_year}-{str(week_info['report_month']).zfill(2)}-{report_week}"

        # 构建报告数据（不保存到数据库）
        report_data.update({
            'report_id': report_id,
            'report_year': week_info['report_year'],
            'report_week': week_info['report_week'],
            'report_month': week_info['report_month'],
            'report_month_week': week_info['report_month_week'],
            'start_date': week_info['start_date'],
            'end_date': week_info['end_date'],
            'report_name': week_info['report_name'],
            'report_sequence': week_info['report_sequence'],
        })

        return jsonify({
            'success': True,
            'data': {
                'report_id': report_id,
                'report_data': report_data,
                'is_new': True,
                'recalculated': True  # 标记为重新计算的数据
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<string:report_id>', methods=['GET'])
@handle_exceptions
def get_report(report_id):
    """获取指定周报"""
    try:
        report = db.session.query(WeeklyReport).filter_by(report_id=report_id).first()

        if not report:
            return jsonify({
                'success': False,
                'error': f'周报不存在: ID={report_id}'
            }), 404

        return jsonify({
            'success': True,
            'data': {
                'report_id': report.report_id,
                'report_html': report.report_html,
                'report_data': _serialize_report(report)
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<string:report_id>', methods=['PUT'])
@handle_exceptions
def update_report(report_id):
    """更新或创建周报内容（支持Upsert）"""
    try:
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"========== 开始更新/创建周报 ==========")
        logger.info(f"报告ID: {report_id}")

        report = db.session.query(WeeklyReport).filter_by(report_id=report_id).first()

        # 如果报告不存在，先创建
        if not report:
            logger.info(f"周报不存在，创建新报告: {report_id}")

            # 从 report_id 解析出年份和周次
            # 格式: YYYY-MM-weeknum
            parts = report_id.split('-')
            if len(parts) != 3:
                logger.error(f"无效的report_id格式: {report_id}")
                return jsonify({
                    'success': False,
                    'error': f'无效的报告ID格式: {report_id}'
                }), 400

            try:
                report_year = int(parts[0])
                report_month = int(parts[1])
                report_week = int(parts[2])
            except ValueError:
                logger.error(f"无法解析report_id: {report_id}")
                return jsonify({
                    'success': False,
                    'error': f'无法解析报告ID: {report_id}'
                }), 400

            # 计算周信息
            fridays_in_year = get_all_fridays_in_year(report_year)
            if report_week - 1 < len(fridays_in_year):
                friday = fridays_in_year[report_week - 1]
                week_info = get_week_info(friday)
            else:
                logger.error(f"无效的周次: {report_year}年第{report_week}周")
                return jsonify({
                    'success': False,
                    'error': f'无效的周次: {report_year}年第{report_week}周'
                }), 400

            # 创建新报告
            report = WeeklyReport(
                report_id=report_id,
                report_year=week_info['report_year'],
                report_week=week_info['report_week'],
                report_month=week_info['report_month'],
                report_month_week=week_info['report_month_week'],
                start_date=datetime.strptime(week_info['start_date'], '%Y-%m-%d').date(),
                end_date=datetime.strptime(week_info['end_date'], '%Y-%m-%d').date(),
                report_name=week_info['report_name'],
                report_sequence=week_info['report_sequence'],
                status='draft'
            )

            db.session.add(report)
            db.session.flush()  # flush 以获取ID，但不提交
            logger.info(f"新报告创建成功: {report_id}")

        data = request.get_json()
        logger.info(f"接收到的数据: {data}")

        # 更新重点工作
        if 'key_works' in data:
            logger.info(f"更新前的 key_works: {report.key_works[:100] if report.key_works else 'None'}...")
            key_works_json = json.dumps(data['key_works'], ensure_ascii=False)
            logger.info(f"更新后的 key_works: {key_works_json[:100]}...")
            report.key_works = key_works_json
            report.updated_at = datetime.now()

        # 更新指标字段（如果提供）
        # 完整的字段列表，对应数据库表的所有可编辑字段
        metric_fields = [
            # 流量入口
            'content_count', 'content_views',
            # 直播获客
            'live_sessions', 'live_viewers',
            # 广告投放
            'ad_impressions', 'ad_clicks',
            # 转化数据
            'new_accounts',  # 互联网营业部新开户（大数字）
            'enterprise_wechat_add',  # 企业微信添加
            'subscription_count',  # 投顾产品订阅
            'branch_new_accounts',  # 助力分支新开户
        ]

        for field in metric_fields:
            if field in data:
                old_value = getattr(report, field, 0)
                new_value = data[field]
                logger.info(f"更新 {field}: {old_value} -> {new_value}")
                setattr(report, field, new_value)
                report.updated_at = datetime.now()

        # 更新状态
        if 'status' in data:
            report.status = data['status']
            if data['status'] == 'published' and not report.published_at:
                report.published_at = datetime.now()

        # 更新HTML内容
        if 'report_html' in data:
            report.report_html = data['report_html']

        logger.info("准备提交到数据库...")
        db.session.commit()
        logger.info("数据库提交成功！")

        logger.info(f"========== 周报更新完成 ==========")

        return jsonify({
            'success': True,
            'message': '周报更新成功',
            'data': {
                'report_id': report.report_id,
                'report_data': _serialize_report(report)
            }
        })

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"更新周报失败: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/<string:report_id>/export', methods=['GET'])
@handle_exceptions
def export_report(report_id):
    """导出周报数据（不包含HTML，由前端生成）"""
    try:
        report = db.session.query(WeeklyReport).filter_by(report_id=report_id).first()

        if not report:
            return jsonify({
                'success': False,
                'error': f'周报不存在: ID={report_id}'
            }), 404

        # 返回报告数据，前端根据数据生成HTML
        return jsonify({
            'success': True,
            'data': {
                'report_data': _serialize_report(report),
                'filename': f"{report.report_name}"
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== 私有辅助函数 ====================

def _aggregate_weekly_data(week_info: dict) -> dict:
    """
    聚合周报数据（从 daily_metrics_unified 表聚合真实数据）

    Args:
        week_info: 周信息字典（包含 start_date, end_date, report_year, report_week 等）

    Returns:
        dict: 聚合后的周报数据
    """
    from backend.scripts.aggregate_weekly_data import aggregate_weekly_data, copy_previous_key_works

    # 调用聚合脚本获取真实数据
    aggregated = aggregate_weekly_data(week_info['start_date'], week_info['end_date'])

    # 复制上一周的 key_works
    key_works = copy_previous_key_works(week_info['report_year'], week_info['report_week'])

    # 合并数据
    aggregated['key_works'] = key_works

    return aggregated


def _get_default_key_works() -> list:
    """获取默认重点工作列表"""
    return [
        {
            'work_num': '01',
            'work_category': '渠道拓展',
            'work_description': '预沟通2026年度广告投放代理招标采购，财经媒体直播供应商征集完成，应用商城优化方案已提交。'
        },
        {
            'work_num': '02',
            'work_category': '投放管理',
            'work_description': '代理公司探索阶段顺利完成，进入精细化运营阶段，启动投放额度与策略机制优化。'
        },
        {
            'work_num': '03',
            'work_category': '直播优化',
            'work_description': '启动研究所直播话术培训，优化投顾后端策略产品运营方案，直播制度修订稿进入OA核稿阶段。'
        },
        {
            'work_num': '04',
            'work_category': '金融科技',
            'work_description': '小红书运营报表持续开发，应用市场归因功能开发联调中，腾讯元宝落地页面完成测试验收。'
        },
        {
            'work_num': '05',
            'work_category': '业务赋能',
            'work_description': '分支机构认证账号审批通过，抖音小红书号陆续开通，拟协调研究所分析师开展赋能培训。'
        }
    ]


def _serialize_report(report: WeeklyReport) -> dict:
    """序列化周报对象为字典"""
    return {
        'report_id': report.report_id,  # 改为 report_id
        'report_year': report.report_year,
        'report_week': report.report_week,
        'report_month': report.report_month,
        'report_month_week': report.report_month_week,
        'start_date': report.start_date.strftime('%Y-%m-%d') if report.start_date else None,
        'end_date': report.end_date.strftime('%Y-%m-%d') if report.end_date else None,
        'report_name': report.report_name,
        'report_sequence': report.report_sequence,
        'content_count': report.content_count,
        'content_count_cumulative': report.content_count_cumulative,
        'live_sessions': report.live_sessions,
        'live_sessions_cumulative': report.live_sessions_cumulative,
        'live_viewers': report.live_viewers,
        'live_viewers_cumulative': report.live_viewers_cumulative,
        'ad_impressions': report.ad_impressions,
        'ad_impressions_cumulative': report.ad_impressions_cumulative,
        'ad_clicks': report.ad_clicks,
        'ad_clicks_cumulative': report.ad_clicks_cumulative,
        'new_accounts': report.new_accounts,
        'new_accounts_cumulative': report.new_accounts_cumulative,
        'enterprise_wechat_add': report.enterprise_wechat_add,
        'enterprise_wechat_add_cumulative': report.enterprise_wechat_add_cumulative,
        'subscription_count': report.subscription_count,
        'subscription_count_cumulative': report.subscription_count_cumulative,
        'branch_new_accounts': report.branch_new_accounts,
        'branch_new_accounts_cumulative': report.branch_new_accounts_cumulative,
        'key_works': json.loads(report.key_works) if report.key_works else [],
        'status': report.status,
        'created_at': report.created_at.strftime('%Y-%m-%d %H:%M:%S') if report.created_at else None,
        'updated_at': report.updated_at.strftime('%Y-%m-%d %H:%M:%S') if report.updated_at else None,
        'published_at': report.published_at.strftime('%Y-%m-%d %H:%M:%S') if report.published_at else None,
    }


# ==================== v3.1.30 纯数据周报 ====================

def _safe_div(num, den, pct=False):
    """安全除法，分母为 0 返回 0；pct=True 时返回百分比"""
    try:
        if not den:
            return 0.0
        r = float(num) / float(den)
        return round(r * 100, 2) if pct else round(r, 4)
    except (TypeError, ZeroDivisionError):
        return 0.0


@bp.route('/data', methods=['POST'])
@handle_exceptions
def get_weekly_data():
    """v3.1.30 纯数据周报端点

    输入: { report_year, report_week } 或 { start_date, end_date }
    输出: {
        period: { start_date, end_date, report_year, report_week, report_name },
        summary: {
            ad: { impressions, clicks, cost, leads, cpc, cpa, ... 累计 },
            channel: { opens, deposits, valid_accounts, ... 累计 },
            funnel: { content_rate, appmarket_rate, ... }
        },
        daily: [
            { date, ad_impressions, ad_clicks, ad_cost, ad_leads, ch_opens, ch_deposits, ch_valid },
            ...
        ],
        by_platform: [ { platform, impressions, clicks, cost, leads }, ... ],
        by_channel: [ { channel, opens, deposits, valid_accounts }, ... ],
    }
    """
    data = request.get_json() or {}
    report_year = data.get('report_year')
    report_week = data.get('report_week')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    # 解析日期区间
    if report_year and report_week:
        if not validate_week_period(report_year, report_week):
            return jsonify({'success': False, 'error': f'无效的周次: {report_year}年第{report_week}周'}), 400
        fridays = get_all_fridays_in_year(report_year)
        if report_week - 1 >= len(fridays):
            return jsonify({'success': False, 'error': f'无效的周次: {report_year}年第{report_week}周'}), 400
        friday = fridays[report_week - 1]
        week_info = get_week_info(friday)
        sd = week_info['start_date']
        ed = week_info['end_date']
        report_name = week_info['report_name']
        report_sequence = week_info['report_sequence']
    elif start_date and end_date:
        sd = start_date
        ed = end_date
        report_year = int(sd[:4])
        report_week = int(sd[5:7])
        report_name = f'{report_year}年第{report_week}周'
        report_sequence = report_week
        week_info = {'start_date': sd, 'end_date': ed, 'report_year': report_year,
                     'report_week': report_week, 'report_name': report_name,
                     'report_sequence': report_sequence, 'report_month': int(sd[5:7]),
                     'report_month_week': 1}
    else:
        return jsonify({'success': False, 'error': '需要 report_year+report_week 或 start_date+end_date'}), 400

    # 累计范围：年初到周末
    year_start = f'{report_year}-01-01'
    cum_end = ed

    # ===== 1. 广告投放汇总（agg_vendor_daily）=====
    ad_q = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('new_accounts'),
    ).filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed))
    ad_r = ad_q.first()

    ad_cum = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('new_accounts'),
    ).filter(and_(AggVendorDaily.日期 >= year_start, AggVendorDaily.日期 <= cum_end)).first()

    ad_impressions = int(ad_r.impressions or 0)
    ad_clicks = int(ad_r.clicks or 0)
    ad_cost = float(ad_r.cost or 0)
    ad_leads = int(ad_r.leads or 0)
    ad_new_accounts = int(ad_r.new_accounts or 0)

    ad_cum_impressions = int(ad_cum.impressions or 0)
    ad_cum_clicks = int(ad_cum.clicks or 0)
    ad_cum_cost = float(ad_cum.cost or 0)
    ad_cum_leads = int(ad_cum.leads or 0)
    ad_cum_new_accounts = int(ad_cum.new_accounts or 0)

    # ===== 2. 互联网渠道开户汇总（agg_daily_channel_open，仅互联网引流）=====
    ch_q = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposits'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    ))
    ch_r = ch_q.first()

    ch_cum = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposits'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= cum_end,
    )).first()

    ch_opens = int(ch_r.opens or 0)
    ch_deposits = int(ch_r.deposits or 0)
    ch_valid = int(ch_r.valid or 0)
    ch_cum_opens = int(ch_cum.opens or 0)
    ch_cum_deposits = int(ch_cum.deposits or 0)
    ch_cum_valid = int(ch_cum.valid or 0)

    # ===== 3. 漏斗整体转化率（线索→开户）=====
    # 内容平台漏斗
    content_q = db.session.query(
        func.count(FactConvContent.id).label('total'),
        func.coalesce(func.sum(case((FactConvContent.是否开户 == 1, 1), else_=0)), 0).label('opened'),
    ).filter(and_(FactConvContent.线索日期 >= sd, FactConvContent.线索日期 <= ed))
    content_r = content_q.first()
    content_total = int(content_r.total or 0)
    content_opened = int(content_r.opened or 0)
    content_rate = _safe_div(content_opened, content_total, pct=True)

    # 应用市场漏斗（限互联网引流）
    appmarket_q = db.session.query(
        func.count(FactConvAppmarket.id).label('total'),
        func.coalesce(func.sum(case((FactConvAppmarket.是否开户成功 == 1, 1), else_=0)), 0).label('opened'),
    ).filter(and_(
        FactConvAppmarket.渠道类型 == '互联网引流',
        FactConvAppmarket.下载日期 >= sd,
        FactConvAppmarket.下载日期 <= ed,
    ))
    appmarket_r = appmarket_q.first()
    appmarket_total = int(appmarket_r.total or 0)
    appmarket_opened = int(appmarket_r.opened or 0)
    appmarket_rate = _safe_div(appmarket_opened, appmarket_total, pct=True)

    # ===== 4. 每日明细（用于日走势堆叠柱状图）=====
    # 广告投放按日
    ad_daily_rows = db.session.query(
        AggVendorDaily.日期.label('date'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('new_accounts'),
    ).filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed)) \
     .group_by(AggVendorDaily.日期).order_by(AggVendorDaily.日期).all()

    # 渠道开户按日（互联网引流）
    ch_daily_rows = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposits'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.时间区间).order_by(AggDailyChannelOpen.时间区间).all()

    # 合并两源按日数据
    ad_map = {r.date: r for r in ad_daily_rows}
    ch_map = {r.date: r for r in ch_daily_rows}
    all_dates = sorted(set(list(ad_map.keys()) + list(ch_map.keys())))
    daily = []
    for d in all_dates:
        ad_row = ad_map.get(d)
        ch_row = ch_map.get(d)
        daily.append({
            'date': d,
            'ad_impressions': int(ad_row.impressions or 0) if ad_row else 0,
            'ad_clicks': int(ad_row.clicks or 0) if ad_row else 0,
            'ad_cost': float(ad_row.cost or 0) if ad_row else 0,
            'ad_leads': int(ad_row.leads or 0) if ad_row else 0,
            'ad_new_accounts': int(ad_row.new_accounts or 0) if ad_row else 0,
            'ch_opens': int(ch_row.opens or 0) if ch_row else 0,
            'ch_deposits': int(ch_row.deposits or 0) if ch_row else 0,
            'ch_valid': int(ch_row.valid or 0) if ch_row else 0,
        })

    # ===== 5. 按平台拆分（广告投放）=====
    platform_rows = db.session.query(
        AggVendorDaily.平台.label('platform'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.点击量), 0).label('clicks'),
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.线索数), 0).label('leads'),
        func.coalesce(func.sum(AggVendorDaily.开户人数), 0).label('new_accounts'),
    ).filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed)) \
     .group_by(AggVendorDaily.平台).order_by(func.sum(AggVendorDaily.花费).desc()).all()
    by_platform = [{
        'platform': r.platform or '未分类',
        'impressions': int(r.impressions or 0),
        'clicks': int(r.clicks or 0),
        'cost': float(r.cost or 0),
        'leads': int(r.leads or 0),
        'new_accounts': int(r.new_accounts or 0),
    } for r in platform_rows]

    # ===== 6. 按渠道拆分（互联网开户）=====
    channel_rows = db.session.query(
        AggDailyChannelOpen.渠道名称.label('channel'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.入金户数), 0).label('deposits'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.渠道名称) \
     .order_by(func.sum(AggDailyChannelOpen.开户成功人数).desc()).all()
    by_channel = [{
        'channel': r.channel or '未分类',
        'opens': int(r.opens or 0),
        'deposits': int(r.deposits or 0),
        'valid': int(r.valid or 0),
    } for r in channel_rows]

    return jsonify({
        'success': True,
        'data': {
            'period': {
                'start_date': sd,
                'end_date': ed,
                'report_year': report_year,
                'report_week': report_week,
                'report_name': report_name,
                'report_sequence': report_sequence,
            },
            'summary': {
                'ad': {
                    'impressions': ad_impressions,
                    'clicks': ad_clicks,
                    'cost': round(ad_cost, 2),
                    'leads': ad_leads,
                    'new_accounts': ad_new_accounts,
                    'cpc': round(ad_cost / ad_clicks, 2) if ad_clicks > 0 else 0,
                    'cpa': round(ad_cost / ad_new_accounts, 2) if ad_new_accounts > 0 else 0,
                    'ctr': _safe_div(ad_clicks, ad_impressions, pct=True),
                    'cumulative': {
                        'impressions': ad_cum_impressions,
                        'clicks': ad_cum_clicks,
                        'cost': round(ad_cum_cost, 2),
                        'leads': ad_cum_leads,
                        'new_accounts': ad_cum_new_accounts,
                    },
                },
                'channel': {
                    'opens': ch_opens,
                    'deposits': ch_deposits,
                    'valid': ch_valid,
                    'deposit_rate': _safe_div(ch_deposits, ch_opens, pct=True),
                    'valid_rate': _safe_div(ch_valid, ch_opens, pct=True),
                    'cumulative': {
                        'opens': ch_cum_opens,
                        'deposits': ch_cum_deposits,
                        'valid': ch_cum_valid,
                    },
                },
                'funnel': {
                    'content_total': content_total,
                    'content_opened': content_opened,
                    'content_rate': content_rate,
                    'appmarket_total': appmarket_total,
                    'appmarket_opened': appmarket_opened,
                    'appmarket_rate': appmarket_rate,
                },
            },
            'daily': daily,
            'by_platform': by_platform,
            'by_channel': by_channel,
        }
    })
