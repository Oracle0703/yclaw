import type { AutomationPage } from './types';

/**
 * 选择器生成器 — 从页面元素生成唯一 CSS 选择器
 */
export class SelectorGenerator {
  /**
   * 在页面中运行选择器生成器，为指定坐标位置的元素生成唯一选择器
   */
  async generateFromPoint(
    wc: AutomationPage,
    x: number,
    y: number,
  ): Promise<string> {
    return wc.executeJavaScript(`
      (() => {
        function getUniqueSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);

          const path = [];
          let current = el;

          while (current && current !== document.body && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
              path.unshift('#' + CSS.escape(current.id));
              break;
            }

            if (current.className && typeof current.className === 'string') {
              const classes = current.className.trim().split(/\\s+/).slice(0, 2);
              if (classes.length > 0 && classes[0]) {
                selector += '.' + classes.map(c => CSS.escape(c)).join('.');
              }
            }

            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += ':nth-of-type(' + index + ')';
              }
            }

            path.unshift(selector);
            current = current.parentElement;
          }

          return path.join(' > ');
        }

        const el = document.elementFromPoint(${x}, ${y});
        if (!el) return '';
        return getUniqueSelector(el);
      })()
    `);
  }

  /**
   * 校验选择器是否能唯一匹配元素
   */
  async validate(wc: AutomationPage, selector: string): Promise<{ count: number; valid: boolean }> {
    const count = await wc.executeJavaScript<number>(`
      document.querySelectorAll(${JSON.stringify(selector)}).length
    `);
    return { count, valid: count === 1 };
  }
}
