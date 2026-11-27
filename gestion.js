/* ============================================================
   Magic Moments — modules de gestion
   Annonces, diaporama d'accueil, ressources humaines (recrutement,
   personnel, avances, paie) et comptabilité (journal, comptes,
   rapports, export). Branché sur server.js via ctx.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const HANDLED = Symbol('handled');

export const INCOME_CATEGORIES = ['Ventes de surprises', 'Ventes boutique', 'Décoration événementielle', 'Locations de matériel', 'Acomptes clients', 'Autres recettes'];
export const EXPENSE_CATEGORIES = ['Achats de fournitures', 'Achats de marchandises', 'Achat de matériel', 'Pâtisserie et fleurs', 'Salaires et primes', 'Transport et livraison', 'Carburant et électricité', 'Loyer', 'Communication et internet', 'Marketing et publicité', 'Location d’équipement', 'Entretien et réparations', 'Frais bancaires et de paiement', 'Taxes et impôts', 'Remboursements clients', 'Autres dépenses'];
const CONTRACTS = ['CDI', 'CDD', 'Temps partiel', 'Stage', 'Journalier', 'Prestataire'];
const JOB_TYPES = ['Temps plein', 'Temps partiel', 'Contrat', 'Stage', 'Journalier'];
const APP_STATUS = ['new', 'shortlisted', 'interview', 'hired', 'rejected'];
const CV_TYPES = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };
const ATTACH_TYPES = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v));
const month = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v || '');
const today = () => new Date().toISOString().slice(0, 10);
const amountOk = (v, allowZero = false) => Number.isInteger(v) && (allowZero ? v >= 0 : v > 0) && v <= 100000000;

/** Ajoute les collections manquantes (données existantes conservées). */
export function migrate(db) {
  for (const f of db.faq || []) if (f.q === 'Dois-je créer un compte pour commander ?' && f.a === 'Non. Vous pouvez envoyer une demande sans compte. Un compte vous permet en plus de suivre vos commandes, vos reçus et vos liens Magic Live. Un compte est nécessaire pour louer du matériel.') { f.a = 'Non. Aucun compte n’est nécessaire : surprises, boutique, cadeau express, location et décoration se commandent sans compte. Suivez vos demandes, vos paiements et vos reçus dans « Suivre ma commande », avec la référence et votre téléphone, ou avec un code reçu par courriel.'; f.a_ht = 'Non. Ou pa bezwen kont : sipriz, boutik, kado eksprès, lokasyon ak dekorasyon, ou ka kòmande yo san kont. Swiv demann, peman ak resi ou yo nan « Swiv kòmand mwen », ak referans lan ak telefòn ou, oswa ak yon kòd ou resevwa pa imèl.'; }
  db.announcements ??= []; db.jobs ??= []; db.applications ??= []; db.employees ??= []; db.payroll ??= []; db.advances ??= []; db.files ??= []; db.entries ??= [];
  db.accounts ??= [
    { id: 'caisse', name: 'Caisse (espèces)', opening: 0 }, { id: 'moncash', name: 'MonCash', opening: 0 }, { id: 'natcash', name: 'NatCash', opening: 0 },
    { id: 'banque', name: 'Banque', opening: 0 }, { id: 'plopplop', name: 'PlopPlop (paiements en ligne)', opening: 0 }
  ];
  db.settings.hero_slides ??= db.settings.contact?.hero_media ? [{ media: db.settings.contact.hero_media, caption: '', caption_ht: '' }] : [];
}

/* ---------- Écritures comptables automatiques ----------
   Une commande ou une location peut être payée en plusieurs fois (acompte puis solde) :
   chaque encaissement a sa propre écriture (ref « order:<id> », puis « order:<id>:2 »…). */
const baseRef = (kind, x) => (kind === 'order' ? 'order:' : 'rental:') + x.id;
const incomesOf = (db, base) => db.entries.filter(e => e.type === 'income' && (e.ref === base || e.ref.startsWith(base + ':')));
const totalOf = (kind, x) => kind === 'order' ? (x.amount_due || x.total_htg) : (x.amount_due || x.estimate || 0);
const titleOf = (kind, x) => kind === 'order' ? `${x.package_name} — ${x.recipient}` : `Location — ${x.equipment_name}`;
export function recordPayment(db, kind, x, amount, account, part, id, now) {
  if (!(amount > 0)) return;
  const base = baseRef(kind, x), n = incomesOf(db, base).length;
  db.entries.push({ id: id(), date: now().slice(0, 10), type: 'income', category: kind === 'order' ? (x.shop ? 'Ventes boutique' : x.decor ? 'Décoration événementielle' : 'Ventes de surprises') : 'Locations de matériel', amount, account: account || 'caisse',
    label: (part === 'deposit' ? 'Acompte — ' : part === 'balance' ? 'Solde — ' : '') + titleOf(kind, x), ref: n ? base + ':' + (n + 1) : base, auto: true, created_at: now() });
}
// Marquage « payé » par l'administrateur : on n'enregistre que ce qui n'a pas encore été compté.
function recordRemainder(db, kind, x, id, now) {
  const done = incomesOf(db, baseRef(kind, x)).reduce((a, e) => a + e.amount, 0), rest = totalOf(kind, x) - done;
  if (rest > 0) recordPayment(db, kind, x, rest, (x.payments || []).some(p => p.status === 'paid' && !p.manual && !p.declared_ref) ? 'plopplop' : 'caisse', done ? 'balance' : 'full', id, () => (x.paid_at || now()));
}
function recordRefund(db, kind, x, id, now) {
  const base = baseRef(kind, x), sales = incomesOf(db, base), refund = (kind === 'order' ? 'refund:' : 'refund-rental:') + x.id;
  if (!sales.length || db.entries.some(e => e.ref === refund)) return;
  db.entries.push({ id: id(), date: today(), type: 'expense', category: 'Remboursements clients', amount: sales.reduce((a, e) => a + e.amount, 0), account: sales[0].account, label: 'Remboursement — ' + titleOf(kind, x), ref: refund, auto: true, created_at: now() });
}
export const recordOrderPaid = (db, o, id, now) => recordRemainder(db, 'order', o, id, now);
export const recordOrderRefund = (db, o, id, now) => recordRefund(db, 'order', o, id, now);
export const recordRentalPaid = (db, r, id, now) => recordRemainder(db, 'rental', r, id, now);
export const recordRentalRefund = (db, r, id, now) => recordRefund(db, 'rental', r, id, now);

