/**
 * 省心投 BI - 侧边栏组件
 */

class Sidebar {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.navItems = this.container.querySelectorAll('.nav-item');
        this.currentReport = 'dashboard';

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // 处理二级菜单展开/收起
                if (item.classList.contains('has-submenu')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSubmenu(item);
                    return;
                }

                const reportId = item.getAttribute('data-report');
                if (reportId) {
                    this.switchReport(reportId);
                }
            });

            // 阻止二级菜单项的事件冒泡
            const submenuItems = item.querySelectorAll('.submenu .nav-item');
            submenuItems.forEach(subItem => {
                subItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const reportId = subItem.getAttribute('data-report');
                    if (reportId) {
                        this.switchReport(reportId);
                    }
                });
            });

            // 处理submenu-trigger的点击
            const trigger = item.querySelector('.submenu-trigger');
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSubmenu(item);
                });
            }
        });

        // 阻止二级菜单项点击时触发父级菜单
        const allSubmenuItems = this.container.querySelectorAll('.submenu .nav-item');
        allSubmenuItems.forEach(subItem => {
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    /**
     * 切换二级菜单
     * @param {HTMLElement} item - 菜单项
     */
    toggleSubmenu(item) {
        const isExpanded = item.classList.contains('expanded');
        const submenu = item.querySelector('.submenu');

        if (isExpanded) {
            // 收起：先移除expanded类触发动画，然后等待动画完成后再隐藏
            item.classList.remove('expanded');
            setTimeout(() => {
                if (!item.classList.contains('expanded')) {
                    submenu.style.display = 'none';
                }
            }, 300); // 与CSS动画时长匹配
        } else {
            // 展开：先显示，然后在下一帧添加expanded类触发动画
            submenu.style.display = 'block';
            // 强制重排
            submenu.offsetHeight;
            item.classList.add('expanded');
        }
    }


    /**
     * 切换报表
     * @param {string} reportId - 报表ID
     */
    switchReport(reportId) {
        // 移除所有激活状态
        this.navItems.forEach(item => {
            item.classList.remove('active');
        });

        // 添加当前激活状态
        const currentItem = this.container.querySelector(`[data-report="${reportId}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }

        this.currentReport = reportId;

        // 更新顶部标题
        const reportConfig = window.APP_CONFIG.REPORTS[reportId];
        if (reportConfig) {
            const currentReportElement = document.getElementById('currentReport');
            if (currentReportElement) {
                currentReportElement.textContent = reportConfig.name;
            }
        }

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('reportChange', {
            detail: { reportId }
        }));
    }

    /**
     * 设置当前激活的报表
     * @param {string} reportId - 报表ID
     */
    setActive(reportId) {
        this.switchReport(reportId);
    }

    /**
     * 获取当前报表ID
     * @returns {string}
     */
    getCurrentReport() {
        return this.currentReport;
    }
}

// 导出
window.Sidebar = Sidebar;
