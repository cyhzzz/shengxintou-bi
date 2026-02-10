# -*- coding: utf-8 -*-
"""
飞书同步API路由 - 智能版本
支持自动表结构检查、字段同步、增量更新
"""

from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models import DailyMetricsUnified
from backend.utils.feishu_client import FeishuClient
from backend.utils.feishu_field_mapping import FIELD_MAPPING
import threading
import uuid
import requests
from datetime import datetime

bp = Blueprint('feishu_sync', __name__)

# 存储任务状态（内存）
sync_tasks = {}


@bp.route('/push', methods=['POST', 'OPTIONS'])
def push_to_feishu():
    """
    推送本地数据到飞书（智能同步）

    请求体:
        {
            "table": "daily_metrics_unified",
            "force_full_sync": false  // 是否强制全量同步
        }

    返回:
        {
            "success": true,
            "task_id": "任务ID"
        }
    """
    # 处理OPTIONS预检请求
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

    data = request.get_json() or {}
    table_name = data.get('table', 'daily_metrics_unified')
    force_full_sync = data.get('force_full_sync', False)

    task_id = str(uuid.uuid4())
    sync_tasks[task_id] = {
        'status': 'running',
        'progress': 0,
        'total': 0,
        'processed': 0,
        'message': '正在检查表结构...'
    }

    # 异步执行智能同步
    thread = threading.Thread(
        target=_smart_push_async,
        args=(task_id, table_name, force_full_sync)
    )
    thread.start()

    return jsonify({
        'success': True,
        'task_id': task_id
    })


@bp.route('/pull', methods=['POST', 'OPTIONS'])
def pull_from_feishu():
    """从飞书拉取数据到本地"""
    # 处理OPTIONS预检请求
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

    data = request.get_json() or {}
    table_name = data.get('table', 'daily_metrics_unified')

    task_id = str(uuid.uuid4())
    sync_tasks[task_id] = {
        'status': 'running',
        'progress': 0,
        'total': 0,
        'processed': 0,
        'message': '正在拉取数据...'
    }

    # 异步执行
    thread = threading.Thread(
        target=_pull_data_async,
        args=(task_id, table_name)
    )
    thread.start()

    return jsonify({
        'success': True,
        'task_id': task_id
    })


