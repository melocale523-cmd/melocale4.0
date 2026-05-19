import { Loader2 } from 'lucide-react';
import type { AuthFormData } from '../../hooks/useAuthForm';

interface DetailsStepProps {
  formData: AuthFormData;
  onChange: (field: keyof AuthFormData, value: string) => void;
  onCepChange: (cep: string) => void;
  isFetchingCep: boolean;
  categorias: string[];
  selectedRole: 'client' | 'professional' | null;
}

export function DetailsStep({
  formData,
  onChange,
  onCepChange,
  isFetchingCep,
  categorias,
  selectedRole,
}: DetailsStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">WhatsApp para Contato</label>
        <input
          required
          type="tel"
          placeholder="(00) 00000-0000"
          maxLength={20}
          className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
          value={formData.phone}
          onChange={e => onChange('phone', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">CEP</label>
        <div className="relative">
          <input
            type="text"
            placeholder="00000-000"
            maxLength={9}
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            value={formData.cep}
            onChange={e => onCepChange(e.target.value)}
          />
          {isFetchingCep && (
            <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-emerald-500" />
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">Cidade / Localização</label>
        <input
          required
          type="text"
          placeholder="Onde você está localizado?"
          maxLength={100}
          className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
          value={formData.city}
          onChange={e => onChange('city', e.target.value)}
        />
      </div>

      {selectedRole === 'professional' && (
        <div>
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">Área de Atuação</label>
          <select
            required
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium appearance-none cursor-pointer"
            value={formData.category}
            onChange={e => onChange('category', e.target.value)}
          >
            <option value="" disabled>Selecione sua área de atuação</option>
            {categorias.map(cat => (
              <option key={cat} value={cat} className="bg-[#0E1C32] text-white">{cat}</option>
            ))}
          </select>
          {formData.category === 'Outro' && (
            <input
              type="text"
              required
              placeholder="Descreva sua profissão..."
              maxLength={100}
              className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium mt-3"
              value={formData.customCategory}
              onChange={e => onChange('customCategory', e.target.value)}
            />
          )}
        </div>
      )}

      {selectedRole === 'professional' && (
        <div>
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-3 pl-1">
            Sobre você (opcional)
          </label>
          <textarea
            placeholder="Descreva brevemente sua experiência e serviços..."
            rows={3}
            maxLength={500}
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium resize-none text-sm leading-relaxed"
            value={formData.bio}
            onChange={e => onChange('bio', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
