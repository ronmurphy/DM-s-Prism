import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Skull, GripVertical, FileJson, Info, Save, Globe, Database, Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { searchSpells } from '../services/libraryService';
import { search5eTools, getCompendiumStatus, load5eToolsData } from '../services/fiveToolsService';
import { getSavedMonsters, saveMonster, deleteMonster, saveCompendiumData } from '../services/dbService';
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
  const [resultSource, setResultSource] = useState<'5e.tools' | 'open5e' | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null); // Name of monster currently saving
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  
  // Compendium Status
  const [compendiumStats, setCompendiumStats] = useState<{ totalCached: number, isComplete: boolean } | null>(null);

  // Load saved monsters from IndexedDB on mount
  useEffect(() => {
    loadLibrary();
    checkCompendium();
  }, []);

  const loadLibrary = async () => {
      try {
          const monsters = await getSavedMonsters();
          setSavedMonsters(monsters);
      } catch (e) {
          console.error("Failed to load library from DB", e);
      }
  };
  
  const checkCompendium = async () => {
      const stats = await getCompendiumStatus();
      setCompendiumStats({ totalCached: stats.totalCached, isComplete: stats.isComplete });
  };

  const handleDownloadCompendium = async () => {
      setLoadingMessage("Starting Download...");
      setIsSearching(true);
      await load5eToolsData(true, (msg) => setLoadingMessage(msg));
      await checkCompendium();
      setIsSearching(false);
      setLoadingMessage(null);
  };

  const handleSaveMonster = async (monster: Monster) => {
     setIsSaving(monster.name);
     try {
         await saveMonster(monster);
         await loadLibrary(); // Refresh list
     } catch (e) {
         console.error("Save failed", e);
         alert("Failed to save monster to local DB. See console.");
     } finally {
         setIsSaving(null);
     }
  };

  const handleDeleteSavedMonster = async (name: string) => {
      await deleteMonster(name);
      await loadLibrary();
  };

  // Unified Search Logic
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'SPELLS') {
        if (query.length > 1) {
            setSpellResults(searchSpells(query));
        }
    } else {
        if (!query) return;
        setIsSearching(true);
        setSearchResults([]);
        
        try {
            // 1. Try 5e.tools (Cached or Network)
            // We pass a progress callback to update UI if it's downloading for the first time
            const fiveToolsResults = await search5eTools(query, (msg) => setLoadingMessage(msg));
            await checkCompendium(); // Update stats after search potentially loads data
            setLoadingMessage(null);

            if (fiveToolsResults.length > 0) {
                setSearchResults(fiveToolsResults);
                setResultSource('5e.tools');
                setSubTab('SEARCH');
            } else {
                 // 2. Fallback to Open5e
                 const { monsters } = await searchMonstersOpen5e(query);
                 setSearchResults(monsters);
                 setResultSource('open5e');
                 setSubTab('SEARCH');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    }
  };

  const handleDragStart = (e: React.DragEvent, monster: Monster) => {
    let finalMonster = { ...monster };
    // Ensure default
    if (!finalMonster.size) finalMonster.size = 1;

    e.dataTransfer.setData('application/json', JSON.stringify(finalMonster));
    e.dataTransfer.effectAllowed = 'copy';
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
  
      setIsSaving("Reading files...");
      
      Array.from(files).forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const json = JSON.parse(ev.target?.result as string);
                  // Check format: 5e.tools typically uses { monster: [...] }
                  let monsters = [];
                  if (Array.isArray(json)) {
                      monsters = json;
                  } else if (json.monster && Array.isArray(json.monster)) {
                      monsters = json.monster;
                  }
                  
                  if (monsters.length > 0) {
                       // Save to compendium cache using filename as key
                       console.log(`Manually caching ${file.name} with ${monsters.length} entries.`);
                       await saveCompendiumData(file.name, monsters);
                  } else {
                      // Fallback: Try to import as individual saved monsters
                      setImportJson(JSON.stringify(json)); // Pass to text parser
                  }
              } catch (err) {
                  console.error(`Error parsing ${file.name}`, err);
              }
          };
          reader.readAsText(file);
      });
      
      // Reload logic after short delay
      setTimeout(async () => {
          await load5eToolsData(false); // Reload cache from DB
          await checkCompendium();
          setIsSaving(null);
          setShowImport(false);
      }, 1500);
  };

  const parse5eToolsImport = async () => {
      try {
          const data = JSON.parse(importJson);
          const list = Array.isArray(data) ? data : [data];
          
          setIsSaving("Importing...");

          for (const m of list) {
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

              const monsterObj: Monster = {
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

              await saveMonster(monsterObj);
          }

          await loadLibrary();
          setImportJson('');
          setShowImport(false);
          setSubTab('SAVED');
      } catch (e) {
          console.error(e);
          alert("Invalid JSON format or Import Error.");
      } finally {
          setIsSaving(null);
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
            placeholder={activeTab === 'BESTIARY' ? "Search..." : "Search spells..."}
            className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
          />
        </form>

        {activeTab === 'BESTIARY' && (
            <div className="flex text-xs mt-2 border-b border-slate-700">
                <button 
                    onClick={() => setSubTab('SAVED')}
                    className={`px-3 py-1 flex items-center gap-2 ${subTab === 'SAVED' ? 'text-indigo-400 border-b border-indigo-500' : 'text-slate-500'}`}
                >
                    <Database size={10} /> Local ({savedMonsters.length})
                </button>
                <button 
                     onClick={() => setSubTab('SEARCH')}
                     className={`px-3 py-1 flex items-center gap-2 ${subTab === 'SEARCH' ? 'text-indigo-400 border-b border-indigo-500' : 'text-slate-500'}`}
                >
                    <Globe size={10} /> Online
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
                        <div className="mb-2 flex justify-between items-center">
                             <div className="text-xs text-slate-500 italic py-1">
                                {subTab === 'SAVED' ? 'Stored in IndexedDB' : (
                                    isSearching ? 'Searching...' : 
                                    (resultSource === '5e.tools' ? 'Results from 5eTools' : 
                                     resultSource === 'open5e' ? 'Results from Open5e' : 'Online Search')
                                )}
                             </div>
                            <button 
                                onClick={() => setShowImport(true)}
                                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700"
                            >
                                <FileJson size={10} /> Import JSON
                            </button>
                        </div>

                        {subTab === 'SEARCH' && isSearching && (
                            <div className="flex flex-col items-center justify-center py-6 text-indigo-400">
                                <Loader2 size={24} className="animate-spin mb-2" />
                                <span className="text-sm">{loadingMessage || 'Summoning data...'}</span>
                                {loadingMessage && <span className="text-[10px] text-slate-500 mt-1 text-center max-w-[200px]">Downloading compendium for offline use... This happens once.</span>}
                            </div>
                        )}
                        
                        {subTab === 'SEARCH' && !isSearching && searchResults.length === 0 && (
                            <div className="text-center text-slate-600 text-xs py-4">
                                No results found. 
                                {compendiumStats && compendiumStats.totalCached === 0 && (
                                    <div className="mt-2 text-orange-400">Cache is empty.</div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            {(subTab === 'SAVED' ? savedMonsters : searchResults).map((monster, idx) => (
                                <div 
                                    key={`${monster.name}-${idx}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, monster)}
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
                                                     <button 
                                                        onClick={() => handleSaveMonster(monster)} 
                                                        className="text-slate-500 hover:text-green-400 disabled:opacity-50" 
                                                        title="Save to Library"
                                                        disabled={isSaving === monster.name}
                                                     >
                                                         {isSaving === monster.name ? <Download size={14} className="animate-bounce" /> : <Save size={14}/>}
                                                     </button>
                                                 )}
                                                 {subTab === 'SAVED' && (
                                                     <button onClick={() => handleDeleteSavedMonster(monster.name)} className="text-slate-600 hover:text-red-400" title="Remove"><Skull size={14}/></button>
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

      {/* Compendium Status Footer */}
      {activeTab === 'BESTIARY' && (
          <div className="bg-slate-950 p-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <Database size={10} />
                  {compendiumStats ? (
                      <span>Cache: {compendiumStats.totalCached} monsters</span>
                  ) : (
                      <span>Checking Cache...</span>
                  )}
              </div>
              
              {!loadingMessage && compendiumStats && !compendiumStats.isComplete && (
                  <button 
                    onClick={handleDownloadCompendium} 
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 px-2 py-1 rounded border border-slate-700 transition-colors"
                  >
                     <Download size={10} /> Download All
                  </button>
              )}
               {!loadingMessage && compendiumStats && compendiumStats.isComplete && (
                   <span className="text-green-600 flex items-center gap-1"><RefreshCw size={10} /> Up to date</span>
               )}
          </div>
      )}

      {showImport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-full max-w-md shadow-2xl">
                  <h3 className="font-bold text-white mb-2">Import from 5e.tools</h3>
                  
                  <div className="space-y-4">
                      {/* File Upload Option */}
                      <div className="border-2 border-dashed border-slate-700 rounded p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer relative group">
                          <Upload size={24} className="mx-auto mb-2 text-slate-500 group-hover:text-indigo-400" />
                          <p className="text-xs text-slate-400 mb-1">Upload Source JSON (e.g. bestiary-mm.json)</p>
                          <p className="text-[10px] text-slate-600">This will cache the book locally.</p>
                          <input 
                              type="file" 
                              accept=".json" 
                              multiple 
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={handleFileUpload}
                          />
                      </div>
                      
                      <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-slate-800" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-slate-900 px-2 text-slate-600">Or Paste Text</span>
                          </div>
                      </div>

                      <textarea 
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-green-400 mb-3 focus:border-indigo-500 outline-none"
                        placeholder='Paste array of monsters here...'
                      />
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setShowImport(false)} className="px-3 py-1 text-xs text-slate-400">Cancel</button>
                      <button onClick={parse5eToolsImport} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded">Import Text</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LibraryWindow;