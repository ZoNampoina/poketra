# Intégration à reprendre avec la source complète

Les fichiers de `prepared/` indiquent leurs destinations relatives dans la source.
Le fragment `receipts-sync.fragment.ts` remplace uniquement la fonction correspondante :
il ne doit pas être conservé comme module indépendant compilé.

- Conserver le moteur financier, IndexedDB, les sauvegardes et l'interface existants.
- Passer de Vinext/Sites à Next.js : scripts dev/start avec next, build avec
  `next build --webpack && node scripts/pwa-assets.mjs`.
- Ajouter les versions vérifiées `@supabase/ssr 0.12.7` et
  `@supabase/supabase-js 2.119.1`. Épingler les autres dépendances d'après le
  verrouillage d'origine ; générer et conserver package-lock.json.
- Retirer les modules de construction propres à Sites et les importations
  `cloudflare:workers` de l'application de production.
- Conserver l'ancien adaptateur D1 dans une fixture de test en corrigeant
  ses importations. Faire pointer les anciens tests serveur vers cette fixture.
- Intégrer le panneau de connexion dans Sécurité & sauvegardes, avec champs e-mail
  et mot de passe, options explicites d'envoi de lien et de vérification du code.
  Aucun e-mail n'est envoyé automatiquement.
- Ajouter un bouton Mon compte dans l'en-tête ; proposer de récupérer le compte
  sur le premier écran avant d'initialiser des soldes.
- Exclure les chemins /auth/ du service worker, en plus de /api/.
- Laisser le shell initial sans données personnelles afin de pouvoir le mettre
  en cache hors connexion ; ne pas mettre les API ou réponses d'identité en cache.
- Ajouter les règles de confidentialité du dépôt pour exclure .env, sauvegardes
  et fichiers générés de la PWA.
- Mettre à jour la documentation et la version en 1.1.1 ; réaliser les tests
  avant de promouvoir un déploiement.

Le schéma proposé et la configuration ne contiennent aucune identité personnelle,
donnée financière ni clé. L'autorisation du propriétaire et l'import se feront
séparément après vérification de la sauvegarde et de son compte.
