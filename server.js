const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const prompts = require('./prompts');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}

// Game state
const games = {};
const players = {};
const ALLOWED_STARTERS = new Set(['amelia', 'marlene']);
const MAX_ROUNDS = 15;
const TARGET_SCORE = 10;

function normalizePromptEntry(entry) {
  if (typeof entry === 'string') {
    return {
      text: entry,
      drawerHint: '',
      guesserHints: []
    };
  }

  return {
    text: entry.text,
    drawerHint: entry.drawerHint || '',
    guesserHints: Array.isArray(entry.guesserHints) ? entry.guesserHints : []
  };
}

function findPromptEntry(promptText) {
  for (const difficultyPrompts of Object.values(prompts)) {
    for (const entry of difficultyPrompts) {
      const normalizedEntry = normalizePromptEntry(entry);
      if (normalizedEntry.text === promptText) {
        return normalizedEntry;
      }
    }
  }

  return normalizePromptEntry(promptText);
}

class Game {
  constructor(gameId) {
    this.gameId = gameId;
    this.teams = {
      team1: { name: 'Team: Send It to Legal', players: [], score: 0, color: '#1f77b4' },
      team2: { name: 'Team: Oops, All Addendums', players: [], score: 0, color: '#ff7f0e' },
      team3: { name: 'Team: The Redline Rangers', players: [], score: 0, color: '#2ca02c' }
    };
    this.currentDrawer = null;
    this.currentPrompt = null;
    this.currentPromptMeta = null;
    this.currentDifficulty = 'easy';
    this.preRoundCountdown = 5;
    this.intermissionDuration = 10;
    this.roundDuration = 90;
    this.maxRounds = MAX_ROUNDS;
    this.targetScore = TARGET_SCORE;
    this.roundTimer = null;
    this.intermissionTimer = null;
    this.roundStartTime = null;
    this.guessedPlayers = new Set();
    this.usedPrompts = {
      easy: new Set(),
      medium: new Set(),
      hard: new Set()
    };
    this.gameActive = false;
    this.finalGuessPhase = false;
    this.finalGuessTeamStatus = {
      team1: false,
      team2: false,
      team3: false
    };
    this.finalGuessers = {
      team1: null,
      team2: null,
      team3: null
    };
    this.currentDrawingTeam = null;
    this.roundsCompleted = 0;
    this.roundCounted = false;
    this.gameOver = false;
    this.hintsRevealed = { first: false, second: false };
    this.phase = 'lobby';
    this.phaseStartedAt = null;
    this.phaseDurationSeconds = 0;
    this.guessHistory = [];
    this.canvasSnapshot = null;
    this.lastRoundSummary = null;
  }

  setPhase(phase, durationSeconds = 0) {
    this.phase = phase;
    this.phaseStartedAt = Date.now();
    this.phaseDurationSeconds = durationSeconds;
  }

  clearRoundArtifacts() {
    this.guessHistory = [];
    this.canvasSnapshot = null;
    this.lastRoundSummary = null;
  }

  appendGuessHistory(entry) {
    this.guessHistory.push(entry);
    if (this.guessHistory.length > 100) {
      this.guessHistory.shift();
    }
  }

  setCanvasSnapshot(snapshot) {
    this.canvasSnapshot = typeof snapshot === 'string' && snapshot.startsWith('data:image/')
      ? snapshot
      : null;
  }

  getDrawerName() {
    for (const team of Object.values(this.teams)) {
      const player = team.players.find((entry) => entry.id === this.currentDrawer);
      if (player) {
        return player.name;
      }
    }

    return null;
  }

  getRemainingPhaseSeconds() {
    if (!this.phaseStartedAt || !this.phaseDurationSeconds) {
      return 0;
    }

    const elapsedSeconds = (Date.now() - this.phaseStartedAt) / 1000;
    return Math.max(0, Math.ceil(this.phaseDurationSeconds - elapsedSeconds));
  }

