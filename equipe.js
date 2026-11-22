/* ==========================================================
   Magic Moments — Espace employé (V22)
   ----------------------------------------------------------
   Chaque employé peut avoir un compte (rôle « staff ») relié
   à sa fiche du personnel. Depuis /equipe, il voit :
   - ses tâches (avec la commande ou la location liée),
   - son pointage (arrivée / départ) et ses heures travaillées,
   - ses fiches de paie et ses avances,
   - son profil, et peut changer son mot de passe.
   L'administration invite l'employé par courriel, assigne les
   tâches, contrôle et valide les heures (Ressources humaines).
   Les jours validés servent au calcul de la paie journalière.
   ========================================================== */
import { randomBytes } from 'node:crypto';

const TZ = 'America/Port-au-Prince';
const hday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const hm = d => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
export const PRIORITIES = { low: 'Basse', normal: 'Normale', high: 'Urgente' };
export const TASK_STATUS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminée', cancelled: 'Annulée' };
const okDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const okHM = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
const minutesOf = t => t.end ? Math.max(0, Math.round((Date.parse(t.end) - Date.parse(t.start)) / 60000) - (t.break_minutes || 0)) : 0;

export function migrate(db) { db.tasks ??= []; db.timeEntries ??= []; }

/** Jours travaillés validés d'un employé sur une période AAAA-MM (pour la paie journalière). */
export const approvedDays = (db, empId, period) => new Set(db.timeEntries.filter(t => t.employee_id === empId && t.status === 'approved' && t.date.startsWith(period) && t.end).map(t => t.date)).size;

const empView = e => ({ id: e.id, name: e.name, role: e.role, department: e.department, phone: e.phone, email: e.email, hire_date: e.hire_date, contract: e.contract, pay_type: e.pay_type, salary: e.salary, pay_method: e.pay_method, status: e.status });
function linked(db, t) {
  if (t.order_id) { const o = db.orders.find(x => x.id === t.order_id); if (o) return { kind: 'order', ref: 'MM-' + o.id.slice(0, 8).toUpperCase(), title: o.package_name, recipient: o.recipient, city: o.city, address: o.address, date: o.event_at, phone: o.contact?.recipient_phone || '', client: o.contact?.sender_name || '', client_phone: o.contact?.sender_phone || '', message: o.message || '', items: (o.options || []).map(x => x.name + (x.quantity > 1 ? ' × ' + x.quantity : '')) }; }
  if (t.rental_id) { const r = db.rentals.find(x => x.id === t.rental_id); if (r) return { kind: 'rental', ref: 'LOC-' + r.id.slice(0, 8).toUpperCase(), title: r.equipment_name, city: r.city, address: r.address, date: r.start_at, end: r.end_at, client: r.contact?.name || '', client_phone: r.contact?.phone || r.phone || '', items: (r.items || []).map(x => x.name + ' × ' + x.quantity) }; }
  return null;
}
const taskView = (db, t) => ({ ...t, link: linked(db, t), assignees: t.employee_ids.map(id => db.employees.find(e => e.id === id)?.name || '—') });

