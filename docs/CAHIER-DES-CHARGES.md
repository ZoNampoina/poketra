> Référence historique du MVP 0.1.0. Pour l’architecture et les fonctions actives depuis V1.1, consulter [la mise à jour V1.1](MISE-A-JOUR-V1.1.md). Les règles financières fondamentales ci-dessous sont conservées.

# Poketra — Cahier des charges et architecture de référence

Version 1.0 · 12 octobre 2026 · Application en français · Devise MGA

## 1. La situation à laquelle Poketra répond

Poketra accompagne une personne qui travaille par projets. Une prestation peut apporter une somme importante, puis plusieurs semaines ou plusieurs mois peuvent s’écouler sans nouvelle entrée. La date du prochain paiement est inconnue. L’application doit donc aider à faire durer l’argent déjà reçu, plutôt qu’à organiser un salaire mensuel fictif.

La priorité est de pouvoir répondre à quatre questions : combien je possède, où se trouve cet argent, quelle part est déjà réservée et quelle part je peux utiliser. Les soldes doivent toujours être explicables à partir du journal des opérations.

Les décisions transmises dans cette conversation constituent la référence du projet. Les choix de réalisation qui suivent précisent leur fonctionnement et pourront évoluer sans modifier ces principes.

## 2. Portefeuilles et catégories

### Portefeuilles

| Groupe | Portefeuille | Solde indépendant |
|---|---|---|
| Mobile Money | MVola | Oui |
| Mobile Money | Orange Money | Oui |
| Mobile Money | Airtel Money | Oui |
| Espèces | Argent liquide | Oui |
| Banque | Compte bancaire | Oui |

Le total Mobile Money additionne ses trois portefeuilles, sans créer un sixième solde. Chaque portefeuille dispose de son historique. Les soldes de départ sont enregistrés une seule fois et sont exclus des statistiques de revenus.

Les montants saisis dans le MVP sont des Ariary entiers. Les calculs sont exacts dans la plage des entiers sûrs JavaScript. PostgreSQL utilisera des `bigint` limités à cette même plage pour assurer la cohérence avec le client. Aucun tarif opérateur n’est supposé : les frais réellement appliqués sont saisis par l’utilisateur.

### Catégories

| Catégorie | Sous-catégories initiales |
|---|---|
| Personnelles | Vêtements, coiffure, achats personnels |
| Famille | Parents, frères et sœurs, voiture familiale, aides |
| Libres | Loisirs, sorties, divertissements |
| Essentielles | Alimentation, logement, factures |
| Transport | Carburant, taxi, bus |
| Santé et éducation | Soins, médicaments, formation |
| Frais financiers | Retrait, transfert, banque |
| Imprévus et autres | Imprévu, autre |

Des sous-catégories et catégories supplémentaires peuvent être créées. Un bénéficiaire facultatif précise pour qui une dépense a été faite. Une catégorie utilisée dans le journal ne devra pas être supprimée physiquement : elle sera archivée dans une prochaine évolution. Une dépense conserve sa catégorie historique.

## 3. Deux lectures du même argent

Un portefeuille indique **où** se trouve l’argent. Une affectation indique **à quoi** il sert. Une réserve n’est donc pas un compte bancaire supplémentaire ; elle peut correspondre à de l’argent réparti entre plusieurs portefeuilles.

Toutes les affectations sont disjointes :

| Affectation | Signification |
|---|---|
| Réserve de sécurité | Somme protégée, libérable après avertissement |
| Provisions | Argent mis de côté pour un projet ou une obligation |
| Enveloppes | Argent disponible pour les catégories de dépenses |
| Non attribué | Argent reçu ou initial, encore libre de répartition |

L’identité de contrôle est :

**Total des portefeuilles = réserve + provisions + enveloppes + non attribué.**

Le budget global disponible est **la somme des soldes des enveloppes**. Il n’est pas une deuxième caisse que l’on débite indépendamment. Le disponible hors réserve et provisions est la somme des enveloppes et du non attribué ; une enveloppe peut néanmoins être destinée à une dépense indispensable plutôt qu’à un achat libre.

