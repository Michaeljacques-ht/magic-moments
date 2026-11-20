/* ==========================================================
   Magic Moments — Parcours par étapes (V16)
   ----------------------------------------------------------
   Chaque commande et chaque location avance de la demande à la
   livraison. À chaque étape :
   - un courriel automatique (Brevo ou Resend) part au client ;
   - un message WhatsApp pré-enregistré est prêt à envoyer
     depuis l'administration (simple lien wa.me, sans API Meta).
   Les textes sont modifiables (français et kreyòl) dans
   Administration → Paramètres → Messages par étape.
   ========================================================== */
import { randomBytes } from 'node:crypto';

export const STAGES = {
  order: [
    { key: 'pending', fr: 'Demande reçue', ht: 'Demann resevwa' },
    { key: 'confirmed', fr: 'Confirmée — à payer', ht: 'Konfime — pou peye' },
    { key: 'paid', fr: 'Paiement reçu', ht: 'Peman resevwa' },
    { key: 'preparing', fr: 'En préparation', ht: 'N ap prepare' },
    { key: 'in_progress', fr: 'En livraison', ht: 'Sou wout' },
    { key: 'completed', fr: 'Livrée', ht: 'Livre' }
  ],
  rental: [
    { key: 'pending', fr: 'Demande reçue', ht: 'Demann resevwa' },
    { key: 'confirmed', fr: 'Confirmée — à payer', ht: 'Konfime — pou peye' },
    { key: 'paid', fr: 'Paiement reçu', ht: 'Peman resevwa' },
    { key: 'delivered', fr: 'Livrée et installée', ht: 'Livre e enstale' },
    { key: 'completed', fr: 'Récupérée — terminée', ht: 'Rekipere — fini' }
  ]
};
export const CANCELLED = { key: 'cancelled', fr: 'Annulée', ht: 'Anile' };
export const DEPOSIT = { key: 'deposit', fr: 'Acompte reçu', ht: 'Avans resevwa' };
export const PLACEHOLDERS = {
  '{client}': 'Nom du client', '{objet}': 'Surprise ou matériel loué', '{destinataire}': 'Destinataire (surprises)',
  '{date}': 'Date de l’événement ou début de location', '{fin}': 'Fin de location', '{ville}': 'Ville', '{adresse}': 'Adresse',
  '{montant}': 'Montant restant à payer', '{total}': 'Montant total', '{acompte}': 'Montant de l’acompte', '{deja_paye}': 'Déjà payé', '{reste}': 'Reste à payer', '{lien_paiement}': 'Lien de paiement en ligne', '{ref}': 'Référence', '{site}': 'Adresse du site', '{lien_suivi}': 'Lien pour suivre la demande (sans compte)', '{whatsapp}': 'Numéro WhatsApp de l’entreprise'
};

