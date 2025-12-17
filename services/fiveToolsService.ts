
import { Monster, Ability } from "../types";
import { getCompendiumData, saveCompendiumData } from "./dbService";

// Updated to a working mirror
const BASE_URL = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-mirror-3.github.io/master/data/bestiary/";

// We will cache the fetched data in memory after loading from DB/Network
let cachedBestiary: any[] = [];
let isLoaded = false;
let isLoading = false;

// Priority sources to "install" locally
const SOURCES_TO_LOAD = [
    "bestiary-mm.json",     // Monster Manual
    "bestiary-mpmm.json",   // Mordenkainen Presents: Monsters of the Multiverse
    "bestiary-vrgr.json",   // Van Richten's Guide to Ravenloft
    "bestiary-mtf.json",    // Mordenkainen's Tome of Foes
    "bestiary-vgm.json"     // Volo's Guide to Monsters
];

export const getCompendiumStatus = async () => {
    let totalCached = 0;
    let missingFiles = [];

    for (const file of SOURCES_TO_LOAD) {
        const data = await getCompendiumData(file);
        if (data && Array.isArray(data)) {
            totalCached += data.length;
        } else {
            missingFiles.push(file);
        }
    }
    return { totalCached, missingFiles, isComplete: missingFiles.length === 0 };
};

export const load5eToolsData = async (forceDownload = false, onProgress?: (msg: string) => void) => {
    // If forcing download, ignore isLoaded check
    if (isLoaded && !forceDownload) return;
    if (isLoading) return;
    isLoading = true;
    
    try {
        const newMonsters: any[] = [];
        cachedBestiary = []; // Clear memory cache to rebuild

        // Iterate through sources
        for (const file of SOURCES_TO_LOAD) {
            let data = null;
            
            // 1. Try Local DB Cache (unless forcing download)
            if (!forceDownload) {
                data = await getCompendiumData(file);
            }

            if (data && Array.isArray(data) && data.length > 0) {
                console.log(`%c[Cache Hit] Loaded ${file} from IndexedDB (${data.length} monsters)`, 'color: #4ade80');
                newMonsters.push(...data);
            } else {
                // 2. Fetch from Network
                const msg = `Downloading ${file} from mirror...`;
                console.log(`%c[Network] ${msg}`, 'color: #facc15');
                if (onProgress) onProgress(msg);
                
                try {
                    const res = await fetch(BASE_URL + file);
                    if (!res.ok) throw new Error(`Failed to load ${file} (Status: ${res.status})`);
                    const json = await res.json();
                    
                    if (json.monster && Array.isArray(json.monster)) {
                         // 3. Save to Local DB
                         await saveCompendiumData(file, json.monster);
                         newMonsters.push(...json.monster);
                         console.log(`%c[Cache Save] Saved ${file} to IndexedDB`, 'color: #4ade80');
                    }
                } catch (err) {
                    console.warn(`Failed to fetch ${file}:`, err);
                }
            }
        }

        cachedBestiary = newMonsters; // Replace memory cache
        isLoaded = true;
        
        if (onProgress) onProgress(`Compendium Ready: ${cachedBestiary.length} monsters.`);
        console.log(`Compendium Fully Loaded: ${cachedBestiary.length} monsters available.`);
    } catch (e) {
        console.error("Critical error loading 5e.tools data", e);
        if (onProgress) onProgress("Error loading data. Check console.");
    } finally {
        isLoading = false;
    }
};

const mapSize = (size: any): number => {
    if (!size) return 1;
    // 5e.tools uses S, M, L, H, G, T in array or string
    const s = Array.isArray(size) ? size[0] : size;
    switch(s) {
        case 'T': return 1; // Tiny
        case 'S': return 1; // Small
        case 'M': return 1; // Medium
        case 'L': return 2; // Large
        case 'H': return 3; // Huge
        case 'G': return 4; // Gargantuan
        default: return 1;
    }
};

