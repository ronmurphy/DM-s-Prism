import React, { useState } from 'react';
import { Token } from '../types';
import { X, Check, Footprints } from 'lucide-react';

interface TokenEditorProps {
  token: Token;
  onSave: (updated: Token) => void;
  onCancel: () => void;
}

const TokenEditor: React.FC<TokenEditorProps> = ({ token, onSave, onCancel }) => {
  const [name, setName] = useState(token.name);
  const [color, setColor] = useState(token.color);
  const [maxHp, setMaxHp] = useState(token.maxHp);
  const [ac, setAc] = useState(token.ac);
  const [speed, setSpeed] = useState(token.speed || 30);
  const [previewImage, setPreviewImage] = useState<string | undefined>(token.avatarUrl);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      ...token,
      name,
      color,
      maxHp,
      hp: Math.min(token.hp, maxHp), // Ensure current HP doesn't exceed max
      ac,
      speed,
      // If we change max speed, should we reset remaining? 
      // For now, let's just ensure it doesn't exceed new speed if we reduced it.
      remainingMovement: Math.min(token.remainingMovement, speed), 
      avatarUrl: previewImage
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-96 shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-serif text-white">Edit Token</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center mb-4">
             <div 
               className="w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-800 relative group cursor-pointer"
               style={{ borderColor: color }}
             >
                {previewImage ? (
                    <img src={previewImage} alt="Token" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-2xl font-bold text-slate-500">{name[0]}</span>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleImageUpload}
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white font-bold">
                    Change Img
                </div>
             </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input 
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div>
                <label className="block text-xs text-slate-400 mb-1">Max HP</label>
                <input 
                  type="number"
                  value={maxHp} onChange={e => setMaxHp(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:border-indigo-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs text-slate-400 mb-1">AC</label>
                <input 
                  type="number"
                  value={ac} onChange={e => setAc(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:border-indigo-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Footprints size={10}/> Speed</label>
                <input 
                  type="number"
                  step={5}
                  value={speed} onChange={e => setSpeed(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:border-indigo-500 outline-none"
                />
             </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Color</label>
            <div className="flex gap-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'].map(c => (
                <div 
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded mt-4 flex items-center justify-center gap-2 transition-colors"
          >
            <Check size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenEditor;