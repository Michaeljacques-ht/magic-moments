// Magic Moments — espace d'administration (/admin)
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const h = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => new Intl.NumberFormat('fr-HT').format(Math.round(Number(n) || 0)) + ' HTG';
const fmtDate = v => v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('fr-CA', { dateStyle: 'medium' }) : '—';
const fmtDT = v => v ? new Date(v).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
const LABELS = { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', in_progress: 'En livraison', delivered: 'Livrée et installée', completed: 'Terminée', cancelled: 'Annulée', unpaid: 'Non payé', partial: 'Acompte payé', pending_verification: 'En vérification', paid: 'Payé', refunded: 'Remboursé' };
const PILL = { pending: 'warn', confirmed: '', preparing: '', in_progress: '', delivered: '', completed: 'ok', cancelled: 'grey', unpaid: 'warn', partial: 'warn', pending_verification: 'warn', paid: 'ok', refunded: 'grey' };
const pill = (v, map = PILL, lab = LABELS) => `<span class="pill ${map[v] || ''}">${h(lab[v] || v)}</span>`;

async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  let data; try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) { const e = Error(data.error || 'Erreur de connexion'); e.status = res.status; throw e; }
  return data;
}
const post = (url, body, method = 'POST') => api(url, { method, body: JSON.stringify(body) });
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(window.tt); window.tt = setTimeout(() => t.classList.add('hidden'), 5000); }
const safe = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message); } };

