# -*- coding: utf-8 -*-
"""
后端转化数据处理器 - 完整版 (v2.0)

功能:
1. 完整映射Excel的40个字段到backend_conversions表
2. 支持全量覆盖导入模式 (每次导入前删除所有旧数据)
3. 支持Excel (.xlsx, .xls) 和 CSV 格式
4. 自动处理日期格式转换和布尔值转换
"""

import pandas as pd
from datetime import datetime
from backend.processors.base_processor import DataProcessor
from backend.models import BackendConversions
from typing import Dict, List, Tuple, Any, Optional


class BackendConversionProcessor(DataProcessor):
    """后端转化数据处理器（完整版）"""

    # Excel列名到数据库字段的完整映射 (40个字段)
    COLUMN_MAPPING = {
        '微信昵称': 'wechat_nickname',
        '资金账号': 'capital_account',
        '开户营业部': 'opening_branch',
        '客户性别': 'customer_gender',
        '平台来源': 'platform_source',
        '流量类型': 'traffic_type',
        '客户来源': 'customer_source',
        '是否客户开口': 'is_customer_mouth',
        '是否有效线索': 'is_valid_lead',
        '是否开户中断': 'is_open_account_interrupted',
        '开户中断日期': 'open_account_interrupted_date',
        '是否开户': 'is_opened_account',
        '是否为有效户': 'is_valid_customer',
        '是否为存量客户': 'is_existing_customer',
        '是否为存量有效户': 'is_existing_valid_customer',
        '是否删除企微': 'is_delete_enterprise_wechat',
        '线索日期': 'lead_date',
        '首次触达时间': 'first_contact_time',
        '最近互动时间': 'last_contact_time',
        '互动次数': 'interaction_count',
        '营销人员互动次数': 'sales_interaction_count',
        '添加员工号': 'add_employee_no',
        '添加员工姓名': 'add_employee_name',
        '开户时间': 'account_opening_time',
        '微信认证状态': 'wechat_verify_status',
        '微信认证时间': 'wechat_verify_time',
        '有效户时间': 'valid_customer_time',
        '资产': 'assets',
        '客户贡献': 'customer_contribution',
        '广告账号': 'ad_account',
        '广告代理商': 'agency',
        '广告ID': 'ad_id',
        '创意ID': 'creative_id',
        '笔记ID': 'note_id',
        '笔记名称': 'note_title',
        '平台用户ID': 'platform_user_id',
        '平台用户昵称': 'platform_user_nickname',
        '广告点击日期': 'ad_click_date',
        '生产者': 'producer',
        '企微标签': 'enterprise_wechat_tags',
    }

    def get_required_columns(self) -> List[str]:
        """获取必需列（由于有完整映射，所有列都是可选的）"""
        return []

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据 - 只验证线索日期非空"""
        # 获取线索日期
        lead_date_value = self._get_column_value(row, ['线索日期', 'lead_date'])

        # 使用pd.isna()检查NaN
        if pd.isna(lead_date_value) or not lead_date_value:
            return False, "线索日期为空"

        # 尝试解析日期
        try:
            self.safe_date(lead_date_value)
        except Exception as e:
            return False, f"线索日期格式错误: {lead_date_value}"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据 - 完整映射所有40个字段

        字段类型处理:
        - 日期字段: lead_date, open_account_interrupted_date, first_contact_time,
                    last_contact_time, account_opening_time, wechat_verify_time,
                    valid_customer_time, ad_click_date
        - 布尔字段: is_customer_mouth, is_valid_lead, is_open_account_interrupted,
                    is_opened_account, is_valid_customer, is_existing_customer,
                    is_existing_valid_customer, is_delete_enterprise_wechat
        - 数值字段: interaction_count, sales_interaction_count, assets, customer_contribution
        - 字符串字段: 其他所有字段
        """
        data = {}

        # 遍历所有列映射
        for excel_col, db_field in self.COLUMN_MAPPING.items():
            value = self._get_column_value(row, [excel_col])

            # 跳过NaN值
            if pd.isna(value):
                # 根据字段类型设置默认值
                if db_field.startswith('is_'):
                    data[db_field] = False
                elif db_field in ['interaction_count', 'sales_interaction_count']:
                    data[db_field] = 0
                elif db_field in ['assets', 'customer_contribution']:
                    data[db_field] = None
                else:
                    data[db_field] = None
                continue

            # 根据字段类型进行转换
            if db_field in ['lead_date', 'open_account_interrupted_date', 'ad_click_date']:
                # 日期字段 (Date类型)
                data[db_field] = self.safe_date(value)

            elif db_field in ['first_contact_time', 'last_contact_time', 'account_opening_time',
                             'wechat_verify_time', 'valid_customer_time']:
                # 时间戳字段 (DateTime类型)
                data[db_field] = self.safe_datetime(value)

            elif db_field.startswith('is_'):
                # 布尔字段
                data[db_field] = self.safe_bool(value)

            elif db_field in ['interaction_count', 'sales_interaction_count']:
                # 整数字段
                data[db_field] = self.safe_int(value)

            elif db_field in ['assets', 'customer_contribution']:
                # 数值字段 (保留2位小数)
                data[db_field] = self.safe_numeric(value)

            else:
                # 字符串字段
                data[db_field] = self.safe_str(value)

        return data

    def get_model_class(self):
        """获取模型类"""
        return BackendConversions

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段 - 不使用唯一约束，每次全量覆盖"""
        return []

    def import_data(
        self,
        file_path: str,
        overwrite: bool = True,  # 默认全量覆盖
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """
        导入数据（重写以支持全量覆盖模式）

        全量覆盖逻辑:
        1. 删除 backend_conversions 表中的所有现有数据
        2. 导入Excel/CSV中的所有数据
        3. 不进行唯一性检查，直接批量插入

        Args:
            file_path: 文件路径
            overwrite: 是否覆盖模式（默认True，强制全量覆盖）
            batch_size: 批量插入大小

        Returns:
            导入结果字典
        """
        start_time = pd.Timestamp.now()

        try:
            # 1. 读取文件
            if file_path.endswith('.csv'):
                df, encoding = self.read_csv_safe(file_path)
            elif file_path.endswith(('.xlsx', '.xls')):
                df, encoding = self.read_excel_safe(file_path)
            else:
                return {
                    'success': False,
                    'error': '不支持的文件格式，仅支持 .xlsx, .xls, .csv'
                }

            total_rows = len(df)

            # 2. 全量覆盖模式：删除所有现有数据
            if overwrite:
                try:
                    deleted_count = self.db_session.query(BackendConversions).count()
                    self.db_session.query(BackendConversions).delete()
                    self.db_session.commit()
                    print(f"[BackendConversionProcessor] 全量覆盖模式：已删除 {deleted_count} 条旧数据")
                except Exception as e:
                    self.db_session.rollback()
                    return {
                        'success': False,
                        'error': f'删除旧数据失败: {str(e)}'
                    }

            # 3. 清洗数据
            df = self.clean_data(df)

            # 4. 计算质量评分
            quality_score = self.calculate_quality_score(df)

            # 5. 批量处理和插入数据
            inserted_count = 0
            failed_count = 0
            batch_data = []

            ModelClass = self.get_model_class()

            for idx, row in df.iterrows():
                try:
                    # 验证行数据
                    is_valid, error_msg = self.validate_row(row)
                    if not is_valid:
                        failed_count += 1
                        if error_msg and len(self.errors) < 100:
                            self.errors.append(f"第 {idx + 2} 行: {error_msg}")
                        continue

                    # 转换为模型字段
                    data = self.process_row(row)
                    batch_data.append(data)

                    # 批量插入
                    if len(batch_data) >= batch_size:
                        self.db_session.bulk_insert_mappings(ModelClass, batch_data)
                        self.db_session.commit()
                        inserted_count += len(batch_data)
                        print(f"[BackendConversionProcessor] 已插入 {inserted_count}/{total_rows} 条记录")
                        batch_data = []

                except Exception as e:
                    failed_count += 1
                    if len(self.errors) < 100:
                        self.errors.append(f"第 {idx + 2} 行: {str(e)}")
                    continue

            # 插入剩余数据
            if batch_data:
                self.db_session.bulk_insert_mappings(ModelClass, batch_data)
                self.db_session.commit()
                inserted_count += len(batch_data)

            # 计算耗时
            processing_time = (pd.Timestamp.now() - start_time).total_seconds()

            return {
                'success': True,
                'total_rows': total_rows,
                'processed_rows': inserted_count,
                'inserted_rows': inserted_count,
                'updated_rows': 0,  # 全量覆盖模式不更新
                'failed_rows': failed_count,
                'quality_score': quality_score['overall'],
                'encoding': encoding,
                'processing_time': processing_time,
                'overwrite_mode': overwrite,
                'errors': self.errors[:20],  # 最多返回20个错误
                'warnings': self.warnings[:10]
            }

        except Exception as e:
            self.db_session.rollback()
            return {
                'success': False,
                'error': str(e),
                'errors': self.errors
            }

    def safe_datetime(self, value) -> Optional[datetime]:
        """
        安全转换为datetime对象

        支持多种格式:
        - YYYY-MM-DD HH:MM:SS
        - YYYY-MM-DD
        - Excel日期序列号
        """
        if pd.isna(value):
            return None

        # 如果已经是datetime对象
        if isinstance(value, datetime):
            return value

        # 如果是数值（Excel日期序列号）
        if isinstance(value, (int, float)):
            try:
                return pd.to_datetime('1899-12-30') + pd.Timedelta(days=value)
            except:
                return None

        # 尝试解析字符串
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None

            # 尝试多种格式
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M:%S.%f',
                '%Y/%m/%d %H:%M:%S',
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%Y%m%d',
            ]

            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue

        # 最后尝试使用pandas
        try:
            return pd.to_datetime(value)
        except:
            return None

    def safe_bool(self, value) -> bool:
        """
        安全转换为布尔值

        支持的表示:
        - True: 1, '1', '是', 'Y', 'YES', 'true', True
        - False: 0, '0', '否', 'N', 'NO', 'false', False, None, NaN
        """
        if pd.isna(value):
            return False

        if isinstance(value, bool):
            return value

        if isinstance(value, (int, float)):
            return bool(value)

        if isinstance(value, str):
            value = value.strip().lower()
            if value in ['1', '是', 'y', 'yes', 'true']:
                return True
            if value in ['0', '否', 'n', 'no', 'false', '']:
                return False

        return False

    def safe_int(self, value) -> int:
        """安全转换为整数"""
        if pd.isna(value):
            return 0

        try:
            return int(float(value))
        except (ValueError, TypeError):
            return 0

    def safe_numeric(self, value) -> Optional[float]:
        """安全转换为数值（保留2位小数）"""
        if pd.isna(value):
            return None

        try:
            num = float(value)
            return round(num, 2)
        except (ValueError, TypeError):
            return None

    def _get_column_value(self, row: pd.Series, possible_names: List[str]) -> Any:
        """
        获取列值（支持多种可能的列名）

        Args:
            row: 数据行
            possible_names: 可能的列名列表

        Returns:
            列值，找不到返回None
        """
        for name in possible_names:
            if name in row.index:
                return row[name]
        return None

    def calculate_quality_score(self, df: pd.DataFrame) -> Dict[str, float]:
        """
        计算数据质量评分

        评估维度:
        1. 完整性: 必填字段（线索日期）的填充率
        2. 唯一性: 不适用（全量覆盖）
        3. 有效性: 日期格式正确率
        4. 一致性: 平台来源标准化程度
        """
        scores = {}

        # 1. 完整性评分 - 线索日期填充率
        lead_date_col = self._find_column(df, ['线索日期', 'lead_date'])
        if lead_date_col:
            non_null_count = df[lead_date_col].notna().sum()
            completeness_score = (non_null_count / len(df)) * 100
            scores['completeness'] = completeness_score
        else:
            scores['completeness'] = 0

        # 2. 有效性评分 - 日期格式正确率
        if lead_date_col:
            valid_count = 0
            for value in df[lead_date_col]:
                if pd.notna(value):
                    try:
                        self.safe_date(value)
                        valid_count += 1
                    except:
                        pass
            validity_score = (valid_count / len(df)) * 100 if len(df) > 0 else 0
            scores['validity'] = validity_score
        else:
            scores['validity'] = 0

        # 3. 一致性评分 - 平台来源标准化
        platform_col = self._find_column(df, ['平台来源', 'platform_source'])
        if platform_col:
            normalized_count = 0
            for value in df[platform_col]:
                if pd.notna(value):
                    platform = self.safe_str(value)
                    if platform in ['腾讯', '抖音', '小红书']:
                        normalized_count += 1
            total_platform = df[platform_col].notna().sum()
            consistency_score = (normalized_count / total_platform * 100) if total_platform > 0 else 0
            scores['consistency'] = consistency_score
        else:
            scores['consistency'] = 0

        # 总分（平均）
        scores['overall'] = sum(scores.values()) / len(scores) if scores else 0

        return scores

    def _find_column(self, df: pd.DataFrame, possible_names: List[str]) -> Optional[str]:
        """查找DataFrame中存在的列名"""
        for name in possible_names:
            if name in df.columns:
                return name
        return None
