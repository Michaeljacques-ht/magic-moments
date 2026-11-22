/* ==========================================================
   Magic Moments — Boutique de cadeaux (V20)
   ----------------------------------------------------------
   Des cadeaux prêts à offrir (fleurs, peluches, chocolats,
   paniers…) avec prix et stock. Le client remplit un panier,
   choisit la livraison ou le retrait, paie la totalité et suit
   sa commande sans compte. Chaque achat devient une commande
   « Boutique » : paiement, étapes, courriels, WhatsApp, reçus
   et comptabilité fonctionnent comme pour les surprises.
   Le stock est réservé à la commande et rendu si elle est annulée.
   ========================================================== */
import { randomBytes, randomUUID } from 'node:crypto';
import { move } from './stock.js';
const mid = () => randomUUID(), mnow = () => new Date().toISOString();

export const SHOP_CATEGORIES = ['Fleurs', 'Peluches', 'Chocolats et douceurs', 'Paniers gourmands', 'Bijoux et accessoires', 'Parfums et beauté', 'Décoration', 'Cartes et ballons', 'Personnalisés', 'Autres'];
export const SHOP_CATEGORIES_HT = { 'Fleurs': 'Flè', 'Peluches': 'Toutou', 'Chocolats et douceurs': 'Chokola ak dous', 'Paniers gourmands': 'Panye manje', 'Bijoux et accessoires': 'Bijou ak akseswa', 'Parfums et beauté': 'Pafen ak bote', 'Décoration': 'Dekorasyon', 'Cartes et ballons': 'Kat ak balon', 'Personnalisés': 'Pèsonalize', 'Autres': 'Lòt' };
const DEFAULT_SETTINGS = { enabled: true, delivery: true, delivery_fee: 750, free_from: 15000, pickup: true, pickup_address: '', lead_days: 1, gift_wrap: 250 };
const P = (name, name_ht, category, price_htg, stock, description, description_ht, featured = false) => ({ name, name_ht, category, price_htg, stock, description, description_ht, featured });
const SEED = [
  P('Bouquet de 12 roses rouges', 'Bouke 12 woz wouj', 'Fleurs', 3500, 10, 'Roses fraîches emballées avec ruban et carte.', 'Woz fre vlope ak riban ak kat.', true),
  P('Bouquet de fleurs mixtes', 'Bouke flè melanje', 'Fleurs', 2500, 10, 'Composition colorée de saison.', 'Bèl bouke flè koulè sezon an.'),
  P('Ours en peluche géant', 'Gwo toutou nounous', 'Peluches', 4500, 6, 'Peluche douce de 1 mètre, idéale pour surprendre.', 'Toutou dous 1 mèt, pou fè sipriz.', true),
  P('Petit ours « Je t’aime »', 'Ti nounous « Mwen renmen w »', 'Peluches', 1500, 12, 'Peluche de 25 cm avec cœur brodé.', 'Toutou 25 cm ak yon kè bwode.'),
  P('Coffret de chocolats', 'Bwat chokola', 'Chocolats et douceurs', 2000, 15, 'Assortiment de 16 chocolats fins.', '16 bon chokola diferan.', true),
  P('Panier gourmand', 'Panye manje fen', 'Paniers gourmands', 6500, 5, 'Fruits, jus, biscuits, chocolats et douceurs locales.', 'Fwi, ji, biskwi, chokola ak dous lokal.'),
  P('Bougie parfumée', 'Bouji santi bon', 'Décoration', 1200, 10, 'Bougie artisanale parfum vanille ou coco.', 'Bouji atizanal ki santi vaniy oswa kokoye.'),
  P('Bouquet de ballons hélium', 'Bouke balon elyòm', 'Cartes et ballons', 1800, 8, 'Six ballons gonflés à l’hélium, couleurs au choix.', 'Sis balon elyòm, koulè ou chwazi.'),
  P('Mug personnalisé', 'Tas pèsonalize', 'Personnalisés', 1300, 10, 'Mug avec photo ou message (24 h de préparation).', 'Tas ak foto oswa mesaj (24 è preparasyon).'),
  P('Coffret parfum et soins', 'Bwat pafen ak swen', 'Parfums et beauté', 5500, 4, 'Parfum, lait corporel et pochette cadeau.', 'Pafen, lèt pou kò ak ti valiz kado.')
];

