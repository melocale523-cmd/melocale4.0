interface LoadingLogoProps {
  size?: number; // px, lado do quadrado. Default 180 (uso full-page).
  showLabel?: boolean; // mostra "Carregando..." embaixo. Default true.
}

export default function LoadingLogo({ size = 180, showLabel = true }: LoadingLogoProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size > 60 ? 20 : 8 }}>
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="loadingLogoClipM">
            <rect className="loading-logo-fill-m" x="0" y="0" width="103" height="200" />
          </clipPath>
          <clipPath id="loadingLogoClipC">
            <rect className="loading-logo-fill-c" x="103" y="0" width="97" height="200" />
          </clipPath>
        </defs>
        <rect x="8" y="8" width="184" height="184" rx="38" fill="#0f5132" stroke="#d9d6cc" strokeWidth="4" />
        <text x="100" y="128" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="92" fontWeight="bold" fill="none" stroke="rgba(232,230,223,0.35)" strokeWidth="2" letterSpacing="-16">MC</text>
        <g clipPath="url(#loadingLogoClipM)">
          <text x="100" y="128" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="92" fontWeight="bold" fill="#e8e6df" letterSpacing="-16">MC</text>
        </g>
        <g clipPath="url(#loadingLogoClipC)">
          <text x="100" y="128" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="92" fontWeight="bold" fill="#e8e6df" letterSpacing="-16">MC</text>
        </g>
      </svg>
      {showLabel && (
        <p style={{ color: '#94A3B8', fontWeight: 600, fontSize: size > 60 ? 15 : 11, letterSpacing: '.02em' }} className="loading-logo-pulse-text">
          Carregando...
        </p>
      )}
    </div>
  );
}
