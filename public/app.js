// Magic Moments — interface client (français / kreyòl) et administrateur (français).
import { HT, HT_HTML } from './i18n.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { user: null, packages: [], equipment: [], elements: [], gallery: [], settings: {}, testimonials: [], categories: [], catHT: {}, mode: 'login', resetToken: null, step: 1, pay: null };

/* ---------- Langue ---------- */
let lang = 'fr';
try { lang = localStorage.getItem('mm_lang') === 'ht' ? 'ht' : 'fr'; } catch {}
/** Traduit un texte français de l'interface ; {x} est remplacé par vars.x. */
const t = (fr, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll('{' + k + '}', v), (lang === 'ht' && HT[fr]) || fr);
/** Champ de données dans la langue active (name → name_ht), avec repli sur le français. */
const tr = (obj, field) => (lang === 'ht' && obj?.[field + '_ht']) || obj?.[field] || '';
const trList = (obj, field) => (lang === 'ht' && obj?.[field + '_ht']?.length ? obj[field + '_ht'] : obj?.[field]) || [];
const catName = c => (lang === 'ht' && state.catHT[c]) || c;

const LABELS = { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée', unpaid: 'Non payé', pending_verification: 'En vérification', paid: 'Payé', refunded: 'Remboursé' };
const label = x => t(LABELS[x] || x);
const adminLabel = x => LABELS[x] || x;
const money = n => new Intl.NumberFormat('fr-HT').format(Number(n)) + ' HTG';
const escapeHTML = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOIS_HT = ['jan.', 'fev.', 'mas', 'avr.', 'me', 'jen', 'jiy.', 'out', 'sept.', 'okt.', 'nov.', 'des.'];
function dateTime(v, onlyDate = false) {
  const d = new Date(v); if (Number.isNaN(d.getTime())) return '';
  if (lang === 'ht') { const s = `${d.getDate()} ${MOIS_HT[d.getMonth()]} ${d.getFullYear()}`; return onlyDate ? s : `${s}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  return onlyDate ? d.toLocaleDateString('fr-CA', { dateStyle: 'medium' }) : d.toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}
const adminDate = v => new Date(v).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });

async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  let data; try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw Error(data.error || 'Erreur de connexion');
  return data;
}
function toast(msg) { const el = $('#toast'); el.textContent = t(msg); el.classList.remove('hidden'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.add('hidden'), 6000); }
const post = (url, body, method = 'POST') => api(url, { method, body: JSON.stringify(body) });

/* Traduction des textes fixes de la page (hors tableau de bord administrateur). */
const originals = new WeakMap();
function translateStatic() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('script, style, [data-i18n], [data-dyn]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n; (n = walker.nextNode());) {
    if (!originals.has(n)) originals.set(n, n.nodeValue);
    const fr = originals.get(n), key = fr.trim(); if (!key) continue;
    n.nodeValue = lang === 'ht' && HT[key] ? fr.replace(key, HT[key]) : fr;
  }
  for (const el of $$('[placeholder], [aria-label]')) {
    for (const a of ['placeholder', 'aria-label']) { if (!el.hasAttribute(a)) continue; const k = 'data-fr-' + a; if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a)); const fr = el.getAttribute(k); el.setAttribute(a, (lang === 'ht' && HT[fr]) || fr); }
  }
  for (const el of $$('[data-i18n]')) { if (!el.dataset.fr) el.dataset.fr = el.innerHTML; el.innerHTML = lang === 'ht' && HT_HTML[el.dataset.i18n] ? HT_HTML[el.dataset.i18n] : el.dataset.fr; }
  document.documentElement.lang = lang === 'ht' ? 'ht' : 'fr';
  document.title = t('Magic Moments — Chaque instant devient inoubliable');
  $('#langToggle').textContent = lang === 'ht' ? 'Français' : 'Kreyòl'; $('#drawerLang').textContent = lang === 'ht' ? '🌐 Français' : '🌐 Kreyòl';
  const oc = $('#orderForm [name=occasion]'); if (['Anniversaire', 'Anivèsè'].includes(oc.value)) oc.value = t('Anniversaire');
}
function setLang(l) {
  const keep = customLines();
  lang = l; try { localStorage.setItem('mm_lang', l); } catch {}
  translateStatic();
  renderCategories(); renderCatalog(); renderElements(keep); setBuildMode(state.buildMode); renderEquipment(); renderGallery(); renderContact(); renderTestimonials();
  setMode(state.mode); goStep(state.step); renderAuth(); refreshOrders(); renderTicker(); if (state.jobs && !$('#careersModal').classList.contains('hidden')) renderJobs(); if (state.pay) renderPay();
}
$('#langToggle').onclick = () => setLang(lang === 'ht' ? 'fr' : 'ht');

/* ---------- Connexion, inscription, mot de passe oublié ---------- */
const MODES = {
  login: ['Connexion', 'Accédez à votre espace Magic Moments.', 'Se connecter'],
  register: ['Créer un compte', 'Créez votre espace pour suivre vos commandes et reçus.', "S'inscrire"],
  forgot: ['Mot de passe oublié', 'Indiquez votre courriel : nous vous enverrons un lien valable une heure.', 'Envoyer le lien'],
  reset: ['Nouveau mot de passe', 'Choisissez un nouveau mot de passe (8 caractères minimum).', 'Enregistrer et me connecter']
};
function setMode(mode) {
  state.mode = mode; const [title, intro, submit] = MODES[mode].map(x => t(x)), f = $('#authForm');
  $('#modalTitle').textContent = title; $('#modalIntro').textContent = intro; $('#authSubmit').textContent = submit;
  const show = { nameLabel: mode === 'register', emailLabel: mode !== 'reset', passwordLabel: mode !== 'forgot', confirmLabel: mode === 'reset' };
  for (const [k, v] of Object.entries(show)) $('#' + k).classList.toggle('hidden', !v);
  f.elements.email.required = mode !== 'reset'; f.elements.password.required = mode !== 'forgot'; f.elements.confirm.required = mode === 'reset';
  f.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#forgotAuth').classList.toggle('hidden', mode !== 'login');
  $('#switchAuth').textContent = t(mode === 'login' ? 'Créer un compte' : 'Retour à la connexion');
}
const openModal = () => $('#authModal').classList.remove('hidden');
const closeModal = () => { $('#authModal').classList.add('hidden'); state.resetToken = null; setMode('login'); };
const needAuth = () => { if (state.user) return true; openModal(); toast('Connectez-vous pour continuer.'); return false; };

$('#authButton').onclick = openModal;
$('#closeModal').onclick = closeModal;
$('#authModal').onclick = e => { if (e.target.id === 'authModal') closeModal(); };
$('#switchAuth').onclick = () => setMode(state.mode === 'login' ? 'register' : 'login');
$('#forgotAuth').onclick = () => setMode('forgot');
$('#authForm').onsubmit = async e => {
  e.preventDefault(); const form = e.target, f = new FormData(form), mode = state.mode;
  try {
    if (mode === 'forgot') {
      await post('/api/auth/forgot', { email: f.get('email'), lang });
      form.reset(); closeModal(); toast('Si un compte existe pour ce courriel, un lien de réinitialisation vient d’être envoyé. Vérifiez aussi les indésirables.'); return;
    }
    let r;
    if (mode === 'reset') {
      if (f.get('password') !== f.get('confirm')) throw Error('Les mots de passe ne correspondent pas');
      r = await post('/api/auth/reset', { token: state.resetToken, password: f.get('password') }); state.resetToken = null;
    } else {
      const body = { email: f.get('email'), password: f.get('password') }; if (mode === 'register') body.name = f.get('name');
      r = await post(mode === 'register' ? '/api/auth/register' : '/api/auth/login', body);
    }
    if (r.user.role === 'admin') { location.href = '/admin'; return; }
    state.user = r.user; form.reset(); closeModal(); renderAuth();
    toast(mode === 'reset' ? 'Mot de passe modifié. Vous êtes connecté.' : 'Bienvenue sur Magic Moments !'); refreshOrders();
  } catch (err) { toast(err.message); }
};
$('#logoutButton').onclick = async () => { try { await post('/api/auth/logout', {}); } catch {} state.user = null; renderAuth(); refreshOrders(); toast('Déconnexion effectuée'); };

/* Liens reçus par courriel : #reset=<jeton> (mot de passe) et #payer=<commande>.<jeton> (paiement). */
function checkHashLinks() {
  const h = location.hash, reset = /^#reset=([a-f0-9]{64})$/.exec(h), pay = /^#payer=([a-f0-9-]{36})\.([a-f0-9]{32})$/.exec(h);
  if (!reset && !pay) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (reset) { state.resetToken = reset[1]; setMode('reset'); openModal(); }
  if (pay) openPay(pay[1], pay[2]);
}
window.addEventListener('hashchange', checkHashLinks);

function renderAuth() {
  const u = state.user;
  for (const [k, v] of Object.entries({ sender_name: u?.name, sender_email: u?.email, sender_phone: u?.phone })) { const el = $('#orderForm [name=' + k + ']'); if (u && !el.value) el.value = v || ''; if (!u) el.value = ''; }
  $('#identity').textContent = u && u.role !== 'admin' ? t('Bonjour, {n}', { n: u.name.split(' ')[0] }) : '';
  const admin = u?.role === 'admin', client = !!u && !admin;
  // Compte administrateur : un seul accès, « Administration » (le reste fait doublon avec /admin).
  $('#authButton').classList.toggle('hidden', !!u); $('#logoutButton').classList.toggle('hidden', !client); $('#accountButton').classList.toggle('hidden', !client);
  for (const id of ['#adminLink', '#drawerAdmin']) $(id).classList.toggle('hidden', !admin);
  $('#drawerAuth').classList.toggle('hidden', admin); $$('[data-account]').forEach(a => a.classList.toggle('hidden', admin && !a.closest('.bottom-nav')));
  $('#espace').classList.toggle('hidden', !client);
  $('#drawerAuth').textContent = t(u ? 'Déconnexion' : 'Se connecter'); $('#drawerHello').textContent = u ? t('Bonjour, {n}', { n: u.name.split(' ')[0] }) : '';
  renderGallery(); renderTestimonials();
}

/* ---------- Coordonnées, WhatsApp, pied de page ---------- */
function waLink(text = t('Bonjour Magic Moments, je souhaite des informations.')) {
  let d = (state.settings.whatsapp || '').replace(/\D/g, ''); if (!d) return '';
  if (d.length === 8) d = '509' + d; // numéro haïtien saisi sans indicatif
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
}
function renderContact() {
  const s = state.settings, wa = waLink();
  $('#waFloat').classList.toggle('hidden', !wa); if (wa) $('#waFloat').href = wa;
  $('#aboutText').textContent = tr(s, 'about') || t('Une question, un devis, une idée ? Écrivez-nous, nous vous répondons rapidement.');
  const tel = s.phone ? 'tel:' + s.phone.replace(/[^\d+]/g, '') : '';
  $('#contactActions').innerHTML = [wa && `<a class="btn btn-gold" href="${escapeHTML(wa)}" target="_blank" rel="noopener noreferrer">${t('Écrire sur WhatsApp')}</a>`, tel && `<a class="btn btn-ghost" href="${escapeHTML(tel)}">${t('Appeler')} ${escapeHTML(s.phone)}</a>`, `<a class="btn btn-ghost" href="#commander">${t('Demander un devis')}</a>`].filter(Boolean).join('');
  const rows = [['📍 ' + t('Adresse'), s.address], ['🗺️ ' + t('Zone desservie'), tr(s, 'zone')], ['🕘 ' + t('Horaires'), tr(s, 'hours')], ['✉️ ' + t('Courriel'), s.email && `<a href="mailto:${escapeHTML(s.email)}">${escapeHTML(s.email)}</a>`, true], ['📞 ' + t('Téléphone'), s.phone], ['💬 WhatsApp', s.whatsapp]].filter(r => r[1]);
  const socials = [['Facebook', s.facebook], ['Instagram', s.instagram], ['TikTok', s.tiktok]].filter(x => x[1]).map(([n, url]) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${n}</a>`).join(' · ');
  $('#contactInfo').innerHTML = rows.map(([k, v, html]) => `<div><small>${k}</small><p>${html ? v : escapeHTML(v)}</p></div>`).join('') + (socials ? `<div><small>${t('Réseaux sociaux')}</small><p>${socials}</p></div>` : '');
  $('#footerContact').innerHTML = [s.phone && `<p>${escapeHTML(s.phone)}</p>`, s.email && `<p>${escapeHTML(s.email)}</p>`, tr(s, 'zone') && `<p>${escapeHTML(tr(s, 'zone'))}</p>`, socials && `<p>${socials}</p>`].filter(Boolean).join('') || `<p>${t('Écrivez-nous depuis la section')} <a href="#contact">${t('Contact')}</a>.</p>`;
  const pays = (s.payments || '').split(',').map(x => x.trim()).filter(Boolean);
  $('#footerPaymentsBox').classList.toggle('hidden', !pays.length); $('#footerPayments').innerHTML = pays.map(x => `<span>${escapeHTML(x)}</span>`).join('');
  renderSlides();
}

/* ---------- Catalogue ---------- */
const DIASPORA = 'Surprise à distance (diaspora)';
const packagePhotos = p => [...new Set([p.photo, ...(p.photos || [])].filter(Boolean))];
const packageVisual = p => { const ph = packagePhotos(p); return ph.length ? `<img src="/media/${escapeHTML(ph[0])}" alt="${escapeHTML(tr(p, 'name'))}" loading="lazy">${ph.length > 1 ? `<button type="button" class="photo-count open-photos" data-pkg="${escapeHTML(p.id)}">📷 ${t('{n} photos', { n: ph.length })}</button>` : ''}` : `<span>${escapeHTML(p.image || '🎁')}</span>`; };
/* Visionneuse de photos d'une formule. */
const lb = { list: [], i: 0, title: '' };
function openPhotos(p, i = 0) { lb.list = packagePhotos(p); if (!lb.list.length) return; lb.i = i; lb.title = tr(p, 'name'); $('#lightbox').classList.remove('hidden'); showPhoto(); }
function showPhoto() { $('#lbImg').src = '/media/' + lb.list[lb.i]; $('#lbImg').alt = lb.title; $('#lbCaption').textContent = `${lb.title} — ${t('Photo {i} / {n}', { i: lb.i + 1, n: lb.list.length })}`; $$('.lb-nav').forEach(b => b.classList.toggle('hidden', lb.list.length < 2)); }
const movePhoto = d => { lb.i = (lb.i + d + lb.list.length) % lb.list.length; showPhoto(); };
$('.lb-prev').onclick = () => movePhoto(-1); $('.lb-next').onclick = () => movePhoto(1);
$('.lb-close').onclick = () => $('#lightbox').classList.add('hidden');
$('#lightbox').onclick = e => { if (e.target.id === 'lightbox') $('#lightbox').classList.add('hidden'); };
document.addEventListener('keydown', e => { if ($('#lightbox').classList.contains('hidden')) return; if (e.key === 'Escape') $('#lightbox').classList.add('hidden'); if (e.key === 'ArrowLeft') movePhoto(-1); if (e.key === 'ArrowRight') movePhoto(1); });
document.addEventListener('click', e => { const b = e.target.closest('.open-photos, .card-image img, .detail-thumb'); if (!b) return; const id = b.dataset.pkg || b.closest('[data-pkg]')?.dataset.pkg; const p = state.packages.find(x => x.id === id); if (p) openPhotos(p, Number(b.dataset.i || 0)); });
const chips = p => `<div class="chips">${tr(p, 'guests') ? `<span>👥 ${escapeHTML(tr(p, 'guests'))}</span>` : ''}${tr(p, 'lead_time') ? `<span>⏱ ${escapeHTML(tr(p, 'lead_time'))}</span>` : ''}</div>`;
function renderCategories() {
  const cats = state.categories, used = cats.filter(c => state.packages.some(p => p.category === c)), cur = $('#categoryFilter').value;
  $('#categoryFilter').innerHTML = `<option value="">${t('Toutes les catégories')}</option>` + used.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(catName(x))}</option>`).join('');
  $('#categoryFilter').value = used.includes(cur) ? cur : '';
}
function renderCatalog() {
  $('#diaspora').classList.toggle('hidden', !state.packages.some(p => p.category === DIASPORA));
  const cat = $('#categoryFilter').value, list = state.packages.filter(p => !cat || p.category === cat);
  $('#catalogueGrid').innerHTML = list.map(p => `<article class="card">
    <div class="card-image" data-pkg="${escapeHTML(p.id)}">${packageVisual(p)}</div>
    <div class="card-body"><small>${escapeHTML(catName(p.category))}</small><h3>${escapeHTML(tr(p, 'name'))}</h3><p>${escapeHTML(tr(p, 'description'))}</p>
      ${trList(p, 'includes').length ? `<ul class="includes">${trList(p, 'includes').slice(0, 5).map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
      ${chips(p)}
      <div class="card-bottom"><span class="price"><small>${t('À partir de')}</small>${money(p.price_htg)}</span><button class="btn btn-purple choose-package" data-pick="${escapeHTML(p.id)}">${t('Choisir')}</button></div>
    </div></article>`).join('') || `<p>${t('Aucune formule disponible dans cette catégorie.')}</p>`;
  $$('.choose-package').forEach(b => b.onclick = () => { setBuildMode('ready'); $('#packageSelect').value = b.dataset.pick; renderOptions(); goStep(1); location.hash = 'commander'; });
  const sel = $('#packageSelect'), cur = sel.value;
  sel.innerHTML = state.packages.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(tr(p, 'name'))} — ${t('dès')} ${money(p.price_htg)}</option>`).join('');
  sel.value = cur && [...sel.options].some(o => o.value === cur) ? cur : (state.packages[0]?.id || '');
  renderOptions();
}
$('#categoryFilter').onchange = renderCatalog;
$('#diasporaButton').onclick = () => { $('#categoryFilter').value = DIASPORA; renderCatalog(); $('#catalogue').scrollIntoView({ behavior: 'smooth' }); };

/* ---------- Créer une surprise : configurateur en 3 étapes ---------- */
state.buildMode = 'custom';
const isCustom = () => state.buildMode === 'custom';
const currentPackage = () => isCustom() ? null : state.packages.find(p => p.id === $('#packageSelect').value);
function selectedOptions() { return (currentPackage()?.options || []).filter(x => document.querySelector(`[data-option="${x.id}"]`)?.checked); }
function setBuildMode(m) {
  state.buildMode = m === 'ready' && state.packages.length ? 'ready' : 'custom';
  $$('.mode-switch button').forEach(b => b.classList.toggle('active', b.dataset.mode === state.buildMode));
  $('#elementBuilder').classList.toggle('hidden', !isCustom()); $('#readyBox').classList.toggle('hidden', isCustom());
  $('#orderForm [name=quantity]').disabled = isCustom();
  renderOptions();
}
$$('.mode-switch button').forEach(b => b.onclick = () => setBuildMode(b.dataset.mode));

/* Éléments classés par dimension ; chaque choix (taille, saveur…) peut ajouter un supplément. */
const elById = id => state.elements.find(x => x.id === id);
const plus = n => n > 0 ? `+${money(n)}` : '';
const optName = o => (lang === 'ht' && o.name_ht) || o.name;
let dimFilter = null; // null = première dimension à l'ouverture
function lineChoices(row) {
  const el = elById(row.dataset.id), choices = {};
  for (const g of el.groups || []) {
    const ins = $$(`input[name="g-${el.id}-${g.id}"]:checked`).map(i => i.value).filter(Boolean);
    if (ins.length) choices[g.id] = g.type === 'multi' ? ins : ins[0];
  }
  return choices;
}
function lineUnit(el, choices) {
  let u = el.price;
  for (const g of el.groups || []) { const v = choices[g.id]; for (const oid of [].concat(v || [])) u += g.options.find(o => o.id === oid)?.price || 0; }
  return u;
}
function customLines() {
  return $$('.element-row[data-on="1"]').map(r => ({ id: r.dataset.id, quantity: Math.max(1, Math.min(100, Number(r.querySelector('.el-qty').value) || 1)), choices: lineChoices(r), note: r.querySelector('.el-note').value }));
}
function renderElements(keep = []) {
  const dims = [...new Set(state.elements.map(e => e.category))];
  const dimLabel = d => { const e = state.elements.find(x => x.category === d); return (lang === 'ht' && e?.category_ht) || d; };
  if (dimFilter === null || (dimFilter && !dims.includes(dimFilter))) dimFilter = dims[0] || '';
  $('#dimTabs').innerHTML = [['', t('Tout')], ...dims.map(d => [d, dimLabel(d)])].map(([v, l]) => `<button type="button" class="${v === dimFilter ? 'active' : ''}" data-dim="${escapeHTML(v)}">${escapeHTML(l)}</button>`).join('');
  $('#elementList').innerHTML = dims.map(d => `<section class="dim-block" data-dim="${escapeHTML(d)}"><h4>${escapeHTML(dimLabel(d))}</h4>${state.elements.filter(e => e.category === d).map(x => {
    const groups = (x.groups || []).map(g => `<div class="el-group"><p class="g-title">${escapeHTML(tr(g, 'name'))} <em>${t(g.type === 'multi' ? 'plusieurs choix possibles' : g.required ? 'obligatoire' : 'facultatif')}</em></p><div class="opts">${
      (g.type === 'single' && !g.required ? `<label class="opt"><input type="radio" name="g-${x.id}-${g.id}" value="" checked><span>${t('Aucun')}</span></label>` : '') +
      g.options.map((o, i) => `<label class="opt"><input type="${g.type === 'multi' ? 'checkbox' : 'radio'}" name="g-${x.id}-${g.id}" value="${escapeHTML(o.id)}" ${g.type === 'single' && g.required && i === 0 ? 'checked' : ''}><span>${escapeHTML(optName(o))}</span>${o.price > 0 ? `<b>${plus(o.price)}</b>` : ''}</label>`).join('')}</div></div>`).join('');
    const minPrice = x.price + (x.groups || []).filter(g => g.required).reduce((a, g) => a + Math.min(...g.options.map(o => o.price)), 0);
    return `<div class="element-row" data-id="${escapeHTML(x.id)}">
      <div class="el-head">${x.photo ? `<img class="el-photo" data-el="${escapeHTML(x.id)}" src="/media/${escapeHTML(x.photo)}" alt="" loading="lazy">` : ''}<div class="el-info"><strong>${escapeHTML(tr(x, 'name'))}</strong>${tr(x, 'description') ? `<small>${escapeHTML(tr(x, 'description'))}</small>` : ''}<span class="el-base">${t('à partir de')} ${money(minPrice)}</span></div><button type="button" class="btn btn-purple el-add">${t('Ajouter')}</button></div>
      <div class="element-details hidden">${groups}
        <div class="el-foot"><div class="qty"><button type="button" class="q-btn" data-q="-1" aria-label="${t('Diminuer')}">−</button><input class="el-qty" type="number" min="1" max="100" value="1" aria-label="${t('Quantité')}"><button type="button" class="q-btn" data-q="1" aria-label="${t('Augmenter')}">+</button></div><span class="line-total"></span></div>
        <label>${t('Précisions (facultatif)')}<input class="el-note" maxlength="300" placeholder="${escapeHTML(t('Message, contenu du bouquet…'))}"></label>
        <button type="button" class="linkbtn el-remove">${t('Retirer')}</button></div></div>`;
  }).join('')}</section>`).join('') || `<p class="empty">${t('Les éléments seront bientôt disponibles. Choisissez une surprise prête ou écrivez-nous.')}</p>`;
  for (const l of keep) {
    const r = document.querySelector(`.element-row[data-id="${l.id}"]`); if (!r) continue;
    toggleLine(r, true); r.querySelector('.el-qty').value = l.quantity; r.querySelector('.el-note').value = l.note || '';
    for (const [gid, v] of Object.entries(l.choices || {})) { $$(`input[name="g-${l.id}-${gid}"]`).forEach(i => { i.checked = [].concat(v).includes(i.value); }); }
  }
  applyDimFilter(); updateTotal();
}
function applyDimFilter() { $$('.dim-block').forEach(b => b.classList.toggle('hidden', !!dimFilter && b.dataset.dim !== dimFilter)); $$('#dimTabs button').forEach(b => b.classList.toggle('active', b.dataset.dim === dimFilter)); }
function toggleLine(row, on) { row.dataset.on = on ? '1' : ''; row.classList.toggle('selected', on); row.querySelector('.element-details').classList.toggle('hidden', !on); row.querySelector('.el-add').textContent = on ? t('Ajouté ✓') : t('Ajouter'); }
$('#dimTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; dimFilter = b.dataset.dim; applyDimFilter(); };
$('#elementList').addEventListener('click', e => {
  const row = e.target.closest('.element-row'); if (!row) return;
  if (e.target.closest('.el-add')) { toggleLine(row, row.dataset.on !== '1'); updateTotal(); }
  else if (e.target.closest('.el-remove')) { toggleLine(row, false); updateTotal(); }
  else if (e.target.closest('.q-btn')) { const q = row.querySelector('.el-qty'); q.value = Math.max(1, Math.min(100, (Number(q.value) || 1) + Number(e.target.closest('.q-btn').dataset.q))); updateTotal(); }
  else if (e.target.closest('.el-photo')) { const el = elById(row.dataset.id); openPhotos({ photo: el.photo, photos: [], name: el.name, name_ht: el.name_ht }); }
});
$('#elementList').addEventListener('change', updateTotal);
$('#elementList').addEventListener('input', updateTotal);

function renderOptions() {
  const p = currentPackage(), checked = selectedOptions().map(x => x.id);
  $('#packageDetails').classList.toggle('hidden', !p);
  $('#packageDetails').innerHTML = p ? `${packagePhotos(p).length ? `<div class="detail-photos" data-pkg="${escapeHTML(p.id)}">${packagePhotos(p).map((ph, i) => `<img class="detail-thumb" data-i="${i}" src="/media/${escapeHTML(ph)}" alt="" loading="lazy">`).join('')}</div>` : ''}${tr(p, 'description') ? `<p>${escapeHTML(tr(p, 'description'))}</p>` : ''}${trList(p, 'includes').length ? `<ul class="includes">${trList(p, 'includes').map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}${chips(p)}` : '';
  $('#customOptions').innerHTML = (p?.options || []).length ? `<p class="hint">${t('Options supplémentaires')}</p>` + p.options.map(x => `<label class="check"><input type="checkbox" data-option="${escapeHTML(x.id)}" ${checked.includes(x.id) ? 'checked' : ''}> ${escapeHTML(x.name)} (+${money(x.price)})</label>`).join('') : '';
  updateTotal();
}
function orderTotal() {
  if (isCustom()) return customLines().reduce((a, l) => a + l.quantity * lineUnit(elById(l.id), l.choices), 0);
  const p = currentPackage(); if (!p) return null;
  return (p.price_htg + selectedOptions().reduce((a, x) => a + x.price, 0)) * Math.max(1, Number($('#orderForm [name=quantity]').value) || 1);
}
const choicesText = (el, choices) => (el.groups || []).flatMap(g => [].concat(choices[g.id] || []).map(oid => optName(g.options.find(o => o.id === oid) || {}))).filter(Boolean).join(', ');
function updateTotal() {
  const v = orderTotal(); $('#orderTotal').textContent = v === null ? '—' : money(v);
  if (!isCustom()) return;
  for (const r of $$('.element-row[data-on="1"]')) { const el = elById(r.dataset.id), q = Math.max(1, Number(r.querySelector('.el-qty').value) || 1); r.querySelector('.line-total').textContent = `${t('Sous-total')} : ${money(lineUnit(el, lineChoices(r)) * q)}`; }
  const lines = customLines();
  $('#customSummary').innerHTML = `<strong>${t('Votre surprise')}</strong>` + (lines.length ? `<ul class="sum-lines">${lines.map(l => { const el = elById(l.id), c = choicesText(el, l.choices); return `<li><span>${escapeHTML(tr(el, 'name'))}${c ? ` <small>(${escapeHTML(c)})</small>` : ''} × ${l.quantity}</span><b>${money(lineUnit(el, l.choices) * l.quantity)}</b></li>`; }).join('')}</ul>` : `<p>${t('Aucun élément choisi pour le moment.')}</p>`);
}
$('#packageSelect').onchange = renderOptions;
$('#customOptions').onchange = updateTotal;
$('#orderForm [name=quantity]').oninput = updateTotal;
const cardDefaults = () => { $('#cardName').textContent = $('#recipientInput').value || t('Votre destinataire'); $('#cardText').textContent = $('#messageInput').value || t('Votre message apparaîtra ici...'); $('#cardSign').textContent = $('#signInput').value || t('Avec amour ✨'); };
for (const id of ['#recipientInput', '#messageInput', '#signInput']) $(id).addEventListener('input', cardDefaults);
$$('.custom-start, nav a[href="#commander"]').forEach(a => a.addEventListener('click', () => { setBuildMode('custom'); goStep(1); }));