@bp.route('/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    """查询同步进度"""
    task = sync_tasks.get(task_id)
    if not task:
        return jsonify({
            'success': False,
            'error': '任务不存在'
        }), 404

    return jsonify({
        'success': True,
        'data': task
    })


@bp.route('/tables', methods=['GET'])
def get_tables_info():
    """
    获取表信息对比

    返回本地表和云端表的结构对比
    """
    try:
        import config
        from app import app

        with app.app_context():
            feishu_client = FeishuClient(
                config.FEISHU_APP_ID,
                config.FEISHU_APP_SECRET
            )

            tables_info = {}

            for table_name, table_id in config.FEISHU_TABLE_IDS.items():
                # 获取云端字段
                token = feishu_client.get_tenant_access_token()
                url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/fields"
                headers = {"Authorization": f"Bearer {token}"}
                response = requests.get(url, headers=headers)
                data = response.json()

                cloud_fields = []
                if data.get('code') == 0:
                    cloud_fields = data.get('data', {}).get('items', [])

                # 获取本地字段映射
                local_fields = FIELD_MAPPING.get(table_name, {})

                # 对比字段
                cloud_field_names = {f.get('field_name'): f for f in cloud_fields}
                local_field_names = set(local_fields.values())

                missing_in_cloud = local_field_names - set(cloud_field_names.keys())
                missing_in_local = set(cloud_field_names.keys()) - local_field_names

                tables_info[table_name] = {
                    'table_id': table_id,
                    'cloud_fields_count': len(cloud_fields),
                    'local_fields_count': len(local_fields),
                    'missing_in_cloud': list(missing_in_cloud),
                    'missing_in_local': list(missing_in_local),
                    'needs_sync': len(missing_in_cloud) > 0
                }

            return jsonify({
                'success': True,
                'data': tables_info
            })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _smart_push_async(task_id, table_name, force_full_sync):
    """
    智能推送数据

    步骤：
    1. 检查云端表结构
    2. 对比本地字段，找出差异
    3. 自动创建缺失字段（如果需要）
    4. 判断是增量更新还是全量同步
    5. 执行数据同步
    """
    try:
        from app import app
        import config

        with app.app_context():
            if not hasattr(config, 'FEISHU_BITABLE_ID') or not hasattr(config, 'FEISHU_TABLE_IDS'):
                raise Exception("飞书配置缺失")

            if table_name not in config.FEISHU_TABLE_IDS:
                raise Exception(f"表 {table_name} 未配置")

            table_id = config.FEISHU_TABLE_IDS[table_name]
            field_mapping = FIELD_MAPPING.get(table_name, {})

            if not field_mapping:
                raise Exception(f"表 {table_name} 的字段映射不存在")

            # ===== 步骤1: 检查云端表结构 =====
            sync_tasks[task_id]['message'] = '正在检查云端表结构...'
            sync_tasks[task_id]['progress'] = 5

            feishu_client = FeishuClient(
                config.FEISHU_APP_ID,
                config.FEISHU_APP_SECRET
            )

            token = feishu_client.get_tenant_access_token()
            url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/fields"
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(url, headers=headers)
            data = response.json()

            if data.get('code') != 0:
                raise Exception(f"获取云端字段失败: {data.get('msg')}")

            cloud_fields = data.get('data', {}).get('items', [])
            cloud_field_names = {f.get('field_name'): f for f in cloud_fields}
            local_field_names = set(field_mapping.values())

            # ===== 步骤2: 对比字段差异 =====
            missing_in_cloud = local_field_names - set(cloud_field_names.keys())

            sync_tasks[task_id]['progress'] = 10

            # ===== 步骤3: 自动创建缺失字段 =====
            if missing_in_cloud:
                sync_tasks[task_id]['message'] = f'发现{len(missing_in_cloud)}个缺失字段，正在创建...'

                for field_name in sorted(missing_in_cloud):
                    # 根据字段名推断类型
                    field_type = _infer_field_type(field_name)

                    create_result = _create_feishu_field(
                        token,
                        config.FEISHU_BITABLE_ID,
                        table_id,
                        field_name,
                        field_type
                    )

                    if not create_result['success']:
                        sync_tasks[task_id]['status'] = 'failed'
                        sync_tasks[task_id]['message'] = f"创建字段{field_name}失败: {create_result.get('error')}"
                        return

                sync_tasks[task_id]['message'] = f'成功创建{len(missing_in_cloud)}个字段'

            # ===== 步骤4: 获取本地数据 =====
            sync_tasks[task_id]['message'] = '正在读取本地数据...'
            sync_tasks[task_id]['progress'] = 20

            if table_name == 'daily_metrics_unified':
                records = DailyMetricsUnified.query.all()
            else:
                raise Exception(f"不支持的表: {table_name}")

            total_records = len(records)
            sync_tasks[task_id]['total'] = total_records

            if total_records == 0:
                sync_tasks[task_id]['status'] = 'completed'
                sync_tasks[task_id]['message'] = '本地无数据需要同步'
                sync_tasks[task_id]['progress'] = 100
                return

            # ===== 步骤5: 判断增量还是全量 =====
            sync_tasks[task_id]['message'] = '正在分析同步策略...'
            sync_tasks[task_id]['progress'] = 25

            need_full_sync = force_full_sync
            min_date_to_sync = None

            if not need_full_sync:
                # 检查云端数据日期范围
                cloud_max_date = _get_cloud_max_date(token, table_id)

                if cloud_max_date:
                    # 云端有数据，获取本地最新日期
                    local_max_date = max([r.date for r in records] if records else None)

                    if local_max_date:
                        from datetime import timedelta
                        # 如果本地最新日期大于云端最新日期，执行增量更新
                        if local_max_date > cloud_max_date:
                            need_full_sync = False
                            min_date_to_sync = cloud_max_date + timedelta(days=1)
                            sync_tasks[task_id]['message'] = f'增量更新：{min_date_to_sync} 至 {local_max_date}'
                        else:
                            # 云端数据已是最新，无需同步
                            sync_tasks[task_id]['status'] = 'completed'
                            sync_tasks[task_id]['progress'] = 100
                            sync_tasks[task_id]['message'] = '云端数据已是最新，无需同步'
                            return
                    else:
                        need_full_sync = True
                else:
                    # 云端无数据，需要全量同步
                    need_full_sync = True

            # 如果是增量更新，过滤数据
            if not need_full_sync and min_date_to_sync:
                original_count = len(records)
                records = [r for r in records if r.date >= min_date_to_sync]
                sync_tasks[task_id]['message'] = f'增量更新：过滤后 {len(records)} 条记录（原始 {original_count} 条）'

            # ===== 步骤6: 如果需要全量同步，先清空云端数据 =====
            if need_full_sync:
                sync_tasks[task_id]['message'] = '检测到结构变化或首次同步，正在清空云端历史数据...'
                sync_tasks[task_id]['progress'] = 30

                # 批量删除所有记录
                delete_result = _clear_all_feishu_records(token, table_id)

                if not delete_result['success']:
                    raise Exception(f"清空云端数据失败: {delete_result.get('error')}")

                sync_tasks[task_id]['message'] = f'已清空云端数据，准备上传{len(records)}条记录'

            # ===== 步骤7: 转换并上传数据 =====
            sync_tasks[task_id]['message'] = '正在上传数据...'
            sync_tasks[task_id]['progress'] = 35

            records_to_push = []
            for record in records:
                feishu_record = {}
                for db_field, feishu_field_name in field_mapping.items():
                    value = getattr(record, db_field, None)

                    # 跳过None和空字符串，但保留0值
                    if value is None or value == '':
                        continue

                    # 类型转换
                    try:
                        if hasattr(value, 'strftime'):  # datetime或date
                            from datetime import datetime
                            if isinstance(value, type(datetime.now().date())):  # date对象
                                value = int(datetime.combine(value, datetime.min.time()).timestamp() * 1000)
                            else:  # datetime对象
                                value = int(value.timestamp() * 1000)
                        elif isinstance(value, (int, float)) or str(type(value).__name__) == 'Decimal':
                            value = float(value)

                        feishu_record[feishu_field_name] = value
                    except Exception as e:
                        # 类型转换失败，记录警告并跳过该字段
                        print(f"警告: 字段 {db_field} 类型转换失败: {str(e)}")
                        continue

                # 只添加非空记录
                if feishu_record:
                    records_to_push.append(feishu_record)

            if not records_to_push:
                sync_tasks[task_id]['status'] = 'failed'
                sync_tasks[task_id]['message'] = '没有有效数据可上传（所有记录都为空）'
                sync_tasks[task_id]['progress'] = 100
                return

            # 批量推送（每100条一批）
            batch_size = 100
            total_batches = (len(records_to_push) + batch_size - 1) // batch_size

            for i in range(0, len(records_to_push), batch_size):
                batch = records_to_push[i:i+batch_size]

                print(f"准备上传批次 {i//batch_size + 1}/{total_batches}，共 {len(batch)} 条记录")
                print(f"示例记录: {batch[0] if batch else 'empty'}")

                result = feishu_client.push_records(
                    config.FEISHU_BITABLE_ID,
                    table_id,
                    batch
                )

                print(f"飞书API响应: {result}")

                if result.get('code') == 0:
                    processed = i + len(batch)
                    sync_tasks[task_id]['processed'] = processed
                    sync_tasks[task_id]['progress'] = 35 + int((processed / len(records_to_push)) * 60)
                    sync_tasks[task_id]['message'] = f'已上传 {processed}/{len(records_to_push)} 条记录'
                else:
                    error_msg = result.get('msg', '未知错误')
                    error_code = result.get('code', 'unknown')
                    raise Exception(f"推送失败 (code={error_code}): {error_msg}")

            # ===== 完成 =====
            sync_tasks[task_id]['status'] = 'completed'
            sync_tasks[task_id]['progress'] = 100
            sync_tasks[task_id]['message'] = f'成功同步{len(records_to_push)}条记录'

    except Exception as e:
        sync_tasks[task_id]['status'] = 'failed'
        sync_tasks[task_id]['message'] = f'同步失败: {str(e)}'


def _pull_data_async(task_id, table_name):
    """异步拉取数据"""
    try:
        from app import app
        import config

        with app.app_context():
            if not hasattr(config, 'FEISHU_BITABLE_ID') or not hasattr(config, 'FEISHU_TABLE_IDS'):
                raise Exception("飞书配置缺失")

            if table_name not in config.FEISHU_TABLE_IDS:
                raise Exception(f"表 {table_name} 未配置")

            # 1. 从飞书拉取数据
            feishu_client = FeishuClient(
                config.FEISHU_APP_ID,
                config.FEISHU_APP_SECRET
            )

            records = feishu_client.pull_records(
                config.FEISHU_BITABLE_ID,
                config.FEISHU_TABLE_IDS[table_name]
            )

            sync_tasks[task_id]['total'] = len(records)
            sync_tasks[task_id]['message'] = f'共{len(records)}条记录'

            if len(records) == 0:
                sync_tasks[task_id]['status'] = 'completed'
                sync_tasks[task_id]['progress'] = 100
                sync_tasks[task_id]['message'] = '云端无数据'
                return

            # 2. 转换为数据库格式
            field_mapping = FIELD_MAPPING.get(table_name, {})
            reverse_mapping = {v: k for k, v in field_mapping.items()}

            for record in records:
                feishu_fields = record.get('fields', {})

                if table_name == 'daily_metrics_unified':
                    db_record = DailyMetricsUnified()

                    for feishu_field_name, db_field in reverse_mapping.items():
                        value = feishu_fields.get(feishu_field_name)
                        if value is not None:
                            # 类型转换
                            if isinstance(value, (int, float)) and value > 10000000000:
                                # 可能是时间戳（毫秒），转换为日期
                                from datetime import datetime
                                value = datetime.fromtimestamp(value / 1000).date()

                            setattr(db_record, db_field, value)

                    # 使用merge实现upsert
                    db.session.merge(db_record)

                sync_tasks[task_id]['processed'] += 1
                progress = int((sync_tasks[task_id]['processed'] / len(records)) * 100)
                sync_tasks[task_id]['progress'] = progress

            db.session.commit()

            sync_tasks[task_id]['status'] = 'completed'
            sync_tasks[task_id]['progress'] = 100
            sync_tasks[task_id]['message'] = f'成功拉取{len(records)}条记录'

    except Exception as e:
        sync_tasks[task_id]['status'] = 'failed'
        sync_tasks[task_id]['message'] = f'拉取失败: {str(e)}'


def _infer_field_type(field_name):
    """
    根据字段名推断字段类型

    返回飞书字段类型代码：
    - 1: 文本
    - 2: 数字
    - 5: 日期
    """
    # 日期字段
    if '日期' in field_name or 'date' in field_name.lower():
        return 5

    # 数字字段
    if any(keyword in field_name for keyword in [
        '花费', '曝光', '点击', '线索', '潜客', '开户', '有效',
        'cost', 'impressions', 'clicks', 'leads', 'users', 'count'
    ]):
        return 2

    # 默认文本
    return 1


def _create_feishu_field(token, bitable_id, table_id, field_name, field_type):
    """在飞书表格中创建字段"""
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{bitable_id}/tables/{table_id}/fields"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "field_name": field_name,
        "type": field_type
    }

    response = requests.post(url, json=payload, headers=headers)
    result = response.json()

    if result.get('code') == 0:
        return {'success': True}
    else:
        return {'success': False, 'error': result.get('msg')}


