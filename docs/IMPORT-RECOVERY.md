# Poketra’ko — Import et restauration de l'ancien Poketra

Date : 23 novembre 2026. Correction : `fix/poketrako-import-recovery`.

## Pourquoi l'import semblait ne rien faire

Deux situations étaient insuffisamment prises en charge :

1. **Nouvel appareil / navigateur sans document local :** l'ancien écran demandait systématiquement un point de récupération `checkpointState`, même quand aucun document `workspace` n'existait. Il échouait avant d'enregistrer les opérations.
2. **Nouvel espace déjà initialisé :** l'ancien écran essayait de réunir deux journaux ayant chacun leur propre écriture de solde initial. La validation rejetait logiquement la seconde ouverture ; le message d'échec apparaissait en bas des paramètres, parfois hors écran.

Un troisième obstacle concerne la synchronisation : la fonction serveur refuse de modifier une écriture existante. C'est une protection voulue contre la perte de transactions, qui bloque néanmoins la migration d'un compte ne contenant qu'une première écriture d'initialisation.

## Correction client

- Analyse du JSON V1/V2 et validation des justificatifs avant tout enregistrement.
- Aperçu visible près du bouton : nombre d'opérations actuelles, nombre importé, total avant/après, compatibilité des journaux.
- **Espace sans opérations :** importer le journal sans essayer de sauvegarder un `workspace` inexistant.
- **Journaux compatibles :** fusionner seulement les identifiants d'opération manquants, sans doubler les soldes de départ.
- **Journaux distincts :** proposer une restauration explicite après consentement, en créant un point de récupération local et en téléchargeant une copie complète et vérifiée de l'espace actuel, si celui-ci est présent.
- Confirmation après écriture : relecture et comparaison exacte du journal restauré. Les erreurs sont affichées immédiatement à côté du bouton.
- En cas d'échec, ne jamais réinitialiser IndexedDB, les fichiers, les données distantes ni la file d'attente.

## Synchronisation serveur du premier journal

La nouvelle route `POST /api/restore-initial` est **optionnelle** et exige un consentement distinct dans l'interface. Elle utilise l'authentification du compte Supabase, un contrôle d'origine et la fonction SQL `public.poketra_restore_initial_document`.

Conditions imposées dans la même transaction SQL :
1. Compte authentifié, inscrit dans `poketra_access`.
2. Identifiant de mutation idempotent et révision attendue exacte.
3. Nouveau JSON financier validé par le moteur côté serveur (montants et écritures cohérents).
4. **Historique distant préexistant : une seule écriture de type `opening`, aucune autre transaction.** Toute autre situation est refusée.
5. Archivage obligatoire de l'ancien journal dans `poketra_snapshots` **avant** remplacement.
6. Révision atomiquement incrémentée et accusé de réception vérifié avant suppression de l'outbox locale.

**Aucun transfert n'est exécuté par cette migration SQL** ; elle ne fait qu'installer la fonction de restauration contrôlée. Le transfert réel exige une action explicite de l'utilisateur depuis son navigateur avec son fichier local, sans fournir ses identifiants ou ses opérations à GitHub.

## Cas d'emploi

1. Exporter la **sauvegarde complète JSON** depuis l'ancienne origine Poketra sur le téléphone où les transactions les plus récentes existent.
2. Dans Poketra’ko, aller à **Sécurité et sauvegardes → Choisir une sauvegarde**, sélectionner ce JSON et lire le récapitulatif.
3. Si une incompatibilité de soldes initiaux apparaît, cocher la confirmation de restauration. L'ancien espace local sera d'abord conservé dans un point et téléchargé en JSON.
4. Pour synchroniser aussi le compte en ligne s'il ne contient que son solde initial, cocher l'option distincte.
5. Confirmer la restauration, puis contrôler les cinq portefeuilles et le nombre d'opérations. Le navigateur indiquera séparément si la sauvegarde est synchronisée.
6. Si l'envoi réseau échoue, conserver le JSON, les anciennes PWA et les points de récupération. L'outil affiche une reprise explicite de synchronisation.

## Tests

`tests/restore-flow.test.ts` couvre : navigateur sans document local, espace initialisé indépendamment, fusion d'un journal partagé, validation de sauvegarde V1/V2, restauration explicite + point antérieur, absence de doublons, présence du garde-fou serveur et de l'archivage. La suite CI lance `npm test`, `npm run typecheck` et `npm run build`.

**Limite importante :** cette version n'autorise pas le remplacement d'un compte distant contenant plusieurs opérations, même si un fichier de sauvegarde paraît plus complet. Il faut d'abord examiner le conflit et conserver les deux versions. Les anciennes transactions éventuelles effectuées après la date du JSON sélectionné ne peuvent pas être inventées.
