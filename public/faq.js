// Magic Moments — page FAQ (français / kreyòl)
import { HT } from './i18n.js';
const $ = s => document.querySelector(s);
const h = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = 'fr'; try { lang = localStorage.getItem('mm_lang') === 'ht' ? 'ht' : 'fr'; } catch {}
const t = fr => (lang === 'ht' && HT[fr]) || fr;
const tr = (o, k) => (lang === 'ht' && o[k + '_ht']) || o[k];
let faq = [], settings = {}, cat = '';
const STATIC = [['.faq-title', 'Questions fréquentes'], ['.faq-help h2', 'Vous ne trouvez pas votre réponse ?'], ['.faq-help > p:not(.faq-cookie)', 'Écrivez-nous, nous répondons rapidement.'], ['#faqCookies', 'Modifier mes choix de cookies'], ['.nav-actions a.btn', '← Retour au site']];
function translate() {
  for (const [sel, fr] of STATIC) $(sel).textContent = t(fr);
  $('#faqSearch').placeholder = t('Rechercher une question…'); $('#faqSearch').setAttribute('aria-label', t('Rechercher une question…'));
  $('#langToggle').textContent = lang === 'ht' ? 'Français' : 'Kreyòl'; document.documentElement.lang = lang === 'ht' ? 'ht' : 'fr'; document.title = 'FAQ — Magic Moments';
}
const getCookie = n => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')) || [])[1] || '';
const setCookie = (n, v, d) => { document.cookie = `${n}=${v}; Max-Age=${d * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; };
function render() {
  const q = $('#faqSearch').value.trim().toLowerCase(), cats = [...new Set(faq.map(f => f.category))];
  $('#faqCats').innerHTML = [['', t('Toutes')], ...cats.map(c => [c, t(c)])].map(([v, l]) => `<button type="button" data-cat="${h(v)}" class="${v === cat ? 'active' : ''}">${h(l)}</button>`).join('');
  const list = faq.filter(f => (!cat || f.category === cat) && (!q || (tr(f, 'q') + ' ' + tr(f, 'a') + ' ' + f.q + ' ' + f.a).toLowerCase().includes(q)));
  $('#faqList').innerHTML = list.map(f => `<details class="faq-item" id="${/cookie/i.test(f.q) ? 'cookies' : 'q-' + h(f.id)}" ${(location.hash === '#cookies' && /cookie/i.test(f.q)) || location.hash === '#q-' + f.id ? 'open' : ''}><summary><span>${h(tr(f, 'q'))}</span><small>${h(t(f.category))}</small></summary><p>${h(tr(f, 'a')).replace(/\n/g, '<br>')}</p></details>`).join('') || `<p class="empty">${t('Aucune question ne correspond à votre recherche.')}</p>`;
  let wa = (settings.whatsapp || '').replace(/\D/g, ''); if (wa.length === 8) wa = '509' + wa;
  $('#faqContact').innerHTML = (wa ? `<a class="btn btn-gold" target="_blank" rel="noopener noreferrer" href="https://wa.me/${wa}?text=${encodeURIComponent(t('Bonjour Magic Moments, je souhaite des informations.'))}">${t('Écrire sur WhatsApp')}</a>` : '') + `<a class="btn btn-purple" href="/#contact">${t('Contact')}</a>`;
  const c = getCookie('mm_consent');
  $('#faqCookieState').innerHTML = c === 'yes' ? `· <b>${t('Mesure d’audience acceptée')}</b> <button type="button" class="linkbtn" data-consent="no">${t('Refuser')}</button>` : `· <b>${t('Mesure d’audience refusée')}</b> <button type="button" class="linkbtn" data-consent="yes">${t('Accepter')}</button>`;
}
$('#faqCats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; render(); } };
$('#faqSearch').oninput = render;
$('#faqCookies').onclick = () => $('#faqCookieState').scrollIntoView({ block: 'center' });
document.addEventListener('click', e => { const b = e.target.closest('[data-consent]'); if (!b) return; setCookie('mm_consent', b.dataset.consent, 365); if (b.dataset.consent === 'no') setCookie('mm_vid', '', 0); render(); const tt = $('#toast'); tt.textContent = t('Votre choix est enregistré.'); tt.classList.remove('hidden'); setTimeout(() => tt.classList.add('hidden'), 3000); });
$('#langToggle').onclick = () => { lang = lang === 'ht' ? 'fr' : 'ht'; try { localStorage.setItem('mm_lang', lang); } catch {} translate(); render(); };
(async () => {
  translate();
  try { [faq, settings] = await Promise.all([fetch('/api/faq').then(r => r.json()), fetch('/api/settings').then(r => r.json())]); } catch { faq = []; }
  render(); if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: 'start' });
})();
