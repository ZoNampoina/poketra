# Poketra — Mise à jour V1.1.0

Date de réalisation : 12 octobre 2026. Application privée existante : https://poketra.zonampoina.chatgpt.site.

Cette mise à jour garde le projet, son URL, ses cinq portefeuilles, son moteur de journal et ses règles de budgets continus. Les statistiques mensuelles restent des vues d’analyse ; aucun mois ne remet une enveloppe à zéro.

## 1. Audit et conservation

La version 0.1.0 stockait les finances uniquement dans IndexedDB sur chaque appareil. Aucun serveur financier, compte Supabase, prêt ou synchronisation n’était actif. La protection en ligne venait de l’accès privé Sites. Le Service Worker attendait le réseau avant de servir l’interface.

Stockage conservé : base `poketra-v1`, version IndexedDB 1, magasin `documents`, document `workspace`. Les nouvelles clés contiennent les points de récupération, la file `outbox`, l’état `sync`, les justificatifs et les diagnostics. Le journal original, ses UUID, dates, montants et mouvements ne sont pas réécrits par la migration.

Avant extension applicative vers `extra.schemaVersion = 2`, Poketra valide l’ancien état, vérifie sa sauvegarde JSON restaurable, compare tous les soldes, affectations et écritures puis enregistre le nouvel état et le point `checkpoint:before-v11` dans la même transaction. Toute incompatibilité suspend la saisie et laisse le document original intact. Les opérations non synchronisées restent dans le journal local et dans une file durable.

Aucune sauvegarde serveur de données réelles ne pouvait être extraite avant la mise à jour : le serveur financier n’existait pas. Le téléphone n’est pas accessible au développeur. La copie automatique avant migration protège l’évolution locale, mais une copie téléchargée indépendante reste nécessaire contre la perte du téléphone.

## 2. Première ouverture sur Android

1. Si l’ancienne version est encore ouverte, utiliser **Paramètres → Exporter** et garder le fichier JSON dans un emplacement privé hors du stockage de Poketra.
2. Fermer les autres onglets Poketra. Ouvrir la même application avec une connexion stable et le même compte privé.
3. Si le bandeau de mise à jour apparaît, choisir **Sauvegarder et mettre à jour**. Un point local est vérifié avant activation du nouveau Service Worker. Ne jamais vider les données applicatives.
4. Vérifier les cinq soldes dans **Plus → Vérifier mes soldes** et le nombre d’écritures dans **Sécurité & sauvegardes → Vérifier l’intégrité**.
5. Faire **Sauvegarde complète**. Cet export JSON inclut les données actuelles, les préférences et les justificatifs présents, y compris ceux non synchronisés. Le fichier est en clair : le conserver en privé.
6. Attendre la mention **Synchronisé**. Une erreur ou un état **En attente** ne supprime pas les opérations locales. Revenir dans Sécurité pour relancer la vérification et exporter la sauvegarde serveur.
7. Dans Paramètres, attendre **Interface prête hors connexion** avant de tester le mode avion. Les justificatifs téléchargés sont disponibles localement ; les fichiers encore uniquement sur le serveur doivent d’abord être ouverts ou exportés.

En cas de page d’accueil vide alors que des finances existaient, ne pas recréer des soldes de départ. Garder l’appareil et l’espace original, exporter ce qui est accessible, puis récupérer la bonne sauvegarde dans un autre espace de navigateur. En cas d’état invalide, l’écran de récupération permet d’exporter le document original sans le modifier.

## 3. Règles financières

| Opération | Solde réel | Revenus / consommation | Affectations |
|---|---|---|---|
| Revenu encaissé | Augmente le portefeuille reçu | Revenu réel | Non attribué global ou propre au projet |
| Revenu attendu | Aucun effet | Séparé des encaissements | Aucun argent créé |
| Dépense | Débite une seule fois le portefeuille | Somme des parts et frais | Chaque enveloppe / provision concernée diminue |
| Transfert interne | Source − montant − frais ; destination + montant | Seuls les frais sont une dépense | Seuls les frais consomment des fonds |
| Prêt accordé / avance | Débit du capital | Capital hors consommation | Source de financement choisie |
| Emprunt reçu | Crédit du capital | Capital hors revenu gagné | Non attribué, dette suivie séparément |
| Remboursement | Capital et intérêts distingués | Seuls les intérêts sont un revenu ou une charge | Fonds concernés explicites |
| Échéance future | Aucun débit avant paiement | Prévision uniquement | Part déjà provisionnée non déduite à nouveau |
| Correction justifiée | Delta entre constaté et calculé | Hors revenus gagnés et consommation | Non attribué pour un surplus ; source choisie pour un manque |
| Annulation | Contre-écriture, aucune suppression | Neutralisation de l’opération active | Refus si elle rend des fonds négatifs |

