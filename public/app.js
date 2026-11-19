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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('#adminSection, script, style, [data-i18n], [data-dyn]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n; (n = walker.nextNode());) {
    if (!originals.has(n)) originals.set(n, n.nodeValue);
    const fr = originals.get(n), key = fr.trim(); if (!key) continue;
    n.nodeValue = lang === 'ht' && HT[key] ? fr.replace(key, HT[key]) : fr;
  }
  for (const el of $$('[placeholder], [aria-label]')) {
    if (el.closest('#adminSection')) continue;
    for (const a of ['placeholder', 'aria-label']) { if (!el.hasAttribute(a)) continue; const k = 'data-fr-' + a; if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a)); const fr = el.getAttribute(k); el.setAttribute(a, (lang === 'ht' && HT[fr]) || fr); }
  }
  for (const el of $$('[data-i18n]')) { if (!el.dataset.fr) el.dataset.fr = el.innerHTML; el.innerHTML = lang === 'ht' && HT_HTML[el.dataset.i18n] ? HT_HTML[el.dataset.i18n] : el.dataset.fr; }
  document.documentElement.lang = lang === 'ht' ? 'ht' : 'fr';
  document.title = t('Magic Moments — Chaque instant devient inoubliable');
  $('#langToggle').textContent = lang === 'ht' ? 'Français' : 'Kreyòl';
  const oc = $('#orderForm [name=occasion]'); if (['Anniversaire', 'Anivèsè'].includes(oc.value)) oc.value = t('Anniversaire');
}
function setLang(l) {
  const keep = customLines();
  lang = l; try { localStorage.setItem('mm_lang', l); } catch {}
  translateStatic();
  renderCategories(); renderCatalog(); renderElements(keep); renderOptions(); renderEquipment(); renderGallery(); renderContact(); renderTestimonials();
  setMode(state.mode); goStep(state.step); renderAuth(); refreshOrders(); if (state.pay) renderPay();
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
  $('#identity').textContent = u ? t('Bonjour, {n}', { n: u.name.split(' ')[0] }) : '';
  $('#authButton').classList.toggle('hidden', !!u); $('#logoutButton').classList.toggle('hidden', !u);
  $('#adminSection').classList.toggle('hidden', u?.role !== 'admin');
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
  const hero = state.gallery.find(g => g.id === s.hero_media && g.mime.startsWith('image/'));
  $('#heroImage').src = hero ? '/media/' + hero.id : '/logo.png'; $('#heroImage').alt = hero ? hero.title : 'Magic Moments';
  $('.hero-art').classList.toggle('photo', !!hero);
}

