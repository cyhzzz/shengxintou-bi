/**
 * 周报HTML模板 - 完全参考原模板样式
 *
 * 基于周报模板3-1.HTML，保持所有样式和编辑功能
 */

class WeeklyReportTemplate {
    /**
     * 生成周报HTML（完全参考原模板样式）
     * @param {Object} data - 报告数据
     * @returns {string} HTML内容
     */
    static generateHTML(data) {
        const reportData = data.report_data || {};
        const keyWorks = reportData.key_works || [];

        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <title>互联网渠道周报 - 可编辑版</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&family=Inter:wght@400;500&display=swap');

        :root {
            --c-bg: #FAFAF8;
            --c-text: #1a1a1a;
            --c-text-light: #525252;
            --c-text-muted: #a3a3a3;
            --c-brand: #0052D9;
            --c-brand-light: #409EFF;
            --c-border: #e5e5e5;
            --c-edit-bg: rgba(0, 82, 217, 0.08);
            --c-edit-border: rgba(0, 82, 217, 0.3);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--c-bg);
            color: var(--c-text);
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            overflow-y: auto;
        }

        .editorial-container {
            max-width: 480px;
            margin: 0 auto;
            min-height: 100vh;
            padding: 20px 24px 16px;
            display: flex;
            flex-direction: column;
        }

        /* 可编辑元素基础样式 */
        [contenteditable="true"] {
            cursor: text;
            transition: all 0.15s ease;
            border-radius: 3px;
            outline: none;
            word-break: break-word;
        }

        [contenteditable="true"]:hover {
            background-color: var(--c-edit-bg);
            box-shadow: 0 0 0 1px var(--c-edit-border);
        }

        [contenteditable="true"]:focus {
            background-color: rgba(255, 255, 255, 0.9);
            box-shadow: 0 0 0 2px var(--c-brand);
            color: var(--c-text);
        }

        /* 数字专用编辑样式 */
        .editable-num {
            display: inline-block;
            min-width: 18px;
            text-align: right;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }

        .editable-num:hover {
            background-color: var(--c-edit-bg);
            border-radius: 4px;
            padding: 0 4px;
            margin: 0 -4px;
        }

