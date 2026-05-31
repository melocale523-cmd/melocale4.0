import { useState, type RefObject, type FormEvent } from 'react';
import {
  Send, Paperclip, Smile, Mic, Image as ImageIcon,
  Loader2, Square, X, CalendarPlus,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    onTypingBroadcast();
  };

  const RecordingIndicator = (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20 animate-pulse">
      <div className="w-2 h-2 bg-red-500 rounded-full" />
      <span className="text-xs font-mono font-bold text-red-500">
        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
      </span>
      <button type="button" onClick={onStopRecording} className="p-1 hover:bg-black/20 rounded-md text-red-500">
        <Square size={16} fill="currentColor" />
      </button>
    </div>
  );

  const SendButton = (
    <button
      disabled={!messageInput.trim() || sendMessagePending}
      type="submit"
      className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.25rem] flex items-center justify-center transition-all shadow-xl shadow-emerald-500/20 disabled:grayscale disabled:opacity-30 disabled:cursor-not-allowed shrink-0 relative active:scale-90"
    >
      <Send size={22} className="translate-x-0.5 -translate-y-0.5" />
      {sendMessagePending && <div className="absolute inset-0 bg-emerald-500/20 rounded-[1.25rem] animate-pulse" />}
    </button>
  );

  const TextInput = (
    <div className="flex-1 relative group">
      <input
        value={messageInput}
        maxLength={2000}
        onChange={handleInputChange}
        placeholder={inputPlaceholder}
        className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-[1.25rem] py-4 px-6 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all font-medium shadow-inner"
      />
      <button
        type="button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className={cn('absolute right-4 top-1/2 -translate-y-1/2 transition-colors', showEmojiPicker ? 'text-yellow-500' : 'text-slate-600 hover:text-yellow-500')}
      >
        <Smile size={24} />
      </button>
    </div>
  );

  return (
    <div className="p-6 pb-8 border-t border-[#1C3050] bg-[#1C3454]/80 backdrop-blur-xl z-20 relative">
      {showEmojiPicker && (
        <div className="absolute bottom-28 left-6 right-6 p-4 bg-[#1C3454] border border-[#243F6A] rounded-2xl shadow-2xl flex flex-wrap gap-2 animate-in slide-in-from-bottom-4 duration-300 border-b-4 border-b-emerald-500/20 z-50">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { setMessageInput(messageInput + emoji); setShowEmojiPicker(false); }}
              className="text-2xl hover:scale-125 transition-transform p-2 bg-white/5 rounded-xl hover:bg-emerald-500/20"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowEmojiPicker(false)}
            className="absolute -top-3 -right-3 w-8 h-8 bg-black border border-[#243F6A] rounded-full flex items-center justify-center text-[#4A6580] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {role === 'professional' ? (
        <form onSubmit={onSendMessage} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {TextInput}
            {SendButton}
          </div>
          <div className="flex items-center gap-1 px-1">
            {isRecording ? RecordingIndicator : (
              <>
                <button type="button" onClick={onStartRecording} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50" title="Gravar Áudio">
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                </button>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Foto">
                  <ImageIcon size={20} />
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Arquivo">
                  <Paperclip size={20} />
                </button>
                {onOpenScheduleModal && (
                  <button type="button" onClick={onOpenScheduleModal} disabled={isUploading} className="p-2.5 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50" title="Agendar Visita">
                    <CalendarPlus size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={onSendMessage} className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/5 py-1 px-1.5 rounded-[1.25rem] border border-[#1C3050] shadow-inner">
            {isRecording ? RecordingIndicator : (
              <>
                <button type="button" onClick={onStartRecording} disabled={isUploading} className="p-3 text-[#4A6580] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-50" title="Gravar Áudio">
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                </button>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="p-3 text-[#4A6580] hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Foto">
                  <ImageIcon size={20} />
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-3 text-[#4A6580] hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all disabled:opacity-50" title="Enviar Arquivo">
                  <Paperclip size={20} />
                </button>
              </>
            )}
          </div>
          {TextInput}
          {SendButton}
        </form>
      )}

      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-4 text-center">
        As mensagens são protegidas por SSL em trânsito
      </p>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'image'); e.target.value = ''; }}
      />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'file'); e.target.value = ''; }}
      />
    </div>
  );
}
