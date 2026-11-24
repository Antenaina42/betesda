'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  DollarSign,
  ArrowDownRight,
  Plus,
  Search,
  Calendar,
  Printer,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Building,
  Smartphone,
  Banknote,
  Users,
  Pill,
  Stethoscope,
  Briefcase,
  History,
  Layers,
  Trash2,
  Minus,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Paperclip,
  Smile,
  FileCheck,
  Eye,
  Filter,
  RefreshCw,
  Wallet,
  ArrowRightLeft,
  Pencil,
  Landmark,
  Settings,
} from 'lucide-react';
import MedicineSearchSelect from '@/components/pharmacy/MedicineSearchSelect';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { AuthUser } from '@/types';

export interface ExpenseTx {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  category: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  description: string;
  transactionDate: string | Date;
  beneficiary?: string | null;
  performedBy?: { firstName: string; lastName: string } | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  cashRegister?: string | null;
}

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: { id: string; name: string; displayName: string };
  doctorProfile?: { specialtyName?: string | null } | null;
}

export interface EmployeeRecord {
  id: string;
  clinicId?: string;
  lastName: string;
  firstName: string;
  phone?: string | null;
  position: string;
  baseSalary: number;
  isActive?: boolean;
  createdAt?: string | Date;
}

export interface UnifiedEmployee {
  id: string;
  source: 'EMPLOYEE' | 'USER';
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  position: string;
  baseSalary: number;
  email?: string | null;
  createdAt?: string | Date;
  rawEmployee?: EmployeeRecord;
  rawUser?: StaffUser;
}

interface PayrollSlipItem {
  id: string;
  slipNumber: string;
  month: string;
  monthLabel: string;
  baseSalary: number;
  bonusAmount: number;
  deductionAmount: number;
  netSalary: number;
  paymentMethod: string;
  paymentDate: string | Date;
  status: string;
  notes?: string | null;
  userId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeePosition?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    role: { displayName: string; name: string };
  } | null;
  employee?: EmployeeRecord | null;
}

