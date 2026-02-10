# -*- coding: utf-8 -*-
"""
周报HTML模板生成器

根据数据生成周报HTML内容
"""


def generate_weekly_report_html(data: dict) -> str:
    """
    生成周报HTML内容

    Args:
        data: 周报数据字典，包含：
            - week_info: 周信息
            - traffic: 流量数据
            - ad: 广告数据
            - conversion: 转化数据
            - key_works: 重点工作列表

    Returns:
        完整的HTML字符串
    """
    week_info = data.get('week_info', {})
    traffic = data.get('traffic', {})
    ad = data.get('ad', {})
    conversion = data.get('conversion', {})
    key_works = data.get('key_works', [])

    # 格式化数字显示
    def format_number(num, is_cumulative=False):
        """格式化数字，支持万单位"""
        if num >= 10000:
            return f"{num / 10000:.2f}万"
        return str(num)

    # 月份名称映射
    month_names = {
        1: '一月', 2: '二月', 3: '三月', 4: '四月', 5: '五月', 6: '六月',
        7: '七月', 8: '八月', 9: '九月', 10: '十月', 11: '十一月', 12: '十二月'
    }

    month_name = month_names.get(week_info.get('report_month', 1), '一月')
    month_week = week_info.get('report_month_week', 1)
    date_range = week_info.get('date_range', '')

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <title>{week_info.get('report_name', '周报')} - 互联网渠道周报</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&family=Inter:wght@400;500&display=swap');

        :root {{
            --c-bg: #FAFAF8;
            --c-text: #1a1a1a;
            --c-text-light: #525252;
            --c-text-muted: #a3a3a3;
            --c-brand: #0052D9;
            --c-brand-light: #409EFF;
            --c-border: #e5e5e5;
            --c-edit-bg: rgba(0, 82, 217, 0.08);
            --c-edit-border: rgba(0, 82, 217, 0.3);
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--c-bg);
            color: var(--c-text);
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            overflow-y: auto;
        }}

        .editorial-container {{
            max-width: 480px;
            margin: 0 auto;
            min-height: 100vh;
            padding: 20px 24px 16px;
            display: flex;
            flex-direction: column;
        }}

        /* 可编辑元素基础样式 */
        [contenteditable="true"] {{
            cursor: text;
            transition: all 0.15s ease;
            border-radius: 3px;
            outline: none;
            word-break: break-word;
        }}

        [contenteditable="true"]:hover {{
            background-color: var(--c-edit-bg);
            box-shadow: 0 0 0 1px var(--c-edit-border);
        }}

        [contenteditable="true"]:focus {{
            background-color: rgba(255, 255, 255, 0.9);
            box-shadow: 0 0 0 2px var(--c-brand);
            color: var(--c-text);
        }}

        /* 数字专用编辑样式 */
        .editable-num {{
            display: inline-block;
            min-width: 18px;
            text-align: right;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }}

        .editable-num:hover {{
            background-color: var(--c-edit-bg);
            border-radius: 4px;
            padding: 0 4px;
            margin: 0 -4px;
        }}

        /* 刊头 */
        .masthead {{
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--c-border);
            position: relative;
            flex-shrink: 0;
        }}

        .kicker {{
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--c-brand);
            margin-bottom: 4px;
            display: inline-block;
            padding: 2px 4px;
        }}

        .headline {{
            font-family: 'Noto Serif SC', 'Playfair Display', serif;
            font-size: 26px;
            font-weight: 600;
            line-height: 1.2;
            color: var(--c-brand);
            display: block;
            padding: 2px 4px;
            margin-left: -4px;
        }}

        .dateline {{
            position: absolute;
            right: 0;
            top: 0;
            font-size: 10px;
            color: var(--c-text-muted);
            letter-spacing: 0.05em;
            padding: 2px 4px;
        }}

        /* 统一卡片 */
        .layer-card {{
            background: transparent;
            border-top: 2px solid var(--c-text);
            position: relative;
            padding: 12px 0;
            margin-bottom: 12px;
            flex-shrink: 0;
        }}

        .layer-card::before {{
            content: '';
            position: absolute;
            top: -2px;
            left: 0;
            width: 16px;
            height: 2px;
            background: var(--c-brand);
        }}

        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
        }}

        .card-title {{
            font-family: 'Noto Serif SC', serif;
            font-size: 15px;
            font-weight: 600;
            color: var(--c-text);
            padding: 2px 4px;
            margin-left: -4px;
        }}

        .card-tag {{
            font-size: 9px;
            color: var(--c-text-muted);
            letter-spacing: 0.05em;
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
        }}

        /* 流量层 */
        .layer-sources {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            flex-shrink: 0;
        }}

        .source-body {{
            display: flex;
            flex-direction: column;
            gap: 6px;
        }}

        .data-row {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--c-border);
            white-space: nowrap;
            overflow: hidden;
        }}

        .data-row:last-child {{
            border-bottom: none;
            padding-bottom: 0;
        }}

        .data-label {{
            font-size: 11px;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }}

        .data-value {{
            font-family: 'Noto Serif SC', 'Playfair Display', serif;
            font-size: 16px;
            font-weight: 600;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            line-height: 1;
            color: var(--c-text);
            padding: 2px 0;
            display: flex;
            align-items: baseline;
            gap: 2px;
        }}

        .data-value.brand {{
            color: var(--c-brand);
        }}

        .data-cum {{
            font-size: 9px;
            color: var(--c-text-muted);
            font-weight: 500;
            letter-spacing: -0.02em;
        }}

        /* 广告层 */
        .ads-layer {{
            display: block;
            margin-bottom: 12px;
            flex-shrink: 0;
        }}

        .ads-body {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }}

        /* 转化层 */
        .conversion-layer {{
            display: block;
            margin-bottom: 16px;
            flex-shrink: 0;
        }}

        .conversion-body {{
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 16px;
            min-height: 100px;
        }}

        .conv-primary {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-right: 16px;
            border-right: 1px solid var(--c-border);
        }}

        .conv-big-label {{
            font-size: 11px;
            color: var(--c-text-light);
            margin-bottom: 6px;
            font-weight: 500;
            padding: 2px 4px;
            margin-left: -4px;
        }}

        .conv-big-number {{
            font-family: 'Noto Serif SC', 'Playfair Display', serif;
            font-size: 38px;
            font-weight: 600;
            background: linear-gradient(135deg, var(--c-brand-light) 0%, var(--c-brand) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            margin-bottom: 4px;
            padding: 2px 4px;
            margin-left: -4px;
            display: inline-block;
        }}

        .conv-big-number:focus {{
            -webkit-text-fill-color: var(--c-brand);
            background: transparent;
        }}

        .conv-big-cum {{
            font-size: 10px;
            color: var(--c-text-muted);
            padding: 2px 4px;
            margin-left: -4px;
        }}

        .conv-secondary {{
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 2px 0;
        }}

        .conv-small-item {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 5px 0;
            border-bottom: 1px solid var(--c-border);
        }}

        .conv-small-item:last-child {{
            border-bottom: none;
        }}

        .conv-small-label {{
            font-size: 10px;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }}

        .conv-small-value {{
            font-family: 'Noto Serif SC', 'Playfair Display', serif;
            font-size: 15px;
            font-weight: 600;
            color: var(--c-text);
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            line-height: 1;
            display: flex;
            align-items: baseline;
            gap: 2px;
        }}

        .conv-small-value.brand {{
            color: var(--c-brand);
        }}

        .conv-small-cum {{
            font-size: 8px;
            color: var(--c-text-muted);
            letter-spacing: -0.02em;
        }}

        /* 重点工作 */
        .editorial-section {{
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }}

        .section-title {{
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.15em;
            color: var(--c-text-muted);
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--c-border);
            padding: 2px 4px;
            margin-left: -4px;
            flex-shrink: 0;
        }}

        .work-list {{
            display: flex;
            flex-direction: column;
            gap: 8px;
        }}

        .work-item {{
            display: grid;
            grid-template-columns: 20px 64px 1fr;
            gap: 10px;
            align-items: start;
            padding: 4px 0;
        }}

        .work-num {{
            font-family: 'Playfair Display', serif;
            font-size: 13px;
            font-style: italic;
            color: var(--c-brand);
            font-weight: 600;
            line-height: 1.4;
            padding: 2px 4px;
            margin-left: -4px;
        }}

        .work-cat {{
            font-size: 10px;
            font-weight: 600;
            color: var(--c-text);
            letter-spacing: 0.02em;
            line-height: 1.4;
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }}

        .work-desc {{
            font-size: 11px;
            line-height: 1.45;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-right: -4px;
        }}

        .footer {{
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--c-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            letter-spacing: 0.1em;
            color: var(--c-text-muted);
            flex-shrink: 0;
        }}

        .footer span {{
            padding: 2px 4px;
        }}

        .pg-num {{
            font-style: italic;
        }}
    </style>