const mapType = (type: any): string => {
    if (!type) return "Unknown";
    if (typeof type === 'string') return type;
    if (type.type) {
        let str = type.type;
        if (type.tags && Array.isArray(type.tags)) str += ` (${type.tags.join(', ')})`;
        return str;
    }
    return "Unknown";
}

const mapAc = (ac: any): number => {
    if (!ac) return 10;
    if (typeof ac === 'number') return ac;
    if (Array.isArray(ac)) {
        // Can be [{ac: 15, from: [...]}] or just [15]
        const first = ac[0];
        if (typeof first === 'number') return first;
        if (first && first.ac) return first.ac;
    }
    return 10;
}

const mapHp = (hp: any): number => {
    if (!hp) return 10;
    if (typeof hp === 'number') return hp;
    if (hp.average) return hp.average;
    return 10;
}

const mapSpeed = (speed: any): number => {
    if (!speed) return 30;
    if (typeof speed === 'number') return speed;
    if (speed.walk) return speed.walk;
    // Sometimes it's just fly/swim, fallback to max
    if (typeof speed === 'object') {
        const vals = Object.values(speed).filter(v => typeof v === 'number') as number[];
        if (vals.length > 0) return Math.max(...vals);
    }
    return 30;
}

const formatText = (text: string): string => {
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
        .replace(/{@tag (.*?)}/g, "$1") 
        .replace(/{@\w+ (.*?)\|(.*?)}/g, "$2") // {@creature goblin|notes} -> notes
        .replace(/{@\w+ (.*?)}/g, "$1"); // {@spell fireball} -> fireball
}

export const search5eTools = async (query: string, onProgress?: (msg: string) => void): Promise<Monster[]> => {
    // Ensure data is loaded (will use cache if available)
    await load5eToolsData(false, onProgress);
    
    if (!cachedBestiary.length) return [];

    const lowerQuery = query.toLowerCase();
    
    // Filter matches
    const matches = cachedBestiary.filter(m => m.name && m.name.toLowerCase().includes(lowerQuery));
    
    // Limit to 20 to prevent UI lag
    return matches.slice(0, 20).map(m => {
        const source = m.source || "MM";
        // 5e.tools token convention
        const encodedName = encodeURIComponent(m.name);
        const encodedSource = encodeURIComponent(source);
        const avatarUrl = `https://5e.tools/img/bestiary/tokens/${encodedSource}/${encodedName}.webp`;
        
        const abilities: Ability[] = [];
        
        if (m.action) {
            m.action.forEach((a: any) => {
                abilities.push({
                    name: a.name,
                    type: 'action',
                    description: formatText(a.entries ? a.entries.join('\n') : '')
                });
            });
        }
        
        if (m.reaction) {
            m.reaction.forEach((a: any) => {
                 abilities.push({
                    name: a.name,
                    type: 'reaction',
                    description: formatText(a.entries ? a.entries.join('\n') : '')
                });
            });
        }

        if (m.legendary) {
            m.legendary.forEach((a: any) => {
                abilities.push({
                    name: a.name,
                    type: 'legendary',
                    description: formatText(a.entries ? a.entries.join('\n') : '')
                });
            });
        }
        
        // Passive traits
        if (m.trait) {
            m.trait.forEach((a: any) => {
                abilities.push({
                    name: a.name,
                    type: 'passive',
                    description: formatText(a.entries ? a.entries.join('\n') : '')
                });
            });
        }

        return {
            name: m.name,
            source: source,
            avatarUrl: avatarUrl,
            type: mapType(m.type),
            ac: mapAc(m.ac),
            hp: mapHp(m.hp),
            speed: mapSpeed(m.speed),
            stats: {
                str: m.str || 10,
                dex: m.dex || 10,
                con: m.con || 10,
                int: m.int || 10,
                wis: m.wis || 10,
                cha: m.cha || 10
            },
            cr: m.cr ? (typeof m.cr === 'string' ? m.cr : m.cr.cr) : "Unknown",
            size: mapSize(m.size),
            abilities: abilities
        };
    });
};
