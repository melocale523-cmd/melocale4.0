import { useState, useEffect } from 'react';
import { Gift, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DISMISSED_KEY = 'referral_announcement_dismissed';

interface Props {
  role: 'client' | 'professional';
}

export default function ReferralAnnouncementBanner({ role }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleClick = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
    navigate(role === 'professional' ? '/profissional/indicacao' : '/cliente/indicacao');
  };

  return (
    <div
      className="mx-2 mb-3 rounded-xl border border-emerald-500/30 p-3 flex items-center gap-3 cursor-pointer"
      style={{ background: 'linear-gradient(135deg,#0b2818,#0f3020)' }}
      onClick={handleClick}
    >
      <Gift size={18} className="text-emerald-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-white leading-tight">Indique e ganhe moeda</p>
        <p className="text-xs text-[#94A3B8] leading-tight mt-0.5">Cada amigo cadastrado pelo seu link já rende moeda</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="text-[#4A6580] hover:text-white transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
