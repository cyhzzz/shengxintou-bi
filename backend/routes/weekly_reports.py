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


def _query_metrics(sd, ed):
    """v3.1.32 查询某时间区间的 7 个核心指标（复用于本周/全年/上周）

    1. 消耗金额 (agg_vendor_daily.花费)
    2. 品牌曝光 (agg_vendor_daily.展示量)
    3. 企微数   (fact_conv_content COUNT(*), 内容平台线索)
    4. APP激活数 (agg_vendor_daily.APP激活人数, 应用市场线索)
    5. 开户数   (agg_daily_channel_open.开户成功人数, 仅互联网引流)
    6. 新增有效户数 (agg_daily_channel_open.有效户数, 仅互联网引流)
    7. 新增客户资产 (fact_conv_content 新开户 SUM(资产) + fact_conv_appmarket 新开户 SUM(总资产))

    v3.1.32 改动：线索数拆分为企微数（fact_conv_content COUNT）+ APP激活数（agg_vendor_daily.APP激活人数）
    """
    # 1-2: 广告投放（agg_vendor_daily）
    ad_r = db.session.query(
        func.coalesce(func.sum(AggVendorDaily.花费), 0).label('cost'),
        func.coalesce(func.sum(AggVendorDaily.展示量), 0).label('impressions'),
        func.coalesce(func.sum(AggVendorDaily.APP激活人数), 0).label('leads_app'),
    ).filter(and_(AggVendorDaily.日期 >= sd, AggVendorDaily.日期 <= ed)).first()

    # 3: 企微数（fact_conv_content COUNT）
    leads_wx = db.session.query(
        func.coalesce(func.count(FactConvContent.id), 0)
    ).filter(and_(
        FactConvContent.线索日期 >= sd,
        FactConvContent.线索日期 <= ed,
    )).scalar() or 0

    # 4-5: 渠道开户（agg_daily_channel_open，仅互联网引流）
    ch_r = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('opens'),
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0).label('valid'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).first()

    # 6: 新开户客户资产
    # 内容平台：是否开户==1 AND 非存量 AND 线索日期在区间
    content_assets = db.session.query(
        func.coalesce(func.sum(FactConvContent.资产), 0)
    ).filter(and_(
        FactConvContent.是否开户 == 1,
        or_(FactConvContent.是否为存量客户 == 0, FactConvContent.是否为存量客户.is_(None)),
        FactConvContent.线索日期 >= sd,
        FactConvContent.线索日期 <= ed,
    )).scalar() or 0

    # 应用市场：是否新开户==1 AND 渠道类型==互联网引流 AND 下载日期在区间
    appmarket_assets = db.session.query(
        func.coalesce(func.sum(FactConvAppmarket.总资产), 0)
    ).filter(and_(
        FactConvAppmarket.是否新开户 == 1,
        FactConvAppmarket.渠道类型 == '互联网引流',
        FactConvAppmarket.下载日期 >= sd,
        FactConvAppmarket.下载日期 <= ed,
    )).scalar() or 0

    return {
        'cost': float(ad_r.cost or 0),
        'impressions': int(ad_r.impressions or 0),
        'leads_wx': int(leads_wx),
        'leads_app': int(ad_r.leads_app or 0),
        'opens': int(ch_r.opens or 0),
        'valid': int(ch_r.valid or 0),
        'assets': float(content_assets) + float(appmarket_assets),
    }


def _calc_wow(curr, prev):
    """计算环比百分比，prev=0 或不可比时返回 None"""
    if prev is None or prev == 0:
        return None
    return round((float(curr) - float(prev)) / float(prev) * 100, 2)


