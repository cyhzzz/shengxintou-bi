# -*- coding: utf-8 -*-
"""
小红书内容笔记日级数据处理器 - 高性能版

优化策略：
1. 预处理：只加载现有数据的 (data_date, note_id) 唯一键到内存
2. 增量过滤：快速过滤掉已存在的记录
3. 批量插入：只插入新增的记录

性能提升：
- 旧方案：82,000 次数据库查询（每条记录查询一次是否存在）
- 新方案：1 次数据库查询 + 内存去重（O(1)查询）
"""
from backend.processors.base_processor import DataProcessor
from backend.models import XhsNotesContentDaily, XhsNoteInfo
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class XhsNotesContentDailyProcessorFast(DataProcessor):
    """小红书内容笔记日级数据处理器 - 高性能版"""

    # 列名映射（与原版相同）
    COLUMN_MAPPING = {
        # 核心ID
        '数据日期': 'data_date',
        '笔记id': 'note_id',

        # 笔记基础信息
        '笔记名称': 'note_title',
        '笔记链接': 'note_url',
        '笔记发布时间': 'note_publish_time',
        '笔记来源': 'note_source',
        '笔记类型': 'note_type',

        # 创作者信息
        '笔记创作者名称': 'creator_name',
        '笔记创作者ID': 'creator_id',
        '作者粉丝量': 'creator_followers',

        # 运营指标
        '全部曝光量': 'total_impressions',
        '全部阅读量': 'total_reads',
        '全部互动量': 'total_interactions',
    }

    def __init__(self, db_session):
        super().__init__(db_session)

        # 实例变量：每次导入时重新初始化缓存
        self._existing_records_cache = set()
        self._cache_initialized = False

        self.stats = {
            'total_rows': 0,
            'existing_rows': 0,
            'new_rows': 0,
            'inserted_rows': 0,
            'updated_rows': 0,
            'failed_rows': 0
        }

    def import_data(self, filepath: str, overwrite: bool = False, batch_size: int = 1000,
                    progress_callback=None) -> Dict[str, Any]:
        """
        导入数据（高性能版）

        Args:
            filepath: 文件路径
            overwrite: 是否覆盖模式（暂不支持，始终为增量模式）
            batch_size: 批次大小
            progress_callback: 进度回调函数

        Returns:
            导入结果字典
        """
        try:
            # 步骤 1: 读取文件
            if progress_callback:
                progress_callback(5, '正在读取文件...')

            # 使用基类的文件读取方法
            if filepath.endswith('.csv'):
                df, self.detected_encoding = self.read_csv_safe(filepath)
            elif filepath.endswith(('.xlsx', '.xls')):
                df, self.detected_encoding = self.read_excel_safe(filepath)
            else:
                return {
                    'success': False,
                    'error': '不支持的文件格式',
                    'message': '不支持的文件格式，仅支持 .csv, .xlsx, .xls'
                }

            if df is None or df.empty:
                return {
                    'success': False,
                    'error': '文件为空或读取失败',
                    'message': '文件为空或读取失败'
                }

            self.stats['total_rows'] = len(df)

            # 步骤 2: 初始化缓存（只执行一次）
            if progress_callback:
                progress_callback(10, '正在加载现有数据索引...')

            self._initialize_existing_cache()

            logger.info(f"现有记录索引加载完成，共 {len(self._existing_records_cache):,} 条")

            # 步骤 3: 预处理 - 过滤增量数据
            if progress_callback:
                progress_callback(20, '正在分析增量数据...')

            df_new = self._filter_incremental_data(df)

            self.stats['existing_rows'] = self.stats['total_rows'] - len(df_new)
            self.stats['new_rows'] = len(df_new)

            logger.info(f"增量数据识别完成:")
            logger.info(f"  总行数: {self.stats['total_rows']:,}")
            logger.info(f"  已存在: {self.stats['existing_rows']:,} (跳过)")
            logger.info(f"  新增: {self.stats['new_rows']:,} (需要导入)")

            if len(df_new) == 0:
                return {
                    'success': True,
                    'message': '没有需要导入的新数据',
                    'total_rows': self.stats['total_rows'],
                    'processed_rows': self.stats['total_rows'],
                    'inserted_rows': 0,
                    'updated_rows': 0,
                    'failed_rows': 0,
                    'existing_rows': self.stats['existing_rows'],
                    'new_rows': 0
                }

            # 步骤 4: 批量导入增量数据
            if progress_callback:
                progress_callback(30, f'正在导入 {len(df_new):,} 条新数据...')

            inserted, updated, failed = self._batch_import(df_new, batch_size, progress_callback)

            self.stats['inserted_rows'] = inserted
            self.stats['updated_rows'] = updated
            self.stats['failed_rows'] = failed

            # 步骤 5: 完成
            if progress_callback:
                progress_callback(100, '导入完成！')

            return {
                'success': True,
                'message': f'成功导入 {inserted:,} 条新数据',
                'total_rows': self.stats['total_rows'],
                'processed_rows': self.stats['total_rows'],
                'inserted_rows': inserted,
                'updated_rows': updated,
                'failed_rows': failed,
                'existing_rows': self.stats['existing_rows'],
                'new_rows': self.stats['new_rows'],
                'encoding': self.detected_encoding
            }

        except Exception as e:
            logger.error(f"导入失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'message': f'导入失败: {str(e)}'
            }

    def _initialize_existing_cache(self):
        """
        初始化现有数据索引（每次导入时重新加载）

        只加载 (data_date, note_id) 唯一键到内存集合，用于快速去重

        注意：每次导入时重新加载，确保获取最新的数据库状态
        """
        logger.info("正在加载现有数据索引...")

        # 批量加载所有唯一键
        existing_records = self.db_session.query(
            XhsNotesContentDaily.data_date,
            XhsNotesContentDaily.note_id
        ).all()

        # 转换为字符串格式的唯一键（与_filter_incremental_data中的格式一致）
        self._existing_records_cache = set(
            f'{rec[0].strftime("%Y-%m-%d") if isinstance(rec[0], datetime) else str(rec[0])}|{rec[1]}'
            for rec in existing_records
        )

        self._cache_initialized = True
        logger.info(f"索引加载完成：{len(self._existing_records_cache):,} 条记录")

    def _filter_incremental_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        过滤增量数据（只返回不存在的记录）

        使用内存集合快速过滤，避免逐条查询数据库

        Args:
            df: 原始数据框

        Returns:
            只包含新数据的 DataFrame
        """
        # 构造唯一键列
        # 注意：需要将 Excel 中的 YYYYMMDD 格式转换为 YYYY-MM-DD 格式
        # 以匹配数据库中的格式（第197行：strftime('%Y-%m-%d')）
        df['_temp_date'] = pd.to_datetime(df['数据日期'].astype(str), format='%Y%m%d', errors='coerce')
        df['_unique_key'] = df['_temp_date'].dt.strftime('%Y-%m-%d') + '|' + df['笔记id'].astype(str)

        # 找出不存在的记录
        df_new = df[~df['_unique_key'].isin(self._existing_records_cache)]

        # 删除临时列
        df_new = df_new.drop(['_unique_key', '_temp_date'], axis=1)

        return df_new

    def _batch_import(self, df: pd.DataFrame, batch_size: int, progress_callback=None) -> Tuple[int, int, int]:
        """
        批量导入数据（UPSERT模式：先删除旧记录，再插入）

        对于已存在的记录（相同 data_date + note_id），先删除再插入
        对于不存在的记录，直接插入

        Args:
            df: 要导入的数据框
            batch_size: 批次大小
            progress_callback: 进度回调

        Returns:
            (插入数量, 更新数量, 失败数量)
        """
        total_rows = len(df)
        inserted = 0
        updated = 0
        failed = 0

        # 分批处理
        for i in range(0, total_rows, batch_size):
            batch_end = min(i + batch_size, total_rows)
            df_batch = df.iloc[i:batch_end]

            batch_inserted = 0
            batch_updated = 0
            batch_failed = 0

            # 准备本批次的数据
            records_to_insert = []
            unique_keys = []

            for _, row in df_batch.iterrows():
                try:
                    # 验证数据
                    is_valid, error_msg = self.validate_row(row)
                    if not is_valid:
                        batch_failed += 1
                        continue

                    # 处理数据
                    data = self.process_row(row)

                    # 额外验证：检查解析后的必需字段
                    if data['data_date'] is None:
                        logger.warning(f"日期解析失败，跳过该行: note_id={data['note_id']}, 原始值={row.get('数据日期', 'N/A')}")
                        batch_failed += 1
                        continue

                    if not data['note_id']:
                        logger.warning(f"笔记ID为空，跳过该行")
                        batch_failed += 1
                        continue

                    records_to_insert.append(data)
                    unique_keys.append((data['data_date'], data['note_id']))

                except Exception as e:
                    logger.warning(f"处理行失败: {str(e)}")
                    batch_failed += 1

            # 第一步：删除已存在的记录（实现UPDATE效果）
            try:
                if unique_keys:
                    # 批量删除已存在的记录
                    # 使用更简单的SQL：逐个删除（SQLite限制）
                    deleted_count = 0
                    for data_date, note_id in unique_keys:
                        deleted = self.db_session.query(XhsNotesContentDaily).filter(
                            XhsNotesContentDaily.data_date == data_date,
                            XhsNotesContentDaily.note_id == note_id
                        ).delete(synchronize_session=False)
                        deleted_count += 1

                    batch_updated = deleted_count  # 记录"更新"的数量

                # 第二步：批量插入所有记录
                for data in records_to_insert:
                    record = XhsNotesContentDaily(**data)
                    self.db_session.add(record)
                    batch_inserted += 1

                # 提交批次
                self.db_session.commit()
                inserted += batch_inserted
                updated += batch_updated
                failed += batch_failed

                # 更新进度
                if progress_callback:
                    progress = 30 + int(70 * (batch_end / total_rows))
                    progress_callback(progress, f'进度: {batch_end}/{total_rows} ({inserted} 插入, {updated} 更新, {failed} 失败)')

                logger.info(f"批次提交成功: {batch_end}/{total_rows} ({batch_inserted} 插入, {batch_updated} 更新, {batch_failed} 失败)")

            except Exception as e:
                self.db_session.rollback()
                logger.error(f"批次提交失败: {str(e)}")
                failed += batch_size

        return inserted, updated, failed

    def get_required_columns(self) -> List[List[str]]:
        """获取必需列"""
        return [
            ['数据日期', 'data_date'],
            ['笔记id', 'note_id']
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证数据日期
        data_date_value = self._get_column_value(row, ['数据日期', 'data_date'])
        if not data_date_value:
            return False, "数据日期为空"

        # 验证笔记ID
        note_id = self._get_column_value(row, ['笔记id', 'note_id'])
        if not note_id:
            return False, "笔记ID为空"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """处理单行数据"""
        return {
            # 核心ID
            'data_date': self._safe_parse_date(self._get_column_value(row, ['数据日期', 'data_date'])),
            'note_id': self.safe_str(self._get_column_value(row, ['笔记id', 'note_id'])),

            # 笔记基础信息
            'note_title': self.safe_str(self._get_column_value(row, ['笔记名称', 'note_title'])),
            'note_url': self.safe_str(self._get_column_value(row, ['笔记链接', 'note_url'])),
            'note_publish_time': self._safe_parse_datetime(self._get_column_value(row, ['笔记发布时间', 'note_publish_time'])),
            'note_source': self.safe_str(self._get_column_value(row, ['笔记来源', 'note_source'])),
            'note_type': self.safe_str(self._get_column_value(row, ['笔记类型', 'note_type'])),

            # 创作者信息
            'creator_name': self.safe_str(self._get_column_value(row, ['笔记创作者名称', 'creator_name'])),
            'creator_id': self.safe_str(self._get_column_value(row, ['笔记创作者ID', 'creator_id'])),
            'creator_followers': self._safe_parse_int_comma(self._get_column_value(row, ['作者粉丝量', 'creator_followers'])),

            # 运营指标
            'total_impressions': self._safe_parse_int_comma(self._get_column_value(row, ['全部曝光量', 'total_impressions'])),
            'total_reads': self._safe_parse_int_comma(self._get_column_value(row, ['全部阅读量', 'total_reads'])),
            'total_interactions': self._safe_parse_int_comma(self._get_column_value(row, ['全部互动量', 'total_interactions'])),
        }

    def get_model_class(self):
        """获取模型类"""
        return XhsNotesContentDaily

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['data_date', 'note_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None

    @staticmethod
    def safe_str(value) -> Optional[str]:
        """安全转换为字符串"""
        if pd.isna(value):
            return None
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    @staticmethod
    def _safe_parse_date(value) -> Optional[datetime]:
        """安全解析日期（YYYYMMDD格式）"""
        if pd.isna(value) or not value:
            return None
        try:
            value_str = str(value).strip()
            if len(value_str) == 8 and value_str.isdigit():  # YYYYMMDD
                return datetime.strptime(value_str, '%Y%m%d')
            else:  # YYYY-MM-DD
                return pd.to_datetime(value_str).to_pydatetime()
        except:
            return None

    @staticmethod
    def _safe_parse_datetime(value) -> Optional[datetime]:
        """安全解析日期时间"""
        if pd.isna(value) or not value:
            return None
        try:
            return pd.to_datetime(value).to_pydatetime()
        except:
            return None

    @staticmethod
    def _safe_parse_int_comma(value) -> Optional[int]:
        """安全解析整数（支持千分位）"""
        if pd.isna(value) or not value:
            return 0
        try:
            if isinstance(value, (int, float)):
                return int(value)
            value_str = str(value).strip().replace(',', '')
            return int(value_str) if value_str else 0
        except:
            return 0
