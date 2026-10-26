import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:5173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
const key = 'aureus.ledger.v1';
const stored = async () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const choose = async index => page.locator('.bottom-nav button').nth(index).click();
const dialog = () => page.getByRole('dialog');
const close = async () => dialog().getByRole('button', { name: '关闭', exact: true }).click();
const assertTotal = async text => expect(page.locator('.wealth-number .money')).toHaveText(text);
const saveForm = async (name, amount, kind) => {
  await dialog().getByLabel(`${kind}名称`).fill(name);
  await dialog().getByLabel(/MYR/).fill(amount);
  await dialog().getByRole('button', { name: `保存${kind}`, exact: true }).click();
};
const clickDay = async date => { await choose(1); await page.getByRole('button', { name: new RegExp(`^${date}`) }).click(); };
try {
  await page.goto('http://127.0.0.1:5173'); await page.evaluate(() => document.fonts.ready);
  await assertTotal('0.00'); assert.equal((await stored()).accounts.length, 0);
  await page.getByRole('button', { name: '添加第一个账户' }).click();
  await saveForm('我的储蓄', '1000.00', '账户'); await assertTotal('1,000.00');
  await page.getByRole('button', { name: '添加账户', exact: true }).click();
  await saveForm('备用金', '0', '账户'); assert.equal((await stored()).accounts.length, 2);
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await saveForm('工资', '200.10', '流水'); await assertTotal('1,200.10');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await dialog().getByRole('button', { name: '支出', exact: true }).click();
  await saveForm('午餐', '20.05', '流水'); await assertTotal('1,180.05');
  await expect(page.locator('.stats .money')).toHaveText(['RM 200.10', 'RM 20.05', 'RM 180.05']);
  await page.reload(); await assertTotal('1,180.05'); assert.equal((await stored()).transactions.length, 2);
  await clickDay(today); await dialog().getByRole('button', { name: /午餐/ }).click();
  await dialog().getByLabel(/金额 · MYR/).fill('30.05'); await dialog().getByRole('button', { name: '保存流水' }).click();
  assert.match(await dialog().locator('.sheet-total').textContent(), /170.05/); await close(); await choose(0); await assertTotal('1,170.05');
  await page.getByRole('button', { name: '编辑账户 我的储蓄', exact: true }).click();
  await dialog().getByLabel('当前余额 · MYR').fill('2000'); await dialog().getByRole('button', { name: '保存账户' }).click(); await assertTotal('2,000.00');
  await clickDay(today); await dialog().getByRole('button', { name: /午餐/ }).click();
  await dialog().getByRole('button', { name: '删除流水', exact: true }).click();
  await dialog().getByRole('button', { name: '保留，返回' }).click(); assert.equal((await stored()).transactions.length, 2);
  await dialog().getByRole('button', { name: '删除流水', exact: true }).click(); await dialog().getByRole('button', { name: '确认删除', exact: true }).click();
  await close(); await choose(0); await assertTotal('2,030.05');
  // Each full date belongs to its own month; previous/next navigation wraps years.
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await dialog().getByLabel('日期', { exact: true }).fill('2025-12-31'); await saveForm('旧年记录', '10.00', '流水'); await assertTotal('2,040.05');
  await choose(1); const startingMonth = today.slice(0,7);
  for (let i = 0; i < 12 && !(await page.locator('.month-control h2').textContent()).replace(/\s/g,'').startsWith('202512'); i++) await page.getByRole('button', { name: '上个月' }).click();
  await page.getByRole('button', { name: /^2025-12-31/ }).click(); assert.match(await dialog().textContent(), /旧年记录/); await close();
  await page.getByRole('button', { name: '下个月' }).click(); assert.match(await page.locator('.month-control h2').textContent(), /2026.*01/);
  await page.getByRole('button', { name: '回到本月' }).click();
  await choose(2); await page.getByRole('button', { name: '＋ 预计收入', exact: true }).click(); await saveForm('未来收益', '100', '计划');
  await page.getByRole('button', { name: '＋ 预留支出', exact: true }).click(); await saveForm('旅行预留', '50', '计划');
  await expect(page.locator('.estimate-amount .money')).toHaveText('2,090.05');
  await page.getByRole('button', { name: /^预留支出/ }).click(); await page.getByRole('button', { name: /旅行预留/ }).click();
  await saveForm('旅行预留', '75', '计划'); await expect(page.locator('.estimate-amount .money')).toHaveText('2,065.05');
  await page.getByRole('button', { name: /旅行预留/ }).click(); await dialog().getByRole('button', { name: '删除计划' }).click(); await dialog().getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.locator('.estimate-amount .money')).toHaveText('2,140.05');
  await page.getByRole('button', { name: '设置目标', exact: true }).click(); await saveForm('自由基金', '2000', '目标'); assert.match(await page.locator('.goal').textContent(), /目标已达成/);
  await page.reload(); await choose(2); await expect(page.locator('.estimate-amount .money')).toHaveText('2,140.05'); assert.match(await page.locator('.goal h3').textContent(), /自由基金/);
  await choose(0); const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '导出备份', exact: true }).click(); const download = await downloadEvent;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8')); assert.equal(backup.accounts.length, 2); assert.equal(backup.transactions.length, 2);
  // A backup cannot replace any data until confirmation; invalid backups never mutate it.
  const prior = JSON.stringify(await stored());
  await page.getByLabel('选择账本备份').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  assert.equal(JSON.stringify(await stored()), prior);
  const alternate = { ...backup, goal: { name: '导入的目标', targetCents: 800000 } };
  const file = { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(alternate)) };
  await page.getByLabel('选择账本备份').setInputFiles(file); await dialog().getByRole('button', { name: '取消导入' }).click(); assert.equal(JSON.stringify(await stored()), prior);
  await page.getByLabel('选择账本备份').setInputFiles(file); await dialog().getByRole('button', { name: '确认替换账本' }).click(); assert.equal((await stored()).goal.name, '导入的目标');
  // Account deletion names and removes its associated records only, with cancellation support.
  await page.getByRole('button', { name: '编辑账户 我的储蓄' }).click(); await dialog().getByRole('button', { name: '删除账户' }).click(); assert.match(await dialog().textContent(), /2 笔流水/);
  await dialog().getByRole('button', { name: '保留，返回' }).click(); await close(); assert.equal((await stored()).accounts.length, 2);
  await page.getByRole('button', { name: '编辑账户 我的储蓄' }).click(); await dialog().getByRole('button', { name: '删除账户' }).click(); await dialog().getByRole('button', { name: '确认删除', exact: true }).click();
  await assertTotal('0.00'); assert.equal((await stored()).transactions.length, 0); assert.equal((await stored()).accounts.length, 1);
  await page.getByLabel('选择账本备份').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }); await dialog().getByRole('button', { name: '确认替换账本' }).click(); await assertTotal('2,040.05');
  // Narrow phones and the original viewport: every page stays within the screen.
  await mkdir('/workspace/artifacts', { recursive: true });
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [i, name] of ['overview', 'calendar', 'estimate'].entries()) {
      await choose(i); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow at ${width}`);
      if (width === 390) await page.screenshot({ path: `/workspace/artifacts/personal-${name}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '切换主题' }).click(); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.screenshot({ path: '/workspace/artifacts/personal-light.png', fullPage: true });
  // Corrupt/blocked storage cannot silently clobber previous saved bytes.
  const corruptPage = await context.newPage(); await corruptPage.addInitScript(k => localStorage.setItem(k, '{broken'), key); await corruptPage.goto('http://127.0.0.1:5173');
  assert.match(await corruptPage.getByRole('alert').textContent(), /原有存储不会被覆盖/); assert.equal(await corruptPage.evaluate(k => localStorage.getItem(k), key), '{broken'); await corruptPage.close();
  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); const blockedPage = await blockedContext.newPage();
  await blockedPage.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; }); await blockedPage.goto('http://127.0.0.1:5173');
  assert.match(await blockedPage.getByRole('alert').textContent(), /未能保存到本机/); await blockedContext.close();
  const cleanContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); const cleanPage = await cleanContext.newPage(); await cleanPage.goto('http://127.0.0.1:5173'); assert.equal(await cleanPage.locator('.wealth-number .money').textContent(), '0.00'); await cleanContext.close();
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('PASS: personal ledger CRUD, balance/report/estimate calculation, reload persistence, year boundaries, goal, backup/restore, deletion confirmation/cascade, local-only requests, corrupt/blocked storage, isolated visitors, themes, and 320–430px layout.');
} finally { await browser.close(); }