  getJoinState(playerId) {
    const playerData = players[playerId];

    return {
      teams: this.teams,
      assignedTeam: playerData?.teamId || null,
      phase: this.phase,
      currentDrawer: this.currentDrawer,
      currentDrawerName: this.getDrawerName(),
      currentDrawingTeam: this.currentDrawingTeam,
      roundDuration: this.roundDuration,
      remainingSeconds: this.getRemainingPhaseSeconds(),
      currentPrompt: this.currentPrompt,
      guessHistory: this.guessHistory,
      canvasSnapshot: this.canvasSnapshot,
      intermission: this.lastRoundSummary,
      gameOverPayload: this.gameOver ? this.getGameOverPayload('sync') : null
    };
  }

  resetForNewGame() {
    for (const team of Object.values(this.teams)) {
      team.score = 0;
    }

    this.currentDrawer = null;
    this.currentPrompt = null;
    this.currentPromptMeta = null;
    this.currentDifficulty = 'easy';
    this.roundStartTime = null;
    this.guessedPlayers.clear();
    this.usedPrompts = {
      easy: new Set(),
      medium: new Set(),
      hard: new Set()
    };
    this.gameActive = false;
    this.finalGuessPhase = false;
    this.finalGuessTeamStatus = { team1: false, team2: false, team3: false };
    this.finalGuessers = { team1: null, team2: null, team3: null };
    this.currentDrawingTeam = null;
    this.roundsCompleted = 0;
    this.roundCounted = false;
    this.gameOver = false;
    this.hintsRevealed = { first: false, second: false };
    this.phase = 'lobby';
    this.phaseStartedAt = null;
    this.phaseDurationSeconds = 0;
    this.clearRoundArtifacts();

    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }

    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }
  }

  getLeastPopulatedTeam() {
    const teamEntries = Object.entries(this.teams);
    const sizes = teamEntries.map(([id, team]) => ({ id, count: team.players.length }));
    const minCount = Math.min(...sizes.map(p => p.count));
    const smallest = sizes.filter(p => p.count === minCount).map(p => p.id);
    return smallest[Math.floor(Math.random() * smallest.length)];
  }

  addPlayer(playerId, playerName, teamId) {
    // avoid duplicates for same socket
    const existingTeam = Object.values(this.teams).find(team =>
      team.players.some(p => p.id === playerId)
    );
    if (existingTeam) {
      return Object.entries(this.teams).find(([, team]) => team === existingTeam)[0];
    }

    // if teamId is not provided or invalid, balance automatically
    let assignTo = teamId;
    if (!this.teams[assignTo]) {
      assignTo = this.getLeastPopulatedTeam();
    }

    if (this.teams[assignTo]) {
      this.teams[assignTo].players.push({ id: playerId, name: playerName });
      players[playerId] = { gameId: this.gameId, teamId: assignTo, playerName };
      return assignTo;
    }

    return null;
  }

  getRandomPrompt(difficulty) {
    const difficultyPrompts = prompts[difficulty];
    const available = difficultyPrompts.filter((_, i) => !this.usedPrompts[difficulty].has(i));

    if (available.length === 0) {
      this.usedPrompts[difficulty].clear();
      return this.getRandomPrompt(difficulty);
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const selectedPrompt = available[randomIndex];
    const originalIndex = difficultyPrompts.indexOf(selectedPrompt);
    this.usedPrompts[difficulty].add(originalIndex);

    return normalizePromptEntry(selectedPrompt);
  }

  getPromptChoices() {
    // Return 2 easy, 2 medium, 2 hard for drawer to choose from
    return {
      easy: [this.getRandomPrompt('easy'), this.getRandomPrompt('easy')],
      medium: [this.getRandomPrompt('medium'), this.getRandomPrompt('medium')],
      hard: [this.getRandomPrompt('hard'), this.getRandomPrompt('hard')]
    };
  }

  getCurrentPromptValue() {
    const scoreMap = {
      easy: 1,
      medium: 2,
      hard: 3
    };

    return scoreMap[this.currentDifficulty] || 1;
  }

  pickRandomDrawer(excludedDrawerId = null) {
    const availableTeams = Object.entries(this.teams)
      .filter(([, team]) => team.players.length > 0)
      .map(([teamId, team]) => ({ teamId, team }));

    if (availableTeams.length === 0) {
      this.currentDrawingTeam = null;
      this.currentDrawer = null;
      return null;
    }

    const eligibleTeamPool = availableTeams.filter(({ team }) =>
      team.players.some((player) => player.id !== excludedDrawerId)
    );
    const teamPool = eligibleTeamPool.length > 0 ? eligibleTeamPool : availableTeams;
    const chosenTeam = teamPool[Math.floor(Math.random() * teamPool.length)];

    const eligiblePlayers = chosenTeam.team.players.filter((player) => player.id !== excludedDrawerId);
    const playerPool = eligiblePlayers.length > 0 ? eligiblePlayers : chosenTeam.team.players;
    const chosenPlayer = playerPool[Math.floor(Math.random() * playerPool.length)];

    this.currentDrawingTeam = chosenTeam.teamId;
    this.currentDrawer = chosenPlayer.id;

    return {
      teamId: chosenTeam.teamId,
      teamName: chosenTeam.team.name,
      drawerId: chosenPlayer.id,
      drawerName: chosenPlayer.name
    };
  }

  startRound(options = {}) {
    this.gameOver = false;
    this.gameActive = false;
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }
    this.guessedPlayers.clear();
    this.finalGuessPhase = false;
    this.finalGuessTeamStatus = { team1: false, team2: false, team3: false };
    this.finalGuessers = { team1: null, team2: null, team3: null };
    this.roundCounted = false;
    this.currentPrompt = null;
    this.currentPromptMeta = null;
    this.hintsRevealed = { first: false, second: false };
    this.clearRoundArtifacts();
    this.setPhase('prompt_selection');

    let selection = null;
    if (options.preserveDrawer && this.currentDrawer) {
      for (const [teamId, team] of Object.entries(this.teams)) {
        const player = team.players.find((entry) => entry.id === this.currentDrawer);
        if (player) {
          this.currentDrawingTeam = teamId;
          selection = {
            teamId,
            teamName: team.name,
            drawerId: player.id,
            drawerName: player.name
          };
          break;
        }
      }
    }

    if (!selection) {
      const excludedDrawerId = options.excludeDrawerId === undefined
        ? this.currentDrawer
        : options.excludeDrawerId;
      selection = this.pickRandomDrawer(excludedDrawerId);
    }

    this.roundStartTime = Date.now();
    return {
      choices: this.getPromptChoices(),
      selection
    };
  }

  startFinalGuessPhase() {
    this.finalGuessPhase = true;
    this.finalGuessTeamStatus = { team1: false, team2: false, team3: false };

    for (const [teamId, team] of Object.entries(this.teams)) {
      if (team.players.length > 0) {
        this.finalGuessers[teamId] = team.players[Math.floor(Math.random() * team.players.length)].id;
        this.finalGuessTeamStatus[teamId] = true; // still has chance
      } else {
        this.finalGuessers[teamId] = null;
        this.finalGuessTeamStatus[teamId] = false;
      }
    }
  }

  recordFinalGuess(teamId) {
    this.finalGuessTeamStatus[teamId] = false;
  }

  allFinalGuessesUsed() {
    return Object.values(this.finalGuessTeamStatus).every(status => status === false);
  }

  checkGuess(guess) {
    if (!this.currentPrompt) return false;
    const distance = levenshteinDistance(guess.toLowerCase(), this.currentPrompt.toLowerCase());
    return distance <= 2;
  }

  playerGuessedCorrect(playerId) {
    if (this.guessedPlayers.has(playerId)) return false;
    this.guessedPlayers.add(playerId);
    return true;
  }

  hasPlayerGuessedCorrect(playerId) {
    return this.guessedPlayers.has(playerId);
  }

  recordRoundCompletion() {
    if (this.roundCounted) return;
    this.roundCounted = true;
    this.roundsCompleted += 1;
  }

  getScoreWinner() {
    return Object.entries(this.teams).find(([, team]) => team.score >= this.targetScore) || null;
  }

  getTopTeams() {
    const teamEntries = Object.entries(this.teams);
    const maxScore = Math.max(...teamEntries.map(([, team]) => team.score), 0);
    return teamEntries.filter(([, team]) => team.score === maxScore);
  }

  getGameOverPayload(reason) {
    const scoreWinner = this.getScoreWinner();
    const leaders = this.getTopTeams();
    const singleLeader = leaders.length === 1 ? leaders[0] : null;

    return {
      reason,
      teams: this.teams,
      roundsCompleted: this.roundsCompleted,
      maxRounds: this.maxRounds,
      targetScore: this.targetScore,
      winner: scoreWinner
        ? { teamId: scoreWinner[0], teamName: scoreWinner[1].name, score: scoreWinner[1].score }
        : singleLeader
          ? { teamId: singleLeader[0], teamName: singleLeader[1].name, score: singleLeader[1].score }
          : null,
      tiedTeams: !scoreWinner && leaders.length > 1
        ? leaders.map(([teamId, team]) => ({ teamId, teamName: team.name, score: team.score }))
        : []
    };
  }

  checkGameOver() {
    const scoreWinner = this.getScoreWinner();
    if (scoreWinner) {
      this.gameOver = true;
      return this.getGameOverPayload('target_score');
    }

    if (this.roundsCompleted >= this.maxRounds) {
      this.gameOver = true;
      return this.getGameOverPayload('round_limit');
    }

    return null;
  }

  rotateDrawer() {
    this.pickRandomDrawer(this.currentDrawer);
    this.gameActive = false;
  }

  endRound() {
    this.recordRoundCompletion();
    this.gameActive = false;
    this.finalGuessPhase = false;
    this.finalGuessTeamStatus = { team1: false, team2: false, team3: false };

    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }

  removePlayer(playerId) {
    const playerData = players[playerId];
    if (!playerData) return;

    const game = games[playerData.gameId];
    if (!game) return;

    const team = game.teams[playerData.teamId];
    if (team) {
      team.players = team.players.filter(p => p.id !== playerId);
    }

    delete players[playerId];
    return game.teams;
  }
}