Le non attribué se compose d’une part générale et, pour chaque projet, d’une part dont l’origine est conservée. Ces sous-comptes sont regroupés dans le montant global « Non attribué ». Ils évitent de présenter comme encore libres des recettes de projet déjà réparties.

## 4. Règles de calcul et opérations atomiques

### Encaissement

Un revenu réel augmente le portefeuille choisi et le non attribué du même montant. S’il appartient à un projet, il augmente le non attribué propre à ce projet et son cumul encaissé. Un montant convenu, une facture envoyée ou une promesse de paiement ne change aucun solde.

### Répartition et réallocation

Une répartition déplace un montant entre deux affectations. Elle ne change pas les portefeuilles et ne constitue pas une dépense. Aucun pourcentage obligatoire de réserve, aucun prélèvement fiscal et aucune répartition automatique ne sont imposés.

Exemple : recevoir 1 000 000 Ar donne 1 000 000 Ar non attribués. Mettre 300 000 Ar en réserve et 200 000 Ar dans Essentielles laisse 500 000 Ar non attribués. Le total possédé reste 1 000 000 Ar.

### Dépense dans une enveloppe

Une dépense de 20 000 Ar diminue le portefeuille et l’enveloppe de 20 000 Ar. Le budget global diminue automatiquement de 20 000 Ar puisque l’enveloppe fait partie de sa somme. La dépense n’est enregistrée qu’une fois dans les statistiques.

La catégorie correspond à l’enveloppe. Si l’enveloppe n’est pas assez alimentée, l’utilisateur réaffecte de l’argent avant le paiement. L’application ne déborde pas silencieusement vers la réserve ou une autre enveloppe.

### Dépense d’une provision

Une dépense provisionnée diminue le portefeuille et la provision concernée. Elle ne débite pas une enveloppe personnelle en plus. Une provision de 100 000 Ar payée à hauteur de 40 000 Ar laisse 60 000 Ar provisionnés. Le coût réel et le restant provisionné s’additionnent pour connaître les engagements du projet ; le coût payé ne reste pas une deuxième fois dans la provision.

### Transfert et retrait

Le formulaire précise le montant reçu à destination et les frais réellement facturés.

| Mouvement | Montant |
|---|---:|
| Débit MVola | 102 000 Ar |
| Crédit Espèces | 100 000 Ar |
| Frais financiers | 2 000 Ar |

Le total possédé baisse de 2 000 Ar. Le transfert de 100 000 Ar est exclu des dépenses. Le montant et les frais font partie d’une même opération atomique, avec une ligne de dépense financière distincte. Les frais sont financés par leur enveloppe ou par le non attribué choisi explicitement. Un transfert sans frais laisse les affectations inchangées.

Dans le MVP, les frais sont prélevés dans le portefeuille source. Un futur cas de frais débités sur un autre portefeuille devra être proposé explicitement, sans deviner le mode de facturation.

### Réserve

L’objectif de réserve est configurable. Définir un objectif ne crée pas d’argent et n’alimente pas automatiquement la réserve. Pour dépenser cette réserve dans l’interface, l’utilisateur confirme d’abord sa libération vers une enveloppe ou le non attribué. Cette décision est enregistrée dans le journal.

### Correction

Les opérations financières sont conservées. Une correction se fait par une contre-écriture, puis par une nouvelle opération correcte si nécessaire. Les statistiques excluent l’opération annulée ; la sauvegarde garde l’original et sa contre-écriture. Une annulation est refusée si elle produit un solde négatif. Pour une obligation ayant plusieurs paiements, les paiements suivants doivent être annulés avant un paiement antérieur.

### Garde-fous du MVP

