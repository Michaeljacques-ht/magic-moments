# Magic Moments autonome
Node.js 20+ uniquement. Aucune bibliothèque npm ni base externe. À la racine du dépôt: server.js, package.json, public/.
Render (service existant): Root Directory vide; Build Command `node --check server.js`; Start Command `node server.js`; Health Check `/health`. Supprimer DATABASE_URL et JWT_SECRET si souhaité (ignorées). NODE_ENV=production.
Au premier démarrage, le compte admin est créé automatiquement: ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum) sont facultatifs; en leur absence un mot de passe aléatoire est affiché une seule fois dans les logs privés. Ne pas publier ces logs. Les variables ne réinitialisent pas un compte existant.
Stockage JSON local créé automatiquement. Pour conserver les données sur Render, attacher un disque persistant (forfait compatible), monté sur /var/data et définir DATA_DIR=/var/data. Sans disque, les redémarrages/redéploiements peuvent effacer comptes et commandes. Une seule instance, pas de scaling horizontal. Sauvegarder régulièrement store.json dans un emplacement privé. Aucune migration des données PostgreSQL existantes.
Paiements: validation manuelle uniquement; aucun encaissement réel intégré. Magic Live: liens HTTPS privés fournis par un prestataire externe; aucune diffusion native. Catalogue de départ indicatif. Prototype à tester avant exploitation commerciale; pas d'audit de sécurité indépendant.

## V3
Même déploiement. Sauvegarder data/store.json et médias avant mise à jour. DATA_DIR doit pointer vers un disque persistant pour conserver les données. Un seul processus. Catalogue et galerie administrables. Options tarifées par unité. Les liens Pay’m sont fournis par le marchand pour chaque commande, et le paiement doit être vérifié dans le portail marchand avant de marquer payé. PLOPLOP_ALLOWED_HOSTS permet d'ajouter les domaines de checkout officiellement confirmés, séparés par virgules. Aucune API ou webhook Pay’m automatique implémenté faute de contrat technique. Reçus imprimables via navigateur. Vidéos MP4/WebM 20 Mo maximum. Ne pas publier sans consentement. Les demandes personnalisées hors options peuvent nécessiter un devis séparé. 

## V4
Catalogue sur mesure administrable et coordonnées requises. Les prix initiaux sont des exemples à modifier; les variantes ont un tarif commun par article (créer des articles distincts si tarifs différents). Le bouquet d’argent doit être tarifé selon sa valeur réelle avant vente. Magic Live ouvre un lien HTTPS externe renseigné par l’administrateur; aucun serveur vidéo natif. Les données V3 sont conservées si DATA_DIR est inchangé et persistant.

## V5 — Courriels transactionnels
Créer un compte Resend et vérifier un domaine expéditeur. Dans Render > Environment, ajouter RESEND_API_KEY (clé privée), MAIL_FROM (ex. Magic Moments <contact@votre-domaine.ht>, adresse vérifiée) et PUBLIC_URL (URL réelle du site). Aucun package npm ajouté. Les événements de commande alimentent une file persistée dans store.json; le serveur tente les envois toutes les 5 secondes, avec 5 tentatives maximum. Le journal admin indique l'acceptation par le fournisseur, pas la livraison en boîte de réception. Le reçu est inclus dans le corps du courriel après confirmation du paiement, pas en pièce jointe PDF. Sans configuration les messages restent en attente. Conserver DATA_DIR sur un disque persistant et sauvegarder avant déploiement. Les événements antérieurs à V5 ne sont pas réémis. Les échecs définitifs nécessitent une intervention technique.

## V6 — PWA
Installation via le bouton de la page d’accueil ou le menu du navigateur (Safari iOS : Partager → Sur l’écran d’accueil). HTTPS requis (Render le fournit). Le service worker met en cache uniquement les ressources de secours publiques ; aucune commande, session, réponse API ou vidéo privée n’est mise en cache. Hors connexion, une page de secours apparaît lors de la navigation. Les transactions et le direct restent en ligne uniquement. Les notifications push ne sont pas incluses ; les emails V5 sont conservés. Aucun nouveau paramètre Render requis. Sauvegarder les données avant redéploiement.

## V6.1 — Corrections
- Galerie : un fichier média manquant ne fait plus planter le serveur (404 propre) ; prise en charge des requêtes Range (lecture et avance rapide des vidéos sur iPhone/Safari) ; requêtes HEAD et cache navigateur.
- Sécurité : limitation des tentatives de connexion basée sur l'IP réelle du client derrière le proxy Render (auparavant tous les visiteurs partageaient la même limite) ; en-tête HSTS en production ; un en-tête Origin invalide renvoie 403 au lieu de 500.
- Mobile/PWA : menu de navigation visible et défilant sous 900 px (il était masqué) ; bouton « Installer l'application » lisible.
- Interface : statuts affichés en français (client et admin) ; journal des courriels chargé automatiquement et placé après les commandes ; une requête /api/orders en double supprimée.
- Performance : logo.png réduit de 1,7 Mo à ~200 Ko ; banner.png (2,1 Mo, inutilisé) retiré ; images servies avec cache 7 jours ; cache du service worker renommé v6-1.
Aucune nouvelle variable Render. Données store.json compatibles.