export function migrate(db, id, now) {
  db.settings.shop = { ...DEFAULT_SETTINGS, ...(db.settings.shop || {}) };
  if (!db.products) { db.products = SEED.map((x, i) => ({ id: id(), ...x, photo: '', active: true, order: i, created_at: now() })); }
}

const pub = x => ({ id: x.id, name: x.name, name_ht: x.name_ht, category: x.category, category_ht: SHOP_CATEGORIES_HT[x.category] || '', description: x.description, description_ht: x.description_ht, price_htg: x.price_htg, stock: x.stock, photo: x.photo, featured: !!x.featured });
const settingsPub = S => ({ first_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(Date.now() + Number(S.lead_days || 0) * 864e5), enabled: S.enabled, delivery: S.delivery, delivery_fee: S.delivery_fee, free_from: S.free_from, pickup: S.pickup, pickup_address: S.pickup_address, lead_days: S.lead_days, gift_wrap: S.gift_wrap });
const deliveryFee = (S, sub, mode) => mode === 'pickup' ? 0 : (S.free_from && sub >= S.free_from ? 0 : S.delivery_fee);

/** Rend le stock d'une commande boutique annulée (une seule fois). */
export function restock(db, o) {
  if (o.stock_restored || !(o.options || []).some(l => l.product_id)) return;
  for (const l of o.options || []) { const x = l.product_id && db.products.find(p => p.id === l.product_id); if (x) move(db, { kind: 'product', item: x, qty: l.quantity, type: 'return', reason: 'Commande annulée' + (o.cancel_reason ? ' (' + o.cancel_reason + ')' : ''), ref: o.id, id: mid, now: mnow }); }
  o.stock_restored = true;
}

