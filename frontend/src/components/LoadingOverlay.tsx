import LoadingLogo from './LoadingLogo';

interface LoadingOverlayProps {
  active: boolean;
  label?: string; // ex: "Atualizando pedidos..."
}

export default function LoadingOverlay({ active, label = 'Atualizando...' }: LoadingOverlayProps) {
  if (!active) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(14,28,50,.75)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <LoadingLogo size={64} showLabel={false} />
      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{label}</p>
    </div>
  );
}
