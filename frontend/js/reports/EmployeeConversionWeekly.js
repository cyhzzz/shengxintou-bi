/**
 * 员工转化周报生成页面组件
 *
 * 功能：
 * 1. 配置周报参数（日期范围、平台、人数）
 * 2. 生成周报内容（文本格式）
 * 3. 支持复制、导出Word、导出Excel
 */

class EmployeeConversionWeekly {
    constructor() {
        this.startDate = null;
        this.endDate = null;
        this.platforms = ['小红书', '腾讯', '抖音'];
        this.topCount = 10;
        this.reportContent = null;
        this.currentData = null;
        this.platformMultiSelect = null;

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('员工转化周报生成页面初始化...');

        this.setDefaultDateRange();
        this.render();
        this.bindEvents();
        this.initPlatformMultiSelect();

        console.log('员工转化周报生成页面加载完成');
    }

    /**
     * 设置默认日期范围（上周一到上周日）
     */
    setDefaultDateRange() {
        const today = new Date();
        const dayOfWeek = today.getDay() || 7; // 周日为7

        // 上周日
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - dayOfWeek);

        // 上周一
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);

        this.startDate = lastMonday.toISOString().split('T')[0];
        this.endDate = lastSunday.toISOString().split('T')[0];
    }

    /**
     * 渲染页面
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <!-- 配置卡片 -->
            <div class="card card--filter card--full-width">
                <div class="card__header">
                    <h3 class="card__title">周报配置</h3>
                </div>
                <div class="card__body">
                    <div class="filter-bar-content" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;">
                        <!-- 日期范围 -->
                        <div class="filter-group">
                            <label class="filter-label">周一日期</label>
                            <input type="date" id="weeklyStartDate" class="form-control" value="${this.startDate}">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">周日日期</label>
                            <input type="date" id="weeklyEndDate" class="form-control" value="${this.endDate}">
                        </div>

                        <!-- 平台选择 -->
                        <div class="filter-group">
                            <label class="filter-label">平台</label>
                            <div id="weeklyPlatformMultiSelect" class="multi-select-form"></div>
                        </div>

                        <!-- 榜单人数 -->
                        <div class="filter-group">
                            <label class="filter-label">榜单人数</label>
                            <select id="topCountSelect" class="form-control">
                                <option value="5">TOP 5</option>
                                <option value="10" selected>TOP 10</option>
                                <option value="20">TOP 20</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card__footer">
                    <button class="btn btn--primary" id="generateReportBtn">生成周报</button>
                </div>
            </div>

            <!-- 周报内容卡片 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">周报内容</h3>
                    <div class="card__actions">
                        <button class="btn btn--sm btn--outline" id="copyReportBtn" disabled>复制报告</button>
                        <button class="btn btn--sm btn--outline" id="exportWordBtn" disabled>导出Word</button>
                        <button class="btn btn--sm btn--outline" id="exportExcelBtn" disabled>导出Excel</button>
                    </div>
                </div>
                <div class="card__body">
                    <div id="reportContent" style="
                        background: var(--bg-hover, #f5f7fa);
                        border-radius: 8px;
                        padding: 20px;
                        min-height: 400px;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        white-space: pre-wrap;
                        line-height: 1.8;
                    ">
<span style="color: #999; font-size: 14px;">
点击"生成周报"按钮，将自动生成本周转化战报...
</span>
                    </div>
                </div>
            </div>

            <!-- 海报导出卡片 -->
            <div class="card card--full-width" id="posterExportCard" style="display: none;">
                <div class="card__header">
                    <h3 class="card__title">导出海报</h3>
                    <div class="card__actions">
                        <span class="stat-label">选择平台导出精美海报</span>
                    </div>
                </div>
                <div class="card__body">
                    <div class="poster-export-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 20px;
                    ">
                        <!-- 小红书海报 -->
                        <div class="poster-export-item" style="
                            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                            border-radius: 12px;
                            padding: 24px;
                            color: white;
                            text-align: center;
                            cursor: pointer;
                            transition: transform 0.2s, box-shadow 0.2s;
                        " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(255, 107, 107, 0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                            <div style="font-size: 48px; margin-bottom: 12px;">📕</div>
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">小红书渠道</div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">开户榜海报</div>
                            <button class="btn btn--sm export-poster-btn" data-platform="xiaohongshu" style="
                                background: white;
                                color: #ff6b6b;
                                border: none;
                                font-weight: 600;
                            ">导出海报</button>
                        </div>

                        <!-- 腾讯海报 -->
                        <div class="poster-export-item" style="
                            background: linear-gradient(135deg, #1e5bb5 0%, #2d7dd2 100%);
                            border-radius: 12px;
                            padding: 24px;
                            color: white;
                            text-align: center;
                            cursor: pointer;
                            transition: transform 0.2s, box-shadow 0.2s;
                        " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(30, 91, 181, 0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                            <div style="font-size: 48px; margin-bottom: 12px;">💬</div>
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">腾讯渠道</div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">开户榜海报</div>
                            <button class="btn btn--sm export-poster-btn" data-platform="tencent" style="
                                background: white;
                                color: #1e5bb5;
                                border: none;
                                font-weight: 600;
                            ">导出海报</button>
                        </div>

                        <!-- 抖音海报 -->
                        <div class="poster-export-item" style="
                            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                            border-radius: 12px;
                            padding: 24px;
                            color: white;
                            text-align: center;
                            cursor: pointer;
                            transition: transform 0.2s, box-shadow 0.2s;
                        " onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(0, 0, 0, 0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                            <div style="font-size: 48px; margin-bottom: 12px;">🎵</div>
                            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">抖音渠道</div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">开户榜海报</div>
                            <button class="btn btn--sm export-poster-btn" data-platform="douyin" style="
                                background: white;
                                color: #1a1a2e;
                                border: none;
                                font-weight: 600;
                            ">导出海报</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 生成周报按钮
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }

        // 复制报告按钮
        const copyBtn = document.getElementById('copyReportBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyReport());
        }

        // 导出Word按钮
        const wordBtn = document.getElementById('exportWordBtn');
        if (wordBtn) {
            wordBtn.addEventListener('click', () => this.exportWord());
        }

        // 导出Excel按钮
        const excelBtn = document.getElementById('exportExcelBtn');
        if (excelBtn) {
            excelBtn.addEventListener('click', () => this.exportExcel());
        }

        // 海报导出按钮
        const posterBtns = document.querySelectorAll('.export-poster-btn');
        posterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const platform = e.target.dataset.platform;
                this.exportPoster(platform);
            });
        });
    }

    /**
     * 初始化平台多选组件
     */
    initPlatformMultiSelect() {
        const container = document.getElementById('weeklyPlatformMultiSelect');
        if (!container || typeof MultiSelectForm === 'undefined') return;

        this.platformMultiSelect = new MultiSelectForm({
            container: container,
            options: ['小红书', '腾讯', '抖音'],
            selectedValues: ['小红书', '腾讯', '抖音'],
            placeholder: '选择平台',
            onChange: (selected) => {
                this.platforms = selected;
            }
        });
    }

    /**
     * 获取选中的平台
     */
    getSelectedPlatforms() {
        if (this.platformMultiSelect) {
            return this.platformMultiSelect.getSelected();
        }
        return this.platforms;
    }

    /**
     * 生成周报
     */
    async generateReport() {
        const startDate = document.getElementById('weeklyStartDate')?.value;
        const endDate = document.getElementById('weeklyEndDate')?.value;
        const platforms = this.getSelectedPlatforms();
        const topCount = parseInt(document.getElementById('topCountSelect')?.value || '10');

        if (!startDate || !endDate) {
            alert('请选择日期范围');
            return;
        }

        if (platforms.length === 0) {
            alert('请至少选择一个平台');
            return;
        }

        // 显示加载状态
        const contentEl = document.getElementById('reportContent');
        if (contentEl) {
            contentEl.innerHTML = '<span style="color: #999;">正在生成周报，请稍候...</span>';
        }

        try {
            const response = await fetch('/api/v1/employee-conversion/weekly', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    platforms: platforms,
                    top_count: topCount
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentData = result.data;
                this.reportContent = this.formatReportContent(result.data, startDate, endDate);
                this.displayReport(this.reportContent);

                // 启用导出按钮
                document.getElementById('copyReportBtn').disabled = false;
                document.getElementById('exportWordBtn').disabled = false;
                document.getElementById('exportExcelBtn').disabled = false;

                // 显示海报导出卡片
                const posterCard = document.getElementById('posterExportCard');
                if (posterCard) {
                    posterCard.style.display = 'block';
                }

                // 绑定海报导出按钮事件
                this.bindPosterEvents();
            } else {
                if (contentEl) {
                    contentEl.innerHTML = `<span style="color: #f56c6c;">生成失败：${result.message || '未知错误'}</span>`;
                }
            }

        } catch (error) {
            console.error('生成周报失败:', error);
            if (contentEl) {
                contentEl.innerHTML = '<span style="color: #f56c6c;">生成失败，请稍后重试</span>';
            }
        }
    }

    /**
     * 格式化周报内容
     */
    formatReportContent(data, startDate, endDate) {
        const period = data.period || {};
        const overview = data.overview || {};
        const rankings = data.rankings || {};
        const stars = data.stars || {};

        // 格式化日期显示
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return `${date.getMonth() + 1}月${date.getDate()}日`;
        };

        let content = `═══════════════════════════════════════════════════════════
                    员工转化周报
═══════════════════════════════════════════════════════════

📅 报告周期：${formatDate(startDate)} - ${formatDate(endDate)}

`;

        // 各平台概览
        for (const platform of Object.keys(overview)) {
            const platformData = overview[platform] || {};
            content += `
┌───────────────────────────────────────────────────────────┐
│ 【${platform}平台概览】
├───────────────────────────────────────────────────────────┤
│ 线索量：${this.formatNum(platformData.leads)} 条
│ 开户量：${this.formatNum(platformData.opened)} 户
│ 开户率：${(platformData.rate || 0).toFixed(2)}%
└───────────────────────────────────────────────────────────┘

`;
        }

        // 各平台榜单
        for (const platform of Object.keys(rankings)) {
            const platformRankings = rankings[platform] || {};

            content += `
═══════════════════════════════════════════════════════════
              【${platform}平台转化榜单】
═══════════════════════════════════════════════════════════

`;

            // 全部线索榜单
            const totalList = platformRankings.total || [];
            if (totalList.length > 0) {
                content += `【全部线索转化榜 TOP${Math.min(totalList.length, 10)}】\n`;
                content += `排名  服务人员    线索量  开户量  开户率\n`;
                content += `──────────────────────────────────────\n`;
                totalList.slice(0, 10).forEach((item, idx) => {
                    content += `${String(idx + 1).padStart(2, '0')}    ${this.padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
                });
                content += `\n`;
            }

            // 存量线索榜单
            const existingList = platformRankings.existing || [];
            if (existingList.length > 0) {
                content += `【存量线索转化榜 TOP${Math.min(existingList.length, 10)}】\n`;
                content += `排名  服务人员    线索量  开户量  开户率\n`;
                content += `──────────────────────────────────────\n`;
                existingList.slice(0, 10).forEach((item, idx) => {
                    content += `${String(idx + 1).padStart(2, '0')}    ${this.padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
                });
                content += `\n`;
            }

            // 新增线索榜单
            const newList = platformRankings.new || [];
            if (newList.length > 0) {
                content += `【新增线索转化榜 TOP${Math.min(newList.length, 10)}】\n`;
                content += `排名  服务人员    线索量  开户量  开户率\n`;
                content += `──────────────────────────────────────\n`;
                newList.slice(0, 10).forEach((item, idx) => {
                    content += `${String(idx + 1).padStart(2, '0')}    ${this.padRight(item.employee_name, 8)}  ${String(item.total_leads).padStart(5)}  ${String(item.opened_count).padStart(5)}  ${(item.opening_rate || 0).toFixed(2)}%\n`;
                });
                content += `\n`;
            }
        }

        // 转化之星
        content += `
═══════════════════════════════════════════════════════════
                  【本周转化之星】
═══════════════════════════════════════════════════════════

`;
        for (const platform of Object.keys(stars)) {
            const star = stars[platform] || {};
            content += `⭐ ${platform}：${star.name || '-'}，开户率 ${(star.rate || 0).toFixed(2)}%\n`;
        }

        content += `
═══════════════════════════════════════════════════════════
                    报告结束
═══════════════════════════════════════════════════════════
`;

        return content;
    }

    /**
     * 显示周报
     */
    displayReport(content) {
        const contentEl = document.getElementById('reportContent');
        if (contentEl) {
            contentEl.textContent = content;
        }
    }

    /**
     * 复制周报
     */
    async copyReport() {
        if (!this.reportContent) {
            alert('请先生成周报');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.reportContent);
            alert('周报已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            alert('复制失败，请手动选择内容复制');
        }
    }

    /**
     * 导出Word
     */
    exportWord() {
        if (!this.reportContent) {
            alert('请先生成周报');
            return;
        }

        // 创建HTML内容
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>员工转化周报</title>
    <style>
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; line-height: 1.8; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <pre>${this.reportContent}</pre>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `员工转化周报_${this.startDate}_${this.endDate}.doc`;
        link.click();
    }

    /**
     * 导出Excel
     */
    exportExcel() {
        if (!this.currentData) {
            alert('请先生成周报');
            return;
        }

        const rankings = this.currentData.rankings || {};
        const platforms = Object.keys(rankings);

        // 构建CSV内容
        let csvContent = '';

        platforms.forEach(platform => {
            csvContent += `\n${platform}平台 - 全部线索转化榜\n`;
            csvContent += '排名,服务人员,线索量,开口量,有效线索,开户量,开户率,有效户,有效户率,总资产\n';

            const totalList = rankings[platform]?.total || [];
            totalList.forEach((item, idx) => {
                csvContent += `${idx + 1},${item.employee_name},${item.total_leads},${item.mouth_count},${item.valid_lead_count},${item.opened_count},${(item.opening_rate || 0).toFixed(2)}%,${item.valid_customer_count},${(item.valid_customer_rate || 0).toFixed(2)}%,${item.total_assets}\n`;
            });
        });

        // 创建Blob并下载
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `员工转化周报_${this.startDate}_${this.endDate}.csv`;
        link.click();
    }

    /**
     * 格式化数字
     */
    formatNum(value) {
        if (value === null || value === undefined) return '0';
        return value.toLocaleString();
    }

    /**
     * 字符串右填充空格
     */
    padRight(str, length) {
        str = String(str || '');
        const chineseCount = (str.match(/[\u4e00-\u9fa5]/g) || []).length;
        const totalLength = str.length + chineseCount;
        if (totalLength >= length) return str;
        return str + ' '.repeat(length - totalLength);
    }

    /**
     * 绑定海报导出按钮事件
     */
    bindPosterEvents() {
        const posterBtns = document.querySelectorAll('.export-poster-btn');
        posterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const platform = e.target.dataset.platform;
                this.exportPoster(platform);
            });
        });
    }

    /**
     * 导出海报
     */
    async exportPoster(platform) {
        if (!this.currentData) {
            alert('请先生成周报');
            return;
        }

        // 映射平台名称
        const platformMap = {
            'xiaohongshu': '小红书',
            'tencent': '腾讯',
            'douyin': '抖音'
        };

        const platformName = platformMap[platform];
        if (!platformName) {
            alert('未知的平台类型');
            return;
        }

        // 检查该平台数据是否存在
        const rankings = this.currentData.rankings?.[platformName];
        if (!rankings) {
            alert(`${platformName}平台暂无数据`);
            return;
        }

        // 打开海报预览窗口
        this.openPosterPreview(platform, platformName, rankings);
    }

    /**
     * 打开海报预览窗口
     */
    openPosterPreview(platform, platformName, rankings) {
        // 准备海报数据
        const posterData = this.preparePosterData(platformName, rankings);

        // 构建模板URL
        const templateMap = {
            'xiaohongshu': '/templates/weekly-reports/xiaohongshu-template.html',
            'tencent': '/templates/weekly-reports/tencent-template.html',
            'douyin': '/templates/weekly-reports/douyin-template.html'
        };

        const templateUrl = templateMap[platform];

        // 打开新窗口
        const previewWindow = window.open(templateUrl, '_blank', 'width=900,height=1200,scrollbars=yes');

        if (!previewWindow) {
            alert('无法打开预览窗口，请检查浏览器弹窗拦截设置');
            return;
        }

        // 等待窗口加载完成后发送数据
        const sendData = () => {
            if (previewWindow.initPoster) {
                previewWindow.initPoster(posterData);
            } else {
                // 如果还没加载完成，稍后再试
                setTimeout(sendData, 100);
            }
        };

        // 延迟发送数据，确保页面已加载
        setTimeout(sendData, 500);
    }

    /**
     * 准备海报数据
     */
    preparePosterData(platformName, rankings) {
        const startDate = document.getElementById('weeklyStartDate')?.value || this.startDate;
        const endDate = document.getElementById('weeklyEndDate')?.value || this.endDate;

        // 转换数据格式以匹配模板要求
        const transformData = (items) => {
            if (!items || !Array.isArray(items)) return [];
            return items.map(item => ({
                employee_name: item.employee_name || '-',
                total_leads: item.total_leads || 0,
                opened_count: item.opened_count || 0,
                valid_customer_count: item.valid_customer_count || 0,
                total_assets: item.total_assets || 0,
                opening_rate: item.opening_rate || 0,
                valid_customer_rate: item.valid_customer_rate || 0
            }));
        };

        return {
            start_date: startDate,
            end_date: endDate,
            platform: platformName,
            rankings: {
                total: transformData(rankings.total),
                existing: transformData(rankings.existing),
                new: transformData(rankings.new)
            }
        };
    }

    /**
     * 导出海报为图片（使用html2canvas）
     */
    async exportPosterAsImage(platform) {
        // 检查html2canvas是否可用
        if (typeof html2canvas === 'undefined') {
            // 动态加载html2canvas
            await this.loadHtml2Canvas();
        }

        // 创建隐藏的iframe来渲染海报
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '800px';
        iframe.style.height = '1200px';
        document.body.appendChild(iframe);

        const platformMap = {
            'xiaohongshu': '小红书',
            'tencent': '腾讯',
            'douyin': '抖音'
        };
        const platformName = platformMap[platform];
        const rankings = this.currentData.rankings?.[platformName];
        const posterData = this.preparePosterData(platformName, rankings);

        // 构建模板URL
        const templateMap = {
            'xiaohongshu': '/templates/weekly-reports/xiaohongshu-template.html',
            'tencent': '/templates/weekly-reports/tencent-template.html',
            'douyin': '/templates/weekly-reports/douyin-template.html'
        };

        // 加载模板
        const response = await fetch(templateMap[platform]);
        const html = await response.text();

        // 写入iframe
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();

        // 等待加载并初始化
        await new Promise(resolve => {
            const checkInit = () => {
                if (iframe.contentWindow.initPoster) {
                    iframe.contentWindow.initPoster(posterData);
                    setTimeout(resolve, 1000); // 等待渲染完成
                } else {
                    setTimeout(checkInit, 100);
                }
            };
            setTimeout(checkInit, 500);
        });

        // 使用html2canvas截图
        const posterContent = iframe.contentDocument.getElementById('posterContent');
        if (posterContent && html2canvas) {
            const canvas = await html2canvas(posterContent, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null
            });

            // 下载图片
            const link = document.createElement('a');
            link.download = `${platformName}渠道开户榜_${posterData.start_date}_${posterData.end_date}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        // 清理
        document.body.removeChild(iframe);
    }

    /**
     * 动态加载html2canvas
     */
    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.currentData = null;
        this.reportContent = null;
    }
}

// 导出组件
window.EmployeeConversionWeekly = EmployeeConversionWeekly;