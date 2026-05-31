import { X, MapPin } from 'lucide-react';
import type { ClientProfile } from '../../types/chat';

interface ClientProfileModalProps {
  profile: ClientProfile;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  open:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'orçando':  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  finalizado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelado:  'bg-red-500/10 text-red-400 border-red-500/20',
};

export function ClientProfileModal({ profile, onClose }: ClientProfileModalProps) {
  const initials = (profile.full_name ?? 'C')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="h-20 bg-gradient-to-r from-slate-800 to-blue-900/30 shrink-0" />
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 p-7 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-all">
          <X size={18} />
        </button>

        <div className="px-11 -mt-10 pb-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-end gap-9 mb-8">
            <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-blue-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.full_name ?? ''} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <div className="pb-1">
              <h3 className="text-xl font-black text-white">{profile.full_name ?? 'Cliente'}</h3>
              {(profile.city || profile.state) && (
                <span className="text-xs text-[#94A3B8] flex items-center gap-6 mt-6">
                  <MapPin size={12} />
                  {[profile.city, profile.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-11 space-y-10">
          <div className="grid grid-cols-2 gap-9">
            <div className="bg-[#0E1C32] rounded-xl p-9">
              <p className="text-xs text-[#4A6580] uppercase tracking-widest mb-6">Membro desde</p>
              <p className="text-white font-bold text-sm">{new Date(profile.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="bg-[#0E1C32] rounded-xl p-9">
              <p className="text-xs text-[#4A6580] uppercase tracking-widest mb-6">Total de pedidos</p>
              <p className="text-white font-bold text-sm">{profile.total_leads}</p>
            </div>
          </div>

          {profile.recent_leads.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-8">Últimos pedidos</p>
              <div className="space-y-7">
                {profile.recent_leads.map(lead => {
                  const colorClass = STATUS_COLORS[lead.status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                  return (
                    <div key={lead.id} className="bg-[#0E1C32] rounded-xl p-8 flex items-center justify-between gap-8">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{lead.title}</p>
                        <p className="text-xs text-[#4A6580]">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className={`shrink-0 px-7 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
                        {lead.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-11 py-9 border-t border-slate-700/50 shrink-0">
          <button type="button" onClick={onClose}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
