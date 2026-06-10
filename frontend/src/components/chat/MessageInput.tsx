import { useState, useEffect, type RefObject, type FormEvent } from 'react';
import {
  Send, Paperclip, Smile, Mic, Image as ImageIcon,
  X, CalendarPlus,
} from 'lucide-react';

const EMOJIS = ['👍', '🤝', '✅', '🏠', '🛠️', '🎨', '📐', '💰', '📅', '📍'];

interface MessageInputProps {
  role: 'professional' | 'client';
  messageInput: string;
  setMessageInput: (v: string) => void;
  onSendMessage: (e?: FormEvent) => void;
  onTypingBroadcast: () => void;
  onFileUpload: (file: File, type: 'image' | 'file') => void;
  isUploading: boolean;
  isRecording: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  sendMessagePending: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  inputPlaceholder: string;
  onOpenScheduleModal?: () => void;
}

export function MessageInput({
  role,
  messageInput,
  setMessageInput,
  onSendMessage,
  onTypingBroadcast,
  onFileUpload,
  isUploading,
  isRecording,
  recordingTime,
  onStartRecording,
  onStopRecording,
  sendMessagePending,
  imageInputRef,
  fileInputRef,
  inputPlaceholder,
  onOpenScheduleModal,
}: MessageInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  function clearImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPendingImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function clearFilePreview() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function flushPendingImage() {
    if (!pendingImageFile) return;
    onFileUpload(pendingImageFile, 'image');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPendingImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function flushPendingFile() {
    if (!pendingFile) return;
    onFileUpload(pendingFile, 'file');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const hasText = !!messageInput.trim();

    if (pendingImageFile && !hasText && !pendingFile) {
      flushPendingImage();
      return;
    }
    if (pendingFile && !hasText && !pendingImageFile) {
      flushPendingFile();
      return;
    }
    if (pendingImageFile) flushPendingImage();
    if (pendingFile) flushPendingFile();
    if (hasText) onSendMessage(e);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    onTypingBroadcast();
  };

  const hasPending = !!pendingImageFile || !!pendingFile;
  const showSend = !!messageInput.trim() || hasPending;

  const attachMenuItems = [
    {
      icon: <ImageIcon size={16} color="#10b981" />,
      label: 'Fotos e vídeos',
      bg: '#10b98120',
      onClick: () => { imageInputRef.current?.click(); setShowAttachMenu(false); },
    },
    {
      icon: <Paperclip size={16} color="#60a5fa" />,
      label: 'Documento',
      bg: '#3b82f620',
      onClick: () => { fileInputRef.current?.click(); setShowAttachMenu(false); },
    },
    ...(role === 'professional' && onOpenScheduleModal ? [{
      icon: <CalendarPlus size={16} color="#a78bfa" />,
      label: 'Agendar visita',
      bg: '#7c3aed20',
      onClick: () => { onOpenScheduleModal(); setShowAttachMenu(false); },
    }] : []),
  ];

  return (
    <div style={{ background: '#0a1928', borderTop: '1px solid #1C3050', padding: '10px 14px 8px', zIndex: 20, position: 'relative' }}>
      <style>{`@keyframes wave { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div style={{ position: 'absolute', bottom: '72px', left: '14px', right: '14px', padding: '10px', background: '#132236', border: '1px solid #1C3050', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px', zIndex: 50 }}>
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => { setMessageInput(messageInput + emoji); setShowEmojiPicker(false); }}
              style={{ fontSize: '20px', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: 'none', cursor: 'pointer', transition: 'transform .15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(false)}
            style={{ position: 'absolute', top: '-10px', right: '-10px', width: '22px', height: '22px', background: '#0d1c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '8px' }}>
          <img src={imagePreview} alt="Preview" style={{ height: '80px', width: '80px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} />
          <button
            type="button"
            onClick={clearImagePreview}
            style={{ width: '20px', height: '20px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginLeft: '-12px', marginTop: '-4px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* File preview */}
      {pendingFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 12px' }}>
          <Paperclip size={14} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</span>
          <button type="button" onClick={clearFilePreview} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main row */}
      {isRecording ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onStopRecording}
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#1C3050', border: '1px solid #243F6A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={18} color="#94a3b8" />
          </button>
          <div style={{ flex: 1, background: '#0d1929', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '24px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'pulse 1.2s ease-in-out infinite' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
              {[8, 14, 10, 18, 12, 16, 8, 14, 10, 12].map((h, i) => (
                <span key={i} style={{
                  display: 'inline-block', width: '3px', height: `${h}px`,
                  background: '#ef4444', borderRadius: '2px', opacity: 0.7,
                  animation: `wave ${0.8 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.07}s`,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={onStopRecording}
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
          >
            <Send size={16} color="#fff" style={{ transform: 'translateX(1px) translateY(-1px)' }} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Input wrapper */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Emoji button — left inside input */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: showEmojiPicker ? '#facc15' : 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, zIndex: 1 }}
            >
              <Smile size={17} />
            </button>

            <input
              value={messageInput}
              maxLength={2000}
              onChange={handleInputChange}
              placeholder={inputPlaceholder}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0d1929', border: '1px solid #1C3050', borderRadius: '24px',
                padding: '9px 80px 9px 40px',
                fontSize: '14px', color: '#f1f5f9', outline: 'none',
                fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#1C3050'; }}
            />

            {/* Camera + clip — right inside input */}
            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '2px', zIndex: 1 }}>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading || !!pendingImageFile}
                title="Enviar foto"
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '6px', transition: 'color .15s', opacity: (isUploading || !!pendingImageFile) ? 0.3 : 1 }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
              >
                <ImageIcon size={16} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowAttachMenu(v => !v); }}
                title="Anexar"
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '6px', transition: 'color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
              >
                <Paperclip size={16} />
              </button>
            </div>

            {/* Attach menu */}
            {showAttachMenu && (
              <div
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', bottom: '50px', right: '0px', background: '#132236', border: '1px solid #1C3050', borderRadius: '12px', padding: '6px', zIndex: 50, minWidth: '160px' }}
              >
                {attachMenuItems.map(({ icon, label, bg, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1C3050'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mic / Send toggle */}
          {!showSend ? (
            <button
              type="button"
              onClick={onStartRecording}
              disabled={isUploading}
              title="Gravar Áudio"
              style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUploading ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'all .2s', boxShadow: '0 4px 12px rgba(16,185,129,0.25)', opacity: isUploading ? 0.5 : 1 }}
            >
              <Mic size={18} color="#fff" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sendMessagePending}
              style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sendMessagePending ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'all .2s', boxShadow: '0 4px 12px rgba(16,185,129,0.25)', opacity: sendMessagePending ? 0.5 : 1 }}
            >
              <Send size={16} color="#fff" style={{ transform: 'translateX(1px) translateY(-1px)' }} />
            </button>
          )}
        </form>
      )}

      <p style={{ fontSize: '10px', color: '#1e293b', textAlign: 'center', padding: '5px 0 0', letterSpacing: '.04em', margin: 0 }}>
        As mensagens são protegidas por SSL em trânsito
      </p>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            setPendingImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) setPendingFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
