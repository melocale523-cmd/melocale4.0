import { Eye, EyeOff } from 'lucide-react';
import type { AuthFormData } from '../../hooks/useAuthForm';
import { getPasswordStrength } from '../../hooks/useAuthForm';

interface BasicsStepProps {
  mode: 'login' | 'signup';
  formData: AuthFormData;
  onChange: (field: keyof AuthFormData, value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  isSubmitting: boolean;
}

export function BasicsStep({
  mode,
  formData,
  onChange,
  showPassword,
  onTogglePassword,
  onForgotPassword,
  isSubmitting,
}: BasicsStepProps) {
  return (
    <div className="space-y-5">
      {mode === 'signup' && (
        <div>
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">Nome Completo</label>
          <input
            required
            type="text"
            placeholder="Como devemos te chamar?"
            maxLength={100}
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
            value={formData.name}
            onChange={e => onChange('name', e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">E-mail de Acesso</label>
        <input
          required
          type="email"
          placeholder="seu@email.com"
          maxLength={254}
          className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
          value={formData.email}
          onChange={e => onChange('email', e.target.value)}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest pl-1">Sua Senha</label>
          {mode === 'login' && (
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={isSubmitting}
              className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400 tracking-widest transition-colors"
            >
              Esqueci a senha
            </button>
          )}
        </div>
        <div className="relative">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 pr-12 py-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
            value={formData.password}
            onChange={e => onChange('password', e.target.value)}
            minLength={8}
            maxLength={128}
          />
          <button
            type="button"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B0C4D8] hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {mode === 'signup' && formData.password.length > 0 && (() => {
          const strength = getPasswordStrength(formData.password);
          const colors = { 0: 'bg-white/10', 1: 'bg-red-500', 2: 'bg-yellow-400', 3: 'bg-emerald-500' } as const;
          const activeColor = colors[strength];
          return (
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? activeColor : 'bg-white/10'}`} />
              ))}
            </div>
          );
        })()}

        {mode === 'signup' && (
          <div className="flex items-center gap-3 mt-2">
            {[
              { ok: formData.password.length >= 8, label: '8+ chars' },
              { ok: /[A-Z]/.test(formData.password), label: 'Maiúscula' },
              { ok: /[0-9]/.test(formData.password), label: 'Número' },
            ].map(({ ok, label }) => (
              <span
                key={label}
                className={`text-[13px] font-bold flex items-center gap-1 transition-colors ${ok ? 'text-emerald-400' : 'text-[#7A9EBF]'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-[#7A9EBF]'}`} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
