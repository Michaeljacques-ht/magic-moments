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

const LABELS = { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', in_progress: 'En livraison', delivered: 'Livrée et installée', completed: 'Terminée', cancelled: 'Annulée', unpaid: 'Non payé', partial: 'Acompte payé', pending_verification: 'En vérification', paid: 'Payé', refunded: 'Remboursé' };
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
  renderCategories(); renderCatalog(); renderElements(keep); setBuildMode(state.buildMode); renderEquipment(); renderGallery(); renderContact(); renderTestimonials(); renderExpress(); renderShop(); renderCart(); renderAddons();
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
    if (r.user.role === 'staff') { location.href = '/equipe'; return; }
    state.user = r.user; form.reset(); closeModal(); renderAuth();
    toast(mode === 'reset' ? 'Mot de passe modifié. Vous êtes connecté.' : 'Bienvenue sur Magic Moments !'); refreshOrders();
  } catch (err) { toast(err.message); }
};
const openLogin = () => { setMode('login'); openModal(); openDrawer(false); };
$('#loginButton').onclick = openLogin; $('#drawerLogin').onclick = openLogin;
$('#logoutButton').onclick = () => logoutClient(); $('#drawerLogout').onclick = () => { openDrawer(false); logoutClient(); };
async function logoutClient() { try { await post('/api/client/logout', {}); } catch {} if (state.user) { try { await post('/api/auth/logout', {}); } catch {} state.user = null; renderAuth(); } refreshOrders(); toast('Déconnexion effectuée'); }

/* Liens reçus par courriel : #reset=<jeton> (mot de passe) et #payer=<commande>.<jeton> (paiement). */
function checkHashLinks() {
  const h = location.hash, reset = /^#reset=([a-f0-9]{64})$/.exec(h), pay = /^#payer(-location)?=([a-f0-9-]{36})\.([a-f0-9]{32})$/.exec(h), follow = /^#suivre=([ol])\.([a-f0-9-]{36})\.([a-f0-9]{32})$/.exec(h);
  if (follow) { history.replaceState(null, '', location.pathname + location.search + '#espace'); showPage('espace'); remember(follow[1] === 'l' ? 'rental' : 'order', follow[2], follow[3]); refreshOrders().then(() => { const el = document.getElementById('it-' + follow[2]); (el || $('#espace')).scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('flash'); }); return; }
  if (pay) remember(pay[1] ? 'rental' : 'order', pay[2], pay[3]);
  if (!reset && !pay) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (reset) { state.resetToken = reset[1]; setMode('reset'); openModal(); }
  if (pay) openPay(pay[2], pay[3], pay[1] ? 'rental' : 'order');
}
window.addEventListener('hashchange', checkHashLinks);

