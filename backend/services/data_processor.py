# -*- coding: utf-8 -*-
"""
省心投 BI - 数据处理服务
负责解析和处理CSV/Excel文件
"""

import pandas as pd
import os
from datetime import datetime
from decimal import Decimal

class DataProcessor:
    """数据处理器"""

    def __init__(self):
        self.supported_encodings = ['utf-8', 'gb2312', 'gbk', 'gb18030', 'latin1']

    def detect_encoding(self, filepath):
        """检测文件编码"""
        for encoding in self.supported_encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    f.read(1024)  # 读取一小块测试
                return encoding
            except:
                continue
        return 'utf-8'  # 默认

    def read_csv_safe(self, filepath, encoding=None):
        """安全读取CSV文件"""
        if encoding is None:
            encoding = self.detect_encoding(filepath)

        try:
            # 尝试读取，忽略错误行
            df = pd.read_csv(filepath, encoding=encoding, on_bad_lines='skip', engine='python')
            return df, encoding
        except Exception as e:
            # 如果指定编码失败，尝试其他编码
            if encoding != 'latin1':
                for alt_encoding in ['latin1', 'gb18030', 'utf-8']:
                    try:
                        df = pd.read_csv(filepath, encoding=alt_encoding, on_bad_lines='skip', engine='python')
                        print(f"  使用 {alt_encoding} 编码成功读取")
                        return df, alt_encoding
                    except:
                        continue
            raise Exception(f"读取CSV失败: {str(e)}")

    def read_excel_safe(self, filepath):
        """安全读取Excel文件（支持.xlsx和.xls）"""
        try:
            # 尝试读取Excel文件
            df = pd.read_excel(filepath, engine='openpyxl')
            print(f"  使用openpyxl引擎成功读取Excel")
            return df
        except Exception as e:
            # 如果openpyxl失败，尝试xlrd
            try:
                df = pd.read_excel(filepath, engine='xlrd')
                print(f"  使用xlrd引擎成功读取Excel")
                return df
            except Exception as e2:
                raise Exception(f"读取Excel失败: {str(e)}, {str(e2)}")

    def parse_number(self, value):
        """解析数字（处理逗号）"""
        if pd.isna(value):
            return 0
        if isinstance(value, (int, float, Decimal)):
            return float(value)
        if isinstance(value, str):
            value = value.replace(',', '').replace('"', '').strip()
            try:
                return float(value) if '.' in value else int(value)
            except:
                return 0
        return 0

    def normalize_date(self, date_str):
        """标准化日期格式为YYYY-MM-DD"""
        if pd.isna(date_str):
            return None
        date_str = str(date_str).strip()

        # 处理YYYYMMDD格式
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

        # 处理YYYY/MM/DD或YYYY-MM-DD格式
        if '-' in date_str or '/' in date_str:
            date_str = date_str.replace('/', '-')
            return date_str.split()[0]  # 去除时间部分

        return date_str

    def process_tencent_data(self, df, mapping_df):
        """处理腾讯广告数据"""
        print(f"处理腾讯数据: {len(df)} 行")

        mapping_dict = mapping_df[mapping_df['platform'] == '腾讯'].set_index('account_id')['agency'].to_dict()

        result = []
        for _, row in df.iterrows():
            account_id = str(row['账户ID']).strip()
            agency = mapping_dict.get(account_id, '申万宏源直投')

            record = {
                'date': self.normalize_date(row['日期']),
                'platform': '腾讯',
                'account_id': account_id,
                'account_name': '',
                'agency': agency,
                'business_model': self.get_business_model('腾讯', account_id, agency),
                'metrics': {
                    'cost': self.parse_number(row.get('花费', 0)),
                    'impressions': self.parse_number(row.get('曝光次数', 0)),
                    'clicks': self.parse_number(row.get('点击次数', 0)),
                    'leads': 0,
                    'new_accounts': 0
                }
            }
            result.append(record)

        return result

    def process_douyin_data(self, df, mapping_df):
        """处理抖音广告数据"""
        print(f"处理抖音数据: {len(df)} 行")

        mapping_dict = mapping_df[mapping_df['platform'] == '抖音'].set_index('account_id')['agency'].to_dict()

        result = []
        for _, row in df.iterrows():
            account_id = str(row['账户ID']).strip()
            account_name = str(row.get('账户名称', '')) if pd.notna(row.get('账户名称')) else ''
            agency = mapping_dict.get(account_id, '未知')

            record = {
                'date': self.normalize_date(row['时间-天']),
                'platform': '抖音',
                'account_id': account_id,
                'account_name': account_name,
                'agency': agency,
                'business_model': self.get_business_model('抖音', account_id, agency),
                'metrics': {
                    'cost': self.parse_number(row.get('消耗', 0)),
                    'impressions': self.parse_number(row.get('展示数', 0)),
                    'clicks': self.parse_number(row.get('点击数', 0)),
                    'leads': 0,
                    'new_accounts': 0
                }
            }
            result.append(record)

        return result

    def process_xiaohongshu_data(self, df, mapping_df):
        """处理小红书广告数据"""
        print(f"处理小红书数据: {len(df)} 行")

        # 所属代理商全名到简称的映射
        agency_full_name_mapping = {
            '上海创迹无尽计算机科技有限公司': '绩牛',
            '上海破圈广告有限公司': '美洋',  # 修正：不是众联
            '北京量子聚合文化傳播有限公司': '量子',
            '北京量子聚合文化传播有限公司': '量子',
            '浙江红薯派文化传媒有限公司': '未知',  # 修正：不是风声
        }

        result = []
        for _, row in df.iterrows():
            sub_account_id = str(row.get('代理商子账户ID', '')).strip() if pd.notna(row.get('代理商子账户ID')) else ''
            account_name = str(row.get('账户名称', '')) if pd.notna(row.get('账户名称')) else ''

            # 优先使用所属代理商字段映射
            agency = None

            # 如果没有代理商子账号ID，说明是申万宏源直投
            if not sub_account_id or sub_account_id == '' or sub_account_id == 'nan':
                agency = '申万宏源直投'
            # 如果有代理商子账号，使用所属代理商字段映射
            elif pd.notna(row.get('所属代理商')) and str(row.get('所属代理商')).strip():
                raw_agency = str(row.get('所属代理商')).strip()
                agency = agency_full_name_mapping.get(raw_agency, None)

            # 如果所属代理商字段为空或映射失败，使用映射表
            if agency is None:
                mapping_dict = mapping_df[mapping_df['platform'] == '小红书'].set_index('account_id')['agency'].to_dict()
                agency_from_mapping = mapping_dict.get(sub_account_id, None)

                # 映射表中的非标准值需要转换
                if agency_from_mapping == '申万':
                    # '申万'需要通过所属代理商或默认值处理
                    agency = None
                elif agency_from_mapping and agency_from_mapping != '无':
                    agency = agency_from_mapping

            # 如果还是没有找到，使用默认值
            if agency is None or agency == '无':
                agency = '申万宏源直投'

            record = {
                'date': self.normalize_date(row['周期']),
                'platform': '小红书',
                'account_id': sub_account_id,
                'account_name': account_name,
                'agency': agency,
                'business_model': self.get_business_model('小红书', sub_account_id, agency),
                'metrics': {
                    'cost': self.parse_number(row.get('总消耗', 0)),
                    'impressions': self.parse_number(row.get('总展现', 0)),
                    'clicks': self.parse_number(row.get('总点击', 0)),
                    'leads': 0,
                    'new_accounts': 0
                }
            }
            result.append(record)

        return result

    def get_business_model(self, platform, account_id, agency):
        """根据平台、账号ID和代理商确定业务模式"""
        special_accounts = {
            ('腾讯', '66250750'): '直播',
            ('腾讯', '70295208'): '直播',
            ('抖音', '1839699079285836'): '直播',
            ('抖音', '1846861381145228'): '直播',
        }

        key = (platform, account_id)
        if key in special_accounts:
            return special_accounts[key]

        if agency in ['优品', '信则']:
            return '直播'
        else:
            return '信息流'

    def process_backend_conversion(self, df, mapping_df):
        """处理后端转化数据"""
        print(f"处理后端转化数据...")

        conversion_stats = {}
        processed_count = 0
        matched_count = 0

        # 构建完整的映射表
        # 腾讯：account_id -> agency
        tencent_id_mapping = {}
        if mapping_df is not None and len(mapping_df) > 0:
            tencent_mapping = mapping_df[mapping_df['platform'] == '腾讯']
            if len(tencent_mapping) > 0:
                tencent_id_mapping = tencent_mapping.set_index('account_id')['agency'].to_dict()

        # 小红书：account_name -> agency
        xiaohongshu_name_mapping = {}
        if mapping_df is not None and len(mapping_df) > 0:
            xhs_mapping = mapping_df[mapping_df['platform'] == '小红书'].drop_duplicates()
            if len(xhs_mapping) > 0 and 'account_name' in xhs_mapping.columns:
                xiaohongshu_name_mapping = xhs_mapping.set_index('account_name')['agency'].to_dict()

        # 添加缺失的小红书账号映射
        xiaohongshu_extra_mappings = {
            '申万宏源证券财富管理': '申万宏源直投',
            '申万宏源财富管理': '申万宏源直投',
            '申万-量子-自产': '量子',
            '申万宏源证券-lz-1': '量子',
            '申万宏源证券-lz-2-视频': '量子',
        }
        xiaohongshu_name_mapping.update(xiaohongshu_extra_mappings)

        # 抖音：account_id -> agency 和 account_name -> agency
        douyin_id_mapping = {}
        douyin_name_mapping = {}
        if mapping_df is not None and len(mapping_df) > 0:
            douyin_mapping = mapping_df[mapping_df['platform'] == '抖音']
            if len(douyin_mapping) > 0:
                douyin_id_mapping = douyin_mapping.set_index('account_id')['agency'].to_dict()
                douyin_name_mapping = douyin_mapping.drop_duplicates().set_index('account_name')['agency'].to_dict()

        for _, row in df.iterrows():
            # 使用列索引访问数据（避免列名编码问题）
            # 索引4: 平台来源
            # 索引11: 是否开户
            # 索引16: 线索日期
            # 索引29: 广告账号
            # 索引30: 广告代理商

            # 获取日期（索引16: 线索日期）
            if len(row) <= 16:
                continue
            date_val = row.iloc[16]
            if pd.isna(date_val):
                continue

            date = self.normalize_date(date_val)
            if not date or not date.startswith('2025'):
                continue

            # 获取平台（索引4: 平台来源）
            if len(row) <= 4:
                continue
            platform_raw = row.iloc[4]
            if pd.isna(platform_raw):
                continue

            platform = str(platform_raw).strip()

            # 标准化平台名称（处理编码问题）
            try:
                # 尝试将latin1的乱码转换回正确的中文
                platform_clean = platform.encode('latin1').decode('gbk').encode('utf-8').decode('utf-8')
            except:
                platform_clean = platform

            # 移除"广告"后缀，统一平台名称
            platform_clean = platform_clean.replace('广告', '').strip()

            # 最终平台名称标准化
            if '腾讯' in platform_clean:
                platform = '腾讯'
            elif '抖音' in platform_clean or 'douyin' in platform_clean.lower():
                platform = '抖音'
            elif '小红书' in platform_clean:
                platform = '小红书'
            elif platform_clean.lower() == 'yj' or platform_clean.lower() == '易车':
                # YJ平台数据不统计，跳过
                continue
            else:
                platform = platform_clean  # 使用原始清理后的名称

            # 获取广告账号（索引29: 广告账号）
            ad_account = None
            if len(row) > 29:
                val = row.iloc[29]
                if pd.notna(val) and str(val).strip():
                    # 需要应用编码转换，因为数据可能是用latin1读取的
                    try:
                        ad_account = str(val).strip().encode('latin1').decode('gbk').encode('utf-8').decode('utf-8')
                    except:
                        try:
                            ad_account = str(val).strip()
                        except:
                            ad_account = None

            # 获取代理商
            agency = '未知'

            # 先尝试通过广告账号匹配
            if platform == '腾讯' and ad_account:
                if ad_account in tencent_id_mapping:
                    agency = tencent_id_mapping[ad_account]
                    matched_count += 1

            elif platform == '小红书' and ad_account:
                if ad_account in xiaohongshu_name_mapping:
                    agency = xiaohongshu_name_mapping[ad_account]
                    matched_count += 1

            elif platform == '抖音' and ad_account:
                if ad_account in douyin_id_mapping:
                    agency = douyin_id_mapping[ad_account]
                    matched_count += 1
                elif ad_account in douyin_name_mapping:
                    agency = douyin_name_mapping[ad_account]
                    matched_count += 1

            # 从广告账号字段中提取代理商信息（新数据格式：申万-量子-广告素材、申万宏源证券财富管理-创迹等）
            if agency == '未知' and ad_account:
                # 从广告账号中提取代理商简称
                ad_agency_from_account = None

                # 模式1: 申万-量子-广告素材 → 量子
                if '申万-' in ad_account and '-' in ad_account:
                    parts = ad_account.split('-')
                    if len(parts) >= 2:
                        # 取"申万"和"广告素材"之间的部分
                        for i in range(1, len(parts) - 1):
                            part = parts[i].strip()
                            # 排除常见的前缀和后缀
                            if part and part not in ['申万', '广告素材', '主号', '后缀', '素材']:
                                ad_agency_from_account = part
                                break

                # 模式2: 申万宏源证券财富管理-创迹 → 创迹
                elif '-' in ad_account:
                    parts = ad_account.split('-')
                    if len(parts) >= 2:
                        # 取最后一个"-"之后的部分
                        last_part = parts[-1].strip()
                        # 排除已知的非代理商后缀
                        if last_part and last_part not in ['广告素材', '主号', '后缀', '素材', '广告']:
                            ad_agency_from_account = last_part

                # 将提取的简称映射到完整代理商名称
                if ad_agency_from_account:
                    ad_agency_mapping = {
                        '量子': '量子',
                        '量子聚合': '量子',
                        '创迹': '绩牛',
                        '绩牛': '绩牛',
                        '破圈': '众联',
                        '众联': '众联',
                        '风声': '风声',
                        '红薯派': '风声',
                        '信则': '信则',
                        '优品': '优品',
                        '美洋': '美洋',
                    }
                    if ad_agency_from_account in ad_agency_mapping:
                        agency = ad_agency_mapping[ad_agency_from_account]
                        matched_count += 1
                    elif ad_agency_from_account == '直投':
                        agency = '申万宏源直投'
                        matched_count += 1
                    else:
                        # 使用提取的名称作为代理商
                        agency = ad_agency_from_account

            # 再检查转化表中的代理商列（索引30: 广告代理商）
            if agency == '未知' and len(row) > 30:
                val = row.iloc[30]
                if pd.notna(val) and str(val).strip():
                    # 需要应用编码转换
                    try:
                        agency_from_table = str(val).strip().encode('latin1').decode('gbk').encode('utf-8').decode('utf-8')
                    except:
                        try:
                            agency_from_table = str(val).strip()
                        except:
                            agency_from_table = None

                    if agency_from_table:
                        # 标准化代理商名称
                        agency_full_name_mapping = {
                            '上海创迹无尽计算机科技有限公司': '绩牛',
                            '上海破圈广告有限公司': '众联',
                            '北京量子聚合文化传播有限公司': '量子',
                            '浙江红薯派文化传媒有限公司': '风声',
                            '厦门众联世纪': '众联',
                            '北京量子聚合': '量子',
                            '申万宏源证券': '申万宏源直投',
                        }
                        if agency_from_table in agency_full_name_mapping:
                            agency = agency_full_name_mapping[agency_from_table]
                            matched_count += 1
                        elif agency == '未知':
                            agency = agency_from_table

            # 处理厂商拼音简称映射（支持抖音新数据格式）
            # 检查广告代理商字段中是否包含拼音简称
            if len(row) > 30:
                ad_agency_val = row.iloc[30]
                if pd.notna(ad_agency_val):
                    ad_agency_str = str(ad_agency_val).strip().lower()
                    # 拼音简称映射
                    pinyin_mapping = {
                        'lz': '量子',
                        'quantum': '量子',
                        'jl': '绩牛',
                        'fs': '风声',
                        'zl': '众联',
                        'youpin': '优品',
                        'yp': '优品',
                        'xinze': '信则',
                        'xz': '信则',
                        'my': '美洋',
                    }
                    if ad_agency_str in pinyin_mapping:
                        agency = pinyin_mapping[ad_agency_str]
                        matched_count += 1

            # 确定业务模式
            business_model = self.get_business_model(platform, ad_account or '', agency)

            key = f"{date}_{platform}_{business_model}_{agency}"

            if key not in conversion_stats:
                conversion_stats[key] = {
                    'leads': 0,
                    'new_accounts': 0
                }

            # 统计线索（每行一个线索）
            conversion_stats[key]['leads'] += 1

            # 统计开户（索引11: 是否开户）
            if len(row) > 11:
                is_opened = row.iloc[11]
                if pd.notna(is_opened):
                    try:
                        if int(is_opened) == 1:
                            conversion_stats[key]['new_accounts'] += 1
                    except:
                        pass

            processed_count += 1

        print(f"处理后端转化数据完成: {processed_count} 条")
        print(f"成功匹配代理商: {matched_count} 条")
        print(f"统计结果: {len(conversion_stats)} 个日期-平台-代理商组合")

        return conversion_stats

    def aggregate_daily_data(self, frontend_data, conversion_stats):
        """聚合日级数据"""
        daily_aggregated = {}

        # 先处理后端转化数据
        for key, stats in conversion_stats.items():
            parts = key.split('_')
            date = parts[0]
            platform = parts[1]
            business_model = parts[2]
            agency = '_'.join(parts[3:])

            daily_aggregated[key] = {
                'date': date,
                'platform': platform,
                'business_model': business_model,
                'agency': agency,
                'metrics': {
                    'cost': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'leads': stats['leads'],
                    'new_accounts': stats['new_accounts']
                }
            }

        # 再添加前端广告数据
        for record in frontend_data:
            date = record['date']
            platform = record['platform']
            business_model = record['business_model']
            agency = record['agency']
            key = f"{date}_{platform}_{business_model}_{agency}"

            if key not in daily_aggregated:
                daily_aggregated[key] = {
                    'date': date,
                    'platform': platform,
                    'business_model': business_model,
                    'agency': agency,
                    'metrics': {
                        'cost': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'leads': 0,
                        'new_accounts': 0
                    }
                }

            for metric_name in ['cost', 'impressions', 'clicks']:
                value = record['metrics'].get(metric_name, 0)
                daily_aggregated[key]['metrics'][metric_name] += value

        return list(daily_aggregated.values())

    def process_xhs_notes_daily(self, df):
        """
        处理小红书笔记日级数据（v3.0 精简版）

        CSV列包括：
        - 数据日期、笔记id、笔记链接
        - 笔记来源、笔记类型
        - 笔记创作者名称、笔记创作者ID、作者粉丝量
        - 全部曝光量、全部阅读量、全部互动量

        注意：已删除 custom_tags, note_status, product_binding_status 字段
        """
        print(f"处理小红书笔记日级数据: {len(df)} 行")

        result = []
        for _, row in df.iterrows():
            date_val = row.get('数据日期')
            if pd.isna(date_val):
                continue

            date = self.normalize_date(date_val)
            if not date:
                continue

            # 接受2024和2025年的数据
            if not (date.startswith('2024') or date.startswith('2025')):
                continue

            note_id = str(row.get('笔记id', '')).strip()
            if not note_id or note_id == 'nan':
                continue

            record = {
                'date': date,
                'note_id': note_id,
                'note_url': str(row.get('笔记链接', '')) if pd.notna(row.get('笔记链接')) else '',
                'note_source': str(row.get('笔记来源', '')) if pd.notna(row.get('笔记来源')) else '',
                'note_type': str(row.get('笔记类型', '')) if pd.notna(row.get('笔记类型')) else '',
                'creator_name': str(row.get('笔记创作者名称', '')) if pd.notna(row.get('笔记创作者名称')) else '',
                'creator_id': str(row.get('笔记创作者ID', '')) if pd.notna(row.get('笔记创作者ID')) else '',
                'creator_followers': self.parse_number(row.get('作者粉丝量', 0)),

                # 互动指标
                'impressions': self.parse_number(row.get('全部曝光量', 0)),
                'reads': self.parse_number(row.get('全部阅读量', 0)),  # 阅读量类似点击量
                'total_interactions': self.parse_number(row.get('全部互动量', 0)),

                # 7日数据
                'cost_7d': self.parse_number(row.get('7日支付金额', 0)),
                'conversions_7d': self.parse_number(row.get('7日支付订单量', 0)),
                'roi_7d': self.parse_number(row.get('7日支付ROI', 0)),

                # 直播数据
                'live_views': self.parse_number(row.get('直播间有效观看次数', 0)),

                # 生产者和策略
                'producer': str(row.get('生产者', '')) if pd.notna(row.get('生产者')) else '',
                'strategy': str(row.get('广告策略', '')) if pd.notna(row.get('广告策略')) else ''
            }

            result.append(record)

        print(f"成功解析 {len(result)} 条小红书笔记数据")
        return result

    def process_xhs_note_info(self, df):
        """
        处理小红书笔记映射数据
        全量笔记-生产者和策略映射表.csv
        """
        print(f"处理小红书笔记映射数据: {len(df)} 行")

        result = {}
        for _, row in df.iterrows():
            note_id = str(row.get('笔记ID', '')).strip()
            if not note_id or note_id == 'nan':
                continue

            result[note_id] = {
                'note_id': note_id,
                'producer': str(row.get('生产者', '')) if pd.notna(row.get('生产者')) else '',
                'strategy': str(row.get('策略', '')) if pd.notna(row.get('策略')) else ''
            }

        print(f"成功解析 {len(result)} 条笔记映射")
        return result