/* ---------- Formulaires génériques ---------- */
// Champ : { name, label, type, options:[[valeur, libellé]], required, placeholder, hint, min, rows }. Un tableau de champs = une ligne à 2 ou 3 colonnes.
function field(f, v) {
  if (Array.isArray(f)) return `<div class="grid${f.length === 3 ? 3 : 2}">${f.map(x => field(x, v)).join('')}</div>`;
  const val = v?.[f.name] ?? f.value ?? '', req = f.required ? 'required' : '', ph = f.placeholder ? `placeholder="${h(f.placeholder)}"` : '';
  const hint = f.hint ? `<p class="hint">${h(f.hint)}</p>` : '';
  if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.name}" ${val === true || (val === '' && f.checked) ? 'checked' : ''}> ${h(f.label)}</label>${hint}`;
  if (f.type === 'select') return `<label>${h(f.label)}<select name="${f.name}" ${req}>${f.options.map(([o, l]) => `<option value="${h(o)}" ${String(o) === String(val) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></label>${hint}`;
  if (f.type === 'textarea') return `<label>${h(f.label)}<textarea name="${f.name}" rows="${f.rows || 3}" ${req} ${ph}>${h(Array.isArray(val) ? val.join('\n') : val)}</textarea></label>${hint}`;
  return `<label>${h(f.label)}<input name="${f.name}" type="${f.type || 'text'}" value="${h(val)}" ${req} ${ph} ${f.min != null ? `min="${f.min}"` : ''} ${f.type === 'number' ? 'step="1"' : ''}></label>${hint}`;
}
function readForm(form, fields) {
  const out = {};
  for (const f of fields.flat()) {
    const el = form.elements[f.name]; if (!el) continue;
    out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : f.lines ? el.value.split('\n').map(x => x.trim()).filter(Boolean) : el.value.trim();
  }
  return out;
}
function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); $('#modal').scrollTop = 0; }
const closeModal = () => $('#modal').classList.add('hidden');
$('#modalClose').onclick = closeModal;
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
/** Ouvre un formulaire dans la fenêtre modale. onSubmit(valeurs, form) ; onRender(form) pour les parties sur mesure. */
function openForm({ title, fields, values = {}, before = '', extra = '', submit = 'Enregistrer', onSubmit, onRender, remove }) {
  openModal(title, `<form id="mform">${before}${fields.map(f => field(f, values)).join('')}${extra}<div class="form-actions">${remove ? '<button type="button" class="btn danger" id="mremove">Supprimer</button>' : ''}<button type="button" class="btn line" id="mcancel">Annuler</button><button class="btn primary">${h(submit)}</button></div></form>`);
  const form = $('#mform'); $('#mcancel').onclick = closeModal;
  if (remove) $('#mremove').onclick = safe(async () => { if (!confirm('Confirmer la suppression ?')) return; await remove(); closeModal(); });
  form.onsubmit = safe(async e => { e.preventDefault(); const btn = form.querySelector('button.primary'); btn.disabled = true; try { await onSubmit(readForm(form, fields), form); closeModal(); } finally { btn.disabled = false; } });
  onRender?.(form);
}

/* ---------- Envoi de fichiers ---------- */
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(Error('Image JPG, PNG ou WEBP requise'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Image illisible')); }; img.src = url;
  });
}
const uploadImage = async (file, kind = 'package') => (await post('/api/admin/media', { mime: 'image/jpeg', data: await resizeImage(file), title: file.name, kind })).id;
const readBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
async function uploadAttachment(file) {
  if (file.size > 10e6) throw Error('10 Mo maximum');
  const data = file.type.startsWith('image/') ? await resizeImage(file) : await readBase64(file);
  return (await post('/api/admin/files', { name: file.name, mime: file.type.startsWith('image/') ? 'image/jpeg' : file.type, data })).id;
}
const thumbHTML = (id, rm, wide) => `<span class="thumb ${wide ? 'wide' : ''}"><img src="/media/${h(id)}" alt=""><button type="button" data-rm="${h(rm)}" aria-label="Retirer">×</button></span>`;

/* ---------- Navigation ---------- */
const VIEWS = [
  { id: 'dashboard', ico: '📊', label: 'Tableau de bord' },
  { id: 'orders', ico: '🧾', label: 'Commandes', badge: d => d.orders_pending + d.payments_to_check + (d.express_today || 0) },
  { id: 'rentals', ico: '🪑', label: 'Locations', badge: d => d.rentals_pending + (d.rentals_to_check || 0) },
  { id: 'catalog', ico: '🎁', label: 'Catalogue', badge: d => d.to_price, tabs: [['packages', 'Surprises prêtes'], ['elements', 'Éléments à composer'], ['categories', 'Catégories'], ['equipment', 'Matériel de location'], ['music', 'Musiques (YouTube)'], ['shop', 'Boutique de cadeaux']] },
  { id: 'stock', ico: '📦', label: 'Stock', badge: d => d.stock_low || 0, tabs: [['overview', 'État du stock'], ['moves', 'Mouvements'], ['supplies', 'Fournitures']] },
  { id: 'content', ico: '🖼️', label: 'Site et contenu', tabs: [['contact', 'Coordonnées'], ['slides', 'Diaporama d’accueil'], ['announcements', 'Annonces'], ['gallery', 'Réalisations'], ['testimonials', 'Témoignages'], ['faq', 'FAQ']] },
  { id: 'hr', ico: '👥', label: 'Ressources humaines', badge: d => d.applications_new, tabs: [['recruit', 'Recrutement'], ['staff', 'Personnel'], ['tasks', 'Tâches'], ['time', 'Heures et pointage'], ['payroll', 'Paie et avances']] },
  { id: 'accounting', ico: '📒', label: 'Comptabilité', tabs: [['summary', 'Synthèse'], ['journal', 'Journal'], ['accounts', 'Comptes']] },
  { id: 'traffic', ico: '📍', label: 'Visites et connexions' },
  { id: 'settings', ico: '⚙️', label: 'Paramètres', tabs: [['general', 'Général'], ['payments', 'Moyens de paiement'], ['express', 'Cadeau express'], ['messages', 'Messages par étape']] }
];
const S = { view: 'dashboard', tab: {}, dash: null, settings: {}, period: { from: today().slice(0, 8) + '01', to: today() }, orderFilter: { q: '', status: 'open', pay: '' } };
// Menu vertical unique : les sous-sections s'affichent sous la rubrique ouverte.
function renderNav() {
  $('#sideNav').innerHTML = VIEWS.map(v => {
    const n = S.dash && v.badge ? v.badge(S.dash) : 0, open = v.id === S.view;
    const subs = v.tabs && open ? `<div class="sub">${v.tabs.map(([k, l]) => `<button type="button" data-view="${v.id}" data-tab="${k}" class="${S.tab[v.id] === k ? 'active' : ''}">${h(l)}</button>`).join('')}</div>` : '';
    return `<button type="button" data-view="${v.id}" class="${open && !v.tabs ? 'active' : open ? 'open' : ''}"><span class="ico">${v.ico}</span>${h(v.label)}${n ? `<span class="badge">${n}</span>` : ''}${v.tabs ? `<span class="chev">${open ? '▾' : '▸'}</span>` : ''}</button>${subs}`;
  }).join('');
}
$('#sideNav').onclick = e => { const b = e.target.closest('button[data-view]'); if (!b) return; const v = VIEWS.find(x => x.id === b.dataset.view); go(b.dataset.view, b.dataset.tab, !!v.tabs && !b.dataset.tab); };
$('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#backdrop').classList.add('show'); };
$('#backdrop').onclick = () => { $('#side').classList.remove('open'); $('#backdrop').classList.remove('show'); };
function go(view, tab, keepMenu = false) {
  S.view = view; const v = VIEWS.find(x => x.id === view); if (tab) S.tab[view] = tab; if (v.tabs && !S.tab[view]) S.tab[view] = v.tabs[0][0];
  if (!keepMenu) { $('#side').classList.remove('open'); $('#backdrop').classList.remove('show'); }
  $('#viewTitle').textContent = v.tabs ? v.tabs.find(([k]) => k === S.tab[view])[1] : v.label; $('#topActions').innerHTML = ''; renderNav();
  try { history.replaceState(null, '', '#' + view + (v.tabs ? '/' + S.tab[view] : '')); } catch {}
  render();
}
async function render() {
  const view = $('#view'); view.innerHTML = '<p class="empty">Chargement…</p>';
  try { await RENDER[S.view + (S.tab[S.view] ? ':' + S.tab[S.view] : '')]?.(view); } catch (e) { view.innerHTML = `<p class="warning">${h(e.message)}</p>`; }
}
const actions = html => { $('#topActions').innerHTML = html; };
async function refreshDash() { try { S.dash = await api('/api/admin/dashboard'); renderNav(); } catch {} }

const RENDER = {};

/* ============ Tableau de bord ============ */
RENDER.dashboard = async view => {
  const [d, st, cat] = await Promise.all([api('/api/admin/dashboard'), api('/api/settings'), api('/api/admin/catalog')]); S.dash = d; S.settings = st; renderNav();
  const warn = [];
  if (!st.whatsapp && !st.phone) warn.push(['Coordonnées de l’entreprise non renseignées (WhatsApp, téléphone).', 'content', 'contact']);
  if (!st.online_payment) warn.push(['Paiement en ligne PlopPlop non configuré : ajoutez PLOP_CLIENT_ID et PLOP_CLIENT_SECRET dans Render.', 'settings']);
  if (!(st.hero_slides || []).length) warn.push(['Diaporama d’accueil vide : ajoutez vos photos et affiches.', 'content', 'slides']);
  const noPhoto = cat.packages.filter(p => p.active !== false && !p.photo).length; if (noPhoto) warn.push([`${noPhoto} surprise(s) prête(s) sans photo.`, 'catalog', 'packages']);
  const todo = [
    [d.express_today, '⚡ cadeau(x) express à livrer aujourd’hui', 'orders'], [d.orders_pending, 'commande(s) à confirmer', 'orders'], [d.payments_to_check, 'paiement(s) à vérifier', 'orders'], [d.rentals_pending, 'location(s) à confirmer', 'rentals'],
    [d.applications_new, 'nouvelle(s) candidature(s)', 'hr', 'recruit'], [d.stock_low, 'article(s) à réapprovisionner (stock sous le seuil)', 'stock', 'overview'], [d.to_price, 'élément(s) du catalogue à tarifer', 'catalog', 'elements']
  ].filter(x => x[0]);
  const max = Math.max(1, ...d.months.flatMap(x => [x.income, x.expense]));
  view.innerHTML = `
    <div class="kpis">
      <div class="kpi accent"><small>Recettes du mois</small><strong>${money(d.month_income)}</strong></div>
      <div class="kpi"><small>Dépenses du mois</small><strong>${money(d.month_expense)}</strong></div>
      <div class="kpi ${d.month_result >= 0 ? 'good' : 'bad'}"><small>Résultat du mois</small><strong>${money(d.month_result)}</strong></div>
      <div class="kpi"><small>Trésorerie (tous comptes)</small><strong>${money(d.cash_total)}</strong></div>
      <div class="kpi"><small>À encaisser (commandes confirmées)</small><strong>${money(d.receivable)}</strong></div>
      <div class="kpi"><small>Salaires à payer</small><strong>${money(d.payroll_due)}</strong></div>
    </div>
    ${warn.map(([t, v, tab]) => `<p class="warning">${h(t)} <a href="#" data-go="${v}" data-tab="${tab || ''}">Corriger →</a></p>`).join('')}
    <div class="cards">
      <div class="card"><h3>✅ À faire</h3>${todo.length ? `<ul class="todo">${todo.map(([n, t, v, tab]) => `<li><span class="badge">${n}</span><span>${h(t)}</span><button class="btn sm line" data-go="${v}" data-tab="${tab || ''}">Ouvrir</button></li>`).join('')}</ul>` : '<p class="empty">Rien d’urgent. 🎉</p>'}</div>
      <div class="card"><h3>📅 Événements des 7 prochains jours</h3>${d.upcoming.length ? `<ul class="todo">${d.upcoming.map(o => `<li><span><b>${h(fmtDT(o.event_at))}</b><br>${h(o.package_name)} — ${h(o.recipient)} · ${h(o.city)}</span>${pill(o.payment_status)}</li>`).join('')}</ul>` : '<p class="empty">Aucun événement prévu.</p>'}</div>
      <div class="card"><h3>📈 Recettes et dépenses (6 mois)</h3><div class="bars">${d.months.map(x => `<div class="bar"><div class="cols"><div class="in" style="height:${x.income / max * 100}%" title="Recettes ${money(x.income)}"></div><div class="out" style="height:${x.expense / max * 100}%" title="Dépenses ${money(x.expense)}"></div></div><small>${x.month.slice(5)}/${x.month.slice(2, 4)}</small></div>`).join('')}</div><div class="legend"><span><i style="background:#2aa866"></i>Recettes</span><span><i style="background:#d9577a"></i>Dépenses</span></div></div>
    </div>`;
};
document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (!a) return; e.preventDefault(); go(a.dataset.go, a.dataset.tab || undefined); });

/* ============ Commandes ============ */
const lineText = x => [x.name, (x.choices || []).length ? '(' + x.choices.map(c => c.option + (c.price ? ' +' + c.price : '')).join(', ') + ')' : '', x.quantity ? '× ' + x.quantity : '', x.note ? '« ' + x.note + ' »' : '', x.price ? '= ' + money(x.price) : ''].filter(Boolean).join(' ');
RENDER.orders = async view => {
  const [orders, st] = await Promise.all([api('/api/orders'), api('/api/settings')]); S.settings = st;
  const f = S.orderFilter;
  const groups = { open: ['pending', 'confirmed', 'preparing', 'in_progress'], express: ['pending', 'confirmed', 'preparing', 'in_progress'], shop: null, pending: ['pending'], done: ['completed'], cancelled: ['cancelled'], all: null };
  const list = orders.filter(o => (!groups[f.status] || groups[f.status].includes(o.status)) && (f.status !== 'express' || o.express) && (f.status !== 'shop' || o.shop) && (!f.pay || (f.pay === 'unpaid' ? o.payment_status !== 'paid' : o.payment_status === f.pay)) && (!f.q || JSON.stringify([o.package_name, o.recipient, o.city, o.contact, o.id]).toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => (a.status === 'pending') - (b.status === 'pending') || 0).sort((a, b) => a.event_at.localeCompare(b.event_at)).sort((a, b) => (b.express && !['completed', 'cancelled'].includes(b.status)) - (a.express && !['completed', 'cancelled'].includes(a.status)));
  view.innerHTML = `<div class="toolbar"><label class="grow">Rechercher<input id="oq" value="${h(f.q)}" placeholder="Nom, téléphone, ville, référence…"></label>
    <label>Statut<select id="os">${[['open', 'En cours (à traiter)'], ['express', '⚡ Cadeaux express'], ['shop', '🛍️ Boutique'], ['pending', 'À confirmer'], ['done', 'Terminées'], ['cancelled', 'Annulées'], ['all', 'Toutes']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Paiement<select id="op">${[['', 'Tous'], ['unpaid', 'Non payées'], ['pending_verification', 'À vérifier'], ['paid', 'Payées']].map(([v, l]) => `<option value="${v}" ${f.pay === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="muted">${list.length} commande(s), triées par date d’événement.</p>
    <div class="list">${list.map(o => { const c = o.contact || {}; return `<article class="item"><div class="item-head"><div class="grow"><strong>${h(o.package_name)} — ${h(o.recipient)}</strong> ${o.express ? `<span class="pill express">⚡ Express ${h(o.express_date === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date()) ? 'aujourd’hui' : o.express_date)} · ${h(o.express_slot)}</span>` : ''} ${o.shop ? `<span class="pill shop">🛍️ Boutique · ${o.delivery === 'pickup' ? 'retrait' : 'livraison'}</span>` : ''} ${o.guest ? '<span class="pill">Sans compte</span>' : ''} ${o.lang === 'ht' ? '<span class="pill">Kreyòl</span>' : ''}
      <p>📅 ${h(fmtDT(o.event_at))} · 📍 ${h(o.city)} (${h(c.department || '')}) · 👤 ${h(c.sender_name || '')} ${h(c.sender_phone || '')}</p></div>
      <div style="text-align:right"><strong>${money(o.amount_due || o.total_htg)}</strong><br>${pill(o.status)} ${pill(o.payment_status)}</div></div>
      <details><summary>Détails et suivi</summary>
        <p><b>Contenu :</b> ${h((o.options || []).map(lineText).join(' ; ') || '—')}</p>
        <p><b>Client :</b> ${h(c.sender_name)} · ${h(c.sender_phone)} · ${h(c.sender_email)}</p>
        <p><b>Destinataire :</b> ${h(o.recipient)} · ${h(c.recipient_phone)}${c.alternate_phone ? ' · autre : ' + h(c.alternate_phone) : ''}</p>
        <p><b>Adresse :</b> ${h(o.address)}${c.landmark ? ' · ' + h(c.landmark) : ''}</p>
        ${o.message ? `<p><b>Carte :</b> « ${h(o.message)} » ${o.personalization?.sender ? '— ' + h(o.personalization.sender) : ''}</p>` : ''}
        <p><b>Préférences :</b> ${h(Object.entries(o.personalization || {}).filter(x => x[1] && !['sender', 'music_id', 'music_url'].includes(x[0])).map(x => x.join(' : ')).join(' · ') || '—')}${o.personalization?.music_url ? ` · <a href="${h(o.personalization.music_url)}" target="_blank" rel="noopener">▶ écouter la musique choisie</a>` : ''}</p>
        <p>Magic Live : ${o.live_requested ? 'demandé' : 'non'} · Réf. ${h(o.id.slice(0, 8))}</p>
        ${payBlock('order', o, o.amount_due || o.total_htg)}
        <div class="controls">
          <label>Statut<select data-k="status">${['pending', 'confirmed', 'preparing', 'in_progress', 'completed', 'cancelled'].map(v => `<option value="${v}" ${v === o.status ? 'selected' : ''}>${LABELS[v]}</option>`).join('')}</select></label>
          <label>Paiement<select data-k="payment_status">${['unpaid', 'partial', 'pending_verification', 'paid', 'refunded'].map(v => `<option value="${v}" ${v === o.payment_status ? 'selected' : ''}>${LABELS[v]}</option>`).join('')}</select></label>
          <label>Montant à payer<input data-k="amount_due" type="number" min="1" placeholder="${o.total_htg}" value="${o.amount_due || ''}"></label>
          <label>Lien Magic Live<input data-k="live_url" placeholder="https://…" value="${h(o.live_url || '')}"></label>
        </div>
        <div class="form-actions"><button class="btn primary sm save-order" data-id="${o.id}">Enregistrer</button>
          ${st.online_payment && o.pay_token ? `<button class="btn line sm copy-link" data-link="${h(location.origin + '/#payer=' + o.id + '.' + o.pay_token)}">Copier le lien de paiement</button>` : ''}
          <button class="btn line sm stage-msgs" data-kind="order" data-id="${o.id}">💬 Étapes et WhatsApp</button><button class="btn line sm mk-task" data-kind="order" data-id="${o.id}" data-title="${h('Livrer « ' + o.package_name + ' » à ' + o.recipient + ' — ' + o.city)}">📋 Confier une tâche</button>
          ${o.payment_status === 'paid' ? `<button class="btn line sm receipt" data-id="${o.id}">Reçu</button>` : ''}</div>
        <div class="stage-box" data-box="${o.id}"></div>
      </details></article>`; }).join('') || '<p class="empty">Aucune commande pour ce filtre.</p>'}</div>`;
  const upd = () => { f.q = $('#oq').value; f.status = $('#os').value; f.pay = $('#op').value; RENDER.orders(view).then(() => $('#oq').focus()); };
  $('#os').onchange = upd; $('#op').onchange = upd; let tm; $('#oq').oninput = () => { clearTimeout(tm); tm = setTimeout(upd, 350); };
  view.querySelectorAll('.save-order').forEach(b => b.onclick = safe(async () => {
    const box = b.closest('.item'), v = k => box.querySelector(`[data-k="${k}"]`).value.trim();
    if (v('payment_status') === 'paid' && !confirm('Confirmez avoir vérifié le montant et la transaction.')) return;
    await post('/api/admin/orders/' + b.dataset.id, { status: v('status'), payment_status: v('payment_status'), amount_due: Number(v('amount_due')) || null, live_url: v('live_url') || null }, 'PATCH');
    toast('Commande mise à jour'); refreshDash(); RENDER.orders(view);
  }));
};
document.addEventListener('click', safe(async e => {
  const c = e.target.closest('.copy-link'); if (c) { try { await navigator.clipboard.writeText(c.dataset.link); toast('Lien copié : collez-le dans WhatsApp.'); } catch { prompt('Lien de paiement', c.dataset.link); } return; }
  const r = e.target.closest('.receipt'); if (r) {
    const w = window.open('', '_blank'); const x = await api('/api/receipt/' + r.dataset.id);
    w.document.body.innerHTML = `<h1>Magic Moments — Reçu</h1><p>${h(x.number)}</p><p>Client : ${h(x.customer)}</p><p>Prestation : ${h(x.package)}</p><p>Contenu : ${h(x.options.map(lineText).join(' ; '))}</p><h2>Montant encaissé : ${money(x.total)}</h2><p>Date : ${h(fmtDT(x.date))}</p><p>Transaction : ${h(x.reference || 'Validation administrative')}</p>`; w.print();
  }
}));

/* ---------- Paiements reçus : acomptes, soldes, déclarations à vérifier ---------- */
const PART = { deposit: 'Acompte', full: 'Totalité', balance: 'Solde' };
const ATT = { paid: ['Reçu', 'ok'], declared: ['À vérifier', 'warn'], rejected: ['Refusé', 'bad'], pending: ['En ligne, en attente', 'grey'] };
function payBlock(kind, x, total) {
  const paid = x.amount_paid || (x.payment_status === 'paid' ? total : 0), rest = Math.max(0, total - paid);
  const rows = (x.payments || []).filter(a => a.status !== 'pending' || Date.now() - Date.parse(a.created_at) < 864e5).slice().reverse().map(a => `<li><span>${h(fmtDT(a.created_at))}</span> <b>${money(a.amount)}</b> ${PART[a.part] ? '· ' + PART[a.part] : ''} · ${h(a.method || (a.status === 'pending' ? 'PlopPlop' : '—'))} · ${h(a.declared_ref || a.transaction_id || a.reference)} <span class="pill ${ATT[a.status]?.[1] || ''}">${ATT[a.status]?.[0] || h(a.status)}</span>
    ${a.proof ? `<a href="/api/admin/files/${h(a.proof)}" target="_blank" rel="noopener">📎 Voir la preuve</a>` : ''}${a.reason ? ` <span class="muted">(${h(a.reason)})</span>` : ''}
    ${a.status === 'declared' ? `<span class="row-actions"><button type="button" class="btn sm primary pay-review" data-kind="${kind}" data-id="${x.id}" data-ref="${h(a.reference)}" data-ok="1">✔ Confirmer la réception</button><button type="button" class="btn sm line pay-review" data-kind="${kind}" data-id="${x.id}" data-ref="${h(a.reference)}" data-ok="0">Refuser</button></span>` : ''}</li>`).join('');
  return `<div class="paybox"><p><b>Paiement :</b> ${money(paid)} reçu sur ${money(total)}${rest && paid ? ` · <b>reste ${money(rest)}</b>` : ''} ${x.pay_method === 'cash' ? '· espèces à la livraison' : ''}</p>${rows ? `<ul class="paylist">${rows}</ul>` : ''}
    ${rest > 0 && x.status !== 'cancelled' ? `<button type="button" class="btn line sm pay-record" data-kind="${kind}" data-id="${x.id}" data-rest="${rest}">💵 Encaisser un montant (espèces, MonCash…)</button>` : ''}</div>`;
}
document.addEventListener('click', safe(async e => {
  const r = e.target.closest('.pay-review');
  if (r) {
    const ok = r.dataset.ok === '1'; let reason = '';
    if (ok && !confirm('Confirmez avoir vérifié la réception de ce montant sur votre compte.')) return;
    if (!ok && (reason = prompt('Motif du refus (visible dans la fiche) :', 'Transaction introuvable')) === null) return;
    await post('/api/admin/payments/review', { kind: r.dataset.kind, id: r.dataset.id, reference: r.dataset.ref, accept: ok, reason });
    toast(ok ? 'Paiement confirmé : le client reçoit son reçu.' : 'Déclaration refusée'); refreshDash(); render(); return;
  }
  const c = e.target.closest('.pay-record'); if (!c) return;
  openForm({ title: 'Encaisser un montant', values: { amount: Number(c.dataset.rest), account: 'caisse' },
    fields: [[{ name: 'amount', label: 'Montant reçu (HTG)', type: 'number', min: 1, required: true }, { name: 'account', label: 'Reçu sur', type: 'select', options: [['caisse', 'Espèces (caisse)'], ['moncash', 'MonCash'], ['natcash', 'NatCash'], ['banque', 'Banque'], ['plopplop', 'PlopPlop']] }],
      { name: 'note', label: 'Référence ou note (facultatif)', placeholder: 'Ex. espèces remises à la livraison' }],
    before: `<p class="hint">Reste à payer : ${money(Number(c.dataset.rest))}. Le client reçoit un reçu par courriel et l’écriture comptable est créée.</p>`,
    onSubmit: async v => { await post('/api/admin/payments/record', { kind: c.dataset.kind, id: c.dataset.id, amount: v.amount, account: v.account, note: v.note }); toast('Encaissement enregistré'); refreshDash(); render(); } });
}));

/* ============ Locations ============ */
RENDER.rentals = async view => {
  const [rentals, st] = await Promise.all([api('/api/rentals'), api('/api/settings')]);
  const f = S.rentalFilter ??= { status: 'open' }, groups = { open: ['pending', 'confirmed', 'delivered'], pending: ['pending'], done: ['completed'], cancelled: ['cancelled'], all: null };
  const list = rentals.filter(r => !groups[f.status] || groups[f.status].includes(r.status)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  view.innerHTML = `<div class="toolbar"><label>Statut<select id="rs">${[['open', 'En cours (à traiter)'], ['pending', 'À confirmer'], ['done', 'Terminées'], ['cancelled', 'Annulées'], ['all', 'Toutes']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="muted">${list.length} location(s), triées par date de début. Étapes : demande → confirmée (à payer) → payée → livrée et installée → récupérée.</p>
    <div class="list">${list.map(r => { const c = r.client || {}, pay = r.payment_status || 'unpaid', amount = r.amount_due || r.estimate || 0; return `<article class="item"><div class="item-head"><div class="grow"><strong>${r.items ? r.items.map(x => `${h(x.name)} × ${x.quantity}`).join(', ') : `${h(r.equipment_name)} × ${r.quantity}`}</strong> ${r.lang === 'ht' ? '<span class="pill">Kreyòl</span>' : ''}
      <p>📅 ${h(fmtDT(r.start_at))} → ${h(fmtDT(r.end_at))} · 📍 ${h(r.city)}${r.address ? ' — ' + h(r.address) : ''}</p><p>👤 ${h(c.name || '')} ${h(r.phone || c.phone || '')} ${h(c.email || '')}</p></div>
      <div style="text-align:right"><strong>${money(amount)}</strong>${r.days ? `<br><span class="muted">${r.days} jour(s)</span>` : ''}<br>${pill(r.status)} ${pill(pay)}</div></div>
      <details><summary>Suivi, paiement et messages</summary>
        ${r.note ? `<p><b>Note :</b> « ${h(r.note)} »</p>` : ''}
        <p>Réf. LOC-${h(r.id.slice(0, 8).toUpperCase())}</p>
        ${payBlock('rental', r, amount)}
        <div class="controls">
          <label>Étape<select data-k="status">${['pending', 'confirmed', 'delivered', 'completed', 'cancelled'].map(v => `<option value="${v}" ${v === r.status ? 'selected' : ''}>${LABELS[v]}</option>`).join('')}</select></label>
          <label>Paiement<select data-k="payment_status">${['unpaid', 'partial', 'pending_verification', 'paid', 'refunded'].map(v => `<option value="${v}" ${v === pay ? 'selected' : ''}>${LABELS[v]}</option>`).join('')}</select></label>
          <label>Montant à payer<input data-k="amount_due" type="number" min="1" placeholder="${r.estimate || ''}" value="${r.amount_due || ''}"></label>
        </div>
        <div class="form-actions"><button class="btn primary sm save-rental" data-id="${r.id}">Enregistrer</button>
          ${st.online_payment && r.pay_token ? `<button class="btn line sm copy-link" data-link="${h(location.origin + '/#payer-location=' + r.id + '.' + r.pay_token)}">Copier le lien de paiement</button>` : ''}
          <button class="btn line sm stage-msgs" data-kind="rental" data-id="${r.id}">💬 Étapes et WhatsApp</button><button class="btn line sm mk-task" data-kind="rental" data-id="${r.id}" data-title="${h('Livrer et installer : ' + r.equipment_name + ' — ' + r.city)}">📋 Confier une tâche</button></div>
        <div class="stage-box" data-box="${r.id}"></div>
      </details></article>`; }).join('') || '<p class="empty">Aucune location pour ce filtre.</p>'}</div>`;
  $('#rs').onchange = () => { f.status = $('#rs').value; RENDER.rentals(view); };
  view.querySelectorAll('.save-rental').forEach(b => b.onclick = safe(async () => {
    const box = b.closest('.item'), v = k => box.querySelector(`[data-k="${k}"]`).value.trim();
    if (v('payment_status') === 'paid' && !confirm('Confirmez avoir vérifié le montant et la transaction.')) return;
    await post('/api/admin/rentals/' + b.dataset.id, { status: v('status'), payment_status: v('payment_status'), amount_due: Number(v('amount_due')) || null }, 'PATCH');
    toast('Location mise à jour'); refreshDash(); RENDER.rentals(view);
  }));
};

/* ---------- Étapes et messages WhatsApp pré-enregistrés ---------- */
async function showStages(btn) {
  const box = document.querySelector(`.stage-box[data-box="${btn.dataset.id}"]`); if (!box) return;
  if (box.innerHTML) { box.innerHTML = ''; return; }
  const d = await api(`/api/admin/messages/${btn.dataset.kind}/${btn.dataset.id}`), steps = d.steps.filter(s => s.key !== 'cancelled'), i = steps.findIndex(s => s.current);
  box.innerHTML = `<ol class="stepper">${steps.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}"><span>${k < i ? '✓' : k + 1}</span><small>${h(s.label)}</small></li>`).join('')}</ol>
    ${d.client_phone ? '' : '<p class="warning">Aucun numéro WhatsApp client enregistré : utilisez « Copier » puis collez le message.</p>'}
    <div class="msg-list">${d.steps.map(s => `<div class="msg ${s.current ? 'current' : ''}"><div class="msg-head"><b>${h(s.label)}</b> ${s.current ? '<span class="pill ok">Étape actuelle</span>' : ''} <span class="pill ${s.email_active ? '' : 'grey'}">${s.email_active ? 'Courriel auto' : 'Courriel désactivé'}</span></div>
      <pre class="wa-text">${h(s.wa)}</pre><div class="form-actions">${s.wa_client ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${h(s.wa_client)}">WhatsApp client</a>` : ''}${s.wa_dest ? `<a class="btn line sm" target="_blank" rel="noopener" href="${h(s.wa_dest)}">WhatsApp destinataire</a>` : ''}<button type="button" class="btn line sm copy-text" data-text="${h(s.wa)}">Copier</button></div></div>`).join('')}</div>
    <p class="muted">Langue du client : ${d.lang === 'ht' ? 'Kreyòl' : 'Français'}. Textes modifiables dans Paramètres → Messages par étape.</p>`;
}
document.addEventListener('click', safe(async e => {
  const b = e.target.closest('.stage-msgs'); if (b) return showStages(b);
  const mt = e.target.closest('.mk-task'); if (mt) { const T = await api('/api/admin/team'); return taskForm(T, null, { title: mt.dataset.title, priority: 'normal', status: 'todo', link: (mt.dataset.kind === 'order' ? 'o:' : 'r:') + mt.dataset.id }); }
  const c = e.target.closest('.copy-text'); if (c) { try { await navigator.clipboard.writeText(c.dataset.text); toast('Message copié'); } catch { prompt('Message', c.dataset.text); } }
}));

/* ============ Catalogue ============ */
const statusPill = x => x.needs_price ? '<span class="pill warn">À tarifer</span>' : x.active === false ? '<span class="pill grey">Inactif</span>' : '<span class="pill ok">Actif</span>';
const visual = (photo, emoji = '🎁') => photo ? `<img class="mini-img" src="/media/${h(photo)}" alt="">` : `<span class="mini-img">${h(emoji)}</span>`;
let gallery = [];
RENDER['catalog:packages'] = async view => {
  const [cat, gal] = await Promise.all([api('/api/admin/catalog'), api('/api/gallery')]); gallery = gal;
  actions('<button class="btn primary" id="newPkg">＋ Nouvelle surprise prête</button>'); $('#newPkg').onclick = () => packageForm(null, cat.categories);
  view.innerHTML = `<table class="table"><thead><tr><th></th><th>Surprise</th><th>Catégorie</th><th class="num">Prix de départ</th><th>Kreyòl</th><th>Statut</th></tr></thead><tbody>${cat.packages.map(p => `<tr class="clickable" data-id="${p.id}"><td>${visual(p.photo, p.image)}</td><td data-l="Surprise"><b>${h(p.name)}</b><br><span class="muted">${h((p.photos || []).length + (p.photo ? 1 : 0))} photo(s)</span></td><td data-l="Catégorie">${h(p.category)}</td><td class="num" data-l="Prix">${p.needs_price ? '—' : money(p.price_htg)}</td><td data-l="Kreyòl">${p.name_ht ? '✓' : '<span class="pill warn">à traduire</span>'}</td><td>${statusPill(p)}</td></tr>`).join('')}</tbody></table>`;
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => packageForm(cat.packages.find(p => p.id === tr.dataset.id), cat.categories));
};
function packageForm(p, categories) {
  const media = { photo: p?.photo || '', photos: [...(p?.photos || [])] };
  const fields = [
    [{ name: 'name', label: 'Nom', required: true }, { name: 'category', label: 'Catégorie', type: 'select', options: categories.map(c => [c, c]) }],
    { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
    [{ name: 'price_htg', label: 'Prix de départ (HTG)', type: 'number', min: 1, required: true }, { name: 'guests', label: 'Invités / format', placeholder: 'Ex. Jusqu’à 20 invités' }, { name: 'lead_time', label: 'Délai pour commander', placeholder: 'Ex. 48 h à l’avance' }],
    { name: 'includes', label: 'Ce qui est inclus (une ligne par élément)', type: 'textarea', lines: true, placeholder: 'Exemple : Gâteau 8 parts' },
    { name: 'options', label: 'Options payantes (une par ligne : nom | prix HTG)', type: 'textarea', rows: 2, placeholder: 'Exemple : Bouquet de roses | 2500' },
    { name: 'active', label: 'Visible par les clients', type: 'checkbox', checked: true },
    { name: 'express', label: '⚡ Cadeau express : peut être livré le jour même', type: 'checkbox' }
  ];
  const ht = [{ name: 'name_ht', label: 'Nom (kreyòl)' }, { name: 'description_ht', label: 'Description (kreyòl)', type: 'textarea', rows: 2 }, { name: 'includes_ht', label: 'Inclus (kreyòl, une ligne par élément)', type: 'textarea', lines: true }, [{ name: 'guests_ht', label: 'Invités (kreyòl)' }, { name: 'lead_time_ht', label: 'Délai (kreyòl)' }]];
  const values = p ? { ...p, price_htg: p.needs_price ? '' : p.price_htg, active: p.active !== false || !!p.needs_price, options: (p.options || []).map(x => x.name + ' | ' + x.price).join('\n'), includes: (p.includes || []).join('\n'), includes_ht: (p.includes_ht || []).join('\n') } : { active: true };
  openForm({
    title: p ? 'Modifier : ' + p.name : 'Nouvelle surprise prête', fields: [...fields, ...ht], values,
    extra: `<div class="section-box"><b>Photos</b><label>Photo vignette (carte)<input type="file" id="pThumb" accept="image/*"></label><div class="thumbs" id="pThumbs"></div><label>Autres photos (plusieurs possibles, 12 maximum)<input type="file" id="pPhotos" accept="image/*" multiple></label><div class="thumbs" id="pPhotosList"></div></div>`,
    onRender: form => {
      const draw = () => { $('#pThumbs').innerHTML = media.photo ? thumbHTML(media.photo, 'thumb') : '<span class="muted">Aucune vignette.</span>'; $('#pPhotosList').innerHTML = media.photos.map((x, i) => thumbHTML(x, i)).join(''); };
      draw();
      $('#pThumbs').onclick = e => { if (e.target.dataset.rm) { media.photo = ''; draw(); } };
      $('#pPhotosList').onclick = e => { const i = e.target.dataset.rm; if (i !== undefined) { media.photos.splice(Number(i), 1); draw(); } };
      $('#pThumb').onchange = safe(async e => { const f = e.target.files[0]; if (!f) return; toast('Envoi…'); media.photo = await uploadImage(f); draw(); toast('Vignette ajoutée'); });
      $('#pPhotos').onchange = safe(async e => { for (const f of [...e.target.files].slice(0, 12 - media.photos.length)) { toast('Envoi des photos…'); media.photos.push(await uploadImage(f)); draw(); } toast('Photos ajoutées'); });
      // Les champs kreyòl sont regroupés dans une section repliable.
      const first = form.elements.name_ht.closest('label'); const box = document.createElement('details'); box.className = 'section-box'; box.innerHTML = '<summary><b>Version kreyòl</b></summary>';
      first.before(box); for (const n of ['name_ht', 'description_ht', 'includes_ht']) box.append(form.elements[n].closest('label')); box.append(form.elements.guests_ht.closest('.grid2'));
    },
    onSubmit: async v => {
      const options = (v.options || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => { const [name, price] = x.split('|'); return { name: name.trim(), price: Number((price || '').trim()) }; });
      await post('/api/admin/packages', { ...v, id: p?.id, options, price_htg: v.price_htg, photo: media.photo, photos: media.photos });
      toast('Surprise enregistrée'); refreshDash(); render();
    }
  });
}

RENDER['catalog:elements'] = async view => {
  const els = await api('/api/admin/elements');
  actions('<button class="btn primary" id="newEl">＋ Nouvel élément</button>'); $('#newEl').onclick = () => elementForm(null, els);
  const dims = [...new Set(els.map(e => e.category))];
  view.innerHTML = `<p class="muted">Les éléments que le client assemble dans « Créer une surprise », classés par dimension. Chaque option peut ajouter un supplément au prix de base.</p>` + dims.map(d => `<h3 style="margin:18px 0 8px">${h(d)}</h3><table class="table"><thead><tr><th></th><th>Élément</th><th class="num">Prix de base</th><th>Choix</th><th>Statut</th></tr></thead><tbody>${els.filter(e => e.category === d).map(e => `<tr class="clickable" data-id="${e.id}"><td>${visual(e.photo, '✦')}</td><td data-l="Élément"><b>${h(e.name)}</b>${e.name_ht ? '' : ' <span class="pill warn">kreyòl</span>'}</td><td class="num" data-l="Prix">${e.needs_price ? '—' : money(e.price)}</td><td data-l="Choix">${h((e.groups || []).map(g => g.name + ' (' + g.options.length + ')').join(', ') || '—')}</td><td>${statusPill(e)}</td></tr>`).join('')}</tbody></table>`).join('');
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => elementForm(els.find(e => e.id === tr.dataset.id), els));
};
function elementForm(x, els) {
  const media = { photo: x?.photo || '' }, dims = [...new Set(els.map(e => e.category))];
  const fields = [
    [{ name: 'name', label: 'Nom', required: true }, { name: 'name_ht', label: 'Nom (kreyòl)' }],
    [{ name: 'category', label: 'Dimension', required: true, placeholder: 'Ex. Pâtisserie' }, { name: 'category_ht', label: 'Dimension (kreyòl)', placeholder: 'Ex. Patisri' }],
    [{ name: 'description', label: 'Description', type: 'textarea', rows: 2 }, { name: 'description_ht', label: 'Description (kreyòl)', type: 'textarea', rows: 2 }],
    { name: 'price', label: 'Prix de base (HTG) — 0 si le prix dépend entièrement des options', type: 'number', min: 0, required: true },
    { name: 'active', label: 'Disponible pour les clients', type: 'checkbox', checked: true },
    { name: 'service', label: '🎶 Service inclus : proposé dans la section facultative « Services inclus » (livraison, animation, décoration…)', type: 'checkbox' }
  ];
  const group = (g = { name: '', name_ht: '', type: 'single', required: true, options: [] }) => `<div class="group-block" data-gid="${h(g.id || '')}"><div class="grid2"><label>Nom du choix<input class="g-name" value="${h(g.name)}" placeholder="Ex. Taille"></label><label>Nom (kreyòl)<input class="g-name-ht" value="${h(g.name_ht || '')}" placeholder="Ex. Gwosè"></label></div>
    <div class="grid2"><label>Type<select class="g-type"><option value="single" ${g.type === 'single' ? 'selected' : ''}>Un seul choix</option><option value="multi" ${g.type === 'multi' ? 'selected' : ''}>Plusieurs choix possibles</option></select></label><label class="check" style="margin-top:24px"><input type="checkbox" class="g-req" ${g.required ? 'checked' : ''}> Obligatoire</label></div>
    <label>Options — une par ligne : Nom | Nom kreyòl | Supplément HTG<textarea class="g-opts" rows="4" placeholder="Exemple : Grand | Gwo | 3000">${h(g.options.map(o => [o.name, o.name_ht || '', o.price].join(' | ')).join('\n'))}</textarea></label><button type="button" class="btn sm danger g-del">Supprimer ce choix</button></div>`;
  openForm({
    title: x ? 'Modifier : ' + x.name : 'Nouvel élément', fields, values: x ? { ...x, price: x.needs_price ? '' : x.price, active: x.active !== false || !!x.needs_price } : { active: true },
    extra: `<datalist id="dimList">${dims.map(d => `<option value="${h(d)}">`).join('')}</datalist><div class="section-box"><b>Photo</b><input type="file" id="eFile" accept="image/*"><div class="thumbs" id="eThumb"></div></div><div class="section-box"><b>Choix proposés au client (taille, saveur, couleur, extras…)</b><div id="groups">${(x?.groups || []).map(group).join('')}</div><button type="button" class="btn line" id="addG">＋ Ajouter un choix</button></div>`,
    onRender: form => {
      form.elements.category.setAttribute('list', 'dimList');
      const draw = () => { $('#eThumb').innerHTML = media.photo ? thumbHTML(media.photo, 'e') : '<span class="muted">Aucune photo.</span>'; }; draw();
      $('#eThumb').onclick = e => { if (e.target.dataset.rm) { media.photo = ''; draw(); } };
      $('#eFile').onchange = safe(async e => { const f = e.target.files[0]; if (f) { toast('Envoi…'); media.photo = await uploadImage(f); draw(); toast('Photo ajoutée'); } });
      $('#addG').onclick = () => $('#groups').insertAdjacentHTML('beforeend', group());
      $('#groups').onclick = e => { if (e.target.closest('.g-del')) e.target.closest('.group-block').remove(); };
    },
    onSubmit: async v => {
      const groups = $$('#groups .group-block').map(d => ({ id: d.dataset.gid || undefined, name: d.querySelector('.g-name').value.trim(), name_ht: d.querySelector('.g-name-ht').value.trim(), type: d.querySelector('.g-type').value, required: d.querySelector('.g-req').checked,
        options: d.querySelector('.g-opts').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split('|').map(s => s.trim()), last = p[p.length - 1], hasPrice = p.length > 1 && /^\d+$/.test(last); return { name: p[0], name_ht: p.length === 3 || (p.length === 2 && !hasPrice) ? p[1] : '', price: hasPrice ? Number(last) : 0 }; }) }));
      await post('/api/admin/elements', { ...v, id: x?.id, photo: media.photo, groups }); toast('Élément enregistré'); refreshDash(); render();
    }
  });
}

RENDER['catalog:categories'] = async view => {
  const cats = await api('/api/categories?full=1');
  actions('<button class="btn primary" id="newCat">＋ Nouvelle catégorie</button>');
  const form = c => openForm({ title: c ? 'Catégorie : ' + c.name : 'Nouvelle catégorie', fields: [[{ name: 'name', label: 'Nom (français)', required: true }, { name: 'name_ht', label: 'Nom (kreyòl)' }]], values: c || {}, onRender: f => { if (c) f.elements.name.readOnly = true; }, onSubmit: async v => { await post('/api/admin/categories', { ...v, translate: !!c }); toast('Catégorie enregistrée'); render(); } });
  $('#newCat').onclick = () => form(null);
  view.innerHTML = `<table class="table"><thead><tr><th>Catégorie</th><th>Kreyòl</th></tr></thead><tbody>${cats.map(c => `<tr class="clickable" data-n="${h(c.name)}"><td><b>${h(c.name)}</b></td><td>${h(c.name_ht) || '<span class="pill warn">à traduire</span>'}</td></tr>`).join('')}</tbody></table>`;
  view.querySelectorAll('tr[data-n]').forEach(tr => tr.onclick = () => form(cats.find(c => c.name === tr.dataset.n)));
};

RENDER['catalog:equipment'] = async view => {
  const eq = await api('/api/admin/equipment');
  actions('<button class="btn primary" id="newEq">＋ Nouveau matériel</button>');
  const form = x => { const media = { photo: x?.photo || '' }; openForm({ title: x ? x.name : 'Nouveau matériel', fields: [[{ name: 'name', label: 'Nom', required: true }, { name: 'name_ht', label: 'Nom (kreyòl)' }], [{ name: 'stock', label: 'Stock disponible', type: 'number', min: 0, required: true }, { name: 'daily_price_htg', label: 'Prix par jour (HTG)', type: 'number', min: 1, required: true }], { name: 'active', label: 'Proposé à la location', type: 'checkbox', checked: true }],
    extra: '<div class="section-box"><b>Vignette (photo du matériel)</b><input type="file" id="qFile" accept="image/*"><div class="thumbs" id="qThumb"></div></div>',
    onRender: () => { const draw = () => { $('#qThumb').innerHTML = media.photo ? thumbHTML(media.photo, 'q') : '<span class="muted">Aucune vignette : la carte affiche un pictogramme.</span>'; }; draw(); $('#qThumb').onclick = e => { if (e.target.dataset.rm) { media.photo = ''; draw(); } }; $('#qFile').onchange = safe(async e => { const f = e.target.files[0]; if (f) { toast('Envoi…'); media.photo = await uploadImage(f); draw(); toast('Vignette ajoutée'); } }); },
    values: x ? { ...x, daily_price_htg: x.needs_price ? '' : x.daily_price_htg, active: x.active !== false || !!x.needs_price } : { active: true }, onSubmit: async v => { await post('/api/admin/equipment', { ...v, id: x?.id, photo: media.photo }); toast('Matériel enregistré'); refreshDash(); render(); } }); };
  $('#newEq').onclick = () => form(null);
  view.innerHTML = `<table class="table"><thead><tr><th></th><th>Matériel</th><th class="num">Stock</th><th class="num">Prix / jour</th><th>Statut</th></tr></thead><tbody>${eq.map(x => `<tr class="clickable" data-id="${x.id}"><td>${visual(x.photo, '🪑')}</td><td><b>${h(x.name)}</b></td><td class="num" data-l="Stock">${x.stock}</td><td class="num" data-l="Prix">${x.needs_price ? '—' : money(x.daily_price_htg)}</td><td>${statusPill(x)}</td></tr>`).join('')}</tbody></table>`;
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(eq.find(x => x.id === tr.dataset.id)));
};

/* ============ Site et contenu ============ */
const CONTACT_FIELDS = [
  [{ name: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '+509 …' }, { name: 'phone', label: 'Téléphone', type: 'tel' }, { name: 'email', label: 'Courriel', type: 'email' }],
  { name: 'address', label: 'Adresse' },
  [{ name: 'zone', label: 'Zone desservie', placeholder: 'Ex. Saint-Marc, Port-au-Prince et environs' }, { name: 'zone_ht', label: 'Zone desservie (kreyòl)' }],
  [{ name: 'hours', label: 'Horaires', placeholder: 'Ex. Lundi à samedi, 8 h à 18 h' }, { name: 'hours_ht', label: 'Horaires (kreyòl)' }],
  [{ name: 'facebook', label: 'Facebook (https://…)' }, { name: 'instagram', label: 'Instagram (https://…)' }, { name: 'tiktok', label: 'TikTok (https://…)' }],
  { name: 'payments', label: 'Moyens de paiement affichés (séparés par des virgules)', placeholder: 'MonCash, NatCash, Espèces' },
  [{ name: 'about', label: 'Présentation courte', type: 'textarea', rows: 2 }, { name: 'about_ht', label: 'Présentation courte (kreyòl)', type: 'textarea', rows: 2 }]
];
RENDER['content:contact'] = async view => {
  const st = await api('/api/settings'); S.settings = st;
  view.innerHTML = `<form class="card" id="cform">${CONTACT_FIELDS.map(f => field(f, st)).join('')}<div class="form-actions"><button class="btn primary">Enregistrer les coordonnées</button></div></form>`;
  $('#cform').onsubmit = safe(async e => { e.preventDefault(); const v = readForm(e.target, CONTACT_FIELDS); await post('/api/admin/settings', { ...v, hero_media: st.hero_media || '' }); toast('Coordonnées enregistrées'); });
};