Identité permanente : **total = réserve + provisions + enveloppes + non attribué**. Le budget global disponible est dérivé des enveloppes. L’argent hors réserve et provisions peut couvrir les budgets et le non attribué : il ne faut pas le réadditionner au total.

Une dépense fractionnée débite un portefeuille une fois. La somme des parts doit égaler exactement le principal ; les frais sont en plus et identifiés comme frais financiers. Une réaffectation à la saisie est explicite. La réserve exige un avertissement et une confirmation, sans bloquer une dépense réelle correctement financée.

L’autonomie utilise le repère de besoins indispensables sur 30 jours, sans nouveau revenu. Elle distingue la réserve et retire les provisions. Cette estimation reste prudente si des besoins du repère sont aussi provisionnés. La prévision par échéance retire uniquement la part non couverte des obligations et remboursements d’emprunts dans l’horizon choisi ; elle n’ajoute jamais un revenu annoncé.

## 4. Fonctionnalités V1.1

| Domaine | Fonctionnement |
|---|---|
| Saisie | Cinq types, montant, date locale Madagascar, portefeuille et catégorie mémorisés, détails facultatifs, sous-catégorie, enregistrement et nouveau / fermer |
| Favoris et duplication | Préremplissage sans enregistrement automatique, montant vérifiable, duplication des parts et des frais, annulation immédiate par contre-écriture |
| Portefeuilles | MVola, Orange Money, Airtel Money, Espèces et Banque restent indépendants ; page de rapprochement des cinq comptes |
| Mobile Money | Dépôts/retraits/transferts, tiers comme dépenses, frais modifiables, modèles personnels par opérateur et tranche, derniers frais proposés |
| SMS | Collage manuel, analyse locale conservative, avertissements si ambigu, référence contrôlée contre les doublons, confirmation dans le formulaire |
| Fractions | Catégories, bénéficiaires, source et projet par part ; exactitude du total contrôlée |
| Famille | Personnes personnalisées, renommage par alias sans altérer le journal, filtre de période et nature aide/cadeau/capital, historique et analyses |
| Budgets | Enveloppes continues, réaffectations, seuils 80/100 %, global dérivé, réserve protégée et montants non attribués conservés |
| Trésorerie | Horizon 30/90/365 jours, récurrences mensuelles, couverture des provisions, manque éventuel, objectif de réserve en mois, vigilance et simulation avant grosse dépense |
| Projets | Convenu/encaissé/restant/dépensé/provision/résultat/non attribué séparés, statut et date attendue, association et annotations sans changement des soldes |
| Prêts | Prêts et avances, emprunts, capital restant, remboursements partiels, intérêts et échéances séparés |
| Dépenses programmées | À venir/payé/reporté/annulé, date et portefeuille prévus, bénéficiaire, provision, paiement explicite ; ancrage du jour préservé pour une récurrence mensuelle |
| Justificatifs | Photo JPEG/PNG/WebP et PDF, compression jusqu’à 1 800 px et qualité 87 %, maximum 6 Mo après compression, aperçu/téléchargement privé, détachement sans supprimer la transaction |
| Recherche | Texte, montant, bornes, dates, portefeuille, catégorie/sous-catégorie, personne, projet, note, référence et type ; tris et pagination de 40 |
| Rapports | CSV, XLSX et PDF paginé, colonnes/période/portefeuille/catégorie/projet/type/notes et orientation configurables ; données de soldes et budgets clairement actuelles |
| Sécurité | Accès privé existant, isolation serveur par propriétaire, masquage visuel, coffre local AES-GCM facultatif, verrouillage manuel ou délai configurable |
| Personnalisation | Cartes et portefeuilles réordonnables, cartes masquées, accueil préféré, clair/sombre/système, trois tailles de texte, catégories/couleurs/icônes/favoris/archivage |
| Analyses | Semaine/mois/trimestre/année/période/libre/dernier paiement de projet, catégories/portefeuilles/personnes/projets, comparaison, plus grosses dépenses, courbes des soldes et réserve enregistrés |
| Hors ligne | Interface préchargée, saisie et annotations locales, file durable, statut de synchronisation, fusion contrôlée et reprise des justificatifs |

Les justificatifs sont joints depuis le détail d’une transaction enregistrée. Une pièce détachée est archivée et conservée pour la récupération des sauvegardes ; il n’y a pas de destruction automatique de ses octets.

## 5. Serveur et synchronisation

D1 contient quatre nouvelles tables : `poketra_documents`, `poketra_requests`, `poketra_snapshots`, `poketra_files`. R2 conserve les états versionnés et les justificatifs dans des chemins propres au propriétaire. Les ressources sont accessibles uniquement par les routes privées, jamais par une URL R2 publique.