// Textes par défaut. subject/body = courriel ; wa = WhatsApp au client ; dest = WhatsApp au destinataire (surprises).
const T = (subject_fr, body_fr, wa_fr, subject_ht, body_ht, wa_ht, dest_fr = '', dest_ht = '') => ({ active: true, subject_fr, body_fr, wa_fr, subject_ht, body_ht, wa_ht, dest_fr, dest_ht });
export const DEFAULTS = {
  order: {
    pending: T('Demande reçue', 'Bonjour {client},\n\nNous avons bien reçu votre demande « {objet} » pour {destinataire}. Notre équipe vérifie la disponibilité et vous confirme très vite, par courriel et WhatsApp.\n\nPour réserver votre date dès maintenant, vous pouvez régler un acompte de {acompte} :\n{lien_paiement}',
      'Bonjour {client} 👋\nIci Magic Moments. Nous avons bien reçu votre demande « {objet} » pour {destinataire} (le {date}, {ville}).\nRéférence : {ref}\nNous vérifions la disponibilité et revenons vers vous très vite. 🎁',
      'Nou resevwa demann ou', 'Bonjou {client},\n\nNou resevwa demann ou « {objet} » pou {destinataire}. Ekip nou an ap verifye disponiblite epi l ap konfime w byento, pa imèl ak WhatsApp.\n\nPou rezève dat ou a kounye a, ou ka peye yon avans {acompte} :\n{lien_paiement}',
      'Bonjou {client} 👋\nSe Magic Moments. Nou resevwa demann ou « {objet} » pou {destinataire} ({date}, {ville}).\nReferans : {ref}\nN ap verifye disponiblite epi n ap reponn ou byento. 🎁'),
    confirmed: T('Commande confirmée — paiement', 'Bonjour {client},\n\nBonne nouvelle : votre commande « {objet} » est confirmée ! Montant à régler : {montant}.\nPayez en ligne (MonCash, NatCash, Kashpaw) avec ce lien sécurisé :\n{lien_paiement}',
      'Bonjour {client} ✨\nVotre commande « {objet} » pour {destinataire} est confirmée !\nMontant : {montant}\nPayez en ligne ici (MonCash / NatCash) :\n{lien_paiement}\nMerci de votre confiance. — Magic Moments',
      'Kòmand ou konfime — peman', 'Bonjou {client},\n\nBon nouvèl : kòmand ou « {objet} » konfime! Montan pou peye : {montant}.\nPeye an liy (MonCash, NatCash, Kashpaw) ak lyen sa a :\n{lien_paiement}',
      'Bonjou {client} ✨\nKòmand ou « {objet} » pou {destinataire} konfime!\nMontan : {montant}\nPeye an liy la a (MonCash / NatCash) :\n{lien_paiement}\nMèsi pou konfyans ou. — Magic Moments'),
    paid: T('Paiement reçu — merci !', 'Bonjour {client},\n\nNous avons bien reçu votre paiement de {montant}. Merci ! Votre surprise entre dans notre planning de préparation.',
      'Bonjour {client} 🙏\nPaiement de {montant} bien reçu pour « {objet} ». Merci !\nNous lançons la préparation. Référence : {ref}',
      'Nou resevwa peman ou — mèsi!', 'Bonjou {client},\n\nNou resevwa peman {montant} ou a. Mèsi! Sipriz ou a antre nan plan preparasyon nou.',
      'Bonjou {client} 🙏\nNou resevwa peman {montant} pou « {objet} ». Mèsi!\nN ap kòmanse prepare l. Referans : {ref}'),
    preparing: T('Votre surprise est en préparation', 'Bonjour {client},\n\nNotre équipe prépare votre surprise « {objet} » pour {destinataire}. Tout sera prêt pour le {date}.',
      'Bonjour {client} 🎀\nVotre surprise « {objet} » est en préparation. Tout sera prêt pour le {date}. Une question ? Répondez à ce message.',
      'N ap prepare sipriz ou', 'Bonjou {client},\n\nEkip nou an ap prepare sipriz ou « {objet} » pou {destinataire}. Tout bagay ap pare pou {date}.',
      'Bonjou {client} 🎀\nN ap prepare sipriz ou « {objet} ». L ap pare pou {date}. Ou gen yon kesyon? Reponn mesaj sa a.'),
    in_progress: T('En route pour la livraison', 'Bonjour {client},\n\nNotre équipe est en route vers {ville} pour livrer « {objet} » à {destinataire}. Nous vous prévenons dès que c’est fait.',
      'Bonjour {client} 🚗\nNotre équipe est en route pour livrer « {objet} » à {destinataire} ({ville}). Nous vous envoyons la confirmation et les photos dès la remise !',
      'Nou sou wout pou livrezon an', 'Bonjou {client},\n\nEkip nou an sou wout {ville} pou livre « {objet} » bay {destinataire}. N ap fè w konnen depi sa fèt.',
      'Bonjou {client} 🚗\nEkip nou an sou wout pou livre « {objet} » bay {destinataire} ({ville}). N ap voye konfimasyon ak foto yo depi nou remèt li!',
      'Bonjour {destinataire} 👋\nIci Magic Moments. Nous avons une livraison pour vous aujourd’hui à {ville}. Pouvez-vous nous confirmer votre présence et l’adresse exacte ?',
      'Bonjou {destinataire} 👋\nSe Magic Moments. Nou gen yon livrezon pou ou jodi a nan {ville}. Èske w ka konfime w la epi ban nou adrès egzak la?'),
    completed: T('Surprise livrée 🎉', 'Bonjour {client},\n\nVotre surprise a été livrée à {destinataire}. Merci d’avoir choisi Magic Moments pour créer ce moment magique ! Votre avis compte : répondez à ce courriel pour nous le partager.',
      'Bonjour {client} 🎉\nMission accomplie : « {objet} » a été livrée à {destinataire} !\nMerci d’avoir choisi Magic Moments. Un petit avis nous ferait très plaisir ⭐',
      'Sipriz la livre 🎉', 'Bonjou {client},\n\nSipriz ou a rive kay {destinataire}. Mèsi paske w chwazi Magic Moments pou kreye moman majik sa a! Opinyon ou enpòtan : reponn imèl sa a pou pataje l.',
      'Bonjou {client} 🎉\nMisyon akonpli : « {objet} » rive kay {destinataire}!\nMèsi paske w chwazi Magic Moments. Yon ti avi t ap fè nou plezi ⭐'),
    deposit: T('Acompte reçu — date réservée', 'Bonjour {client},\n\nNous avons bien reçu votre acompte de {deja_paye} pour « {objet} ». Votre date est réservée ! Reste à payer : {reste}. Le lien pour régler le solde vous sera envoyé après confirmation.',
      'Bonjour {client} 🙏\nAcompte de {deja_paye} bien reçu pour « {objet} ». Votre date est réservée ✅\nReste à payer : {reste}. Référence : {ref}',
      'Nou resevwa avans ou — dat la rezève', 'Bonjou {client},\n\nNou resevwa avans {deja_paye} ou a pou « {objet} ». Dat ou a rezève! Rès pou peye : {reste}. N ap voye lyen pou peye rès la apre konfimasyon.',
      'Bonjou {client} 🙏\nNou resevwa avans {deja_paye} pou « {objet} ». Dat ou a rezève ✅\nRès pou peye : {reste}. Referans : {ref}'),
    cancelled: T('Commande annulée', 'Bonjour {client},\n\nVotre commande « {objet} » a été annulée. Si vous avez déjà payé, notre équipe vous contacte pour le remboursement. Pour toute question : WhatsApp {whatsapp}.',
      'Bonjour {client},\nVotre commande « {objet} » (réf. {ref}) a été annulée. Nous restons disponibles pour toute question.',
      'Kòmand ou anile', 'Bonjou {client},\n\nKòmand ou « {objet} » anile. Si w te deja peye, ekip nou an ap kontakte w pou ranbousman an. Pou nenpòt kesyon : WhatsApp {whatsapp}.',
      'Bonjou {client},\nKòmand ou « {objet} » (ref. {ref}) anile. Nou rete disponib pou nenpòt kesyon.')
  },
  rental: {
    pending: T('Demande de location reçue', 'Bonjour {client},\n\nNous avons bien reçu votre demande de location : {objet}, du {date} au {fin} à {ville}. Nous vérifions le stock et vous confirmons rapidement.\n\nPour bloquer le matériel dès maintenant, vous pouvez régler un acompte de {acompte} :\n{lien_paiement}',
      'Bonjour {client} 👋\nIci Magic Moments. Demande de location reçue : {objet}\nDu {date} au {fin} — {ville}\nRéférence : {ref}\nNous vérifions le stock et revenons vers vous.',
      'Nou resevwa demann lokasyon ou', 'Bonjou {client},\n\nNou resevwa demann lokasyon ou : {objet}, depi {date} rive {fin} nan {ville}. N ap verifye stòk la epi n ap konfime w vit.\n\nPou bloke materyèl la kounye a, ou ka peye yon avans {acompte} :\n{lien_paiement}',
      'Bonjou {client} 👋\nSe Magic Moments. Nou resevwa demann lokasyon ou : {objet}\nDepi {date} rive {fin} — {ville}\nReferans : {ref}\nN ap verifye stòk la epi n ap reponn ou.'),
    confirmed: T('Location confirmée — paiement', 'Bonjour {client},\n\nVotre location est confirmée : {objet}. Montant à régler : {montant}.\nPayez en ligne (MonCash, NatCash, Kashpaw) avec ce lien sécurisé :\n{lien_paiement}',
      'Bonjour {client} ✅\nVotre location est confirmée : {objet}\nMontant : {montant}\nPayez en ligne ici :\n{lien_paiement}\n— Magic Moments',
      'Lokasyon ou konfime — peman', 'Bonjou {client},\n\nLokasyon ou konfime : {objet}. Montan pou peye : {montant}.\nPeye an liy (MonCash, NatCash, Kashpaw) ak lyen sa a :\n{lien_paiement}',
      'Bonjou {client} ✅\nLokasyon ou konfime : {objet}\nMontan : {montant}\nPeye an liy la a :\n{lien_paiement}\n— Magic Moments'),
    paid: T('Paiement de la location reçu', 'Bonjour {client},\n\nNous avons bien reçu votre paiement de {montant}. Merci ! Le matériel sera livré et installé le {date} à {adresse}.',
      'Bonjour {client} 🙏\nPaiement de {montant} bien reçu. Livraison et installation prévues le {date} ({ville}). Référence : {ref}',
      'Nou resevwa peman lokasyon an', 'Bonjou {client},\n\nNou resevwa peman {montant} ou a. Mèsi! N ap livre epi enstale materyèl la {date} nan {adresse}.',
      'Bonjou {client} 🙏\nNou resevwa peman {montant} ou a. Livrezon ak enstalasyon : {date} ({ville}). Referans : {ref}'),
    delivered: T('Matériel livré et installé', 'Bonjour {client},\n\nVotre matériel est livré et installé. Nous passerons le récupérer le {fin}. Bon événement !',
      'Bonjour {client} 🎊\nVotre matériel est livré et installé. Récupération prévue le {fin}. Bon événement !',
      'Materyèl la livre e enstale', 'Bonjou {client},\n\nMateryèl ou a livre e enstale. N ap pase rekipere l {fin}. Bon evènman!',
      'Bonjou {client} 🎊\nMateryèl ou a livre e enstale. N ap vin rekipere l {fin}. Bon evènman!'),
    completed: T('Location terminée — merci !', 'Bonjour {client},\n\nNous avons récupéré le matériel : votre location est terminée. Merci d’avoir choisi Magic Moments, à très bientôt !',
      'Bonjour {client} 🙌\nMatériel récupéré, location terminée. Merci et à bientôt chez Magic Moments !',
      'Lokasyon an fini — mèsi!', 'Bonjou {client},\n\nNou rekipere materyèl la : lokasyon ou a fini. Mèsi paske w chwazi Magic Moments, a byento!',
      'Bonjou {client} 🙌\nNou rekipere materyèl la, lokasyon an fini. Mèsi e a byento nan Magic Moments!'),
    deposit: T('Acompte de location reçu', 'Bonjour {client},\n\nNous avons bien reçu votre acompte de {deja_paye}. Le matériel ({objet}) est bloqué pour vous. Reste à payer : {reste}.',
      'Bonjour {client} 🙏\nAcompte de {deja_paye} bien reçu. Matériel bloqué pour vous ✅\nReste à payer : {reste}. Référence : {ref}',
      'Nou resevwa avans lokasyon an', 'Bonjou {client},\n\nNou resevwa avans {deja_paye} ou a. Materyèl la ({objet}) bloke pou ou. Rès pou peye : {reste}.',
      'Bonjou {client} 🙏\nNou resevwa avans {deja_paye} ou a. Materyèl la bloke pou ou ✅\nRès pou peye : {reste}. Referans : {ref}'),
    cancelled: T('Location annulée', 'Bonjour {client},\n\nVotre demande de location ({objet}) a été annulée. Si vous avez déjà payé, notre équipe vous contacte pour le remboursement. Questions : WhatsApp {whatsapp}.',
      'Bonjour {client},\nVotre location ({objet}, réf. {ref}) a été annulée. Nous restons disponibles pour toute question.',
      'Lokasyon an anile', 'Bonjou {client},\n\nDemann lokasyon ou ({objet}) anile. Si w te deja peye, ekip nou an ap kontakte w pou ranbousman an. Kesyon : WhatsApp {whatsapp}.',
      'Bonjou {client},\nLokasyon ou ({objet}, ref. {ref}) anile. Nou rete disponib pou nenpòt kesyon.')
  }
};
const FIELDS = ['subject_fr', 'body_fr', 'wa_fr', 'subject_ht', 'body_ht', 'wa_ht', 'dest_fr', 'dest_ht'];

