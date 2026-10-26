import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, parseAmount, accountBalance, totalBalance, monthSummary, sum, shiftMonth, validateLedger, loadLedger, STORAGE_KEY, validDate } from '../src/ledger.js';
const account = { id: 'a', name: '储蓄', kind: '现金账户', openingCents: 100000 };
const income = { id: 't1', title: '工资', type: 'income', cents: 50000, accountId: 'a', date: '2026-12-31' };
const expense = { id: 't2', title: '午餐', type: 'expense', cents: 1234, accountId: 'a', date: '2027-01-01' };
const ledger = () => ({ ...emptyLedger(), accounts: [account], transactions: [income, expense] });

test('money parsing preserves cents, zero/negative balances, and rejects malformed or unsafe numbers', () => {
  assert.equal(parseAmount('0.10'), 10); assert.equal(parseAmount('0012.3'), 1230);
  assert.equal(parseAmount('0', { zero: true }), 0); assert.equal(parseAmount('-1.23', { signed: true }), -123);
  for (const value of ['', 'NaN', 'Infinity', '1e3', '1.234', '-1', '0', '0x10', '9'.repeat(50)]) assert.throws(() => parseAmount(value));
});
test('actual records automatically affect account balance and month-specific reports', () => {
  const state = ledger(); assert.equal(accountBalance(state, 'a'), 148766); assert.equal(totalBalance(state), 148766);
  assert.deepEqual(monthSummary(state, '2026-12'), { entries: [income], income: 50000, expense: 0, net: 50000 });
  assert.equal(monthSummary(state, '2027-01').net, -1234); assert.equal(monthSummary(state, '2026-11').net, 0);
  state.transactions[1] = { ...expense, cents: 20000 }; assert.equal(totalBalance(state), 130000);
  state.transactions = [income]; assert.equal(totalBalance(state), 150000);
});
test('editing a current balance preserves historical entries and later reversal remains correct', () => {
  const state = ledger(); const desired = 220000;
  state.accounts = [{ ...account, openingCents: desired - sum(state.transactions) }];
  assert.equal(totalBalance(state), desired); assert.equal(state.transactions.length, 2);
  state.transactions = [expense]; assert.equal(totalBalance(state), desired - income.cents);
});
test('estimate uses only future plans in addition to current balance', () => {
  const state = ledger(); state.plans = [{ id: 'p1', title: '预期收益', type: 'income', cents: 20000 }, { id: 'p2', title: '旅行', type: 'expense', cents: 30000 }];
  assert.equal(totalBalance(state) + sum(state.plans), 138766);
  assert.deepEqual(validateLedger(JSON.parse(JSON.stringify(state))), state);
});
test('full dates handle year boundaries, leap days, and independent days in separate months', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.equal(validDate('2028-02-29'), true); assert.equal(validDate('2027-02-29'), false); assert.equal(validDate('2026-13-01'), false);
  const state = ledger(); state.transactions.push({ ...expense, id: 't3', date: '2027-02-01', cents: 123 });
  assert.equal(monthSummary(state, '2027-01').expense, 1234); assert.equal(monthSummary(state, '2027-02').expense, 123);
});
test('backup validation rejects orphaned entries, duplicates, invalid dates, and unsafe data', () => {
  const bad = [null, {}, { ...ledger(), version: 2 }, { ...ledger(), transactions: [{ ...income, accountId: 'missing' }] }, { ...ledger(), transactions: [income, income] }, { ...ledger(), transactions: [{ ...income, date: '2026-02-31' }] }, { ...ledger(), transactions: [{ ...income, cents: 1.5 }] }, { ...ledger(), accounts: [{ ...account, openingCents: Infinity }] }, { ...ledger(), goal: { name: '', targetCents: -1 } }];
  for (const value of bad) assert.throws(() => validateLedger(value));
});
test('loading does not mutate storage, resets no real data, and reports corrupt or blocked storage', () => {
  const json = JSON.stringify(ledger()); let writes = 0;
  const storage = { getItem: key => { assert.equal(key, STORAGE_KEY); return json; }, setItem: () => writes++ };
  assert.deepEqual(loadLedger(storage), { ledger: ledger(), error: '' }); assert.equal(writes, 0);
  assert.deepEqual(loadLedger({ getItem: () => null }).ledger, emptyLedger());
  assert.ok(loadLedger({ getItem: () => '{broken' }).error);
  assert.ok(loadLedger({ getItem: () => { throw Error('blocked'); } }).error);
});
