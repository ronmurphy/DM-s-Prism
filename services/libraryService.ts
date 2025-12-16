import { Spell } from "../types";

const MOCK_SPELLS: Spell[] = [
  {
    name: "Fireball",
    level: 3,
    school: "Evocation",
    castingTime: "1 Action",
    range: "150 feet",
    components: "V, S, M",
    duration: "Instantaneous",
    description: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one."
  },
  {
    name: "Cure Wounds",
    level: 1,
    school: "Evocation",
    castingTime: "1 Action",
    range: "Touch",
    components: "V, S",
    duration: "Instantaneous",
    description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st."
  },
  {
    name: "Mage Hand",
    level: 0,
    school: "Conjuration",
    castingTime: "1 Action",
    range: "30 feet",
    components: "V, S",
    duration: "1 Minute",
    description: "A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again."
  },
  {
    name: "Shield",
    level: 1,
    school: "Abjuration",
    castingTime: "1 Reaction",
    range: "Self",
    components: "V, S",
    duration: "1 Round",
    description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile."
  },
  {
    name: "Invisibility",
    level: 2,
    school: "Illusion",
    castingTime: "1 Action",
    range: "Touch",
    components: "V, S, M",
    duration: "Concentration, up to 1 hour",
    description: "A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the person's person. The spell ends for a target that attacks or casts a spell."
  }
];

export const searchSpells = (query: string): Spell[] => {
  const lowerQuery = query.toLowerCase();
  return MOCK_SPELLS.filter(s => s.name.toLowerCase().includes(lowerQuery));
};