# Trois directions de design

Maquettes fonctionnelles dans `docs/design/directions/`, chacune avec :
- une page de recherche à filtres et une fiche de référence ;
- un affichage ordinateur (1 440 px) et mobile (390 px) ;
- les vraies polices.

Les données sont celles de l'étude du 01/11/2026 et sont marquées « maquette ». Les captures sont dans `docs/design/directions/captures/` (une planche par direction : `planche-*.png`).

Pour les ouvrir en local : `npx http-server docs/design`, puis `/directions/a-cotation/index.html?page=recherche&ac=1`. Les paramètres :
- `page` vaut `recherche` ou `fiche` ;
- `ac=1` ouvre l'autocomplétion ;
- `sheet=1` ouvre le panneau de filtres sur mobile.

## 0. Ce qui fait « générique » dans le design actuel

Voir `docs/captures/avant/` :
- des cartes blanches à bord arrondi posées sur un fond gris ;
- des pastilles arrondies pour tout : statut, source, références suivies ;
- des libellés en capitales espacées au-dessus de chaque bloc ;
- un bouton bleu par défaut et des jauges en barres arrondies ;
- aucune hiérarchie propre au produit : la cote a le même poids visuel que le reste ;
- des polices chargées depuis Google à chaque visite.

Ce sont exactement les automatismes d'un tableau de bord prêt à l'emploi.

## A. Cotation — dessin technique

**Concept.** En dessin industriel, une *cote* est la mesure inscrite sur un plan, entre deux lignes d'attache et une flèche à chaque bout. Le site joue sur ce double sens : chaque prix est « coté » comme une pièce, avec sa fourchette dessinée comme une ligne de cote.

| | |
| --- | --- |
| Polices | **Archivo** (Omnibus-Type), variable en graisse et en chasse : chasse large pour la cote et les titres, normale pour le texte. **Martian Mono** (Evil Martians) pour les références et les chiffres des tableaux. Licence SIL OFL 1.1, usage commercial autorisé, 0 €. |
| Palette | Fond `#F3F4F4` (gris froid), encre `#0F1215` (17,1:1), texte secondaire `#545B63` (6,2:1), filets `#B9C0C6` et `#D9DDE0`, un seul signal `#C2351C` vermillon (5,0:1), réservé au repère de la cote et aux alertes. |
| Élément signature | La **ligne de cote** : lignes d'attache, trait et flèches. Elle sert pour la fourchette de la fiche, l'indicateur de fourchette dans la liste, le curseur de prix et le logo. Le pied de page reprend le **cartouche** d'un plan (méthode, date des données, unité). |
| Mise en page | Grille de 12 colonnes, filtres à gauche sur 3 colonnes, tableau dense et triable sur 9. Filets fins, aucun arrondi, aucune ombre. |
| Logo (esquisse) | « COMPTOIR DE » en chasse large, au-dessus de « cote » soulignée d'une ligne de cote à flèches. Monogramme : un « c » coté. |
| Choix par défaut écarté | Une police à empattements « luxe » et un fond sombre doré : c'est le cliché des sites horlogers, et c'est hors de propos pour un instrument de mesure. |

## B. Catalogue — vente aux enchères

**Concept.** La mise en page d'un catalogue de vente horlogère : chaque référence est un *lot*, avec son numéro, sa description et une *estimation* basse et haute. Le registre éditorial donne du sérieux sans décor.

