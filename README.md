# Magic Moments — Render starter

Application web événementielle fonctionnelle (interface en français, API Express, PostgreSQL) avec identité violet/or, packages, comptes, demandes de surprises, cartes personnalisées, location de matériel, espace client et administration.

## Fonctionnel
- Inscription / connexion par email et mot de passe, session en cookie HTTP-only.
- Catalogue des packages avec prix en HTG (prix de démonstration).
- Commandes et messages de cartes, stockage PostgreSQL.
- Demandes de location, stock et contrôle de disponibilité lors de la confirmation.
- Tableau de bord administrateur, suivi de commandes, statuts de paiement saisis manuellement.
- Magic Live : lien HTTPS externe par commande, saisi par un administrateur (pas de streaming natif).

## Non inclus / à connecter avant exploitation commerciale
- **Pas de paiement en ligne réel** : aucun débit bancaire, MonCash ou NatCash n'est intégré. Les statuts de paiement sont saisis par l'administrateur, et ne sont pas une preuve bancaire.
- **Pas de diffusion vidéo native** : utiliser un service externe privé, avec consentement des participants, et renseigner le lien dans l'administration.
- Pas de moteur complet de devis, de notifications SMS, de facturation PDF, de stockage de photos, de livraison ni de comptabilité avancée.
- Les prix et stocks initiaux sont des **exemples** à adapter. L'application est un socle opérationnel de démonstration, pas une solution commerciale auditée.

## Déploiement sur Render
1. Extraire le ZIP et envoyer **le contenu du dossier** dans un dépôt GitHub privé.
2. Sur Render, sélectionner **New > Blueprint** et connecter le dépôt qui contient `render.yaml`.
3. Vérifier les plans choisis dans `render.yaml` (le web Starter et PostgreSQL Basic peuvent être payants).
4. Renseigner `ADMIN_EMAIL` et `ADMIN_PASSWORD` (12 caractères minimum). `JWT_SECRET` est généré automatiquement.
5. Déployer. Render installe les dépendances, démarre le serveur et crée automatiquement les tables et les données d'exemple.
6. Ouvrir l'URL du service Render. Connectez-vous avec les identifiants administrateur.

**Important** : ne pas partager `ADMIN_PASSWORD` ou `JWT_SECRET`. Si vous changez l'adresse administrateur, l'ancien compte administrateur n'est pas supprimé automatiquement : gérez sa révocation manuellement en base.

## Exécution locale
Prérequis : Node.js 20+, PostgreSQL.
```bash
cp .env.example .env
# Renseigner DATABASE_URL et JWT_SECRET dans .env
npm install
# charger les variables de .env (Node 20.6+)
node --env-file=.env src/server.js
```
Visiter http://localhost:3000.

## API
- `GET /health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`
- `GET /api/packages`, `GET /api/equipment`
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`
- `POST /api/rentals`, `GET /api/rentals`
- `GET /api/admin/stats`, `PATCH /api/admin/orders/:id`, `PATCH /api/admin/rentals/:id`

## Limites de sécurité avant lancement public
Ajouter un rate limiter, un système anti-CSRF (ou protection Origin stricte), un système d'email de vérification et réinitialisation de mot de passe, un journal d'audit des modifications administrateur, des contrôles renforcés sur les URLs de direct, une surveillance, une sauvegarde testée, une revue juridique et des tests de pénétration. Les cookies HTTP-only SameSite=Lax réduisent certains risques mais ne remplacent pas une protection CSRF.

## Structure
- `src/server.js` API, initialisation et contrôle d'accès
- `src/schema.sql` schéma PostgreSQL
- `public/` interface responsive
- `render.yaml` infrastructure Render
- `.env.example` exemple de configuration
