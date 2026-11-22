/* ==========================================================
   Magic Moments — Gestion de stock (V21)
   ----------------------------------------------------------
   Trois familles d'articles suivies au même endroit :
   - les articles de la boutique (vendus) ;
   - le matériel de location (prêté puis récupéré) ;
   - les fournitures internes (ballons, rubans, papier cadeau…).
   Chaque variation passe par un mouvement daté et tracé
   (entrée, sortie, perte, inventaire, vente, retour), avec le
   stock avant/après, le coût et l'auteur. Une entrée peut créer
   la dépense correspondante en comptabilité. Seuils d'alerte,
   valeur du stock et export CSV.
   ========================================================== */
const KINDS = { product: 'Boutique', equipment: 'Matériel de location', supply: 'Fourniture' };
export const MOVE_TYPES = { in: 'Entrée (achat / réception)', out: 'Sortie (utilisation)', loss: 'Perte / casse', adjust: 'Inventaire (ajustement)', sale: 'Vente', return: 'Retour en stock' };
const SUPPLY_CATEGORIES = ['Décoration', 'Emballage', 'Ballons', 'Fleurs', 'Pâtisserie', 'Papeterie', 'Entretien', 'Autres'];
const SEED_SUPPLIES = [
  ['Ballons latex (sachet de 50)', 'Ballons', 'sachet', 10, 3, 600], ['Bonbonne d’hélium', 'Ballons', 'bonbonne', 2, 1, 9000], ['Rouleau de papier cadeau', 'Emballage', 'rouleau', 20, 5, 250],
  ['Ruban satin (bobine)', 'Emballage', 'bobine', 15, 4, 300], ['Cartes de vœux', 'Papeterie', 'carte', 100, 20, 50], ['Bougies d’anniversaire (boîte)', 'Pâtisserie', 'boîte', 12, 3, 150]
];

export function migrate(db, id, now) {
  db.stockMoves ??= [];
  if (!db.supplies) db.supplies = SEED_SUPPLIES.map(([name, category, unit, stock, min_stock, cost]) => ({ id: id(), name, category, unit, stock, min_stock, cost, supplier: '', active: true, created_at: now() }));
  for (const p of db.products || []) { p.min_stock ??= 2; p.cost ??= 0; }
  for (const e of db.equipment || []) { e.min_stock ??= 0; e.cost ??= 0; }
}

const listOf = (db, kind) => kind === 'product' ? (db.products ||= []) : kind === 'equipment' ? db.equipment : (db.supplies ||= []);

/** Seul point d'entrée pour faire varier un stock : met à jour la quantité et journalise. */
export function move(db, { kind, item, qty, type, reason = '', ref = '', cost = null, user = 'système', id, now }) {
  const before = item.stock, after = Math.max(0, before + qty);
  item.stock = after;
  db.stockMoves.push({ id: id(), kind, item_id: item.id, item_name: item.name, type, qty: after - before, before, after, unit_cost: cost, reason, ref, user, created_at: now() });
  if (db.stockMoves.length > 20000) db.stockMoves.splice(0, db.stockMoves.length - 20000);
  return item;
}

const view = (kind, x) => ({ kind, kind_label: KINDS[kind], id: x.id, name: x.name, category: x.category || (kind === 'equipment' ? 'Location' : ''), unit: x.unit || 'unité', stock: x.stock, min_stock: x.min_stock || 0, cost: x.cost || 0,
  value: (x.cost || 0) * x.stock, price: kind === 'product' ? x.price_htg : kind === 'equipment' ? x.daily_price_htg : null, active: x.active !== false, low: x.active !== false && x.stock <= (x.min_stock || 0), photo: x.photo || '', supplier: x.supplier || '' });
export const lowCount = db => ['product', 'equipment', 'supply'].reduce((a, k) => a + listOf(db, k).filter(x => x.active !== false && !x.needs_price && x.stock <= (x.min_stock || 0)).length, 0);
const cell = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };

