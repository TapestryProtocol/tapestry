const { test, expect } = require('@playwright/test');
const { NORMALIZE_ROUTES } = require('../../test/helpers/openapiNormalizeRoutes');

/**
 * openapi-coverage #1: /docs in a browser, on a scratch stack — AC4's live check.
 *
 * Story: engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md
 * Plan:  engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.test-plan.md (§ How to run:
 *        the scratch stack, the loopback-only forward it is reached through, and the command)
 * Node half: test/openapi-coverage.test.js, test/openapi-document.test.js.
 *
 *   P1 — /docs loads the document: the Tapestry API title, no Swagger error panel, no page or console error,
 *        also after opening each of the 20 new entries (Swagger resolves an entry's $refs only when opened).  [AC4]
 *   P2 — the Normalize section shows each of the 20 routes the story documents, under its method.          [AC4]
 *   P3 — Try it out → Execute on GET /api/normalize/node-primitives sends the request to the origin serving
 *        the page, and the answer is the probe's (200, surface "node-primitives").                        [AC4]
 *
 * OPT-IN: it runs only with OPENAPI_DOCS_SCRATCH=1 and BRAINSTORM_BASE_URL pointing at the scratch forward.
 * Without them it skips, so a plain Playwright run never opens /docs on whatever answers at the default base
 * URL (on the Mac Studio that is Grawk's private instance). Chromium only.
 */

const OPT_IN = process.env.OPENAPI_DOCS_SCRATCH === '1';
const PROBE = '/api/normalize/node-primitives';

test.describe('openapi-coverage #1 — /docs on a scratch stack', () => {
  test.skip(!OPT_IN, 'opt-in: set OPENAPI_DOCS_SCRATCH=1 and BRAINSTORM_BASE_URL to a scratch-stack forward (test plan § How to run)');
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');

  /** Open /docs and wait until Swagger has rendered the document (or its error). */
  async function openDocs(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto('/docs/');
    await page.locator('.swagger-ui .information-container, .swagger-ui .errors-wrapper, .swagger-ui .loading-container .errors').first()
      .waitFor({ timeout: 30000 });
    return errors;
  }

  const opblock = (page, method, p) =>
    page.locator(`.opblock.opblock-${method.toLowerCase()}`).filter({ has: page.locator(`.opblock-summary-path[data-path="${p}"]`) });

  test('P1: /docs loads the document, and opening each of the 20 new entries shows no Swagger error and logs no page or console error', async ({ page }) => {
    const errors = await openDocs(page);
    await expect(page.locator('.swagger-ui .information-container .title')).toContainText('Tapestry API');
    await expect(page.locator('.swagger-ui .errors-wrapper')).toHaveCount(0);
    // Swagger resolves an operation's references only when it is opened, so a broken $ref shows only then.
    for (const [m, p] of NORMALIZE_ROUTES) {
      const block = opblock(page, m, p);
      if (await block.count() !== 1) continue; // P2 reports a missing route
      await block.locator('.opblock-summary').first().click();
      await expect(block.locator('.opblock-body')).toBeVisible();
    }
    await page.waitForTimeout(1000);
    const panel = page.locator('.swagger-ui .errors-wrapper');
    const panelText = (await panel.count()) ? await panel.first().innerText() : '';
    expect(panelText, 'Swagger error panel after opening the normalize entries').toBe('');
    expect(errors, `errors while /docs loaded:\n${errors.join('\n')}`).toEqual([]);
  });

  test('P2: the Normalize section shows each of the 20 routes the story documents', async ({ page }) => {
    await openDocs(page);
    const section = page.locator('.opblock-tag-section').filter({ has: page.locator('.opblock-tag[data-tag="Normalize"]') });
    await expect(section).toHaveCount(1);
    const missing = [];
    for (const [m, p] of NORMALIZE_ROUTES) {
      const n = await section.locator(`.opblock.opblock-${m.toLowerCase()}`)
        .filter({ has: page.locator(`.opblock-summary-path[data-path="${p}"]`) }).count();
      if (n !== 1) missing.push(`${m} ${p} (${n} found)`);
    }
    expect(missing, `normalize routes not shown once under Normalize:\n${missing.join('\n')}`).toEqual([]);
  });

  test('P3: Try it out on GET /api/normalize/node-primitives calls the origin serving the page and gets the probe answer', async ({ page }) => {
    await openDocs(page);
    const block = opblock(page, 'GET', PROBE);
    await expect(block, `no GET ${PROBE} operation on /docs`).toHaveCount(1);
    await block.locator('.opblock-summary').first().click();
    await block.locator('button.try-out__btn').click();
    await block.locator('button.execute').click();
    const origin = new URL(page.url()).origin;
    const requestUrl = block.locator('.request-url pre');
    await expect(requestUrl).toHaveText(`${origin}${PROBE}`, { timeout: 15000 });
    const row = block.locator('.live-responses-table tbody tr.response').first();
    await expect(row.locator('.response-col_status')).toHaveText('200', { timeout: 15000 });
    await expect(row.locator('.response-col_description')).toContainText('"surface": "node-primitives"');
  });
});