Les portefeuilles et affectations ne deviennent pas négatifs. Les montants décimaux, références inconnues, identifiants dupliqués et écritures déséquilibrées sont refusés. Les dates impossibles sont rejetées. Une opération réelle future doit passer par les échéances plutôt que par le journal encaissé. Les plafonds de calcul sont vérifiés, y compris pendant l’addition.

## 5. Projets et rentabilité

Un projet contient son nom, son client, sa description et son montant convenu. Les avances et paiements sont des revenus réels liés à ce projet. Les dépenses liées au projet restent identifiables, qu’elles soient financées par une provision ou par une enveloppe.

| Indicateur | Calcul |
|---|---|
| Encaissé | Somme des revenus actifs liés au projet |
| À encaisser | Maximum de zéro et du convenu moins l’encaissé |
| Surpaiement | Maximum de zéro et de l’encaissé moins le convenu |
| Dépensé | Somme des dépenses actives liées au projet |
| Provision restante | Solde de l’affectation provisionnée du projet |
| Résultat réalisé de trésorerie | Encaissé moins dépensé |
| Marge prévisionnelle après provisions connues | Convenu moins dépensé moins provision restante |
| Contribution encaissée après engagements connus | Encaissé moins dépensé moins provision restante |
| Fonds du projet encore à attribuer | Solde réel du non attribué propre au projet |

La marge prévisionnelle suppose que le montant convenu sera payé et que les provisions connues couvrent les dépenses restantes. Elle n’augmente jamais les soldes disponibles. Elle n’est pas un bénéfice comptable ou fiscal certifié.

Le résultat réalisé peut être négatif : un projet peut avoir commencé à coûter avant d’apporter un encaissement. Le montant encore à attribuer tient compte des réaffectations déjà effectuées vers les budgets, les provisions ou la réserve. La trésorerie globale reste la référence pour décider d’un paiement.

## 6. Budgets continus et alertes

Les enveloppes n’expirent pas à la fin d’un mois. Un changement de semaine, mois ou année ne les réinitialise pas. Une nouvelle entrée devient disponible à répartir ; l’utilisateur décide quand et comment.

La capacité d’une enveloppe continue vaut son solde actuel plus ses dépenses actives cumulées. Cette définition ajuste la capacité lorsque l’on y ajoute ou retire des fonds. Le taux d’utilisation est dépenses actives divisées par cette capacité. Une enveloppe sans capacité affiche zéro, sans erreur de division.

Les alertes apparaissent à partir de 80 % et à 100 %. À 100 %, une nouvelle dépense nécessite une alimentation ou une réallocation. Les annulations neutralisent aussi les dépenses utilisées pour ces pourcentages.

Une prochaine évolution pourra permettre des objectifs volontaires par période. Ils ne remplaceront jamais les enveloppes continues et ne créeront pas de revenus fictifs.

## 7. Autonomie et obligations

L’utilisateur renseigne ses besoins indispensables pour 30 jours. Cette valeur sert de repère journalier ; elle n’est pas un budget mensuel obligatoire.

**Besoin journalier = besoins indispensables sur 30 jours / 30.**

**Autonomie hors réserve = partie entière de (total − réserve − provisions) / besoin journalier.**

**Autonomie avec réserve = partie entière de (total − provisions) / besoin journalier.**

Les deux scénarios supposent zéro nouveau revenu. Un besoin journalier nul donne « À renseigner », jamais une autonomie infinie. Le MVP utilise un besoin constant et retire toutes les provisions : c’est une estimation prudente. Si une obligation essentielle est déjà provisionnée, cette estimation reste conservatrice, car le besoin récurrent n’est pas automatiquement réduit. Le calcul par calendrier réel de décaissements sera une évolution distincte, pour traiter précisément ce chevauchement sans double déduction.

Une obligation a un montant, une date, une catégorie et une récurrence éventuelle. Sa création ne change aucun solde. Sa provision correspond à de l’argent réellement retiré du non attribué ou d’une autre affectation. Le paiement est confirmé manuellement et débite une fois le portefeuille et la provision. Une échéance mensuelle avance après paiement ; elle ne génère pas de débit automatique.

