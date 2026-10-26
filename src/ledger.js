export const STORAGE_KEY = 'aureus.ledger.v1';
export const MAX_CENTS = 100_000_000_000_000;
export const emptyLedger = () => ({ version: 1, accounts: [], transactions: [], plans: [], goal: { name: '我的财富目标', targetCents: 0 } });
export const id = () => crypto.randomUUID();
export const signed = item => item.type === 'expense' ? -item.cents : item.cents;
export const sum = items => items.reduce((total, item) => total + signed(item), 0);
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const monthOf = date => date.slice(0, 7);
export const shiftMonth = (month, offset) => {
  const [y, m] = month.split('-').map(Number);
  return monthOf(localDate(new Date(y, m - 1 + offset, 1)));
};
export const format = cents => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function parseAmount(value, { signed: allowNegative = false, zero = false } = {}) {
  const text = String(value).trim();
  if (!(allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(text)) throw new Error('请输入有效金额，最多保留两位小数。');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_CENTS || (!zero && cents === 0)) throw new Error('请输入范围内的金额；流水和计划金额须大于 0。');
  return cents;
}
export function accountBalance(ledger, accountId) {
  const account = ledger.accounts.find(a => a.id === accountId);
  return account ? account.openingCents + sum(ledger.transactions.filter(t => t.accountId === accountId)) : 0;
}
export const totalBalance = ledger => ledger.accounts.reduce((s, a) => s + accountBalance(ledger, a.id), 0);
export function monthSummary(ledger, month) {
  const entries = ledger.transactions.filter(t => monthOf(t.date) === month);
  const income = entries.filter(t => t.type === 'income').reduce((s, t) => s + t.cents, 0);
  const expense = entries.filter(t => t.type === 'expense').reduce((s, t) => s + t.cents, 0);
  return { entries, income, expense, net: income - expense };
}
export function validateLedger(data) {
  const fail = () => { throw new Error('备份格式不正确，未修改现有账本。'); };
  const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 100;
  const money = (v, positive = false) => Number.isSafeInteger(v) && Math.abs(v) <= MAX_CENTS && (!positive || v > 0);
  const list = v => Array.isArray(v) && v.length <= 10000;
  if (!data || data.version !== 1 || !list(data.accounts) || !list(data.transactions) || !list(data.plans)) fail();
  const ids = new Set();
  const unique = v => { if (!text(v) || ids.has(v)) fail(); ids.add(v); };
  const accounts = data.accounts.map(a => {
    if (!a || !text(a.name) || !['现金账户', '投资账户', '其他账户'].includes(a.kind) || !money(a.openingCents)) fail();
    unique(a.id);
    return { id: a.id, name: a.name.trim(), kind: a.kind, openingCents: a.openingCents };
  });
  const accountIds = new Set(accounts.map(a => a.id));
  const transactions = data.transactions.map(t => {
    if (!t || !accountIds.has(t.accountId) || !text(t.title) || !['income', 'expense'].includes(t.type) || !money(t.cents, true) || !validDate(t.date)) fail();
    unique(t.id);
    return { id: t.id, title: t.title.trim(), accountId: t.accountId, type: t.type, cents: t.cents, date: t.date };
  });
  const plans = data.plans.map(p => {
    if (!p || !text(p.title) || !['income', 'expense'].includes(p.type) || !money(p.cents, true)) fail();
    unique(p.id);
    return { id: p.id, title: p.title.trim(), type: p.type, cents: p.cents };
  });
  if (!data.goal || !text(data.goal.name) || !money(data.goal.targetCents) || data.goal.targetCents < 0) fail();
  const clean = { version: 1, accounts, transactions, plans, goal: { name: data.goal.name.trim(), targetCents: data.goal.targetCents } };
  const gross = accounts.reduce((s, a) => s + Math.abs(a.openingCents), 0) + transactions.reduce((s, t) => s + t.cents, 0) + plans.reduce((s, p) => s + p.cents, 0);
  if (!Number.isSafeInteger(gross) || gross > MAX_CENTS) throw new Error('账本金额超出支持范围，请检查输入金额。');
  const aggregates = [totalBalance(clean), sum(plans), totalBalance(clean) + sum(plans), ...accounts.map(a => accountBalance(clean, a.id))];
  if (aggregates.some(n => !Number.isSafeInteger(n) || Math.abs(n) > MAX_CENTS)) fail();
  return clean;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return y >= 1900 && y <= 9999 && localDate(new Date(y, m - 1, d)) === value;
}
export function loadLedger(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { ledger: raw === null ? emptyLedger() : validateLedger(JSON.parse(raw)), error: '' };
  } catch {
    return { ledger: emptyLedger(), error: '无法读取本机账本。原有存储不会被覆盖；请导入有效备份，或检查浏览器存储设置。' };
  }
}
