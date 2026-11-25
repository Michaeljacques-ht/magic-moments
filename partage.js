/* ==========================================================
   Magic Moments — Pages de partage (V25)
   ----------------------------------------------------------
   /p/s/<id> : une surprise (formule)  ·  /p/b/<id> : un article
   de la boutique  ·  /p/l/<id> : un matériel de location.
   Les réseaux sociaux (Facebook, WhatsApp, X, Telegram,
   LinkedIn…) lisent ici les balises Open Graph : photo, titre,
   description et prix. Un visiteur humain est redirigé vers la
   bonne page du site, la fiche concernée mise en avant.
   ?lang=ht donne l'aperçu en kreyòl.
   ========================================================== */
const BOT = /facebookexternalhit|facebot|twitterbot|whatsapp|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|vkshare|redditbot|applebot|googlebot|bingbot|embedly|iframely|viber|snapchat|instagram|tumblr|bitlybot|mastodon|yandex|duckduckbot|petalbot|google-inspectiontool|preview/i;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' HTG';
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

function item(db, type, id, ht) {
  const pick = (x, k) => (ht && x[k + '_ht']) || x[k] || '';
  if (type === 's') {
    const x = db.packages.find(p => p.id === id && p.active !== false); if (!x) return null;
    const inc = (ht && x.includes_ht?.length ? x.includes_ht : x.includes || []).slice(0, 4);
    return { title: pick(x, 'name'), price: (ht ? 'Apati ' : 'À partir de ') + money(x.price_htg), amount: x.price_htg, desc: [pick(x, 'description'), inc.length ? (ht ? 'Gen ladan l : ' : 'Inclus : ') + inc.join(', ') : ''].filter(Boolean).join(' — '),
      photo: x.photo || (x.photos || [])[0] || '', target: '#catalogue', label: ht ? 'Sipriz' : 'Surprise', express: !!x.express };
  }
  if (type === 'b') {
    const x = (db.products || []).find(p => p.id === id && p.active !== false); if (!x) return null;
    return { title: pick(x, 'name'), price: money(x.price_htg), amount: x.price_htg, desc: pick(x, 'description') + (x.stock > 0 ? '' : (ht ? ' — Fini pou kounye a' : ' — Bientôt de retour')), photo: x.photo || '', target: '#boutique', label: ht ? 'Boutik kado' : 'Boutique de cadeaux' };
  }
  if (type === 'l') {
    const x = db.equipment.find(e => e.id === id && e.active !== false); if (!x) return null;
    return { title: pick(x, 'name'), price: money(x.daily_price_htg) + (ht ? ' / jou' : ' / jour'), amount: x.daily_price_htg, desc: pick(x, 'description') || (ht ? 'Lokasyon materyèl pou evènman ou an Ayiti, livrezon ak enstalasyon.' : 'Location de matériel pour vos événements en Haïti, livraison et installation.'), photo: x.photo || '', target: '#location', label: ht ? 'Lokasyon' : 'Location' };
  }
  return null;
}

/** Répond à GET /p/<type>/<id>. Renvoie true si la requête est traitée. */
export function handle(db, req, res, p, publicUrl) {
  const mm = /^\/p\/([sbl])\/([\w-]{6,64})$/.exec(p); if (!mm) return false;
  const q = new URL(req.url, 'http://x').searchParams, ht = q.get('lang') === 'ht';
  const it = item(db, mm[1], mm[2], ht), base = publicUrl();
  const target = it ? `${base}/?voir=${mm[1]}:${mm[2]}${ht ? '&lang=ht' : ''}${it.target}` : base + '/';
  if (!BOT.test(req.headers['user-agent'] || '')) { res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' }); res.end(); return true; }
  const title = it ? `${it.title} — ${it.price} | Magic Moments` : 'Magic Moments — Surprises et événements en Haïti';
  const desc = it ? cut(`${it.desc ? it.desc + ' — ' : ''}${it.price}. ${ht ? 'Kòmande sou Magic Moments : sipriz, kado ak lokasyon an Ayiti.' : 'Commandez sur Magic Moments : surprises, cadeaux et location en Haïti.'}`, 300) : 'Surprises livrées, cadeaux, décorations et location de matériel en Haïti.';
  const img = it?.photo ? `${base}/media/${it.photo}` : `${base}/logo.png`, url = `${base}${p}${ht ? '?lang=ht' : ''}`;
  const html = `<!doctype html><html lang="${ht ? 'ht' : 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="Magic Moments"><meta property="og:type" content="product"><meta property="og:locale" content="${ht ? 'ht_HT' : 'fr_FR'}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}"><meta property="og:image:alt" content="${esc(it?.title || 'Magic Moments')}">
${it ? `<meta property="product:price:amount" content="${it.amount}"><meta property="product:price:currency" content="HTG">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
</head><body style="font-family:Arial,sans-serif;max-width:640px;margin:30px auto;padding:0 16px;color:#24162c">
<p><img src="${esc(img)}" alt="" style="max-width:100%;border-radius:14px"></p><p style="color:#8a5a00;font-weight:bold">${esc(it?.label || '')}</p><h1>${esc(it?.title || 'Magic Moments')}</h1><p><b>${esc(it?.price || '')}</b></p><p>${esc(it?.desc || desc)}</p>
<p><a href="${esc(target)}" style="display:inline-block;background:#43005d;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold">${ht ? 'Wè sou Magic Moments' : 'Voir sur Magic Moments'}</a></p></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' }); res.end(html); return true;
}