        /* 刊头 */
        .masthead {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--c-border);
            position: relative;
            flex-shrink: 0;
        }

        .kicker {
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--c-brand);
            margin-bottom: 4px;
            display: inline-block;
            padding: 2px 4px;
        }

        .headline {
            font-family: 'Noto Serif SC', 'Playfair Display', serif;
            font-size: 26px;
            font-weight: 600;
            line-height: 1.2;
            color: var(--c-brand);
            display: block;
            padding: 2px 4px;
            margin-left: -4px;
        }

        .dateline {
            position: absolute;
            right: 0;
            top: 0;
            font-size: 10px;
            color: var(--c-text-muted);
            letter-spacing: 0.05em;
            padding: 2px 4px;
        }

        /* 统一卡片 */
        .layer-card {
            background: transparent;
            border-top: 2px solid var(--c-text);
            position: relative;
            padding: 12px 0;
            margin-bottom: 12px;
            flex-shrink: 0;
        }

        .layer-card::before {
            content: '';
            position: absolute;
            top: -2px;
            left: 0;
            width: 16px;
            height: 2px;
            background: var(--c-brand);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
        }

        .card-title {
            font-family: 'Noto Serif SC', serif;
            font-size: 15px;
            font-weight: 600;
            color: var(--c-text);
            padding: 2px 4px;
            margin-left: -4px;
        }

        .card-tag {
            font-size: 9px;
            color: var(--c-text-muted);
            letter-spacing: 0.05em;
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
        }

        /* 流量层 */
        .layer-sources {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            flex-shrink: 0;
        }

        .source-body {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .data-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--c-border);
            white-space: nowrap;
            overflow: hidden;
        }

        .data-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .data-label {
            font-size: 11px;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }

        .data-value {
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
        }

        .data-value.brand {
            color: var(--c-brand);
        }

        .data-cum {
            font-size: 9px;
            color: var(--c-text-muted);
            font-weight: 500;
            letter-spacing: -0.02em;
        }

        /* 广告层 */
        .ads-layer {
            display: block;
            margin-bottom: 12px;
            flex-shrink: 0;
        }

        .ads-body {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        /* 转化层 */
        .conversion-layer {
            display: block;
            margin-bottom: 16px;
            flex-shrink: 0;
        }

        .conversion-body {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 16px;
            min-height: 100px;
        }

        .conv-primary {
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-right: 16px;
            border-right: 1px solid var(--c-border);
        }

        .conv-big-label {
            font-size: 11px;
            color: var(--c-text-light);
            margin-bottom: 6px;
            font-weight: 500;
            padding: 2px 4px;
            margin-left: -4px;
        }

        .conv-big-number {
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
        }

        .conv-big-number:focus {
            -webkit-text-fill-color: var(--c-brand);
            background: transparent;
        }

        .conv-big-cum {
            font-size: 10px;
            color: var(--c-text-muted);
            padding: 2px 4px;
            margin-left: -4px;
        }

        .conv-secondary {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 2px 0;
        }

        .conv-small-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 5px 0;
            border-bottom: 1px solid var(--c-border);
        }

        .conv-small-item:last-child {
            border-bottom: none;
        }

        .conv-small-label {
            font-size: 10px;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }

        .conv-small-value {
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
        }

        .conv-small-value.brand {
            color: var(--c-brand);
        }

        .conv-small-cum {
            font-size: 8px;
            color: var(--c-text-muted);
            letter-spacing: -0.02em;
        }

        /* 重点工作 */
        .editorial-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .section-title {
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
        }

        .work-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .work-item {
            position: relative;
            display: grid;
            grid-template-columns: 20px 64px 1fr;
            gap: 10px;
            align-items: start;
            padding: 4px 30px 4px 0; /* 右侧留出空间给按钮 */
        }

        .work-num {
            font-family: 'Playfair Display', serif;
            font-size: 13px;
            font-style: italic;
            color: var(--c-brand);
            font-weight: 600;
            line-height: 1.4;
            padding: 2px 4px;
            margin-left: -4px;
        }

        .work-cat {
            font-size: 10px;
            font-weight: 600;
            color: var(--c-text);
            letter-spacing: 0.02em;
            line-height: 1.4;
            padding: 2px 4px;
            margin-left: -4px;
            white-space: nowrap;
        }

        .work-desc {
            font-size: 11px;
            line-height: 1.45;
            color: var(--c-text-light);
            padding: 2px 4px;
            margin-right: -4px;
        }

        /* 行操作按钮 - 固定在右侧边缘 */
        .work-actions {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .work-item:hover .work-actions {
            opacity: 1;
        }

        .work-add-btn,
        .work-delete-btn {
            width: 20px;
            height: 20px;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            transition: all 0.2s ease;
            font-weight: bold;
        }

        .work-add-btn {
            background-color: #52c41a;
            color: white;
        }

        .work-add-btn:hover {
            background-color: #3ca636;
            transform: scale(1.1);
        }

        .work-delete-btn {
            background-color: #ff4d4f;
            color: white;
        }

        .work-delete-btn:hover {
            background-color: #d9363e;
            transform: scale(1.1);
        }

        .footer {
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
        }

        .footer span {
            padding: 2px 4px;
        }

        .pg-num {
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="editorial-container">
        <!-- 刊头 -->
        <header class="masthead">
            <div class="kicker" contenteditable="true">获客周报</div>
            <h1 class="headline" contenteditable="true">互联网渠道</h1>
            <div class="dateline" contenteditable="true">${reportData.report_name || ''} · ${reportData.date_range || ''}</div>
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
                            <span class="editable-num" contenteditable="true">${this.formatNumber(reportData.content_count || 0)}</span>
                            <span class="data-cum" contenteditable="true">/${this.formatNumber(reportData.content_count_cumulative || 0)}</span>
                        </span>
                    </div>
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">阅读播放</span>
                        <span class="data-value">
                            <span class="editable-num" contenteditable="true">${this.formatLargeNumber(reportData.content_views || 0)}</span>
                            <span class="data-cum" contenteditable="true">/${this.formatLargeNumber(reportData.content_views_cumulative || 0)}</span>
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
                            <span class="editable-num" contenteditable="true">${this.formatNumber(reportData.live_sessions || 0)}</span>
                            <span class="data-cum" contenteditable="true">/${this.formatNumber(reportData.live_sessions_cumulative || 0)}场</span>
                        </span>
                    </div>
                    <div class="data-row">
                        <span class="data-label" contenteditable="true">观看人数</span>
                        <span class="data-value brand">
                            <span class="editable-num" contenteditable="true">${this.formatLargeNumber(reportData.live_viewers || 0)}</span>
                            <span class="data-cum" contenteditable="true">/${this.formatLargeNumber(reportData.live_viewers_cumulative || 0)}</span>
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
                        <span class="editable-num" contenteditable="true">${this.formatLargeNumber(reportData.ad_impressions || 0)}</span>
                        <span class="data-cum" contenteditable="true">/${this.formatLargeNumber(reportData.ad_impressions_cumulative || 0)}</span>
                    </span>
                </div>
                <div class="data-row" style="border-bottom: none; padding-bottom: 0;">
                    <span class="data-label" contenteditable="true">点击量</span>
                    <span class="data-value brand">
                        <span class="editable-num" contenteditable="true">${this.formatLargeNumber(reportData.ad_clicks || 0)}</span>
                        <span class="data-cum" contenteditable="true">/${this.formatLargeNumber(reportData.ad_clicks_cumulative || 0)}</span>
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
                    <div class="conv-big-number" contenteditable="true">${this.formatNumber(reportData.new_accounts || 0)}</div>
                    <div class="conv-big-cum" contenteditable="true">年度累计 ${this.formatNumber(reportData.new_accounts_cumulative || 0)}</div>
                </div>

                <div class="conv-secondary">
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">企业微信</span>
                        <div>
                            <span class="conv-small-value">
                                <span class="editable-num" contenteditable="true">${this.formatNumber(reportData.enterprise_wechat_add || 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/${this.formatNumber(reportData.enterprise_wechat_add_cumulative || 0)}</span>
                            </span>
                        </div>
                    </div>
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">投顾产品订阅</span>
                        <div>
                            <span class="conv-small-value">
                                <span class="editable-num" contenteditable="true">${this.formatNumber(reportData.subscription_count || 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/${this.formatNumber(reportData.subscription_count_cumulative || 0)}</span>
                            </span>
                        </div>
                    </div>
                    <div class="conv-small-item">
                        <span class="conv-small-label" contenteditable="true">助力分支新开户</span>
                        <div>
                            <span class="conv-small-value brand">
                                <span class="editable-num" contenteditable="true">${this.formatNumber(reportData.branch_new_accounts || 0)}</span>
                                <span class="conv-small-cum" contenteditable="true">/${this.formatNumber(reportData.branch_new_accounts_cumulative || 0)}</span>
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
                ${keyWorks.map((work, index) => `
                    <div class="work-item" data-work-id="${work.work_id || ''}" data-index="${index}">
                        <div class="work-num" contenteditable="true">${work.work_num || ''}</div>
                        <div class="work-cat" contenteditable="true">${work.work_category || ''}</div>
                        <div class="work-desc" contenteditable="true" data-field="work_description">${work.work_description || ''}</div>
                        <div class="work-actions">
                            <button class="work-add-btn" data-index="${index}" title="在下方添加一行">+</button>
                            <button class="work-delete-btn" data-index="${index}" title="删除这一行">−</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <footer class="footer">
            <span contenteditable="true">互联网渠道部</span>
            <span class="pg-num" contenteditable="true">${this.getWeekOrdinal(reportData.report_week || 1)}期</span>
        </footer>
    </div>
</body>
</html>
        `;
    }

    /**
     * 格式化数字（添加千分位）
     */
    static formatNumber(num) {
        if (num === null || num === undefined) {
            return '0';
        }
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 格式化大数字（万为单位）
     */
    static formatLargeNumber(num) {
        if (num === null || num === undefined) {
            return '0';
        }
        if (num >= 10000) {
            return (num / 10000).toFixed(2) + '万';
        }
        return this.formatNumber(num);
    }

    /**
     * 获取周次序数（中文）
     */
    static getWeekOrdinal(weekNum) {
        const ordinals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                          '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                          '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
                          '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十',
                          '四十一', '四十二', '四十三', '四十四', '四十五', '四十六', '四十七', '四十八', '四十九', '五十',
                          '五十一', '五十二', '五十三'];
        return ordinals[weekNum - 1] || weekNum;
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.WeeklyReportTemplate = WeeklyReportTemplate;
}
