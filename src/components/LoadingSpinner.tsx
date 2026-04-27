import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export default function LoadingSpinner({ size = 24, className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className="animate-spin text-emerald-500" size={size} />
      {label && <p className="text-slate-400 text-sm font-medium">{label}</p>}
    </div>
  );
}
