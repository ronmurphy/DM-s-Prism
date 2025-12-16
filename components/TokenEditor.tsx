
import React, { useState } from 'react';
import { Token, Ability, DiceRoll } from '../types';
import { X, Check, Footprints, ScrollText, Swords, Dices } from 'lucide-react';

interface TokenEditorProps {
  token: Token;
  onSave: (updated: Token) => void;
  onCancel: () => void;
  onRoll?: (roll: DiceRoll) => void;
}

const TokenEditor: React.FC<TokenEditorProps> = ({ token, onSave, onCancel, onRoll }) => {
  const [activeTab, setActiveTab] = useState<'STATS' | 'ABILITIES'>('STATS');
  
  // Stats Form
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
      hp: Math.min(token.hp, maxHp),
      ac,
      speed,
      remainingMovement: Math.min(token.remainingMovement, speed), 
      avatarUrl: previewImage
    });
  };

  const handleAbilityRoll = (formula: string, reason: string) => {
      if (!onRoll) return;
      
      try {
          // Normalize formula
          const cleanFormula = formula.replace(/\s/g, '').toLowerCase();
          const match = cleanFormula.match(/(\d+)d(\d+)([+-]\d+)?/);
          
          if (match) {
             const count = parseInt(match[1]);
             const sides = parseInt(match[2]);
             const modifier = match[3] ? parseInt(match[3]) : 0;
             
             let total = 0;
             const results = [];
             for(let i=0; i<count; i++) {
                 const r = Math.floor(Math.random() * sides) + 1;
                 results.push(r);
                 total += r;
             }
             total += modifier;
             
             onRoll({
                 id: Date.now().toString(),
                 total,
                 formula: formula,
                 breakdown: `[${results.join(', ')}] ${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''} (${reason})`,
                 timestamp: Date.now()
             });
          }
      } catch (e) {
          console.error("Roll error", e);
      }
  };

  // Renderer for description with clickable dice
  const renderDescription = (text: string, abilityName: string) => {
      // Find patterns like "3d6", "1d10 + 4", "1d20" (basic)
      // We split by capturing group to preserve the delimiters
      const parts = text.split(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/g);
      
      return parts.map((part, i) => {
          // Check if this part is a dice formula
          if (part.match(/^\d+d\d+(?:\s*[+-]\s*\d+)?$/)) {
              return (
                  <button 
                    key={i}
                    onClick={() => handleAbilityRoll(part, abilityName)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 bg-indigo-900/50 border border-indigo-500/50 rounded text-indigo-200 text-xs hover:bg-indigo-800 transition-colors font-mono cursor-pointer"
                    title="Click to Roll"
                  >
                      <Dices size={10} /> {part}
                  </button>
              );
          }
          return <span key={i}>{part}</span>;
      });
  };

  // Logic to determine if we show abilities tab
  // Only show if it's an 'enemy' (Bestiary) OR if it explicitly has abilities populated.
  const showAbilitiesTab = token.type === 'enemy' || (token.abilities && token.abilities.length > 0);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-slate-600 overflow-hidden bg-black">
                  {previewImage ? <img src={previewImage} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800" />}
              </div>
              <div>
                  <h3 className="text-xl font-bold font-serif text-white">{name}</h3>
                  <p className="text-xs text-slate-500">{token.type === 'pc' ? 'Player Character' : 'Creature'}</p>
              </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
            <button 
                onClick={() => setActiveTab('STATS')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'STATS' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-500 hover:text-white'}`}
            >
                <Swords size={16} /> Stats
            </button>
            {showAbilitiesTab && (
                <button 
                    onClick={() => setActiveTab('ABILITIES')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'ABILITIES' ? 'text-green-400 border-b-2 border-green-500 bg-slate-800/50' : 'text-slate-500 hover:text-white'}`}
                >
                    <ScrollText size={16} /> Abilities
                </button>
            )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'STATS' && (
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
                </div>
            )}

            {activeTab === 'ABILITIES' && showAbilitiesTab && (
                <div className="space-y-4">
                    {(!token.abilities || token.abilities.length === 0) ? (
                        <div className="text-center text-slate-500 text-sm py-4">
                            No abilities found. Try re-importing this monster from 5e.tools.
                        </div>
                    ) : (
                        token.abilities.map((ability, idx) => (
                            <div key={idx} className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-indigo-300 text-sm">{ability.name}</span>
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded text-slate-200 font-bold
                                        ${ability.type === 'action' ? 'bg-red-900/50' : 
                                          ability.type === 'spell' ? 'bg-blue-900/50' : 
                                          ability.type === 'reaction' ? 'bg-yellow-900/50' : 'bg-slate-700'}
                                    `}>
                                        {ability.type}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                                    {renderDescription(ability.description, ability.name)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        <div className="p-4 border-t border-slate-800">
             <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
            >
                <Check size={16} /> Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};

export default TokenEditor;