RENDER['content:slides'] = async view => {
  const st = await api('/api/settings'); let slides = [...(st.hero_slides || [])];
  const draw = () => {
    view.innerHTML = `<div class="card"><h3>Diaporama de l’accueil <span class="muted" style="font-weight:500">— photos et affiches qui défilent sur la page d’accueil (10 maximum)</span></h3>
      <label>Ajouter des images (plusieurs possibles)<input type="file" id="sFiles" accept="image/*" multiple></label>
      ${slides.map((s, i) => `<div class="slide-row" data-i="${i}"><span class="thumb wide"><img src="/media/${h(s.media)}" alt=""></span><div class="grid2"><label>Légende (facultatif)<input class="s-cap" value="${h(s.caption)}" maxlength="140"></label><label>Légende (kreyòl)<input class="s-cap-ht" value="${h(s.caption_ht)}" maxlength="140"></label></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn sm line" data-mv="-1">↑</button><button type="button" class="btn sm line" data-mv="1">↓</button><button type="button" class="btn sm danger" data-del>Retirer</button></div></div>`).join('') || '<p class="empty">Aucune image : le logo s’affiche à l’accueil.</p>'}
      <div class="form-actions"><button class="btn primary" id="sSave">Enregistrer le diaporama</button></div></div>`;
    const sync = () => $$('.slide-row').forEach(r => { const s = slides[r.dataset.i]; s.caption = r.querySelector('.s-cap').value; s.caption_ht = r.querySelector('.s-cap-ht').value; });
    view.querySelectorAll('.slide-row').forEach(r => r.onclick = e => { const i = Number(r.dataset.i); if (e.target.dataset.mv) { sync(); const j = i + Number(e.target.dataset.mv); if (j >= 0 && j < slides.length) { [slides[i], slides[j]] = [slides[j], slides[i]]; draw(); } } if (e.target.hasAttribute('data-del')) { sync(); slides.splice(i, 1); draw(); } });
    $('#sFiles').onchange = safe(async e => { sync(); for (const f of [...e.target.files].slice(0, 10 - slides.length)) { toast('Envoi des images…'); slides.push({ media: await uploadImage(f, 'hero'), caption: '', caption_ht: '' }); } draw(); toast('Images ajoutées — cliquez sur « Enregistrer le diaporama »'); });
    $('#sSave').onclick = safe(async () => { sync(); slides = await post('/api/admin/slides', { slides }); toast('Diaporama enregistré'); draw(); });
  };
  draw();
};

RENDER['content:announcements'] = async view => {
  const list = await api('/api/admin/announcements');
  actions('<button class="btn primary" id="newAnn">＋ Nouvelle annonce</button>');
  const form = a => openForm({ title: a ? 'Modifier l’annonce' : 'Nouvelle annonce', remove: a && (async () => { await post('/api/admin/announcements/remove', { id: a.id }); toast('Annonce supprimée'); render(); }),
    fields: [{ name: 'text', label: 'Texte de l’annonce (240 caractères maximum)', type: 'textarea', rows: 2, required: true }, { name: 'text_ht', label: 'Texte en kreyòl', type: 'textarea', rows: 2 }, { name: 'link', label: 'Lien (facultatif)', placeholder: '#catalogue ou https://…', hint: 'Sections du site : #catalogue, #commander, #location, #contact' }, [{ name: 'start', label: 'Afficher à partir du', type: 'date' }, { name: 'end', label: 'Jusqu’au', type: 'date' }], { name: 'active', label: 'Annonce active', type: 'checkbox', checked: true }],
    values: a || { active: true }, onSubmit: async v => { await post('/api/admin/announcements', { ...v, id: a?.id }); toast('Annonce enregistrée'); render(); } });
  $('#newAnn').onclick = () => form(null);
  const d = today(), state = a => !a.active ? ['Désactivée', 'grey'] : a.end && a.end < d ? ['Terminée', 'grey'] : a.start && a.start > d ? ['Programmée', 'warn'] : ['En ligne', 'ok'];
  view.innerHTML = `<p class="muted">Les annonces en ligne défilent dans une bande sous le menu du site, en français ou en kreyòl selon la langue du visiteur.</p>` + (list.length ? `<table class="table"><thead><tr><th>Annonce</th><th>Période</th><th>Statut</th></tr></thead><tbody>${list.map(a => `<tr class="clickable" data-id="${a.id}"><td><b>${h(a.text)}</b>${a.text_ht ? '' : ' <span class="pill warn">kreyòl</span>'}</td><td data-l="Période">${a.start ? h(fmtDate(a.start)) : '—'} → ${a.end ? h(fmtDate(a.end)) : '—'}</td><td><span class="pill ${state(a)[1]}">${state(a)[0]}</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune annonce.</p>');
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(list.find(a => a.id === tr.dataset.id)));
};

RENDER['content:gallery'] = async view => {
  const gal = await api('/api/gallery');
  actions('<button class="btn primary" id="newMedia">＋ Publier une réalisation</button>');
  $('#newMedia').onclick = () => openForm({ title: 'Publier une réalisation', fields: [{ name: 'title', label: 'Titre', required: true }, { name: 'consent', label: 'Autorisations de publication obtenues (personnes visibles)', type: 'checkbox' }], extra: '<label>Photo ou vidéo (20 Mo maximum)<input type="file" id="gFile" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required></label>',
    onSubmit: async v => { const file = $('#gFile').files[0]; if (!file) throw Error('Choisissez un fichier'); if (file.size > 20e6) throw Error('20 Mo maximum'); const isImg = file.type.startsWith('image/'); await post('/api/admin/gallery', { title: v.title, consent: v.consent, mime: isImg ? 'image/jpeg' : file.type, data: isImg ? await resizeImage(file, 2000) : await readBase64(file) }); toast('Réalisation publiée'); render(); } });
  view.innerHTML = gal.length ? `<div class="cards">${gal.map(g => `<div class="card">${g.mime.startsWith('video/') ? `<video src="/media/${h(g.id)}" controls preload="metadata" style="width:100%;border-radius:10px"></video>` : `<img src="/media/${h(g.id)}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px">`}<p><b>${h(g.title)}</b></p><button class="btn sm danger rm-media" data-id="${g.id}">Retirer</button></div>`).join('')}</div>` : '<p class="empty">Aucune réalisation publiée.</p>';
  view.querySelectorAll('.rm-media').forEach(b => b.onclick = safe(async () => { if (!confirm('Retirer ce média ?')) return; await post('/api/admin/gallery/remove', { id: b.dataset.id }); toast('Média retiré'); render(); }));
};

RENDER['content:testimonials'] = async view => {
  const list = await api('/api/testimonials');
  actions('<button class="btn primary" id="newT">＋ Ajouter un témoignage</button>');
  $('#newT').onclick = () => openForm({ title: 'Témoignage client', before: '<p class="hint">Uniquement des avis réels, avec l’accord du client.</p>', fields: [[{ name: 'name', label: 'Nom affiché', required: true, placeholder: 'Ex. Nadège P.' }, { name: 'city', label: 'Ville' }, { name: 'occasion', label: 'Occasion' }], { name: 'text', label: 'Témoignage', type: 'textarea', required: true }], onSubmit: async v => { await post('/api/admin/testimonials', v); toast('Témoignage ajouté'); render(); } });
  view.innerHTML = list.length ? `<div class="list">${list.map(t => `<div class="item"><div class="item-head"><div class="grow"><strong>${h(t.name)}</strong> <span class="muted">${h([t.occasion, t.city].filter(Boolean).join(', '))}</span><p>« ${h(t.text)} »</p></div><button class="btn sm danger rm-t" data-id="${t.id}">Retirer</button></div></div>`).join('')}</div>` : '<p class="empty">Aucun témoignage : la section « Avis » est masquée sur le site.</p>';
  view.querySelectorAll('.rm-t').forEach(b => b.onclick = safe(async () => { if (!confirm('Retirer ce témoignage ?')) return; await post('/api/admin/testimonials/remove', { id: b.dataset.id }); render(); }));
};

/* ============ Ressources humaines ============ */
const APP_LABELS = { new: 'Nouvelle', shortlisted: 'Présélectionnée', interview: 'Entretien', hired: 'Embauchée', rejected: 'Refusée' };
const APP_PILL = { new: 'warn', shortlisted: '', interview: '', hired: 'ok', rejected: 'grey' };
let HR = null, ACCOUNTS = [];
const loadHR = async () => (HR = await api('/api/admin/hr'));
const loadAccounts = async () => { if (!ACCOUNTS.length) ACCOUNTS = (await api('/api/admin/accounting')).accounts; return ACCOUNTS; };
const accountOptions = () => ACCOUNTS.map(a => [a.id, a.name]);

RENDER['hr:recruit'] = async view => {
  await loadHR();
  actions('<button class="btn primary" id="newJob">＋ Nouvelle offre d’emploi</button>'); $('#newJob').onclick = () => jobForm(null);
  const f = S.appFilter ||= { job: '', status: '' };
  const apps = HR.applications.filter(a => (!f.job || a.job_id === f.job) && (!f.status || a.status === f.status));
  view.innerHTML = `<div class="card" style="margin-bottom:16px"><h3>📢 Offres d’emploi <span class="muted" style="font-weight:500">— publiées dans « Carrières » sur le site</span></h3>${HR.jobs.length ? `<table class="table"><thead><tr><th>Poste</th><th>Type</th><th>Date limite</th><th>Candidatures</th><th>Statut</th></tr></thead><tbody>${HR.jobs.map(j => `<tr class="clickable" data-job="${j.id}"><td><b>${h(j.title)}</b><br><span class="muted">${h(j.location)}</span></td><td data-l="Type">${h(j.type)}</td><td data-l="Date limite">${h(fmtDate(j.deadline))}</td><td data-l="Candidatures">${HR.applications.filter(a => a.job_id === j.id).length}</td><td>${j.status === 'open' ? '<span class="pill ok">Ouverte</span>' : '<span class="pill grey">Fermée</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune offre.</p>'}</div>
    <div class="toolbar"><label>Offre<select id="fJob"><option value="">Toutes</option>${HR.jobs.map(j => `<option value="${j.id}" ${f.job === j.id ? 'selected' : ''}>${h(j.title)}</option>`).join('')}</select></label><label>Statut<select id="fSt"><option value="">Tous</option>${Object.entries(APP_LABELS).map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="list">${apps.map(a => `<div class="item"><div class="item-head"><div class="grow"><strong>${h(a.name)}</strong> <span class="pill ${APP_PILL[a.status]}">${APP_LABELS[a.status]}</span><p>${h(a.job_title)} · reçue le ${h(fmtDate(a.created_at))}</p><p>📞 ${h(a.phone)} · ✉️ ${h(a.email)}</p></div>${a.cv ? `<a class="btn sm line" href="/api/admin/files/${a.cv}">📄 CV</a>` : ''}</div>
      ${a.message ? `<details><summary>Message du candidat</summary><p>${h(a.message)}</p></details>` : ''}
      <div class="controls"><label>Statut<select class="a-st">${Object.entries(APP_LABELS).map(([k, l]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label style="grid-column:span 2">Notes internes<input class="a-notes" value="${h(a.notes)}"></label></div>
      <div class="form-actions"><button class="btn sm primary a-save" data-id="${a.id}">Enregistrer</button>${a.status !== 'hired' ? `<button class="btn sm gold a-hire" data-id="${a.id}">Embaucher → fiche du personnel</button>` : ''}<a class="btn sm line" target="_blank" rel="noopener" href="https://wa.me/${h(a.phone.replace(/\D/g, '').replace(/^(\d{8})$/, '509$1'))}">WhatsApp</a></div></div>`).join('') || '<p class="empty">Aucune candidature.</p>'}</div>`;
  view.querySelectorAll('tr[data-job]').forEach(tr => tr.onclick = () => jobForm(HR.jobs.find(j => j.id === tr.dataset.job)));
  $('#fJob').onchange = () => { f.job = $('#fJob').value; render(); }; $('#fSt').onchange = () => { f.status = $('#fSt').value; render(); };
  view.querySelectorAll('.a-save').forEach(b => b.onclick = safe(async () => { const box = b.closest('.item'); await post('/api/admin/applications/update', { id: b.dataset.id, status: box.querySelector('.a-st').value, notes: box.querySelector('.a-notes').value }); toast('Candidature mise à jour'); refreshDash(); render(); }));
  view.querySelectorAll('.a-hire').forEach(b => b.onclick = () => { const a = HR.applications.find(x => x.id === b.dataset.id); employeeForm(null, { name: a.name, phone: a.phone, email: a.email, role: a.job_title, hire_date: today(), status: 'active', contract: 'CDI', pay_type: 'monthly', from_application: a.id }); });
};
function jobForm(j) {
  openForm({ title: j ? 'Offre : ' + j.title : 'Nouvelle offre d’emploi', remove: j && (async () => { await post('/api/admin/jobs/remove', { id: j.id }); toast('Offre supprimée'); render(); }),
    fields: [[{ name: 'title', label: 'Intitulé du poste', required: true }, { name: 'title_ht', label: 'Intitulé (kreyòl)' }], [{ name: 'type', label: 'Type', type: 'select', options: HR.job_types.map(x => [x, x]) }, { name: 'location', label: 'Lieu', placeholder: 'Ex. Saint-Marc' }, { name: 'department', label: 'Service', placeholder: 'Ex. Décoration' }],
      { name: 'description', label: 'Description du poste', type: 'textarea', rows: 4, required: true }, { name: 'description_ht', label: 'Description (kreyòl)', type: 'textarea', rows: 3 },
      [{ name: 'requirements', label: 'Profil recherché', type: 'textarea' }, { name: 'requirements_ht', label: 'Profil (kreyòl)', type: 'textarea' }],
      [{ name: 'salary', label: 'Rémunération (facultatif)', placeholder: 'Ex. À discuter' }, { name: 'deadline', label: 'Date limite', type: 'date' }, { name: 'status', label: 'Statut', type: 'select', options: [['open', 'Ouverte (publiée)'], ['closed', 'Fermée']] }]],
    values: j || { status: 'open', type: 'Temps plein' }, onSubmit: async v => { await post('/api/admin/jobs', { ...v, id: j?.id }); toast('Offre enregistrée'); render(); } });
}

RENDER['hr:staff'] = async view => {
  await loadHR(); await loadAccounts();
  actions('<button class="btn primary" id="newEmp">＋ Nouvel employé</button>'); $('#newEmp').onclick = () => employeeForm(null);
  const act = HR.employees.filter(e => e.status === 'active'), mass = act.reduce((a, e) => a + (e.pay_type === 'daily' ? e.salary * 26 : e.salary), 0);
  view.innerHTML = `<div class="kpis"><div class="kpi accent"><small>Employés actifs</small><strong>${act.length}</strong></div><div class="kpi"><small>Masse salariale mensuelle estimée</small><strong>${money(mass)}</strong></div><div class="kpi"><small>Avances non remboursées</small><strong>${money(HR.advances.filter(a => !a.settled_in).reduce((x, a) => x + a.amount, 0))}</strong></div></div>
    ${HR.employees.length ? `<table class="table"><thead><tr><th>Nom</th><th>Poste</th><th>Contrat</th><th class="num">Salaire</th><th>Paiement</th><th>Statut</th><th></th></tr></thead><tbody>${HR.employees.map(e => `<tr><td data-l="Nom"><b>${h(e.name)}</b><br><span class="muted">${h(e.phone)}</span></td><td data-l="Poste">${h(e.role)}${e.department ? '<br><span class="muted">' + h(e.department) + '</span>' : ''}</td><td data-l="Contrat">${h(e.contract)}<br><span class="muted">depuis ${h(fmtDate(e.hire_date))}</span></td><td class="num" data-l="Salaire">${money(e.salary)}${e.pay_type === 'daily' ? ' / jour' : ' / mois'}</td><td data-l="Paiement">${h(e.pay_method || '—')}</td><td>${e.status === 'active' ? '<span class="pill ok">Actif</span>' : '<span class="pill grey">Sorti</span>'}</td><td><button class="btn sm line e-edit" data-id="${e.id}">Fiche</button> <button class="btn sm line e-adv" data-id="${e.id}">Avance</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucun employé enregistré.</p>'}`;
  view.querySelectorAll('.e-edit').forEach(b => b.onclick = () => employeeForm(HR.employees.find(e => e.id === b.dataset.id)));
  view.querySelectorAll('.e-adv').forEach(b => b.onclick = () => advanceForm(HR.employees.find(e => e.id === b.dataset.id)));
  const team = await api('/api/admin/team');
  view.querySelectorAll('.e-edit').forEach(b => { const x = team.employees.find(e => e.id === b.dataset.id); if (!x) return;
    b.insertAdjacentHTML('afterend', ` <button class="btn line sm e-acc" data-id="${x.id}">${x.account ? (x.account.disabled ? '🔒 Accès coupé' : '🔑 Espace actif') : '🔑 Créer l’accès'}</button>${x.clocked_in ? ' <span class="pill ok">Au travail</span>' : ''}`); });
  view.querySelectorAll('.e-acc').forEach(b => b.onclick = () => accessForm(team.employees.find(e => e.id === b.dataset.id)));
};
function accessForm(x) {
  const a = x.account;
  openForm({ title: 'Espace employé — ' + x.name, values: { email: a?.email || x.email || '' }, fields: [{ name: 'email', label: 'Courriel de connexion', type: 'email', required: true }],
    before: `<p class="hint">L’employé se connecte sur <b>${h(location.origin)}/equipe</b> : il y voit ses tâches, pointe son arrivée et son départ, suit ses heures et consulte ses fiches de paie.</p>
      ${a ? `<p>${a.disabled ? '<span class="pill bad">Accès coupé</span>' : '<span class="pill ok">Accès actif</span>'} ${a.last_login ? 'Dernière connexion : ' + h(fmtDT(a.last_login)) : 'Jamais connecté'}${a.invited_at ? ' · invitation du ' + h(fmtDT(a.invited_at)) : ''}</p>` : ''}`,
    extra: a ? `<p><button type="button" class="btn line sm" id="accToggle">${a.disabled ? 'Rétablir l’accès' : 'Couper l’accès'}</button></p>` : '',
    submit: a ? 'Renvoyer l’invitation' : 'Créer l’accès et envoyer l’invitation',
    onRender: () => { $('#accToggle') && ($('#accToggle').onclick = safe(async () => { await post('/api/admin/team/access', { employee_id: x.id, action: a.disabled ? 'enable' : 'disable' }); closeModal(); toast(a.disabled ? 'Accès rétabli' : 'Accès coupé'); render(); })); },
    onSubmit: async v => { const r = await post('/api/admin/team/access', { employee_id: x.id, email: v.email, action: 'invite' }); toast('Invitation envoyée par courriel');
      setTimeout(() => prompt('Lien d’activation (à envoyer aussi par WhatsApp si besoin, valable 7 jours) :', r.link), 200); render(); } });
}
function employeeForm(e, preset = {}) {
  openForm({ title: e ? 'Fiche : ' + e.name : 'Nouvel employé',
    fields: [[{ name: 'name', label: 'Nom complet', required: true }, { name: 'role', label: 'Poste', required: true }, { name: 'department', label: 'Service' }],
      [{ name: 'phone', label: 'Téléphone', type: 'tel', required: true }, { name: 'email', label: 'Courriel', type: 'email' }, { name: 'emergency', label: 'Contact d’urgence' }], { name: 'address', label: 'Adresse' },
      [{ name: 'contract', label: 'Contrat', type: 'select', options: HR.contracts.map(x => [x, x]) }, { name: 'hire_date', label: 'Date d’embauche', type: 'date', required: true }, { name: 'end_date', label: 'Date de fin (si connue)', type: 'date' }],
      [{ name: 'pay_type', label: 'Rémunération', type: 'select', options: [['monthly', 'Salaire mensuel'], ['daily', 'Taux journalier']] }, { name: 'salary', label: 'Montant (HTG)', type: 'number', min: 1, required: true }, { name: 'status', label: 'Statut', type: 'select', options: [['active', 'Actif'], ['inactive', 'Sorti / inactif']] }],
      [{ name: 'pay_method', label: 'Mode de paiement', type: 'select', options: [['MonCash', 'MonCash'], ['NatCash', 'NatCash'], ['Espèces', 'Espèces'], ['Virement bancaire', 'Virement bancaire'], ['Chèque', 'Chèque']] }, { name: 'pay_account', label: 'Numéro MonCash / NatCash ou banque' }],
      { name: 'notes', label: 'Notes (compétences, observations…)', type: 'textarea', rows: 2 }],
    values: e || { contract: 'CDI', pay_type: 'monthly', status: 'active', hire_date: today(), ...preset },
    onSubmit: async v => { await post('/api/admin/employees', { ...v, id: e?.id, from_application: preset.from_application }); toast('Fiche enregistrée'); refreshDash(); if (S.view === 'hr' && S.tab.hr !== 'staff') go('hr', 'staff'); else render(); } });
}
function advanceForm(e) {
  openForm({ title: 'Avance sur salaire — ' + e.name, before: '<p class="hint">L’avance est enregistrée en dépense et déduite automatiquement de la prochaine fiche de paie.</p>',
    fields: [[{ name: 'amount', label: 'Montant (HTG)', type: 'number', min: 1, required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'account', label: 'Payée depuis', type: 'select', options: accountOptions() }], { name: 'note', label: 'Motif' }],
    values: { date: today(), account: 'caisse' }, onSubmit: async v => { await post('/api/admin/advances', { ...v, employee_id: e.id }); toast('Avance enregistrée'); render(); } });
}

/* ---------- Tâches du personnel ---------- */
const PRIO_PILL = { low: 'grey', normal: '', high: 'bad' }, TASK_PILL = { todo: 'warn', in_progress: '', done: 'ok', cancelled: 'grey' };
function taskForm(T, t, preset = {}) {
  const v = t ? { ...t, due_at: t.due_at ? new Date(new Date(t.due_at).getTime() - new Date(t.due_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '', link: t.order_id ? 'o:' + t.order_id : t.rental_id ? 'r:' + t.rental_id : '' } : { priority: 'normal', status: 'todo', ...preset };
  const chosen = new Set(t?.employee_ids || preset.employee_ids || []), active = T.employees.filter(e => e.status === 'active' || chosen.has(e.id));
  openForm({ title: t ? 'Tâche : ' + t.title : 'Nouvelle tâche', values: v,
    fields: [{ name: 'title', label: 'Tâche', required: true, placeholder: 'Ex. Livrer la surprise de Marie à Delmas' }, { name: 'description', label: 'Consignes', type: 'textarea', rows: 3 },
      [{ name: 'priority', label: 'Priorité', type: 'select', options: Object.entries(T.priorities) }, { name: 'due_at', label: 'À faire pour le', type: 'datetime-local' }, { name: 'status', label: 'Statut', type: 'select', options: Object.entries(T.statuses) }],
      { name: 'link', label: 'Liée à (facultatif)', type: 'select', options: [['', '— Aucune —'], ...T.orders.map(o => ['o:' + o.id, '🎁 ' + o.label]), ...T.rentals.map(r => ['r:' + r.id, '🪑 ' + r.label])] }],
    before: `<div class="section-box"><b>Confier à</b><div class="check-list">${active.map(e => `<label class="check"><input type="checkbox" class="tEmp" value="${e.id}" ${chosen.has(e.id) ? 'checked' : ''}> ${h(e.name)} <span class="muted">${h(e.role)}${e.account && !e.account.disabled ? '' : ' · sans espace'}</span></label>`).join('') || '<p class="muted">Ajoutez d’abord des employés.</p>'}</div></div>`,
    extra: t?.comments?.length ? `<div class="section-box"><b>Suivi</b>${t.comments.map(c => `<p>${h(fmtDT(c.at))} — <b>${h(c.by)}</b> : ${h(T.statuses[c.status] || '')}${c.note ? ' · « ' + h(c.note) + ' »' : ''}</p>`).join('')}</div>` : '',
    remove: t ? async () => { await post('/api/admin/tasks/remove', { id: t.id }); toast('Tâche supprimée'); render(); } : null,
    onSubmit: async f => { const ids = [...document.querySelectorAll('.tEmp:checked')].map(x => x.value); if (!ids.length) throw Error('Choisissez au moins un employé');
      await post('/api/admin/tasks', { id: t?.id, title: f.title, description: f.description, priority: f.priority, status: f.status, due_at: f.due_at ? new Date(f.due_at).toISOString() : null, employee_ids: ids, order_id: f.link?.startsWith('o:') ? f.link.slice(2) : null, rental_id: f.link?.startsWith('r:') ? f.link.slice(2) : null });
      toast('Tâche enregistrée — l’employé est prévenu par courriel'); if (S.view === 'hr' && S.tab.hr === 'tasks') render(); } });
}
RENDER['hr:tasks'] = async view => {
  const T = await api('/api/admin/team'), f = S.taskFilter ??= { status: 'open', emp: '' };
  actions('<button class="btn primary" id="newTask">＋ Nouvelle tâche</button>'); $('#newTask').onclick = () => taskForm(T, null);
  const list = T.tasks.filter(t => (f.status === 'all' || (f.status === 'open' ? ['todo', 'in_progress'].includes(t.status) : t.status === f.status)) && (!f.emp || t.employee_ids.includes(f.emp)))
    .sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || String(a.due_at || '9').localeCompare(String(b.due_at || '9')));
  view.innerHTML = `<div class="toolbar"><label>Statut<select id="tS">${[['open', 'À faire et en cours'], ['done', 'Terminées'], ['all', 'Toutes']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Employé<select id="tE"><option value="">Tous</option>${T.employees.map(e => `<option value="${e.id}" ${f.emp === e.id ? 'selected' : ''}>${h(e.name)}</option>`).join('')}</select></label></div>
    <div class="list">${list.map(t => `<article class="item clickable" data-id="${t.id}"><div class="item-head"><div class="grow"><strong>${h(t.title)}</strong> <span class="pill ${PRIO_PILL[t.priority]}">${h(T.priorities[t.priority])}</span>
      <p>👤 ${h(t.assignees.join(', '))}${t.due_at ? ' · 📅 ' + h(fmtDT(t.due_at)) : ''}${t.link ? ` · ${t.link.kind === 'order' ? '🎁' : '🪑'} ${h(t.link.ref)} ${h(t.link.city || '')}` : ''}</p>${t.comments?.length ? `<p class="muted">Dernier suivi : ${h(t.comments.at(-1).by)} — ${h(t.comments.at(-1).note || T.statuses[t.comments.at(-1).status])}</p>` : ''}</div>
      <div><span class="pill ${TASK_PILL[t.status]}">${h(T.statuses[t.status])}</span>${t.due_at && t.status !== 'done' && Date.parse(t.due_at) < Date.now() ? ' <span class="pill bad">En retard</span>' : ''}</div></div></article>`).join('') || '<p class="empty">Aucune tâche pour ce filtre.</p>'}</div>`;
  $('#tS').onchange = e => { f.status = e.target.value; render(); }; $('#tE').onchange = e => { f.emp = e.target.value; render(); };
  view.querySelectorAll('[data-id]').forEach(x => x.onclick = () => taskForm(T, T.tasks.find(t => t.id === x.dataset.id)));
};
/* ---------- Heures et pointage ---------- */
const dur = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
const hhmm = iso => iso ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'America/Port-au-Prince', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '';
function timeForm(T, x) {
  openForm({ title: x ? 'Corriger le pointage' : 'Ajouter des heures', values: x ? { employee_id: x.employee_id, date: x.date, start: hhmm(x.start), end: hhmm(x.end), break_minutes: x.break_minutes || 0, status: x.status === 'pending' ? 'approved' : x.status, note: x.note } : { date: today(), start: '08:00', end: '17:00', break_minutes: 60, status: 'approved' },
    fields: [[{ name: 'employee_id', label: 'Employé', type: 'select', options: T.employees.map(e => [e.id, e.name]) }, { name: 'date', label: 'Date', type: 'date', required: true }],
      [{ name: 'start', label: 'Arrivée', type: 'time', required: true }, { name: 'end', label: 'Départ', type: 'time' }, { name: 'break_minutes', label: 'Pause (minutes)', type: 'number', min: 0 }],
      [{ name: 'status', label: 'Statut', type: 'select', options: [['approved', 'Validé'], ['pending', 'À valider'], ['rejected', 'Refusé']] }, { name: 'note', label: 'Note' }]],
    remove: x ? async () => { await post('/api/admin/time/remove', { id: x.id }); toast('Pointage supprimé'); render(); } : null,
    onSubmit: async v => { await post('/api/admin/time', { ...v, id: x?.id, break_minutes: Number(v.break_minutes || 0) }); toast('Heures enregistrées'); render(); } });
}
RENDER['hr:time'] = async view => {
  const T = await api('/api/admin/team'), f = S.timeFilter ??= { month: today().slice(0, 7), emp: '' };
  actions('<button class="btn primary" id="newTime">＋ Ajouter des heures</button>'); $('#newTime').onclick = () => timeForm(T, null);
  const list = T.time.filter(t => t.date.startsWith(f.month) && (!f.emp || t.employee_id === f.emp)), pend = list.filter(t => t.status === 'pending' && t.end);
  const per = {}; for (const t of list) { const k = t.employee_id; per[k] ??= { name: t.name, min: 0, ok: 0, days: new Set() }; per[k].min += t.minutes; if (t.status === 'approved') { per[k].ok += t.minutes; per[k].days.add(t.date); } }
  view.innerHTML = `<div class="toolbar"><label>Mois<input type="month" id="tmM" value="${f.month}"></label><label>Employé<select id="tmE"><option value="">Tous</option>${T.employees.map(e => `<option value="${e.id}" ${f.emp === e.id ? 'selected' : ''}>${h(e.name)}</option>`).join('')}</select></label>${pend.length ? `<button class="btn primary" id="tmAll">✔ Valider les ${pend.length} pointage(s) en attente</button>` : ''}</div>
    <div class="kpis">${Object.values(per).map(x => `<div class="kpi"><small>${h(x.name)}</small><strong>${dur(x.ok)}</strong><small>${x.days.size} jour(s) validé(s)${x.min > x.ok ? ' · ' + dur(x.min - x.ok) + ' à valider' : ''}</small></div>`).join('') || '<p class="muted">Aucun pointage ce mois-ci.</p>'}</div>
    <table class="table"><thead><tr><th>Date</th><th>Employé</th><th>Arrivée → départ</th><th class="num">Durée</th><th>Source</th><th>Statut</th><th></th></tr></thead><tbody>${list.map(t => `<tr><td>${h(t.date)}</td><td>${h(t.name)}</td><td>${hhmm(t.start)} → ${t.end ? hhmm(t.end) : '<span class="pill ok">en cours</span>'}${t.break_minutes ? ` <span class="muted">(pause ${t.break_minutes} min)</span>` : ''}${t.note ? `<br><span class="muted">${h(t.note)}</span>` : ''}</td><td class="num" data-l="Durée">${t.end ? dur(t.minutes) : '—'}</td><td>${t.source === 'clock' ? '📱 Pointage' : t.source === 'manual' ? '✍️ Saisie admin' : '✍️ Pointage corrigé'}</td>
      <td><span class="pill ${{ approved: 'ok', pending: 'warn', rejected: 'bad' }[t.status]}">${{ approved: 'Validé', pending: 'À valider', rejected: 'Refusé' }[t.status]}</span></td><td><span class="row-actions">${t.status !== 'approved' && t.end ? `<button class="btn sm primary tmOk" data-id="${t.id}">✔</button>` : ''}${t.status === 'pending' && t.end ? `<button class="btn sm line tmNo" data-id="${t.id}">✖</button>` : ''}<button class="btn sm line tmEd" data-id="${t.id}">✎</button></span></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun pointage.</td></tr>'}</tbody></table>
    <p class="muted">Les jours validés d’un employé payé à la journée sont repris automatiquement lors de la génération de la paie du mois.</p>`;
  const st = async (ids, status) => { await post('/api/admin/time/status', { ids, status }); toast(status === 'approved' ? 'Heures validées' : 'Pointage refusé'); render(); };
  $('#tmM').onchange = e => { f.month = e.target.value || today().slice(0, 7); render(); }; $('#tmE').onchange = e => { f.emp = e.target.value; render(); };
  $('#tmAll') && ($('#tmAll').onclick = safe(() => st(pend.map(t => t.id), 'approved')));
  view.querySelectorAll('.tmOk').forEach(b => b.onclick = safe(() => st([b.dataset.id], 'approved')));
  view.querySelectorAll('.tmNo').forEach(b => b.onclick = safe(() => st([b.dataset.id], 'rejected')));
  view.querySelectorAll('.tmEd').forEach(b => b.onclick = () => timeForm(T, list.find(t => t.id === b.dataset.id)));
};

RENDER['hr:payroll'] = async view => {
  await loadHR(); await loadAccounts();
  S.payPeriod ||= today().slice(0, 7);
  const slips = HR.payroll.filter(s => s.period === S.payPeriod), tot = k => slips.reduce((a, s) => a + s[k], 0);
  actions(`<label style="margin:0">Mois<input type="month" id="pPer" value="${S.payPeriod}"></label><button class="btn primary" id="pGen">Préparer la paie du mois</button>`);
  $('#pPer').onchange = () => { S.payPeriod = $('#pPer').value; render(); };
  $('#pGen').onclick = safe(async () => { const r = await post('/api/admin/payroll/generate', { period: S.payPeriod }); toast(r.created ? r.created + ' fiche(s) de paie préparée(s)' : 'Toutes les fiches de ce mois existent déjà'); refreshDash(); render(); });
  view.innerHTML = `<div class="kpis"><div class="kpi"><small>Brut du mois</small><strong>${money(tot('gross'))}</strong></div><div class="kpi"><small>Avances déduites</small><strong>${money(tot('advances'))}</strong></div><div class="kpi accent"><small>Net à verser</small><strong>${money(tot('net'))}</strong></div><div class="kpi ${slips.some(s => s.status === 'draft') ? 'bad' : 'good'}"><small>Restant à payer</small><strong>${money(slips.filter(s => s.status === 'draft').reduce((a, s) => a + s.net, 0))}</strong></div></div>
    ${slips.length ? `<table class="table"><thead><tr><th>Employé</th><th class="num">Base</th><th class="num">Primes</th><th class="num">Retenues</th><th class="num">Avances</th><th class="num">Net</th><th>Statut</th><th></th></tr></thead><tbody>${slips.map(s => `<tr><td data-l="Employé"><b>${h(s.name)}</b><br><span class="muted">${h(s.role)}${s.pay_type === 'daily' ? ' · ' + s.days + ' jour(s)' : ''}</span></td><td class="num" data-l="Base">${money(s.base)}</td><td class="num" data-l="Primes">${money(s.bonus)}</td><td class="num" data-l="Retenues">${money(s.deductions)}</td><td class="num" data-l="Avances">${money(s.advances)}</td><td class="num" data-l="Net"><b>${money(s.net)}</b></td><td>${s.status === 'paid' ? `<span class="pill ok">Payé ${h(fmtDate(s.paid_at))}</span>` : '<span class="pill warn">À payer</span>'}</td><td><button class="btn sm line s-open" data-id="${s.id}">${s.status === 'paid' ? 'Fiche' : 'Ajuster / payer'}</button></td></tr>`).join('')}</tbody></table>` : `<p class="empty">Aucune fiche pour ${h(S.payPeriod)}. Cliquez sur « Préparer la paie du mois » : une fiche est créée pour chaque employé actif, avec déduction des avances.</p>`}
    <div class="card" style="margin-top:16px"><h3>💵 Avances récentes</h3>${HR.advances.length ? `<table class="table"><thead><tr><th>Employé</th><th>Date</th><th class="num">Montant</th><th>Motif</th><th>Statut</th></tr></thead><tbody>${HR.advances.slice(0, 15).map(a => `<tr><td>${h(a.name)}</td><td data-l="Date">${h(fmtDate(a.date))}</td><td class="num" data-l="Montant">${money(a.amount)}</td><td data-l="Motif">${h(a.note || '—')}</td><td>${a.settled_in ? '<span class="pill ok">Déduite</span>' : '<span class="pill warn">À déduire</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune avance. Elles se saisissent depuis l’onglet Personnel.</p>'}</div>`;
  view.querySelectorAll('.s-open').forEach(b => b.onclick = () => slipForm(HR.payroll.find(s => s.id === b.dataset.id)));
};
function printSlip(s) {
  const e = HR.employees.find(x => x.id === s.employee_id) || {}, acc = ACCOUNTS.find(a => a.id === s.account)?.name || '';
  const w = window.open('', '_blank'); if (!w) return toast('Autorisez les fenêtres contextuelles');
  w.document.body.innerHTML = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>Magic Moments — Fiche de paie</h2><p><b>Période :</b> ${h(s.period)}<br><b>Employé :</b> ${h(s.name)} — ${h(s.role)}<br><b>Contrat :</b> ${h(e.contract || '')} · embauché le ${h(fmtDate(e.hire_date))}</p>
    <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><tr><td>Salaire de base${s.pay_type === 'daily' ? ` (${s.days} jours × ${money(s.rate)})` : ''}</td><td align="right">${money(s.base)}</td></tr><tr><td>Primes</td><td align="right">${money(s.bonus)}</td></tr><tr><td><b>Brut</b></td><td align="right"><b>${money(s.gross)}</b></td></tr><tr><td>Retenues</td><td align="right">− ${money(s.deductions)}</td></tr><tr><td>Avances déduites</td><td align="right">− ${money(s.advances)}</td></tr><tr><td><b>Net versé</b></td><td align="right"><b>${money(s.net)}</b></td></tr></table>
    <p>${s.status === 'paid' ? `Payé le ${h(fmtDate(s.paid_at))} · ${h(acc)} ${s.reference ? '· réf. ' + h(s.reference) : ''}` : 'Non encore payé'}</p>${s.note ? `<p>Note : ${h(s.note)}</p>` : ''}<p style="margin-top:50px">Signature de l’employé : ______________________</p></div>`;
  w.print();
}
function slipForm(s) {
  if (s.status === 'paid') return printSlip(s);
  openForm({ title: `Paie ${s.period} — ${s.name}`, before: `<p class="hint">Base : ${money(s.base)}${s.pay_type === 'daily' ? ` (${money(s.rate)} par jour)` : ''} · Avances à déduire : ${money(s.advances)}</p>`,
    fields: [[...(s.pay_type === 'daily' ? [{ name: 'days', label: 'Jours travaillés', type: 'number', min: 0 }] : []), { name: 'bonus', label: 'Primes (HTG)', type: 'number', min: 0 }, { name: 'deductions', label: 'Retenues (HTG)', type: 'number', min: 0 }], { name: 'note', label: 'Note' }],
    values: s, submit: 'Enregistrer les ajustements', remove: async () => { await post('/api/admin/payroll/remove', { id: s.id }); toast('Fiche supprimée'); render(); },
    extra: `<div class="section-box"><b>Verser le salaire</b><div class="grid3"><label>Date<input type="date" id="payDate" value="${today()}"></label><label>Payé depuis<select id="payAcc">${accountOptions().map(([v, l]) => `<option value="${v}">${h(l)}</option>`).join('')}</select></label><label>Référence<input id="payRef" placeholder="N° transaction"></label></div><button type="button" class="btn gold" id="payNow">Enregistrer les ajustements et marquer payé</button> <button type="button" class="btn line" id="slipPrint">Aperçu de la fiche</button></div>`,
    onRender: form => {
      $('#slipPrint').onclick = () => printSlip(s);
      $('#payNow').onclick = safe(async () => { const v = readForm(form, [{ name: 'days', type: 'number' }, { name: 'bonus', type: 'number' }, { name: 'deductions', type: 'number' }, { name: 'note' }]); await post('/api/admin/payroll/update', { id: s.id, days: v.days ?? 0, bonus: v.bonus || 0, deductions: v.deductions || 0, note: v.note }); const paid = await post('/api/admin/payroll/pay', { id: s.id, date: $('#payDate').value, account: $('#payAcc').value, reference: $('#payRef').value }); closeModal(); toast('Salaire payé et enregistré en comptabilité'); refreshDash(); await loadHR(); printSlip(paid); render(); });
    },
    onSubmit: async v => { await post('/api/admin/payroll/update', { id: s.id, days: v.days ?? 0, bonus: v.bonus || 0, deductions: v.deductions || 0, note: v.note }); toast('Fiche mise à jour'); render(); } });
}

/* ============ Comptabilité ============ */
let ACC = null;
async function loadAcc() { const { from, to } = S.period; ACC = await api(`/api/admin/accounting?from=${from}&to=${to}`); ACCOUNTS = ACC.accounts; return ACC; }
function periodBar() {
  const { from, to } = S.period, y = today().slice(0, 4), m = today().slice(0, 7), prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1); const pm = prev.toISOString().slice(0, 7);
  const lastDay = ym => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
  actions(`<label style="margin:0">Du<input type="date" id="aFrom" value="${from}"></label><label style="margin:0">Au<input type="date" id="aTo" value="${to}"></label>
    <select id="aQuick" style="width:auto;margin-top:18px"><option value="">Période rapide…</option><option value="${m}-01|${today()}">Ce mois</option><option value="${pm}-01|${pm}-${lastDay(pm)}">Mois dernier</option><option value="${y}-01-01|${today()}">Cette année</option><option value="${Number(y) - 1}-01-01|${Number(y) - 1}-12-31">Année dernière</option></select>
    <a class="btn line" style="margin-top:18px" href="/api/admin/accounting/export?from=${from}&to=${to}">⬇ Export Excel (CSV)</a>`);
  const set = (f, t) => { S.period = { from: f, to: t }; render(); };
  $('#aFrom').onchange = () => set($('#aFrom').value, $('#aTo').value); $('#aTo').onchange = () => set($('#aFrom').value, $('#aTo').value);
  $('#aQuick').onchange = () => { const [f, t] = $('#aQuick').value.split('|'); if (f) set(f, t); };
}
RENDER['accounting:summary'] = async view => {
  await loadAcc(); periodBar(); const a = ACC, max = Math.max(1, ...a.months.flatMap(x => [x.income, x.expense]));
  view.innerHTML = `<div class="kpis"><div class="kpi accent"><small>Recettes de la période</small><strong>${money(a.income)}</strong></div><div class="kpi"><small>Dépenses de la période</small><strong>${money(a.expense)}</strong></div><div class="kpi ${a.result >= 0 ? 'good' : 'bad'}"><small>Résultat</small><strong>${money(a.result)}</strong></div><div class="kpi"><small>Trésorerie au ${h(fmtDate(a.to))}</small><strong>${money(a.cash_total)}</strong></div><div class="kpi"><small>Créances clients (à encaisser)</small><strong>${money(a.receivable)}</strong></div><div class="kpi"><small>Salaires à payer</small><strong>${money(a.payroll_due)}</strong></div></div>
    <div class="cards"><div class="card"><h3>🏦 Soldes des comptes</h3><table class="table"><tbody>${a.accounts.map(x => `<tr><td>${h(x.name)}</td><td class="num ${x.balance < 0 ? 'amount-out' : ''}">${money(x.balance)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>${money(a.cash_total)}</b></td></tr></tbody></table></div>
    <div class="card"><h3>📊 Par catégorie</h3>${a.categories.length ? `<table class="table"><tbody>${a.categories.map(c => `<tr><td>${h(c.category)}</td><td class="num ${c.type === 'income' ? 'amount-in' : 'amount-out'}">${c.type === 'income' ? '+' : '−'} ${money(c.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune écriture sur la période.</p>'}</div>
    <div class="card"><h3>📈 12 derniers mois</h3><div class="bars">${a.months.map(x => `<div class="bar"><div class="cols"><div class="in" style="height:${x.income / max * 100}%" title="${money(x.income)}"></div><div class="out" style="height:${x.expense / max * 100}%" title="${money(x.expense)}"></div></div><small>${x.month.slice(5)}</small></div>`).join('')}</div><div class="legend"><span><i style="background:#2aa866"></i>Recettes</span><span><i style="background:#d9577a"></i>Dépenses</span></div></div></div>`;
};
RENDER['accounting:journal'] = async view => {
  await loadAcc(); periodBar();
  $('#topActions').insertAdjacentHTML('afterbegin', '<button class="btn primary" data-new="income" style="margin-top:18px">＋ Recette</button><button class="btn danger" data-new="expense" style="margin-top:18px">＋ Dépense</button><button class="btn line" data-new="transfer" style="margin-top:18px">⇄ Virement</button>');
  $$('[data-new]').forEach(b => b.onclick = () => entryForm(null, b.dataset.new));
  const f = S.jf ||= { type: '', account: '', q: '' }, name = Object.fromEntries(ACC.accounts.map(a => [a.id, a.name]));
  const list = ACC.entries.filter(e => (!f.type || e.type === f.type) && (!f.account || e.account === f.account || e.to_account === f.account) && (!f.q || (e.label + e.category).toLowerCase().includes(f.q.toLowerCase())));
  view.innerHTML = `<div class="toolbar"><label class="grow">Rechercher<input id="jq" value="${h(f.q)}" placeholder="Libellé, catégorie…"></label><label>Type<select id="jt"><option value="">Tous</option><option value="income" ${f.type === 'income' ? 'selected' : ''}>Recettes</option><option value="expense" ${f.type === 'expense' ? 'selected' : ''}>Dépenses</option><option value="transfer" ${f.type === 'transfer' ? 'selected' : ''}>Virements</option></select></label><label>Compte<select id="ja"><option value="">Tous</option>${ACC.accounts.map(a => `<option value="${a.id}" ${f.account === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select></label></div>
    ${list.length ? `<table class="table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Compte</th><th class="num">Montant</th></tr></thead><tbody>${list.map(e => `<tr class="clickable" data-id="${e.id}"><td data-l="Date">${h(fmtDate(e.date))}</td><td data-l="Libellé"><b>${h(e.label)}</b> ${e.auto ? '<span class="pill">auto</span>' : ''} ${e.attachment ? '📎' : ''}</td><td data-l="Catégorie">${h(e.type === 'transfer' ? 'Virement interne' : e.category)}</td><td data-l="Compte">${h(name[e.account])}${e.type === 'transfer' ? ' → ' + h(name[e.to_account]) : ''}</td><td class="num ${e.type === 'income' ? 'amount-in' : e.type === 'expense' ? 'amount-out' : ''}">${e.type === 'income' ? '+' : e.type === 'expense' ? '−' : ''} ${money(e.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune écriture sur la période. Les ventes payées et les salaires versés s’y ajoutent automatiquement.</p>'}`;
  const upd = () => { f.q = $('#jq').value; f.type = $('#jt').value; f.account = $('#ja').value; render(); };
  $('#jt').onchange = upd; $('#ja').onchange = upd; let tm; $('#jq').oninput = () => { clearTimeout(tm); tm = setTimeout(upd, 400); };
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => { const e = ACC.entries.find(x => x.id === tr.dataset.id); entryForm(e, e.type); });
};
function entryForm(e, type) {
  const cats = type === 'income' ? ACC.income_categories : ACC.expense_categories, att = { id: e?.attachment || '' };
  const fields = [[{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'amount', label: 'Montant (HTG)', type: 'number', min: 1, required: true }],
    { name: 'label', label: 'Libellé', required: true, placeholder: type === 'expense' ? 'Ex. Achat de fleurs au marché' : type === 'income' ? 'Ex. Location de chaises — mariage Joseph' : 'Ex. Dépôt de la caisse à la banque' },
    type === 'transfer' ? [{ name: 'account', label: 'Depuis le compte', type: 'select', options: accountOptions() }, { name: 'to_account', label: 'Vers le compte', type: 'select', options: accountOptions() }]
      : [{ name: 'category', label: 'Catégorie', type: 'select', options: cats.map(c => [c, c]) }, { name: 'account', label: type === 'income' ? 'Encaissé sur' : 'Payé depuis', type: 'select', options: accountOptions() }]];
  openForm({ title: (e ? 'Modifier — ' : '') + ({ income: 'Recette', expense: 'Dépense', transfer: 'Virement entre comptes' }[type]), fields, values: e || { date: today(), account: 'caisse', to_account: 'banque' },
    before: e?.auto ? '<p class="hint">Écriture créée automatiquement (vente payée, salaire ou avance). Vous pouvez corriger le compte ou la date.</p>' : '',
    extra: type === 'transfer' ? '' : `<div class="section-box"><b>Pièce justificative (facture, reçu — photo ou PDF)</b><input type="file" id="attFile" accept="image/*,application/pdf"><p id="attInfo" class="muted"></p></div>`,
    remove: e && (async () => { await post('/api/admin/entries/remove', { id: e.id }); toast('Écriture supprimée'); render(); }),
    onRender: () => { if (type === 'transfer') return; const info = () => { $('#attInfo').innerHTML = att.id ? `<a href="/api/admin/files/${att.id}">📎 Télécharger la pièce</a> · <a href="#" id="attRm">retirer</a>` : 'Aucune pièce jointe.'; const rm = $('#attRm'); if (rm) rm.onclick = ev => { ev.preventDefault(); att.id = ''; info(); }; }; info(); $('#attFile').onchange = safe(async ev => { const f = ev.target.files[0]; if (!f) return; toast('Envoi de la pièce…'); att.id = await uploadAttachment(f); info(); toast('Pièce jointe ajoutée'); }); },
    onSubmit: async v => { await post('/api/admin/entries', { ...v, id: e?.id, type, attachment: att.id }); toast('Écriture enregistrée'); render(); } });
}
RENDER['accounting:accounts'] = async view => {
  await loadAcc(); periodBar();
  $('#topActions').insertAdjacentHTML('afterbegin', '<button class="btn primary" id="newAcc" style="margin-top:18px">＋ Nouveau compte</button>');
  const form = a => openForm({ title: a ? a.name : 'Nouveau compte', before: '<p class="hint">Solde d’ouverture : le montant présent sur ce compte au démarrage de la comptabilité dans Magic Moments.</p>', fields: [[{ name: 'name', label: 'Nom du compte', required: true }, { name: 'opening', label: 'Solde d’ouverture (HTG)', type: 'number', required: true }]], values: a || { opening: 0 }, onSubmit: async v => { await post('/api/admin/accounts', { ...v, id: a?.id }); ACCOUNTS = []; toast('Compte enregistré'); render(); } });
  $('#newAcc').onclick = () => form(null);
  view.innerHTML = `<table class="table"><thead><tr><th>Compte</th><th class="num">Solde d’ouverture</th><th class="num">Solde au ${h(fmtDate(ACC.to))}</th></tr></thead><tbody>${ACC.accounts.map(a => `<tr class="clickable" data-id="${a.id}"><td><b>${h(a.name)}</b></td><td class="num" data-l="Ouverture">${money(a.opening)}</td><td class="num" data-l="Solde">${money(a.balance)}</td></tr>`).join('')}</tbody></table>`;
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(ACC.accounts.find(a => a.id === tr.dataset.id)));
};


/* ============ Visites et connexions ============ */
S.traffic = { from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to: today(), tab: 'visits' };
const topList = (rows, total) => rows.length ? `<table class="table"><tbody>${rows.slice(0, 8).map(r => `<tr><td>${h(r.k)}</td><td class="num">${r.n} <span class="muted">(${Math.round(r.n / Math.max(1, total) * 100)} %)</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune donnée.</p>';
RENDER.traffic = async view => {
  const T = S.traffic, d = await api(`/api/admin/traffic?from=${T.from}&to=${T.to}`);
  actions(`<label style="margin:0">Du<input type="date" id="tFrom" value="${T.from}"></label><label style="margin:0">Au<input type="date" id="tTo" value="${T.to}"></label><a class="btn line" style="margin-top:18px" href="/api/admin/traffic/export?kind=${T.tab}&from=${T.from}&to=${T.to}">⬇ Export Excel (CSV)</a>`);
  $('#tFrom').onchange = $('#tTo').onchange = () => { T.from = $('#tFrom').value; T.to = $('#tTo').value; render(); };
  const max = Math.max(1, ...d.days.map(x => x[1]));
  view.innerHTML = `<p class="muted">Visites enregistrées uniquement pour les visiteurs qui acceptent les cookies de mesure d’audience. Les connexions aux comptes sont toujours enregistrées (sécurité). Localisation approximative, à partir de l’adresse IP ou du fuseau horaire.</p>
    <div class="kpis"><div class="kpi accent"><small>Visites</small><strong>${d.total}</strong></div><div class="kpi"><small>Visiteurs uniques</small><strong>${d.unique}</strong></div><div class="kpi"><small>Pages vues</small><strong>${d.pages}</strong></div><div class="kpi"><small>Connexions aux comptes</small><strong>${d.logins_total}</strong></div></div>
    <div class="card" style="margin-bottom:16px"><h3>📈 Visites par jour</h3>${d.days.length ? `<div class="bars">${d.days.slice(-31).map(([k, n]) => `<div class="bar"><div class="cols"><div class="in" style="width:70%;max-width:26px;height:${n / max * 100}%" title="${n} visite(s)"></div></div><small>${k.slice(8)}</small></div>`).join('')}</div>` : '<p class="empty">Aucune visite sur la période.</p>'}</div>
    <div class="cards"><div class="card"><h3>🌍 Pays</h3>${topList(d.countries, d.total)}</div><div class="card"><h3>🏙️ Villes</h3>${topList(d.cities, d.total)}</div><div class="card"><h3>📱 Appareils</h3>${topList(d.devices, d.total)}<h3 style="margin-top:14px">💻 Systèmes</h3>${topList(d.os, d.total)}</div><div class="card"><h3>🌐 Navigateurs</h3>${topList(d.browsers, d.total)}</div><div class="card"><h3>🔗 Provenance</h3>${topList(d.sources, d.total)}</div></div>
    <div class="toolbar" style="margin-top:18px"><button class="btn ${T.tab === 'visits' ? 'primary' : 'line'}" data-ttab="visits">Dernières visites</button><button class="btn ${T.tab === 'logins' ? 'primary' : 'line'}" data-ttab="logins">Connexions aux comptes</button></div>
    ${T.tab === 'visits' ? (d.visits.length ? `<table class="table"><thead><tr><th>Date et heure</th><th>Lieu</th><th>Appareil</th><th>Navigateur</th><th>Pages</th><th>Provenance</th></tr></thead><tbody>${d.visits.map(v => `<tr><td data-l="Date">${h(fmtDT(v.at))}${v.returning ? ' <span class="pill">déjà venu</span>' : ''}${v.user_name ? `<br><span class="muted">${h(v.user_name)}</span>` : ''}</td><td data-l="Lieu">${h([v.city, v.region, v.country].filter(Boolean).join(', ') || 'Inconnu')}${v.geo === 'fuseau' ? ' <span class="muted">(fuseau)</span>' : ''}</td><td data-l="Appareil">${h(v.device)}${v.model ? ' · ' + h(v.model) : ''}<br><span class="muted">${h(v.os)}</span></td><td data-l="Navigateur">${h(v.browser)}</td><td data-l="Pages">${v.pages || 1}</td><td data-l="Provenance">${h(v.ref || 'Accès direct')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune visite.</p>')
      : (d.logins.length ? `<table class="table"><thead><tr><th>Date et heure</th><th>Compte</th><th>Lieu</th><th>Appareil</th><th>Adresse IP</th></tr></thead><tbody>${d.logins.map(l => `<tr><td data-l="Date">${h(fmtDT(l.at))}</td><td data-l="Compte"><b>${h(l.name)}</b> ${l.role === 'admin' ? '<span class="pill warn">admin</span>' : ''}<br><span class="muted">${h(l.email)}</span></td><td data-l="Lieu">${h([l.city, l.country].filter(Boolean).join(', ') || 'Inconnu')}</td><td data-l="Appareil">${h(l.device)}${l.model ? ' · ' + h(l.model) : ''}<br><span class="muted">${h(l.os)} · ${h(l.browser)}</span></td><td data-l="IP">${h(l.ip)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune connexion.</p>')}`;
  view.querySelectorAll('[data-ttab]').forEach(b => b.onclick = () => { T.tab = b.dataset.ttab; render(); });
};

/* ============ FAQ ============ */
RENDER['content:faq'] = async view => {
  const list = await api('/api/admin/faq'), cats = [...new Set(list.map(f => f.category))];
  actions('<a class="btn line" href="/faq" target="_blank" rel="noopener">Voir la page FAQ ↗</a><button class="btn primary" id="newFaq">＋ Nouvelle question</button>');
  const form = f => openForm({ title: f ? 'Modifier la question' : 'Nouvelle question', remove: f && (async () => { await post('/api/admin/faq/remove', { id: f.id }); toast('Question supprimée'); render(); }),
    fields: [[{ name: 'category', label: 'Rubrique', required: true, placeholder: 'Ex. Paiement' }, { name: 'order', label: 'Ordre d’affichage', type: 'number', min: 0 }], { name: 'q', label: 'Question', required: true }, { name: 'a', label: 'Réponse', type: 'textarea', rows: 4, required: true }, { name: 'q_ht', label: 'Question (kreyòl)' }, { name: 'a_ht', label: 'Réponse (kreyòl)', type: 'textarea', rows: 4 }, { name: 'active', label: 'Publiée', type: 'checkbox', checked: true }],
    values: f || { active: true, order: list.length, category: cats[0] || '' }, extra: `<datalist id="faqCats">${cats.map(c => `<option value="${h(c)}">`).join('')}</datalist>`,
    onRender: fm => fm.elements.category.setAttribute('list', 'faqCats'),
    onSubmit: async v => { await post('/api/admin/faq', { ...v, id: f?.id, order: v.order ?? 0 }); toast('Question enregistrée'); render(); } });
  $('#newFaq').onclick = () => form(null);
  view.innerHTML = cats.map(c => `<h3 style="margin:16px 0 8px">${h(c)}</h3><table class="table"><tbody>${list.filter(f => f.category === c).map(f => `<tr class="clickable" data-id="${f.id}"><td><b>${h(f.q)}</b><br><span class="muted">${h(f.a.slice(0, 120))}${f.a.length > 120 ? '…' : ''}</span></td><td>${f.q_ht ? '' : '<span class="pill warn">kreyòl</span>'} ${f.active ? '<span class="pill ok">Publiée</span>' : '<span class="pill grey">Masquée</span>'}</td></tr>`).join('')}</tbody></table>`).join('') || '<p class="empty">Aucune question.</p>';
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(list.find(f => f.id === tr.dataset.id)));
};

/* ============ Paramètres ============ */
RENDER['settings:general'] = async view => {
  const [mail, st] = await Promise.all([api('/api/admin/mail'), api('/api/settings')]);
  view.innerHTML = `<div class="cards"><div class="card"><h3>💳 Paiement en ligne PlopPlop</h3><p>${st.online_payment ? '<span class="pill ok">Actif</span> Les clients paient par MonCash, NatCash ou Kashpaw après confirmation de leur commande.' : '<span class="pill warn">Non configuré</span> Ajoutez PLOP_CLIENT_ID et PLOP_CLIENT_SECRET dans Render → Environment, puis redémarrez le service.'}</p></div>
    <div class="card"><h3>✉️ Courriels automatiques</h3><p>${mail.configured ? `<span class="pill ok">${mail.provider === 'brevo' ? 'Brevo' : 'Resend'} actif</span> Expéditeur : ${h(mail.sender)}` : '<span class="pill warn">Non configuré</span> Ajoutez BREVO_API_KEY et MAIL_FROM (adresse validée dans Brevo) dans Render → Environment, puis redémarrez.'}</p><p class="muted">Un courriel part à chaque étape (demande, confirmation, paiement, préparation, livraison…). Textes : Paramètres → Messages par étape.</p><p class="muted">Alertes de nouvelles commandes, paiements et candidatures : variable ADMIN_NOTIFY_EMAIL.</p></div>
    <div class="card"><h3>👤 Compte</h3><p>${h(S.user.name)} · ${h(S.user.email)}</p><p class="muted">Pour changer de mot de passe : « Mot de passe oublié ? » sur le site.</p></div></div>
    <div class="card" style="margin-top:16px"><h3>Journal des 100 derniers courriels</h3><pre class="log">${h(mail.jobs.map(x => `${fmtDT(x.created_at)} · ${x.subject} → ${x.to} · ${{ pending: 'En attente', sent: 'Envoyé', failed: 'Échec' }[x.status]}${x.attempts > 1 ? ' (' + x.attempts + ' essais)' : ''}`).join('\n') || 'Aucun courriel.')}</pre></div>`;
};

/* ============ Moyens de paiement ============ */
RENDER['settings:payments'] = async view => {
  const d = await api('/api/admin/payment-settings'), P = JSON.parse(JSON.stringify(d.settings)), T = d.types;
  const chk = (k, l, hint) => `<label class="check"><input type="checkbox" data-p="${k}" ${P[k] ? 'checked' : ''}> ${h(l)}</label>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  const draw = () => {
    view.innerHTML = `<div class="cards">
      <div class="card"><h3>🔖 Acompte à la demande</h3>${chk('deposit_enabled', 'Proposer un acompte dès l’envoi du formulaire', 'Le client réserve sa date (ou son matériel) en payant une partie tout de suite ; le solde se règle après confirmation.')}
        <label>Pourcentage de l’acompte<input type="number" min="10" max="100" step="5" data-p="deposit_percent" value="${P.deposit_percent}"></label></div>
      <div class="card"><h3>💳 Paiement en ligne PlopPlop</h3>${chk('online', 'Proposer le paiement en ligne (MonCash, NatCash, Kashpaw)')}
        <p>${d.gateway ? '<span class="pill ok">Passerelle configurée</span> Confirmation automatique.' : '<span class="pill warn">Non configurée</span> Ajoutez PLOP_CLIENT_ID et PLOP_CLIENT_SECRET dans Render → Environment.'}</p></div>
      <div class="card"><h3>💵 Espèces à la livraison</h3>${chk('cash', 'Indiquer aux clients qu’ils peuvent payer en espèces à la livraison', 'Vous enregistrez ensuite l’encaissement dans la fiche (bouton « Encaisser un montant »).')}</div></div>
      <div class="card" style="margin-top:16px"><h3>🏦 Transfert direct sur vos comptes</h3>${chk('direct', 'Proposer le transfert direct (le client envoie l’argent puis déclare la transaction)', 'Le client indique le numéro de transaction et peut joindre une capture ; vous confirmez la réception dans la fiche. Aucune commission.')}
        <div class="list" id="accts">${P.accounts.map((a, i) => `<div class="item" data-i="${i}"><div class="grid3"><label>Moyen<select data-a="type">${Object.entries(T).map(([k, t]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${t.ico} ${h(t.name)}</option>`).join('')}</select></label>
          <label>${h(T[a.type]?.field || 'Numéro')}<input data-a="number" value="${h(a.number)}" placeholder="+509 …"></label><label>Au nom de<input data-a="holder" value="${h(a.holder)}" placeholder="Nom du titulaire"></label></div>
          <div class="grid2"><label>${a.type === 'banque' ? 'Banque' : 'Nom affiché'}<input data-a="${a.type === 'banque' ? 'bank' : 'label'}" value="${h(a.type === 'banque' ? a.bank : a.label)}" placeholder="${a.type === 'banque' ? 'Ex. Unibank' : 'Ex. MonCash Magic Moments'}"></label><label>Consigne au client (facultatif)<input data-a="instructions" value="${h(a.instructions)}" placeholder="Ex. envoyez la capture après le transfert"></label></div>
          <div class="form-actions" style="justify-content:space-between"><label class="check"><input type="checkbox" data-a="active" ${a.active !== false ? 'checked' : ''}> Proposé aux clients</label><button type="button" class="btn line sm" data-rm="${i}">Retirer</button></div></div>`).join('') || '<p class="muted">Aucun compte déclaré.</p>'}</div>
        <p><button type="button" class="btn line sm" id="addAcct">+ Ajouter un compte</button></p></div>
      <div class="form-actions"><button type="button" class="btn primary" id="savePay">Enregistrer les moyens de paiement</button></div>`;
    view.querySelectorAll('[data-p]').forEach(el => el.oninput = el.onchange = () => { P[el.dataset.p] = el.type === 'checkbox' ? el.checked : Number(el.value); });
    view.querySelectorAll('[data-a]').forEach(el => el.oninput = el.onchange = () => { const a = P.accounts[el.closest('[data-i]').dataset.i]; a[el.dataset.a] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.a === 'type') draw(); });
    view.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { P.accounts.splice(Number(b.dataset.rm), 1); draw(); });
    $('#addAcct').onclick = () => { P.accounts.push({ type: 'moncash', label: 'MonCash', number: '', holder: '', bank: '', instructions: '', active: true }); draw(); };
    $('#savePay').onclick = safe(async () => { await post('/api/admin/payment-settings', P); toast('Moyens de paiement enregistrés'); });
  };
  draw();
};

/* ============ Cadeau express ============ */
RENDER['settings:express'] = async view => {
  const d = await api('/api/admin/express'), X = d.settings, st = d.status;
  const why = { off: 'désactivé', no_gift: 'aucun cadeau express choisi', late: 'heure limite passée ou plus de créneau aujourd’hui', full: 'toutes les livraisons du jour sont réservées' };
  view.innerHTML = `<div class="card"><h3>⚡ Cadeau express — livré le jour même</h3>
      <p>${st.open ? `<span class="pill ok">Ouvert aujourd’hui</span> ${st.slots.length} créneau(x) encore disponible(s), ${st.left} livraison(s) restante(s).` : `<span class="pill warn">Fermé aujourd’hui</span> ${why[st.reason] || ''}.`} <span class="muted">(heure d’Haïti)</span></p>
      <label class="check"><input type="checkbox" id="xEnabled" ${X.enabled ? 'checked' : ''}> Proposer le cadeau express sur le site</label>
      <div class="grid3"><label>Premières livraisons<input type="time" id="xStart" value="${h(X.start)}"></label><label>Dernières livraisons (fin)<input type="time" id="xEnd" value="${h(X.end)}"></label><label>Heure limite pour commander<input type="time" id="xCutoff" value="${h(X.cutoff)}"></label></div>
      <div class="grid3"><label>Durée d’un créneau (minutes)<input type="number" id="xSlot" min="30" max="480" step="15" value="${X.slot_minutes}"></label><label>Délai de préparation (minutes)<input type="number" id="xLead" min="0" max="480" step="15" value="${X.lead_minutes}"></label><label>Frais express (HTG)<input type="number" id="xFee" min="0" value="${X.fee}"></label></div>
      <div class="grid2"><label>Livraisons express maximum par jour<input type="number" id="xLimit" min="1" max="500" value="${X.daily_limit}"></label><label>Villes desservies (une par ligne)<textarea id="xCities" rows="5">${h(X.cities.join('\n'))}</textarea></label></div></div>
    <div class="card" style="margin-top:16px"><h3>🎁 Cadeaux proposés en express</h3><p class="muted">Choisissez les formules prêtes à partir dans la journée (fleurs, paniers, gâteaux, coffrets…). Le client règle la totalité à la commande.</p>
      <div class="check-list">${d.packages.map(x => `<label class="check"><input type="checkbox" class="xPack" value="${x.id}" ${x.express ? 'checked' : ''} ${x.active ? '' : 'disabled'}> ${h(x.name)} <span class="muted">${money(x.price_htg)}${x.active ? '' : ' · masquée'}</span></label>`).join('')}</div></div>
    <div class="form-actions"><button type="button" class="btn primary" id="xSave">Enregistrer</button></div>`;
  $('#xSave').onclick = safe(async () => {
    await post('/api/admin/express', { enabled: $('#xEnabled').checked, start: $('#xStart').value, end: $('#xEnd').value, cutoff: $('#xCutoff').value, slot_minutes: Number($('#xSlot').value), lead_minutes: Number($('#xLead').value), fee: Number($('#xFee').value), daily_limit: Number($('#xLimit').value), cities: $('#xCities').value, packages: [...view.querySelectorAll('.xPack:checked')].map(x => x.value) });
    toast('Cadeau express enregistré'); RENDER['settings:express'](view);
  });
};

/* ============ Boutique de cadeaux ============ */
RENDER['catalog:shop'] = async view => {
  const d = await api('/api/admin/shop'), S = d.settings;
  actions('<button class="btn primary" id="newProd">＋ Nouvel article</button>');
  const form = x => { const media = { photo: x?.photo || '' };
    openForm({ title: x ? x.name : 'Nouvel article', values: x ? { ...x } : { active: true, stock: 10, category: d.categories[0] },
      fields: [[{ name: 'name', label: 'Nom de l’article', required: true }, { name: 'name_ht', label: 'Nom (kreyòl)' }],
        [{ name: 'category', label: 'Catégorie', type: 'select', options: d.categories.map(c => [c, c]) }, { name: 'price_htg', label: 'Prix (HTG)', type: 'number', min: 1, required: true }, { name: 'stock', label: 'Stock disponible', type: 'number', min: 0, required: true }],
        { name: 'description', label: 'Description', type: 'textarea', rows: 2 }, { name: 'description_ht', label: 'Description (kreyòl)', type: 'textarea', rows: 2 },
        [{ name: 'active', label: 'En vente dans la boutique', type: 'checkbox' }, { name: 'featured', label: '⭐ Mettre en avant', type: 'checkbox' }]],
      extra: '<div class="section-box"><b>Photo de l’article</b><input type="file" id="qFile" accept="image/*"><div class="thumbs" id="qThumb"></div></div>',
      onRender: () => { const draw = () => { $('#qThumb').innerHTML = media.photo ? thumbHTML(media.photo, 'q') : '<span class="muted">Sans photo, la boutique affiche un pictogramme.</span>'; }; draw();
        $('#qThumb').onclick = e => { if (e.target.dataset.rm) { media.photo = ''; draw(); } };
        $('#qFile').onchange = safe(async e => { const f = e.target.files[0]; if (f) { toast('Envoi…'); media.photo = await uploadImage(f); draw(); toast('Photo ajoutée'); } }); },
      remove: x ? async () => { await post('/api/admin/shop/products/remove', { id: x.id }); toast('Article supprimé'); render(); } : null,
      onSubmit: async v => { await post('/api/admin/shop/products', { ...v, id: x?.id, photo: media.photo }); toast('Article enregistré'); refreshDash(); render(); } }); };
  $('#newProd').onclick = () => form(null);
  view.innerHTML = `<div class="card"><h3>🛍️ Réglages de la boutique</h3>
      <label class="check"><input type="checkbox" id="sEnabled" ${S.enabled ? 'checked' : ''}> Boutique ouverte sur le site</label>
      <div class="grid3"><label class="check"><input type="checkbox" id="sDelivery" ${S.delivery ? 'checked' : ''}> Livraison à domicile</label><label>Frais de livraison (HTG)<input type="number" id="sFee" min="0" value="${S.delivery_fee}"></label><label>Livraison offerte dès (HTG, 0 = jamais)<input type="number" id="sFree" min="0" value="${S.free_from}"></label></div>
      <div class="grid3"><label class="check"><input type="checkbox" id="sPickup" ${S.pickup ? 'checked' : ''}> Retrait sur place</label><label>Adresse de retrait<input id="sPickAddr" value="${h(S.pickup_address)}" placeholder="Ex. Delmas 33, en face de…"></label><label>Délai minimum (jours)<input type="number" id="sLead" min="0" max="30" value="${S.lead_days}"></label></div>
      <div class="grid3"><label>Emballage cadeau (HTG, 0 = non proposé)<input type="number" id="sWrap" min="0" value="${S.gift_wrap}"></label></div>
      <div class="form-actions"><button type="button" class="btn primary" id="sSave">Enregistrer les réglages</button></div></div>
    <p class="muted" style="margin-top:16px">${d.products.length} article(s). Le stock est réservé à la commande, rendu si elle est annulée ; les commandes non payées sous 48 h sont annulées automatiquement.</p>
    <table class="table"><thead><tr><th></th><th>Article</th><th>Catégorie</th><th class="num">Prix</th><th class="num">Stock</th><th>Statut</th></tr></thead><tbody>${d.products.map(x => `<tr class="clickable" data-id="${x.id}"><td>${visual(x.photo, '🎁')}</td><td><b>${h(x.name)}</b>${x.featured ? ' ⭐' : ''}</td><td>${h(x.category)}</td><td class="num" data-l="Prix">${money(x.price_htg)}</td><td class="num" data-l="Stock">${x.stock <= 2 ? `<span class="pill ${x.stock ? 'warn' : 'bad'}">${x.stock}</span>` : x.stock}</td><td>${x.active !== false ? '<span class="pill ok">En vente</span>' : '<span class="pill grey">Masqué</span>'}</td></tr>`).join('')}</tbody></table>`;
  $('#sSave').onclick = safe(async () => { await post('/api/admin/shop/settings', { enabled: $('#sEnabled').checked, delivery: $('#sDelivery').checked, delivery_fee: Number($('#sFee').value), free_from: Number($('#sFree').value), pickup: $('#sPickup').checked, pickup_address: $('#sPickAddr').value, lead_days: Number($('#sLead').value), gift_wrap: Number($('#sWrap').value) }); toast('Réglages de la boutique enregistrés'); });
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(d.products.find(x => x.id === tr.dataset.id)));
};

/* ============ Gestion de stock ============ */
const KIND_ICO = { product: '🛍️', equipment: '🪑', supply: '🧰' };
const MOVE_PILL = { in: 'ok', return: 'ok', out: '', sale: '', loss: 'bad', adjust: 'warn' };
function stockMoveForm(d, x, type, view) {
  const T = { in: 'Entrée de stock', out: 'Sortie de stock', loss: 'Perte / casse', adjust: 'Inventaire' }[type];
  const fields = type === 'adjust' ? [{ name: 'quantity', label: `Quantité comptée (${x.unit})`, type: 'number', min: 0, required: true }]
    : [{ name: 'quantity', label: `Quantité (${x.unit})`, type: 'number', min: 1, required: true }];
  if (type === 'in') fields.push([{ name: 'unit_cost', label: 'Coût unitaire (HTG)', type: 'number', min: 0 }, { name: 'supplier', label: 'Fournisseur (facultatif)' }],
    [{ name: 'expense', label: 'Enregistrer la dépense en comptabilité', type: 'checkbox' }, { name: 'account', label: 'Payé depuis', type: 'select', options: d.accounts.map(a => [a.id, a.name]) }]);
  fields.push({ name: 'reason', label: type === 'loss' ? 'Que s’est-il passé ?' : 'Motif ou note (facultatif)', placeholder: type === 'out' ? 'Ex. utilisé pour la commande de Marie' : '' });
  openForm({ title: `${T} — ${x.name}`, values: type === 'adjust' ? { quantity: x.stock } : { quantity: 1, unit_cost: x.cost || '', supplier: x.supplier || '', expense: true },
    before: `<p class="hint">Stock actuel : <b>${x.stock} ${h(x.unit)}</b>${type === 'adjust' ? '. Indiquez la quantité réellement comptée : l’écart est enregistré.' : ''}</p>`, fields,
    onSubmit: async v => { await post('/api/admin/stock/move', { kind: x.kind, id: x.id, type, quantity: Number(v.quantity), unit_cost: v.unit_cost === '' || v.unit_cost == null ? null : Number(v.unit_cost), supplier: v.supplier || '', expense: !!v.expense, account: v.account, reason: v.reason || '' }); toast('Stock mis à jour'); refreshDash(); RENDER['stock:overview'](view); } });
}
RENDER['stock:overview'] = async view => {
  const d = await api('/api/admin/stock'), f = S.stockFilter ??= { kind: '', low: false, q: '' };
  actions('<a class="btn line" href="/api/admin/stock/export.csv">⬇ Exporter (CSV)</a>');
  const list = d.items.filter(x => (!f.kind || x.kind === f.kind) && (!f.low || x.low) && (!f.q || (x.name + ' ' + x.category).toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => (b.low - a.low) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  view.innerHTML = `<div class="kpis"><div class="kpi accent"><small>Valeur du stock (au coût)</small><strong>${money(d.totals.value)}</strong></div><div class="kpi"><small>Articles suivis</small><strong>${d.totals.items}</strong></div><div class="kpi"><small>À réapprovisionner</small><strong>${d.totals.low}</strong></div><div class="kpi"><small>Épuisés</small><strong>${d.totals.out}</strong></div></div>
    <div class="toolbar"><label class="grow">Rechercher<input id="stQ" value="${h(f.q)}" placeholder="Article, catégorie…"></label><label>Famille<select id="stKind"><option value="">Toutes</option>${Object.entries(d.kinds).map(([k, l]) => `<option value="${k}" ${f.kind === k ? 'selected' : ''}>${KIND_ICO[k]} ${h(l)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="stLow" ${f.low ? 'checked' : ''}> À réapprovisionner</label></div>
    <table class="table"><thead><tr><th></th><th>Article</th><th>Famille</th><th class="num">Stock</th><th class="num">Seuil</th><th class="num">Coût</th><th class="num">Valeur</th><th>Actions</th></tr></thead><tbody>${list.map(x => `<tr data-k="${x.kind}" data-id="${x.id}" class="${x.active ? '' : 'dim'}"><td>${visual(x.photo, KIND_ICO[x.kind])}</td><td><b>${h(x.name)}</b><br><span class="muted">${h(x.category)}${x.active ? '' : ' · inactif'}</span></td><td>${h(x.kind_label)}</td>
      <td class="num" data-l="Stock">${!x.stock ? '<span class="pill bad">0</span>' : x.low ? `<span class="pill warn">${x.stock}</span>` : x.stock} <span class="muted">${h(x.unit)}</span></td><td class="num" data-l="Seuil">${x.min_stock}</td><td class="num" data-l="Coût">${x.cost ? money(x.cost) : '—'}</td><td class="num" data-l="Valeur">${x.value ? money(x.value) : '—'}</td>
      <td><span class="row-actions"><button class="btn sm primary" data-act="in" title="Entrée">＋ Entrée</button><button class="btn sm line" data-act="out" title="Sortie">− Sortie</button><button class="btn sm line" data-act="loss" title="Perte / casse">Perte</button><button class="btn sm line" data-act="adjust" title="Inventaire">Inventaire</button><button class="btn sm line" data-act="set" title="Seuil et coût">⚙</button><button class="btn sm line" data-act="hist" title="Historique">🕘</button></span></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun article.</td></tr>'}</tbody></table>
    <p class="muted">Les ventes de la boutique et les annulations mettent le stock à jour automatiquement. Le matériel de location n’est pas déduit pendant une location (la disponibilité est calculée par dates) : enregistrez ici les achats, casses et pertes.</p>`;
  $('#stQ').oninput = e => { f.q = e.target.value; clearTimeout(S.stT); S.stT = setTimeout(() => { RENDER['stock:overview'](view).then(() => { const i = $('#stQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };
  $('#stKind').onchange = e => { f.kind = e.target.value; RENDER['stock:overview'](view); };
  $('#stLow').onchange = e => { f.low = e.target.checked; RENDER['stock:overview'](view); };
  view.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const tr = b.closest('tr'), x = d.items.find(i => i.kind === tr.dataset.k && i.id === tr.dataset.id), act = b.dataset.act;
    if (act === 'hist') { S.stockItem = { kind: x.kind, id: x.id, name: x.name }; go('stock', 'moves'); return; }
    if (act === 'set') {
      if (x.kind === 'supply') { go('stock', 'supplies'); return; }
      openForm({ title: 'Seuil d’alerte et coût — ' + x.name, values: { min_stock: x.min_stock, cost: x.cost }, fields: [[{ name: 'min_stock', label: 'Alerter quand le stock descend à', type: 'number', min: 0, required: true }, { name: 'cost', label: 'Coût d’achat unitaire (HTG)', type: 'number', min: 0, required: true }]],
        onSubmit: async v => { await post('/api/admin/stock/settings', { kind: x.kind, id: x.id, min_stock: Number(v.min_stock), cost: Number(v.cost) }); toast('Réglages enregistrés'); refreshDash(); RENDER['stock:overview'](view); } });
      return;
    }
    stockMoveForm(d, x, act, view);
  });
};
RENDER['stock:moves'] = async view => {
  const it = S.stockItem, d = await api('/api/admin/stock'), moves = it ? await api(`/api/admin/stock/moves?kind=${it.kind}&item=${it.id}`) : d.moves;
  actions('<a class="btn line" href="/api/admin/stock/export.csv">⬇ Exporter l’état du stock (CSV)</a>');
  view.innerHTML = `${it ? `<p class="toolbar"><span>Historique de <b>${h(it.name)}</b></span><button class="btn line sm" id="stAll">Voir tous les mouvements</button></p>` : '<p class="muted">Les 300 derniers mouvements, du plus récent au plus ancien.</p>'}
    <table class="table"><thead><tr><th>Date</th><th>Article</th><th>Mouvement</th><th class="num">Quantité</th><th class="num">Avant → après</th><th>Motif</th><th>Par</th></tr></thead><tbody>${moves.map(x => `<tr><td>${h(fmtDT(x.created_at))}</td><td>${KIND_ICO[x.kind] || ''} ${h(x.item_name)}</td><td><span class="pill ${MOVE_PILL[x.type] || ''}">${h(d.types[x.type] || x.type)}</span></td><td class="num" data-l="Quantité"><b>${x.qty > 0 ? '+' : ''}${x.qty}</b></td><td class="num" data-l="Stock">${x.before} → ${x.after}</td><td>${h(x.reason || '')}${x.unit_cost ? ` <span class="muted">· ${money(x.unit_cost)}/u</span>` : ''}${x.ref ? ` <span class="muted">· réf. ${h(x.ref.slice(0, 8).toUpperCase())}</span>` : ''}</td><td>${h(x.user)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun mouvement.</td></tr>'}</tbody></table>`;
  $('#stAll') && ($('#stAll').onclick = () => { S.stockItem = null; RENDER['stock:moves'](view); });
};
RENDER['stock:supplies'] = async view => {
  const d = await api('/api/admin/stock'), list = d.items.filter(x => x.kind === 'supply');
  actions('<button class="btn primary" id="newSup">＋ Nouvelle fourniture</button>');
  const form = x => openForm({ title: x ? x.name : 'Nouvelle fourniture', values: x || { unit: 'unité', min_stock: 1, cost: 0, stock: 0, active: true, category: d.supply_categories[0] },
    fields: [[{ name: 'name', label: 'Nom', required: true }, { name: 'category', label: 'Catégorie', type: 'select', options: d.supply_categories.map(c => [c, c]) }], [{ name: 'unit', label: 'Unité (pièce, rouleau, boîte…)', required: true }, ...(x ? [] : [{ name: 'stock', label: 'Stock initial', type: 'number', min: 0 }]), { name: 'min_stock', label: 'Seuil d’alerte', type: 'number', min: 0, required: true }],
      [{ name: 'cost', label: 'Coût unitaire (HTG)', type: 'number', min: 0 }, { name: 'supplier', label: 'Fournisseur habituel' }], { name: 'active', label: 'Suivie', type: 'checkbox' }],
    before: x ? `<p class="hint">Stock actuel : <b>${x.stock} ${h(x.unit)}</b>. Pour le modifier, utilisez Entrée, Sortie ou Inventaire dans « État du stock ».</p>` : '',
    remove: x ? async () => { await post('/api/admin/stock/supplies/remove', { id: x.id }); toast('Fourniture supprimée'); render(); } : null,
    onSubmit: async v => { await post('/api/admin/stock/supplies', { ...v, id: x?.id, stock: Number(v.stock || 0), min_stock: Number(v.min_stock), cost: Number(v.cost || 0) }); toast('Fourniture enregistrée'); refreshDash(); render(); } });
  $('#newSup').onclick = () => form(null);
  view.innerHTML = `<p class="muted">Fournitures internes (ballons, emballages, cartes…) : elles ne sont pas vendues mais doivent être suivies pour ne jamais manquer.</p>
    <table class="table"><thead><tr><th>Fourniture</th><th>Catégorie</th><th class="num">Stock</th><th class="num">Seuil</th><th class="num">Coût</th><th>Fournisseur</th></tr></thead><tbody>${list.map(x => `<tr class="clickable" data-id="${x.id}"><td><b>${h(x.name)}</b>${x.active ? '' : ' <span class="pill grey">non suivie</span>'}</td><td>${h(x.category)}</td><td class="num" data-l="Stock">${x.low ? `<span class="pill ${x.stock ? 'warn' : 'bad'}">${x.stock}</span>` : x.stock} <span class="muted">${h(x.unit)}</span></td><td class="num" data-l="Seuil">${x.min_stock}</td><td class="num" data-l="Coût">${x.cost ? money(x.cost) : '—'}</td><td>${h(x.supplier || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune fourniture.</td></tr>'}</tbody></table>`;
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => form(list.find(x => x.id === tr.dataset.id)));
};

/* ============ Musiques (YouTube) ============ */
RENDER['catalog:music'] = async view => {
  const d = await api('/api/admin/music'), cats = [...new Set([...d.categories, ...d.list.map(m => m.category)])];
  view.innerHTML = `<div class="card"><h3>📥 Importer depuis YouTube</h3><p class="muted">Collez un ou plusieurs liens YouTube (un par ligne). Le titre et l’artiste sont récupérés automatiquement ; les clients écoutent un extrait et choisissent la musique de leur surprise.</p>
      <label>Liens YouTube<textarea id="mUrls" rows="4" placeholder="https://www.youtube.com/watch?v=…&#10;https://youtu.be/…"></textarea></label>
      <div class="toolbar"><label>Catégorie<select id="mCat">${cats.map(c => `<option>${h(c)}</option>`).join('')}</select></label><button type="button" class="btn primary" id="mImport">Importer</button></div><div id="mResult"></div></div>
    <p class="muted" style="margin-top:16px">${d.list.length} musique(s). Cliquez sur une ligne pour modifier le titre, la catégorie ou la masquer.</p>
    ${d.list.length ? `<table class="table"><tbody>${d.list.slice().reverse().map(m => `<tr class="clickable" data-id="${m.id}"><td style="width:110px"><img class="mini-img" style="width:96px;height:54px" src="https://i.ytimg.com/vi/${h(m.youtube_id)}/mqdefault.jpg" alt=""></td><td><b>${h(m.title)}</b><br><span class="muted">${h(m.artist || '—')}</span></td><td>${h(m.category)}</td><td>${m.active !== false ? '<span class="pill ok">Proposée</span>' : '<span class="pill grey">Masquée</span>'}</td><td><a href="https://www.youtube.com/watch?v=${h(m.youtube_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">▶ Écouter</a></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune musique pour le moment.</p>'}`;
  $('#mImport').onclick = safe(async () => {
    const r = await post('/api/admin/music/import', { urls: $('#mUrls').value, category: $('#mCat').value });
    toast(r.added.length + ' musique(s) importée(s)'); await RENDER['catalog:music'](view);
    if (r.skipped.length) $('#mResult').innerHTML = `<p class="warning">Ignorés : ${r.skipped.map(x => `${h(x.url.slice(0, 60))} (${h(x.reason)})`).join(' ; ')}</p>`;
  });
  view.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => {
    const m = d.list.find(x => x.id === tr.dataset.id);
    openForm({ title: 'Modifier la musique', values: { ...m, active: m.active !== false },
      fields: [{ name: 'title', label: 'Titre', required: true }, [{ name: 'artist', label: 'Artiste' }, { name: 'category', label: 'Catégorie', type: 'select', options: cats.map(c => [c, c]) }], { name: 'active', label: 'Proposée aux clients', type: 'checkbox' }],
      before: `<iframe class="yt-prev" src="https://www.youtube-nocookie.com/embed/${h(m.youtube_id)}?rel=0" title="Aperçu" allowfullscreen></iframe>`,
      remove: async () => { await post('/api/admin/music/remove', { id: m.id }); toast('Musique retirée'); render(); },
      onSubmit: async v => { await post('/api/admin/music/' + m.id, v, 'PATCH'); toast('Musique enregistrée'); render(); } });
  });
};

/* ============ Messages par étape ============ */
RENDER['settings:messages'] = async view => {
  const d = await api('/api/admin/templates'), kind = S.msgKind ||= 'order';
  const ph = Object.entries(d.placeholders).map(([k, l]) => `<code title="${h(l)}">${h(k)}</code>`).join(' ');
  view.innerHTML = `<div class="toolbar"><label>Parcours<select id="mk"><option value="order" ${kind === 'order' ? 'selected' : ''}>Surprises (commandes)</option><option value="rental" ${kind === 'rental' ? 'selected' : ''}>Locations de matériel</option></select></label></div>
    <p class="muted">À chaque étape, le courriel part automatiquement au client (s’il est activé) et le message WhatsApp est prêt dans la fiche de la commande ou de la location. Variables : ${ph}</p>
    <table class="table"><thead><tr><th>Étape</th><th>Courriel (français)</th><th>Courriel</th><th>Kreyòl</th></tr></thead><tbody>${d.stages[kind].map((s, k) => { const t = d.templates[kind][s.key] || {}; return `<tr class="clickable" data-st="${s.key}"><td><b>${k + 1 <= d.stages[kind].length - 1 ? (k + 1) + '. ' : ''}${h(s.fr)}</b></td><td>${h(t.subject_fr)}<br><span class="muted">${h((t.wa_fr || '').slice(0, 90))}…</span></td><td>${t.active ? '<span class="pill ok">Automatique</span>' : '<span class="pill grey">Désactivé</span>'}</td><td>${t.body_ht ? '<span class="pill ok">✓</span>' : '<span class="pill warn">à traduire</span>'}</td></tr>`; }).join('')}</tbody></table>`;
  $('#mk').onchange = () => { S.msgKind = $('#mk').value; RENDER['settings:messages'](view); };
  view.querySelectorAll('tr[data-st]').forEach(tr => tr.onclick = () => {
    const st = d.stages[kind].find(s => s.key === tr.dataset.st), t = d.templates[kind][st.key];
    const fields = [{ name: 'active', label: 'Envoyer ce courriel automatiquement', type: 'checkbox' },
      { name: 'subject_fr', label: 'Objet du courriel (français)', required: true }, { name: 'body_fr', label: 'Courriel (français)', type: 'textarea', rows: 5, required: true },
      { name: 'wa_fr', label: 'WhatsApp au client (français)', type: 'textarea', rows: 4 },
      ...(kind === 'order' ? [{ name: 'dest_fr', label: 'WhatsApp au destinataire (français, facultatif — ne pas dévoiler la surprise)', type: 'textarea', rows: 3 }] : []),
      { name: 'subject_ht', label: 'Objet du courriel (kreyòl)' }, { name: 'body_ht', label: 'Courriel (kreyòl)', type: 'textarea', rows: 5 },
      { name: 'wa_ht', label: 'WhatsApp au client (kreyòl)', type: 'textarea', rows: 4 },
      ...(kind === 'order' ? [{ name: 'dest_ht', label: 'WhatsApp au destinataire (kreyòl, facultatif)', type: 'textarea', rows: 3 }] : [])];
    openForm({ title: 'Étape « ' + st.fr + ' »', fields, values: t, before: `<p class="hint">Variables : ${ph}. Les détails (référence, montant, suivi des étapes, lien de l’espace client) sont ajoutés automatiquement sous le courriel.</p>`,
      extra: '<p><button type="button" class="btn line sm" id="tplReset">Rétablir le texte par défaut</button></p>',
      onRender: () => { $('#tplReset').onclick = safe(async () => { if (!confirm('Rétablir le texte d’origine de cette étape ?')) return; await post('/api/admin/templates/reset', { kind, stage: st.key }); closeModal(); toast('Texte rétabli'); RENDER['settings:messages'](view); }); },
      onSubmit: async v => { await post('/api/admin/templates', { ...v, kind, stage: st.key }); toast('Messages enregistrés'); RENDER['settings:messages'](view); } });
  });
};

/* ---------- Démarrage ---------- */
$('#loginForm').onsubmit = safe(async e => { e.preventDefault(); const f = new FormData(e.target); const r = await post('/api/auth/login', { email: f.get('email'), password: f.get('password') }); if (r.user.role === 'staff') { location.href = '/equipe'; return; } if (r.user.role !== 'admin') throw Error('Ce compte n’a pas accès à l’administration'); start(r.user); });
$('#logout').onclick = safe(async () => { await post('/api/auth/logout', {}); location.href = '/'; });
function start(user) {
  S.user = user; $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const [v, t] = location.hash.slice(1).split('/'); go(VIEWS.some(x => x.id === v) ? v : 'dashboard', t); refreshDash();
}
(async () => { try { const { user } = await api('/api/me'); if (user.role !== 'admin') throw Error(); start(user); } catch { $('#login').classList.remove('hidden'); } })();