export function routes(ctx, { m, p, b, u, req, res, json }) {
  if (!p.startsWith('/api/admin/stock')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  const { db } = ctx, who = u.name || u.email;
  const items = () => ['product', 'equipment', 'supply'].flatMap(k => listOf(db, k).filter(x => !x.needs_price).map(x => view(k, x)));

  if (m === 'GET' && p === '/api/admin/stock') {
    const all = items(), active = all.filter(x => x.active);
    return json({ items: all, types: MOVE_TYPES, kinds: KINDS, supply_categories: SUPPLY_CATEGORIES,
      totals: { value: active.reduce((a, x) => a + x.value, 0), low: active.filter(x => x.low).length, out: active.filter(x => !x.stock).length, items: active.length },
      moves: db.stockMoves.slice(-300).reverse(), accounts: (db.accounts || []).map(({ id, name }) => ({ id, name })) }), true;
  }
  if (m === 'GET' && p === '/api/admin/stock/moves') {
    const q = new URL(req.url, 'http://x').searchParams, kind = q.get('kind'), item = q.get('item');
    return json(db.stockMoves.filter(x => (!kind || x.kind === kind) && (!item || x.item_id === item)).slice(-1000).reverse()), true;
  }
  if (m === 'GET' && p === '/api/admin/stock/export.csv') {
    const rows = [['Famille', 'Article', 'Catégorie', 'Unité', 'Stock', 'Seuil d’alerte', 'Coût unitaire HTG', 'Valeur HTG', 'Statut']].concat(items().map(x => [x.kind_label, x.name, x.category, x.unit, x.stock, x.min_stock, x.cost, x.value, !x.active ? 'Inactif' : !x.stock ? 'Épuisé' : x.low ? 'À réapprovisionner' : 'OK']));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="stock-magic-moments-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
    res.end('﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n')); return true;
  }
  // Mouvement manuel : entrée, sortie, perte ou inventaire
  if (m === 'POST' && p === '/api/admin/stock/move') {
    if (!KINDS[b.kind] || !['in', 'out', 'loss', 'adjust'].includes(b.type)) ctx.err(400, 'Mouvement invalide');
    const item = ctx.find(listOf(db, b.kind), String(b.id || '')), n = Number(b.quantity);
    if (!Number.isInteger(n) || n < 0 || n > 1e6 || (b.type !== 'adjust' && n < 1)) ctx.err(400, 'Quantité invalide');
    if (['out', 'loss'].includes(b.type) && n > item.stock) ctx.err(400, `Stock insuffisant : il reste ${item.stock}.`);
    if (!ctx.str(b.reason ?? '', 0, 300)) ctx.err(400, 'Motif trop long');
    const cost = b.unit_cost === '' || b.unit_cost == null ? null : Number(b.unit_cost);
    if (cost !== null && (!Number.isInteger(cost) || cost < 0 || cost > 1e7)) ctx.err(400, 'Coût unitaire invalide');
    const qty = b.type === 'adjust' ? n - item.stock : b.type === 'in' ? n : -n;
    if (b.type === 'adjust' && !qty) ctx.err(400, 'Le stock compté est identique au stock enregistré.');
    const account = b.expense && b.type === 'in' && cost ? (db.accounts.find(a => a.id === b.account) ? b.account : 'caisse') : null;
    ctx.commit(() => {
      move(db, { kind: b.kind, item, qty, type: b.type, reason: (b.reason || '').trim() + (b.supplier ? (b.reason ? ' · ' : '') + 'Fournisseur : ' + b.supplier.trim().slice(0, 120) : ''), cost, user: who, id: ctx.id, now: ctx.now });
      if (b.type === 'in' && cost) item.cost = cost;
      if (b.kind === 'supply' && b.supplier) item.supplier = b.supplier.trim().slice(0, 120);
      if (account) db.entries.push({ id: ctx.id(), date: ctx.now().slice(0, 10), type: 'expense', category: b.kind === 'product' ? 'Achats de marchandises' : b.kind === 'equipment' ? 'Achat de matériel' : 'Achats de fournitures',
        amount: cost * n, account, label: `Stock — ${item.name} × ${n}`, ref: 'stock:' + db.stockMoves.at(-1).id, auto: true, created_at: ctx.now() });
    });
    return json(view(b.kind, item)), true;
  }
  // Seuil d'alerte et coût d'achat d'un article (boutique ou matériel)
  if (m === 'POST' && p === '/api/admin/stock/settings') {
    if (!KINDS[b.kind]) ctx.err(400, 'Famille invalide');
    const item = ctx.find(listOf(db, b.kind), String(b.id || '')), min = Number(b.min_stock), cost = Number(b.cost);
    if (!Number.isInteger(min) || min < 0 || min > 1e6 || !Number.isInteger(cost) || cost < 0 || cost > 1e7) ctx.err(400, 'Seuil ou coût invalide');
    ctx.commit(() => { item.min_stock = min; item.cost = cost; });
    return json(view(b.kind, item)), true;
  }
  // Fournitures internes
  if (m === 'POST' && p === '/api/admin/stock/supplies') {
    const old = b.id ? ctx.find(db.supplies, b.id) : null, n = k => { const v = Number(b[k]); if (!Number.isInteger(v) || v < 0 || v > 1e7) ctx.err(400, 'Valeur invalide : ' + k); return v; };
    if (!ctx.str(b.name || '', 2, 120) || !ctx.str(b.category || '', 2, 60) || !ctx.str(b.unit || '', 1, 30) || !ctx.str(b.supplier ?? '', 0, 120)) ctx.err(400, 'Nom, catégorie et unité requis');
    const x = { id: old?.id || ctx.id(), name: b.name.trim(), category: b.category.trim(), unit: b.unit.trim(), min_stock: n('min_stock'), cost: n('cost'), supplier: (b.supplier || '').trim(), active: b.active !== false, stock: old ? old.stock : 0, created_at: old?.created_at || ctx.now() };
    const initial = old ? 0 : n('stock');
    ctx.commit(() => { if (old) Object.assign(old, x); else { db.supplies.push(x); if (initial) move(db, { kind: 'supply', item: x, qty: initial, type: 'in', reason: 'Stock initial', cost: x.cost || null, user: who, id: ctx.id, now: ctx.now }); } });
    return json(x), true;
  }
  if (m === 'POST' && p === '/api/admin/stock/supplies/remove') { const x = ctx.find(db.supplies, String(b.id || '')); ctx.commit(() => { db.supplies = db.supplies.filter(y => y.id !== x.id); }); return json({ ok: true }), true; }
  return false;
}
