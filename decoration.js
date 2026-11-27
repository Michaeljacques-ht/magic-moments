/* ==========================================================
   Magic Moments — Décoration événement (V26)
   ----------------------------------------------------------
   Vente de services de décoration pour tout événement :
   anniversaire, mariage, baby shower, baptême, graduation,
   fête d'entreprise, fête religieuse…
   - Formules de décoration (photo, galerie, inclus, invités,
     prix de départ, type d'événement) ;
   - Options à la carte (arche de ballons, photobooth, centres
     de table, éclairage…) au forfait ou à l'unité ;
   - Demande de devis / réservation : la demande devient une
     commande « Décoration » (prix estimé, l'équipe confirme le
     montant final, acompte puis solde, étapes, courriels,
     WhatsApp, tâches pour l'équipe, suivi sans compte).
   ========================================================== */
import { randomBytes } from 'node:crypto';

export const EVENT_TYPES = ['Anniversaire', 'Mariage', 'Baby shower', 'Baptême', 'Première communion', 'Graduation', 'Fiançailles', 'Fête d’entreprise', 'Fête religieuse', 'Gender reveal', 'Fête des mères / pères', 'Autre événement'];
export const EVENT_TYPES_HT = { 'Anniversaire': 'Anivèsè', 'Mariage': 'Maryaj', 'Baby shower': 'Baby shower', 'Baptême': 'Batèm', 'Première communion': 'Premye kominyon', 'Graduation': 'Gradyasyon', 'Fiançailles': 'Fiyansay', 'Fête d’entreprise': 'Fèt antrepriz', 'Fête religieuse': 'Fèt relijye', 'Gender reveal': 'Gender reveal', 'Fête des mères / pères': 'Fèt manman / papa', 'Autre événement': 'Lòt evènman' };
export const VENUES = { home: 'À domicile', hall: 'Salle de réception', outdoor: 'Extérieur / jardin', church: 'Église', hotel: 'Hôtel / restaurant', office: 'Entreprise / bureau' };
const F = (name, name_ht, event_type, price_htg, guests, description, description_ht, includes, includes_ht, featured = false) => ({ name, name_ht, event_type, price_htg, guests, description, description_ht, includes, includes_ht, featured });
const SEED = [
  F('Anniversaire Essentiel', 'Anivèsè Esansyèl', 'Anniversaire', 15000, 'Jusqu’à 30 invités', 'Une décoration colorée et chaleureuse pour fêter un anniversaire à la maison ou en salle.', 'Yon bèl dekorasyon koulè pou fete anivèsè lakay oswa nan sal.',
    ['Arche de ballons', 'Fond de scène « Joyeux anniversaire »', 'Décoration de la table du gâteau', 'Montage et démontage'], ['Ach balon', 'Fon sèn « Bòn fèt »', 'Dekorasyon tab gato a', 'Monte ak demonte'], true),
  F('Mariage Élégance', 'Maryaj Elegans', 'Mariage', 85000, '80 à 150 invités', 'Une décoration raffinée pour la cérémonie et la réception : fleurs, drapés et éclairage.', 'Yon dekorasyon rafine pou seremoni ak resepsyon : flè, twal ak limyè.',
    ['Table d’honneur fleurie', 'Arche de cérémonie', 'Centres de table (15 tables)', 'Chemin d’allée', 'Drapés et éclairage d’ambiance', 'Coordination le jour J'], ['Tab donè ak flè', 'Ach seremoni', 'Sant tab (15 tab)', 'Chemen ale', 'Twal ak limyè anbyans', 'Kowòdinasyon jou a'], true),
  F('Baby shower Douceur', 'Baby shower Dousè', 'Baby shower', 25000, 'Jusqu’à 40 invités', 'Pastels, ballons et coin photo pour accueillir bébé en beauté.', 'Koulè pastèl, balon ak kwen foto pou akeyi bebe a.',
    ['Arche de ballons pastel', 'Coin photo personnalisé', 'Table des douceurs décorée', 'Décoration des tables invités'], ['Ach balon pastèl', 'Kwen foto pèsonalize', 'Tab dous dekore', 'Dekorasyon tab envite yo']),
  F('Baptême & communion', 'Batèm ak kominyon', 'Baptême', 22000, 'Jusqu’à 50 invités', 'Une décoration lumineuse et sobre pour les fêtes religieuses en famille.', 'Yon dekorasyon klere e senp pou fèt relijye an fanmi.',
    ['Fond de scène blanc et or', 'Table d’honneur', 'Centres de table fleuris', 'Montage et démontage'], ['Fon sèn blan ak lò', 'Tab donè', 'Sant tab ak flè', 'Monte ak demonte']),
  F('Graduation Prestige', 'Gradyasyon Prestij', 'Graduation', 20000, 'Jusqu’à 50 invités', 'Toques, ballons et couleurs de l’école pour célébrer la réussite.', 'Kas, balon ak koulè lekòl la pou fete siksè a.',
    ['Arche de ballons aux couleurs choisies', 'Panneau photo « Félicitations »', 'Décoration de table', 'Accessoires photo'], ['Ach balon ak koulè ou chwazi', 'Panno foto « Konpliman »', 'Dekorasyon tab', 'Akseswa foto']),
  F('Événement d’entreprise', 'Evènman antrepriz', 'Fête d’entreprise', 45000, '50 à 200 personnes', 'Lancement, gala ou fête de fin d’année : décoration aux couleurs de votre marque.', 'Lansman, gala oswa fèt fen ane : dekorasyon ak koulè mak ou.',
    ['Scène et fond aux couleurs de la marque', 'Accueil et signalétique', 'Centres de table', 'Éclairage d’ambiance'], ['Sèn ak fon ak koulè mak la', 'Akèy ak siyalizasyon', 'Sant tab', 'Limyè anbyans'])
];
const O = (name, name_ht, price_htg, unit, unit_ht) => ({ name, name_ht, price_htg, unit, unit_ht });
const SEED_OPTIONS = [
  O('Arche de ballons supplémentaire', 'Lòt ach balon', 5000, 'forfait', 'fòfè'), O('Coin photo / photobooth', 'Kwen foto / photobooth', 8000, 'forfait', 'fòfè'),
  O('Centre de table fleuri', 'Sant tab ak flè', 1500, 'par table', 'pa tab'), O('Nappes et housses de chaise', 'Nap ak kouvèti chèz', 250, 'par chaise', 'pa chèz'),
  O('Éclairage d’ambiance (LED)', 'Limyè anbyans (LED)', 6000, 'forfait', 'fòfè'), O('Tapis rouge et poteaux', 'Tapi wouj ak poto', 4000, 'forfait', 'fòfè'),
  O('Lettres géantes lumineuses', 'Gwo lèt limyè', 7000, 'forfait', 'fòfè'), O('Bouquet de mariée / fleurs fraîches', 'Bouke maryaj / flè fre', 6500, 'forfait', 'fòfè')
];

