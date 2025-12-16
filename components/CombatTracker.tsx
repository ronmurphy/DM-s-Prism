
import React, { useState, useEffect, useRef } from 'react';
import { Token, StatusEffect, Role } from '../types';
import { Sword, Heart, Shield, Activity, Skull, SkipForward, RefreshCw, Hourglass, Trash2, Check, X } from 'lucide-react';

interface CombatTrackerProps {
  tokens: Token[];
  activeTokenId: string | null;
  role: Role;
  onUpdateToken: (token: Token) => void;
  onDeleteToken: (tokenId: string) => void;
  onNextTurn: () => void;
  onResetCombat: () => void;
}

const STATUS_EFFECTS: StatusEffect[] = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'
];

const CombatTracker: React.FC<CombatTrackerProps> = ({ 
  tokens, 
  activeTokenId, 
  role, 
  onUpdateToken, 
  onDeleteToken,
  onNextTurn, 
  onResetCombat 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Sort by initiative descending
  const sortedTokens = [...tokens].sort((a, b) => b.initiative - a.initiative);

  // Auto-scroll to active token
  useEffect(() => {
    if (activeTokenId && activeRef.current) {
        activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeTokenId]);

  const handleHpChange = (token: Token, delta: number) => {
    onUpdateToken({
      ...token,
      hp: Math.min(token.maxHp, Math.max(0, token.hp + delta))
    });
  };

  const toggleEffect = (token: Token, effect: StatusEffect) => {
    const newEffects = token.statusEffects.includes(effect)
      ? token.statusEffects.filter(e => e !== effect)
      : [...token.statusEffects, effect];
    
    onUpdateToken({ ...token, statusEffects: newEffects });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Combat Header */}
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <Sword size={16} className="text-red-500" /> Initiative
        </h3>
        <div className="flex gap-2">
           {role === 'DM' && (
              <button onClick={onResetCombat} title="Reset Combat" className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <RefreshCw size={14} />
              </button>
           )}
           <button 
             onClick={onNextTurn} 
             title="End Current Turn" 
             className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-[10px] uppercase font-bold flex items-center gap-1 shadow-lg"
           >
              Next <SkipForward size={12} />
           </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sortedTokens.map((token, index) => {
          const isActive = token.id === activeTokenId;
          const isEditing = editingId === token.id;
          const isDeleting = deleteConfirmId === token.id;

          return (
            <div 
              key={token.id} 
              ref={isActive ? activeRef : null}
              onMouseLeave={() => {
                  // Auto-close menus if mouse leaves the card
                  if (deleteConfirmId === token.id) setDeleteConfirmId(null);
              }}
              className={`border rounded-lg p-3 relative group transition-colors duration-200
                  ${isActive ? 'bg-indigo-900/40 border-indigo-500 shadow-md' : 'bg-slate-800 border-slate-700'}
                  ${isEditing ? 'z-50' : 'z-0'} 
              `}
            >
              {isActive && (
                 <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-500 rounded-r shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
              )}
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`font-mono font-bold w-6 h-6 flex items-center justify-center rounded text-xs border ${isActive ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                    {token.initiative}
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${isActive ? 'text-indigo-300' : 'text-white'}`}>
                      {token.name}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <Shield size={10} /> AC {token.ac}
                      {isActive && <span className="text-indigo-400 ml-2 text-[10px] flex items-center gap-1 font-bold animate-pulse"><Hourglass size={10} /> ACTIVE</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1 text-sm font-mono">
                    <Heart size={12} className={token.hp < token.maxHp / 2 ? 'text-red-500' : 'text-green-500'} />
                    <span className={token.hp === 0 ? 'text-red-500 font-bold' : ''}>{token.hp}</span>
                    <span className="text-slate-500">/{token.maxHp}</span>
                  </div>
                  <div className="text-[10px] text-blue-400 mt-1">
                     Move: {token.remainingMovement}ft
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 mb-2 relative z-30">
                 {/* HP Controls */}
                 <div className="flex flex-1 gap-1">
                    <button onClick={() => handleHpChange(token, -1)} className="px-2 py-0.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded text-xs text-red-200 flex-1">-1</button>
                    <button onClick={() => handleHpChange(token, -5)} className="px-2 py-0.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded text-xs text-red-200 flex-1">-5</button>
                    <button onClick={() => handleHpChange(token, 1)} className="px-2 py-0.5 bg-green-900/50 hover:bg-green-900 border border-green-800 rounded text-xs text-green-200 flex-1">+1</button>
                 </div>
                 
                 {/* Delete Button (DM Only) with In-Place Confirmation */}
                 {role === 'DM' && (
                     <div className="flex items-center">
                        {isDeleting ? (
                            <div className="flex gap-1 animate-fade-in-right">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteToken(token.id);
                                        setDeleteConfirmId(null);
                                    }}
                                    className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded shadow-lg border border-red-400"
                                    title="Confirm Delete"
                                >
                                    <Check size={14} />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(null);
                                    }}
                                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded shadow-lg border border-slate-500"
                                    title="Cancel"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(token.id);
                                }}
                                className="flex items-center justify-center p-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-white border border-slate-600 hover:border-red-500 rounded transition-colors cursor-pointer"
                                title="Delete Token"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                     </div>
                 )}
              </div>

              {/* Status Effects */}
              <div className="flex flex-wrap gap-1 relative z-10">
                {token.statusEffects.map(effect => (
                  <span 
                    key={effect} 
                    onClick={() => role === 'DM' && toggleEffect(token, effect)}
                    className="px-1.5 py-0.5 bg-yellow-900/50 border border-yellow-700 text-yellow-200 text-[10px] rounded cursor-pointer hover:bg-yellow-900"
                  >
                    {effect}
                  </span>
                ))}
                <button 
                  onClick={() => setEditingId(editingId === token.id ? null : token.id)}
                  className={`px-1.5 py-0.5 border text-[10px] rounded ${editingId === token.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'}`}
                >
                  +
                </button>
              </div>

              {/* Status Effect Dropdown */}
              {isEditing && (
                <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-600 rounded-b shadow-xl z-50 p-2 grid grid-cols-2 gap-1 mt-1 animate-fade-in">
                  {STATUS_EFFECTS.map(effect => (
                    <button
                      key={effect}
                      onClick={() => {
                        toggleEffect(token, effect);
                        setEditingId(null);
                      }}
                      className={`text-xs text-left px-2 py-1 rounded ${token.statusEffects.includes(effect) ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    >
                      {effect}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CombatTracker;