/* Preuve de paiement envoyée par un client (capture ou PDF), conservée en fichier privé. */
export function saveProof(ctx, file) { return saveFile(ctx, file, { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }, 6000000, 'proof'); }

/* ---------- Soldes et rapports ---------- */
function balances(db, until) {
  const bal = Object.fromEntries(db.accounts.map(a => [a.id, a.opening || 0]));
  for (const e of db.entries) {
    if (until && e.date > until) continue;
    if (e.type === 'income') bal[e.account] = (bal[e.account] || 0) + e.amount;
    else if (e.type === 'expense') bal[e.account] = (bal[e.account] || 0) - e.amount;
    else if (e.type === 'transfer') { bal[e.account] = (bal[e.account] || 0) - e.amount; bal[e.to_account] = (bal[e.to_account] || 0) + e.amount; }
  }
  return bal;
}
function report(db, from, to) {
  const inRange = db.entries.filter(e => e.date >= from && e.date <= to && e.type !== 'transfer');
  const sum = t => inRange.filter(e => e.type === t).reduce((a, e) => a + e.amount, 0);
  const byCat = {}; for (const e of inRange) { const k = e.type + '|' + e.category; byCat[k] = (byCat[k] || 0) + e.amount; }
  const months = [];
  const end = new Date(to + 'T00:00:00Z');
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1)), key = d.toISOString().slice(0, 7);
    const es = db.entries.filter(e => e.date.startsWith(key) && e.type !== 'transfer');
    months.push({ month: key, income: es.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0), expense: es.filter(e => e.type === 'expense').reduce((a, e) => a + e.amount, 0) });
  }
  const bal = balances(db, to);
  const receivable = db.orders.filter(o => !['pending', 'cancelled'].includes(o.status) && ['unpaid', 'pending_verification'].includes(o.payment_status)).reduce((a, o) => a + (o.amount_due || o.total_htg), 0);
  const payrollDue = db.payroll.filter(s => s.status === 'draft').reduce((a, s) => a + s.net, 0);
  return {
    from, to, income: sum('income'), expense: sum('expense'), result: sum('income') - sum('expense'),
    categories: Object.entries(byCat).map(([k, amount]) => { const [type, category] = k.split('|'); return { type, category, amount }; }).sort((a, b) => b.amount - a.amount),
    accounts: db.accounts.map(a => ({ ...a, balance: bal[a.id] || 0 })), cash_total: Object.values(bal).reduce((a, b) => a + b, 0),
    months, receivable, payroll_due: payrollDue
  };
}
const csvCell = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/* ---------- Paie ---------- */
function computeSlip(s) { s.gross = s.base + s.bonus; s.net = Math.max(0, s.gross - s.deductions - s.advances); return s; }
function slipBase(emp, days) { return emp.pay_type === 'daily' ? emp.salary * days : emp.salary; }

/* ---------- Fichiers privés (CV, pièces justificatives) ---------- */
function saveFile(ctx, { name, mime, data }, types, max, kind) {
  if (!types[mime] || typeof data !== 'string') ctx.err(400, 'Type de fichier non accepté');
  const buf = Buffer.from(data, 'base64'); if (!buf.length || buf.length > max) ctx.err(400, `Fichier trop volumineux (${Math.round(max / 1e6)} Mo maximum)`);
  const f = { id: ctx.id(), name: String(name || 'fichier').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100) || 'fichier', mime, kind, size: buf.length, created_at: ctx.now() };
  fs.writeFileSync(path.join(ctx.dir, 'f-' + f.id), buf, { mode: 0o600 });
  return f;
}

/* ============================================================
   Routes publiques (avant l'exigence de connexion)
   ============================================================ */
export async function publicRoutes(ctx, { m, p, b, req, json }) {
  const db = ctx.db;
  if (m === 'GET' && p === '/api/announcements') {
    const d = today();
    return json(db.announcements.filter(a => a.active && (!a.start || a.start <= d) && (!a.end || a.end >= d)).map(({ id, text, text_ht, link }) => ({ id, text, text_ht, link }))), HANDLED;
  }
  if (m === 'GET' && p === '/api/jobs') {
    const d = today();
    return json(db.jobs.filter(j => j.status === 'open' && (!j.deadline || j.deadline >= d))), HANDLED;
  }
  const apply = /^\/api\/jobs\/([a-f0-9-]{36})\/apply$/.exec(p);
  if (m === 'POST' && apply) {
    ctx.throttle(req);
    const job = ctx.find(db.jobs, apply[1]); if (job.status !== 'open' || (job.deadline && job.deadline < today())) ctx.err(409, 'Ce poste n’est plus ouvert');
    if (!ctx.str(b.name, 2, 120) || !/^\+?[0-9 ()-]{7,25}$/.test(b.phone || '') || !/^\S+@\S+\.\S+$/.test(b.email || '') || !ctx.str(b.message ?? '', 0, 3000)) ctx.err(400, 'Informations invalides');
    let cv = null; if (b.cv) cv = saveFile(ctx, b.cv, CV_TYPES, 6000000, 'cv');
    const a = { id: ctx.id(), job_id: job.id, job_title: job.title, name: b.name.trim(), phone: b.phone.trim(), email: b.email.trim().toLowerCase(), message: (b.message || '').trim(), cv: cv?.id || null, status: 'new', notes: '', created_at: ctx.now() };
    try { ctx.commit(() => { if (cv) db.files.push(cv); db.applications.push(a); ctx.alertAdmin('Nouvelle candidature — ' + job.title, ['Candidature reçue pour : ' + job.title, '', 'Nom : ' + a.name, 'Téléphone : ' + a.phone, 'Courriel : ' + a.email, 'CV joint : ' + (cv ? 'oui' : 'non')]); }); }
    catch (e) { if (cv) fs.rmSync(path.join(ctx.dir, 'f-' + cv.id), { force: true }); throw e; }
    return json({ ok: true }, 201), HANDLED;
  }
  return null;
}

