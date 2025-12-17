
import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Skull, GripVertical, FileJson, Info, Save, Globe, Database, Download, Loader2, RefreshCw, Upload, Check, ArrowLeft } from 'lucide-react';
import { searchSpells } from '../services/libraryService';
import { search5eTools, getCompendiumStatus, load5eToolsData, getSpellCompendiumStatus, load5eToolsSpellData } from '../services/fiveToolsService';
import { getSavedMonsters, saveMonster, deleteMonster, saveCompendiumData, saveSpellCompendiumData } from '../services/dbService';
import { searchMonstersOpen5e } from '../services/open5eService';
import { Spell, Monster, Ability } from '../types';

const LibraryWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SPELLS' | 'BESTIARY'>('BESTIARY');
  const [subTab, setSubTab] = useState<'SEARCH' | 'SAVED'>('SAVED');
  const [query, setQuery] = useState('');
  
  const [spellResults, setSpellResults] = useState<Spell[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

  const [savedMonsters, setSavedMonsters] = useState<Monster[]>([]);
  const [searchResults, setSearchResults] = useState<Monster[]>([]);
  const [resultSource, setResultSource] = useState<'5e.tools' | 'open5e' | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null); 
  const [showImport, setShowImport] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  
  const [compendiumStats, setCompendiumStats] = useState<{ totalCached: number, totalFiles: number } | null>(null);
  const [spellStats, setSpellStats] = useState<{ totalCached: number, totalFiles: number } | null>(null);

  useEffect(() => {
    loadLibrary();
    checkStats();
  }, []);

  // Effect to clean up search state when switching primary tabs
  useEffect(() => {
    setQuery('');
    setSpellResults([]);
    setSearchResults([]);
    setSelectedMonster(null);
    setSelectedSpell(null);
    setResultSource(null);
  }, [activeTab]);

  const loadLibrary = async () => {
      try {
          const monsters = await getSavedMonsters();
          setSavedMonsters(monsters);
      } catch (e) { console.error(e); }
  };
  
  const checkStats = async () => {
      const mStats = await getCompendiumStatus();
      const sStats = await getSpellCompendiumStatus();
      setCompendiumStats(mStats);
      setSpellStats(sStats);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setIsSearching(true);
    
    // Clear current view
    setSelectedMonster(null);
    setSelectedSpell(null);

    if (activeTab === 'SPELLS') {
        setSpellResults([]); // Clear previous
        const results = await searchSpells(query);
        setSpellResults(results);
    } else {
        setSearchResults([]); // Clear previous
        const fiveToolsResults = await search5eTools(query);
        if (fiveToolsResults.length > 0) {
            setSearchResults(fiveToolsResults);
            setResultSource('5e.tools');
            setSubTab('SEARCH');
        } else {
             const { monsters } = await searchMonstersOpen5e(query);
             setSearchResults(monsters);
             setResultSource('open5e');
             setSubTab('SEARCH');
        }
    }
    setIsSearching(false);
  };

  const handleDragStart = (e: React.DragEvent, monster: Monster) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ ...monster, size: monster.size || 1 }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
  
      setIsSaving(`Analyzing ${files.length} items...`);
      let processedCount = 0;
      
      const processFile = (file: File) => {
          return new Promise<void>((resolve) => {
              const reader = new FileReader();
              reader.onload = async (ev) => {
                  try {
                      const json = JSON.parse(ev.target?.result as string);
                      if (json.monster || (Array.isArray(json) && json[0]?.ac)) {
                           let monsters = json.monster || json;
                           await saveCompendiumData(file.name, monsters);
                           processedCount++;
                      } else if (json.spell || (Array.isArray(json) && json[0]?.school)) {
                           let spells = json.spell || json;
                           await saveSpellCompendiumData(file.name, spells);
                           processedCount++;
                      }
                  } catch (err) { console.error(err); }
                  resolve();
              };
              reader.readAsText(file);
          });
      };

      for (const file of Array.from(files) as File[]) {
          await processFile(file);
      }
      
      await load5eToolsData(true); 
      await load5eToolsSpellData(true);
      await checkStats();
      setIsSaving(null);
      setShowImport(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex gap-2 mb-3 bg-slate-900 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('BESTIARY')} 
                className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'BESTIARY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                <Skull size={14} /> Bestiary
            </button>
            <button 
                onClick={() => setActiveTab('SPELLS')} 
                className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'SPELLS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
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
            placeholder={`Search ${activeTab.toLowerCase()}...`} 
            className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:border-indigo-500 outline-none" 
          />
        </form>

        {activeTab === 'BESTIARY' && (
            <div className="flex text-xs mt-2 border-b border-slate-700">
                <button 
                    onClick={() => { setSubTab('SAVED'); setSelectedMonster(null); }} 
                    className={`px-3 py-1 flex items-center gap-2 transition-all ${subTab === 'SAVED' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Database size={10} /> Local ({savedMonsters.length})
                </button>
                <button 
                    onClick={() => { setSubTab('SEARCH'); setSelectedMonster(null); }} 
                    className={`px-3 py-1 flex items-center gap-2 transition-all ${subTab === 'SEARCH' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Globe size={10} /> Online
                </button>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Detail View: Spell */}
        {activeTab === 'SPELLS' && selectedSpell && (
            <div className="bg-slate-800 p-4 rounded border border-slate-700 animate-fade-in">
              <button onClick={() => setSelectedSpell(null)} className="text-xs text-blue-400 mb-4 hover:underline flex items-center gap-1">
                <ArrowLeft size={12} /> Back to Results
              </button>
              <h2 className="text-xl font-serif font-bold text-white mb-1">{selectedSpell.name}</h2>
              <div className="text-xs text-slate-400 italic mb-4">Level {selectedSpell.level} {selectedSpell.school}</div>
              
              <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] uppercase font-bold text-slate-500">
                  <div className="bg-slate-900 p-2 rounded">Time: <span className="text-white block">{selectedSpell.castingTime}</span></div>
                  <div className="bg-slate-900 p-2 rounded">Range: <span className="text-white block">{selectedSpell.range}</span></div>
                  <div className="bg-slate-900 p-2 rounded">Comp: <span className="text-white block">{selectedSpell.components}</span></div>
                  <div className="bg-slate-900 p-2 rounded">Dur: <span className="text-white block">{selectedSpell.duration}</span></div>
              </div>

              <div className="text-sm text-slate-300 leading-relaxed border-t border-slate-700 pt-3 whitespace-pre-line">{selectedSpell.description}</div>
            </div>
        )}

        {/* Detail View: Monster */}
        {activeTab === 'BESTIARY' && selectedMonster && (
            <div className="bg-slate-800 p-4 rounded border border-slate-700 animate-fade-in">
                <button onClick={() => setSelectedMonster(null)} className="text-xs text-blue-400 mb-4 hover:underline flex items-center gap-1">
                    <ArrowLeft size={12} /> Back to Results
                </button>
                <div className="flex gap-4 mb-4">
                    {selectedMonster.avatarUrl && <img src={selectedMonster.avatarUrl} className="w-16 h-16 rounded-full border border-slate-600 bg-black object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }}/>}
                    <div>
                        <h2 className="text-xl font-serif font-bold text-white">{selectedMonster.name}</h2>
                        <div className="text-xs text-slate-400 italic">{selectedMonster.type} • CR {selectedMonster.cr}</div>
                        <div className="flex gap-2 mt-2 text-xs">
                                <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded">HP {selectedMonster.hp}</span>
                                <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">AC {selectedMonster.ac}</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-6 gap-1 text-center text-[10px] mb-4 bg-slate-950 p-2 rounded border border-slate-700">
                    <div><div className="text-slate-500">STR</div><div className="font-bold">{selectedMonster.stats.str}</div></div>
                    <div><div className="text-slate-500">DEX</div><div className="font-bold">{selectedMonster.stats.dex}</div></div>
                    <div><div className="text-slate-500">CON</div><div className="font-bold">{selectedMonster.stats.con}</div></div>
                    <div><div className="text-slate-500">INT</div><div className="font-bold">{selectedMonster.stats.int}</div></div>
                    <div><div className="text-slate-500">WIS</div><div className="font-bold">{selectedMonster.stats.wis}</div></div>
                    <div><div className="text-slate-500">CHA</div><div className="font-bold">{selectedMonster.stats.cha}</div></div>
                </div>

                <div className="space-y-4">
                    {selectedMonster.abilities?.map((ab, i) => (
                        <div key={i} className="text-sm border-b border-slate-700/50 pb-2 last:border-0">
                            <span className="font-bold text-indigo-300 block mb-1">{ab.name} <span className="text-[10px] text-slate-500 uppercase ml-1">({ab.type})</span></span>
                            <span className="text-slate-400 text-xs whitespace-pre-line">{ab.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Results List: Spells */}
        {activeTab === 'SPELLS' && !selectedSpell && (
            <div className="space-y-1">
                {isSearching && <div className="text-center py-6 text-indigo-400"><Loader2 className="animate-spin mx-auto mb-2" /> Searching Spells...</div>}
                {!isSearching && spellResults.length === 0 && query && <div className="text-center py-8 text-slate-600 text-sm italic">No spells found matching "{query}"</div>}
                {spellResults.map(spell => (
                <div key={spell.name} onClick={() => setSelectedSpell(spell)} className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors group flex justify-between items-center">
                    <div>
                        <div className="font-bold text-sm text-indigo-300 group-hover:text-indigo-200">{spell.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{spell.school} • Level {spell.level}</div>
                    </div>
                    <Info size={14} className="text-slate-600 group-hover:text-white" />
                </div>))}
            </div>
        )}

        {/* Results List: Monsters */}
        {activeTab === 'BESTIARY' && !selectedMonster && (
            <div className="space-y-2">
                {isSearching && <div className="text-center py-6 text-indigo-400"><Loader2 className="animate-spin mx-auto mb-2" /> Summoning Bestiary...</div>}
                
                {/* Source Identifier */}
                {!isSearching && subTab === 'SEARCH' && resultSource && (
                    <div className="px-1 text-[10px] text-slate-600 flex justify-between items-center">
                        <span>Results from {resultSource === '5e.tools' ? 'Local Compendium' : 'Open5e API'}</span>
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 uppercase">{searchResults.length} Found</span>
                    </div>
                )}

                {(subTab === 'SAVED' ? savedMonsters : searchResults).map((monster, idx) => (
                    <div 
                        key={`${monster.name}-${idx}`} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, monster)} 
                        className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500 rounded cursor-grab active:cursor-grabbing transition-all group relative flex gap-3 items-center shadow-md"
                    >
                        {monster.avatarUrl && (
                            <img 
                                src={monster.avatarUrl} 
                                alt={monster.name} 
                                className="w-10 h-10 rounded-full object-cover border border-slate-600 bg-black flex-shrink-0" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-sm text-red-200 truncate group-hover:text-white">{monster.name}</div>
                                <div className="flex gap-2">
                                    {subTab === 'SEARCH' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); saveMonster(monster).then(loadLibrary); }} 
                                            className="text-slate-500 hover:text-green-400 transition-colors" 
                                            title="Save to Pin"
                                        >
                                            <Save size={14}/>
                                        </button>
                                    )}
                                    {subTab === 'SAVED' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteMonster(monster.name).then(loadLibrary); }} 
                                            className="text-slate-500 hover:text-red-400 transition-colors" 
                                            title="Unpin"
                                        >
                                            <Skull size={14}/>
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setSelectedMonster(monster); }} 
                                        className="text-slate-500 hover:text-white transition-colors"
                                    >
                                        <Info size={14}/>
                                    </button>
                                    <GripVertical size={16} className="text-slate-600 group-hover:text-indigo-400" />
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500 italic truncate uppercase tracking-widest">{monster.type} • CR {monster.cr}</div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      <div className="bg-slate-950 p-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1"><Database size={8} /> {compendiumStats?.totalCached || 0} Monsters ({compendiumStats?.totalFiles || 0} books)</span>
              <span className="flex items-center gap-1"><BookOpen size={8} /> {spellStats?.totalCached || 0} Spells ({spellStats?.totalFiles || 0} books)</span>
          </div>
          <button onClick={() => setShowImport(true)} className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700 transition-colors">
              <FileJson size={10} /> Library Manager
          </button>
      </div>

      {showImport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-full max-w-md shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white flex items-center gap-2"><FileJson size={18} className="text-indigo-400" /> Library Manager</h3>
                      <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-white transition-colors"><Check size={20}/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer relative group bg-slate-950/50">
                          {isSaving ? (
                              <div className="flex flex-col items-center gap-3">
                                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                                  <p className="text-xs text-indigo-400 font-bold">{isSaving}</p>
                              </div>
                          ) : (
                              <>
                                <Upload size={32} className="mx-auto mb-2 text-slate-500 group-hover:text-indigo-400 transition-all" />
                                <p className="text-sm text-slate-200 font-bold">Drop 5e.tools JSON Files</p>
                                <p className="text-xs text-slate-500 mt-1">Bestiary or Spell source files.</p>
                                <p className="text-[10px] text-indigo-500/50 mt-4 uppercase tracking-widest font-bold">Auto-detecting Format</p>
                              </>
                          )}
                          <input type="file" accept=".json" multiple className="absolute inset-0 opacity-0 cursor-pointer disabled:hidden" onChange={handleFileUpload} disabled={!!isSaving} />
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
                      <button onClick={() => setShowImport(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded transition-colors">Close Manager</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LibraryWindow;