## V6.2 — Mot de passe oublié et alertes administrateur
- Mot de passe oublié : lien « Mot de passe oublié ? » dans la fenêtre de connexion. Le client reçoit un courriel avec un lien valable 1 heure et utilisable une seule fois (PUBLIC_URL/#reset=…). Après changement, toutes ses anciennes sessions sont fermées et il est connecté automatiquement. La réponse est identique que le courriel existe ou non. Le contenu des courriels envoyés est effacé de store.json après envoi.
- Prérequis : RESEND_API_KEY, MAIL_FROM et PUBLIC_URL (V5) doivent être configurés, sinon le lien reste en attente dans le journal admin.
- Alertes administrateur : nouvelle variable facultative ADMIN_NOTIFY_EMAIL (une ou plusieurs adresses séparées par des virgules). Un courriel est envoyé à chaque nouvelle commande et nouvelle demande de location. Sans cette variable, rien ne change.
- Dates des courriels affichées à l'heure d'Haïti. Journal des courriels limité aux 500 derniers envois terminés.

## Envoi vers GitHub (Windows)
Double-cliquer sur envoyer.bat : vérifie la syntaxe (si Node.js est installé), demande un message, puis fait commit et push. Au premier lancement, il demande l'adresse du dépôt GitHub. Le dossier data/ et .env ne sont jamais envoyés. Render redéploie automatiquement si Auto-Deploy est activé.

## V7 — Présentation professionnelle
Tout se règle dans le tableau de bord administrateur, sans toucher au code :
- **Coordonnées de l’entreprise** : WhatsApp, téléphone, courriel, adresse, zone desservie, horaires, Facebook/Instagram/TikTok (liens https), moyens de paiement, présentation et photo d’accueil. Elles alimentent la section Contact, le pied de page et le bouton WhatsApp flottant (masqué tant qu’aucun numéro n’est saisi ; un numéro à 8 chiffres reçoit l’indicatif 509).
- **Photos** : publier les réalisations dans la galerie, puis les associer à chaque formule et à l’accueil. Sans photo, la formule garde son pictogramme.
- **Formules enrichies** : « ce qui est inclus » (une ligne par élément), nombre d’invités, délai pour commander ; le prix s’affiche « À partir de ».
- **Témoignages** : section « Ce que disent nos clients » affichée seulement après l’ajout d’un premier avis. N’y mettre que des avis réels, avec l’accord du client.
- **Commande en 3 étapes** (surprise, livraison, carte) avec récapitulatif. Les visiteurs peuvent envoyer une demande **sans compte** : elle apparaît avec l’étiquette « Sans compte » et doit être suivie par WhatsApp ou téléphone (le client reçoit un courriel de confirmation). La location exige toujours un compte.
- Catégorie « Mariage » ajoutée ; les catégories sans formule active ne sont pas proposées aux visiteurs. Créer une formule Mariage pour qu’elle apparaisse.
- Mentions « démonstration » retirées ; alertes dans le tableau de bord pour ce qui manque encore (coordonnées, photos, avis).
Données existantes conservées (store.json compatible). Aucune nouvelle variable Render.

## V8 — Nouvelles offres
Ajoutées automatiquement au premier démarrage (une seule fois, sans doublon, données existantes conservées) :
- **7 catégories** : Surprise à distance (diaspora), Diplômes et réussites, Baptême et communion, Romance, Entreprise, Condoléances et soutien, Fêtes de saison.
- **23 formules** avec description, éléments inclus, nombre d’invités et délai : Bonjou Lakay, Lakay Premium, Panier gourmand Lakay, Réveil surprise, **Fête de diplômé**, Fierté du bachelier, Baptême et communion, Gender reveal, Demande en mariage, Cérémonie Élégance, Voiture des mariés, Dîner aux chandelles, Bouquet Romance, Cadeaux d’entreprise, Inauguration, Fête de fin d’année, Hommage, Panier réconfort, Saint-Valentin, Fête des mères, Fête des pères, Noël en famille, Jour de l’An — Soup joumou.
- **14 articles sur mesure** (photographe, vidéaste, musicien, animateur, arche de ballons, néon, mur photo, table de desserts, etc.) et **9 matériels de location** (arche, nappes et housses, vaisselle, guirlandes, projecteur, groupe électrogène, ventilateur, podium, jeu gonflable).
- Tout arrive **inactif, marqué « à tarifer »** : l’activation est refusée tant que le prix provisoire (1 HTG) n’est pas remplacé ; le matériel exige aussi un stock. Les formules de saison sont à activer quelques semaines avant chaque fête, puis à désactiver.
- Nouveau formulaire **Matériel de location** dans le tableau de bord (ajouter, modifier, stock, prix, activer).
- Section **« Vous vivez à l’étranger ? »** affichée dès qu’une formule diaspora est active.

## V9 — Bilingue français / kreyòl et paiement en ligne PlopPlop
**Langues.** Bouton « Kreyòl / Français » dans l’en-tête ; le choix est mémorisé sur l’appareil. Toute l’interface publique est traduite (dictionnaire : public/i18n.js). Le catalogue de départ (formules, catégories, articles, matériel) a reçu sa version kreyòl (kreyol.js), appliquée seulement aux textes français non modifiés. Pour vos propres textes, remplissez les champs « kreyòl » du tableau de bord (formules, catégories, articles, matériel, coordonnées). Un texte sans traduction s’affiche en français ; une alerte le signale. Les courriels au client partent dans la langue choisie lors de la commande. Le tableau de bord reste en français.

**Paiement PlopPlop.** Repris de Konekte (plopplop.js) : passerelle plopplop.solutionip.app, MonCash, NatCash et Kashpaw.
1. Dans Render > Environment, ajouter PLOP_CLIENT_ID et PLOP_CLIENT_SECRET (les mêmes identifiants marchands que Konekte, ou ceux d’un compte dédié). PLOP_HOTE est facultatif.
2. Le client peut payer dès que l’équipe a confirmé la commande (statut autre que « En attente »). Il reçoit un courriel avec un lien privé de paiement (fonctionne aussi sans compte) ; un client connecté a le bouton « Payer maintenant » dans son espace.
3. Montant payé : « Montant à payer » saisi par l’administrateur sur la commande, sinon le montant estimatif. Minimum 20 HTG.
4. La commande passe à « Payé » automatiquement après vérification auprès de la passerelle ; reçu envoyé au client et alerte à l’administrateur. Un paiement non vérifié au retour du client est rattrapé automatiquement toutes les 15 minutes.
5. Bouton « Copier le lien de paiement client » sur chaque commande, pour l’envoyer par WhatsApp.
Sans identifiants PlopPlop, le paiement manuel (lien + référence déclarée) reste actif.

## V10 — Photos des formules et corrections
- **Photos des formules** : dans « Créer / modifier une formule », importer une photo vignette (affichée sur la carte) et jusqu’à 12 autres photos, directement depuis l’ordinateur ou le téléphone. Les photos sont réduites automatiquement (1600 px, JPEG) avant l’envoi. Les visiteurs voient « 📷 n photos » sur la carte et parcourent les photos dans une visionneuse (flèches, clavier, glissement mobile). Penser à cliquer « Enregistrer » après l’import.
- **Photo d’accueil** : importable directement dans « Coordonnées de l’entreprise » (plus besoin de passer par la galerie).
- **En-tête** : les liens ne se coupent plus sur deux lignes ; sous 1180 px, le menu passe en bande défilante sous le logo.
- Les textes d’exemple des champs sont en gris clair italique pour ne pas être confondus avec du contenu.
- Ces photos ne sont pas publiées dans « Réalisations » ; la galerie reste réservée aux événements passés.

## V11 — « Nos surprises » et configurateur « Créer une surprise »
- « Nos formules » devient **« Nos surprises »** (menu, accueil, catalogue), en français et en kreyòl.
- **Créer une surprise** : par défaut, le client compose tout lui-même. Il parcourt les éléments par dimension (Pâtisserie, Fleurs, Cadeaux, Décoration, Services… — onglets filtrables), clique « Ajouter », puis fait ses choix (taille, saveur, couleur, extras…), règle la quantité et ajoute une précision. Le sous-total de chaque élément, le récapitulatif « Votre surprise » et le montant total changent à chaque choix. Il peut aussi basculer sur « Je pars d’une surprise prête ».
- Le serveur recalcule lui-même tous les prix à partir du catalogue : un prix envoyé par le navigateur est ignoré.
- **Administration — « Éléments pour Créer une surprise »** : pour chaque élément, saisir le nom (+ kreyòl), la dimension (+ kreyòl), une description, le prix de base (0 possible), une photo, et autant de **choix** que nécessaire. Chaque choix : nom (+ kreyòl), type « un seul choix » ou « plusieurs choix possibles », obligatoire ou non, et ses options, une par ligne : `Nom | Nom kreyòl | Supplément HTG` (ex. `Grand | Gwo | 3000`).
- Migration automatique : les anciennes couleurs/saveurs et tailles deviennent des choix « Couleur / saveur » et « Taille » avec un supplément à 0 HTG — **à ajuster** pour que le prix varie selon la taille.
- La commande, le courriel, le reçu et le tableau de bord indiquent les choix du client et leurs suppléments.

## V12 — Espace d’administration séparé, RH, comptabilité, navigation mobile
**Administration : https://votre-site/admin** (bouton « Administration » dans l’en-tête une fois connecté en administrateur). Le tableau de bord n’est plus mélangé au site public.
- **Tableau de bord** : recettes, dépenses et résultat du mois, trésorerie, montants à encaisser, salaires à payer ; liste « À faire » (commandes à confirmer, paiements à vérifier, candidatures, éléments à tarifer) ; événements des 7 prochains jours ; graphique sur 6 mois.
- **Commandes** : recherche et filtres (à traiter, à confirmer, payées…), détail repliable, statut, montant à payer, lien Magic Live, lien de paiement à copier, bouton WhatsApp client, reçu.
- **Catalogue** : surprises prêtes, éléments à composer, catégories, matériel de location — édition dans une fenêtre, photos et version kreyòl incluses.
- **Site et contenu** : coordonnées, **diaporama d’accueil** (10 photos ou affiches qui défilent, légendes FR/KR, ordre modifiable), **annonces** (bande défilante sous le menu, dates de début et de fin, lien), réalisations, témoignages.
- **Ressources humaines** : offres d’emploi publiées dans « Carrières » ; candidatures avec CV, statuts (nouvelle, présélectionnée, entretien, embauchée, refusée) et notes ; bouton « Embaucher » qui crée la fiche employé ; fiches du personnel (contrat, salaire mensuel ou journalier, mode de paiement) ; avances sur salaire ; paie mensuelle (préparation automatique, primes, retenues, déduction des avances, versement, fiche de paie imprimable).
- **Comptabilité** : comptes de trésorerie (caisse, MonCash, NatCash, banque, PlopPlop, + vos comptes) avec solde d’ouverture ; journal des recettes, dépenses et virements avec pièces justificatives (photo ou PDF) ; écritures **automatiques** pour les commandes payées, les remboursements, les salaires et les avances ; synthèse par période (résultat, soldes, catégories, 12 mois) ; **export Excel (CSV)**.
- **Paramètres** : état du paiement en ligne et des courriels, journal des courriels.

**Site public**
- Téléphone : en-tête compact (logo, langue, bouton menu) et **menu tiroir** ; **barre de raccourcis en bas** (Accueil, Surprises, Créer, Location, Compte).
- **Diaporama** des photos et affiches à l’accueil (défilement automatique, glissement du doigt).
- **Bande d’annonces** défilante (fermable par le visiteur).
- **Carrières** : liste des postes ouverts et candidature en ligne avec CV (PDF, Word ou photo).
- Moins de défilement : sections « Nos atouts » et « Magic Live » fusionnées ailleurs, catalogue / réalisations / avis / matériel en carrousels horizontaux sur téléphone, configurateur ouvert sur la première dimension, formulaire de location replié, espace client affiché seulement une fois connecté.
- Les fichiers privés (CV, pièces comptables) sont stockés dans le dossier de données et téléchargeables uniquement par l’administrateur.
Données existantes conservées ; la photo d’accueil actuelle devient la première image du diaporama.

## V13 — Administration : un seul menu vertical
- La rangée d’onglets horizontaux est supprimée : les sous-sections (Surprises prêtes, Éléments, Annonces, Recrutement, Paie, Journal…) s’affichent dans le menu vertical, sous la rubrique ouverte. Le titre de la page indique la sous-section affichée.
- Compte administrateur sur le site public : un seul bouton « Administration » (plus de « Mon espace », « Bonjour… », « Déconnexion » ni d’espace client en doublon). Un administrateur qui se connecte depuis le site arrive directement dans /admin ; le raccourci « Compte » du téléphone y mène aussi.

## V14 — Location multi-matériels, cookies et visites, FAQ
- **Location** : une demande peut contenir plusieurs matériels. Le client clique « Ajouter » sur chaque matériel (ou « ＋ Ajouter un autre matériel »), règle les quantités, les dates, la ville, l’adresse et une précision ; le détail et l’estimation se calculent automatiquement. L’administrateur voit chaque matériel, la durée et l’estimation ; la confirmation vérifie le stock de chaque matériel.
- **Cookies** : bandeau Accepter / Refuser au premier passage, lien « Cookies » en bas de page et réglage dans la FAQ. Cookie nécessaire : la session. Cookie de mesure d’audience (mm_vid) seulement après acceptation.
- **Visites et connexions** (administration → 📍) : pour les visiteurs qui acceptent, pays, région, ville, heure, appareil (téléphone, tablette, ordinateur, modèle), système, navigateur, pages vues et provenance ; connexions aux comptes (nom, lieu, appareil, adresse IP) toujours enregistrées pour la sécurité. Statistiques par période, graphiques et export Excel (CSV). Localisation approximative par l’adresse IP via le service ipwho.is (désactivable avec la variable GEO_LOOKUP=off), sinon par le fuseau horaire. Adresses IP des visiteurs anonymisées ; données conservées 180 jours.
- **Accueil** : « Créez des moments magiques et inoubliables pour vos proches. » (FR/KR).
- **FAQ** : page /faq (recherche, rubriques, réponses dépliables, français/kreyòl, réglage des cookies, contact WhatsApp), liens dans le menu et le pied de page. 11 questions de départ, modifiables dans Administration → Site et contenu → FAQ.
- Correction : sur téléphone, la barre de raccourcis ne recouvre plus les fenêtres (connexion, paiement, carrières).

## V15 — Nouveau logo et vignettes du matériel
- **Logo** : nouveau logo « Magic Moments — Gestion événementielle ». En-tête du site et de la FAQ passés en blanc pour le mettre en valeur ; logo dans le menu téléphone, le pied de page, la page de connexion de l’administration (version complète) et le menu de l’administration (emblème « M »). Icônes de l’application installable, favicon et icône iPhone refaites avec l’emblème « M » ; écran de démarrage blanc. Fichiers : logo.png (complet, image de repli de l’accueil), logo-header.png, logo-mark.png, icon-192/512.png, apple-touch-icon.png, favicon.png.
- **Matériel de location** : vignette (photo) importable dans Administration → Catalogue → Matériel de location ; affichée sur les cartes du site et dans la liste de l’administration.

## Version 16 — Paiement des locations, courriels Brevo et suivi par étapes

### Paiement en ligne des locations
- Les locations ont maintenant leur statut de paiement, un **lien de paiement privé** (`/#payer-location=…`) et le bouton **« Payer maintenant »** dans l’espace client, via PlopPlop (MonCash, NatCash, Kashpaw).
- Le paiement s’ouvre après confirmation par l’équipe ; le montant est l’estimation ou le **montant à payer** fixé par l’administrateur.
- Paiement confirmé automatiquement (retour client + rattrapage toutes les 15 min), écriture comptable « Locations de matériel », remboursement géré.

### Parcours en plusieurs étapes
- **Surprises** : Demande reçue → Confirmée (à payer) → Paiement reçu → En préparation → En livraison → Livrée (ou Annulée).
- **Locations** : Demande reçue → Confirmée (à payer) → Paiement reçu → Livrée et installée → Récupérée — terminée (ou Annulée).
- Le client voit une **frise de suivi** sur chaque commande et location ; chaque courriel rappelle aussi où en est la demande.

### Courriels automatiques à chaque étape (Brevo)
- Un courriel part au client à chaque étape, dans sa langue (français ou kreyòl), avec les détails, le lien de paiement quand il faut payer et le reçu après paiement.
- Textes modifiables dans **Administration → Paramètres → Messages par étape** (objet, courriel, WhatsApp, version kreyòl, activation par étape, retour au texte d’origine). Variables : `{client}`, `{objet}`, `{destinataire}`, `{date}`, `{fin}`, `{ville}`, `{adresse}`, `{montant}`, `{lien_paiement}`, `{ref}`, `{site}`, `{whatsapp}`.
- Variables Render → Environment :
  - `BREVO_API_KEY` : clé API Brevo (SMTP & API → Clés API).
  - `MAIL_FROM` : adresse d’expédition **validée dans Brevo**, ex. `Magic Moments <contact@votredomaine.com>`.
  - `MAIL_FROM_NAME` (facultatif) : nom affiché, par défaut « Magic Moments ».
  - `PUBLIC_URL` : adresse du site (liens dans les courriels).
- Si `BREVO_API_KEY` est absent, Resend (`RESEND_API_KEY`) reste utilisable.

### Messages WhatsApp pré-enregistrés
- Dans chaque commande ou location : bouton **« 💬 Étapes et WhatsApp »** → frise des étapes et message prêt pour chaque étape, avec boutons **WhatsApp client**, **WhatsApp destinataire** (livraison des surprises, sans dévoiler la surprise) et **Copier**.
- Le formulaire de location demande désormais un numéro WhatsApp pour le suivi.

## Version 17 — Acompte, moyens de paiement et playlist YouTube

### Acompte dès la demande
- À l’envoi du formulaire (surprise ou location), le client peut payer tout de suite un **acompte** (60 % par défaut) pour réserver sa date ou bloquer le matériel. Une case cochée par défaut l’y invite et la fenêtre de paiement s’ouvre juste après l’envoi.
- Le client peut aussi payer la totalité. Le **solde** se règle après confirmation par l’équipe (bouton « Payer le solde » dans l’espace client, lien envoyé par courriel et WhatsApp).
- Suivi précis : montant total, déjà payé, reste à payer ; statut « Acompte payé ». Chaque versement a son écriture comptable (Acompte / Solde) et son reçu par courriel ; nouveau message « Acompte reçu » dans Messages par étape (variables `{acompte}`, `{total}`, `{deja_paye}`, `{reste}`).

### Moyens de paiement (Paramètres → Moyens de paiement)
- **Acompte** : activé ou non, pourcentage réglable (10 à 100 %).
- **Paiement en ligne PlopPlop** (MonCash, NatCash, Kashpaw, confirmation automatique) : activable.
- **Transfert direct** sur vos comptes MonCash, NatCash, bancaires ou autres (numéro, titulaire, banque, consigne) : le client envoie l’argent, déclare le numéro de transaction et peut joindre une capture ; l’équipe clique sur **« Confirmer la réception »** ou « Refuser » dans la fiche.
- **Espèces à la livraison** : indiqué aux clients ; l’équipe enregistre l’encaissement avec **« Encaisser un montant »** (espèces, MonCash, NatCash, banque).

### Musiques importées depuis YouTube
- Catalogue → **Musiques (YouTube)** : collez un ou plusieurs liens YouTube, choisissez une catégorie ; titre et artiste sont récupérés automatiquement (modifiables), musique masquable ou supprimable.
- Dans le formulaire de commande, le client ouvre **« Choisir dans notre playlist »**, écoute un extrait et choisit la musique de sa surprise (ou écrit un autre titre). L’administration voit la musique choisie avec un lien d’écoute.
- Rien n’est téléchargé : la musique reste sur YouTube (lecture intégrée via youtube-nocookie.com).

## Version 18 — Plus besoin de compte client (suivi façon Konekte)

- **Commandes et locations sans compte** : le client donne son nom, son téléphone / WhatsApp et, de préférence, son courriel. Chaque demande reçoit une **référence** (MM-XXXXXXXX pour une surprise, LOC-XXXXXXXX pour une location), affichée à l’envoi et rappelée dans chaque courriel.
- **Suivre ma commande** (bouton du menu, raccourci « Suivi » en bas de l’écran) :
  1. **Référence + téléphone** : l’étape, le paiement, le bouton pour payer (acompte, totalité ou solde) et le reçu s’affichent tout de suite.
  2. **Téléphone ou courriel** : un **code à 6 chiffres** part par courriel ; une fois saisi, le client retrouve toutes ses commandes et locations (session de 30 jours sur cet appareil, bouton « Se déconnecter »).
  3. **Cet appareil se souvient** des demandes envoyées depuis lui (bouton « Oublier cet appareil »).
- Les courriels contiennent un **lien de suivi direct** (`/#suivre=…`) qui ouvre la demande sans rien saisir ; variable `{lien_suivi}` disponible pour les messages WhatsApp.
- **Reçus** consultables et imprimables sans compte, avec le détail des versements (acompte, solde).
- Les anciens comptes clients continuent de fonctionner (leurs demandes apparaissent aussi via leur courriel) ; seule l’équipe se connecte, depuis `/admin`.
- Les codes de connexion partent en priorité dans la file des courriels.

### V18.1
- Titres réduits (accueil et sections) pour une lecture plus confortable sur ordinateur et téléphone.
- V18.2 : mentions « Demande sans création de compte » et « Confirmation par notre équipe » retirées de l’accueil.

## Version 19 — Cadeau express (livré le jour même)

- Nouvelle section **⚡ Cadeau express** (menu, bouton de l’accueil, menu mobile) : le client choisit un cadeau prêt à partir, indique le destinataire, la ville, l’adresse, un **créneau de livraison d’aujourd’hui** et un mot pour la carte, puis **paie la totalité** (frais express inclus). Aucun compte nécessaire : référence, reçu et suivi par courriel.
- Les créneaux proposés tiennent compte de l’heure d’Haïti et du délai de préparation ; après l’heure limite (ou quand le quota du jour est atteint), la section indique de revenir le lendemain ou de planifier une surprise.
- **Paramètres → Cadeau express** : activation, heures de livraison, heure limite pour commander, durée des créneaux, délai de préparation, frais express, nombre maximum de livraisons par jour, villes desservies et choix des cadeaux proposés (aussi via la case « Cadeau express » d’une formule).
- Côté équipe : alerte prioritaire « ⚡ CADEAU EXPRESS », badge et ligne dans le tableau de bord, étiquette « ⚡ Express aujourd’hui · créneau » et filtre « Cadeaux express » dans les commandes (affichées en premier).

## Version 20 — Boutique de cadeaux

- Nouvelle section **🛍️ Boutique** (menu, menu mobile) : articles prêts à offrir avec photo, description, prix et stock, filtres par catégorie et recherche, badges « Coup de cœur » et « Plus que N ».
- **Panier** (bouton flottant 🛒, mémorisé sur l’appareil) : quantités, **livraison** (frais, gratuite dès un montant) ou **retrait sur place**, date, cadeau pour quelqu’un d’autre (destinataire et téléphone), mot sur la carte, **emballage cadeau** en option. Paiement de la totalité, sans compte ; courriel récapitulatif avec lien de paiement et de suivi.
- Chaque achat devient une commande « 🛍️ Boutique » : étapes, paiement, reçus, WhatsApp et suivi comme les surprises ; recette comptable « Ventes boutique ».
- **Stock** réservé à la commande, rendu si elle est annulée ; commandes non payées sous 48 h annulées automatiquement.
- **Catalogue → Boutique de cadeaux** : réglages (ouverture, livraison, frais, livraison offerte, retrait et adresse, délai minimum, emballage) et articles (nom FR/KR, catégorie, prix, stock, description, photo, mise en avant, en vente ou masqué). 10 articles d’exemple à adapter (prix et stock indicatifs). Alerte au tableau de bord quand un article est presque épuisé ; filtre « Boutique » dans les commandes.

### V20.1 — Articles de la boutique dans une surprise
- À l’étape 1 de « Créer une surprise » (composition libre ou surprise prête), le client peut ajouter des articles de la boutique avec leur quantité : prix ajouté au total, lignes « 🛍️ » dans le récapitulatif, la commande, les courriels et les reçus.
- Stock vérifié et réservé à la commande, rendu si elle est annulée ; une surprise peut aussi être composée uniquement d’articles de la boutique.

## Version 21 — Gestion de stock

- Nouveau menu **📦 Stock** dans l’administration (badge = articles sous le seuil d’alerte) :
  - **État du stock** : articles de la boutique, matériel de location et fournitures internes au même endroit ; stock, seuil d’alerte, coût d’achat, **valeur du stock**, filtres (famille, recherche, « à réapprovisionner ») et actions **Entrée**, **Sortie**, **Perte / casse**, **Inventaire** (quantité comptée → écart enregistré), réglage du seuil et du coût, historique de l’article. Export **CSV**.
  - **Mouvements** : journal daté de chaque variation (avant → après, motif, coût, fournisseur, auteur, référence de commande).
  - **Fournitures** : consommables internes (ballons, hélium, papier cadeau, rubans, cartes, bougies…) avec unité, seuil, coût et fournisseur ; 6 fournitures d’exemple.
- Une **entrée de stock** peut créer automatiquement la dépense en comptabilité (« Achats de marchandises », « Achat de matériel » ou « Achats de fournitures »), depuis le compte choisi ; le coût unitaire est mis à jour.
- Les **ventes de la boutique**, les articles ajoutés aux surprises, les **annulations** et les modifications de fiches sont tracés automatiquement.
- Tableau de bord : alerte « article(s) à réapprovisionner ».

## Version 22 — Espace employé

- Nouvelle adresse **/equipe** (adaptée au téléphone) pour le personnel, avec un compte relié à la fiche de l’employé :
  - **Accueil** : bouton **Pointer mon arrivée / mon départ**, temps travaillé du jour, prochaines tâches.
  - **Tâches** : consignes, échéance, priorité, commande ou location liée (destinataire, adresse, articles, mot de la carte, téléphones à appeler, itinéraire Google Maps) ; boutons « Je commence », « Terminé », « Note ».
  - **Heures** : pointages du mois, heures travaillées et validées, jours travaillés.
  - **Paie** : rémunération, fiches de paie (base, primes, retenues, avances, net, statut) et avances.
  - **Profil** et changement de mot de passe.
- **Administration → Ressources humaines** :
  - **Personnel** : bouton « 🔑 Créer l’accès » (invitation par courriel avec lien d’activation valable 7 jours, aussi copiable pour WhatsApp), renvoi de l’invitation, accès coupé ou rétabli, dernière connexion, badge « Au travail ».
  - **Tâches** : création, assignation à un ou plusieurs employés, priorité, échéance, lien vers une commande ou une location, suivi des commentaires ; l’employé reçoit un courriel ; bouton « 📋 Confier une tâche » dans chaque commande et location ; alerte quand une tâche est terminée.
  - **Heures et pointage** : pointages du mois par employé, validation ou refus (un par un ou tout d’un coup), correction et saisie manuelle (pause comprise), totaux par employé.
  - La **paie journalière** utilise automatiquement les jours validés du mois.
- Les comptes employés n’ont aucun accès à l’administration ; un compte désactivé est déconnecté immédiatement.

### V22.1
- Bouton **Se connecter** (👤) rétabli dans l’en-tête et le menu mobile : clients avec compte, employés (redirigés vers /equipe) et administration ; bouton Déconnexion et « Bonjour … » une fois connecté.
- Accueil sur téléphone : les 3 boutons (Voir nos surprises, Composer ma surprise, Cadeau express) sont empilés sur toute la largeur, sans débordement ; en-tête ordinateur resserré pour tout afficher.

## Version 23 — Une page à la fois
- Chaque entrée du menu (ordinateur, menu mobile, raccourcis du bas, boutons et liens internes) affiche **uniquement sa page** : Accueil, Cadeau express, Boutique, Nos surprises, Créer une surprise, Location, Réalisations, Contact, Suivre ma commande. Le site ne défile plus d’une section à l’autre ; chaque page s’ouvre en haut.
- La page ouverte est mise en évidence dans le menu ; les boutons Précédent/Suivant du navigateur et les liens reçus (paiement, suivi) fonctionnent.

## Version 24 — Services inclus
- « Créer une surprise » : les onglets Tout / Pâtisserie / Cadeaux / Fleurs / Services / Décoration sont retirés ; les éléments s’affichent à la suite par catégorie.
- Nouvelle section facultative **🎶 Services inclus**, juste après « Ajoutez des cadeaux de la boutique », pour les deux façons de commander (composition libre ou surprise prête) : livraison, animation musicale, décoration… avec options, quantité, prix ajouté au total et au récapitulatif.
- Les éléments des catégories Services et Décoration y sont placés automatiquement ; l’élément « Transport » devient « Livraison ». Une case « Service inclus » dans la fiche d’un élément (Catalogue → Éléments) permet de choisir ce qui apparaît dans cette section.

### V24.1
- « Je compose tout moi-même » : la liste d’éléments (Gâteau, Bouquet d’argent, Peluche…) et le bloc « Votre surprise » sont retirés ; la composition se fait avec les **cadeaux de la boutique** et les **Services inclus**. Une surprise composée peut contenir uniquement des articles de la boutique.
- V24.2 : la section **⚡ Cadeau express** s’affiche aussi sur la page d’accueil (sous la présentation), en plus de sa propre page.

## Version 25 — Partage sur les réseaux sociaux

- Bouton **↗ Partager** sur chaque carte : surprises (Nos surprises et Cadeau express), articles de la boutique et matériel de location.
- Fenêtre de partage : aperçu (photo, nom, prix), **WhatsApp, Facebook, Messenger (téléphone), X, Telegram, LinkedIn, courriel**, copie du lien et, sur téléphone, « Autres applications » (Instagram, SMS… via le partage du téléphone).
- Chaque partage utilise un lien dédié (`/p/s/…`, `/p/b/…`, `/p/l/…`) avec balises **Open Graph / Twitter** : les réseaux affichent la **photo** de l’article (ou le logo s’il n’a pas de photo), le **nom**, la **description**, ce qui est **inclus** et le **prix** ; en kreyòl si le site est en kreyòl.
- La personne qui clique arrive sur la bonne page du site, la fiche partagée mise en avant.
- Important : `PUBLIC_URL` doit contenir l’adresse publique du site (Render → Environment) pour que les photos s’affichent dans les aperçus.

## Version 26 — Décoration événement

- Nouvelle page **🎈 Décoration** (menu, menu mobile) pour vendre la décoration événementielle : anniversaire, mariage, baby shower, baptême, communion, graduation, fiançailles, fête d’entreprise, fête religieuse, gender reveal…
  - **Formules** (photo, galerie, type d’événement, nombre d’invités, ce qui est inclus, prix de départ), filtres par type d’événement, mise en avant, bouton Partager.
  - **Demande de devis** : formule ou décoration sur mesure, type d’événement, personne fêtée, date et heure, invités, lieu (domicile, salle, extérieur, église, hôtel, entreprise), ville et adresse, thème, couleurs, lien d’inspiration, **options à la carte** (arche, photobooth, centres de table par table, housses par chaise, éclairage, tapis rouge, lettres lumineuses, fleurs…) et estimation en direct. Aucun compte nécessaire ; suivi par référence.
- La demande devient une commande **🎈 Décoration** : alerte détaillée, courriel au client, fiche avec tous les détails ; l’équipe indique le **devis final** (Montant à payer), confirme (lien d’acompte), confie le montage (tâches), puis suit les étapes jusqu’à la fin. Recette comptable « Décoration événementielle ».
- **Catalogue → Décoration événement** : activation, délai minimum, note de déplacement, formules (FR/KR, photos, inclus) et options (prix, unité). 6 formules et 8 options d’exemple à adapter.
- En-tête ordinateur : le lien FAQ passe dans le menu ☰ et le pied de page sur les écrans moyens pour laisser la place à « Décoration ».

## Version 27 — Menu simplifié
- « Créer une surprise » est retiré du menu : la page **Nos surprises** propose un bouton **✨ Créer une surprise** et un bandeau « Envie d’une surprise unique ? » qui ouvrent la création (le raccourci « Créer » du téléphone reste). « Nos surprises » reste en surbrillance pendant la création.
- « FAQ » est retiré du menu : les **questions fréquentes** s’affichent dans la page **Contact** (recherche, réponses dépliables, français/kreyòl), avec un lien vers la page FAQ complète. Le lien `#faq` ouvre directement cette partie.
- Réponse FAQ « Dois-je créer un compte ? » mise à jour (plus aucun compte nécessaire).
- V27.1 : le bouton de connexion affiche « Se connecter » en toutes lettres (ordinateur et téléphone).
- V27.2 : envoyer.bat corrige seul une adresse GitHub invalide (guillemets, espaces, « compte/dépôt » sans https, caractères parasites) et utilise par défaut https://github.com/Michaeljacques-ht/magic-moments.git ; il suffit d’appuyer sur Entrée lors du premier envoi.
