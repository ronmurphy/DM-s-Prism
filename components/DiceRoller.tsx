import React, { useState } from 'react';
import { Dices, Send } from 'lucide-react';
import { DiceRoll } from '../types';

interface DiceRollerProps {
  onRoll: (roll: DiceRoll) => void;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ onRoll }) => {
  const [notation, setNotation] = useState('');

  const rollDice = (formula: string) => {
    try {
      // Very basic parser for XdY+Z
      const match = formula.toLowerCase().match(/^(\d+)d(\d+)([+-]\d+)?$/);
      
      let total = 0;
      let breakdown = '';
      
      if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const modifier = match[3] ? parseInt(match[3]) : 0;
        
        const results = [];
        for (let i = 0; i < count; i++) {
          const val = Math.floor(Math.random() * sides) + 1;
          results.push(val);
          total += val;
        }
        total += modifier;
        breakdown = `[${results.join(', ')}] ${modifier !== 0 ? (modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`) : ''}`;
      } else {
        // Fallback or simple number
         if(!isNaN(Number(formula))) {
             total = Number(formula);
             breakdown = 'Fixed Value';
         } else {
             // Default 1d20
             const val = Math.floor(Math.random() * 20) + 1;
             total = val;
             breakdown = '1d20 (default)';
             formula = '1d20';
         }
      }

      onRoll({
        id: Date.now().toString(),
        total,
        formula,
        breakdown,
        timestamp: Date.now()
      });
      setNotation('');
    } catch (e) {
      console.error("Dice parsing error", e);
    }
  };

  return (
    <div className="bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700">
      <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
        <Dices size={18} /> Dice Roller
      </h3>
      <div className="flex gap-2 mb-3">
        {['1d20', '1d8', '1d6', '2d6'].map(d => (
          <button 
            key={d} 
            onClick={() => rollDice(d)}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white font-mono transition-colors"
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          placeholder="e.g. 2d8+4"
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && rollDice(notation)}
        />
        <button 
          onClick={() => rollDice(notation)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

export default DiceRoller;