/* ============================================================
   Routes administrateur (/api/admin/…, connexion admin vérifiée)
   ============================================================ */
export async function adminRoutes(ctx, { m, p, b, u, req, res, json }) {
  const db = ctx.db, { err, str, id, now, commit, find } = ctx;
  const done = (x, s) => (json(x, s), HANDLED);

  /* --- Tableau de bord --- */
  if (m === 'GET' && p === '/api/admin/dashboard') {
    const d = today(), mStart = d.slice(0, 8) + '01', r = report(db, mStart, d), soon = Date.now() + 7 * 864e5;
    return done({
      month_income: r.income, month_expense: r.expense, month_result: r.result, cash_total: r.cash_total, receivable: r.receivable, payroll_due: r.payroll_due,
      orders_pending: db.orders.filter(o => o.status === 'pending').length, shop_low: (db.products || []).filter(x => x.active !== false && x.stock <= (x.min_stock ?? 2)).length, stock_low: ['products', 'equipment', 'supplies'].reduce((a, k) => a + (db[k] || []).filter(x => x.active !== false && !x.needs_price && x.stock <= (x.min_stock || 0)).length, 0), express_today: db.orders.filter(o => o.express && !['cancelled', 'completed'].includes(o.status) && o.express_date === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date())).length, orders_total: db.orders.length,
      payments_to_check: db.orders.filter(o => o.payment_status === 'pending_verification').length,
      rentals_pending: db.rentals.filter(x => x.status === 'pending').length, rentals_to_check: db.rentals.filter(x => x.payment_status === 'pending_verification').length, applications_new: db.applications.filter(a => a.status === 'new').length,
      employees_active: db.employees.filter(e => e.status === 'active').length,
      to_price: db.packages.filter(x => x.needs_price).length + db.elements.filter(x => x.needs_price).length + db.equipment.filter(x => x.needs_price).length,
      upcoming: db.orders.filter(o => o.status !== 'cancelled' && Date.parse(o.event_at) >= Date.now() && Date.parse(o.event_at) <= soon).sort((a, b) => a.event_at.localeCompare(b.event_at)).slice(0, 8).map(o => ({ id: o.id, package_name: o.package_name, recipient: o.recipient, city: o.city, event_at: o.event_at, status: o.status, payment_status: o.payment_status })),
      months: r.months.slice(-6)
    });
  }

  /* --- Annonces --- */
  if (m === 'GET' && p === '/api/admin/announcements') return done(db.announcements);
  if (m === 'POST' && p === '/api/admin/announcements') {
    if (!str(b.text, 3, 240) || !str(b.text_ht ?? '', 0, 240) || (b.link && !/^(https:\/\/[^\s"'<>]+|#[a-z-]+)$/.test(b.link)) || (b.start && !day(b.start)) || (b.end && !day(b.end))) err(400, 'Annonce invalide : texte (240 caractères maximum), lien https:// ou #section, dates AAAA-MM-JJ');
    const old = b.id ? find(db.announcements, b.id) : null;
    const a = { id: old?.id || id(), text: b.text.trim(), text_ht: (b.text_ht || '').trim(), link: b.link || '', start: b.start || '', end: b.end || '', active: b.active !== false, created_at: old?.created_at || now() };
    commit(() => { if (old) Object.assign(old, a); else db.announcements.unshift(a); }); return done(a);
  }
  if (m === 'POST' && p === '/api/admin/announcements/remove') { const a = find(db.announcements, b.id); commit(() => { db.announcements = db.announcements.filter(x => x !== a); }); return done({ ok: true }); }

  /* --- Diaporama d'accueil --- */
  if (m === 'POST' && p === '/api/admin/slides') {
    if (!Array.isArray(b.slides) || b.slides.length > 10 || b.slides.some(s => !ctx.isImage(s?.media) || !str(s.caption ?? '', 0, 140) || !str(s.caption_ht ?? '', 0, 140))) err(400, 'Diaporama invalide (10 images maximum, légende 140 caractères)');
    commit(() => { db.settings.hero_slides = b.slides.map(s => ({ media: s.media, caption: (s.caption || '').trim(), caption_ht: (s.caption_ht || '').trim() })); }); return done(db.settings.hero_slides);
  }

  /* --- Fichiers privés --- */
  const fileGet = /^\/api\/admin\/files\/([a-f0-9-]{36})$/.exec(p);
  if (m === 'GET' && fileGet) {
    const f = find(db.files, fileGet[1]), fp = path.join(ctx.dir, 'f-' + f.id);
    if (!fs.existsSync(fp)) err(404, 'Fichier introuvable');
    res.writeHead(200, { 'Content-Type': f.mime, 'Content-Disposition': `attachment; filename="${encodeURIComponent(/\.[a-z0-9]{2,5}$/i.test(f.name) ? f.name : f.name + (CV_TYPES[f.mime] || ATTACH_TYPES[f.mime] || ''))}"`, 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res); return HANDLED;
  }
  if (m === 'POST' && p === '/api/admin/files') {
    const f = saveFile(ctx, b, ATTACH_TYPES, 10000000, 'attachment');
    try { commit(() => db.files.push(f)); } catch (e) { fs.rmSync(path.join(ctx.dir, 'f-' + f.id), { force: true }); throw e; }
    return done(f, 201);
  }

  /* --- Recrutement --- */
  if (m === 'GET' && p === '/api/admin/hr') return done({ jobs: db.jobs, applications: db.applications.slice().reverse(), employees: db.employees, payroll: db.payroll.slice().reverse(), advances: db.advances.slice().reverse(), contracts: CONTRACTS, job_types: JOB_TYPES });
  if (m === 'POST' && p === '/api/admin/jobs') {
    if (!str(b.title, 3, 120) || !str(b.title_ht ?? '', 0, 120) || !JOB_TYPES.includes(b.type) || !str(b.location ?? '', 0, 120) || !str(b.department ?? '', 0, 80) || !str(b.description, 10, 4000) || !str(b.description_ht ?? '', 0, 4000) || !str(b.requirements ?? '', 0, 3000) || !str(b.requirements_ht ?? '', 0, 3000) || !str(b.salary ?? '', 0, 120) || (b.deadline && !day(b.deadline)) || !['open', 'closed'].includes(b.status)) err(400, 'Offre invalide : titre, type, description (10 caractères minimum) requis');
    const old = b.id ? find(db.jobs, b.id) : null, j = { id: old?.id || id(), created_at: old?.created_at || now() };
    for (const k of ['title', 'title_ht', 'type', 'location', 'department', 'description', 'description_ht', 'requirements', 'requirements_ht', 'salary', 'deadline', 'status']) j[k] = typeof b[k] === 'string' ? b[k].trim() : '';
    commit(() => { if (old) Object.assign(old, j); else db.jobs.unshift(j); }); return done(j);
  }
  if (m === 'POST' && p === '/api/admin/jobs/remove') { const j = find(db.jobs, b.id); if (db.applications.some(a => a.job_id === j.id)) err(409, 'Des candidatures existent : fermez l’offre au lieu de la supprimer'); commit(() => { db.jobs = db.jobs.filter(x => x !== j); }); return done({ ok: true }); }
  if (m === 'POST' && p === '/api/admin/applications/update') {
    const a = find(db.applications, b.id); if (!APP_STATUS.includes(b.status) || !str(b.notes ?? '', 0, 3000)) err(400, 'Mise à jour invalide');
    commit(() => { a.status = b.status; a.notes = (b.notes || '').trim(); a.updated_at = now(); }); return done(a);
  }

  /* --- Personnel --- */
  if (m === 'POST' && p === '/api/admin/employees') {
    if (!str(b.name, 2, 120) || !str(b.role, 2, 80) || !str(b.department ?? '', 0, 80) || !/^\+?[0-9 ()-]{7,25}$/.test(b.phone || '') || (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) || !day(b.hire_date) || (b.end_date && !day(b.end_date)) || !CONTRACTS.includes(b.contract) || !['monthly', 'daily'].includes(b.pay_type) || !amountOk(b.salary) || !str(b.pay_method ?? '', 0, 40) || !str(b.pay_account ?? '', 0, 80) || !str(b.address ?? '', 0, 300) || !str(b.emergency ?? '', 0, 200) || !str(b.notes ?? '', 0, 2000) || !['active', 'inactive'].includes(b.status)) err(400, 'Fiche invalide : nom, poste, téléphone, date d’embauche, contrat et salaire requis');
    const old = b.id ? find(db.employees, b.id) : null, e = { id: old?.id || id(), created_at: old?.created_at || now(), from_application: old?.from_application || b.from_application || null };
    for (const k of ['name', 'role', 'department', 'phone', 'email', 'hire_date', 'end_date', 'contract', 'pay_type', 'pay_method', 'pay_account', 'address', 'emergency', 'notes', 'status']) e[k] = typeof b[k] === 'string' ? b[k].trim() : '';
    e.salary = b.salary;
    commit(() => { if (old) Object.assign(old, e); else db.employees.push(e); if (e.from_application) { const a = db.applications.find(x => x.id === e.from_application); if (a) a.status = 'hired'; } }); return done(e);
  }
  if (m === 'POST' && p === '/api/admin/advances') {
    const emp = find(db.employees, b.employee_id); if (!amountOk(b.amount) || !day(b.date) || !db.accounts.some(a => a.id === b.account) || !str(b.note ?? '', 0, 300)) err(400, 'Avance invalide');
    const a = { id: id(), employee_id: emp.id, name: emp.name, amount: b.amount, date: b.date, account: b.account, note: (b.note || '').trim(), settled_in: null, created_at: now() };
    commit(() => { db.advances.push(a); db.entries.push({ id: id(), date: a.date, type: 'expense', category: 'Salaires et primes', amount: a.amount, account: a.account, label: 'Avance sur salaire — ' + emp.name, ref: 'advance:' + a.id, auto: true, created_at: now() }); }); return done(a);
  }

  /* --- Paie --- */
  if (m === 'POST' && p === '/api/admin/payroll/generate') {
    if (!month(b.period)) err(400, 'Période invalide (AAAA-MM)');
    const created = [];
    commit(() => {
      for (const emp of db.employees.filter(e => e.status === 'active' && e.hire_date.slice(0, 7) <= b.period)) {
        if (db.payroll.some(s => s.employee_id === emp.id && s.period === b.period)) continue;
        const worked = new Set((db.timeEntries || []).filter(t => t.employee_id === emp.id && t.status === 'approved' && t.end && t.date.startsWith(b.period)).map(t => t.date)).size, days = emp.pay_type === 'daily' ? (worked || 26) : 0, adv = db.advances.filter(a => a.employee_id === emp.id && !a.settled_in).reduce((x, a) => x + a.amount, 0);
        const s = computeSlip({ id: id(), period: b.period, employee_id: emp.id, name: emp.name, role: emp.role, pay_type: emp.pay_type, rate: emp.salary, days, base: slipBase(emp, days), bonus: 0, deductions: 0, advances: adv, note: '', status: 'draft', created_at: now() });
        db.payroll.push(s); created.push(s);
      }
    });
    return done({ created: created.length });
  }
  if (m === 'POST' && p === '/api/admin/payroll/update') {
    const s = find(db.payroll, b.id); if (s.status !== 'draft') err(409, 'Fiche déjà payée');
    if (!amountOk(b.bonus, true) || !amountOk(b.deductions, true) || (s.pay_type === 'daily' && !(Number.isInteger(b.days) && b.days >= 0 && b.days <= 31)) || !str(b.note ?? '', 0, 300)) err(400, 'Valeurs invalides');
    commit(() => { if (s.pay_type === 'daily') { s.days = b.days; s.base = s.rate * b.days; } s.bonus = b.bonus; s.deductions = b.deductions; s.note = (b.note || '').trim(); computeSlip(s); }); return done(s);
  }
  if (m === 'POST' && p === '/api/admin/payroll/remove') { const s = find(db.payroll, b.id); if (s.status !== 'draft') err(409, 'Fiche déjà payée'); commit(() => { db.payroll = db.payroll.filter(x => x !== s); }); return done({ ok: true }); }
  if (m === 'POST' && p === '/api/admin/payroll/pay') {
    const s = find(db.payroll, b.id); if (s.status !== 'draft') err(409, 'Fiche déjà payée');
    if (!day(b.date) || !db.accounts.some(a => a.id === b.account) || !str(b.reference ?? '', 0, 120)) err(400, 'Paiement invalide');
    commit(() => {
      Object.assign(s, { status: 'paid', paid_at: b.date, account: b.account, reference: (b.reference || '').trim() });
      for (const a of db.advances.filter(a => a.employee_id === s.employee_id && !a.settled_in)) a.settled_in = s.id;
      if (s.net > 0) db.entries.push({ id: id(), date: b.date, type: 'expense', category: 'Salaires et primes', amount: s.net, account: b.account, label: `Salaire ${s.period} — ${s.name}`, ref: 'payslip:' + s.id, auto: true, created_at: now() });
    });
    return done(s);
  }

  /* --- Comptabilité --- */
  if (m === 'GET' && p === '/api/admin/accounting') {
    const q = new URL(req.url, 'http://x').searchParams, from = day(q.get('from')) ? q.get('from') : today().slice(0, 8) + '01', to = day(q.get('to')) ? q.get('to') : today();
    return done({ ...report(db, from, to), entries: db.entries.filter(e => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), income_categories: INCOME_CATEGORIES, expense_categories: EXPENSE_CATEGORIES });
  }
  if (m === 'GET' && p === '/api/admin/accounting/export') {
    const q = new URL(req.url, 'http://x').searchParams, from = day(q.get('from')) ? q.get('from') : '0000-01-01', to = day(q.get('to')) ? q.get('to') : '9999-12-31';
    const name = Object.fromEntries(db.accounts.map(a => [a.id, a.name])), type = { income: 'Recette', expense: 'Dépense', transfer: 'Virement' };
    const rows = [['Date', 'Type', 'Catégorie', 'Libellé', 'Compte', 'Vers le compte', 'Montant HTG', 'Référence', 'Automatique']]
      .concat(db.entries.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, type[e.type], e.category || '', e.label, name[e.account] || e.account, e.to_account ? name[e.to_account] : '', e.type === 'expense' ? -e.amount : e.amount, e.ref || '', e.auto ? 'oui' : 'non']));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="journal-magic-moments-${from}-${to}.csv"`, 'Cache-Control': 'no-store' });
    res.end('﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')); return HANDLED;
  }
  if (m === 'POST' && p === '/api/admin/entries') {
    const cats = b.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!['income', 'expense', 'transfer'].includes(b.type) || !day(b.date) || !amountOk(b.amount) || !db.accounts.some(a => a.id === b.account) || !str(b.label, 2, 200) || (b.type !== 'transfer' && !cats.includes(b.category)) || (b.type === 'transfer' && (!db.accounts.some(a => a.id === b.to_account) || b.to_account === b.account)) || (b.attachment && !db.files.some(f => f.id === b.attachment))) err(400, 'Écriture invalide : date, montant, compte, catégorie et libellé requis');
    const old = b.id ? find(db.entries, b.id) : null;
    const e = { id: old?.id || id(), date: b.date, type: b.type, category: b.type === 'transfer' ? '' : b.category, amount: b.amount, account: b.account, to_account: b.type === 'transfer' ? b.to_account : '', label: b.label.trim(), attachment: b.attachment || '', ref: old?.ref || '', auto: old?.auto || false, created_at: old?.created_at || now(), updated_by: u.name };
    commit(() => { if (old) Object.assign(old, e); else db.entries.push(e); }); return done(e);
  }
  if (m === 'POST' && p === '/api/admin/entries/remove') { const e = find(db.entries, b.id); if (e.ref?.startsWith('payslip:') || e.ref?.startsWith('advance:')) err(409, 'Écriture liée à la paie : modifiez-la plutôt que de la supprimer'); commit(() => { db.entries = db.entries.filter(x => x !== e); }); return done({ ok: true }); }
  if (m === 'POST' && p === '/api/admin/accounts') {
    if (!str(b.name, 2, 60) || !Number.isInteger(b.opening) || Math.abs(b.opening) > 1e9) err(400, 'Compte invalide');
    const old = b.id ? find(db.accounts, b.id) : null, a = { id: old?.id || id(), name: b.name.trim(), opening: b.opening };
    commit(() => { if (old) Object.assign(old, a); else db.accounts.push(a); }); return done(a);
  }
  return null;
}

/* ============================================================
   Visites et connexions (pays, ville, heure, appareil)
   - Visites : enregistrées seulement si le visiteur accepte les cookies.
   - Connexions aux comptes : toujours enregistrées (sécurité).
   La localisation vient de l'adresse IP (service ipwho.is, désactivable
   avec GEO_LOOKUP=off), sinon du fuseau horaire du navigateur.
   ============================================================ */
const TZ_COUNTRY = { 'America/Port-au-Prince': 'Haïti', 'America/New_York': 'États-Unis', 'America/Chicago': 'États-Unis', 'America/Denver': 'États-Unis', 'America/Los_Angeles': 'États-Unis', 'America/Phoenix': 'États-Unis', 'America/Detroit': 'États-Unis', 'America/Indiana/Indianapolis': 'États-Unis', 'America/Toronto': 'Canada', 'America/Montreal': 'Canada', 'America/Vancouver': 'Canada', 'America/Edmonton': 'Canada', 'America/Halifax': 'Canada', 'America/Winnipeg': 'Canada', 'Europe/Paris': 'France', 'Europe/Brussels': 'Belgique', 'Europe/Zurich': 'Suisse', 'Europe/London': 'Royaume-Uni', 'Europe/Madrid': 'Espagne', 'America/Santo_Domingo': 'République dominicaine', 'America/Sao_Paulo': 'Brésil', 'America/Santiago': 'Chili', 'America/Mexico_City': 'Mexique', 'America/Cayenne': 'Guyane', 'America/Guadeloupe': 'Guadeloupe', 'America/Martinique': 'Martinique', 'America/Nassau': 'Bahamas', 'America/Panama': 'Panama', 'America/Havana': 'Cuba', 'America/Puerto_Rico': 'Porto Rico', 'America/Jamaica': 'Jamaïque' };
const geoCache = new Map();
const isPrivateIp = ip => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/i.test(ip);
const maskIp = ip => !ip ? '' : ip.includes('.') ? ip.replace(/\.\d+$/, '.0') : ip.split(':').slice(0, 3).join(':') + '::';
async function geoLookup(ip) {
  if (process.env.GEO_LOOKUP === 'off' || isPrivateIp(ip)) return null;
  const c = geoCache.get(ip); if (c && c.t > Date.now() - 864e5) return c.v;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,region,city&lang=fr`, { signal: AbortSignal.timeout(4000) });
    const j = await r.json(); const v = j.success ? { country: j.country || '', region: j.region || '', city: j.city || '' } : null;
    if (geoCache.size > 5000) geoCache.clear(); geoCache.set(ip, { t: Date.now(), v }); return v;
  } catch { return null; }
}
export function parseUA(ua = '') {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Autre';
  const browser = /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /Edg\//i.test(ua) ? 'Edge' : /FBAN|FBAV|Instagram|WhatsApp/i.test(ua) ? 'Application (Facebook, WhatsApp…)' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Autre';
  const device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablette' : /Mobi|iPhone|Android/i.test(ua) ? 'Téléphone' : /bot|crawl|spider|preview/i.test(ua) ? 'Robot' : 'Ordinateur';
  const model = (/Android [\d.]+; ([^;)]+)/i.exec(ua)?.[1] || (/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : '')).replace(/Build.*$/, '').trim().slice(0, 60);
  return { device, os, browser, model };
}
function locate(ctx, rec, ip) {
  geoLookup(ip).then(g => { if (!g) return; try { ctx.commit(() => { Object.assign(rec, { country: g.country || rec.country, region: g.region, city: g.city || rec.city, geo: 'ip' }); }); } catch {} });
}
function trim(db) {
  const limit = Date.now() - 180 * 864e5;
  if (db.visits.length > 20000 || (db.visits[0] && Date.parse(db.visits[0].at) < limit)) db.visits = db.visits.filter(v => Date.parse(v.last_at || v.at) >= limit).slice(-20000);
  if (db.logins.length > 10000) db.logins = db.logins.slice(-10000);
}
export function logLogin(ctx, req, u) {
  const db = ctx.db, ip = ctx.clientIp(req), ua = String(req.headers['user-agent'] || '').slice(0, 300);
  const rec = { id: ctx.id(), at: ctx.now(), user_id: u.id, name: u.name, email: u.email, role: u.role, ip, ...parseUA(ua), ua, country: '', city: '', geo: '' };
  db.logins ??= []; db.logins.push(rec); trim(db); locate(ctx, rec, ip);
}
export function migrateTraffic(db) {
  db.visits ??= []; db.logins ??= []; db.faq ??= null;
  if (db.faq === null) db.faq = DEFAULT_FAQ.map((f, i) => ({ id: randomUUID(), order: i, active: true, ...f }));
}

