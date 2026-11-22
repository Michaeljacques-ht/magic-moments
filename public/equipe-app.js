/* Magic Moments — Espace employé (/equipe) : tâches, pointage, heures, paie, profil. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'America/Port-au-Prince';
const money = n => Number(n || 0).toLocaleString('fr-FR') + ' HTG';
const dt = (v, o = { dateStyle: 'medium', timeStyle: 'short' }) => v ? new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...o }).format(new Date(v)) : '';
const hhmm = v => dt(v, { hour: '2-digit', minute: '2-digit' });
const dur = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
const PRIO = { low: ['Basse', 'grey'], normal: ['Normale', ''], high: ['Urgente', 'bad'] }, STATUS = { todo: ['À faire', 'warn'], in_progress: ['En cours', ''], done: ['Terminée', 'ok'] };
const TIME = { approved: ['Validé', 'ok'], pending: ['À valider', 'warn'], rejected: ['Refusé', 'bad'] };
const S = { view: 'home', me: null, month: new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()).slice(0, 7) };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500); }
async function api(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || (r.status === 403 && url.startsWith('/api/staff/'))) { if (url !== '/api/auth/login') showLogin(j.error); throw Error(j.error || 'Connexion requise'); }
  if (!r.ok) throw Error(j.error || 'Erreur ' + r.status);
  return j;
}
const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

function showLogin(msg) { $('#app').classList.add('hidden'); $('#activate').classList.add('hidden'); $('#login').classList.remove('hidden'); if (msg && msg !== 'Connexion requise') toast(msg); }
$('#loginForm').onsubmit = safe(async e => {
  e.preventDefault(); const f = new FormData(e.target), r = await api('/api/auth/login', { email: f.get('email'), password: f.get('password') });
  if (r.user.role === 'admin') { location.href = '/admin'; return; }
  if (r.user.role !== 'staff') { await api('/api/auth/logout', {}).catch(() => {}); throw Error('Ce compte n’est pas un compte employé.'); }
  e.target.reset(); start();
});
$('#forgot').onclick = safe(async () => {
  const email = $('#loginForm [name=email]').value.trim(); if (!email) { toast('Indiquez d’abord votre courriel.'); return; }
  await api('/api/auth/forgot', { email }); toast('Si ce courriel existe, un lien vous a été envoyé.');
});
$('#activateForm').onsubmit = safe(async e => {
  e.preventDefault(); const f = new FormData(e.target); if (f.get('password') !== f.get('confirm')) throw Error('Les deux mots de passe ne correspondent pas.');
  await api('/api/auth/reset', { token: S.token, password: f.get('password') }); history.replaceState(null, '', '/equipe'); toast('Votre espace est activé. Bienvenue !'); start();
});

/* ---------- Navigation ---------- */
$$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.v));
$('#refresh').onclick = () => go(S.view);
function go(v) { S.view = v; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); $$('.view').forEach(x => x.classList.toggle('hidden', x.id !== 'v-' + v)); safe(RENDER[v])(); window.scrollTo(0, 0); }
async function start() {
  S.me = await api('/api/staff/me');
  $('#login').classList.add('hidden'); $('#activate').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#who').textContent = S.me.employee.name; go(S.view);
}
const RENDER = {};

/* ---------- Accueil : pointage + tâches du jour ---------- */
RENDER.home = async () => {
  const me = S.me = await api('/api/staff/me'), tasks = await api('/api/staff/tasks'), open = me.open;
  const todo = tasks.filter(t => ['todo', 'in_progress'].includes(t.status)); badge(todo.length);
  $('#v-home').innerHTML = `<h2>Bonjour ${h(me.employee.name.split(' ')[0])} 👋</h2>
    <div class="card clock"><div class="muted">${dt(Date.now(), { dateStyle: 'full' })}</div><div class="now" id="clockNow">${hhmm(Date.now())}</div>
      ${open ? `<p>✅ Arrivé à <b>${hhmm(open.start)}</b> · <span id="since"></span></p><button class="btn gold full" id="clockOut">Pointer mon départ</button>` : `<p class="muted">Vous n’êtes pas pointé.</p><button class="btn primary full" id="clockIn">Pointer mon arrivée</button>`}
      <p class="muted" style="margin-bottom:0">Aujourd’hui : ${dur(me.today_minutes + (open ? Math.round((Date.now() - Date.parse(open.start)) / 60000) : 0))}</p></div>
    <div class="stats"><div class="stat"><strong>${me.tasks_open}</strong><small>tâche(s) en cours</small></div><div class="stat"><strong>${me.tasks_today}</strong><small>pour aujourd’hui</small></div><div class="stat"><strong>${h(me.employee.role)}</strong><small>poste</small></div></div>
    <h2>Mes prochaines tâches</h2>${todo.slice(0, 4).map(taskCard).join('') || '<p class="empty">Aucune tâche en attente. 🎉</p>'}${todo.length > 4 ? '<button class="btn full" id="allTasks">Voir toutes mes tâches</button>' : ''}`;
  $('#clockIn') && ($('#clockIn').onclick = safe(clock('in'))); $('#clockOut') && ($('#clockOut').onclick = safe(clock('out')));
  $('#allTasks') && ($('#allTasks').onclick = () => go('tasks')); bindTasks($('#v-home'));
  tick();
};
let tickT; function tick() { clearInterval(tickT); const f = () => { const n = $('#clockNow'); if (!n) return clearInterval(tickT); n.textContent = hhmm(Date.now()); const o = S.me.open, s = $('#since'); if (o && s) s.textContent = 'depuis ' + dur(Math.round((Date.now() - Date.parse(o.start)) / 60000)); }; f(); tickT = setInterval(f, 20000); }
const clock = action => async () => {
  let note = ''; if (action === 'out') { note = prompt('Une note sur votre journée ? (facultatif)') ?? ''; }
  await api('/api/staff/clock', { action, note }); toast(action === 'in' ? 'Arrivée enregistrée. Bonne journée !' : 'Départ enregistré. Merci et à demain !'); RENDER.home();
};

