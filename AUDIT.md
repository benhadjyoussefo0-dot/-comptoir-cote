# Audit — Comptoir de cote horlogère

Phase 0, réalisée le 4 novembre 2026 sur la branche `refonte/phase-0` (commit de départ `ebf4a52`).

## 1. Ce que je peux faire, et ce que je ne peux pas faire

| Capacité | État | Conséquence |
| --- | --- | --- |
| Lire, modifier, committer et pousser dans le dépôt | Oui | Je travaille sur des branches, par petits commits. |
| Exécuter du code (Node 22, Python, Chromium sans écran) | Oui | Tests, construction du site, captures d'écran automatisées. |
| Recherche web et lecture de pages | Oui, partiellement | Chrono24 (CGU, pages), EUR-Lex et certains sites refusent ma lecture : je le signale à chaque fois. |
| Lire l'état public du dépôt sur GitHub (exécutions des workflows) | Oui | Je peux vérifier qu'une mise à jour ou une publication est passée. |
| Régler le dépôt (Pages, secrets, branches protégées), créer des comptes (eBay, Awin, Cloudflare) | Non | Je donne la marche à suivre ; vous faites l'action. |
| Accéder à votre navigateur ou à votre ordinateur | Non | Aucun navigateur relié à cette session. |
| Interroger les bases de marques INPI, EUIPO, OMPI | À tenter au moment du logo | Leurs moteurs sont dynamiques ; à défaut, je donnerai les requêtes à lancer vous-même. |

## 2. État des lieux

### Technique
- **Site statique** d'une seule page (`site/index.html`, 48 Ko, HTML, CSS et JavaScript en ligne, sans dépendance), plus `site/chrono24.js` pour les relevés.
- **Collecte** en Node 24 sans dépendance (`scripts/`), lancée par GitHub Actions toutes les 6 heures. Sources : eBay Browse API (clés pas encore configurées), Reddit (API fermée aux nouveaux accès depuis le 31/10/2026), taux BCE.
- **Données** en JSON dans le dépôt : `references.json` (10 fiches), `market.json`, `history.json`, `state/ebay.json`.
- **Tests** : 14 tests `node:test` (filtres de titres, extraction de prix, agrégats, collecte simulée, lecture des relevés Chrono24). Aucun test de bout en bout du site dans l'intégration continue, aucun test visuel.
- **Hébergement** : GitHub Pages, dépôt public `benhadjyoussefo0-dot/-comptoir-cote`.
- **Secrets** : aucun secret trouvé dans le code ni dans l'historique (recherche des motifs de clés courants sur tout l'historique). Les clés sont prévues dans les secrets GitHub.

### Calcul de la cote et des indicateurs

| Indicateur | Méthode actuelle | Vérifiable ? |
| --- | --- | --- |
| Cote | Cote de l'étude du 01/11/2026, rapprochée de la médiane des prix demandés eBay moins 8 %, et des relevés Chrono24 | Oui dès qu'eBay tourne ; la décote de 8 % est une hypothèse documentée, pas une mesure |
| Prix par état | Coefficients fixes (×1,10 neuf, ×0,93, ×0,87, montre seule) | **Non** : repères arbitraires |
| Délai de vente | Ancienneté des annonces eBay disparues | Oui, mais « disparue » ne veut pas dire « vendue » |
| Demande | Délai de vente, volume annuel de l'étude, ratio Reddit | **Partiellement** : le volume annuel est une estimation de l'étude, Reddit est fermé |
| Offre | Mois de stock ou nombre d'annonces | Oui avec eBay ; sinon valeur de l'étude |
| Hype | Note de base de l'étude, ajustée par Reddit et la tendance | **Non** : la note de base est un jugement |
| Indice de risque | Pondération liquidité, tendance, volatilité, contrefaçon, révision | **Partiellement** : contrefaçon et révision sont des jugements de l'étude |

## 3. Problèmes classés par gravité

### Critique
1. **L'hébergement actuel interdit l'usage visé.** La documentation de GitHub indique que Pages « is not intended for or allowed to be used as a free web-hosting service to run your online business », y compris un SaaS, et que les sites Pages ne doivent pas servir à des transactions sensibles comme l'envoi de mots de passe ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), consulté le 04/11/2026). Tant que le site reste un outil personnel gratuit, ce n'est pas bloquant ; dès qu'il devient un SaaS (comptes, abonnement), il faut migrer. Voir § 5.
2. **Aucune donnée de marché réelle pour l'instant.** Sans clés eBay, la cote affichée est celle de l'étude, figée. Chrono24 n'a pas d'API ; Reddit n'ouvre plus d'accès.
3. **Des indicateurs reposent sur des jugements, pas sur des données** (prix par état, hype, part de la demande, contrefaçon, révision). Ils sont présentés comme des mesures. Il faut les signaler, puis les remplacer par des définitions mesurables (chantier A, étape 7).

