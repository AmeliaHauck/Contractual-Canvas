# 🎨 SE: Contractual Canvas (Multiplayer Pictionary)

A fun, real-time multiplayer drawing game designed for team building with Microsoft Teams integration.

## Features

✅ **1-Minute Timer** - Fast-paced rounds keep everyone engaged
✅ **Fuzzy Matching** - Levenshtein distance algorithm (≤2) for flexible guess matching
✅ **SE-Themed UI** - Clean, professional Stack Exchange-inspired design
✅ **Drawing Tools** - Brush, Eraser, Undo, Clear, Adjustable sizes & colors
✅ **Prompt Generator** - 150 prompts across 3 difficulty levels (50 Easy, 50 Medium, 50 Hard)
✅ **Rotating Drawer** - Each player takes turns drawing
✅ **Team Scoring** - 3 teams with real-time scoring and leaderboard
✅ **Microsoft Teams Integration** - Auto-detect player names from Teams

## Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

## Installation

### Option 1: Using Batch File (Windows)

1. Open Command Prompt in the project directory
2. Run:
   ```bash
   install.bat
   ```

### Option 2: Manual Installation

1. Open Command Prompt or PowerShell in the project directory
2. Run:
   ```bash
   npm install
   ```

## Starting the Server

### Option 1: Using Batch File
```bash
start.bat
```

### Option 2: Manual Start
```bash
npm start
```

The server will start on **http://localhost:3000**

## How to Play

### Setup
1. Open http://localhost:3000 in your browser
2. Enter a **Game ID** (e.g., "team-game-1")
3. Enter your **Player Name**
4. Select your **Team** (1, 2, or 3)
5. Click **Join Game**

### Gameplay
1. One player per round draws the prompt
2. Other players guess by typing in the input field and pressing Enter
3. When a proper guess is made (fuzzy match ≤2 characters), the team earns points
4. Timer counts down from 1 minute
5. After time expires, click **Next Round** to rotate the drawer and continue

### Drawing Controls
- **Color Picker** - Change brush color
- **Brush Size** - Adjust drawing size (1-50px)
- **Eraser** - Switch to eraser mode (1-50px sizes)
- **Undo** - Undo last drawing stroke
- **Clear** - Clear entire canvas
- **Difficulty** - Change prompt difficulty level

## Game Rules

- **Scoring**: 10 points per correct guess
- **Round Duration**: 60 seconds per round
- **Guess Matching**: Fuzzy matching with Levenshtein distance ≤ 2 (e.g., "Caterpillar" matches "Caterpiller")
- **Teams**: 3 teams compete independently
- **Rotation**: Drawer rotates to the next player after each round

## Difficulty Levels

### Easy (50 prompts)
Simple, everyday objects and concepts
- Examples: Apple, Dog, House, Pizza, Rainbow

### Medium (50 prompts)
Specific items and hobbies
- Examples: Skateboard, Saxophone, Volcano, UFO

### Hard (50 prompts)
Abstract concepts and complex vocabulary
- Examples: Procrastination, Singularity, Artificial Intelligence

## Architecture

```
node-demo/
├── server.js           # Express + Socket.io backend
├── prompts.js          # Prompt database (3 difficulty levels)
├── package.json        # Project dependencies
├── public/
│   ├── index.html      # Frontend UI (SE-themed)
│   └── client.js       # Frontend logic & Socket.io client
├── install.bat         # Windows installation script
└── start.bat           # Windows startup script
```

## Project Structure

- **Backend**: Node.js + Express for serving files, Socket.io for real-time multiplayer communication
- **Frontend**: HTML5 Canvas for drawing, vanilla JavaScript for UI interaction
- **Real-time**: Socket.io enables instant drawing, guessing, and scoring across all players
- **Matching Algorithm**: Levenshtein distance ensures flexible guess matching

## Technical Details

### Levenshtein Distance
The guess matching algorithm calculates the edit distance between the guessed text and the actual prompt. A distance of ≤2 means the guess is accepted, allowing for minor spelling mistakes.

Example:
- Prompt: "Caterpillar"
- Guess: "Caterpiller" → Distance: 1 ✅ Correct
- Guess: "Butterfly" → Distance: 7 ❌ Incorrect

### Real-time Communication
- **Socket.io** handles all multiplayer events:
  - Drawing strokes transmitted to all players
  - Guesses checked in real-time
  - Score updates broadcasted instantly
  - Timer synchronized across clients

### Microsoft Teams Integration
- The system can auto-detect player names from Teams User Principal Name (UPN)
- Falls back to manual player name entry

## Troubleshooting

### Port Already in Use
If port 3000 is occupied, modify the PORT in server.js:
```javascript
const PORT = process.env.PORT || 3001; // Change to 3001 or another port
```

### Dependencies Not Installing
- Clear npm cache: `npm cache clean --force`
- Delete node_modules: `rmdir /s node_modules` (Windows)
- Reinstall: `npm install`

### Drawing Not Appearing
- Ensure you're the current drawer (check for ✏️ next to your name)
- Check browser console for errors (F12)
- Reload the page and rejoin the game

### Guesses Not Being Recognized
- Check that you're not the current drawer (drawers cannot guess)
- The matching is fuzzy but limited to ≤2 character differences
- Ensure you're pressing Enter to submit a guess

## Tips for Team Building

1. **Mix skill levels** - Combine good artists with poor ones for variety
2. **Difficulty progression** - Start with Easy, progress to Medium/Hard
3. **Soundboard** - Have everyone on an audio/video call for reactions
4. **Round limit** - Play 3-5 rounds per session for team building meetings
5. **Leaderboard** - Track team scores across multiple sessions

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Internet Explorer: ❌ Not supported

## License

MIT

## Future Enhancements

- Custom word lists
- Persistent leaderboards
- Multiplayer tutorials
- Chat system with hints
- Mobile-optimized layout
- Sound effects and animations

---

Enjoy your team-building drawing game! 🎨🎮
