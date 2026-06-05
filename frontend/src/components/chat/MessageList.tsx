import { type RefObject } from 'react';
import { Send, Loader2, Download, CheckCheck, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
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

function renderMessageContent(msg: Message) {
  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : msg.attachments;

  if (att?.type === 'image') {
    return (
      <img
        src={msg.body}
        alt="Foto"
        loading="lazy"
        className="max-w-full rounded-xl max-h-64 object-cover cursor-pointer"
        onClick={() => window.open(msg.body, '_blank')}
      />
    );
  }

  if (att?.type === 'audio') {
    return <audio controls src={msg.body} className="max-w-full min-w-[200px]" />;
  }

  if (att?.type === 'file') {
    // Render image files inline instead of as download links
    if (att.fileName && IMAGE_EXTENSIONS.test(att.fileName)) {
      return (
        <img
          src={msg.body}
          alt={att.fileName}
          loading="lazy"
          className="max-w-full rounded-xl max-h-64 object-cover cursor-pointer"
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
        className="flex items-center gap-2 text-sm underline hover:no-underline"
      >
        <Download size={14} />
        {getFileName(msg.body)}
      </a>
    );
  }

  // No attachment metadata: try to detect image by URL pattern
  if (!att && isImageUrl(msg.body)) {
    return (
      <img
        src={msg.body}
        alt="Foto"
        loading="lazy"
        className="max-w-full rounded-xl max-h-64 object-cover cursor-pointer"
        onClick={() => window.open(msg.body, '_blank')}
      />
    );
  }

  return <span className="whitespace-pre-wrap">{msg.body}</span>;
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
  return (
    // flex flex-col ensures ml-auto/mr-auto align bubbles correctly
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 custom-scrollbar relative z-10">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500" size={28} />
        </div>
      ) : messages && messages.length > 0 ? (
        messages.map((msg) => {
          const isAi = msg.sender_type === 'ai';
          const mine = !isAi && msg.sender_type === role;
          const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[75%] group animate-in slide-in-from-bottom-2',
                mine ? 'ml-auto items-end' : 'mr-auto items-start',
              )}
            >
              {isAi && (
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">
                  🤖 Assistente MeloCalé
                </span>
              )}
              <div className={cn(
                'px-3 pt-2 pb-1.5 rounded-2xl text-[13px] leading-relaxed relative shadow-md',
                mine
                  ? 'bg-[#10b981] text-white rounded-tr-sm'
                  : isAi
                  ? 'bg-slate-700/80 text-slate-200 border border-slate-600/50 rounded-tl-sm italic'
                  : 'bg-white/10 text-white border border-white/[0.06] rounded-tl-sm',
              )}>
                {renderMessageContent(msg)}
                {/* Timestamp inside bubble, bottom-right */}
                <div className={cn(
                  'flex items-center justify-end gap-1 mt-1',
                  mine ? 'opacity-70' : 'opacity-50',
                )}>
                  <span className="text-[10px]">{timestamp}</span>
                  {mine && (
                    msg.read_at
                      ? <CheckCheck size={12} className="text-white" />
                      : <Check size={12} className="text-white/80" />
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-[1.5rem] flex items-center justify-center mb-4 text-emerald-500 border border-emerald-500/20 shadow-2xl">
            <Send size={28} />
          </div>
          <h4 className="text-white font-bold text-base mb-2">Sem mensagens ainda</h4>
          <p className="text-[#4A6580] font-medium text-sm max-w-[200px]">
            Inicie uma conversa com o {otherLabel.toLowerCase()} para fechar o serviço.
          </p>
        </div>
      )}

      {isTyping && (
        <div className="flex flex-col items-start max-w-[70%] animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white/10 border border-white/[0.06] text-slate-300 py-2.5 px-4 rounded-2xl rounded-tl-sm flex items-center gap-3 shadow-md">
            <div className="flex gap-1 pt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-tighter">
              <span className="text-emerald-500">{otherName}</span> está digitando...
            </p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
