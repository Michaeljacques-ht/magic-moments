/* ============================================================
   Magic Moments — Traductions kreyòl du catalogue de départ
   et des courriels. Le français reste la langue de référence :
   chaque traduction n'est appliquée que si le texte français
   n'a pas été modifié depuis (sinon l'administrateur saisit
   lui-même la version kreyòl dans le tableau de bord).
   ============================================================ */

export const CATEGORIES_HT = {
  'Anniversaire': 'Anivèsè', 'Baby shower': 'Baby shower', 'Événement': 'Evènman', 'Mariage': 'Maryaj',
  'Surprise à distance (diaspora)': 'Sipriz a distans (dyaspora)', 'Diplômes et réussites': 'Diplòm ak reyisit',
  'Baptême et communion': 'Batèm ak kominyon', 'Romance': 'Womans', 'Entreprise': 'Antrepriz',
  'Condoléances et soutien': 'Kondoleyans ak sipò', 'Fêtes de saison': 'Fèt sezon'
};

// [nom FR, description FR] → { name_ht, description_ht, includes_ht, guests_ht, lead_time_ht }
export const PACKAGES_HT = {
  'Surprise Essentielle': { fr: 'Gâteau, ballons et carte', name_ht: 'Sipriz Esansyèl', description_ht: 'Gato, balon ak kat' },
  'Surprise Premium': { fr: 'Fleurs, gâteau et décoration', name_ht: 'Sipriz Premium', description_ht: 'Flè, gato ak dekorasyon' },
  'Surprise VIP': { fr: 'Décoration et animation', name_ht: 'Sipriz VIP', description_ht: 'Dekorasyon ak animasyon' },
  'Baby Sweet': { fr: 'Décoration intime', name_ht: 'Baby Sweet', description_ht: 'Yon ti dekorasyon entim' },
  'Baby Premium': { fr: 'Décoration et animation', name_ht: 'Baby Premium', description_ht: 'Dekorasyon ak animasyon' },
  'Événement Élégance': { fr: 'Organisation et décoration', name_ht: 'Evènman Elegans', description_ht: 'Òganizasyon ak dekorasyon' },
  'Bonjou Lakay': { name_ht: 'Bonjou Lakay', description_ht: 'Yon sipriz nou livre bay yon moun ou renmen ann Ayiti, ou menm ou kòmande l depi aletranje. Ou resevwa foto ak videyo moman an.', includes_ht: ['Bouke flè', 'Gato pèsonalize', 'Kat ak mesaj ou', 'Livrezon filme', 'Foto ak videyo voye sou WhatsApp'], guests_ht: '1 moun', lead_time_ht: '72 è davans' },
  'Lakay Premium': { name_ht: 'Lakay Premium', description_ht: 'Gwo sipriz a distans : dekorasyon sou plas ak yon dirèk prive pou w viv moman an depi aletranje.', includes_ht: ['Dekorasyon chanm nan', 'Gato ak bouke flè', 'Balon', 'Difizyon Magic Live prive', 'Videyo souvni'], guests_ht: 'Fanmi', lead_time_ht: '5 jou davans' },
  'Panier gourmand Lakay': { name_ht: 'Panye bon gou Lakay', description_ht: 'Yon panye kado ak bon pwodui lokal, byen prezante, nou livre l ak kat ou.', includes_ht: ['Pwodui lokal nou chwazi', 'Anbalaj kado', 'Kat pèsonalize', 'Livrezon'], guests_ht: '1 moun', lead_time_ht: '48 è davans' },
  'Réveil surprise': { name_ht: 'Sipriz bonè maten', description_ht: 'Yon livrezon depi moun nan leve, pou jounen an kòmanse byen.', includes_ht: ['Manje maten', 'Balon', 'Kat pèsonalize', 'Livrezon bonè nan maten'], guests_ht: '1 a 2 moun', lead_time_ht: '48 è davans' },
  'Fête de diplômé': { name_ht: 'Fèt diplome', description_ht: 'Selebre resepsyon diplòm nan : dekorasyon ak koulè lekòl la oswa fakilte a, gato ak yon kwen foto.', includes_ht: ['Dekorasyon ak koulè ou chwazi', 'Banyè ak non an ak diplòm nan', 'Gato selebrasyon', 'Kwen foto ak kad', 'Balon ak chapo diplome'], guests_ht: 'Jiska 30 envite', lead_time_ht: '1 semèn davans' },
  'Fierté du bachelier': { name_ht: 'Fyète bachelye a', description_ht: 'Pou fete reyisit nan bakaloreya (Filo, Reto) ak fanmi ak zanmi.', includes_ht: ['Banyè pèsonalize', 'Gato', 'Balon', 'Kat felisitasyon'], guests_ht: 'Fanmi ak zanmi', lead_time_ht: '48 è davans' },
  'Baptême et communion': { name_ht: 'Batèm ak kominyon', description_ht: 'Dekorasyon blan ak dore pou yon batèm, yon premye kominyon oswa yon konfimasyon.', includes_ht: ['Dekorasyon blan ak dore', 'Tab desè', 'Ti souvni pou envite yo', 'Gato'], guests_ht: 'Jiska 40 envite', lead_time_ht: '1 semèn davans' },
  'Gender reveal': { name_ht: 'Gender reveal', description_ht: 'Dekouvri si se ti gason oswa ti fi ak yon moman sipriz pou pataje.', includes_ht: ['Balon sipriz', 'Lafimen woz oswa ble', 'Gato revelasyon', 'Dekorasyon'], guests_ht: 'Jiska 20 envite', lead_time_ht: '5 jou davans' },
  'Demande en mariage': { name_ht: 'Demann maryaj', description_ht: 'Yon dekorasyon womantik nou prepare an kachèt pou yon demann ou p ap janm bliye.', includes_ht: ['Dekorasyon womantik', 'Petal flè ak bouji LED', 'Bouke flè', 'Kowòdinasyon diskrè sou plas'], guests_ht: 'Koup la', lead_time_ht: '1 semèn davans' },
  'Cérémonie Élégance': { name_ht: 'Seremoni Elegans', description_ht: 'Dekorasyon seremoni an ak resepsyon an, ak koulè ou chwazi.', includes_ht: ['Ak pou seremoni an', 'Dekorasyon tab yo', 'Kouvèti chèz', 'Kowòdinasyon jou a'], guests_ht: 'Sou devi, selon kantite envite', lead_time_ht: '1 mwa davans' },
  'Voiture des mariés': { name_ht: 'Machin marye yo', description_ht: 'Dekorasyon flè ak riban pou machin marye yo.', includes_ht: ['Konpozisyon flè', 'Riban', 'Enstalasyon ak retire'], guests_ht: '1 machin', lead_time_ht: '1 semèn davans' },
  'Dîner aux chandelles': { name_ht: 'Dine ak chandèl', description_ht: 'Yon tab womantik nou monte lakay ou oswa sou yon teras.', includes_ht: ['Tab dekore', 'Bouji ak petal flè', 'Mizik anbyans', 'Enstalasyon ak ranje apre'], guests_ht: '2 moun', lead_time_ht: '72 è davans' },
  'Bouquet Romance': { name_ht: 'Bouke Womans', description_ht: 'Bouke, bagay dous ak yon kat pou di « mwen renmen w » san okazyon espesyal.', includes_ht: ['Bouke woz', 'Chokola', 'Kat pèsonalize', 'Livrezon'], guests_ht: '1 moun', lead_time_ht: '24 è davans' },
  'Cadeaux d’entreprise': { name_ht: 'Kado pou antrepriz', description_ht: 'Panye ak bwat kado pèsonalize pou kliyan, patnè oswa anplwaye ou yo.', includes_ht: ['Bwat kado pèsonalize', 'Kat ak non antrepriz la', 'Livrezon an gwoup'], guests_ht: 'Apati 10 bwat', lead_time_ht: '2 semèn davans' },
  'Inauguration': { name_ht: 'Inogirasyon', description_ht: 'Dekorasyon ak resepsyon pou louvri yon biznis oswa yon biwo.', includes_ht: ['Riban ak sizo', 'Ak balon', 'Sonorizasyon', 'Dekorasyon antre a'], guests_ht: 'Sou devi', lead_time_ht: '1 semèn davans' },
  'Fête de fin d’année': { name_ht: 'Fèt fen ane', description_ht: 'Yon soare pou ekip la, tout bagay pare pou fèmen ane a.', includes_ht: ['Dekorasyon', 'Sonorizasyon', 'Kowòdinasyon', 'Kwen foto'], guests_ht: 'Sou devi', lead_time_ht: '3 semèn davans' },
  'Hommage': { name_ht: 'Omaj', description_ht: 'Yon gèb oswa yon bouke senp ak yon kat, nou livre l ak diskresyon.', includes_ht: ['Gèb oswa bouke senp', 'Kat kondoleyans', 'Livrezon diskrè'], guests_ht: '1 fanmi', lead_time_ht: '24 è davans' },
  'Panier réconfort': { name_ht: 'Panye konsolasyon', description_ht: 'Yon panye ak anpil atansyon pou yon moun ki malad oswa k ap refè.', includes_ht: ['Flè', 'Bagay dous ak fwi', 'Kat sipò', 'Livrezon'], guests_ht: '1 moun', lead_time_ht: '24 è davans' },
  'Saint-Valentin': { name_ht: 'Sen Valanten', description_ht: 'Fòmil espesyal pou 14 fevriye.', includes_ht: ['Bouke woz', 'Chokola', 'Pelich', 'Kat pèsonalize'], guests_ht: '1 moun', lead_time_ht: 'Rezève bonè : plas limite' },
  'Fête des mères': { name_ht: 'Fèt manman', description_ht: 'Fòmil espesyal pou fèt manman, dènye dimanch mwa me.', includes_ht: ['Bouke flè', 'Gato', 'Kat pèsonalize', 'Livrezon'], guests_ht: '1 moun', lead_time_ht: 'Rezève bonè : plas limite' },
  'Fête des pères': { name_ht: 'Fèt papa', description_ht: 'Fòmil espesyal pou fèt papa.', includes_ht: ['Bwat kado', 'Gato', 'Kat pèsonalize'], guests_ht: '1 moun', lead_time_ht: 'Rezève bonè' },
  'Noël en famille': { name_ht: 'Nwèl an fanmi', description_ht: 'Dekorasyon ak kado pou fèt fen ane yo.', includes_ht: ['Dekorasyon Nwèl', 'Panye bon gou', 'Kat bòn ane'], guests_ht: 'Fanmi', lead_time_ht: '1 semèn davans' },
  'Jour de l’An — Soup joumou': { name_ht: 'Premye janvye — Soup joumou', description_ht: 'Pou premye janvye, Fèt Endepandans : soup joumou ak vè bòn ane livre bay moun ou renmen yo.', includes_ht: ['Soup joumou', 'Pen', 'Kat bòn ane', 'Livrezon 1ye janvye'], guests_ht: 'Fanmi', lead_time_ht: 'Rezève anvan 20 desanm' }
};