/* ---------- Catalogue ---------- */
const DIASPORA = 'Surprise à distance (diaspora)';
const packageVisual = p => p.photo && state.gallery.some(g => g.id === p.photo) ? `<img src="/media/${escapeHTML(p.photo)}" alt="${escapeHTML(tr(p, 'name'))}" loading="lazy">` : `<span>${escapeHTML(p.image || '🎁')}</span>`;
const chips = p => `<div class="chips">${tr(p, 'guests') ? `<span>👥 ${escapeHTML(tr(p, 'guests'))}</span>` : ''}${tr(p, 'lead_time') ? `<span>⏱ ${escapeHTML(tr(p, 'lead_time'))}</span>` : ''}</div>`;
function renderCategories() {
  const cats = state.categories, used = cats.filter(c => state.packages.some(p => p.category === c)), cur = $('#categoryFilter').value;
  $('#categoryFilter').innerHTML = `<option value="">${t('Toutes les catégories')}</option>` + used.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(catName(x))}</option>`).join('');
  $('#categoryFilter').value = used.includes(cur) ? cur : '';
  $('#packageForm [name=category]').innerHTML = cats.map(x => `<option>${escapeHTML(x)}</option>`).join('');
  const ce = $('#categoryEdit'), cv = ce.value;
  ce.innerHTML = '<option value="">Nouvelle catégorie</option>' + cats.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}${state.catHT[x] ? ' — ' + escapeHTML(state.catHT[x]) : ' — kreyòl à saisir'}</option>`).join(''); ce.value = cv;
}
function renderCatalog() {
  $('#diaspora').classList.toggle('hidden', !state.packages.some(p => p.category === DIASPORA));
  const cat = $('#categoryFilter').value, list = state.packages.filter(p => !cat || p.category === cat);
  $('#catalogueGrid').innerHTML = list.map(p => `<article class="card">
    <div class="card-image">${packageVisual(p)}</div>
    <div class="card-body"><small>${escapeHTML(catName(p.category))}</small><h3>${escapeHTML(tr(p, 'name'))}</h3><p>${escapeHTML(tr(p, 'description'))}</p>
      ${trList(p, 'includes').length ? `<ul class="includes">${trList(p, 'includes').slice(0, 5).map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
      ${chips(p)}
      <div class="card-bottom"><span class="price"><small>${t('À partir de')}</small>${money(p.price_htg)}</span><button class="btn btn-purple choose-package" data-pick="${escapeHTML(p.id)}">${t('Choisir')}</button></div>
    </div></article>`).join('') || `<p>${t('Aucune formule disponible dans cette catégorie.')}</p>`;
  $$('.choose-package').forEach(b => b.onclick = () => { $('#packageSelect').value = b.dataset.pick; renderOptions(); goStep(1); location.hash = 'commander'; });
  const sel = $('#packageSelect'), cur = sel.value;
  sel.innerHTML = `<option value="custom">${t('Sur mesure — je compose ma surprise')}</option>` + state.packages.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(tr(p, 'name'))} — ${t('dès')} ${money(p.price_htg)}</option>`).join('');
  sel.value = cur && [...sel.options].some(o => o.value === cur) ? cur : (state.packages[0]?.id || 'custom');
  renderOptions();
}
$('#categoryFilter').onchange = renderCatalog;
$('#diasporaButton').onclick = () => { $('#categoryFilter').value = DIASPORA; renderCatalog(); $('#catalogue').scrollIntoView({ behavior: 'smooth' }); };

/* ---------- Commande en 3 étapes ---------- */
const currentPackage = () => state.packages.find(p => p.id === $('#packageSelect').value);
function selectedOptions() { return (currentPackage()?.options || []).filter(x => document.querySelector(`[data-option="${x.id}"]`)?.checked); }
function customLines() {
  return $$('.element-row').filter(r => r.querySelector('.el-on').checked).map(r => ({ id: r.dataset.id, quantity: Number(r.querySelector('.el-qty').value), color: r.querySelector('.el-color')?.value || '', size: r.querySelector('.el-size')?.value || '', note: r.querySelector('.el-note').value }));
}
/* Les variantes s'affichent dans la langue active mais la valeur envoyée reste la variante française. */
function renderElements(keep = []) {
  const select = (x, k, c) => `<select class="${c}">${x[k].map((v, i) => `<option value="${escapeHTML(v)}">${escapeHTML((lang === 'ht' && x[k + '_ht']?.[i]) || v)}</option>`).join('')}</select>`;
  $('#elementBuilder').innerHTML = `<p class="hint">${t('Cochez les articles souhaités, puis précisez quantité et variante.')}</p>` + state.elements.map(x => `<div class="element-row" data-id="${escapeHTML(x.id)}">
    <label class="check"><input type="checkbox" class="el-on"> <strong>${escapeHTML(tr(x, 'name'))}</strong> <small>${escapeHTML(tr(x, 'category'))} · ${money(x.price)}</small></label>
    <div class="element-details hidden"><div class="form-grid"><label>${t('Quantité')}<input class="el-qty" type="number" min="1" max="100" value="1"></label>
      ${x.colors.length ? `<label>${t('Couleur / saveur')}${select(x, 'colors', 'el-color')}</label>` : ''}${x.sizes.length ? `<label>${t('Taille')}${select(x, 'sizes', 'el-size')}</label>` : ''}</div>
      <label>${t('Précisions (facultatif)')}<input class="el-note" maxlength="300" placeholder="${escapeHTML(t('Message, contenu du bouquet…'))}"></label></div></div>`).join('');
  for (const l of keep) {
    const r = document.querySelector(`.element-row[data-id="${l.id}"]`); if (!r) continue;
    r.querySelector('.el-on').checked = true; r.querySelector('.element-details').classList.remove('hidden'); r.querySelector('.el-qty').value = l.quantity; r.querySelector('.el-note').value = l.note;
    if (l.color && r.querySelector('.el-color')) r.querySelector('.el-color').value = l.color; if (l.size && r.querySelector('.el-size')) r.querySelector('.el-size').value = l.size;
  }
}
$('#elementBuilder').addEventListener('change', e => { if (e.target.matches('.el-on')) e.target.closest('.element-row').querySelector('.element-details').classList.toggle('hidden', !e.target.checked); updateTotal(); });
$('#elementBuilder').addEventListener('input', () => updateTotal());
function renderOptions() {
  const custom = $('#packageSelect').value === 'custom', p = currentPackage(), checked = selectedOptions().map(x => x.id);
  $('#elementBuilder').classList.toggle('hidden', !custom);
  $('#quantityLabel').classList.toggle('hidden', custom); $('#orderForm [name=quantity]').disabled = custom;
  $('#packageDetails').classList.toggle('hidden', !p);
  $('#packageDetails').innerHTML = p ? `${tr(p, 'description') ? `<p>${escapeHTML(tr(p, 'description'))}</p>` : ''}${trList(p, 'includes').length ? `<ul class="includes">${trList(p, 'includes').map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}${chips(p)}` : '';
  $('#customOptions').innerHTML = (p?.options || []).length ? `<p class="hint">${t('Options supplémentaires')}</p>` + p.options.map(x => `<label class="check"><input type="checkbox" data-option="${escapeHTML(x.id)}" ${checked.includes(x.id) ? 'checked' : ''}> ${escapeHTML(x.name)} (+${money(x.price)})</label>`).join('') : '';
  updateTotal();
}
function orderTotal() {
  if ($('#packageSelect').value === 'custom') return customLines().reduce((a, l) => a + l.quantity * (state.elements.find(x => x.id === l.id)?.price || 0), 0);
  const p = currentPackage(); if (!p) return null;
  return (p.price_htg + selectedOptions().reduce((a, x) => a + x.price, 0)) * Math.max(1, Number($('#orderForm [name=quantity]').value) || 1);
}
function updateTotal() { const v = orderTotal(); $('#orderTotal').textContent = v === null ? '—' : money(v); }
$('#packageSelect').onchange = renderOptions;
$('#customOptions').onchange = updateTotal;
$('#orderForm [name=quantity]').oninput = updateTotal;
const cardDefaults = () => { $('#cardName').textContent = $('#recipientInput').value || t('Votre destinataire'); $('#cardText').textContent = $('#messageInput').value || t('Votre message apparaîtra ici...'); $('#cardSign').textContent = $('#signInput').value || t('Avec amour ✨'); };
for (const id of ['#recipientInput', '#messageInput', '#signInput']) $(id).addEventListener('input', cardDefaults);
$$('.custom-start').forEach(a => a.addEventListener('click', () => { $('#packageSelect').value = 'custom'; renderOptions(); goStep(1); }));

function validateStep(n) {
  if (n === 1 && $('#packageSelect').value === 'custom' && !customLines().length) { goStep(1); toast('Cochez au moins un article pour composer votre surprise.'); return false; }
  for (const el of $$(`.step[data-step="${n}"] input, .step[data-step="${n}"] select, .step[data-step="${n}"] textarea`)) {
    if (el.disabled || el.closest('.hidden:not(.step)') || el.closest('details:not([open])')) continue;
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
  const items = p ? [tr(p, 'name'), ...selectedOptions().map(x => '+ ' + x.name)] : customLines().map(l => `${tr(state.elements.find(x => x.id === l.id), 'name')} × ${l.quantity}`);
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
      lang, package_id: f.get('package_id'), occasion: f.get('occasion'), recipient: f.get('recipient'), message: f.get('message'), city: f.get('city'), address: f.get('address'),
      event_at: new Date(f.get('event_at')).toISOString(), quantity: Number(f.get('quantity') || 1), elements: customLines(), live_requested: f.has('live_requested'), options: selectedOptions().map(x => x.id),
      ...Object.fromEntries(['sender_name', 'sender_phone', 'sender_email', 'recipient_phone', 'alternate_phone', 'department', 'landmark', 'colors', 'theme', 'cake', 'music', 'notes', 'sender'].map(k => [k, f.get(k) || '']))
    };
    await post('/api/orders', body);
    for (const k of ['recipient', 'recipient_phone', 'alternate_phone', 'message', 'sender', 'landmark', 'address', 'event_at', 'colors', 'theme', 'cake', 'music', 'notes']) e.target.elements[k].value = '';
    e.target.elements.live_requested.checked = false; cardDefaults();
    renderElements(); renderOptions(); goStep(1);
    if (state.user) { toast('Demande enregistrée ! Suivez-la dans votre espace client. Aucun paiement n’a été effectué.'); location.hash = 'espace'; refreshOrders(); }
    else toast('Merci ! Votre demande est enregistrée. Notre équipe vous recontacte par WhatsApp ou téléphone. Un récapitulatif vous est envoyé par courriel.');
  } catch (err) { toast(err.message); } finally { btn.disabled = false; }
};

/* ---------- Location ---------- */
function renderEquipment() {
  $('#equipmentGrid').innerHTML = state.equipment.map(e => `<div class="equipment-item"><h3>✦ ${escapeHTML(tr(e, 'name'))}</h3><p>${money(e.daily_price_htg)} ${t('/ jour')}</p><p>${t('Disponibles :')} ${Number(e.stock)}</p></div>`).join('');
  const sel = $('#equipmentSelect'), cur = sel.value;
  sel.innerHTML = state.equipment.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(tr(e, 'name'))} — ${money(e.daily_price_htg)} ${t('/ jour')}</option>`).join(''); if (cur) sel.value = cur;
  updateRentalTotal();
}
function updateRentalTotal() {
  const f = $('#rentalForm'), e = state.equipment.find(x => x.id === f.elements.equipment_id.value), qty = Number(f.elements.quantity.value) || 0;
  const s = Date.parse(f.elements.start_at.value), en = Date.parse(f.elements.end_at.value), days = s && en && en > s ? Math.ceil((en - s) / 86400000) : 1;
  $('#rentalTotal').textContent = e && qty > 0 ? `${money(e.daily_price_htg * qty * days)} (${days} ${t(days > 1 ? 'jours' : 'jour')})` : '—';
}
$('#rentalForm').addEventListener('input', updateRentalTotal);
$('#rentalForm').onsubmit = async e => {
  e.preventDefault(); if (!needAuth()) return; const f = new FormData(e.target);
  try {
    await post('/api/rentals', { equipment_id: f.get('equipment_id'), quantity: Number(f.get('quantity')), city: f.get('city'), start_at: new Date(f.get('start_at')).toISOString(), end_at: new Date(f.get('end_at')).toISOString() });
    toast('Demande de location enregistrée, en attente de confirmation.'); location.hash = 'espace'; refreshOrders();
  } catch (err) { toast(err.message); }
};

