import React, { type RefObject } from 'react';
import { Send, Loader2, Download, CheckCheck, Check } from 'lucide-react';
import type { Message } from '../../types/chat';

interface MessageListProps {
  messages: Message[] | undefined;
  isLoading: boolean;
  isTyping: boolean;
  otherName: string;
  otherLabel: string;
  role: 'professional' | 'client';
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i;
const AVATAR_COLORS = ['#1e40af', '#7e22ce', '#c2410c', '#0f766e'];

function getAvatarInfo(name: string): { initials: string; color: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return { initials, color: AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] };
}

function isImageUrl(url: string): boolean {
  return url.startsWith('https') && (url.includes('/storage/') || url.includes('supabase'));
}

function getFileName(url: string): string {
  const parts = url.split('/');
  const raw = decodeURIComponent(parts[parts.length - 1] || 'arquivo');
  const cleaned = raw.replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-?/i, '');
  const name = cleaned || 'arquivo';
  return name.length > 30 ? name.substring(0, 27) + '...' : name;
}

const AVATAR_SENT_COLOR = 'linear-gradient(135deg,#1e40af,#3b82f6)'

function AudioPlayer({ src, isMine, otherInitials, otherColor, timestamp }: { src: string; isMine: boolean; otherInitials: string; otherColor: string; timestamp: string }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [currentTime, setCurrentTime] = React.useState(0)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const BARS = [4,8,14,20,10,18,6,16,24,11,19,13,22,7,17,12,21,5,15,23,9,20,13,18,5,22,11,16,8,14,4,9,15,21,10,19,6,17,25,12,20,14,22,7,18,13,21,9,16,11]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <audio ref={audioRef} src={src}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={e => { const a = e.target as HTMLAudioElement; setCurrentTime(a.currentTime); setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0) }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0) }}
      />

      {/* Avatar esquerda (enviado) */}
      {isMine && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: AVATAR_SENT_COLOR, border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff' }}>
            Eu
          </div>
          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '16px', height: '16px', borderRadius: '50%', background: '#25d366', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>🎤</div>
        </div>
      )}

      {/* Play/Pause */}
      <button type="button" onClick={toggle} style={{ width: '34px', height: '34px', borderRadius: '50%', background: isMine ? 'rgba(255,255,255,0.22)' : 'rgba(16,185,129,0.2)', border: isMine ? 'none' : '1px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        {playing
          ? <svg width="11" height="13" viewBox="0 0 11 13"><rect x="0" y="0" width="3.5" height="13" rx="1.5" fill={isMine ? 'rgba(255,255,255,0.95)' : '#10b981'}/><rect x="7.5" y="0" width="3.5" height="13" rx="1.5" fill={isMine ? 'rgba(255,255,255,0.95)' : '#10b981'}/></svg>
          : <svg width="12" height="14" viewBox="0 0 12 14"><polygon points="0,0 12,7 0,14" fill={isMine ? 'rgba(255,255,255,0.95)' : '#10b981'}/></svg>
        }
      </button>

      {/* Waveform + footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isMine ? 'rgba(255,255,255,0.9)' : '#10b981', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px', height: '20px', cursor: 'pointer', flex: 1, overflow: 'hidden' }}
            onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; if (audioRef.current) { audioRef.current.currentTime = pct * audioRef.current.duration; setProgress(pct * 100) } }}>
            {BARS.map((h, i) => (
              <span key={i} style={{ display: 'inline-block', width: '2px', borderRadius: '2px', flexShrink: 0, height: `${h}px`, background: progress > (i / BARS.length) * 100 ? (isMine ? '#fff' : '#10b981') : (isMine ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)'), transition: 'background .08s' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: isMine ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)' }}>
            {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: isMine ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>{timestamp}</span>
            {isMine && <svg width="16" height="11" viewBox="0 0 16 11"><path d="M1 5.5l3 3L9 2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5.5l3 3L15 2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
      </div>

      {/* Avatar direita (recebido) */}
      {!isMine && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: otherColor, border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff' }}>
            {otherInitials}
          </div>
          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '16px', height: '16px', borderRadius: '50%', background: '#475569', border: '2px solid #132236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>🎤</div>
        </div>
      )}
    </div>
  )
}