/* ---------- Tâches ---------- */
const badge = n => { const b = $('#tBadge'); b.textContent = n; b.classList.toggle('hidden', !n); };
function taskCard(t) {
  const L = t.link, late = t.due_at && t.status !== 'done' && Date.parse(t.due_at) < Date.now();
  return `<article class="card task ${t.priority} ${t.status}" data-id="${t.id}"><h3>${h(t.title)}</h3>
    <div class="meta"><span class="pill ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span> <span class="pill ${PRIO[t.priority][1]}">${PRIO[t.priority][0]}</span> ${t.due_at ? `📅 ${h(dt(t.due_at))}` : ''} ${late ? '<span class="pill bad">En retard</span>' : ''}</div>
    ${t.description ? `<p>${h(t.description).replace(/\n/g, '<br>')}</p>` : ''}
    ${L ? `<div class="link"><b>${L.kind === 'order' ? '🎁' : '🪑'} ${h(L.ref)} — ${h(L.title)}</b><br>${L.recipient ? `Pour <b>${h(L.recipient)}</b> · ` : ''}📍 ${h(L.city || '')}${L.address ? ', ' + h(L.address) : ''}<br>📅 ${h(dt(L.date))}${L.end ? ' → ' + h(dt(L.end)) : ''}
      ${L.items?.length ? `<br>📦 ${h(L.items.join(', '))}` : ''}${L.message ? `<br>💌 « ${h(L.message)} »` : ''}
      <br>${L.phone ? `<a href="tel:${h(L.phone)}">📞 Destinataire ${h(L.phone)}</a> · ` : ''}${L.client_phone ? `<a href="tel:${h(L.client_phone)}">📞 Client ${h(L.client)} ${h(L.client_phone)}</a>` : ''}
      ${L.address ? `<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((L.address || '') + ', ' + (L.city || '') + ', Haïti')}">🗺️ Itinéraire</a>` : ''}</div>` : ''}
    ${t.assignees.length > 1 ? `<div class="meta">👥 Avec ${h(t.assignees.filter(n => n !== S.me.employee.name).join(', '))}</div>` : ''}
    <div class="acts">${t.status === 'todo' ? '<button class="btn sm" data-s="in_progress">▶ Je commence</button>' : ''}${t.status !== 'done' ? '<button class="btn sm primary" data-s="done">✔ Terminé</button>' : '<button class="btn sm" data-s="in_progress">↺ Rouvrir</button>'}<button class="btn sm" data-s="note">💬 Note</button></div></article>`;
}
function bindTasks(root) {
  root.querySelectorAll('[data-s]').forEach(b => b.onclick = safe(async () => {
    const card = b.closest('.task'), id = card.dataset.id, s = b.dataset.s; let note = '';
    if (s === 'note' || s === 'done') { note = prompt(s === 'done' ? 'Un commentaire pour l’équipe ? (facultatif)' : 'Votre note :') ?? null; if (note === null) return; }
    const cur = ['todo', 'in_progress', 'done'].find(x => card.classList.contains(x));
    await api('/api/staff/tasks/update', { id, status: s === 'note' ? cur : s, note }); toast(s === 'done' ? 'Bravo, tâche terminée !' : 'Tâche mise à jour'); RENDER[S.view]();
  }));
}
RENDER.tasks = async () => {
  const tasks = await api('/api/staff/tasks'), open = tasks.filter(t => t.status !== 'done'), done = tasks.filter(t => t.status === 'done'); badge(open.length);
  $('#v-tasks').innerHTML = `<h2>Mes tâches</h2>${open.map(taskCard).join('') || '<p class="empty">Aucune tâche en cours.</p>'}${done.length ? `<h2>Terminées</h2>${done.slice(0, 20).map(taskCard).join('')}` : ''}`;
  bindTasks($('#v-tasks'));
};

