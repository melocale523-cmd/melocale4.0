import { AlertCircle, Loader2 } from 'lucide-react';
import { STATUS_LABELS, PLAN_NAMES, PLAN_LEADS, PLAN_PRICES } from './constants';

interface Subscription {
  package_id: string;
  status: string;
  started_at?: string;
}

interface SubscriptionStatus {
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  current_period_start?: number;
}

interface Props {
  currentSubscription: Subscription | null | undefined;
  subscriptionStatus: SubscriptionStatus | null | undefined;
  isSubscriptionLoading: boolean;
  hasActivePlan: boolean;
  daysUntilExpiry: number | null;
  showExpiryWarning: boolean;
  cycleProgress: number;
  cancelConfirm: boolean;
  onCancelConfirmChange: (v: boolean) => void;
  cancelLoading: boolean;
  onCancelSubscription: () => void;
  onOpenChangePlanModal: () => void;
}

export default function CurrentPlanCard({
  currentSubscription,
  subscriptionStatus,
  isSubscriptionLoading,
  hasActivePlan,
  daysUntilExpiry,
  showExpiryWarning,
  cycleProgress,
  cancelConfirm,
  onCancelConfirmChange,
  cancelLoading,
  onCancelSubscription,
  onOpenChangePlanModal,
}: Props) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#071e30,#0e2038)', border: `1px solid ${hasActivePlan ? 'rgba(16,185,129,.22)' : 'rgba(55,138,221,.22)'}`, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: hasActivePlan ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)', borderRadius: '18px 18px 0 0' }} />
      <div style={{ position: 'relative', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 4 }}>Plano Atual</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>
            {currentSubscription ? `Plano ${PLAN_NAMES[currentSubscription.package_id] ?? currentSubscription.package_id}` : 'Sem plano ativo'}
          </p>
        </div>
        {currentSubscription && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: `1px solid`, ...(STATUS_LABELS[currentSubscription.status] ? {
            background: currentSubscription.status === 'active' ? 'rgba(16,185,129,.12)' : currentSubscription.status === 'canceling' ? 'rgba(249,115,22,.12)' : 'rgba(239,68,68,.12)',
            color: currentSubscription.status === 'active' ? '#34d399' : currentSubscription.status === 'canceling' ? '#fb923c' : '#f87171',
            borderColor: currentSubscription.status === 'active' ? 'rgba(16,185,129,.3)' : currentSubscription.status === 'canceling' ? 'rgba(249,115,22,.3)' : 'rgba(239,68,68,.3)',
          } : {}) }}>
            {(STATUS_LABELS[currentSubscription.status] ?? { label: currentSubscription.status }).label}
          </span>
        )}
      </div>

      <div style={{ padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isSubscriptionLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
            <Loader2 size={20} className="animate-spin text-emerald-500" />
          </div>
        ) : currentSubscription ? (
          <>
            {subscriptionStatus?.cancel_at_period_end && (
              <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                <p style={{ color: '#fca5a5', fontSize: 12 }}>
                  Cancelamento agendado para <strong>{subscriptionStatus.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : '—'}</strong>
                </p>
              </div>
            )}
            {showExpiryWarning && !subscriptionStatus?.cancel_at_period_end && (
              <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={13} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                <p style={{ color: '#fde68a', fontSize: 12 }}>
                  Seu plano expira em <strong>{daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''}</strong>. Renove para não perder o acesso.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Desconto moedas', value: PLAN_LEADS[currentSubscription.package_id] ?? '—', color: '#34d399' },
                { label: 'Valor mensal', value: `R$ ${PLAN_PRICES[currentSubscription.package_id] ?? '—'}`, color: 'white' },
                { label: 'Data início', value: currentSubscription.started_at ? new Date(currentSubscription.started_at).toLocaleDateString('pt-BR') : '—', color: 'white' },
                { label: subscriptionStatus?.cancel_at_period_end ? 'Encerra em' : 'Próx. renovação', value: subscriptionStatus?.current_period_end ? new Date(subscriptionStatus.current_period_end * 1000).toLocaleDateString('pt-BR') : '—', color: subscriptionStatus?.cancel_at_period_end ? '#fb923c' : 'white' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4A6580', marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            {subscriptionStatus?.current_period_end && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A6580', marginBottom: 6 }}>
                  <span>Ciclo atual</span>
                  <span style={{ color: daysUntilExpiry !== null && daysUntilExpiry <= 7 ? '#f87171' : '#4A6580' }}>
                    {daysUntilExpiry !== null && daysUntilExpiry >= 0 ? `${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''} restante${daysUntilExpiry !== 1 ? 's' : ''}` : 'Expirado'}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#10b981,#059669)', borderRadius: 5, width: `${cycleProgress}%`, transition: 'width .5s' }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', textAlign: 'center', gap: 8 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📋</div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Você não tem plano ativo</p>
            <p style={{ color: '#4A6580', fontSize: 12, lineHeight: 1.5 }}>Sem plano você paga preço cheio e aparece menos nas buscas.</p>
          </div>
        )}
      </div>

      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onOpenChangePlanModal} style={{ width: '100%', height: 42, background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {hasActivePlan ? 'Mudar de Plano →' : '⚡ Assinar PRO — R$67/mês'}
        </button>
        {currentSubscription && !subscriptionStatus?.cancel_at_period_end && (
          cancelConfirm ? (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>Confirmar cancelamento?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onCancelConfirmChange(false)} style={{ flex: 1, height: 34, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Não</button>
                <button onClick={onCancelSubscription} disabled={cancelLoading} style={{ flex: 1, height: 34, background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: cancelLoading ? .5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {cancelLoading ? <Loader2 size={13} className="animate-spin" /> : 'Sim, cancelar'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => onCancelConfirmChange(true)} style={{ width: '100%', height: 32, background: 'transparent', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar Assinatura
            </button>
          )
        )}
      </div>
    </div>
  );
}
