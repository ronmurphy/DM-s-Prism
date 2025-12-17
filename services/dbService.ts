
import { Monster, Character, Spell } from '../types';

const DB_NAME = 'DMsPrismDB';
const DB_VERSION = 3; // Bumped to trigger upgrade for compendium store

// Helper to convert an image URL to a Base64 string for local storage
export const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Failed to convert ${url} to base64 (likely CORS). Saving original URL.`, error);
    return url;
  }
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("IndexedDB Open Error:", (event.target as any).error);
        reject('IndexedDB error: ' + (event.target as any).error);
    };

    request.onupgradeneeded = (event) => {
      console.log(`Upgrading DB to version ${DB_VERSION}...`);
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for User's Saved Monsters (Bestiary)
      if (!db.objectStoreNames.contains('monsters')) {
        db.createObjectStore('monsters', { keyPath: 'name' });
      }

      // Store for Player Characters
      if (!db.objectStoreNames.contains('characters')) {
        db.createObjectStore('characters', { keyPath: 'id' });
      }

      // Store for Spells
      if (!db.objectStoreNames.contains('spells')) {
        db.createObjectStore('spells', { keyPath: 'name' });
      }
      
      // Store for Maps
      if (!db.objectStoreNames.contains('maps')) {
        db.createObjectStore('maps', { keyPath: 'id', autoIncrement: true });
      }

      // NEW: Store for External Reference Data (Compendium Cache)
      // We use out-of-line keys (manual keys) for this store
      if (!db.objectStoreNames.contains('compendium')) {
        db.createObjectStore('compendium'); 
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
  });
};

// --- Generic Helpers ---

const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    
    // Ensure transaction closes
    transaction.oncomplete = () => db.close();
  });
};

const put = async <T>(storeName: string, item: T, key?: IDBValidKey): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // If key is provided, use it (for out-of-line keys like compendium)
    // If not, assume in-line key (like monsters.name)
    const request = key ? store.put(item, key) : store.put(item); 
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
};

const get = async <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
};

const remove = async (storeName: string, key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

// --- Specific Exports ---

export const getSavedMonsters = () => getAll<Monster>('monsters');

export const saveMonster = async (monster: Monster) => {
  // Try to cache the image locally so 3D/Canvas works offline/without CORS
  let finalMonster = { ...monster };
  if (monster.avatarUrl && monster.avatarUrl.startsWith('http')) {
      const base64 = await urlToBase64(monster.avatarUrl);
      finalMonster.avatarUrl = base64;
  }
  return put('monsters', finalMonster);
};

export const deleteMonster = (name: string) => remove('monsters', name);

export const getSavedCharacters = () => getAll<Character>('characters');
export const saveCharacter = (char: Character) => put('characters', char);
export const deleteCharacter = (id: string) => remove('characters', id);

export const getSavedSpells = () => getAll<Spell>('spells');
export const saveSpell = (spell: Spell) => put('spells', spell);

// --- Compendium Cache ---
// Used to store bulk JSON data from 5e.tools so we don't fetch it every time

export const saveCompendiumData = (key: string, data: any[]) => put('compendium', data, key);
export const getCompendiumData = (key: string) => get<any[]>('compendium', key);