function emitRoundStarted(gameId, game) {
  if (game.gameOver) return;
  const roundData = game.startRound();
  io.to(gameId).emit('round_started', {
    choices: roundData.choices,
    drawer: game.currentDrawer,
    drawingTeam: game.currentDrawingTeam,
    selection: roundData.selection,
    drawerName: roundData.selection?.drawerName || null,
    duration: game.roundDuration,
    teams: game.teams
  });
}

function emitRestartedRound(gameId, game) {
  if (game.gameOver) return;
  const roundData = game.startRound({ preserveDrawer: true });
  io.to(gameId).emit('round_started', {
    choices: roundData.choices,
    drawer: game.currentDrawer,
    drawingTeam: game.currentDrawingTeam,
    selection: roundData.selection,
    drawerName: roundData.selection?.drawerName || null,
    duration: game.roundDuration,
    teams: game.teams
  });
}

function isAllowedHost(socketId) {
  const normalizedName = players[socketId]?.playerName?.trim().toLowerCase();
  return ALLOWED_STARTERS.has(normalizedName);
}

function scheduleAutomaticNextRound(gameId, payload) {
  const game = games[gameId];
  if (!game || game.gameOver) return;

  if (game.intermissionTimer) {
    clearTimeout(game.intermissionTimer);
  }

  game.lastRoundSummary = {
    ...payload,
    prompt: game.currentPrompt,
    seconds: game.intermissionDuration
  };
  game.setPhase('intermission', game.intermissionDuration);

  io.to(gameId).emit('intermission_started', {
    ...payload,
    prompt: game.currentPrompt,
    seconds: game.intermissionDuration
  });

  game.intermissionTimer = setTimeout(() => {
    game.intermissionTimer = null;
    if (game.gameOver) return;
    emitRoundStarted(gameId, game);
  }, game.intermissionDuration * 1000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_game', (data) => {
    const { playerName, teamId, teamsUserPrincipalName } = data;
    const fixedGameId = 'contractual-canvas';
    const playerDisplayName = playerName || teamsUserPrincipalName?.split('@')[0] || `Player${socket.id.slice(0, 4)}`;

    if (!games[fixedGameId]) {
      games[fixedGameId] = new Game(fixedGameId);
    }

    const game = games[fixedGameId];

    const assignedTeam = game.addPlayer(socket.id, playerDisplayName, teamId);
    socket.join(fixedGameId);

    io.to(fixedGameId).emit('player_joined', {
      teams: game.teams,
      notification: `${playerDisplayName} joined ${assignedTeam}`,
      assignedTeam
    });

    socket.emit('game_state_sync', game.getJoinState(socket.id));

    console.log(`${playerDisplayName} joined game ${fixedGameId} in ${assignedTeam}`);
  });

  socket.on('start_game', (gameId) => {
    const game = games[gameId];
    if (!game || !isAllowedHost(socket.id)) {
      socket.emit('start_game_denied', {
        message: 'Only Amelia or Marlene can start the game.'
      });
      return;
    }

    if (game.gameOver) {
      game.resetForNewGame();
      io.to(gameId).emit('player_joined', {
        teams: game.teams,
        notification: 'A new game has started.',
        assignedTeam: players[socket.id]?.teamId || null
      });
    }

    emitRoundStarted(gameId, game);
  });

  socket.on('select_prompt', (data) => {
    const { gameId, prompt, difficulty } = data;
    const game = games[gameId];
    if (!game) return;
    const drawer = Object.values(game.teams)
      .flatMap((team) => team.players)
      .find((player) => player.id === game.currentDrawer);

    game.currentPrompt = prompt;
    game.currentPromptMeta = findPromptEntry(prompt);
    game.currentDifficulty = (difficulty || 'easy').toLowerCase();
    game.gameActive = false;
    game.hintsRevealed = { first: false, second: false };
    game.setPhase('countdown', game.preRoundCountdown);

    io.to(gameId).emit('round_prompt_selected', {
      drawer: game.currentDrawer,
      drawerName: drawer?.name || null,
      countdown: game.preRoundCountdown,
      duration: game.roundDuration
    });

    setTimeout(() => {
      if (!game.currentPrompt || game.currentPrompt !== prompt) return;

      game.gameActive = true;
      game.setPhase('live', game.roundDuration);
      io.to(gameId).except(game.currentDrawer).emit('round_live_started', {
        drawer: game.currentDrawer,
        drawerName: drawer?.name || null,
        canDraw: false,
        duration: game.roundDuration
      });
      io.to(game.currentDrawer).emit('round_live_started', {
        drawer: game.currentDrawer,
        drawerName: drawer?.name || null,
        canDraw: true,
        duration: game.roundDuration
      });

      // Start round timer after the countdown ends.
      const startTime = Date.now();
      const timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = game.roundDuration - elapsed;

        io.to(gameId).emit('timer_update', { remaining: Math.max(0, remaining) });

        if (!game.hintsRevealed.first && remaining <= 60) {
          const firstHint = game.currentPromptMeta?.guesserHints?.[0];
          if (firstHint) {
            game.appendGuessHistory({ type: 'hint', text: firstHint, hintNumber: 1 });
            io.to(gameId).except(game.currentDrawer).emit('guesser_hint', {
              hintNumber: 1,
              text: firstHint,
              remaining: Math.max(0, remaining)
            });
          }
          game.hintsRevealed.first = true;
        }

        if (!game.hintsRevealed.second && remaining <= 30) {
          const secondHint = game.currentPromptMeta?.guesserHints?.[1];
          if (secondHint) {
            game.appendGuessHistory({ type: 'hint', text: secondHint, hintNumber: 2 });
            io.to(gameId).except(game.currentDrawer).emit('guesser_hint', {
              hintNumber: 2,
              text: secondHint,
              remaining: Math.max(0, remaining)
            });
          }
          game.hintsRevealed.second = true;
        }

        if (remaining <= 0) {
          clearInterval(timerInterval);
          game.endRound();
          io.to(gameId).emit('round_ended', {
            prompt: game.currentPrompt,
            guessedPlayers: Array.from(game.guessedPlayers),
            noGuess: game.guessedPlayers.size === 0
          });

          const gameOverPayload = game.checkGameOver();
          if (gameOverPayload) {
            game.setPhase('game_over');
            io.to(gameId).emit('game_over', gameOverPayload);
          } else if (game.guessedPlayers.size === 0) {
            scheduleAutomaticNextRound(gameId, { reason: 'no_guess' });
          }
        }
      }, 100);

      game.roundTimer = timerInterval;
    }, game.preRoundCountdown * 1000);
  });

  socket.on('draw', (data) => {
    const {
      gameId,
      x0,
      y0,
      x1,
      y1,
      x0Ratio,
      y0Ratio,
      x1Ratio,
      y1Ratio,
      color,
      size,
      sizeRatio,
      isEraser
    } = data;
    io.to(gameId).emit('draw', {
      x0,
      y0,
      x1,
      y1,
      x0Ratio,
      y0Ratio,
      x1Ratio,
      y1Ratio,
      color,
      size,
      sizeRatio,
      isEraser,
      senderId: socket.id
    });
  });

  socket.on('canvas_snapshot', (data) => {
    const { gameId, snapshot } = data || {};
    const game = games[gameId];
    if (!game) return;
    game.setCanvasSnapshot(snapshot);
  });

  socket.on('cursor_move', (data) => {
    const { gameId, x, y, xRatio, yRatio, isEraser } = data;
    socket.to(gameId).emit('cursor_move', {
      x,
      y,
      xRatio,
      yRatio,
      isEraser,
      senderId: socket.id
    });
  });

  socket.on('cursor_hide', (data) => {
    const { gameId } = data;
    socket.to(gameId).emit('cursor_hide', {
      senderId: socket.id
    });
  });

  socket.on('guess', (data) => {
    const { gameId, guess } = data;
    const game = games[gameId];
    if (!game || !game.gameActive) return;

    const playerData = players[socket.id];
    if (!playerData) return;

    game.appendGuessHistory({
      type: 'guess',
      player: playerData.playerName,
      guess
    });

    io.to(gameId).emit('guess_logged', {
      player: playerData.playerName,
      guess
    });

    const isCorrect = game.checkGuess(guess);
    const playerGuessedAlready = game.hasPlayerGuessedCorrect(socket.id);

    if (isCorrect && !playerGuessedAlready) {
      game.playerGuessedCorrect(socket.id);
      const team = game.teams[playerData.teamId];
      const pointsAwarded = game.getCurrentPromptValue();
      team.score += pointsAwarded;

      io.to(gameId).emit('correct_guess', {
        player: playerData.playerName,
        team: playerData.teamId,
        pointsAwarded,
        teams: game.teams,
        prompt: game.currentPrompt,
        guessedCount: game.guessedPlayers.size
      });

      game.endRound();
      io.to(gameId).emit('round_ended', {
        prompt: game.currentPrompt,
        guessedPlayers: Array.from(game.guessedPlayers)
      });
      const gameOverPayload = game.checkGameOver();
      if (gameOverPayload) {
        game.setPhase('game_over');
        io.to(gameId).emit('game_over', gameOverPayload);
      } else {
        scheduleAutomaticNextRound(gameId, {
          reason: 'correct_guess',
          player: playerData.playerName,
          teamId: playerData.teamId,
          teamName: team.name,
          pointsAwarded
        });
      }
    }
  });

  socket.on('undo', (data) => {
    const { gameId, snapshot } = data || {};
    if (!gameId) return;
    const game = games[gameId];
    if (game && snapshot) {
      game.setCanvasSnapshot(snapshot);
    }
    socket.to(gameId).emit('undo', { snapshot });
  });

  socket.on('clear_canvas', (data) => {
    const { gameId, snapshot } = data || {};
    if (!gameId) return;
    const game = games[gameId];
    if (game) {
      game.setCanvasSnapshot(snapshot || null);
    }
    socket.to(gameId).emit('clear_canvas', { snapshot });
  });

  socket.on('next_round', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('next_round_denied', {
        message: 'Only Amelia or Marlene can start the next round.'
      });
      return;
    }
    if (game.gameOver) return;
    if (game.intermissionTimer) {
      clearTimeout(game.intermissionTimer);
      game.intermissionTimer = null;
    }
    emitRoundStarted(gameId, game);
  });

  socket.on('restart_round', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('restart_round_denied', {
        message: 'Only Amelia or Marlene can restart the round.'
      });
      return;
    }

    if (game.intermissionTimer) {
      clearTimeout(game.intermissionTimer);
      game.intermissionTimer = null;
    }

    emitRestartedRound(gameId, game);
  });

  socket.on('end_game', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('end_game_denied', {
        message: 'Only Amelia or Marlene can end the game.'
      });
      return;
    }

    game.resetForNewGame();
    io.to(gameId).emit('game_reset', {
      teams: game.teams,
      message: 'The game was ended by the host.'
    });
  });

  socket.on('restart_game', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('restart_game_denied', {
        message: 'Only Amelia or Marlene can restart the game.'
      });
      return;
    }

    game.resetForNewGame();
    io.to(gameId).emit('game_reset', {
      teams: game.teams,
      message: 'The game was restarted by the host.'
    });
  });

  socket.on('add_points', (data) => {
    const { gameId, teamId, points } = data || {};
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('add_points_denied', {
        message: 'Only Amelia or Marlene can add points.'
      });
      return;
    }

    const team = game.teams[teamId];
    const parsedPoints = Number(points);
    if (!team || !Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      socket.emit('add_points_denied', {
        message: 'Choose a valid team and a positive point amount.'
      });
      return;
    }

    team.score += parsedPoints;
    io.to(gameId).emit('score_updated', {
      teams: game.teams,
      teamId,
      points: parsedPoints,
      message: `${team.name} received ${parsedPoints} manual point${parsedPoints === 1 ? '' : 's'}.`
    });

    const gameOverPayload = game.checkGameOver();
    if (gameOverPayload) {
      game.setPhase('game_over');
      game.setPhase('game_over');
      io.to(gameId).emit('game_over', gameOverPayload);
    }
  });

  socket.on('remove_points', (data) => {
    const { gameId, teamId, points } = data || {};
    const game = games[gameId];
    if (!game) return;
    if (!isAllowedHost(socket.id)) {
      socket.emit('remove_points_denied', {
        message: 'Only Amelia or Marlene can remove points.'
      });
      return;
    }

    const team = game.teams[teamId];
    const parsedPoints = Number(points);
    if (!team || !Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      socket.emit('remove_points_denied', {
        message: 'Choose a valid team and a positive point amount.'
      });
      return;
    }

    team.score = Math.max(0, team.score - parsedPoints);
    io.to(gameId).emit('score_updated', {
      teams: game.teams,
      teamId,
      points: parsedPoints,
      message: `${team.name} lost ${parsedPoints} manual point${parsedPoints === 1 ? '' : 's'}.`
    });
  });

  socket.on('change_difficulty', (data) => {
    const { gameId, difficulty } = data;
    const game = games[gameId];
    if (game) {
      game.currentDifficulty = difficulty;
      io.to(gameId).emit('difficulty_changed', { difficulty });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const game = games['contractual-canvas'];
    const teams = game?.removePlayer(socket.id);
    if (teams) {
      io.to('contractual-canvas').emit('player_joined', {
        teams,
        notification: `A player left the game and has been removed from their team.`
      });

      // Check if all teams are empty (no players left)
      const allEmpty = Object.values(teams).every(team => team.players.length === 0);
      if (allEmpty) {
        // Reset scores and game state
        game.resetForNewGame();
        io.to('contractual-canvas').emit('game_reset', {
          teams: game.teams,
          notification: 'All players have left. Game has been reset.'
        });
      }
    } else {
      delete players[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Drawing game server running on http://localhost:${PORT}`);
});
