import React from 'react';
import { Character, Token } from '../types';
import { Shield, Heart, Activity, Footprints, Edit, Zap } from 'lucide-react';

interface CharacterSheetProps {
  character: Character;
  token?: Token;
  onEditToken: () => void;
  onRollInitiative: (total: number) => void;
}

const StatBox: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const mod = Math.floor((value - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  
  return (
    <div className="flex flex-col items-center bg-slate-800 p-2 rounded border border-slate-700 w-16">
      <div className="text-xs text-slate-400 uppercase font-bold">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-indigo-400 bg-slate-900 px-2 rounded-full border border-slate-800">{modStr}</div>
    </div>
  );
};

const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, token, onEditToken, onRollInitiative }) => {
  
  const rollInit = () => {
      const dexMod = Math.floor((character.stats.dex - 10) / 2);
      const d20 = Math.floor(Math.random() * 20) + 1;
      onRollInitiative(d20 + dexMod);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 p-4 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-4">
        <div className="w-20 h-20 rounded-full border-4 border-slate-700 overflow-hidden bg-black">
             <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover" />
        </div>
        <div>
            <h2 className="text-2xl font-serif font-bold text-white">{character.name}</h2>
            <div className="text-slate-400">{character.class} • Level {character.level}</div>
        </div>
      </div>

      {/* Token Actions */}
      <div className="mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
         <div>
            <h4 className="font-bold text-slate-300">VTT Token</h4>
            <p className="text-xs text-slate-500">Customize your map appearance</p>
         </div>
         <button 
           onClick={onEditToken}
           className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded text-sm font-bold text-white transition-colors"
         >
           <Edit size={16} /> Edit Token
         </button>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center">
            <Shield className="text-slate-400 mb-1" size={18} />
            <span className="text-xl font-bold">{character.ac}</span>
            <span className="text-[10px] text-slate-500 uppercase">AC</span>
        </div>
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center">
            <Heart className="text-red-500 mb-1" size={18} />
            <span className="text-xl font-bold">{character.maxHp}</span>
            <span className="text-[10px] text-slate-500 uppercase">Max HP</span>
        </div>
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center">
            <Footprints className="text-green-500 mb-1" size={18} />
            <span className="text-xl font-bold">{character.speed}</span>
            <span className="text-[10px] text-slate-500 uppercase">Speed</span>
        </div>
        <div className="bg-slate-800 p-1 rounded border border-indigo-500/50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors" onClick={rollInit}>
            <Zap className="text-yellow-400 mb-1" size={18} />
            <span className="text-xs font-bold text-indigo-300">ROLL</span>
            <span className="text-[10px] text-slate-500 uppercase">Init</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 justify-items-center mb-6">
         <StatBox label="STR" value={character.stats.str} />
         <StatBox label="DEX" value={character.stats.dex} />
         <StatBox label="CON" value={character.stats.con} />
         <StatBox label="INT" value={character.stats.int} />
         <StatBox label="WIS" value={character.stats.wis} />
         <StatBox label="CHA" value={character.stats.cha} />
      </div>

      {/* Movement Status (Live) */}
      {token && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg">
             <h3 className="font-bold text-slate-400 mb-2 flex items-center gap-2">
                <Activity size={16} /> Current Status
             </h3>
             <div className="space-y-2">
                <div className="flex justify-between text-sm">
                   <span>Current HP</span>
                   <span className={token.hp < token.maxHp/2 ? 'text-red-500' : 'text-green-500'}>
                      {token.hp} / {token.maxHp}
                   </span>
                </div>
                <div className="flex justify-between text-sm">
                   <span>Remaining Move</span>
                   <span className="text-blue-400">{token.remainingMovement} ft</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                    <div 
                        className="bg-blue-600 h-full transition-all duration-300" 
                        style={{ width: `${(token.remainingMovement / token.speed) * 100}%` }} 
                    />
                </div>
                <div className="flex justify-between text-sm mt-2">
                    <span>Initiative</span>
                    <span className="font-mono font-bold">{token.initiative}</span>
                </div>
             </div>
          </div>
      )}

    </div>
  );
};

export default CharacterSheet;