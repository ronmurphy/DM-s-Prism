
import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Skull, GripVertical, FileJson, Info, Save, Globe } from 'lucide-react';
import { searchSpells } from '../services/libraryService';
import { searchMonstersOpen5e } from '../services/open5eService';
import { Spell, Monster, Ability } from '../types';

const format5eText = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/{@atk mw}/g, "Melee Weapon Attack:")
        .replace(/{@atk rw}/g, "Ranged Weapon Attack:")
        .replace(/{@atk ms,rs}/g, "Melee or Ranged Spell Attack:")
        .replace(/{@hit (\d+)}/g, "+$1")
        .replace(/{@h}/g, "Hit: ")
        .replace(/{@damage (.*?)}/g, "$1")
        .replace(/{@dc (\d+)}/g, "DC $1")
        .replace(/{@recharge (\d+)}/g, "(Recharge $1-6)")
        .replace(/{@spell (.*?)}/g, "$1")
        .replace(/{@condition (.*?)}/g, "$1")
        .replace(/{@item (.*?)}/g, "$1")
        .replace(/{@skill (.*?)}/g, "$1");
};

// Helper for parsing raw 5e.tools size strings (e.g. "M", "L", "H")
const parseImportSize = (s: any): number => {
    if (!s) return 1;
    // 5e tools usually uses abbreviations
    if (typeof s === 'string') {
        const val = s.toUpperCase();
        if (val === 'T' || val === 'S' || val === 'M') return 1;
        if (val === 'L') return 2;
        if (val === 'H') return 3;
        if (val === 'G') return 4;
    }
    return 1;
}

const parseOpen5eSize = (s: string): number => {
    const sl = s.toLowerCase();
    if (sl.includes('large')) return 2;
    if (sl.includes('huge')) return 3;
    if (sl.includes('gargantuan')) return 4;
    return 1;
}

const LibraryWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SPELLS' | 'BESTIARY'>('BESTIARY');
  const [subTab, setSubTab] = useState<'SEARCH' | 'SAVED'>('SAVED');
  
  const [query, setQuery] = useState('');
  
  // Spells
  const [spellResults, setSpellResults] = useState<Spell[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

  // Monsters
  const [savedMonsters, setSavedMonsters] = useState<Monster[]>([]);
  const [searchResults, setSearchResults] = useState<Monster[]>([]);
  const [rawOpen5e, setRawOpen5e] = useState<any[]>([]); // To extract size string if needed
  
  const [isSearching, setIsSearching] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);

  // Load saved monsters on mount
  useEffect(() => {
    const saved = localStorage.getItem('dnd_vtt_saved_monsters');
    if (saved) {
        try {
            setSavedMonsters(JSON.parse(saved));
        } catch(e) { console.error(e); }
    }
  }, []);

  const saveMonster = (monster: Monster) => {
     setSavedMonsters(prev => {
         // Avoid dups
         if (prev.find(m => m.name === monster.name)) return prev;
         const updated = [...prev, monster];
         localStorage.setItem('dnd_vtt_saved_monsters', JSON.stringify(updated));
         return updated;
     });
     alert(`Saved ${monster.name} to library.`);
  };

  const deleteSavedMonster = (name: string) => {
      setSavedMonsters(prev => {
          const updated = prev.filter(m => m.name !== name);
          localStorage.setItem('dnd_vtt_saved_monsters', JSON.stringify(updated));
          return updated;
      });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'SPELLS') {
        if (query.length > 1) {
            setSpellResults(searchSpells(query));
        }
    } else {
        if (!query) return;
        setIsSearching(true);
        const { monsters, raw } = await searchMonstersOpen5e(query);
        setSearchResults(monsters);
        setRawOpen5e(raw);
        setIsSearching(false);
        setSubTab('SEARCH');
    }
  };

  const handleDragStart = (e: React.DragEvent, monster: Monster, rawSizeStr?: string) => {
    // If we have a raw size string from API (e.g. "Large"), map it to int
    let finalMonster = { ...monster };
    if (rawSizeStr) {
        // From search results
        finalMonster.size = parseOpen5eSize(rawSizeStr);
    } else if (!finalMonster.size && monster.type) {
         // Try to parse from type string like "Large Beast"
         finalMonster.size = parseOpen5eSize(monster.type);
    }
    // Ensure default
    if (!finalMonster.size) finalMonster.size = 1;

    e.dataTransfer.setData('application/json', JSON.stringify(finalMonster));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const parse5eToolsImport = () => {
      try {
          const data = JSON.parse(importJson);
          const list = Array.isArray(data) ? data : [data];
          
          const newMonsters: Monster[] = list.map((m: any) => {
              const name = m.name || "Unknown";
              const source = m.source || "MM"; 
              const avatarUrl = `https://5e.tools/img/bestiary/tokens/${source}/${encodeURIComponent(name)}.webp`;
              
              // Map size
              const sizeInt = parseImportSize(Array.isArray(m.size) ? m.size[0] : m.size);

              let finalHp = 10;
              if (typeof m.hp === 'number') finalHp = m.hp;
              else if (m.hp?.average) finalHp = m.hp.average;

              let finalAc = 10;
              if (typeof m.ac === 'number') finalAc = m.ac;
              else if (Array.isArray(m.ac)) {
                  const val = m.ac[0];
                  finalAc = typeof val === 'number' ? val : (val.ac || 10);
              }

              let finalType = "Unknown";
              if (typeof m.type === 'string') {
                  finalType = m.type;
              } else if (typeof m.type === 'object' && m.type !== null) {
                  finalType = m.type.type || "Unknown";
                  if (m.type.tags) {
                      finalType += ` (${m.type.tags.join(', ')})`;
                  }
              }

              const abilities: Ability[] = [];
              if (m.action) {
                  m.action.forEach((a: any) => {
                      abilities.push({
                          name: a.name,
                          type: 'action',
                          description: format5eText(a.entries ? a.entries.join('\n') : '')
                      });
                  });
              }

              return {
                name: name,
                source: source,
                avatarUrl: avatarUrl,
                type: finalType, 
                ac: finalAc,
                hp: finalHp,
                speed: 30, // Simplified default
                stats: { str: m.str||10, dex: m.dex||10, con: m.con||10, int: m.int||10, wis: m.wis||10, cha: m.cha||10 },
                cr: m.cr ? (typeof m.cr === 'string' ? m.cr : m.cr.cr) : "?",
                abilities: abilities,
                size: sizeInt
              };
          });

          // Auto save imported
          const updated = [...savedMonsters, ...newMonsters];
          // dedupe by name
          const unique = updated.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
          setSavedMonsters(unique);
          localStorage.setItem('dnd_vtt_saved_monsters', JSON.stringify(unique));
          
          setImportJson('');
          setShowImport(false);
          setSubTab('SAVED');
      } catch (e) {
          console.error(e);
          alert("Invalid JSON format.");
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex gap-2 mb-3 bg-slate-900 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('BESTIARY')}
                className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${activeTab === 'BESTIARY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                <Skull size={14} /> Bestiary
            </button>
            <button 
                onClick={() => setActiveTab('SPELLS')}
                className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${activeTab === 'SPELLS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                <BookOpen size={14} /> Spells
            </button>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2 top-2 text-slate-500" size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeTab === 'BESTIARY' ? "Search Open5e..." : "Search spells..."}
            className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
          />
        </form>

        {activeTab === 'BESTIARY' && (
            <div className="flex text-xs mt-2 border-b border-slate-700">
                <button 
                    onClick={() => setSubTab('SAVED')}
                    className={`px-3 py-1 ${subTab === 'SAVED' ? 'text-indigo-400 border-b border-indigo-500' : 'text-slate-500'}`}
                >
                    Saved ({savedMonsters.length})
                </button>
                <button 
                     onClick={() => setSubTab('SEARCH')}
                     className={`px-3 py-1 ${subTab === 'SEARCH' ? 'text-indigo-400 border-b border-indigo-500' : 'text-slate-500'}`}
                >
                    Online Results
                </button>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'SPELLS' ? (
             selectedSpell ? (
                <div className="bg-slate-800 p-4 rounded border border-slate-700">
                  <button onClick={() => setSelectedSpell(null)} className="text-xs text-blue-400 mb-2 hover:underline">← Back</button>
                  <h2 className="text-xl font-serif font-bold text-white mb-1">{selectedSpell.name}</h2>
                  <div className="text-xs text-slate-400 italic mb-3">Level {selectedSpell.level} {selectedSpell.school}</div>
                  <div className="text-sm text-slate-300 leading-relaxed border-t border-slate-700 pt-3">
                    {selectedSpell.description}
                  </div>
                </div>
             ) : (
                <div className="space-y-1">
                    {spellResults.map(spell => (
                    <div 
                        key={spell.name} 
                        onClick={() => setSelectedSpell(spell)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors"
                    >
                        <div className="font-bold text-sm text-indigo-300">{spell.name}</div>
                        <div className="text-xs text-slate-500">{spell.school} • Level {spell.level}</div>
                    </div>
                    ))}
                </div>
             )
        ) : (
            <>
                {selectedMonster ? (
                     <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <button onClick={() => setSelectedMonster(null)} className="text-xs text-blue-400 mb-2 hover:underline">← Back</button>
                        <div className="flex gap-4 mb-4">
                            {selectedMonster.avatarUrl && (
                                <img 
                                    src={selectedMonster.avatarUrl} 
                                    className="w-16 h-16 rounded-full border border-slate-600 bg-black object-cover" 
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            )}
                            <div>
                                <h2 className="text-xl font-serif font-bold text-white">{selectedMonster.name}</h2>
                                <div className="text-xs text-slate-400 italic">{selectedMonster.type} • CR {selectedMonster.cr}</div>
                                <div className="flex gap-2 mt-2 text-xs">
                                     <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded">HP {selectedMonster.hp}</span>
                                     <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">AC {selectedMonster.ac}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-6 gap-1 text-center text-xs mb-3 bg-slate-900 p-2 rounded">
                                <div><div className="text-slate-500">STR</div>{selectedMonster.stats.str}</div>
                                <div><div className="text-slate-500">DEX</div>{selectedMonster.stats.dex}</div>
                                <div><div className="text-slate-500">CON</div>{selectedMonster.stats.con}</div>
                                <div><div className="text-slate-500">INT</div>{selectedMonster.stats.int}</div>
                                <div><div className="text-slate-500">WIS</div>{selectedMonster.stats.wis}</div>
                                <div><div className="text-slate-500">CHA</div>{selectedMonster.stats.cha}</div>
                            </div>
                            {selectedMonster.abilities?.map((ab, i) => (
                                <div key={i} className="text-sm border-b border-slate-700 pb-2 last:border-0">
                                    <span className="font-bold text-indigo-300 block">{ab.name} ({ab.type})</span>
                                    <span className="text-slate-400 whitespace-pre-line">{ab.description}</span>
                                </div>
                            ))}
                        </div>
                     </div>
                ) : (
                    <>
                        <div className="mb-2 flex justify-between">
                             <div className="text-xs text-slate-500 italic py-1">
                                {subTab === 'SAVED' ? 'Local Library' : 'Open5e API Results'}
                             </div>
                            <button 
                                onClick={() => setShowImport(true)}
                                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700"
                            >
                                <FileJson size={10} /> Import JSON
                            </button>
                        </div>

                        {subTab === 'SEARCH' && isSearching && <div className="text-center text-indigo-400 text-sm py-4">Summoning data...</div>}
                        
                        {subTab === 'SEARCH' && !isSearching && searchResults.length === 0 && (
                            <div className="text-center text-slate-600 text-xs py-4">No results found.</div>
                        )}

                        <div className="space-y-2">
                            {(subTab === 'SAVED' ? savedMonsters : searchResults).map((monster, idx) => (
                                <div 
                                    key={`${monster.name}-${idx}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, monster, subTab === 'SEARCH' ? rawOpen5e[idx]?.size : undefined)}
                                    className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500 rounded cursor-grab active:cursor-grabbing transition-all group relative flex gap-3 items-center"
                                >
                                    {monster.avatarUrl ? (
                                        <img 
                                            src={monster.avatarUrl} 
                                            alt={monster.name} 
                                            className="w-10 h-10 rounded-full object-cover border border-slate-600 bg-black flex-shrink-0" 
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : null}
                                    
                                    {/* Fallback Initial - Always rendered but covered by img if valid */}
                                    <div className={`w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-500 text-xs absolute left-3 top-3 -z-10`}>
                                        {monster.name.substring(0,2)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-sm text-red-200 truncate">{monster.name}</div>
                                            <div className="flex gap-2">
                                                 {subTab === 'SEARCH' && (
                                                     <button onClick={() => saveMonster(monster)} className="text-slate-500 hover:text-green-400" title="Save to Library"><Save size={14}/></button>
                                                 )}
                                                 {subTab === 'SAVED' && (
                                                     <button onClick={() => deleteSavedMonster(monster.name)} className="text-slate-600 hover:text-red-400" title="Remove"><Skull size={14}/></button>
                                                 )}
                                                 <button onClick={() => setSelectedMonster(monster)} className="text-slate-500 hover:text-white" title="View Stats"><Info size={14}/></button>
                                                 <GripVertical size={16} className="text-slate-600 group-hover:text-indigo-400" />
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 italic truncate">{monster.type} • CR {monster.cr}</div>
                                        <div className="flex gap-3 mt-1 text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-500"></i> {monster.hp}</span>
                                            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-blue-500"></i> {monster.ac}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </>
        )}
      </div>

      {showImport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-full max-w-md shadow-2xl">
                  <h3 className="font-bold text-white mb-2">Import from 5e.tools</h3>
                  <textarea 
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    className="w-full h-40 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-green-400 mb-3 focus:border-indigo-500 outline-none"
                    placeholder='Paste JSON here...'
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowImport(false)} className="px-3 py-1 text-xs text-slate-400">Cancel</button>
                      <button onClick={parse5eToolsImport} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded">Import</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LibraryWindow;