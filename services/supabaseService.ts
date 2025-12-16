import { supabase } from '../lib/supabaseClient';
import { Token, MapData, ChatMessage, Character } from '../types';

// --- Mappers ---

export const mapTokenFromDB = (row: any): Token => ({
  id: row.id,
  name: row.name,
  x: row.x,
  y: row.y,
  type: row.type,
  color: row.color,
  hp: row.hp,
  maxHp: row.max_hp,
  ac: row.ac,
  speed: row.speed ?? 30,
  remainingMovement: row.remaining_movement ?? 30,
  size: row.size,
  initiative: row.initiative,
  statusEffects: row.status_effects || [],
  avatarUrl: row.avatar_url,
  characterSheetId: row.character_sheet_id
});

export const mapTokenToDB = (token: Token) => ({
  // We generally don't send ID for inserts if auto-generated, but for updates we use it for query
  name: token.name,
  x: token.x,
  y: token.y,
  type: token.type,
  color: token.color,
  hp: token.hp,
  max_hp: token.maxHp,
  ac: token.ac,
  speed: token.speed,
  remaining_movement: token.remainingMovement,
  size: token.size,
  initiative: token.initiative,
  status_effects: token.statusEffects,
  avatar_url: token.avatarUrl,
  character_sheet_id: token.characterSheetId || null
});

export const mapMessageFromDB = (row: any): ChatMessage => ({
  id: row.id.toString(),
  sender: row.sender,
  role: row.role,
  content: row.content,
  type: row.type,
  recipient: row.recipient,
  timestamp: new Date(row.created_at).getTime()
});

export const mapCharFromDB = (row: any): Character => ({
  id: row.id,
  name: row.name,
  class: row.class,
  level: row.level,
  stats: row.stats,
  maxHp: row.max_hp,
  ac: row.ac,
  speed: row.speed || 30,
  avatarUrl: row.avatar_url,
  ddbLink: row.ddb_link
});

export const mapCharToDB = (char: Character) => ({
  id: char.id,
  name: char.name,
  class: char.class,
  level: char.level,
  stats: char.stats,
  max_hp: char.maxHp,
  ac: char.ac,
  speed: char.speed,
  avatar_url: char.avatarUrl,
  ddb_link: char.ddbLink
});

// --- Actions ---

export const uploadMapImage = async (base64Data: string) => {
  // Update the singleton row (id=1)
  const { error } = await supabase
    .from('map_state')
    .update({ image_url: base64Data })
    .eq('id', 1);
  
  if (error) {
     // Try insert if update fails (first run)
     await supabase.from('map_state').insert({ id: 1, image_url: base64Data });
  }
};

export const updateTokenInDB = async (token: Token) => {
  const { error } = await supabase
    .from('tokens')
    .update(mapTokenToDB(token))
    .eq('id', token.id);
  
  if (error) console.error("Error updating token:", error.message || error);
};

export const createTokenInDB = async (token: Token) => {
    const payload = mapTokenToDB(token);
    const { error } = await supabase.from('tokens').insert(payload);
    if (error) console.error("Error creating token:", error.message || error);
};

export const sendMessageToDB = async (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
  const { error } = await supabase.from('messages').insert({
    sender: msg.sender,
    role: msg.role,
    content: msg.content,
    type: msg.type,
    recipient: msg.recipient
  });
  if (error) console.error("Error sending message:", error);
};