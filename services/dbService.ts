
import { Monster, Character, Spell } from '../types';

const DB_NAME = 'DMsPrismDB';
const DB_VERSION = 1;

interface DBMigration {
  version: number;
  migration: (db: IDBDatabase) => void;
}

// Helper to convert an image URL to a Base64 string for local storage
// This solves the CORS issue for 3D textures by making the asset local
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

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as any).error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for Monsters (Bestiary)
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
  });
};

const add = async <T>(storeName: string, item: T): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item); // put updates if exists, add throws if exists
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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
  return add('monsters', finalMonster);
};

export const deleteMonster = (name: string) => remove('monsters', name);

export const getSavedCharacters = () => getAll<Character>('characters');
export const saveCharacter = (char: Character) => add('characters', char);
export const deleteCharacter = (id: string) => remove('characters', id);

export const getSavedSpells = () => getAll<Spell>('spells');
export const saveSpell = (spell: Spell) => add('spells', spell);
