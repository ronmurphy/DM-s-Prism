import React, { useState, useEffect } from 'react';
import { User, Character } from '../types';
import { Shield, Download, User as UserIcon, LogIn, Trash2, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { mapCharFromDB, mapCharToDB } from '../services/supabaseService';
import { parseCharacterPdf } from '../services/geminiService';

interface SplashScreenProps {
  onLogin: (user: User) => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'SELECT' | 'DM' | 'PLAYER'>('SELECT');
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [savedChars, setSavedChars] = useState<Character[]>([]);

  useEffect(() => {
    // Load characters from Supabase
    const fetchChars = async () => {
      const { data, error } = await supabase.from('characters').select('*');
      if (data) {
        setSavedChars(data.map(mapCharFromDB));
      }
    };
    fetchChars();
  }, []);

  const handleDmLogin = () => {
    onLogin({ id: 'dm-1', name: 'Dungeon Master', role: 'DM' });
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file.");
      return;
    }

    setIsLoading(true);
    setLoadingStep('Reading Scroll...');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64Pdf = ev.target?.result as string;
        
        setLoadingStep('Deciphering Runes (AI Extraction)...');
        const extractedData = await parseCharacterPdf(base64Pdf);
        
        // Construct full character object
        const newCharacter: Character = {
          id: generateUUID(),
          name: extractedData.name || playerName || "Unknown Hero",
          class: extractedData.class || "Commoner 1",
          level: extractedData.level || 1,
          stats: extractedData.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          maxHp: extractedData.maxHp || 10,
          ac: extractedData.ac || 10,
          speed: extractedData.speed || 30,
          avatarUrl: 'https://www.dndbeyond.com/content/skins/waterdeep/images/characters/default-avatar.png',
          ddbLink: 'PDF Import'
        };

        setLoadingStep('Saving to Database...');
        const { error } = await supabase.from('characters').insert(mapCharToDB(newCharacter));

        if (!error) {
           setSavedChars(prev => [...prev, newCharacter]);
           // Auto-login
           onLogin({ 
             id: newCharacter.id, 
             name: newCharacter.name, 
             role: 'PLAYER', 
             characterId: newCharacter.id 
           });
        } else {
           console.error(error);
           alert("Failed to save character to database.");
        }

      } catch (err) {
        console.error(err);
        alert("Failed to parse PDF. Please try a different file.");
      } finally {
        setIsLoading(false);
        setLoadingStep('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectChar = (char: Character) => {
    onLogin({ id: char.id, name: char.name, role: 'PLAYER', characterId: char.id });
  };

  const deleteChar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (!error) {
        const newChars = savedChars.filter(c => c.id !== id);
        setSavedChars(newChars);
    }
  };

  if (mode === 'SELECT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-200 p-4">
        <div className="mb-8 text-center animate-fade-in">
          <Shield size={64} className="text-indigo-500 mx-auto mb-4" />
          <h1 className="text-4xl font-serif font-bold text-white mb-2">Dungeon Master's Prism</h1>
          <p className="text-slate-400">The Ultimate Virtual Tabletop Experience</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
          <div 
            onClick={() => setMode('PLAYER')}
            className="bg-slate-900 border border-slate-700 hover:border-green-500 p-8 rounded-xl cursor-pointer transition-all hover:scale-105 group"
          >
            <UserIcon size={48} className="text-green-500 mb-4 group-hover:text-green-400" />
            <h2 className="text-2xl font-bold mb-2">Player</h2>
            <p className="text-slate-400 text-sm">Join a session, import your character, and roll for initiative.</p>
          </div>

          <div 
            onClick={() => setMode('DM')}
            className="bg-slate-900 border border-slate-700 hover:border-indigo-500 p-8 rounded-xl cursor-pointer transition-all hover:scale-105 group"
          >
            <Shield size={48} className="text-indigo-500 mb-4 group-hover:text-indigo-400" />
            <h2 className="text-2xl font-bold mb-2">Dungeon Master</h2>
            <p className="text-slate-400 text-sm">Host a game, build maps with AI, and control the world.</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'DM') {
     return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <div className="bg-slate-900 p-8 rounded-lg border border-slate-700 w-96 text-center">
                <h2 className="text-2xl font-bold mb-6">DM Access</h2>
                <button 
                  onClick={handleDmLogin}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-colors"
                >
                    Enter Campaign
                </button>
                <button onClick={() => setMode('SELECT')} className="mt-4 text-slate-500 text-sm hover:text-white">Back</button>
            </div>
        </div>
     );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200">
      <div className="bg-slate-900 p-8 rounded-lg border border-slate-700 w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <UserIcon className="text-green-500" /> Player Login
        </h2>

        {/* Saved Characters */}
        {savedChars.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Community Characters</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedChars.map(char => (
                <div 
                  key={char.id}
                  onClick={() => handleSelectChar(char)}
                  className="flex items-center gap-4 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors group"
                >
                  <img src={char.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-500" />
                  <div className="flex-1">
                    <div className="font-bold text-white">{char.name}</div>
                    <div className="text-xs text-slate-400">{char.class} • Level {char.level}</div>
                  </div>
                  <button onClick={(e) => deleteChar(e, char.id)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Import */}
        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Import Character Sheet</h3>
          
          {isLoading ? (
             <div className="bg-slate-950 border border-slate-700 rounded p-6 flex flex-col items-center justify-center text-center animate-pulse">
                <Loader2 size={32} className="text-green-500 animate-spin mb-3" />
                <p className="text-green-400 font-bold">{loadingStep}</p>
                <p className="text-xs text-slate-500 mt-2">Gemini is reading your PDF...</p>
             </div>
          ) : (
            <div className="space-y-3">
               <div className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-green-900/20 group-hover:bg-green-900/30 border-2 border-dashed border-slate-700 group-hover:border-green-500 rounded-lg transition-all" />
                  <div className="relative p-6 flex flex-col items-center justify-center text-center">
                      <FileText size={32} className="text-slate-400 group-hover:text-green-400 mb-2 transition-colors" />
                      <p className="font-bold text-slate-300 group-hover:text-white">Upload D&D Beyond PDF</p>
                      <p className="text-xs text-slate-500 mt-1">Accepts standard 5e PDF Character Sheets</p>
                      <input 
                         type="file" 
                         accept="application/pdf"
                         onChange={handleFileUpload}
                         className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                  </div>
               </div>
               
               <p className="text-xs text-slate-500 text-center">
                 *Your PDF will be analyzed by Gemini AI to extract stats, HP, and class info automatically.
               </p>
            </div>
          )}
        </div>

        <button onClick={() => setMode('SELECT')} className="mt-6 text-slate-500 text-sm hover:text-white w-full">Back</button>
      </div>
    </div>
  );
};

export default SplashScreen;