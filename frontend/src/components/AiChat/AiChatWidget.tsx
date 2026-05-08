import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';

const PROBLEM_KEYWORDS = ['erro', 'problema', 'não consigo', 'nao consigo', 'bug', 'travou', 'não funciona', 'nao funciona', 'falhou', 'não abre', 'não carrega', 'ajuda', 'suporte'];
const isProblem = (text: string) => PROBLEM_KEYWORDS.some(kw => text.toLowerCase().includes(kw));

interface Message {
  role: 'user' | 'model';
  text: string;
  time: string;
}

function getTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou o Assistente MeloCalé. Como posso te ajudar hoje?', time: getTime() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ticketCreatedRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const newMessages: Message[] = [...messages, { role: 'user', text: userMessage, time: getTime() }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!response.ok) throw new Error('Falha ao comunicar com assistente');
      const data = await response.json();

      const aiResponse = data.response || 'Desculpe, tive um problema ao processar sua pergunta.';
      const finalMessages: Message[] = [...newMessages, { role: 'model', text: aiResponse, time: getTime() }];
      setMessages(finalMessages);

      if (isProblem(userMessage) && !ticketCreatedRef.current) {
        ticketCreatedRef.current = true;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await apiFetch('/api/support-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user?.id || null,
              email: user?.email || null,
              conversation: finalMessages,
            }),
          });
        } catch {
          // silently ignore ticket creation failures
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'model', text: 'Ocorreu um erro ao conectar com o assistente. Tente novamente mais tarde.', time: getTime() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-20 right-0 w-[380px] max-w-[calc(100vw-1.5rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-[#0A0B0D] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-black/20 rounded-2xl flex items-center justify-center">
                    <Bot size={20} className="text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-emerald-700 animate-pulse" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">Assistente MeloCalé</p>
                  <p className="text-emerald-200 text-[11px] font-medium">Responde em segundos ⚡</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-black/20 rounded-xl transition-colors text-white/80 hover:text-white"
                  title="Minimizar"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-black/20 rounded-xl transition-colors text-white/80 hover:text-white"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ scrollbarWidth: 'none' }}
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 mb-4">
                      <Bot size={12} className="text-emerald-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-white rounded-br-sm'
                        : 'bg-[#14161B] border border-white/5 text-white rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-600 px-1">{msg.time}</span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-emerald-400" />
                  </div>
                  <div className="bg-[#14161B] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                        style={{ opacity: 1 - i * 0.25 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-[#0A0B0D] shrink-0">
              <div className="flex items-center gap-2 bg-[#14161B] border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-emerald-500/50 transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-8 h-8 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-colors"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} className="text-white" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={22} className="text-white" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Online pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20 pointer-events-none" />

        {/* Notification badge */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0A0B0D] shadow">
            1
          </span>
        )}
      </motion.button>
    </div>
  );
}