export function migrate(db) {
  db.templates ??= {};
  // V17 : les textes « demande reçue » restés d'origine reçoivent la mention de l'acompte.
  const OLD = { order: 'Bonjour {client},\n\nNous avons bien reçu votre demande « {objet} » pour {destinataire}. Notre équipe vérifie la disponibilité et vous confirme très vite, par courriel et WhatsApp.', rental: 'Bonjour {client},\n\nNous avons bien reçu votre demande de location : {objet}, du {date} au {fin} à {ville}. Nous vérifions le stock et vous confirmons rapidement.' };
  for (const kind of Object.keys(OLD)) { const t = db.templates[kind]?.pending; if (t && t.body_fr === OLD[kind]) db.templates[kind].pending = { ...DEFAULTS[kind].pending, active: t.active }; }
  for (const kind of Object.keys(DEFAULTS)) { db.templates[kind] ??= {}; for (const k of Object.keys(DEFAULTS[kind])) db.templates[kind][k] ??= { ...DEFAULTS[kind][k] }; }
  for (const r of db.rentals || []) { r.payment_status ??= 'unpaid'; r.pay_token ??= randomBytes(16).toString('hex'); r.lang ??= 'fr'; }
}

/** Étape actuelle d'une commande ou d'une location. */
export function stageOf(kind, x) {
  if (x.status === 'cancelled') return 'cancelled';
  const late = kind === 'order' ? ['preparing', 'in_progress', 'completed'] : ['delivered', 'completed'];
  if (late.includes(x.status)) return x.status;
  if (x.payment_status === 'paid') return 'paid';
  return x.status === 'confirmed' ? 'confirmed' : 'pending';
}
export const stageLabel = (kind, key, lg = 'fr') => ([...STAGES[kind], DEPOSIT, CANCELLED].find(s => s.key === key) || {})[lg] || key;