</head>
<body>
    <div class="editorial-container">
        <!-- 刊头 -->
        <header class="masthead">
            <div class="kicker" contenteditable="true">获客周报</div>
            <h1 class="headline" contenteditable="true">互联网渠道</h1>
            <div class="dateline" contenteditable="true">{month_name}第{month_week}周 · {date_range}</div>
        </header>

        <!-- Layer 1: 流量入口 -->
        <div class="layer-sources">
            <div class="layer-card" style="margin-bottom: 0;">
                <div class="card-header">
                    <span class="card-title" contenteditable="true">内容运营</span>
                    <span class="card-tag" contenteditable="true">多形态内容</span>
                </div>
                <div class="source-body">
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">内容数量</span>
                        <span class="data-value">
                            <span class="editable-num" contenteditable="true">{traffic.get('content_count', 0)}</span>
                            <span class="data-cum" contenteditable="true">/{traffic.get('content_count_cumulative', 0)}</span>
                        </span>
                    </div>
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">阅读播放</span>
                        <span class="data-value">
                            <span class="editable-num" contenteditable="true">{format_number(traffic.get('content_views', 0))}</span>
                            <span class="data-cum" contenteditable="true">/{format_number(traffic.get('content_views_cumulative', 0))}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="layer-card" style="margin-bottom: 0;">
                <div class="card-header">
                    <span class="card-title" contenteditable="true">直播获客</span>
                    <span class="card-tag" contenteditable="true">投顾+分析师</span>
                </div>
                <div class="source-body">
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">直播场次</span>
                        <span class="data-value">
                            <span class="editable-num" contenteditable="true">{traffic.get('live_sessions', 0)}</span>
                            <span class="data-cum" contenteditable="true">/{traffic.get('live_sessions_cumulative', 0)}场</span>
                        </span>
                    </div>
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">观看人数</span>
                        <span class="data-value brand">
                            <span class="editable-num" contenteditable="true">{format_number(traffic.get('live_viewers', 0))}</span>
                            <span class="data-cum" contenteditable="true">/{format_number(traffic.get('live_viewers_cumulative', 0))}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Layer 2: 广告投放 -->
        <div class="layer-card ads-layer">
            <div class="card-header">
                <span class="card-title" contenteditable="true">广告投放</span>
                <span class="card-tag" contenteditable="true">付费推广</span>
            </div>
            <div class="ads-body">
                <div class="data-row" style="border-bottom: none; padding-bottom: 0;">
                    <span class="data-label" contenteditable="true">曝光量</span>
                    <span class="data-value">
                        <span class="editable-num" contenteditable="true">{format_number(ad.get('ad_impressions', 0))}</span>
                        <span class="data-cum" contenteditable="true">/{format_number(ad.get('ad_impressions_cumulative', 0))}</span>
                    </span>
                </div>
                <div class="data-row" style="border-bottom: none; padding-bottom: 0;">
                    <span class="data-label" contenteditable="true">点击量</span>
                    <span class="data-value brand">
                        <span class="editable-num" contenteditable="true">{format_number(ad.get('ad_clicks', 0))}</span>
                        <span class="data-cum" contenteditable="true">/{format_number(ad.get('ad_clicks_cumulative', 0))}</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Layer 3: 转化结果 -->
        <div class="layer-card conversion-layer">
            <div class="card-header">
                <span class="card-title" contenteditable="true">转化结果</span>
                <span class="card-tag" contenteditable="true">获客闭环</span>
            </div>
            <div class="conversion-body">
                <div class="conv-primary">
                    <div class="conv-big-label" contenteditable="true">互联网营业部新开户</div>
                    <div class="conv-big-number" contenteditable="true">{conversion.get('new_accounts', 0)}</div>
                    <div class="conv-big-cum" contenteditable="true">年度累计 {conversion.get('new_accounts_cumulative', 0)}</div>
                </div>

                <div class="conv-secondary">
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">企业微信</span>
                        <div>
                            <span class="conv-small-value">
                                <span class="editable-num" contenteditable="true">{conversion.get('enterprise_wechat_add', 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/{conversion.get('enterprise_wechat_add_cumulative', 0)}</span>
                            </span>
                        </div>
                    </div>
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">投顾产品订阅</span>
                        <div>
                            <span class="conv-small-value">
                                <span class="editable-num" contenteditable="true">{conversion.get('subscription_count', 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/{conversion.get('subscription_count_cumulative', 0)}</span>
                            </span>
                        </div>
                    </div>
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">助力分支新开户</span>
                        <div>
                            <span class="conv-small-value brand">
                                <span class="editable-num" contenteditable="true">+{conversion.get('branch_new_accounts', 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/{conversion.get('branch_new_accounts_cumulative', 0)}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 重点工作 -->
        <section class="editorial-section">
            <div class="section-title" contenteditable="true">重点工作进展</div>

            <div class="work-list">
"""

    # 生成重点工作列表
    for work in key_works:
        html += f"""
                <div class="work-item">
                    <div class="work-num" contenteditable="true">{work.get('work_num', '01')}</div>
                    <div class="work-cat" contenteditable="true">{work.get('work_category', '')}</div>
                    <div class="work-desc" contenteditable="true">{work.get('work_description', '')}</div>
                </div>
        """

    html += f"""
            </div>
        </section>

        <footer class="footer">
            <span contenteditable="true">互联网渠道部</span>
            <span class="pg-num" contenteditable="true">第{month_week}期</span>
        </footer>
    </div>
</body>
</html>
    """

    return html


# 测试代码
if __name__ == '__main__':
    # 测试数据
    test_data = {
        'week_info': {
            'report_year': 2026,
            'report_month': 1,
            'report_week': 4,
            'report_month_week': 4,
            'date_range': '1/23-1/29',
            'report_name': '2026年1月第4周'
        },
        'traffic': {
            'content_count': 61,
            'content_count_cumulative': 125,
            'content_views': 21300,
            'content_views_cumulative': 130200,
            'live_sessions': 22,
            'live_sessions_cumulative': 68,
            'live_viewers': 89300,
            'live_viewers_cumulative': 306100
        },
        'ad': {
            'ad_impressions': 305000,
            'ad_impressions_cumulative': 1524000,
            'ad_clicks': 61000,
            'ad_clicks_cumulative': 235800
        },
        'conversion': {
            'new_accounts': 191,
            'new_accounts_cumulative': 760,
            'enterprise_wechat_add': 1207,
            'enterprise_wechat_add_cumulative': 4786,
            'subscription_count': 5,
            'subscription_count_cumulative': 41,
            'branch_new_accounts': 16,
            'branch_new_accounts_cumulative': 42
        },
        'key_works': [
            {
                'work_num': '01',
                'work_category': '渠道拓展',
                'work_description': '预沟通2026年度广告投放代理招标采购，财经媒体直播供应商征集完成，应用商城优化方案已提交。'
            },
            {
                'work_num': '02',
                'work_category': '投放管理',
                'work_description': '代理公司探索阶段顺利完成，进入精细化运营阶段，启动投放额度与策略机制优化。'
            }
        ]
    }

    # 生成HTML
    html = generate_weekly_report_html(test_data)

    # 保存到文件测试
    with open('test_weekly_report.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("周报HTML已生成: test_weekly_report.html")
