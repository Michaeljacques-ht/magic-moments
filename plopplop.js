/* ============================================================
   Magic Moments — Passerelle de paiement PLOP PLOP
   Repris du module de Konekte / EDUCA Librairie (même processus).
   Documentation : https://plopplop.solutionip.app/paiement-doc

   PAIEMENT (2 appels)
     POST api/paiement-marchand  { client_id, refference_id, montant, payment_method }
       → { status, url, transaction_id }   → le client paie sur `url`
     POST api/paiement-verify    { client_id, refference_id }
       → { trans_status: 'ok', id_transaction, method, date, heure }

   Variables d'environnement (Render > Environment), jamais dans le code :
     PLOP_CLIENT_ID, PLOP_CLIENT_SECRET, PLOP_HOTE (facultatif).
   Sans PLOP_CLIENT_ID / PLOP_CLIENT_SECRET, le paiement en ligne est
   désactivé et le site garde le paiement manuel.
   ============================================================ */

export const PLOP = {
  hote: process.env.PLOP_HOTE || 'plopplop.solutionip.app',
  clientId: process.env.PLOP_CLIENT_ID || '',
  clientSecret: process.env.PLOP_CLIENT_SECRET || '',
  montantMinHTG: 20 // minimum imposé par l'API PLOP PLOP
};

export const passerelleActive = () => !!(PLOP.clientId && PLOP.clientSecret);

/* Appel JSON sortant. Une passerelle d'essai locale (localhost) est
   joignable en http ; partout ailleurs, https est obligatoire. */
async function appelPlop(chemin, corps) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(PLOP.hote);
  const url = (local ? 'http://' : 'https://') + PLOP.hote + '/' + chemin.replace(/^\//, '');
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(25000) });
  } catch (e) {
    throw new Error('Passerelle injoignable : ' + (e.name === 'TimeoutError' ? 'délai dépassé' : e.message));
  }
  const brut = await r.text();
  let json; try { json = JSON.parse(brut || '{}'); } catch { json = { message: brut.slice(0, 300) }; }
  return { code: r.status, corps: json };
}

/** Ouvre une transaction. Retourne { ok, url, transactionId } ou { ok:false, error }. */
export async function initierPaiement({ reference, montant }) {
  if (!passerelleActive()) return { ok: false, error: 'Paiement en ligne non configuré.' };
  let rep;
  try {
    rep = await appelPlop('api/paiement-marchand', {
      client_id: PLOP.clientId,
      refference_id: reference, // orthographe imposée par l'API
      montant: Math.max(PLOP.montantMinHTG, Math.round(montant)),
      payment_method: 'all' // le client choisit MonCash, NatCash ou Kashpaw sur la passerelle
    });
  } catch (e) { return { ok: false, error: e.message }; }
  if (rep.code !== 200 || !rep.corps.status || !rep.corps.url) {
    return { ok: false, error: rep.corps.message || 'La passerelle a refusé la transaction.', code: rep.code };
  }
  if (!/^https:\/\//.test(rep.corps.url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(rep.corps.url)) {
    return { ok: false, error: 'Adresse de paiement invalide reçue de la passerelle.' };
  }
  return { ok: true, url: rep.corps.url, transactionId: rep.corps.transaction_id || null };
}

/** État d'une transaction. `paye` n'est vrai que si trans_status === 'ok'. */
export async function verifierPaiement(reference) {
  if (!passerelleActive()) return { ok: false, paye: false, error: 'Paiement en ligne non configuré.' };
  let rep;
  try {
    rep = await appelPlop('api/paiement-verify', { client_id: PLOP.clientId, refference_id: reference });
  } catch (e) { return { ok: false, paye: false, error: e.message }; }
  const i = rep.corps || {};
  if (i.trans_status === 'ok') {
    return { ok: true, paye: true, infos: { transactionId: i.id_transaction || null, methode: i.method || null, date: [i.date, i.heure].filter(Boolean).join(' ') } };
  }
  return { ok: true, paye: false, message: i.message || 'Paiement non encore confirmé.' };
}