/* ---------- FAQ par défaut (modifiable dans l'administration) ---------- */
const DEFAULT_FAQ = [
  { category: 'Commandes', q: 'Comment commander une surprise ?', q_ht: 'Kijan pou m kòmande yon sipriz ?', a: 'Choisissez une surprise prête dans « Nos surprises » ou composez la vôtre dans « Créer une surprise », puis indiquez vos coordonnées, celles de la personne à surprendre et la date de livraison. Notre équipe vous recontacte pour confirmer.', a_ht: 'Chwazi yon sipriz ki pare nan « Sipriz nou yo » oswa konpoze pa w nan « Kreye yon sipriz », epi mete enfòmasyon ou, enfòmasyon moun w ap fè sipriz la ak dat livrezon an. Ekip nou an ap kontakte w pou konfime.' },
  { category: 'Commandes', q: 'Dois-je créer un compte pour commander ?', q_ht: 'Èske m bezwen kreye yon kont pou m kòmande ?', a: 'Non. Aucun compte n’est nécessaire : surprises, boutique, cadeau express, location et décoration se commandent sans compte. Suivez vos demandes, vos paiements et vos reçus dans « Suivre ma commande », avec la référence et votre téléphone, ou avec un code reçu par courriel.', a_ht: 'Non. Ou pa bezwen kont : sipriz, boutik, kado eksprès, lokasyon ak dekorasyon, ou ka kòmande yo san kont. Swiv demann, peman ak resi ou yo nan « Swiv kòmand mwen », ak referans lan ak telefòn ou, oswa ak yon kòd ou resevwa pa imèl.' },
  { category: 'Commandes', q: 'Combien de temps à l’avance dois-je commander ?', q_ht: 'Konbyen tan davans pou m kòmande ?', a: 'Le délai est indiqué sur chaque surprise. Plus vous commandez tôt, plus nous pouvons respecter vos choix (couleurs, saveurs, décoration), surtout pendant les fêtes.', a_ht: 'Delè a ekri sou chak sipriz. Plis ou kòmande bonè, plis nou ka respekte chwa ou (koulè, gou, dekorasyon), sitou nan peryòd fèt yo.' },
  { category: 'Paiement', q: 'Quand et comment dois-je payer ?', q_ht: 'Kilè e kijan pou m peye ?', a: 'Aucun paiement n’est demandé à l’envoi de la demande. Une fois la commande confirmée par notre équipe, vous recevez un lien de paiement sécurisé PlopPlop (MonCash, NatCash ou Kashpaw).', a_ht: 'Nou pa mande w peye lè w voye demann lan. Lè ekip nou an fin konfime kòmand lan, ou resevwa yon lyen peman sekirize PlopPlop (MonCash, NatCash oswa Kashpaw).' },
  { category: 'Paiement', q: 'Le montant affiché est-il définitif ?', q_ht: 'Èske montan ki parèt la se montan final la ?', a: 'Le montant affiché est une estimation. Notre équipe confirme le montant final avant tout paiement, selon la disponibilité et vos demandes particulières.', a_ht: 'Montan ki parèt la se yon estimasyon. Ekip nou an konfime montan final la anvan ou peye anyen, selon disponiblite ak demann espesyal ou yo.' },
  { category: 'Diaspora', q: 'Je vis à l’étranger : puis-je faire une surprise à un proche en Haïti ?', q_ht: 'Mwen rete aletranje : èske m ka fè yon moun ann Ayiti sipriz ?', a: 'Oui. Commandez depuis le site, payez en ligne une fois la commande confirmée, et recevez photos et vidéo de la remise. Avec Magic Live, vous pouvez même suivre la surprise en direct.', a_ht: 'Wi. Kòmande sou sit la, peye sou entènèt lè kòmand lan fin konfime, epi resevwa foto ak videyo moman an. Avèk Magic Live, ou ka menm swiv sipriz la an dirèk.' },
  { category: 'Livraison', q: 'Dans quelles villes livrez-vous ?', q_ht: 'Nan ki vil nou livre ?', a: 'La zone desservie est indiquée dans la section Contact. Pour une autre ville, écrivez-nous sur WhatsApp : nous vous dirons si c’est possible et à quelles conditions.', a_ht: 'Zòn nou sèvi a ekri nan seksyon Kontak la. Pou yon lòt vil, ekri nou sou WhatsApp : n ap di w si sa posib ak nan ki kondisyon.' },
  { category: 'Location', q: 'Puis-je louer plusieurs matériels dans une même demande ?', q_ht: 'Èske m ka lwe plizyè materyèl nan yon sèl demann ?', a: 'Oui. Ajoutez chaque matériel avec sa quantité, choisissez les dates : l’estimation se calcule automatiquement. L’équipe vérifie les disponibilités et vous confirme.', a_ht: 'Wi. Ajoute chak materyèl ak kantite li, chwazi dat yo : estimasyon an kalkile otomatikman. Ekip la verifye disponiblite yo epi l konfime w.' },
  { category: 'Magic Live', q: 'Qu’est-ce que Magic Live ?', q_ht: 'Kisa Magic Live ye ?', a: 'Un direct vidéo privé de la surprise. Cochez l’option lors de la commande ; une fois confirmé, le lien apparaît dans votre espace client.', a_ht: 'Se yon dirèk videyo prive sipriz la. Make opsyon an lè w ap kòmande ; lè sa konfime, lyen an ap parèt nan espas kliyan ou.' },
  { category: 'Compte et confidentialité', q: 'Quels cookies utilisez-vous ?', q_ht: 'Ki bonbon (cookies) nou itilize ?', a: 'Un cookie nécessaire garde votre session ouverte. Si vous l’acceptez, un cookie de mesure d’audience nous permet de connaître le pays, la ville approximative (à partir de l’adresse IP), l’heure et le type d’appareil des visites, pour améliorer le site. Vous pouvez changer votre choix à tout moment avec le lien « Cookies » en bas de page.', a_ht: 'Yon bonbon nesesè kenbe sesyon ou louvri. Si w aksepte l, yon bonbon pou mezire odyans pèmèt nou konnen peyi, vil apeprè (selon adrès IP a), lè ak kalite aparèy vizit yo, pou nou amelyore sit la. Ou ka chanje chwa ou nenpòt lè ak lyen « Bonbon » anba paj la.' },
  { category: 'Compte et confidentialité', q: 'J’ai oublié mon mot de passe.', q_ht: 'Mwen bliye modpas mwen.', a: 'Cliquez sur « Se connecter », puis « Mot de passe oublié ? ». Vous recevez par courriel un lien valable une heure pour en choisir un nouveau.', a_ht: 'Klike sou « Konekte », epi « Ou bliye modpas ou ? ». W ap resevwa yon lyen pa imèl ki bon pou inèdtan pou w chwazi yon nouvo.' }
];

