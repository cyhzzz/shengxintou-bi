/**
 * 业务指标组件库
 * 提供三种专业的业务指标卡片组件
 *
 * @version 1.0.0
 * @updated 2026-01-26
 */

class BusinessMetrics {
    /**
     * 渲染漏斗指标卡片
     * 用于展示业务转化漏斗的各个节点
     *
     * @param {string} title - 指标标题
     * @param {string} value - 指标数值
     * @param {string} bgColor - 背景颜色（十六进制）
     * @param {string} color - 主题颜色（十六进制）
     * @param {number} step - 漏斗步骤序号（1-5）
     * @returns {string} HTML字符串
     *
     * @example
     * BusinessMetrics.renderFunnelCard(
     *     '曝光量',
     *     '13,017,458',
     *     '#E8F4FF',
     *     '#1890FF',
     *     1
     * )
     */
    static renderFunnelCard(title, value, bgColor, color, step) {
        return `
            <div class="funnel-card" style="
                background: ${bgColor};
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                position: relative;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px ${color}40'"
               onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                <div class="funnel-card__badge" style="
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
                <div class="funnel-card__title" style="
                    font-size: 10px;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                ">
                    ${title}
                </div>
                <div class="funnel-card__value" style="
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
     * 渲染转化率卡片
     * 用于展示业务转化率指标，支持动态颜色编码
     *
     * @param {string} title - 指标标题
     * @param {number} value - 指标数值（百分比）
     * @param {string} unit - 单位（默认'%'）
     * @param {string} subtitle - 副标题（显示转化路径，如"曝光 → 点击"）
     * @returns {string} HTML字符串
     *
     * @example
     * BusinessMetrics.renderRateCard(
     *     '曝光点击率',
     *     8.6,
     *     '%',
     *     '曝光 → 点击'
     * )
     */
    static renderRateCard(title, value, unit = '%', subtitle = '') {
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
            <div class="rate-card" style="
                background: white;
                border: 1px solid #E8E9EB;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                transition: all 0.2s ease;
            " onmouseover="this.style.borderColor='${color}'; this.style.boxShadow='0 2px 8px ${color}30'"
               onmouseout="this.style.borderColor='#E8E9EB'; this.style.boxShadow='none'">
                <div class="rate-card__subtitle" style="
                    font-size: 10px;
                    color: #8A8D99;
                    margin-bottom: 4px;
                ">
                    ${subtitle}
                </div>
                <div class="rate-card__title" style="
                    font-size: 11px;
                    color: #5A5C66;
                    font-weight: 600;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div class="rate-card__value" style="
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
     * 渲染成本效率卡片
     * 用于展示成本类指标，支持动态颜色编码
     *
     * @param {string} title - 指标标题
     * @param {number} value - 成本数值
     * @param {string} unit - 成本单位（如"元/千次"、"元/次"等）
     * @param {Object} options - 可选配置
     * @param {number} options.thresholds - 自定义阈值 {good: number, medium: number, high: number}
     * @returns {string} HTML字符串
     *
     * @example
     * BusinessMetrics.renderCostCard(
     *     '千次曝光成本',
     *     130.18,
     *     '元/千次'
     * )
     *
     * // 自定义阈值
     * BusinessMetrics.renderCostCard(
     *     '单开户成本',
     *     850,
     *     '元/户',
     *     { thresholds: { good: 200, medium: 500, high: 1000 } }
     * )
     */
    static renderCostCard(title, value, unit, options = {}) {
        // 默认阈值
        const defaultThresholds = {
            good: 100,      // <100: 绿色（优秀）
            medium: 500,    // 100-500: 蓝色（良好）
            high: 1000      // 500-1000: 橙色（中等偏高），>=1000: 红色（高）
        };

        const thresholds = { ...defaultThresholds, ...options.thresholds };

        // 根据成本大小动态设置颜色
        let color = '#52C41A';
        let bgColor = '#F6FFED';

        if (value >= thresholds.high) {
            color = '#F5222D';  // 红色 - 成本高
            bgColor = '#FFF1F0';
        } else if (value >= thresholds.medium) {
            color = '#FA8C16';  // 橙色 - 成本中等偏高
            bgColor = '#FFF7E6';
        } else if (value >= thresholds.good) {
            color = '#1890FF';  // 蓝色 - 成本中等
            bgColor = '#E8F4FF';
        }

        return `
            <div class="cost-card" style="
                background: ${bgColor};
                border-left: 3px solid ${color};
                border-radius: 6px;
                padding: 12px;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px ${color}30'"
               onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none'">
                <div class="cost-card__title" style="
                    font-size: 11px;
                    color: ${color};
                    font-weight: 600;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div class="cost-card__value" style="
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
     * 渲染紧凑型指标卡片
     * 用于展示基础指标（第一行）
     *
     * @param {string} title - 指标标题
     * @param {string} value - 指标数值
     * @param {string} unit - 数值单位
     * @param {string} color - 主题颜色（十六进制）
     * @returns {string} HTML字符串
     *
     * @example
     * BusinessMetrics.renderCompactCard(
     *     '新增笔记数',
     *     '782',
     *     '篇',
     *     '#6366F1'
     * )
     */
    static renderCompactCard(title, value, unit, color) {
        return `
            <div class="compact-card" style="
                background: ${color}15;
                border-left: 3px solid ${color};
                padding: 14px 16px;
                border-radius: 6px;
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${color}30'"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                <div class="compact-card__title" style="
                    font-size: 11px;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 6px;
                ">
                    ${title}
                </div>
                <div class="compact-card__value" style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #171A23;
                    line-height: 1.2;
                ">
                    ${value}
                </div>
                <div class="compact-card__unit" style="
                    font-size: 11px;
                    color: #8A8D99;
                    margin-top: 2px;
                ">
                    ${unit}
                </div>
            </div>
        `;
    }
}

// 导出到全局
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessMetrics;
}
