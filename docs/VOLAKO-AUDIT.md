# Volako — Registre d'audit fonctionnel (non confirmé)

**Date de vérification :** 22 novembre 2026  
**URL étudiée :** https://volako.e-voatra.com/  
**Objectif :** identifier les modules utiles à intégrer à Poketra’ko sans copier un logiciel ou un habillage propriétaire.

## 1. Constat technique vérifiable

- Le site a été demandé via l'outil de consultation web, qui n'a retourné ni interface utilisable ni contenu de pages internes (erreur de récupération / cache miss).
- Les recherches publiques ciblées sur le domaine et l'expression « Volako e-Voatra » n'ont pas livré de documentation officielle exploitable sur ses fonctionnalités.
- Aucun compte de démonstration ni parcours authentifié n'a été utilisé.
- Aucun écran, endpoint privé, schéma de base de données, technologie interne ou politique d'accès n'a été confirmé.

**En conséquence, aucun élément ci-dessous ne doit être présenté comme une fonctionnalité existante de Volako.** Il s'agit exclusivement de points de contrôle à inspecter.

## 2. Registre des hypothèses, sans les confondre avec les faits

| ID | Domaine à observer | Questions concrètes à vérifier | Statut | Preuve attendue |
|---|---|---|---|---|
| V-01 | Accueil et navigation | Quels écrans existent ? Quels rôles peuvent les ouvrir ? | Non vérifié | Capture écran du menu et page d'accueil |
| V-02 | Portefeuilles | Soldes, comptes bancaires, Mobile Money, fonds et devises ? | Non vérifié | Formulaire et détails de compte |
| V-03 | Transactions | Revenus, dépenses, transferts, frais, corrections, contrepassations ? | Non vérifié | Démonstration de bout en bout |
| V-04 | Budgets | Enveloppes, périodes, seuils, report ou remise à zéro ? | Non vérifié | Écran de budget et règles de calcul |
| V-05 | Prêts et dettes | Capital, intérêts, remboursements, échéanciers ? | Non vérifié | Parcours de création et remboursement |
| V-06 | Projets | Contrats, acomptes, règlements attendus, rentabilité ? | Non vérifié | Écran de projet |
| V-07 | Statistiques | Bilans, catégories, rapports, périodes et comparaisons ? | Non vérifié | Pages de rapports et exports |
| V-08 | Import et automatisation | Lecture SMS, reçu, import fichier, catégorisation ? | Non vérifié | Écran d'import et sortie validée |
| V-09 | Synchronisation | Sauvegardes, comptes, permissions, mode hors connexion ? | Non vérifié | Documentation ou démonstration autorisée |
| V-10 | Personnalisation | Thèmes, catégories, langues, notifications ? | Non vérifié | Paramètres utilisateur |
| V-11 | Sécurité | Authentification, permissions, export, suppression et confidentialité ? | Non vérifié | Paramètres et documentation publiques |
| V-12 | Ergonomie mobile | Installation PWA, écran mobile, accessibilité ? | Non vérifié | Capture mobile et navigation testée |

## 3. Protocole d'audit autorisé

1. Ouvrir le site dans un navigateur humain standard. En présence d'une authentification, **utiliser un compte de démonstration autorisé** ; ne pas publier d'identifiants, codes OTP, tokens, SMS personnels ni données d'autres utilisateurs.
2. Capturer la navigation et un parcours complet par fonction, avec des données de démonstration. Masquer tout nom, téléphone, solde réel ou donnée sensible.
3. Pour chaque fonction, consigner : nom de l'écran, objectif, champs, validations, calculs visibles, étapes, erreurs, rôle utilisateur et contraintes hors ligne.
4. Faire examiner les résultats par le propriétaire autorisé des comptes ; distinguer observations certaines, hypothèses et erreurs.
5. Comparer à la matrice Poketra ci-dessous : doublon, amélioration, nouveau module ou fonction non applicable.
6. Avant codage, écrire des critères d'acceptation et des tests à partir de comportements observables. Développer du code indépendant avec une interface originale.

Aucun contournement d'authentification ou de contrôle d'accès n'est prévu. Aucune copie des textes, logos, ressources, scripts ou de la base propriétaire.

## 4. Matrice comparative de départ

| Domaine | Poketra vérifié dans le code | Volako | Décision en attendant l'audit |
|---|---|---|---|
| Cinq portefeuilles | Oui | Inconnu | Conserver Poketra |
| Budget continu | Oui | Inconnu | Conserver Poketra |
| Projets et sommes à encaisser | Oui | Inconnu | Conserver Poketra |
| Prêts, dettes et échéances | Oui | Inconnu | Conserver Poketra |
| Imports SMS collés | Oui | Inconnu | Conserver Poketra |
| Simulations de décision | Nouvelle fonctionnalité Poketra’ko, lecture seule | Inconnu | Intégrer indépendamment de Volako |
| Sauvegardes / hors connexion | Oui, à revalider en production | Inconnu | Aucun remplacement de stockage |
| Fonction spécifique démontrée dans Volako | Sans objet | Aucune identifiée à cette date | Aucune implémentation prétendument « copiée de Volako » |

## 5. Modèle de fiche de découverte

```
ID       : V-XX
Page     :
URL/chemin public ou écran :
Environnement/données de test :
Objectif utilisateur :
Étapes observées :
Champs d'entrée et validations :
Résultats/calculs constatés :
Cas d'erreur :
Sur mobile :
Hors connexion :
Permissions / confidentialité :
Capture de preuve (redigée) :
Confiance : vérifié / à confirmer / hypothèse
Décision : déjà dans Poketra / enrichir / créer / écarter
Tests d'acceptation :
```

## 6. Statut

**Audit incomplet.** Ne pas inscrire de fonctionnalité « Volako » comme réalisée avant obtention d'une preuve observable et validation du périmètre. Les modules de planification et d'assistance actuellement ajoutés viennent de la feuille de route Poketra’ko, pas d'une découverte vérifiée dans Volako.