function renderAuth() {
  const u = state.user, admin = u?.role === 'admin', client = !!u && !admin;
  for (const [k, v] of Object.entries({ sender_name: u?.name, sender_email: u?.email, sender_phone: u?.phone })) { const el = $('#orderForm [name=' + k + ']'); if (client && !el.value) el.value = v || ''; }
  for (const [k, v] of Object.entries({ name: u?.name, email: u?.email, phone: u?.phone })) { const el = $('#rentalForm [name=' + k + ']'); if (client && !el.value) el.value = v || ''; }
  // Connexion facultative : clients avec compte, équipe (/equipe) et administration.
  const staff = u?.role === 'staff', first = (u?.name || '').split(' ')[0];
  $('#identity').textContent = client ? t('Bonjour {n}', { n: first }) : '';
  for (const id of ['#adminLink', '#drawerAdmin']) { const a = $(id); a.classList.toggle('hidden', !admin && !staff); a.href = staff ? '/equipe' : '/admin'; a.textContent = t(staff ? 'Espace employé' : 'Administration'); }
  for (const id of ['#loginButton', '#drawerLogin']) $(id).classList.toggle('hidden', !!u);
  for (const id of ['#logoutButton', '#drawerLogout']) $(id).classList.toggle('hidden', !u);
  $$('[data-account]').forEach(a => a.classList.toggle('hidden', admin && !a.closest('.bottom-nav')));
  $('#espace').classList.toggle('hidden', admin); $('#drawerHello').textContent = client ? t('Bonjour {n}', { n: first }) + ' 👋' : '';
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
$('#diasporaButton').onclick = () => { $('#categoryFilter').value = DIASPORA; renderCatalog(); location.hash = 'catalogue'; };

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
  if (isCustom()) return customLines().reduce((a, l) => a + l.quantity * lineUnit(elById(l.id), l.choices), 0) + addonTotal();
  const p = currentPackage(); if (!p) return null;
  return (p.price_htg + selectedOptions().reduce((a, x) => a + x.price, 0)) * Math.max(1, Number($('#orderForm [name=quantity]').value) || 1) + addonTotal();
}
/* Articles de la boutique ajoutés à la surprise */
state.addons = {};
const addonLines = () => Object.entries(state.addons).map(([id, q]) => ({ x: (state.shop?.products || []).find(p => p.id === id), q })).filter(l => l.x && l.q > 0);
const addonTotal = () => addonLines().reduce((a, l) => a + l.x.price_htg * l.q, 0);
function renderAddons() {
  const S = state.shop, on = !!S?.settings.enabled && S.products.some(x => x.stock > 0);
  $('#shopAddon').classList.toggle('hidden', !on); if (!on) return;
  $('#addonList').innerHTML = S.products.filter(x => x.stock > 0 || state.addons[x.id]).map(x => { const q = state.addons[x.id] || 0;
    return `<div class="addon ${q ? 'on' : ''}"><span class="cart-ico">${x.photo ? `<img src="/media/${escapeHTML(x.photo)}" alt="" loading="lazy">` : SHOP_ICON[x.category] || '🎁'}</span><span class="grow"><b>${escapeHTML(prodName(x))}</b><small>${money(x.price_htg)}</small></span>
      ${q ? `<span class="qty" data-id="${x.id}"><button type="button" data-d="-1">−</button><em>${q}</em><button type="button" data-d="1" ${q >= x.stock ? 'disabled' : ''}>+</button></span>` : `<button type="button" class="btn btn-outline-dark addon-add" data-id="${x.id}">＋ ${t('Ajouter')}</button>`}</div>`; }).join('');
}
$('#addonList').addEventListener('click', e => {
  const a = e.target.closest('.addon-add'), q = e.target.closest('.qty [data-d]'), id = a?.dataset.id || q?.closest('.qty').dataset.id; if (!id) return;
  const x = state.shop.products.find(p => p.id === id), n = Math.max(0, Math.min(x.stock, (state.addons[id] || 0) + (a ? 1 : Number(q.dataset.d))));
  if (n) state.addons[id] = n; else delete state.addons[id];
  renderAddons(); updateTotal(); if (a) toast(`🛍️ ${prodName(x)} — ${t('Ajouté ✓')}`);
});
const choicesText = (el, choices) => (el.groups || []).flatMap(g => [].concat(choices[g.id] || []).map(oid => optName(g.options.find(o => o.id === oid) || {}))).filter(Boolean).join(', ');
function updateTotal() {
  const v = orderTotal(); $('#orderTotal').textContent = v === null ? '—' : money(v); depositText('#orderDeposit', v);
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
    const lines = customLines(); if (!lines.length && !addonLines().length) { goStep(1); toast('Ajoutez au moins un élément pour composer votre surprise.'); return false; }
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
  items.push(...addonLines().map(l => `🛍️ ${prodName(l.x)} × ${l.q}`));
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
    body.music_id = f.get('music_id') || '';
    body.shop_items = addonLines().map(l => ({ id: l.x.id, quantity: l.q }));
    const o = await post('/api/orders', body), wantDeposit = f.has('pay_deposit') && !$('#orderDeposit').classList.contains('hidden');
    for (const k of ['recipient', 'recipient_phone', 'alternate_phone', 'message', 'sender', 'landmark', 'address', 'event_at', 'colors', 'theme', 'cake', 'music', 'music_id', 'notes']) e.target.elements[k].value = '';
    $('#musicChosen').innerHTML = ''; state.addons = {}; renderAddons(); loadShop();
    remember('order', o.id, o.pay_token); refreshOrders();
    if (wantDeposit && o.pay_token) openPay(o.id, o.pay_token, 'order', 'deposit');
    e.target.elements.live_requested.checked = false; cardDefaults();
    renderElements(); setBuildMode(state.buildMode); goStep(1);
    toast(t(wantDeposit ? 'Demande enregistrée (référence {r}) ! Réglez votre acompte pour réserver la date.' : 'Merci ! Demande enregistrée — référence {r}. Suivez-la dans « Suivre ma commande ». Un récapitulatif vous est envoyé par courriel.', { r: refOf('order', o) }));
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
  $('#rentalTotal').textContent = lines.length ? money(total) : '—'; depositText('#rentalDeposit', lines.length ? total : null);
}
// Case « payer un acompte maintenant » : visible si l'acompte est activé et qu'un moyen de paiement existe.
function depositText(sel, total) {
  const box = $(sel), P = PAY(), on = P.deposit_enabled && payMethodsReady(); box.classList.toggle('hidden', !on); if (!on) return;
  box.querySelector('.deposit-text').innerHTML = t('Réserver dès maintenant : payer un acompte de {p} %{m} juste après l’envoi (le solde sera réglé après confirmation).', { p: P.deposit_percent, m: total ? ' (' + money(Math.ceil(total * P.deposit_percent / 100)) + ')' : '' });
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
  e.preventDefault(); const form = e.target, f = new FormData(form);
  const items = state.rentalLines.filter(l => l.qty > 0).map(l => ({ equipment_id: l.id, quantity: l.qty }));
  if (!items.length) { toast('Ajoutez au moins un matériel.'); return; }
  for (const el of [form.elements.start_at, form.elements.end_at, form.elements.city]) if (!el.checkValidity()) { el.reportValidity(); return; }
  try {
    for (const el of [form.elements.name, form.elements.phone, form.elements.email]) if (!el.checkValidity()) { el.reportValidity(); return; }
    const wantDeposit = f.has('pay_deposit') && !$('#rentalDeposit').classList.contains('hidden');
    const r = await post('/api/rentals', { items, lang, name: f.get('name'), email: f.get('email') || '', phone: f.get('phone') || '', city: f.get('city'), address: f.get('address'), note: f.get('note'), start_at: new Date(f.get('start_at')).toISOString(), end_at: new Date(f.get('end_at')).toISOString() });
    remember('rental', r.id, r.pay_token);
    toast(t(wantDeposit ? 'Demande enregistrée (référence {r}) ! Réglez l’acompte pour bloquer le matériel.' : 'Demande de location enregistrée — référence {r}. Suivez-la dans « Suivre ma commande ».', { r: refOf('rental', r) })); form.reset(); state.rentalLines = []; state.rentalTouched = false; renderEquipment(); goAccount(); refreshOrders(); if (wantDeposit && r.pay_token) openPay(r.id, r.pay_token, 'rental', 'deposit');
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

/* ---------- Paiement : acompte, solde, en ligne (PlopPlop) ou transfert direct ---------- */
const PAY = () => state.settings?.payment || { online: !!state.settings?.online_payment, cash: false, accounts: [], deposit_enabled: false, deposit_percent: 60 };
const payMethodsReady = () => PAY().online || PAY().accounts.length > 0;
// Même règle que le serveur : acompte ou totalité dès la demande (si l'acompte est activé), solde après confirmation.
function canPay(x, total) {
  const paid = x.amount_paid || 0;
  if (!payMethodsReady() || x.status === 'cancelled' || ['paid', 'refunded'].includes(x.payment_status) || (x.payments || []).some(a => a.status === 'declared') || !(total > 0)) return false;
  if (paid > 0) return x.status !== 'pending' && paid < total;
  return x.status !== 'pending' || PAY().deposit_enabled;
}
const canPayOnline = o => canPay(o, o.amount_due || o.total_htg);
let payTimer = null;
function savePending(v) { try { v ? sessionStorage.setItem('mm_pay', JSON.stringify(v)) : sessionStorage.removeItem('mm_pay'); } catch {} }
async function openPay(id, token, kind = 'order', part = '') {
  state.pay = { id, token, kind, part, info: null, opened: false, error: '', done: '' }; $('#payModal').classList.remove('hidden'); renderPay();
  try { state.pay.info = await post('/api/pay/info', { id, token, kind }); if (state.pay.info.pending_attempt) { state.pay.opened = true; await verifyPay(true); } } catch (err) { state.pay.error = err.message; }
  renderPay();
}
function closePay() { $('#payModal').classList.add('hidden'); clearInterval(payTimer); payTimer = null; state.pay = null; }
$('#closePay').onclick = closePay;
$('#payModal').onclick = e => { if (e.target.id === 'payModal') closePay(); };
const PART_LABEL = { deposit: 'Acompte de {p} %', full: 'Totalité', balance: 'Solde restant' };
function renderPay() {
  const p = state.pay; if (!p) return; const i = p.info;
  $('#payTitle').textContent = t(p.kind === 'rental' ? 'Paiement de votre location' : 'Paiement de votre commande');
  if (p.error) { $('#payInfo').innerHTML = `<p class="warning">${escapeHTML(t(p.error))}</p>`; $('#payActions').innerHTML = ''; return; }
  if (!i) { $('#payInfo').innerHTML = `<p>${t('Chargement…')}</p>`; $('#payActions').innerHTML = ''; return; }
  $('#payInfo').innerHTML = `<div class="summary"><strong>${escapeHTML(tr(i, 'package_name'))}</strong>${i.kind === 'rental' ? `<p>🪑 ${t('Location')} · 📍 ${escapeHTML(i.city || '')}</p><p>${escapeHTML(dateTime(i.event_at, true))} — ${escapeHTML(dateTime(i.end_at, true))}</p>` : `<p>${t('Pour')} <b>${escapeHTML(i.recipient)}</b> · ${escapeHTML(dateTime(i.event_at))}</p>`}
    <p>${t('Montant total')} : <b>${money(i.total)}</b>${i.paid_amount > 0 ? ` · ${t('Déjà payé')} : <b>${money(i.paid_amount)}</b> · ${t('Reste à payer')} : <b>${money(i.remaining)}</b>` : ''}</p>
    <p>${t('Statut')} : ${escapeHTML(label(i.status))} · ${t('Paiement')} : ${escapeHTML(label(i.payment_status))}</p></div>`;
  let html = p.done ? `<p class="success">✅ ${escapeHTML(t(p.done))}</p>` : '';
  if (i.payment_status === 'paid') html = `<p class="success">✅ ${t('Paiement confirmé ! Merci. Votre reçu vous est envoyé par courriel.')}</p>`;
  else if (i.declared) html += `<p class="success">⏳ ${t('Votre paiement de {m} (réf. {r}) est en cours de vérification par notre équipe.', { m: money(i.declared.amount), r: escapeHTML(i.declared.reference) })}</p>`;
  else if (!i.parts.length) html += `<p>${t(i.paid_amount > 0 ? 'Acompte reçu : votre date est réservée. Le solde sera payable après confirmation par notre équipe.' : i.kind === 'rental' ? 'Paiement possible après confirmation de la location par notre équipe.' : 'Paiement possible après confirmation de la commande par notre équipe.')}</p>`;
  else if (!i.methods.online && !i.methods.accounts.length) html += `<p>${t('Le paiement en ligne n’est pas encore disponible. Notre équipe vous indiquera comment régler.')}</p>`;
  else {
    if (!i.parts.includes(p.part)) p.part = i.parts[0];
    const amt = part => part === 'deposit' ? i.deposit : i.remaining, amount = amt(p.part);
    html += i.parts.length > 1 ? `<div class="pay-parts">${i.parts.map(k => `<label class="pay-part ${k === p.part ? 'on' : ''}"><input type="radio" name="payPart" value="${k}" ${k === p.part ? 'checked' : ''}><span>${t(PART_LABEL[k], { p: i.deposit_percent })}</span><b>${money(amt(k))}</b></label>`).join('')}</div>` : `<p class="pay-amount">${money(amount)} <small>${t(PART_LABEL[p.part], { p: i.deposit_percent })}</small></p>`;
    if (i.methods.online) {
      html += `<h4 class="pay-h">💳 ${t('Payer en ligne')}</h4><button type="button" class="btn btn-gold full" id="payGo">${t('Payer {m} maintenant', { m: money(amount) })}</button><p class="hint">${t('MonCash, NatCash ou Kashpaw, paiement sécurisé par PlopPlop.')}</p>`;
      if (p.opened) html += `<p class="hint">${t('Terminez le paiement sur la page PlopPlop, puis revenez ici.')}</p><button type="button" class="btn btn-purple full" id="payCheck">${t('J’ai payé — vérifier')}</button>`;
    }
    if (i.methods.accounts.length) {
      html += `<h4 class="pay-h">🏦 ${t('Transfert direct')}</h4><p class="hint">${t('Envoyez {m} sur l’un de nos comptes, puis indiquez le numéro de transaction.', { m: money(amount) })}</p>
        <div class="accts">${i.methods.accounts.map(a => `<label class="acct"><input type="radio" name="payAcct" value="${escapeHTML(a.id)}" ${i.methods.accounts.length === 1 ? 'checked' : ''}><span><b>${a.ico} ${escapeHTML(a.label)}</b><br>${escapeHTML(a.number)}${a.holder ? ' · ' + t('au nom de') + ' ' + escapeHTML(a.holder) : ''}${a.bank ? ' · ' + escapeHTML(a.bank) : ''}${a.instructions ? `<br><small>${escapeHTML(a.instructions)}</small>` : ''}</span></label>`).join('')}</div>
        <form id="payDeclare" class="pay-declare"><label>${t('Numéro de transaction')}<input name="reference" required minlength="3" maxlength="80" placeholder="Ex. 123456789"></label><label>${t('Capture du paiement (facultatif)')}<input name="proof" type="file" accept="image/*,application/pdf"></label><button class="btn btn-purple full">${t('J’ai payé — envoyer ma référence')}</button></form>`;
    }
    if (i.methods.cash) html += `<p class="hint">💵 ${t('Vous pouvez aussi régler en espèces à la livraison : notre équipe vous remet un reçu.')}</p>`;
  }
  $('#payActions').innerHTML = html;
  $('#payGo')?.addEventListener('click', startPay); $('#payCheck')?.addEventListener('click', () => verifyPay(false));
  $('#payActions').querySelectorAll('[name=payPart]').forEach(r => r.onchange = () => { p.part = r.value; renderPay(); });
  $('#payDeclare')?.addEventListener('submit', declarePay);
}
// Capture d'écran réduite avant l'envoi (les photos de téléphone sont lourdes).
function proofData(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 8e6) return reject(Error('Fichier trop volumineux (6 Mo maximum)'));
    if (!file.type.startsWith('image/')) { if (file.size > 6e6) return reject(Error('Fichier trop volumineux (6 Mo maximum)')); const r = new FileReader(); r.onload = () => resolve({ mime: file.type, data: r.result.split(',')[1] }); r.onerror = reject; r.readAsDataURL(file); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Image illisible')); }; img.src = url;
  });
}
async function declarePay(e) {
  e.preventDefault(); const p = state.pay, form = e.target, btn = form.querySelector('button'), acct = $('#payActions [name=payAcct]:checked')?.value;
  if (!acct) { toast('Choisissez le compte sur lequel vous avez payé'); return; }
  if (!form.elements.reference.checkValidity()) { form.elements.reference.reportValidity(); return; }
  btn.disabled = true;
  try {
    const file = form.elements.proof.files[0], proof = file ? await proofData(file) : null;
    p.info = await post('/api/pay/declare', { id: p.id, token: p.token, kind: p.kind, part: p.part, account: acct, reference: form.elements.reference.value.trim(), proof });
    p.done = 'Merci ! Votre paiement a été transmis. Notre équipe le vérifie et vous confirme par courriel.'; renderPay(); refreshOrders();
  } catch (err) { toast(err.message); btn.disabled = false; }
}
async function startPay() {
  const p = state.pay, w = window.open('', '_blank'); // ouverte tout de suite pour éviter le blocage des fenêtres
  try {
    const r = await post('/api/pay/open', { id: p.id, token: p.token, kind: p.kind, part: p.part });
    p.opened = true; savePending({ id: p.id, token: p.token, kind: p.kind }); renderPay();
    if (w) w.location = r.url; else location.href = r.url;
    clearInterval(payTimer); let n = 0; payTimer = setInterval(() => { if (++n > 40 || !state.pay) { clearInterval(payTimer); return; } verifyPay(true); }, 6000);
  } catch (err) { if (w) w.close(); toast(err.message); }
}
async function verifyPay(silent) {
  const p = state.pay; if (!p) return;
  try {
    const r = await post('/api/pay/verify', { id: p.id, token: p.token, kind: p.kind }); p.info = r;
    if (r.paid === true) { clearInterval(payTimer); savePending(null); p.opened = false; p.done = r.payment_status === 'paid' ? '' : 'Acompte reçu ! Votre date est réservée.'; renderPay(); toast(r.payment_status === 'paid' ? 'Paiement confirmé ! Merci.' : 'Acompte reçu ! Votre date est réservée.'); refreshOrders(); return; }
    if (!silent) toast('Le paiement n’est pas encore confirmé. Patientez quelques secondes puis réessayez.');
  } catch (err) { if (!silent) toast(err.message); }
  renderPay();
}
const onReturn = () => { if (state.pay?.opened && document.visibilityState === 'visible') verifyPay(true); };
window.addEventListener('focus', onReturn); document.addEventListener('visibilitychange', onReturn);

