# Comptoir de cote horlogère

Cote de revente, demande, offre, hype et indice de risque de montres d'occasion (Tudor, IWC, Seiko), **mis à jour automatiquement toutes les 6 heures** par GitHub Actions.

**Site :** https://benhadjyoussefo0-dot.github.io/-comptoir-cote/ (l'adresse suit le nom du dépôt : s'il est renommé, elle change aussi)

On tape une marque, un modèle ou une référence, et le site affiche :

- la cote par état (neuve, excellent état complète, très bon état, sans boîte ou papiers, montre seule) ;
- le marché en direct : annonces actives, prix demandés médians, offres et demandes sur Reddit, taux d'écoulement, courbe de la cote ;
- la demande, la pression de l'offre et la hype, chacune sur 100 ;
- un indice de risque de revente sur 100, avec le détail de son calcul ;
- un verdict (flip, attendre, passer), le prix d'achat cible et maximal, le seuil de rentabilité et un calculateur de marge ;
- la fiche technique et revente : calibre, révision, garantie, points d'authentification, pièges, générations.

Chaque indicateur porte l'étiquette **direct** (calculé à partir des annonces) ou **étude** (valeur de l'étude du 1er novembre 2026, utilisée tant que les annonces ne suffisent pas).

## Comment les données se mettent à jour

```
Toutes les 6 h ─► GitHub Actions ─► BCE (taux de change, sans clé)
                                 ├► eBay France, Allemagne, États-Unis (API Browse, annonces actives)
                                 └► Reddit r/Watchexchange (annonces [WTS] et [WTB], 30 derniers jours)
                         │
                         ▼
        data/market.json, data/history.json (un point par jour)
                         │
                         ▼
        GitHub Pages republie le site ; une page ouverte se rafraîchit toute seule toutes les 10 minutes
```

- **Cote :** elle part de la cote de l'étude, puis se rapproche à chaque passage de la médiane des prix demandés en occasion, moins 8 % (un prix demandé surestime le prix de vente de 5 à 15 %). Plus il y a d'annonces, plus elle bouge, avec au plus 60 % de l'écart absorbé par passage.
- **Délai de vente :** une annonce eBay qui disparaît avant sa date de fin est comptée comme « écoulée » (vendue ou retirée). Son ancienneté donne le délai de vente estimé, dès 5 annonces écoulées.
- **Tendances :** sur 30 jours dès le premier mois de suivi. La tendance sur 12 mois et la volatilité sont calculées par l'historique dès qu'il est assez long ; avant, ce sont les valeurs de l'étude.
- **Chrono24 se relève à la main :** il n'a pas d'interface publique et bloque les robots, y compris ceux qui tournent sur les serveurs de GitHub. Ses prix entrent dans la cote par les relevés copiés-collés depuis votre navigateur (voir « Ajouter les prix Chrono24 »).

Ce n'est pas du temps réel à la seconde. Aucune source gratuite et autorisée ne le permet pour les montres d'occasion.

## Mise en route (une seule fois)

### 1. Activer GitHub Pages

Dépôt → **Settings** → **Pages** → **Source : GitHub Actions**.

### 2. Clés eBay (gratuites)

