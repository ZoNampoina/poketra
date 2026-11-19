# Migration indépendante

Le stockage local reste poketra-v1, version 1, magasin documents. Le journal, les sauvegardes et le moteur financier sont conservés.

Le schéma supabase/poketra.sql est additif et s’applique une seule fois. Les mises à jour de l’application ne modifient pas la base automatiquement. Les accès sont limités aux comptes explicitement inscrits dans poketra_access. Les anciennes opérations restent immuables ; les écritures sont atomiques et idempotentes.

Les justificatifs sont privés. Le transfert utilise des URL temporaires ; la confirmation vérifie leur empreinte, taille et type.

Les données locales sont liées au domaine. Avant de changer d’adresse, exporter la sauvegarde complète de chaque appareil contenant des opérations non synchronisées. Ne pas désinstaller l’ancienne PWA ni vider son stockage. La première connexion sur la nouvelle adresse récupère la copie serveur. Importer ensuite les opérations locales manquantes depuis Sécurité & sauvegardes ; aucun journal plus récent ne doit être remplacé.

Pour la connexion par e-mail, ajouter https://<domaine>/auth/callback aux redirections autorisées de Supabase. Le mot de passe du compte existant reste utilisable. Les clés de service privilégiées ne sont jamais requises dans l’application.

Le build Next.js génère la liste de ressources hors connexion. Les API et les chemins de connexion sont exclus du cache. Les tests utilisent des données synthétiques. Vérifier la connexion, les cinq soldes, les imports, le stockage privé et Android hors connexion avant de basculer définitivement.
