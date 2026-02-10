/**
 * 省心投 BI - 小红书运营分析报表
 * 提供7个子模块的数据分析和可视化
 * 样式已更新为 Structured Clarity 设计规范
 *
 * @version 1.1.0
 * @updated 2026-01-23
 */

class XhsNotesOperationReport {
    constructor() {
        this.currentData = null;
        this.filters = this.getDefaultFilters();
        this.topNotesDateRange = this.getDefaultTopNotesDateRange();  // 优秀笔记排行榜独立时间筛选器
        this.creatorAnnualDateRange = this.getDefaultCreatorAnnualDateRange();  // 创作者年度排行榜独立时间筛选器
        this.charts = {};
        this.isLoading = false;  // 加载状态标志

        // 初始化事件管理器（Phase 1: 修复事件监听器泄漏）
        this.eventManager = new EventManager();

        this.init();
    }

    /**
     * 获取默认筛选条件
     */
    getDefaultFilters() {
        // 默认"近30天"
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return {
            date_range: [
                thirtyDaysAgo.toISOString().split('T')[0],
                today.toISOString().split('T')[0]
            ]
        };
    }

    /**
     * 获取优秀笔记排行榜默认时间范围（近30天）
     */
    getDefaultTopNotesDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return [
            thirtyDaysAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        ];
    }

    /**
     * 获取创作者年度排行榜默认时间范围（今年以来）
     */
    getDefaultCreatorAnnualDateRange() {
        const today = new Date();
        const yearStart = new Date(today.getFullYear(), 0, 1);  // 当年1月1日

        return [
            yearStart.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        ];
    }

    /**
     * 初始化
     */
    async init() {
        console.log('小红书运营分析报表初始化...');

        // 加载数据
        await this.loadData();

        // 渲染报表
        this.render();

        // 绑定事件
        this.bindEvents();

        console.log('小红书运营分析报表加载完成');
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            const response = await API.post('/api/v1/xhs-notes-operation-analysis', {
                filters: {
                    ...this.filters,
                    top_notes_date_range: this.topNotesDateRange,  // 传递优秀笔记排行榜独立时间筛选器
                    creator_annual_date_range: this.creatorAnnualDateRange  // 传递创作者年度排行榜独立时间筛选器
                }
            });

            console.log('[XhsNotesOperation] API Response:', response);

            if (response.success) {
                this.currentData = response.data;
                console.log('[XhsNotesOperation] 运营分析数据加载成功');

                // 详细打印员工转化相关数据
                console.log('[XhsNotesOperation] response.data keys:', Object.keys(response.data));
                console.log('[XhsNotesOperation] employee_conversion_ranking:',
                    this.currentData.employee_conversion_ranking);
                console.log('[XhsNotesOperation] employee_weekly_conversion:',
                    this.currentData.employee_weekly_conversion);
                console.log('[XhsNotesOperation] employee_weekly_conversion type:',
                    typeof this.currentData.employee_weekly_conversion);
                console.log('[XhsNotesOperation] employee_weekly_conversion value:',
                    JSON.stringify(this.currentData.employee_weekly_conversion, null, 2));
            } else {
                console.error('[XhsNotesOperation] 数据加载失败:', response.error);
                this.showError('数据加载失败: ' + (response.message || response.error));
            }
        } catch (error) {
            console.error('[XhsNotesOperation] 加载数据时出错:', error);
            this.showError('加载数据时出错: ' + error.message);
        }
    }

    /**
     * 处理查询
     */
    async handleQuery() {
        // 防止重复点击
        if (this.isLoading) {
            return;
        }

        // 直接使用 filters.date_range，不从输入框读取
        // 因为快速选择时可能设置为 null（全部）
        const [startDate, endDate] = this.filters.date_range;

        // 允许全部数据查询（startDate 和 endDate 都为 null）
        if (!startDate && !endDate) {
            // 全部数据 - 继续查询
        } else if (!startDate || !endDate) {
            // 只有一个为空，提示用户
            alert('请选择完整的日期范围');
            return;
        }

        // 设置加载状态
        this.isLoading = true;
        this.updateLoadingUI();

        try {
            await this.loadData();
            // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
            this.updateData();
            this.bindEvents();
        } catch (error) {
            console.error('查询失败:', error);
            alert('查询失败: ' + error.message);
        } finally {
            // 清除加载状态
            this.isLoading = false;
            this.updateLoadingUI();
        }
    }

    /**
     * 处理重置
     */
    async handleReset() {
        // 防止重复点击
        if (this.isLoading) {
            return;
        }

        this.filters = this.getDefaultFilters();

        // 设置加载状态
        this.isLoading = true;
        this.updateLoadingUI();

        try {
            await this.loadData();
            // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
            this.updateData();
            this.bindEvents();
        } catch (error) {
            console.error('重置失败:', error);
            alert('重置失败: ' + error.message);
        } finally {
            // 清除加载状态
            this.isLoading = false;
            this.updateLoadingUI();
        }
    }

    /**
     * 绑定优秀笔记排行榜独立时间筛选器事件
     */
    bindTopNotesDateSelectorEvents() {
        // 找到 .btn-group 容器（从 #topNotesStartDate 的父级容器中查找）
        const startDateInput = document.getElementById('topNotesStartDate');
        if (!startDateInput) return;

        const container = startDateInput.parentElement?.parentElement?.querySelector('.btn-group');
        if (!container) return;

        const buttons = container.querySelectorAll('button');
        const endDateInput = document.getElementById('topNotesEndDate');

        // 快速日期按钮点击事件
        buttons.forEach(button => {
            this.eventManager.on(button, 'click', async (e) => {
                e.preventDefault();

                // 防止重复点击
                if (container.classList.contains('is-loading')) {
                    return;
                }

                const days = button.getAttribute('data-days');

                const today = new Date();
                let startDate, endDate;

                if (days === '30') {
                    // 近30天
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 30);
                } else if (days === 'ytd') {
                    // 今年以来
                    endDate = new Date(today);
                    startDate = new Date(today.getFullYear(), 0, 1);
                } else if (days === 'custom') {
                    // 自定义日期 - 移除readonly，允许用户选择
                    if (startDateInput) {
                        startDateInput.removeAttribute('readonly');
                        startDateInput.focus();
                    }
                    if (endDateInput) {
                        endDateInput.removeAttribute('readonly');
                    }

                    // 绑定日期变化事件（Phase 1: 使用 EventManager）
                    if (startDateInput && !startDateInput.hasAttribute('data-bound')) {
                        startDateInput.setAttribute('data-bound', 'true');
                        this.eventManager.on(startDateInput, 'change', async () => {
                            if (startDateInput.value && endDateInput.value) {
                                this.topNotesDateRange = [startDateInput.value, endDateInput.value];

                                // 显示loading状态
                                this.showTopNotesLoading(buttons);

                                await this.loadTopNotesData();

                                // 隐藏loading状态
                                this.hideTopNotesLoading(buttons);
                            }
                        });
                    }
                    if (endDateInput && !endDateInput.hasAttribute('data-bound')) {
                        endDateInput.setAttribute('data-bound', 'true');
                        this.eventManager.on(endDateInput, 'change', async () => {
                            if (startDateInput.value && endDateInput.value) {
                                this.topNotesDateRange = [startDateInput.value, endDateInput.value];

                                // 显示loading状态
                                this.showTopNotesLoading(buttons);

                                await this.loadTopNotesData();

                                // 隐藏loading状态
                                this.hideTopNotesLoading(buttons);
                            }
                        });
                    }
                    return;
                } else {
                    return;
                }

                this.topNotesDateRange = [
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                ];

                // 更新输入框显示（保持readonly）
                if (startDateInput) startDateInput.value = this.topNotesDateRange[0];
                if (endDateInput) endDateInput.value = this.topNotesDateRange[1];

                // 更新按钮激活状态
                buttons.forEach(btn => btn.classList.remove('is-active'));
                button.classList.add('is-active');

                // 显示loading状态
                this.showTopNotesLoading(buttons);

                await this.loadTopNotesData();

                // 隐藏loading状态
                this.hideTopNotesLoading(buttons);
            });
        });
    }

    /**
     * 显示优秀笔记排行榜loading状态
     */
    showTopNotesLoading(buttons) {
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('is-loading');
        });
    }

    /**
     * 隐藏优秀笔记排行榜loading状态
     */
    hideTopNotesLoading(buttons) {
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('is-loading');
        });
    }

    /**
     * 绑定创作者年度排行榜独立时间筛选器事件
     */
    bindCreatorAnnualDateSelectorEvents() {
        // 找到 .btn-group 容器（从 #creatorAnnualStartDate 的父级容器中查找）
        const startDateInput = document.getElementById('creatorAnnualStartDate');
        if (!startDateInput) return;

        const buttonsContainer = startDateInput.parentElement?.parentElement?.querySelector('.btn-group');
        if (!buttonsContainer) return;

        const buttons = buttonsContainer.querySelectorAll('button');
        const endDateInput = document.getElementById('creatorAnnualEndDate');

        // 快速日期按钮点击事件
        buttons.forEach(button => {
            this.eventManager.on(button, 'click', async (e) => {
                e.preventDefault();

                // 防止重复点击
                if (buttonsContainer.classList.contains('is-loading')) {
                    return;
                }

                // 更新按钮激活状态
                buttons.forEach(btn => btn.classList.remove('is-active'));
                button.classList.add('is-active');

                const days = button.getAttribute('data-days');

                const today = new Date();
                let startDate, endDate;

                if (days === '30') {
                    // 近30天
                    endDate = new Date(today);
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 30);
                } else if (days === 'ytd') {
                    // 今年以来
                    endDate = new Date(today);
                    startDate = new Date(today.getFullYear(), 0, 1);
                } else {
                    return;
                }

                this.creatorAnnualDateRange = [
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                ];

                // 更新输入框显示（保持readonly）
                if (startDateInput) startDateInput.value = this.creatorAnnualDateRange[0];
                if (endDateInput) endDateInput.value = this.creatorAnnualDateRange[1];

                // 显示loading状态
                buttons.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('is-loading');
                });

                // 重新加载创作者年度排行榜数据
                await this.loadCreatorAnnualData();

                // 恢复按钮状态
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('is-loading');
                });
            });
        });
    }

    /**
     * 只加载优秀笔记排行榜数据
     */
    async loadTopNotesData() {
        try {
            // 独立筛选器：只使用自己的日期范围，不继承主筛选器的其他条件
            const response = await API.post('/api/v1/xhs-notes-operation-analysis', {
                filters: {
                    top_notes_date_range: this.topNotesDateRange
                }
            });

            if (response.success) {
                this.currentData.top_notes = response.data.top_notes;
                // 只重新渲染优秀笔记排行榜表格
                const tbody = document.querySelector('#topNotesStartDate').closest('.card').querySelector('tbody');
                if (tbody) {
                    tbody.innerHTML = this.renderTopNotesRows();
                }
                console.log('优秀笔记排行榜数据更新成功');
            } else {
                console.error('数据加载失败:', response.error);
                this.showError('数据加载失败: ' + (response.message || response.error));
            }
        } catch (error) {
            console.error('加载数据时出错:', error);
            this.showError('加载数据时出错: ' + error.message);
        }
    }

    /**
     * 只加载创作者年度排行榜数据
     */
    async loadCreatorAnnualData() {
        try {
            // 独立筛选器：只使用自己的日期范围，不继承主筛选器的其他条件
            const response = await API.post('/api/v1/xhs-notes-operation-analysis', {
                filters: {
                    creator_annual_date_range: this.creatorAnnualDateRange
                }
            });

            if (response.success) {
                this.currentData.creator_annual_ranking = response.data.creator_annual_ranking;
                // 只重新渲染创作者年度排行榜表格
                const tbody = document.querySelector('#creatorAnnualStartDate').closest('.card').querySelector('tbody');
                if (tbody) {
                    tbody.innerHTML = this.renderCreatorAnnualRows();
                }
                console.log('创作者年度排行榜数据更新成功');
            } else {
                console.error('数据加载失败:', response.error);
                this.showError('数据加载失败: ' + (response.message || response.error));
            }
        } catch (error) {
            console.error('加载数据时出错:', error);
            this.showError('加载数据时出错: ' + error.message);
        }
    }

    /**
     * 处理快速日期选择
     */
    handleQuickDateSelect(rangeType) {
        const today = new Date();
        let startDate, endDate;

        switch (rangeType) {
            case 'all':  // 全部：从2025年4月9日到今天
                endDate = new Date(today);
                startDate = new Date(2025, 3, 9);  // 2025年4月9日（月份从0开始）
                break;

            case '7':  // 近7天
            case '30': // 近30天
            case '90': // 近90天
                endDate = new Date(today);
                startDate = new Date(today);
                startDate.setDate(today.getDate() - parseInt(rangeType, 10));
                break;

            case 'ytd':  // 今年以来
                endDate = new Date(today);
                startDate = new Date(today.getFullYear(), 0, 1);  // 当年1月1日
                break;

            default:
                return;
        }

        // 格式化日期为 YYYY-MM-DD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // 更新筛选器 - 所有快选项都使用计算后的日期范围
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        this.filters.date_range = [startDateStr, endDateStr];

        // 更新日期输入框
        const startDateInput = document.getElementById('operationStartDate');
        const endDateInput = document.getElementById('operationEndDate');

        if (startDateInput && endDateInput) {
            startDateInput.value = this.filters.date_range[0] || '';
            endDateInput.value = this.filters.date_range[1] || '';
        }

        // 更新按钮激活状态（只更新被点击的按钮组）
        const clickedButton = document.querySelector(`button[data-days="${rangeType}"]`);
        const buttonGroup = clickedButton?.closest('.btn-group');
        if (buttonGroup) {
            const buttons = buttonGroup.querySelectorAll('.btn');
            buttons.forEach(btn => btn.classList.remove('is-active'));
            if (clickedButton) {
                clickedButton.classList.add('is-active');
            }
        }

        // 触发查询
        this.handleQuery();
    }

    /**
     * 判断快速日期按钮是否激活
     */
    isQuickDateActive(rangeType) {
        const today = new Date();
        const [startDate, endDate] = this.filters.date_range;
        const todayStr = today.toISOString().split('T')[0];  // 提取到 switch 之前

        switch (rangeType) {
            case 'all':  // 全部：从2025年4月9日到今天
                if (!startDate || !endDate) return false;
                const allStartDate = new Date(2025, 3, 9);  // 2025年4月9日
                const allStartStr = allStartDate.toISOString().split('T')[0];
                return startDate === allStartStr && endDate === todayStr;

            case '7':  // 近7天
            case '30':  // 近30天
            case '90':  // 近90天
                if (!startDate || !endDate) return false;
                const rangeStartDate = new Date(today);
                rangeStartDate.setDate(today.getDate() - parseInt(rangeType, 10));
                const rangeStartStr = rangeStartDate.toISOString().split('T')[0];
                return startDate === rangeStartStr && endDate === todayStr;

            case 'ytd':  // 今年以来
                if (!startDate || !endDate) return false;
                const yearStart = new Date(today.getFullYear(), 0, 1);
                const yearStartStr = yearStart.toISOString().split('T')[0];
                const ytdTodayStr = today.toISOString().split('T')[0];
                return startDate === yearStartStr && endDate === ytdTodayStr;

            default:
                return false;
        }
    }

    /**
     * 判断创作者年度筛选器的快速日期按钮是否激活
     */
    isCreatorAnnualDateActive(rangeType) {
        const today = new Date();
        const [startDate, endDate] = this.creatorAnnualDateRange;

        switch (rangeType) {
            case 30:  // 近30天
                if (!startDate || !endDate) return false;
                const rangeStartDate = new Date(today);
                rangeStartDate.setDate(today.getDate() - 30);
                const rangeStartStr = rangeStartDate.toISOString().split('T')[0];
                const todayStr = today.toISOString().split('T')[0];
                return startDate === rangeStartStr && endDate === todayStr;

            case 'ytd':  // 今年以来
                if (!startDate || !endDate) return false;
                const yearStart = new Date(today.getFullYear(), 0, 1);
                const yearStartStr = yearStart.toISOString().split('T')[0];
                const ytdTodayStr = today.toISOString().split('T')[0];
                return startDate === yearStartStr && endDate === ytdTodayStr;

            default:
                return false;
        }
    }

    /**
     * 判断优秀笔记筛选器的快速日期按钮是否激活
     */
    isTopNotesDateActive(rangeType) {
        const today = new Date();
        const [startDate, endDate] = this.topNotesDateRange;

        switch (rangeType) {
            case 30:  // 近30天
                if (!startDate || !endDate) return false;
                const rangeStartDate = new Date(today);
                rangeStartDate.setDate(today.getDate() - 30);
                const rangeStartStr = rangeStartDate.toISOString().split('T')[0];
                const todayStr = today.toISOString().split('T')[0];
                return startDate === rangeStartStr && endDate === todayStr;

            case 'ytd':  // 今年以来
                if (!startDate || !endDate) return false;
                const yearStart = new Date(today.getFullYear(), 0, 1);
                const yearStartStr = yearStart.toISOString().split('T')[0];
                const ytdTodayStr = today.toISOString().split('T')[0];
                return startDate === yearStartStr && endDate === ytdTodayStr;

            case 'custom':  // 自定义
                // 不匹配快速选项
                const customRangeStart = new Date(today);
                customRangeStart.setDate(today.getDate() - 30);
                const customRangeStartStr = customRangeStart.toISOString().split('T')[0];
                const customYearStartStr = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                return startDate !== customRangeStartStr && startDate !== customYearStartStr;

            default:
                return false;
        }
    }

    /**
     * 更新加载状态UI
     */
    updateLoadingUI() {
        const queryBtn = document.getElementById('operationQueryBtn');
        const resetBtn = document.getElementById('operationResetBtn');

        if (queryBtn) {
            if (this.isLoading) {
                queryBtn.disabled = true;
                queryBtn.innerHTML = '<span class="btn-loading"></span> 查询中...';
            } else {
                queryBtn.disabled = false;
                queryBtn.innerHTML = '查询';
            }
        }

        if (resetBtn) {
            resetBtn.disabled = this.isLoading;
        }
    }

    /**
     * 更新数据（Phase 2优化：局部更新，避免全量重渲染）
     */
    updateData() {
        if (!this.currentData) {
            console.warn('[updateData] 没有数据可更新');
            return;
        }

        console.log('[updateData] 开始更新数据');

        // 更新核心指标卡片（只更新数据卡片的body，不更新筛选器）
        const coreMetricsCard = document.querySelector('#mainContent .card--full-width:nth-child(2) .card__body');
        if (coreMetricsCard) {
            coreMetricsCard.innerHTML = this.renderCoreMetricsSections();
            console.log('[updateData] 核心指标卡片已更新');
        }

        // 更新创作者内容表格
        const contentTbody = document.querySelector('#creatorContentTable tbody');
        if (contentTbody) {
            contentTbody.innerHTML = this.renderCreatorContentRows();
            console.log('[updateData] 创作者内容表格已更新');
        }

        // 更新创作者转化表格
        const conversionTbody = document.querySelector('#creatorConversionTable tbody');
        if (conversionTbody) {
            conversionTbody.innerHTML = this.renderCreatorConversionRows();
            console.log('[updateData] 创作者转化表格已更新');
        }

        // 更新优质笔记表格
        const topNotesTbody = document.querySelector('#topNotesTable tbody');
        if (topNotesTbody) {
            topNotesTbody.innerHTML = this.renderTopNotesRows();
            console.log('[updateData] 优质笔记表格已更新');
        }

        // 更新创作者年度表格
        const annualTbody = document.querySelector('#creatorAnnualTable tbody');
        if (annualTbody) {
            annualTbody.innerHTML = this.renderCreatorAnnualRows();
            console.log('[updateData] 创作者年度表格已更新');
        }

        // 更新代理商表格
        const agencyTbody = document.querySelector('#agencyTable tbody');
        if (agencyTbody) {
            agencyTbody.innerHTML = this.renderAgencyRows();
            console.log('[updateData] 代理商表格已更新');
        }

        // 更新员工转化表格
        const employeeTbody = document.querySelector('#employeeConversionTable tbody');
        if (employeeTbody) {
            employeeTbody.innerHTML = this.renderEmployeeConversionRows();
            console.log('[updateData] 员工转化表格已更新');
        }

        // 更新图表（图表需要重新渲染）
        setTimeout(() => {
            this.renderCharts();
            console.log('[updateData] 图表已更新');
        }, 100);

        console.log('[updateData] 数据更新完成');
    }

    /**
     * 渲染报表（Phase 2优化：只创建一次DOM结构）
     */
    render() {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error('找不到主内容容器');
            return;
        }

        // Phase 2: 检查是否已经渲染过本报表的特定元素
        // 检查更具体的内容区域，而不是通用的筛选器
        if (mainContent.querySelector('#conversionTrendChart') &&
            mainContent.querySelector('#employeeWeeklyRateChart')) {
            console.log('[render] 报表内容已存在，只更新数据');
            // DOM结构已存在，只需要更新数据
            this.updateData();
            return;
        }

        console.log('[render] 首次渲染，创建DOM结构');

        // 注入自定义样式
        if (!document.getElementById('xhs-operation-custom-styles')) {
            const style = document.createElement('style');
            style.id = 'xhs-operation-custom-styles';
            style.textContent = `
                /* 转化运营数据卡片布局 */
                .conversion-charts-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-bottom: 24px;
                }

                .conversion-chart-item {
                    min-height: 350px;
                }

                .conversion-chart-item .chart-container {
                    height: 300px;
                }

                .conversion-table-section {
                    margin-top: 24px;
                }

                .conversion-table-section .section-title {
                    margin-bottom: 16px;
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a1a1a;
                }

                /* 表格样式优化 */
                .table-rank {
                    font-weight: 600;
                    color: #6366f1;
                    text-align: center;
                }

                /* 响应式调整 */
                @media (max-width: 1200px) {
                    .conversion-charts-row {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        const reportHTML = `
            <!-- 筛选器卡片 -->
            <div class="card card--filter card--full-width">
                <div class="card__header">
                    <h3 class="card__title">小红书运营分析</h3>
                    <div class="card__actions">
                        <button class="btn btn--secondary btn--sm" id="operationResetBtn">重置</button>
                        <button class="btn btn--primary btn--sm" id="operationQueryBtn" ${this.isLoading ? 'disabled' : ''}>
                            ${this.isLoading ? '查询中...' : '查询'}
                        </button>
                    </div>
                </div>
                <div class="card__body">
                    <div style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: var(--space-md);
                        align-items: flex-end;
                    ">
                        <!-- 日期范围 - 与其他报表保持一致 -->
                        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 480px;">
                            <label class="form-label">日期范围</label>
                            <div style="
                                display: flex;
                                gap: 12px;
                                align-items: center;
                                white-space: nowrap;
                            ">
                                <!-- 日期输入 -->
                                <div style="display: inline-flex; gap: var(--space-sm); align-items: center;">
                                    <input type="date" id="operationStartDate" class="form-control" value="${this.filters.date_range[0]}" style="height: 32px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="operationEndDate" class="form-control" value="${this.filters.date_range[1]}" style="height: 32px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" style="display: inline-flex;">
                                    <button class="btn ${this.isQuickDateActive('all') ? 'is-active' : ''}" data-days="all" style="height: 32px; white-space: nowrap;">全部</button>
                                    <button class="btn ${this.isQuickDateActive(7) ? 'is-active' : ''}" data-days="7" style="height: 32px; white-space: nowrap;">近7天</button>
                                    <button class="btn ${this.isQuickDateActive(30) ? 'is-active' : ''}" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn ${this.isQuickDateActive(90) ? 'is-active' : ''}" data-days="90" style="height: 32px; white-space: nowrap;">近90天</button>
                                    <button class="btn ${this.isQuickDateActive('ytd') ? 'is-active' : ''}" data-days="ytd" style="height: 32px; white-space: nowrap;">今年以来</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 模块1: 核心运营数据 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">核心运营数据</h3>
                </div>
                <div class="card__body">
                    ${this.renderCoreMetricsSections()}
                </div>
            </div>

            <!-- 模块2: 创作者维度数据 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">创作者维度数据</h3>
                </div>
                <div class="card__body">
                    <div class="creator-layout">
                        <div class="creator-section">
                            <h4 class="section-title">内容数据</h4>
                            <div class="table-container">
                                <table class="data-table" id="creatorContentTable">
                                    <thead>
                                        <tr>
                                            <th>创作者</th>
                                            <th class="text-right sort-asc" onclick="window.app.currentReportInstance.sortCreatorContent('note_count')">笔记数 ↑</th>
                                            <th class="text-right">曝光量</th>
                                            <th class="text-right">点击率</th>
                                            <th class="text-right">互动率</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.renderCreatorContentRows()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="creator-section">
                            <h4 class="section-title">业务转化数据</h4>
                            <div class="table-container">
                                <table class="data-table" id="creatorConversionTable">
                                    <thead>
                                        <tr>
                                            <th>创作者</th>
                                            <th class="text-right">私信数</th>
                                            <th class="text-right">加微数</th>
                                            <th class="text-right sort-asc" onclick="window.app.currentReportInstance.sortCreatorConversion('opened_account_users')">开户数 ↑</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.renderCreatorConversionRows()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 模块3: 内容运营数据 -->
            <div class="card card--chart card--full-width">
                <div class="card__header">
                    <h3 class="card__title">内容运营数据</h3>
                </div>
                <div class="card__body">
                    <div class="chart-grid">
                        <div>
                            <h4 class="section-title">创作量趋势</h4>
                            <div id="creationVolumeChart" class="chart-container"></div>
                        </div>
                        <div>
                            <h4 class="section-title">互动量趋势</h4>
                            <div id="interactionTrendChart" class="chart-container"></div>
                        </div>
                    </div>
                    <div class="chart-grid" style="margin-top: var(--spacing-lg);">
                        <div>
                            <h4 class="section-title">笔记创作量</h4>
                            <div id="creatorCreationChart" class="chart-container"></div>
                        </div>
                        <div>
                            <h4 class="section-title">笔记互动量</h4>
                            <div id="creatorInteractionChart" class="chart-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 模块4: 优秀笔记排行榜 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">优秀笔记排行榜</h3>
                    <!-- 独立时间筛选器 -->
                    <div class="card__actions">
                        <div class="form-group" style="margin-bottom: 0;">
                            <!-- Date inputs and buttons as one integrated unit -->
                            <div style="display: flex; gap: 12px; align-items: center; white-space: nowrap;">
                                <!-- Date inputs -->
                                <div style="display: inline-flex; gap: 8px; align-items: center;">
                                    <input type="date" id="topNotesStartDate" class="form-control" value="${this.topNotesDateRange[0]}" style="height: 32px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="topNotesEndDate" class="form-control" value="${this.topNotesDateRange[1]}" style="height: 32px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" style="display: inline-flex;">
                                    <button class="btn ${this.isTopNotesDateActive(30) ? 'is-active' : ''}" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn ${this.isTopNotesDateActive('ytd') ? 'is-active' : ''}" data-days="ytd" style="height: 32px; white-space: nowrap;">今年以来</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card__body">
                    <div class="table-container">
                        <table class="data-table" id="topNotesTable">
                            <thead>
                                <tr>
                                    <th style="width: 50px; text-align: center;">排名</th>
                                    <th style="width: 90px;">笔记ID</th>
                                    <th style="min-width: 150px; max-width: 250px;">笔记名称</th>
                                    <th style="width: 90px; text-align: center;">发布日期</th>
                                    <th style="width: 120px; text-align: center;">创作者</th>
                                    <th style="width: 90px; text-align: center;">广告策略</th>
                                    <th style="width: 90px; text-align: right;">消耗金额</th>
                                    <th style="width: 90px; text-align: right;">展现量</th>
                                    <th style="width: 80px; text-align: right;">点击量</th>
                                    <th style="width: 90px; text-align: right;">私信进线</th>
                                    <th style="width: 80px; text-align: right;">企微数</th>
                                    <th style="width: 80px; text-align: right;">开户数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderTopNotesRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 模块5: 创作者年度排行榜 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">创作者年度排行榜</h3>
                    <div class="card__actions">
                        <div class="form-group" style="margin-bottom: 0;">
                            <div style="display: flex; gap: 12px; align-items: center; white-space: nowrap;">
                                <!-- 日期输入 -->
                                <div style="display: inline-flex; gap: 8px; align-items: center;">
                                    <input type="date" id="creatorAnnualStartDate" class="form-control" value="${this.creatorAnnualDateRange[0]}" style="height: 32px;">
                                    <span class="text-tertiary">→</span>
                                    <input type="date" id="creatorAnnualEndDate" class="form-control" value="${this.creatorAnnualDateRange[1]}" style="height: 32px;">
                                </div>
                                <!-- 快速选择按钮 -->
                                <div class="btn-group" style="display: inline-flex;">
                                    <button class="btn ${this.isCreatorAnnualDateActive(30) ? 'is-active' : ''}" data-days="30" style="height: 32px; white-space: nowrap;">近30天</button>
                                    <button class="btn ${this.isCreatorAnnualDateActive('ytd') ? 'is-active' : ''}" data-days="ytd" style="height: 32px; white-space: nowrap;">今年以来</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card__body">
                    <div class="table-container">
                        <table class="data-table" id="creatorAnnualTable">
                            <thead>
                                <tr>
                                    <th style="width: 60px; text-align: center;">排名</th>
                                    <th style="width: 150px;">创作者</th>
                                    <th style="width: 100px; text-align: right;">消耗金额</th>
                                    <th style="width: 100px; text-align: right;">笔记发布量</th>
                                    <th style="width: 100px; text-align: right;">展现量</th>
                                    <th style="width: 100px; text-align: right;">点击量</th>
                                    <th style="width: 100px; text-align: right;">私信进线量</th>
                                    <th style="width: 100px; text-align: right;">加微量</th>
                                    <th style="width: 100px; text-align: right;">开户量</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderCreatorAnnualRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 模块6: 代理商数据 -->
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">代理商数据</h3>
                    <div class="card__actions">
                        <span class="stat-label" style="font-size: 13px; color: var(--text-tertiary);">
                            仅展示小红书平台代理商投放数据
                        </span>
                    </div>
                </div>
                <div class="card__body">
                    <div class="table-container">
                        <table class="data-table" id="agencyTable">
                            <thead>
                                <tr>
                                    <th>代理商</th>
                                    <th class="text-right">总花费</th>
                                    <th class="text-right">曝光量</th>
                                    <th class="text-right">点击量</th>
                                    <th class="text-right">企微数</th>
                                    <th class="text-right">潜客数</th>
                                    <th class="text-right">客户开口数</th>
                                    <th class="text-right">有效线索数</th>
                                    <th class="text-right">开户数</th>
                                    <th class="text-right">有效户数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderAgencyRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 模块7: 转化运营数据 -->
            <div class="card card--chart card--full-width">
                <div class="card__header">
                    <h3 class="card__title">转化运营数据</h3>
                    <div class="card__actions">
                        <span class="stat-label" style="font-size: 12px; color: var(--text-tertiary);">
                            数据来源: backend_conversions (小红书平台)
                        </span>
                    </div>
                </div>
                <div class="card__body">
                    <!-- 上方：两个图表并排 -->
                    <div class="conversion-charts-row">
                        <!-- 左图：整体转化走势图 -->
                        <div class="conversion-chart-item">
                            <h4 class="section-title">整体转化走势（周度）</h4>
                            <div id="conversionTrendChart" class="chart-container"></div>
                        </div>
                        <!-- 右图：小助手开户转化率走势（周度）-->
                        <div class="conversion-chart-item">
                            <h4 class="section-title">小助手开户转化率走势（周度）</h4>
                            <div id="employeeWeeklyRateChart" class="chart-container"></div>
                        </div>
                    </div>

                    <!-- 下方：员工转化量排行榜 -->
                    <div class="conversion-table-section">
                        <h4 class="section-title">员工转化量排行榜</h4>
                        <div class="table-container">
                            <table class="data-table" id="employeeConversionTable">
                                <thead>
                                    <tr>
                                        <th style="width: 60px; text-align: center;">排名</th>
                                        <th style="width: 120px;">转化人员</th>
                                        <th style="width: 90px; text-align: right;">企微数</th>
                                        <th style="width: 100px; text-align: right;">有效线索数</th>
                                        <th style="width: 100px; text-align: right;">新开客户数</th>
                                        <th style="width: 90px; text-align: right;">有效户数</th>
                                        <th style="width: 90px; text-align: right;">开户率</th>
                                        <th style="width: 90px; text-align: right;">有效户率</th>
                                        <th style="width: 100px; text-align: right;">资产（元）</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderEmployeeConversionRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        mainContent.innerHTML = reportHTML;

        // 渲染图表
        setTimeout(() => {
            this.renderCharts();
        }, 100);
    }

    /**
     * 解绑事件（Phase 1: 修复事件监听器泄漏）
     * 在 bindEvents() 之前调用，防止重复绑定
     */
    unbindEvents() {
        // 使用 EventManager 清理所有事件监听器
        if (this.eventManager) {
            this.eventManager.off();
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // Phase 1: 先解绑之前的事件，防止重复绑定
        this.unbindEvents();

        const queryBtn = document.getElementById('operationQueryBtn');
        const resetBtn = document.getElementById('operationResetBtn');

        if (queryBtn) {
            this.eventManager.on(queryBtn, 'click', () => this.handleQuery());
        }

        if (resetBtn) {
            this.eventManager.on(resetBtn, 'click', () => this.handleReset());
        }

        // 绑定主筛选器的日期快速选择按钮（只选择主筛选器区域的按钮）
        const mainDateButtons = document.querySelectorAll('#mainContent > .card:first-child .btn-group button[data-days]');
        mainDateButtons.forEach(button => {
            this.eventManager.on(button, 'click', (e) => {
                e.preventDefault();
                const days = button.getAttribute('data-days');
                this.handleQuickDateSelect(days);
            });
        });

        // 绑定优秀笔记排行榜独立时间筛选器事件
        this.bindTopNotesDateSelectorEvents();

        // 绑定创作者年度排行榜独立时间筛选器事件
        this.bindCreatorAnnualDateSelectorEvents();
    }

    /**
     * 渲染核心指标四行布局
     */
    renderCoreMetricsSections() {
        const metrics = this.currentData?.core_metrics || {};

        return `
            <!-- 第一行：基础指标（新增笔记数、投放笔记数、投放金额） -->
            <div style="
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
                padding-bottom: 16px;
                border-bottom: 1px solid #E8E9EB;
            ">
                ${this.renderCompactMetricCard(
                    '新增笔记数',
                    this.formatNumber(metrics.new_notes_count || 0),
                    '篇',
                    '#6366F1'
                )}
                ${this.renderCompactMetricCard(
                    '投放笔记数',
                    this.formatNumber(metrics.ad_notes_count || 0),
                    '篇',
                    '#8B5CF6'
                )}
                ${this.renderCompactMetricCard(
                    '投放金额',
                    this.formatCurrency(metrics.total_cost || 0),
                    '元',
                    '#F59E0B'
                )}
            </div>

            <!-- 第二行：转化漏斗核心数据（曝光→点击→私信进线→加企微→开户） -->
            <div style="margin-bottom: 16px;">
                <div style="
                    font-size: 12px;
                    font-weight: 600;
                    color: #5A5C66;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <span style="width: 3px; height: 14px; background: #1890FF; border-radius: 2px;"></span>
                    业务转化漏斗
                </div>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 10px;
                ">
                    ${this.renderFunnelMetric(
                        '曝光量',
                        this.formatNumber(metrics.total_impressions || 0),
                        '#E8F4FF',
                        '#1890FF',
                        1
                    )}
                    ${this.renderFunnelMetric(
                        '点击量',
                        this.formatNumber(metrics.total_clicks || 0),
                        '#FFF7E6',
                        '#FA8C16',
                        2
                    )}
                    ${this.renderFunnelMetric(
                        '私信进线',
                        this.formatNumber(metrics.total_private_messages || 0),
                        '#FFF0F6',
                        '#C41D7F',
                        3
                    )}
                    ${this.renderFunnelMetric(
                        '加企微',
                        this.formatNumber(metrics.total_lead_users || 0),
                        '#F6FFED',
                        '#52C41A',
                        4
                    )}
                    ${this.renderFunnelMetric(
                        '开户数',
                        this.formatNumber(metrics.total_opened_accounts || 0),
                        '#F9F0FF',
                        '#722ED1',
                        5
                    )}
                </div>
            </div>

            <!-- 第三行：核心转化率指标（与第二行关联） -->
            <div style="margin-bottom: 16px;">
                <div style="
                    font-size: 12px;
                    font-weight: 600;
                    color: #5A5C66;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <span style="width: 3px; height: 14px; background: #52C41A; border-radius: 2px;"></span>
                    转化率指标
                </div>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                ">
                    ${this.renderRateCompactCard(
                        '曝光点击率',
                        metrics.impression_click_rate || 0,
                        '%',
                        '曝光 → 点击'
                    )}
                    ${this.renderRateCompactCard(
                        '点击进线率',
                        metrics.click_lead_rate || 0,
                        '%',
                        '点击 → 私信'
                    )}
                    ${this.renderRateCompactCard(
                        '进线加微率',
                        metrics.lead_to_wechat_rate || 0,
                        '%',
                        '私信 → 加微'
                    )}
                    ${this.renderRateCompactCard(
                        '线索开户率',
                        metrics.wechat_to_account_rate || 0,
                        '%',
                        '加微 → 开户'
                    )}
                </div>
            </div>

            <!-- 第四行：单价卡片 -->
            <div>
                <div style="
                    font-size: 12px;
                    font-weight: 600;
                    color: #5A5C66;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <span style="width: 3px; height: 14px; background: #F59E0B; border-radius: 2px;"></span>
                    成本效率指标
                </div>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                ">
                    ${this.renderCostCard(
                        '千次曝光成本',
                        metrics.cost_per_mille || 0,
                        '元/千次'
                    )}
                    ${this.renderCostCard(
                        '点击成本',
                        metrics.cost_per_click || 0,
                        '元/次'
                    )}
                    ${this.renderCostCard(
                        '单企微成本',
                        metrics.cost_per_lead_user || 0,
                        '元/人'
                    )}
                    ${this.renderCostCard(
                        '单开户成本',
                        metrics.cost_per_opened_account || 0,
                        '元/户'
                    )}
                </div>
            </div>
        `;
    }

    /**
     * 渲染紧凑型指标卡片（第一行用）
     */
    renderCompactMetricCard(title, value, unit, color) {
        return `
            <div style="
                background: ${color}15;
                border-left: 3px solid ${color};
                padding: 14px 16px;
                border-radius: 6px;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${color}30'"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                <div style="
                    font-size: 11px;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #171A23;
                    line-height: 1.2;
                ">
                    ${value}
                </div>
                <div style="
                    font-size: 11px;
                    color: #8A8D99;
                    margin-top: 2px;
                ">
                    ${unit}
                </div>
            </div>
        `;
    }

    /**
     * 渲染漏斗指标卡片（第二行用）
     */
    renderFunnelMetric(title, value, bgColor, color, step) {
        return `
            <div style="
                background: ${bgColor};
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                position: relative;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px ${color}40'"
               onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                <div style="
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    width: 18px;
                    height: 18px;
                    background: ${color};
                    color: white;
                    border-radius: 50%;
                    font-size: 11px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    ${step}
                </div>
                <div style="
                    font-size: 10px;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                ">
                    ${title}
                </div>
                <div style="
                    font-size: 20px;
                    font-weight: 700;
                    color: #171A23;
                    line-height: 1.2;
                    word-break: break-all;
                ">
                    ${value}
                </div>
            </div>
        `;
    }

    /**
     * 渲染转化率卡片（第三行用）
     */
    renderRateCompactCard(title, value, unit, subtitle) {
        // 根据数值大小动态设置颜色
        let color = '#171A23';
        if (value >= 10) {
            color = '#52C41A';  // 绿色 - 优秀
        } else if (value >= 5) {
            color = '#1890FF';  // 蓝色 - 良好
        } else if (value >= 2) {
            color = '#FA8C16';  // 橙色 - 一般
        } else if (value > 0) {
            color = '#F5222D';  // 红色 - 较低
        }

        return `
            <div style="
                background: white;
                border: 1px solid #E8E9EB;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                transition: all 0.2s ease;
            " onmouseover="this.style.borderColor='${color}'; this.style.boxShadow='0 2px 8px ${color}30'"
               onmouseout="this.style.borderColor='#E8E9EB'; this.style.boxShadow='none'">
                <div style="
                    font-size: 10px;
                    color: #8A8D99;
                    margin-bottom: 4px;
                ">
                    ${subtitle}
                </div>
                <div style="
                    font-size: 11px;
                    color: #5A5C66;
                    font-weight: 600;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div style="
                    font-size: 22px;
                    font-weight: 700;
                    color: ${color};
                    line-height: 1.2;
                ">
                    ${value}
                    <span style="font-size: 12px; font-weight: 500; margin-left: 2px;">${unit}</span>
                </div>
            </div>
        `;
    }

    /**
     * 渲染成本卡片（第四行用）
     */
    renderCostCard(title, value, unit) {
        // 根据成本大小动态设置颜色
        let color = '#52C41A';
        let bgColor = '#F6FFED';

        if (value >= 1000) {
            color = '#F5222D';  // 红色 - 成本高
            bgColor = '#FFF1F0';
        } else if (value >= 500) {
            color = '#FA8C16';  // 橙色 - 成本中等偏高
            bgColor = '#FFF7E6';
        } else if (value >= 100) {
            color = '#1890FF';  // 蓝色 - 成本中等
            bgColor = '#E8F4FF';
        }

        return `
            <div style="
                background: ${bgColor};
                border-left: 3px solid ${color};
                border-radius: 6px;
                padding: 12px;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px ${color}30'"
               onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none'">
                <div style="
                    font-size: 11px;
                    color: ${color};
                    font-weight: 600;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div style="
                    font-size: 22px;
                    font-weight: 700;
                    color: #171A23;
                    line-height: 1.2;
                ">
                    ${value}
                    <span style="font-size: 12px; font-weight: 500; margin-left: 4px; color: #8A8D99;">${unit}</span>
                </div>
            </div>
        `;
    }

    /**
     * 渲染创作者内容数据行
     * 按笔记数倒序排序
     */
    renderCreatorContentRows() {
        const data = this.currentData?.creator_content_data || [];
        if (data.length === 0) {
            return '<tr><td colspan="5" class="table-empty">暂无数据</td></tr>';
        }

        // 按笔记数倒序排序
        const sortedData = [...data].sort((a, b) => (b.note_count || 0) - (a.note_count || 0));

        return sortedData.map((item, index) => `
            <tr>
                <td>${item.producer}</td>
                <td class="text-right">${this.formatNumber(item.note_count || 0)}</td>
                <td class="text-right">${this.formatNumber(item.total_impressions || 0)}</td>
                <td class="text-right">${(item.avg_click_rate || 0).toFixed(2)}%</td>
                <td class="text-right">${(item.avg_interaction_rate || 0).toFixed(2)}%</td>
            </tr>
        `).join('');
    }

    /**
     * 排序创作者内容数据
     */
    sortCreatorContent(field) {
        if (!this.currentData?.creator_content_data) return;

        const sorted = [...this.currentData.creator_content_data].sort((a, b) => {
            return (b[field] || 0) - (a[field] || 0);
        });

        this.currentData.creator_content_data = sorted;
        // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
        this.updateData();
    }

    /**
     * 渲染创作者转化数据行
     * 字段改为：私信数、加微数、开户数
     * 按开户数倒序排序
     */
    renderCreatorConversionRows() {
        const data = this.currentData?.creator_conversion_data || [];
        if (data.length === 0) {
            return '<tr><td colspan="4" class="table-empty">暂无数据</td></tr>';
        }

        // 按开户数倒序排序
        const sortedData = [...data].sort((a, b) => (b.opened_account_users || 0) - (a.opened_account_users || 0));

        return sortedData.map((item, index) => `
            <tr>
                <td>${item.producer}</td>
                <td class="text-right">${this.formatNumber(item.private_messages || 0)}</td>
                <td class="text-right">${this.formatNumber(item.lead_users || 0)}</td>
                <td class="text-right">${this.formatNumber(item.opened_account_users || 0)}</td>
            </tr>
        `).join('');
    }

    /**
     * 排序创作者转化数据
     */
    sortCreatorConversion(field) {
        if (!this.currentData?.creator_conversion_data) return;

        const sorted = [...this.currentData.creator_conversion_data].sort((a, b) => {
            return (b[field] || 0) - (a[field] || 0);
        });

        this.currentData.creator_conversion_data = sorted;
        // Phase 2: 使用 updateData() 而不是 render()，避免全量重渲染
        this.updateData();
    }

    /**
     * 渲染优秀笔记行
     */
    renderTopNotesRows() {
        const data = this.currentData?.top_notes || [];
        if (data.length === 0) {
            return '<tr><td colspan="12" class="table-empty">暂无数据</td></tr>';
        }

        return data.map((item, index) => {
            const rankClass = index < 3 ? 'table-rank-top' : '';

            // 笔记标题：如果有URL则显示为可点击链接，否则显示纯文本
            let titleDisplay;
            if (item.note_url) {
                titleDisplay = `<a href="${item.note_url}" target="_blank"
                    class="table-link-title"
                    title="${item.note_title}"
                    style="color: var(--primary-color); text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${item.note_title}
                </a>`;
            } else {
                titleDisplay = `<span title="${item.note_title}" style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.note_title}</span>`;
            }

            return `
            <tr class="${rankClass}">
                <td class="table-rank ${index < 3 ? 'table-rank--top' : ''}" style="text-align: center;">${index + 1}</td>
                <td style="white-space: nowrap;">${item.note_id}</td>
                <td>${titleDisplay}</td>
                <td style="white-space: nowrap; text-align: center;">${item.note_publish_time || '-'}</td>
                <td style="white-space: nowrap; text-align: center;">${item.producer || '-'}</td>
                <td style="white-space: nowrap; text-align: center;">${item.ad_strategy || '-'}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatCurrency(item.total_cost)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_impressions)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_clicks)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_private_messages)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.lead_users)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.opened_account_users)}</td>
            </tr>
        `}).join('');
    }

    /**
     * 渲染创作者年度排行行
     */
    renderCreatorAnnualRows() {
        const data = this.currentData?.creator_annual_ranking || [];
        if (data.length === 0) {
            return '<tr><td colspan="9" class="table-empty">暂无数据</td></tr>';
        }

        return data.map((item, index) => `
            <tr>
                <td class="table-rank ${index < 3 ? 'table-rank--top' : ''}" style="text-align: center;">${index + 1}</td>
                <td style="white-space: nowrap;">${item.producer || '-'}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatCurrency(item.total_cost)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.note_count || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_impressions || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_clicks || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.total_private_messages || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.lead_users || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.opened_account_users || 0)}</td>
            </tr>
        `).join('');
    }

    /**
     * 渲染代理商数据行
     */
    renderAgencyRows() {
        const data = this.currentData?.agency_data || [];
        if (data.length === 0) {
            return '<tr><td colspan="10" class="table-empty">暂无数据</td></tr>';
        }

        return data.map((item, index) => `
            <tr>
                <td>${item.agency}</td>
                <td class="text-right">${this.formatCurrency(item.total_cost)}</td>
                <td class="text-right">${this.formatNumber(item.total_impressions)}</td>
                <td class="text-right">${this.formatNumber(item.total_clicks)}</td>
                <td class="text-right">${this.formatNumber(item.lead_users)}</td>
                <td class="text-right">${this.formatNumber(item.potential_customers)}</td>
                <td class="text-right">${this.formatNumber(item.customer_mouth_users)}</td>
                <td class="text-right">${this.formatNumber(item.valid_lead_users)}</td>
                <td class="text-right">${this.formatNumber(item.opened_account_users)}</td>
                <td class="text-right">${this.formatNumber(item.valid_customer_users)}</td>
            </tr>
        `).join('');
    }

    /**
     * 渲染笔记转化排行行
     */
    renderNoteConversionRows() {
        const data = this.currentData?.note_conversion_ranking || [];
        if (data.length === 0) {
            return '<tr><td colspan="6" class="table-empty">暂无数据</td></tr>';
        }

        return data.map((item, index) => `
            <tr>
                <td class="table-rank ${index < 3 ? 'table-rank--top' : ''}">${index + 1}</td>
                <td>${item.note_id}</td>
                <td class="table-cell-truncate">${item.note_title}</td>
                <td>${item.producer}</td>
                <td class="text-right">${item.lead_users}</td>
                <td class="text-right">${this.formatNumber(item.impressions)}</td>
            </tr>
        `).join('');
    }

    /**
     * 渲染图表
     */
    renderCharts() {
        this.renderCreationVolumeChart();
        this.renderInteractionTrendChart();
        this.renderCreatorCreationChart();
        this.renderCreatorInteractionChart();
        this.renderConversionTrendChart();
        this.renderEmployeeWeeklyRateChart();
    }

    /**
     * 渲染创作量趋势图
     */
    renderCreationVolumeChart() {
        const container = document.getElementById('creationVolumeChart');
        if (!container) return;

        const chartData = this.currentData?.creation_trend;
        if (!chartData) return;

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            xAxis: {
                type: 'category',
                data: chartData.dates,
                axisLabel: { rotate: 45 }
            },
            yAxis: {
                type: 'value',
                name: '笔记数'
            },
            series: [{
                name: '笔记数',
                type: 'bar',
                data: chartData.note_counts,
                itemStyle: { color: '#1890ff' }
            }]
        };

        chart.setOption(option);
        this.charts.creationVolume = chart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染互动量趋势图
     * 使用主副坐标轴：曝光量（左轴）和互动量（右轴）
     */
    renderInteractionTrendChart() {
        const container = document.getElementById('interactionTrendChart');
        if (!container) return;

        const chartData = this.currentData?.creation_trend;
        if (!chartData) return;

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            xAxis: {
                type: 'category',
                data: chartData.dates,
                axisLabel: { rotate: 45 }
            },
            yAxis: [
                {
                    type: 'value',
                    name: '曝光量',
                    position: 'left',
                    axisLabel: {
                        formatter: function(value) {
                            if (value >= 10000) {
                                return (value / 10000).toFixed(1) + '万';
                            }
                            return value;
                        }
                    }
                },
                {
                    type: 'value',
                    name: '互动量',
                    position: 'right',
                    axisLabel: {
                        formatter: function(value) {
                            if (value >= 10000) {
                                return (value / 10000).toFixed(1) + '万';
                            }
                            return value;
                        }
                    }
                }
            ],
            series: [
                {
                    name: '曝光量',
                    type: 'line',
                    yAxisIndex: 0,  // 使用左轴
                    data: chartData.impression_series,
                    smooth: true,
                    itemStyle: { color: '#52c41a' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
                                { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
                            ]
                        }
                    }
                },
                {
                    name: '互动量',
                    type: 'line',
                    yAxisIndex: 1,  // 使用右轴
                    data: chartData.interaction_series,
                    smooth: true,
                    itemStyle: { color: '#faad14' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(250, 173, 20, 0.3)' },
                                { offset: 1, color: 'rgba(250, 173, 20, 0.05)' }
                            ]
                        }
                    }
                }
            ]
        };

        chart.setOption(option);
        this.charts.interactionTrend = chart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染笔记创作量图（按创作者）
     * 横向柱状图，双Y轴：笔记发布量（主轴）和笔记曝光量（副轴）
     */
    renderCreatorCreationChart() {
        const container = document.getElementById('creatorCreationChart');
        if (!container) return;

        const chartData = this.currentData?.creator_creation_data;
        if (!chartData || chartData.length === 0) return;

        // 按笔记数降序排序，取前10名
        const sortedData = [...chartData]
            .sort((a, b) => (b.note_count || 0) - (a.note_count || 0))
            .slice(0, 10);

        // 反转数组，使数据大的在上方
        sortedData.reverse();

        const creators = sortedData.map(d => d.producer || '未知');
        const noteCounts = sortedData.map(d => d.note_count || 0);
        const impressions = sortedData.map(d => d.impressions || 0);

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const idx = params[0].dataIndex;
                    const creator = creators[idx];
                    let result = `${creator}<br/>`;
                    params.forEach(p => {
                        const value = p.value;
                        if (p.seriesName === '笔记发布量') {
                            result += `${p.marker} ${p.seriesName}: ${value} 篇<br/>`;
                        } else {
                            result += `${p.marker} ${p.seriesName}: ${this.formatNumber(value)}<br/>`;
                        }
                    });
                    return result;
                }
            },
            grid: {
                left: '3%',
                right: '3%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: [
                {
                    type: 'value',
                    name: '笔记发布量',
                    position: 'top',
                    axisLabel: {
                        formatter: '{value} 篇'
                    }
                },
                {
                    type: 'value',
                    name: '笔记曝光量',
                    position: 'bottom',
                    axisLabel: {
                        formatter: (value) => {
                            if (value >= 10000) {
                                return (value / 10000).toFixed(1) + '万';
                            }
                            return value;
                        }
                    }
                }
            ],
            yAxis: {
                type: 'category',
                data: creators,
                axisLabel: {
                    width: 100,
                    overflow: 'truncate'
                }
            },
            series: [
                {
                    name: '笔记发布量',
                    type: 'bar',
                    data: noteCounts,
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    itemStyle: {
                        color: '#1890ff'
                    }
                },
                {
                    name: '笔记曝光量',
                    type: 'bar',
                    data: impressions,
                    xAxisIndex: 1,
                    yAxisIndex: 0,
                    itemStyle: {
                        color: '#52c41a'
                    }
                }
            ]
        };

        chart.setOption(option);
        this.charts.creatorCreation = chart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染笔记互动量图（按创作者）
     * 纵向堆积柱状图，Y轴为创作者，X轴为点赞、收藏、评论、分享的堆积值
     */
    renderCreatorInteractionChart() {
        const container = document.getElementById('creatorInteractionChart');
        if (!container) return;

        const chartData = this.currentData?.creator_interaction_data;
        if (!chartData || chartData.length === 0) return;

        // 按总互动量降序排序，取前10名
        const sortedData = [...chartData]
            .sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0))
            .slice(0, 10);

        // 反转数组，使数据大的在上方
        sortedData.reverse();

        const creators = sortedData.map(d => d.producer || '未知');
        const likes = sortedData.map(d => d.likes || 0);
        const favorites = sortedData.map(d => d.favorites || 0);
        const comments = sortedData.map(d => d.comments || 0);
        const shares = sortedData.map(d => d.shares || 0);

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const idx = params[0].dataIndex;
                    const creator = creators[idx];
                    let result = `${creator}<br/>`;
                    params.forEach(p => {
                        const value = p.value;
                        result += `${p.marker} ${p.seriesName}: ${this.formatNumber(value)}<br/>`;
                    });
                    const total = sortedData[idx].total_interactions || 0;
                    result += `总互动量: ${this.formatNumber(total)}`;
                    return result;
                }
            },
            legend: {
                data: ['点赞', '收藏', '评论', '分享'],
                bottom: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                name: '互动量',
                axisLabel: {
                    formatter: (value) => {
                        if (value >= 10000) {
                            return (value / 10000).toFixed(1) + '万';
                        }
                        return value;
                    }
                }
            },
            yAxis: {
                type: 'category',
                data: creators,
                axisLabel: {
                    width: 100,
                    overflow: 'truncate'
                }
            },
            series: [
                {
                    name: '点赞',
                    type: 'bar',
                    stack: 'interaction',
                    data: likes,
                    itemStyle: { color: '#ff4d4f' }
                },
                {
                    name: '收藏',
                    type: 'bar',
                    stack: 'interaction',
                    data: favorites,
                    itemStyle: { color: '#faad14' }
                },
                {
                    name: '评论',
                    type: 'bar',
                    stack: 'interaction',
                    data: comments,
                    itemStyle: { color: '#1890ff' }
                },
                {
                    name: '分享',
                    type: 'bar',
                    stack: 'interaction',
                    data: shares,
                    itemStyle: { color: '#52c41a' }
                }
            ]
        };

        chart.setOption(option);
        this.charts.creatorInteraction = chart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染整体转化趋势图 - 周度聚合柱状图
     * 横坐标：周度格式（YYYY-第X周）
     * 纵坐标：个数
     * 指标：加微数、开口客户数、有效线索数、开户数
     */
    renderConversionTrendChart() {
        const container = document.getElementById('conversionTrendChart');
        if (!container) return;

        const chartData = this.currentData?.conversion_trend;
        console.log('[ConversionTrend] chartData:', chartData);

        // 后端已聚合为周度数据，直接使用
        if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
            console.warn('[ConversionTrend] No data available');
            // 显示空状态
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                    <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <p style="margin: 0; font-size: 14px;">暂无数据</p>
                </div>
            `;
            return;
        }

        // 后端数据已经是周度聚合，转换为前端需要的格式
        const weeklyData = {
            weeks: chartData.weeks.map(w => {
                // 将 "2025-03" 转换为 "2025-第3周"
                const [year, week] = w.split('-');
                return `${year}-第${week}周`;
            }),
            dateRanges: chartData.dateRanges.map(dr => {
                // 将 "0106-0112" 转换为 {start: "01-06", end: "01-12"}
                const [start, end] = dr.split('-');
                return {
                    start: `${start.substring(0, 2)}-${start.substring(2)}`,
                    end: `${end.substring(0, 2)}-${end.substring(2)}`
                };
            }),
            lead_users: chartData.lead_users,
            customer_mouth_users: chartData.customer_mouth_users,
            valid_lead_users: chartData.valid_lead_users,
            opened_account_users: chartData.opened_account_users
        };
        console.log('[ConversionTrend] weeklyData:', weeklyData);

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);
        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const idx = params[0].dataIndex;
                    const week = weeklyData.weeks[idx];
                    const dateRange = weeklyData.dateRanges[idx];
                    let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                    result += `<div style="font-size: 11px; color: #8a8d99; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e8e9eb;">
                        <span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #6366f1; margin-right: 6px;"></span>
                        ${dateRange.start} ~ ${dateRange.end}
                    </div>`;
                    params.forEach(p => {
                        result += `<div style="margin: 5px 0;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                            <span style="color: #5a5c66;">${p.seriesName}:</span>
                            <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value} 个</span>
                        </div>`;
                    });
                    return result;
                },
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                borderColor: '#e8e9eb',
                borderWidth: 1,
                padding: [12, 16],
                textStyle: {
                    fontSize: 12
                },
                extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
            },
            legend: {
                data: ['加微数', '开口客户数', '有效线索数', '开户数'],
                bottom: '2%',
                left: 'center',
                itemWidth: 16,
                itemHeight: 16,
                itemGap: 24,
                textStyle: {
                    fontSize: 13,
                    color: '#5a5c66'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '12%',
                top: '8%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: weeklyData.weeks,
                axisLabel: {
                    rotate: 30,
                    fontSize: 11,
                    color: '#8a8d99',
                    interval: 0,
                    margin: 12
                },
                axisLine: {
                    lineStyle: {
                        color: '#e8e9eb'
                    }
                },
                axisTick: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                name: '个数',
                nameTextStyle: {
                    fontSize: 12,
                    color: '#8a8d99',
                    padding: [0, 0, 0, -8]
                },
                axisLabel: {
                    fontSize: 11,
                    color: '#8a8d99',
                    formatter: (value) => {
                        if (value >= 1000) {
                            return (value / 1000).toFixed(1) + 'k';
                        }
                        return value;
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: '#e8e9eb'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#f0f1f3',
                        type: 'dashed'
                    }
                }
            },
            series: [
                {
                    name: '加微数',
                    type: 'bar',
                    data: weeklyData.lead_users,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#6366f1' },
                                { offset: 1, color: '#818cf8' }
                            ]
                        },
                        borderRadius: [4, 4, 0, 0]
                    },
                    barMaxWidth: 48,
                    emphasis: {
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#4f46e5' },
                                    { offset: 1, color: '#6366f1' }
                                ]
                            }
                        }
                    }
                },
                {
                    name: '开口客户数',
                    type: 'bar',
                    data: weeklyData.customer_mouth_users,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#10b981' },
                                { offset: 1, color: '#34d399' }
                            ]
                        },
                        borderRadius: [4, 4, 0, 0]
                    },
                    barMaxWidth: 48,
                    emphasis: {
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#059669' },
                                    { offset: 1, color: '#10b981' }
                                ]
                            }
                        }
                    }
                },
                {
                    name: '有效线索数',
                    type: 'bar',
                    data: weeklyData.valid_lead_users,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#f59e0b' },
                                { offset: 1, color: '#fbbf24' }
                            ]
                        },
                        borderRadius: [4, 4, 0, 0]
                    },
                    barMaxWidth: 48,
                    emphasis: {
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#d97706' },
                                    { offset: 1, color: '#f59e0b' }
                                ]
                            }
                        }
                    }
                },
                {
                    name: '开户数',
                    type: 'bar',
                    data: weeklyData.opened_account_users,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#ec4899' },
                                { offset: 1, color: '#f472b6' }
                            ]
                        },
                        borderRadius: [4, 4, 0, 0]
                    },
                    barMaxWidth: 48,
                    emphasis: {
                        itemStyle: {
                            color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: '#db2777' },
                                    { offset: 1, color: '#ec4899' }
                                ]
                            }
                        }
                    }
                }
            ],
            animationDuration: 1000,
            animationEasing: 'cubicOut',
            animationDelay: (idx) => idx * 50
        };

        chart.setOption(option);
        this.charts.conversionTrend = chart;
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 将日级数据聚合为周度数据
     * 返回包含日期范围的数据
     */
    aggregateToWeekly(chartData) {
        const dates = chartData.dates || [];
        const leadUsersSeries = chartData.lead_users_series || [];
        const customerMouthUsersSeries = chartData.customer_mouth_users_series || [];
        const validLeadUsersSeries = chartData.valid_lead_users_series || [];
        const openedAccountUsersSeries = chartData.opened_account_users_series || [];

        // 按周聚合数据
        const weeklyMap = new Map();

        dates.forEach((dateStr, idx) => {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const weekNum = this.getWeekNumber(date);
            const weekKey = `${year}-第${weekNum}周`;

            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                    lead_users: 0,
                    customer_mouth_users: 0,
                    valid_lead_users: 0,
                    opened_account_users: 0,
                    dateRange: {
                        start: dateStr,
                        end: dateStr
                    }
                });
            }

            const weekData = weeklyMap.get(weekKey);
            weekData.lead_users += leadUsersSeries[idx] || 0;
            weekData.customer_mouth_users += customerMouthUsersSeries[idx] || 0;
            weekData.valid_lead_users += validLeadUsersSeries[idx] || 0;
            weekData.opened_account_users += openedAccountUsersSeries[idx] || 0;

            // 更新日期范围
            if (dateStr < weekData.dateRange.start) {
                weekData.dateRange.start = dateStr;
            }
            if (dateStr > weekData.dateRange.end) {
                weekData.dateRange.end = dateStr;
            }
        });

        // 转换为数组并按周排序
        const sortedWeeks = Array.from(weeklyMap.entries()).sort((a, b) => {
            const [yearA, weekA] = a[0].split('-第').map(s => parseInt(s.replace('周', '')));
            const [yearB, weekB] = b[0].split('-第').map(s => parseInt(s.replace('周', '')));
            if (yearA !== yearB) return yearA - yearB;
            return weekA - weekB;
        });

        return {
            weeks: sortedWeeks.map(entry => entry[0]),
            dateRanges: sortedWeeks.map(entry => {
                const start = new Date(entry[1].dateRange.start);
                const end = new Date(entry[1].dateRange.end);
                return {
                    start: this.formatDateMD(start),
                    end: this.formatDateMD(end)
                };
            }),
            lead_users: sortedWeeks.map(entry => entry[1].lead_users),
            customer_mouth_users: sortedWeeks.map(entry => entry[1].customer_mouth_users),
            valid_lead_users: sortedWeeks.map(entry => entry[1].valid_lead_users),
            opened_account_users: sortedWeeks.map(entry => entry[1].opened_account_users)
        };
    }

    /**
     * 格式化日期为 MM-DD
     */
    formatDateMD(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    }

    /**
     * 获取日期所在周的周数（ISO周数）
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * 渲染小助手开户转化率走势图（周度）
     * 横坐标：YYYY-第X周
     * 纵坐标：转化率（开户数/加微数 × 100%）
     * 系列：按 add_employee_name 区分
     */
    renderEmployeeWeeklyRateChart() {
        const container = document.getElementById('employeeWeeklyRateChart');
        if (!container) return;

        const chartData = this.currentData?.employee_weekly_conversion;
        console.log('[EmployeeWeeklyRate] chartData:', chartData);

        if (!chartData || !chartData.weeks || chartData.weeks.length === 0) {
            console.warn('[EmployeeWeeklyRate] No data available');
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8a8d99;">
                    <svg style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    <p style="margin: 0; font-size: 14px;">暂无数据</p>
                </div>
            `;
            return;
        }

        // 🔧 性能优化: 延迟加载 ECharts
        (async () => {
            const echarts = await window.loadECharts();
            const chart = echarts.init(container);

        // 格式化周标签（YYYY-第X周）
        const weekLabels = chartData.weeks.map(w => {
            const [year, week] = w.split('-');
            return `${year}-第${week}周`;
        });

        // 构建系列数据（每个员工一条曲线）
        const series = [];
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

        chartData.employees.forEach((empName, idx) => {
            series.push({
                name: empName,
                type: 'line',
                data: chartData.series[idx] || [],
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                showSymbol: true,
                itemStyle: { color: colors[idx % colors.length] },
                lineStyle: { width: 2.5, color: colors[idx % colors.length] },
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderColor: colors[idx % colors.length],
                        borderWidth: 2,
                        symbolSize: 8
                    }
                }
            });
        });

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: (params) => {
                    const idx = params[0].dataIndex;
                    const week = weekLabels[idx];
                    let result = `<div style="font-weight: 600; margin-bottom: 10px; font-size: 13px; color: #1a1a1a;">${week}</div>`;
                    params.forEach(p => {
                        result += `<div style="margin: 5px 0;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${p.color}; margin-right: 8px;"></span>
                            <span style="color: #5a5c66;">${p.seriesName}:</span>
                            <span style="float: right; font-weight: 600; color: #1a1a1a;">${p.value.toFixed(2)}%</span>
                        </div>`;
                    });
                    return result;
                },
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                borderColor: '#e8e9eb',
                borderWidth: 1,
                padding: [12, 16],
                extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 6px;'
            },
            legend: {
                data: chartData.employees,
                bottom: '2%',
                left: 'center',
                itemWidth: 14,
                itemHeight: 14,
                itemGap: 16,
                textStyle: {
                    fontSize: 12,
                    color: '#5a5c66'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '12%',
                top: '5%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: weekLabels,
                axisLabel: {
                    fontSize: 11,
                    color: '#8a8d99',
                    interval: 0,
                    margin: 12,
                    rotate: 30
                },
                axisLine: {
                    lineStyle: { color: '#e8e9eb' }
                },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                name: '转化率 (%)',
                nameTextStyle: {
                    fontSize: 12,
                    color: '#8a8d99',
                    padding: [0, 0, 0, -8]
                },
                axisLabel: {
                    fontSize: 11,
                    color: '#8a8d99',
                    formatter: '{value}%'
                },
                axisLine: {
                    lineStyle: { color: '#e8e9eb' }
                },
                splitLine: {
                    lineStyle: { color: '#f0f1f3', type: 'dashed' }
                }
            },
            series: series,
            animationDuration: 1000,
            animationEasing: 'cubicOut'
        };

        chart.setOption(option);
        this.charts.employeeWeeklyRate = chart;

        // 响应式
        window.addEventListener('resize', () => {
            if (this.charts.employeeWeeklyRate) {
                this.charts.employeeWeeklyRate.resize();
            }
        });
        })(); // 🔧 性能优化: 异步 IIFE 结束
    }

    /**
     * 渲染员工转化量排行榜行
     */
    renderEmployeeConversionRows() {
        const data = this.currentData?.employee_conversion_ranking || [];
        if (data.length === 0) {
            return '<tr><td colspan="9" class="table-empty">暂无数据</td></tr>';
        }

        return data.map((item, index) => `
            <tr>
                <td class="table-rank ${index < 3 ? 'table-rank--top' : ''}" style="text-align: center;">${index + 1}</td>
                <td style="white-space: nowrap;">${item.employee_name || '-'}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.lead_users || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.valid_lead_users || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.opened_account_users || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">${this.formatNumber(item.valid_customer_users || 0)}</td>
                <td style="text-align: right; white-space: nowrap;">
                    <span style="color: ${this.getRateColor(item.opening_rate || 0)}; font-weight: 600;">
                        ${(item.opening_rate || 0).toFixed(2)}%
                    </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <span style="color: ${this.getRateColor(item.valid_customer_rate || 0)}; font-weight: 600;">
                        ${(item.valid_customer_rate || 0).toFixed(2)}%
                    </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">${this.formatCurrency(item.total_assets || 0)}</td>
            </tr>
        `).join('');
    }

    /**
     * 根据转化率数值返回颜色
     */
    getRateColor(rate) {
        if (rate >= 10) return '#52c41a';  // 绿色 - 优秀
        if (rate >= 5) return '#1890ff';   // 蓝色 - 良好
        if (rate >= 2) return '#faad14';   // 橙色 - 一般
        return '#f5222d';                  // 红色 - 较低
    }

    /**
     * 格式化数字
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 格式化货币
     */
    formatCurrency(num) {
        if (num === null || num === undefined) return '¥0.00';
        return '¥' + parseFloat(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-title">加载失败</div>
                <div class="error-message">${message}</div>
                <button class="btn btn--primary" onclick="location.reload()">重新加载</button>
            </div>
        `;
    }

    /**
     * 销毁
     */
    destroy() {
        // Phase 1: 解绑所有事件监听器
        this.unbindEvents();

        // 销毁事件管理器
        if (this.eventManager) {
            this.eventManager.destroy();
            this.eventManager = null;
        }

        // 销毁图表实例
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.dispose();
        });
        this.charts = {};

        // 清理数据
        this.currentData = null;
    }
}

// 导出到全局（确保 DynamicLoader 能找到此类）
if (typeof window !== 'undefined') {
    window.XhsNotesOperationReport = XhsNotesOperationReport;
}
