/* ==========================================================
   Magic Moments — Cadeau express (V19)
   ----------------------------------------------------------
   Offrir un cadeau livré le jour même : le client choisit un
   cadeau prêt à partir, un créneau de livraison d'aujourd'hui
   (heure d'Haïti), règle la totalité et l'équipe est alertée
   en priorité. L'administrateur règle l'heure limite, les
   créneaux, les villes desservies, les frais et le nombre de
   livraisons par jour (Paramètres → Cadeau express) et choisit
   les cadeaux concernés (case « Cadeau express » des formules).
   ========================================================== */
const TZ = 'America/Port-au-Prince';
export const DEFAULTS = { enabled: true, start: '09:00', end: '19:00', cutoff: '15:00', slot_minutes: 120, lead_minutes: 120, fee: 1000, daily_limit: 15,
  cities: ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Tabarre', 'Carrefour', 'Croix-des-Bouquets', 'Saint-Marc'] };
const hm = v => { const [h, m] = String(v).split(':').map(Number); return h * 60 + m; };
const fmt = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const okHM = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');

/** Date, minute du jour et décalage horaire actuels en Haïti. */
export function haitiNow(d = new Date()) {
  const o = {}; for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).formatToParts(d)) o[p.type] = p.value;
  const off = /GMT([+-])?(\d+)?(?::(\d+))?/.exec(o.timeZoneName || 'GMT-5');
  return { date: `${o.year}-${o.month}-${o.day}`, minutes: Number(o.hour) * 60 + Number(o.minute), offset: (off?.[1] || '+') + String(off?.[2] || 0).padStart(2, '0') + ':' + (off?.[3] || '00') };
}

export function migrate(db) {
  db.settings.express = { ...DEFAULTS, ...(db.settings.express || {}) };
  // Premier démarrage : les 4 formules actives les moins chères deviennent des cadeaux express (modifiable).
  if (!db.settings.express_init) { db.settings.express_init = true; db.packages.filter(p => p.active !== false && p.price_htg > 1).sort((a, b) => a.price_htg - b.price_htg).slice(0, 4).forEach(p => { p.express ??= true; }); }
}

const sameDay = (db, date) => db.orders.filter(o => o.express && o.status !== 'cancelled' && o.express_date === date).length;

/** État du jour : ouvert ou non, créneaux restants, villes, frais. */
export function status(db, d = new Date()) {
  const X = db.settings.express, now = haitiNow(d), slots = [];
  for (let t = hm(X.start); t + X.slot_minutes <= hm(X.end); t += X.slot_minutes)
    if (t + X.slot_minutes - 30 >= now.minutes + X.lead_minutes) slots.push({ id: fmt(t), label: fmt(t).replace(':', 'h') + ' – ' + fmt(t + X.slot_minutes).replace(':', 'h'), at: `${now.date}T${fmt(t)}:00${now.offset}` });
  const count = sameDay(db, now.date), packages = db.packages.filter(p => p.express && p.active !== false).length;
  let reason = '';
  if (!X.enabled) reason = 'off'; else if (!packages) reason = 'no_gift'; else if (now.minutes >= hm(X.cutoff) || !slots.length) reason = 'late'; else if (count >= X.daily_limit) reason = 'full';
  return { enabled: !!X.enabled, open: !reason, reason, date: now.date, cutoff: X.cutoff.replace(':', 'h'), start: X.start.replace(':', 'h'), fee: X.fee, cities: X.cities, slots: reason ? [] : slots, left: Math.max(0, X.daily_limit - count) };
}

/** Vérifie une commande express ; renvoie le créneau et les frais. */
export function check(db, b, pack, err) {
  const st = status(db);
  if (!st.open) err(409, { off: 'Le cadeau express n’est pas disponible pour le moment.', no_gift: 'Aucun cadeau express n’est disponible pour le moment.', late: 'Les cadeaux express du jour sont fermés (commande avant ' + st.cutoff + '). Revenez demain dès ' + st.start + '.', full: 'Toutes les livraisons express du jour sont réservées. Revenez demain.' }[st.reason]);
  if (!pack || pack.id === 'custom' || !pack.express) err(400, 'Ce cadeau n’est pas disponible en livraison express.');
  if (!st.cities.includes(b.city)) err(400, 'Livraison express non disponible dans cette ville.');
  const slot = st.slots.find(s => s.id === b.express_slot); if (!slot) err(400, 'Choisissez un créneau de livraison encore disponible aujourd’hui.');
  return { slot, fee: st.fee, date: st.date };
}

export function routes(ctx, { m, p, b, u, json }) {
  const { db } = ctx;
  if (m === 'GET' && p === '/api/express') return json(status(db)), true;
  if (!p.startsWith('/api/admin/express')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  if (m === 'GET') return json({ settings: db.settings.express, status: status(db), packages: db.packages.map(x => ({ id: x.id, name: x.name, price_htg: x.price_htg, active: x.active !== false, express: !!x.express })) }), true;
  if (m === 'POST') {
    const n = (k, lo, hi) => { const v = Number(b[k]); if (!Number.isInteger(v) || v < lo || v > hi) ctx.err(400, 'Valeur invalide : ' + k); return v; };
    for (const k of ['start', 'end', 'cutoff']) if (!okHM(b[k])) ctx.err(400, 'Heure invalide (format HH:MM)');
    if (hm(b.start) >= hm(b.end)) ctx.err(400, 'L’heure de fin doit suivre l’heure de début');
    const cities = (Array.isArray(b.cities) ? b.cities : String(b.cities || '').split('\n')).map(x => String(x).trim()).filter(Boolean);
    if (!cities.length || cities.length > 40 || cities.some(c => c.length > 80)) ctx.err(400, 'Indiquez au moins une ville desservie');
    const X = { enabled: !!b.enabled, start: b.start, end: b.end, cutoff: b.cutoff, slot_minutes: n('slot_minutes', 30, 480), lead_minutes: n('lead_minutes', 0, 480), fee: n('fee', 0, 1000000), daily_limit: n('daily_limit', 1, 500), cities: [...new Set(cities)] };
    const ids = Array.isArray(b.packages) ? b.packages : null;
    ctx.commit(() => { db.settings.express = X; if (ids) for (const x of db.packages) x.express = ids.includes(x.id); });
    return json({ settings: X, status: status(db) }), true;
  }
  return false;
}