1. Créez un compte sur [developer.ebay.com](https://developer.ebay.com/).
2. Dans **Application Keys**, créez un jeu de clés **Production**.
3. eBay demande de configurer les notifications de suppression de compte, ou de déclarer une exemption. Choisissez l'exemption : ce projet ne stocke aucune donnée d'utilisateur eBay.
4. Dans le dépôt : **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :
   - `EBAY_CLIENT_ID` : l'App ID (Client ID) ;
   - `EBAY_CLIENT_SECRET` : le Cert ID (Client Secret).

### 3. Clés Reddit (uniquement si vous en avez déjà)

Reddit n'accepte plus de nouvelles demandes d'accès à son API depuis le 31 octobre 2026, et coupe l'accès public restant en mars 2027. Sans clé, la source Reddit reste vide et le site s'appuie sur eBay et sur l'étude.

Si vous disposez déjà d'une application Reddit approuvée de type **script** :

1. Ajoutez les secrets :
   - `REDDIT_CLIENT_ID` : la chaîne sous le nom de l'application ;
   - `REDDIT_CLIENT_SECRET` : le « secret ».
2. Facultatif : ajoutez une **variable** (pas un secret) `REDDIT_USER_AGENT`, par exemple `comptoir-cote:v1.0 (by /u/votre_pseudo)`.

### 4. Facultatif : clé Claude

Ajoutez le secret `ANTHROPIC_API_KEY`. Quand vous ajoutez une montre, Claude remplit alors sa fiche : calibre, prix de départ estimé, points d'authentification, pièges et mots-clés de recherche. Sans clé, une fiche minimale est créée et la cote démarre avec les premières annonces.

### 5. Premier lancement

**Actions** → **Mise à jour du marché** → **Run workflow**. Ensuite, la mise à jour se lance seule toutes les 6 heures.

Chaque source est facultative. Sans clé, le site fonctionne avec les valeurs de l'étude et le taux BCE, et indique « non configurée » pour la source manquante.

## Ajouter une montre au suivi

**Actions** → **Ajouter une référence** → **Run workflow** : saisissez la marque, le modèle et la référence (plus, au besoin, un prix de départ ou une requête eBay plus précise). La montre apparaît sur le site environ 2 minutes plus tard.

On peut aussi modifier `data/references.json` à la main. Chaque fiche contient :

- `queries` : les requêtes envoyées à eBay et Reddit ;
- `match.any` et `match.none` : les mots qu'un titre d'annonce doit contenir ou ne pas contenir. C'est ce qui évite de mélanger une 79030N et une 79030B.

## Ajouter les prix Chrono24

Sur la fiche d'une montre, section **Relevé Chrono24** :

1. Cliquez sur **Ouvrir la recherche … sur Chrono24** : la recherche s'ouvre déjà réglée sur la référence. Filtrez l'état ou la boîte et les papiers si besoin.
2. Sur la page de résultats, sélectionnez tout et copiez : **Ctrl+A** puis **Ctrl+C** (Cmd sur Mac ; sur téléphone, appui long, « Tout sélectionner », « Copier »).
3. Collez dans la case et cliquez sur **Enregistrer le relevé**.

Le site lit les prix de la page, écarte les frais de port, les filtres de prix, les prix sans rapport (hors de 0,4 à 2,5 fois la cote) et les valeurs atypiques, puis calcule la médiane. La cote se rapproche de cette médiane moins 8 %, avec un poids qui dépend du nombre de prix (60 % au plus). Ce poids reste plein pendant 14 jours, baisse ensuite et s'annule à 60 jours : un relevé par semaine ou deux suffit. L'historique des relevés et l'écart d'un relevé à l'autre s'affichent sous la case.

Les relevés sont conservés dans le navigateur (stockage local) : ils ne passent pas d'un appareil à l'autre et disparaissent si vous effacez les données du site.

## En local

```bash
npm test             # tests avec données simulées
npm run update:demo  # collecte simulée à partir de test/fixtures (modifie data/ : à ne pas committer)
npm run update       # vraie collecte (exporter d'abord les variables EBAY_* et REDDIT_*)
npm run preview      # assemble _site/ et l'ouvre sur http://localhost:8080
```

Node 20 ou plus, aucune dépendance.

## Fichiers

| Chemin | Rôle |
| --- | --- |
| `site/index.html` | Le site (une page, sans dépendance) |
| `site/chrono24.js` | La lecture des relevés Chrono24 et leur poids dans la cote |
| `data/references.json` | Les fiches des montres suivies et la cote de départ de l'étude |
| `data/market.json` | Les indicateurs en direct, réécrits à chaque passage |
| `data/history.json` | Un point par jour et par montre (environ 13 mois conservés) |
| `data/state/ebay.json` | Le suivi interne des annonces eBay, pour le délai de vente (non publié sur le site) |
| `scripts/update-market.mjs` | La collecte et le calcul |
| `scripts/add-reference.mjs` | L'ajout d'une montre |
| `.github/workflows/` | Mise à jour toutes les 6 h, ajout de référence, publication du site |

## Limites

- Les prix eBay, Chrono24 et Reddit sont des **prix demandés**, et les annonces Reddit sont surtout américaines. La décote de 8 % est une moyenne : vérifiez avec vos relevés avant d'acheter.
- Une annonce disparue n'est pas forcément vendue (elle peut avoir été retirée).
- Les coefficients par état (×1,10 pour une neuve, −10 à −15 % pour une montre seule…) sont des repères, pas des mesures.
- Outil d'aide à la décision, pas un conseil en investissement. Aucune marge n'est garantie.
