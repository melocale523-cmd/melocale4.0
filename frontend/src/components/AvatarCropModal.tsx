import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Loader2 } from 'lucide-react';
import { getCroppedBlob, CropArea } from '../lib/cropUtils';

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
  isUploading: boolean;
}

export default function AvatarCropModal({ imageSrc, onConfirm, onClose, isUploading }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPx, setCroppedAreaPx] = useState<CropArea | null>(null);

  const onCropComplete = useCallback((_: unknown, areaInPixels: CropArea) => {
    setCroppedAreaPx(areaInPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPx) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPx);
    onConfirm(blob);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#14161B] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white">Ajustar foto</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Crop area — fixed 1:1 */}
        <div className="relative bg-black" style={{ height: 280 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#000' },
              cropAreaStyle: { border: '2px solid #10b981' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-8">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isUploading || !croppedAreaPx}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {isUploading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
