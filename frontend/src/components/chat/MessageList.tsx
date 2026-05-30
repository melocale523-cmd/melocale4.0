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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
      {isLoading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : messages && messages.length > 0 ? (
        messages.map((msg) => {
          const isAi = msg.sender_type === 'ai';
          const mine = !isAi && msg.sender_type === role;
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%] sm:max-w-[70%] group animate-in slide-in-from-bottom-2',
                mine ? 'ml-auto items-end' : 'mr-auto items-start',
              )}
            >
              {isAi && (
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">
                  🤖 Assistente MeloCalé
                </span>
              )}
              <div className={cn(
                'p-4 rounded-2xl text-[13px] leading-relaxed relative shadow-lg',
                mine
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : isAi
                  ? 'bg-slate-700/80 text-slate-200 border border-slate-600/50 rounded-tl-sm italic'
                  : 'bg-[#1C3454] text-slate-200 border border-[#1C3050] rounded-tl-sm hover:border-emerald-500/30 transition-colors',
              )}>
                {renderMessageContent(msg)}
              </div>
              <div className="flex items-center gap-2 mt-2 px-1">
                <span className="text-[10px] text-[#4A6580] font-bold uppercase tracking-wider">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {mine && (
                  <div className="flex items-center">
                    {msg.read_at
                      ? <CheckCheck size={14} className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]" />
                      : <Check size={14} className="text-slate-600" />}
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center p-12">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 text-emerald-500 border border-emerald-500/20 shadow-2xl">
            <Send size={32} />
          </div>
          <h4 className="text-white font-bold text-lg mb-2">Sem mensagens ainda</h4>
          <p className="text-[#4A6580] font-medium text-sm max-w-[200px]">
            Inicie uma conversa com o {otherLabel.toLowerCase()} para fechar o serviço.
          </p>
        </div>
      )}

      {isTyping && (
        <div className="flex flex-col items-start max-w-[70%] animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-[#1C3454] text-[#94A3B8] py-3 px-5 rounded-2xl rounded-tl-sm border border-[#1C3050] flex items-center gap-3 shadow-lg">
            <div className="flex gap-1 pt-1">
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