| | |
| --- | --- |
| Polices | **Newsreader**, dessinée par **Production Type**, fonderie française, avec un axe de taille optique, pour les titres, les chiffres et le texte. **Schibsted Grotesk** pour l'interface (filtres, libellés). SIL OFL 1.1, 0 €. |
| Palette | Fond blanc `#FFFFFF`, encre `#161514` (18,2:1), secondaire `#625E58` (6,4:1), filets `#CFCBC4` et `#E6E3DE`, accent lie-de-vin `#8A1C2C` (9,2:1) pour les liens et le focus. |
| Élément signature | Le **numéro de lot** et le **double filet** des catalogues. La cote est présentée comme une estimation « 2 330 – 2 800 € ». |
| Mise en page | Colonne de gauche étroite (numéros, rubriques), texte décalé à droite. Filtres en **bandeau horizontal** déroulant, au lieu d'une colonne latérale. Résultats en liste de lots. |
| Logo (esquisse) | « Comptoir *de* Cote », la particule en italique soulignée d'un filet lie-de-vin. Monogramme : « C*d*C ». |
| Choix par défaut écarté | Une grille de cartes produit avec photos : sans photos sous licence, elle sonne creux, et elle ressemble à toutes les boutiques en ligne. |

## C. Instrument — banc de mesure

**Concept.** Un appareil de mesure en lecture sombre : chaque référence est une *lecture*, un chiffre net posé sur une **règle graduée** dont un index jaune marque la position. L'interface se règle comme un panneau d'instrument.

| | |
| --- | --- |
| Polices | **Chivo** pour le texte et **Chivo Mono** pour toutes les valeurs (Omnibus-Type). SIL OFL 1.1, 0 €. |
| Palette | Fond graphite `#131517`, encre `#E6E8EA` (14,9:1), secondaire `#8E969D` (6,1:1), filets `#30353A`, signal jaune de mesure `#E3BF4A` (10,3:1), réservé à l'index et aux alertes. Version claire à prévoir. |
| Élément signature | La **règle graduée** (graduations majeures et mineures, index triangulaire), utilisée dans le curseur de prix, sur chaque lecture et dans le logo. |
| Mise en page | Réglages en **rack horizontal** de commandes segmentées. Résultats en grille de lectures séparées par des filets, sans cartes ni ombres. |
| Logo (esquisse) | « comptoir/cote » en chasse fixe sur une règle graduée, l'index jaune sous la graduation. |
| Choix par défaut écarté | Le « fond noir + néon » des tableaux de bord de trading. Ici le fond est un graphite mat, la couleur sert une seule fonction, et rien ne brille. |

## Contrôle face à la liste des interdits

| Critère | A | B | C |
| --- | --- | --- | --- |
| Polices interdites ou automatismes | Aucune | Aucune | Aucune |
| Violet, dégradés, néons, verre dépoli, crème et terracotta | Non | Non (fond blanc, accent lie-de-vin) | Non (graphite mat, un jaune) |
| Accueil centré avec deux boutons, trois cartes à icônes, bento | Non | Non (accroche alignée à gauche, sans bouton) | Non |
| Cartes arrondies à ombre douce, pastilles « Nouveau », emojis | Non | Non | Non |
| Clichés horlogers (10 h 10, couronne, cadran) | Non | Non | Non : la règle est linéaire, pas un cadran |
| Hausse et baisse signalées autrement que par la couleur | Oui (↑ ↓ et signe) | Oui | Oui |
| Pourrait passer pour un modèle prêt à l'emploi | Non | Peu probable | Peu probable |

**Points à corriger quelle que soit la direction :**
- Les bords des champs de saisie sont trop clairs : 1,6 à 1,7:1, alors que le WCAG 2.2 (critère 1.4.11) demande 3:1. Le système final utilisera l'encre ou un gris plus soutenu.
- Sous le seuil d'échantillon, la fiche affichera « données insuffisantes » à la place de la cote. L'estimation de l'étude passera au second plan, avec sa source.

## Ma recommandation : A, Cotation

C'est la seule des trois dont l'idée naît du nom même du produit : la cote d'une montre devient la cote d'un plan. Elle donne :
- un élément signature qui porte du sens : la ligne de cote **est** la fourchette de prix ;
- une interface claire et dense, lisible au soleil sur un téléphone ;
- un logo qui se dessine naturellement.

B est la plus élégante, mais son registre « maison de ventes » promet un prestige que des cotes calculées ne doivent pas suggérer. C est très reconnaissable, mais le mode sombre par défaut fatigue en lecture longue de tableaux.
