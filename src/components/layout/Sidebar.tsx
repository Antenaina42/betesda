'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  UserCheck,
  FileText,
  Pill,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  PlusCircle,
  DollarSign,
  Receipt,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  ShoppingBag,
  PackagePlus,
  ArrowDownRight,
  ArrowRightLeft,
  Wallet,
  Landmark,
  Calendar,
  Smile,
} from 'lucide-react';
import { AuthUser } from '@/types';
import { getRoleBadgeLabel } from '@/lib/permissions';

interface SidebarProps {
  user: AuthUser;
  clinicName?: string;
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

export default function Sidebar({ user, clinicName, isOpen, onToggle, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearchString = searchParams ? searchParams.toString() : '';
  const roleInfo = getRoleBadgeLabel(user.role);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    patients: pathname.startsWith('/patients'),
    consultations: pathname.startsWith('/consultations'),
    pharmacy: pathname.startsWith('/pharmacy'),
    invoices: pathname.startsWith('/invoices') || pathname.startsWith('/payments'),
  });

  const toggleSubmenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Construction dynamique des sections du menu selon le rôle de l'utilisateur
  const menuSections = useMemo(() => {
    switch (user.role) {
      // 1. COMPTE ACCUEIL / RÉCEPTION : Tableau de bord, Commande de paiement, Caisse consultation, Actes & Hébergements, Dépenses Petite Caisse, Bons de sortie
      case 'RECEPTIONIST':
        return [
          {
            title: 'ESPACE ACCUEIL & CAISSE',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
              {
                label: 'Commande de paiement',
                href: '/pharmacy/sales',
                icon: ShoppingBag,
              },
              {
                label: 'Caisse consultation',
                href: '/consultations/caisse',
                icon: Stethoscope,
              },
              {
                label: 'Actes & Hébergements',
                href: '/pharmacy/consumables',
                icon: ClipboardCheck,
              },
              {
                label: 'Dépenses Petite Caisse',
                href: '/expenses?tab=expenses&register=PETITE_CAISSE',
                icon: ArrowDownRight,
              },
              {
                label: 'Versements vers Grande Caisse',
                href: '/expenses?tab=transfers&register=PETITE_CAISSE',
                icon: ArrowRightLeft,
              },
              {
                label: 'Bons de sortie Médicaments',
                href: '/expenses?tab=clinic-medicines',
                icon: Pill,
              },
            ],
          },
        ];

      // 2. COMPTE PHARMACIE : Tableau de bord en premier, Demande de Caisse, Gestion Stock
      case 'PHARMACIST':
        return [
          {
            title: 'ESPACE PHARMACIE',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
              {
                label: 'Demande de Caisse',
                href: '/pharmacy/sales',
                icon: ShoppingBag,
              },
              {
                label: 'Gestion Stock',
                href: '/pharmacy/stock',
                icon: PackagePlus,
              },
            ],
          },
        ];

      // 3. COMPTE MÉDECIN
      case 'DOCTOR':
        return [
          {
            title: 'ESPACE PRATICIEN',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
            ],
          },
          {
            title: 'ACTIVITÉ MÉDICALE',
            items: [
              {
                key: 'consultations',
                label: 'Consultations',
                icon: Stethoscope,
                href: '/consultations',
                subItems: [
                  { label: 'Toutes les consultations', href: '/consultations' },
                  { label: 'Nouvelle consultation', href: '/consultations/new', icon: PlusCircle },
                ],
              },
              {
                key: 'patients',
                label: 'Dossiers Patients',
                icon: Users,
                href: '/patients',
                subItems: [
                  { label: 'Liste des patients', href: '/patients' },
                  { label: 'Nouveau patient', href: '/patients/new', icon: PlusCircle },
                ],
              },
            ],
          },
        ];

