export const ACTIVITY_SECTION_TEXTS = ['精选活动'] as const;
export const SIGNIN_ENTRY_TEXTS = ['每日签到', '去签到', '立即签到', '签到领福利'] as const;
export const REWARD_BUTTON_TEXTS = [
  '领取',
  '立即领取',
  '马上领取',
  '去领取',
  '领取奖励',
  '已领取',
] as const;
export const REWARD_SUCCESS_TEXTS = ['已领取', '领取成功', '今日奖励已领取'] as const;
export const DATE_CARD_PATTERN_SOURCES = [
  '\\d{1,2}月\\d{1,2}日',
  '\\d{1,2}[/-]\\d{1,2}',
  '\\d{1,2}\\s*/\\s*[一二三四五六七八九十]{1,3}月',
] as const;

export function buildAliyunDriveSigninScript(): string {
  return `
    (async () => {
      const activityTexts = ${JSON.stringify([...ACTIVITY_SECTION_TEXTS])};
      const signinEntryTexts = ${JSON.stringify([...SIGNIN_ENTRY_TEXTS])};
      const rewardButtonTexts = ${JSON.stringify([...REWARD_BUTTON_TEXTS])};
      const rewardSuccessTexts = ${JSON.stringify([...REWARD_SUCCESS_TEXTS])};
      const dateCardPatterns = ${JSON.stringify([...DATE_CARD_PATTERN_SOURCES])}
        .map((source) => new RegExp(source));
      const textIncludes = (value, candidates) =>
        typeof value === 'string' && candidates.some((candidate) => value.includes(candidate));
      const normalizeText = (value) =>
        typeof value === 'string' ? value.replace(/\\s+/g, ' ').trim() : '';
      const getText = (element) =>
        normalizeText(element?.innerText || element?.textContent || '');
      const isVisible = (element) => {
        if (!(element instanceof Element)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const waitFor = async (predicate, options = {}) => {
        const timeoutMs = options.timeoutMs ?? 2500;
        const intervalMs = options.intervalMs ?? 120;
        const deadline = Date.now() + timeoutMs;
        while (Date.now() <= deadline) {
          const value = predicate();
          if (value) {
            return value;
          }
          await sleep(intervalMs);
        }
        return null;
      };
      const clickElement = (element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }
        if (element.matches('button, a, [role="button"]') && typeof element.click === 'function') {
          element.click();
          return;
        }
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      };
      const scrollActivityArea = () => {
        const scrollTargets = Array.from(
          document.querySelectorAll('[class*="container"], main, section, div')
        ).filter((element) => isVisible(element));

        for (const target of scrollTargets.slice(0, 12)) {
          if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'center' });
          }
        }

        if (typeof window.scrollBy === 'function') {
          window.scrollBy(0, Math.max(window.innerHeight * 0.6, 480));
        }
      };
      const hasActivityAnchor = () => {
        const pageText = document.body?.innerText ?? '';
        return textIncludes(pageText, activityTexts);
      };
      const findSigninEntryCard = () => {
        const candidates = Array.from(
          document.querySelectorAll(
            'button, a, [role="button"], .card, .card-item, .activity-card, li, div, section'
          )
        ).filter((element) => {
          const text = getText(element);
          return (
            isVisible(element) &&
            textIncludes(text, signinEntryTexts) &&
            !textIncludes(text, rewardSuccessTexts)
          );
        });

        return candidates[0] ?? null;
      };
      const collectDebugSnapshot = () => {
        const signBarCount = document.querySelectorAll('[class*="sign-bar"]').length;
        const dateCardCandidateCount = Array.from(
          document.querySelectorAll('[class*="sign-bar"], [class*="date"], button, a, [role="button"]')
        ).filter((element) => {
          const text = getText(element);
          return isVisible(element) && dateCardPatterns.some((pattern) => pattern.test(text));
        }).length;

        return {
          readyState: typeof document.readyState === 'string' ? document.readyState : undefined,
          visibilityState:
            typeof document.visibilityState === 'string' ? document.visibilityState : undefined,
          viewport:
            typeof window.innerWidth === 'number' && typeof window.innerHeight === 'number'
              ? \`\${window.innerWidth}x\${window.innerHeight}\`
              : undefined,
          activityAnchorFound: hasActivityAnchor(),
          signBarCount,
          dateCardCandidateCount,
        };
      };
      const buildFailure = (failureReason, detail) => ({
        success: false,
        failureReason,
        detail,
        debug: collectDebugSnapshot(),
      });
      const findDateCard = () => {
        const candidates = Array.from(
          document.querySelectorAll(
            'button, a, [role="button"], .card, .card-item, .activity-card, [class*="sign-bar"], [class*="date"], li, div'
          )
        )
          .map((element) => {
            const text = getText(element);
            if (
              !isVisible(element) ||
              text.length === 0 ||
              !dateCardPatterns.some((pattern) => pattern.test(text))
            ) {
              return null;
            }

            const clickableAncestor = element.closest(
              'button, a, [role="button"], [class*="sign-bar"], .card, .card-item, .activity-card'
            );
            if (clickableAncestor instanceof Element) {
              return clickableAncestor;
            }

            const clickableChild = element.querySelector(
              'button, a, [role="button"], [class*="sign-bar"], .card, .card-item, .activity-card'
            );
            if (clickableChild instanceof Element) {
              return clickableChild;
            }

            if (element.matches('[class*="date"], .card, .card-item, .activity-card')) {
              return element;
            }

            return null;
          })
          .filter((element, index, collection) => {
            return !!element && collection.indexOf(element) === index;
          });

        return candidates[0] ?? null;
      };
      const findRewardButton = () => {
        const candidates = Array.from(
          document.querySelectorAll('button, [role="button"], a')
        ).filter((element) => {
          const text = getText(element);
          return isVisible(element) && textIncludes(text, rewardButtonTexts);
        });

        return candidates[0] ?? null;
      };
      const hasRewardSuccess = () => {
        const pageText = getText(document.body);
        return textIncludes(pageText, rewardSuccessTexts);
      };
      const resolveRewardButtonFlow = async () => {
        let rewardButton = findRewardButton();
        for (let attempt = 0; !rewardButton && attempt < 6; attempt += 1) {
          await sleep(150);
          rewardButton = findRewardButton();
        }

        if (!rewardButton) {
          return hasRewardSuccess()
            ? {
                success: true,
                detail: '今日奖励已领取',
              }
            : null;
        }

        const rewardText = getText(rewardButton);
        if (textIncludes(rewardText, ['已领取'])) {
          return {
            success: true,
            detail: '今日奖励已领取',
          };
        }

        clickElement(rewardButton);

        for (let attempt = 0; attempt < 6; attempt += 1) {
          await sleep(150);
          rewardButton = findRewardButton();
          const nextRewardText = getText(rewardButton);
          if (textIncludes(nextRewardText, ['已领取']) || hasRewardSuccess()) {
            return {
              success: true,
              detail: '今日奖励已领取',
            };
          }
        }

        return {
          success: false,
          failureReason: 'unknown',
          detail: '已点击领取按钮，但未观察到成功反馈',
          debug: collectDebugSnapshot(),
        };
      };

      if (document.querySelector('[data-testid="login"], .login, [href*="login"]')) {
        return buildFailure('session_expired', '检测到登录入口，当前会话可能已失效');
      }

      const directRewardResult = await resolveRewardButtonFlow();
      if (directRewardResult) {
        return directRewardResult;
      }

      const signinEntryCard = findSigninEntryCard();
      if (signinEntryCard) {
        clickElement(signinEntryCard);
        await sleep(200);
        const rewardAfterEntry = await resolveRewardButtonFlow();
        if (rewardAfterEntry) {
          return rewardAfterEntry;
        }
      }

      const initialDateCard = findDateCard();
      if (!initialDateCard && !hasActivityAnchor()) {
        await waitFor(() => {
          const nextDateCard = findDateCard();
          if (nextDateCard) {
            return nextDateCard;
          }
          if (hasActivityAnchor()) {
            return true;
          }
          scrollActivityArea();
          return null;
        });
      }

      const dateCard = await waitFor(() => {
        const nextDateCard = findDateCard();
        if (nextDateCard) {
          return nextDateCard;
        }
        scrollActivityArea();
        return null;
      });

      if (!dateCard && !hasActivityAnchor()) {
        return buildFailure('activity_not_found', '未找到精选活动区域');
      }

      if (!dateCard) {
        return buildFailure('date_card_not_found', '未找到日期卡片');
      }

      clickElement(dateCard);
      await sleep(150);
      const rewardResult = await resolveRewardButtonFlow();
      if (rewardResult) {
        return rewardResult;
      }

      return {
        success: false,
        failureReason: 'reward_button_not_found',
        detail: '未找到领取按钮或奖励弹窗',
        debug: collectDebugSnapshot(),
      };
    })();
  `;
}
