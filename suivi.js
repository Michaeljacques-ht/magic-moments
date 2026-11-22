/* ==========================================================
   Magic Moments — Suivi sans compte (V18)
   ----------------------------------------------------------
   Comme sur Konekte, le client n'a plus besoin de compte :
   1. Référence + téléphone : il voit tout de suite l'étape,
      le paiement et peut payer ou afficher son reçu.
   2. Téléphone ou courriel : un code à 6 chiffres part par
      courriel ; une fois saisi, il retrouve toutes ses
      commandes et locations (session de 30 jours).
   3. L'appareil qui a envoyé la demande s'en souvient
      (liste locale id + jeton privé, vérifiée ici).
   Les liens des courriels (#suivre=…) ouvrent directement
   la demande concernée.
   ========================================================== */
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { stageOf } from './etapes.js';

const dig = t => createHash('sha256').update(t).digest('hex');
const tel8 = v => String(v || '').replace(/\D/g, '').slice(-8);
const mail = v => String(v || '').trim().toLowerCase();
const okMail = v => /^\S+@\S+\.\S+$/.test(v || '');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const mask = e => { const [n, d] = String(e).split('@'); return (n.length <= 2 ? n[0] + '•' : n.slice(0, 2) + '•'.repeat(Math.min(6, n.length - 2))) + '@' + d; };
const SESSION_MS = 30 * 864e5, CODE_MS = 10 * 60000, CHALLENGES = new Map();

export const refOf = (kind, x) => (kind === 'order' ? 'MM-' : 'LOC-') + x.id.slice(0, 8).toUpperCase();
export const trackLink = (base, kind, x) => base + '/#suivre=' + (kind === 'order' ? 'o' : 'l') + '.' + x.id + '.' + x.pay_token;
export function migrate(db) { db.clientSessions ??= []; for (const o of db.orders) o.pay_token ??= randomBytes(16).toString('hex'); }

export function contactOf(db, kind, x) {
  const us = x.user_id && db.users.find(y => y.id === x.user_id);
  return kind === 'order' ? { name: x.contact?.sender_name || us?.name || '', email: x.contact?.sender_email || us?.email || '', phone: x.contact?.sender_phone || us?.phone || '' }
    : { name: x.contact?.name || us?.name || '', email: x.contact?.email || us?.email || '', phone: x.contact?.phone || x.phone || us?.phone || '' };
}
function matches(db, kind, x, who) {
  if (who.userId && x.user_id === who.userId) return true;
  const c = contactOf(db, kind, x);
  return (who.phone?.length === 8 && tel8(c.phone) === who.phone) || (!!who.email && mail(c.email) === who.email);
}
const allOf = (db, who) => [...db.orders.filter(o => matches(db, 'order', o, who)).map(o => ['order', o]), ...db.rentals.filter(r => matches(db, 'rental', r, who)).map(r => ['rental', r])];

/** Vue client : ce dont le suivi a besoin, sans notes internes ni coordonnées d'autres personnes. */
export function view(S, kind, x) {
  const total = S.totalOf(kind, x), paid = S.paidOf(kind, x);
  return {
    kind, id: x.id, ref: refOf(kind, x), token: x.pay_token,
    title: kind === 'order' ? x.package_name : x.equipment_name,
    title_ht: kind === 'order' ? (x.package_name_ht || '') : (x.items || []).map(i => (i.name_ht || i.name) + ' × ' + i.quantity).join(', '),
    recipient: x.recipient || '', city: x.city || '', date: kind === 'order' ? x.event_at : x.start_at, end: x.end_at || null, days: x.days || null, message: x.message || '',
    status: x.status, payment_status: x.payment_status || 'unpaid', stage: stageOf(kind, x), total, paid, remaining: Math.max(0, total - paid),
    can_pay: S.canCollect() && S.partsOf(kind, x).length > 0, declared: (x.payments || []).some(a => a.status === 'declared'),
    express: !!x.express, shop: !!x.shop, express_slot: x.express_slot || '', live_url: x.live_url || '', live_requested: !!x.live_requested, music: x.personalization?.music || '', created_at: x.created_at
  };
}