const V = { 'Vanille': 'Vani', 'Chocolat': 'Chokola', 'Fraise': 'Frèz', 'Coco': 'Kokoye', 'Or': 'Lò', 'Rose': 'Woz', 'Blanc': 'Blan', 'Rouge': 'Wouj', 'Bleu': 'Ble', 'Brun': 'Mawon', 'Multicolore': 'Plizyè koulè', 'Petit': 'Piti', 'Moyen': 'Mwayen', 'Grand': 'Gwo', 'Petite': 'Piti', 'Moyenne': 'Mwayen', 'Grande': 'Gwo', 'Twoubadou': 'Twoubadou', 'Saxophone': 'Saksofòn', 'Chorale': 'Koral', 'DJ': 'DJ', '10 personnes': '10 moun', '20 personnes': '20 moun', '40 personnes': '40 moun', '2 étages': '2 etaj', '3 étages': '3 etaj', 'Petite boîte': 'Ti bwat', 'Grande boîte': 'Gwo bwat', '30 cm': '30 cm', '60 cm': '60 cm', '100 cm': '100 cm' };
export const variantHT = v => V[v];
export const ELEMENT_CATEGORIES_HT = { 'Pâtisserie': 'Patisri', 'Cadeaux': 'Kado', 'Fleurs': 'Flè', 'Services': 'Sèvis', 'Décoration': 'Dekorasyon' };
export const ELEMENTS_HT = {
  'Gâteau': 'Gato', 'Bouquet d’argent': 'Bouke lajan', 'Bouquet de fleurs': 'Bouke flè', 'Peluche': 'Pelich', 'Animation musicale': 'Animasyon mizikal', 'Transport': 'Transpò', 'Tableau personnalisé': 'Tablo pèsonalize', 'Ballons': 'Balon',
  'Photographe': 'Fotograf', 'Vidéaste et vidéo-souvenir': 'Videyograf ak videyo souvni', 'Musicien (twoubadou, saxophone…)': 'Mizisyen (twoubadou, saksofòn…)', 'Animateur pour enfants': 'Animatè pou timoun', 'Livraison express le jour même': 'Livrezon eksprès menm jou a',
  'Arche de ballons': 'Ak balon', 'Néon avec prénom': 'Neyon ak non an', 'Mur photo avec cadre': 'Mi foto ak kad', 'Banderole personnalisée': 'Banyè pèsonalize', 'Pétales et bougies LED': 'Petal flè ak bouji LED',
  'Table de desserts': 'Tab desè', 'Gâteau en étages': 'Gato plizyè etaj', 'Panier de produits locaux': 'Panye pwodui lokal', 'Chocolats': 'Chokola'
};
export const EQUIPMENT_HT = {
  'Chaise événementielle': 'Chèz pou evènman', 'Table ronde': 'Tab won', 'Système de sonorisation': 'Sistèm son', 'Tente 3 × 3 m': 'Tant 3 × 3 m', 'Arche décorative': 'Ak dekoratif',
  'Nappes et housses de chaise (lot de 10)': 'Nap ak kouvèti chèz (lo 10)', 'Vaisselle et verres (lot de 10)': 'Vesèl ak vè (lo 10)', 'Guirlandes lumineuses': 'Gilann limyè', 'Projecteur d’éclairage': 'Pwojektè limyè',
  'Groupe électrogène': 'Dèlko', 'Ventilateur sur pied': 'Vantilatè sou pye', 'Podium / estrade': 'Podyòm / estrad', 'Jeu gonflable pour enfants': 'Jwèt gonflab pou timoun'
};

