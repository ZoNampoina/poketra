# Poketra’ko — Ton argent, tes décisions

**Poketra’ko** est une application financière personnelle en Ariary, installable en PWA. Elle conserve le moteur financier de Poketra, et propose une direction artistique distincte : interface éditoriale marine / corail, navigation lisible et panorama de trésorerie.

## Fonctionnalités disponibles
- Soldes distincts pour MVola, Orange Money, Airtel Money, espèces et banque
- Revenus, dépenses, frais de transfert et transferts internes correctement distingués
- Budgets continus, réserve de sécurité et provisions
- Revenus par projet, échéances, prêts, remboursements et bénéficiaires
- Historique, statistiques, rapports et sauvegardes, fonctionnement local hors connexion
- Synchronisation facultative, si une configuration serveur valide est fournie

## Protection des données
La migration d'identité ne modifie **ni** les tables Supabase, **ni** le modèle financier, **ni** les données IndexedDB (`poketra-v1`). Les exports antérieurs restent compatibles. Aucun fichier financier privé ou secret ne doit être enregistré dans GitHub.

Avant de migrer vers un **autre domaine**, exporter la sauvegarde complète depuis l'ancienne application sur chaque appareil et consulter [docs/MIGRATION.md](docs/MIGRATION.md). Les données IndexedDB sont liées à l'origine web et ne suivent pas automatiquement le changement d'adresse.

## Démarrage
Node.js 24 :

```sh
npm ci
npm test
npm run typecheck
npm run build
npm start
```

Renseigner `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` côté serveur pour les connexions distantes. Voir [docs/MIGRATION.md](docs/MIGRATION.md) pour les autres contraintes.

## Évolution en cinq phases

La feuille de route technique se trouve dans [docs/POKETRAKO-FEUILLE-DE-ROUTE.md](docs/POKETRAKO-FEUILLE-DE-ROUTE.md). Le registre des fonctionnalités **non vérifiées** de Volako se trouve dans [docs/VOLAKO-AUDIT.md](docs/VOLAKO-AUDIT.md).

Le premier lot propose un atelier de simulation en lecture seule et des suggestions locales de catégorie basées sur l'historique. Les résultats restent hypothétiques ; aucune dépense ni aucun paiement n'est créé sans saisie et confirmation.

## Portée de cette version
Cette branche lance le renouvellement visuel et conserve les fonctions préexistantes de Poketra. Ce n'est **pas** une reproduction vérifiée de toutes les fonctions de volako.e-voatra.com : le site de référence ne rend pas ses parcours internes consultables publiquement. Un audit de ses écrans connectés est nécessaire pour établir un périmètre exact.
