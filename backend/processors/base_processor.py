# -*- coding: utf-8 -*-
"""
数据处理器基类 - PRD v1.1

提供通用的数据处理功能:
1. 文件读取（支持多种编码）
2. 数据验证
3. 数据质量评分
4. 数据清洗
5. 数据导入
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional
from abc import ABC, abstractmethod


class DataProcessor(ABC):
    """数据处理器基类"""

    # 支持的编码列表
    ENCODINGS = ['utf-8-sig', 'utf-8', 'gb18030', 'gb2312', 'gbk', 'latin1']

    def __init__(self, db_session):
        """
        初始化处理器

        Args:
            db_session: SQLAlchemy 数据库会话
        """
        self.db_session = db_session
        self.errors = []
        self.warnings = []

    @abstractmethod
    def get_required_columns(self) -> List[str]:
        """
        获取必需列名（子类必须实现）

        Returns:
            必需列名列表（支持中英文）
        """
        pass

    @abstractmethod
    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """
        验证单行数据（子类必须实现）

        Args:
            row: pandas Series，单行数据

        Returns:
            (是否有效, 错误信息)
        """
        pass

    @abstractmethod
    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据，转换为模型字段（子类必须实现）

        Args:
            row: pandas Series，单行数据

        Returns:
            字段字典
        """
        pass

    @abstractmethod
    def get_model_class(self):
        """获取 SQLAlchemy 模型类（子类必须实现）"""
        pass

    @abstractmethod
    def get_unique_fields(self) -> List[str]:
        """
        获取唯一性字段列表（用于判断重复）

        Returns:
            唯一性字段列表，如 ['date', 'account_id']
        """
        pass

    def get_platform_name(self) -> Optional[str]:
        """
        获取平台名称（用于自动创建账号映射）
        子类可以重写此方法

        Returns:
            平台名称，如 '腾讯'、'抖音'、'小红书'
        """
        return None

    def _auto_create_account_mapping(self, data: Dict[str, Any]) -> None:
        """
        自动创建账号映射（如果不存在）

        Args:
            data: 处理后的数据字典
        """
        from backend.models import AccountAgencyMapping

        # 获取平台名称
        platform = self.get_platform_name()
        if not platform:
            return

        # 获取account_id（不同的数据模型字段名可能不同）
        account_id = data.get('account_id')
        if not account_id:
            return

        # 检查是否已存在映射
        existing = self.db_session.query(AccountAgencyMapping).filter_by(
            platform=platform,
            account_id=str(account_id)
        ).first()

        if existing:
            return  # 已存在，无需创建

        # 创建新的账号映射记录（使用默认值）
        new_mapping = AccountAgencyMapping(
            platform=platform,
            account_id=str(account_id),
            account_name=None,       # 用户需要补充
            agency='未分配',          # 使用默认值，满足 NOT NULL 约束
            business_model='信息流'   # 使用默认值
        )
        self.db_session.add(new_mapping)

        # 记录警告信息
        self.warnings.append(
            f"发现新账号 {platform}:{account_id}，已自动创建账号映射记录。"
            f"默认设置：代理商='未分配'，业务模式='信息流'。"
            f"请在账号管理中补充完整信息"
        )

    def read_csv_safe(self, file_path: str) -> Tuple[Optional[pd.DataFrame], Optional[str]]:
        """
        安全读取 CSV 文件（自动检测编码）

        Args:
            file_path: 文件路径

        Returns:
            (DataFrame, 使用的编码)
        """
        import logging
        logger = logging.getLogger(__name__)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        # 获取文件大小
        file_size = os.path.getsize(file_path)
        logger.info(f"开始读取文件: {file_path}, 大小: {file_size / 1024 / 1024:.2f} MB")

        # 尝试不同编码
        for idx, encoding in enumerate(self.ENCODINGS, 1):
            try:
                logger.info(f"尝试编码 {idx}/{len(self.ENCODINGS)}: {encoding}")
                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    low_memory=False
                )
                row_count = len(df)
                col_count = len(df.columns)
                logger.info(f"✓ 成功读取文件！编码: {encoding}, 行数: {row_count}, 列数: {col_count}")
                return df, encoding
            except (UnicodeDecodeError, UnicodeError):
                logger.debug(f"编码 {encoding} 解码失败，尝试下一个...")
                continue
            except Exception as e:
                error_msg = f"编码 {encoding} 读取失败: {str(e)}"
                logger.error(error_msg)
                self.errors.append(error_msg)
                continue

        error_msg = f"无法读取文件，已尝试所有编码: {self.ENCODINGS}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    def read_excel_safe(self, file_path: str) -> Tuple[pd.DataFrame, str]:
        """
        安全读取 Excel 文件（简化版）

        要求：运营团队固化表头格式，不使用多级表头
        - 第一行必须是表头（数据字段名）
        - 不能有多级表头（不能有"基础信息"、"全部流量效果"等分类行）

        Args:
            file_path: 文件路径

        Returns:
            (DataFrame, 'utf-8')
        """
        import logging
        logger = logging.getLogger(__name__)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        try:
            # 直接读取（第一行必须是表头）
            df = pd.read_excel(file_path)

            # 验证：检测是否有多级表头
            first_col = str(df.columns[0]).strip() if len(df.columns) > 0 else ''
            multi_header_keywords = ['基础信息', '全部流量效果', '电商转化指标', '互动数据', '广告数据']

            if any(keyword in first_col for keyword in multi_header_keywords):
                logger.warning(f"检测到多级表头，请要求运营团队去除第一行分类名称")
                raise ValueError(
                    f"检测到多级表头（第一列：'{first_col}'）。\\n"
                    f"请要求运营团队：\\n"
                    f"1. 删除Excel第一行（分类名称行）\\n"
                    f"2. 确保第二行是唯一的表头行\\n"
                    f"3. 重新上传文件"
                )

            return df, 'utf-8'

        except Exception as e:
            raise ValueError(f"读取 Excel 文件失败: {str(e)}")

    def validate_columns(self, df: pd.DataFrame) -> bool:
        """
        验证必需列是否存在

        Args:
            df: DataFrame

        Returns:
            是否包含所有必需列
        """
        required_cols = self.get_required_columns()
        df_cols = df.columns.tolist()

        # 检查必需列（支持中英文列名）
        missing_cols = []
        for col_group in required_cols:
            # col_group 可能是字符串或列表
            if isinstance(col_group, str):
                col_options = [col_group]
            else:
                col_options = col_group

            # 检查是否至少有一个列名存在
            if not any(col in df_cols for col in col_options):
                missing_cols.append(col_options[0])

        if missing_cols:
            self.errors.append(f"缺少必需列: {', '.join(missing_cols)}")
            self.errors.append(f"文件列名: {', '.join(df_cols)}")
            return False

        return True

    def calculate_quality_score(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        计算数据质量评分（PRD v1.1）

        评分维度:
        1. 完整性（Completeness）: 非空值占比
        2. 准确性（Accuracy）: 数据格式正确性
        3. 一致性（Consistency）: 逻辑一致性
        4. 时效性（Timeliness）: 数据新鲜度

        Args:
            df: DataFrame

        Returns:
            质量评分字典
        """
        total_rows = len(df)

        # 1. 完整性评分（非空值占比）
        completeness_scores = {}
        for col in df.columns:
            non_null_count = df[col].notna().sum()
            completeness_scores[col] = (non_null_count / total_rows) * 100

        completeness = np.mean(list(completeness_scores.values()))

        # 2. 准确性评分（基于验证结果）
        # 这里简化处理，实际应基于 validate_row 的结果
        accuracy = 100.0  # 默认满分，处理行时会更新

        # 3. 一致性评分（检查数值合理性）
        consistency = 100.0
        # 示例：花费不能为负数
        if 'cost' in df.columns or '花费' in df.columns:
            cost_col = 'cost' if 'cost' in df.columns else '花费'
            if cost_col in df.columns:
                # 先转换为数值，然后再比较
                cost_series = pd.to_numeric(df[cost_col], errors='coerce').fillna(0)
                invalid_cost = (cost_series < 0).sum()
                consistency = max(0, 100 - (invalid_cost / total_rows * 100))

        # 4. 时效性评分（基于数据日期范围）
        timeliness = 100.0
        # 这里可以添加业务逻辑，例如数据不能超过30天

        # 综合评分
        overall_score = (
            completeness * 0.3 +
            accuracy * 0.3 +
            consistency * 0.2 +
            timeliness * 0.2
        )

        return {
            'overall': round(overall_score, 2),
            'completeness': round(completeness, 2),
            'accuracy': round(accuracy, 2),
            'consistency': round(consistency, 2),
            'timeliness': round(timeliness, 2),
            'details': {
                'completeness_by_column': completeness_scores
            }
        }

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        数据清洗

        Args:
            df: 原始 DataFrame

        Returns:
            清洗后的 DataFrame
        """
        # 1. 删除完全空的行
        df = df.dropna(how='all')

        # 2. 只去除列名首尾空格，不转换大小写（保持原始列名）
        df.columns = df.columns.str.strip()

        # 3. 去除字符串列首尾空格
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].str.strip()

        return df

    def after_insert_record(self, data: Dict[str, Any], record: Any) -> None:
        """
        插入记录后的钩子方法（子类可覆盖）

        在新记录插入数据库后调用，可用于：
        - 自动创建关联记录
        - 触发相关业务逻辑
        - 记录额外日志

        Args:
            data: 处理后的数据字典
            record: 已插入的数据库记录对象
        """
        pass

    def import_data(
        self,
        file_path: str,
        overwrite: bool = False,
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """
        导入数据到数据库

        Args:
            file_path: 文件路径
            overwrite: 是否覆盖模式（遇到重复时更新而非跳过）
            batch_size: 批量插入大小

        Returns:
            导入结果字典
        """
        import logging
        logger = logging.getLogger(__name__)

        start_time = datetime.now()
        logger.info(f"{'='*60}")
        logger.info(f"开始数据导入: file_path={file_path}, overwrite={overwrite}, batch_size={batch_size}")

        try:
            # 1. 读取文件
            logger.info("步骤 1/6: 读取文件...")
            if file_path.endswith('.csv'):
                df, encoding = self.read_csv_safe(file_path)
            elif file_path.endswith(('.xlsx', '.xls')):
                df, encoding = self.read_excel_safe(file_path)
            else:
                return {
                    'success': False,
                    'error': '不支持的文件格式，仅支持 .csv, .xlsx, .xls 格式'
                }

            # 检查DataFrame是否为空
            if df is None or df.empty:
                return {
                    'success': False,
                    'error': '文件为空或无法读取，请检查文件内容'
                }

            total_rows = len(df)
            logger.info(f"✓ 文件读取完成，共 {total_rows} 行数据")

            # 2. 验证列
            logger.info("步骤 2/6: 验证列...")
            if not self.validate_columns(df):
                logger.error(f"✗ 列验证失败: {self.errors}")
                return {
                    'success': False,
                    'error': f"列验证失败: {self.errors}"
                }
            logger.info("✓ 列验证通过")

            # 3. 清洗数据
            logger.info("步骤 3/6: 清洗数据...")
            df = self.clean_data(df)
            logger.info("✓ 数据清洗完成")

            # 3.5. 去除重复记录（基于唯一性字段）
            logger.info("步骤 4/6: 去重处理...")
            unique_fields = self.get_unique_fields()
            if unique_fields:
                # 获取DataFrame中对应的列名（可能有中英文映射）
                df_columns = df.columns.tolist()
                dedup_cols = []

                for field in unique_fields:
                    # 查找对应的DataFrame列名
                    for col in df_columns:
                        # 如果列名直接匹配
                        if col == field:
                            dedup_cols.append(col)
                            break
                        # 如果列名在COLUMN_MAPPING中对应
                        if hasattr(self, 'COLUMN_MAPPING') and col in self.COLUMN_MAPPING:
                            if self.COLUMN_MAPPING[col] == field:
                                dedup_cols.append(col)
                                break

                if dedup_cols and len(dedup_cols) == len(unique_fields):
                    before_dedup = len(df)
                    df = df.drop_duplicates(subset=dedup_cols, keep='last')
                    after_dedup = len(df)
                    if before_dedup > after_dedup:
                        dedup_count = before_dedup - after_dedup
                        self.warnings.append(f"去除重复记录: {dedup_count} 条")
                        logger.info(f"✓ 去除 {dedup_count} 条重复记录")
                    else:
                        logger.info("✓ 无重复记录")
                else:
                    logger.info("✓ 跳过去重（无法找到唯一性字段）")
            else:
                logger.info("✓ 跳过去重（无唯一性字段）")

            # 4. 计算质量评分
            logger.info("步骤 5/6: 计算质量评分...")
            quality_score = self.calculate_quality_score(df)
            logger.info(f"✓ 质量评分: {quality_score['overall']:.2f} 分")

            # 5. 处理数据
            logger.info(f"步骤 6/6: 导入数据库（共 {len(df)} 行，batch_size={batch_size}）...")
            inserted_count = 0
            updated_count = 0
            failed_count = 0

            ModelClass = self.get_model_class()
            unique_fields = self.get_unique_fields()

            # 优化：预先查询所有可能存在的记录（批量模式优化）
            # 收集所有唯一性字段的值
            if unique_fields and overwrite and len(df) > 100:
                logger.info("  预加载现有记录以优化性能...")
                from sqlalchemy import or_

                # 构建批量查询条件
                unique_values = set()
                for _, row in df.iterrows():
                    try:
                        data = self.process_row(row)
                        # 提取唯一性字段的值
                        unique_tuple = tuple(data.get(k) for k in unique_fields)
                        if all(v is not None for v in unique_tuple):
                            unique_values.add(unique_tuple)
                    except:
                        pass

                # 批量查询现有记录
                existing_dict = None
                if unique_values and len(unique_fields) == 2:
                    # 针对 (data_date/date, note_id) 的优化查询
                    # 兼容不同的日期字段名：data_date (content_daily) 或 date (daily)
                    # 注意：只有当模型有 note_id 字段时才执行此优化
                    data_dates = set(v[0] for v in unique_values)
                    note_ids = set(v[1] for v in unique_values)

                    # 检查模型使用的是哪个日期字段
                    date_field = None
                    if hasattr(ModelClass, 'data_date'):
                        date_field = ModelClass.data_date
                    elif hasattr(ModelClass, 'date'):
                        date_field = ModelClass.date

                    # 如果找到了日期字段且有 note_id 字段，进行优化查询
                    # （只有小红书笔记数据有 note_id 字段，抖音/腾讯广告数据没有）
                    if date_field is not None and hasattr(ModelClass, 'note_id'):
                        existing_records = self.db_session.query(ModelClass).filter(
                            date_field.in_(data_dates),
                            ModelClass.note_id.in_(note_ids)
                        ).all()

                        # 构建查找字典
                        existing_dict = {}
                        for record in existing_records:
                            key = (getattr(record, unique_fields[0]), getattr(record, unique_fields[1]))
                            existing_dict[key] = record

                        logger.info(f"  预加载 {len(existing_dict)} 条现有记录")
            else:
                existing_dict = None

            # 批量处理
            batch_count = 0
            total_batches = (len(df) + batch_size - 1) // batch_size

            for idx, row in df.iterrows():
                try:
                    # 验证行数据
                    is_valid, error_msg = self.validate_row(row)
                    if not is_valid:
                        failed_count += 1
                        if error_msg:
                            self.errors.append(f"第 {idx + 2} 行: {error_msg}")
                        continue

                    # 转换为模型字段
                    data = self.process_row(row)

                    # 检查是否存在（优先使用预加载的记录）
                    if existing_dict is not None and len(unique_fields) == 2:
                        # 使用预加载的字典查找
                        key = (data.get(unique_fields[0]), data.get(unique_fields[1]))
                        existing = existing_dict.get(key)
                    else:
                        # 常规查询
                        filters = {k: data.get(k) for k in unique_fields if k in data}
                        with self.db_session.no_autoflush:
                            existing = self.db_session.query(ModelClass).filter_by(**filters).first()

                    if existing:
                        if overwrite:
                            # 更新现有记录（不立即 flush，避免事务问题）
                            for key, value in data.items():
                                if key != 'id':  # 不更新主键
                                    setattr(existing, key, value)
                            updated_count += 1
                        else:
                            # 跳过重复记录
                            failed_count += 1
                            self.warnings.append(f"第 {idx + 2} 行: 重复记录")
                    else:
                        # 新增记录
                        new_record = ModelClass(**data)
                        self.db_session.add(new_record)
                        # 调用插入后钩子（子类可覆盖）
                        self.after_insert_record(data, new_record)
                        inserted_count += 1

                    # 批量提交
                    batch_count += 1
                    if batch_count % batch_size == 0:
                        try:
                            self.db_session.commit()
                            current_batch = batch_count // batch_size
                            logger.info(f"  进度: {current_batch}/{total_batches} 批次 ({inserted_count} 插入, {updated_count} 更新, {failed_count} 失败)")
                        except Exception as commit_error:
                            # 批量提交失败，回滚并继续
                            self.db_session.rollback()
                            logger.error(f"  批量提交失败: {commit_error}")
                            # 将本批次的所有记录标记为失败
                            failed_count += batch_size
                            self.errors.append(f"批次 {current_batch} 提交失败: {commit_error}")

                except Exception as e:
                    failed_count += 1
                    error_msg = f"第 {idx + 2} 行处理失败: {str(e)}"
                    self.errors.append(error_msg)
                    logger.error(error_msg)

            # 提交剩余数据
            try:
                if batch_count % batch_size != 0:
                    self.db_session.commit()
                    logger.info(f"  ✓ 最后批次完成 (总计: {inserted_count} 插入, {updated_count} 更新, {failed_count} 失败)")
            except Exception as final_error:
                self.db_session.rollback()
                logger.error(f"  ✗ 最终提交失败: {final_error}")
                self.errors.append(f"最终提交失败: {final_error}")

            # 计算耗时
            processing_time = (datetime.now() - start_time).total_seconds()

            # 构建成功消息
            success_msg = f"成功导入 {inserted_count} 条数据"
            if updated_count > 0:
                success_msg += f"，更新 {updated_count} 条数据"
            if failed_count > 0:
                success_msg += f"，{failed_count} 条数据失败"

            logger.info(f"{'='*60}")
            logger.info(f"✓ 导入完成！耗时: {processing_time:.2f} 秒")
            logger.info(f"  总行数: {total_rows}")
            logger.info(f"  插入: {inserted_count}")
            logger.info(f"  更新: {updated_count}")
            logger.info(f"  失败: {failed_count}")
            logger.info(f"  质量评分: {quality_score['overall']:.2f}")

            return {
                'success': True,
                'message': success_msg,
                'total_rows': total_rows,
                'processed_rows': inserted_count + updated_count,
                'inserted_rows': inserted_count,
                'updated_rows': updated_count,
                'failed_rows': failed_count,
                'quality_score': quality_score['overall'],
                'encoding': encoding,
                'processing_time': processing_time,
                'errors': self.errors[:10],  # 只返回前10个错误
                'warnings': self.warnings[:10]
            }

        except ValueError as e:
            self.db_session.rollback()
            error_msg = str(e)
            logger.error(f"✗ ValueError: {error_msg}")
            # 提供更友好的错误信息
            if '无法读取文件' in error_msg or '读取 Excel 文件失败' in error_msg:
                error_msg = f'文件格式错误或文件已损坏。请确保文件是有效的 {file_path.split(".")[-1].upper()} 文件。'

            return {
                'success': False,
                'error': error_msg,
                'errors': self.errors
            }
        except Exception as e:
            self.db_session.rollback()
            import traceback
            error_msg = f"处理失败: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"✗ Exception: {error_msg}")

            # 检查是否是唯一性约束错误（重复数据）
            error_msg_full = str(e)
            if 'UNIQUE constraint failed' in error_msg_full or 'IntegrityError' in str(type(e).__name__):
                # 解析表名和字段
                import re
                match = re.search(r'UNIQUE constraint failed: (\w+)\.([^ ]+)', error_msg_full)
                if match:
                    table_name = match.group(1)
                    fields = match.group(2).replace('_', '.')
                    error_msg = f'数据重复：数据库中已存在相同的 {fields} 记录。\n\n建议解决方案：\n1. 使用"覆盖模式"重新导入（更新现有数据）\n2. 或先删除旧数据再导入'
                else:
                    error_msg = '数据重复：数据库中已存在相同记录。\n\n建议：使用"覆盖模式"重新导入'

            # 记录完整的异常堆栈用于调试
            logger.debug(f"异常堆栈: {traceback.format_exc()}")

            return {
                'success': False,
                'error': error_msg,
                'errors': self.errors
            }

    @staticmethod
    def safe_float(value) -> Optional[float]:
        """安全转换为浮点数"""
        if pd.isna(value):
            return 0.0
        try:
            # 先尝试直接转换
            return float(value)
        except (ValueError, TypeError):
            # 如果是字符串，尝试移除逗号等格式符号
            if isinstance(value, str):
                value = value.replace(',', '').replace('，', '').strip()
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0
            return 0.0

    @staticmethod
    def safe_int(value) -> Optional[int]:
        """安全转换为整数"""
        if pd.isna(value):
            return 0
        try:
            # 先尝试直接转换
            return int(value)
        except (ValueError, TypeError):
            # 如果是字符串或浮点数，尝试转换
            if isinstance(value, str):
                value = value.replace(',', '').replace('，', '').strip()
                try:
                    return int(float(value))
                except (ValueError, TypeError):
                    return 0
            elif isinstance(value, float):
                return int(value)
            return 0

    @staticmethod
    def safe_str(value) -> Optional[str]:
        """安全转换为字符串"""
        if pd.isna(value):
            return None
        # 如果已经是字符串，直接返回（去除空格）
        if isinstance(value, str):
            return value.strip()
        # 其他类型转换为字符串
        return str(value).strip()

    @staticmethod
    def safe_date(value) -> Optional[datetime]:
        """
        安全转换为日期

        返回 datetime.date 对象（不含时间），以便正确匹配数据库的 date 字段
        """
        from datetime import date

        if pd.isna(value):
            return None

        # 如果已经是 date 对象（不是 datetime），直接返回
        if isinstance(value, date) and not isinstance(value, datetime):
            return value

        # 如果是 datetime 对象，转换为 date 对象（去除时间部分）
        if isinstance(value, datetime):
            return value.date()

        # 如果是整数（小红书周期格式: YYYYMMDD）
        if isinstance(value, int):
            try:
                # 20260106 -> 2026-01-06
                date_str = str(value)
                if len(date_str) == 8 and date_str.isdigit():
                    year = int(date_str[0:4])
                    month = int(date_str[4:6])
                    day = int(date_str[6:8])
                    return datetime(year, month, day).date()
            except:
                pass

        # 尝试解析字符串
        try:
            # 使用 pd.to_datetime 解析，然后转换为 date 对象
            dt = pd.to_datetime(value)
            # 处理 Timestamp 对象
            if hasattr(dt, 'date'):
                return dt.date()
            else:
                # 处理 datetime 对象
                return dt.to_pydatetime().date()
        except:
            return None

    @staticmethod
    def safe_bool(value) -> bool:
        """安全转换为布尔值"""
        if pd.isna(value):
            return False

        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            return value.lower() in ['true', '1', 'yes', '是', 'y']

        return bool(value)
