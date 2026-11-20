'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, Clock, CheckCircle2, DollarSign, Calendar, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface NotificationDropdownProps {
  userRole?: string;
}

export default function NotificationDropdown({ userRole }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isPharmacist = userRole === 'PHARMACIST';
  const isReceptionist = userRole === 'RECEPTIONIST';

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        // Filtrage spécifique :
        // - Pharmacien : strictement ruptures de stock
        // - Accueil : strictement demandes de paiement transmises par le pharmacien
        let filtered = data;
        if (isPharmacist) {
          filtered = data.filter((n: any) => n.type === 'LOW_STOCK');
        } else if (isReceptionist) {
          filtered = data.filter((n: any) => n.type === 'PAYMENT_RECEIVED' || (n.title && n.title.includes('Demande de paiement')));
        }
        setNotifications(filtered);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [isPharmacist, isReceptionist]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'EXPIRY_WARNING':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'PAYMENT_RECEIVED':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'APPOINTMENT_REMINDER':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title={
          isPharmacist
            ? 'Alertes de rupture de stock'
            : isReceptionist
            ? 'Demandes de paiement reçues'
            : 'Notifications et alertes cliniques'
        }
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={`absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs animate-pulse ${
            isReceptionist ? 'bg-amber-500' : 'bg-rose-500'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[420px] rounded-2xl bg-white shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-extrabold text-slate-900 text-sm truncate">
                  {isPharmacist
                    ? 'Alertes Rupture de Stock'
                    : isReceptionist
                    ? 'Demandes de Paiement Pharmacie'
                    : 'Notifications Clinique'}
                </span>
                {unreadCount > 0 && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black border ${
                    isReceptionist
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-rose-100 text-rose-700 border-rose-200'
                  }`}>
                    {unreadCount} {unreadCount > 1 ? (isReceptionist ? 'demandes' : 'alertes') : (isReceptionist ? 'demande' : 'alerte')}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline whitespace-nowrap cursor-pointer transition-colors"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {isPharmacist
                  ? 'Aucune rupture de stock signalée. Stocks conformes.'
                  : isReceptionist
                  ? 'Aucune demande de paiement en attente.'
                  : 'Aucune alerte pour le moment.'}
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.linkUrl || (isPharmacist ? '/pharmacy/stock' : isReceptionist ? '/pharmacy/sales' : '#')}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                    !notif.isRead ? (isReceptionist ? 'bg-amber-50/50' : 'bg-rose-50/40') : ''
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!notif.isRead ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 inline-block">
                      {formatDate(notif.createdAt)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-center">
            <Link
              href={isPharmacist ? '/pharmacy/stock' : isReceptionist ? '/pharmacy/sales' : '/dashboard'}
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>
                {isPharmacist
                  ? 'Gérer les stocks pharmacie'
                  : isReceptionist
                  ? 'Voir les commandes de paiement'
                  : "Voir le centre d'alertes"}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