def _get_cloud_max_date(token, table_id):
    """获取云端数据的最大日期"""
    try:
        import config
        url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/records"
        headers = {"Authorization": f"Bearer {token}"}

        # 获取记录，按日期降序排序，只取第一条
        params = {
            "page_size": 1,
            "sort": [{"field_name": "日期", "desc": True}]
        }
        response = requests.get(url, params=params, headers=headers)
        data = response.json()

        if data.get('code') == 0:
            items = data.get('data', {}).get('items', [])
            if items:
                # 从字段中提取日期
                fields = items[0].get('fields', {})
                date_timestamp = fields.get('日期')
                if date_timestamp:
                    from datetime import datetime
                    # 转换毫秒时间戳为日期
                    return datetime.fromtimestamp(date_timestamp / 1000).date()

        return None
    except Exception as e:
        print(f"获取云端日期范围失败: {str(e)}")
        return None


def _check_cloud_data_range(token, table_id):
    """检查云端是否有数据"""
    import config
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/records"
    headers = {"Authorization": f"Bearer {token}"}

    params = {"page_size": 1}
    response = requests.get(url, params=params, headers=headers)
    data = response.json()

    if data.get('code') == 0:
        total = data.get('data', {}).get('total', 0)
        return total > 0

    return False


def _clear_all_feishu_records(token, table_id):
    """清空飞书表格的所有记录"""
    import config
    # 先获取所有记录的ID
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/records"
    headers = {"Authorization": f"Bearer {token}"}

    all_record_ids = []
    page_token = None

    while True:
        params = {"page_size": 100}
        if page_token:
            params["page_token"] = page_token

        response = requests.get(url, params=params, headers=headers)
        data = response.json()

        if data.get('code') != 0:
            return {'success': False, 'error': data.get('msg')}

        items = data.get('data', {}).get('items', [])
        all_record_ids.extend([item.get('record_id') for item in items])

        page_token = data.get('data', {}).get('page_token')
        if not page_token:
            break

    # 批量删除
    if all_record_ids:
        delete_url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{config.FEISHU_BITABLE_ID}/tables/{table_id}/records/batch_delete"

        # 每次删除500条
        batch_size = 500
        for i in range(0, len(all_record_ids), batch_size):
            batch_ids = all_record_ids[i:i+batch_size]

            delete_payload = {
                "records": batch_ids,  # 使用 records 数组 (注意: 不是 record_ids)
                "all": False
            }

            response = requests.post(delete_url, json=delete_payload, headers=headers)
            result = response.json()

            if result.get('code') != 0:
                return {'success': False, 'error': result.get('msg')}

    return {'success': True}
