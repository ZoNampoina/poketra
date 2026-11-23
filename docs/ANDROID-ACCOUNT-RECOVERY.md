# Synchronisation PC → Android : récupération sécurisée

Date : 23 novembre 2026.

## Diagnostic

Le journal importé sur ordinateur a été confirmé dans le projet Supabase connecté à Poketra’ko : **114 opérations sur le serveur**, avec un snapshot de l'ancien solde initial. Si Android ne montre pas cet historique, le problème concerne son compte, son application installée ou ses données locales, pas l'absence d'un transfert PC → serveur.

L'application récupère déjà automatiquement le document distant lorsqu'aucune écriture locale ne s'oppose à la récupération. En revanche, un espace Android initialisé séparément possède un autre événement d'ouverture et une file d'attente locale. La fusion automatique échoue volontairement pour éviter de cumuler deux soldes de départ. L'utilisateur doit pouvoir résoudre ce cas explicitement sans supprimer d'opérations.

## Fonction

Page autonome [Récupérer depuis mon compte] `/auth/recover` :
- utilise les cookies Supabase existants et le formulaire de connexion de Poketra’ko ;
- vérifie que le compte est bien l'espace autorisé par le serveur ;
- compare le nombre d'opérations et les montants **du journal serveur et du journal Android** ;
- si l'Android contient un autre état, fabrique une **sauvegarde complète JSON vérifiée** (justificatifs inclus), exige sa conservation et demande une confirmation distincte ;
- crée un checkpoint local, contrôle la révision Android et la révision du serveur, puis reprend le document distant par l'opération `adoptRemote` existante ;
- relit le document, compare les opérations et les soldes, confirme la liaison du compte et l'absence de file d'attente d'anciennes écritures ;
- **ne modifie jamais le journal Supabase** ; aucune requête POST, aucun changement RLS ou migration.

La route `/auth/recover` contourne également l'ancien service worker qui ignorait déjà `/auth/`.

## Scénarios testés

- Android avec solde local initial distinct → comparaison et récupération seulement après confirmation, ancien document conservé dans un checkpoint, aucun appel POST.
- Android vierge → récupération du document depuis le compte.
- Identifiant de compte différent → refus.
- Historique serveur changé entre aperçu et confirmation → refus.
- Affichage de l'écran de récupération et de l'option de sauvegarde.

## Précautions

- Ne pas supprimer l'ancienne application ni vider IndexedDB / le cache.
- Sur Android utiliser l'adresse **https://poketra-rho.vercel.app/auth/recover**, et se connecter avec le même compte que sur le PC.
- Une sauvegarde est indispensable avant de remplacer un historique local Android.
- Si l'Android possède des opérations propres absentes du serveur, celles-ci ne sont pas fusionnées par cet assistant ; elles sont préservées dans la copie de sécurité à réconcilier manuellement.
