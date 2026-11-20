'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  UserCheck,
  DollarSign,
  Pill,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPassword = customPassword || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.details ? `${data.error} (${data.details})` : (data.error || 'Identifiants invalides'));
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError('Erreur de connexion au serveur');
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    handleLogin(undefined, demoEmail, 'password123');
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo Clinique Betesda */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center p-2 bg-white shadow-lg shadow-sky-500/10 border border-slate-100">
            <img src="/logo/betesda-icon.svg" alt="Clinique Betesda" className="w-16 h-16 object-contain" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          CLINIQUE <span className="text-sky-600">BETESDA</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Soins, Bienveillance &amp; Gestion Intelligente
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-slate-200">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Connexion sécurisée</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Accédez au portail de gestion médicale de la clinique
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse Email
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nom@betesda.mg"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mot de passe
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="text-slate-600">Se souvenir de moi</span>
              </label>

              <button
                type="button"
                onClick={() => alert('Veuillez contacter l’administrateur système de la clinique.')}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Role Selector */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
              Comptes Démonstration Dédiés (1 clic)
            </p>

            <div className="space-y-2 text-xs">
              {/* 1. Compte Accueil / Réception */}
              <button
                type="button"
                onClick={() => handleQuickDemo('reception@betesda.mg')}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 hover:border-amber-300 transition-all text-left shadow-xs group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800">Accueil &amp; Réception</div>
                  <div className="text-[10px] text-amber-700 font-medium truncate">Caisse, Consultations &amp; Encaissement Pharmacie</div>
                </div>
              </button>

              {/* 2. Compte Pharmacie */}
              <button
                type="button"
                onClick={() => handleQuickDemo('pharmacien@betesda.mg')}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 hover:border-blue-300 transition-all text-left shadow-xs group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Pill className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800">Pharmacie Clinique</div>
                  <div className="text-[10px] text-blue-700 font-medium truncate">Demandes Médicaments, Envoi Accueil &amp; Entrée Stock</div>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* 2. Compte Administrateur */}
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin.clinique@betesda.mg')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-300 transition-all text-left shadow-xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">Administrateur</div>
                    <div className="text-[10px] text-emerald-700 font-medium truncate">Gestion Clinique</div>
                  </div>
                </button>

                {/* 3. Compte Super Admin */}
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin@betesda.mg')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 hover:border-purple-300 transition-all text-left shadow-xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">Super Admin</div>
                    <div className="text-[10px] text-purple-700 font-medium truncate">Contrôle global</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Système sécurisé conforme aux normes de confidentialité des données médicales.
        </p>
      </div>
    </div>
  );
}
