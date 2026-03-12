/**
 * Vaadin Web Components 按需加载器
 *
 * 用途：统一管理Vaadin组件的CDN加载
 * 使用：在需要Vaadin组件的页面中调用VaadinLoader.ensureLoaded()
 */

const VaadinLoader = {
  _loaded: new Set(),
  _loading: new Map(),

  // CDN基础路径
  CDN_BASE: 'https://cdn.jsdelivr.net/npm/@vaadin',

  // Aura主题CSS路径
  THEME_CSS: {
    global: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/global.css',
    button: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-button.css',
    textField: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-text-field.css',
    select: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-select.css',
    datePicker: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-date-picker.css',
    checkbox: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-checkbox.css',
    radio: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-radio-button.css',
    dialog: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-dialog.css',
    notification: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-notification.css',
    progress: 'https://cdn.jsdelivr.net/npm/@vaadin/vaadin-themes/aura-theme/vaadin-progress-bar.css',
  },

  // 组件JS路径
  COMPONENT_JS: {
    button: '@vaadin/button/vaadin-button.js',
    textField: '@vaadin/text-field/vaadin-text-field.js',
    select: '@vaadin/select/vaadin-select.js',
    item: '@vaadin/item/vaadin-item.js',
    datePicker: '@vaadin/date-picker/vaadin-date-picker.js',
    checkbox: '@vaadin/checkbox/vaadin-checkbox.js',
    radio: '@vaadin/radio-button/vaadin-radio-button.js',
    radioGroup: '@vaadin/radio-group/vaadin-radio-group.js',
    dialog: '@vaadin/dialog/vaadin-dialog.js',
    notification: '@vaadin/notification/vaadin-notification.js',
    progressBar: '@vaadin/progress-bar/vaadin-progress-bar.js',
  },

  /**
   * 加载CSS文件
   * @param {string} id - CSS标识符
   * @param {string} href - CSS路径
   */
  async _loadCSS(id, href) {
    if (this._loaded.has(`css:${id}`)) return;

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.id = `vaadin-css-${id}`;

      link.onload = () => {
        this._loaded.add(`css:${id}`);
        resolve();
      };

      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

      document.head.appendChild(link);
    });
  },

  /**
   * 加载JS模块
   * @param {string} name - 组件名称
   */
  async _loadJS(name) {
    const key = `js:${name}`;
    if (this._loaded.has(key)) return;

    if (this._loading.has(key)) {
      return this._loading.get(key);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = `${this.CDN_BASE}/${this.COMPONENT_JS[name]}`;

      script.onload = () => {
        this._loaded.add(key);
        this._loading.delete(key);
        resolve();
      };

      script.onerror = () => {
        this._loading.delete(key);
        reject(new Error(`Failed to load component: ${name}`));
      };

      document.head.appendChild(script);
    });

    this._loading.set(key, promise);
    return promise;
  },

  /**
   * 确保基础主题已加载
   */
  async ensureBaseTheme() {
    await this._loadCSS('global', this.THEME_CSS.global);
  },

  /**
   * 加载指定组件
   * @param {string[]} components - 组件名称数组
   */
  async loadComponents(components) {
    // 先加载基础主题
    await this.ensureBaseTheme();

    // 加载组件CSS和JS
    const promises = [];

    for (const name of components) {
      // 加载CSS
      const cssKey = name.replace(/([A-Z])/g, (m) => m.toLowerCase());
      if (this.THEME_CSS[cssKey]) {
        promises.push(this._loadCSS(cssKey, this.THEME_CSS[cssKey]));
      }

      // 加载JS
      promises.push(this._loadJS(name));
    }

    await Promise.all(promises);
  },

  /**
   * 加载按钮组件
   */
  async loadButton() {
    await this.loadComponents(['button']);
  },

  /**
   * 加载表单组件（文本框、下拉框）
   */
  async loadFormComponents() {
    await this.loadComponents(['textField', 'select', 'item']);
  },

  /**
   * 加载日期选择器
   */
  async loadDatePicker() {
    await this.loadComponents(['datePicker']);
  },

  /**
   * 加载复选框和单选框
   */
  async loadCheckRadio() {
    await this.loadComponents(['checkbox', 'radio', 'radioGroup']);
  },

  /**
   * 加载对话框和通知
   */
  async loadFeedback() {
    await this.loadComponents(['dialog', 'notification', 'progressBar']);
  },

  /**
   * 加载所有常用组件
   */
  async loadAllCommon() {
    await this.loadComponents([
      'button', 'textField', 'select', 'item',
      'datePicker', 'checkbox', 'radio', 'radioGroup',
      'dialog', 'notification', 'progressBar'
    ]);
  }
};

// 导出
window.VaadinLoader = VaadinLoader;

console.log('[VaadinLoader] 加载器已就绪');