Le report au mois suivant respecte le nombre de jours du mois. Le MVP reporte au dernier jour disponible ; après le 31 janvier, la prochaine date sera le 28 ou 29 février. La gestion d’une règle persistante « dernier jour du mois » reste à ajouter.

## 8. Prêts et remboursements : règles prévues

Le module dédié aux prêts fait partie de la prochaine étape. Les règles sont fixées avant sa réalisation :

| Situation | Effet prévu |
|---|---|
| Prêt accordé | Sortie de liquidités et création d’une créance ; principal exclu des dépenses de consommation |
| Remboursement reçu | Entrée réelle de liquidités et diminution de la créance ; principal exclu des revenus de projet |
| Emprunt reçu | Entrée de liquidités et création d’une dette ; principal exclu des revenus gagnés |
| Remboursement d’emprunt | Sortie réelle de liquidités et diminution de la dette ; principal séparé des intérêts |
| Intérêts payés | Dépense financière |
| Intérêts reçus | Revenu distinct du remboursement de principal |

Créances et dettes sont affichées séparément du total liquide des portefeuilles. Une créance ne devient pas disponible avant son remboursement. Une dette ne sera pas déduite une seconde fois si son paiement est déjà provisionné. Aucune réserve intégrale obligatoire d’un emprunt ne sera imposée sans choix explicite.

## 9. Écrans et navigation

Sur Android, la barre basse donne accès à Accueil, Portefeuilles, Budgets, Projets et Plus. Le menu Plus ouvre Transactions, Statistiques, Échéances et Paramètres. Sur ordinateur, ces sections sont visibles dans une barre latérale.

| Écran | Informations et actions principales |
|---|---|
| Premier démarrage | Cinq soldes de départ, puis création de l’espace ; démonstration séparée |
| Accueil | Total, disponible hors réserve et provisions, réserve, autonomie, budgets, non attribué, dernières transactions, projets |
| Portefeuilles | Groupe Mobile Money, trois soldes, espèces, banque, historique individuel |
| Budgets | Global dérivé, enveloppes, alimentation et réallocations, réserve, provisions |
| Projets | Montant convenu, reçu, restant, coûts, provisions, détail des paiements et dépenses |
| Transactions | Recherche, type, portefeuille, catégorie, projet, dates, annulation |
| Statistiques | Semaine, mois, année, période personnalisée, filtre projet et répartition par catégorie |
| Échéances | Obligations uniques ou mensuelles, provision, paiement confirmé |
| Paramètres | Objectif de réserve, besoins indispensables, nom, sauvegarde, import, installation PWA |

Les formulaires courts utilisent le clavier numérique pour les montants. Les fenêtres défilent indépendamment de la page. Échap ferme une fenêtre ; le focus clavier reste dans la fenêtre. Le formulaire de dépense propose une catégorie, son enveloppe, un portefeuille, un libellé et des détails facultatifs.

La direction visuelle choisie privilégie les verts sobres, des fonds clairs et des montants nettement hiérarchisés. Les alertes utilisent un texte explicite en plus de la couleur. Le mode démonstration porte un bandeau permanent et ne remplace pas les données réelles.

## 10. Architecture réalisée

Le MVP emploie React, TypeScript et les conventions Next.js, avec Vinext pour son exécution sur Sites, et Tailwind CSS pour la base de styles. Le moteur financier n’importe aucun composant d’interface. Il peut être réutilisé dans une autre interface ou dans un futur service de validation.

| Fichier ou module | Rôle |
|---|---|
| `lib/finance.ts` | Modèle, montants exacts, journal, contrôles, calculs |
| `lib/storage.ts` | IndexedDB, enregistrement atomique et contrôle de révision |
| `app/poketra.tsx` | Navigation, formulaires et pages du MVP |
| `app/ui.tsx` | Transactions, enveloppes et champs partagés |
| `public/sw.js` | Cache de l’interface et reprise hors connexion |
| `public/manifest.webmanifest` | Installation PWA |
| `scripts/pwa-assets.mjs` | Liste des ressources précachées et version du cache |
| `tests/finance.test.ts` | Scénarios financiers et invariants |
| `supabase/schema-reference.sql` | Schéma relationnel proposé, à valider avant migration |

