"""
小红书内容笔记日级数据解析示例
用于处理"内容笔记-日（含主号+kos、含投放笔记）.csv"文件
"""

import pandas as pd
from datetime import datetime
from backend.models import XhsNotesContentDaily, db
from backend.database import logger


def normalize_date(date_str, input_format='%Y%m%d'):
    """标准化日期格式"""
    if pd.isna(date_str) or date_str == '':
        return None

    date_str = str(date_str).strip()

    try:
        if input_format == '%Y%m%d':
            # 20250523 -> 2025-05-23
            year = date_str[:4]
            month = date_str[4:6]
            day = date_str[6:8]
            return datetime.strptime(f'{year}-{month}-{day}', '%Y-%m-%d').date()
        else:
            return datetime.strptime(date_str, input_format).date()
    except Exception as e:
        logger.error(f"日期解析失败: {date_str}, 错误: {str(e)}")
        return None


def parse_datetime(date_str, input_format='%Y/%m/%d %H:%M'):
    """解析日期时间"""
    if pd.isna(date_str) or date_str == '':
        return None

    date_str = str(date_str).strip()

    try:
        return datetime.strptime(date_str, input_format)
    except Exception as e:
        logger.error(f"日期时间解析失败: {date_str}, 错误: {str(e)}")
        return None


def parse_int(value):
    """解析整数（去除逗号和空格）"""
    if pd.isna(value) or value == '':
        return 0
    try:
        return int(str(value).replace(',', '').replace(' ', '').strip())
    except:
        return 0


def parse_decimal(value):
    """解析小数（去除逗号、空格、百分号）"""
    if pd.isna(value) or value == '':
        return None
    try:
        cleaned = str(value).replace(',', '').replace(' ', '').replace('%', '').strip()
        return float(cleaned) if cleaned else None
    except:
        return None


def parse_percent(value):
    """解析百分比（转换小数）"""
    if pd.isna(value) or value == '':
        return None
    try:
        cleaned = str(value).replace(',', '').replace(' ', '').replace('%', '').strip()
        decimal_value = float(cleaned)
        return decimal_value / 100 if decimal_value > 1 else decimal_value
    except:
        return None


def validate_content_note_data(record):
    """验证内容笔记数据质量"""
    errors = []
    warnings = []

    # 必填字段验证
    if not record.get('data_date'):
        errors.append("数据日期不能为空")

    if not record.get('note_id'):
        errors.append("笔记ID不能为空")

    # 数值范围验证
    if record.get('total_impressions', 0) < 0:
        errors.append("全部曝光量不能为负数")

    if record.get('total_reads', 0) < 0:
        errors.append("全部阅读量不能为负数")

    if record.get('total_reads', 0) > record.get('total_impressions', 0):
        warnings.append("全部阅读量大于全部曝光量，可能数据异常")

    # 互动率合理性验证
    interaction_rate = record.get('total_interaction_rate')
    impressions = record.get('total_impressions', 0)
    interactions = record.get('total_interactions', 0)

    if interaction_rate is not None and impressions > 0:
        calculated_rate = (interactions / impressions) * 100
        if abs(interaction_rate - calculated_rate) > 5:
            warnings.append(f"互动率异常: 提供值{interaction_rate}%, 计算值{calculated_rate:.2f}%")

    # ROI合理性验证
    roi = record.get('payment_roi')
    amount = record.get('payment_amount_7d', 0)
    if roi is not None and amount > 0:
        # ROI应该在合理范围内
        if roi < 0 or roi > 100:
            warnings.append(f"ROI值异常: {roi}")

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }


def process_xhs_notes_content_daily(filepath):
    """
    处理小红书内容笔记日级数据

    Args:
        filepath: CSV文件路径

    Returns:
        dict: 处理结果统计
    """
    logger.info(f"开始处理小红书内容笔记日级数据: {filepath}")

    inserted_count = 0
    updated_count = 0
    failed_count = 0
    failed_rows = []

    try:
        # 读取CSV文件
        df = pd.read_csv(filepath, encoding='utf-8-sig')

        logger.info(f"读取到 {len(df)} 条数据")

        for index, row in df.iterrows():
            try:
                # 解析数据日期
                data_date = normalize_date(row['数据日期'], format='%Y%m%d')

                # 解析笔记发布时间
                publish_time = parse_datetime(
                    row['笔记发布_time'],
                    format='%Y/%m/%d %H:%M'
                ) if '笔记发布_time' in row else parse_datetime(
                    row.get('笔记发布时间', ''),
                    format='%Y/%m/%d %H:%M'
                )

                # 笔记ID
                note_id = str(row['笔记id']).strip()

                # 检查是否已存在
                existing = db.session.query(XhsNotesContentDaily).filter_by(
                    data_date=data_date,
                    note_id=note_id
                ).first()

                # 构建记录数据
                record_data = {
                    'data_date': data_date,
                    'note_id': note_id,
                    'note_title': row.get('笔记名称', ''),
                    'note_url': row.get('笔记链接', ''),
                    'note_publish_time': publish_time,
                    'note_source': row.get('笔记来源', ''),
                    'note_type': row.get('笔记类型', ''),

                    # 创作者信息
                    'creator_name': row.get('笔记创作者名称', ''),
                    'creator_id': row.get('笔记创作者ID', ''),
                    'creator_followers': parse_int(row.get('作者粉丝量', 0)),

                    # 业务属性
                    'note_status': row.get('笔记状态', ''),
                    'custom_tags': row.get('自定义标签', ''),
                    'product_binding_status': row.get('产品绑定状态', ''),
                    'producer': row.get('生产者', ''),
                    'ad_strategy': row.get('广告策略', ''),

                    # 互动指标
                    'total_impressions': parse_int(row.get('全部曝光量', 0)),
                    'total_reads': parse_int(row.get('全部阅读量', 0)),
                    'total_interactions': parse_int(row.get('全部互动量', 0)),
                    'total_interaction_rate': parse_percent(row.get('全部互动率', 0)),

                    # 电商转化数据
                    'payment_orders_7d': parse_int(row.get('7日支付订单量', 0)),
                    'payment_amount_7d': parse_decimal(row.get('7日支付金额', 0)),
                    'payment_conversion_rate': parse_percent(row.get('7日支付转化率', 0)),
                    'payment_roi': parse_decimal(row.get('7日支付ROI', 0)),

                    # 直播数据
                    'live_view_count': parse_int(row.get('直播间有效观看次数', 0)),
                }

                # 数据质量验证
                validation = validate_content_note_data(record_data)

                if not validation['valid']:
                    logger.error(f"数据验证失败 (行{index+2}): {validation['errors']}")
                    failed_count += 1
                    failed_rows.append(index + 2)  # +2 因为pandas从0开始，CSV从1开始
                    continue

                if validation['warnings']:
                    logger.warning(f"数据警告 (行{index+2}): {validation['warnings']}")

                if existing:
                    # 更新现有记录
                    for key, value in record_data.items():
                        setattr(existing, key, value)
                    updated_count += 1
                else:
                    # 插入新记录
                    new_record = XhsNotesContentDaily(**record_data)
                    db.session.add(new_record)
                    inserted_count += 1

            except Exception as e:
                logger.error(f"处理笔记数据失败 (行{index+2}): {str(e)}")
                logger.error(f"行数据: {row.to_dict()}")
                failed_count += 1
                failed_rows.append(index + 2)
                continue

        # 提交事务
        db.session.commit()

        logger.info(f"数据处理完成: 插入{inserted_count}条, 更新{updated_count}条, 失败{failed_count}条")

        return {
            'success': True,
            'inserted': inserted_count,
            'updated': updated_count,
            'failed': failed_count,
            'failed_rows': failed_rows,
            'total': len(df)
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"处理文件失败: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'inserted': inserted_count,
            'updated': updated_count,
            'failed': failed_count + len(df),
            'total': len(df)
        }


# 批量处理示例
def batch_process_content_notes(file_list):
    """
    批量处理多个内容笔记CSV文件

    Args:
        file_list: 文件路径列表

    Returns:
        dict: 批量处理结果
    """
    total_results = {
        'total_files': len(file_list),
        'success_files': 0,
        'failed_files': 0,
        'total_inserted': 0,
        'total_updated': 0,
        'total_failed': 0,
        'file_details': []
    }

    for filepath in file_list:
        logger.info(f"处理文件: {filepath}")

        result = process_xhs_notes_content_daily(filepath)

        if result['success']:
            total_results['success_files'] += 1
            total_results['total_inserted'] += result['inserted']
            total_results['total_updated'] += result['updated']
            total_results['total_failed'] += result['failed']
        else:
            total_results['failed_files'] += 1

        total_results['file_details'].append({
            'filepath': filepath,
            'result': result
        })

    return total_results


# 使用示例
if __name__ == '__main__':
    # 单文件处理
    csv_file = '内容笔记-日（含主号+kos、含投放笔记）.csv'
    result = process_xhs_notes_content_daily(csv_file)
    print(f"处理结果: {result}")

    # 批量处理
    # file_list = [
    #     'data/20250123_内容笔记.csv',
    #     'data/20250124_内容笔记.csv',
    # ]
    # batch_result = batch_process_content_notes(file_list)
    # print(f"批量处理结果: {batch_result}")