/* ---------- Galerie et témoignages ---------- */
async function loadGallery() { state.gallery = await api('/api/gallery'); renderGallery(); renderContact(); renderCatalog(); }
function renderGallery() {
  $('#galleryGrid').innerHTML = state.gallery.map(x => `<article class="card">${x.mime.startsWith('video/') ? `<video controls preload="metadata" src="/media/${escapeHTML(x.id)}"></video>` : `<img loading="lazy" src="/media/${escapeHTML(x.id)}" alt="${escapeHTML(x.title)}">`}<div class="card-body">${escapeHTML(x.title)}${state.user?.role === 'admin' ? ` <button class="remove-media" data-id="${escapeHTML(x.id)}">Retirer</button>` : ''}</div></article>`).join('') || `<p class="empty">${t('Nos premières réalisations arrivent bientôt.')}</p>`;
  const opts = '<option value="">Aucune</option>' + state.gallery.filter(g => g.mime.startsWith('image/')).map(g => `<option value="${escapeHTML(g.id)}">${escapeHTML(g.title)}</option>`).join('');
  $$('.gallery-image-select').forEach(s => { const v = s.value; s.innerHTML = opts; s.value = v; });
}
function renderTestimonials() {
  $('#avis').classList.toggle('hidden', !state.testimonials.length);
  $('#testimonialGrid').innerHTML = state.testimonials.slice().reverse().map(x => `<figure class="testimonial"><blockquote>« ${escapeHTML(x.text)} »</blockquote><figcaption><strong>${escapeHTML(x.name)}</strong>${[x.occasion, x.city].filter(Boolean).length ? ' · ' + escapeHTML([x.occasion, x.city].filter(Boolean).join(', ')) : ''}</figcaption></figure>`).join('');
  $('#adminTestimonials').innerHTML = state.testimonials.map(x => `<p class="admin-line">${escapeHTML(x.name)} : « ${escapeHTML(x.text.slice(0, 60))}… » <button type="button" class="remove-testimonial" data-id="${escapeHTML(x.id)}">Retirer</button></p>`).join('');
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
    $('#myRentals').innerHTML = myRentals.length ? myRentals.map(r => `<article class="order"><div><strong>${escapeHTML((lang === 'ht' && state.equipment.find(e => e.id === r.equipment_id)?.name_ht) || r.equipment_name)}</strong><p>${Number(r.quantity)} ${t('unité(s)')} · ${escapeHTML(r.city)}</p><p>${dateTime(r.start_at, true)} — ${dateTime(r.end_at, true)}</p></div><span class="status">${escapeHTML(label(r.status))}</span></article>`).join('') : `<div class="empty">${t('Aucune demande de location.')}</div>`;
    if (state.user.role === 'admin') await refreshAdmin();
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

/* ---------- Administration (en français) ---------- */
let allPackages = [];
async function refreshAdmin() {
  if (state.user?.role !== 'admin') return; mailOverview(); fillSettingsForm();
  try {
    await loadAdminCatalog(); await loadAdminElements(); await loadAdminEquipment();
    const [s, orders, rentals] = await Promise.all([api('/api/admin/stats'), api('/api/orders'), api('/api/rentals')]);
    const st = state.settings, warn = [];
    if (!st.whatsapp && !st.phone) warn.push('Coordonnées non renseignées : le bouton WhatsApp et la section Contact restent vides. Remplissez « Coordonnées de l’entreprise ».');
    if (!st.online_payment) warn.push('Paiement en ligne PlopPlop non configuré : ajoutez PLOP_CLIENT_ID et PLOP_CLIENT_SECRET dans Render > Environment. En attendant, le paiement manuel reste actif.');
    if (!state.gallery.some(g => g.mime.startsWith('image/'))) warn.push('Aucune photo publiée : ajoutez vos réalisations, puis associez-les aux formules et à l’accueil.');
    const noPhoto = allPackages.filter(p => p.active !== false && !p.photo).length; if (noPhoto) warn.push(noPhoto + ' formule(s) sans photo : elles s’affichent avec un pictogramme.');
    const noHT = allPackages.filter(p => p.active !== false && (!p.name_ht || (p.description && !p.description_ht) || ((p.includes || []).length && !(p.includes_ht || []).length))).length; if (noHT) warn.push(noHT + ' formule(s) active(s) avec une version kreyòl incomplète (nom, description ou « inclus ») : ces textes s’affichent en français pour les visiteurs en kreyòl.');
    const toPrice = [allPackages.filter(x => x.needs_price).length + ' formule(s)', (state.adminElements || []).filter(x => x.needs_price).length + ' article(s) sur mesure', (state.adminEquipment || []).filter(x => x.needs_price).length + ' matériel(s) de location'].filter(x => !x.startsWith('0 '));
    if (toPrice.length) warn.push('Nouveautés à tarifer puis activer : ' + toPrice.join(', ') + '. Elles sont repérées « à tarifer » dans les listes et restent invisibles pour les clients.');
    if (!state.testimonials.length) warn.push('Aucun témoignage : la section « Avis » reste masquée jusqu’au premier avis réel.');
    $('#adminWarnings').innerHTML = warn.map(w => `<p class="warning">${escapeHTML(w)}</p>`).join('');
    $('#stats').innerHTML = [['Commandes', s.orders], ['Revenus encaissés', money(s.revenue_htg)], ['Clients', s.customers], ['Locations confirmées', s.active_rentals]].map(x => `<div class="stat"><strong>${escapeHTML(x[1])}</strong><span>${escapeHTML(x[0])}</span></div>`).join('');
    const c = o => o.contact || {};
    $('#adminOrders').innerHTML = orders.map(o => {
      const att = o.payments || [], last = att[att.length - 1];
      return `<article class="order"><div><strong>${escapeHTML(o.package_name)} — ${escapeHTML(o.recipient)}</strong>${o.guest ? ' <span class="tag">Sans compte</span>' : ''}${o.lang === 'ht' ? ' <span class="tag">Kreyòl</span>' : ''}<p>${escapeHTML(o.city)} (${escapeHTML(c(o).department)}) · ${escapeHTML(adminDate(o.event_at))}</p><p>${money(o.total_htg)}${o.amount_due ? ' · à payer : ' + money(o.amount_due) : ''} · ${escapeHTML(adminLabel(o.status))} · ${escapeHTML(adminLabel(o.payment_status))}</p><p>Client : ${escapeHTML(c(o).sender_name)} · ${escapeHTML(c(o).sender_phone)} · ${escapeHTML(c(o).sender_email)}</p><p>Destinataire : ${escapeHTML(c(o).recipient_phone)}${c(o).alternate_phone ? ' · autre : ' + escapeHTML(c(o).alternate_phone) : ''}</p><p>${escapeHTML(o.address)}${c(o).landmark ? ' · ' + escapeHTML(c(o).landmark) : ''}</p><p>Réf. ${escapeHTML(o.id.slice(0, 8))} · Transaction : ${escapeHTML(o.payment_reference || '—')} · Magic Live : ${o.live_requested ? 'demandé' : 'non'}</p>${att.length ? `<p>Paiement en ligne : ${att.length} tentative(s), dernière ${last.status === 'paid' ? 'payée' : 'en attente'} (${escapeHTML(adminDate(last.created_at))})</p>` : ''}<p>${escapeHTML((o.options || []).map(x => [x.name, x.quantity ? '× ' + x.quantity : '', x.color, x.size, x.note].filter(Boolean).join(' ')).join(', '))}</p><p>${escapeHTML(Object.entries(o.personalization || {}).filter(x => x[1]).map(x => x.join(' : ')).join(' · '))}</p>${st.online_payment && o.pay_token ? `<button class="copy-pay-link" data-id="${escapeHTML(o.id)}" data-token="${escapeHTML(o.pay_token)}">Copier le lien de paiement client</button>` : `<button class="payment-link" data-id="${escapeHTML(o.id)}">Lien de paiement manuel</button>`}${o.payment_status === 'paid' ? `<button class="receipt" data-id="${escapeHTML(o.id)}">Reçu</button>` : ''}</div><div class="order-controls"><select class="order-status" data-id="${escapeHTML(o.id)}">${['pending', 'confirmed', 'preparing', 'in_progress', 'completed', 'cancelled'].map(v => `<option value="${v}" ${v === o.status ? 'selected' : ''}>${adminLabel(v)}</option>`).join('')}</select><select class="payment-status" data-id="${escapeHTML(o.id)}">${['unpaid', 'pending_verification', 'paid', 'refunded'].map(v => `<option value="${v}" ${v === o.payment_status ? 'selected' : ''}>${adminLabel(v)}</option>`).join('')}</select><input class="amount-due" data-id="${escapeHTML(o.id)}" type="number" min="1" placeholder="Montant à payer (défaut ${o.total_htg})" value="${o.amount_due || ''}"><input class="live-url" data-id="${escapeHTML(o.id)}" placeholder="https://... lien vidéo privé" value="${escapeHTML(o.live_url || '')}"><button class="btn btn-purple save-order" data-id="${escapeHTML(o.id)}">Enregistrer</button></div></article>`;
    }).join('') || '<div class="empty">Aucune commande.</div>';
    $$('.save-order').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, q = c => document.querySelector(`.${c}[data-id="${id}"]`), val = q('live-url').value.trim(), due = Number(q('amount-due').value) || null;
      if (q('payment-status').value === 'paid' && !confirm('Confirmez avoir vérifié le montant et la transaction dans le portail marchand.')) return;
      try { await post('/api/admin/orders/' + id, { status: q('order-status').value, payment_status: q('payment-status').value, live_url: val || null, amount_due: due }, 'PATCH'); toast('Commande mise à jour'); refreshOrders(); } catch (err) { toast(err.message); }
    });
    $('#adminRentals').innerHTML = rentals.map(r => `<article class="order"><div><strong>${escapeHTML(r.equipment_name)}</strong><p>${Number(r.quantity)} unité(s) · ${escapeHTML(r.city)} · ${escapeHTML(adminLabel(r.status))}</p><p>${escapeHTML(adminDate(r.start_at))} → ${escapeHTML(adminDate(r.end_at))}</p></div><div class="order-controls"><select class="rental-status" data-id="${escapeHTML(r.id)}">${['pending', 'confirmed', 'completed', 'cancelled'].map(v => `<option value="${v}" ${v === r.status ? 'selected' : ''}>${adminLabel(v)}</option>`).join('')}</select><button class="btn btn-purple save-rental" data-id="${escapeHTML(r.id)}">Enregistrer</button></div></article>`).join('') || '<div class="empty">Aucune location.</div>';
    $$('.save-rental').forEach(b => b.onclick = async () => { try { await post('/api/admin/rentals/' + b.dataset.id, { status: document.querySelector(`.rental-status[data-id="${b.dataset.id}"]`).value }, 'PATCH'); toast('Location mise à jour'); refreshOrders(); } catch (err) { toast(err.message); } });
  } catch (err) { toast(err.message); }
}
$('#refreshAdmin').onclick = refreshAdmin;