/* H : aides du serveur — hash(pw), verify(pw, h), digest(t), queueMail(to, subject, text, meta), publicUrl(), alertAdmin(subject, lines, meta). */
export function routes(ctx, { m, p, b, u, req, json }, H) {
  const { db } = ctx;
  /* ---------------- Côté employé ---------------- */
  if (p.startsWith('/api/staff/')) {
    if (!u || u.role !== 'staff' || u.disabled) ctx.err(403, 'Espace réservé au personnel');
    const emp = db.employees.find(e => e.id === u.employee_id); if (!emp) ctx.err(403, 'Fiche du personnel introuvable : contactez l’administration.');
    const mine = () => db.timeEntries.filter(t => t.employee_id === emp.id);
    const open = () => mine().find(t => !t.end);
    if (m === 'GET' && p === '/api/staff/me') {
      const today = hday(), todays = mine().filter(t => t.date === today);
      const tasks = db.tasks.filter(t => t.employee_ids.includes(emp.id) && ['todo', 'in_progress'].includes(t.status));
      return json({ user: { name: u.name, email: u.email }, employee: empView(emp), open: open() || null, today, today_minutes: todays.reduce((a, t) => a + minutesOf(t), 0),
        tasks_open: tasks.length, tasks_today: tasks.filter(t => t.due_at && hday(new Date(t.due_at)) <= today).length }), true;
    }
    if (m === 'GET' && p === '/api/staff/tasks') return json(db.tasks.filter(t => t.employee_ids.includes(emp.id) && t.status !== 'cancelled').sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.due_at || '9').localeCompare(String(b.due_at || '9'))).slice(0, 200).map(t => taskView(db, t))), true;
    if (m === 'POST' && p === '/api/staff/tasks/update') {
      const t = ctx.find(db.tasks, String(b.id || '')); if (!t.employee_ids.includes(emp.id)) ctx.err(403, 'Tâche non assignée');
      if (!['todo', 'in_progress', 'done'].includes(b.status) || !ctx.str(b.note ?? '', 0, 500)) ctx.err(400, 'Mise à jour invalide');
      ctx.commit(() => { const prev = t.status; t.status = b.status; t.done_at = b.status === 'done' ? ctx.now() : null; if (b.note?.trim() || prev !== b.status) (t.comments ||= []).push({ by: emp.name, at: ctx.now(), status: b.status, note: (b.note || '').trim() });
        if (b.status === 'done' && prev !== 'done') H.alertAdmin('Tâche terminée — ' + t.title, [emp.name + ' a terminé la tâche « ' + t.title + ' ».', ...(b.note ? ['Note : ' + b.note.trim()] : [])], { task_id: t.id }); });
      return json(taskView(db, t)), true;
    }
    if (m === 'POST' && p === '/api/staff/clock') {
      ctx.throttle(req); if (!ctx.str(b.note ?? '', 0, 300)) ctx.err(400, 'Note trop longue');
      const o = open();
      if (b.action === 'in') { if (o) ctx.err(409, 'Vous êtes déjà pointé depuis ' + hm(o.start) + '.'); const t = { id: ctx.id(), employee_id: emp.id, date: hday(), start: ctx.now(), end: null, break_minutes: 0, source: 'clock', status: 'pending', note: (b.note || '').trim(), created_at: ctx.now() }; ctx.commit(() => db.timeEntries.push(t)); return json(t), true; }
      if (b.action === 'out') { if (!o) ctx.err(409, 'Aucune arrivée en cours.'); ctx.commit(() => { o.end = ctx.now(); if (b.note?.trim()) o.note = [o.note, b.note.trim()].filter(Boolean).join(' · '); o.minutes = minutesOf(o); }); return json(o), true; }
      ctx.err(400, 'Action inconnue');
    }
    if (m === 'GET' && p.startsWith('/api/staff/time')) {
      const month = new URL(req.url, 'http://x').searchParams.get('month') || hday().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) ctx.err(400, 'Mois invalide');
      const list = mine().filter(t => t.date.startsWith(month)).sort((a, b) => b.start.localeCompare(a.start)).map(t => ({ ...t, minutes: minutesOf(t) }));
      return json({ month, entries: list, total: list.reduce((a, t) => a + t.minutes, 0), approved: list.filter(t => t.status === 'approved').reduce((a, t) => a + t.minutes, 0), days: new Set(list.filter(t => t.end).map(t => t.date)).size }), true;
    }
    if (m === 'GET' && p === '/api/staff/pay') return json({ slips: db.payroll.filter(s => s.employee_id === emp.id).slice().reverse(), advances: db.advances.filter(a => a.employee_id === emp.id).slice().reverse(), salary: emp.salary, pay_type: emp.pay_type }), true;
    if (m === 'POST' && p === '/api/staff/password') {
      ctx.throttle(req); if (!H.verify(String(b.current || ''), u.password_hash)) ctx.err(401, 'Mot de passe actuel incorrect');
      if (!ctx.str(b.password || '', 8, 128)) ctx.err(400, 'Nouveau mot de passe : 8 caractères minimum');
      ctx.commit(() => { u.password_hash = H.hash(b.password); }); return json({ ok: true }), true;
    }
    ctx.err(404, 'Introuvable');
  }

  /* ---------------- Côté administration ---------------- */
  if (!p.startsWith('/api/admin/team') && !p.startsWith('/api/admin/tasks') && !p.startsWith('/api/admin/time')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  if (m === 'GET' && p === '/api/admin/team') {
    const since = new Date(Date.now() - 62 * 864e5).toISOString().slice(0, 10);
    return json({ employees: db.employees.map(e => { const a = db.users.find(x => x.role === 'staff' && x.employee_id === e.id); return { ...empView(e), account: a ? { email: a.email, disabled: !!a.disabled, last_login: a.last_login || null, invited_at: a.invited_at || null } : null, clocked_in: !!db.timeEntries.find(t => t.employee_id === e.id && !t.end) }; }),
      tasks: db.tasks.slice().reverse().slice(0, 400).map(t => taskView(db, t)), time: db.timeEntries.filter(t => t.date >= since).sort((a, b) => b.start.localeCompare(a.start)).map(t => ({ ...t, minutes: minutesOf(t), name: db.employees.find(e => e.id === t.employee_id)?.name || '—' })),
      orders: db.orders.filter(o => !['completed', 'cancelled'].includes(o.status)).map(o => ({ id: o.id, label: 'MM-' + o.id.slice(0, 8).toUpperCase() + ' · ' + o.package_name + ' — ' + o.recipient + ' (' + hday(new Date(o.event_at)) + ')' })),
      rentals: db.rentals.filter(r => !['completed', 'cancelled'].includes(r.status)).map(r => ({ id: r.id, label: 'LOC-' + r.id.slice(0, 8).toUpperCase() + ' · ' + r.equipment_name + ' (' + hday(new Date(r.start_at)) + ')' })), priorities: PRIORITIES, statuses: TASK_STATUS }), true;
  }
  if (m === 'POST' && p === '/api/admin/team/access') {
    const emp = ctx.find(db.employees, String(b.employee_id || '')), acc = db.users.find(x => x.role === 'staff' && x.employee_id === emp.id);
    if (b.action === 'disable' || b.action === 'enable') { if (!acc) ctx.err(404, 'Aucun compte'); ctx.commit(() => { acc.disabled = b.action === 'disable'; if (acc.disabled) db.sessions = db.sessions.filter(s => s.user !== acc.id); }); return json({ ok: true }), true; }
    const email = String(b.email || emp.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) ctx.err(400, 'Indiquez le courriel de l’employé');
    const other = db.users.find(x => x.email === email && x !== acc);
    if (other && (other.role !== 'customer' && other.role !== 'client' || other.employee_id)) ctx.err(409, 'Ce courriel est déjà utilisé par un autre compte.');
    const t = randomBytes(32).toString('hex');
    ctx.commit(() => {
      let user = acc;
      if (!user && other) { user = other; Object.assign(user, { role: 'staff', employee_id: emp.id }); }
      if (!user) { user = { id: ctx.id(), name: emp.name, email, role: 'staff', employee_id: emp.id, phone: emp.phone || '', password_hash: H.hash(randomBytes(24).toString('hex')), created_at: ctx.now() }; db.users.push(user); }
      user.email = email; user.disabled = false; user.invited_at = ctx.now(); if (!emp.email) emp.email = email;
      db.resets = (db.resets || []).filter(r => r.user !== user.id); db.resets.push({ token: H.digest(t), user: user.id, expires: Date.now() + 7 * 864e5 });
      H.queueMail(email, 'Votre espace employé Magic Moments', [`Bonjour ${emp.name},`, '', 'Votre espace employé Magic Moments est prêt : vous y verrez vos tâches, votre pointage, vos heures et vos fiches de paie.', '', 'Choisissez votre mot de passe avec ce lien (valable 7 jours) :', H.publicUrl() + '/equipe#activer=' + t, '', 'Ensuite, connectez-vous sur ' + H.publicUrl() + '/equipe avec ce courriel : ' + email, '', 'À bientôt,', 'L’équipe Magic Moments'].join('\n'), { kind: 'staff_invite' });
    });
    return json({ ok: true, link: H.publicUrl() + '/equipe#activer=' + t }), true;
  }
  if (m === 'POST' && p === '/api/admin/tasks') {
    const old = b.id ? ctx.find(db.tasks, b.id) : null, ids = Array.isArray(b.employee_ids) ? [...new Set(b.employee_ids)] : [];
    if (!ctx.str(b.title || '', 2, 160) || !ctx.str(b.description ?? '', 0, 2000) || !ids.length || ids.length > 30 || !ids.every(i => db.employees.some(e => e.id === i))) ctx.err(400, 'Titre et au moins un employé requis');
    if (!PRIORITIES[b.priority] || !TASK_STATUS[b.status || 'todo'] || (b.due_at && !Number.isFinite(Date.parse(b.due_at)))) ctx.err(400, 'Priorité, statut ou échéance invalide');
    if (b.order_id && !db.orders.some(o => o.id === b.order_id)) ctx.err(400, 'Commande introuvable');
    if (b.rental_id && !db.rentals.some(r => r.id === b.rental_id)) ctx.err(400, 'Location introuvable');
    const t = { id: old?.id || ctx.id(), title: b.title.trim(), description: (b.description || '').trim(), employee_ids: ids, priority: b.priority, status: b.status || 'todo', due_at: b.due_at ? new Date(b.due_at).toISOString() : null,
      order_id: b.order_id || null, rental_id: b.rental_id || null, comments: old?.comments || [], created_by: u.name || u.email, created_at: old?.created_at || ctx.now(), done_at: (b.status === 'done' ? old?.done_at || ctx.now() : null) };
    const fresh = ids.filter(i => !old?.employee_ids.includes(i));
    ctx.commit(() => {
      if (old) Object.assign(old, t); else db.tasks.push(t);
      for (const i of fresh) { const e = db.employees.find(x => x.id === i), acc = db.users.find(x => x.role === 'staff' && x.employee_id === i && !x.disabled); if (acc) H.queueMail(acc.email, (t.priority === 'high' ? '⚠️ Tâche urgente : ' : 'Nouvelle tâche : ') + t.title, [`Bonjour ${e.name},`, '', 'Une tâche vous a été confiée :', '• ' + t.title, ...(t.due_at ? ['Échéance : ' + new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date(t.due_at))] : []), ...(t.description ? ['', t.description] : []), '', 'Détails dans votre espace : ' + H.publicUrl() + '/equipe'].join('\n'), { kind: 'task' }); }
    });
    return json(taskView(db, t)), true;
  }
  if (m === 'POST' && p === '/api/admin/tasks/remove') { const t = ctx.find(db.tasks, String(b.id || '')); ctx.commit(() => { db.tasks = db.tasks.filter(x => x !== t); }); return json({ ok: true }), true; }
  if (m === 'POST' && p === '/api/admin/time') {
    const old = b.id ? ctx.find(db.timeEntries, b.id) : null, emp = ctx.find(db.employees, String(b.employee_id || ''));
    if (!okDay(b.date) || !okHM(b.start) || (b.end && !okHM(b.end)) || !ctx.str(b.note ?? '', 0, 300) || !['pending', 'approved', 'rejected'].includes(b.status || 'approved')) ctx.err(400, 'Date ou heures invalides');
    const br = Number(b.break_minutes || 0); if (!Number.isInteger(br) || br < 0 || br > 600) ctx.err(400, 'Pause invalide');
    const off = new Intl.DateTimeFormat('en', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(new Date(b.date + 'T12:00:00Z')).find(x => x.type === 'timeZoneName').value.replace('GMT', '') || '-5';
    const z = (/^[+-]\d+$/.test(off) ? (off[0] + String(Math.abs(off)).padStart(2, '0') + ':00') : '-05:00');
    const start = new Date(`${b.date}T${b.start}:00${z}`).toISOString(), end = b.end ? new Date(`${b.date}T${b.end}:00${z}`).toISOString() : null;
    if (end && end <= start) ctx.err(400, 'L’heure de fin doit suivre l’heure de début');
    const t = { id: old?.id || ctx.id(), employee_id: emp.id, date: b.date, start, end, break_minutes: br, source: old?.source === 'clock' ? 'clock (corrigé)' : 'manual', status: b.status || 'approved', note: (b.note || '').trim(), created_at: old?.created_at || ctx.now(), edited_by: u.name || u.email };
    ctx.commit(() => { if (old) Object.assign(old, t); else db.timeEntries.push(t); });
    return json({ ...t, minutes: minutesOf(t) }), true;
  }
  if (m === 'POST' && p === '/api/admin/time/status') {
    const ids = Array.isArray(b.ids) ? b.ids : []; if (!['approved', 'rejected', 'pending'].includes(b.status) || !ids.length) ctx.err(400, 'Sélection invalide');
    ctx.commit(() => { for (const t of db.timeEntries) if (ids.includes(t.id) && t.end) t.status = b.status; });
    return json({ ok: true }), true;
  }
  if (m === 'POST' && p === '/api/admin/time/remove') { const t = ctx.find(db.timeEntries, String(b.id || '')); ctx.commit(() => { db.timeEntries = db.timeEntries.filter(x => x !== t); }); return json({ ok: true }), true; }
  return false;
}
