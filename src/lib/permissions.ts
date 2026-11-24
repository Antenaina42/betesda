import { RoleType } from '@/types';

/**
 * Matrice des droits d'accès par rôle pour chaque module de l'application
 */
export const MODULE_PERMISSIONS: Record<string, RoleType[]> = {
  // Encaissement Consultation & Ticket 2 volets : Accueil, Administrateurs
  '/consultations/caisse': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'],

  // Module Pharmacie : Bénéfices & Tarification (achat/vente) accessibles à Direction & Comptabilité
  '/pharmacy/financials': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT'],
  '/pharmacy/medicines': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT', 'PHARMACIST'],
  '/pharmacy/consumables': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST', 'ACCOUNTANT'],
  '/pharmacy/inventory': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'],
  '/pharmacy': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST'],

  // Module Consultations : Administrateurs, Médecins, Accueil
  '/consultations': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PHARMACIST'],

  // Module Agenda / Rendez-vous : Accueil, Administrateurs, Médecins
  '/appointments': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'],

  // Module Dossiers Patients : Accueil, Administrateurs, Médecins
  '/patients': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'PHARMACIST', 'DOCTOR', 'NURSE'],

  // Module Ordonnances : Médecins, Accueil et Administrateurs
  '/prescriptions': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PHARMACIST'],

  // Module Médecins : Accueil, Médecins et Administrateurs
  '/doctors': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'],

  // Cabinet Dentiste & Soins des Dents : Administrateurs et Accueil
  '/dentistry': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'RECEPTIONIST'],

  // Module Factures & Caisse : Administrateurs et Comptables
  '/invoices': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT'],
  '/payments': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT'],
  // Module Dépenses, Petite Caisse & Sorties : Administrateurs, Comptables et Accueil (Petite Caisse)
  '/expenses': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'],

  // Module Rapports & Statistiques : Administrateurs et Comptables
  '/reports': ['SUPER_ADMIN', 'CLINIC_ADMIN', 'ACCOUNTANT'],

  // Module Gestion Utilisateurs & Rôles : Super Admin et Admin Clinique
  '/users': ['SUPER_ADMIN', 'CLINIC_ADMIN'],

  // Module Paramètres Clinique : Super Admin et Admin Clinique
  '/settings': ['SUPER_ADMIN', 'CLINIC_ADMIN'],
};

/**
 * Vérifie si un rôle donné a l'autorisation d'accéder à un chemin URL
 */
export function hasModuleAccess(role: RoleType | undefined | null, pathname: string): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;

  // Trouver la règle correspondante la plus spécifique (préfixe le plus long d'abord)
  const matchingKeys = Object.keys(MODULE_PERMISSIONS)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length);

  const matchingKey = matchingKeys[0];

  if (!matchingKey) {
    // Les routes non restreintes explicitement (ex: /dashboard, /profile) sont accessibles à tout utilisateur authentifié
    return true;
  }

  const allowedRoles = MODULE_PERMISSIONS[matchingKey] || [];
  return allowedRoles.includes(role);
}


/**
 * Libellé lisible pour chaque rôle
 */
export function getRoleBadgeLabel(role: RoleType | undefined | null): { label: string; color: string; description: string } {
  switch (role) {
    case 'SUPER_ADMIN':
      return {
        label: 'Super Admin',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Administration globale & configurations système',
      };
    case 'CLINIC_ADMIN':
      return {
        label: 'Admin Clinique',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Gestion globale de l’établissement, finances et utilisateurs',
      };
    case 'DOCTOR':
      return {
        label: 'Médecin Praticien',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Consultations, dossiers médicaux, prescriptions & agenda',
      };
    case 'PHARMACIST':
      return {
        label: 'Pharmacien',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Gestion de la pharmacie, stocks, catalogue & caisse POS',
      };
    case 'RECEPTIONIST':
      return {
        label: 'Accueil & Réception',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Accueil des patients, caisse & admissions',
      };
    case 'NURSE':
      return {
        label: 'Infirmier(ère)',
        color: 'bg-teal-100 text-teal-800 border-teal-200',
        description: 'Prise des constantes, soins & assistance médicale',
      };
    case 'ACCOUNTANT':
      return {
        label: 'Comptable (Grande Caisse)',
        color: 'bg-rose-100 text-rose-800 border-rose-200',
        description: 'Gestion Grande Caisse, Banque, transferts, dépenses, paie & consultations week-end',
      };
    default:
      return {
        label: 'Utilisateur',
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        description: 'Accès standard',
      };
  }
}
