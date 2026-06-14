import { useState, useEffect } from 'react';
import { X, Loader2, Star, Zap, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProfessionalProfile, ProfessionalReview } from '../../types/chat';

interface ProfessionalProfileModalProps {
  userId: string;
  name: string;
  avatar: string | null | undefined;
  onClose: () => void;
}

export function ProfessionalProfileModal({ userId, name, avatar, onClose }: ProfessionalProfileModalProps) {
  const [prof, setProf] = useState<ProfessionalProfile | null>(null);
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('professionals')
      .select('id, bio, category, city, is_active')
      .eq('user_id', userId)
      .single()
      .then(({ data: profData }) => {
        setProf(profData);
        if (profData?.id) {
          return supabase
            .from('reviews')
            .select('id, rating, comment, created_at')
            .eq('professional_id', profData.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => setReviews(data || []));
        }
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, [userId]);

  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: '420px', maxHeight: '85vh',
        background: '#0a1928', border: '1px solid #1C3050', borderTop: '3px solid #10b981',
        borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'DM Sans, sans-serif',
      }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #1C3050', position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', background: '#132236', border: '1px solid #1C3050', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', paddingRight: '40px' }}>
            {/* Avatar */}
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid #10b981', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {avatar
                ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{initials}</span>
              }
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#f1f5f9', margin: '0 0 6px' }}>{name}</h3>
              {prof?.category
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#10b981', marginBottom: 4 }}><Zap size={10} /> {prof.category}</span>
                : <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic', marginBottom: 4, display: 'block' }}>Categoria não informada</span>
              }
              {prof?.city
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', marginTop: 2 }}><MapPin size={11} /> {prof.city}</div>
                : <div style={{ fontSize: 11, color: '#334155', fontStyle: 'italic', marginTop: 2 }}>Cidade não informada</div>
              }
              {reviews.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={12} style={{ color: s <= Math.round(avgRating) ? '#facc15' : '#334155', fill: s <= Math.round(avgRating) ? '#facc15' : '#334155' }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#facc15' }}>{avgRating.toFixed(1)}</span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>({reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''})</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats grid — sempre visível após carregar */}
          {!loading && prof && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '14px' }}>
              {[
                { label: 'Avaliação', value: reviews.length > 0 ? avgRating.toFixed(1) : '—' },
                { label: 'Avaliações', value: String(reviews.length) },
                { label: 'Status', value: prof.is_active ? 'Ativo' : 'Inativo' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#0d1929', border: '1px solid #1C3050', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} style={{ color: '#10b981' }} />
            </div>
          ) : (
            <>
              {prof?.bio ? (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>Sobre</p>
                  <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{prof.bio}</p>
                </div>
              ) : prof && !prof.bio && (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>Sobre</p>
                  <p style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic', margin: 0 }}>Este profissional ainda não adicionou uma biografia.</p>
                </div>
              )}

              {reviews.length > 0 ? (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>Avaliações</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {reviews.map(r => (
                      <div key={r.id} style={{ background: '#0d1929', border: '1px solid #1C3050', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{(r as Record<string, unknown>).client_name as string ?? 'Cliente'}</span>
                          <span style={{ fontSize: '11px', color: '#475569' }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', marginBottom: '6px' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={11} style={{ color: s <= r.rating ? '#facc15' : '#334155', fill: s <= r.rating ? '#facc15' : '#334155' }} />
                          ))}
                        </div>
                        {r.comment && <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>Avaliações</p>
                  <p style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic', margin: 0 }}>Nenhuma avaliação ainda.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1C3050' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '100%', padding: '10px 0', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'background .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