export function migrate(db, id, now) {
  if (!db.decorFormulas) db.decorFormulas = SEED.map((x, i) => ({ id: id(), ...x, photo: '', photos: [], active: true, order: i, created_at: now() }));
  if (!db.decorOptions) db.decorOptions = SEED_OPTIONS.map((x, i) => ({ id: id(), ...x, active: true, order: i, created_at: now() }));
  db.settings.decor ??= { enabled: true, travel_note: 'Frais de déplacement hors zone métropolitaine calculés sur devis.', min_days: 3 };
}

const pubF = x => ({ id: x.id, name: x.name, name_ht: x.name_ht, event_type: x.event_type, event_type_ht: EVENT_TYPES_HT[x.event_type] || '', price_htg: x.price_htg, guests: x.guests, description: x.description, description_ht: x.description_ht, includes: x.includes, includes_ht: x.includes_ht, photo: x.photo, photos: x.photos, featured: !!x.featured });
const pubO = x => ({ id: x.id, name: x.name, name_ht: x.name_ht, price_htg: x.price_htg, unit: x.unit, unit_ht: x.unit_ht });
const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim()).filter(Boolean).slice(0, 20);
const hday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(d);

export function routes(ctx, { m, p, b, u, req, json }, hooks) {
  const { db } = ctx, S = db.settings.decor;
  if (m === 'GET' && p === '/api/decor') return json({ settings: { enabled: S.enabled, travel_note: S.travel_note, min_days: S.min_days, first_date: hday(new Date(Date.now() + S.min_days * 864e5)) }, event_types: EVENT_TYPES.map(n => ({ name: n, name_ht: EVENT_TYPES_HT[n] })), venues: VENUES,
    formulas: S.enabled ? db.decorFormulas.filter(x => x.active !== false).sort((a, b) => (b.featured - a.featured) || (a.order ?? 0) - (b.order ?? 0)).map(pubF) : [], options: S.enabled ? db.decorOptions.filter(x => x.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(pubO) : [] }), true;

  if (m === 'POST' && p === '/api/decor/request') {
    ctx.throttle(req);
    if (!S.enabled) ctx.err(409, 'La décoration événementielle n’est pas disponible pour le moment.');
    const f = b.formula_id ? db.decorFormulas.find(x => x.id === b.formula_id && x.active !== false) : null;
    if (b.formula_id && !f) ctx.err(409, 'Cette formule n’est plus disponible. Actualisez la page.');
    if (!EVENT_TYPES.includes(b.event_type)) ctx.err(400, 'Choisissez le type d’événement');
    if (!VENUES[b.venue]) ctx.err(400, 'Choisissez le lieu de l’événement');
    const guests = Number(b.guests); if (!Number.isInteger(guests) || guests < 1 || guests > 5000) ctx.err(400, 'Nombre d’invités invalide');
    const first = hday(new Date(Date.now() + S.min_days * 864e5));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || b.date < first || b.date > hday(new Date(Date.now() + 730 * 864e5))) ctx.err(400, `Choisissez une date à partir du ${first.split('-').reverse().join('/')} (préparation de ${S.min_days} jours minimum).`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time || '')) ctx.err(400, 'Indiquez l’heure de début');
    const tel = v => /^\+?[0-9 ()-]{7,25}$/.test(v || '') && String(v).replace(/\D/g, '').length >= 8;
    if (!ctx.str(b.name || '', 2, 120) || !tel(b.phone) || !/^\S+@\S+\.\S+$/.test(b.email || '') || b.email.length > 200) ctx.err(400, 'Indiquez votre nom, votre téléphone et votre courriel.');
    if (!ctx.str(b.city || '', 2, 120) || !ctx.str(b.address || '', 5, 500)) ctx.err(400, 'Indiquez la ville et l’adresse de l’événement.');
    for (const [k, mx] of [['theme', 300], ['colors', 200], ['notes', 2000], ['inspiration', 1000], ['celebrant', 120]]) if (!ctx.str(b[k] ?? '', 0, mx)) ctx.err(400, 'Texte trop long');
    const opts = [];
    for (const l of (Array.isArray(b.options) ? b.options.slice(0, 30) : [])) {
      const o = db.decorOptions.find(x => x.id === l?.id && x.active !== false), q = Number(l?.quantity);
      if (!o) ctx.err(409, 'Une option n’est plus disponible. Actualisez la page.'); if (!Number.isInteger(q) || q < 1 || q > 1000 || opts.some(x => x.option_id === o.id)) ctx.err(400, 'Quantité invalide');
      opts.push({ option_id: o.id, name: o.name + (o.unit !== 'forfait' ? ` (${o.unit})` : ''), name_ht: (o.name_ht || o.name) + (o.unit !== 'forfait' ? ` (${o.unit_ht || o.unit})` : ''), unit_price: o.price_htg, quantity: q, price: o.price_htg * q });
    }
    if (!f && !opts.length) ctx.err(400, 'Choisissez une formule ou au moins une option de décoration.');
    const base = f ? f.price_htg : 0, total = base + opts.reduce((a, x) => a + x.price, 0);
    const title = 'Décoration — ' + (f ? f.name : 'sur mesure'), titleHt = 'Dekorasyon — ' + (f ? (f.name_ht || f.name) : 'sou mezi');
    const o = { id: ctx.id(), user_id: u && u.role !== 'admin' ? u.id : null, guest: !u, decor: true, lang: b.lang === 'ht' ? 'ht' : 'fr', pay_token: randomBytes(16).toString('hex'),
      package_id: 'decor', package_name: title, package_name_ht: titleHt, occasion: b.event_type, recipient: (b.celebrant || '').trim() || b.name.trim(), message: '',
      city: b.city.trim(), address: b.address.trim(), event_at: new Date(`${b.date}T${b.time}:00-05:00`).toISOString(), quantity: 1, unit_price_htg: total, total_htg: total,
      options: [...(f ? [{ formula_id: f.id, name: 'Formule ' + f.name, name_ht: 'Fòmil ' + (f.name_ht || f.name), price: base, quantity: 1 }] : []), ...opts],
      decor_details: { event_type: b.event_type, venue: b.venue, venue_label: VENUES[b.venue], guests, time: b.time, theme: (b.theme || '').trim(), colors: (b.colors || '').trim(), inspiration: (b.inspiration || '').trim(), notes: (b.notes || '').trim(), celebrant: (b.celebrant || '').trim() },
      personalization: { theme: (b.theme || '').trim(), colors: (b.colors || '').trim(), notes: (b.notes || '').trim() },
      contact: { sender_name: b.name.trim(), sender_phone: b.phone.trim(), sender_email: b.email.trim().toLowerCase(), recipient_phone: '', department: b.city.trim() },
      live_requested: false, status: 'pending', payment_status: 'unpaid', live_url: null, created_at: ctx.now() };
    ctx.commit(() => { db.orders.push(o); hooks.created(o); });
    return json(o, 201), true;
  }

  if (!p.startsWith('/api/admin/decor')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  if (m === 'GET' && p === '/api/admin/decor') return json({ settings: S, event_types: EVENT_TYPES, formulas: db.decorFormulas.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), options: db.decorOptions.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }), true;
  if (m === 'POST' && p === '/api/admin/decor/settings') {
    const d = Number(b.min_days); if (!Number.isInteger(d) || d < 0 || d > 60 || !ctx.str(b.travel_note ?? '', 0, 300)) ctx.err(400, 'Réglages invalides');
    ctx.commit(() => { db.settings.decor = { enabled: !!b.enabled, min_days: d, travel_note: (b.travel_note || '').trim() }; }); return json(db.settings.decor), true;
  }
  if (m === 'POST' && p === '/api/admin/decor/formulas') {
    const old = b.id ? ctx.find(db.decorFormulas, b.id) : null;
    if (!ctx.str(b.name || '', 2, 120) || !ctx.str(b.name_ht ?? '', 0, 120) || !EVENT_TYPES.includes(b.event_type) || !ctx.str(b.guests ?? '', 0, 80) || !ctx.str(b.description ?? '', 0, 1000) || !ctx.str(b.description_ht ?? '', 0, 1000)) ctx.err(400, 'Nom, type d’événement et description valides requis');
    if (!Number.isInteger(b.price_htg) || b.price_htg < 1 || b.price_htg > 1e8) ctx.err(400, 'Prix invalide');
    const photos = [...new Set(Array.isArray(b.photos) ? b.photos : [])].slice(0, 12);
    for (const ph of [b.photo, ...photos]) if (ph && !ctx.isImage(ph)) ctx.err(400, 'Photo introuvable');
    const x = { id: old?.id || ctx.id(), name: b.name.trim(), name_ht: (b.name_ht || '').trim(), event_type: b.event_type, price_htg: b.price_htg, guests: (b.guests || '').trim(), description: (b.description || '').trim(), description_ht: (b.description_ht || '').trim(),
      includes: lines(b.includes), includes_ht: lines(b.includes_ht), photo: b.photo || '', photos, active: b.active !== false, featured: b.featured === true, order: old?.order ?? db.decorFormulas.length, created_at: old?.created_at || ctx.now() };
    ctx.commit(() => { if (old) Object.assign(old, x); else db.decorFormulas.push(x); }); return json(x), true;
  }
  if (m === 'POST' && p === '/api/admin/decor/options') {
    const old = b.id ? ctx.find(db.decorOptions, b.id) : null;
    if (!ctx.str(b.name || '', 2, 120) || !ctx.str(b.name_ht ?? '', 0, 120) || !ctx.str(b.unit || '', 2, 40) || !ctx.str(b.unit_ht ?? '', 0, 40) || !Number.isInteger(b.price_htg) || b.price_htg < 1 || b.price_htg > 1e7) ctx.err(400, 'Nom, unité et prix valides requis');
    const x = { id: old?.id || ctx.id(), name: b.name.trim(), name_ht: (b.name_ht || '').trim(), price_htg: b.price_htg, unit: b.unit.trim(), unit_ht: (b.unit_ht || '').trim(), active: b.active !== false, order: old?.order ?? db.decorOptions.length, created_at: old?.created_at || ctx.now() };
    ctx.commit(() => { if (old) Object.assign(old, x); else db.decorOptions.push(x); }); return json(x), true;
  }
  if (m === 'POST' && p === '/api/admin/decor/remove') {
    const list = b.kind === 'option' ? 'decorOptions' : 'decorFormulas', x = ctx.find(db[list], String(b.id || ''));
    ctx.commit(() => { db[list] = db[list].filter(y => y.id !== x.id); }); return json({ ok: true }), true;
  }
  return false;
}
