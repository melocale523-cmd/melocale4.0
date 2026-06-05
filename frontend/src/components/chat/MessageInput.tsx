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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  function clearImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPendingImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function flushPendingImage() {
    if (!pendingImageFile) return;
    onFileUpload(pendingImageFile, 'image');
    // Clear preview immediately — message list will show it once sent
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setPendingImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pendingImageFile && !messageInput.trim()) {
      // Image-only send: upload triggers the message via hook, don't call onSendMessage
      flushPendingImage();
      return;
    }
    if (pendingImageFile && messageInput.trim()) {
      // Both image and text: upload image then send text
      flushPendingImage();
      onSendMessage();
      return;
    }
    // Text-only
    if (messageInput.trim()) onSendMessage(e);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    onTypingBroadcast();
  };

  const RecordingIndicator = (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-full border border-red-500/20 animate-pulse">
      <div className="w-2 h-2 bg-red-500 rounded-full" />
      <span className="text-xs font-mono font-bold text-red-500">
        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
      </span>
      <button type="button" onClick={onStopRecording} className="p-1 hover:bg-black/20 rounded-full text-red-500">
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  );

  return (
    <div className="border-t border-white/5 bg-[#0d1c2e] py-3 px-4 z-20 relative">
      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 right-4 p-3 bg-[#132236] border border-white/10 rounded-2xl shadow-2xl flex flex-wrap gap-1.5 animate-in slide-in-from-bottom-4 duration-300 z-50">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { setMessageInput(messageInput + emoji); setShowEmojiPicker(false); }}
              className="text-xl hover:scale-125 transition-transform p-1.5 bg-white/5 rounded-xl hover:bg-emerald-500/20"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowEmojiPicker(false)}
            className="absolute -top-3 -right-3 w-6 h-6 bg-[#0d1c2e] border border-white/10 rounded-full flex items-center justify-center text-white/40 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Image preview — shown until user hits send */}
      {imagePreview && (
        <div className="flex items-start gap-1 mb-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-20 object-cover rounded-xl border border-white/10"
            />
          </div>
          <button
            type="button"
            onClick={clearImagePreview}
            className="w-5 h-5 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white -ml-3 -mt-1 border border-white/20 shrink-0"
          >
            <X size={10} />
          </button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
        {/* Left icons */}
        {isRecording ? RecordingIndicator : (
          <div className="flex items-center">
            <button
              type="button"
              onClick={onStartRecording}
              disabled={isUploading}
              title="Gravar Áudio"
              className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin text-emerald-400" /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading || !!pendingImageFile}
              title="Enviar Foto"
              className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
            >
              <ImageIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Enviar Arquivo"
              className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
            >
              <Paperclip size={18} />
            </button>
            {role === 'professional' && onOpenScheduleModal && (
              <button
                type="button"
                onClick={onOpenScheduleModal}
                disabled={isUploading}
                title="Agendar Visita"
                className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
              >
                <CalendarPlus size={18} />
              </button>
            )}
          </div>
        )}

        {/* Text input */}
        <input
          value={messageInput}
          maxLength={2000}
          onChange={handleInputChange}
          placeholder={inputPlaceholder}
          className="flex-1 bg-[#132236] border border-white/[0.06] rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/30 transition-all"
        />

        {/* Right: emoji + send */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={cn('p-2 transition-colors', showEmojiPicker ? 'text-yellow-400' : 'text-white/40 hover:text-yellow-400')}
          >
            <Smile size={18} />
          </button>
          <button
            type="submit"
            disabled={(!messageInput.trim() && !pendingImageFile) || sendMessagePending}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-2.5 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 relative shrink-0"
          >
            <Send size={16} className="translate-x-0.5 -translate-y-0.5" />
            {sendMessagePending && <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-pulse" />}
          </button>
        </div>
      </form>

      <p className="text-[9px] uppercase tracking-widest text-white/20 text-center mt-2">
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
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'file'); e.target.value = ''; }}
      />
    </div>
  );
}
