export interface ConsultationAct {
  id: string;
  name: string;
  price: number;
  icon?: string;
  description?: string;
}

export const DEFAULT_CONSULTATION_ACTS: ConsultationAct[] = [
  {
    id: 'act-med-gen',
    name: 'Consultation Médecine Générale',
    price: 15000,
    icon: '🩺',
    description: 'Examen clinique standard, diagnostic et orientation',
  },
  {
    id: 'act-specialiste',
    name: 'Consultation Spécialiste',
    price: 25000,
    icon: '👨‍⚕️',
    description: 'Avis spécialisé (Cardiologie, Pédiatrie, Gynécologie, etc.)',
  },
  {
    id: 'act-urgence',
    name: 'Urgence Médicale',
    price: 20000,
    icon: '🚨',
    description: 'Prise en charge prioritaire pour soins aigus et urgences',
  },
  {
    id: 'act-controle',
    name: 'Contrôle & Suivi Médical',
    price: 10000,
    icon: '🔄',
    description: 'Visite de contrôle sous quinzaine ou suivi de traitement',
  },
  {
    id: 'act-soins-inf',
    name: 'Soins Infirmiers & Pansement',
    price: 8000,
    icon: '🩹',
    description: 'Injections, pansements simples/complexes, perfusions',
  },
];