export function routes(ctx, { m, p, b, u, req, json }, hooks) {
  const { db } = ctx, S = db.settings.shop;
  if (m === 'GET' && p === '/api/shop') return json({ settings: settingsPub(S), categories: SHOP_CATEGORIES.map(c => ({ name: c, name_ht: SHOP_CATEGORIES_HT[c] })), products: S.enabled ? db.products.filter(x => x.active !== false).sort((a, b) => (b.featured - a.featured) || (a.order ?? 0) - (b.order ?? 0)).map(pub) : [] }), true;

  if (m === 'POST' && p === '/api/shop/order') {
    ctx.throttle(req);
    if (!S.enabled) ctx.err(409, 'La boutique est fermée pour le moment.');
    const lines = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    if (!lines.length) ctx.err(400, 'Votre panier est vide.');
    const items = [];
    for (const l of lines) {
      const x = db.products.find(y => y.id === l?.id && y.active !== false), q = Number(l?.quantity);
      if (!x) ctx.err(409, 'Un article de votre panier n’est plus disponible. Actualisez la page.');
      if (!Number.isInteger(q) || q < 1 || q > 50) ctx.err(400, 'Quantité invalide');
      if (items.some(i => i.product_id === x.id)) ctx.err(400, 'Article en double');
      if (q > x.stock) ctx.err(409, x.stock ? `Il ne reste que ${x.stock} « ${x.name} ».` : `« ${x.name} » est en rupture de stock.`);
      items.push({ product_id: x.id, name: x.name, name_ht: x.name_ht || '', price: x.price_htg * q, unit_price: x.price_htg, quantity: q });
    }
    const mode = b.delivery === 'pickup' ? 'pickup' : 'delivery';
    if (mode === 'pickup' && !S.pickup) ctx.err(400, 'Le retrait sur place n’est pas proposé.');
    if (mode === 'delivery' && !S.delivery) ctx.err(400, 'La livraison n’est pas proposée.');
    const forOther = b.for_other === true, tel = v => /^\+?[0-9 ()-]{7,25}$/.test(v || '') && String(v).replace(/\D/g, '').length >= 8;
    if (!ctx.str(b.sender_name || '', 2, 120) || !tel(b.sender_phone) || !/^\S+@\S+\.\S+$/.test(b.sender_email || '') || b.sender_email.length > 200) ctx.err(400, 'Indiquez votre nom, votre téléphone et votre courriel.');
    if (forOther && (!ctx.str(b.recipient || '', 2, 120) || !tel(b.recipient_phone))) ctx.err(400, 'Indiquez le nom et le téléphone de la personne qui reçoit le cadeau.');
    if (mode === 'delivery' && (!ctx.str(b.city || '', 2, 120) || !ctx.str(b.address || '', 5, 500))) ctx.err(400, 'Indiquez la ville et l’adresse de livraison.');
    for (const k of ['landmark', 'message']) if (!ctx.str(b[k] ?? '', 0, k === 'message' ? 1000 : 200)) ctx.err(400, 'Texte trop long');
    const hd = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(t), first = hd(Date.now() + Number(S.lead_days || 0) * 864e5), last = hd(Date.now() + 120 * 864e5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || b.date < first || b.date > last) ctx.err(400, 'Choisissez une date de livraison ou de retrait à partir du ' + first.split('-').reverse().join('/') + '.');
    const wrap = b.gift_wrap === true && S.gift_wrap > 0 ? S.gift_wrap : 0, sub = items.reduce((a, i) => a + i.price, 0), fee = deliveryFee(S, sub, mode);
    if (fee) items.push({ name: 'Livraison', name_ht: 'Livrezon', price: fee, quantity: 1, fee: true });
    if (wrap) items.push({ name: 'Emballage cadeau', name_ht: 'Anbalaj kado', price: wrap, quantity: 1, fee: true });
    const count = items.filter(i => i.product_id).reduce((a, i) => a + i.quantity, 0);
    const o = { id: ctx.id(), user_id: u && u.role !== 'admin' ? u.id : null, guest: !u, shop: true, lang: b.lang === 'ht' ? 'ht' : 'fr', pay_token: randomBytes(16).toString('hex'),
      package_id: 'shop', package_name: `Boutique — ${count} article${count > 1 ? 's' : ''}`, package_name_ht: `Boutik — ${count} atik`, occasion: ctx.str(b.occasion || '', 2, 80) ? b.occasion.trim() : 'Cadeau',
      recipient: forOther ? b.recipient.trim() : b.sender_name.trim(), message: (b.message || '').trim(), delivery: mode,
      city: mode === 'pickup' ? 'Retrait en boutique' : b.city.trim(), address: mode === 'pickup' ? (S.pickup_address || 'Retrait sur place') : b.address.trim() + (b.landmark ? ' — ' + b.landmark.trim() : ''),
      event_at: new Date(b.date + 'T12:00:00-05:00').toISOString(), quantity: 1, unit_price_htg: sub, total_htg: sub + fee + wrap, options: items, personalization: {},
      contact: { sender_name: b.sender_name.trim(), sender_phone: b.sender_phone.trim(), sender_email: b.sender_email.trim().toLowerCase(), recipient_phone: forOther ? b.recipient_phone.trim() : '', department: mode === 'pickup' ? '—' : b.city.trim(), landmark: (b.landmark || '').trim() },
      live_requested: false, status: 'pending', payment_status: 'unpaid', live_url: null, created_at: ctx.now() };
    ctx.commit(() => { takeStock(db, o, 'Vente boutique'); db.orders.push(o); hooks.created(o); });
    return json(o, 201), true;
  }

  if (!p.startsWith('/api/admin/shop')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  if (m === 'GET' && p === '/api/admin/shop') return json({ settings: S, categories: SHOP_CATEGORIES, products: db.products.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }), true;
  if (m === 'POST' && p === '/api/admin/shop/settings') {
    const n = (k, hi) => { const v = Number(b[k]); if (!Number.isInteger(v) || v < 0 || v > hi) ctx.err(400, 'Valeur invalide : ' + k); return v; };
    if (!ctx.str(b.pickup_address || '', 0, 300)) ctx.err(400, 'Adresse trop longue');
    if (!b.delivery && !b.pickup) ctx.err(400, 'Proposez au moins la livraison ou le retrait');
    ctx.commit(() => { db.settings.shop = { enabled: !!b.enabled, delivery: !!b.delivery, delivery_fee: n('delivery_fee', 1e6), free_from: n('free_from', 1e8), pickup: !!b.pickup, pickup_address: (b.pickup_address || '').trim(), lead_days: n('lead_days', 30), gift_wrap: n('gift_wrap', 1e6) }; });
    return json(db.settings.shop), true;
  }
  if (m === 'POST' && p === '/api/admin/shop/products') {
    const old = b.id ? ctx.find(db.products, b.id) : null;
    if (!ctx.str(b.name || '', 2, 120) || !ctx.str(b.name_ht ?? '', 0, 120) || !ctx.str(b.category || '', 2, 80) || !ctx.str(b.description ?? '', 0, 600) || !ctx.str(b.description_ht ?? '', 0, 600)) ctx.err(400, 'Nom, catégorie et description valides requis');
    if (!Number.isInteger(b.price_htg) || b.price_htg < 1 || b.price_htg > 1e7 || !Number.isInteger(b.stock) || b.stock < 0 || b.stock > 1e5) ctx.err(400, 'Prix et stock invalides');
    for (const ph of [b.photo, ...(b.photos || [])]) if (ph && !ctx.isImage(ph)) ctx.err(400, 'Photo introuvable');
    const x = { id: old?.id || ctx.id(), name: b.name.trim(), name_ht: (b.name_ht || '').trim(), category: b.category.trim(), description: (b.description || '').trim(), description_ht: (b.description_ht || '').trim(),
      price_htg: b.price_htg, stock: b.stock, photo: b.photo || '', active: b.active !== false, featured: b.featured === true, order: old?.order ?? db.products.length, created_at: old?.created_at || ctx.now() };
    x.min_stock = old?.min_stock ?? 2; x.cost = old?.cost ?? 0;
    const target = x.stock; if (old) x.stock = old.stock; else x.stock = 0;
    ctx.commit(() => { const it = old ? Object.assign(old, x) : (db.products.push(x), x); if (target !== it.stock) move(db, { kind: 'product', item: it, qty: target - it.stock, type: old ? 'adjust' : 'in', reason: old ? 'Modification de la fiche article' : 'Stock initial', user: u.name || u.email, id: ctx.id, now: ctx.now }); });
    x.stock = target;
    return json(x), true;
  }
  if (m === 'POST' && p === '/api/admin/shop/products/remove') { const x = ctx.find(db.products, String(b.id || '')); ctx.commit(() => { db.products = db.products.filter(y => y.id !== x.id); }); return json({ ok: true }), true; }
  return false;
}

/** Libère le stock des commandes boutique jamais payées après 48 h (annulées automatiquement). */
export function expireUnpaid(db) {
  let n = 0;
  for (const o of db.orders) if (o.shop && o.status === 'pending' && o.payment_status === 'unpaid' && !(o.payments || []).some(a => ['declared', 'pending'].includes(a.status)) && Date.now() - Date.parse(o.created_at) > 48 * 36e5) { o.status = 'cancelled'; o.cancel_reason = 'Non payée sous 48 h'; restock(db, o); n++; }
  return n;
}

/** Articles de la boutique ajoutés à une surprise (commande classique) : vérifie le stock et renvoie les lignes. */
export function addons(db, list, err) {
  if (list == null || list === '') return [];
  if (!Array.isArray(list) || list.length > 30) err(400, 'Articles de la boutique invalides');
  if (list.length && !db.settings.shop.enabled) err(409, 'La boutique est fermée pour le moment.');
  const out = [];
  for (const l of list) {
    const x = db.products.find(y => y.id === l?.id && y.active !== false), q = Number(l?.quantity);
    if (!x) err(409, 'Un article de la boutique n’est plus disponible. Actualisez la page.');
    if (!Number.isInteger(q) || q < 1 || q > 50 || out.some(i => i.product_id === x.id)) err(400, 'Quantité invalide');
    if (q > x.stock) err(409, x.stock ? `Il ne reste que ${x.stock} « ${x.name} ».` : `« ${x.name} » est en rupture de stock.`);
    out.push({ product_id: x.id, shop: true, name: '🛍️ ' + x.name, name_ht: x.name_ht ? '🛍️ ' + x.name_ht : '', unit_price: x.price_htg, quantity: q, price: x.price_htg * q });
  }
  return out;
}
export const takeStock = (db, o, reason = 'Ajouté à une surprise') => { for (const l of o.options || []) if (l.product_id) { const x = db.products.find(p => p.id === l.product_id); if (x) move(db, { kind: 'product', item: x, qty: -l.quantity, type: 'sale', reason, ref: o.id, id: mid, now: mnow }); } };