@bp.route('/data', methods=['POST'])
@handle_exceptions
def get_weekly_data():
    """v3.1.31 纯数据周报端点（本周 + 全年累计 + 上周环比 + 两堆叠图 + 互联网占比）

    输入: { report_year, report_week } 或 { start_date, end_date }
    输出: {
        period: { start_date, end_date, prev_start, prev_end, report_year, report_week, ... },
        current_week:   { cost, impressions, leads, opens, valid, assets },
        year_to_date:   { ... },                 # 年初至周末累计
        prev_week:      { ... },                 # 上一周（用于环比）
        week_over_week: { cost, ..., assets },   # 环比百分比，null=不可比
        daily_opens_stacked: [ { date, <渠道名>: n, ... }, ... ],  # 互联网引流开户数按渠道堆叠
        daily_valid_stacked: [ { date, <渠道名>: n, ... }, ... ],  # 互联网引流有效户数按渠道堆叠
        channels: [ '小红书', '腾讯', ... ],    # 堆叠图渠道列表
        internet_ratio: { opens_ratio, valid_ratio },  # 互联网引流 / 全渠道类别
    }
    """
    from datetime import datetime, timedelta

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
    else:
        return jsonify({'success': False, 'error': '需要 report_year+report_week 或 start_date+end_date'}), 400

    # 上一周范围（环比）
    sd_dt = datetime.strptime(sd, '%Y-%m-%d')
    ed_dt = datetime.strptime(ed, '%Y-%m-%d')
    prev_sd = (sd_dt - timedelta(days=7)).strftime('%Y-%m-%d')
    prev_ed = (ed_dt - timedelta(days=7)).strftime('%Y-%m-%d')

    # 全年累计范围
    year_start = f'{report_year}-01-01'

    # ===== 三套时间区间 6 指标 =====
    current_week = _query_metrics(sd, ed)
    year_to_date = _query_metrics(year_start, ed)
    prev_week = _query_metrics(prev_sd, prev_ed)

    # 环比百分比
    week_over_week = {
        k: _calc_wow(current_week[k], prev_week[k]) for k in
        ['cost', 'impressions', 'leads_wx', 'leads_app', 'opens', 'valid', 'assets']
    }

    # ===== 堆叠图 1：本周内按日 × 渠道大类（互联网引流开户数） =====
    opens_daily_rows = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        AggDailyChannelOpen.渠道名称.label('channel'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('val'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.时间区间, AggDailyChannelOpen.渠道名称).all()

    # ===== 堆叠图 2：全年内按周次 × 渠道大类（互联网引流开户数） =====
    opens_yearly_rows = db.session.query(
        AggDailyChannelOpen.时间区间.label('date'),
        AggDailyChannelOpen.渠道名称.label('channel'),
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0).label('val'),
    ).filter(and_(
        AggDailyChannelOpen.渠道类别 == '互联网引流',
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).group_by(AggDailyChannelOpen.时间区间, AggDailyChannelOpen.渠道名称).all()

    # 渠道 → 大类映射（v3.1.33：堆叠图按 3 大类聚合）
    CHANNEL_CATEGORY_MAP = {
        # 内容平台
        '小红书': '内容平台', '腾讯': '内容平台', '抖音': '内容平台',
        '快手': '内容平台', '财联社': '内容平台', 'yj': '内容平台',
        '云极': '内容平台', '其他': '内容平台',
        # 应用市场
        '华为': '应用市场', '荣耀': '应用市场', '小米': '应用市场',
        'oppo': '应用市场', 'vivo': '应用市场', '苹果': '应用市场', '鸿蒙': '应用市场',
        # 本地生活
        '高德': '本地生活',
    }
    CHANNEL_CATEGORIES = ['内容平台', '应用市场', '本地生活']

    def _map_channel(ch):
        return CHANNEL_CATEGORY_MAP.get(ch, '内容平台')

    # 构造年内周次列表 [{week: 'W01', sd, ed}, ...]，仅保留有数据的周
    fridays = get_all_fridays_in_year(report_year)
    week_list = []
    for i, f in enumerate(fridays, 1):
        wi = get_week_info(f)
        wsd = wi['start_date']
        wed = wi['end_date']
        if wsd > ed:
            continue
        if wed > ed:
            wed = ed
        week_list.append({'week': f'W{i:02d}', 'sd': wsd, 'ed': wed})

    def _find_week(d_str):
        for w in week_list:
            if w['sd'] <= d_str <= w['ed']:
                return w['week']
        return None

    # channels 固定为 3 大类（按全年开户数降序）
    cat_total = {c: 0 for c in CHANNEL_CATEGORIES}
    for r in opens_yearly_rows:
        cat = _map_channel(r.channel)
        cat_total[cat] = cat_total.get(cat, 0) + int(r.val or 0)
    channels = sorted(CHANNEL_CATEGORIES, key=lambda c: cat_total.get(c, 0), reverse=True)

    # 图 1：按日 pivot（按大类聚合）
    def _pivot_daily(rows):
        all_dates = sorted(set([r.date for r in rows]))
        m = {}
        for r in rows:
            d = r.date
            cat = _map_channel(r.channel)
            if d not in m:
                m[d] = {'date': d}
            m[d][cat] = m[d].get(cat, 0) + int(r.val or 0)
        return [m.get(d, {'date': d}) for d in all_dates]

    daily_opens_stacked = _pivot_daily(opens_daily_rows)

    # 图 2：按周 pivot（按大类聚合）
    def _pivot_weekly(rows):
        m = {}
        for r in rows:
            wk = _find_week(r.date)
            if not wk:
                continue
            cat = _map_channel(r.channel)
            if wk not in m:
                m[wk] = {'week': wk}
            m[wk][cat] = m[wk].get(cat, 0) + int(r.val or 0)
        return [m.get(w['week'], {'week': w['week']}) for w in week_list]

    weekly_opens_stacked = _pivot_weekly(opens_yearly_rows)

    # ===== 互联网渠道占公司开户占比（互联网引流 / 全渠道类别）=====
    # 本周占比
    week_all_opens = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    week_all_valid = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= sd,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    # 年度占比（全年累计全渠道）
    year_all_opens = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.开户成功人数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0
    year_all_valid = db.session.query(
        func.coalesce(func.sum(AggDailyChannelOpen.有效户数), 0)
    ).filter(and_(
        AggDailyChannelOpen.时间区间 >= year_start,
        AggDailyChannelOpen.时间区间 <= ed,
    )).scalar() or 0

    internet_ratio = {
        'opens_ratio': _safe_div(current_week['opens'], week_all_opens, pct=True) if week_all_opens else 0.0,
        'valid_ratio': _safe_div(current_week['valid'], week_all_valid, pct=True) if week_all_valid else 0.0,
        'year_opens_ratio': _safe_div(year_to_date['opens'], year_all_opens, pct=True) if year_all_opens else 0.0,
        'year_valid_ratio': _safe_div(year_to_date['valid'], year_all_valid, pct=True) if year_all_valid else 0.0,
    }

    # ===== 年度 KPI 完成率（按时间进度测算）=====
    # 时间进度 = 当前周末日 / 全年天数
    from datetime import date as _date
    year_total_days = (_date(report_year, 12, 31) - _date(report_year, 1, 1)).days + 1
    passed_days = (ed_dt.date() - _date(report_year, 1, 1)).days + 1
    time_progress = passed_days / year_total_days

    KPI_TARGETS = {
        'opens': 20000,    # 开户数年度KPI 2万户
        'valid': 10000,    # 有效户年度KPI 1万户
        'assets': 5_0000_0000,  # 资产年度KPI 5亿
    }

    def _kpi_rate(key):
        target = KPI_TARGETS[key]
        actual = year_to_date[key]
        expected = target * time_progress
        return _safe_div(actual, expected, pct=True) if expected else 0.0

    kpi = {
        'time_progress': round(time_progress * 100, 2),  # 时间进度 %
        'opens': {
            'target': KPI_TARGETS['opens'],
            'actual': year_to_date['opens'],
            'rate': _kpi_rate('opens'),  # 完成率 %
        },
        'valid': {
            'target': KPI_TARGETS['valid'],
            'actual': year_to_date['valid'],
            'rate': _kpi_rate('valid'),
        },
        'assets': {
            'target': KPI_TARGETS['assets'],
            'actual': year_to_date['assets'],
            'rate': _kpi_rate('assets'),
        },
    }

    return jsonify({
        'success': True,
        'data': {
            'period': {
                'start_date': sd,
                'end_date': ed,
                'prev_start': prev_sd,
                'prev_end': prev_ed,
                'report_year': report_year,
                'report_week': report_week,
                'report_name': report_name,
                'report_sequence': report_sequence,
            },
            'current_week': current_week,
            'year_to_date': year_to_date,
            'prev_week': prev_week,
            'week_over_week': week_over_week,
            'daily_opens_stacked': daily_opens_stacked,
            'weekly_opens_stacked': weekly_opens_stacked,
            'channels': channels,
            'internet_ratio': internet_ratio,
            'kpi': kpi,
        }
    })