/* H : aides fournies par le serveur — db, publicUrl(), payLink(kind,x), payable(kind,x), amount(kind,x),
   formatDate(v,lg), queueMail(to,subject,text,meta), contact(kind,x) → { name, email, phone, recipient_phone }. */
function vars(H, kind, x, lg) {
  const c = H.contact(kind, x), objet = kind === 'order' ? ((lg === 'ht' && x.package_name_ht) || x.package_name)
    : (x.items || []).map(i => ((lg === 'ht' && i.name_ht) || i.name) + ' × ' + i.quantity).join(', ') || x.equipment_name;
  return {
    '{client}': c.name || '', '{objet}': objet || '', '{destinataire}': x.recipient || '', '{date}': H.formatDate(kind === 'order' ? x.event_at : x.start_at, lg),
    '{fin}': x.end_at ? H.formatDate(x.end_at, lg) : '', '{ville}': x.city || '', '{adresse}': x.address || x.city || '',
    '{montant}': htg(H.amount(kind, x) || H.total(kind, x)), '{total}': htg(H.total(kind, x)), '{acompte}': htg(H.deposit(kind, x)), '{deja_paye}': htg(H.paid(kind, x)), '{reste}': htg(H.amount(kind, x)),
    '{lien_paiement}': H.payable(kind, x) ? H.payLink(kind, x) : (lg === 'ht' ? '(ekip nou an ap ba w enstriksyon peman yo)' : '(notre équipe vous indique comment régler)'),
    '{ref}': (kind === 'order' ? 'MM-' : 'LOC-') + x.id.slice(0, 8).toUpperCase(), '{site}': H.publicUrl(), '{lien_suivi}': H.trackLink(kind, x), '{whatsapp}': H.db.settings.contact?.whatsapp || ''
  };
}
const htg = n => Number(n || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' HTG';
const fill = (s, v) => String(s || '').replace(/\{[a-z_]+\}/g, k => k in v ? v[k] : k);
const phone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 8 ? '509' + d : d; };
const wa = (p, text) => p ? 'https://wa.me/' + p + '?text=' + encodeURIComponent(text) : '';

