# Poketra’ko — restauration vérifiée sur Android (23 novembre 2026)

## Problème
L’utilisateur sélectionne un JSON de l’ancien Poketra sans observer de changement. Deux défauts de code étaient identifiés : les tests ne simulaient pas le véritable parcours de fichier dans l’UI, et le service worker renvoyait la page d’accueil mise en cache pour toute navigation, indépendamment de l’URL.

## Correctif
- Parcours de restauration autonome aux adresses /auth/import et /import, sans le synchroniseur automatique du tableau de bord. La première contourne l’ancien service worker (exclusion des routes /auth/).
- Sélecteur de fichier natif visible, nom du fichier et étapes affichés immédiatement, erreurs près du bouton.
- Contrôle du JSON, des justificatifs, du nombre de lignes et des soldes ; aucune écriture à la simple sélection.
- Journaux indépendants : confirmation explicite et téléchargement d’une copie vérifiée avant remplacement ; checkpoint local puis lecture de confirmation.
- Synchronisation serveur en étape séparée : identification du compte, contrôle de révision et impossibilité d’effacer un journal distant comportant des opérations au-delà de son solde initial. Archivage automatique de l’ancien solde par la fonction SQL existante.
- Correction du service worker : priorité au réseau pour les navigations, cache des pages exactes et jamais de substitution silencieuse de l’accueil à /import.

## Tests
Le nouveau test UI simule la sélection native d’un fichier JSON dans l’interface React, l’aperçu, les deux confirmations, l’enregistrement local et la relecture IndexedDB ; un fichier invalide est refusé sans modifier les finances. La CI vérifie également TypeScript, Next.js et les tests historiques.

## Sécurité
Ne jamais désinstaller l’ancien Poketra ni vider les données navigateur avant de vérifier les soldes et toutes les opérations exportées. Aucune donnée réelle n’entre dans GitHub.