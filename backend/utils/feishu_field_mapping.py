# -*- coding: utf-8 -*-
"""
飞书字段映射配置
数据库字段名 -> 飞书字段名（注意：使用字段名，不是字段ID）

重要发现：飞书API创建记录时必须使用字段名，不是字段ID！
- ❌ 错误: {"fields": {"fldYbaM3Gi": 1702200000000}}  # 使用字段ID
- ✅ 正确: {"fields": {"日期": 1702200000000}}        # 使用字段名

字段名来自实际飞书表格，通过 list_field_names.py 获取
"""

FIELD_MAPPING = {
    'daily_metrics_unified': {
        'date': '日期',
        'platform': '平台',
        'agency': '代理商',
        'business_model': '业务模式',
        'cost': '花费',
        'impressions': '曝光',
        'click_users': '点击用户数',
        'lead_users': '线索用户数',
        'potential_customers': '潜客用户数',
        'customer_mouth_users': '开口用户数',  # 修正：不是"客户开口用户数"
        'valid_lead_users': '有效线索用户数',
        'opened_account_users': '开户用户数',
        'valid_customer_users': '有效户用户数',
        'account_id': '账号ID',
        'account_name': '账号名称',
    },
    'backend_conversions': {
        'lead_date': '线索日期',
        'platform_source': '平台来源',
        'ad_account': '广告账号',
        'agency': '广告代理商',
        'is_customer_mouth': '是否客户开口',
        'is_valid_lead': '是否有效线索',
        'is_opened_account': '是否开户',
        'is_valid_customer': '是否为有效户',
        'wechat_nickname': '微信昵称',
        'capital_account': '资金账号',
        'opening_branch': '开户营业部',
    },
    'xhs_notes_daily': {
        'date': '日期',
        'note_id': '笔记ID',
        'note_title': '笔记标题',
        'account_id': '账号ID',
        'impressions': '曝光',
        'clicks': '点击',
        'likes': '点赞',
        'collects': '收藏',
        'comments': '评论',
        'shares': '分享',
    },
    'daily_notes_metrics_unified': {
        'date': '日期',
        'account_id': '账号ID',
        'account_name': '账号名称',
        'note_count': '笔记数',
        'total_impressions': '总曝光',
        'total_clicks': '总点击',
        'total_likes': '总点赞',
        'total_collects': '总收藏',
        'total_comments': '总评论',
        'total_shares': '总分享',
        'engagement_rate': '互动率',
    },
}
