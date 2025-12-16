import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Role } from '../types';
import { MessageSquare, Send } from 'lucide-react';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentRole: Role;
  onSendMessage: (msg: string, type: 'public' | 'whisper', recipient?: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, currentRole, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [whisperTarget, setWhisperTarget] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    const type = whisperTarget ? 'whisper' : 'public';
    onSendMessage(inputText, type, whisperTarget || undefined);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <MessageSquare size={16} /> Party Chat
        </h3>
        <span className="text-xs text-slate-500 uppercase">{currentRole}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === currentRole ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded px-3 py-2 text-sm ${
              msg.type === 'system' ? 'bg-slate-700 text-yellow-300 italic w-full text-center' :
              msg.type === 'whisper' ? 'bg-purple-900/50 border border-purple-500/30 text-purple-100' :
              msg.sender === currentRole ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}>
              {msg.type !== 'system' && (
                <div className="text-[10px] opacity-70 mb-1 flex justify-between gap-4">
                  <span>{msg.sender} {msg.type === 'whisper' && '(Private)'}</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-700">
        <div className="flex gap-2 mb-2">
           <select 
             className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded px-2 py-1 outline-none"
             value={whisperTarget}
             onChange={(e) => setWhisperTarget(e.target.value)}
           >
             <option value="">Everyone</option>
             <option value="DM">DM</option>
             <option value="Player">Player</option>
           </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button 
            onClick={handleSend}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;