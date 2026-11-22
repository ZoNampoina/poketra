# Poketra’ko — Agenda financier, conversion de devises et aide

Date : 22 novembre 2026. Dépôt : `ZoNampoina/poketra`.

## Objectif UX

- Réduire les slogans, descriptions répétées et grands panneaux qui repoussent les données utiles sous l'écran.
- Conserver une interface singulière, mais faire passer les actions, soldes et événements avant les textes de présentation.
- Fournir une **aide contextuelle facultative** depuis la barre supérieure et le menu latéral ; elle n'apparaît pas par défaut.
- Retirer le bouton texte « Mon compte » du bandeau ; l'avatar donne accès aux sauvegardes et à la connexion.
- Rendre la pastille d'état de synchronisation ouvrable : les erreurs mènent à Sécurité et sauvegardes, sans dissimuler une erreur réelle.

## Agenda financier (`app/financial-agenda.tsx`, `lib/agenda.ts`)

Sources **existantes** (aucun schéma nouveau) :
- échéances ponctuelles et mensuelles : montant, date et statut payé/prévu, maintien de l'ancrage du jour de récurrence ;
- projets : date de règlement estimée (`expectedDate`) et **montant encore attendu**, jamais ajouté aux liquidités ;
- prêts : date d'échéance et capital restant (selon mouvements réellement enregistrés) ;
- revenus encaissés et dépenses inscrites au journal actif, hors annulations.

L'affichage permet de parcourir les mois, sélectionner un jour et filtrer les événements prévus ou réalisés. Chaque événement renvoie au module existant approprié. Les échéances ne provoquent **aucun débit automatique**. Les montants prévus de projets et de prêts restent des repères incertains. Une échéance payée reste marquée réalisée. Le calendrier n'enregistre pas de nouveau type de paiement ou de rendez-vous libre : une telle fonction nécessiterait un modèle et une migration additive séparés.

## Conversion de devises (`app/currency-converter.tsx`, `lib/currency.ts`, `app/api/fx/route.ts`)

Devises disponibles : MGA, EUR, USD, GBP, CNY, JPY, CHF, CAD, ZAR, INR.

- Récupération **sur demande** d'un taux indicatif via l'API publique Frankfurter v2 : `/v2/rate/{BASE}/{QUOTE}`. La route interne contrôle la liste des devises, le résultat, la date et la paire retournée.
- Source officielle de la documentation : https://frankfurter.dev/ . Frankfurter publie des taux de référence provenant de banques centrales ; ce ne sont **pas** des cours de vente définitifs.
- Le dernier taux utilisé est affiché avec la **date retournée**, pas avec la date du téléphone. Un taux manuel modifié par l'utilisateur est identifié « Taux manuel » ; le simulateur reste utilisable hors connexion.
- L'API ne reçoit que les codes des devises, **pas les montants saisis ni les finances du foyer**. Les entrées restent sur l'appareil ; il n'y a pas de stockage permanent des hypothèses ou montants.
- Une contre-valeur en Ariary peut être comparée au disponible pour simuler un achat ; aucun wallet n'est modifié, et les frais de change, spreads et commissions ne sont pas appliqués.
- L'Ariary reste la devise comptable de Poketra’ko, sans conversion automatique des soldes réels ou de l'historique.

**Limites :** toute valeur présentée est une estimation, dépendant de la source et de sa date ; en cas d'indisponibilité du réseau, l'appareil ne récupère pas un taux fictif et requiert la saisie d'un taux manuel.

## Conservation des données existantes

Aucun changement de `State`, `Extras`, `poketra-v1`, des opérations, soldes, affectations, justificatifs, synchronisation ou tables Supabase. Les deux modules font des lectures pures de l'état, sans appeler `saveState` ou `commit`. Les tests couvrent les dates récurrentes, une échéance payée, les projets, les opérations annulées, les emprunts, les conversions non sûres et l'absence de mutation.

**Important :** une URL web différente n'a pas accès à l'IndexedDB de l'ancienne origine. Avant la migration vers `poketra-rho.vercel.app`, conserver et vérifier une sauvegarde complète sur chaque appareil, puis identifier le compte utilisé pour la synchronisation.

## Recommandations de contrôle

1. Sur ordinateur, vérifier l'aide par icône, la navigation, l'avatar compte et l'absence des slogans de l'accueil.
2. Sur Android, contrôler le calendrier à 360 px, la sélection d'un jour, le défilement du menu et le convertisseur.
3. Hors connexion, contrôler le taux manuel et l'agenda, sans nouvelle synchronisation ou perte de données.
4. En ligne, charger EUR/MGA puis MGA/EUR, constater la date du taux et l'avertissement sur les frais.
5. Dans un espace de démonstration, vérifier un projet daté, un prêt remboursé, une échéance mensuelle et une dépense annulée.
6. Avant de diffuser : tests GitHub (unitaires, TypeScript, build), puis tests navigateur sur la version de production et statut de synchronisation de l'utilisateur.

## Diagnostic de « Synchronisation à vérifier »

La pastille de synchronisation ouvre maintenant le module Sécurité et sauvegardes. Cette erreur peut dépendre d'une connexion manquante, d'un compte non autorisé, d'un problème de réseau ou d'une API serveur indisponible. Ne jamais effacer le stockage local ou recréer des soldes pour résoudre cette pastille : vérifier l'identité/état de synchronisation et exporter les données d'abord.
