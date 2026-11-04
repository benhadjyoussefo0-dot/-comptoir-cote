# Accès aux données — Chrono24 et autres sources

Vérifications faites le 4 novembre 2026. Je ne suis pas juriste : ce document recense les faits vérifiés et les risques. Avant toute ouverture commerciale, faites-le relire par un professionnel.

## 1. Ce qui a été vérifié, et ce qui ne l'a pas été

### Chrono24

| Point | Constat | Source et date | Fiabilité |
| --- | --- | --- | --- |
| Conditions d'utilisation | **Non lues.** Les pages de Chrono24 refusent mes lectures automatiques (`chrono24.fr/info/agb.htm`, `chrono24.com/info/terms.htm` : refus du site). | Tentatives du 04/11/2026 | **À lire par vous** dans votre navigateur ; cherchez les mots « automatis », « robot », « extraction », « base de données » |
| robots.txt | Pour tous les robots : délai de 0,1 s entre requêtes et une quinzaine de chemins interdits (publicités, scripts, fenêtres). Les pages de recherche (`/search/index.htm`) **ne sont pas interdites**. `Amazonbot` et `Bytespider` sont interdits sur tout le site. | [chrono24.fr/robots.txt](https://www.chrono24.fr/robots.txt), lu le 04/11/2026 | Vérifié. Un robots.txt n'est **pas** une autorisation de réutiliser les données. |
| Protection technique | Le site est protégé par Cloudflare, qui bloque les requêtes automatiques simples (erreur 403), et rejette les adresses de centres de données, donc celles de GitHub Actions. | Documentation d'outils tiers : [glama.ai](https://glama.ai/mcp/servers/w5kwrlvtpc), [Apify](https://apify.com/automia-admin/chrono24-scraper), consultées le 04/11/2026 | Concordant entre plusieurs sources |
| API officielle de données | Aucune API publique. Chrono24 propose seulement des flux d'**import** pour que les marchands y publient leurs annonces. | [Guide d'import Chrono24](https://update.chrono24.com/listing-import-guide/) ; nombreuses sources tierces concordantes | Vérifié |
| Programme d'affiliation | Programmes Chrono24 sur Awin pour les **États-Unis** (n° 128225) et le **Royaume-Uni** (n° 128227) : commissions variables, cookie de 60 jours. Les fiches publiques ne parlent ni de flux produits, ni des pays acceptés, ni de l'usage des données. **Aucun programme France trouvé.** | [Awin 128225](https://ui.awin.com/merchant-profile/128225), [Awin 128227](https://ui.awin.com/merchant-profile/128227), consultés le 04/11/2026 | À compléter : il faut créer un compte éditeur Awin (gratuit) pour voir les conditions réelles |

**Conséquence.** Une collecte automatique de Chrono24 depuis nos serveurs ne fonctionne qu'en contournant la protection anti-robot. Vos règles l'excluent, et je l'exclus aussi, **quelles que soient les CGU**. Les CGU restent à lire pour décider du reste (liens, affiliation, relevés manuels).

### Cadre juridique (France et UE)

- **Droit des producteurs de bases de données** (art. L342-1 à L342-3 du Code de la propriété intellectuelle, directive 96/9/CE). Le producteur peut interdire l'extraction ou la réutilisation d'une partie substantielle de sa base, ainsi que l'extraction répétée de parties non substantielles quand elle excède une utilisation normale.
  - J'ai lu l'**article L342-3** sur Légifrance (version en vigueur depuis le 26/11/2021). Il prévoit des exceptions : partie non substantielle pour un utilisateur légitime, usage privé, recherche, fouille de textes et de données. Les clauses contraires à certaines de ces exceptions sont nulles.
  - Les articles L342-1 et L342-2 restent **à relire** sur [Légifrance](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069414/).
- **CJUE, 3 juin 2021, CV-Online Latvia, C-762/19.** Un moteur de recherche spécialisé qui copie, indexe et affiche le contenu d'une base d'annonces procède bien à une extraction et à une réutilisation. Le producteur ne peut toutefois l'interdire que si deux conditions sont réunies : son investissement est substantiel, et l'activité met en risque l'amortissement de cet investissement.
  - Sources : notes de [Bird & Bird](https://www.twobirds.com/en/insights/2021/uk/cv-online-latvia-cjeu-complicates-the-enforcement-of-database-rights) et de [Lewis Silkin](https://www.lewissilkin.com/passle/102h08y), et une chronique universitaire ([Toulouse Capitole](https://publications.ut-capitole.fr/46878/1/Janvier%202022.pdf)).
  - EUR-Lex a refusé ma lecture du texte intégral : le dispositif reste **à relire** sur le site de la Cour.
- **Précédent français à vérifier.** Un agrégateur d'annonces automobiles a été condamné : TJ Paris, 8 juillet 2021, Groupe La Centrale c/ ADS4ALL, cité par la chronique de Toulouse Capitole. Je n'ai pas lu la décision elle-même.
  - Un comparateur de cotes qui recopie les prix d'une grande place de marché correspond exactement au risque visé, car son activité concurrence l'exploitation de la base.
- **Droit d'auteur.** Les photos et descriptions d'annonces peuvent être protégées (art. L111-1 du CPI). Aucune ne doit être copiée ni affichée par lien direct sans licence.
- **RGPD.** Le nom, la ville ou le pseudonyme d'un vendeur particulier sont des données personnelles. Aucune n'est collectée.

### Autres sources

| Source | Constat | Source et date |
| --- | --- | --- |
| eBay Browse API | API officielle, gratuite, clés à créer ; prix **demandés** des annonces actives. Les prix de vente réels (Marketplace Insights API) demandent un accès spécial. Les règles de stockage et de redistribution du contenu eBay sont **à vérifier** dans la licence de l'API. | API utilisée par la collecte actuelle ; licence de l'API **non relue** à ce jour |
| WatchCharts API | Données de marché sous licence. Accès réservé aux abonnés Professional : à partir de 600 $ par mois (niveau 1), 1 000 $ par mois pour le niveau 2, avec crédits de données quotidiens. | [watchcharts.com/api](https://watchcharts.com/api), consulté le 04/11/2026 |
| Reddit | Plus aucune nouvelle demande d'accès à l'API depuis le 31/10/2026 ; fin de l'accès public restant en mars 2027. | Annonce de Reddit du 30/09/2026, reprise par la presse |

## 2. Les voies possibles

| Voie | Légalité | Données | Coût | Fraîcheur | Fiabilité et risque d'arrêt | Montée en charge |
| --- | --- | --- | --- | --- | --- | --- |
| Partenariat ou licence avec Chrono24 | Sûre | Selon contrat : prix demandés, peut-être historiques | Négocié | Selon contrat | Très bonne, mais réponse incertaine | Excellente |
| Affiliation Chrono24 (Awin) | Sûre dans les limites du contrat | Liens rémunérés ; flux produits **non confirmé** | 0 €, rapporte des commissions | Selon flux | Bonne si accepté ; France non confirmée | Bonne |
| Lien direct vers la recherche Chrono24 depuis chaque fiche, sans copier de données | Sûre | Aucune donnée : renvoi | 0 € | — | Très bonne | Totale |
| eBay Browse API | Sûre si on respecte la licence | Prix demandés, annonces actives, disparitions | 0 € | 6 h | Bonne | Bonne (quota quotidien) |
| Fournisseur sous licence (WatchCharts) | Sûre | Cotes de marché agrégées | À partir de 600 $ par mois | Quotidienne | Très bonne | Excellente |
| Contributions des utilisateurs (prix réellement obtenus, modérés) | Sûre avec consentement et modération | **Prix de transaction** | Faible (comptes, modération) | Variable | Dépend de l'audience | Croît avec l'audience |
| Relevé manuel (page copiée par l'utilisateur, gardée dans son navigateur) | Usage privé : risque faible. Publication de statistiques sur un site public : **incertaine** sans autorisation | Prix demandés | 0 € | Selon l'utilisateur | Fragile (changement de page) | Faible |
| Collecte automatique des pages publiques | **Exclue** : impossible sans contourner la protection, et sous l'œil du droit des bases de données | Prix demandés | — | — | Coupure ou action en justice possibles | — |
| Services de scraping tiers, API mobile privée, proxys résidentiels | **Exclus** par vos règles et par les miennes | — | — | — | — | — |

## 3. Recommandation

1. **Tout de suite :** eBay Browse API pour toutes les références (prix demandés automatiques), plus un **lien « Voir les annonces sur Chrono24 »** sur chaque fiche, sans aucune copie de données.
2. **Cette semaine :**
   - créer un compte éditeur Awin (gratuit) et demander l'accès aux programmes Chrono24 ; demander s'il existe un programme France et un flux produits, avec ses conditions d'usage (stockage, historique, statistiques) ;
   - en parallèle, envoyer l'email de partenariat ci-dessous.
3. **En attendant la réponse de Chrono24 :** garder le relevé manuel comme outil **privé**. Les relevés restent dans le navigateur de l'utilisateur et ne sont ni publiés ni partagés. Aucune statistique Chrono24 ne s'affiche publiquement sans autorisation écrite.
4. **Avec les comptes utilisateurs (P2) :** contributions modérées de prix réellement obtenus, la seule source de **prix de transaction** accessible sans budget.
5. **Plus tard, si le SaaS a des revenus :** comparer le coût de WatchCharts à celui d'une licence Chrono24.

## 4. Email de demande de partenariat

À envoyer depuis votre adresse. Je n'ai pas pu vérifier l'adresse du service partenariats de Chrono24 : passez par la page Contact de chrono24.fr, ou demandez à l'équipe Affiliation via Awin à qui l'adresser.

**Objet : Demande de partenariat de données — outil de cote de montres d'occasion (France)**

> Bonjour,
>
> Je développe [NOM DU SITE], un outil français indépendant qui aide les acheteurs et les revendeurs de montres d'occasion à estimer une montre selon son état, à partir de sa référence. L'outil s'adresse au public francophone. Il met en avant les références les plus échangées : Tudor, Seiko, IWC, puis les grandes marques.
>
> Chrono24 est la place de marché de référence de nos utilisateurs. Plutôt que d'utiliser vos données sans accord, je souhaite vous proposer un partenariat dans l'une des formes suivantes :
> 1. un accès sous licence à des données agrégées par référence (prix demandé médian, nombre d'annonces, éventuellement évolution), sans photos ni descriptions ni données de vendeurs ;
> 2. l'accès à votre programme d'affiliation pour la France, avec, s'il existe, un flux produits et ses conditions d'usage ;
> 3. à défaut, votre accord écrit pour afficher sur chaque fiche un lien vers la recherche Chrono24 correspondante, accompagné de la mention de votre marque.
>
> En retour, chaque fiche renverrait vers Chrono24 pour l'achat, avec une attribution claire. Je suis prêt à respecter vos règles d'affichage et de fréquence.
>
> Pourriez-vous m'indiquer la bonne personne pour en discuter ?
>
> Bien cordialement,
> [Prénom Nom]
> [NOM DU SITE] — [adresse du site]
> [email] · [téléphone facultatif]

Une version anglaise est utile, Chrono24 étant basée en Allemagne :

> **Subject: Data partnership request — pre-owned watch valuation tool (France)**
>
> Hello,
>
> I am building [SITE NAME], an independent French tool that helps buyers and resellers of pre-owned watches estimate a watch's value by condition, from its reference number. Chrono24 is our users' reference marketplace, and I would rather work with you than use your data without permission. I would like to discuss one of the following:
> (1) licensed access to aggregated data per reference (median asking price, number of listings, trend), with no photos, descriptions or seller data;
> (2) access to your affiliate programme for France, including a product feed and its terms of use, if one exists;
> (3) at least, written permission to link each reference page to the matching Chrono24 search, with attribution.
>
> Every page would send buyers to Chrono24, with clear attribution, and I will follow your display and frequency rules. Could you point me to the right contact?
>
> Kind regards,
> [Name] — [SITE NAME], [site address], [email]
