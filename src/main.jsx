import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Plus, Sun, Moon, ArrowRight, X, ChevronDown, Check } from 'lucide-react';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import { STORAGE_KEY, id, signed, sum, localDate, monthOf, shiftMonth, format, parseAmount, accountBalance, totalBalance, monthSummary, validateLedger, validDate, loadLedger } from './ledger.js';
import './style.css';

const groupBy = (items, key) => items.reduce((groups, item) => { (groups[key(item)] ??= []).push(item); return groups; }, {});
const pages = ['总览', '流水日历', '估算'];
const haptic = () => { try { navigator.vibrate?.(8); } catch {} };
const amountText = cents => (cents / 100).toFixed(2);
function Money({ cents, prefix = '' }) {
  const [value, setValue] = useState(cents);
  const previous = useRef(cents);
  useEffect(() => {
    const from = previous.current;
    previous.current = cents;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(cents); return; }
    let frame;
    const start = performance.now();
    const tick = time => {
      const progress = Math.min((time - start) / 650, 1);
      setValue(from + (cents - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents]);
  const [whole, decimal] = format(Math.round(value)).split('.');
  return <span className="money">{prefix}{whole}<span className="dec">.{decimal}</span></span>;
}
function Spark({ values, large = false }) {
  if (!values.length) return <div className="empty-chart">记录流水后，走势会在这里呈现。</div>;
  const low = Math.min(0, ...values), high = Math.max(0, ...values), range = high - low || 1;
  const points = values.map((v, i) => `${i * 296 / Math.max(values.length - 1, 1) + 2},${78 - (v - low) / range * 70}`).join(' ');
  return <svg className={large ? 'spark large' : 'spark'} viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label="实际流水净额走势"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}
function Sheet({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...ref.current.querySelectorAll('button, input, select, textarea, [href], [tabindex="0"]')].filter(e => !e.disabled && e.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, []);
  return <div className="overlay" onClick={onClose}><section ref={ref} tabIndex={-1} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><div className="handle" /><div className="section-heading"><h2>{title}</h2><button className="icon-btn" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>{children}</section></div>;
}
function EntryForm({ modal, ledger, onSave, onDelete, onClose }) {
  const { kind, entry } = modal;
  const [title, setTitle] = useState(entry?.name ?? entry?.title ?? (kind === 'goal' ? ledger.goal.name : ''));
  const [amount, setAmount] = useState(entry ? amountText(kind === 'account' ? accountBalance(ledger, entry.id) : entry.cents) : kind === 'goal' && ledger.goal.targetCents ? amountText(ledger.goal.targetCents) : '');
  const [type, setType] = useState(entry?.type ?? modal.type ?? 'income');
  const [accountId, setAccountId] = useState(entry?.accountId ?? ledger.accounts[0]?.id ?? '');
  const [date, setDate] = useState(entry?.date ?? modal.date ?? localDate());
  const [accountKind, setAccountKind] = useState(entry?.kind ?? '现金账户');
  const [error, setError] = useState('');
  const noun = { account: '账户', transaction: '流水', plan: '计划', goal: '目标' }[kind];
  function submit(event) {
    event.preventDefault();
    try {
      if (!title.trim()) throw new Error('请填写名称。');
      const cents = parseAmount(amount, { signed: kind === 'account', zero: kind === 'account' || kind === 'goal' });
      if (kind === 'transaction' && (!ledger.accounts.some(a => a.id === accountId) || !validDate(date))) throw new Error('请选择有效的账户和日期。');
      const next = kind === 'account' ? { id: entry?.id ?? id(), name: title.trim(), kind: accountKind, openingCents: cents - (entry ? sum(ledger.transactions.filter(t => t.accountId === entry.id)) : 0) }
        : kind === 'goal' ? { name: title.trim(), targetCents: cents }
        : { id: entry?.id ?? id(), title: title.trim(), cents, type, ...(kind === 'transaction' ? { accountId, date } : {}) };
      onSave(next);
    } catch (e) { setError(e.message); }
  }
  return <Sheet title={kind === 'goal' ? '设置财富目标' : `${entry ? '编辑' : '添加'}${noun}`} onClose={onClose}>
    <form onSubmit={submit}>
      {(kind === 'transaction' || kind === 'plan') && <div className="segmented" aria-label="收支类型">{[['income', '收入'], ['expense', '支出']].map(([value, label]) => <button type="button" key={value} aria-pressed={type === value} className={type === value ? 'chosen' : ''} onClick={() => setType(value)}>{label}</button>)}</div>}
      <label>{noun}名称<input required maxLength={60} value={title} onChange={e => setTitle(e.target.value)} placeholder={{ account: '例如：我的储蓄', transaction: '例如：工资、午餐', plan: '例如：下月工资、旅行预留', goal: '例如：我的自由基金' }[kind]} /></label>
      {kind === 'account' && <label>账户类型<select value={accountKind} onChange={e => setAccountKind(e.target.value)}>{['现金账户', '投资账户', '其他账户'].map(k => <option key={k}>{k}</option>)}</select></label>}
      <label>{kind === 'account' ? entry ? '当前余额' : '起始余额' : kind === 'goal' ? '目标金额' : '金额'} · MYR<input required type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" maxLength={18} /></label>
      {kind === 'account' && <p className="form-note">{entry ? '修改为实际余额；已记录的流水会保留。' : '填写记账前的余额，后续流水会自动加减。可填 0 或负数。'}</p>}
      {kind === 'transaction' && <><label>记入账户<select required value={accountId} onChange={e => setAccountId(e.target.value)}><option value="" disabled>请选择账户</option>{ledger.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>日期<input required type="date" min="1900-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} /></label></>}
      {kind === 'plan' && <p className="form-note">仅影响估算，不改变账户余额。实际发生后，请另记一笔流水并删除该计划。</p>}
      {kind === 'goal' && <p className="form-note">设为 0 可暂时关闭目标。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="gold-button" type="submit">保存{noun}<ArrowRight size={16} /></button>
      {entry && <button className="danger-button" type="button" onClick={() => onDelete(entry)}>删除{noun}</button>}
    </form>
  </Sheet>;
}
function App() {
  const [loaded] = useState(() => { try { return loadLedger(localStorage); } catch { return loadLedger({ getItem() { throw Error(); } }); } });
  const [ledger, setLedger] = useState(loaded.ledger);
  const [storageError, setStorageError] = useState(loaded.error);
  const [canSave, setCanSave] = useState(!loaded.error);
  const [page, setPage] = useState(0), [theme, setTheme] = useState('system');
  const [today, setToday] = useState(localDate());
  const [month, setMonth] = useState(monthOf(localDate()));
  const [modal, setModal] = useState(null), [notice, setNotice] = useState(''), [open, setOpen] = useState('income');
  const [swipe, setSwipe] = useState(null);
  const touch = useRef(0), timer = useRef(null), upload = useRef(null);
  useEffect(() => { const refresh = () => setToday(localDate()); window.addEventListener('focus', refresh); const clock = setInterval(refresh, 60000); return () => { window.removeEventListener('focus', refresh); clearInterval(clock); clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    if (!canSave) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); setStorageError(''); }
    catch { setStorageError('未能保存到本机。请先导出备份；关闭页面可能丢失本次修改。'); }
  }, [ledger, canSave]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const current = monthSummary(ledger, monthOf(today)), viewing = monthSummary(ledger, month);
  const total = totalBalance(ledger), available = total + sum(ledger.plans);
  const incomePlans = ledger.plans.filter(p => p.type === 'income'), expensePlans = ledger.plans.filter(p => p.type === 'expense');
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate(), offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const daily = groupBy(viewing.entries, t => t.date);
  const maxDaily = Math.max(100, ...Object.values(daily).map(entries => Math.abs(sum(entries))));
  const recentMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(today), i - 5));
  const history = [...new Set(ledger.transactions.map(t => monthOf(t.date)))].sort().reverse();
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const percent = ledger.goal.targetCents ? Math.max(0, total / ledger.goal.targetCents * 100) : 0;
  function toast(message) { clearTimeout(timer.current); setNotice(message); timer.current = setTimeout(() => setNotice(''), 2800); }
  function update(next) { const clean = validateLedger(next); setLedger(clean); haptic(); }
  function navigate(index) { setPage(index); setSwipe(null); haptic(); window.scrollTo({ top: 0 }); }
  function closeModal() { setModal(modal?.backTo ?? null); }
  function newTransaction(date = today, backTo = null) {
    if (!ledger.accounts.length) { toast('先添加一个账户，再记录流水。'); setModal({ kind: 'account' }); return; }
    setModal({ kind: 'transaction', date, backTo });
  }
  function save(entry) {
    if (modal.kind === 'goal') update({ ...ledger, goal: entry });
    else {
      const field = { account: 'accounts', transaction: 'transactions', plan: 'plans' }[modal.kind];
      update({ ...ledger, [field]: modal.entry ? ledger[field].map(item => item.id === entry.id ? entry : item) : [...ledger[field], entry] });
    }
    setModal(modal.backTo ?? null); toast('已更新账本');
  }
  function askDelete(kind, entry, backTo = null) {
    const count = kind === 'account' ? ledger.transactions.filter(t => t.accountId === entry.id).length : 0;
    setModal({ kind: 'delete', entry, deleteKind: kind, previous: modal, backTo, message: kind === 'account' ? `删除「${entry.name}」${count ? `及其 ${count} 笔流水` : ''}？总资产会同步更新。` : `删除「${entry.title}」？相关金额会重新计算。` });
  }
  function remove() {
    const field = { account: 'accounts', transaction: 'transactions', plan: 'plans' }[modal.deleteKind];
    const next = { ...ledger, [field]: ledger[field].filter(item => item.id !== modal.entry.id) };
    if (modal.deleteKind === 'account') next.transactions = next.transactions.filter(t => t.accountId !== modal.entry.id);
    update(next); setModal(modal.backTo); setSwipe(null); toast('已删除');
  }
  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `AUREUS-备份-${today}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('已生成备份，请妥善保存');
  }
  async function importBackup(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('备份文件过大，请选择 2 MB 以内的 JSON 文件。');
      const imported = validateLedger(JSON.parse(await file.text()));
      setModal({ kind: 'import', imported });
    } catch (e) { toast(e instanceof SyntaxError ? '无法读取备份，现有数据未改动。' : e.message); }
  }
  function planDetails(items) {
    return items.length ? items.map(p => <button className="detail editable-detail" key={p.id} onClick={() => setModal({ kind: 'plan', entry: p })}><span>{p.title}</span><span>{p.type === 'expense' ? '−' : '+'} RM {format(p.cents)} <span className="edit-hint">编辑</span></span></button>) : <p className="empty-copy">暂无计划，点击下方添加。</p>;
  }
  return <div className="app"><main>
    <header><a className="mobile-brand" href="#" onClick={e => { e.preventDefault(); navigate(0); }}>AUREUS</a><div className="header-right"><span className="live-dot" />本机账本<button className="icon-btn" aria-label="切换主题" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}>{theme === 'light' ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
    {storageError && <div className="storage-warning" role="alert">{storageError}<button onClick={exportBackup}>导出当前账本</button></div>}
    <div className="content" key={page}><div className="page-heading"><div><div className="eyebrow">{['A QUIET VIEW OF YOUR WEALTH', 'EVERY DAY, IN PERSPECTIVE', 'MAKE ROOM FOR WHAT’S NEXT'][page]}</div><h1>{['财富，自有节奏。', '让每一天，清晰可见。', '为未来，留有余裕。'][page]}</h1></div><span className="date">{dateLabel}</span></div>
    {page === 0 && <>
      <section className="wealth-card" aria-label="总资产"><div className="card-top"><span>总资产 <small>TOTAL NET WORTH</small></span><span className="card-seal">A</span></div><div className="wealth-number"><span className="currency">MYR</span><Money cents={total} /></div><div className="wealth-bottom"><div><span className={current.net < 0 ? 'negative' : 'positive'}>{current.net >= 0 ? '+' : '−'} RM {format(Math.abs(current.net))}</span><span className="muted">本月净收支 · {ledger.accounts.length} 个账户</span></div></div><div className="card-lines" /></section>
      <div className="stats"><div><span className="stat-label">本月收入 <ArrowUpRight size={14} /></span><Money cents={current.income} prefix="RM " /><span className="positive stat-note">实际入账</span></div><div><span className="stat-label">本月支出 <ArrowDownRight size={14} /></span><Money cents={current.expense} prefix="RM " /><span className="muted stat-note">实际支出</span></div><div><span className="stat-label">本月净收支 <span className="mini-dot" /></span><Money cents={current.net} prefix="RM " /><span className="muted stat-note">收入减支出</span></div></div>
      <div className="overview-grid"><section className="accounts"><div className="section-heading"><h2>我的账户 <small>{String(ledger.accounts.length).padStart(2, '0')}</small></h2><button className="text-btn" onClick={() => setModal({ kind: 'account' })}><Plus size={14} />添加账户</button></div>
        {!ledger.accounts.length && <div className="empty-state"><h3>从你的第一笔积累开始。</h3><p>这里没有示例金额，添加账户后开始记录。</p><button className="gold-button" onClick={() => setModal({ kind: 'account' })}>添加第一个账户<Plus size={16} /></button></div>}
        {ledger.accounts.map(a => <div key={a.id} className={'account-row ' + (swipe === a.id ? 'swiped' : '')} onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => setSwipe(touch.current - e.changedTouches[0].clientX > 55 ? a.id : null)}><button className="account-edit" aria-label={`编辑账户 ${a.name}`} onClick={() => setModal({ kind: 'account', entry: a })}><div><h3>{a.name}<span>{a.kind}</span></h3><small>点击修改名称与余额</small></div><div className="account-value"><Money cents={accountBalance(ledger, a.id)} /><small>编辑</small></div></button>{swipe === a.id && <button className="delete" onClick={() => askDelete('account', a)}>删除</button>}</div>)}
        {!!ledger.accounts.length && <button className="gold-button" onClick={() => newTransaction()}>记一笔<Plus size={16} /></button>}
        <div className="account-footer"><span className="mini-dot" />余额随流水自动更新 · MYR</div></section>
        <section className="growth panel"><div className="section-heading"><h2>收支的节奏</h2><span className="tag">近六个月</span></div><div className="growth-value"><Money cents={sum(ledger.transactions.filter(t => recentMonths.includes(monthOf(t.date))))} prefix="RM " /></div><span className="muted small">六个月实际净收支</span><Spark large values={ledger.transactions.some(t => recentMonths.includes(monthOf(t.date))) ? recentMonths.map(m => monthSummary(ledger, m).net) : []} /><div className="chart-labels">{recentMonths.map(m => <span key={m}>{Number(m.slice(5))}月</span>)}</div></section>
      </div>
      <section className="backup-section"><div className="section-heading"><h2>我的数据</h2><span className="local-badge">仅保存在本机</span></div><p>更换手机、浏览器或清除网站数据前，请导出备份。网站更新不会主动清除账本。</p><div className="backup-actions"><button onClick={exportBackup}>导出备份</button><button onClick={() => upload.current.click()}>导入备份</button></div></section>
    </>}
    {page === 1 && <>
      <div className="calendar-top"><div className="month-control"><button className="icon-btn" aria-label="上个月" disabled={month === '1900-01'} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button><h2>{year} <em>{String(monthNumber).padStart(2, '0')}</em><small>月</small></h2><button className="icon-btn" aria-label="下个月" disabled={month === '9999-12'} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button></div><div className="calendar-summary"><span>本月净收支</span><Money cents={viewing.net} prefix="RM " /></div></div>
      <div className="calendar-actions"><button onClick={() => setMonth(monthOf(today))}>回到本月</button><button onClick={() => newTransaction(month === monthOf(today) ? today : `${month}-01`)}><Plus size={14} />记一笔</button></div>
      <section className="calendar panel"><div className="weekdays">{['一', '二', '三', '四', '五', '六', '日'].map(d => <span key={d}>{d}</span>)}</div><div className="days">{Array.from({ length: offset }, (_, i) => <div key={'blank' + i} />)}{Array.from({ length: days }, (_, i) => {
        const day = i + 1, date = `${month}-${String(day).padStart(2, '0')}`, entries = daily[date] || [], value = sum(entries);
        return <button key={date} className={'day ' + (value > 0 ? 'profit' : value < 0 ? 'loss' : '') + (date === today ? ' today' : '')} aria-label={`${date}${date === today ? ' 今天' : ''}，${entries.length} 笔流水，净额 ${amountText(value)}`} style={{ '--strength': Math.abs(value) / maxDaily }} onClick={() => { setModal({ kind: 'day', date }); haptic(); }}><span>{day}</span>{entries.length ? <small title={format(value)}>{value > 0 ? '+' : value < 0 ? '−' : ''}{(Math.abs(value) / 100).toLocaleString('en-US', { notation: Math.abs(value) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 2 })}</small> : <small className="empty">—</small>}{date === today && <i />}</button>;
      })}</div><div className="calendar-legend"><span><i className="green-dot" />净收入</span><span><i className="red-dot" />净支出</span><span>点击日期编辑流水</span></div></section>
      <div className="section-heading month-heading"><h2>月度回望</h2><span className="muted small">实际记录</span></div><div className="month-cards">{history.length ? history.map(m => {
        const report = monthSummary(ledger, m), grouped = groupBy(report.entries, t => t.date);
        return <button className="month-card panel" key={m} onClick={() => { setMonth(m); window.scrollTo({ top: 0 }); }}><span><em>{m.slice(5)}</em><small>月 / {m.slice(0, 4)}</small></span><div><small>{report.entries.length} 笔 · 净收支</small><strong className={report.net < 0 ? 'negative' : 'positive'}>RM {format(report.net)}</strong></div><Spark values={Object.keys(grouped).sort().map(d => sum(grouped[d]))} /></button>;
      }) : <p className="empty-copy">记录第一笔流水后，这里会出现月度记录。</p>}</div>
    </>}
    {page === 2 && <>
      <section className="estimate-hero"><div className="eyebrow">YOUR NEXT CHAPTER</div><span className="estimate-label">预计最终可用金额</span><div className="estimate-amount"><span>MYR</span><Money cents={available} /></div><div className="estimate-note"><span className="live-dot" />当前余额 ＋ 预计收入 − 预留支出</div><div className="hero-rule"><span>已入账流水包含在余额中，不重复计算</span></div></section>
      <div className="estimate-grid"><section><div className="section-heading"><h2>每一笔，都有去处</h2><span className="muted small">未来计划</span></div>{[{ key: 'accounts', name: '当前资产', value: total }, { key: 'income', name: '预计收入', value: sum(incomePlans) }, { key: 'expense', name: '预留支出', value: sum(expensePlans) }].map(item => <div className="accordion" key={item.key}><button onClick={() => setOpen(open === item.key ? '' : item.key)} aria-expanded={open === item.key}><span>{item.name}</span><span className={item.value < 0 ? 'negative' : ''}>RM {format(item.value)}<ChevronDown size={15} className={open === item.key ? 'rotated' : ''} /></span></button><div className={'accordion-body ' + (open === item.key ? 'expanded' : '')}><div>{item.key === 'accounts' ? ledger.accounts.length ? ledger.accounts.map(a => <button className="detail editable-detail" key={a.id} onClick={() => setModal({ kind: 'account', entry: a })}><span>{a.name}</span><span>RM {format(accountBalance(ledger, a.id))}<span className="edit-hint">编辑</span></span></button>) : <p className="empty-copy">先在总览添加账户。</p> : <>{planDetails(item.key === 'income' ? incomePlans : expensePlans)}<button className="text-btn add-plan" onClick={() => setModal({ kind: 'plan', type: item.key })}><Plus size={14} />添加{item.name}</button></>}</div></div></div>)}<div className="plan-quick-actions"><button onClick={() => setModal({ kind: 'plan', type: 'income' })}>＋ 预计收入</button><button onClick={() => setModal({ kind: 'plan', type: 'expense' })}>＋ 预留支出</button></div></section>
        <section className={'goal panel ' + (ledger.goal.targetCents && total >= ledger.goal.targetCents ? 'achieved' : '')}><div className="section-heading"><h2>下一个里程碑</h2><button className="text-btn" onClick={() => setModal({ kind: 'goal' })}>设置目标</button></div><h3>{ledger.goal.name}</h3>{ledger.goal.targetCents ? <><div className="goal-numbers"><Money cents={total} /><span>/ {format(ledger.goal.targetCents)}</span></div><div className="progress"><span style={{ width: Math.min(percent, 100) + '%' }} /></div><div className="goal-caption"><span>{percent >= 100 ? '目标已达成' : `已完成 ${percent.toFixed(1)}%`}</span><span>MYR</span></div></> : <p className="empty-copy">设定一个属于你的目标金额。</p>}<p>稳稳积累，慢慢靠近。</p></section>
      </div>
    </>}
    <footer><span>AUREUS <i>·</i> 私人资产簿</span><span>MYR / 马来西亚令吉</span></footer></div>
    <nav className="bottom-nav" aria-label="主要页面">{pages.map((name, index) => <button key={name} onClick={() => navigate(index)} className={page === index ? 'active' : ''} aria-current={page === index ? 'page' : undefined}><span />{name}</button>)}</nav>
    </main>
    <input className="file-input" type="file" accept="application/json,.json" aria-label="选择账本备份" ref={upload} onChange={importBackup} />
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
    {modal && ['account', 'transaction', 'plan', 'goal'].includes(modal.kind) && <EntryForm key={`${modal.kind}-${modal.entry?.id || 'new'}`} modal={modal} ledger={ledger} onClose={closeModal} onSave={save} onDelete={entry => askDelete(modal.kind, entry, modal.backTo)} />}
    {modal?.kind === 'day' && <Sheet title={`${modal.date} · 每日流水`} onClose={() => setModal(null)}><div className="sheet-total"><span>当日净收支</span><strong className={sum(ledger.transactions.filter(t => t.date === modal.date)) < 0 ? 'negative' : 'positive'}>RM {format(sum(ledger.transactions.filter(t => t.date === modal.date)))}</strong></div><div className="day-entries">{ledger.transactions.filter(t => t.date === modal.date).map(t => <button className="transaction-row" key={t.id} onClick={() => setModal({ kind: 'transaction', entry: t, backTo: modal })}><span>{t.title}<small>{ledger.accounts.find(a => a.id === t.accountId)?.name}</small></span><span className={t.type === 'income' ? 'positive' : 'negative'}>{t.type === 'income' ? '+' : '−'} RM {format(t.cents)}<small>点击编辑或删除</small></span></button>)}</div>{!ledger.transactions.some(t => t.date === modal.date) && <p className="empty-copy">这一天还没有流水。</p>}<button className="gold-button" onClick={() => newTransaction(modal.date, modal)}>添加流水<Plus size={16} /></button></Sheet>}
    {modal?.kind === 'delete' && <Sheet title="确认删除" onClose={() => setModal(modal.previous)}><p className="confirm-copy">{modal.message}</p><p className="form-note">删除后无法撤销，重要数据请先导出备份。</p><button className="danger-button filled" onClick={remove}>确认删除</button><button className="cancel-button" onClick={() => setModal(modal.previous)}>保留，返回</button></Sheet>}
    {modal?.kind === 'import' && <Sheet title="导入账本备份" onClose={() => setModal(null)}><p className="confirm-copy">将替换当前账本为备份中的 {modal.imported.accounts.length} 个账户、{modal.imported.transactions.length} 笔流水和 {modal.imported.plans.length} 项计划。</p><p className="form-note">请先导出当前账本，替换后无法撤销。</p><button className="gold-button" onClick={() => { update(modal.imported); setCanSave(true); setModal(null); toast('已导入备份'); }}>确认替换账本<ArrowRight size={16} /></button><button className="cancel-button" onClick={() => setModal(null)}>取消导入</button></Sheet>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
