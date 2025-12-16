import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Box, Eye, MessageSquare, 
  Settings, Upload, Zap, Wand2, Sword, BookOpen, LogOut, FileText, SkipForward,
  ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { MapData, Token, ChatMessage, Role, DiceRoll, User, Character } from './types';
import DiceRoller from './components/DiceRoller';
import ChatWindow from './components/ChatWindow';
import MapRenderer from './components/MapRenderer';
import SplashScreen from './components/SplashScreen';
import CombatTracker from './components/CombatTracker';
import LibraryWindow from './components/LibraryWindow';
import TokenEditor from './components/TokenEditor';
import CharacterSheet from './components/CharacterSheet';
import { editMapImage } from './services/geminiService';
import { supabase } from './lib/supabaseClient';
import { mapTokenFromDB, mapMessageFromDB, updateTokenInDB, sendMessageToDB, uploadMapImage, createTokenInDB, mapCharFromDB } from './services/supabaseService';

const DEFAULT_MAP_URL = 'https://picsum.photos/1200/800'; 

type RightSidebarTab = 'CHAT' | 'LIBRARY' | 'SHEET';

const App: React.FC = () => {
  // Session State
  const [user, setUser] = useState<User | null>(null);
  
  // Layout State
  const [showCombatSidebar, setShowCombatSidebar] = useState(true); // Left
  const [showRightSidebar, setShowRightSidebar] = useState(true);   // Right
  const [activeRightTab, setActiveRightTab] = useState<RightSidebarTab>('CHAT');
  
  // Game State
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mapData, setMapData] = useState<MapData>({
    imageUrl: DEFAULT_MAP_URL,
    gridSize: 50,
    width: 1200,
    height: 800,
    fogRevealed: []
  });

  // Turn Management
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);

  // Player Character Data (for Sheet)
  const [playerChar, setPlayerChar] = useState<Character | null>(null);
  
  // UI State
  const [isEditingMap, setIsEditingMap] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [promptText, setPromptText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Realtime Initialization ---
  useEffect(() => {
    const fetchData = async () => {
        // Map
        const { data: mapRows } = await supabase.from('map_state').select('*').eq('id', 1).single();
        if (mapRows) {
            setMapData(prev => ({ 
                ...prev, 
                imageUrl: mapRows.image_url, 
                width: mapRows.width || 1200, 
                height: mapRows.height || 800 
            }));
        } else {
            await uploadMapImage(DEFAULT_MAP_URL);
        }

        // Tokens
        const { data: tokenRows } = await supabase.from('tokens').select('*');
        if (tokenRows) {
            setTokens(tokenRows.map(mapTokenFromDB));
        }

        // Messages
        const { data: msgRows } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
        if (msgRows) {
            setMessages(msgRows.map(mapMessageFromDB));
        }
    };

    fetchData();

    const channel = supabase.channel('game_events')
    .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'tokens' }, 
        (payload) => {
            if (payload.eventType === 'INSERT') {
                setTokens(prev => [...prev, mapTokenFromDB(payload.new)]);
            } else if (payload.eventType === 'UPDATE') {
                setTokens(prev => prev.map(t => t.id === payload.new.id ? mapTokenFromDB(payload.new) : t));
            } else if (payload.eventType === 'DELETE') {
                setTokens(prev => prev.filter(t => t.id !== payload.old.id));
            }
        }
    )
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
            setMessages(prev => [...prev, mapMessageFromDB(payload.new)]);
        }
    )
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'map_state' },
        (payload) => {
            if (payload.new && payload.new.image_url) {
                 setMapData(prev => ({
                     ...prev,
                     imageUrl: payload.new.image_url
                 }));
            }
        }
    )
    .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);


  // --- Handlers ---

  const handleLogin = async (newUser: User) => {
    setUser(newUser);
    
    if (newUser.role === 'PLAYER' && newUser.characterId) {
       // Fetch Char Data
       const { data: charData } = await supabase.from('characters').select('*').eq('id', newUser.characterId).single();
       if (charData) {
         setPlayerChar(mapCharFromDB(charData));
       }

       // Check token existence
       const existingToken = tokens.find(t => t.characterSheetId === newUser.characterId);
       
       if (!existingToken && charData) {
            const newToken: Token = {
                id: '', 
                name: charData.name,
                x: 2, y: 2,
                type: 'pc',
                color: '#22c55e',
                hp: charData.max_hp || 30,
                maxHp: charData.max_hp || 30,
                ac: charData.ac || 14,
                speed: charData.speed || 30,
                remainingMovement: charData.speed || 30,
                size: 1, 
                initiative: 0, 
                statusEffects: [],
                avatarUrl: charData.avatar_url,
                characterSheetId: newUser.characterId 
            };
            await createTokenInDB(newToken);
       }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPlayerChar(null);
  };

  const handleTokenMove = (id: string, x: number, y: number) => {
    const token = tokens.find(t => t.id === id);
    if (!token) return;
    
    // Permissions & Turn Enforcement
    if (user?.role === 'PLAYER') {
        // Can only move own token
        const isOwnToken = token.id === user.characterId || token.characterSheetId === user.characterId || token.name === user.name;
        if (!isOwnToken) return;

        // STRICT TURN ENFORCEMENT
        if (activeTokenId && activeTokenId !== token.id) {
            handleSendMessage(`❌ It is not your turn! Wait for ${tokens.find(t => t.id === activeTokenId)?.name}.`, 'system', user.name);
            return; 
        }

        // Movement Budget Check
        const distanceX = Math.abs(x - token.x);
        const distanceY = Math.abs(y - token.y);
        const distanceInCells = Math.max(distanceX, distanceY);
        const cost = distanceInCells * 5;

        if (token.remainingMovement < cost) {
            handleSendMessage(`❌ Not enough movement!`, 'system', user.name);
            return;
        }

        // Apply Move
        const updated = { 
            ...token, 
            x, 
            y, 
            remainingMovement: token.remainingMovement - cost 
        };
        setTokens(prev => prev.map(t => t.id === id ? updated : t));
        updateTokenInDB(updated);
    } else {
        // DM can move anything anywhere
        const updated = { ...token, x, y };
        setTokens(prev => prev.map(t => t.id === id ? updated : t));
        updateTokenInDB(updated);
    }
  };

  const handleUpdateToken = (updated: Token) => {
    setTokens(prev => prev.map(t => t.id === updated.id ? updated : t));
    updateTokenInDB(updated);
  };

  const handleSendMessage = (content: string, type: 'public' | 'whisper' | 'system', recipient?: string) => {
    if (!user) return;
    sendMessageToDB({
        sender: user.name,
        role: user.role,
        content,
        type,
        recipient
    });
  };

  const handleDiceRoll = (roll: DiceRoll) => {
    const content = `Rolled ${roll.formula}: ${roll.total} (${roll.breakdown})`;
    handleSendMessage(content, 'system');
  };

  const handleRollInitiative = (total: number) => {
      if (!playerChar) return;
      const myToken = tokens.find(t => t.characterSheetId === playerChar.id);
      if (myToken) {
          const updated = { ...myToken, initiative: total };
          handleUpdateToken(updated);
          handleSendMessage(`${playerChar.name} rolled Initiative: ${total}`, 'system');
      }
  };

  const handleFogReveal = (x: number, y: number, radius: number) => {
    console.log(`Revealing fog at ${x},${y} radius ${radius}`);
  };

  const handleMapEdit = async () => {
    if (!promptText) return;
    setIsProcessing(true);
    try {
        let base64Data = mapData.imageUrl;
        if (mapData.imageUrl.startsWith('http')) {
             try {
                const response = await fetch(mapData.imageUrl);
                const blob = await response.blob();
                base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
             } catch (e) {
                 alert("CORS error fetching image. Try uploading a local image first.");
                 setIsProcessing(false);
                 return;
             }
        }

        const newImage = await editMapImage(base64Data, promptText);
        await uploadMapImage(newImage);
        handleSendMessage(`Map updated with AI: "${promptText}"`, 'system');
        setPromptText('');
        setIsEditingMap(false);
    } catch (error) {
        console.error(error);
        alert("Failed to generate map edit. Check API Key.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        await uploadMapImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextTurn = () => {
      // Sort tokens by Initiative (Descending)
      const sortedTokens = [...tokens].sort((a, b) => b.initiative - a.initiative);
      if (sortedTokens.length === 0) return;

      const currentIndex = activeTokenId ? sortedTokens.findIndex(t => t.id === activeTokenId) : -1;
      
      // Loop back to 0 if at end
      let nextIndex = currentIndex + 1;
      if (nextIndex >= sortedTokens.length) {
          nextIndex = 0;
          handleSendMessage(`🔄 Round Complete! Back to top of initiative.`, 'system');
      }
      
      const nextToken = sortedTokens[nextIndex];
      
      if (nextToken) {
          // Reset Movement for the NEW active creature
          const resetToken = { ...nextToken, remainingMovement: nextToken.speed };
          updateTokenInDB(resetToken);
          
          setActiveTokenId(nextToken.id);
          handleSendMessage(`⚔️ It is now ${nextToken.name}'s turn!`, 'system');
      }
  };

  const handleResetCombat = () => {
      setActiveTokenId(null);
      tokens.forEach(t => {
          updateTokenInDB({ ...t, remainingMovement: t.speed, initiative: 0 });
      });
      handleSendMessage(`Combat reset. Initiatives cleared.`, 'system');
  };

  const isMyTurn = () => {
      if (!user || !activeTokenId) return false;
      const myToken = tokens.find(t => t.id === activeTokenId);
      if (!myToken) return false;
      return user.role === 'DM' || myToken.name === user.name || myToken.characterSheetId === user.characterId;
  };

  if (!user) {
    return <SplashScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shadow-md z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold tracking-wider text-indigo-400 font-serif flex items-center gap-2">
            <Shield className="text-indigo-500" /> DM's Prism
          </div>
          
          {/* Active Turn Indicator in Header */}
          {activeTokenId && (
              <div className="ml-8 px-4 py-1 bg-slate-800 border border-indigo-500/50 rounded-full flex items-center gap-2 animate-pulse">
                  <span className="text-xs text-slate-400 uppercase font-bold">Current Turn:</span>
                  <span className="text-sm font-bold text-indigo-300">
                      {tokens.find(t => t.id === activeTokenId)?.name}
                  </span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* END TURN BUTTON (Header Access) */}
          {activeTokenId && isMyTurn() && (
              <button 
                onClick={handleNextTurn}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white px-4 py-1.5 rounded-full font-bold shadow-lg shadow-red-500/20 transform transition-transform active:scale-95 animate-bounce-short"
              >
                  <SkipForward size={18} /> End Turn
              </button>
          )}

          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          
          <div className="flex items-center gap-2">
             <span className="text-xs font-bold px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300">
               {user.role}: {user.name}
             </span>
             <button onClick={handleLogout} className="text-slate-500 hover:text-red-400" title="Logout">
               <LogOut size={16} />
             </button>
          </div>
          
          <button 
             onClick={() => setViewMode(prev => prev === '2D' ? '3D' : '2D')}
             className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded text-sm font-medium transition-colors border border-slate-700"
          >
            {viewMode === '2D' ? <Box size={16} /> : <Eye size={16} />}
            {viewMode === '2D' ? '3D' : '2D'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT Sidebar: COMBAT TRACKER */}
        <aside className={`${showCombatSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shrink-0`}>
             <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center whitespace-nowrap overflow-hidden">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                   <Sword size={16} className="text-red-500" /> Combat
                </span>
                {/* Close Button Inside (optional, redundant with map toggle but good UX) */}
             </div>
             <div className="flex-1 overflow-hidden">
                <CombatTracker 
                    tokens={tokens}
                    activeTokenId={activeTokenId}
                    role={user.role}
                    onUpdateToken={handleUpdateToken}
                    onNextTurn={handleNextTurn}
                    onResetCombat={handleResetCombat}
                />
             </div>
        </aside>

        {/* CENTER: MAP AREA */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
           <MapRenderer 
             mode={viewMode}
             data={mapData}
             tokens={tokens}
             currentRole={user.role}
             activeTokenId={activeTokenId}
             onTokenMove={handleTokenMove}
             onFogReveal={handleFogReveal}
             onTokenClick={(t) => {
               if (user.role === 'DM') {
                 setEditingToken(t);
               }
             }}
           />

           {/* Toggle Buttons Floating on Map */}
           <button 
             onClick={() => setShowCombatSidebar(!showCombatSidebar)}
             className="absolute top-4 left-4 z-10 p-2 bg-slate-800 border border-slate-700 rounded-r text-slate-300 hover:text-white shadow-lg"
             title="Toggle Combat Tracker"
           >
              {showCombatSidebar ? <ChevronLeft size={20} /> : <Menu size={20} />}
           </button>

           <button 
             onClick={() => setShowRightSidebar(!showRightSidebar)}
             className="absolute top-4 right-4 z-10 p-2 bg-slate-800 border border-slate-700 rounded-l text-slate-300 hover:text-white shadow-lg"
             title="Toggle Tools"
           >
              {showRightSidebar ? <ChevronRight size={20} /> : <Menu size={20} />}
           </button>


           {/* DM Toolbar (Now positioned slightly inward to avoid overlap if desired, or top center) */}
           {user.role === 'DM' && (
             <div className="absolute bottom-4 right-4 flex flex-row gap-2 bg-slate-900/90 p-2 rounded border border-slate-700 backdrop-blur-sm shadow-xl z-10">
               <label className="p-2 hover:bg-slate-700 rounded cursor-pointer text-slate-300" title="Upload Map">
                 <Upload size={20} />
                 <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
               </label>
               <button 
                 onClick={() => setIsEditingMap(!isEditingMap)}
                 className={`p-2 rounded transition-colors ${isEditingMap ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                 title="AI Map Edit"
               >
                 <Wand2 size={20} />
               </button>
             </div>
           )}

           {/* AI Edit Modal */}
           {isEditingMap && user.role === 'DM' && (
             <div className="absolute top-16 right-16 w-80 bg-slate-900 border border-indigo-500 rounded-lg shadow-2xl p-4 z-20 animate-fade-in">
                <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-2">
                  <Zap size={16} /> Nano Banana GenAI
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Describe how you want to modify the map using Gemini 2.5 Flash.
                </p>
                <textarea 
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="e.g. Add a magical fog, turn the floor to lava, make it night time..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white mb-3 focus:border-indigo-500 outline-none h-24 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setIsEditingMap(false)}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleMapEdit}
                    disabled={isProcessing || !promptText}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-bold disabled:opacity-50 flex items-center gap-1"
                  >
                    {isProcessing ? 'Thinking...' : 'Generate'}
                  </button>
                </div>
             </div>
           )}
        </div>

        {/* RIGHT Sidebar: CHAT / LIBRARY / SHEET */}
        <aside className={`${showRightSidebar ? 'w-96' : 'w-0'} transition-all duration-300 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shrink-0`}>
           {/* Sidebar Tabs */}
           <div className="flex border-b border-slate-800 whitespace-nowrap overflow-hidden">
              <button 
                onClick={() => setActiveRightTab('CHAT')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeRightTab === 'CHAT' ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
              >
                <MessageSquare size={14} /> Chat
              </button>
              <button 
                onClick={() => setActiveRightTab('LIBRARY')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeRightTab === 'LIBRARY' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
              >
                <BookOpen size={14} /> Lib
              </button>
              {user.role === 'PLAYER' && (
                 <button 
                    onClick={() => setActiveRightTab('SHEET')}
                    className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeRightTab === 'SHEET' ? 'bg-slate-800 text-green-400 border-b-2 border-green-500' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                 >
                    <FileText size={14} /> Sheet
                 </button>
              )}
           </div>

           <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
             
             {activeRightTab === 'CHAT' && (
                <div className="flex flex-col h-full p-2 gap-2">
                  <div className="flex-1 overflow-hidden">
                     <ChatWindow messages={messages} currentRole={user.role} onSendMessage={handleSendMessage} />
                  </div>
                  <div className="h-auto">
                     <DiceRoller onRoll={handleDiceRoll} />
                  </div>
                </div>
             )}

             {activeRightTab === 'LIBRARY' && (
               <LibraryWindow />
             )}

             {activeRightTab === 'SHEET' && playerChar && (
                 <CharacterSheet 
                    character={playerChar} 
                    token={tokens.find(t => t.characterSheetId === playerChar.id)}
                    onEditToken={() => {
                        const t = tokens.find(t => t.characterSheetId === playerChar.id);
                        if (t) setEditingToken(t);
                    }}
                    onRollInitiative={handleRollInitiative}
                 />
             )}
           </div>
        </aside>


        {/* Modals */}
        {editingToken && (
           <TokenEditor 
             token={editingToken} 
             onSave={(updated) => {
               handleUpdateToken(updated);
               setEditingToken(null);
             }}
             onCancel={() => setEditingToken(null)}
           />
        )}

      </div>
    </div>
  );
};

export default App;