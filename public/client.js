(function () {
  'use strict';

  const GAME_ID = 'contractual-canvas';

  // Socket connection
  const socket = io();

  // State
  let myId = null;
  let myTeam = null;
  let isDrawer = false;
  let canDraw = false;
  let currentColor = '#ef4444';
  let currentBrushSize = 3;
  let eraserActive = false;
  let currentEraserSize = 10;
  let isMouseDown = false;
  let lastX = null;
  let lastY = null;
  let undoStack = [];
  let gamePhase = 'lobby';
  let promptChoiceTimeout = null;
  let remoteCursors = {};

  // DOM references
  const setupModal = document.getElementById('setupModal');
  const gameContainer = document.getElementById('gameContainer');
  const hostControls = document.getElementById('hostControls');
  const promptChoiceModal = document.getElementById('promptChoiceModal');
  const intermissionModal = document.getElementById('intermissionModal');
  const gameOverModal = document.getElementById('gameOverModal');
  const canvasStatusBanner = document.getElementById('canvasStatusBanner');
  const promptText = document.getElementById('promptText');
  const timerEl = document.getElementById('timer');
  const guessInput = document.getElementById('guessInput');
  const guessHistoryList = document.getElementById('guessHistoryList');
  const drawingCanvas = document.getElementById('drawingCanvas');
  const ctx = drawingCanvas ? drawingCanvas.getContext('2d') : null;
  const brushBtn = document.getElementById('brushBtn');
  const eraserBtn = document.getElementById('eraserBtn');
  const brushSizeInput = document.getElementById('brushSize');
  const eraserSizeInput = document.getElementById('eraserSize');
  const colorPickerInput = document.getElementById('colorPicker');
  const hostPrimaryBtn = document.getElementById('hostPrimaryBtn');
  const easyOptions = document.getElementById('easyOptions');
  const mediumOptions = document.getElementById('mediumOptions');
  const hardOptions = document.getElementById('hardOptions');
  const promptChoiceCountdown = document.getElementById('promptChoiceCountdown');

  // ─── Utility helpers ────────────────────────────────────────────────────────

  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  function updateTeams(teams) {
    ['team1', 'team2', 'team3'].forEach(function (teamId) {
      const team = teams[teamId];
      if (!team) return;
      const scoreEl = document.getElementById(teamId + 'Score');
      const playersEl = document.getElementById(teamId + 'Players');
      if (scoreEl) scoreEl.textContent = team.score;
      if (playersEl) {
        playersEl.innerHTML = '';
        team.players.forEach(function (player) {
          const li = document.createElement('li');
          li.textContent = player.name;
          if (player.id === myId) li.style.fontWeight = 'bold';
          playersEl.appendChild(li);
        });
      }
    });
  }

  function appendGuessHistory(entry) {
    if (!guessHistoryList) return;
    const li = document.createElement('li');
    li.className = 'guess-history-item';
    if (entry.type === 'hint') {
      li.className += ' hint-item';
      li.textContent = '\uD83D\uDCA1 Hint ' + entry.hintNumber + ': ' + entry.text;
    } else {
      li.textContent = (entry.player || 'Unknown') + ': ' + (entry.guess || entry.text || '');
    }
    guessHistoryList.appendChild(li);
    guessHistoryList.scrollTop = guessHistoryList.scrollHeight;
  }

  function clearGuessHistory() {
    if (guessHistoryList) guessHistoryList.innerHTML = '';
  }

  function setCanvasBanner(message, type) {
    if (!canvasStatusBanner) return;
    canvasStatusBanner.textContent = message;
    canvasStatusBanner.className = 'canvas-status-banner ' + (type || 'waiting');
    canvasStatusBanner.style.display = message ? 'block' : 'none';
  }

  function resizeCanvas() {
    if (!drawingCanvas) return;
    const container = drawingCanvas.parentElement;
    if (!container) return;
    const snapshot = drawingCanvas.toDataURL();
    drawingCanvas.width = container.clientWidth;
    drawingCanvas.height = container.clientHeight;
    if (snapshot && snapshot !== 'data:,') {
      const img = new Image();
      img.onload = function () { if (ctx) ctx.drawImage(img, 0, 0); };
      img.src = snapshot;
    }
  }

  // ─── Canvas drawing ──────────────────────────────────────────────────────────

  function drawLine(x0, y0, x1, y1, color, size, erasing) {
    if (!ctx) return;
    ctx.save();
    if (erasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  function getCanvasPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      xRatio: (clientX - rect.left) / rect.width,
      yRatio: (clientY - rect.top) / rect.height
    };
  }

  function saveUndoState() {
    if (!drawingCanvas) return;
    undoStack.push(drawingCanvas.toDataURL());
    if (undoStack.length > 30) undoStack.shift();
  }

  function restoreSnapshot(snapshot) {
    if (!ctx || !drawingCanvas) return;
    if (!snapshot || !snapshot.startsWith('data:image/')) {
      ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      return;
    }
    const img = new Image();
    img.onload = function () {
      ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      ctx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
    };
    img.src = snapshot;
  }

  function onMouseDown(e) {
    if (!canDraw) return;
    e.preventDefault();
    saveUndoState();
    isMouseDown = true;
    const pos = getCanvasPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function onMouseMove(e) {
    if (!canDraw) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const size = eraserActive ? currentEraserSize : currentBrushSize;

    // Emit cursor move
    socket.emit('cursor_move', {
      gameId: GAME_ID,
      x: pos.x,
      y: pos.y,
      xRatio: pos.xRatio,
      yRatio: pos.yRatio,
      isEraser: eraserActive
    });

    if (!isMouseDown) return;

    drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, eraserActive);

    socket.emit('draw', {
      gameId: GAME_ID,
      x0: lastX,
      y0: lastY,
      x1: pos.x,
      y1: pos.y,
      x0Ratio: lastX / drawingCanvas.width,
      y0Ratio: lastY / drawingCanvas.height,
      x1Ratio: pos.x / drawingCanvas.width,
      y1Ratio: pos.y / drawingCanvas.height,
      color: currentColor,
      size: size,
      sizeRatio: size / Math.max(drawingCanvas.width, drawingCanvas.height),
      isEraser: eraserActive
    });

    lastX = pos.x;
    lastY = pos.y;
  }

  function onMouseUp(e) {
    if (!canDraw || !isMouseDown) return;
    e.preventDefault();
    isMouseDown = false;
    lastX = null;
    lastY = null;
    // Send snapshot after stroke
    const snapshot = drawingCanvas.toDataURL();
    socket.emit('canvas_snapshot', { gameId: GAME_ID, snapshot });
  }

  function onMouseLeave() {
    if (canDraw) {
      socket.emit('cursor_hide', { gameId: GAME_ID });
    }
    if (isMouseDown) {
      isMouseDown = false;
      lastX = null;
      lastY = null;
    }
  }

  if (drawingCanvas) {
    drawingCanvas.addEventListener('mousedown', onMouseDown);
    drawingCanvas.addEventListener('mousemove', onMouseMove);
    drawingCanvas.addEventListener('mouseup', onMouseUp);
    drawingCanvas.addEventListener('mouseleave', onMouseLeave);
    drawingCanvas.addEventListener('touchstart', onMouseDown, { passive: false });
    drawingCanvas.addEventListener('touchmove', onMouseMove, { passive: false });
    drawingCanvas.addEventListener('touchend', onMouseUp);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  if (brushSizeInput) {
    brushSizeInput.addEventListener('input', function () {
      currentBrushSize = parseInt(this.value, 10);
    });
  }

  if (eraserSizeInput) {
    eraserSizeInput.addEventListener('input', function () {
      currentEraserSize = parseInt(this.value, 10);
    });
  }

  if (colorPickerInput) {
    colorPickerInput.addEventListener('input', function () {
      selectColor(this.value);
    });
  }

  // ─── Exposed functions (called from HTML onclick) ────────────────────────────

  window.joinGame = function () {
    const nameInput = document.getElementById('playerName');
    const playerName = nameInput ? nameInput.value.trim() : '';
    if (!playerName) {
      alert('Please enter your name before joining.');
      return;
    }
    localStorage.setItem('cc_playerName', playerName);
    socket.emit('join_game', { playerName, gameId: GAME_ID });
  };

  window.selectColor = function (color) {
    eraserActive = false;
    currentColor = color;
    if (brushBtn) brushBtn.classList.add('active');
    if (eraserBtn) eraserBtn.classList.remove('active');
    document.querySelectorAll('.color-swatch').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.color === color);
    });
    if (colorPickerInput) colorPickerInput.value = color;
  };

  window.selectBrush = function () {
    eraserActive = false;
    if (brushBtn) brushBtn.classList.add('active');
    if (eraserBtn) eraserBtn.classList.remove('active');
  };

  window.toggleEraser = function () {
    eraserActive = !eraserActive;
    if (eraserBtn) eraserBtn.classList.toggle('active', eraserActive);
    if (brushBtn) brushBtn.classList.toggle('active', !eraserActive);
  };

  window.undoDrawing = function () {
    if (!canDraw) return;
    const snapshot = undoStack.pop() || null;
    restoreSnapshot(snapshot);
    socket.emit('undo', { gameId: GAME_ID, snapshot });
  };

  window.clearCanvas = function () {
    if (!canDraw) return;
    if (!ctx || !drawingCanvas) return;
    saveUndoState();
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    socket.emit('clear_canvas', { gameId: GAME_ID, snapshot: null });
  };

  window.handleGuessKeypress = function (e) {
    if (e.key === 'Enter') {
      const guess = guessInput ? guessInput.value.trim() : '';
      if (!guess) return;
      socket.emit('guess', { gameId: GAME_ID, guess });
      if (guessInput) guessInput.value = '';
    }
  };

  window.togglePrimaryHostAction = function () {
    socket.emit('start_game', GAME_ID);
  };

  window.startNewRound = function () {
    socket.emit('next_round', GAME_ID);
  };

  window.restartRound = function () {
    socket.emit('restart_round', GAME_ID);
  };

  window.restartGame = function () {
    socket.emit('restart_game', GAME_ID);
  };

  window.addPointsToTeam = function () {
    const teamSelect = document.getElementById('hostTeamSelect');
    const pointInput = document.getElementById('hostPointInput');
    const teamId = teamSelect ? teamSelect.value : null;
    const points = pointInput ? parseInt(pointInput.value, 10) : 0;
    if (!teamId || !points) return;
    socket.emit('add_points', { gameId: GAME_ID, teamId, points });
  };

  window.removePointsFromTeam = function () {
    const teamSelect = document.getElementById('hostTeamSelect');
    const pointInput = document.getElementById('hostPointInput');
    const teamId = teamSelect ? teamSelect.value : null;
    const points = pointInput ? parseInt(pointInput.value, 10) : 0;
    if (!teamId || !points) return;
    socket.emit('remove_points', { gameId: GAME_ID, teamId, points });
  };

  // ─── Prompt selection helpers ────────────────────────────────────────────────

  function renderPromptChoices(choices) {
    function renderGroup(container, items, difficulty) {
      container.innerHTML = '';
      items.forEach(function (item) {
        const btn = document.createElement('button');
        btn.className = 'prompt-option-btn';
        btn.textContent = item.text || item;
        btn.addEventListener('click', function () {
          socket.emit('select_prompt', {
            gameId: GAME_ID,
            prompt: item.text || item,
            difficulty
          });
          hide(promptChoiceModal);
          if (promptChoiceTimeout) clearInterval(promptChoiceTimeout);
        });
        container.appendChild(btn);
      });
    }
    if (easyOptions && choices.easy) renderGroup(easyOptions, choices.easy, 'easy');
    if (mediumOptions && choices.medium) renderGroup(mediumOptions, choices.medium, 'medium');
    if (hardOptions && choices.hard) renderGroup(hardOptions, choices.hard, 'hard');
  }

  function startPromptChoiceCountdown(seconds, choices) {
    if (promptChoiceTimeout) clearInterval(promptChoiceTimeout);
    let remaining = seconds;
    if (promptChoiceCountdown) promptChoiceCountdown.textContent = remaining + 's remaining';
    promptChoiceTimeout = setInterval(function () {
      remaining -= 1;
      if (promptChoiceCountdown) promptChoiceCountdown.textContent = remaining + 's remaining';
      if (remaining <= 0) {
        clearInterval(promptChoiceTimeout);
        promptChoiceTimeout = null;
        // Auto-select first easy prompt
        const firstEasy = choices && choices.easy && choices.easy[0];
        if (firstEasy) {
          socket.emit('select_prompt', {
            gameId: GAME_ID,
            prompt: firstEasy.text || firstEasy,
            difficulty: 'easy'
          });
        }
        hide(promptChoiceModal);
      }
    }, 1000);
  }

  // ─── Socket event handlers ───────────────────────────────────────────────────

  socket.on('connect', function () {
    myId = socket.id;

    // On reconnect (socket.io sets socket.recovered or we detect via stored name + visible game UI)
    const storedName = localStorage.getItem('cc_playerName');
    const gameVisible = gameContainer && !gameContainer.classList.contains('hidden');
    if (storedName && gameVisible) {
      // Attempt to silently rejoin with the same name
      socket.emit('join_game', { playerName: storedName, gameId: GAME_ID });
    } else if (storedName && setupModal) {
      // Pre-fill the name input for convenience
      const nameInput = document.getElementById('playerName');
      if (nameInput && !nameInput.value) nameInput.value = storedName;
    }
  });

  socket.on('player_joined', function (data) {
    if (data.teams) updateTeams(data.teams);
    if (data.assignedTeam) myTeam = data.assignedTeam;
  });

  socket.on('game_state_sync', function (data) {
    myTeam = data.assignedTeam || myTeam;
    gamePhase = data.phase || 'lobby';

    if (data.teams) updateTeams(data.teams);

    // Show the game container, hide setup modal
    hide(setupModal);
    show(gameContainer);

    // Show/hide host controls
    const isHost = isAllowedHostLocally();
    if (hostControls) hostControls.style.display = isHost ? '' : 'none';

    // Restore guess history
    if (data.guessHistory && data.guessHistory.length > 0) {
      clearGuessHistory();
      data.guessHistory.forEach(appendGuessHistory);
    }

    // Restore canvas snapshot if in a live round
    if (data.canvasSnapshot) {
      restoreSnapshot(data.canvasSnapshot);
    }

    // Handle current phase
    if (gamePhase === 'live') {
      canDraw = data.currentDrawer === myId;
      isDrawer = canDraw;
      if (data.currentPrompt && isDrawer) {
        if (promptText) promptText.textContent = 'Draw: ' + data.currentPrompt;
      } else {
        if (promptText) promptText.textContent = 'Guess the drawing!';
      }
      const remaining = data.remainingSeconds || 0;
      if (timerEl) timerEl.textContent = remaining + ' seconds';
      setCanvasBanner('', '');
    } else if (gamePhase === 'intermission') {
      canDraw = false;
      isDrawer = false;
      if (data.intermission) {
        showIntermission(data.intermission);
      }
    } else if (gamePhase === 'game_over') {
      canDraw = false;
      isDrawer = false;
      if (data.gameOverPayload) {
        showGameOver(data.gameOverPayload);
      }
    } else {
      canDraw = false;
      isDrawer = false;
      if (promptText) promptText.textContent = 'Waiting for game to start...';
      setCanvasBanner('Waiting for the round to start.', 'waiting');
    }
  });

  socket.on('round_started', function (data) {
    gamePhase = 'prompt_selection';
    canDraw = false;
    isDrawer = data.drawer === myId;

    hide(intermissionModal);
    hide(gameOverModal);
    if (data.teams) updateTeams(data.teams);
    clearGuessHistory();
    if (ctx && drawingCanvas) ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    undoStack = [];

    if (isDrawer) {
      if (promptText) promptText.textContent = 'Choose a prompt to draw!';
      renderPromptChoices(data.choices);
      show(promptChoiceModal);
      startPromptChoiceCountdown(20, data.choices);
    } else {
      const drawerName = data.drawerName || 'Someone';
      if (promptText) promptText.textContent = drawerName + ' is choosing a prompt...';
      hide(promptChoiceModal);
    }

    setCanvasBanner('Waiting for the drawer to choose a prompt.', 'waiting');
    if (timerEl) timerEl.textContent = data.duration + ' seconds';

    if (hostPrimaryBtn) hostPrimaryBtn.textContent = 'End Game';
  });

  socket.on('round_prompt_selected', function (data) {
    gamePhase = 'countdown';
    const drawerName = data.drawerName || 'The drawer';
    if (promptText) promptText.textContent = drawerName + ' is about to draw! Get ready...';
    setCanvasBanner('Round starting in ' + data.countdown + 's...', 'waiting');
    hide(promptChoiceModal);
    if (promptChoiceTimeout) { clearInterval(promptChoiceTimeout); promptChoiceTimeout = null; }
  });

  socket.on('round_live_started', function (data) {
    gamePhase = 'live';
    canDraw = data.canDraw === true;
    isDrawer = data.drawer === myId;

    setCanvasBanner('', '');

    if (isDrawer) {
      if (promptText) promptText.textContent = 'Draw: ' + (window._currentPrompt || '');
    } else {
      const drawerName = data.drawerName || 'Someone';
      if (promptText) promptText.textContent = drawerName + ' is drawing — make your guesses!';
    }
    if (timerEl) timerEl.textContent = data.duration + ' seconds';
  });

  socket.on('prompt_for_drawer', function (data) {
    window._currentPrompt = data.prompt;
    if (isDrawer && promptText) {
      promptText.textContent = 'Draw: ' + data.prompt;
    }
  });

  socket.on('timer_update', function (data) {
    if (timerEl) timerEl.textContent = data.remaining + ' seconds';
  });

  socket.on('guesser_hint', function (data) {
    appendGuessHistory({ type: 'hint', hintNumber: data.hintNumber, text: data.text });
  });

  socket.on('guess_logged', function (data) {
    appendGuessHistory({ type: 'guess', player: data.player, guess: data.guess });
  });

  socket.on('correct_guess', function (data) {
    if (data.teams) updateTeams(data.teams);
    if (promptText) promptText.textContent = data.player + ' guessed correctly!';
  });

  socket.on('round_ended', function (data) {
    gamePhase = 'intermission';
    canDraw = false;
    isDrawer = false;
    if (promptText) promptText.textContent = 'Round ended. Prompt was: ' + (data.prompt || '');
    setCanvasBanner('Round over.', 'waiting');
  });

  socket.on('intermission_started', function (data) {
    gamePhase = 'intermission';
    canDraw = false;
    showIntermission(data);
  });

  function showIntermission(data) {
    const intermissionTitle = document.getElementById('intermissionTitle');
    const intermissionMessage = document.getElementById('intermissionMessage');
    const intermissionPromptEl = document.getElementById('intermissionPrompt');
    const intermissionCountdown = document.getElementById('intermissionCountdown');

    if (intermissionTitle) {
      intermissionTitle.textContent = data.reason === 'correct_guess' ? 'Correct!' : 'Shucks...';
    }
    if (intermissionMessage) {
      if (data.reason === 'correct_guess') {
        intermissionMessage.textContent = (data.player || 'Someone') + ' from ' + (data.teamName || 'a team') + ' guessed it! +' + (data.pointsAwarded || 0) + ' pts';
      } else {
        intermissionMessage.textContent = 'No one could guess the answer!';
      }
    }
    if (intermissionPromptEl) intermissionPromptEl.textContent = 'Prompt: ' + (data.prompt || '');
    if (intermissionCountdown) intermissionCountdown.textContent = 'Next round starts in ' + (data.seconds || 10) + '...';

    show(intermissionModal);

    let remaining = data.seconds || 10;
    const tick = setInterval(function () {
      remaining -= 1;
      if (intermissionCountdown) intermissionCountdown.textContent = 'Next round starts in ' + remaining + '...';
      if (remaining <= 0) clearInterval(tick);
    }, 1000);
  }

  socket.on('game_over', function (data) {
    gamePhase = 'game_over';
    canDraw = false;
    isDrawer = false;
    hide(intermissionModal);
    showGameOver(data);
    if (hostPrimaryBtn) hostPrimaryBtn.textContent = 'Start Game';
  });

  function showGameOver(data) {
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverSubtitle = document.getElementById('gameOverSubtitle');
    const gameOverWinnerLine = document.getElementById('gameOverWinnerLine');
    const gameOverPodium = document.getElementById('gameOverPodium');
    const gameOverFooter = document.getElementById('gameOverFooter');

    if (gameOverTitle) gameOverTitle.textContent = data.winner ? 'Champions!' : 'It\'s a Tie!';
    if (gameOverSubtitle) gameOverSubtitle.textContent = 'The final standings are in.';
    if (gameOverWinnerLine) {
      if (data.winner) {
        gameOverWinnerLine.textContent = data.winner.teamName + ' wins with ' + data.winner.score + ' points!';
      } else if (data.tiedTeams && data.tiedTeams.length > 0) {
        gameOverWinnerLine.textContent = 'Tied: ' + data.tiedTeams.map(function (t) { return t.teamName; }).join(' & ');
      } else {
        gameOverWinnerLine.textContent = '';
      }
    }

    if (gameOverPodium && data.teams) {
      gameOverPodium.innerHTML = '';
      Object.entries(data.teams).sort(function (a, b) { return b[1].score - a[1].score; }).forEach(function (entry) {
        const teamId = entry[0];
        const team = entry[1];
        const div = document.createElement('div');
        div.className = 'podium-team ' + teamId;
        div.innerHTML = '<div class="podium-name">' + team.name + '</div><div class="podium-score">' + team.score + ' pts</div>';
        gameOverPodium.appendChild(div);
      });
    }

    if (gameOverFooter) gameOverFooter.textContent = 'Restart the game to crown the next winner.';
    show(gameOverModal);
  }

  socket.on('game_reset', function (data) {
    gamePhase = 'lobby';
    canDraw = false;
    isDrawer = false;
    hide(gameOverModal);
    hide(intermissionModal);
    if (data.teams) updateTeams(data.teams);
    if (promptText) promptText.textContent = 'Waiting for game to start...';
    setCanvasBanner('Waiting for the round to start.', 'waiting');
    clearGuessHistory();
    if (ctx && drawingCanvas) ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    undoStack = [];
    if (hostPrimaryBtn) hostPrimaryBtn.textContent = 'Start Game';
  });

  socket.on('player_disconnected', function (data) {
    const msg = `${data.playerName || 'A player'} disconnected — they have ${data.reconnectWindowSeconds || 30}s to rejoin.`;
    appendGuessHistory({ type: 'hint', hintNumber: 0, text: msg });
  });

  socket.on('score_updated', function (data) {
    if (data.teams) updateTeams(data.teams);
  });

  // Remote drawing events
  socket.on('draw', function (data) {
    if (data.senderId === myId) return;
    if (!ctx || !drawingCanvas) return;
    const w = drawingCanvas.width;
    const h = drawingCanvas.height;
    const x0 = data.x0Ratio != null ? data.x0Ratio * w : data.x0;
    const y0 = data.y0Ratio != null ? data.y0Ratio * h : data.y0;
    const x1 = data.x1Ratio != null ? data.x1Ratio * w : data.x1;
    const y1 = data.y1Ratio != null ? data.y1Ratio * h : data.y1;
    const size = data.sizeRatio != null ? data.sizeRatio * Math.max(w, h) : data.size;
    drawLine(x0, y0, x1, y1, data.color, size, data.isEraser);
  });

  socket.on('undo', function (data) {
    restoreSnapshot(data.snapshot || null);
  });

  socket.on('clear_canvas', function (data) {
    restoreSnapshot(data.snapshot || null);
  });

  socket.on('cursor_move', function () {
    // Remote cursor display could be added here if desired
  });

  socket.on('cursor_hide', function () {
    // Remote cursor hide could be handled here
  });

  // Denied events
  socket.on('start_game_denied', function (data) {
    alert(data.message || 'You are not allowed to start the game.');
  });

  socket.on('next_round_denied', function (data) {
    alert(data.message || 'You are not allowed to start the next round.');
  });

  socket.on('restart_round_denied', function (data) {
    alert(data.message || 'You are not allowed to restart the round.');
  });

  socket.on('restart_game_denied', function (data) {
    alert(data.message || 'You are not allowed to restart the game.');
  });

  socket.on('end_game_denied', function (data) {
    alert(data.message || 'You are not allowed to end the game.');
  });

  socket.on('add_points_denied', function (data) {
    alert(data.message || 'Could not add points.');
  });

  socket.on('remove_points_denied', function (data) {
    alert(data.message || 'Could not remove points.');
  });

  // ─── Host check ──────────────────────────────────────────────────────────────

  function isAllowedHostLocally() {
    const nameInput = document.getElementById('playerName');
    const name = (nameInput ? nameInput.value : '').trim().toLowerCase();
    return name === 'amelia' || name === 'marlene';
  }

}());