/* ---------- Courriels ---------- */
export const LABELS = {
  fr: { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée', unpaid: 'Non payé', pending_verification: 'En vérification', paid: 'Payé', refunded: 'Remboursé' },
  ht: { pending: 'Ap tann', confirmed: 'Konfime', preparing: 'Ap prepare', in_progress: 'Ap fèt', completed: 'Fini', cancelled: 'Anile', unpaid: 'Poko peye', pending_verification: 'Ap verifye', paid: 'Peye', refunded: 'Ranbouse' }
};
export const MAIL = {
  fr: {
    hello: 'Bonjour', order: 'Commande', service: 'Prestation', date: 'Date de l’événement', items: 'Articles', amount: 'Montant', status: 'Statut', payment: 'Paiement',
    receiptTitle: 'REÇU DE PAIEMENT', received_amount: 'Montant encaissé', paidOn: 'Date', transaction: 'Transaction', adminValidation: 'Validation administrative',
    payOnline: 'Payer en ligne (MonCash, NatCash, Kashpaw)', space: 'Consultez votre espace client Magic Moments', thanks: 'Merci de votre confiance.',
    received: ['Commande reçue', 'Votre demande a bien été enregistrée.'],
    received_guest: ['Commande reçue', 'Votre demande a bien été enregistrée. Notre équipe vous recontacte par WhatsApp ou téléphone pour confirmer la disponibilité et le paiement.'],
    paylink: ['Lien de paiement disponible', 'Votre lien de paiement est disponible dans votre espace client.'],
    reference: ['Référence reçue', 'Votre paiement est en cours de vérification.'],
    receipt: ['Reçu de paiement', 'Votre paiement a été confirmé.'],
    paychange: ['Paiement mis à jour', 'Votre statut de paiement a changé.'],
    status_change: ['Commande : {s}', 'Votre commande est désormais : {s}'],
    payable: ['Commande confirmée — paiement en ligne', 'Votre commande est confirmée. Vous pouvez la régler en ligne avec le lien ci-dessous.'],
    live: ['Magic Live disponible', 'Connectez-vous à votre espace client pour rejoindre votre direct privé.'],
    reset: ['Réinitialisation du mot de passe', 'Une demande de réinitialisation du mot de passe a été faite pour votre compte.\nOuvrez ce lien dans l’heure pour choisir un nouveau mot de passe :', 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.']
  },
  ht: {
    hello: 'Bonjou', order: 'Kòmand', service: 'Fòmil', date: 'Dat evènman an', items: 'Atik', amount: 'Montan', status: 'Estati', payment: 'Peman',
    receiptTitle: 'RESI PEMAN', received_amount: 'Montan nou resevwa', paidOn: 'Dat', transaction: 'Tranzaksyon', adminValidation: 'Validasyon administrasyon an',
    payOnline: 'Peye sou entènèt (MonCash, NatCash, Kashpaw)', space: 'Gade espas kliyan Magic Moments ou', thanks: 'Mèsi paske ou fè nou konfyans.',
    received: ['Nou resevwa kòmand ou', 'Nou anrejistre demann ou an.'],
    received_guest: ['Nou resevwa kòmand ou', 'Nou anrejistre demann ou an. Ekip nou an ap kontakte w sou WhatsApp oswa nan telefòn pou konfime disponiblite ak peman an.'],
    paylink: ['Lyen peman disponib', 'Lyen peman ou disponib nan espas kliyan ou.'],
    reference: ['Nou resevwa referans lan', 'N ap verifye peman ou.'],
    receipt: ['Resi peman', 'Nou konfime peman ou.'],
    paychange: ['Peman mete ajou', 'Estati peman ou chanje.'],
    status_change: ['Kòmand : {s}', 'Kounye a, kòmand ou an : {s}'],
    payable: ['Kòmand konfime — peye sou entènèt', 'Kòmand ou konfime. Ou ka peye l sou entènèt ak lyen ki anba a.'],
    live: ['Magic Live disponib', 'Konekte nan espas kliyan ou pou w antre nan dirèk prive w la.'],
    reset: ['Chanje modpas', 'Yon moun mande pou chanje modpas kont ou an.\nLouvri lyen sa a nan inèdtan k ap vini an pou w chwazi yon nouvo modpas :', 'Si se pa ou ki fè demann sa a, pa okipe mesaj sa a : modpas ou pa chanje.']
  }
};

const MOIS = ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'];
const JOURS = ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'];
/** Date lisible à l'heure d'Haïti, en français ou en kreyòl. */
export function formatDate(v, lang = 'fr') {
  const d = new Date(v); if (Number.isNaN(d.getTime())) return v || '—';
  if (lang !== 'ht') return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Port-au-Prince' }).format(d);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Port-au-Prince', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return `${JOURS[wd]} ${p.day} ${MOIS[p.month - 1]} ${p.year} a ${p.hour}:${p.minute}`;
}