function clientSession(db, req) {
  const t = (req.headers.cookie || '').match(/(?:^|;\s*)mm_client=([a-f0-9]{48})/)?.[1];
  return t ? db.clientSessions.find(s => s.token === dig(t) && s.expires > Date.now()) : null;
}
const setCookie = (S, res, t, age) => res.setHeader('Set-Cookie', `mm_client=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${S.production ? '; Secure' : ''}`);

const MAILS = {
  fr: (code) => ['Votre code Magic Moments', `Bonjour,\n\nVoici votre code pour retrouver vos commandes et locations Magic Moments :\n\n${code}\n\nIl est valable 10 minutes. Si vous n’avez rien demandé, ignorez ce message.`],
  ht: (code) => ['Kòd Magic Moments ou', `Bonjou,\n\nMen kòd pou w jwenn kòmand ak lokasyon Magic Moments ou yo :\n\n${code}\n\nLi bon pou 10 minit. Si se pa ou ki te mande l, pa okipe mesaj sa a.`]
};

export async function routes(S, { m, p, b, req, res, u, json }) {
  const db = S.db;
  // 1. Référence + téléphone
  if (m === 'POST' && p === '/api/track') {
    S.throttle(req);
    const ref = String(b.reference || '').trim().toUpperCase().replace(/\s+/g, ''), tel = tel8(b.phone), mm = /^(MM|LOC)-?([A-F0-9]{8})$/.exec(ref);
    if (!mm || tel.length < 8) S.err(400, 'Indiquez la référence (ex. MM-1A2B3C4D) et votre numéro de téléphone.');
    const kind = mm[1] === 'MM' ? 'order' : 'rental';
    const x = (kind === 'order' ? db.orders : db.rentals).find(y => y.id.slice(0, 8).toUpperCase() === mm[2] && tel8(contactOf(db, kind, y).phone) === tel);
    if (!x) S.err(404, 'Aucune demande ne correspond à ces informations.');
    return json(view(S, kind, x)), true;
  }
  // 3. Demandes mémorisées par cet appareil (id + jeton privé)
  if (m === 'POST' && p === '/api/track/device') {
    const out = [];
    for (const it of (Array.isArray(b.items) ? b.items.slice(0, 40) : [])) {
      const kind = it?.kind === 'rental' ? 'rental' : 'order', x = (kind === 'order' ? db.orders : db.rentals).find(y => y.id === it?.id);
      if (x && same(it.token, x.pay_token)) out.push(view(S, kind, x));
    }
    return json(out), true;
  }
  // 2. Code par courriel
  if (m === 'POST' && p === '/api/client/code') {
    S.throttle(req);
    const raw = String(b.contact || '').trim(), email = raw.includes('@') ? mail(raw) : '', phone = email ? '' : tel8(raw);
    if (email && !okMail(email)) S.err(400, 'Adresse courriel invalide.');
    if (!email && phone.length < 8) S.err(400, 'Indiquez votre numéro de téléphone ou votre courriel.');
    const items = allOf(db, { phone, email });
    if (!items.length) S.err(404, 'Aucune commande ni location trouvée avec ces informations.');
    const dest = email || items.map(([k, x]) => mail(contactOf(db, k, x).email)).find(okMail);
    if (!dest) S.err(409, 'Aucune adresse courriel n’est enregistrée avec ce numéro. Utilisez la référence de votre demande, ou écrivez-nous sur WhatsApp.');
    const now = Date.now(); for (const [k, v] of CHALLENGES) if (v.expires < now) CHALLENGES.delete(k);
    if (CHALLENGES.size > 5000) S.err(429, 'Réessayez dans quelques minutes');
    const challenge = randomBytes(18).toString('hex'), code = String(randomInt(0, 1e6)).padStart(6, '0');
    CHALLENGES.set(challenge, { phone, email: dest, code, tries: 0, expires: now + CODE_MS });
    const [subject, text] = MAILS[b.lang === 'ht' ? 'ht' : 'fr'](code);
    S.commit(() => S.queueMail(dest, subject, text, { kind: 'code' }));
    return json({ challenge, destination: mask(dest) }), true;
  }
  if (m === 'POST' && p === '/api/client/verify') {
    S.throttle(req);
    const c = CHALLENGES.get(String(b.challenge || ''));
    if (!c || c.expires < Date.now()) S.err(401, 'Code expiré. Demandez un nouveau code.');
    if (++c.tries > 5) { CHALLENGES.delete(b.challenge); S.err(429, 'Trop de tentatives. Demandez un nouveau code.'); }
    const code = String(b.code || '').replace(/\D/g, '');
    if (!(code.length === 6 && same(code, c.code))) S.err(401, `Code incorrect. ${5 - c.tries} essai(s) restant(s).`);
    CHALLENGES.delete(b.challenge);
    const t = randomBytes(24).toString('hex');
    S.commit(() => { db.clientSessions = db.clientSessions.filter(s => s.expires > Date.now()).slice(-5000); db.clientSessions.push({ token: dig(t), phone: c.phone, email: c.email, expires: Date.now() + SESSION_MS, created_at: new Date().toISOString() }); });
    setCookie(S, res, t, SESSION_MS / 1000);
    return json({ ok: true }), true;
  }
  if (m === 'POST' && p === '/api/client/logout') {
    const s = clientSession(db, req); if (s) S.commit(() => { db.clientSessions = db.clientSessions.filter(x => x !== s); });
    setCookie(S, res, '', 0); return json({ ok: true }), true;
  }
  if (m === 'GET' && p === '/api/client/mine') {
    const s = clientSession(db, req), client = u && u.role !== 'admin' ? u : null;
    if (!s && !client) return json({ session: null, items: [] }), true;
    const who = { phone: s?.phone || tel8(client?.phone), email: s?.email || mail(client?.email), userId: client?.id || null };
    const items = allOf(db, who).sort((a, b) => String(b[1].created_at).localeCompare(String(a[1].created_at))).map(([k, x]) => view(S, k, x));
    return json({ session: { label: s ? (s.phone ? '•••• ' + s.phone.slice(-4) + ' · ' : '') + mask(s.email) : client.email, account: !s }, items }), true;
  }
  // Reçu : jeton privé de la demande, session client ou compte propriétaire.
  if (m === 'POST' && p === '/api/receipt/view') {
    const kind = b.kind === 'rental' ? 'rental' : 'order', x = (kind === 'order' ? db.orders : db.rentals).find(y => y.id === b.id);
    if (!x) S.err(404, 'Demande introuvable');
    const s = clientSession(db, req);
    if (!(same(b.token, x.pay_token) || (u && (u.role === 'admin' || x.user_id === u.id)) || (s && matches(db, kind, x, { phone: s.phone, email: s.email })))) S.err(403, 'Accès refusé');
    const paid = S.paidOf(kind, x); if (!(paid > 0)) S.err(409, 'Paiement non confirmé');
    const c = contactOf(db, kind, x);
    return json({ number: refOf(kind, x), kind, customer: c.name || 'Client', title: kind === 'order' ? x.package_name : x.equipment_name, options: kind === 'order' ? (x.options || []) : (x.items || []),
      total: S.totalOf(kind, x), paid, remaining: Math.max(0, S.totalOf(kind, x) - paid),
      payments: (x.payments || []).filter(a => a.status === 'paid').map(a => ({ amount: a.amount, date: a.paid_at || a.created_at, method: a.method || '', reference: a.declared_ref || a.transaction_id || a.reference })),
      date: x.paid_at || (x.payments || []).filter(a => a.status === 'paid').map(a => a.paid_at).pop() || null, reference: x.payment_reference || null }), true;
  }
  return false;
}