function renderMessageContent(msg: Message, mine: boolean, otherInitials: string, otherColor: string, timestamp: string) {
  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : msg.attachments;

  if (att?.type === 'image') {
    return (
      <img
        src={msg.body}
        alt="Foto"
        loading="lazy"
        style={{ maxWidth: '100%', borderRadius: '12px', maxHeight: '256px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
        onClick={() => window.open(msg.body, '_blank')}
      />
    );
  }

  if (att?.type === 'audio') {
    return <AudioPlayer src={msg.body} isMine={mine} otherInitials={otherInitials} otherColor={otherColor} timestamp={timestamp} />;
  }

  if (att?.type === 'file') {
    if (att.fileName && IMAGE_EXTENSIONS.test(att.fileName)) {
      return (
        <img
          src={msg.body}
          alt={att.fileName}
          loading="lazy"
          style={{ maxWidth: '100%', borderRadius: '12px', maxHeight: '256px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
          onClick={() => window.open(msg.body, '_blank')}
        />
      );
    }
    return (
      <a
        href={msg.body}
        download={att.fileName}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'inherit', textDecoration: 'underline' }}
      >
        <Download size={14} />
        {getFileName(msg.body)}
      </a>
    );
  }

  if (!att && isImageUrl(msg.body)) {
    return (
      <img
        src={msg.body}
        alt="Foto"
        loading="lazy"
        style={{ maxWidth: '100%', borderRadius: '12px', maxHeight: '256px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
        onClick={() => window.open(msg.body, '_blank')}
      />
    );
  }

  return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</span>;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function MessageList({
  messages,
  isLoading,
  isTyping,
  otherName,
  otherLabel,
  role,
  messagesEndRef,
}: MessageListProps) {
  // Group messages by calendar day
  const grouped: { dateKey: string; label: string; msgs: Message[] }[] = [];
  if (messages) {
    for (const msg of messages) {
      const key = new Date(msg.created_at).toDateString();
      const last = grouped[grouped.length - 1];
      if (!last || last.dateKey !== key) grouped.push({ dateKey: key, label: formatDateLabel(msg.created_at), msgs: [msg] });
      else last.msgs.push(msg);
    }
  }

  const { initials: otherInitials, color: otherColor } = getAvatarInfo(otherName);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#070f1c', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', zIndex: 10 }}>
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={28} style={{ color: '#10b981' }} />
        </div>
      ) : messages && messages.length > 0 ? (
        <>
          {grouped.map(({ dateKey, label, msgs }) => (
            <div key={dateKey}>
              {/* Date separator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 8px' }}>
                <div style={{ flex: 1, height: '1px', background: '#1C3050' }} />
                <span style={{ fontSize: '10px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
                  {label}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#1C3050' }} />
              </div>

              {msgs.map(msg => {
                const isAi = msg.sender_type === 'ai';
                const mine = !isAi && msg.sender_type === role;
                const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isAudio = (Array.isArray(msg.attachments) ? msg.attachments[0] : (msg.attachments as {type?:string}))?.type === 'audio';

                return (
                  <div
                    key={msg.id}
                    style={{ width: '100%', display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: '8px' }}
                  >
                    {/* Avatar for received messages */}
                    {!mine && (
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isAi ? '#475569' : otherColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, marginRight: '6px', alignSelf: 'flex-end' }}>
                        {isAi ? '🤖' : otherInitials}
                      </div>
                    )}

                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      {isAi && (
                        <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', marginBottom: '4px', marginLeft: '4px' }}>
                          Assistente MeloCalé
                        </span>
                      )}
                      <div style={{
                        padding: '8px 10px', fontSize: '13px', lineHeight: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        ...(mine
                          ? { background: '#10b981', color: '#fff', borderRadius: '18px 18px 4px 18px' }
                          : isAi
                          ? { background: 'rgba(71,85,105,0.5)', color: '#cbd5e1', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '18px 18px 18px 4px', fontStyle: 'italic' }
                          : { background: '#132236', color: '#e2e8f0', border: '1px solid #1C3050', borderRadius: '18px 18px 18px 4px' }
                        ),
                        ...(isAudio && { padding: '5px 8px' }),
                      }}>
                        {renderMessageContent(msg, mine, otherInitials, otherColor, timestamp)}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                          {!isAudio && <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: mine ? 'rgba(255,255,255,0.6)' : '#334155' }}>{timestamp}</span>}
                          {mine && !isAudio && (
                            msg.read_at
                              ? <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />
                              : <Check size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.1)', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Send size={28} style={{ color: '#10b981' }} />
          </div>
          <h4 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px', margin: '0 0 8px', fontFamily: 'DM Sans, sans-serif' }}>Sem mensagens ainda</h4>
          <p style={{ color: '#4A6580', fontSize: '14px', maxWidth: '200px', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
            Inicie uma conversa com o {otherLabel.toLowerCase()} para fechar o serviço.
          </p>
        </div>
      )}

      {/* Typing indicator */}
      {isTyping && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#132236', border: '1px solid #1C3050', borderRadius: '18px 18px 18px 4px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['-0.3s', '-0.15s', '0s'].map((delay, i) => (
                <div
                  key={i}
                  className="animate-bounce"
                  style={{ width: '6px', height: '6px', background: 'rgba(16,185,129,0.6)', borderRadius: '50%', animationDelay: delay }}
                />
              ))}
            </div>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
              <span style={{ color: '#10b981' }}>{otherName}</span>
              <span style={{ color: '#475569' }}> está digitando...</span>
            </p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
