# Poketra’ko — Plan technique de réalisation (phases 1 à 5)

Date : 22 novembre 2026  
Dépôt : [ZoNampoina/poketra](https://github.com/ZoNampoina/poketra)  
Branche de préparation : `feature/poketrako-roadmap-p1-p5`  
Référence : Poketra V1.1.1 renommé Poketra’ko, Next.js 16, React 19, TypeScript, PWA, IndexedDB `poketra-v1`, Supabase côté serveur.

## 0. Objectif et périmètre

Construire une application de finances personnelles cohérente à partir de Poketra, enrichie d’outils de décision et de fonctions de Volako **uniquement après vérification**. L’existant n’est pas remplacé par un nouveau journal. La version actuelle de Poketra’ko conserve les mêmes opérations, portefeuilles, budgets, projets, prêts et sauvegardes.

Périmètre autorisé sans accès supplémentaire : code GitHub, règles financières locales, interface, tests et documentation. Les données réelles dans les navigateurs/serveurs, les comptes, les déploiements et les justificatifs privés ne sont pas disponibles dans l’audit du dépôt.

### Garanties non négociables

1. L’identité de calcul `total portefeuille = réserve + provisions + enveloppes + non attribué` reste exacte. Les corrections historiques utilisent une contre-écriture.
2. Un montant contractuel attendu n’augmente jamais le solde. Un transfert entre portefeuilles n’est pas une dépense ; seuls ses frais en sont une.
3. Pas d’écriture financière induite par une simulation, un import prévisualisé, un classement suggéré ou un rappel.
4. Garder `poketra-v1` / magasin `documents` / clé `workspace` tant qu’une migration explicite, testée et réversible n’est pas approuvée.
5. Préserver les identifiants, dates, montants, pièces et points de récupération des anciennes opérations. Ne pas écraser des données non synchronisées.
6. Protéger l’accès par propriétaire et les justificatifs privés. Aucune clé Supabase privilégiée dans le client ou dans GitHub.
7. Mode hors connexion d’abord ; statut de synchronisation explicite ; en cas de conflit, export et arbitrage humain, pas d’écrasement silencieux.

## 1. Architecture cible

| Domaine | Référence dans le dépôt | Politique |
|---|---|---|
| Journal et calculs | `lib/finance.ts`, `lib/validation.ts` | Source unique de vérité |
| Fonctions financières étendues | `lib/advanced-finance.ts` | Projets, prêts, échéances, vigilance |
| Métadonnées & préférences | `lib/models.ts` | Évolution additive avec garde-fous |
| Données locales | `lib/storage.ts`, `lib/vault.ts` | IndexedDB, transactions atomiques, coffre facultatif |
| Synchronisation | `lib/sync.ts`, `lib/supabase-store.ts`, `app/api/*` | Révision, authentification et séparation par compte |
| Interface | `app/poketra.tsx`, `app/poketrako.css`, `app/*` | Responsive, composants isolés, chargement différé |
| Analyse de scénarios | `lib/decision-support.ts`, `app/decision-lab.tsx` | Fonctions pures, lecture seule |
| Assistances de saisie | `lib/decision-support.ts`, `lib/sms.ts` | Proposer et confirmer, jamais enregistrer seul |
| Référentiel externe | `docs/VOLAKO-AUDIT.md` | Preuves, inconnues, exigences à comparer |
| Tests | `tests/*.test.ts`, `.github/workflows/ci.yml` | Test, TypeScript et build avant fusion |

Aucune table Supabase ni structure `State` n’est modifiée dans ce premier lot. Les nouvelles fonctionnalités de la branche lisent l’état courant sans le persister.

## 2. Phase 1 — Consolider Poketra

**Déjà présent :** cinq portefeuilles, budgets continus, frais, revenus de projets, prêts, provisions, échéances, historique, rapports, sauvegardes, chiffrement local facultatif et PWA.

**Travaux :**
- P1.1 — Formaliser les invariants monétaires avec tests unitaires de non-régression sur les cinq soldes, opérations fractionnées, transferts, prêts, contre-écritures et cas de conflit.
- P1.2 — Mesurer les performances à froid/à chaud, du journal et des gros historiques ; éviter les accès synchrones bloquants.
- P1.3 — Éprouver import/export complet et récupération d’une sauvegarde ancienne en présence de nouvelles écritures.
- P1.4 — Tester la synchronisation entre deux appareils et les erreurs réseau sans toucher aux données de production.
- P1.5 — Vérifier l’isolement des fichiers justificatifs et le maintien du coffre local.

**Livrable d’acceptation :** suite de tests verte, schéma inchangé ou migration vérifiée, restauration possible, pas de double comptabilisation, aucun retour à zéro involontaire.

## 3. Phase 2 — Repenser l’expérience

**État :** direction visuelle Poketra’ko marine/corail déjà intégrée ; nouvelle entrée vers l'atelier de décision sur cette branche.

**Travaux :**
- P2.1 — Clarifier les cinq concepts : total détenu, disponible, réserve, provisions, argent attendu.
- P2.2 — Navigation commune mobile/ordinateur : Accueil, Opérations, Portefeuilles, Projets, Budgets, Atelier de décisions et fonctions secondaires.
- P2.3 — Réduire les champs de saisie sans cacher les frais et sources de financement ; garder une confirmation explicite.
- P2.4 — États vides utiles, erreurs compréhensibles, clavier, contraste, `prefers-reduced-motion`, police scalable et masquage des montants.
- P2.5 — Tester les écrans à 360/390/768/1280 px, notamment les barres de navigation et les modales.
- P2.6 — Parcours Android hors connexion et installation PWA avec les mêmes fonctions critiques.

**Livrable d’acceptation :** une transaction ordinaire saisissable rapidement, aucun bouton sans action, pas de débordement mobile, navigation utilisable au clavier, stockage inchangé.

## 4. Phase 3 — Intelligence financière

**Implémenté dans le premier lot :** `evaluateScenario(state,input)` et l’écran `DecisionLab` permettent de simuler un achat, un supplément de dépenses essentielles sur 30 jours et des échéances à horizon 30/90/365 jours, sans sauvegarder le scénario.

Le simulateur présente **deux lectures distinctes** :
1. disponible après achat et après part non provisionnée des échéances ;
2. autonomie indicative en jours d’après les besoins essentiels.

Ces résultats **ne s’additionnent pas**, car une échéance peut aussi faire partie des besoins essentiels de référence. Pas de revenu futur supposé et pas de dépense simulée enregistrée.

**Travaux complémentaires :**
- P3.1 — Calendrier projeté jour par jour, contrôle des chevauchements entre besoins récurrents et échéances explicites.
- P3.2 — Scénarios comparables et enregistrables uniquement comme hypothèses séparées du journal.
- P3.3 — Sensibilité à une période sans revenu, délais de paiement, variation des besoins et évènements exceptionnels.
- P3.4 — Alertes explicables (hypothèses affichées), avec option de désactivation et aucun paiement automatique.
- P3.5 — Prédictions uniquement à partir d’hypothèses consenties et de données fiables ; jamais de promesse de revenu.

**Livrable d’acceptation :** même état financier avant/après simulation, refus des montants non sûrs, cohérence des projections et résultats accompagnés d’hypothèses.

## 5. Phase 4 — Automatisation encadrée

**Déjà présent :** analyse de SMS collé, favoris, duplication, propositions de frais, dépenses programmées. L’utilisateur confirme avant toute écriture.

**Implémenté dans le premier lot :** `suggestExpenseCategory(state,label)` reconnaît un libellé identique déjà utilisé au moins deux fois avec une catégorie stable (hors opérations annulées et catégories archivées). Cette recommandation est locale, explicable et peut seulement **préremplir** une saisie à confirmer. `localInsights` affiche des repères calculés sans tâche en arrière-plan ni écriture.

**Travaux complémentaires :**
- P4.1 — Détection des doublons de référence avant tout import Mobile Money, avec écran de prévisualisation.
- P4.2 — Reconnaissance OCR de reçus en option, avec consentement, prévisualisation et suppression des données temporaires.
- P4.3 — Catégorisation plus souple après tests de faux positifs ; possibilité de désactiver et corriger toutes les suggestions.
- P4.4 — Rappels d’échéances uniquement après opt-in et en respectant les restrictions des navigateurs et d’Android.
- P4.5 — Import manuel de relevés standardisés ; aucune connexion automatique à un compte bancaire ou Mobile Money non autorisée.

**Livrable d’acceptation :** aucune opération créée sans validation, aucune extraction privée transmise hors appareil à l’insu de l’utilisateur, doublons contrôlés, fonctionnement local stable.

## 6. Phase 5 — Fonctions propres à Volako

Le site `https://volako.e-voatra.com/` n’a pas fourni d’écrans exploitables lors de la tentative de consultation publique du 22 novembre 2026. **Aucune fonctionnalité spécifique de Volako n’est considérée comme vérifiée.**

Le registre de preuves et de questions est dans [VOLAKO-AUDIT.md](VOLAKO-AUDIT.md). La réalisation se fera seulement après :
- démonstration ou captures d’écran de chaque page autorisée ;
- description du parcours, des champs et des règles observées ;
- identification des chevauchements avec Poketra ;
- hiérarchisation des fonctions supplémentaires ;
- validation des règles de sécurité, de licence et des tests.

**Livrable d’acceptation :** fiche fonctionnelle par module sourcée par une preuve, comportement testé, implémentation originale et non copie de code ou de marque.

## 7. Ordre d’exécution et portes de qualité

| Itération | Travail prioritaire | Condition pour passer |
|---|---|---|
| A (cette branche) | P1 base conservée + P2 navigation atelier + P3 simulation + P4 suggestions + P5 registre d'audit | GitHub Actions : tests, typecheck et build verts |
| B | Régression données et synchronisation multi-appareils, audit accessibilité et Android | Exports restaurables, aucune perte mesurée |
| C | Prévisions détaillées, scénarios nommés et qualité UX | Calculs explicables, tests de chevauchement |
| D | OCR/imports, rappels opt-in et classification améliorée | Faux positifs contrôlés et confirmation utilisateur |
| E | Fonctionnalités confirmées de Volako | Preuves et cahier des charges validés |
| F | Préproduction, tests navigateur et déploiement contrôlé | Backup vérifié sur chaque appareil, permissions et santé serveur confirmées |

## 8. Plan de tests

- **Unitaires :** règles F/State, projections, montants extrêmes, classification stable ou contradictoire, événements annulés.
- **Intégration :** IndexedDB ancienne version, `outbox`, récupération, sauvegarde JSON et justificatifs.
- **API :** authentification, séparation de compte, contrôle de révision, requêtes rejouées.
- **E2E à réaliser :** Android/mobile, mode avion, accueil avec grand historique, saisie, retour, installation et mise à jour.
- **Sécurité :** exposition des secrets, URLs signées, protection XSS des exports, concurrence et permissions.
- **Validation finale :** `npm ci`, `npm test`, `npm run typecheck`, `npm run build` via GitHub Actions ; tests navigateur réels non remplacés par cette CI.

## 9. Déploiement et migration

Le déploiement doit être **séparé** de la fusion du code. Avant une nouvelle adresse, exporter les sauvegardes locales sur chaque appareil, contrôler les opérations non synchronisées et configurer la redirection Supabase autorisée. Un changement de domaine ne transporte **pas** IndexedDB automatiquement.

Ne pas effacer l’ancienne PWA ni supprimer son origine de stockage. Lire aussi [MIGRATION.md](MIGRATION.md). Un déploiement Vercel peut rester inaccessible si les permissions GitHub ou l'accès au projet sont bloqués : cela ne justifie pas de réinitialiser les comptes ou les données.

## 10. État d’avancement du lot A

| Élément | État |
|---|---|
| Calculs et stockage historiques | Conservés ; sans migration |
| Écran Atelier de décisions | Code ajouté dans la branche de travail |
| Simulation non destructive | Code + tests ajoutés |
| Conseils locaux de catégorie | Code + tests ajoutés ; contrôle humain |
| Audit Volako | Registre d’inconnues |
| OCR / apprentissage / connecteurs Mobile Money | Non réalisés |
| Scénarios persistés | Non réalisés |
| Test navigateur réel et déploiement | Non réalisés dans ce lot |
| Tests CI GitHub | À confirmer dans le résultat de la PR |
