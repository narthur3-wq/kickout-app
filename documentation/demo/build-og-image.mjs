/**
 * Generates public/og-image.png — the 1200x630 card shown when the app URL is
 * pasted into WhatsApp, Slack, iMessage, X, etc.
 *
 * Rendered from HTML via Playwright so it stays in the app's visual language
 * (header navy, Clontarf red stripe, the real crest) without needing a design
 * tool. Re-run after editing:
 *
 *   node documentation/demo/build-og-image.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const crest = readFileSync(new URL('../../public/crest.png', import.meta.url)).toString('base64');

const html = `
<!doctype html>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
    background: #0f1923; color: #fff; overflow: hidden;
  }
  .stripe { height: 10px; background: #c41230; flex-shrink: 0; }
  .body {
    flex: 1; display: flex; align-items: center; gap: 56px; padding: 0 84px;
  }
  .crest { width: 210px; height: 210px; object-fit: contain; flex-shrink: 0; }
  .title { font-size: 108px; font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
  .sub {
    font-size: 34px; font-weight: 600; color: rgba(255,255,255,0.62);
    margin-top: 16px; letter-spacing: -0.01em;
  }
  .rule { width: 96px; height: 5px; background: #c41230; margin: 30px 0 26px; border-radius: 3px; }
  .points { display: flex; gap: 14px; flex-wrap: wrap; }
  .pill {
    font-size: 21px; font-weight: 700; padding: 10px 20px; border-radius: 999px;
    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9);
    border: 1px solid rgba(255,255,255,0.14);
  }
</style>
<div class="stripe"></div>
<div class="body">
  <img class="crest" src="data:image/png;base64,${crest}" />
  <div>
    <div class="title">P&aacute;irc</div>
    <div class="sub">GAA Match Analyst</div>
    <div class="rule"></div>
    <div class="points">
      <span class="pill">Live kickout &amp; shot capture</span>
      <span class="pill">Half-time digest</span>
      <span class="pill">Tactical board</span>
    </div>
  </div>
</div>
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: new URL('../../public/og-image.png', import.meta.url).pathname.replace(/^\//, '') });
await browser.close();

console.log('Wrote public/og-image.png (1200x630)');
