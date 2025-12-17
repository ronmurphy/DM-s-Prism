
export type Role = 'DM' | 'PLAYER';

export type StatusEffect = 'Blinded' | 'Charmed' | 'Deafened' | 'Frightened' | 'Grappled' | 'Incapacitated' | 'Invisible' | 'Paralyzed' | 'Petrified' | 'Poisoned' | 'Prone' | 'Restrained' | 'Stunned' | 'Unconscious';

export interface Ability {
  name: string;
  type: 'action' | 'reaction' | 'bonus' | 'spell' | 'legendary' | 'passive';
  description: string;
}

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'pc' | 'npc' | 'enemy';
  color: string;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number; // Max speed in feet
  remainingMovement: number; // Remaining feet for this turn
  size: number; // 1 = 5ft square
  initiative: number;
  statusEffects: StatusEffect[];
  avatarUrl?: string; // Custom image
  characterSheetId?: string; // Link to full char sheet
  abilities?: Ability[]; // Stat block actions
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: Role;
  content: string;
  type: 'public' | 'whisper' | 'system';
  timestamp: number;
  recipient?: string;
}

export interface MapData {
  imageUrl: string;
  gridSize: number; // pixels per cell
  width: number;
  height: number;
  fogRevealed: boolean[][]; // true = visible
}

export interface DiceRoll {
  id: string;
  total: number;
  formula: string;
  breakdown: string;
  timestamp: number;
}

export interface Spell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
}

export interface Monster {
  name: string;
  source?: string; // e.g., "MM", "XMM"
  avatarUrl?: string; // Constructed URL
  type: string;
  ac: number;
  hp: number;
  speed: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  actions?: { name: string; desc: string }[];
  abilities?: Ability[];
  cr?: string;
  size?: number;
}

export interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  maxHp: number;
  ac: number;
  speed: number;
  avatarUrl?: string;
  ddbLink?: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  characterId?: string; // If player
}