interface ClinicRequisitionItem {
  id: string;
  requisitionNumber: string;
  department: string;
  requestedBy: string;
  reason: string;
  totalCost: number;
  date: string | Date;
  notes?: string | null;
  itemsJson: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface MedicineItem {
  id: string;
  name: string;
  dosage: string;
  form: string;
  currentStock: number;
  purchasePrice: number;
  sellingPrice: number;
}

interface ExpensesClientProps {
  clinic: any;
  currentUser: AuthUser;
  initialExpenses: ExpenseTx[];
  staffUsers: StaffUser[];
  employees?: EmployeeRecord[];
  initialPayrollSlips: PayrollSlipItem[];
  initialClinicRequisitions: ClinicRequisitionItem[];
  medicines: MedicineItem[];
  initialDentalConsultations?: any[];
  initialDentalCashTransactions?: any[];
  staffMedicineSales?: any[];
  doctors?: any[];
  initialWeekendConsultations?: any[];
}

export function parseTransactionActors(exp: ExpenseTx) {
  const desc = exp.description || '';
  let operator = exp.performedBy ? `${exp.performedBy.firstName} ${exp.performedBy.lastName}` : '';

  // 1. Versement & Mouvements Inter-Comptes (Petite Caisse, Grande Caisse, Banque)
  const isTransfer =
    desc.includes('Remettant :') ||
    desc.includes('Récepteur :') ||
    desc.includes('Déposant :') ||
    (exp.category || '').toLowerCase().includes('versement') ||
    (exp.category || '').toLowerCase().includes('dépôt') ||
    (exp.category || '').toLowerCase().includes('retrait') ||
    (exp.category || '').toLowerCase().includes('approvisionnement') ||
    (exp.reference && (exp.reference.startsWith('VERS') || exp.reference.startsWith('DEP-BQ') || exp.reference.startsWith('RET-BQ') || exp.reference.startsWith('BQ-INIT')));

  if (isTransfer) {
    const senderMatch = desc.match(/(?:Remettant|Déposant|Reçu de|Retrait effectué sur le compte bancaire par)\s*:\s*([^➔|–\-]+)/i);
    const receiverMatch = desc.match(/(?:Récepteur|Réceptionné par|Bénéficiaire|Compte)\s*:\s*([^|–\-]+)/i);
    const opMatch = desc.match(/Opérateur(?:\s*système)?\s*:\s*([^|–\-]+)/i) || desc.match(/Saisi par\s*:\s*([^|–\-]+)/i);

    let defaultSender = exp.cashRegister === 'BANQUE' ? 'Banque' : 'Accueil (Caissière)';
    let defaultReceiver = exp.cashRegister === 'BANQUE' ? 'Banque' : 'Direction / Administrateur';

    const sender = senderMatch ? senderMatch[1].trim() : defaultSender;
    const receiver = receiverMatch ? receiverMatch[1].trim() : defaultReceiver;
    if (opMatch && !operator) operator = opMatch[1].trim();

    return {
      operator: operator || 'Direction / Caisse',
      actorsLabel: exp.reference?.startsWith('DEP-BQ')
        ? 'Dépôt Bancaire'
        : exp.reference?.startsWith('RET-BQ')
        ? 'Retrait Bancaire'
        : 'Transfert Inter-Caisses',
      primaryActor: `Émetteur : ${sender}`,
      secondaryActor: `Récepteur : ${receiver}`,
      isTransfer: true,
    };
  }

  // 2. Bénéficiaire / Patient / Salarié
  let counterparty = '';
  let counterpartyLabel = '';

  if (desc.includes('Bénéficiaire :')) {
    const benMatch = desc.match(/Bénéficiaire\s*:\s*([^|–\-]+)/i);
    counterparty = benMatch ? benMatch[1].trim() : '';
    counterpartyLabel = 'Bénéficiaire';
  } else if (exp.category === 'Salaires & Paie') {
    counterpartyLabel = 'Salarié payé';
    const staffMatch = desc.match(/Paie\s+[^\-]+-\s*([^|–\-\(]+)/i);
    counterparty = staffMatch ? staffMatch[1].trim() : (exp.beneficiary || 'Personnel');
  } else if (exp.category === 'Consultation' || exp.category === 'Infirmerie') {
    counterpartyLabel = 'Patient';
    const patMatch = desc.match(/-\s*([^(|]+)\s*\(/);
    counterparty = patMatch ? patMatch[1].trim() : 'Patient';
  } else if (exp.category === 'Pharmacie') {
    counterpartyLabel = 'Client';
    const clientMatch = desc.match(/Client\s*:\s*([^|–\-]+)/i);
    counterparty = clientMatch ? clientMatch[1].trim() : 'Client de passage';
  } else if (exp.beneficiary) {
    counterpartyLabel = 'Bénéficiaire';
    counterparty = exp.beneficiary;
  }

  const opMatch = desc.match(/Saisi par\s*:\s*([^|–\-]+)/i) || desc.match(/Enregistré par\s*:\s*([^|–\-]+)/i) || desc.match(/Décaissé par(?:\s*l'Administrateur)?\s*:\s*([^|–\-]+)/i);
  if (opMatch && !operator) operator = opMatch[1].trim();

  return {
    operator: operator || 'Caisse',
    actorsLabel: counterpartyLabel || 'Tiers',
    primaryActor: counterparty ? `${counterpartyLabel} : ${counterparty}` : '',
    secondaryActor: '',
    isTransfer: false,
  };
}

export default function ExpensesClient({
  clinic,
  currentUser,
  initialExpenses,
  staffUsers,
  employees = [],
  initialPayrollSlips,
  initialClinicRequisitions,
  medicines: initialMedicines,
  initialDentalConsultations,
  initialDentalCashTransactions,
  staffMedicineSales = [],
  doctors = [],
  initialWeekendConsultations = [],
}: ExpensesClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab');

  type ExpensesTab =
    | 'expenses'
    | 'transfers'
    | 'bank'
    | 'weekend-consultations'
    | 'payroll'
    | 'clinic-medicines'
    | 'dentistry';

  const resolveTabFromParam = (param: string | null | undefined, isRec: boolean): ExpensesTab => {
    if (param === 'transfers') return 'transfers';
    if (param === 'clinic-medicines') return 'clinic-medicines';
    if (!isRec) {
      if (param === 'bank') return 'bank';
      if (param === 'weekend-consultations' || param === 'weekend') return 'weekend-consultations';
      if (param === 'payroll') return 'payroll';
      if (param === 'dentistry' || param === 'dentist') return 'dentistry';
    }
    return 'expenses';
  };

  const [activeTab, setActiveTab] = useState<ExpensesTab>(
    resolveTabFromParam(tabParam, currentUser.role === 'RECEPTIONIST')
  );
  const [expenses, setExpenses] = useState<ExpenseTx[]>(initialExpenses);
  const [payrollSlips, setPayrollSlips] = useState<PayrollSlipItem[]>(initialPayrollSlips);
  const [clinicRequisitions, setClinicRequisitions] = useState<ClinicRequisitionItem[]>(initialClinicRequisitions);
  const [medicines, setMedicines] = useState<MedicineItem[]>(initialMedicines);

  // Données Dentisterie
  const [dentalConsultations, setDentalConsultations] = useState<any[]>(
    initialDentalConsultations && initialDentalConsultations.length > 0
      ? initialDentalConsultations
      : [
          {
            id: 'dent-consult-1',
            createdAt: new Date().toISOString(),
            reason: 'Soins de Carie & Obturation Composite Dentaire',
            patient: { firstName: 'Miora', lastName: 'ANDRIANINA', patientNumber: 'P-2026-0042' },
            doctor: { user: { firstName: 'Haja', lastName: 'RAVELO' }, specialty: { name: 'Odonto-Stomatologie' } },
            invoice: { invoiceNumber: 'FAC-DENT-001', totalAmount: 45000, payments: [{ paymentMethod: 'CASH' }] },
          },
          {
            id: 'dent-consult-2',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            reason: 'Détartrage Complet & Soins Gencives',
            patient: { firstName: 'Rado', lastName: 'RAZAFINDRABE', patientNumber: 'P-2026-0038' },
            doctor: { user: { firstName: 'Haja', lastName: 'RAVELO' }, specialty: { name: 'Odonto-Stomatologie' } },
            invoice: { invoiceNumber: 'FAC-DENT-002', totalAmount: 35000, payments: [{ paymentMethod: 'MOBILE_MONEY' }] },
          },
        ]
  );
  const [dentalCashTransactions, setDentalCashTransactions] = useState<any[]>(
    initialDentalCashTransactions || []
  );

  // Filtres avancés
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [amountFilter, setAmountFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');

  // Helper impression A4 / Téléchargement PDF avec nom de document propre
  const handlePrintCleanA4 = (docTitle?: string | React.MouseEvent) => {
    const originalTitle = document.title;
    const title = typeof docTitle === 'string' ? docTitle : 'CLINIQUE_BETESDA_DOCUMENT_A4';
    document.title = title;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  // Feedback notifications
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtre Caisse : Toutes, Petite Caisse, Grande Caisse, Banque
  const isReceptionist = currentUser.role === 'RECEPTIONIST';
  const isAccountant = currentUser.role === 'ACCOUNTANT';
  const isAdminOrAccountant =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'CLINIC_ADMIN' ||
    currentUser.role === 'ACCOUNTANT';
  const registerParam = searchParams?.get('register');
  const [registerFilter, setRegisterFilter] = useState<'ALL' | 'PETITE_CAISSE' | 'GRANDE_CAISSE' | 'BANQUE'>(
    isReceptionist || registerParam === 'PETITE_CAISSE'
      ? 'PETITE_CAISSE'
      : registerParam === 'GRANDE_CAISSE'
      ? 'GRANDE_CAISSE'
      : registerParam === 'BANQUE'
      ? 'BANQUE'
      : 'ALL'
  );

  // Synchronisation automatique lorsque l'utilisateur clique sur un lien du menu latéral (?tab=...&register=...)
  useEffect(() => {
    setActiveTab(resolveTabFromParam(tabParam, isReceptionist));
    if (isReceptionist || registerParam === 'PETITE_CAISSE') {
      setRegisterFilter('PETITE_CAISSE');
    } else if (registerParam === 'GRANDE_CAISSE') {
      setRegisterFilter('GRANDE_CAISSE');
    } else if (registerParam === 'BANQUE') {
      setRegisterFilter('BANQUE');
    } else if (tabParam === 'bank') {
      setRegisterFilter('BANQUE');
    } else {
      setRegisterFilter('ALL');
    }
  }, [tabParam, registerParam, isReceptionist]);

  // Sous-filtre dans l'onglet Dépenses : Dépenses seules vs Toutes opérations
  const [expenseTypeView, setExpenseTypeView] = useState<'EXPENSE_ONLY' | 'ALL_OPS'>('EXPENSE_ONLY');

  // =========================================================================
  // 1. MODAL SORTIE DE CAISSE STANDARD (DÉCAISSEMENT)
  // =========================================================================
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Charges & Fonctionnement',
    customCategory: '',
    amount: '',
    beneficiary: '',
    paymentMethod: 'CASH',
    reference: '',
    description: '',
    transactionDate: new Date().toISOString().split('T')[0],
    attachmentUrl: '',
    attachmentName: '',
    cashRegister: isReceptionist ? 'PETITE_CAISSE' : 'GRANDE_CAISSE',
  });
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadAttachmentError, setUploadAttachmentError] = useState('');

  // =========================================================================
  // 1e. MODALS CONSULTATIONS WEEK-END (ENTRÉE & PAIEMENT HONORAIRES MÉDECINS)
  // =========================================================================
  const [showWeekendIncomeModal, setShowWeekendIncomeModal] = useState(false);
  const [weekendIncomeForm, setWeekendIncomeForm] = useState({
    amount: '',
    patientName: '',
    doctorName: '',
    actName: 'Consultation Week-end',
    paymentMethod: 'CASH',
    transactionDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [showWeekendDoctorPayModal, setShowWeekendDoctorPayModal] = useState(false);
  const [weekendDoctorPayForm, setWeekendDoctorPayForm] = useState({
    selectedDoctorOption: '',
    customDoctorName: '',
    amount: '',
    paymentMethod: 'CASH',
    transactionDate: new Date().toISOString().split('T')[0],
    weekendPeriod: `Week-end du ${new Date().toLocaleDateString('fr-FR')}`,
    notes: '',
  });
  const [weekendMonthFilter, setWeekendMonthFilter] = useState('ALL');
  const [weekendDoctorFilter, setWeekendDoctorFilter] = useState('ALL');
  const [printedWeekendPayment, setPrintedWeekendPayment] = useState<ExpenseTx | null>(null);

  // =========================================================================
  // 1b. MODAL TRANSFERTS INTER-COMPTES (PETITE CAISSE, GRANDE CAISSE, BANQUE)
  // =========================================================================
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<
    'PETITE_CAISSE_TO_GRANDE_CAISSE' | 'GRANDE_CAISSE_TO_BANQUE' | 'BANQUE_TO_GRANDE_CAISSE'
  >('PETITE_CAISSE_TO_GRANDE_CAISSE');
  const [transferForm, setTransferForm] = useState({
    amount: '',
    senderName: isReceptionist
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Accueil & Caisse'
      : 'Accueil & Caisse (Caissière)',
    receiverName: currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'CLINIC_ADMIN'
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Direction Clinique / Administrateur'
      : 'Direction Clinique / Administrateur',
    notes: 'Versement journalier des recettes de la Petite Caisse vers la Grande Caisse',
    transferDate: new Date().toISOString().split('T')[0],
    attachmentUrl: '',
    attachmentName: '',
  });
  const [uploadingTransferAttachment, setUploadingTransferAttachment] = useState(false);
  const [uploadTransferError, setUploadTransferError] = useState('');
  const [printedTransfer, setPrintedTransfer] = useState<{
    ref: string;
    amount: number;
    senderName: string;
    receiverName: string;
    date: string | Date;
    notes?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    title?: string;
    sourceLabel?: string;
    destLabel?: string;
  } | null>(null);

  // =========================================================================
  // 1c. MODAL DE MODIFICATION / SUPPRESSION D'UNE TRANSACTION PAR L'ADMIN
  // =========================================================================
  const [editingTx, setEditingTx] = useState<ExpenseTx | null>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    category: '',
    amount: '',
    paymentMethod: 'CASH',
    reference: '',
    description: '',
    transactionDate: '',
    cashRegister: 'PETITE_CAISSE',
    attachmentUrl: '',
    attachmentName: '',
  });

  // =========================================================================
  // 1d. MODAL DE CONFIGURATION DU COMPTE BANCAIRE (NOM, RIB, SOLDE INITIAL)
  // =========================================================================
  const initialBankName = clinic?.settings?.find((s: any) => s.key === 'bank_name')?.value || 'Banque';
  const initialBankRib = clinic?.settings?.find((s: any) => s.key === 'bank_rib')?.value || '';
  const initialBankHolder = clinic?.settings?.find((s: any) => s.key === 'bank_holder')?.value || (clinic?.name || 'Clinique Betesda');
  const initialBankTx = initialExpenses.find((e) => e.reference === 'BQ-INIT-001');
  const initialBankAmount = initialBankTx ? String(initialBankTx.amount) : '20000000';

  const [showBankSettingsModal, setShowBankSettingsModal] = useState(false);
  const [bankSettings, setBankSettings] = useState({
    bankName: initialBankName,
    bankRib: initialBankRib,
    bankHolder: initialBankHolder,
    initialAmount: initialBankAmount,
  });

  // =========================================================================
  // 2. MODAL FICHE DE PAIE & DÉCAISSEMENT SALAIRE
  // =========================================================================
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UnifiedEmployee | null>(null);
  const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState<UnifiedEmployee | null>(null);
  const [payrollPeriodFilter, setPayrollPeriodFilter] = useState<'ALL' | 'THIS_MONTH' | 'PREVIOUS_MONTH' | 'LAST_3_MONTHS'>('ALL');
  const [payrollForm, setPayrollForm] = useState({
    month: '2026-10',
    monthLabel: 'Octobre 2026',
    baseSalary: '1200000',
    bonusAmount: '0',
    deductionAmount: '0',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Virement bancaire de fin de mois conforme au contrat.',
  });

  // =========================================================================
  // 3. MODAL DÉPENSE CLINIQUE : PRÉLÈVEMENT MÉDICAMENTS PHARMACIE
  // =========================================================================
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [requisitionDept, setRequisitionDept] = useState('Dentisterie');
  const [requisitionRequester, setRequisitionRequester] = useState(
    `${currentUser.firstName} ${currentUser.lastName}`
  );
  const [requisitionReason, setRequisitionReason] = useState('Matériel et soins bucco-dentaires');
  const [requisitionCart, setRequisitionCart] = useState<
    Array<{
      medicineId: string;
      medicineName: string;
      dosage: string;
      form: string;
      quantity: number;
      unitCost: number;
      availableStock: number;
    }>
  >([]);
  const [medSearchInput, setMedSearchInput] = useState('');

  // =========================================================================
  // 4. MODALS DE VISUALISATION / IMPRESSION
  // =========================================================================
  const [printedSlip, setPrintedSlip] = useState<PayrollSlipItem | null>(null);
  const [printedRequisition, setPrintedRequisition] = useState<{
    req: ClinicRequisitionItem;
    items: any[];
  } | null>(null);
  const [printedExpense, setPrintedExpense] = useState<ExpenseTx | null>(null);

  // Totaux calculés
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalPayroll = useMemo(() => payrollSlips.reduce((sum, p) => sum + p.netSalary, 0), [payrollSlips]);
  const totalClinicRequisitions = useMemo(() => clinicRequisitions.reduce((sum, r) => sum + r.totalCost, 0), [clinicRequisitions]);
  const totalGeneralExpenses = useMemo(
    () => expenses.filter((e) => e.category !== 'Salaires & Paie' && e.category !== 'Dépense Clinique (Pharmacie)').reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  // =========================================================================
  // CALCULS COMPLETS DES SOLDES PETITE CAISSE (ACCUEIL) & GRANDE CAISSE (ADMIN)
  // =========================================================================

  // 1. PETITE CAISSE (COMPTE ACCUEIL)
  const petiteCaisseList = useMemo(() => {
    return expenses.filter((e) => (e.cashRegister || 'PETITE_CAISSE') === 'PETITE_CAISSE');
  }, [expenses]);

  // Recettes totales encaissées par l'Accueil (Consultations, Pharmacie comptoir, Actes & soins)
  const recettesPetiteCaisse = useMemo(() => {
    return petiteCaisseList
      .filter((e) => e.type === 'INCOME')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [petiteCaisseList]);

  // Versements sortants de la Petite Caisse vers la Grande Caisse
  const cashTransfersOut = useMemo(() => {
    return petiteCaisseList.filter(
      (e) => e.type === 'EXPENSE' && ((e.category || '').toLowerCase().includes('versement') || (e.reference && e.reference.startsWith('VERS')))
    );
  }, [petiteCaisseList]);

  const totalTransfersAmount = useMemo(() => {
    return cashTransfersOut.reduce((sum, e) => sum + e.amount, 0);
  }, [cashTransfersOut]);

  // Menues dépenses de fonctionnement de l'Accueil (hors versements et hors salaires qui incombent à la Direction)
  const depensesPetiteCaisseHorsTransfert = useMemo(() => {
    return petiteCaisseList
      .filter((e) =>
        e.type === 'EXPENSE' &&
        e.category !== 'Salaires & Paie' &&
        !((e.category || '').toLowerCase().includes('versement') || (e.reference && e.reference.startsWith('VERS')))
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }, [petiteCaisseList]);

  // Total des sorties de Petite Caisse (Menues dépenses + Versements remis à l'Administrateur)
  const totalPetiteCaisseExpenses = useMemo(() => {
    return depensesPetiteCaisseHorsTransfert + totalTransfersAmount;
  }, [depensesPetiteCaisseHorsTransfert, totalTransfersAmount]);

  // ★ SOLDE DISPONIBLE EN PETITE CAISSE (Ne peut JAMAIS être négatif)
  const soldeDisponiblePetiteCaisse = useMemo(() => {
    const net = recettesPetiteCaisse - totalPetiteCaisseExpenses;
    return Math.max(0, net);
  }, [recettesPetiteCaisse, totalPetiteCaisseExpenses]);


  // 2. GRANDE CAISSE (COMPTE ADMINISTRATEUR)
  const grandeCaisseList = useMemo(() => {
    return expenses.filter((e) => e.cashRegister === 'GRANDE_CAISSE');
  }, [expenses]);

  // Versements reçus de l'Accueil dans la Grande Caisse
  const totalGrandeCaisseReceived = useMemo(() => {
    return grandeCaisseList
      .filter((e) => e.type === 'INCOME' || (e.category || '').toLowerCase().includes('reçu'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [grandeCaisseList]);

  // Décaissements et Salaires payés par la Grande Caisse
  const totalGrandeCaisseExpenses = useMemo(() => {
    return expenses
      .filter((e) =>
        (e.cashRegister === 'GRANDE_CAISSE' || e.category === 'Salaires & Paie') &&
        e.type === 'EXPENSE' &&
        !(e.category || '').toLowerCase().includes('reçu')
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // ★ SOLDE DISPONIBLE EN GRANDE CAISSE (AUGMENTE quand un versement est reçu de l'Accueil ou de la Banque)
  const soldeDisponibleGrandeCaisse = useMemo(() => {
    return totalGrandeCaisseReceived - totalGrandeCaisseExpenses;
  }, [totalGrandeCaisseReceived, totalGrandeCaisseExpenses]);

  // 3. COMPTE BANCAIRE DE LA CLINIQUE (BANQUE)
  const banqueList = useMemo(() => {
    return expenses.filter((e) => e.cashRegister === 'BANQUE');
  }, [expenses]);

  const recettesBanque = useMemo(() => {
    return banqueList
      .filter((e) => e.type === 'INCOME')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [banqueList]);

  const sortiesBanque = useMemo(() => {
    return banqueList
      .filter((e) => e.type === 'EXPENSE')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [banqueList]);

  // ★ SOLDE DISPONIBLE EN BANQUE
  const soldeDisponibleBanque = useMemo(() => {
    return recettesBanque - sortiesBanque;
  }, [recettesBanque, sortiesBanque]);

  // 4. TRÉSORERIE TOTALE GLOBALE DE LA CLINIQUE (Petite Caisse + Grande Caisse + Banque)
  const soldeTresorerieTotale = useMemo(() => {
    return soldeDisponiblePetiteCaisse + soldeDisponibleGrandeCaisse + soldeDisponibleBanque;
  }, [soldeDisponiblePetiteCaisse, soldeDisponibleGrandeCaisse, soldeDisponibleBanque]);

  // Totaux & Filtres Cabinet Dentiste
  const dentalRequisitions = useMemo(() => {
    return clinicRequisitions.filter(
      (r) =>
        r.department?.toLowerCase().includes('dentist') ||
        r.reason?.toLowerCase().includes('dent')
    );
  }, [clinicRequisitions]);

  const totalDentalPharmacyExpense = useMemo(() => {
    return dentalRequisitions.reduce((sum, r) => sum + r.totalCost, 0);
  }, [dentalRequisitions]);

  const totalDentalIncome = useMemo(() => {
    return dentalConsultations.reduce((sum, c) => {
      const invAmount = c.invoice?.totalAmount ? Number(c.invoice.totalAmount) : 0;
      return sum + invAmount;
    }, 0);
  }, [dentalConsultations]);

  const totalDentalDirectExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.category === 'Dépense Dentisterie' || (e.reference && e.reference.startsWith('DEP-DENT')))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const netDentalBalance = useMemo(() => {
    return totalDentalIncome - (totalDentalPharmacyExpense + totalDentalDirectExpenses);
  }, [totalDentalIncome, totalDentalPharmacyExpense, totalDentalDirectExpenses]);

  const totalDentalMedUnits = useMemo(() => {
    return dentalRequisitions.reduce((sum, req) => {
      try {
        const items = JSON.parse(req.itemsJson);
        return sum + items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
      } catch {
        return sum;
      }
    }, 0);
  }, [dentalRequisitions]);

  // Helper : déterminer si une transaction est un transfert inter-comptes
  const isTransferTx = (e: ExpenseTx) => {
    const cat = (e.category || '').toLowerCase();
    const ref = e.reference || '';
    return (
      ref.startsWith('VERS-') ||
      ref.startsWith('DEP-BQ-') ||
      ref.startsWith('RET-BQ-') ||
      cat.includes('versement') ||
      cat.includes('dépôt bancaire') ||
      cat.includes('retrait bancaire') ||
      cat.includes('approvisionnement depuis banque')
    );
  };

  // Liste dédiée des transferts (Onglet Transferts / Versements)
  const transferTransactionsList = useMemo(() => {
    if (isReceptionist) {
      return cashTransfersOut;
    }
    // Pour Comptable/Admin : 1 ligne claire par référence de transfert (on privilégie la ligne sortante EXPENSE)
    const allTransfers = expenses.filter((e) => isTransferTx(e));
    const seenRefs = new Set<string>();
    const unique: ExpenseTx[] = [];
    // Préférer EXPENSE pour chaque référence jumelée
    const sorted = [...allTransfers].sort((a, b) => {
      const timeDiff = new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.type === 'EXPENSE' ? -1 : 1;
    });
    for (const tx of sorted) {
      if (tx.reference && (tx.reference.startsWith('VERS-') || tx.reference.startsWith('DEP-BQ-') || tx.reference.startsWith('RET-BQ-'))) {
        if (seenRefs.has(tx.reference)) continue;
        seenRefs.add(tx.reference);
      }
      unique.push(tx);
    }
    return unique;
  }, [expenses, cashTransfersOut, isReceptionist]);

  // Liste dédiée des mouvements bancaires (Onglet Mouvements Banque)
  const bankTransactionsList = useMemo(() => {
    return expenses
      .filter((e) => e.cashRegister === 'BANQUE')
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [expenses]);

  // Liste formatée des médecins disponibles pour les paiements Consultations Week-end
  const doctorOptions = useMemo(() => {
    return (doctors || []).map((d: any) => {
      const fullName =
        d.firstName || d.lastName
          ? `${d.title || 'Dr.'} ${d.firstName || ''} ${d.lastName || ''}`.trim()
          : d.user
          ? `Dr. ${d.user.firstName} ${d.user.lastName}`.trim()
          : 'Médecin consultant';
      const spec = d.specialty?.name || d.specialtyName || 'Médecine Générale';
      return {
        id: d.id,
        name: fullName,
        specialty: spec,
        label: `${fullName} (${spec})`,
      };
    });
  }, [doctors]);

  // =========================================================================
  // GESTION À PART : BUDGET CONSULTATIONS WEEK-END & PAIEMENTS MÉDECINS
  // =========================================================================
  const weekendDirectIncomes = useMemo(() => {
    return expenses.filter(
      (e) => e.cashRegister === 'CONSULTATION_WEEKEND' && e.type === 'INCOME'
    );
  }, [expenses]);

  const weekendDoctorPayments = useMemo(() => {
    return expenses
      .filter((e) => e.cashRegister === 'CONSULTATION_WEEKEND' && e.type === 'EXPENSE')
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [expenses]);

  const allWeekendEntries = useMemo(() => {
    type WeekendEntry = {
      id: string;
      date: string;
      dayLabel: string;
      monthKey: string;
      ref: string;
      patientName: string;
      doctorName: string;
      actName: string;
      amount: number;
      paymentMethod: string;
      operatorName: string;
      source: 'TX' | 'CONSULTATION';
      rawTx?: ExpenseTx;
    };

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const txRefs = new Set(weekendDirectIncomes.map((t) => t.reference).filter(Boolean));
    const list: WeekendEntry[] = [];

    weekendDirectIncomes.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const desc = tx.description || '';
      const docMatch = desc.match(/Médecin\s*:\s*([^|]+)/i);
      const patMatch = desc.match(/Patient\s*:\s*([^|]+)/i) || desc.match(/-\s*([^(|]+)\s*\(/);
      const actMatch = desc.match(/Acte\s*:\s*([^|]+)/i) || desc.match(/\(([^)]+)\)/);
      list.push({
        id: `tx-${tx.id}`,
        date: String(tx.transactionDate),
        dayLabel: dayNames[d.getDay()] || 'Week-end',
        monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        ref: tx.reference || 'CONS-WE',
        patientName: patMatch ? patMatch[1].trim() : 'Néant',
        doctorName: docMatch ? docMatch[1].trim() : 'Médecin de garde',
        actName: actMatch ? actMatch[1].trim() : tx.category || 'Consultation Week-end',
        amount: tx.amount,
        paymentMethod: tx.paymentMethod || 'CASH',
        operatorName: tx.performedBy ? `${tx.performedBy.firstName} ${tx.performedBy.lastName}` : 'Caisse',
        source: 'TX',
        rawTx: tx,
      });
    });

    (initialWeekendConsultations || []).forEach((c: any) => {
      const invRef = c.invoice?.invoiceNumber;
      if (invRef && txRefs.has(invRef)) return;
      const amt = Number(c.invoice?.paidAmount ?? c.invoice?.totalAmount ?? 0);
      if (amt <= 0) return;
      const d = new Date(c.consultationDate);
      const docName = c.doctor
        ? c.doctor.firstName || c.doctor.lastName
          ? `${c.doctor.title || 'Dr.'} ${c.doctor.firstName || ''} ${c.doctor.lastName || ''}`.trim()
          : c.doctor.user
          ? `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}`.trim()
          : 'Médecin consultant'
        : 'Médecin consultant';
      list.push({
        id: `cons-${c.id}`,
        date: String(c.consultationDate),
        dayLabel: dayNames[d.getDay()] || 'Week-end',
        monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        ref: invRef || 'FAC-CONS',
        patientName: c.patient ? `${c.patient.lastName} ${c.patient.firstName}`.trim() : 'Néant',
        doctorName: docName,
        actName: c.reason || 'Consultation Week-end',
        amount: amt,
        paymentMethod: c.invoice?.payments?.[0]?.paymentMethod || 'CASH',
        operatorName: 'Caisse Consultation',
        source: 'CONSULTATION',
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [weekendDirectIncomes, initialWeekendConsultations]);

  const totalWeekendIncome = useMemo(() => {
    return allWeekendEntries.reduce((sum, e) => sum + e.amount, 0);
  }, [allWeekendEntries]);

  const totalWeekendPaidDoctors = useMemo(() => {
    return weekendDoctorPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [weekendDoctorPayments]);

  const soldeDisponibleWeekend = useMemo(() => {
    return Math.max(0, totalWeekendIncome - totalWeekendPaidDoctors);
  }, [totalWeekendIncome, totalWeekendPaidDoctors]);

  const filteredWeekendEntries = useMemo(() => {
    return allWeekendEntries.filter((e) => {
      if (weekendMonthFilter !== 'ALL' && e.monthKey !== weekendMonthFilter) return false;
      if (weekendDoctorFilter !== 'ALL' && !e.doctorName.toLowerCase().includes(weekendDoctorFilter.toLowerCase())) return false;
      return true;
    });
  }, [allWeekendEntries, weekendMonthFilter, weekendDoctorFilter]);

  const filteredWeekendDoctorPayments = useMemo(() => {
    return weekendDoctorPayments.filter((p) => {
      const d = new Date(p.transactionDate);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (weekendMonthFilter !== 'ALL' && mKey !== weekendMonthFilter) return false;
      if (weekendDoctorFilter !== 'ALL' && !(p.description || '').toLowerCase().includes(weekendDoctorFilter.toLowerCase())) return false;
      return true;
    });
  }, [weekendDoctorPayments, weekendMonthFilter, weekendDoctorFilter]);

  const weekendAvailableMonths = useMemo(() => {
    const set = new Set<string>();
    allWeekendEntries.forEach((e) => set.add(e.monthKey));
    weekendDoctorPayments.forEach((p) => {
      const d = new Date(p.transactionDate);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort().reverse();
  }, [allWeekendEntries, weekendDoctorPayments]);

  // Catégories disponibles dynamiquement (inclut les catégories personnalisées "Autre")
  const availableExpenseCategories = useMemo(() => {
    const defaults = [
      'Salaires & Paie',
      'Dépense Clinique (Pharmacie)',
      'Charges & Fonctionnement',
      'Achats & Fournitures',
      'Maintenance & Équipements',
      'Transport & Déplacements',
      'Primes & Avances Personnel',
      'Divers & Urgences',
    ];
    const set = new Set<string>(defaults);
    expenses.forEach((e) => {
      if (e.category && !isTransferTx(e) && e.cashRegister !== 'CONSULTATION_WEEKEND') {
        set.add(e.category);
      }
    });
    return Array.from(set);
  }, [expenses]);

  // Filtrage avancé et dynamique des dépenses (Onglet 1 : Dépenses, séparé des Transferts et du Budget Week-end)
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return expenses
      .filter((e) => {
        // Exclure le budget Consultations Week-end (onglet dédié)
        if (e.cashRegister === 'CONSULTATION_WEEKEND') return false;

        // Exclure les transferts inter-caisses de l'onglet Dépenses (ils ont leur onglet dédié Transferts / Versements)
        if (isTransferTx(e)) return false;

        // Pour l'onglet Dépenses : filtrer par Dépenses seules ou Toutes opérations selon le choix
        if (expenseTypeView === 'EXPENSE_ONLY' && e.type !== 'EXPENSE') return false;

        // 0. Caisse (Cloisonnement strict : l'Accueil ne voit QUE la Petite Caisse)
        if (isReceptionist) {
          const reg = e.cashRegister || 'PETITE_CAISSE';
          if (reg !== 'PETITE_CAISSE') return false;
        } else if (registerFilter !== 'ALL') {
          const reg = e.cashRegister || 'PETITE_CAISSE';
          if (reg !== registerFilter) return false;
        }

        // 1. Catégorie
        if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;

        // 2. Mode de paiement
        if (paymentMethodFilter !== 'ALL' && e.paymentMethod !== paymentMethodFilter) return false;

        // 3. Période / Date
        const txDate = new Date(e.transactionDate);
        if (datePreset === 'TODAY') {
          if (txDate.toDateString() !== now.toDateString()) return false;
        } else if (datePreset === 'YESTERDAY') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          if (txDate.toDateString() !== yesterday.toDateString()) return false;
        } else if (datePreset === '7DAYS') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
          if (txDate < sevenDaysAgo) return false;
        } else if (datePreset === 'THIS_MONTH') {
          if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) return false;
        } else if (datePreset === 'LAST_MONTH') {
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          if (txDate.getMonth() !== lastMonth || txDate.getFullYear() !== lastMonthYear) return false;
        } else if (datePreset === 'CUSTOM') {
          if (startDate) {
            const s = new Date(startDate);
            s.setHours(0, 0, 0, 0);
            if (txDate < s) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
          }
        }

        // 4. Montant
        if (amountFilter === '<50k' && e.amount >= 50000) return false;
        if (amountFilter === '50k-200k' && (e.amount < 50000 || e.amount > 200000)) return false;
        if (amountFilter === '200k-500k' && (e.amount < 200000 || e.amount > 500000)) return false;
        if (amountFilter === '>500k' && e.amount <= 500000) return false;

        // 5. Recherche texte
        if (q) {
          const matchQuery =
            e.description.toLowerCase().includes(q) ||
            (e.reference && e.reference.toLowerCase().includes(q)) ||
            e.category.toLowerCase().includes(q) ||
            (e.performedBy && `${e.performedBy.firstName} ${e.performedBy.lastName}`.toLowerCase().includes(q));
          if (!matchQuery) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_ASC') {
          return new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
        }
        if (sortBy === 'AMOUNT_DESC') {
          return b.amount - a.amount;
        }
        if (sortBy === 'AMOUNT_ASC') {
          return a.amount - b.amount;
        }
        // Par défaut DATE_DESC
        return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      });
  }, [
    expenses,
    expenseTypeView,
    isReceptionist,
    registerFilter,
    categoryFilter,
    paymentMethodFilter,
    datePreset,
    startDate,
    endDate,
    amountFilter,
    searchQuery,
    sortBy,
  ]);

  const filteredIncomeTotal = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.type === 'INCOME' || (e.category || '').toLowerCase().includes('reçu'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const filteredExpenseTotal = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.type === 'EXPENSE' && !(e.category || '').toLowerCase().includes('reçu'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const filteredNetBalance = useMemo(() => {
    return filteredIncomeTotal - filteredExpenseTotal;
  }, [filteredIncomeTotal, filteredExpenseTotal]);

  const filteredTotalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const hasActiveFilters =
    categoryFilter !== 'ALL' ||
    paymentMethodFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    amountFilter !== 'ALL' ||
    Boolean(searchQuery.trim()) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    sortBy !== 'DATE_DESC';

  const handleResetFilters = () => {
    setCategoryFilter('ALL');
    setPaymentMethodFilter('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setAmountFilter('ALL');
    setSearchQuery('');
    setSortBy('DATE_DESC');
  };

  // Salaires par défaut selon la fonction de l'employé
  const getDefaultSalaryByRole = (roleName: string) => {
    switch (roleName) {
      case 'DOCTOR':
        return '1800000';
      case 'PHARMACIST':
        return '900000';
      case 'NURSE':
        return '700000';
      case 'RECEPTIONIST':
        return '550000';
      case 'ACCOUNTANT':
        return '950000';
      case 'CLINIC_ADMIN':
      case 'SUPER_ADMIN':
        return '1500000';
      default:
        return '600000';
    }
  };

  // Répertoire unifié de TOUS les employés (Table Employee + Comptes Staff)
  const allEmployees: UnifiedEmployee[] = useMemo(() => {
    const list: UnifiedEmployee[] = (employees || []).map((emp) => ({
      id: emp.id,
      source: 'EMPLOYEE' as const,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.lastName.toUpperCase()} ${emp.firstName}`,
      phone: emp.phone || 'Néant',
      position: emp.position || 'Salarié',
      baseSalary: emp.baseSalary || 0,
      email: null,
      createdAt: emp.createdAt,
      rawEmployee: emp,
    }));

    (staffUsers || [])
      .filter((usr) => usr.role?.name !== 'SUPER_ADMIN')
      .forEach((usr) => {
      const already = list.some(
        (e) =>
          e.lastName.trim().toLowerCase() === usr.lastName.trim().toLowerCase() &&
          e.firstName.trim().toLowerCase() === usr.firstName.trim().toLowerCase()
      );
      if (!already) {
        const defSal = parseFloat(getDefaultSalaryByRole(usr.role.name)) || 0;
        list.push({
          id: usr.id,
          source: 'USER' as const,
          firstName: usr.firstName,
          lastName: usr.lastName,
          fullName: `${usr.lastName.toUpperCase()} ${usr.firstName}`,
          phone: usr.phone || 'Néant',
          position: usr.doctorProfile?.specialtyName || usr.role.displayName,
          baseSalary: defSal,
          email: usr.email,
          rawUser: usr,
        });
      }
    });

    return list;
  }, [employees, staffUsers]);

  // Ouverture du modal de paie pré-rempli pour un employé
  const handleOpenPayrollForEmployee = (emp: UnifiedEmployee) => {
    setError('');
    setSelectedStaff(emp);
    const currentDate = new Date();
    const curYear = currentDate.getFullYear();
    const curMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthLabel = `${monthNames[currentDate.getMonth()]} ${curYear}`;

    setPayrollForm({
      month: `${curYear}-${curMonth}`,
      monthLabel,
      baseSalary: (emp.baseSalary || 0).toString(),
      bonusAmount: '0',
      deductionAmount: '0',
      paymentMethod: 'CASH',
      notes: `Paiement salaire ${monthLabel} pour ${emp.fullName} (${emp.position}).`,
    });
    setShowPayrollModal(true);
  };

  const handleOpenPayrollForUser = (staff: StaffUser) => {
    const matched = allEmployees.find((e) => e.id === staff.id) || {
      id: staff.id,
      source: 'USER' as const,
      firstName: staff.firstName,
      lastName: staff.lastName,
      fullName: `${staff.lastName.toUpperCase()} ${staff.firstName}`,
      phone: staff.phone || 'Néant',
      position: staff.doctorProfile?.specialtyName || staff.role.displayName,
      baseSalary: parseFloat(getDefaultSalaryByRole(staff.role.name)) || 0,
      email: staff.email,
      rawUser: staff,
    };
    handleOpenPayrollForEmployee(matched);
  };

  // Filtrage des bulletins de salaire par période
  const isSlipInPayrollPeriod = (
    slip: PayrollSlipItem,
    period: 'ALL' | 'THIS_MONTH' | 'PREVIOUS_MONTH' | 'LAST_3_MONTHS'
  ) => {
    if (period === 'ALL') return true;
    const slipDate = new Date(slip.paymentDate || slip.month);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (period === 'THIS_MONTH') {
      return slipDate.getFullYear() === curYear && slipDate.getMonth() === curMonth;
    }
    if (period === 'PREVIOUS_MONTH') {
      const prevDate = new Date(curYear, curMonth - 1, 1);
      return slipDate.getFullYear() === prevDate.getFullYear() && slipDate.getMonth() === prevDate.getMonth();
    }
    if (period === 'LAST_3_MONTHS') {
      const threeMonthsAgo = new Date(curYear, curMonth - 2, 1);
      return slipDate >= threeMonthsAgo;
    }
    return true;
  };

  const filteredPayrollSlips = useMemo(() => {
    return payrollSlips.filter((s) => isSlipInPayrollPeriod(s, payrollPeriodFilter));
  }, [payrollSlips, payrollPeriodFilter]);

  const totalFilteredPayroll = useMemo(() => {
    return filteredPayrollSlips.reduce((sum, s) => sum + s.netSalary, 0);
  }, [filteredPayrollSlips]);

  // Calcul dynamique net à payer paie
  const payrollNet = useMemo(() => {
    const base = parseFloat(payrollForm.baseSalary || '0');
    const bonus = parseFloat(payrollForm.bonusAmount || '0');
    const ded = parseFloat(payrollForm.deductionAmount || '0');
    return Math.max(0, base + bonus - ded);
  }, [payrollForm]);

  // Calcul panier réquisition clinique
  const requisitionTotal = useMemo(() => {
    return requisitionCart.reduce((sum, it) => sum + (it.unitCost * it.quantity), 0);
  }, [requisitionCart]);

  // Action d'ouverture de réquisition spécifique pour la Dentisterie
  const handleOpenDentistRequisition = () => {
    setError('');
    setRequisitionDept('Dentisterie');
    setRequisitionReason('Soins & Interventions Dentaires (anesthésiques, compresses, seringues)');
    setShowRequisitionModal(true);
  };

  // Téléversement de pièce jointe justificative (Facultatif)
  const handleExpenseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadAttachmentError('Le fichier dépasse la taille maximale autorisée (10 Mo).');
      return;
    }

    setUploadingAttachment(true);
    setUploadAttachmentError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/expenses/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du téléversement');

      setExpenseForm((prev) => ({
        ...prev,
        attachmentUrl: data.url,
        attachmentName: data.filename || file.name,
      }));
    } catch (err: any) {
      setUploadAttachmentError(err.message || 'Erreur lors de l’envoi du justificatif');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // =========================================================================
  // SOUMISSION SORTIE DE CAISSE STANDARD
  // =========================================================================
  const handleSubmitStandardExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (expenseForm.category === 'Autre' && !expenseForm.customCategory.trim()) {
      setError('Veuillez préciser le nom de votre catégorie personnalisée.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'STANDARD_EXPENSE',
          ...expenseForm,
          beneficiary: expenseForm.beneficiary.trim() || 'Néant',
          reference: expenseForm.reference.trim() || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement');

      setExpenses([data.expense, ...expenses]);
      setShowExpenseModal(false);
      setLoading(false);
      setSuccessMsg(`✓ Décaissement de ${formatCurrency(data.expense.amount)} enregistré avec succès !`);
      setTimeout(() => setSuccessMsg(''), 5000);

      // Reset
      setExpenseForm({
        category: 'Charges & Fonctionnement',
        customCategory: '',
        amount: '',
        beneficiary: '',
        paymentMethod: 'CASH',
        reference: '',
        description: '',
        transactionDate: new Date().toISOString().split('T')[0],
        attachmentUrl: '',
        attachmentName: '',
        cashRegister: currentUser.role === 'RECEPTIONIST' ? 'PETITE_CAISSE' : 'GRANDE_CAISSE',
      });
      setUploadAttachmentError('');
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
      setLoading(false);
    }
  };

  // =========================================================================
  // SOUMISSION ENTRÉE CONSULTATION WEEK-END (SAMEDI / DIMANCHE)
  // =========================================================================
  const handleSubmitWeekendIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const numAmount = parseFloat(weekendIncomeForm.amount);
    if (!numAmount || numAmount <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0 Ar.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WEEKEND_CONSULTATION_INCOME',
          amount: numAmount,
          patientName: weekendIncomeForm.patientName.trim() || 'Néant',
          doctorName: weekendIncomeForm.doctorName.trim() || 'Médecin de garde',
          actName: weekendIncomeForm.actName.trim() || 'Consultation Week-end',
          paymentMethod: weekendIncomeForm.paymentMethod,
          transactionDate: weekendIncomeForm.transactionDate,
          notes: weekendIncomeForm.notes.trim() || 'Néant',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur enregistrement consultation week-end');

      setExpenses([data.transaction, ...expenses]);
      setShowWeekendIncomeModal(false);
      setSuccessMsg(`✓ Entrée Consultation Week-end de ${formatCurrency(numAmount)} ajoutée au budget week-end !`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setWeekendIncomeForm({
        amount: '',
        patientName: '',
        doctorName: '',
        actName: 'Consultation Week-end',
        paymentMethod: 'CASH',
        transactionDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // SOUMISSION PAIEMENT MÉDECIN AVEC L'ARGENT DES CONSULTATIONS WEEK-END
  // =========================================================================
  const handleSubmitWeekendDoctorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const numAmount = parseFloat(weekendDoctorPayForm.amount);
    const chosenDoctor =
      weekendDoctorPayForm.selectedDoctorOption === 'CUSTOM'
        ? weekendDoctorPayForm.customDoctorName.trim()
        : weekendDoctorPayForm.selectedDoctorOption.trim();

    if (!chosenDoctor) {
      setError('Veuillez sélectionner ou préciser le nom du médecin bénéficiaire.');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setError('Veuillez saisir un montant supérieur à 0 Ar.');
      return;
    }
    if (numAmount > soldeDisponibleWeekend) {
      setError(
        `Le paiement (${formatCurrency(numAmount)}) dépasse le budget disponible des consultations week-end (${formatCurrency(soldeDisponibleWeekend)}).`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WEEKEND_DOCTOR_PAYMENT',
          doctorName: chosenDoctor,
          amount: numAmount,
          paymentMethod: weekendDoctorPayForm.paymentMethod,
          transactionDate: weekendDoctorPayForm.transactionDate,
          weekendPeriod: weekendDoctorPayForm.weekendPeriod.trim() || 'Week-end',
          notes: weekendDoctorPayForm.notes.trim() || 'Néant',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur paiement médecin week-end');

      setExpenses([data.paymentTx, ...expenses]);
      setShowWeekendDoctorPayModal(false);
      setPrintedWeekendPayment(data.paymentTx);
      setSuccessMsg(`✓ Paiement de ${formatCurrency(numAmount)} versé à ${chosenDoctor} sur le budget Consultations Week-end !`);
      setTimeout(() => setSuccessMsg(''), 6000);
      setWeekendDoctorPayForm({
        selectedDoctorOption: '',
        customDoctorName: '',
        amount: '',
        paymentMethod: 'CASH',
        transactionDate: new Date().toISOString().split('T')[0],
        weekendPeriod: `Week-end du ${new Date().toLocaleDateString('fr-FR')}`,
        notes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  // Téléversement pièce jointe pour versement
  const handleTransferFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadTransferError('Le fichier dépasse la taille maximale autorisée (10 Mo).');
      return;
    }

    setUploadingTransferAttachment(true);
    setUploadTransferError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/expenses/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du téléversement');

      setTransferForm((prev) => ({
        ...prev,
        attachmentUrl: data.url,
        attachmentName: data.filename || file.name,
      }));
    } catch (err: any) {
      setUploadTransferError(err.message || 'Erreur lors de l’envoi du justificatif');
    } finally {
      setUploadingTransferAttachment(false);
    }
  };

  // =========================================================================
  // SOUMISSION TRANSFERTS INTER-COMPTES (Petite Caisse, Grande Caisse, Banque)
  // =========================================================================
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(transferForm.amount);
    if (!numAmount || numAmount <= 0) {
      setError('Veuillez saisir un montant de transfert supérieur à 0 Ar.');
      return;
    }

    if (transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE' && numAmount > soldeDisponiblePetiteCaisse) {
      setError(
        `Le montant du versement (${formatCurrency(numAmount)}) ne peut pas dépasser le solde disponible en Petite Caisse (${formatCurrency(soldeDisponiblePetiteCaisse)}). Le solde de caisse ne peut pas être négatif.`
      );
      return;
    }

    if (transferType === 'GRANDE_CAISSE_TO_BANQUE' && numAmount > soldeDisponibleGrandeCaisse) {
      setError(
        `Le montant du dépôt (${formatCurrency(numAmount)}) ne peut pas dépasser le solde disponible au coffre Grande Caisse (${formatCurrency(soldeDisponibleGrandeCaisse)}).`
      );
      return;
    }

    if (transferType === 'BANQUE_TO_GRANDE_CAISSE' && numAmount > soldeDisponibleBanque) {
      setError(
        `Le montant du retrait bancaire (${formatCurrency(numAmount)}) ne peut pas dépasser le solde disponible sur le compte bancaire (${formatCurrency(soldeDisponibleBanque)}).`
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CASH_TRANSFER',
          transferType,
          ...transferForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du versement');

      if (data.transfer?.inTx && data.transfer?.outTx) {
        setExpenses([data.transfer.inTx, data.transfer.outTx, ...expenses]);
      } else if (data.transfer?.outTx) {
        setExpenses([data.transfer.outTx, ...expenses]);
      }
      setShowTransferModal(false);
      setLoading(false);

      const titleLabel =
        transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
          ? 'Versement Petite Caisse ➔ Grande Caisse'
          : transferType === 'GRANDE_CAISSE_TO_BANQUE'
          ? 'Dépôt Grande Caisse ➔ Banque'
          : 'Retrait Banque ➔ Grande Caisse';

      setSuccessMsg(
        `✓ ${titleLabel} de ${formatCurrency(numAmount)} validé avec succès !`
      );
      setTimeout(() => setSuccessMsg(''), 6000);

      // Ouvrir le bordereau officiel A4
      setPrintedTransfer({
        ref: data.transfer?.transferRef || 'VERS-2026',
        amount: numAmount,
        senderName: transferForm.senderName,
        receiverName: transferForm.receiverName,
        date: transferForm.transferDate,
        notes: transferForm.notes,
        attachmentUrl: transferForm.attachmentUrl,
        attachmentName: transferForm.attachmentName,
        title: titleLabel,
        sourceLabel:
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? 'Petite Caisse (Compte Accueil)'
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? 'Grande Caisse (Coffre Direction)'
            : 'Banque',
        destLabel:
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? 'Grande Caisse (Coffre Direction)'
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? 'Banque'
            : 'Grande Caisse (Coffre Direction)',
      });

      // Reset
      setTransferForm({
        amount: '',
        senderName: isReceptionist ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 'Accueil & Caisse',
        receiverName: 'Direction Clinique / Administrateur',
        notes: '',
        transferDate: new Date().toISOString().split('T')[0],
        attachmentUrl: '',
        attachmentName: '',
      });
      setUploadTransferError('');
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
      setLoading(false);
    }
  };

  // =========================================================================
  // GESTION CRUD PAR L'ADMINISTRATEUR (MODIFICATION & SUPPRESSION)
  // =========================================================================
  const handleOpenEditTx = (tx: ExpenseTx) => {
    setEditingTx(tx);
    setEditForm({
      id: tx.id,
      category: tx.category || 'Charges d’exploitation',
      amount: String(tx.amount || ''),
      paymentMethod: tx.paymentMethod || 'CASH',
      reference: tx.reference || '',
      description: tx.description || '',
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toISOString().split('T')[0] : '',
      cashRegister: tx.cashRegister || 'PETITE_CAISSE',
      attachmentUrl: tx.attachmentUrl || '',
      attachmentName: tx.attachmentName || '',
    });
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');

      setExpenses((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...t, ...data.transaction } : t))
      );

      setEditingTx(null);
      setLoading(false);
      setSuccessMsg('✓ Transaction mise à jour avec succès !');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Erreur de modification');
      setLoading(false);
    }
  };

  const handleDeleteTx = async (tx: ExpenseTx) => {
    if (
      !window.confirm(
        `Confirmez-vous la suppression de l'écriture ${tx.reference || tx.description} (${formatCurrency(tx.amount)}) ? Cette action supprimera définitivement le mouvement et réajustera le solde.`
      )
    ) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/expenses?id=${tx.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur suppression');

      const isPaired =
        tx.reference &&
        (tx.reference.startsWith('VERS-') || tx.reference.startsWith('DEP-BQ-') || tx.reference.startsWith('RET-BQ-'));

      setExpenses((prev) =>
        prev.filter((t) => (isPaired ? t.reference !== tx.reference : t.id !== tx.id))
      );

      setLoading(false);
      setSuccessMsg('✓ Écriture supprimée avec succès du journal de caisse.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
      setLoading(false);
    }
  };

  // =========================================================================
  // ENREGISTREMENT DES PARAMÈTRES ET DU SOLDE BANCAIRE
  // =========================================================================
  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_BANK_SETTINGS',
          ...bankSettings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur enregistrement coordonnées bancaires');

      if (data.initialTransaction) {
        setExpenses((prev) => {
          const exists = prev.some((t) => t.id === data.initialTransaction.id);
          if (exists) {
            return prev.map((t) => (t.id === data.initialTransaction.id ? data.initialTransaction : t));
          } else {
            return [data.initialTransaction, ...prev];
          }
        });
      }

      setShowBankSettingsModal(false);
      setLoading(false);
      setSuccessMsg(`✓ Coordonnées et solde de la banque "${bankSettings.bankName}" enregistrés avec succès !`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
      setLoading(false);
    }
  };

  // =========================================================================
  // SOUMISSION FICHE DE PAIE & DÉCAISSEMENT SALAIRE
  // =========================================================================
  const handleSubmitPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        action: 'PAYROLL_SLIP',
        ...payrollForm,
      };
      if (selectedStaff.source === 'EMPLOYEE') {
        payload.employeeId = selectedStaff.id;
      } else {
        payload.userId = selectedStaff.id;
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’émission de la paie');

      setPayrollSlips([data.payrollSlip, ...payrollSlips]);
      setExpenses([data.cashTx, ...expenses]);
      setShowPayrollModal(false);
      setLoading(false);
      setSuccessMsg(
        `✓ Fiche de paie émise et décaissement de ${formatCurrency(data.payrollSlip.netSalary)} validé pour ${selectedStaff.fullName} !`
      );
      setTimeout(() => setSuccessMsg(''), 6000);

      // Ouvrir immédiatement la fiche de paie pour impression
      setPrintedSlip(data.payrollSlip);
    } catch (err: any) {
      setError(err.message || 'Erreur');
      setLoading(false);
    }
  };

  // =========================================================================
  // GESTION PANIER DÉPENSE CLINIQUE (PRÉLÈVEMENT PHARMACIE)
  // =========================================================================
  const handleAddMedToRequisition = (medId: string) => {
    const med = medicines.find((m) => m.id === medId);
    if (!med) return;
    if (med.currentStock <= 0) {
      setError(`Le médicament "${med.name}" est en rupture de stock.`);
      return;
    }

    setRequisitionCart((prev) => {
      const idx = prev.findIndex((i) => i.medicineId === med.id);
      if (idx > -1) {
        const copy = [...prev];
        if (copy[idx].quantity + 1 <= med.currentStock) {
          copy[idx].quantity += 1;
        }
        return copy;
      }
      return [
        ...prev,
        {
          medicineId: med.id,
          medicineName: med.name,
          dosage: med.dosage,
          form: med.form,
          quantity: 1, // en unités
          unitCost: med.purchasePrice || med.sellingPrice,
          availableStock: med.currentStock,
        },
      ];
    });
  };

  const updateRequisitionQty = (medId: string, delta: number) => {
    setRequisitionCart((prev) =>
      prev
        .map((it) => {
          if (it.medicineId === medId) {
            const next = it.quantity + delta;
            return next > 0 && next <= it.availableStock ? { ...it, quantity: next } : it;
          }
          return it;
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const removeRequisitionItem = (medId: string) => {
    setRequisitionCart((prev) => prev.filter((it) => it.medicineId !== medId));
  };

  // =========================================================================
  // SOUMISSION DÉPENSE CLINIQUE (PRÉLÈVEMENT PHARMACIE)
  // =========================================================================
  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requisitionCart.length) {
      setError('Veuillez ajouter au moins un médicament à prélever.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLINIC_MEDICINE_REQUISITION',
          department: requisitionDept,
          requestedBy: requisitionRequester,
          reason: requisitionReason,
          items: requisitionCart,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du prélèvement');

      // Déduire le stock localement
      setMedicines((prev) =>
        prev.map((m) => {
          const reqItem = requisitionCart.find((ci) => ci.medicineId === m.id);
          if (reqItem) {
            return { ...m, currentStock: Math.max(0, m.currentStock - reqItem.quantity) };
          }
          return m;
        })
      );

      setClinicRequisitions([data.requisition, ...clinicRequisitions]);
      setExpenses([data.cashTx, ...expenses]);
      setShowRequisitionModal(false);
      setLoading(false);
      setSuccessMsg(
        `✓ Prélèvement pharmacie validé ! ${requisitionCart.length} médicaments déduits pour la clinique (${formatCurrency(data.requisition.totalCost)}).`
      );
      setTimeout(() => setSuccessMsg(''), 6000);

      // Ouvrir le bon de prélèvement
      setPrintedRequisition({
        req: data.requisition,
        items: data.items,
      });

      // Reset
      setRequisitionCart([]);
    } catch (err: any) {
      setError(err.message || 'Erreur');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-blue-600">Tableau de bord</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium">Administration Clinique</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">
              {isReceptionist
                ? activeTab === 'transfers'
                  ? 'Versements vers Grande Caisse'
                  : 'Dépenses Petite Caisse'
                : isAccountant
                ? 'Comptabilité & Grande Caisse'
                : 'Gestion Solde'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight flex items-center gap-2.5">
            <ArrowDownRight className="w-6 h-6 text-rose-600" />
            <span>
              {isReceptionist
                ? activeTab === 'transfers'
                  ? 'Versements Petite Caisse ➔ Grande Caisse'
                  : 'Gestion Petite Caisse & Dépenses Accueil'
                : isAccountant
                ? 'Compte Comptable — Grande Caisse, Banque & Consultations Week-end'
                : 'Gestion Solde, Dépenses, Paie & Trésorerie'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pouvoir de décaissement de l'administration : Dépenses de fonctionnement, Fiches de paie du personnel &amp; Prélèvements pharmacie interne.
          </p>
        </div>

        {/* Boutons d'action rapide */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Versement / Mouvements inter-comptes */}
          <button
            type="button"
            onClick={() => {
              setError('');
              setTransferType('PETITE_CAISSE_TO_GRANDE_CAISSE');
              setShowTransferModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>
              {currentUser.role === 'RECEPTIONIST'
                ? 'Nouveau Versement vers Grande Caisse'
                : 'Mouvements & Transferts (Caisse / Coffre / Banque)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setError('');
              setShowExpenseModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Dépense / Sortie</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setError('');
              setShowRequisitionModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Pill className="w-4 h-4 text-indigo-600" />
            <span>Prélèvement Pharmacie (Clinique)</span>
          </button>
        </div>
      </div>

      {/* Bandeau d'identification de l'opérateur connecté & Traçabilité */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-sm shadow-xs">
            {currentUser.firstName?.[0] || 'U'}{currentUser.lastName?.[0] || ''}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Session active :</span>
              <strong className="text-white font-extrabold text-sm">{currentUser.firstName} {currentUser.lastName}</strong>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                currentUser.role === 'RECEPTIONIST'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : currentUser.role === 'ACCOUNTANT'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}>
                {currentUser.role === 'RECEPTIONIST'
                  ? '👤 Compte Accueil • Gestion Petite Caisse'
                  : currentUser.role === 'ACCOUNTANT'
                  ? '📊 Compte Comptable • Gestion Grande Caisse, Banque & Consultations Week-end'
                  : currentUser.role === 'SUPER_ADMIN'
                  ? '👑 Super Administrateur • Gestion Grande Caisse & Banque'
                  : currentUser.role === 'CLINIC_ADMIN'
                  ? '💼 Administrateur Clinique • Gestion Grande Caisse & Banque'
                  : currentUser.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Traçabilité garantie : chaque versement, encaissement ou sortie est signé et enregistré nominativement sous votre nom.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{clinic?.name || 'Clinique Betesda'}</span>
        </div>
      </div>

      {/* KPI Cards : Cloisonnement strict Accueil (Petite Caisse seule) vs Administrateur (Petite Caisse, Grande Caisse, Banque, Trésorerie) */}
      {currentUser.role === 'RECEPTIONIST' ? (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-white to-emerald-50/50 border-2 border-emerald-400 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Solde Disponible en Petite Caisse (Accueil) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Petite Caisse (Accueil)</span>
              </span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                ★ Solde Disponible en Caisse
              </div>
              <div className={`text-3xl lg:text-4xl font-black tracking-tight ${soldeDisponiblePetiteCaisse > 0 ? 'text-emerald-800' : 'text-slate-700'}`}>
                {formatCurrency(soldeDisponiblePetiteCaisse)}
              </div>
              {soldeDisponiblePetiteCaisse === 0 && (
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-md inline-block mt-1">
                  ✓ Caisse soldée (recettes intégralement versées à la Direction)
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
            <div className="text-xs space-y-1 text-slate-600 bg-white/80 p-3.5 rounded-xl border border-emerald-100 min-w-[280px]">
              <div className="flex justify-between items-center gap-4">
                <span>Recettes encaissées (Consultations + Pharmacie) :</span>
                <strong className="text-emerald-700 font-bold">+{formatCurrency(recettesPetiteCaisse)}</strong>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span>Menues dépenses autorisées :</span>
                <strong className="text-slate-700 font-bold">-{formatCurrency(depensesPetiteCaisseHorsTransfert)}</strong>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span>Versements effectués :</span>
                <strong className="text-amber-700 font-bold">-{formatCurrency(totalTransfersAmount)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setError('');
                setTransferType('PETITE_CAISSE_TO_GRANDE_CAISSE');
                setShowTransferModal(true);
              }}
              disabled={soldeDisponiblePetiteCaisse <= 0}
              className="py-3 px-5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Wallet className="w-4 h-4" />
              <span>Effectuer un Versement vers la Grande Caisse</span>
            </button>
          </div>
        </div>
      ) : (
        /* VUE ADMINISTRATEUR : LES 3 SOLDES MAJEURS + TRÉSORERIE TOTALE */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Carte 1 : Solde Petite Caisse (Accueil) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-emerald-50/50 border-2 border-emerald-300 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Petite Caisse (Accueil)</span>
              </span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                ★ Solde Petite Caisse
              </div>
              <div className={`text-2xl lg:text-3xl font-black tracking-tight ${soldeDisponiblePetiteCaisse > 0 ? 'text-emerald-800' : 'text-slate-700'}`}>
                {formatCurrency(soldeDisponiblePetiteCaisse)}
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-100 text-[10px] space-y-0.5 text-slate-600">
              <div className="flex justify-between items-center">
                <span>Recettes encaissées :</span>
                <strong className="text-emerald-700 font-bold">+{formatCurrency(recettesPetiteCaisse)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Menues dépenses :</span>
                <strong className="text-slate-700 font-bold">-{formatCurrency(depensesPetiteCaisseHorsTransfert)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Versé à l'Admin :</span>
                <strong className="text-amber-700 font-bold">-{formatCurrency(totalTransfersAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Carte 2 : Solde Grande Caisse (Coffre Administrateur) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-blue-50/50 border-2 border-blue-400 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>Grande Caisse (Coffre Admin)</span>
              </span>
              <Building className="w-4 h-4 text-blue-600" />
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                ★ Solde Grande Caisse
              </div>
              <div className={`text-2xl lg:text-3xl font-black tracking-tight ${soldeDisponibleGrandeCaisse >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                {formatCurrency(soldeDisponibleGrandeCaisse)}
              </div>
            </div>

            <div className="pt-2 border-t border-blue-100 text-[10px] space-y-0.5 text-slate-600">
              <div className="flex justify-between items-center">
                <span>Entrées reçues (Accueil & Banque) :</span>
                <strong className="text-emerald-700 font-bold">+{formatCurrency(totalGrandeCaisseReceived)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Dépenses, Paie & Versé Banque :</span>
                <strong className="text-rose-700 font-bold">-{formatCurrency(totalGrandeCaisseExpenses)}</strong>
              </div>
            </div>
          </div>

          {/* Carte 3 : Solde Banque */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-indigo-50/50 border-2 border-indigo-400 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="max-w-[140px] truncate">{bankSettings.bankName || 'Compte Bancaire'}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowBankSettingsModal(true)}
                  className="p-1 rounded-md text-indigo-600 hover:text-indigo-950 hover:bg-indigo-100 transition-colors cursor-pointer"
                  title="Modifier le nom de la banque, le RIB et le montant initial"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <Landmark className="w-4 h-4 text-indigo-600" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>★ Solde en Banque</span>
                {bankSettings.bankRib && (
                  <span className="font-mono text-[9px] text-indigo-600 font-bold">
                    RIB: {bankSettings.bankRib}
                  </span>
                )}
              </div>
              <div className={`text-2xl lg:text-3xl font-black tracking-tight ${soldeDisponibleBanque >= 0 ? 'text-indigo-900' : 'text-rose-700'}`}>
                {formatCurrency(soldeDisponibleBanque)}
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-100 text-[10px] space-y-0.5 text-slate-600">
              <div className="flex justify-between items-center">
                <span>Dépôts & Capital reçu :</span>
                <strong className="text-emerald-700 font-bold">+{formatCurrency(recettesBanque)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Retraits vers coffre & virements :</span>
                <strong className="text-rose-700 font-bold">-{formatCurrency(sortiesBanque)}</strong>
              </div>
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowBankSettingsModal(true)}
                  className="text-[10px] text-indigo-700 hover:text-indigo-950 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Modifier le nom &amp; montant banque</span>
                </button>
              </div>
            </div>
          </div>

          {/* Carte 4 : Trésorerie Totale Clinique (Petite Caisse + Grande Caisse + Banque) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md space-y-2 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                Vision Globale
              </span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">
                ★ Trésorerie Totale Clinique
              </div>
              <div className="text-2xl lg:text-3xl font-black text-amber-400 tracking-tight font-mono">
                {formatCurrency(soldeTresorerieTotale)}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700 text-[10px] space-y-0.5 text-slate-300">
              <div className="flex justify-between items-center">
                <span>Petite Caisse :</span>
                <strong className="text-emerald-400">{formatCurrency(soldeDisponiblePetiteCaisse)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Grande Caisse :</span>
                <strong className="text-blue-300">{formatCurrency(soldeDisponibleGrandeCaisse)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Banque :</span>
                <strong className="text-indigo-300">{formatCurrency(soldeDisponibleBanque)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglets Principaux Séparés */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/80 p-1 text-xs font-bold w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowDownRight className="w-4 h-4 text-rose-600" />
          <span>
            {isReceptionist
              ? `Dépenses Petite Caisse (${filteredExpenses.length})`
              : `Dépenses (${filteredExpenses.length})`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transfers')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'transfers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>
            {isReceptionist
              ? `Versements vers Grande Caisse (${transferTransactionsList.length})`
              : `Transferts (${transferTransactionsList.length})`}
          </span>
        </button>

        {!isReceptionist && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'bank'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Mouvements Banque ({bankTransactionsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('weekend-consultations')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'weekend-consultations'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Consultations Week-end</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'weekend-consultations'
                    ? 'bg-white/20 text-white'
                    : 'bg-violet-100 text-violet-800'
                }`}
              >
                {formatCurrency(soldeDisponibleWeekend)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'payroll'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Fiches de Paie ({allEmployees.length})</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('clinic-medicines')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'clinic-medicines'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>Bons de Sortie Médicaments ({clinicRequisitions.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : TOUTES LES DÉPENSES & DÉCAISSEMENTS                            */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Panneau complet de filtres multiples */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3.5">
            {/* Sélecteur de Caisse pour Administrateur (Masqué pour l'Accueil qui est cloisonné à la Petite Caisse) */}
            {currentUser.role !== 'RECEPTIONIST' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 pl-1">
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <span>Sélection du Compte / Caisse :</span>
                </span>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setRegisterFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      registerFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toutes les Caisses
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterFilter('PETITE_CAISSE')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      registerFilter === 'PETITE_CAISSE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Petite Caisse (Accueil)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterFilter('GRANDE_CAISSE')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      registerFilter === 'GRANDE_CAISSE'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                    <span>Grande Caisse (Coffre Admin)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterFilter('BANQUE')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      registerFilter === 'BANQUE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-indigo-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
                    <span>Banque</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sélecteur Type d'affichage Dépenses Seules vs Toutes opérations (hors transferts) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setExpenseTypeView('EXPENSE_ONLY')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    expenseTypeView === 'EXPENSE_ONLY'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dépenses uniquement
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseTypeView('ALL_OPS')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    expenseTypeView === 'ALL_OPS'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dépenses + Recettes caisse
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                Les transferts inter-caisses et mouvements bancaires disposent désormais de leurs onglets dédiés.
              </span>
            </div>

            {/* Ligne 1 : Recherche + Périodes Rapides */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par motif, référence, bénéficiaire, validateur..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-blue-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Présélections de date rapides */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs font-semibold">
                {[
                  { key: 'ALL', label: 'Toutes dates' },
                  { key: 'TODAY', label: "Aujourd'hui" },
                  { key: 'YESTERDAY', label: 'Hier' },
                  { key: '7DAYS', label: '7 derniers jours' },
                  { key: 'THIS_MONTH', label: 'Ce mois-ci' },
                  { key: 'LAST_MONTH', label: 'Mois dernier' },
                  { key: 'CUSTOM', label: '📅 Période...' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDatePreset(p.key as any)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                      datePreset === p.key
                        ? 'bg-slate-900 text-white shadow-2xs font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Si période personnalisée sélectionnée */}
            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs animate-in fade-in">
                <span className="font-bold text-blue-900">Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                />
                <span className="font-bold text-blue-900">Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                />
              </div>
            )}

            {/* Ligne 2 : Filtres Catégorie, Paiement, Montant & Tri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Catégorie de Dépense
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">Toutes les catégories</option>
                  {availableExpenseCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Mode de Décaissement
                </label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">Tous les modes</option>
                  <option value="CASH">Espèces / Caisse</option>
                  <option value="BANK_TRANSFER">Virement Bancaire</option>
                  <option value="CHECK">Chèque</option>
                  <option value="MOBILE_MONEY">Mobile Money (Mvola, etc.)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tranche de Montant
                </label>
                <select
                  value={amountFilter}
                  onChange={(e) => setAmountFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">Tous montants</option>
                  <option value="<50k">Moins de 50 000 Ar</option>
                  <option value="50k-200k">50 000 Ar - 200 000 Ar</option>
                  <option value="200k-500k">200 000 Ar - 500 000 Ar</option>
                  <option value=">500k">Plus de 500 000 Ar</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Trier Par
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="DATE_DESC">Date (Plus récent d'abord)</option>
                  <option value="DATE_ASC">Date (Plus ancien d'abord)</option>
                  <option value="AMOUNT_DESC">Montant (Décroissant)</option>
                  <option value="AMOUNT_ASC">Montant (Croissant)</option>
                </select>
              </div>
            </div>

            {/* Ligne 3 : Synthèse des résultats & Bouton Réinitialiser */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  {filteredExpenses.length} opération(s) trouvée(s)
                </span>
                {filteredIncomeTotal > 0 && (
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Versements Reçus (Grande Caisse) : + {formatCurrency(filteredIncomeTotal)}
                  </span>
                )}
                <span className="font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  Total Sorties / Décaissements : - {formatCurrency(filteredExpenseTotal)}
                </span>
                <span className="font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                  Solde Net : {filteredNetBalance >= 0 ? '+' : ''}{formatCurrency(filteredNetBalance)}
                </span>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réinitialiser tous les filtres</span>
                </button>
              )}
            </div>
          </div>

          {/* Tableau des mouvements de caisse (Dépenses & Versements) */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Réf. Mouvement</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Description / Motif</th>
                  <th className="px-4 py-3">Caisse</th>
                  <th className="px-4 py-3">Intervenants &amp; Responsables (Qui a fait quoi)</th>
                  <th className="px-4 py-3">Règlement</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-center">Pièce Jointe</th>
                  <th className="px-4 py-3 text-center">Bon / Reçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      Aucune opération enregistrée correspondant aux critères.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const isIncome = exp.type === 'INCOME' || (exp.category || '').toLowerCase().includes('reçu');
                    const isTransferOut = exp.type === 'EXPENSE' && ((exp.category || '').toLowerCase().includes('versement') || (exp.reference && exp.reference.startsWith('VERS')));
                    const isGrandeCaisse = exp.cashRegister === 'GRANDE_CAISSE';
                    const actors = parseTransactionActors(exp);

                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(exp.transactionDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`font-mono font-bold ${
                              isIncome ? 'text-emerald-700' : isTransferOut ? 'text-amber-700' : 'text-rose-600'
                            }`}
                          >
                            {exp.reference || 'DEP-DIRECT'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isTransferOut
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : exp.category === 'Salaires & Paie'
                                ? 'bg-purple-100 text-purple-800'
                                : exp.category === 'Dépense Clinique (Pharmacie)'
                                ? 'bg-indigo-100 text-indigo-800'
                                : exp.category?.includes('Dentist')
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 max-w-xs">
                          <div>{exp.description}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              exp.cashRegister === 'BANQUE'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : isGrandeCaisse
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {exp.cashRegister === 'BANQUE'
                              ? 'Banque'
                              : isGrandeCaisse
                              ? 'Grande Caisse (Admin)'
                              : 'Petite Caisse (Accueil)'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 min-w-[200px]">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-[11px]">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Saisi par : <strong className="text-blue-950 font-black">{actors.operator}</strong></span>
                            </div>
                            {actors.primaryActor && (
                              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                                {actors.primaryActor}
                              </div>
                            )}
                            {actors.secondaryActor && (
                              <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block ml-1">
                                {actors.secondaryActor}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {exp.paymentMethod}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-black whitespace-nowrap ${
                            isIncome ? 'text-emerald-700' : isTransferOut ? 'text-amber-700' : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? `+ ${formatCurrency(exp.amount)}` : `- ${formatCurrency(exp.amount)}`}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {exp.attachmentUrl ? (
                            <a
                              href={exp.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                              title={exp.attachmentName || 'Justificatif'}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                              <span className="max-w-[90px] truncate">{exp.attachmentName || 'Justificatif'}</span>
                              <Eye className="w-3 h-3 text-blue-500" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Aucune</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const isTransferRef =
                                  exp.reference &&
                                  (exp.reference.startsWith('VERS-') ||
                                    exp.reference.startsWith('DEP-BQ-') ||
                                    exp.reference.startsWith('RET-BQ-'));
                                if (isTransferOut || isIncome || isTransferRef) {
                                  const tTitle = exp.reference?.startsWith('DEP-BQ')
                                    ? 'Dépôt Grande Caisse ➔ Banque'
                                    : exp.reference?.startsWith('RET-BQ')
                                    ? 'Retrait Banque ➔ Grande Caisse'
                                    : 'Versement Petite Caisse ➔ Grande Caisse';
                                  setPrintedTransfer({
                                    ref: exp.reference || 'VERS-2026',
                                    amount: exp.amount,
                                    senderName: actors.primaryActor ? actors.primaryActor.replace(/^(?:Remettant|Déposant|Émetteur)\s*:\s*/i, '') : 'Accueil (Caissière)',
                                    receiverName: actors.secondaryActor ? actors.secondaryActor.replace(/^(?:Récepteur|Destinataire|Compte)\s*:\s*/i, '') : 'Direction / Administrateur',
                                    date: exp.transactionDate,
                                    notes: exp.description,
                                    attachmentUrl: exp.attachmentUrl,
                                    attachmentName: exp.attachmentName,
                                    title: tTitle,
                                    sourceLabel: exp.reference?.startsWith('RET-BQ')
                                      ? 'Banque'
                                      : exp.reference?.startsWith('DEP-BQ')
                                      ? 'Grande Caisse (Coffre Direction)'
                                      : 'Petite Caisse (Compte Accueil)',
                                    destLabel: exp.reference?.startsWith('RET-BQ')
                                      ? 'Grande Caisse (Coffre Direction)'
                                      : exp.reference?.startsWith('DEP-BQ')
                                      ? 'Banque'
                                      : 'Grande Caisse (Coffre Direction)',
                                  });
                                } else {
                                  setPrintedExpense(exp);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Imprimer / Télécharger le bon A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{isTransferOut || isIncome ? 'Bordereau' : 'Reçu'}</span>
                            </button>

                            {/* Actions de modification & suppression pour l'Administrateur */}
                            {currentUser.role !== 'RECEPTIONIST' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTx(exp)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Modifier cette écriture (Administrateur)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTx(exp)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Supprimer cette écriture (Administrateur)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 1b : TRANSFERTS & VERSEMENTS INTER-CAISSES                         */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-5 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                <span>
                  {isReceptionist
                    ? 'Suivi des Versements Petite Caisse ➔ Grande Caisse'
                    : 'Journal Dédié des Transferts (Petite Caisse / Grande Caisse / Banque)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isReceptionist
                  ? 'Historique séparé de vos versements remis à la Grande Caisse avec bordereaux A4 certifiés.'
                  : 'Suivi clair et isolé de tous les mouvements de fonds entre la Petite Caisse, la Grande Caisse et la Banque.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setTransferType('PETITE_CAISSE_TO_GRANDE_CAISSE');
                  setShowTransferModal(true);
                }}
                disabled={soldeDisponiblePetiteCaisse <= 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Petite Caisse ➔ Grande Caisse</span>
              </button>

              {!isReceptionist && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setTransferType('GRANDE_CAISSE_TO_BANQUE');
                      setTransferForm((prev) => ({
                        ...prev,
                        senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                        receiverName: bankSettings.bankName || 'Banque',
                        notes: "Dépôt bancaire des espèces du coffre Grande Caisse",
                      }));
                      setShowTransferModal(true);
                    }}
                    disabled={soldeDisponibleGrandeCaisse <= 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Grande Caisse ➔ Banque</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setTransferType('BANQUE_TO_GRANDE_CAISSE');
                      setTransferForm((prev) => ({
                        ...prev,
                        senderName: bankSettings.bankName || 'Banque',
                        receiverName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                        notes: 'Retrait bancaire pour approvisionnement du coffre Grande Caisse',
                      }));
                      setShowTransferModal(true);
                    }}
                    disabled={soldeDisponibleBanque <= 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Banque ➔ Grande Caisse</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date &amp; Réf.</th>
                  <th className="py-3 px-4">Type de Mouvement</th>
                  <th className="py-3 px-4">Acteurs &amp; Opérateur</th>
                  <th className="py-3 px-4">Détail / Motif</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferTransactionsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Aucun transfert ou versement enregistré pour le moment.
                    </td>
                  </tr>
                ) : (
                  transferTransactionsList.map((tx) => {
                    const actors = parseTransactionActors(tx);
                    const isDepBq = tx.reference?.startsWith('DEP-BQ');
                    const isRetBq = tx.reference?.startsWith('RET-BQ');
                    const routeBadge = isDepBq
                      ? { label: 'Grande Caisse ➔ Banque', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
                      : isRetBq
                      ? { label: 'Banque ➔ Grande Caisse', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                      : { label: 'Petite Caisse ➔ Grande Caisse', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{formatDate(tx.transactionDate)}</div>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {tx.reference || 'VERS'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${routeBadge.cls}`}>
                            {routeBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-[11px]">Saisi par : {actors.operator}</div>
                          {actors.primaryActor && (
                            <div className="text-[11px] text-slate-600">{actors.primaryActor}</div>
                          )}
                          {actors.secondaryActor && (
                            <div className="text-[11px] text-slate-600">{actors.secondaryActor}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-slate-700 text-[11px] line-clamp-2" title={tx.description}>
                            {tx.description || 'Néant'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-sm text-amber-800 whitespace-nowrap font-mono">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPrintedTransfer({
                                  ref: tx.reference || 'VERS',
                                  amount: tx.amount,
                                  senderName: actors.primaryActor
                                    ? actors.primaryActor.replace(/^Émetteur\s*:\s*/i, '')
                                    : actors.operator,
                                  receiverName: actors.secondaryActor
                                    ? actors.secondaryActor.replace(/^Récepteur\s*:\s*/i, '')
                                    : 'Direction / Comptabilité',
                                  date: tx.transactionDate,
                                  notes: tx.description,
                                  attachmentUrl: tx.attachmentUrl,
                                  attachmentName: tx.attachmentName,
                                  title: routeBadge.label,
                                  sourceLabel: isRetBq
                                    ? bankSettings.bankName || 'Banque'
                                    : isDepBq
                                    ? 'Grande Caisse (Coffre Direction)'
                                    : 'Petite Caisse (Accueil)',
                                  destLabel: isDepBq
                                    ? bankSettings.bankName || 'Banque'
                                    : 'Grande Caisse (Coffre Direction)',
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                              title="Imprimer le Bordereau A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Bordereau A4</span>
                            </button>
                            {isAdminOrAccountant && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTx(tx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                  title="Modifier"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTx(tx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 1c : MOUVEMENTS BANQUE (DÉDIÉ COMPTABLE & ADMINISTRATEUR)          */}
      {/* ========================================================================= */}
      {activeTab === 'bank' && !isReceptionist && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-5 p-5">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-blue-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-300" />
                <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                  {bankSettings.bankName || 'Banque'}
                </span>
              </div>
              <div className="text-3xl font-black tracking-tight">
                {formatCurrency(soldeDisponibleBanque)}
              </div>
              <div className="text-[11px] text-indigo-200 flex flex-wrap gap-x-4 gap-y-1">
                <span>Titulaire : <strong className="text-white">{bankSettings.bankHolder || 'Clinique Betesda'}</strong></span>
                <span>RIB / Compte : <strong className="text-white font-mono">{bankSettings.bankRib || 'Néant'}</strong></span>
                <span>Entrées : <strong className="text-emerald-300">+{formatCurrency(recettesBanque)}</strong></span>
                <span>Sorties : <strong className="text-rose-300">-{formatCurrency(sortiesBanque)}</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setTransferType('GRANDE_CAISSE_TO_BANQUE');
                  setTransferForm((prev) => ({
                    ...prev,
                    senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                    receiverName: bankSettings.bankName || 'Banque',
                    notes: 'Dépôt bancaire depuis Grande Caisse',
                  }));
                  setShowTransferModal(true);
                }}
                disabled={soldeDisponibleGrandeCaisse <= 0}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 cursor-pointer"
              >
                + Dépôt vers Banque
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setTransferType('BANQUE_TO_GRANDE_CAISSE');
                  setTransferForm((prev) => ({
                    ...prev,
                    senderName: bankSettings.bankName || 'Banque',
                    receiverName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                    notes: 'Retrait bancaire vers Grande Caisse',
                  }));
                  setShowTransferModal(true);
                }}
                disabled={soldeDisponibleBanque <= 0}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-white text-indigo-900 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer"
              >
                Retrait vers Grande Caisse
              </button>
              <button
                type="button"
                onClick={() => setShowBankSettingsModal(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Paramètres Banque</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date &amp; Réf.</th>
                  <th className="py-3 px-4">Sens / Catégorie</th>
                  <th className="py-3 px-4">Opérateur</th>
                  <th className="py-3 px-4">Libellé / Détails</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankTransactionsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Aucun mouvement bancaire enregistré.
                    </td>
                  </tr>
                ) : (
                  bankTransactionsList.map((tx) => {
                    const isCredit = tx.type === 'INCOME';
                    const actors = parseTransactionActors(tx);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{formatDate(tx.transactionDate)}</div>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            {tx.reference || 'BQ'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              isCredit
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isCredit ? 'CRÉDIT (+)' : 'DÉBIT (-)'} • {tx.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{actors.operator}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-md">{tx.description || 'Néant'}</td>
                        <td className={`py-3 px-4 text-right font-black font-mono text-sm whitespace-nowrap ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isCredit ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPrintedExpense(tx)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                              title="Imprimer justificatif A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTx(tx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 1d : CONSULTATIONS WEEK-END (BUDGET À PART & PAIEMENT MÉDECINS)    */}
      {/* ========================================================================= */}
      {activeTab === 'weekend-consultations' && !isReceptionist && (
        <div className="space-y-6">
          {/* En-tête & Actions Budget Week-end */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-900 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/15 text-violet-200 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                <span>Gestion à Part • Budget Consultations Week-end (Samedi &amp; Dimanche)</span>
              </span>
              <h2 className="text-xl font-black tracking-tight mt-1">
                Caisse Consultations Week-end &amp; Honoraires Médecins
              </h2>
              <p className="text-xs text-violet-200 max-w-2xl">
                Toutes les recettes de consultations effectuées le week-end sont isolées ici pour suivre le budget disponible et régler directement les honoraires des médecins de garde.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowWeekendIncomeModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer Entrée Week-end</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setWeekendDoctorPayForm((prev) => ({
                    ...prev,
                    selectedDoctorOption: doctorOptions[0]?.name || 'CUSTOM',
                  }));
                  setShowWeekendDoctorPayModal(true);
                }}
                disabled={soldeDisponibleWeekend <= 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors cursor-pointer"
              >
                <Stethoscope className="w-4 h-4" />
                <span>Payer un Médecin (Budget Week-end)</span>
              </button>
            </div>
          </div>

          {/* 3 Cartes KPI du Budget Consultations Week-end */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white to-violet-50 border-2 border-violet-400 shadow-xs space-y-1">
              <div className="text-[11px] font-black text-violet-800 uppercase tracking-wider">
                ★ Budget Disponible Week-end
              </div>
              <div className="text-3xl font-black text-violet-950 font-mono">
                {formatCurrency(soldeDisponibleWeekend)}
              </div>
              <p className="text-[11px] text-slate-500">
                Argent disponible pour les paiements honoraires médecins week-end.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-1">
              <div className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
                Total Entrées Consultations Week-end
              </div>
              <div className="text-2xl font-black text-emerald-800 font-mono">
                +{formatCurrency(totalWeekendIncome)}
              </div>
              <p className="text-[11px] text-slate-500">
                {allWeekendEntries.length} consultation(s) Samedi &amp; Dimanche comptabilisée(s).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-1">
              <div className="text-[11px] font-black text-rose-700 uppercase tracking-wider">
                Total Versé aux Médecins (Week-end)
              </div>
              <div className="text-2xl font-black text-rose-700 font-mono">
                -{formatCurrency(totalWeekendPaidDoctors)}
              </div>
              <p className="text-[11px] text-slate-500">
                {weekendDoctorPayments.length} paiement(s) médecin(s) effectué(s).
              </p>
            </div>
          </div>

          {/* Filtres Mois & Médecin */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Mois :</span>
                <select
                  value={weekendMonthFilter}
                  onChange={(e) => setWeekendMonthFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="ALL">Tous les mois</option>
                  {weekendAvailableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Médecin :</span>
                <select
                  value={weekendDoctorFilter}
                  onChange={(e) => setWeekendDoctorFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="ALL">Tous les médecins</option>
                  {doctorOptions.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Les consultations encaissées le Samedi et Dimanche alimentent automatiquement ce budget séparé.
            </div>
          </div>

          {/* Tableau 1 : Entrées de Consultations Week-end */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-violet-600" />
                <span>Entrées de Consultations Week-end ({filteredWeekendEntries.length})</span>
              </h3>
              <span className="text-xs font-black text-emerald-700">
                Total affiché : +{formatCurrency(filteredWeekendEntries.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Date &amp; Jour</th>
                    <th className="py-2.5 px-3">Référence</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Médecin</th>
                    <th className="py-2.5 px-3">Acte / Motif</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWeekendEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aucune entrée de consultation week-end trouvée pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredWeekendEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{formatDate(entry.date)}</div>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-bold">
                            {entry.dayLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{entry.ref}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{entry.patientName || 'Néant'}</td>
                        <td className="py-2.5 px-3 font-bold text-violet-900">{entry.doctorName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{entry.actName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {entry.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-700">
                          +{formatCurrency(entry.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tableau 2 : Paiements aux Médecins effectués sur le Budget Week-end */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" />
                <span>Paiements Honoraires Médecins — Budget Week-end ({filteredWeekendDoctorPayments.length})</span>
              </h3>
              <span className="text-xs font-black text-rose-700">
                Total versé : -{formatCurrency(filteredWeekendDoctorPayments.reduce((s, p) => s + p.amount, 0))}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Date &amp; Réf.</th>
                    <th className="py-2.5 px-3">Médecin Payé &amp; Détails</th>
                    <th className="py-2.5 px-3">Opérateur (Comptable / Admin)</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3 text-right">Montant Versé</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWeekendDoctorPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun paiement médecin enregistré sur le budget week-end pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filteredWeekendDoctorPayments.map((pay) => {
                      const actors = parseTransactionActors(pay);
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{formatDate(pay.transactionDate)}</div>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                              {pay.reference || 'PAY-MED-WE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-md">
                            <div className="font-extrabold text-slate-900">{actors.primaryActor || 'Médecin'}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{pay.description}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{actors.operator}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {pay.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono text-rose-700">
                            -{formatCurrency(pay.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPrintedWeekendPayment(pay)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-800 text-[11px] font-bold cursor-pointer"
                                title="Imprimer le Reçu Honoraires Médecin A4"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Reçu A4</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditTx(pay)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                title="Modifier"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTx(pay)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : FICHES DE PAIE & SALAIRES DU PERSONNEL                        */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Grille de tout le personnel clinique */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Répertoire des Employés &amp; Fiches de Paie Clinique ({allEmployees.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gestion des rémunérations, profil individuel, émission des bulletins de paie et décaissement en caisse.
                </p>
              </div>

              <Link
                href="/users"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors shrink-0 shadow-2xs"
                title="Accéder au CRUD complet des employés (ajouter, modifier, supprimer des collaborateurs)"
              >
                <UserCheck className="w-4 h-4" />
                <span>Gestion Complète des Employés (CRUD) &rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allEmployees.map((emp) => {
                // Vérifier si une fiche de paie a été émise
                const latestSlip = payrollSlips.find(
                  (p) =>
                    (p.employeeId && p.employeeId === emp.id) ||
                    (p.employee?.id && p.employee.id === emp.id) ||
                    (p.userId && p.userId === emp.id) ||
                    (p.user?.id && p.user.id === emp.id)
                );

                return (
                  <div
                    key={emp.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">
                            {emp.fullName}
                          </div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {emp.position}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeProfile(emp)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                          title="Voir le profil de l'employé"
                        >
                          {emp.firstName[0]}{emp.lastName[0]}
                        </button>
                      </div>

                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div>📞 {emp.phone}</div>
                        {emp.email && <div className="truncate">📧 {emp.email}</div>}
                        <div className="pt-1 font-semibold text-slate-700">
                          Salaire de base : <span className="font-bold text-slate-900">{formatCurrency(emp.baseSalary)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {latestSlip ? (
                        <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dernier payé : {latestSlip.monthLabel}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Aucun bulletin émis</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeProfile(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                          title="Consulter le profil et l'historique complet"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Profil</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPayrollForEmployee(emp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Émettre Paie</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historique des Fiches de Paie émises avec filtres de période */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Bulletins de Salaire Décaissés ({filteredPayrollSlips.length})</span>
                </h3>
                <span className="text-xs font-bold text-purple-700">
                  Total Décaissé : {formatCurrency(totalFilteredPayroll)}
                </span>
              </div>

              {/* Filtres de période : Tout, Ce mois-ci, 3 derniers mois, Le mois d'avant */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPayrollPeriodFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    payrollPeriodFilter === 'ALL'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setPayrollPeriodFilter('THIS_MONTH')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    payrollPeriodFilter === 'THIS_MONTH'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ce mois-ci
                </button>
                <button
                  type="button"
                  onClick={() => setPayrollPeriodFilter('LAST_3_MONTHS')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    payrollPeriodFilter === 'LAST_3_MONTHS'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3 derniers mois
                </button>
                <button
                  type="button"
                  onClick={() => setPayrollPeriodFilter('PREVIOUS_MONTH')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    payrollPeriodFilter === 'PREVIOUS_MONTH'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Le mois d'avant
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">N° Bulletin</th>
                    <th className="px-4 py-3">Période</th>
                    <th className="px-4 py-3">Employé</th>
                    <th className="px-4 py-3">Fonction</th>
                    <th className="px-4 py-3 text-right">Salaire Base</th>
                    <th className="px-4 py-3 text-right">Primes</th>
                    <th className="px-4 py-3 text-right">Retenues</th>
                    <th className="px-4 py-3 text-right">Net Payé</th>
                    <th className="px-4 py-3 text-center">Fiche de Paie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayrollSlips.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Aucun bulletin de salaire correspondant au filtre de période ({payrollPeriodFilter === 'ALL' ? 'Tous' : payrollPeriodFilter === 'THIS_MONTH' ? 'Ce mois-ci' : payrollPeriodFilter === 'PREVIOUS_MONTH' ? 'Le mois d\'avant' : '3 derniers mois'}).
                      </td>
                    </tr>
                  ) : (
                    filteredPayrollSlips.map((slip) => {
                      const empName = slip.employee
                        ? `${slip.employee.lastName.toUpperCase()} ${slip.employee.firstName}`
                        : slip.employeeName || (slip.user ? `${slip.user.lastName.toUpperCase()} ${slip.user.firstName}` : 'Employé');

                      const empPos = slip.employee?.position || slip.employeePosition || slip.user?.role?.displayName || 'Personnel';

                      return (
                        <tr key={slip.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-purple-700 whitespace-nowrap">
                            {slip.slipNumber}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                            {slip.monthLabel}
                          </td>
                          <td className="px-4 py-3 font-extrabold text-slate-900">
                            {empName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {empPos}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(slip.baseSalary)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                            +{formatCurrency(slip.bonusAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-medium">
                            -{formatCurrency(slip.deductionAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-purple-900 whitespace-nowrap">
                            {formatCurrency(slip.netSalary)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPrintedSlip(slip)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimer Fiche</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : DÉPENSE CLINIQUE : PRÉLÈVEMENT MÉDICAMENTS PHARMACIE          */}
      {/* ========================================================================= */}
      {activeTab === 'clinic-medicines' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-indigo-600" />
                  <span>Prélèvements Pharmacie pour l'Usage Clinique ({clinicRequisitions.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Consommation interne : les médicaments prélevés sont automatiquement décomptés du stock de la pharmacie et imputés aux dépenses cliniques.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowRequisitionModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Prélèvement Pharmacie</span>
              </button>
            </div>

            {/* Tableau des réquisitions de la clinique */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">N° Prélèvement</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Service Destinataire</th>
                    <th className="px-4 py-3">Demandé par</th>
                    <th className="px-4 py-3">Motif Clinique</th>
                    <th className="px-4 py-3">Médicaments (Unités)</th>
                    <th className="px-4 py-3 text-right">Valeur Dépense</th>
                    <th className="px-4 py-3 text-center">Bon de Sortie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clinicRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                        Aucun prélèvement pharmacie enregistré pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    clinicRequisitions.map((req) => {
                      let items = [];
                      try {
                        items = JSON.parse(req.itemsJson);
                      } catch (e) {
                        items = [];
                      }

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {req.requisitionNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {formatDateTime(req.date)}
                          </td>
                          <td className="px-4 py-3 font-extrabold text-slate-900">
                            {req.department}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {req.requestedBy}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {items.map((it: any, idx: number) => (
                                <div key={idx} className="text-[11px] text-slate-700">
                                  • {it.medicineName} : <span className="font-bold text-indigo-700">{it.quantity} unités</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-indigo-900 whitespace-nowrap">
                            {formatCurrency(req.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPrintedRequisition({ req, items })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Bon Sortie</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : CABINET DENTISTE (ENTRÉES & DÉPENSES PHARMACIE)                */}
      {/* ========================================================================= */}
      {activeTab === 'dentistry' && (
        <div className="space-y-6">
          {/* Entête du Cabinet Dentiste */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Smile className="w-5 h-5 text-teal-600" />
                  <span>Cabinet Dentiste : Entrées d'Argent &amp; Consommation Pharmacie</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Suivi des actes bucco-dentaires (recettes des consultations/soins) et des prélèvements de médicaments et consommables auprès de la pharmacie.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenDentistRequisition}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-colors cursor-pointer"
                >
                  <Pill className="w-4 h-4" />
                  <span>+ Prélever Médicaments pour le Dentiste</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Dentisterie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Recettes Dentaires */}
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 shadow-2xs space-y-1">
                <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Recettes Actes &amp; Soins</span>
                  <DollarSign className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-2xl font-black text-teal-800">
                  {formatCurrency(totalDentalIncome)}
                </div>
                <div className="text-[11px] text-teal-700 font-medium">
                  {dentalConsultations.length} acte(s) et consultation(s) dentaire(s)
                </div>
              </div>

              {/* Dépenses Pharmacie Dentaire */}
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 shadow-2xs space-y-1">
                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Dépenses Pharmacie Dentiste</span>
                  <Pill className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-indigo-800">
                  {formatCurrency(totalDentalPharmacyExpense)}
                </div>
                <div className="text-[11px] text-indigo-700 font-medium">
                  {totalDentalMedUnits} unité(s) de médicaments prélevée(s)
                </div>
              </div>

              {/* Autres Dépenses Dentisterie */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Autres Frais Dentaires</span>
                  <ArrowDownRight className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-2xl font-black text-slate-700">
                  {formatCurrency(totalDentalDirectExpenses)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Fournitures externes &amp; maintenance
                </div>
              </div>

              {/* Solde Net Cabinet Dentiste */}
              <div
                className={`p-4 rounded-xl border shadow-2xs space-y-1 ${
                  netDentalBalance >= 0
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : 'bg-rose-50/80 border-rose-200'
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                    netDentalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  <span>Marge Nette Dentisterie</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div
                  className={`text-2xl font-black ${
                    netDentalBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {formatCurrency(netDentalBalance)}
                </div>
                <div
                  className={`text-[11px] font-semibold ${
                    netDentalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {netDentalBalance >= 0 ? 'Excédent positif cabinet' : 'Déficit provisoire'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1 : DÉPENSES - Médicaments et Consommables prélevés à la Pharmacie */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-indigo-600" />
                  <span>Dépenses : Médicaments Prélevés à la Pharmacie pour le Dentiste ({dentalRequisitions.length})</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Produits pris dans le stock de la pharmacie : Anesthésiques, seringues, compresses stériles, antalgiques, antiseptiques.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-700">
                Coût total Pharmacie : {formatCurrency(totalDentalPharmacyExpense)}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date Sortie</th>
                    <th className="px-4 py-3">N° Bon Sortie</th>
                    <th className="px-4 py-3">Demandeur</th>
                    <th className="px-4 py-3">Motif de Soin</th>
                    <th className="px-4 py-3">Médicaments / Produits Sortis (Unités)</th>
                    <th className="px-4 py-3 text-right">Montant Imputé</th>
                    <th className="px-4 py-3 text-center">Bon Sortie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dentalRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Aucun médicament n'a encore été prélevé pour le cabinet dentaire.
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={handleOpenDentistRequisition}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Enregistrer le 1er prélèvement pour le dentiste</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dentalRequisitions.map((req) => {
                      let items = [];
                      try {
                        items = JSON.parse(req.itemsJson);
                      } catch (e) {
                        items = [];
                      }

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {formatDateTime(req.date)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-teal-700 whitespace-nowrap">
                            {req.requisitionNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {req.requestedBy}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {items.map((it: any, idx: number) => (
                                <div key={idx} className="text-[11px] text-slate-700 flex items-center justify-between gap-3">
                                  <span>• {it.medicineName}</span>
                                  <span className="font-bold text-teal-700 whitespace-nowrap">{it.quantity} unités</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-rose-600 whitespace-nowrap">
                            - {formatCurrency(req.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPrintedRequisition({ req, items })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Bon Sortie</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2 : ENTRÉES - Soins, Actes & Consultations Dentaires */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  <span>Entrées d'Argent : Consultations, Détartrages, Extractions &amp; Soins Dentaires ({dentalConsultations.length})</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Règlements encaissés au profit du service d'odontologie et stomatologie.
                </p>
              </div>
              <span className="text-xs font-bold text-teal-700">
                Total Encaissé : {formatCurrency(totalDentalIncome)}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Réf. Facture / Consultation</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Acte / Motif Dentaire</th>
                    <th className="px-4 py-3">Praticien</th>
                    <th className="px-4 py-3">Règlement</th>
                    <th className="px-4 py-3 text-right">Montant Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dentalConsultations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Aucun acte dentaire enregistré pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    dentalConsultations.map((c) => {
                      const amount = c.invoice?.totalAmount ? Number(c.invoice.totalAmount) : 0;
                      const method = c.invoice?.payments?.[0]?.paymentMethod || 'CASH';

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {formatDateTime(c.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-teal-700 whitespace-nowrap">
                            {c.invoice?.invoiceNumber || 'CONS-DENT'}
                          </td>
                          <td className="px-4 py-3 font-extrabold text-slate-900">
                            {c.patient ? `${c.patient.lastName?.toUpperCase()} ${c.patient.firstName}` : 'Patient non renseigné'}
                            {c.patient?.patientNumber && (
                              <span className="block text-[10px] font-normal text-slate-400">
                                {c.patient.patientNumber}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {c.reason || 'Soin dentaire conventionné'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {c.doctor?.user ? `Dr. ${c.doctor.user.lastName}` : 'Chirurgien Dentiste'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {method}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-teal-700 whitespace-nowrap">
                            + {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1 : SORTIE DE CAISSE STANDARD (DÉPENSE)                            */}
      {/* ========================================================================= */}
      {showExpenseModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExpenseModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5 text-rose-600" />
                  <span>Enregistrer une Dépense / Sortie d'Argent</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Décaissement immédiat imputé au journal de caisse de la clinique
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitStandardExpense} className="space-y-3 text-xs">
              {/* Opérateur système connecté */}
              <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-[11px] text-slate-300">Enregistré par l'opérateur :</span>
                  <strong className="text-white font-bold">{currentUser.firstName} {currentUser.lastName}</strong>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {currentUser.role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Caisse Débitée *
                  </label>
                  {currentUser.role === 'RECEPTIONIST' ? (
                    <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 text-xs">
                      Petite Caisse (Accueil)
                    </div>
                  ) : (
                    <select
                      value={expenseForm.cashRegister || 'PETITE_CAISSE'}
                      onChange={(e) => setExpenseForm({ ...expenseForm, cashRegister: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                    >
                      <option value="PETITE_CAISSE">Petite Caisse (Accueil)</option>
                      <option value="GRANDE_CAISSE">Grande Caisse (Coffre Direction)</option>
                      <option value="BANQUE">Banque</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie de la Dépense
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="Charges & Fonctionnement">Charges &amp; Fonctionnement (Loyer, Jirama, Internet)</option>
                    <option value="Achats & Fournitures">Achats &amp; Fournitures médicales / consommables</option>
                    <option value="Maintenance & Équipements">Maintenance &amp; Réparation d'équipements</option>
                    <option value="Transport & Déplacements">Transport &amp; Déplacements professionnels</option>
                    <option value="Primes & Avances Personnel">Primes &amp; Avances ponctuelles personnel</option>
                    <option value="Divers & Urgences">Divers &amp; Urgences imprévues</option>
                    <option value="Autre">Autre (Catégorie personnalisée...)</option>
                  </select>
                </div>
              </div>

              {expenseForm.category === 'Autre' && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <label className="block font-bold text-amber-900 mb-1">
                    Précisez la catégorie personnalisée *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseForm.customCategory}
                    onChange={(e) => setExpenseForm({ ...expenseForm, customCategory: e.target.value })}
                    placeholder="Ex: Carburant groupe électrogène, Restauration garde, Frais bancaires..."
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Montant Décaissé (Ar) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="Ex: 50000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-rose-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mode de Règlement
                  </label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="CASH">Espèces (Caisse)</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="MOBILE_MONEY">Mobile Money (MVola, OM)</option>
                    <option value="CREDIT_CARD">Chèque / Carte</option>
                  </select>
                </div>
              </div>

              {/* Simulation dynamique du solde disponible après dépense */}
              {(() => {
                const amt = parseFloat(expenseForm.amount) || 0;
                const isBank = expenseForm.cashRegister === 'BANQUE';
                const isGrande = expenseForm.cashRegister === 'GRANDE_CAISSE';
                const curBalance = isBank
                  ? soldeDisponibleBanque
                  : isGrande
                  ? soldeDisponibleGrandeCaisse
                  : soldeDisponiblePetiteCaisse;
                const registerTitle = isBank
                  ? bankSettings.bankName || 'Banque'
                  : isGrande
                  ? 'Grande Caisse (Comptable / Admin)'
                  : 'Petite Caisse (Accueil)';
                const newBalance = curBalance - amt;
                return (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Solde dispo {registerTitle}
                      </span>
                      <span className="font-extrabold text-slate-900">{formatCurrency(curBalance)}</span>
                    </div>
                    {amt > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-rose-600 uppercase block">
                          Nouveau solde après sortie (-{formatCurrency(amt)})
                        </span>
                        <span className={`font-black ${newBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatCurrency(newBalance)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bénéficiaire (Optionnel — Néant par défaut)
                  </label>
                  <input
                    type="text"
                    value={expenseForm.beneficiary}
                    onChange={(e) => setExpenseForm({ ...expenseForm, beneficiary: e.target.value })}
                    placeholder="Néant (ou Jirama, Fournisseur...)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    N° Référence / Facture (Optionnel — Néant par défaut)
                  </label>
                  <input
                    type="text"
                    value={expenseForm.reference}
                    onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                    placeholder="Néant (ou ex: FAC-2026-089)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif détaillé &amp; Justification *
                </label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Ex: Paiement facture électricité mois d'octobre..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Date de l'opération
                </label>
                <input
                  type="date"
                  value={expenseForm.transactionDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              {/* Pièce jointe justificative (Optionnelle / Facultatif) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-700 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pièce jointe justificative (Facultatif)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">PDF, Image PNG/JPG (max 10 Mo)</span>
                </label>

                {expenseForm.attachmentUrl ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold truncate max-w-[200px]">
                        {expenseForm.attachmentName || 'Justificatif joint'}
                      </span>
                      <a
                        href={expenseForm.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-0.5 text-[11px] shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Aperçu</span>
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpenseForm((prev) => ({ ...prev, attachmentUrl: '', attachmentName: '' }))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Retirer la pièce jointe"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleExpenseFileUpload}
                      disabled={uploadingAttachment}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:border file:border-slate-300 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer border border-slate-200 rounded-lg p-1 bg-white"
                    />
                    {uploadingAttachment && (
                      <div className="absolute right-3 top-2 flex items-center gap-1.5 text-[11px] text-blue-600 font-bold bg-white px-2 py-0.5 rounded shadow-2xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Téléversement...</span>
                      </div>
                    )}
                  </div>
                )}
                {uploadAttachmentError && (
                  <p className="text-[10px] text-rose-600 font-semibold">{uploadAttachmentError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Valider la Sortie de Caisse</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL VERSEMENT : PETITE CAISSE (ACCUEIL) ➔ GRANDE CAISSE (DIRECTION)   */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1b. MODAL TRANSFERTS INTER-COMPTES (Petite Caisse, Grande Caisse, Banque) */}
      {/* ========================================================================= */}
      {showTransferModal && (() => {
        const sourceAvailable =
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? soldeDisponiblePetiteCaisse
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? soldeDisponibleGrandeCaisse
            : soldeDisponibleBanque;

        const destCurrent =
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? soldeDisponibleGrandeCaisse
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? soldeDisponibleBanque
            : soldeDisponibleGrandeCaisse;

        const sourceLabel =
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? 'Petite Caisse (Accueil)'
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? 'Grande Caisse (Coffre Direction)'
            : 'Banque';

        const destLabel =
          transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
            ? 'Grande Caisse (Coffre Direction)'
            : transferType === 'GRANDE_CAISSE_TO_BANQUE'
            ? 'Banque'
            : 'Grande Caisse (Coffre Direction)';

        const amt = parseFloat(transferForm.amount) || 0;
        const newSource = sourceAvailable - amt;
        const newDest = destCurrent + amt;

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTransferModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          >
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <span>
                      {isReceptionist
                        ? 'Versement : Petite Caisse ➔ Grande Caisse'
                        : 'Mouvements & Transferts de Trésorerie'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isReceptionist
                      ? "Transfert certifié des recettes collectées par l'Accueil vers le coffre Administrateur"
                      : 'Gestion des flux entre Petite Caisse, Coffre Direction (Grande Caisse) et Compte Bancaire'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sélecteur de type de transfert (Uniquement pour Administrateur) */}
              {!isReceptionist && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                    Type de Mouvement de Trésorerie :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('PETITE_CAISSE_TO_GRANDE_CAISSE');
                        setTransferForm((prev) => ({
                          ...prev,
                          senderName: 'Accueil & Caisse (Caissière)',
                          receiverName: 'Direction Clinique / Administrateur',
                          notes: 'Versement journalier des recettes de la Petite Caisse vers la Grande Caisse',
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        transferType === 'PETITE_CAISSE_TO_GRANDE_CAISSE'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="text-xs font-black">Petite Caisse ➔ Coffre</div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Versement Accueil</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('GRANDE_CAISSE_TO_BANQUE');
                        setTransferForm((prev) => ({
                          ...prev,
                          senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                          receiverName: 'Banque',
                          notes: "Dépôt bancaire des espèces du coffre Grande Caisse",
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        transferType === 'GRANDE_CAISSE_TO_BANQUE'
                          ? 'bg-blue-50 border-blue-400 text-blue-950 font-black shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="text-xs font-black">Grande Caisse ➔ Banque</div>
                      <div className="text-[10px] text-blue-700 mt-0.5">Dépôt d’espèces</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('BANQUE_TO_GRANDE_CAISSE');
                        setTransferForm((prev) => ({
                          ...prev,
                          senderName: 'Banque',
                          receiverName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
                          notes: 'Retrait bancaire pour approvisionnement du coffre Grande Caisse',
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        transferType === 'BANQUE_TO_GRANDE_CAISSE'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-black shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="text-xs font-black">Banque ➔ Grande Caisse</div>
                      <div className="text-[10px] text-indigo-700 mt-0.5">Retrait coffre</div>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitTransfer} className="space-y-3.5 text-xs">
                {/* Opérateur système connecté */}
                <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-slate-300">Opérateur responsable :</span>
                    <strong className="text-white font-bold">{currentUser.firstName} {currentUser.lastName}</strong>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {currentUser.role}
                  </span>
                </div>

                {/* Synthèse du mouvement */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Origine ➔ Destination</span>
                    <span className="text-xs font-black text-slate-900">
                      {sourceLabel} ➔ {destLabel}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-800">
                    Solde Source : {formatCurrency(sourceAvailable)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Montant du Transfert (Ar) *
                    </label>
                    {sourceAvailable > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTransferForm({
                            ...transferForm,
                            amount: String(sourceAvailable),
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        <span>⚡ Transférer tout le solde ({formatCurrency(sourceAvailable)})</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={sourceAvailable > 0 ? sourceAvailable : undefined}
                    required
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    placeholder={`Max disponible : ${sourceAvailable} Ar`}
                    className={`w-full px-3 py-2 text-base font-black rounded-lg border focus:outline-none focus:ring-2 ${
                      amt > sourceAvailable
                        ? 'border-rose-500 text-rose-700 focus:ring-rose-200 bg-rose-50/50'
                        : 'border-emerald-400 text-emerald-800 focus:ring-emerald-200'
                    }`}
                  />
                  {sourceAvailable <= 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      ℹ️ Le solde disponible sur le compte source ({sourceLabel}) est actuellement de <strong>0 Ar</strong>.
                    </p>
                  )}
                </div>

                {/* Simulation en direct de l'impact sur les deux comptes */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Impact Immédiat sur les Soldes</span>
                    {amt > 0 && (
                      <span className="font-mono text-emerald-700 font-extrabold">
                        Mouvement : {formatCurrency(amt)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Compte Source */}
                    <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-900 uppercase truncate">{sourceLabel}</span>
                        <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          ⬇ Diminue
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Disponible actuel : <strong>{formatCurrency(sourceAvailable)}</strong>
                      </div>
                      <div className="text-xs font-black text-slate-900 pt-1 border-t border-rose-200">
                        Nouveau solde :{' '}
                        <span className={newSource < 0 ? 'text-rose-700 font-extrabold' : 'text-slate-900'}>
                          {formatCurrency(newSource)}
                        </span>
                      </div>
                    </div>

                    {/* Compte Destinataire */}
                    <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-900 uppercase truncate">{destLabel}</span>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          ⬆ Augmente
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Disponible actuel : <strong>{formatCurrency(destCurrent)}</strong>
                      </div>
                      <div className="text-xs font-black text-slate-900 pt-1 border-t border-emerald-200">
                        Nouveau solde :{' '}
                        <span className="text-emerald-800 font-extrabold">
                          {formatCurrency(newDest)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {amt > sourceAvailable && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-800 font-bold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Montant non autorisé : l'opération ({formatCurrency(amt)}) ne peut pas dépasser le solde disponible sur le compte source ({formatCurrency(sourceAvailable)}).
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Donneur d'ordre / Émetteur *
                    </label>
                    <input
                      type="text"
                      required
                      value={transferForm.senderName}
                      onChange={(e) => setTransferForm({ ...transferForm, senderName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Bénéficiaire / Récepteur *
                    </label>
                    <input
                      type="text"
                      required
                      value={transferForm.receiverName}
                      onChange={(e) => setTransferForm({ ...transferForm, receiverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date de l'Opération
                  </label>
                  <input
                    type="date"
                    required
                    value={transferForm.transferDate}
                    onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Motif / Observations (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    placeholder="Ex: Versement recettes de consultations, approvisionnement coffre..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>

                {/* Pièce jointe justificative */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-700 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pièce jointe justificative (Bordereau signé, reçu bancaire ou décharge)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">PDF, JPG/PNG</span>
                  </label>

                  {transferForm.attachmentUrl ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold truncate max-w-[200px]">
                          {transferForm.attachmentName || 'Justificatif joint'}
                        </span>
                        <a
                          href={transferForm.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-0.5 text-[11px] shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Aperçu</span>
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTransferForm((prev) => ({ ...prev, attachmentUrl: '', attachmentName: '' }))}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Retirer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleTransferFileUpload}
                        disabled={uploadingTransferAttachment}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:border file:border-slate-300 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer border border-slate-200 rounded-lg p-1 bg-white"
                      />
                      {uploadingTransferAttachment && (
                        <div className="absolute right-3 top-2 flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold bg-white px-2 py-0.5 rounded shadow-2xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Téléversement...</span>
                        </div>
                      )}
                    </div>
                  )}
                  {uploadTransferError && (
                    <p className="text-[10px] text-rose-600 font-semibold">{uploadTransferError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !transferForm.amount ||
                      amt <= 0 ||
                      amt > sourceAvailable
                    }
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Valider le Mouvement ({formatCurrency(amt)})</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 1c. MODAL MODIFICATION D'UNE TRANSACTION PAR L'ADMINISTRATEUR             */}
      {/* ========================================================================= */}
      {editingTx && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTx(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-blue-600" />
                  <span>Modifier une Transaction de Caisse (Administrateur)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ajustez les montants, libellés, dates ou caisses de rattachement avec mise à jour immédiate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Compte / Caisse Rattachée *
                  </label>
                  <select
                    value={editForm.cashRegister}
                    onChange={(e) => setEditForm({ ...editForm, cashRegister: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold bg-white"
                  >
                    <option value="PETITE_CAISSE">Petite Caisse (Accueil)</option>
                    <option value="GRANDE_CAISSE">Grande Caisse (Coffre Direction)</option>
                    <option value="BANQUE">Banque</option>
                    <option value="CONSULTATION_WEEKEND">Consultations Week-end</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Montant (Ar) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-slate-900 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mode de Paiement
                  </label>
                  <select
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CREDIT_CARD">Chèque / Carte</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Libellé de l'Écriture *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Référence de Pièce
                  </label>
                  <input
                    type="text"
                    value={editForm.reference}
                    onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date de Transaction
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.transactionDate}
                    onChange={(e) => setEditForm({ ...editForm, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Enregistrer les Modifications</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1d. MODAL CONFIGURATION DU COMPTE BANCAIRE (NOM, RIB, SOLDE INITIAL)     */}
      {/* ========================================================================= */}
      {showBankSettingsModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBankSettingsModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  <span>Paramètres du Compte Bancaire</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Modifier le nom de la banque, le RIB et le montant initial / solde d'ouverture
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBankSettingsModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom de la Banque *
                </label>
                <input
                  type="text"
                  required
                  value={bankSettings.bankName}
                  onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                  placeholder="Ex: Banque Principale, Compte Courant..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Numéro de Compte / RIB (Optionnel)
                </label>
                <input
                  type="text"
                  value={bankSettings.bankRib}
                  onChange={(e) => setBankSettings({ ...bankSettings, bankRib: e.target.value })}
                  placeholder="Ex: 00004 00001 12345678901 45"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Titulaire du Compte (Intitulé)
                </label>
                <input
                  type="text"
                  value={bankSettings.bankHolder}
                  onChange={(e) => setBankSettings({ ...bankSettings, bankHolder: e.target.value })}
                  placeholder="Ex: Clinique Betesda SARL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
                <label className="block font-extrabold text-indigo-950 text-xs flex items-center justify-between">
                  <span>★ Solde Initial / Fonds de Départ (Ar) *</span>
                  <span className="text-[10px] text-indigo-700 font-mono font-bold">Réf: BQ-INIT-001</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={bankSettings.initialAmount}
                  onChange={(e) => setBankSettings({ ...bankSettings, initialAmount: e.target.value })}
                  className="w-full px-3 py-2 text-base font-black rounded-lg border border-indigo-300 bg-white text-indigo-900 font-mono focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                />
                <p className="text-[10px] text-indigo-700">
                  Ce montant définit le capital de départ déposé sur le compte bancaire de la clinique (modifiable à tout moment).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBankSettingsModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Enregistrer les Informations</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : ENREGISTRER UNE ENTRÉE CONSULTATION WEEK-END                      */}
      {/* ========================================================================= */}
      {showWeekendIncomeModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWeekendIncomeModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-600" />
                  <span>Enregistrer une Entrée Consultation Week-end</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Alimente directement le budget dédié « Consultations Week-end ».
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeekendIncomeModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitWeekendIncome} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Montant encaissé (Ar) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={weekendIncomeForm.amount}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, amount: e.target.value })}
                    placeholder="Ex: 25000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-emerald-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date (Samedi / Dimanche) *</label>
                  <input
                    type="date"
                    required
                    value={weekendIncomeForm.transactionDate}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Médecin consultant</label>
                  <select
                    value={weekendIncomeForm.doctorName}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, doctorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                  >
                    <option value="">Médecin de garde</option>
                    {doctorOptions.map((doc) => (
                      <option key={doc.id} value={doc.name}>
                        {doc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mode de paiement</label>
                  <select
                    value={weekendIncomeForm.paymentMethod}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CREDIT_CARD">Carte / Chèque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Patient (Optionnel — Néant par défaut)</label>
                  <input
                    type="text"
                    value={weekendIncomeForm.patientName}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, patientName: e.target.value })}
                    placeholder="Néant (ou nom du patient)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Acte / Prestation</label>
                  <input
                    type="text"
                    value={weekendIncomeForm.actName}
                    onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, actName: e.target.value })}
                    placeholder="Consultation Week-end"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarque (Optionnel — Néant par défaut)</label>
                <input
                  type="text"
                  value={weekendIncomeForm.notes}
                  onChange={(e) => setWeekendIncomeForm({ ...weekendIncomeForm, notes: e.target.value })}
                  placeholder="Néant"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWeekendIncomeModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl font-black text-white bg-violet-600 hover:bg-violet-700 shadow-sm cursor-pointer"
                >
                  {loading ? 'Enregistrement...' : 'Ajouter au Budget Week-end'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : PAYER UN MÉDECIN AVEC L'ARGENT DES CONSULTATIONS WEEK-END         */}
      {/* ========================================================================= */}
      {showWeekendDoctorPayModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWeekendDoctorPayModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-emerald-600" />
                  <span>Payer un Médecin — Budget Consultations Week-end</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Décaissement d'honoraires financé exclusivement par la caisse Consultations Week-end.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeekendDoctorPayModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitWeekendDoctorPayment} className="space-y-3 text-xs">
              {/* Simulation solde week-end */}
              {(() => {
                const amt = parseFloat(weekendDoctorPayForm.amount) || 0;
                const remaining = soldeDisponibleWeekend - amt;
                return (
                  <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-violet-700 uppercase block">
                        Budget Consultations Week-end Disponible
                      </span>
                      <span className="text-base font-black text-violet-950 font-mono">
                        {formatCurrency(soldeDisponibleWeekend)}
                      </span>
                    </div>
                    {amt > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Reste après paiement
                        </span>
                        <span className={`text-sm font-black font-mono ${remaining < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Médecin Bénéficiaire *</label>
                <select
                  required
                  value={weekendDoctorPayForm.selectedDoctorOption}
                  onChange={(e) =>
                    setWeekendDoctorPayForm({ ...weekendDoctorPayForm, selectedDoctorOption: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                >
                  <option value="">-- Choisir un médecin --</option>
                  {doctorOptions.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.label}
                    </option>
                  ))}
                  <option value="CUSTOM">Autre médecin / Médecin remplaçant...</option>
                </select>
              </div>

              {weekendDoctorPayForm.selectedDoctorOption === 'CUSTOM' && (
                <div>
                  <label className="block font-bold text-violet-800 mb-1">Nom complet du médecin *</label>
                  <input
                    type="text"
                    required
                    value={weekendDoctorPayForm.customDoctorName}
                    onChange={(e) =>
                      setWeekendDoctorPayForm({ ...weekendDoctorPayForm, customDoctorName: e.target.value })
                    }
                    placeholder="Ex: Dr. Rakotomalala Nirina"
                    className="w-full px-3 py-2 rounded-lg border border-violet-300 bg-violet-50/40 font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Montant à payer (Ar) *</label>
                  <input
                    type="number"
                    min="1"
                    max={soldeDisponibleWeekend}
                    required
                    value={weekendDoctorPayForm.amount}
                    onChange={(e) =>
                      setWeekendDoctorPayForm({ ...weekendDoctorPayForm, amount: e.target.value })
                    }
                    placeholder={`Max ${soldeDisponibleWeekend}`}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-rose-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date du paiement *</label>
                  <input
                    type="date"
                    required
                    value={weekendDoctorPayForm.transactionDate}
                    onChange={(e) =>
                      setWeekendDoctorPayForm({ ...weekendDoctorPayForm, transactionDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Week-end concerné</label>
                  <input
                    type="text"
                    value={weekendDoctorPayForm.weekendPeriod}
                    onChange={(e) =>
                      setWeekendDoctorPayForm({ ...weekendDoctorPayForm, weekendPeriod: e.target.value })
                    }
                    placeholder="Ex: Week-end du 21-22 Nov 2026"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mode de règlement</label>
                  <select
                    value={weekendDoctorPayForm.paymentMethod}
                    onChange={(e) =>
                      setWeekendDoctorPayForm({ ...weekendDoctorPayForm, paymentMethod: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money (MVola / OM)</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CREDIT_CARD">Chèque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarque (Optionnel — Néant par défaut)</label>
                <input
                  type="text"
                  value={weekendDoctorPayForm.notes}
                  onChange={(e) =>
                    setWeekendDoctorPayForm({ ...weekendDoctorPayForm, notes: e.target.value })
                  }
                  placeholder="Néant (ou nb de consultations, garde samedi/dimanche...)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWeekendDoctorPayModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || (parseFloat(weekendDoctorPayForm.amount) || 0) > soldeDisponibleWeekend}
                  className="px-5 py-2.5 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {loading ? 'Traitement...' : 'Valider le Paiement Médecin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPRESSION A4 : REÇU HONORAIRES MÉDECIN (BUDGET WEEK-END)           */}
      {/* ========================================================================= */}
      {printedWeekendPayment && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintedWeekendPayment(null);
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-start p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print-modal-overlay"
        >
          <div className="no-print flex items-center justify-between w-full max-w-2xl my-3 p-3 bg-slate-900 rounded-xl text-white shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Stethoscope className="w-4 h-4 text-violet-400" />
              <span>Reçu Honoraires Médecin Week-end • Page A4</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handlePrintCleanA4(`Recu_Medecin_Weekend_${printedWeekendPayment.reference || 'PAY'}_Betesda`)
                }
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer / Télécharger PDF (A4)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintedWeekendPayment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full max-w-2xl bg-white rounded-2xl p-8 shadow-2xl border border-slate-200 print-section space-y-6 text-slate-900">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {clinic?.name || 'CLINIQUE BETESDA'}
                </h2>
                <p className="text-xs text-slate-500">{clinic?.address || 'Antananarivo, Madagascar'}</p>
                <p className="text-xs text-slate-500">Tél : {clinic?.phone || 'Néant'}</p>
              </div>
              <div className="text-right">
                <div className="inline-block px-3 py-1 rounded-lg bg-violet-100 text-violet-900 font-black text-xs uppercase">
                  Reçu Honoraires Médecin Week-end
                </div>
                <div className="font-mono font-bold text-xs mt-1">
                  Réf : {printedWeekendPayment.reference || 'PAY-MED-WE'}
                </div>
                <div className="text-xs text-slate-500">
                  Date : {formatDate(printedWeekendPayment.transactionDate)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-violet-50/60 border border-violet-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Source des fonds :</span>
                <strong className="text-violet-900">Budget Consultations Week-end (Samedi &amp; Dimanche)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Mode de règlement :</span>
                <strong>{printedWeekendPayment.paymentMethod}</strong>
              </div>
              <div className="pt-2 border-t border-violet-200">
                <span className="text-slate-600 font-semibold block">Détails / Bénéficiaire :</span>
                <p className="font-bold text-slate-900 mt-0.5">{printedWeekendPayment.description}</p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Montant Net Versé au Médecin
              </span>
              <span className="text-2xl font-black font-mono text-emerald-300">
                {formatCurrency(printedWeekendPayment.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
              <div className="border border-slate-300 rounded-xl p-4 h-28 flex flex-col justify-between">
                <div className="font-bold text-slate-700">Signature Comptabilité / Direction</div>
                <div className="text-[11px] text-slate-400">
                  {printedWeekendPayment.performedBy
                    ? `${printedWeekendPayment.performedBy.firstName} ${printedWeekendPayment.performedBy.lastName}`
                    : `${currentUser.firstName} ${currentUser.lastName}`}
                </div>
              </div>
              <div className="border border-slate-300 rounded-xl p-4 h-28 flex flex-col justify-between">
                <div className="font-bold text-slate-700">Signature du Médecin Bénéficiaire</div>
                <div className="text-[11px] text-slate-400">Lu et approuvé, bon pour acquit</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPRESSION A4 : BORDEREAU DE TRANSFERT INTER-COMPTES                */}
      {/* ========================================================================= */}
      {printedTransfer && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintedTransfer(null);
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-start p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print-modal-overlay"
        >
          <div className="no-print flex items-center justify-between w-full max-w-2xl my-3 p-3 bg-slate-900 rounded-xl text-white shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>{printedTransfer.title || 'Bordereau Officiel de Caisse'} • Page A4</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintCleanA4(`Bordereau_${printedTransfer.ref}_Clinique_Betesda`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Télécharger PDF A4</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintedTransfer(null)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>

          <div
            id="print-a4-transfer"
            className="w-full max-w-2xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 border border-slate-300 space-y-6"
          >
            {/* Header Clinique */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  {clinic?.name || 'CLINIQUE BETESDA'}
                </h2>
                <p className="text-xs text-slate-600 italic">
                  {clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo'} • Tél : {clinic?.phone || '034 51 365 45'}
                </p>
                <p className="text-[10px] font-bold text-slate-600">
                  {clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027'}
                </p>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                  {printedTransfer.ref.startsWith('DEP-BQ')
                    ? 'DÉPÔT BANCAIRE'
                    : printedTransfer.ref.startsWith('RET-BQ')
                    ? 'APPROVISIONNEMENT BANQUE'
                    : 'BORDEREAU DE VERSEMENT'}
                </span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-2">
                  Réf : {printedTransfer.ref}
                </div>
                <div className="text-[11px] text-slate-500">
                  Date : {formatDate(printedTransfer.date)}
                </div>
              </div>
            </div>

            {/* Corps du Bordereau */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Compte / Caisse Émettrice</span>
                  <span className="text-sm font-extrabold text-slate-900 uppercase">{printedTransfer.sourceLabel || 'Petite Caisse (Accueil)'}</span>
                  <span className="text-xs text-slate-600 block mt-0.5">Donneur d'ordre : <strong>{printedTransfer.senderName}</strong></span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Compte / Caisse Bénéficiaire</span>
                  <span className="text-sm font-extrabold text-slate-900 uppercase">{printedTransfer.destLabel || 'Grande Caisse (Direction)'}</span>
                  <span className="text-xs text-slate-600 block mt-0.5">Réceptionné par : <strong>{printedTransfer.receiverName}</strong></span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-600">
                <span className="font-semibold">Opérateur certifié ayant validé l'opération :</span>
                <strong className="text-slate-900 font-extrabold">{currentUser.firstName} {currentUser.lastName} ({currentUser.role})</strong>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Montant Total du Mouvement</span>
                  <span className="text-xs text-slate-600 italic">Fonds certifiés et enregistrés dans la comptabilité clinique</span>
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {formatCurrency(printedTransfer.amount)}
                </div>
              </div>

              {printedTransfer.notes && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">Observations : </span>
                  <span className="text-slate-600">{printedTransfer.notes}</span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div className="p-4 border border-slate-300 rounded-xl min-h-[110px] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs uppercase text-slate-700">Signature de l'Émetteur</div>
                  <div className="text-[11px] text-slate-500">({printedTransfer.senderName})</div>
                </div>
                <div className="border-b border-dashed border-slate-400 mt-8"></div>
                <div className="text-[10px] text-slate-400 text-center">{printedTransfer.senderName}</div>
              </div>

              <div className="p-4 border border-slate-300 rounded-xl min-h-[110px] flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs uppercase text-slate-700">Signature du Récepteur</div>
                  <div className="text-[11px] text-slate-500">({printedTransfer.receiverName})</div>
                </div>
                <div className="border-b border-dashed border-slate-400 mt-8"></div>
                <div className="text-[10px] text-slate-400 text-center">{printedTransfer.receiverName}</div>
              </div>
            </div>

            {/* Mention de clôture */}
            <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 pt-3">
              Ce document officiel certifie le transfert de trésorerie entre les comptes de la Clinique Betesda avec traçabilité intégrale.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : FICHE DE PAIE & DÉCAISSEMENT DU SALAIRE                       */}
      {/* ========================================================================= */}
      {showPayrollModal && selectedStaff && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPayrollModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <span>Émettre la Fiche de Paie &amp; Décaisser le Salaire</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Employé : <strong className="text-slate-800">{selectedStaff.fullName}</strong> ({selectedStaff.position})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayrollModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayroll} className="space-y-3 text-xs">
              {/* Opérateur système connecté */}
              <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-[11px] text-slate-300">Décaissé par l'Administrateur :</span>
                  <strong className="text-white font-bold">{currentUser.firstName} {currentUser.lastName}</strong>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Grande Caisse
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Période / Mois</label>
                  <input
                    type="text"
                    value={payrollForm.monthLabel}
                    onChange={(e) => setPayrollForm({ ...payrollForm, monthLabel: e.target.value })}
                    required
                    placeholder="Ex: Octobre 2026"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mode de règlement</label>
                  <select
                    value={payrollForm.paymentMethod}
                    onChange={(e) => setPayrollForm({ ...payrollForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CASH">Espèces (Caisse)</option>
                    <option value="MOBILE_MONEY">Mobile Money (MVola, OM)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Salaire de Base</label>
                  <input
                    type="number"
                    min="0"
                    value={payrollForm.baseSalary}
                    onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-700 mb-1">Primes / Indemnités (+)</label>
                  <input
                    type="number"
                    min="0"
                    value={payrollForm.bonusAmount}
                    onChange={(e) => setPayrollForm({ ...payrollForm, bonusAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-rose-700 mb-1">Retenues / Avances (-)</label>
                  <input
                    type="number"
                    min="0"
                    value={payrollForm.deductionAmount}
                    onChange={(e) => setPayrollForm({ ...payrollForm, deductionAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-rose-700"
                  />
                </div>
              </div>

              {/* Box Salaire Net & Impact Grande Caisse */}
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-purple-700 uppercase">Salaire Net à Décaisser</div>
                  <div className="text-xl font-black text-purple-900">{formatCurrency(payrollNet)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-purple-700 font-bold uppercase block">
                    Décaissé de la Grande Caisse
                  </span>
                  <span className="text-xs font-black text-purple-950">
                    Solde restant : {formatCurrency(soldeDisponibleGrandeCaisse - payrollNet)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarques &amp; Mentions</label>
                <input
                  type="text"
                  value={payrollForm.notes}
                  onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                  placeholder="Ex: Paiement fin de mois..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || payrollNet <= 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Valider &amp; Générer la Fiche de Paie</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : DÉPENSE CLINIQUE : PRÉLÈVEMENT MÉDICAMENTS PHARMACIE          */}
      {/* ========================================================================= */}
      {showRequisitionModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRequisitionModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-indigo-600" />
                  <span>Dépense Clinique : Prélèvement de Médicaments dans la Pharmacie</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sortie physique en unités depuis le stock de la pharmacie pour l'usage interne de la clinique.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRequisitionModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequisition} className="space-y-4 text-xs">
              {/* Opérateur système connecté */}
              <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-[11px] text-slate-300">Validé par :</span>
                  <strong className="text-white font-bold">{currentUser.firstName} {currentUser.lastName}</strong>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {currentUser.role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Service Destinataire de la Clinique
                  </label>
                  <select
                    value={requisitionDept}
                    onChange={(e) => setRequisitionDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-800"
                  >
                    <option value="Dentisterie">Cabinet Dentiste (Soins dentaires, anesthésiques, compresses, etc.)</option>
                    <option value="Infirmerie & Soins">Infirmerie &amp; Soins internes</option>
                    <option value="Urgences Médicales">Armoire d’Urgences Médicales</option>
                    <option value="Hospitalisation">Chambres d’Hospitalisation</option>
                    <option value="Bloc & Pansements">Salle de Pansement &amp; Soins</option>
                    <option value="Trousse de Secours">Trousse de Premiers Secours</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Demandé / Réceptionné par
                  </label>
                  <input
                    type="text"
                    value={requisitionRequester}
                    onChange={(e) => setRequisitionRequester(e.target.value)}
                    required
                    placeholder="Ex: Sarah Rasoa (Infirmière)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motif du Prélèvement Interne
                </label>
                <input
                  type="text"
                  value={requisitionReason}
                  onChange={(e) => setRequisitionReason(e.target.value)}
                  required
                  placeholder="Ex: Dotation hebdomadaire pour soins infirmiers..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              {/* Sélection des médicaments à prélever */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Médicaments à prélever dans la pharmacie (en Unités)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {requisitionCart.length} produit(s) sélectionné(s)
                  </span>
                </div>

                {/* Sélecteur de médicament avec recherche intégrée */}
                <MedicineSearchSelect
                  medicines={medicines.map((m) => ({
                    id: m.id,
                    name: m.name,
                    dosage: m.dosage,
                    form: m.form,
                    currentStock: m.currentStock,
                    sellingPrice: m.purchasePrice || m.sellingPrice,
                  }))}
                  selectedId=""
                  onSelect={(id) => handleAddMedToRequisition(id)}
                  placeholder="Rechercher un médicament à prélever (nom, dosage, DCI)..."
                />

                {/* Panier des médicaments prélevés */}
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {requisitionCart.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Aucun médicament ajouté dans la liste de prélèvement.
                    </div>
                  ) : (
                    requisitionCart.map((it) => (
                      <div
                        key={it.medicineId}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 truncate">{it.medicineName}</div>
                          <div className="text-[10px] text-slate-400">
                            {it.dosage} • Stock dispo : {it.availableStock} unités
                          </div>
                        </div>

                        {/* Contrôle des unités */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateRequisitionQty(it.medicineId, -1)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black text-xs min-w-[24px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRequisitionQty(it.medicineId, 1)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right font-black text-slate-900 min-w-[70px]">
                          {formatCurrency(it.unitCost * it.quantity)}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRequisitionItem(it.medicineId)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total Dépense Clinique */}
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-indigo-700 uppercase">Valeur Totale Prélèvement Clinique</div>
                  <div className="text-xl font-black text-indigo-900">{formatCurrency(requisitionTotal)}</div>
                </div>
                <span className="text-[11px] text-indigo-700 font-semibold">
                  Déduit des stocks de la pharmacie &amp; imputé aux dépenses
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequisitionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || requisitionCart.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Valider le Prélèvement ({formatCurrency(requisitionTotal)})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPRESSION : BULLETIN DE PAIE OFFICIEL                            */}
      {/* ========================================================================= */}
      {printedSlip && (() => {
        const empName = printedSlip.employee
          ? `${printedSlip.employee.lastName.toUpperCase()} ${printedSlip.employee.firstName}`
          : printedSlip.employeeName || (printedSlip.user ? `${printedSlip.user.lastName.toUpperCase()} ${printedSlip.user.firstName}` : 'Employé');

        const empPos = printedSlip.employee?.position || printedSlip.employeePosition || printedSlip.user?.role?.displayName || 'Salarié';

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setPrintedSlip(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer print-modal-overlay"
          >
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 print-modal-card">
              <div className="no-print flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                  Bulletin de Paie • Clinique Betesda
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handlePrintCleanA4(
                        `Bulletin_Paie_${empName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${(
                          printedSlip.monthLabel || 'Mois'
                        ).replace(/[^a-zA-Z0-9_-]/g, '_')}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-purple-600 text-white hover:bg-purple-700 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimer / Télécharger PDF A4</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintedSlip(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fiche de paie imprimable */}
              <div
                id="print-a4-payroll"
                className="p-6 border-2 border-slate-900 rounded-xl space-y-4 bg-white text-slate-900"
              >
                {/* Header Clinique */}
                <div className="text-center border-b border-slate-900 pb-3">
                  <div className="font-black text-lg uppercase tracking-wider">{clinic?.name || 'CLINIQUE BETESDA'}</div>
                  <div className="text-xs text-slate-600 italic">{clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente'}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo'} • Tél : {clinic?.phone || '034 51 365 45'}
                  </div>
                  <div className="text-[9.5px] font-bold text-slate-600">{clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027'}</div>
                </div>

                {/* Titre Bulletin */}
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <div className="font-black uppercase text-sm">BULLETIN DE SALAIRE</div>
                    <div className="text-slate-600">Période : <strong className="text-slate-900">{printedSlip.monthLabel}</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">{printedSlip.slipNumber}</div>
                    <div className="text-slate-500 text-[10px]">Date : {formatDate(printedSlip.paymentDate)}</div>
                  </div>
                </div>

                {/* Info Salarié */}
                <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nom &amp; Prénom :</span>
                    <span className="font-extrabold">{empName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Poste / Fonction :</span>
                    <span className="font-bold">{empPos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mode de paiement :</span>
                    <span className="font-bold">{printedSlip.paymentMethod === 'CASH' ? 'Espèces (Caisse)' : printedSlip.paymentMethod}</span>
                  </div>
                </div>

                {/* Lignes de rémunération */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 text-slate-600">
                      <th className="py-1 text-left">Désignation</th>
                      <th className="py-1 text-right">Montant (Ar)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1.5 font-bold">Salaire de Base</td>
                      <td className="py-1.5 text-right font-bold">{formatCurrency(printedSlip.baseSalary)}</td>
                    </tr>
                    {printedSlip.bonusAmount > 0 && (
                      <tr>
                        <td className="py-1.5 text-emerald-700">Primes &amp; Indemnités diverses</td>
                        <td className="py-1.5 text-right text-emerald-700 font-bold">+{formatCurrency(printedSlip.bonusAmount)}</td>
                      </tr>
                    )}
                    {printedSlip.deductionAmount > 0 && (
                      <tr>
                        <td className="py-1.5 text-rose-700">Retenues &amp; Avances sur salaire</td>
                        <td className="py-1.5 text-right text-rose-700 font-bold">-{formatCurrency(printedSlip.deductionAmount)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Net à payer */}
                <div className="p-3 bg-slate-100 border-2 border-slate-900 rounded-lg flex justify-between items-center text-sm font-black">
                  <span>NET PAYÉ AU SALARIÉ :</span>
                  <span className="text-base">{formatCurrency(printedSlip.netSalary)}</span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-300 text-center text-xs">
                  <div>
                    <div className="font-bold mb-8">Pour la Clinique Betesda</div>
                    <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Cachet &amp; Signature Direction</div>
                  </div>
                  <div>
                    <div className="font-bold mb-8">Le Salarié (Reçu pour solde)</div>
                    <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL : PROFIL INDIVIDUEL DE L'EMPLOYÉ & HISTORIQUE DES BULLETINS         */}
      {/* ========================================================================= */}
      {selectedEmployeeProfile && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEmployeeProfile(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-purple-50/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
                  {selectedEmployeeProfile.firstName[0]}
                  {selectedEmployeeProfile.lastName[0]}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {selectedEmployeeProfile.fullName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                      {selectedEmployeeProfile.position}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Employé Actif
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployeeProfile(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenu profil défilable */}
            <div className="p-5 space-y-5 overflow-y-auto text-xs">
              {/* Grille informations personnelles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Téléphone</div>
                  <div className="font-extrabold text-slate-800 text-sm">
                    {selectedEmployeeProfile.phone}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 space-y-1">
                  <div className="text-[10px] font-bold text-purple-600 uppercase">Salaire Contractuel Base</div>
                  <div className="font-black text-purple-900 text-sm">
                    {formatCurrency(selectedEmployeeProfile.baseSalary)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Date d'embauche / Enreg.</div>
                  <div className="font-extrabold text-slate-800 text-sm">
                    {selectedEmployeeProfile.createdAt
                      ? formatDate(selectedEmployeeProfile.createdAt)
                      : 'Actif'}
                  </div>
                </div>
              </div>

              {/* Statistiques de paie de cet employé */}
              {(() => {
                const empSlips = payrollSlips.filter(
                  (p) =>
                    (p.employeeId && p.employeeId === selectedEmployeeProfile.id) ||
                    (p.employee?.id && p.employee.id === selectedEmployeeProfile.id) ||
                    (p.userId && p.userId === selectedEmployeeProfile.id) ||
                    (p.user?.id && p.user.id === selectedEmployeeProfile.id)
                );
                const totalPaidToEmp = empSlips.reduce((sum, s) => sum + s.netSalary, 0);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>Historique des Bulletins de Salaire ({empSlips.length})</span>
                      </div>
                      <span className="font-black text-purple-700 text-xs">
                        Cumul perçu : {formatCurrency(totalPaidToEmp)}
                      </span>
                    </div>

                    {empSlips.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Aucun bulletin de salaire émis pour {selectedEmployeeProfile.fullName} pour le moment.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">N° Bulletin</th>
                              <th className="px-3 py-2">Période</th>
                              <th className="px-3 py-2 text-right">Salaire Base</th>
                              <th className="px-3 py-2 text-right">Primes</th>
                              <th className="px-3 py-2 text-right">Retenues</th>
                              <th className="px-3 py-2 text-right">Net Payé</th>
                              <th className="px-3 py-2 text-center">Fiche</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {empSlips.map((slip) => (
                              <tr key={slip.id} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 font-mono font-bold text-purple-700 whitespace-nowrap">
                                  {slip.slipNumber}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                                  {slip.monthLabel}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {formatCurrency(slip.baseSalary)}
                                </td>
                                <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                                  +{formatCurrency(slip.bonusAmount)}
                                </td>
                                <td className="px-3 py-2 text-right text-rose-600 font-bold">
                                  -{formatCurrency(slip.deductionAmount)}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-purple-900 whitespace-nowrap">
                                  {formatCurrency(slip.netSalary)}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPrintedSlip(slip);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>Imprimer</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SECTION : ACHATS MÉDICAMENTS AU PRIX D'ACHAT (PERSONNEL CLINIQUE) */}
              {(() => {
                const empMedSales = (staffMedicineSales || []).filter(
                  (s: any) =>
                    (s.employeeId && s.employeeId === selectedEmployeeProfile.id) ||
                    (s.customerName &&
                      s.customerName.toLowerCase().includes(selectedEmployeeProfile.lastName.toLowerCase()))
                );
                const totalMedAmount = empMedSales.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);

                return (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                        <Pill className="w-4 h-4 text-blue-600" />
                        <span>Achats Médicaments au Prix d'Achat ({empMedSales.length})</span>
                      </div>
                      <span className="font-black text-blue-700 text-xs">
                        Total acheté : {formatCurrency(totalMedAmount)}
                      </span>
                    </div>

                    {empMedSales.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Aucun achat de médicaments enregistré pour {selectedEmployeeProfile.fullName}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">N° Vente</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Médicaments</th>
                              <th className="px-3 py-2 text-right">Montant (Prix d'achat)</th>
                              <th className="px-3 py-2 text-center">Statut</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {empMedSales.map((sale: any) => (
                              <tr key={sale.id} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                                  {sale.saleNumber}
                                </td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                  {formatDate(sale.createdAt)}
                                </td>
                                <td className="px-3 py-2 text-slate-800">
                                  {sale.items
                                    ?.map((it: any) => `${it.medicineName || it.medicine?.name} (x${it.quantity})`)
                                    .join(', ') || '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                  {formatCurrency(sale.total)}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {sale.status === 'PAID' ? 'Réglé' : sale.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Pied modal avec actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedEmployeeProfile(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 font-semibold text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href="/pharmacy/sales"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>+ Achat Médicament (Prix d'achat)</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    const emp = selectedEmployeeProfile;
                    setSelectedEmployeeProfile(null);
                    handleOpenPayrollForEmployee(emp);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Émettre une Fiche de Paie pour {selectedEmployeeProfile.firstName}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPRESSION A4 : BON DE PRÉLÈVEMENT & SORTIE PHARMACIE INTERNE       */}
      {/* ========================================================================= */}
      {printedRequisition && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintedRequisition(null);
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-start p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print-modal-overlay"
        >
          {/* Barre d'actions supérieure (Masquée à l'impression) */}
          <div className="no-print flex items-center justify-between w-full max-w-3xl my-3 p-3 bg-slate-900 rounded-xl text-white shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Aperçu de la Page A4 • Bon de Sortie &amp; Livraison Pharmacie</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintCleanA4(`Bon_Livraison_Pharmacie_${printedRequisition.req.requisitionNumber}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Télécharger PDF A4</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintedRequisition(null)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>

          {/* DOCUMENT A4 OFFICIEL PROPREMENT DESIGNÉ */}
          <div
            id="print-a4-requisition"
            className="w-full max-w-3xl bg-white shadow-2xl p-8 sm:p-12 text-slate-900 text-xs border border-slate-300 font-sans space-y-6 rounded-xl my-auto"
          >
            {/* En-tête officiel de la clinique */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-wider uppercase">
                  {clinic?.name || 'CLINIQUE BETESDA'}
                </h2>
                <p className="text-xs text-indigo-700 font-semibold italic mt-0.5">
                  {clinic?.slogan || 'Soins, Bienveillance & Gestion Intelligente'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {clinic?.address || 'Lot IVG 35 Rue Pasteur, Antananarivo'} • Tél : {clinic?.phone || '034 51 365 45'}
                </p>
                <p className="text-[9.5px] font-bold text-slate-600">
                  {clinic?.taxId || 'NIF: 3 005 710 430 - N° Stat: 86201 11 2021 0 08027'}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                  Usage Interne
                </span>
                <div className="mt-2 text-xs font-mono font-bold text-slate-800">
                  N° {printedRequisition.req.requisitionNumber}
                </div>
                <div className="text-[10px] text-slate-500">
                  Date : {formatDateTime(printedRequisition.req.date)}
                </div>
              </div>
            </div>

            {/* Titre central du document */}
            <div className="text-center py-2 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                BON DE LIVRAISON &amp; SORTIE PHARMACIE • DÉPENSE CLINIQUE
              </h3>
            </div>

            {/* Informations destinataire & justification */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/60 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 font-semibold">Service Destinataire :</span>{' '}
                  <strong className="text-slate-900 font-extrabold">{printedRequisition.req.department}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Demandé / Réceptionné par :</span>{' '}
                  <strong className="text-slate-900">{printedRequisition.req.requestedBy}</strong>
                </div>
              </div>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 font-semibold">Motif du Prélèvement :</span>{' '}
                  <span className="text-slate-800 font-medium italic">{printedRequisition.req.reason}</span>
                </div>
                {printedRequisition.req.notes && (
                  <div>
                    <span className="text-slate-500 font-semibold">Notes :</span>{' '}
                    <span className="text-slate-700">{printedRequisition.req.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tableau détaillé des médicaments prélevés */}
            <div className="space-y-1">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 text-left">N°</th>
                    <th className="py-2.5 px-3 text-left">Désignation du Médicament</th>
                    <th className="py-2.5 px-3 text-center">Quantité Décaissée</th>
                    <th className="py-2.5 px-3 text-right">Coût Unitaire (Ar)</th>
                    <th className="py-2.5 px-3 text-right">Total Coût (Ar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printedRequisition.items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{it.medicineName}</td>
                      <td className="py-2.5 px-3 text-center font-black text-indigo-700 font-mono">
                        {it.quantity} unités
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(it.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                        {formatCurrency(it.unitCost * it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Barre de Totalisation */}
              <div className="p-3 bg-slate-100 border-2 border-slate-900 rounded-lg flex justify-between items-center font-black text-sm mt-3">
                <span className="uppercase tracking-wide text-xs">VALEUR TOTALE DÉPENSE PHARMACIE :</span>
                <span className="text-base text-slate-900 font-mono">{formatCurrency(printedRequisition.req.totalCost)}</span>
              </div>
            </div>

            {/* Signatures officielles */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="font-extrabold text-slate-900 mb-12">Le Responsable Pharmacie (Délivré par)</div>
                <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Cachet &amp; Signature</div>
              </div>
              <div>
                <div className="font-extrabold text-slate-900 mb-12">Le Demandeur Clinique (Réceptionné par)</div>
                <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Signature</div>
              </div>
            </div>

            {/* Pied de page du document */}
            <div className="text-center pt-3 border-t border-slate-100 text-[9.5px] text-slate-400">
              Clinique Betesda • Document officiel de sortie de stock interne • Traçabilité médicale certifiée
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPRESSION : REÇU DE SORTIE DE CAISSE (DÉPENSE STANDARD)           */}
      {/* ========================================================================= */}
      {printedExpense && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintedExpense(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer print-modal-overlay"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 print-modal-card">
            <div className="no-print flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                Reçu de Décaissement Caisse
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintCleanA4(`Recu_Sortie_Caisse_${printedExpense.reference || 'DIRECT'}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer / Télécharger PDF A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintedExpense(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div id="print-a4-expense" className="p-4 border-2 border-slate-900 rounded-xl space-y-3 bg-white text-slate-900 text-xs">
              <div className="text-center border-b border-slate-900 pb-2">
                <div className="font-black text-base uppercase">{clinic?.name || 'CLINIQUE BETESDA'}</div>
                <div className="text-xs font-black text-rose-700 uppercase">BON DE SORTIE DE CAISSE</div>
              </div>

              <div className="flex justify-between">
                <span>Réf. Décaissement :</span>
                <span className="font-mono font-bold">{printedExpense.reference || 'DEP-DIRECT'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date &amp; Heure :</span>
                <span>{formatDateTime(printedExpense.transactionDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Catégorie :</span>
                <span className="font-bold">{printedExpense.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode de paiement :</span>
                <span className="font-bold">{printedExpense.paymentMethod}</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Motif / Description :</span>
                <span className="font-bold text-xs">{printedExpense.description}</span>
              </div>

              {printedExpense.attachmentUrl && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-blue-900">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-slate-500">Pièce Jointe :</span>
                    <strong className="font-bold truncate max-w-[200px]">
                      {printedExpense.attachmentName || 'Justificatif joint'}
                    </strong>
                  </div>
                  <a
                    href={printedExpense.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Voir</span>
                  </a>
                </div>
              )}

              <div className="p-2.5 bg-rose-50 border-2 border-rose-600 rounded-lg flex justify-between font-black text-sm text-rose-900">
                <span>MONTANT SORTI :</span>
                <span>- {formatCurrency(printedExpense.amount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-300 text-center text-[10px]">
                <div>
                  <div className="font-bold mb-6">Autorisé par (Direction)</div>
                  <div className="border-t border-slate-400 pt-1">Signature</div>
                </div>
                <div>
                  <div className="font-bold mb-6">Reçu par (Bénéficiaire)</div>
                  <div className="border-t border-slate-400 pt-1">Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* FEUILLE DE STYLE IMPRESSION A4 PARFAITE POUR TOUS LES DOCUMENTS */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          /* 1. Masquage complet de l'interface et des éléments d'écran */
          body * {
            visibility: hidden;
          }
          .no-print,
          aside,
          header,
          nav,
          [role="navigation"],
          .sidebar,
          .topbar,
          button,
          input,
          select {
            display: none !important;
          }

          /* 2. Neutraliser le fond sombre, le blur et l'overflow du modal overlay */
          .print-modal-overlay,
          .print-modal-card {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* 3. Rendre visible le document A4 sélectionné */
          #print-a4-transfer,
          #print-a4-transfer *,
          #print-a4-requisition,
          #print-a4-requisition *,
          #print-a4-payroll,
          #print-a4-payroll *,
          #print-a4-expense,
          #print-a4-expense * {
            visibility: visible !important;
          }

          /* 4. Formatage strict A4 blanc pur haute définition */
          #print-a4-transfer,
          #print-a4-requisition,
          #print-a4-payroll,
          #print-a4-expense {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 198mm !important;
            margin: 0 auto !important;
            padding: 8mm 12mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
