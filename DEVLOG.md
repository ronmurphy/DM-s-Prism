# Dungeon Master's Prism - Development Log

## Current Status (Session End)
**Date:** February 10, 2025
**Version:** 0.5.0 (Alpha)

### ✅ Recently Completed Features
1.  **Movement & Physics**:
    *   Refactored `MapRenderer` (Scene2D) to use `requestAnimationFrame` for smooth 60fps token dragging.
    *   Implemented **Movement Clamping**: Tokens cannot be dragged past their remaining movement speed.
    *   Added **Range Overlays**: A colored box indicates the valid movement area based on the token's specific color.
    *   Fixed coordinate snapping issues (off-by-one errors) during drag-and-drop.

2.  **UI Layout Overhaul**:
    *   **Split Sidebar Architecture**: 
        *   **Left**: Dedicated Combat Tracker (Initiative, HP, Status Effects).
        *   **Right**: Tools (Chat, Dice, Library, Character Sheet).
    *   Added floating toggle buttons to hide/show sidebars independently for maximum map visibility.
    *   Added `End Turn` button to the main header for quick access.

3.  **Turn Management**:
    *   Implemented **Strict Turn Enforcement**: Players can only move their tokens when it is their turn.
    *   **Initiative System**: 
        *   Added "Roll Initiative" button to Character Sheet (d20 + DEX).
        *   Combat Tracker auto-sorts tokens by initiative.
        *   "Next Turn" loops through the order and resets movement for the new active token.
    *   Auto-scroll: Combat tracker automatically scrolls to keep the active token in view.

4.  **Content & AI**:
    *   **PDF Import**: Gemini 2.5 Flash parses D&D Beyond PDFs to auto-populate the Character Sheet.
    *   **Map Gen**: Gemini 2.5 Flash Image edits map backgrounds based on prompts.

---

## 🏗️ Technical Architecture
*   **Frontend**: React 19, Tailwind CSS, Lucide React.
*   **Map Engine**: 
    *   2D: HTML5 Canvas (Custom implementation).
    *   3D: React Three Fiber / Three.js.
*   **Backend**: Supabase (PostgreSQL + Realtime).
    *   `tokens` table: position, stats, state.
    *   `messages` table: chat history.
    *   `map_state` table: current background image.
*   **AI**: Google GenAI SDK (`@google/genai`).

---

## 📝 To-Do / Next Steps
*   **Fog of War Tools**: Currently, the DM clicks to reveal a radius. We need a "Brush" tool to paint/erase fog manually.
*   **AOE Templates**: Add ability to drop "Fireball" or "Cone of Cold" templates on the map to see who is hit.
*   **3D Mode Enhancements**: Sync 3D token movement with the new 2D clamping logic (currently 3D view is mostly visual).
*   **Monster Stat Blocks**: Add a way for the DM to quickly click a monster token and see a stat block (similar to the Player Sheet).
*   **Dice Logic**: Connect the "Roll" buttons on the character sheet (STR, DEX, etc.) to the chat window so others can see the results.

---

## 🚀 Quick Start
To resume work:
1.  Ensure Supabase credentials are valid in `lib/supabaseClient.ts`.
2.  Ensure `API_KEY` is set in environment for Gemini features.
3.  Run `npm start` / `npm run dev`.
