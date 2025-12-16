# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dungeon Master's Prism** is a real-time virtual tabletop (VTT) for D&D 5e campaigns. Built as a React SPA with Supabase backend, it features both 2D canvas-based and 3D (Three.js) map rendering, AI-powered tools via Gemini, and real-time multiplayer sync.

## Development Commands

```bash
npm install              # Install dependencies
npm run dev             # Start dev server (port 3000)
npm run build           # Build for production
npm run preview         # Preview production build
```

## Environment Setup

Create `.env.local` in the project root:
```
GEMINI_API_KEY=your_key_here
```

The app uses hardcoded Supabase credentials in `lib/supabaseClient.ts` (public anon key, safe for client-side use).

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **3D Engine**: React Three Fiber, Three.js, @react-three/drei
- **Backend**: Supabase (PostgreSQL + Realtime subscriptions)
- **AI**: Google GenAI SDK (Gemini 2.5 Flash)
- **Build Tool**: Vite

### Directory Structure
```
/
├── components/           # React UI components
│   ├── MapRenderer.tsx   # 2D canvas + 3D Three.js renderer
│   ├── CombatTracker.tsx # Initiative tracking UI
│   ├── CharacterSheet.tsx # Player character sheet
│   ├── ChatWindow.tsx    # In-game chat
│   ├── LibraryWindow.tsx # Monster/spell library browser
│   ├── DiceRoller.tsx    # Dice rolling UI
│   ├── TokenEditor.tsx   # Token stats editor modal
│   └── SplashScreen.tsx  # Login screen
├── services/            # Business logic & API clients
│   ├── supabaseService.ts # DB mappers & CRUD operations
│   ├── geminiService.ts   # AI image editing & PDF parsing
│   ├── libraryService.ts  # Fetch 5e SRD data
│   └── ddbService.ts      # D&D Beyond API utilities
├── lib/
│   └── supabaseClient.ts # Supabase client singleton
├── types.ts             # Shared TypeScript types
└── App.tsx              # Root component & state management
```

### Core Data Flow

**State Management**: All game state lives in `App.tsx` and flows down via props. No global state library.

**Realtime Sync**: Supabase Realtime channels sync 3 tables:
- `tokens` - Character/monster positions, stats, initiative
- `messages` - Chat history
- `map_state` - Current map background image (single row, id=1)

**Role-Based Logic**:
- `DM`: Full control (move any token, spawn monsters, edit map with AI)
- `PLAYER`: Can only move own token on their turn, view character sheet

### Key Components

**MapRenderer** (`components/MapRenderer.tsx`):
- Dual-mode: Switches between 2D Canvas (`Scene2D`) and 3D Three.js (`Scene3D`)
- 2D uses `requestAnimationFrame` for 60fps token dragging
- Implements movement clamping (tokens can't exceed `remainingMovement`)
- Renders range overlays (colored boxes showing valid movement area)
- Handles drag-and-drop of monsters from library to spawn them

**Combat Tracker** (`components/CombatTracker.tsx`):
- Displays tokens sorted by initiative (descending)
- Shows HP bars, status effects, remaining movement
- Auto-scrolls to active token
- "Next Turn" button cycles through initiative order and resets movement

**Initiative System**:
- Stored in `Token.initiative` field
- Combat tracker sorts tokens by this value
- `activeTokenId` in App.tsx tracks whose turn it is
- Turn enforcement: Players can only move tokens when `activeTokenId` matches their token

### Database Schema (Supabase)

**tokens table**:
```
id, name, x, y, type, color, hp, max_hp, ac, speed,
remaining_movement, size, initiative, status_effects,
avatar_url, character_sheet_id
```

**messages table**:
```
id, sender, role, content, type, recipient, created_at
```

**map_state table**:
```
id (always 1), image_url, width, height
```

**characters table**:
```
id, name, class, level, stats (jsonb), max_hp, ac, speed,
avatar_url, ddb_link
```

### AI Features

**Map Editing** (`geminiService.ts`):
- Uses `gemini-2.5-flash-image` model for image-to-image edits
- Takes current map (base64) + text prompt
- Returns edited map maintaining top-down perspective
- Triggered via DM toolbar (wand icon)

**PDF Character Import**:
- Uses `gemini-2.5-flash` with structured output (JSON schema)
- Parses D&D Beyond character sheets
- Extracts: name, class, level, stats, HP, AC, speed
- Triggered from Character Sheet component (file upload)

### Important Implementation Details

**Movement Clamping Logic** (`App.tsx:173-214`):
- Calculates distance using Chebyshev distance: `Math.max(distanceX, distanceY)`
- Converts cells to feet (× 5)
- Rejects move if cost > `remainingMovement`
- Updates token state with new position and reduced movement

**Turn Enforcement** (`App.tsx:184-187`):
- Players MUST wait for their turn (strict check via `activeTokenId`)
- Shows error message in chat if player tries to move out of turn
- DM bypasses all turn restrictions

**Coordinate System**:
- Grid cells are indexed from (0,0) at top-left
- `gridSize` in pixels (default 50px per cell)
- Token position is stored in grid cells, not pixels

**Realtime Subscription Pattern** (`App.tsx:89-126`):
- Single channel (`game_events`) listens to all 3 tables
- INSERT → append to local state array
- UPDATE → replace matching item in local state
- DELETE → filter out from local state
- Changes propagate to all connected clients instantly

## Common Development Patterns

### Adding a New Token Field
1. Add to `Token` type in `types.ts`
2. Add mapping in `mapTokenFromDB` and `mapTokenToDB` in `services/supabaseService.ts`
3. Add column to Supabase `tokens` table (use JSONB for complex data)
4. Update UI components that display/edit tokens

### Adding a New AI Feature
1. Create function in `services/geminiService.ts`
2. Use `stripDataUrl()` helper for base64 processing
3. For structured output, define `responseSchema` with `Type.OBJECT`
4. Check `process.env.API_KEY` is defined (set in `vite.config.ts`)

### Path Aliasing
`@/*` resolves to project root (configured in `vite.config.ts` and `tsconfig.json`).

Example: `import { Token } from '@/types'`

## Current Known Issues

- Abilities field on tokens not persisted to DB (line `services/supabaseService.ts:50` commented out)
- 3D mode doesn't sync movement clamping logic with 2D (visual-only)
- Fog of War reveal is stubbed (logs only, no persistence)
- Dice rolls from character sheet don't display in chat yet

## Testing Notes

No test suite currently configured. Manual testing workflow:
1. Login as DM, spawn monsters from library
2. Login as Player (separate browser/incognito), load character sheet
3. DM clicks "Roll Initiative" for monsters, Player rolls initiative
4. Click "Next Turn" to cycle through combat
5. Verify movement clamping by dragging token beyond range