/* ---------- Suivi par étapes (de la demande à la livraison) ---------- */
const STEPS = {
  order: [['pending', 'Demande reçue'], ['confirmed', 'Confirmée — à payer'], ['paid', 'Paiement reçu'], ['preparing', 'En préparation'], ['in_progress', 'En livraison'], ['completed', 'Livrée']],
  rental: [['pending', 'Demande reçue'], ['confirmed', 'Confirmée — à payer'], ['paid', 'Paiement reçu'], ['delivered', 'Livrée et installée'], ['completed', 'Récupérée — terminée']]
};
function stageOf(kind, x) {
  if (x.status === 'cancelled') return 'cancelled';
  if ((kind === 'order' ? ['preparing', 'in_progress', 'completed'] : ['delivered', 'completed']).includes(x.status)) return x.status;
  return x.payment_status === 'paid' ? 'paid' : x.status === 'confirmed' ? 'confirmed' : 'pending';
}
function stepper(kind, x) {
  const st = stageOf(kind, x); if (st === 'cancelled') return `<p><span class="status cancelled">${t('Annulée')}</span></p>`;
  const steps = STEPS[kind], i = steps.findIndex(s => s[0] === st);
  return `<ol class="stepper" aria-label="${t('Suivi')}">${steps.map(([, l], k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}"><span>${k < i ? '✓' : k + 1}</span><small>${escapeHTML(t(l))}</small></li>`).join('')}</ol>`;
}

/* ---------- Suivi sans compte (comme Konekte) ----------
   Référence + téléphone, code par courriel, ou demandes mémorisées sur cet appareil. */
const MINE_KEY = 'mm_mine';
function deviceList() { try { return JSON.parse(localStorage.getItem(MINE_KEY) || '[]').filter(x => x && x.id && x.token); } catch { return []; } }
function remember(kind, id, token) { if (!token) return; const l = deviceList().filter(x => x.id !== id); l.unshift({ kind, id, token }); try { localStorage.setItem(MINE_KEY, JSON.stringify(l.slice(0, 30))); } catch {} }
const refOf = (kind, x) => (kind === 'order' ? 'MM-' : 'LOC-') + x.id.slice(0, 8).toUpperCase();
function itemCard(v) {
  const title = (lang === 'ht' && v.title_ht) || v.title, rest = v.remaining;
  const head = v.kind === 'order' ? `🎁 ${escapeHTML(title)} · ${escapeHTML(v.recipient)}` : `🪑 ${escapeHTML(title)}`;
  const when = v.kind === 'order' ? `${v.express ? `<p class="x-badge">⚡ ${t('Cadeau express')} · ${escapeHTML(v.express_slot)}</p>` : ''}<p>📍 ${escapeHTML(v.city)} · ${escapeHTML(dateTime(v.date))}</p>` : `<p>📍 ${escapeHTML(v.city)}${v.days ? ' · ' + v.days + ' ' + t('jour(s)') : ''}</p><p>${dateTime(v.date, true)} — ${dateTime(v.end, true)}</p>`;
  const payBtn = v.can_pay ? `<button class="btn btn-gold pay-now" data-kind="${v.kind}" data-id="${escapeHTML(v.id)}" data-token="${escapeHTML(v.token)}">💳 ${t(v.paid > 0 ? 'Payer le solde ({m})' : PAY().deposit_enabled && !v.express && !v.shop ? 'Payer l’acompte ou la totalité' : 'Payer {m} maintenant', { m: money(v.paid > 0 ? rest : v.total) })}</button>` : '';
  const hint = v.declared ? `<p class="hint">⏳ ${t('Paiement déclaré, en cours de vérification.')}</p>` : v.status === 'pending' && !v.can_pay && v.payment_status !== 'paid' && payMethodsReady() ? `<p class="hint">${t(v.paid > 0 ? (v.kind === 'order' ? 'Acompte reçu : votre date est réservée. Le solde sera payable après confirmation par notre équipe.' : 'Acompte reçu : le matériel est bloqué pour vous. Le solde sera payable après confirmation.') : (v.kind === 'order' ? 'Paiement possible après confirmation de la commande par notre équipe.' : 'Paiement possible après confirmation de la location par notre équipe.'))}</p>` : '';
  return `<article class="order" id="it-${escapeHTML(v.id)}"><div><p class="ref">${t('Référence')} : <b>${escapeHTML(v.ref)}</b></p><strong>${head}</strong>${when}${v.message ? `<p>${t('Carte')} : « ${escapeHTML(v.message)} »</p>` : ''}${v.music ? `<p>🎵 ${escapeHTML(v.music)}</p>` : ''}
    ${stepper(v.kind, v)}<p>${t('Paiement')} : ${escapeHTML(label(v.payment_status))}${v.paid > 0 && rest > 0 ? ` · ${t('Déjà payé')} : <b>${money(v.paid)}</b> · ${t('Reste à payer')} : <b>${money(rest)}</b>` : ''}</p>
    ${v.live_url ? `<p><a href="${escapeHTML(v.live_url)}" target="_blank" rel="noopener noreferrer">▶ ${t('Rejoindre Magic Live (lien externe)')}</a></p>` : ''}${hint}<div class="order-actions">${payBtn}${v.paid > 0 ? `<button class="btn btn-outline-dark receipt" data-kind="${v.kind}" data-id="${escapeHTML(v.id)}" data-token="${escapeHTML(v.token)}">🧾 ${t('Reçu')}</button>` : ''}</div></div><strong>${money(v.total)}</strong></article>`;
}
async function refreshOrders() {
  if (state.user?.role === 'admin') return;
  const saved = deviceList();
  const [mine, dev] = await Promise.all([api('/api/client/mine').catch(() => ({ session: null, items: [] })), saved.length ? post('/api/track/device', { items: saved }).catch(() => []) : Promise.resolve([])]);
  state.client = mine.session;
  const map = new Map(); for (const v of [...mine.items, ...dev]) map.set(v.id, v);
  const all = [...map.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  state.myItems = all;
  $('#espaceWho').classList.toggle('hidden', !state.client && !saved.length);
  $('#espaceWho').innerHTML = state.client ? `<span>✅ ${t('Connecté')} : <b>${escapeHTML(state.client.label)}</b></span><button type="button" class="btn btn-outline-dark" id="clientLogout">${t('Se déconnecter')}</button>`
    : saved.length ? `<span>📱 ${t('Demandes envoyées depuis cet appareil')}</span><button type="button" class="linkbtn" id="forgetDevice">${t('Oublier cet appareil')}</button>` : '';
  $('#espaceLogin').classList.toggle('hidden', !!state.client);
  const orders = all.filter(v => v.kind === 'order'), rentals = all.filter(v => v.kind === 'rental');
  $('#myOrders').innerHTML = orders.map(itemCard).join('') || `<div class="empty">${t('Aucune commande à afficher. Utilisez votre référence ou votre téléphone ci-dessus.')}</div>`;
  $('#myRentals').innerHTML = rentals.map(itemCard).join('') || `<div class="empty">${t('Aucune demande de location.')}</div>`;
  const lives = orders.filter(o => o.live_requested || o.live_url);
  $('#liveList').innerHTML = lives.map(o => `<article class="order"><div><strong>${escapeHTML((lang === 'ht' && o.title_ht) || o.title)} — ${escapeHTML(o.recipient)}</strong><p>${escapeHTML(dateTime(o.date))}</p>${o.live_url ? `<a class="btn btn-purple" href="${escapeHTML(o.live_url)}" target="_blank" rel="noopener noreferrer">▶ ${t('Rejoindre le direct privé')}</a>` : `<p>${t('En attente du lien de diffusion de l’équipe.')}</p>`}</div></article>`).join('') || `<p>${t('Aucun direct demandé.')}</p>`;
}
$('#espaceWho').addEventListener('click', e => {
  if (e.target.id === 'clientLogout') logoutClient();
  if (e.target.id === 'forgetDevice' && confirm(t('Retirer de cet appareil la liste de vos demandes ? Vous pourrez les retrouver avec votre référence ou votre téléphone.'))) { try { localStorage.removeItem(MINE_KEY); } catch {} refreshOrders(); }
});
$('#trackForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target; for (const el of [f.elements.reference, f.elements.phone]) if (!el.value.trim()) { el.reportValidity(); toast(t('Indiquez la référence (ex. MM-1A2B3C4D) et votre numéro de téléphone.')); return; }
  try {
    const v = await post('/api/track', { reference: f.elements.reference.value, phone: f.elements.phone.value });
    remember(v.kind, v.id, v.token); f.reset(); await refreshOrders();
    const el = document.getElementById('it-' + v.id); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('flash');
  } catch (err) { toast(err.message); }
};
state.codeChallenge = null;
function resetCodeForm() { state.codeChallenge = null; const f = $('#codeForm'); f.reset(); $('#codeL').classList.add('hidden'); $('#codeContactL').classList.remove('hidden'); $('#codeDest').textContent = ''; $('#codeBtn').textContent = t('Recevoir mon code'); $('#codeRestart').classList.add('hidden'); }
$('#codeRestart').onclick = resetCodeForm;
$('#codeForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target, btn = $('#codeBtn'); btn.disabled = true;
  try {
    if (!state.codeChallenge) {
      if (!f.elements.contact.value.trim()) { toast(t('Indiquez votre numéro de téléphone ou votre courriel.')); return; }
      const r = await post('/api/client/code', { contact: f.elements.contact.value, lang }); state.codeChallenge = r.challenge;
      $('#codeL').classList.remove('hidden'); $('#codeContactL').classList.add('hidden'); $('#codeRestart').classList.remove('hidden');
      $('#codeDest').textContent = t('Code envoyé à {d}. Vérifiez aussi les courriels indésirables.', { d: r.destination }); btn.textContent = t('Valider le code'); f.elements.code.focus();
    } else {
      await post('/api/client/verify', { challenge: state.codeChallenge, code: f.elements.code.value }); resetCodeForm();
      toast('Bienvenue ! Voici toutes vos demandes.'); await refreshOrders(); $('#myOrders').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) { toast(err.message); if (/expiré|tentatives/.test(err.message)) resetCodeForm(); } finally { btn.disabled = false; }
};
$('#refreshOrders').onclick = refreshOrders;

async function loadCategories() { const full = await api('/api/categories?full=1'); state.categories = full.map(x => x.name); state.catHT = Object.fromEntries(full.filter(x => x.name_ht).map(x => [x.name, x.name_ht])); }

/* ---------- Menu tiroir (téléphone), barre de raccourcis, compte ---------- */
const drawer = $('#drawer');
function openDrawer(open) { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', open ? 'false' : 'true'); $('#menuButton').setAttribute('aria-expanded', open ? 'true' : 'false'); document.body.classList.toggle('no-scroll', open); }
$('#menuButton').onclick = () => openDrawer(true);
$('#drawerClose').onclick = () => openDrawer(false);
drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('.drawer-nav a')) openDrawer(false); });
$('#drawerLang').onclick = () => { setLang(lang === 'ht' ? 'fr' : 'ht'); };
function goAccount() { if (state.user?.role === 'admin') { location.href = '/admin'; return; } $('#espace').classList.remove('hidden'); if (location.hash === '#espace') showPage('espace'); else location.hash = 'espace'; }
document.addEventListener('click', e => { const a = e.target.closest('[data-account]'); if (!a) return; e.preventDefault(); openDrawer(false); goAccount(); });
/* ---------- Navigation par pages ----------
   Chaque entrée du menu affiche uniquement sa page (pas tout le site qui défile). */
const PAGES = { accueil: ['accueil', 'diaspora', 'avis'], express: ['express'], boutique: ['boutique'], catalogue: ['catalogue'], commander: ['commander'], location: ['location'], gallery: ['gallery'], avis: ['avis'], contact: ['contact'], espace: ['espace'], live: ['espace'] };
const PAGE_SECTIONS = [...new Set(Object.values(PAGES).flat())];
function showPage(id, anchor) {
  if (!PAGES[id]) id = 'accueil';
  const keep = PAGES[id]; state.page = id;
  for (const s of PAGE_SECTIONS) document.getElementById(s)?.classList.toggle('off-page', !keep.includes(s));
  const page = id === 'live' ? 'espace' : id;
  $$('.main-nav a, .drawer-nav a').forEach(a => a.classList.toggle('current', a.getAttribute('href') === '#' + page));
  $$('.bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.sec === page));
  const el = anchor && document.getElementById(anchor);
  if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' })); else window.scrollTo({ top: 0, behavior: 'instant' });
}
function routeFromHash() {
  const h = location.hash.slice(1);
  if (/^(reset|payer|suivre|activer)/.test(h)) return;
  showPage(h, h === 'live' ? 'live' : null);
}
window.addEventListener('hashchange', routeFromHash);
// Un clic sur la page déjà ouverte la ramène en haut.
document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a && a.getAttribute('href') === location.hash && PAGES[location.hash.slice(1)]) { e.preventDefault(); showPage(location.hash.slice(1)); } });
routeFromHash();

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
    if (b.matches('.pay-now')) openPay(id, b.dataset.token, b.dataset.kind || 'order');
    else if (b.matches('.reference')) { const reference = prompt(t('Référence de transaction')); if (!reference) return; await post('/api/payment-reference', { id, reference }); await refreshOrders(); }
    else if (b.matches('.receipt')) {
      const w = window.open('', '_blank'); if (!w) throw Error('Autorisez les fenêtres contextuelles');
      try {
        const r = await post('/api/receipt/view', { kind: b.dataset.kind || 'order', id, token: b.dataset.token }), nm = x => (lang === 'ht' && x.name_ht) || x.name;
        w.document.title = 'Magic Moments — ' + r.number;
        w.document.body.innerHTML = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:24px auto;color:#24162c"><img src="/logo-header.png" alt="Magic Moments" style="height:56px"><h1 style="font-size:22px">${t('Reçu')} — ${escapeHTML(r.number)}</h1>
          <p>${t('Client')} : <b>${escapeHTML(r.customer)}</b></p><p>${t(r.kind === 'rental' ? 'Location' : 'Surprise')} : ${escapeHTML(r.title)}</p>
          <p>${t('Options')} : ${escapeHTML(r.options.map(x => nm(x) + ((x.choices || []).length ? ' (' + x.choices.map(c => (lang === 'ht' && c.option_ht) || c.option).join(', ') + ')' : '') + (x.quantity > 1 ? ' × ' + x.quantity : '')).join(', ') || '—')}</p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0">${r.payments.map(x => `<tr><td style="border-bottom:1px solid #ddd;padding:6px">${escapeHTML(dateTime(x.date))}</td><td style="border-bottom:1px solid #ddd;padding:6px">${escapeHTML(x.method)} · ${escapeHTML(x.reference || '')}</td><td style="border-bottom:1px solid #ddd;padding:6px;text-align:right"><b>${money(x.amount)}</b></td></tr>`).join('')}</table>
          <h2 style="font-size:18px">${t('Montant encaissé')} : ${money(r.paid)} / ${money(r.total)}</h2>${r.remaining > 0 ? `<p>${t('Reste à payer')} : <b>${money(r.remaining)}</b></p>` : ''}<p>${t('Transaction')} : ${escapeHTML(r.reference || t('Validation administrative'))}</p></div>`;
        w.print();
      } catch (err) { w.close(); throw err; }
    }
  } catch (err) { toast(err.message); }
});

