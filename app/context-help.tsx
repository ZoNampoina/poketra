'use client';
import {BookOpen,HelpCircle,X} from 'lucide-react';

type Topic={title:string;summary:string;steps:string[]};
export const helpTopics:Record<string,Topic>={
  dashboard:{title:'Vue d’ensemble',summary:'Synthèse de l’argent réellement détenu.',steps:['Le total additionne uniquement les portefeuilles.', 'Le disponible exclut la réserve et les provisions. Ne l’additionne pas au total.', 'Pour une opération, utilise Ajouter une dépense ou Noter une entrée.']},
  wallets:{title:'Portefeuilles',summary:'Où se trouve ton argent ?',steps:['MVola, Orange Money, Airtel Money, Espèces et Banque ont des soldes séparés.','Un transfert entre tes portefeuilles ne constitue pas un revenu.','Vérifier les soldes permet de constater et justifier un écart.']},
  budgets:{title:'Budgets et réserve',summary:'À quoi servira l’argent ?',steps:['Les enveloppes ne se remettent pas à zéro à la fin d’un mois.','Répartir déplace une somme entre affectations sans modifier ton total.','La réserve reste protégée et son utilisation demande une confirmation.']},
  projects:{title:'Projets',summary:'Suivre les prestations et paiements attendus.',steps:['Renseigne le montant convenu et la date de paiement estimée.','Seuls les encaissements réellement enregistrés augmentent les soldes.','Le résultat distingue dépenses, provisions et montant encore attendu.']},
  history:{title:'Transactions',summary:'Journal des opérations.',steps:['Recherche une opération par texte, portefeuille, montant ou date.','Une erreur se corrige par une contre-écriture, sans effacer le journal.','Une transaction peut être associée à un projet ou à un bénéficiaire.']},
  stats:{title:'Statistiques',summary:'Comprendre les dépenses constatées.',steps:['Choisis une période puis une catégorie ou un portefeuille.','Les graphiques n’affectent aucun budget.','Les transferts internes ne sont pas des dépenses, contrairement aux frais.']},
  plannedIncome:{title:'Entrées prévues',summary:'Programmer un encaissement ponctuel ou récurrent.',steps:['Choisis la source, le portefeuille et la première date.','Le montant peut être fixe ou saisi à la réception.','Valide le rappel pour créditer le portefeuille.']},
  obligations:{title:'Échéances',summary:'Préparer un paiement sans le débiter à l’avance.',steps:['Crée une échéance ponctuelle, hebdomadaire ou mensuelle.','Tu peux provisionner l’argent correspondant.','Clique sur Payer seulement après le paiement réel.']},
  agenda:{title:'Agenda financier',summary:'Visualiser les événements du mois.',steps:['Sélectionne un jour ou un filtre pour voir ses événements.','Les paiements de projets prévus ne sont pas des revenus encaissés.','Utilise Voir pour ouvrir la transaction, le prêt, le projet ou l’échéance correspondant.']},
  treasury:{title:'Trésorerie',summary:'Lire les échéances futures et le disponible.',steps:['Choisis un horizon de 30, 90 ou 365 jours.','Les provisions existantes ne sont pas déduites deux fois.','Les entrées encore attendues ne sont pas comptabilisées.']},
  simulator:{title:'Atelier de décisions',summary:'Tester une hypothèse avant une dépense.',steps:['Renseigne un achat et une éventuelle hausse des besoins.','Le résultat est indicatif : engagements et dépenses essentielles peuvent se recouper.','Aucun scénario ne modifie les portefeuilles ni les transactions.']},
  currency:{title:'Conversion de devises',summary:'Estimer la contre-valeur d’une somme.',steps:['Choisis les devises et saisis le montant à convertir.','Charge un taux indicatif en ligne ou saisis un taux manuel hors connexion.','Les frais, spreads et taux réels des opérateurs ne sont pas inclus.']},
  loans:{title:'Prêts et remboursements',summary:'Distinguer créances, dettes et intérêts.',steps:['Le capital prêté n’est pas une dépense de consommation.','Le capital emprunté n’est pas un revenu gagné.','Seuls les fonds effectivement reçus ou payés affectent les portefeuilles.']},
  beneficiaries:{title:'Bénéficiaires',summary:'Retrouver à qui une somme a été destinée.',steps:['Associe des personnes aux opérations.','Des alias évitent de casser l’historique en cas de changement de nom.','Consulte le détail des aides, cadeaux ou remboursements.']},
  reconcile:{title:'Vérifier les soldes',summary:'Comparer solde calculé et solde réel.',steps:['Compare le montant affiché avec le solde réel de chaque portefeuille.','Recherche d’abord une transaction manquante ou un frais mal saisi.','Tout ajustement doit avoir un motif et rester traçable.']},
  fees:{title:'Frais Mobile Money',summary:'Proposer des frais sans inventer de barème.',steps:['Crée tes modèles par opérateur et tranche de montant.','Vérifie toujours les frais appliqués avant validation.','Le montant transféré n’est pas lui-même une dépense.']},
  reports:{title:'Exports',summary:'Produire un rapport ou une sauvegarde.',steps:['CSV, Excel et PDF servent à consulter ou partager des analyses.','Une sauvegarde complète JSON est différente d’un rapport.','Conserve les sauvegardes contenant des montants dans un emplacement privé.']},
  customize:{title:'Personnalisation',summary:'Adapter les vues à ton usage.',steps:['Réorganise ou masque les cartes du tableau de bord.','Configure les catégories sans supprimer leur historique.','La taille de police et le thème sont indépendants des données.']},
  security:{title:'Sécurité et sauvegardes',summary:'Sauvegarder, restaurer et synchroniser.',steps:['Exporte une sauvegarde JSON complète avant tout changement d’appareil ou d’adresse.','Vérifie l’état de la connexion et le compte associé avant une synchronisation.','Une erreur de synchronisation ne signifie pas que tes données locales ont disparu.']},
  settings:{title:'Paramètres',summary:'Configurer les repères financiers.',steps:['Les besoins sur 30 jours servent uniquement au calcul de l’autonomie.','La cible de réserve n’ajoute aucun argent à tes portefeuilles.','La devise comptable reste l’Ariary ; le convertisseur ne la modifie pas.']}
};
export default function ContextHelp({view,onClose}:{view:string;onClose:()=>void}){
  const topic=helpTopics[view]??helpTopics.dashboard;
  return <aside className="pk-context-help" aria-label={'Guide : '+topic.title}>
    <div className="pk-context-head"><span><BookOpen size={19}/> Guide : {topic.title}</span><button type="button" aria-label="Fermer l'aide" onClick={onClose}><X size={19}/></button></div>
    <p className="pk-context-summary">{topic.summary}</p>
    <ul>{topic.steps.map(step=><li key={step}>{step}</li>)}</ul>
    <div className="pk-context-foot"><HelpCircle size={15}/> Cette aide n’effectue aucune opération.</div>
  </aside>;
}