Une seule écriture IndexedDB conserve l’état financier complet. Une révision empêche deux onglets de remplacer silencieusement leurs modifications. En cas de conflit, la seconde écriture échoue et demande un rechargement. L’interface n’annonce un succès qu’après validation et enregistrement. Le mode démonstration travaille uniquement en mémoire.

Le cache de l’interface ne contient pas de données financières reçues d’un serveur. L’état personnel reste dans IndexedDB. L’utilisation hors connexion nécessite un premier chargement complet et la disponibilité du cache sur l’appareil. Une suppression des données du navigateur ou une éviction du stockage peut nécessiter de restaurer une sauvegarde.

La version privée publiée bénéficie du contrôle d’accès de son hébergeur lorsqu’elle est consultée en ligne. Le stockage local du MVP n’est pas chiffré ; la sécurité hors connexion repose actuellement sur l’accès à l’appareil. Le MVP n’affiche pas de faux verrou PIN et ne prétend pas disposer déjà de comptes Supabase.

## 11. Modèle relationnel et synchronisation cible

| Entité | Champs et relations essentiels |
|---|---|
| Espaces | Propriétaire Auth, devise, révision, paramètres |
| Portefeuilles | Espace, nom, groupe |
| Catégories | Espace, nom, caractère indispensable, archivage |
| Sous-catégories | Espace, catégorie, nom |
| Projets | Espace, client, description, montant convenu |
| Obligations | Espace, montant, échéance, règle de récurrence |
| Affectations | Espace, type, catégorie/projet/obligation éventuels |
| Opérations | Identifiant client unique, espace, type, date réelle, séquence serveur, original annulé éventuel |
| Écritures portefeuilles | Opération, portefeuille, variation signée |
| Écritures affectations | Opération, affectation, variation signée |
| Lignes de dépenses | Opération, montant, catégorie, affectation, projet, bénéficiaire |
| Prêts | Espace, sens, tiers, principal, échéance |

Les soldes sont dérivés des écritures. Des vues ou caches de soldes seront possibles, à condition de pouvoir être reconstruits depuis le journal. Les références incluent l’espace propriétaire afin qu’une écriture ne puisse pas associer le portefeuille d’un compte au projet d’un autre.

Le schéma SQL fourni est une référence de structure avec RLS et clés étrangères, **pas une base de production activée**. Il accorde seulement la lecture aux utilisateurs authentifiés. Les écritures financières devront passer par un service de validation et une transaction atomique ; le schéma ne laisse pas le client contourner ces contrôles par des insertions directes.

### Parcours de synchronisation à réaliser

1. Authentifier l’utilisateur avec Supabase Auth et isoler son espace local par son identifiant de compte.
2. Enregistrer une commande hors connexion avec son UUID, sa version de schéma et la révision serveur connue. La marquer « En attente ».
3. Envoyer les commandes au retour du réseau. Les paramètres confidentiels restent côté serveur ; seul un identifiant public de projet et une clé publiable peuvent être présents dans le client.
4. Côté serveur, vérifier l’identité et l’appartenance, verrouiller l’espace concerné, contrôler l’idempotence et rejouer les règles sur la version courante.
5. En cas de fonds insuffisants après une autre opération distante, refuser la commande et afficher un conflit à résoudre. Ne jamais fusionner deux soldes ni compter les deux opérations comme acceptées.
6. Enregistrer les mouvements, frais et affectations dans une seule transaction PostgreSQL et attribuer une séquence serveur.
7. Renvoyer le résultat accepté ou refusé, récupérer les écritures manquantes et reconstruire l’état local dans une transaction IndexedDB.