function fillSettingsForm() { const f = $('#settingsForm'); for (const el of f.elements) if (el.name) el.value = state.settings[el.name] || ''; }
$('#settingsForm').onsubmit = async e => {
  e.preventDefault();
  try { const saved = await post('/api/admin/settings', Object.fromEntries(new FormData(e.target))); state.settings = { ...saved, online_payment: state.settings.online_payment }; renderContact(); refreshAdmin(); toast('Coordonnées enregistrées'); } catch (err) { toast(err.message); }
};
$('#testimonialForm').onsubmit = async e => {
  e.preventDefault();
  try { await post('/api/admin/testimonials', Object.fromEntries(new FormData(e.target))); e.target.reset(); state.testimonials = await api('/api/testimonials'); renderTestimonials(); toast('Témoignage ajouté'); } catch (err) { toast(err.message); }
};

async function loadAdminCatalog() {
  const a = await api('/api/admin/catalog'); allPackages = a.packages;
  const sel = $('#editPackage'), cur = sel.value;
  sel.innerHTML = '<option value="">Nouvelle formule</option>' + allPackages.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}${x.needs_price ? ' — à tarifer' : x.active === false ? ' (inactive)' : ''}</option>`).join(''); sel.value = cur;
}
const lines = v => (v || '').split('\n').map(x => x.trim()).filter(Boolean);
const list = v => (v || '').split(',').map(x => x.trim()).filter(Boolean);
$('#editPackage').onchange = () => {
  const f = $('#packageForm'), p = allPackages.find(x => x.id === $('#editPackage').value);
  if (!p) { f.reset(); return; }
  for (const k of ['name', 'category', 'description', 'guests', 'lead_time', 'photo', 'name_ht', 'description_ht', 'guests_ht', 'lead_time_ht']) f.elements[k].value = p[k] || '';
  f.elements.price.value = p.needs_price ? '' : p.price_htg; f.elements.active.checked = p.active !== false || !!p.needs_price;
  f.elements.includes.value = (p.includes || []).join('\n'); f.elements.includes_ht.value = (p.includes_ht || []).join('\n'); f.elements.options.value = (p.options || []).map(x => x.name + ' | ' + x.price).join('\n');
};
async function refreshCatalog() { await loadCategories(); state.packages = await api('/api/packages'); renderCategories(); renderCatalog(); await loadAdminCatalog(); }
async function loadCategories() { const full = await api('/api/categories?full=1'); state.categories = full.map(x => x.name); state.catHT = Object.fromEntries(full.filter(x => x.name_ht).map(x => [x.name, x.name_ht])); }
$('#categoryEdit').onchange = () => { const f = $('#categoryForm'), v = $('#categoryEdit').value; f.elements.name.value = v; f.elements.name.readOnly = !!v; f.elements.name_ht.value = state.catHT[v] || ''; };
$('#categoryForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target), existing = f.get('existing');
  try { await post('/api/admin/categories', { name: f.get('name'), name_ht: f.get('name_ht'), translate: !!existing }); e.target.reset(); e.target.elements.name.readOnly = false; await refreshCatalog(); toast(existing ? 'Traduction enregistrée' : 'Catégorie créée'); } catch (err) { toast(err.message); }
};
$('#packageForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target);
  try {
    const options = lines(f.get('options')).map(x => { const [name, price] = x.split('|'); return { name: name.trim(), price: price?.trim() ? Number(price) : NaN }; });
    await post('/api/admin/packages', { id: f.get('id'), name: f.get('name'), category: f.get('category'), description: f.get('description'), price_htg: Number(f.get('price')), options, includes: lines(f.get('includes')), guests: f.get('guests'), lead_time: f.get('lead_time'), photo: f.get('photo'), active: f.has('active'), name_ht: f.get('name_ht'), description_ht: f.get('description_ht'), includes_ht: lines(f.get('includes_ht')), guests_ht: f.get('guests_ht'), lead_time_ht: f.get('lead_time_ht') });
    e.target.reset(); await refreshCatalog(); refreshAdmin(); toast('Formule enregistrée');
  } catch (err) { toast(err.message); }
};
async function loadAdminElements() {
  state.adminElements = await api('/api/admin/elements'); const el = $('#elementEdit'), old = el.value;
  el.innerHTML = '<option value="">Nouvel article</option>' + state.adminElements.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}${x.needs_price ? ' — à tarifer' : x.active === false ? ' (inactif)' : ''}</option>`).join(''); el.value = old;
}
$('#elementEdit').onchange = () => {
  const f = $('#elementForm'), x = state.adminElements.find(x => x.id === $('#elementEdit').value);
  for (const k of ['name', 'category', 'price', 'colors', 'sizes', 'name_ht', 'category_ht', 'colors_ht', 'sizes_ht']) f.elements[k].value = Array.isArray(x?.[k]) ? x[k].join(',') : x?.[k] ?? '';
  if (x?.needs_price) f.elements.price.value = '';
  f.elements.active.checked = x?.active !== false || !!x?.needs_price;
};
$('#elementForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target);
  try { await post('/api/admin/elements', { id: f.get('id'), name: f.get('name'), category: f.get('category'), price: Number(f.get('price')), colors: list(f.get('colors')), sizes: list(f.get('sizes')), active: f.has('active'), name_ht: f.get('name_ht'), category_ht: f.get('category_ht'), colors_ht: list(f.get('colors_ht')), sizes_ht: list(f.get('sizes_ht')) }); await loadAdminElements(); state.elements = await api('/api/elements'); renderElements(); toast('Article enregistré'); } catch (err) { toast(err.message); }
};
async function loadAdminEquipment() {
  state.adminEquipment = await api('/api/admin/equipment'); const el = $('#equipmentEdit'), old = el.value;
  el.innerHTML = '<option value="">Nouveau matériel</option>' + state.adminEquipment.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}${x.needs_price ? ' — à tarifer' : x.active === false ? ' (inactif)' : ''}</option>`).join(''); el.value = old;
}
$('#equipmentEdit').onchange = () => {
  const f = $('#equipmentForm'), x = state.adminEquipment.find(x => x.id === $('#equipmentEdit').value);
  if (!x) { f.reset(); return; }
  f.elements.name.value = x.name; f.elements.name_ht.value = x.name_ht || ''; f.elements.stock.value = x.stock; f.elements.daily_price_htg.value = x.needs_price ? '' : x.daily_price_htg; f.elements.active.checked = x.active !== false || !!x.needs_price;
};
$('#equipmentForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target);
  try { await post('/api/admin/equipment', { id: f.get('id'), name: f.get('name'), name_ht: f.get('name_ht'), stock: Number(f.get('stock')), daily_price_htg: Number(f.get('daily_price_htg')), active: f.has('active') }); e.target.reset(); await loadAdminEquipment(); state.equipment = await api('/api/equipment'); renderEquipment(); refreshAdmin(); toast('Matériel enregistré'); } catch (err) { toast(err.message); }
};
$('#galleryForm').onsubmit = async e => {
  e.preventDefault(); const f = new FormData(e.target), file = f.get('media');
  try {
    if (file.size > 20000000) throw Error('Maximum 20 Mo');
    const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });
    await post('/api/admin/gallery', { title: f.get('title'), mime: file.type, data, consent: f.has('consent') }); e.target.reset(); await loadGallery(); toast('Réalisation publiée');
  } catch (err) { toast(err.message); }
};
async function mailOverview() {
  if (state.user?.role !== 'admin') return;
  try { const a = await api('/api/admin/mail'); $('#mailOverview').textContent = (a.configured ? 'Service configuré' : 'Service non configuré — courriels en attente') + '\n' + a.jobs.map(x => x.subject + ' | ' + x.to + ' | ' + ({ pending: 'En attente', sent: 'Accepté par le prestataire', failed: 'Échec' }[x.status]) + ' | tentatives : ' + x.attempts).join('\n'); } catch (err) { $('#mailOverview').textContent = err.message; }
}
$('#mailRefresh').onclick = mailOverview;

// Actions déclenchées par les boutons des listes (délégation).
document.addEventListener('click', async e => {
  const b = e.target.closest('button[data-id]'); if (!b) return; const id = b.dataset.id;
  try {
    if (b.matches('.pay-now')) openPay(id, b.dataset.token);
    else if (b.matches('.copy-pay-link')) { const link = location.origin + '/#payer=' + id + '.' + b.dataset.token; try { await navigator.clipboard.writeText(link); toast('Lien de paiement copié : collez-le dans WhatsApp ou un courriel au client.'); } catch { prompt('Lien de paiement à envoyer au client', link); } }
    else if (b.matches('.payment-link')) { const url = prompt('Lien marchand Pay’m PlopPlop correspondant au montant exact de cette commande'); if (!url) return; await post('/api/admin/payment-link', { id, url }); await refreshOrders(); }
    else if (b.matches('.reference')) { const reference = prompt(t('Référence de transaction')); if (!reference) return; await post('/api/payment-reference', { id, reference }); await refreshOrders(); }
    else if (b.matches('.remove-media')) { if (!confirm('Retirer ce média de la galerie ?')) return; await post('/api/admin/gallery/remove', { id }); state.settings = await api('/api/settings'); state.packages = await api('/api/packages'); await loadGallery(); }
    else if (b.matches('.remove-testimonial')) { if (!confirm('Retirer ce témoignage ?')) return; await post('/api/admin/testimonials/remove', { id }); state.testimonials = await api('/api/testimonials'); renderTestimonials(); }
    else if (b.matches('.receipt')) {
      const w = window.open('', '_blank'); if (!w) throw Error('Autorisez les fenêtres contextuelles');
      try { const r = await api('/api/receipt/' + id); w.document.body.innerHTML = `<h1>Magic Moments — ${t('Reçu')}</h1><p>${escapeHTML(r.number)}</p><p>${t('Client')} : ${escapeHTML(r.customer)}</p><p>${t('Formule')} : ${escapeHTML(r.package)}</p><p>${t('Options')} : ${escapeHTML(r.options.map(x => (lang === 'ht' && x.name_ht) || x.name).join(', '))}</p><h2>${t('Montant encaissé')} : ${money(r.total)}</h2><p>${t('Date')} : ${escapeHTML(r.date ? dateTime(r.date) : t('Non enregistrée'))}</p><p>${t('Transaction')} : ${escapeHTML(r.reference || t('Validation administrative'))}</p>`; w.print(); } catch (err) { w.close(); throw err; }
    }
  } catch (err) { toast(err.message); }
});

/* ---------- Démarrage ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();
  translateStatic();
  try {
    const [packages, equipment, elements, gallery, settings, testimonials] = await Promise.all(['/api/packages', '/api/equipment', '/api/elements', '/api/gallery', '/api/settings', '/api/testimonials'].map(u => api(u)));
    Object.assign(state, { packages, equipment, elements, gallery, settings, testimonials }); await loadCategories();
    renderElements(); renderCategories(); renderCatalog(); renderEquipment(); renderGallery(); renderContact(); cardDefaults(); setMode('login'); goStep(1);
    try { state.user = (await api('/api/me')).user; } catch {}
    renderAuth(); refreshOrders(); checkHashLinks();
    if (!state.pay) { try { const p = JSON.parse(sessionStorage.getItem('mm_pay') || 'null'); if (p) openPay(p.id, p.token); } catch {} }
  } catch (err) { toast(t('Impossible de charger les données : ') + t(err.message)); }
}
init();