function validateStep(n) {
  if (n === 1 && isCustom()) {
    const lines = customLines(); if (!lines.length) { goStep(1); toast('Ajoutez au moins un élément pour composer votre surprise.'); return false; }
    for (const l of lines) { const el = elById(l.id); for (const g of el.groups || []) if (g.required && ![].concat(l.choices[g.id] || []).length) { goStep(1); toast(t('Faites un choix pour « {g} »', { g: `${tr(g, 'name')} — ${tr(el, 'name')}` })); return false; } }
  }
  if (n === 1 && !isCustom() && !currentPackage()) { goStep(1); toast('Choisissez une surprise.'); return false; }
  for (const el of $$(`.step[data-step="${n}"] input, .step[data-step="${n}"] select, .step[data-step="${n}"] textarea`)) {
    if (el.disabled || el.closest('.hidden:not(.step)') || el.closest('details:not([open])') || el.closest('#elementBuilder')) continue;
    if (!el.checkValidity()) { goStep(n); el.reportValidity(); return false; }
  }
  if (n === 2) {
    const ev = $('#orderForm [name=event_at]');
    if (new Date(ev.value).getTime() <= Date.now()) { goStep(2); toast('Choisissez une date et une heure à venir.'); ev.focus(); return false; }
    for (const k of ['sender_phone', 'recipient_phone']) { const el = $(`#orderForm [name=${k}]`); if (!/^\+?[0-9 ()-]{7,25}$/.test(el.value.trim()) || el.value.replace(/\D/g, '').length < 7) { goStep(2); toast('Numéro de téléphone incomplet ou invalide.'); el.focus(); return false; } }
  }
  return true;
}
function goStep(n) {
  state.step = n;
  $$('.step').forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== n));
  $$('.steps li').forEach(li => { const i = Number(li.dataset.indicator); li.classList.toggle('active', i === n); li.classList.toggle('done', i < n); });
  $('#stepBack').classList.toggle('invisible', n === 1);
  $('#stepNext').classList.toggle('hidden', n === 3); $('#orderSubmit').classList.toggle('hidden', n !== 3);
  if (n === 3) renderSummary();
}
function renderSummary() {
  const f = new FormData($('#orderForm')), p = currentPackage();
  const items = p ? [tr(p, 'name'), ...selectedOptions().map(x => '+ ' + x.name)] : customLines().map(l => { const el = elById(l.id), c = choicesText(el, l.choices); return `${tr(el, 'name')}${c ? ' (' + c + ')' : ''} × ${l.quantity}`; });
  $('#orderSummary').innerHTML = `<strong>${t('Récapitulatif')}</strong><p>${items.map(escapeHTML).join('<br>')}</p><p>${t('Pour')} <b>${escapeHTML(f.get('recipient'))}</b> · ${escapeHTML(f.get('city'))} (${escapeHTML(f.get('department'))})<br>${f.get('event_at') ? escapeHTML(dateTime(f.get('event_at'))) : ''}</p>`;
}
$('#stepNext').onclick = () => { if (validateStep(state.step)) { goStep(state.step + 1); $('#orderForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
$('#stepBack').onclick = () => goStep(Math.max(1, state.step - 1));

$('#orderForm').onsubmit = async e => {
  e.preventDefault(); if (state.step !== 3) { $('#stepNext').click(); return; }
  for (const n of [1, 2, 3]) if (!validateStep(n)) return;
  const f = new FormData(e.target), btn = $('#orderSubmit'); btn.disabled = true;
  try {
    const body = {
      lang, package_id: isCustom() ? 'custom' : $('#packageSelect').value, occasion: f.get('occasion'), recipient: f.get('recipient'), message: f.get('message'), city: f.get('city'), address: f.get('address'),
      event_at: new Date(f.get('event_at')).toISOString(), quantity: isCustom() ? 1 : Number(f.get('quantity') || 1), elements: isCustom() ? customLines() : [], live_requested: f.has('live_requested'), options: selectedOptions().map(x => x.id),
      ...Object.fromEntries(['sender_name', 'sender_phone', 'sender_email', 'recipient_phone', 'alternate_phone', 'department', 'landmark', 'colors', 'theme', 'cake', 'music', 'notes', 'sender'].map(k => [k, f.get(k) || '']))
    };
    await post('/api/orders', body);
    for (const k of ['recipient', 'recipient_phone', 'alternate_phone', 'message', 'sender', 'landmark', 'address', 'event_at', 'colors', 'theme', 'cake', 'music', 'notes']) e.target.elements[k].value = '';
    e.target.elements.live_requested.checked = false; cardDefaults();
    renderElements(); setBuildMode(state.buildMode); goStep(1);
    if (state.user) { toast('Demande enregistrée ! Suivez-la dans votre espace client. Aucun paiement n’a été effectué.'); location.hash = 'espace'; refreshOrders(); }
    else toast('Merci ! Votre demande est enregistrée. Notre équipe vous recontacte par WhatsApp ou téléphone. Un récapitulatif vous est envoyé par courriel.');
  } catch (err) { toast(err.message); } finally { btn.disabled = false; }
};

/* ---------- Location : plusieurs matériels par demande ---------- */
state.rentalLines = []; // [{ id, qty }]
const eqById = id => state.equipment.find(x => x.id === id);
function renderEquipment() {
  $('#equipmentGrid').innerHTML = state.equipment.map(e => `<button type="button" class="equipment-item ${e.photo ? 'has-photo' : ''}" data-eq="${escapeHTML(e.id)}">${e.photo ? `<img class="eq-img" src="/media/${escapeHTML(e.photo)}" alt="" loading="lazy">` : ''}<h3>${e.photo ? '' : '✦ '}${escapeHTML(tr(e, 'name'))}</h3><p>${money(e.daily_price_htg)} ${t('/ jour')}</p><p>${t('Disponibles :')} ${Number(e.stock)}</p><span class="eq-cta">${t('Ajouter')} →</span></button>`).join('');
  state.rentalLines = state.rentalLines.filter(l => eqById(l.id));
  if (!state.rentalLines.length && state.equipment.length) state.rentalLines.push({ id: state.equipment[0].id, qty: 1 });
  renderRentalLines();
}
function renderRentalLines() {
  const opts = cur => state.equipment.map(e => `<option value="${escapeHTML(e.id)}" ${e.id === cur ? 'selected' : ''}>${escapeHTML(tr(e, 'name'))} — ${money(e.daily_price_htg)} ${t('/ jour')}</option>`).join('');
  $('#rentalLines').innerHTML = state.rentalLines.map((l, i) => `<div class="rental-line" data-i="${i}"><label>${t('Matériel')}<select class="rl-eq">${opts(l.id)}</select></label><label>${t('Quantité')}<input class="rl-qty" type="number" min="1" max="1000" value="${l.qty}"></label>${state.rentalLines.length > 1 ? `<button type="button" class="rl-del" aria-label="${t('Retirer ce matériel')}">×</button>` : ''}</div>`).join('');
  updateRentalTotal();
}
function rentalDays() { const f = $('#rentalForm'), s = Date.parse(f.elements.start_at.value), e = Date.parse(f.elements.end_at.value); return s && e && e > s ? Math.ceil((e - s) / 86400000) : 1; }
function updateRentalTotal() {
  const days = rentalDays(), lines = state.rentalLines.map(l => ({ e: eqById(l.id), qty: l.qty })).filter(x => x.e && x.qty > 0);
  const total = lines.reduce((a, x) => a + x.e.daily_price_htg * x.qty * days, 0);
  $('#rentalBreakdown').innerHTML = lines.length ? `<ul class="sum-lines">${lines.map(x => `<li><span>${escapeHTML(tr(x.e, 'name'))} × ${x.qty}</span><b>${money(x.e.daily_price_htg * x.qty * days)}</b></li>`).join('')}</ul><p class="hint">${t('Durée : {d} jour(s)', { d: days })}</p>` : '';
  $('#rentalTotal').textContent = lines.length ? money(total) : '—';
}
$('#rentalLines').addEventListener('input', e => {
  const row = e.target.closest('.rental-line'); if (!row) return; const l = state.rentalLines[Number(row.dataset.i)];
  if (e.target.matches('.rl-qty')) l.qty = Math.max(0, Math.min(1000, Number(e.target.value) || 0));
  if (e.target.matches('.rl-eq')) { if (state.rentalLines.some((x, k) => x.id === e.target.value && k !== Number(row.dataset.i))) { toast('Ce matériel est déjà dans votre demande.'); e.target.value = l.id; return; } l.id = e.target.value; }
  updateRentalTotal();
});
$('#rentalLines').addEventListener('click', e => { const b = e.target.closest('.rl-del'); if (!b) return; state.rentalLines.splice(Number(b.closest('.rental-line').dataset.i), 1); renderRentalLines(); });
$('#addRentalLine').onclick = () => { const free = state.equipment.find(e => !state.rentalLines.some(l => l.id === e.id)); if (!free) { toast('Ce matériel est déjà dans votre demande.'); return; } state.rentalLines.push({ id: free.id, qty: 1 }); renderRentalLines(); };
$('#rentalForm').addEventListener('input', e => { if (e.target.name === 'start_at' || e.target.name === 'end_at') updateRentalTotal(); });
$('#rentalOpen').onclick = () => { $('#rentalForm').classList.remove('collapsed'); $('#rentalOpen').classList.add('hidden'); };
$('#equipmentGrid').addEventListener('click', e => {
  const it = e.target.closest('[data-eq]'); if (!it) return; const id = it.dataset.eq, line = state.rentalLines.find(l => l.id === id);
  // Le premier clic remplace la ligne par défaut encore vierge ; les suivants ajoutent un matériel ou augmentent sa quantité.
  if (!state.rentalTouched && state.rentalLines.length <= 1) state.rentalLines = [{ id, qty: 1 }]; else if (line) line.qty += 1; else state.rentalLines.push({ id, qty: 1 });
  state.rentalTouched = true; renderRentalLines(); $('#rentalOpen').click(); toast(`${tr(eqById(id), 'name')} — ${t('Ajouté ✓')}`);
});
$('#rentalForm').onsubmit = async e => {
  e.preventDefault(); if (!needAuth()) return; const form = e.target, f = new FormData(form);
  const items = state.rentalLines.filter(l => l.qty > 0).map(l => ({ equipment_id: l.id, quantity: l.qty }));
  if (!items.length) { toast('Ajoutez au moins un matériel.'); return; }
  for (const el of [form.elements.start_at, form.elements.end_at, form.elements.city]) if (!el.checkValidity()) { el.reportValidity(); return; }
  try {
    await post('/api/rentals', { items, city: f.get('city'), address: f.get('address'), note: f.get('note'), start_at: new Date(f.get('start_at')).toISOString(), end_at: new Date(f.get('end_at')).toISOString() });
    toast('Demande de location enregistrée, en attente de confirmation.'); form.reset(); state.rentalLines = []; state.rentalTouched = false; renderEquipment(); goAccount(); refreshOrders();
  } catch (err) { toast(err.message.startsWith('Stock insuffisant : ') ? t('Stock insuffisant : {n}', { n: err.message.slice(20) }) : err.message); }
};

/* ---------- Cookies et mesure d'audience (avec consentement) ---------- */
const getCookie = n => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')) || [])[1] || '';
function setCookie(n, v, days) { document.cookie = `${n}=${v}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; }
function recordVisit() {
  if (getCookie('mm_consent') !== 'yes') return;
  if (!/^[a-f0-9-]{36}$/.test(getCookie('mm_vid'))) setCookie('mm_vid', crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)), 365);
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  fetch('/api/visit', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: location.pathname + location.hash, ref: document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '', lang, tz, screen: `${screen.width}x${screen.height}` }) }).catch(() => {});
}
function showCookieBanner(show) { $('#cookieBanner').classList.toggle('hidden', !show); }
$('#cookieAccept').onclick = () => { setCookie('mm_consent', 'yes', 365); showCookieBanner(false); recordVisit(); toast('Votre choix est enregistré.'); };
$('#cookieRefuse').onclick = () => { setCookie('mm_consent', 'no', 365); setCookie('mm_vid', '', 0); showCookieBanner(false); toast('Votre choix est enregistré.'); };
$('#cookieSettings').onclick = e => { e.preventDefault(); showCookieBanner(true); };

/* ---------- Galerie et témoignages ---------- */
async function loadGallery() { state.gallery = await api('/api/gallery'); renderGallery(); renderContact(); renderCatalog(); }
function renderGallery() {
  $('#galleryGrid').innerHTML = state.gallery.map(x => `<article class="card">${x.mime.startsWith('video/') ? `<video controls preload="metadata" src="/media/${escapeHTML(x.id)}"></video>` : `<img loading="lazy" src="/media/${escapeHTML(x.id)}" alt="${escapeHTML(x.title)}">`}<div class="card-body">${escapeHTML(x.title)}</div></article>`).join('') || `<p class="empty">${t('Nos premières réalisations arrivent bientôt.')}</p>`;
}
function renderTestimonials() {
  $('#avis').classList.toggle('hidden', !state.testimonials.length);
  $('#testimonialGrid').innerHTML = state.testimonials.slice().reverse().map(x => `<figure class="testimonial"><blockquote>« ${escapeHTML(x.text)} »</blockquote><figcaption><strong>${escapeHTML(x.name)}</strong>${[x.occasion, x.city].filter(Boolean).length ? ' · ' + escapeHTML([x.occasion, x.city].filter(Boolean).join(', ')) : ''}</figcaption></figure>`).join('');
  $('#drawerAvis').classList.toggle('hidden', !state.testimonials.length);
}

/* ---------- Paiement en ligne (PlopPlop) ---------- */
const canPayOnline = o => state.settings.online_payment && !['pending', 'cancelled'].includes(o.status) && ['unpaid', 'pending_verification'].includes(o.payment_status);
let payTimer = null;
function savePending(v) { try { v ? sessionStorage.setItem('mm_pay', JSON.stringify(v)) : sessionStorage.removeItem('mm_pay'); } catch {} }
async function openPay(id, token) {
  state.pay = { id, token, info: null, opened: false, error: '' }; $('#payModal').classList.remove('hidden'); renderPay();
  try { state.pay.info = await post('/api/pay/info', { id, token }); if (state.pay.info.pending_attempt) { state.pay.opened = true; await verifyPay(true); } } catch (err) { state.pay.error = err.message; }
  renderPay();
}
function closePay() { $('#payModal').classList.add('hidden'); clearInterval(payTimer); payTimer = null; state.pay = null; }
$('#closePay').onclick = closePay;
$('#payModal').onclick = e => { if (e.target.id === 'payModal') closePay(); };
function renderPay() {
  const p = state.pay; if (!p) return; const i = p.info;
  if (p.error) { $('#payInfo').innerHTML = `<p class="warning">${escapeHTML(t(p.error))}</p>`; $('#payActions').innerHTML = ''; return; }
  if (!i) { $('#payInfo').innerHTML = `<p>${t('Chargement…')}</p>`; $('#payActions').innerHTML = ''; return; }
  $('#payInfo').innerHTML = `<div class="summary"><strong>${escapeHTML(tr(i, 'package_name'))}</strong><p>${t('Pour')} <b>${escapeHTML(i.recipient)}</b> · ${escapeHTML(dateTime(i.event_at))}</p><p class="pay-amount">${money(i.amount)}</p><p>${t('Statut')} : ${escapeHTML(label(i.status))} · ${t('Paiement')} : ${escapeHTML(label(i.payment_status))}</p></div>`;
  let html = '';
  if (i.payment_status === 'paid') html = `<p class="success">✅ ${t('Paiement confirmé ! Merci. Votre reçu vous est envoyé par courriel.')}</p>`;
  else if (!i.online) html = `<p>${t('Le paiement en ligne n’est pas encore disponible. Notre équipe vous indiquera comment régler.')}</p>`;
  else if (!i.payable) html = `<p>${t('Paiement possible après confirmation de la commande par notre équipe.')}</p>`;
  else {
    html = `<button type="button" class="btn btn-gold full" id="payGo">💳 ${t('Payer {m} maintenant', { m: money(i.amount) })}</button>`;
    if (p.opened) html += `<p class="hint">${t('Terminez le paiement sur la page PlopPlop, puis revenez ici.')}</p><button type="button" class="btn btn-purple full" id="payCheck">${t('J’ai payé — vérifier')}</button>`;
  }
  $('#payActions').innerHTML = html;
  $('#payGo')?.addEventListener('click', startPay); $('#payCheck')?.addEventListener('click', () => verifyPay(false));
}
async function startPay() {
  const p = state.pay, w = window.open('', '_blank'); // ouverte tout de suite pour éviter le blocage des fenêtres
  try {
    const r = await post('/api/pay/open', { id: p.id, token: p.token });
    p.opened = true; savePending({ id: p.id, token: p.token }); renderPay();
    if (w) w.location = r.url; else location.href = r.url;
    clearInterval(payTimer); let n = 0; payTimer = setInterval(() => { if (++n > 40 || !state.pay) { clearInterval(payTimer); return; } verifyPay(true); }, 6000);
  } catch (err) { if (w) w.close(); toast(err.message); }
}
async function verifyPay(silent) {
  const p = state.pay; if (!p) return;
  try {
    const r = await post('/api/pay/verify', { id: p.id, token: p.token }); p.info = r;
    if (r.paid || r.payment_status === 'paid') { clearInterval(payTimer); savePending(null); renderPay(); toast('Paiement confirmé ! Merci.'); refreshOrders(); return; }
    if (!silent) toast('Le paiement n’est pas encore confirmé. Patientez quelques secondes puis réessayez.');
  } catch (err) { if (!silent) toast(err.message); }
  renderPay();
}
const onReturn = () => { if (state.pay?.opened && document.visibilityState === 'visible') verifyPay(true); };
window.addEventListener('focus', onReturn); document.addEventListener('visibilitychange', onReturn);

/* ---------- Espace client ---------- */
async function refreshOrders() {
  if (state.user?.role === 'admin') return;
  if (!state.user) { showLive(); $('#myOrders').innerHTML = `<div class="empty">${t('Connectez-vous pour consulter vos commandes.')}</div>`; $('#myRentals').innerHTML = ''; return; }
  try {
    const [orders, rentals] = await Promise.all([api('/api/orders'), api('/api/rentals')]); showLive(orders);
    const mine = state.user.role === 'admin' ? orders.filter(o => o.user_id === state.user.id) : orders;
    $('#myOrders').innerHTML = mine.length ? mine.map(o => {
      const amount = o.amount_due || o.total_htg, pkg = (lang === 'ht' && o.package_name_ht) || o.package_name;
      const payBtn = canPayOnline(o) ? `<button class="btn btn-gold pay-now" data-id="${escapeHTML(o.id)}" data-token="${escapeHTML(o.pay_token || '')}">💳 ${t('Payer {m} maintenant', { m: money(amount) })}</button>` : '';
      const manual = !state.settings.online_payment && o.payment_url && ['unpaid', 'pending_verification'].includes(o.payment_status) ? `<p><a target="_blank" rel="noopener noreferrer" href="${escapeHTML(o.payment_url)}">${t('Payer avec Pay’m PlopPlop')}</a> <button class="reference" data-id="${escapeHTML(o.id)}">${t('Déclarer la référence')}</button></p>` : '';
      const waiting = o.status === 'pending' && o.payment_status === 'unpaid' && state.settings.online_payment ? `<p class="hint">${t('Paiement possible après confirmation de la commande par notre équipe.')}</p>` : '';
      return `<article class="order"><div><strong>${escapeHTML(pkg)} · ${escapeHTML(o.recipient)}</strong><p>📍 ${escapeHTML(o.city)} · ${escapeHTML(dateTime(o.event_at))}</p>${o.message ? `<p>${t('Carte')} : « ${escapeHTML(o.message)} »</p>` : ''}<p><span class="status">${escapeHTML(label(o.status))}</span> · ${t('Paiement')} : ${escapeHTML(label(o.payment_status))}</p>${o.live_url ? `<p><a href="${escapeHTML(o.live_url)}" target="_blank" rel="noopener noreferrer">▶ ${t('Rejoindre Magic Live (lien externe)')}</a></p>` : ''}${waiting}${payBtn}${manual}${o.payment_status === 'paid' ? `<button class="receipt" data-id="${escapeHTML(o.id)}">${t('Reçu')}</button>` : ''}</div><strong>${money(amount)}</strong></article>`;
    }).join('') : `<div class="empty">${t('Aucune commande pour le moment.')}</div>`;
    const myRentals = state.user.role === 'admin' ? rentals.filter(r => r.user_id === state.user.id) : rentals;
    $('#myRentals').innerHTML = myRentals.length ? myRentals.map(r => `<article class="order"><div><strong>${escapeHTML(r.items ? r.items.map(x => ((lang === 'ht' && x.name_ht) || x.name) + ' × ' + x.quantity).join(', ') : ((lang === 'ht' && state.equipment.find(e => e.id === r.equipment_id)?.name_ht) || r.equipment_name))}</strong><p>${r.items ? '' : Number(r.quantity) + ' ' + t('unité(s)') + ' · '}${escapeHTML(r.city)}${r.estimate ? ' · ' + money(r.estimate) : ''}</p><p>${dateTime(r.start_at, true)} — ${dateTime(r.end_at, true)}</p></div><span class="status">${escapeHTML(label(r.status))}</span></article>`).join('') : `<div class="empty">${t('Aucune demande de location.')}</div>`;
  } catch (err) { toast(err.message); }
}
async function showLive(list) {
  if (!state.user) { $('#liveList').innerHTML = `<p>${t('Connectez-vous pour retrouver vos événements privés.')}</p>`; return; }
  try {
    const orders = list || await api('/api/orders');
    $('#liveList').innerHTML = orders.filter(o => (o.live_requested || o.live_url) && o.user_id === state.user.id).map(o => `<article class="order"><div><strong>${escapeHTML((lang === 'ht' && o.package_name_ht) || o.package_name)} — ${escapeHTML(o.recipient)}</strong><p>${escapeHTML(dateTime(o.event_at))}</p>${o.live_url ? `<a class="btn btn-purple" href="${escapeHTML(o.live_url)}" target="_blank" rel="noopener noreferrer">▶ ${t('Rejoindre le direct privé')}</a>` : `<p>${t('En attente du lien de diffusion de l’équipe.')}</p>`}</div></article>`).join('') || `<p>${t('Aucun direct demandé.')}</p>`;
  } catch (err) { toast(err.message); }
}
$('#liveRefresh').onclick = () => { if (needAuth()) showLive(); };
window.addEventListener('hashchange', () => { if (location.hash === '#live' && state.user) showLive(); });
$('#refreshOrders').onclick = refreshOrders;

async function loadCategories() { const full = await api('/api/categories?full=1'); state.categories = full.map(x => x.name); state.catHT = Object.fromEntries(full.filter(x => x.name_ht).map(x => [x.name, x.name_ht])); }

/* ---------- Menu tiroir (téléphone), barre de raccourcis, compte ---------- */
const drawer = $('#drawer');
function openDrawer(open) { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', open ? 'false' : 'true'); $('#menuButton').setAttribute('aria-expanded', open ? 'true' : 'false'); document.body.classList.toggle('no-scroll', open); }
$('#menuButton').onclick = () => openDrawer(true);
$('#drawerClose').onclick = () => openDrawer(false);
drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('.drawer-nav a')) openDrawer(false); });
$('#drawerLang').onclick = () => { setLang(lang === 'ht' ? 'fr' : 'ht'); };
$('#drawerAuth').onclick = () => { openDrawer(false); if (state.user) $('#logoutButton').click(); else openModal(); };
$('#accountButton').onclick = () => goAccount();
function goAccount() { if (!state.user) { openModal(); return; } if (state.user.role === 'admin') { location.href = '/admin'; return; } $('#espace').classList.remove('hidden'); $('#espace').scrollIntoView({ behavior: 'smooth' }); }
document.addEventListener('click', e => { const a = e.target.closest('[data-account]'); if (!a) return; e.preventDefault(); openDrawer(false); goAccount(); });
// Raccourci actif selon la section visible.
const secs = ['accueil', 'catalogue', 'commander', 'location', 'espace'].map(id => document.getElementById(id)).filter(Boolean);
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => { for (const en of es) if (en.isIntersecting) $$('.bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.sec === en.target.id)); }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => io.observe(s));
}

/* ---------- Diaporama d'accueil ---------- */
let slideTimer = null, slideIdx = 0;
function renderSlides() {
  const list = (state.settings.hero_slides || []).filter(s => s.media);
  const items = list.length ? list : [{ media: '', caption: '' }];
  $('#slides').innerHTML = items.map((s, i) => `<figure class="slide ${i === 0 ? 'active' : ''}"><img src="${s.media ? '/media/' + escapeHTML(s.media) : '/logo.png'}" alt="${escapeHTML(tr(s, 'caption') || 'Magic Moments')}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>${tr(s, 'caption') ? `<figcaption>${escapeHTML(tr(s, 'caption'))}</figcaption>` : ''}</figure>`).join('');
  $('#slideDots').innerHTML = items.length > 1 ? items.map((_, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-slide="${i}" aria-label="${i + 1}"></button>`).join('') : '';
  $('.hero-art').classList.toggle('photo', !!list.length);
  slideIdx = 0; clearInterval(slideTimer); if (items.length > 1) slideTimer = setInterval(() => showSlide(slideIdx + 1), 5000);
}
function showSlide(i) {
  const s = $$('#slides .slide'); if (!s.length) return; slideIdx = (i + s.length) % s.length;
  s.forEach((x, k) => x.classList.toggle('active', k === slideIdx)); $$('#slideDots button').forEach((x, k) => x.classList.toggle('active', k === slideIdx));
}
$('#slideDots').onclick = e => { const b = e.target.closest('[data-slide]'); if (!b) return; showSlide(Number(b.dataset.slide)); clearInterval(slideTimer); slideTimer = setInterval(() => showSlide(slideIdx + 1), 5000); };
let touchX = null;
$('#slideshow').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
$('#slideshow').addEventListener('touchend', e => { if (touchX === null) return; const d = e.changedTouches[0].clientX - touchX; if (Math.abs(d) > 40) showSlide(slideIdx + (d < 0 ? 1 : -1)); touchX = null; });

/* ---------- Bande d'annonces défilante ---------- */
function renderTicker() {
  let closed = ''; try { closed = sessionStorage.getItem('mm_ticker') || ''; } catch {}
  const list = state.announcements || [], sig = list.map(a => a.id).join(',');
  $('#ticker').classList.toggle('hidden', !list.length || closed === sig);
  if (!list.length) return;
  const one = list.map(a => { const txt = escapeHTML(tr(a, 'text')); return a.link ? `<a href="${escapeHTML(a.link)}" ${a.link.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${txt}</a>` : `<span>${txt}</span>`; }).join('<b>✦</b>');
  $('#tickerTrack').innerHTML = `<div class="ticker-run">${one}<b>✦</b></div><div class="ticker-run" aria-hidden="true">${one}<b>✦</b></div>`;
  const run = $('#tickerTrack .ticker-run'); $('#tickerTrack').style.setProperty('--dur', Math.max(15, run.textContent.length / 6) + 's');
  $('#tickerClose').onclick = () => { try { sessionStorage.setItem('mm_ticker', sig); } catch {} $('#ticker').classList.add('hidden'); };
}

/* ---------- Carrières ---------- */
async function openCareers() {
  $('#careersModal').classList.remove('hidden'); $('#jobsList').innerHTML = `<p>${t('Chargement…')}</p>`;
  try { state.jobs = await api('/api/jobs'); renderJobs(); } catch (err) { $('#jobsList').innerHTML = `<p class="warning">${escapeHTML(t(err.message))}</p>`; }
}
function renderJobs(openId) {
  const jobs = state.jobs || [];
  $('#jobsList').innerHTML = jobs.length ? jobs.map(j => `<article class="job ${openId === j.id ? 'open' : ''}" data-job="${escapeHTML(j.id)}"><div class="job-head"><div><strong>${escapeHTML(tr(j, 'title'))}</strong><p>${escapeHTML([t(j.type), j.location, j.deadline ? t('Jusqu’au {d}', { d: dateTime(j.deadline, true) }) : ''].filter(Boolean).join(' · '))}</p></div><button type="button" class="btn btn-purple job-toggle">${t(openId === j.id ? 'Fermer' : 'Voir et postuler')}</button></div>
    ${openId === j.id ? `<div class="job-body"><p>${escapeHTML(tr(j, 'description')).replace(/\n/g, '<br>')}</p>${tr(j, 'requirements') ? `<h4>${t('Profil recherché')}</h4><p>${escapeHTML(tr(j, 'requirements')).replace(/\n/g, '<br>')}</p>` : ''}${j.salary ? `<p><b>${t('Rémunération')} :</b> ${escapeHTML(j.salary)}</p>` : ''}
      <form class="apply-form"><h4>${t('Postuler')}</h4><label>${t('Nom complet')}<input name="name" required maxlength="120"></label><div class="form-grid"><label>${t('Téléphone')}<input name="phone" type="tel" required placeholder="+509 ..."></label><label>${t('Courriel')}<input name="email" type="email" required></label></div><label>${t('Message (facultatif)')}<textarea name="message" rows="3" maxlength="3000"></textarea></label><label>${t('CV (PDF, Word ou photo, 6 Mo maximum)')}<input name="cv" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png"></label><button class="btn btn-gold full">${t('Envoyer ma candidature')}</button></form></div>` : ''}</article>`).join('')
    : `<p class="empty">${t('Aucun poste ouvert pour le moment. Revenez bientôt !')}</p>`;
}
$('#jobsList').addEventListener('click', e => { const b = e.target.closest('.job-toggle'); if (!b) return; const id = b.closest('.job').dataset.job; renderJobs($('.job.open')?.dataset.job === id ? null : id); });
$('#jobsList').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.target, id = form.closest('.job').dataset.job, f = new FormData(form), file = f.get('cv'), btn = form.querySelector('button'); btn.disabled = true;
  try {
    let cv = null;
    if (file && file.size) { if (file.size > 6e6) throw Error('Fichier trop volumineux (6 Mo maximum)'); cv = { name: file.name, mime: file.type, data: await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }) }; }
    await post(`/api/jobs/${id}/apply`, { name: f.get('name'), phone: f.get('phone'), email: f.get('email'), message: f.get('message'), cv });
    $('#jobsList').innerHTML = `<p class="success">✅ ${t('Merci ! Votre candidature a bien été envoyée. Nous vous contacterons si votre profil est retenu.')}</p>`;
  } catch (err) { toast(err.message); btn.disabled = false; }
});
document.addEventListener('click', e => { const a = e.target.closest('[data-open="careers"]'); if (!a) return; e.preventDefault(); openDrawer(false); openCareers(); });
$('#closeCareers').onclick = () => $('#careersModal').classList.add('hidden');
$('#careersModal').onclick = e => { if (e.target.id === 'careersModal') $('#careersModal').classList.add('hidden'); };

// Actions des listes de l'espace client (délégation).
document.addEventListener('click', async e => {
  const b = e.target.closest('button[data-id]'); if (!b) return; const id = b.dataset.id;
  try {
    if (b.matches('.pay-now')) openPay(id, b.dataset.token);
    else if (b.matches('.reference')) { const reference = prompt(t('Référence de transaction')); if (!reference) return; await post('/api/payment-reference', { id, reference }); await refreshOrders(); }
    else if (b.matches('.receipt')) {
      const w = window.open('', '_blank'); if (!w) throw Error('Autorisez les fenêtres contextuelles');
      try { const r = await api('/api/receipt/' + id); w.document.body.innerHTML = `<h1>Magic Moments — ${t('Reçu')}</h1><p>${escapeHTML(r.number)}</p><p>${t('Client')} : ${escapeHTML(r.customer)}</p><p>${t('Surprise')} : ${escapeHTML(r.package)}</p><p>${t('Options')} : ${escapeHTML(r.options.map(x => ((lang === 'ht' && x.name_ht) || x.name) + ((x.choices || []).length ? ' (' + x.choices.map(c => (lang === 'ht' && c.option_ht) || c.option).join(', ') + ')' : '') + (x.quantity > 1 ? ' × ' + x.quantity : '')).join(', '))}</p><h2>${t('Montant encaissé')} : ${money(r.total)}</h2><p>${t('Date')} : ${escapeHTML(r.date ? dateTime(r.date) : t('Non enregistrée'))}</p><p>${t('Transaction')} : ${escapeHTML(r.reference || t('Validation administrative'))}</p>`; w.print(); } catch (err) { w.close(); throw err; }
    }
  } catch (err) { toast(err.message); }
});

/* ---------- Démarrage ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();
  translateStatic();
  try {
    const [packages, equipment, elements, gallery, settings, testimonials, announcements] = await Promise.all(['/api/packages', '/api/equipment', '/api/elements', '/api/gallery', '/api/settings', '/api/testimonials', '/api/announcements'].map(u => api(u)));
    Object.assign(state, { packages, equipment, elements, gallery, settings, testimonials, announcements }); renderTicker(); await loadCategories();
    renderElements(); renderCategories(); renderCatalog(); setBuildMode('custom'); renderEquipment(); renderGallery(); renderContact(); cardDefaults(); setMode('login'); goStep(1);
    try { state.user = (await api('/api/me')).user; } catch {}
    renderAuth(); refreshOrders(); checkHashLinks();
    if (!getCookie('mm_consent')) showCookieBanner(true); else recordVisit();
    if (!state.pay) { try { const p = JSON.parse(sessionStorage.getItem('mm_pay') || 'null'); if (p) openPay(p.id, p.token); } catch {} }
  } catch (err) { toast(t('Impossible de charger les données : ') + t(err.message)); }
}
init();
