import { expect, test } from '@playwright/test';

const DEMO_CODE = 'DEMO26';
const INVALID_CODE = 'XXXXXX';

test.describe('Kiawah Golf production smoke tests', () => {
  test('Home page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    await expect(page.getByText(/Kiawah Golf/i).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Join|Enter code|Enter Event Code/i }).first()
    ).toBeVisible();
  });

  test('Join with valid code', async ({ page }) => {
    const response = await page.goto(`/join/${DEMO_CODE}`);
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    await expect(page).toHaveURL(new RegExp(`/join/${DEMO_CODE}|/t/${DEMO_CODE}`));
    await expect(
      page.getByText(/Tap your name to join scoring|Join Tournament|Demo Cup 2026/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Could not load tournament roster|Internal Error|500/u)
    ).toHaveCount(0);
  });

  test('Join with invalid code', async ({ page }) => {
    await page.goto('/join');
    await page.getByLabel(/Event Code/i).fill(INVALID_CODE);
    await page.getByRole('button', { name: /Join Tournament/i }).click();

    await expect(
      page.getByText(/Tournament not found|valid 6-character event code/i)
    ).toBeVisible();
    await expect(page.getByText(/ReferenceError|TypeError|Internal Error|500/u)).toHaveCount(0);
  });

  test('Commissioner login page reachable', async ({ page }) => {
    const response = await page.goto('/manage/login');
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    await expect(page.getByLabel(/Email/i)).toBeVisible();
  });

  test('Commissioner login rejects invalid email', async ({ page }) => {
    await page.goto('/manage/login');

    await page.evaluate(() => {
      const form = document.querySelector('form');
      form?.setAttribute('novalidate', 'novalidate');
    });

    await page.getByLabel(/Email/i).fill('notanemail');
    await page.getByRole('button', { name: /Send sign-in link/i }).click();

    // In production (dev=false) the generic message is shown; confirm no crash / redirect
    await expect(page.getByText('Could not send magic link. Try again.')).toBeVisible();
    await expect(page).not.toHaveURL(/magic-link-sent/);
  });

  test('Spectator live ticker page reachable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const response = await page.goto(`/t/${DEMO_CODE}/live`);
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    await expect(
      page.getByText(/Live updates connected|Progress to Win|Live Ticker/i).first()
    ).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(pageErrors).toEqual([]);
  });

  test('404 page is user friendly', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response).not.toBeNull();
    expect([200, 404]).toContain(response?.status());

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(bodyText).toMatch(/404|not found|page not found/i);
    expect(bodyText).not.toMatch(/ReferenceError|TypeError|SyntaxError|stack|Unhandled/i);
  });

  test('Dark mode text remains legible', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const darkModeScreenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('home-dark-mode', {
      body: darkModeScreenshot,
      contentType: 'image/png',
    });

    const lowLuminanceElements = await page.evaluate(() => {
      const selectors = [
        '.text-muted',
        '.text-secondary',
        '.text-text-muted',
        '.text-text-secondary',
        'h1',
      ];
      const scanned = new Set<Element>();
      const targets: Element[] = [];

      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (!scanned.has(element)) {
            scanned.add(element);
            targets.push(element);
          }
        }
      }

      const parseColor = (color: string): [number, number, number] | null => {
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/u);
        if (rgbMatch) {
          return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
        }

        const hexMatch = color.match(/^#([0-9a-f]{6})$/iu);
        if (hexMatch) {
          const value = hexMatch[1];
          return [
            Number.parseInt(value.slice(0, 2), 16),
            Number.parseInt(value.slice(2, 4), 16),
            Number.parseInt(value.slice(4, 6), 16),
          ];
        }

        return null;
      };

      const linearize = (channel: number): number => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };

      const luminance = (rgb: [number, number, number]): number =>
        0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);

      return targets
        .map((element) => {
          const computedColor = getComputedStyle(element).color;
          const rgb = parseColor(computedColor);
          const text = element.textContent?.trim() ?? '';

          if (!rgb || text.length === 0) {
            return null;
          }

          const value = luminance(rgb);
          return value < 0.04
            ? {
                selector:
                  element.tagName.toLowerCase() +
                  (element.className
                    ? `.${String(element.className).trim().replace(/\s+/gu, '.')}`
                    : ''),
                color: computedColor,
                luminance: value,
                text: text.slice(0, 80),
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    });

    expect(lowLuminanceElements).toEqual([]);
  });
});