/* ---------- Heures ---------- */
RENDER.time = async () => {
  const d = await api('/api/staff/time?month=' + S.month);
  $('#v-time').innerHTML = `<h2>Mes heures</h2><label>Mois<input type="month" id="mon" value="${S.month}"></label>
    <div class="stats"><div class="stat"><strong>${dur(d.total)}</strong><small>travaillées</small></div><div class="stat"><strong>${dur(d.approved)}</strong><small>validées</small></div><div class="stat"><strong>${d.days}</strong><small>jour(s)</small></div></div>
    <div class="card">${d.entries.map(t => `<div class="row"><span><b>${h(dt(t.start, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br><span class="muted">${hhmm(t.start)} → ${t.end ? hhmm(t.end) : 'en cours'}${t.break_minutes ? ' · pause ' + t.break_minutes + ' min' : ''}${t.note ? ' · ' + h(t.note) : ''}</span></span><span style="text-align:right">${t.end ? dur(t.minutes) : '—'}<br><span class="pill ${TIME[t.status][1]}">${TIME[t.status][0]}</span></span></div>`).join('') || '<p class="empty">Aucun pointage ce mois-ci.</p>'}</div>
    <p class="muted">Les heures sont validées par l’administration. Une erreur de pointage ? Signalez-la à votre responsable.</p>`;
  $('#mon').onchange = e => { S.month = e.target.value || S.month; RENDER.time(); };
};

/* ---------- Paie ---------- */
RENDER.pay = async () => {
  const d = await api('/api/staff/pay');
  $('#v-pay').innerHTML = `<h2>Ma paie</h2><div class="card"><div class="row"><span>Rémunération</span><b>${money(d.salary)} ${d.pay_type === 'daily' ? '/ jour' : '/ mois'}</b></div></div>
    ${d.slips.map(s => `<div class="card slip"><div class="row"><span><b>Fiche de paie ${h(s.period)}</b><br><span class="pill ${s.status === 'paid' ? 'ok' : 'warn'}">${s.status === 'paid' ? 'Payée' + (s.paid_at ? ' le ' + h(dt(s.paid_at.length === 10 ? s.paid_at + 'T12:00:00' : s.paid_at, { dateStyle: 'medium' })) : '') : 'En préparation'}</span></span><span class="big">${money(s.net)}</span></div>
      <div class="row"><span>Base${s.pay_type === 'daily' ? ` (${s.days} jour(s))` : ''}</span><span>${money(s.base)}</span></div>${s.bonus ? `<div class="row"><span>Primes</span><span>+ ${money(s.bonus)}</span></div>` : ''}${s.deductions ? `<div class="row"><span>Retenues</span><span>− ${money(s.deductions)}</span></div>` : ''}${s.advances ? `<div class="row"><span>Avances déduites</span><span>− ${money(s.advances)}</span></div>` : ''}${s.note ? `<p class="muted">${h(s.note)}</p>` : ''}</div>`).join('') || '<p class="empty">Aucune fiche de paie pour le moment.</p>'}
    ${d.advances.length ? `<h2>Mes avances</h2><div class="card">${d.advances.map(a => `<div class="row"><span>${h(dt(a.date + 'T12:00:00', { dateStyle: 'medium' }))}${a.note ? '<br><span class="muted">' + h(a.note) + '</span>' : ''}</span><span>${money(a.amount)}<br><span class="pill ${a.settled_in ? 'ok' : 'warn'}">${a.settled_in ? 'Remboursée' : 'À déduire'}</span></span></div>`).join('')}</div>` : ''}`;
};

/* ---------- Profil ---------- */
RENDER.me = async () => {
  const e = S.me.employee;
  $('#v-me').innerHTML = `<h2>Mon profil</h2><div class="card">${[['Nom', e.name], ['Poste', e.role], ['Service', e.department || '—'], ['Téléphone', e.phone], ['Courriel', S.me.user.email], ['Contrat', e.contract], ['Embauché le', e.hire_date ? dt(e.hire_date + 'T12:00:00', { dateStyle: 'long' }) : '—'], ['Paiement', e.pay_method || '—']].map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b>${h(v)}</b></div>`).join('')}</div>
    <p class="muted">Une information à corriger ? Prévenez l’administration.</p>
    <h2>Changer mon mot de passe</h2><form id="pwForm" class="card"><label>Mot de passe actuel<input type="password" name="current" required autocomplete="current-password"></label><label>Nouveau mot de passe<input type="password" name="password" required minlength="8" autocomplete="new-password"></label><button class="btn primary full">Enregistrer</button></form>
    <button class="btn full" id="logout">Se déconnecter</button>`;
  $('#pwForm').onsubmit = safe(async ev => { ev.preventDefault(); const f = new FormData(ev.target); await api('/api/staff/password', { current: f.get('current'), password: f.get('password') }); ev.target.reset(); toast('Mot de passe modifié'); });
  $('#logout').onclick = safe(async () => { await api('/api/auth/logout', {}); location.reload(); });
};

/* ---------- Démarrage ---------- */
const act = /^#activer=([a-f0-9]{64})$/.exec(location.hash);
if (act) { S.token = act[1]; $('#activate').classList.remove('hidden'); }
else start().catch(() => showLogin());
