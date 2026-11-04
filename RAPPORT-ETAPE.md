# Rapport d'étape — 4 novembre 2026

Branche `refonte/phase-0`. La version en ligne (`main`) n'a pas changé.

## Fait et testé

| Livrable | Où | Tests |
| --- | --- | --- |
| Audit : capacités, état des lieux, problèmes classés, plan, hébergement | `AUDIT.md` | — |
| Voies d'accès aux données : clauses vérifiées et datées, tableau comparatif, recommandation, email de partenariat (français et anglais) | `ACCES-DONNEES.md` | — |
| Trois directions de design, avec maquettes fonctionnelles en 1 440 et 390 px, captures, licences des polices | `docs/design/` | Captures automatiques |
| Direction retenue : **A, Cotation** | `docs/design/DIRECTIONS.md` | — |
| Référentiel : normalisation des références (préfixe M, suffixes de variante), équivalents régionaux, surnoms, collections, rapprochement avec score et niveau de confiance, tolérance aux fautes | `site/js/referentiel.js`, `data/references.json` | 5 tests |
| Moteur de recherche à facettes (comptes disjonctifs, options dépendantes, 7 tris, fourchette de cote, suggestions groupées, état dans l'adresse) | `site/js/referentiel.js` | inclus ci-dessus |
| Liste maîtresse : références les plus présentes dans les annonces eBay par marque prioritaire (Tudor, Seiko, IWC), comptes seulement, tâche hebdomadaire | `scripts/discover-references.mjs`, `.github/workflows/discover.yml` | 2 tests |
| Ajout de référence : l'IA ne fournit plus aucun prix | `scripts/add-reference.mjs` | Suite existante |

Total : 21 tests, tous verts.

## Pas encore fait

- **Système de design A et nouvelles pages.** Variables, composants, page `/design`, recherche à filtres branchée sur le moteur, fiches, pages marques et modèles indexables, méthodologie, pages légales, 404. Logo définitif, favicons, image de partage, recherche d'antériorité INPI, EUIPO et OMPI.
- **Indicateurs redéfinis** sur des données mesurables, seuil « données insuffisantes », tableau de bord qualité.
- **Contrôle qualité final** : Lighthouse, WCAG 2.2 AA, captures avant et après.

## Décisions et démarches en attente

| Sujet | Qui | État |
| --- | --- | --- |
| Clés eBay | Vous | Compte en cours de validation chez eBay (au moins un jour ouvré) |
| Compte éditeur Awin et demande d'accès aux programmes Chrono24 | Vous | À faire |
| Email de partenariat à Chrono24 | Vous | Prêt dans `ACCES-DONNEES.md` |
| Lecture des CGU de Chrono24 (inaccessibles pour moi) | Vous | Mots à chercher indiqués dans `ACCES-DONNEES.md` |
| Migration vers Cloudflare Pages | Vous | Reportée à l'ouverture commerciale |

## Coûts mensuels actuels

0 €. GitHub, l'API eBay, le taux BCE, les polices sous licence libre et l'affiliation Awin sont gratuits.

## Couverture

10 références cotées sur un objectif de 300. La liste maîtresse se remplira automatiquement dès que les clés eBay seront en place.

## Où reprendre

1. Créer `site/css/systeme.css` à partir de la maquette `docs/design/directions/a-cotation/`, puis la page `/design`.
2. Refaire `site/index.html` (recherche) sur le moteur `Referentiel.createIndex`, avec les facettes et l'état dans l'adresse.
3. Générer les fiches statiques `/montres/<marque>/<référence>/` dans `scripts/build-site.mjs`.
4. Fusionner dans `main` après tests et captures.
