/**
 * ============================================
 * STRUCTURED CLARITY - JavaScript Components
 * ============================================
 * Reusable component factory with state management
 *
 * @version 1.0.0
 * @license MIT
 * ============================================
 */

class StructuredClarity {
  /**
   * Create a card component
   * @param {Object} config - Card configuration
   * @returns {HTMLElement} Card element
   */
  static createCard(config = {}) {
    const {
      variant = 'default', // default | filter | chart | metric | full-width
      title = '',
      actions = [],
      bodyContent = '',
      footerContent = ''
    } = config;

    const card = document.createElement('div');
    card.className = `card card--${variant}`;

    // Header
    if (title || actions.length > 0) {
      const header = document.createElement('div');
      header.className = 'card__header';

      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'card__title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
      }

      if (actions.length > 0) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'card__actions';
        actions.forEach(action => {
          actionsEl.appendChild(action);
        });
        header.appendChild(actionsEl);
      }

      card.appendChild(header);
    }

    // Body
    if (bodyContent) {
      const body = document.createElement('div');
      body.className = 'card__body';

      if (typeof bodyContent === 'string') {
        body.innerHTML = bodyContent;
      } else {
        body.appendChild(bodyContent);
      }

      card.appendChild(body);
    }

    // Footer
    if (footerContent) {
      const footer = document.createElement('div');
      footer.className = 'card__footer';

      if (typeof footerContent === 'string') {
        footer.innerHTML = footerContent;
      } else {
        footer.appendChild(footerContent);
      }

      card.appendChild(footer);
    }

    return card;
  }

  /**
   * Create a button component
   * @param {Object} config - Button configuration
   * @returns {HTMLElement} Button element
   */
  static createButton(config = {}) {
    const {
      variant = 'primary', // primary | secondary | outline | ghost
      size = 'default',    // sm | default | lg
      text = '',
      icon = null,
      disabled = false,
      loading = false,
      onClick = null
    } = config;

    const button = document.createElement('button');
    button.className = `btn btn--${variant} btn--${size}`;
    button.textContent = text;
    button.disabled = disabled;

    if (loading) {
      button.classList.add('is-loading');
      button.textContent = 'Loading...';
    }

    if (icon) {
      button.innerHTML = `${icon} ${text}`;
    }

    if (onClick && !disabled) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  /**
   * Create a button group
   * @param {Array} buttons - Array of button configs
   * @param {number} activeIndex - Index of active button
   * @returns {HTMLElement} Button group element
   */
  static createButtonGroup(buttons, activeIndex = 0) {
    const group = document.createElement('div');
    group.className = 'btn-group';

    buttons.forEach((btnConfig, index) => {
      const isActive = index === activeIndex;
      const button = this.createButton({
        ...btnConfig,
        onClick: (e) => {
          // Update active state
          group.querySelectorAll('.btn').forEach((btn, i) => {
            btn.classList.toggle('is-active', i === index);
          });

          // Call original onClick
          if (btnConfig.onClick) {
            btnConfig.onClick(e, index);
          }
        }
      });

      if (isActive) {
        button.classList.add('is-active');
      }

      group.appendChild(button);
    });

    return group;
  }

  /**
   * Create a form group
   * @param {Object} config - Form group configuration
   * @returns {HTMLElement} Form group element
   */
  static createFormGroup(config = {}) {
    const {
      label = '',
      required = false,
      type = 'text', // text | select | date
      options = [],   // For select
      placeholder = '',
      value = '',
      error = null,
      hint = '',
      onChange = null
    } = config;

    const group = document.createElement('div');
    group.className = 'form-group';

    // Label
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'form-label';
      if (required) {
        labelEl.classList.add('required');
      }
      labelEl.textContent = label;
      group.appendChild(labelEl);
    }

    // Input
    let input;

    if (type === 'select') {
      input = document.createElement('select');
      input.className = 'form-control';

      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value || opt;
        option.textContent = opt.label || opt;
        if (opt.value === value || opt === value) {
          option.selected = true;
        }
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = type;
      input.className = 'form-control';
      input.placeholder = placeholder;
      input.value = value;
    }

    if (error) {
      input.classList.add('is-error');
    }

    if (onChange) {
      input.addEventListener('change', (e) => {
        onChange(e.target.value);
      });
    }

    group.appendChild(input);

    // Hint or error
    if (error || hint) {
      const hintEl = document.createElement('small');
      hintEl.className = 'form-hint';
      if (error) {
        hintEl.classList.add('is-error');
        hintEl.textContent = error;
      } else {
        hintEl.textContent = hint;
      }
      group.appendChild(hintEl);
    }

    return group;
  }

  /**
   * Create a date range picker
   * @param {Object} config - Date range configuration
   * @returns {HTMLElement} Date range element
   */
  static createDateRange(config = {}) {
    const {
      label = '',
      startDate = '',
      endDate = '',
      onChange = null
    } = config;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'center';

    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'form-label';
      labelEl.textContent = label;
      labelEl.style.marginBottom = '0';
      labelEl.style.whiteSpace = 'nowrap';
      wrapper.appendChild(labelEl);
    }

    const startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.className = 'form-control';
    startInput.value = startDate;

    const separator = document.createElement('span');
    separator.textContent = 'to';
    separator.style.color = '#8A8D99';

    const endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.className = 'form-control';
    endInput.value = endDate;

    if (onChange) {
      const handleChange = () => {
        onChange({
          start: startInput.value,
          end: endInput.value
        });
      };

      startInput.addEventListener('change', handleChange);
      endInput.addEventListener('change', handleChange);
    }

    wrapper.appendChild(startInput);
    wrapper.appendChild(separator);
    wrapper.appendChild(endInput);

    return wrapper;
  }

  /**
   * Create a divider
   * @param {Object} config - Divider configuration
   * @returns {HTMLElement} Divider element
   */
  static createDivider(config = {}) {
    const {
      variant = 'default', // default | thick | dashed
      text = '',
      marginTop = '20px',
      marginBottom = '20px'
    } = config;

    if (text) {
      const divider = document.createElement('div');
      divider.className = 'divider divider--with-text';
      divider.style.marginTop = marginTop;
      divider.style.marginBottom = marginBottom;

      const span = document.createElement('span');
      span.textContent = text;
      divider.appendChild(span);

      return divider;
    }

    const hr = document.createElement('hr');
    hr.className = 'divider';
    hr.style.marginTop = marginTop;
    hr.style.marginBottom = marginBottom;

    if (variant === 'thick') {
      hr.classList.add('divider--thick');
    } else if (variant === 'dashed') {
      hr.classList.add('divider--dashed');
    }

    return hr;
  }

  /**
   * Create a metric card
   * @param {Object} config - Metric configuration
   * @returns {HTMLElement} Metric card element
   */
  static createMetricCard(config = {}) {
    const {
      title = '',
      value = '',
      trend = null, // { value: string, direction: 'up' | 'down' }
      color = 'primary' // primary | success | warning | error
    } = config;

    const card = this.createCard({
      variant: 'metric',
      bodyContent: ''
    });

    const body = card.querySelector('.card__body');

    // Value
    const valueEl = document.createElement('div');
    valueEl.style.fontSize = '32px';
    valueEl.style.fontWeight = '600';
    valueEl.style.color = '#171A23';
    valueEl.style.marginBottom = '4px';
    valueEl.textContent = value;
    body.appendChild(valueEl);

    // Title
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '13px';
      titleEl.style.color = '#5A5C66';
      titleEl.textContent = title;
      body.appendChild(titleEl);
    }

    // Trend
    if (trend) {
      const trendEl = document.createElement('div');
      trendEl.style.fontSize = '12px';
      trendEl.style.marginTop = '8px';

      const colorMap = {
        up: '#52C41A',
        down: '#F5222D'
      };

      trendEl.style.color = colorMap[trend.direction] || '#8A8D99';
      trendEl.textContent = `${trend.direction === 'up' ? '↑' : '↓'} ${trend.value}`;
      body.appendChild(trendEl);
    }

    return card;
  }

  /**
   * Show a toast notification
   * @param {Object} config - Toast configuration
   * @returns {HTMLElement} Toast element
   */
  static showToast(config = {}) {
    const {
      message = '',
      type = 'info', // info | success | warning | error
      duration = 3000
    } = config;

    const toast = document.createElement('div');
    toast.className = 'card';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1100;
      min-width: 300px;
      padding: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      animation: slideDown 0.3s ease-out;
    `;

    const colorMap = {
      info: '#1890FF',
      success: '#52C41A',
      warning: '#FAAD14',
      error: '#F5222D'
    };

    toast.style.borderLeft = `4px solid ${colorMap[type]}`;

    toast.innerHTML = `
      <div style="font-size: 14px; color: #171A23;">${message}</div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }

  /**
   * Create a loading overlay
   * @param {Object} config - Loading configuration
   * @returns {HTMLElement} Loading overlay element
   */
  static createLoading(config = {}) {
    const {
      text = 'Loading...',
      size = 'default' // sm | default | lg
    } = config;

    const overlay = document.createElement('div');
    overlay.className = 'card';
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      padding: 24px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;

    const sizeMap = {
      sm: '16px',
      default: '24px',
      lg: '32px'
    };

    overlay.innerHTML = `
      <div style="
        border: 3px solid #E8EAED;
        border-top: 3px solid #1890FF;
        border-radius: 50%;
        width: ${sizeMap[size]};
        height: ${sizeMap[size]};
        animation: spin 0.6s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <div style="font-size: 14px; color: #5A5C66;">${text}</div>
    `;

    // Add animation keyframes
    if (!document.getElementById('structured-clarity-animations')) {
      const style = document.createElement('style');
      style.id = 'structured-clarity-animations';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    return overlay;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StructuredClarity;
}