export async function trafficPublic(ctx, { m, p, b, req, u, json }) {
  if (m === 'GET' && p === '/api/faq') return json(ctx.db.faq.filter(f => f.active).sort((a, b) => a.order - b.order).map(({ id, category, q, q_ht, a, a_ht }) => ({ id, category, q, q_ht, a, a_ht }))), HANDLED;
  if (m === 'POST' && p === '/api/visit') {
    // Uniquement avec consentement ; un visiteur = un identifiant aléatoire (cookie mm_vid).
    const vid = /mm_vid=([a-f0-9-]{36})/.exec(req.headers.cookie || '')?.[1];
    if (!/mm_consent=yes/.test(req.headers.cookie || '') || !vid) return json({ ok: false }), HANDLED;
    const db = ctx.db, at = ctx.now(), page = String(b.page || '/').slice(0, 120), tz = String(b.tz || '').slice(0, 60);
    const last = [...db.visits].reverse().find(v => v.vid === vid);
    if (last && Date.now() - Date.parse(last.last_at || last.at) < 30 * 60000) { ctx.commit(() => { last.last_at = at; last.pages = (last.pages || 1) + 1; if (u && !last.user_name) last.user_name = u.name; }); return json({ ok: true }), HANDLED; }
    const ip = ctx.clientIp(req), ua = String(req.headers['user-agent'] || '').slice(0, 300), info = parseUA(ua);
    if (info.device === 'Robot') return json({ ok: false }), HANDLED;
    const rec = { id: ctx.id(), vid, at, last_at: at, pages: 1, page, ref: String(b.ref || '').replace(/^https?:\/\//, '').slice(0, 120), lang: b.lang === 'ht' ? 'ht' : 'fr', tz, ip: maskIp(ip), ...info, country: TZ_COUNTRY[tz] || '', city: tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : '', geo: TZ_COUNTRY[tz] ? 'fuseau' : '', screen: String(b.screen || '').slice(0, 20), user_name: u?.name || '', returning: db.visits.some(v => v.vid === vid) };
    ctx.commit(() => { db.visits.push(rec); trim(db); }); locate(ctx, rec, ip);
    return json({ ok: true }), HANDLED;
  }
  return null;
}

const count = (list, key) => Object.entries(list.reduce((a, x) => { const k = (typeof key === 'function' ? key(x) : x[key]) || 'Inconnu'; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
export async function trafficAdmin(ctx, { m, p, b, req, res, json }) {
  const db = ctx.db, { err, str, find, commit, id } = ctx;
  if (m === 'GET' && (p === '/api/admin/traffic' || p === '/api/admin/traffic/export')) {
    const q = new URL(req.url, 'http://x').searchParams, from = day(q.get('from')) ? q.get('from') : new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to = day(q.get('to')) ? q.get('to') : today();
    const inR = x => x.at.slice(0, 10) >= from && x.at.slice(0, 10) <= to, visits = db.visits.filter(inR), logins = db.logins.filter(inR);
    if (p.endsWith('/export')) {
      const kind = q.get('kind') === 'logins' ? 'logins' : 'visits';
      const rows = kind === 'logins' ? [['Date et heure (UTC)', 'Nom', 'Courriel', 'Rôle', 'Pays', 'Ville', 'Appareil', 'Modèle', 'Système', 'Navigateur', 'Adresse IP']].concat(logins.map(l => [l.at, l.name, l.email, l.role, l.country, l.city, l.device, l.model, l.os, l.browser, l.ip]))
        : [['Date et heure (UTC)', 'Dernière activité', 'Pages', 'Pays', 'Région', 'Ville', 'Source localisation', 'Appareil', 'Modèle', 'Système', 'Navigateur', 'Langue', 'Provenance', 'Visiteur connu', 'Client connecté', 'IP (anonymisée)']].concat(visits.map(v => [v.at, v.last_at, v.pages, v.country, v.region, v.city, v.geo, v.device, v.model, v.os, v.browser, v.lang, v.ref, v.returning ? 'oui' : 'non', v.user_name, v.ip]));
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-magic-moments-${from}-${to}.csv"`, 'Cache-Control': 'no-store' });
      res.end('﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')); return HANDLED;
    }
    const byDay = {}; for (const v of visits) { const k = v.at.slice(0, 10); byDay[k] = (byDay[k] || 0) + 1; }
    return json({ from, to, total: visits.length, unique: new Set(visits.map(v => v.vid)).size, pages: visits.reduce((a, v) => a + (v.pages || 1), 0), logins_total: logins.length,
      countries: count(visits, 'country'), cities: count(visits, v => [v.city, v.country].filter(Boolean).join(', ')), devices: count(visits, 'device'), os: count(visits, 'os'), browsers: count(visits, 'browser'), sources: count(visits, v => v.ref || 'Accès direct'),
      days: Object.entries(byDay).sort(), visits: visits.slice(-300).reverse(), logins: logins.slice(-300).reverse() }), HANDLED;
  }
  if (m === 'GET' && p === '/api/admin/faq') return json(db.faq.slice().sort((a, b) => a.order - b.order)), HANDLED;
  if (m === 'POST' && p === '/api/admin/faq') {
    if (!str(b.q, 5, 240) || !str(b.a, 5, 3000) || !str(b.q_ht ?? '', 0, 240) || !str(b.a_ht ?? '', 0, 3000) || !str(b.category, 2, 60) || !Number.isInteger(b.order ?? 0)) err(400, 'Question invalide : question, réponse et rubrique requises');
    const old = b.id ? find(db.faq, b.id) : null, f = { id: old?.id || id(), category: b.category.trim(), q: b.q.trim(), q_ht: (b.q_ht || '').trim(), a: b.a.trim(), a_ht: (b.a_ht || '').trim(), order: b.order ?? (db.faq.length), active: b.active !== false };
    commit(() => { if (old) Object.assign(old, f); else db.faq.push(f); }); return json(f), HANDLED;
  }
  if (m === 'POST' && p === '/api/admin/faq/remove') { const f = find(db.faq, b.id); commit(() => { db.faq = db.faq.filter(x => x !== f); }); return json({ ok: true }), HANDLED; }
  return null;
}
