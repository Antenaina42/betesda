'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Lock,
  Mail,
  Phone,
  Clock,
  Briefcase,
  DollarSign,
  AlertCircle,
  X,
  Trash2,
  Building,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
}

interface EmployeeItem {
  id: string;
  lastName: string;
  firstName: string;
  phone?: string | null;
  position: string;
  baseSalary: number;
  isActive: boolean;
  createdAt: string;
}

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  role: Role;
  doctorProfile?: {
    specialtyName?: string | null;
    specialty?: { name: string } | null;
  } | null;
}

interface UnifiedEmployeeRow {
  id: string;
  source: 'EMPLOYEE' | 'USER';
  lastName: string;
  firstName: string;
  phone?: string | null;
  position: string;
  baseSalary: number | null;
  isActive: boolean;
  email?: string | null;
  employeeItem?: EmployeeItem;
  linkedUser?: UserItem;
}

interface UsersClientProps {
  initialEmployees: EmployeeItem[];
  initialUsers: UserItem[];
  roles: Role[];
  currentUserRole: string;
  currentUserId: string;
}

export default function UsersClient({
  initialEmployees,
  initialUsers,
  roles,
  currentUserRole,
  currentUserId,
}: UsersClientProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'users'>('employees');

  // -------------------------------------------------------------
  // ÉTAT EMPLOYÉS
  // -------------------------------------------------------------
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeItem | null>(null);

  const STAFF_CATEGORIES = ['Médecin', 'Infirmier(ère)', 'Employé', 'Autre'] as const;

  const parsePositionFields = (rawPosition?: string | null) => {
    const pos = (rawPosition || '').trim();
    if (!pos) {
      return { staffCategory: 'Employé', customCategory: '', description: '' };
    }
    const dashIdx = pos.indexOf(' — ');
    const basePart = dashIdx !== -1 ? pos.slice(0, dashIdx).trim() : pos;
    const descPart = dashIdx !== -1 ? pos.slice(dashIdx + 3).trim() : '';

    if (/^m[eé]decin$/i.test(basePart)) {
      return { staffCategory: 'Médecin', customCategory: '', description: descPart === 'Néant' ? '' : descPart };
    }
    if (/^infirmier(\(ère\)|e)?$/i.test(basePart)) {
      return { staffCategory: 'Infirmier(ère)', customCategory: '', description: descPart === 'Néant' ? '' : descPart };
    }
    if (/^employ[eé]$/i.test(basePart)) {
      return { staffCategory: 'Employé', customCategory: '', description: descPart === 'Néant' ? '' : descPart };
    }
    if (/^autre$/i.test(basePart)) {
      return { staffCategory: 'Autre', customCategory: descPart, description: '' };
    }
    return { staffCategory: 'Autre', customCategory: basePart, description: descPart === 'Néant' ? '' : descPart };
  };

  const buildFormattedPosition = (form: {
    staffCategory: string;
    customCategory: string;
    description: string;
  }) => {
    const cat =
      form.staffCategory === 'Autre'
        ? form.customCategory.trim() || 'Autre'
        : form.staffCategory;
    const desc = form.description.trim();
    if (desc && desc !== 'Néant') {
      return `${cat} — ${desc}`;
    }
    return cat;
  };

  const [employeeForm, setEmployeeForm] = useState({
    lastName: '',
    firstName: '',
    phone: '',
    staffCategory: 'Médecin',
    customCategory: '',
    description: '',
    position: '',
    baseSalary: '',
    isActive: true,
  });

  // -------------------------------------------------------------
  // ÉTAT COMPTES UTILISATEURS (4 TYPES)
  // -------------------------------------------------------------
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [userSearch, setUserSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    roleId: roles[0]?.id || '',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canManage = currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'CLINIC_ADMIN';

  // Couleurs et libellés des rôles
  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'CLINIC_ADMIN':
        return { label: 'Administrateur', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      case 'PHARMACIST':
        return { label: 'Pharmacien', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'DOCTOR':
        return { label: 'Médecin', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'NURSE':
        return { label: 'Infirmier(ère)', color: 'bg-teal-100 text-teal-700 border-teal-200' };
      case 'ACCOUNTANT':
        return { label: 'Comptable (Grande Caisse)', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'RECEPTIONIST':
      default:
        return { label: 'Accueil / Réception', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
  };

  // -------------------------------------------------------------
  // GESTION EMPLOYÉS : AJOUT / MODIF / SUPPR
  // -------------------------------------------------------------
  const handleOpenEmployeeCreate = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      lastName: '',
      firstName: '',
      phone: '',
      staffCategory: 'Médecin',
      customCategory: '',
      description: '',
      position: '',
      baseSalary: '',
      isActive: true,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setEmployeeModalOpen(true);
  };

  const handleOpenEmployeeCreateFromUser = (u: UserItem) => {
    setEditingEmployee(null);
    const defaultCat =
      u.role.name === 'DOCTOR'
        ? 'Médecin'
        : u.role.name === 'NURSE'
        ? 'Infirmier(ère)'
        : 'Employé';
    const desc =
      u.doctorProfile?.specialty?.name ||
      u.doctorProfile?.specialtyName ||
      getRoleBadge(u.role.name).label;
    setEmployeeForm({
      lastName: u.lastName.trim().toUpperCase(),
      firstName: u.firstName.trim(),
      phone: u.phone || '',
      staffCategory: defaultCat,
      customCategory: '',
      description: desc,
      position: `${defaultCat} — ${desc}`,
      baseSalary: '',
      isActive: u.isActive,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setEmployeeModalOpen(true);
  };

  const handleOpenEmployeeEdit = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    const parsed = parsePositionFields(emp.position);
    setEmployeeForm({
      lastName: emp.lastName,
      firstName: emp.firstName,
      phone: emp.phone === 'Néant' ? '' : (emp.phone || ''),
      staffCategory: parsed.staffCategory,
      customCategory: parsed.customCategory,
      description: parsed.description,
      position: emp.position,
      baseSalary: String(emp.baseSalary || ''),
      isActive: emp.isActive,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setEmployeeModalOpen(true);
  };

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (employeeForm.staffCategory === 'Autre' && !employeeForm.customCategory.trim()) {
      setErrorMsg('Veuillez préciser la fonction pour la catégorie « Autre ».');
      return;
    }

    const formattedPosition = buildFormattedPosition(employeeForm);
    setLoading(true);

    try {
      const payload = {
        lastName: employeeForm.lastName,
        firstName: employeeForm.firstName,
        phone: employeeForm.phone.trim() || 'Néant',
        position: formattedPosition,
        staffCategory: employeeForm.staffCategory,
        description: employeeForm.description.trim() || 'Néant',
        baseSalary: employeeForm.baseSalary,
        isActive: employeeForm.isActive,
      };

      if (editingEmployee) {
        const res = await fetch('/api/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEmployee.id,
            ...payload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');

        setEmployees((prev) => prev.map((emp) => (emp.id === editingEmployee.id ? data.employee : emp)));
        setSuccessMsg(`✓ Employé ${data.employee.lastName} ${data.employee.firstName} mis à jour avec succès !`);
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

        setEmployees((prev) => [data.employee, ...prev]);
        setSuccessMsg(`✓ Nouvel employé ${data.employee.lastName} ${data.employee.firstName} enregistré !`);
      }

      setTimeout(() => {
        setEmployeeModalOpen(false);
        setEditingEmployee(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/employees?id=${employeeToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur suppression');

      setEmployees((prev) => prev.filter((e) => e.id !== employeeToDelete.id));
      setSuccessMsg(`✓ Employé ${employeeToDelete.lastName} ${employeeToDelete.firstName} supprimé.`);
      setEmployeeToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur suppression');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // GESTION UTILISATEURS (4 TYPES) : AJOUT / MODIF / SUPPR
  // -------------------------------------------------------------
  const handleOpenUserCreate = () => {
    setEditingUser(null);
    setUserForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      roleId: roles[0]?.id || '',
      isActive: true,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setUserModalOpen(true);
  };

  const handleOpenUserEdit = (u: UserItem) => {
    setEditingUser(u);
    setUserForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone || '',
      password: '',
      roleId: u.role.id,
      isActive: u.isActive,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setUserModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: userForm.firstName,
            lastName: userForm.lastName,
            phone: userForm.phone,
            isActive: userForm.isActive,
            roleId: userForm.roleId,
            password: userForm.password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour');

        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === editingUser.id) {
              const matchedRole = roles.find((r) => r.id === userForm.roleId) || u.role;
              return {
                ...u,
                firstName: userForm.firstName,
                lastName: userForm.lastName,
                phone: userForm.phone,
                isActive: userForm.isActive,
                role: matchedRole,
              };
            }
            return u;
          })
        );
        setSuccessMsg(`✓ Compte utilisateur de ${userForm.firstName} ${userForm.lastName} mis à jour !`);
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

        const matchedRole = roles.find((r) => r.id === userForm.roleId) || roles[0];
        setUsers((prev) => [
          {
            ...data.user,
            phone: userForm.phone || null,
            isActive: userForm.isActive,
            createdAt: new Date().toISOString(),
            role: matchedRole,
          },
          ...prev,
        ]);
        setSuccessMsg(`✓ Compte utilisateur créé pour ${userForm.firstName} ${userForm.lastName} !`);
      }

      setTimeout(() => {
        setUserModalOpen(false);
        setEditingUser(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur suppression compte');

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setSuccessMsg(`✓ Compte utilisateur de ${userToDelete.firstName} ${userToDelete.lastName} supprimé.`);
      setUserToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur suppression');
    } finally {
      setLoading(false);
    }
  };

  // Liste unifiée des Employés : Table Employee + tous les comptes Utilisateurs SAUF Super Admin
  const unifiedEmployees: UnifiedEmployeeRow[] = useMemo(() => {
    const nonSuperUsers = users.filter((u) => u.role?.name !== 'SUPER_ADMIN');

    const rows: UnifiedEmployeeRow[] = employees.map((emp) => {
      const linkedUser = nonSuperUsers.find(
        (u) =>
          u.lastName.trim().toLowerCase() === emp.lastName.trim().toLowerCase() &&
          u.firstName.trim().toLowerCase() === emp.firstName.trim().toLowerCase()
      );
      return {
        id: `emp-${emp.id}`,
        source: 'EMPLOYEE',
        lastName: emp.lastName.trim().toUpperCase(),
        firstName: emp.firstName.trim(),
        phone: emp.phone || linkedUser?.phone || null,
        position: emp.position,
        baseSalary: emp.baseSalary,
        isActive: emp.isActive,
        email: linkedUser?.email || null,
        employeeItem: emp,
        linkedUser,
      };
    });

    nonSuperUsers.forEach((u) => {
      const alreadyExists = rows.some(
        (r) =>
          r.lastName.toLowerCase() === u.lastName.trim().toLowerCase() &&
          r.firstName.toLowerCase() === u.firstName.trim().toLowerCase()
      );
      if (!alreadyExists) {
        const positionLabel =
          u.doctorProfile?.specialty?.name ||
          u.doctorProfile?.specialtyName ||
          getRoleBadge(u.role.name).label;
        rows.push({
          id: `usr-${u.id}`,
          source: 'USER',
          lastName: u.lastName.trim().toUpperCase(),
          firstName: u.firstName.trim(),
          phone: u.phone || null,
          position: positionLabel,
          baseSalary: null,
          isActive: u.isActive,
          email: u.email,
          linkedUser: u,
        });
      }
    });

    return rows.sort((a, b) => {
      const cmpLast = a.lastName.localeCompare(b.lastName, 'fr');
      return cmpLast !== 0 ? cmpLast : a.firstName.localeCompare(b.firstName, 'fr');
    });
  }, [employees, users]);

  // Filtres
  const filteredEmployees = unifiedEmployees.filter((e) => {
    const q = employeeSearch.toLowerCase();
    return (
      !employeeSearch ||
      e.lastName.toLowerCase().includes(q) ||
      e.firstName.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      (e.phone && e.phone.toLowerCase().includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q))
    );
  });

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchSearch =
      !userSearch ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q));

    const matchRole = selectedRole === 'ALL' || u.role.name === selectedRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Messages d'alerte */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Onglets principaux : Employés vs Utilisateurs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Liste de tous les Employés ({unifiedEmployees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Comptes Utilisateurs (5 rôles) ({users.length})</span>
          </button>
        </div>

        {canManage && (
          <div>
            {activeTab === 'employees' ? (
              <button
                type="button"
                onClick={handleOpenEmployeeCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Ajouter un Employé</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenUserCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Nouvel Utilisateur</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : LISTE DE TOUS LES EMPLOYÉS (Personnel + Comptes hors Super Admin) */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Rechercher par nom, prénom, poste, téléphone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Total : {filteredEmployees.length} employé(s) (hors Super Admin)
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Nom</th>
                  <th className="py-2.5 px-3">Prénom</th>
                  <th className="py-2.5 px-3">Numéro Téléphone</th>
                  <th className="py-2.5 px-3">Poste / Rôle</th>
                  <th className="py-2.5 px-3 text-right">Salaire de Base</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Aucun employé enregistré pour le moment.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const roleBadge = emp.linkedUser ? getRoleBadge(emp.linkedUser.role.name) : null;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {emp.lastName}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div>{emp.firstName}</div>
                          {emp.email && (
                            <div className="text-[10px] text-slate-400 font-mono">{emp.email}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {emp.phone || <span className="text-slate-400 italic">Néant</span>}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                                /^m[eé]decin/i.test(emp.position)
                                  ? 'bg-violet-50 text-violet-800 border-violet-200'
                                  : /^infirmier/i.test(emp.position)
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              {emp.position}
                            </span>
                            {roleBadge && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleBadge.color}`}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                Compte Utilisateur
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                          {emp.baseSalary !== null ? (
                            formatCurrency(emp.baseSalary)
                          ) : (
                            <span className="text-[11px] font-sans font-medium text-slate-400 italic">
                              À définir
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {emp.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canManage && (
                            <div className="flex items-center justify-end gap-1.5">
                              {emp.employeeItem ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEmployeeEdit(emp.employeeItem!)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Modifier la fiche employé"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {emp.linkedUser && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUserEdit(emp.linkedUser!)}
                                      className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                                      title="Modifier le compte utilisateur"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEmployeeToDelete(emp.employeeItem!)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                emp.linkedUser && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEmployeeCreateFromUser(emp.linkedUser!)}
                                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                      title="Définir un salaire / fiche employé"
                                    >
                                      Définir salaire
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUserEdit(emp.linkedUser!)}
                                      className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                                      title="Modifier le compte utilisateur"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )
                              )}
                            </div>
                          )}
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
      {/* ONGLET 2 : COMPTES UTILISATEURS (Accueil, Pharmacien, Admin, Super Admin)  */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher nom, email, téléphone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedRole('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  selectedRole === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous ({users.length})
              </button>
              {['RECEPTIONIST', 'PHARMACIST', 'ACCOUNTANT', 'CLINIC_ADMIN', 'SUPER_ADMIN'].map((rName) => {
                const count = users.filter((u) => u.role.name === rName).length;
                const badge = getRoleBadge(rName);
                return (
                  <button
                    key={rName}
                    type="button"
                    onClick={() => setSelectedRole(rName)}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      selectedRole === rName
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {badge.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Utilisateur</th>
                  <th className="py-2.5 px-3">Email (Connexion)</th>
                  <th className="py-2.5 px-3">Téléphone</th>
                  <th className="py-2.5 px-3">Rôle Système</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucun compte utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const badge = getRoleBadge(u.role.name);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {u.firstName} {u.lastName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {u.email}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {u.phone || <span className="text-slate-400 italic">Néant</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canManage && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenUserEdit(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {u.id !== currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
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
      {/* MODAL : AJOUT / MODIFICATION D'UN EMPLOYÉ                                */}
      {/* ========================================================================= */}
      {employeeModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmployeeModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <span>{editingEmployee ? 'Modifier l’Employé' : 'Ajouter un Employé'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEmployeeModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.lastName}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                    placeholder="Ex: RAKOTO"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.firstName}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                    placeholder="Ex: Jean"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Numéro de Téléphone</label>
                  <input
                    type="text"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    placeholder="Néant (ou 034 00 000 00)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catégorie / Type de Personnel *</label>
                  <select
                    required
                    value={employeeForm.staffCategory}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, staffCategory: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 font-bold text-slate-800"
                  >
                    {STAFF_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {employeeForm.staffCategory === 'Autre' && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <label className="block font-bold text-amber-900 mb-1">Précisez la fonction / poste *</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.customCategory}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, customCategory: e.target.value })}
                    placeholder="Ex: Technicien labo, Agent d'entretien, Chauffeur..."
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:border-amber-500 font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Spécialité (Optionnel — Néant par défaut)
                </label>
                <input
                  type="text"
                  value={employeeForm.description}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, description: e.target.value })}
                  placeholder={
                    employeeForm.staffCategory === 'Médecin'
                      ? 'Ex: Médecine Générale, Pédiatrie, Chirurgie, Garde Week-end...'
                      : employeeForm.staffCategory === 'Infirmier(ère)'
                      ? 'Ex: Soins intensifs, Pansements, Garde de nuit...'
                      : 'Néant (ou précision sur les attributions...)'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {employeeForm.staffCategory === 'Médecin' && (
                <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-200 text-[11px] text-violet-900 font-semibold">
                  ✓ Ce praticien sera automatiquement disponible dans « Médecin Bénéficiaire » pour les paiements Consultations Week-end et les consultations.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Salaire de Base (Ariary) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={employeeForm.baseSalary}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: e.target.value })}
                  placeholder="Ex: 450000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500 font-bold font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="empActive"
                  checked={employeeForm.isActive}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="empActive" className="font-semibold text-slate-700 cursor-pointer">
                  Employé en poste (Actif)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xs transition-colors"
                >
                  {loading ? 'Enregistrement...' : editingEmployee ? 'Enregistrer les modifications' : 'Ajouter l’employé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : AJOUT / MODIF UTILISATEUR (STRICTEMENT 4 RÔLES)                   */}
      {/* ========================================================================= */}
      {userModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>{editingUser ? 'Modifier le Compte Utilisateur' : 'Créer un Compte Utilisateur'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    placeholder="Prénom..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    placeholder="Nom de famille..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email de Connexion *</label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="utilisateur@clinique.mg"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    placeholder="Néant (ou 034 00 000 00)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingUser ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe initial *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Minimum 6 caractères'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              {/* SÉLECTION RÔLE : STRICTEMENT LES 4 TYPES */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Type d'Utilisateur (5 Rôles Disponibles) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const badge = getRoleBadge(r.name);
                    const isSelected = userForm.roleId === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setUserForm({ ...userForm, roleId: r.id })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/80'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="font-extrabold text-xs text-slate-900">{badge.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{r.description || `Accès ${badge.label}`}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="userActive" className="font-semibold text-slate-700 cursor-pointer">
                  Compte actif (autorisé à se connecter)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xs transition-colors"
                >
                  {loading ? 'Enregistrement...' : editingUser ? 'Mettre à jour' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION EMPLOYÉ */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm">Confirmer la suppression</h4>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer l’employé <strong>{employeeToDelete.lastName} {employeeToDelete.firstName}</strong> ({employeeToDelete.position}) ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDeleteEmployee}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION UTILISATEUR */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm">Confirmer la suppression du compte</h4>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer le compte utilisateur de <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> ({userToDelete.email}) ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDeleteUser}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