/** Textes prêts pour chaque étape (administration). */
export function messages(H, kind, x) {
  const lg = x.lang === 'ht' ? 'ht' : 'fr', v = vars(H, kind, x, lg), c = H.contact(kind, x), cur = stageOf(kind, x);
  return {
    stage: cur, lang: lg, client_phone: phone(c.phone), recipient_phone: phone(c.recipient_phone),
    steps: [...STAGES[kind], DEPOSIT, CANCELLED].map(s => { const t = H.db.templates[kind][s.key] || {}, txt = fill(t['wa_' + lg], v), dest = fill(t['dest_' + lg], v);
      return { key: s.key, label: s.fr, current: s.key === cur, email_active: !!t.active, wa: txt, wa_client: wa(phone(c.phone), txt), wa_dest: dest && c.recipient_phone ? wa(phone(c.recipient_phone), dest) : '' }; })
  };
}

/** Courriel automatique de l'étape. Renvoie false seulement si l'étape n'a pas de modèle (l'ancien courriel prend alors le relais). */
export function sendStage(H, kind, x, stage, extra = []) {
  const t = H.db.templates?.[kind]?.[stage], c = H.contact(kind, x);
  if (!t) return false;
  if (!t.active || !c.email || !/^\S+@\S+\.\S+$/.test(c.email)) return true; // désactivé par l'administrateur : aucun courriel
  const lg = x.lang === 'ht' ? 'ht' : 'fr', v = vars(H, kind, x, lg), ht = lg === 'ht';
  const steps = STAGES[kind], i = steps.findIndex(s => s.key === stage);
  const track = i >= 0 ? steps.map((s, k) => (k < i ? '✔ ' : k === i ? '➜ ' : '○ ') + s[lg]).join('\n') : '';
  const text = [fill(t['body_' + lg], v), ...extra, '', (ht ? 'Referans' : 'Référence') + ' : ' + v['{ref}'], (kind === 'order' ? (ht ? 'Sèvis' : 'Prestation') : (ht ? 'Materyèl' : 'Matériel')) + ' : ' + v['{objet}'],
    (ht ? 'Dat' : 'Date') + ' : ' + v['{date}'] + (v['{fin}'] ? ' → ' + v['{fin}'] : ''), (ht ? 'Montan total' : 'Montant total') + ' : ' + v['{total}'], ...(H.paid(kind, x) > 0 ? [(ht ? 'Deja peye' : 'Déjà payé') + ' : ' + v['{deja_paye}'], (ht ? 'Rès pou peye' : 'Reste à payer') + ' : ' + v['{reste}']] : []),
    ...(track ? ['', ht ? 'Kote demann ou ye :' : 'Où en est votre demande :', track] : []),
    '', (ht ? 'Swiv demann ou' : 'Suivre votre demande') + ' : ' + H.trackLink(kind, x), ht ? 'Mèsi paske w chwazi Magic Moments.' : 'Merci d’avoir choisi Magic Moments.'].join('\n');
  H.queueMail(c.email, fill(t['subject_' + lg], v), text, { [kind + '_id']: x.id, stage });
  return true;
}

