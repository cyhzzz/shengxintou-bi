/**
 * 省心投 BI - 主题切换组件
 */

class ThemeToggle {
    constructor(buttonSelector) {
        this.button = document.querySelector(buttonSelector);
        this.currentTheme = this.getSavedTheme();

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.applyTheme(this.currentTheme);
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.button.addEventListener('click', () => {
            this.toggle();
        });
    }

    /**
     * 切换主题
     */
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    /**
     * 应用主题
     * @param {string} theme - 主题名称
     */
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);

        // 更新按钮图标
        this.updateIcon();
    }

    /**
     * 更新按钮图标
     */
    updateIcon() {
        const icon = this.button.querySelector('i');
        if (icon) {
            icon.className = this.currentTheme === 'light' ? 'icon-moon' : 'icon-sun';
        }
    }

    /**
     * 保存主题到本地存储
     * @param {string} theme - 主题名称
     */
    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    /**
     * 获取保存的主题
     * @returns {string}
     */
    getSavedTheme() {
        return localStorage.getItem('theme') || 'light';
    }
}

// 导出
window.ThemeToggle = ThemeToggle;