La clé d’idempotence protège une reprise après coupure : renvoyer la même commande ne crée jamais un deuxième encaissement. Une contrainte unique ne suffira pas seule ; le serveur devra également vérifier que le contenu d’un UUID déjà utilisé n’a pas changé.

Les politiques RLS utilisent l’identité vérifiée `auth.uid()` et le propriétaire de l’espace, avec `USING` et `WITH CHECK` pour les modifications lorsqu’elles seront autorisées. Les tables exposées sont toutes protégées par RLS. Les vues éventuelles seront créées avec `security_invoker = true`. Aucun secret `service_role` ne sera envoyé au navigateur.

## 12. Plan de réalisation et critères d’acceptation

### Étape 1 — MVP local

Les cinq portefeuilles, le journal, les transferts et frais, les projets, les enveloppes continues, la réserve, l’autonomie, les échéances, les statistiques et les sauvegardes constituent la première version. La publication reste privée. Aucun montant de démonstration n’est injecté dans l’espace personnel.

### Étape 2 — Comptes et synchronisation

Créer ou sélectionner une base Supabase dédiée à Poketra, valider les migrations, les transactions d’écriture, les politiques RLS, les comptes et l’outbox locale. Tester deux appareils, les doublons d’envoi, la perte de réseau et les conflits de financement. Ajouter un verrou local chiffré si l’accès hors connexion doit être protégé sur un appareil partagé.

### Étape 3 — Prêts et perfectionnement

Développer les prêts et remboursements selon les règles définies, les pièces justificatives, les notifications, l’archivage et la modification des métadonnées, les scénarios de trésorerie par échéance et une répartition de revenus en une seule saisie. Les tarifs opérateurs pourront être ajoutés avec une date de validité et confirmation ; ils ne seront jamais inventés.

### Vérifications obligatoires

- Un transfert sans frais conserve le total et tous les budgets.
- Un transfert avec frais de 2 000 Ar diminue le total et les dépenses uniquement de 2 000 Ar.
- Une dépense réduit une seule enveloppe et un seul portefeuille ; le global suit sa somme.
- Un revenu attendu ne change ni le total ni l’autonomie.
- Une provision n’est pas une dépense ; son paiement la consomme sans double déduction.
- Les seuils 80 % et 100 % sont calculés sur des montants exacts.
- L’utilisation de la réserve demande une confirmation et laisse une trace.
- Le changement de mois ne réinitialise aucun budget.
- Une erreur d’écriture ou de sauvegarde ne modifie pas partiellement les soldes.
- Une sauvegarde invalide est refusée avant toute écriture locale.
- Le mode démonstration ne persiste jamais sur l’espace réel.
- Les commandes distantes seront idempotentes et les accès entre comptes seront refusés.

### État de livraison du 12 octobre 2026

La conception fonctionnelle, les calculs, la navigation, l’architecture et le MVP local sont réalisés. L’authentification Supabase, la synchronisation entre appareils et le module de prêts restent à développer et à activer. La création du projet Supabase n’a pas pu être engagée : l’opération nécessaire n’est pas disponible via la connexion actuelle. Aucune base d’ARIZONA ou de FOSA n’a été modifiée.

Les tests automatiques portent sur le moteur, les sauvegardes et les invariants. La compilation de production et le contrôle TypeScript font partie de la livraison. Le navigateur de contrôle requis pour une inspection visuelle Android n’est pas disponible dans cet environnement ; cette inspection et l’installation sur un appareil réel restent à vérifier.

### Références techniques consultées

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Connexion par lien ou code reçu par e-mail](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase — Changelog](https://supabase.com/changelog)
- [PostgreSQL — Contraintes et clés étrangères](https://www.postgresql.org/docs/current/ddl-constraints.html)

Ces références guident l’implémentation technique. Elles n’imposent aucune règle de budget, aucun taux d’épargne et aucune hypothèse de revenu à Poketra.
