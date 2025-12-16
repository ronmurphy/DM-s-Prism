import { Character } from "../types";

// In a real app, this would hit a backend proxy to scrape DDB or use their API if available.
// Here we simulate parsing a character based on the link.

export const importCharacterFromLink = async (url: string, playerName: string): Promise<Character> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  if (!url.includes('dndbeyond.com')) {
    throw new Error("Invalid D&D Beyond URL");
  }

  // Generate a deterministic-ish character based on the string length for variety in demo
  const isOdd = url.length % 2 !== 0;
  
  return {
    id: `char_${Date.now()}`,
    name: isOdd ? "Kaelthos the Brave" : "Elara Moonwhisper",
    class: isOdd ? "Paladin 5" : "Wizard 5",
    level: 5,
    stats: {
      str: isOdd ? 16 : 8,
      dex: 10,
      con: 14,
      int: isOdd ? 8 : 18,
      wis: 12,
      cha: 14
    },
    maxHp: isOdd ? 45 : 28,
    ac: isOdd ? 18 : 12,
    speed: 30,
    avatarUrl: isOdd 
      ? "https://i.pinimg.com/736x/33/27/64/332764353d2aa253907c041147a4087e.jpg" 
      : "https://i.pinimg.com/236x/8d/68/70/8d6870958f276b0cb444d32047817fc1.jpg",
    ddbLink: url
  };
};