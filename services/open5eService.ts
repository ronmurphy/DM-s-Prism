import { Monster, Ability } from "../types";

const API_BASE = "https://api.open5e.com/monsters/";

// Map Open5e "document__slug" to 5e.tools "source" abbreviations
const SOURCE_MAP: Record<string, string> = {
  'wotc-srd': 'MM',      // System Reference Document -> Monster Manual
  '5e-srd': 'MM',
  'tob': 'TOB',          // Tome of Beasts
  'tob2': 'TOB2',        // Tome of Beasts 2
  'tob3': 'TOB3',        // Tome of Beasts 3
  'cc': 'CC',            // Creature Codex
  'kp': 'KP',            // Kobold Press
  'menagerie': 'MFF',    // Mordenkainen's Fiendish Folio (Best guess)
  'flee-mortals': 'FM'   // Flee, Mortals!
};

// Helper to map Open5e size string to grid squares (integers)
const mapSizeToGrid = (sizeStr: string): number => {
  if (!sizeStr) return 1;
  const s = sizeStr.toLowerCase();
  if (s.includes("tiny") || s.includes("small") || s.includes("medium")) return 1;
  if (s.includes("large")) return 2;
  if (s.includes("huge")) return 3;
  if (s.includes("gargantuan")) return 4;
  return 1;
};

// Helper to map Open5e JSON to our Monster Interface
const mapOpen5eToMonster = (data: any): Monster => {
  const abilities: Ability[] = [];

  // Map Actions
  if (data.actions) {
    data.actions.forEach((a: any) => {
      abilities.push({
        name: a.name,
        type: 'action',
        description: a.desc
      });
    });
  }

  // Map Reactions
  if (data.reactions) {
    data.reactions.forEach((r: any) => {
      abilities.push({
        name: r.name,
        type: 'reaction',
        description: r.desc
      });
    });
  }

  // Map Legendary Actions
  if (data.legendary_actions) {
    data.legendary_actions.forEach((l: any) => {
      abilities.push({
        name: l.name,
        type: 'legendary',
        description: l.desc
      });
    });
  }

  // Map Special Abilities (Passive)
  if (data.special_abilities) {
    data.special_abilities.forEach((s: any) => {
      abilities.push({
        name: s.name,
        type: 'passive',
        description: s.desc
      });
    });
  }

  // Construct Avatar URL
  // Default to MM if source is unknown, but mostly works for SRD content
  const sourceSlug = data.document__slug || 'wotc-srd';
  const sourceAbbr = SOURCE_MAP[sourceSlug] || 'MM'; 
  const avatarUrl = `https://5e.tools/img/bestiary/tokens/${sourceAbbr}/${encodeURIComponent(data.name)}.webp`;

  return {
    name: data.name,
    type: `${data.size} ${data.type}`,
    ac: data.armor_class || 10,
    hp: data.hit_points || 10,
    speed: parseInt(data.speed?.walk || "30") || 30,
    stats: {
      str: data.strength,
      dex: data.dexterity,
      con: data.constitution,
      int: data.intelligence,
      wis: data.wisdom,
      cha: data.charisma
    },
    source: sourceAbbr,
    cr: data.challenge_rating,
    avatarUrl: avatarUrl,
    abilities: abilities,
    size: mapSizeToGrid(data.size)
  };
};

export const searchMonstersOpen5e = async (query: string): Promise<{ monsters: Monster[], raw: any[] }> => {
  try {
    const response = await fetch(`${API_BASE}?search=${encodeURIComponent(query)}&limit=10`);
    const json = await response.json();
    
    if (json.results) {
        return {
            monsters: json.results.map(mapOpen5eToMonster),
            raw: json.results // Return raw to extract size string if needed
        };
    }
    return { monsters: [], raw: [] };
  } catch (e) {
    console.error("Open5e Fetch Error", e);
    return { monsters: [], raw: [] };
  }
};