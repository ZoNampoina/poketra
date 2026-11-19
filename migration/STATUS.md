# Migration en préparation — 19 novembre 2026

La version actuelle de Poketra reste disponible. Aucun déploiement Vercel, transfert
de données financières ni changement de la base existante n'a été effectué dans cette étape.

Le répertoire `prepared/` conserve une partie des adaptations rédigées pour la
version indépendante. Ces fichiers doivent être intégrés à la source complète
de la version existante. Ils ne forment pas une nouvelle application autonome.

Travail préparé : transaction PostgreSQL avec contrôle de révision, journal
immuable et idempotence ; accès par propriétaire ; stockage privé ; connexion
indépendante par Supabase ; adaptation de la PWA à Next.js.

Contrôles restant à réaliser : compilation, tests existants, test SQL transactionnel
avec ROLLBACK, import et comparaison des sauvegardes dans un environnement isolé,
contrôles RLS et stockage, tests de connexion et Android hors connexion.

Blocages observés : accès Vercel refusé (autorisation de l'espace nécessaire) ;
environnement d'exécution indisponible avant la fin des tests et de l'envoi du code.

Étapes de reprise :
1. Récupérer la source complète du site existant et les adaptations locales si disponibles.
2. Intégrer les adaptations sans modifier IndexedDB ni le moteur financier.
3. Installer les versions de dépendances épinglées et générer le fichier de verrouillage.
4. Compiler et exécuter la suite de tests avec des données synthétiques.
5. Relire et appliquer le schéma additif ; autoriser uniquement le compte du propriétaire.
6. Importer la copie vérifiée sans remplacer de données plus récentes ; comparer tout le journal.
7. Configurer Vercel, vérifier un déploiement de test, puis basculer seulement après validation.
8. Vérifier les opérations éventuellement restées sur le téléphone avant tout changement d'adresse.

Ne pas appliquer automatiquement le SQL depuis un déploiement de prévisualisation.
Ne jamais publier de sauvegarde financière ou de clé de service.
