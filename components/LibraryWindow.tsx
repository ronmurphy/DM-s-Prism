
import React, { useState } from 'react';
import { BookOpen, Search, Skull, GripVertical, FileJson, Info } from 'lucide-react';
import { searchSpells } from '../services/libraryService';
import { Spell, Monster, Ability } from '../types';

// Mock Data
const MOCK_MONSTERS: Monster[] = [
  {
    name: "Goblin",
    type: "Humanoid (Goblinoid)",
    ac: 15,
    hp: 7,
    speed: 30,
    stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    cr: "1/4",
    source: "MM",
    avatarUrl: "https://5e.tools/img/bestiary/tokens/MM/Goblin.webp",
    abilities: [
        { name: "Scimitar", type: "action", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." },
        { name: "Nimble Escape", type: "bonus", description: "The goblin can take the Disengage or Hide action as a bonus action on each of its turns." }
    ]
  }
];

// Helper to strip 5e.tools tags
const format5eText = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/{@atk mw}/g, "Melee Weapon Attack:")
        .replace(/{@atk rw}/g, "Ranged Weapon Attack:")
        .replace(/{@atk ms,rs}/g, "Melee or Ranged Spell Attack:")
        .replace(/{@hit (\d+)}/g, "+$1")
        .replace(/{@h}/g, "Hit: ")
        .replace(/{@damage (.*?)}/g, "$1") // Simplify damage to just the dice/num
        .replace(/{@dc (\d+)}/g, "DC $1")
        .replace(/{@recharge (\d+)}/g, "(Recharge $1-6)")
        .replace(/{@spell (.*?)}/g, "$1")
        .replace(/{@condition (.*?)}/g, "$1")
        .replace(/{@item (.*?)}/g, "$1")
        .replace(/{@skill (.*?)}/g, "$1");
};

const LibraryWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SPELLS' | 'BESTIARY'>('BESTIARY');
  const [query, setQuery] = useState('');
  
  // Spell State
  const [spellResults, setSpellResults] = useState<Spell[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

  // Monster State
  const [monsters, setMonsters] = useState<Monster[]>(MOCK_MONSTERS);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null); // For "viewing" details

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (activeTab === 'SPELLS') {
        if (val.length > 1) {
            setSpellResults(searchSpells(val));
        } else {
            setSpellResults([]);
        }
    }
  };

  const handleDragStart = (e: React.DragEvent, monster: Monster) => {
    e.dataTransfer.setData('application/json', JSON.stringify(monster));
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

              // 1. Parse HP
              let finalHp = 10;
              if (typeof m.hp === 'number') finalHp = m.hp;
              else if (m.hp?.average) finalHp = m.hp.average;

              // 2. Parse AC
              let finalAc = 10;
              if (typeof m.ac === 'number') finalAc = m.ac;
              else if (Array.isArray(m.ac)) {
                  // Usually [12, {ac: 15, condition: ...}]
                  const val = m.ac[0];
                  finalAc = typeof val === 'number' ? val : (val.ac || 10);
              }

              // 3. Parse Speed
              let finalSpeed = 30;
              if (typeof m.speed === 'number') finalSpeed = m.speed;
              else if (m.speed?.walk) finalSpeed = m.speed.walk;
              // Sometimes speed is just object keys like { fly: 60, walk: 30 }
              
              // 4. Parse Type (Can be string or object)
              let finalType = "Unknown";
              if (typeof m.type === 'string') {
                  finalType = m.type;
              } else if (typeof m.type === 'object' && m.type !== null) {
                  finalType = m.type.type || "Unknown";
                  if (m.type.tags) {
                      finalType += ` (${m.type.tags.join(', ')})`;
                  }
              }

              // 5. Parse CR (Can be string "1/4" or object {cr: "1/4", xpLair: ...})
              let finalCr = "?";
              if (typeof m.cr === 'string' || typeof m.cr === 'number') {
                  finalCr = String(m.cr);
              } else if (typeof m.cr === 'object' && m.cr !== null) {
                  finalCr = m.cr.cr ? String(m.cr.cr) : "?";
              }
              
              // 6. Parse Abilities (Actions, Reactions, Traits, Spells)
              const abilities: Ability[] = [];

              // Traits / Passive
              if (m.trait) {
                  m.trait.forEach((t: any) => {
                      abilities.push({
                          name: t.name,
                          type: 'passive',
                          description: format5eText(t.entries ? t.entries.join('\n') : '')
                      });
                  });
              }

              // Actions
              if (m.action) {
                  m.action.forEach((a: any) => {
                      abilities.push({
                          name: a.name,
                          type: 'action',
                          description: format5eText(a.entries ? a.entries.join('\n') : '')
                      });
                  });
              }

              // Reactions
              if (m.reaction) {
                  m.reaction.forEach((r: any) => {
                       abilities.push({
                          name: r.name,
                          type: 'reaction',
                          description: format5eText(r.entries ? r.entries.join('\n') : '')
                      });
                  });
              }

              // Spells
              if (m.spellcasting) {
                  m.spellcasting.forEach((s: any) => {
                      let desc = "";
                      if (s.headerEntries) desc += format5eText(s.headerEntries.join('\n')) + "\n\n";
                      
                      if (s.will) desc += `At Will: ${format5eText(s.will.join(', '))}\n`;
                      if (s.daily) {
                          for (const [key, value] of Object.entries(s.daily)) {
                              const v = value as string[];
                              desc += `${key.replace('e', '')}/day: ${format5eText(v.join(', '))}\n`;
                          }
                      }
                      if (s.spells) {
                           // Slots
                           for (const [key, value] of Object.entries(s.spells)) {
                              const slot = value as any;
                              if (slot.spells) {
                                  desc += `Level ${key}: ${format5eText(slot.spells.join(', '))}\n`;
                              }
                           }
                      }
                      
                      abilities.push({
                          name: s.name || "Spellcasting",
                          type: 'spell',
                          description: desc
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
                speed: finalSpeed,
                stats: {
                    str: m.str || 10,
                    dex: m.dex || 10,
                    con: m.con || 10,
                    int: m.int || 10,
                    wis: m.wis || 10,
                    cha: m.cha || 10
                },
                cr: finalCr,
                abilities: abilities
              };
          });

          setMonsters(prev => [...prev, ...newMonsters]);
          setImportJson('');
          setShowImport(false);
      } catch (e) {
          console.error(e);
          alert("Invalid JSON format. Check console for details.");
      }
  };

  const filteredMonsters = monsters.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));

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

        <div className="relative">
          <Search className="absolute left-2 top-2 text-slate-500" size={14} />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder={activeTab === 'BESTIARY' ? "Search monsters..." : "Search spells..."}
            className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
          />
        </div>
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
                    {spellResults.length === 0 && <div className="text-center text-slate-600 text-xs mt-4">Type to search spells...</div>}
                </div>
             )
        ) : (
            <>
                {selectedMonster ? (
                     <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <button onClick={() => setSelectedMonster(null)} className="text-xs text-blue-400 mb-2 hover:underline">← Back</button>
                        <div className="flex gap-4 mb-4">
                            {selectedMonster.avatarUrl && <img src={selectedMonster.avatarUrl} className="w-16 h-16 rounded-full border border-slate-600 bg-black object-cover" />}
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
                            {selectedMonster.abilities?.map((ab, i) => (
                                <div key={i} className="text-sm">
                                    <span className="font-bold text-indigo-300 block">{ab.name} ({ab.type})</span>
                                    <span className="text-slate-400">{ab.description}</span>
                                </div>
                            ))}
                            {(!selectedMonster.abilities || selectedMonster.abilities.length === 0) && (
                                <p className="text-xs text-slate-500 italic">No special abilities parsed.</p>
                            )}
                        </div>
                     </div>
                ) : (
                    <>
                        <div className="mb-2 flex justify-end">
                            <button 
                                onClick={() => setShowImport(true)}
                                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700"
                            >
                                <FileJson size={10} /> Import JSON
                            </button>
                        </div>
                        <div className="space-y-2">
                            {filteredMonsters.map((monster, idx) => (
                                <div 
                                    key={`${monster.name}-${idx}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, monster)}
                                    className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500 rounded cursor-grab active:cursor-grabbing transition-all group relative flex gap-3 items-center"
                                >
                                    {monster.avatarUrl ? (
                                        <img src={monster.avatarUrl} alt={monster.name} className="w-10 h-10 rounded-full object-cover border border-slate-600 bg-black" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-500">
                                            {monster.name[0]}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-sm text-red-200 truncate">{monster.name}</div>
                                            <div className="flex gap-2">
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
