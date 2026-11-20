export interface DefaultDentalAct {
  name: string;
  price: number;
  description: string;
}

export const DEFAULT_DENTAL_ACTS: DefaultDentalAct[] = [
  { name: 'Consultation & Diagnostic Dentaire', price: 15000, description: 'Examen bucco-dentaire initial et devis' },
  { name: 'Extraction Dentaire Simple', price: 30000, description: 'Extraction sous anesthésie locale' },
  { name: 'Extraction Dent de Sagesse', price: 50000, description: 'Extraction complexe ou dent incluse' },
  { name: 'Détartrage Complet & Polissage', price: 40000, description: 'Nettoyage ultrasonique et polissage des deux arcades' },
  { name: 'Soins de Carie & Obturation Composite', price: 35000, description: 'Restauration esthétique par dent' },
  { name: 'Dévitalisation & Traitement Canalaire', price: 60000, description: 'Traitement endodontique mono ou pluriradiculaire' },
  { name: 'Pansement Dentaire Provisoire', price: 15000, description: 'Soins d’urgence et pansement calmant' },
  { name: 'Radiographie Rétro-Alvéolaire', price: 20000, description: 'Cliché radiologique ciblé' },
];
