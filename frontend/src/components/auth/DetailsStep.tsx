import type { AuthFormData } from '../../hooks/useAuthForm';
import { AddressForm, type AddressValue } from '../AddressForm';

interface DetailsStepProps {
  formData: AuthFormData;
  onChange: (field: keyof AuthFormData, value: string) => void;
  address: AddressValue;
  onAddressChange: (address: AddressValue) => void;
  categorias: string[];
  selectedRole: 'client' | 'professional' | null;
}

export function DetailsStep({
  formData,
  onChange,
  address,
  onAddressChange,
  categorias,
  selectedRole,
}: DetailsStepProps) {
  return (
    <div className="space-y-10">
      <div>
        <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-8 pl-1">WhatsApp para Contato</label>
        <input
          required
          type="tel"
          placeholder="(00) 00000-0000"
          maxLength={20}
          className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-9 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
          value={formData.phone}
          onChange={e => onChange('phone', e.target.value)}
        />
      </div>

      <div className="pt-1">
        <p className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-9 pl-1">Endereço</p>
        <AddressForm
          value={address}
          onChange={onAddressChange}
          variant="signup"
        />
      </div>

      {selectedRole === 'professional' && (
        <div>
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-8 pl-1">Área de Atuação</label>
          <select
            required
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-9 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium appearance-none cursor-pointer"
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
              className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-9 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium mt-8"
              value={formData.customCategory}
              onChange={e => onChange('customCategory', e.target.value)}
            />
          )}
        </div>
      )}

      {selectedRole === 'professional' && (
        <div>
          <label className="block text-xs font-black text-[#7A9EBF] uppercase tracking-widest mb-8 pl-1">
            Sobre você (opcional)
          </label>
          <textarea
            placeholder="Descreva brevemente sua experiência e serviços..."
            rows={3}
            maxLength={500}
            className="w-full bg-[#1C3454] border border-[#243F6A] rounded-2xl px-5 py-9 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium resize-none text-sm leading-relaxed"
            value={formData.bio}
            onChange={e => onChange('bio', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