/* ---------- Cadeau express : livré le jour même ---------- */
async function loadExpress() { try { state.express = await api('/api/express'); } catch { state.express = null; } renderExpress(); }
const EXPRESS_CLOSED = { late: 'Les cadeaux express du jour sont fermés (commande avant {c}). Revenez demain dès {s}, ou planifiez une surprise pour une autre date.', full: 'Toutes les livraisons express du jour sont réservées. Revenez demain, ou planifiez une surprise pour une autre date.' };
function renderExpress() {
  const X = state.express, gifts = (state.packages || []).filter(p => p.express);
  const show = !!X && X.enabled && gifts.length > 0;
  $('#express').classList.toggle('hidden', !show); $$('a[href="#express"]').forEach(a => a.classList.toggle('hidden', !show));
  if (!show) return;
  $('#expressInfo').innerHTML = X.open ? t('Commandez avant {c} : livraison aujourd’hui à {v}. Frais express : {f}.', { c: X.cutoff, v: X.cities.slice(0, 5).join(', ') + (X.cities.length > 5 ? '…' : ''), f: money(X.fee) })
    : `<span class="closed">⏰ ${t(EXPRESS_CLOSED[X.reason] || 'Le cadeau express n’est pas disponible pour le moment.', { c: X.cutoff, s: X.start })}</span> <a href="#commander">${t('Planifier une surprise')} →</a>`;
  $('#expressGrid').innerHTML = gifts.map(p => `<article class="express-card" data-pkg="${escapeHTML(p.id)}"><div class="card-image">${packageVisual(p)}</div><div class="express-body"><strong>${escapeHTML(tr(p, 'name'))}</strong><p>${escapeHTML((tr(p, 'description') || '').slice(0, 110))}</p>
    <div class="express-foot"><span><b>${money(p.price_htg + X.fee)}</b><small>${t('frais express inclus')}</small></span><button type="button" class="btn btn-gold express-go" data-id="${escapeHTML(p.id)}" ${X.open ? '' : 'disabled'}>⚡ ${t('Offrir aujourd’hui')}</button></div></div></article>`).join('');
}
$('#expressGrid').addEventListener('click', async e => {
  const b = e.target.closest('.express-go'); if (!b) return;
  await loadExpress(); if (!state.express?.open) { toast(t(EXPRESS_CLOSED[state.express?.reason] || 'Le cadeau express n’est pas disponible pour le moment.', { c: state.express?.cutoff, s: state.express?.start })); return; }
  const p = state.packages.find(x => x.id === b.dataset.id), X = state.express, f = $('#expressForm'); state.expressPkg = p;
  $('#xSummary').innerHTML = `<strong>${escapeHTML(tr(p, 'name'))}</strong><p>${t('Cadeau')} : ${money(p.price_htg)} · ${t('Frais express')} : ${money(X.fee)}</p><p class="total">${t('Total')} : <b>${money(p.price_htg + X.fee)}</b></p>`;
  const city = f.elements.city.value; $('#xCity').innerHTML = X.cities.map(c => `<option ${c === city ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('');
  $('#xSlot').innerHTML = X.slots.map(sl => `<option value="${sl.id}">${t('Aujourd’hui')} · ${sl.label}</option>`).join('');
  $('#xSubmit').textContent = t('Commander et payer {m}', { m: money(p.price_htg + X.fee) });
  for (const [k, v] of Object.entries({ sender_name: state.user?.name, sender_email: state.user?.email, sender_phone: state.user?.phone })) if (v && !f.elements[k].value) f.elements[k].value = v;
  $('#expressModal').classList.remove('hidden'); f.elements.recipient.focus();
});
const closeExpress = () => $('#expressModal').classList.add('hidden');
$('#closeExpress').onclick = closeExpress;
$('#expressModal').onclick = e => { if (e.target.id === 'expressModal') closeExpress(); };
$('#expressForm').onsubmit = async e => {
  e.preventDefault(); const form = e.target, btn = $('#xSubmit');
  for (const el of form.querySelectorAll('input,select,textarea')) if (!el.checkValidity()) { el.reportValidity(); return; }
  const f = Object.fromEntries(new FormData(form)), p = state.expressPkg; btn.disabled = true;
  try {
    const o = await post('/api/orders', { ...f, express: true, package_id: p.id, options: [], quantity: 1, lang, department: f.city, event_at: new Date(Date.now() + 36e5).toISOString() });
    remember('order', o.id, o.pay_token); closeExpress(); for (const k of ['recipient', 'recipient_phone', 'address', 'landmark', 'message']) form.elements[k].value = '';
    toast(t('Cadeau express enregistré — référence {r}. Réglez-le maintenant pour lancer la livraison.', { r: refOf('order', o) })); refreshOrders(); loadExpress();
    if (o.pay_token) openPay(o.id, o.pay_token, 'order', 'full');
  } catch (err) { toast(err.message); loadExpress(); } finally { btn.disabled = false; }
};

/* ---------- Boutique de cadeaux : panier, livraison ou retrait, paiement ---------- */
const SHOP_ICON = { 'Fleurs': '💐', 'Peluches': '🧸', 'Chocolats et douceurs': '🍫', 'Paniers gourmands': '🧺', 'Bijoux et accessoires': '💍', 'Parfums et beauté': '🌸', 'Décoration': '🕯️', 'Cartes et ballons': '🎈', 'Personnalisés': '🎨' };
state.shopCat = ''; state.cartMode = 'delivery';
try { state.cart = JSON.parse(localStorage.getItem('mm_cart') || '[]').filter(x => x && x.id && x.q > 0); } catch { state.cart = []; }
const saveCart = () => { try { localStorage.setItem('mm_cart', JSON.stringify(state.cart)); } catch {} };
const prodName = x => (lang === 'ht' && x.name_ht) || x.name;
async function loadShop() { try { state.shop = await api('/api/shop'); } catch { state.shop = null; } const ids = new Set((state.shop?.products || []).map(x => x.id)); state.cart = state.cart.filter(c => ids.has(c.id)); saveCart(); renderShop(); renderCart(); renderAddons(); updateTotal(); }
function renderShop() {
  const S = state.shop, on = !!S?.settings.enabled && S.products.length > 0;
  $('#boutique').classList.toggle('hidden', !on); $$('a[href="#boutique"]').forEach(a => a.classList.toggle('hidden', !on)); if (!on) return;
  const used = new Set(S.products.map(x => x.category)), q = $('#shopSearch').value.trim().toLowerCase();
  $('#shopCats').innerHTML = [{ name: '' }, ...S.categories.filter(c => used.has(c.name))].map(c => `<button type="button" class="chip ${c.name === state.shopCat ? 'on' : ''}" data-cat="${escapeHTML(c.name)}">${c.name ? (SHOP_ICON[c.name] || '🎁') + ' ' + escapeHTML((lang === 'ht' && c.name_ht) || c.name) : t('Toutes')}</button>`).join('');
  const list = S.products.filter(x => (!state.shopCat || x.category === state.shopCat) && (!q || (x.name + ' ' + x.name_ht + ' ' + x.description).toLowerCase().includes(q)));
  $('#shopGrid').innerHTML = list.map(x => { const inCart = state.cart.find(c => c.id === x.id)?.q || 0;
    return `<article class="shop-card"><div class="shop-img">${x.photo ? `<img src="/media/${escapeHTML(x.photo)}" alt="${escapeHTML(prodName(x))}" loading="lazy">` : `<span>${SHOP_ICON[x.category] || '🎁'}</span>`}${x.featured ? `<b class="shop-star">⭐ ${t('Coup de cœur')}</b>` : ''}${x.stock > 0 && x.stock <= 3 ? `<b class="shop-low">${t('Plus que {n}', { n: x.stock })}</b>` : ''}</div>
      <div class="shop-body"><strong>${escapeHTML(prodName(x))}</strong><p>${escapeHTML((lang === 'ht' && x.description_ht) || x.description || '')}</p>
      <div class="shop-foot"><b>${money(x.price_htg)}</b>${!x.stock ? `<span class="pill-out">${t('Épuisé')}</span>` : inCart ? `<span class="qty" data-id="${x.id}"><button type="button" data-d="-1">−</button><em>${inCart}</em><button type="button" data-d="1" ${inCart >= x.stock ? 'disabled' : ''}>+</button></span>` : `<button type="button" class="btn btn-gold add-cart" data-id="${x.id}">＋ ${t('Ajouter')}</button>`}</div></div></article>`; }).join('') || `<p class="empty">${t('Aucun cadeau ne correspond à votre recherche.')}</p>`;
}
function cartAdd(id, d) {
  const x = state.shop.products.find(p => p.id === id); if (!x) return; let c = state.cart.find(c => c.id === id);
  if (!c) { c = { id, q: 0 }; state.cart.push(c); } c.q = Math.max(0, Math.min(x.stock, c.q + d)); if (c.q === 0) state.cart = state.cart.filter(z => z !== c);
  saveCart(); renderShop(); renderCart(); if (d > 0) toast(`🛒 ${prodName(x)} — ${t('Ajouté ✓')}`);
}
$('#shopGrid').addEventListener('click', e => { const a = e.target.closest('.add-cart'); if (a) return cartAdd(a.dataset.id, 1); const q = e.target.closest('.qty [data-d]'); if (q) cartAdd(q.closest('.qty').dataset.id, Number(q.dataset.d)); });
$('#shopCats').addEventListener('click', e => { const c = e.target.closest('[data-cat]'); if (c) { state.shopCat = c.dataset.cat; renderShop(); } });
$('#shopSearch').addEventListener('input', renderShop);
function cartTotals() {
  const S = state.shop.settings, lines = state.cart.map(c => ({ c, x: state.shop.products.find(p => p.id === c.id) })).filter(l => l.x), sub = lines.reduce((a, l) => a + l.x.price_htg * l.c.q, 0);
  const fee = state.cartMode === 'pickup' ? 0 : (S.free_from && sub >= S.free_from ? 0 : S.delivery_fee), wrap = $('#cartForm').elements.gift_wrap.checked && S.gift_wrap > 0 ? S.gift_wrap : 0;
  return { lines, sub, fee, wrap, total: sub + fee + wrap };
}
function renderCart() {
  const S = state.shop?.settings, n = state.cart.reduce((a, c) => a + c.q, 0);
  $$('.cart-n').forEach(e => e.textContent = n); $('#cartFab').classList.toggle('hidden', !n || !S?.enabled);
  if (!S || $('#cartModal').classList.contains('hidden')) return;
  if (!S.delivery) state.cartMode = 'pickup'; if (!S.pickup) state.cartMode = 'delivery';
  const T = cartTotals(), f = $('#cartForm');
  $('#cartLines').innerHTML = T.lines.map(({ c, x }) => `<div class="cart-line"><span class="cart-ico">${x.photo ? `<img src="/media/${escapeHTML(x.photo)}" alt="">` : SHOP_ICON[x.category] || '🎁'}</span><span class="grow"><b>${escapeHTML(prodName(x))}</b><small>${money(x.price_htg)}</small></span><span class="qty" data-id="${x.id}"><button type="button" data-d="-1">−</button><em>${c.q}</em><button type="button" data-d="1" ${c.q >= x.stock ? 'disabled' : ''}>+</button></span><b class="cart-sum">${money(x.price_htg * c.q)}</b></div>`).join('') || `<p class="empty">${t('Votre panier est vide.')}</p>`;
  f.classList.toggle('hidden', !T.lines.length);
  $('#cartModes').innerHTML = [S.delivery && ['delivery', '🚚 ' + t('Livraison'), S.free_from && T.sub >= S.free_from ? t('offerte') : money(S.delivery_fee)], S.pickup && ['pickup', '🏬 ' + t('Retrait sur place'), t('gratuit')]].filter(Boolean).map(([k, l, pr]) => `<label class="pay-part ${k === state.cartMode ? 'on' : ''}"><input type="radio" name="cartMode" value="${k}" ${k === state.cartMode ? 'checked' : ''}><span>${l}${k === 'pickup' && S.pickup_address ? `<br><small>${escapeHTML(S.pickup_address)}</small>` : ''}</span><b>${pr}</b></label>`).join('');
  $('#cartAddress').classList.toggle('hidden', state.cartMode === 'pickup'); $('#cartDateL').textContent = t(state.cartMode === 'pickup' ? 'Date de retrait' : 'Date de livraison');
  $('#cartRecipient').classList.toggle('hidden', !f.elements.for_other.checked);
  $('#cartDate').min = S.first_date; if (!f.elements.date.value || f.elements.date.value < S.first_date) f.elements.date.value = S.first_date;
  $('#cartWrapL').classList.toggle('hidden', !(S.gift_wrap > 0)); $('#cartWrapText').textContent = t('Emballage cadeau (+{m})', { m: money(S.gift_wrap) });
  $('#cartTotals').innerHTML = `<p>${t('Articles')} : <b>${money(T.sub)}</b></p>${state.cartMode === 'delivery' ? `<p>${t('Livraison')} : <b>${T.fee ? money(T.fee) : t('offerte')}</b>${S.free_from && T.fee ? ` <small>(${t('offerte dès {m}', { m: money(S.free_from) })})</small>` : ''}</p>` : ''}${T.wrap ? `<p>${t('Emballage cadeau')} : <b>${money(T.wrap)}</b></p>` : ''}<p class="total">${t('Total')} : <b>${money(T.total)}</b></p>`;
  $('#cartSubmit').textContent = t('Commander et payer {m}', { m: money(T.total) });
}
const openCart = () => { $('#cartModal').classList.remove('hidden'); const f = $('#cartForm'); for (const [k, v] of Object.entries({ sender_name: state.user?.name, sender_email: state.user?.email, sender_phone: state.user?.phone })) if (v && !f.elements[k].value) f.elements[k].value = v; renderCart(); };
$('#cartFab').onclick = openCart; $('#cartOpen2').onclick = openCart;
$('#closeCart').onclick = () => $('#cartModal').classList.add('hidden');
$('#cartModal').addEventListener('click', e => { if (e.target.id === 'cartModal') $('#cartModal').classList.add('hidden'); const q = e.target.closest('.qty [data-d]'); if (q) cartAdd(q.closest('.qty').dataset.id, Number(q.dataset.d)); });
$('#cartForm').addEventListener('change', e => { if (e.target.name === 'cartMode') state.cartMode = e.target.value; if (['cartMode', 'for_other', 'gift_wrap'].includes(e.target.name)) renderCart(); });
$('#cartForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target, other = f.elements.for_other.checked, pickup = state.cartMode === 'pickup', btn = $('#cartSubmit');
  const need = [f.elements.date, f.elements.sender_name, f.elements.sender_phone, f.elements.sender_email, ...(other ? [f.elements.recipient, f.elements.recipient_phone] : []), ...(pickup ? [] : [f.elements.city, f.elements.address])];
  for (const el of need) if (!el.value.trim() || !el.checkValidity()) { el.reportValidity(); if (!el.value.trim()) toast(t('Complétez les champs obligatoires.')); el.focus(); return; }
  const v = Object.fromEntries(new FormData(f)); btn.disabled = true;
  try {
    const o = await post('/api/shop/order', { ...v, items: state.cart.map(c => ({ id: c.id, quantity: c.q })), delivery: state.cartMode, for_other: other, gift_wrap: f.elements.gift_wrap.checked, lang });
    state.cart = []; saveCart(); remember('order', o.id, o.pay_token); $('#cartModal').classList.add('hidden');
    for (const k of ['recipient', 'recipient_phone', 'address', 'landmark', 'message']) f.elements[k].value = '';
    toast(t('Commande enregistrée — référence {r}. Réglez-la maintenant pour que nous la préparions.', { r: refOf('order', o) })); loadShop(); refreshOrders();
    if (o.pay_token) openPay(o.id, o.pay_token, 'order', 'full');
  } catch (err) { toast(err.message); loadShop(); } finally { btn.disabled = false; }
};

/* ---------- Playlist : musiques importées de YouTube par l'équipe ---------- */
state.musicCat = '';
function renderMusic() {
  const q = $('#musicSearch').value.trim().toLowerCase(), cats = [...new Set(state.music.map(m => m.category))];
  $('#musicCats').innerHTML = ['', ...cats].map(c => `<button type="button" class="chip ${c === state.musicCat ? 'on' : ''}" data-cat="${escapeHTML(c)}">${escapeHTML(c ? t(c) : t('Toutes'))}</button>`).join('');
  const list = state.music.filter(m => (!state.musicCat || m.category === state.musicCat) && (!q || (m.title + ' ' + m.artist).toLowerCase().includes(q)));
  $('#musicList').innerHTML = list.map(m => `<div class="music-item" data-id="${escapeHTML(m.id)}"><div class="music-thumb" data-yt="${escapeHTML(m.youtube_id)}"><img src="https://i.ytimg.com/vi/${escapeHTML(m.youtube_id)}/mqdefault.jpg" alt="" loading="lazy"><span>▶</span></div>
    <div class="music-meta"><b>${escapeHTML(m.title)}</b><small>${escapeHTML(m.artist || '')}${m.artist ? ' · ' : ''}${escapeHTML(t(m.category))}</small><button type="button" class="btn btn-gold music-choose">${t('Choisir')}</button></div></div>`).join('') || `<p class="empty">${t('Aucune musique trouvée.')}</p>`;
}
function musicChip(m) { $('#musicChosen').innerHTML = m ? `<div class="music-chosen"><img src="https://i.ytimg.com/vi/${escapeHTML(m.youtube_id)}/default.jpg" alt=""><span>🎵 ${escapeHTML(m.title)}</span><button type="button" id="musicClear" aria-label="Retirer">×</button></div>` : ''; }
$('#musicPick').onclick = () => { $('#musicModal').classList.remove('hidden'); renderMusic(); $('#musicSearch').focus(); };
const closeMusic = () => { $('#musicModal').classList.add('hidden'); $('#musicList').innerHTML = ''; };
$('#closeMusic').onclick = closeMusic;
$('#musicModal').onclick = e => { if (e.target.id === 'musicModal') closeMusic(); };
$('#musicSearch').oninput = renderMusic;
$('#musicCats').onclick = e => { const c = e.target.closest('[data-cat]'); if (!c) return; state.musicCat = c.dataset.cat; renderMusic(); };
$('#musicList').onclick = e => {
  const th = e.target.closest('.music-thumb'); if (th && !th.querySelector('iframe')) { th.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${th.dataset.yt}?autoplay=1&rel=0" title="YouTube" allow="autoplay; encrypted-media" allowfullscreen></iframe>`; return; }
  const b = e.target.closest('.music-choose'); if (!b) return; const m = state.music.find(x => x.id === b.closest('.music-item').dataset.id);
  $('#musicId').value = m.id; $('#musicInput').value = m.title + (m.artist ? ' — ' + m.artist : ''); musicChip(m); closeMusic(); toast(`🎵 ${m.title} — ${t('Ajouté ✓')}`);
};
$('#musicInput').addEventListener('input', () => { $('#musicId').value = ''; musicChip(null); });
$('#musicChosen').addEventListener('click', e => { if (e.target.id === 'musicClear') { $('#musicId').value = ''; $('#musicInput').value = ''; musicChip(null); } });

/* ---------- Démarrage ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();
  translateStatic();
  try {
    const [packages, equipment, elements, gallery, settings, testimonials, announcements, music] = await Promise.all(['/api/packages', '/api/equipment', '/api/elements', '/api/gallery', '/api/settings', '/api/testimonials', '/api/announcements', '/api/music'].map(u => api(u).catch(() => [])));
    Object.assign(state, { packages, equipment, elements, gallery, settings, testimonials, announcements, music }); $('#musicPick').classList.toggle('hidden', !music.length); depositText('#orderDeposit', orderTotal()); depositText('#rentalDeposit', null); renderTicker(); await loadCategories();
    renderElements(); renderCategories(); renderCatalog(); setBuildMode('custom'); renderEquipment(); renderGallery(); renderContact(); cardDefaults(); setMode('login'); goStep(1);
    try { state.user = (await api('/api/me')).user; } catch {}
    renderAuth(); refreshOrders(); loadExpress(); setInterval(loadExpress, 300000); loadShop(); checkHashLinks();
    if (!getCookie('mm_consent')) showCookieBanner(true); else recordVisit();
    if (!state.pay) { try { const p = JSON.parse(sessionStorage.getItem('mm_pay') || 'null'); if (p) openPay(p.id, p.token, p.kind || 'order'); } catch {} }
  } catch (err) { toast(t('Impossible de charger les données : ') + t(err.message)); }
}
init();