/* ---------- Routes d'administration des modèles ---------- */
export function adminRoutes(ctx, { m, p, b, json }, H) {
  const { db } = ctx;
  if (m === 'GET' && p === '/api/admin/templates') return json({ stages: { order: [...STAGES.order, DEPOSIT, CANCELLED], rental: [...STAGES.rental, DEPOSIT, CANCELLED] }, templates: db.templates, placeholders: PLACEHOLDERS }), true;
  if (m === 'POST' && p === '/api/admin/templates') {
    const kind = b.kind, stage = b.stage;
    if (!DEFAULTS[kind]?.[stage]) ctx.err(400, 'Étape inconnue');
    for (const f of FIELDS) if (!ctx.str(b[f] ?? '', 0, f.startsWith('subject') ? 160 : 3000)) ctx.err(400, 'Texte trop long : ' + f);
    if (!ctx.str(b.subject_fr || '', 2, 160) || !ctx.str(b.body_fr || '', 5, 3000)) ctx.err(400, 'Objet et message en français requis');
    ctx.commit(() => { const t = db.templates[kind][stage]; for (const f of FIELDS) t[f] = (b[f] || '').trim(); t.active = b.active !== false; });
    return json(db.templates[kind][stage]), true;
  }
  if (m === 'POST' && p === '/api/admin/templates/reset') {
    if (!DEFAULTS[b.kind]?.[b.stage]) ctx.err(400, 'Étape inconnue');
    ctx.commit(() => { db.templates[b.kind][b.stage] = { ...DEFAULTS[b.kind][b.stage] }; });
    return json(db.templates[b.kind][b.stage]), true;
  }
  const mm = /^\/api\/admin\/messages\/(order|rental)\/([\w-]+)$/.exec(p);
  if (m === 'GET' && mm) { const x = ctx.find(mm[1] === 'order' ? db.orders : db.rentals, mm[2]); return json(messages(H, mm[1], x)), true; }
  return false;
}
