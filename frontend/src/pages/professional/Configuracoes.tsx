import { useState, useEffect } from 'react';
import { Settings, Bell, Lock, Shield, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import { getWhatsAppConnectLink } from '../../lib/whatsappConnect';
import { useIsMobile } from '../../hooks/useIsMobile';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function ProfessionalConfiguracoes() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

  const [notifications, setNotifications] = useState({
    newLead: true,
    appointmentConfirmed: true,
    appointmentCancelled: true,
    messages: true,
    promotions: false,
    whatsappNewLead: true,
  });
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  const [savingNotifications, setSavingNotifications] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Load persisted preferences on mount
  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;
      const { data } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data && !cancelled) {
        setNotifications(prev => ({
          ...prev,
          newLead: data.email_new_lead,
          messages: data.email_messages,
          promotions: data.push_enabled,
          appointmentConfirmed: data.appointment_confirmed,
          appointmentCancelled: data.appointment_cancelled,
          whatsappNewLead: data.whatsapp_marketing_opt_in ?? true,
        }));
        setWhatsappConnected(data.whatsapp_connected === true);
      }
    }
    loadPrefs();
    return () => { cancelled = true; };
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Sessão expirada');
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          email_new_lead: notifications.newLead,
          email_messages: notifications.messages,
          push_enabled: notifications.promotions,
          appointment_confirmed: notifications.appointmentConfirmed,
          appointment_cancelled: notifications.appointmentCancelled,
          whatsapp_marketing_opt_in: notifications.whatsappNewLead,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Preferências de notificação salvas!');
    } catch {
      toast.error('Erro ao salvar preferências. Tente novamente.');
    } finally {
      setSavingNotifications(false);
    }
  };

  return (
    <div className="w-full" style={{ fontFamily:"'DM Sans',sans-serif", display:'flex', flexDirection:'column', gap:'1.5rem' }}>

      {/* Header */}
      <div>
        <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.25rem' }}>Configurações</p>
        <h1 style={{ fontSize:'1.25rem', fontWeight:900, color:'white', marginBottom:'0.25rem' }}>Minhas Configurações</h1>
        <p style={{ fontSize:'0.75rem', color:'#4A6580' }}>Gerencie suas preferências de conta</p>
      </div>

      {/* Grid Conta + Segurança */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'1rem' }}>

        {/* Conta */}
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#10b981,#059669)' }} />
          <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
            <Shield size={15} style={{ color:'#10b981' }} />Conta
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div style={{ background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.625rem', padding:'0.75rem 1rem' }}>
              <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.25rem' }}>E-mail</p>
              <p style={{ fontSize:'0.8125rem', color:'#e2e8f0' }}>{user?.email}</p>
            </div>
            <div style={{ background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.625rem', padding:'0.75rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.25rem' }}>Tipo de conta</p>
                <p style={{ fontSize:'0.8125rem', color:'#e2e8f0' }}>Profissional</p>
              </div>
              <span style={{ fontSize:'0.625rem', fontWeight:700, padding:'3px 10px', borderRadius:'1.25rem', background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Segurança */}
        <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#60a5fa,#378ADD)' }} />
          <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
            <Lock size={15} style={{ color:'#60a5fa' }} />Segurança
          </p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.625rem', padding:'0.75rem 1rem', marginBottom: showPasswordForm ? '0.75rem' : 0 }}>
            <div>
              <p style={{ fontSize:'0.8125rem', fontWeight:600, color:'white', marginBottom:'0.125rem' }}>Senha</p>
              <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Altere sua senha de acesso</p>
            </div>
            <button onClick={() => setShowPasswordForm(v => !v)} style={{ height:'2rem', padding:'0 0.875rem', background:'transparent', border:'1px solid rgba(96,165,250,.2)', borderRadius:'0.5rem', color:'#60a5fa', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' }}>
              {showPasswordForm ? 'Cancelar' : 'Alterar senha'}
            </button>
          </div>

          {showPasswordForm && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
              {[
                { label:'Senha atual', key:'current', placeholder:'••••••••' },
                { label:'Nova senha', key:'newPass', placeholder:'Mínimo 8 caracteres' },
                { label:'Confirmar nova senha', key:'confirm', placeholder:'Repita a nova senha' },
              ].map(f => (
                <div key={f.key}>
                  <p style={{ fontSize:'0.625rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', marginBottom:'0.375rem' }}>{f.label}</p>
                  <input type="password" value={passwordForm[f.key as keyof typeof passwordForm]} onChange={e => setPasswordForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} maxLength={128} style={{ width:'100%', height:'2.25rem', background:'#0d1929', border:'1px solid #1C3050', borderRadius:'0.5rem', color:'#e2e8f0', fontSize:'0.8125rem', padding:'0 0.75rem', outline:'none' }} />
                </div>
              ))}
              <button disabled={savingPassword} onClick={async () => {
                const { current, newPass, confirm } = passwordForm;
                if (newPass.length < 8) { toast.error('A nova senha deve ter pelo menos 8 caracteres.'); return; }
                if (newPass === current) { toast.error('A nova senha deve ser diferente da senha atual.'); return; }
                if (newPass !== confirm) { toast.error('As senhas não coincidem.'); return; }
                setSavingPassword(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const email = session?.user?.email;
                  if (!email) throw new Error('Sessão expirada. Faça login novamente.');
                  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
                  if (signInError) throw new Error('Senha atual incorreta.');
                  const { error } = await supabase.auth.updateUser({ password: newPass });
                  if (error) throw error;
                  toast.success('Senha alterada com sucesso!');
                  setShowPasswordForm(false);
                  setPasswordForm({ current: '', newPass: '', confirm: '' });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha.');
                } finally {
                  setSavingPassword(false);
                }
              }} style={{ height:'2.375rem', padding:'0 1.25rem', background:'linear-gradient(135deg,#60a5fa,#378ADD)', border:'none', borderRadius:'0.625rem', color:'white', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity: savingPassword ? .6 : 1 }}>
                {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                Salvar nova senha
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notificações */}
      <div style={{ background:'#132236', border:'1px solid #1C3050', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#a78bfa,#7c3aed)' }} />
        <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
          <Bell size={15} style={{ color:'#a78bfa' }} />Notificações
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
          {[
            { key:'newLead', label:'Novo lead disponível', desc:'Quando um cliente solicitar um serviço na sua área' },
            { key:'whatsappNewLead', label:'Novo pedido disponível — WhatsApp', desc:'Receba aviso de novos pedidos direto no seu WhatsApp' },
            { key:'appointmentConfirmed', label:'Agendamento confirmado', desc:'Quando um cliente confirmar um agendamento' },
            { key:'appointmentCancelled', label:'Agendamento cancelado', desc:'Quando um cliente cancelar um agendamento' },
            { key:'messages', label:'Mensagens', desc:'Quando receber uma nova mensagem' },
            { key:'promotions', label:'Promoções e novidades', desc:'Ofertas especiais e atualizações da plataforma' },
          ].map(({ key, label, desc }, i, arr) => {
            const isWhatsappRow = key === 'whatsappNewLead';
            // Toggle "ligado" do WhatsApp reflete o estado real: só ligado quando conectado
            const isOn = isWhatsappRow
              ? notifications.whatsappNewLead && whatsappConnected
              : notifications[key as keyof typeof notifications];
            // Enquanto não conectado e com opt-in já dado, o toggle não alterna
            // o consentimento: clicar nele abre o link de conexão — conectar é
            // a única forma de avançar o estado. Com opt-in desligado, o clique
            // religa o consentimento (e o botão "Conectar WhatsApp" reaparece).
            // Só depois de conectado o toggle liga/desliga normalmente.
            const isWhatsappLocked = isWhatsappRow && !whatsappConnected && notifications.whatsappNewLead;
            const handleToggle = () => {
              if (isWhatsappLocked) {
                window.open(getWhatsAppConnectLink(), '_blank', 'noopener,noreferrer');
                return;
              }
              setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }));
            };
            return (
            <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', padding:'0.875rem 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div>
                <p style={{ fontSize:'0.8125rem', fontWeight:500, color: isOn ? 'white' : '#94a3b8', marginBottom:'0.125rem', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {label}
                  {isWhatsappRow && whatsappConnected && (
                    <span style={{ fontSize:'0.5625rem', fontWeight:700, padding:'2px 8px', borderRadius:'1rem', background:'rgba(16,185,129,.12)', color:'#34d399', border:'1px solid rgba(16,185,129,.25)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                      Conectado
                    </span>
                  )}
                </p>
                <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>{desc}</p>
                {isWhatsappRow && notifications.whatsappNewLead && !whatsappConnected && (
                  <a href={getWhatsAppConnectLink()} target="_blank" rel="noopener noreferrer"
                    style={{ marginTop:'0.5rem', display:'inline-flex', alignItems:'center', gap:6, height:'1.875rem', padding:'0 0.75rem', background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.35)', borderRadius:'0.5rem', color:'#34d399', fontSize:'0.6875rem', fontWeight:700, textDecoration:'none' }}>
                    <MessageCircle size={12} />
                    Conectar WhatsApp
                  </a>
                )}
              </div>
              <button role="switch" aria-checked={isOn} aria-disabled={isWhatsappLocked} onClick={handleToggle}
                title={isWhatsappLocked ? 'Conecte seu WhatsApp para ativar' : undefined}
                style={{ position:'relative', flexShrink:0, width:'2.5rem', height:'1.5rem', borderRadius:'0.75rem', border:'none', cursor:'pointer', background: isOn ? '#10b981' : '#1C3050', transition:'background .2s', opacity: isWhatsappLocked ? .45 : 1 }}>
                <span style={{ position:'absolute', top:'0.25rem', width:'1rem', height:'1rem', borderRadius:'50%', background:'white', transition:'left .2s', left: isOn ? '1.25rem' : '0.25rem' }} />
              </button>
            </div>
            );
          })}
        </div>
        <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid rgba(255,255,255,.04)' }}>
          <button onClick={handleSaveNotifications} disabled={savingNotifications} style={{ height:'2.375rem', padding:'0 1.25rem', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:'0.625rem', color:'white', fontSize:'0.8125rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 12px rgba(16,185,129,.2)', opacity: savingNotifications ? .6 : 1 }}>
            {savingNotifications ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Salvar preferências
          </button>
        </div>
      </div>

      {/* Zona de Perigo */}
      <div style={{ background:'#132236', border:'1px solid rgba(239,68,68,.2)', borderRadius:'1rem', padding:'1.25rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'0.125rem', background:'linear-gradient(90deg,#f87171,#dc2626)' }} />
        <p style={{ fontSize:'0.8125rem', fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
          <Settings size={15} style={{ color:'#f87171' }} />Zona de Perigo
        </p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(239,68,68,.05)', border:'1px solid rgba(239,68,68,.15)', borderRadius:'0.625rem', padding:'0.75rem 1rem' }}>
          <div>
            <p style={{ fontSize:'0.8125rem', fontWeight:600, color:'white', marginBottom:'0.125rem' }}>Desativar conta</p>
            <p style={{ fontSize:'0.6875rem', color:'#4A6580' }}>Sua conta e dados serão desativados permanentemente</p>
          </div>
          <button onClick={() => toast.error('Entre em contato com o suporte para desativar sua conta.')} style={{ height:'2rem', padding:'0 0.875rem', background:'transparent', border:'1px solid rgba(239,68,68,.25)', borderRadius:'0.5rem', color:'#f87171', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' }}>
            Desativar
          </button>
        </div>
      </div>

    </div>
  );
}