### Élevé
0. **L'ajout d'une référence demandait des prix à l'IA** (cote, fourchette, prix neuf, délai, tendance, hype) : ce sont des chiffres non sourcés. **Corrigé sur cette branche** : l'IA ne fournit plus que l'identification et les caractéristiques ; la cote d'une nouvelle référence vient d'un prix saisi par une personne ou des premières annonces.
4. **Couverture : 10 références** pour un objectif de 300.
5. **Pas de référentiel** : chaque fiche porte ses propres mots-clés de correspondance ; pas d'alias normalisés, d'équivalents régionaux ni de surnoms, pas de score de confiance.
6. **Aucun seuil d'échantillon** : le site affiche toujours une cote, même sans annonce. Il doit afficher « données insuffisantes » sous un seuil documenté.
7. **Uniquement des prix demandés.** Les prix de vente réels d'eBay (Marketplace Insights API) demandent un accès spécial ; aucune source de prix de transaction n'est branchée.
8. **Données eBay brutes publiées dans un dépôt public** (`data/state/ebay.json` : titres, liens et prix d'annonces). Les conditions de l'API eBay encadrent le stockage et la redistribution de son contenu : **à vérifier**, et par prudence à sortir du dépôt public (étape « stockage brut » du chantier A).
9. **Relevés Chrono24 limités au navigateur** : pas de partage entre appareils, pas d'historique commun.

### Moyen
10. **Recherche rudimentaire** : score de ressemblance sur 10 fiches, pas de filtres, pas d'état dans l'adresse en dehors du `#` de la fiche.
11. **Design générique** (voir captures `docs/captures/avant/`) : cartes blanches à bord arrondi sur fond gris, pastilles partout, libellés en capitales espacées, bouton bleu par défaut. Rien ne le distingue d'un tableau de bord prêt à l'emploi.
12. **Polices chargées depuis Google Fonts** : une requête vers Google à chaque visite transmet l'adresse IP du visiteur ; à héberger sur le site.
13. **Pages légales absentes** : mentions légales, CGU, confidentialité. Mentions « estimation indicative » et « site indépendant » incomplètes.
14. **Une seule page de 48 Ko** mêlant tout : difficile à faire grandir et à tester.

### Faible
15. Les actions GitHub utilisées tournent encore sur Node 20 (avertissement de dépréciation, forcées en Node 24).
16. Le nom du dépôt commence par un tiret (`-comptoir-cote`), d'où une adresse peu lisible.
17. Pas d'en-têtes de sécurité (GitHub Pages ne permet pas d'en définir).
18. Accessibilité non auditée (libellés présents, mais contraste, focus et lecteur d'écran non vérifiés).

## 4. Plan de travail

| Lot | Contenu | Dépend de | État |
| --- | --- | --- | --- |
| 0 | Audit, accès aux données, trois directions de design | — | Livré sur `refonte/phase-0` |
| 1 | Référentiel canonique, normalisation et rapprochement des références, liste maîtresse, seuils « données insuffisantes » | — | En cours en attendant vos décisions |
| 2 | Recherche à facettes sur l'index existant, état dans l'URL, tests | Lot 1 | En cours |
| 3 | Connecteurs : eBay (vos clés), affiliation Chrono24 (si acceptée), contributions de prix | Vos démarches | En attente |
| 4 | Système de design, logo, toutes les pages | Choix de la direction | En attente |
| 5 | Indicateurs redéfinis, page Méthodologie, tableau de bord qualité | Lots 1 et 3 | À faire |
| 6 | Migration d'hébergement, pages légales, en-têtes de sécurité | Votre accord | À faire |
| 7 | Contrôle qualité : Lighthouse, accessibilité, captures avant et après, rapport final | Tout | À faire |

**Retour arrière** : la branche `main` reste celle qui est en ligne. Rien n'y est fusionné sans tests verts ; chaque fusion est un commit unique qu'on peut annuler (`git revert`).

## 5. Hébergement : proposition de migration

| Offre | Usage commercial sur l'offre gratuite | Limites de l'offre gratuite | Coût |
| --- | --- | --- | --- |
| GitHub Pages (actuel) | **Exclu** pour un SaaS ou une activité en ligne | 1 Go, environ 100 Go de trafic par mois | 0 € |
| Vercel Hobby | **Exclu** : « non-commercial personal use only » ([Fair Use Guidelines](https://vercel.com/docs/plans/hobby)) | — | Pro : 20 $ par mois et par membre |
| Cloudflare Pages | Pas d'interdiction relevée dans la documentation de Pages ; **à confirmer** dans le contrat Cloudflare avant le lancement payant | 500 constructions par mois, 20 000 fichiers, 25 Mio par fichier ([limites](https://developers.cloudflare.com/pages/platform/limits/)) | 0 € |

**Recommandation :** Cloudflare Pages. Le code reste sur GitHub, la publication se fait depuis le même dépôt, on peut définir des en-têtes de sécurité, et l'offre gratuite suffit au volume visé. La migration n'est utile qu'avant l'ouverture commerciale (comptes, abonnement). **Elle demande votre accord.**