      // 4. COMPTE INFIRMIER
      case 'NURSE':
        return [
          {
            title: 'ESPACE SOINS',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
            ],
          },
          {
            title: 'SOINS & PATIENTS',
            items: [
              {
                key: 'patients',
                label: 'Patients & Constantes',
                icon: Users,
                href: '/patients',
                subItems: [
                  { label: 'Tous les patients', href: '/patients' },
                  { label: 'Ajouter un patient', href: '/patients/new', icon: PlusCircle },
                ],
              },
            ],
          },
        ];

      // 5. COMPTE COMPTABLE (GESTION GRANDE CAISSE, TRANSFERTS, DÉPENSES, BANQUE & CONSULTATIONS WEEK-END)
      case 'ACCOUNTANT':
        return [
          {
            title: 'ESPACE COMPTABILITÉ',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
            ],
          },
          {
            title: 'GRANDE CAISSE & TRÉSORERIE',
            items: [
              {
                label: 'Dépenses & Décaissements',
                href: '/expenses?tab=expenses',
                icon: ArrowDownRight,
              },
              {
                label: 'Transferts entre Caisses',
                href: '/expenses?tab=transfers',
                icon: ArrowRightLeft,
              },
              {
                label: 'Mouvements Banque',
                href: '/expenses?tab=bank',
                icon: Landmark,
              },
              {
                label: 'Consultations Week-end',
                href: '/expenses?tab=weekend-consultations',
                icon: Calendar,
              },
              {
                label: 'Fiches de Paie',
                href: '/expenses?tab=payroll',
                icon: Users,
              },
              {
                label: 'Bons de sortie Médicaments',
                href: '/expenses?tab=clinic-medicines',
                icon: Pill,
              },
            ],
          },
          {
            title: 'SUIVI FINANCIER & FACTURATION',
            items: [
              {
                label: 'Bordereau journalier',
                href: '/payments?tab=daily-sheet',
                icon: ClipboardList,
              },
              {
                label: 'Flux financiers',
                href: '/payments?tab=all',
                icon: DollarSign,
              },
              {
                label: 'Bénéfices pharmacie',
                href: '/pharmacy/financials',
                icon: TrendingUp,
              },
              {
                label: 'Cabinet dentaire',
                href: '/dentistry',
                icon: Smile,
              },
              {
                key: 'invoices',
                label: 'Facturation Patients',
                icon: CreditCard,
                href: '/invoices',
                subItems: [
                  { label: 'Factures patients', href: '/invoices' },
                  { label: 'Nouvelle facture', href: '/invoices/new', icon: PlusCircle },
                ],
              },
            ],
          },
        ];

      // 6. COMPTE ADMINISTRATION (SUPER_ADMIN, CLINIC_ADMIN) : Supervision financière & pharmacie & consultation
      case 'SUPER_ADMIN':
      case 'CLINIC_ADMIN':
      default:
        return [
          {
            title: 'TABLEAU DE BORD',
            items: [
              {
                label: 'Tableau de bord',
                href: '/dashboard',
                icon: LayoutDashboard,
              },
            ],
          },
          {
            title: 'FINANCES & CAISSE',
            items: [
              {
                label: 'Gestion Solde',
                href: '/expenses',
                icon: Wallet,
              },
              {
                label: 'Consultations Week-end',
                href: '/expenses?tab=weekend-consultations',
                icon: Calendar,
              },
              {
                label: 'Bordereau journalier',
                href: '/payments?tab=daily-sheet',
                icon: ClipboardList,
              },
              {
                label: 'Flux financiers',
                href: '/payments?tab=all',
                icon: DollarSign,
              },
              {
                label: 'Caisse consultation',
                href: '/consultations/caisse',
                icon: Receipt,
              },
              {
                label: 'Caisse pharmacie',
                href: '/pharmacy/sales',
                icon: CreditCard,
              },
              {
                label: 'Bénéfices pharmacie',
                href: '/pharmacy/financials',
                icon: TrendingUp,
              },
            ],
          },
          {
            title: 'ACTES & SOINS',
            items: [
              {
                label: 'Cabinet dentaire',
                href: '/dentistry',
                icon: Smile,
              },
              {
                label: 'Actes & Hébergements',
                href: '/pharmacy/consumables',
                icon: ClipboardCheck,
              },
            ],
          },
          {
            title: 'PHARMACIE & STOCKS',
            items: [
              {
                key: 'pharmacy',
                label: 'Pharmacie & Stocks',
                icon: Pill,
                href: '/pharmacy',
                subItems: [
                  { label: 'Vue d’ensemble', href: '/pharmacy' },
                  { label: 'Gestion des stocks', href: '/pharmacy/stock' },
                  { label: 'Catalogue médicaments', href: '/pharmacy/medicines' },
                  { label: 'Matériel & consommables', href: '/pharmacy/consumables' },
                  { label: 'Inventaires', href: '/pharmacy/inventory' },
                  { label: 'États financiers', href: '/pharmacy/financials' },
                ],
              },
            ],
          },
          {
            title: 'ADMINISTRATION',
            items: [
              {
                label: 'Gestion des utilisateurs',
                href: '/users',
                icon: Users,
              },
              {
                label: 'Paramètres clinique',
                href: '/settings/clinic',
                icon: Settings,
              },
            ],
          },
        ];
    }
  }, [user.role]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-white">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-xs overflow-hidden">
              <img src="/logo/betesda-icon.svg" alt="Clinique Betesda" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-slate-800 text-sm tracking-wide">
                CLINIQUE <span className="text-sky-600">BETESDA</span>
              </span>
              <p
                className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold leading-none truncate max-w-[155px]"
                title={clinicName || user.clinicName || 'Clinique Betesda'}
              >
                {clinicName || user.clinicName || 'Clinique Betesda'}
              </p>
            </div>
          </Link>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>

              {section.items.map((item: any, iIdx) => {
                const Icon = item.icon;
                const isSub = Boolean(item.subItems);
                const isSubOpen = openMenus[item.key || ''];
                const hasQuery = Boolean(item.href && item.href.includes('?'));
                const currentPathWithSearch = currentSearchString ? `${pathname}?${currentSearchString}` : pathname;
                const isActive = item.href
                  ? hasQuery
                    ? (() => {
                        const [itemBase, itemQuery] = item.href.split('?');
                        if (pathname !== itemBase) return false;
                        const itemParams = new URLSearchParams(itemQuery);
                        const itemTab = itemParams.get('tab');
                        if (itemTab) {
                          return searchParams?.get('tab') === itemTab;
                        }
                        return currentPathWithSearch === item.href;
                      })()
                    : (user.role === 'RECEPTIONIST' && item.href === '/consultations/caisse' && pathname.startsWith('/consultations')) ||
                      (pathname === item.href && (!currentSearchString || (!item.href.startsWith('/expenses') && !item.href.startsWith('/payments'))))
                  : false;

                if (!isSub) {
                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                }

                // Submenu Parent
                return (
                  <div key={iIdx} className="space-y-1">
                    <button
                      onClick={() => toggleSubmenu(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        pathname.startsWith(item.href)
                          ? 'text-blue-600 font-semibold bg-blue-50/50'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${pathname.startsWith(item.href) ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </div>
                      {isSubOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {/* Submenu Children */}
                    {isSubOpen && (
                      <div className="pl-9 pr-2 space-y-1 py-1">
                        {item.subItems.map((sub: any, subIdx: number) => {
                          const isSubActive = pathname === sub.href;
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={subIdx}
                              href={sub.href}
                              onClick={onCloseMobile}
                              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors min-w-0 ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              {SubIcon && <SubIcon className="w-3 h-3 shrink-0" />}
                              <span className="truncate whitespace-nowrap">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
            <Link href="/profile" className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <span className="inline-block text-[10px] text-blue-700 font-semibold truncate">
                  {roleInfo.label}
                </span>
              </div>
            </Link>

            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title="Déconnexion"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
