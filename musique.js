/* ==========================================================
   Magic Moments — Bibliothèque musicale (V17)
   ----------------------------------------------------------
   L'administrateur importe des musiques depuis YouTube en
   collant leurs liens : le titre et l'artiste sont récupérés
   automatiquement (oEmbed de YouTube, sans clé). Rien n'est
   téléchargé : on garde l'identifiant de la vidéo, la
   miniature et l'écoute passent par YouTube.
   Les clients choisissent ensuite une musique pour leur
   surprise dans le formulaire de commande.
   ========================================================== */
export const MUSIC_CATEGORIES = ['Anniversaire', 'Romantique', 'Mariage', 'Fête des mères', 'Gospel', 'Kompa', 'Racine', 'Instrumental', 'Diplôme', 'Autre'];

/** Identifiant YouTube (11 caractères) d'un lien youtu.be, watch?v=, shorts, embed ou music.youtube. */
export function youtubeId(url) {
  const s = String(url || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u; try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return null;
  const id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1, 12) : u.searchParams.get('v') || (/^\/(shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname) || [])[2];
  return /^[\w-]{11}$/.test(id || '') ? id : null;
}

async function oembed(vid) {
  if (process.env.YOUTUBE_LOOKUP === 'off') return null;
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null; const j = await r.json(); return { title: String(j.title || '').slice(0, 160), artist: String(j.author_name || '').slice(0, 120) };
  } catch { return null; }
}

export function migrate(db) { db.music ??= []; }

const pub = x => ({ id: x.id, youtube_id: x.youtube_id, title: x.title, artist: x.artist, category: x.category });

export async function routes(ctx, { m, p, b, u, json }) {
  const { db } = ctx;
  if (m === 'GET' && p === '/api/music') return json(db.music.filter(x => x.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)).map(pub)), true;
  if (!p.startsWith('/api/admin/music')) return false;
  if (!u || u.role !== 'admin') ctx.err(403, 'Accès refusé');
  if (m === 'GET' && p === '/api/admin/music') return json({ list: db.music, categories: MUSIC_CATEGORIES }), true;
  if (m === 'POST' && p === '/api/admin/music/import') {
    const lines = String(b.urls || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean).slice(0, 30), category = ctx.str(b.category || '', 1, 60) ? b.category.trim() : 'Autre';
    if (!lines.length) ctx.err(400, 'Collez au moins un lien YouTube');
    const added = [], skipped = [];
    for (const l of lines) {
      const vid = youtubeId(l); if (!vid) { skipped.push({ url: l, reason: 'Lien YouTube non reconnu' }); continue; }
      if (db.music.some(x => x.youtube_id === vid) || added.some(x => x.youtube_id === vid)) { skipped.push({ url: l, reason: 'Déjà dans la bibliothèque' }); continue; }
      const info = await oembed(vid);
      added.push({ id: ctx.id(), youtube_id: vid, title: info?.title || 'Vidéo YouTube ' + vid, artist: info?.artist || '', category, active: true, created_at: ctx.now() });
    }
    if (added.length) ctx.commit(() => db.music.push(...added));
    return json({ added, skipped }, 201), true;
  }
  const one = /^\/api\/admin\/music\/([\w-]+)$/.exec(p);
  if (one && m === 'PATCH') {
    const x = ctx.find(db.music, one[1]);
    if (!ctx.str(b.title || '', 1, 160) || !ctx.str(b.artist ?? '', 0, 120) || !ctx.str(b.category || '', 1, 60)) ctx.err(400, 'Titre et catégorie requis');
    ctx.commit(() => Object.assign(x, { title: b.title.trim(), artist: (b.artist || '').trim(), category: b.category.trim(), active: b.active !== false }));
    return json(x), true;
  }
  if (m === 'POST' && p === '/api/admin/music/remove') { const x = ctx.find(db.music, String(b.id || '')); ctx.commit(() => { db.music = db.music.filter(y => y.id !== x.id); }); return json({ ok: true }), true; }
  return false;
}
