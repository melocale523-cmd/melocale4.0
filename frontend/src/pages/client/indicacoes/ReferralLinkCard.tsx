import { Link2, Copy, MessageCircle, QrCode, Share2, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { t, cardBase, ReferralCode } from './constants'

interface Props {
  referralData: ReferralCode | undefined
  isEffectivelyLoading: boolean
  codeError: boolean
  copied: boolean
  showQr: boolean
  isMobile: boolean
  generatingStories: boolean
  onSetShowQr: (v: boolean) => void
  onCopyLink: () => void
  onShareWhatsApp: () => void
  onGenerateStoriesImage: () => void
}

export default function ReferralLinkCard({
  referralData,
  isEffectivelyLoading,
  codeError,
  copied,
  showQr,
  isMobile,
  generatingStories,
  onSetShowQr,
  onCopyLink,
  onShareWhatsApp,
  onGenerateStoriesImage,
}: Props) {
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Link2 size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Seu link de indicação</span>
      </div>

      {isEffectivelyLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[44, 36, 96].map(h => (
            <div key={h} style={{ height: h, background: 'rgba(255,255,255,0.05)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : codeError ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '1.5rem 0', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>Não foi possível carregar o seu link.</p>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', margin: 0 }}>Verifique sua conexão e recarregue a página.</p>
        </div>
      ) : (
        <>
          <div style={{
            background: t.input, border: `1px solid ${t.border}`, borderRadius: '10px',
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
          }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {referralData?.link ?? '—'}
            </span>
            <button
              onClick={onCopyLink}
              disabled={!referralData?.link}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: t.accent, color: '#fff', fontSize: '13px', fontWeight: 700,
                padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                flexShrink: 0, transition: 'opacity .2s', opacity: referralData?.link ? 1 : 0.4,
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <Copy size={12} />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ color: t.muted, fontSize: '13px' }}>Código:</span>
            <span style={{
              fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '15px', color: t.text,
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '6px',
              padding: '4px 12px', letterSpacing: '.12em',
            }}>
              {referralData?.code ?? '—'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
            <button
              onClick={onShareWhatsApp}
              disabled={!referralData?.link}
              style={{
                borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)',
                color: '#25D366', fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                opacity: referralData?.link ? 1 : 0.4,
              }}
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
            <button
              onClick={onCopyLink}
              disabled={!referralData?.link}
              style={{
                borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: t.input, border: `1px solid ${t.border}`,
                color: t.subtle, fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                opacity: referralData?.link ? 1 : 0.4,
              }}
            >
              <Copy size={15} /> Copiar link
            </button>
            <button
              onClick={() => onSetShowQr(!showQr)}
              disabled={!referralData?.link}
              style={{
                borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: t.input, border: `1px solid ${t.border}`,
                color: t.subtle, fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                opacity: referralData?.link ? 1 : 0.4,
              }}
            >
              <QrCode size={15} /> {showQr ? 'Ocultar QR' : 'QR Code'}
            </button>
            <button
              onClick={onGenerateStoriesImage}
              disabled={generatingStories || !referralData?.link}
              style={{
                borderRadius: '10px', padding: '11px 0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: 'rgba(45,31,78,0.6)', border: '1px solid rgba(109,40,217,0.25)',
                color: '#a78bfa', fontFamily: 'DM Sans, sans-serif', transition: 'background .2s',
                opacity: (!generatingStories && referralData?.link) ? 1 : 0.5,
              }}
            >
              {generatingStories ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={15} />}
              {generatingStories ? 'Gerando…' : 'Stories'}
            </button>
          </div>

          {showQr && referralData?.link && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
              <QRCodeSVG value={referralData.link} size={160} bgColor="#ffffff" fgColor="#060d1a" level="M" />
              <p style={{ color: '#060d1a', fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700, margin: 0 }}>{referralData.code}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
