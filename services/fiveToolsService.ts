
import { Monster, Ability, Spell } from "../types";
import { 
    getCompendiumData, saveCompendiumData, getAllCompendiumEntries, getAllCompendiumKeys,
    saveSpellCompendiumData, getSpellCompendiumData, getAllSpellCompendiumEntries, getAllSpellCompendiumKeys
} from "./dbService";

const BESTIARY_URL = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-mirror-3.github.io/master/data/bestiary/";
const SPELL_URL = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-mirror-3.github.io/master/data/spells/";

let cachedBestiary: any[] = [];
let cachedSpells: any[] = [];
let isBestiaryLoaded = false;
let isSpellsLoaded = false;

const SCHOOL_MAP: Record<string, string> = {
    'A': 'Abjuration',
    'C': 'Conjuration',
    'D': 'Divination',
    'E': 'Enchantment',
    'V': 'Evocation',
    'I': 'Illusion',
    'N': 'Necromancy',
    'T': 'Transmutation'
};

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
        .replace(/{@\w+ (.*?)\|(.*?)}/g, "$2") 
        .replace(/{@\w+ (.*?)}/g, "$1"); 
}

const mapSize = (size: any): number => {
    if (!size) return 1;
    const s = Array.isArray(size) ? size[0] : size;
    switch(s) {
        case 'T': return 1; 
        case 'S': return 1; 
        case 'M': return 1; 
        case 'L': return 2; 
        case 'H': return 3; 
        case 'G': return 4; 
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
    if (typeof speed === 'object') {
        const vals = Object.values(speed).filter(v => typeof v === 'number') as number[];
        if (vals.length > 0) return Math.max(...vals);
    }
    return 30;
}

const parseSpellTime = (time: any[]): string => {
    if (!time || !time.length) return "1 Action";
    return time.map(t => `${t.number} ${t.unit}${t.number > 1 ? 's' : ''}`).join(', ');
};

const parseSpellRange = (range: any): string => {
    if (!range) return "Unknown";
    if (range.type === 'point' && range.distance) {
        return `${range.distance.amount || ''} ${range.distance.type || 'feet'}`.trim();
    }
    if (range.type === 'special') return "Special";
    return range.type.charAt(0).toUpperCase() + range.type.slice(1);
};

const parseSpellComponents = (comp: any): string => {
    if (!comp) return "";
    const parts = [];
    if (comp.v) parts.push("V");
    if (comp.s) parts.push("S");
    if (comp.m) {
        const material = typeof comp.m === 'string' ? comp.m : (comp.m.text || "M");
        parts.push(`M (${material})`);
    }
    return parts.join(', ');
};

const parseSpellDuration = (duration: any[]): string => {
    if (!duration || !duration.length) return "Instantaneous";
    return duration.map(d => {
        if (d.type === 'instant') return "Instantaneous";
        if (d.type === 'timed' && d.duration) {
            let str = `${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
            if (d.concentration) str = "Concentration, up to " + str;
            return str;
        }
        return d.type;
    }).join(', ');
};

export const getCompendiumStatus = async () => {
    let totalCached = 0;
    const keys = await getAllCompendiumKeys();
    for (const key of keys) {
        const data = await getCompendiumData(key);
        if (data) totalCached += data.length;
    }
    return { totalCached, totalFiles: keys.length, isComplete: true };
};

export const getSpellCompendiumStatus = async () => {
    let totalCached = 0;
    const keys = await getAllSpellCompendiumKeys();
    for (const key of keys) {
        const data = await getSpellCompendiumData(key);
        if (data) totalCached += data.length;
    }
    return { totalCached, totalFiles: keys.length };
};

export const load5eToolsData = async (force = false) => {
    if (isBestiaryLoaded && !force) return;
    const all = await getAllCompendiumEntries();
    cachedBestiary = all.flat();
    isBestiaryLoaded = true;
};

export const load5eToolsSpellData = async (force = false) => {
    if (isSpellsLoaded && !force) return;
    const all = await getAllSpellCompendiumEntries();
    cachedSpells = all.flat();
    isSpellsLoaded = true;
};

export const search5eTools = async (query: string): Promise<Monster[]> => {
    await load5eToolsData();
    const lower = query.toLowerCase();
    const matches = cachedBestiary.filter(m => m.name && m.name.toLowerCase().includes(lower));
    
    return matches.slice(0, 30).map(m => {
        const source = m.source || "MM";
        const avatarUrl = `https://5e.tools/img/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(m.name)}.webp`;
        
        const abilities: Ability[] = [];
        const processEntries = (arr: any[], type: any) => {
            if (!arr) return;
            arr.forEach(a => {
                const desc = Array.isArray(a.entries) 
                  ? a.entries.map((e: any) => typeof e === 'string' ? e : (e.entries ? e.entries.join('\n') : '')).join('\n')
                  : '';
                abilities.push({
                    name: a.name,
                    type: type,
                    description: formatText(desc)
                });
            });
        };

        processEntries(m.action, 'action');
        processEntries(m.reaction, 'reaction');
        processEntries(m.legendary, 'legendary');
        processEntries(m.trait, 'passive');

        return {
            name: m.name,
            source: source,
            avatarUrl: avatarUrl,
            type: mapType(m.type),
            ac: mapAc(m.ac),
            hp: mapHp(m.hp),
            speed: mapSpeed(m.speed),
            stats: {
                str: m.str || 10, dex: m.dex || 10, con: m.con || 10,
                int: m.int || 10, wis: m.wis || 10, cha: m.cha || 10
            },
            cr: m.cr ? (typeof m.cr === 'string' ? m.cr : (m.cr.cr || m.cr)) : "Unknown",
            size: mapSize(m.size),
            abilities: abilities
        };
    });
};

export const search5eToolsSpells = async (query: string): Promise<Spell[]> => {
    await load5eToolsSpellData();
    const lower = query.toLowerCase();
    const matches = cachedSpells.filter(s => s.name && s.name.toLowerCase().includes(lower));
    
    return matches.slice(0, 30).map(s => {
        const entries = Array.isArray(s.entries) ? s.entries.map((e: any) => typeof e === 'string' ? e : (e.entries ? e.entries.join('\n') : '')).join('\n\n') : '';
        const higher = s.entriesHigherLevel ? s.entriesHigherLevel.map((h: any) => h.entries.join('\n')).join('\n\n') : '';

        return {
            name: s.name,
            level: s.level,
            school: SCHOOL_MAP[s.school] || s.school,
            castingTime: parseSpellTime(s.time),
            range: parseSpellRange(s.range),
            components: parseSpellComponents(s.components),
            duration: parseSpellDuration(s.duration),
            description: formatText(entries + (higher ? '\n\n' + higher : ''))
        };
    });
};
