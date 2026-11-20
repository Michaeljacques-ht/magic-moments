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
