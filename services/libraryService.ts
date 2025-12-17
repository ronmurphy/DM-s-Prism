
import { Spell, Monster } from "../types";
import { search5eTools, search5eToolsSpells } from "./fiveToolsService";

const API_BASE_SPELLS = "https://api.open5e.com/spells/";

const mapOpen5eToSpell = (data: any): Spell => ({
    name: data.name,
    level: parseInt(data.level_int) || 0,
    school: data.school,
    castingTime: data.casting_time,
    range: data.range,
    components: data.components,
    duration: data.duration,
    description: data.desc + (data.higher_level ? "\n\nAt Higher Levels: " + data.higher_level : "")
});

export const searchSpells = async (query: string): Promise<Spell[]> => {
    if (query.length < 2) return [];

    // 1. Try local 5e.tools cache
    const localResults = await search5eToolsSpells(query);
    if (localResults.length > 0) return localResults;

    // 2. Fallback to Open5e
    try {
        const res = await fetch(`${API_BASE_SPELLS}?search=${encodeURIComponent(query)}&limit=15`);
        const json = await res.json();
        if (json.results) return json.results.map(mapOpen5eToSpell);
    } catch (e) {
        console.error("Open5e spell search failed", e);
    }
    
    return [];
};
