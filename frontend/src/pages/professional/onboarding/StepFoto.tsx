import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, CheckCircle } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface StepFotoProps {
  avatarMutation: UseMutationResult<string, Error, File>;
  onNext: () => void;
}

export function StepFoto({ avatarMutation, onNext }: StepFotoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    avatarMutation.mutate(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <div className="space-y-7">
        <h2 className="text-3xl font-black text-white tracking-tight">Adicione sua foto</h2>
        <p className="text-[#7A9EBF] font-medium">
          Uma boa foto aumenta a confiança dos clientes. Você pode pular esta etapa.
        </p>
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={avatarMutation.isPending}
        className="relative w-36 h-36 rounded-full border-2 border-dashed border-[#243F6A] hover:border-emerald-500/50 bg-[#1C3454] flex flex-col items-center justify-center gap-7 transition-all group overflow-hidden"
      >
        {preview ? (
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <>
            <Camera size={36} className="text-[#4A6580] group-hover:text-emerald-500 transition-colors" />
            <span className="text-[10px] font-black text-[#4A6580] uppercase tracking-widest group-hover:text-emerald-500 transition-colors">
              Escolher foto
            </span>
          </>
        )}
        {avatarMutation.isPending && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-emerald-500" />
          </div>
        )}
        {avatarMutation.isSuccess && !avatarMutation.isPending && (
          <div className="absolute bottom-2 right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle size={16} className="text-black" />
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {avatarMutation.isError && (
        <p className="text-red-400 text-sm">{avatarMutation.error.message}</p>
      )}

      <div className="w-full space-y-8 pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={avatarMutation.isPending}
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all flex items-center justify-center gap-7 text-lg uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          <Upload size={20} />
          {avatarMutation.isPending ? 'Enviando...' : avatarMutation.isSuccess ? 'Próximo' : 'Próximo'}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={avatarMutation.isPending}
          className="w-full h-11 text-[#7A9EBF] hover:text-white text-sm font-bold transition-colors"
        >
          Pular esta etapa
        </button>
      </div>
    </div>
  );
}
