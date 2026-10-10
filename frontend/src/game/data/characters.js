/**
 * GD Arena — AI Participants and Moderators Configuration
 * 
 * Defines 15 AI participants and 3 room moderators across the Small, Medium,
 * and Large GD Rooms. Coordinates are placed on verified walkable room floor tiles
 * away from walls, doorways, and solid furniture.
 */

export const CHARACTERS = Object.freeze([
  // ==========================================
  // SMALL GD ROOM (3 AI Participants + 1 Moderator)
  // Room bounds: x: 96..480, y: 128..544
  // ==========================================
  {
    id: 'small_moderator',
    name: 'Dr. Mehta',
    role: 'Moderator',
    roomId: 'small_gd',
    roomName: 'Small GD Room',
    x: 272,
    y: 176,
    type: 'moderator',
    textureKey: 'char_moderator'
  },
  {
    id: 'small_aarav',
    name: 'Aarav',
    role: 'Confident Speaker',
    roomId: 'small_gd',
    roomName: 'Small GD Room',
    x: 208,
    y: 272,
    type: 'ai',
    textureKey: 'char_aarav'
  },
  {
    id: 'small_neha',
    name: 'Neha',
    role: 'Analytical Thinker',
    roomId: 'small_gd',
    roomName: 'Small GD Room',
    x: 336,
    y: 272,
    type: 'ai',
    textureKey: 'char_neha'
  },
  {
    id: 'small_rohan',
    name: 'Rohan',
    role: 'Quiet Observer',
    roomId: 'small_gd',
    roomName: 'Small GD Room',
    x: 272,
    y: 368,
    type: 'ai',
    textureKey: 'char_rohan'
  },

  // ==========================================
  // MEDIUM GD ROOM (5 AI Participants + 1 Moderator)
  // Room bounds: x: 992..1568, y: 128..544
  // ==========================================
  {
    id: 'med_moderator',
    name: 'Prof. Sharma',
    role: 'Moderator',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1264,
    y: 176,
    type: 'moderator',
    textureKey: 'char_moderator'
  },
  {
    id: 'med_kavya',
    name: 'Kavya',
    role: 'Collaborative Speaker',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1104,
    y: 304,
    type: 'ai',
    textureKey: 'char_kavya'
  },
  {
    id: 'med_aditya',
    name: 'Aditya',
    role: 'Data-Driven Thinker',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1168,
    y: 336,
    type: 'ai',
    textureKey: 'char_aditya'
  },
  {
    id: 'med_ishan',
    name: 'Ishan',
    role: 'Constructive Contrarian',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1296,
    y: 336,
    type: 'ai',
    textureKey: 'char_ishan'
  },
  {
    id: 'med_priya',
    name: 'Priya',
    role: 'Critical Thinker',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1424,
    y: 336,
    type: 'ai',
    textureKey: 'char_priya'
  },
  {
    id: 'med_varun',
    name: 'Varun',
    role: 'Solution-Oriented Speaker',
    roomId: 'medium_gd',
    roomName: 'Medium GD Room',
    x: 1488,
    y: 272,
    type: 'ai',
    textureKey: 'char_varun'
  },

  // ==========================================
  // LARGE GD ROOM (7 AI Participants + 1 Moderator)
  // Room bounds: x: 1760..2464, y: 128..544
  // ==========================================
  {
    id: 'large_moderator',
    name: 'Dr. Iyer',
    role: 'Moderator',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 2064,
    y: 176,
    type: 'moderator',
    textureKey: 'char_moderator'
  },
  {
    id: 'large_sanya',
    name: 'Sanya',
    role: 'Confident Speaker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 1840,
    y: 288,
    type: 'ai',
    textureKey: 'char_sanya'
  },
  {
    id: 'large_kabir',
    name: 'Kabir',
    role: 'Analytical Thinker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 1888,
    y: 336,
    type: 'ai',
    textureKey: 'char_kabir'
  },
  {
    id: 'large_arjun',
    name: 'Arjun',
    role: 'Collaborative Speaker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 1968,
    y: 336,
    type: 'ai',
    textureKey: 'char_arjun'
  },
  {
    id: 'large_dev',
    name: 'Dev',
    role: 'Data-Driven Thinker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 2064,
    y: 336,
    type: 'ai',
    textureKey: 'char_dev'
  },
  {
    id: 'large_meera',
    name: 'Meera',
    role: 'Constructive Contrarian',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 2160,
    y: 336,
    type: 'ai',
    textureKey: 'char_meera'
  },
  {
    id: 'large_ritika',
    name: 'Ritika',
    role: 'Critical Thinker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 2256,
    y: 336,
    type: 'ai',
    textureKey: 'char_ritika'
  },
  {
    id: 'large_kunal',
    name: 'Kunal',
    role: 'Solution-Oriented Speaker',
    roomId: 'large_gd',
    roomName: 'Large GD Room',
    x: 2304,
    y: 288,
    type: 'ai',
    textureKey: 'char_kunal'
  }
]);

export function getCharacterConfig(id) {
  return CHARACTERS.find((c) => c.id === id);
}

export function getCharactersByRoom(roomId) {
  return CHARACTERS.filter((c) => c.roomId === roomId);
}
