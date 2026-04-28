import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAliyunDriveSigninScript } from '@main/services/signin/AliyunDriveLocators';

describe('buildAliyunDriveSigninScript', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns session_expired when login entry is visible', async () => {
    document.body.innerHTML = `
      <a href="/login">登录</a>
      <div>精选活动</div>
    `;

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(result).toMatchObject({
      success: false,
      failureReason: 'session_expired',
    });
  });

  it('clicks the first date card and reward button inside the dialog', async () => {
    const cardClick = vi.fn(() => {
      const dialog = document.createElement('div');
      const rewardButton = document.createElement('button');
      rewardButton.textContent = '领取';
      rewardButton.addEventListener('click', () => {
        rewardButton.textContent = '已领取';
      });
      dialog.appendChild(rewardButton);
      document.body.appendChild(dialog);
    });

    const dateCard = document.createElement('button');
    dateCard.textContent = '4月28日';
    dateCard.addEventListener('click', cardClick);

    const container = document.createElement('section');
    container.innerHTML = '<h2>精选活动</h2>';
    container.appendChild(dateCard);
    document.body.appendChild(container);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(cardClick).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });

  it('returns date_card_not_found when activity exists but no date card can be resolved', async () => {
    document.body.innerHTML = `
      <section>
        <h2>精选活动</h2>
        <button>查看全部</button>
      </section>
    `;

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(result).toMatchObject({
      success: false,
      failureReason: 'date_card_not_found',
    });
  });

  it('can sign in when the page has a date card but no 精选活动 text anchor', async () => {
    const cardClick = vi.fn(() => {
      const dialog = document.createElement('div');
      const rewardButton = document.createElement('button');
      rewardButton.textContent = '领取';
      rewardButton.addEventListener('click', () => {
        rewardButton.textContent = '已领取';
      });
      dialog.appendChild(rewardButton);
      document.body.appendChild(dialog);
    });

    const dateCard = document.createElement('button');
    dateCard.textContent = '4月28日';
    dateCard.addEventListener('click', cardClick);
    document.body.appendChild(dateCard);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(cardClick).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });

  it('waits for the activity section to render before resolving the sign-in flow', async () => {
    const cardClick = vi.fn(() => {
      const rewardButton = document.createElement('button');
      rewardButton.textContent = '领取';
      rewardButton.addEventListener('click', () => {
        rewardButton.textContent = '已领取';
      });
      document.body.appendChild(rewardButton);
    });

    window.setTimeout(() => {
      const container = document.createElement('section');
      container.innerHTML = '<h2>精选活动</h2>';
      const dateCard = document.createElement('button');
      dateCard.textContent = '4月28日';
      dateCard.addEventListener('click', cardClick);
      container.appendChild(dateCard);
      document.body.appendChild(container);
    }, 50);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(cardClick).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });

  it('supports the current sign bar date structure rendered as 28/四月', async () => {
    const signBar = document.createElement('div');
    signBar.className = 'sign-bar--1XrSl';
    signBar.innerHTML = `
      <div class="sign-content--kB-HB">
        <div class="date--vMIyf">
          <span class="day--kSJ3S">28</span>
          <span class="line--Fvw5Q">/</span>
          <span class="month--3dvd3">四月</span>
        </div>
      </div>
    `;
    signBar.addEventListener('click', () => {
      const rewardButton = document.createElement('button');
      rewardButton.textContent = '领取';
      rewardButton.addEventListener('click', () => {
        rewardButton.textContent = '已领取';
      });
      document.body.appendChild(rewardButton);
    });

    const container = document.createElement('div');
    container.innerHTML = '<h2>精选活动</h2>';
    container.appendChild(signBar);
    document.body.appendChild(container);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });

  it('can enter the daily sign-in card from the home page before claiming the reward', async () => {
    const signinCard = document.createElement('button');
    signinCard.textContent = '每日签到';
    signinCard.addEventListener('click', () => {
      const rewardButton = document.createElement('button');
      rewardButton.textContent = '立即领取';
      rewardButton.addEventListener('click', () => {
        rewardButton.textContent = '已领取';
      });
      document.body.appendChild(rewardButton);
    });
    document.body.appendChild(signinCard);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });

  it('claims the reward directly when the page already exposes an immediate claim button', async () => {
    const rewardButton = document.createElement('button');
    rewardButton.textContent = '立即领取';
    rewardButton.addEventListener('click', () => {
      rewardButton.textContent = '已领取';
    });
    document.body.appendChild(rewardButton);

    const result = await window.eval(buildAliyunDriveSigninScript());

    expect(result).toMatchObject({
      success: true,
      detail: expect.stringContaining('已领取'),
    });
  });
});