Chaque requête obtient le propriétaire du contrôle d’identité Sites. Les requêtes SQL incluent ce propriétaire. Les écritures ont un contrôle de révision et un UUID idempotent ; le changement du pointeur et son accusé de réception sont atomiques. Le serveur refuse la suppression ou la réécriture d’un journal déjà confirmé. Les origines étrangères sont refusées pour les écritures. Les API financières ne sont jamais mises en cache par le Service Worker.

Une file en attente ne disparaît qu’après confirmation exacte du contenu envoyé. Si une nouvelle opération arrive pendant l’envoi ou après une confirmation perdue, elle reste locale et retrouve son état commun avant l’envoi suivant. Deux journaux compatibles sont fusionnés ; des métadonnées incompatibles ou des financements devenant négatifs produisent un conflit à examiner. Les deux versions sont exportables. Aucun arbitrage automatique ne remplace silencieusement un solde.

La sauvegarde serveur courante et l’historique de versions sont disponibles dans Sécurité. L’API permet aussi de récupérer une révision précise. Un export serveur incomplet en justificatifs est refusé ; la sauvegarde locale complète reste la référence pour les fichiers en attente.

## 6. Sauvegardes, coffre et récupération

- Point initial avant migration et point avant la première écriture de chaque jour ; aucun nettoyage automatique des points.
- Points manuels, avant import, fusion, adoption distante, chiffrement et activation du Service Worker.
- Export complet JSON vérifié par lecture, validation financière et empreinte SHA-256 des fichiers.
- Restauration par fusion : les UUID existants restent intacts, les éléments absents sont ajoutés, une incohérence est refusée. Sur un espace vierge, la sauvegarde est restaurée intégralement. Les fichiers importés sont remis en attente pour confirmer leur présence durable sur le serveur.
- Récupération d’une version antérieure par export ; les opérations erronées du journal courant s’annulent par contre-écriture plutôt que par remplacement destructif du journal.

Le coffre chiffre le document, la file, les justificatifs, points de récupération et préférences locales. AES-256-GCM utilise un sel et un nonce aléatoires ; PBKDF2-SHA256 effectue 600 000 itérations. Le code doit comporter au moins huit caractères. La clé reste uniquement en mémoire et le code n’est pas envoyé au serveur. Une sauvegarde indépendante et le code doivent être conservés avant activation. Le masquage des montants seul ne chiffre rien. Aucune biométrie non vérifiée n’a été introduite.

L’export JSON complet est en clair, même quand le coffre est actif. Le coffre local ne constitue pas un chiffrement de bout en bout du serveur ; le serveur reste privé sous contrôle d’accès de l’hébergement.

## 7. Performances et vérification

L’accueil local n’attend plus une réponse de synchronisation. Le cache d’interface est servi en priorité. Les pages secondaires, graphiques, PDF et détails sont chargés à la demande ; les soldes et opérations actives sont mémorisés sur les états immuables. L’historique affiche 40 lignes par page. Les index primaires D1 servent les requêtes par propriétaire, révision et UUID.

Le diagnostic dans Sécurité mesure le stockage, le premier rendu disponible, les ressources et le moment où l’interface est prête dans le navigateur réel. Les prochaines ouvertures peuvent être étiquetées à froid, à chaud ou hors connexion. Une donnée locale affiche sa date de sauvegarde ; une confirmation serveur affiche sa date distincte.

Les tests couvrent les calculs, frais, prêts, fractions, réserves, projets, corrections, sauvegardes, compatibilité ancienne, chiffrement, SMS, rapports, concurrence IndexedDB/serveur, envois rejoués, pertes de réponse, fusion de deux appareils simulés, isolation des comptes, saisie React et Service Worker simulé. Les montants utilisés sont synthétiques. Le rapport d’exécution accompagne les mesures et résultats exacts de la publication.

## 8. Vérifications restant sur le téléphone

Le démarrage Android proche de deux secondes, le clavier virtuel, la caméra, le rendu tactile, la rotation, le bouton Retour matériel, la mise à jour du Service Worker installé et la synchronisation sous la véritable session du propriétaire nécessitent une vérification sur l’appareil. Les tests de calcul, DOM et cache simulés ne sont pas présentés comme des tests physiques Android.

Les barèmes officiels, la lecture automatique de la boîte SMS et une biométrie non compatible ne sont pas intégrés. La saisie programmée supporte une échéance unique et la récurrence mensuelle ; d’autres fréquences peuvent être ajoutées sans changer le journal. Les dates prévisionnelles ne déclenchent pas de débit automatique.

Conserver la priorité protection des données → performances → fiabilité des opérations → fonctionnalités → finition visuelle. Ne pas republier un ancien client incapable de lire les nouveaux types : corriger V1.1 en avançant, sans effacer le journal ni annuler les migrations appliquées.
