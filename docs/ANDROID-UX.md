# Poketra’ko — audit et correctifs Android

Date : 23 novembre 2026 · Branche : `fix/android-mobile-experience`.

## Constats dans le code (avant correction)

1. Navigation mobile : cinq premiers boutons du menu PC recopiés en bas, aucun raccourci direct vers les transactions ou l'agenda, plus un bouton de saisie flottant pouvant couvrir le contenu.
2. Le bouton-avatar menant au compte était masqué sur écran étroit alors que le bouton texte « Mon compte » avait été retiré.
3. Plusieurs textes et soldes imposaient `white-space:nowrap` dans des cartes à deux colonnes, avec risque de débordement si les montants étaient longs.
4. Des tailles de police des formulaires restaient en dessous de 16 px, rendant la saisie moins confortable et favorisant le zoom automatique dans certains navigateurs.
5. Les onglets de saisie, les formulaires en plusieurs colonnes, le convertisseur et certaines grilles demandaient des ajustements en dessous de 400 px.
6. La barre inférieure et les feuilles modales devaient mieux respecter les zones système (barre de navigation et encoche) et le clavier virtuel.

## Modifications apportées

- Barre principale Android : **Accueil · Opérations · Saisir · Agenda · Menu**. L’action centrale ouvre le formulaire existant (dépense, revenu, transfert et autres types dans les onglets) ; le bouton flottant disparaît uniquement en mobile.
- En-tête compact avec un nom court, l’indicateur de synchronisation, l’aide et l’avatar permettant d’accéder au compte. Les raccourcis de confidentialité et d’alertes sont conservés et déplacés dans le menu mobile.
- Fermeture explicite du menu latéral, grands boutons tactiles et liste des rubriques toujours défilable.
- Mise en page mobile avec cartes pouvant prendre une pleine largeur, montants qui ne débordent pas, liste des opérations plus lisible, filtres souples et formulaires à une colonne.
- Saisie : onglets horizontalement défilables, champs et sélecteurs de 16 px ou plus, barre de validation collante dans la feuille modale, prise en compte de `100dvh` et des `safe-area-inset`.
- Agenda : cases, navigation mensuelle et événements adaptés à la largeur.
- Conversion : paire de devises verticale sur petit écran, inversion toujours accessible, taux manuel utilisable sans Internet.
- Déclaration Next.js `viewportFit:'cover'` pour exploiter les marges de sécurité Android.

## Garde-fous

Aucun changement de `lib/finance.ts`, `lib/storage.ts`, `lib/sync.ts`, `lib/restore.ts`, `State`, `poketra-v1` ou de la base serveur. Les opérations et portefeuilles existants restent les seuls chiffres réels. Aucune réinitialisation, fusion ou migration de comptes n'est effectuée par ce correctif.

## Tests

**Automatisés dans la CI** : `npm test`, `npm run typecheck`, `npm run build`, vérification du rendu des cinq boutons du menu mobile, ouverture/fermeture du menu et du formulaire, conservation des soldes, présence de règles CSS ciblées.

**Contrôles réels encore requis sur Android** : vérifier au minimum en Chrome et en PWA installée à 320–360–390–412 px (ou largeur du téléphone disponible) :
- Accueil : cinq soldes lisibles et masquage volontaire des montants.
- Saisie : choisir dépense, revenu et transfert, activer le clavier numérique, faire défiler et valider sans cacher les boutons, puis annuler une saisie test.
- Menu : faire défiler toutes les rubriques, ouvrir l’aide, le compte et les alertes ; fermer avec le bouton et le retour Android.
- Agenda : changer de mois, sélectionner un jour, vérifier que les paiements prévus ne sont pas encaissés.
- Conversion : taux manuel en mode avion, taux indicatif connecté, pas de modification des soldes.
- Rotation portrait/paysage, texte agrandi, barre système, veille/reprise et mode avion.
- Sauvegarde : vérifier que les données importées sont toujours présentes après mise à jour du service worker. Ne jamais effacer le stockage d’application pour résoudre un affichage.

**Limite** : les tests CI et les règles CSS ne certifient pas la qualité visuelle sur l'appareil de l'utilisateur. Le retour par capture Android permet de corriger les derniers détails spécifiques aux tailles, navigateurs ou polices de son téléphone.
