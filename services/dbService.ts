
import { Monster, Character, Spell } from '../types';

const DB_NAME = 'DMsPrismDB';
const DB_VERSION = 4; // Incremented for new store

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
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('monsters')) {
        db.createObjectStore('monsters', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('characters')) {
        db.createObjectStore('characters', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('spells')) {
        db.createObjectStore('spells', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('maps')) {
        db.createObjectStore('maps', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('compendium')) {
        db.createObjectStore('compendium'); 
      }
      if (!db.objectStoreNames.contains('compendium_spells')) {
        db.createObjectStore('compendium_spells'); 
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
  });
};

const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const put = async <T>(storeName: string, item: T, key?: IDBValidKey): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
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

export const getSavedMonsters = () => getAll<Monster>('monsters');
export const saveMonster = async (monster: Monster) => {
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

// Compendium Helpers (Monsters)
export const saveCompendiumData = (key: string, data: any[]) => put('compendium', data, key);
export const getCompendiumData = (key: string) => get<any[]>('compendium', key);
export const getAllCompendiumEntries = () => getAll<any[]>('compendium');
export const getAllCompendiumKeys = async (): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('compendium', 'readonly');
        const store = transaction.objectStore('compendium');
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
};

// Compendium Helpers (Spells)
export const saveSpellCompendiumData = (key: string, data: any[]) => put('compendium_spells', data, key);
export const getSpellCompendiumData = (key: string) => get<any[]>('compendium_spells', key);
export const getAllSpellCompendiumEntries = () => getAll<any[]>('compendium_spells');
export const getAllSpellCompendiumKeys = async (): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('compendium_spells', 'readonly');
        const store = transaction.objectStore('compendium_spells');
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
};
