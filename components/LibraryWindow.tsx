import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { searchSpells } from '../services/libraryService';
import { Spell } from '../types';

const LibraryWindow: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Spell[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length > 1) {
      setResults(searchSpells(val));
    } else {
      setResults([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="p-3 bg-slate-800 border-b border-slate-700">
        <h3 className="font-bold flex items-center gap-2 mb-2">
          <BookOpen size={18} className="text-blue-400" /> 5e Reference
        </h3>
        <div className="relative">
          <Search className="absolute left-2 top-2 text-slate-500" size={14} />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Search spells..."
            className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {selectedSpell ? (
          <div className="bg-slate-800 p-4 rounded border border-slate-700">
            <button onClick={() => setSelectedSpell(null)} className="text-xs text-blue-400 mb-2 hover:underline">← Back</button>
            <h2 className="text-xl font-serif font-bold text-white mb-1">{selectedSpell.name}</h2>
            <div className="text-xs text-slate-400 italic mb-3">Level {selectedSpell.level} {selectedSpell.school}</div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div><span className="text-slate-500">Casting Time:</span> {selectedSpell.castingTime}</div>
              <div><span className="text-slate-500">Range:</span> {selectedSpell.range}</div>
              <div><span className="text-slate-500">Components:</span> {selectedSpell.components}</div>
              <div><span className="text-slate-500">Duration:</span> {selectedSpell.duration}</div>
            </div>
            
            <div className="text-sm text-slate-300 leading-relaxed border-t border-slate-700 pt-3">
              {selectedSpell.description}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {results.length === 0 && query.length > 0 && <div className="text-center text-slate-500 text-sm mt-4">No results found</div>}
            {results.map(spell => (
              <div 
                key={spell.name} 
                onClick={() => setSelectedSpell(spell)}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors"
              >
                <div className="font-bold text-sm text-indigo-300">{spell.name}</div>
                <div className="text-xs text-slate-500">{spell.school} • Level {spell.level}</div>
              </div>
            ))}
            {results.length === 0 && query.length === 0 && (
                <div className="text-center text-slate-600 text-xs mt-10">
                    Search for spells like "Fireball", "Shield", or "Mage Hand"
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryWindow;