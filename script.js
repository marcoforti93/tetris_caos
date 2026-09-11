const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

let COLS = 20;
let ROWS = 20;
let blockSize = 30;
let arena = [];

function resizeCanvas() {
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  
  blockSize = Math.floor(w / COLS);
  if (blockSize < 10) blockSize = 10;

  ROWS = Math.floor(h / blockSize);

  canvas.width = COLS * blockSize;
  canvas.height = ROWS * blockSize;

  const newArena = createMatrix(COLS, ROWS);
  if (arena.length) {
    for (let y = 0; y < Math.min(arena.length, ROWS); y++) {
      for (let x = 0; x < Math.min(arena[y].length, COLS); x++) {
        newArena[ROWS - 1 - y][x] = arena[arena.length - 1 - y][x];
      }
    }
  }
  arena = newArena;

  context.setTransform(1, 0, 0, 1, 0, 0); 
  context.scale(blockSize, blockSize);
}

nextContext.scale(25, 25);

// Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type = 'sine', duration = 0.1) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

const PIECES = {
  'I': [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  'L': [[0, 2, 0], [0, 2, 0], [0, 2, 2]],
  'J': [[0, 3, 0], [0, 3, 0], [3, 3, 0]],
  'O': [[4, 4], [4, 4]],
  'Z': [[5, 5, 0], [0, 5, 5], [0, 0, 0]],
  'S': [[0, 6, 6], [6, 6, 0], [0, 0, 0]],
  'T': [[0, 7, 0], [7, 7, 7], [0, 0, 0]],
  'G': [[4, 4, 4], [4, 4, 4], [4, 4, 4]], // Peça Gigante
  'D': [[5, 0, 5], [0, 5, 0], [5, 5, 0]]  // Novo Desafio: Peça Deformada (Assimétrica)
};

const COLORS = [
  null,
  '#00f0ff', // I
  '#ff7700', // L
  '#0055ff', // J
  '#ffee00', // O
  '#ff0055', // Z
  '#00ff66', // S
  '#a000ff'  // T
];

function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

// Sistema de Partículas
let particles = [];
function createExplosion(x, y, color) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 0.2 + 0.1,
      color: color,
      life: 1.0
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.04;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    context.fillStyle = p.color;
    context.globalAlpha = p.life;
    context.fillRect(p.x, p.y, p.size, p.size);
    context.globalAlpha = 1.0;
  });
}

const player = {
  pos: {x: 0, y: 0},
  matrix: null,
  nextMatrix: null,
  score: 0,
  level: 1,
  lines: 0,
  // Modificadores de Desafios
  isDrunk: false,
  isInverted: false,
  isTurbo: false,
  isMutant: false,
  isGiant: false,
  isDeformed: false,
  isPlaying: false
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let levelTimer = 15;
let timerInterval = null;

function triggerShake() {
  wrapper.classList.remove('shake');
  void wrapper.offsetWidth;
  wrapper.classList.add('shake');
}

function getRandomPiece() {
  const pieces = 'ILJOTSZ';
  const type = pieces[pieces.length * Math.random() | 0];
  return PIECES[type];
}

function drawMatrix(matrix, offset, ctx = context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        let color = COLORS[value];

        if (player.isDrunk && ctx === context && matrix === player.matrix) {
          color = (Math.floor(Date.now() / 150) % 2 === 0) ? '#ff00ff' : '#ffee00';
        } else if (player.isInverted && ctx === context && matrix === player.matrix) {
          color = (Math.floor(Date.now() / 120) % 2 === 0) ? '#00f0ff' : '#001133';
        } else if (player.isTurbo && ctx === context && matrix === player.matrix) {
          color = '#ffea00';
        } else if (player.isDeformed && ctx === context && matrix === player.matrix) {
          color = (Math.floor(Date.now() / 200) % 2 === 0) ? '#ff3333' : '#777777';
        }

        ctx.fillStyle = color;
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);

        if (player.isMutant && ctx === context && matrix === player.matrix) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(x + offset.x + 0.25, y + offset.y + 0.25, 0.5, 0.5);
        }
      }
    });
  });
}

function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, COLS, ROWS);

  drawMatrix(arena, {x: 0, y: 0});
  if (player.matrix) {
    drawMatrix(player.matrix, player.pos);
  }

  drawParticles();

  nextContext.fillStyle = '#000';
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (player.nextMatrix) {
    drawMatrix(player.nextMatrix, {x: 1, y: 1}, nextContext);
  }
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function playerRotate(dir) {
  if (!player.isPlaying) return;

  if (player.isDrunk && Math.random() < 0.4) {
    playSound(150, 'sawtooth', 0.2);
    return;
  }

  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
  playSound(400, 'triangle', 0.05);
}

function checkLineMutate() {
  if (player.isMutant) {
    const newShape = getRandomPiece();
    const oldMatrix = player.matrix;
    player.matrix = newShape;
    if (collide(arena, player)) {
      player.matrix = oldMatrix;
    } else {
      playSound(700, 'sine', 0.08);
    }
  }
}

function playerDrop() {
  if (!player.isPlaying) return;
  player.pos.y++;

  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
  } else {
    checkLineMutate();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  if (!player.isPlaying) return;
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  triggerShake();
  playSound(150, 'square', 0.1);
  playerReset();
  arenaSweep();
  updateScore();
  dropCounter = 0;
}

function playerMove(dir) {
  if (!player.isPlaying) return;

  if (player.isDrunk && Math.random() < 0.4) {
    dir = -dir;
    playSound(180, 'sawtooth', 0.15);
  }

  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  } else {
    playSound(250, 'sine', 0.03);
  }
}

function playerReset() {
  if (!player.nextMatrix) player.nextMatrix = getRandomPiece();
  
  player.matrix = player.nextMatrix;
  player.nextMatrix = getRandomPiece();
  
  player.isDrunk = false;
  player.isInverted = false;
  player.isTurbo = false;
  player.isMutant = false;
  player.isGiant = false;
  player.isDeformed = false;

  // Sorteia Desafios
  const rand = Math.random();
  if (rand < 0.15) player.isDrunk = true;
  else if (rand >= 0.15 && rand < 0.30) player.isInverted = true;
  else if (rand >= 0.30 && rand < 0.45) player.isTurbo = true;
  else if (rand >= 0.45 && rand < 0.60) player.isMutant = true;
  else if (rand >= 0.60 && rand < 0.72) {
    player.isGiant = true;
    player.matrix = PIECES['G'];
  } else if (rand >= 0.72 && rand < 0.85) {
    player.isDeformed = true;
    player.matrix = PIECES['D'];
  }

  const baseSpeed = Math.max(80, 1000 - (player.level - 1) * 90);
  dropInterval = player.isTurbo ? Math.max(40, baseSpeed / 3) : baseSpeed;

  updateStatusUI();

  player.pos.y = 0;
  player.pos.x = (COLS / 2 | 0) - (player.matrix[0].length / 2 | 0);

  if (collide(arena, player)) {
    gameOver();
  }
}

function updateStatusUI() {
  const statusEl = document.getElementById('status-effect');
  if (player.isDrunk) {
    statusEl.innerText = '🥴 BÊBADA!';
    statusEl.className = 'status-drunk';
  } else if (player.isInverted) {
    statusEl.innerText = '🔄 INVERTIDA!';
    statusEl.className = 'status-inverted';
  } else if (player.isTurbo) {
    statusEl.innerText = '⚡ TURBO!';
    statusEl.className = 'status-turbo';
  } else if (player.isMutant) {
    statusEl.innerText = '🌀 MUTANTE!';
    statusEl.className = 'status-mutant';
  } else if (player.isGiant) {
    statusEl.innerText = '🐘 GIGANTE!';
    statusEl.className = 'status-giant';
  } else if (player.isDeformed) {
    statusEl.innerText = '🔨 DEFORMADA!';
    statusEl.className = 'status-deformed';
  } else {
    statusEl.innerText = 'NORMAL';
    statusEl.className = 'status-normal';
  }
}

function arenaSweep() {
  let rowCount = 1;
  let clearedLines = 0;

  for (let y = arena.length - 1; y >= 0; --y) {
    if (arena[y].every(value => value !== 0)) {
      
      for (let x = 0; x < COLS; x++) {
        const colorVal = arena[y][x];
        createExplosion(x, y, COLORS[colorVal] || '#00f0ff');
      }

      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y;

      clearedLines++;
      player.score += rowCount * 100 * player.level;
      player.lines++;
      rowCount *= 2;

      playSound(800 + clearedLines * 100, 'square', 0.2);
    }
  }

  if (clearedLines > 0) {
    triggerShake();
  }
}

function startLevelTimer() {
  clearInterval(timerInterval);
  levelTimer = 15;
  document.getElementById('timer').innerText = levelTimer;

  timerInterval = setInterval(() => {
    if (!player.isPlaying) return;
    levelTimer--;
    document.getElementById('timer').innerText = levelTimer;

    if (levelTimer <= 0) {
      levelTimer = 15;
      player.level++;
      playSound(1000, 'sine', 0.3);
      triggerShake();
    }
  }, 1000);
}

function updateScore() {
  document.getElementById('score').innerText = player.score;
  document.getElementById('level').innerText = player.level;
  document.getElementById('lines').innerText = player.lines;
}

function saveHighScore(score) {
  const inputName = document.getElementById('player-name').value.trim();
  const name = inputName || 'Anônimo';
  
  let highScores = [];
  try {
    highScores = JSON.parse(localStorage.getItem('tetris_scores')) || [];
  } catch(e) {
    highScores = [];
  }

  highScores.push({ name, score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5);

  localStorage.setItem('tetris_scores', JSON.stringify(highScores));
  renderHighScores();
}

function renderHighScores() {
  let highScores = [];
  try {
    highScores = JSON.parse(localStorage.getItem('tetris_scores')) || [];
  } catch(e) {
    highScores = [];
  }

  const list = document.getElementById('high-scores-list');
  if (highScores.length === 0) {
    list.innerHTML = '<li>Sem recordes</li>';
    return;
  }

  list.innerHTML = highScores
    .map(entry => `<li><strong>${entry.name}</strong>: ${entry.score}</li>`)
    .join('');
}

function gameOver() {
  player.isPlaying = false;
  playSound(100, 'sawtooth', 0.6);
  clearInterval(timerInterval);
  triggerShake();
  saveHighScore(player.score);
  alert(`Fim de Jogo! Pontuação final: ${player.score}`);
}

function startGame() {
  const nameInput = document.getElementById('player-name').value.trim();
  if (!nameInput) {
    alert('Por favor, digite seu nome antes de iniciar!');
    return;
  }

  resizeCanvas();
  arena.forEach(row => row.fill(0));
  particles = [];
  player.score = 0;
  player.level = 1;
  player.lines = 0;
  player.isPlaying = true;
  
  playerReset();
  updateScore();
  startLevelTimer();
}

document.getElementById('start-btn').addEventListener('click', startGame);

document.addEventListener('keydown', event => {
  if (!player.isPlaying) return;

  if (player.isInverted) {
    if (event.keyCode === 37) playerMove(1);
    else if (event.keyCode === 39) playerMove(-1);
    else if (event.keyCode === 40) playerRotate(1);
    else if (event.keyCode === 38) playerDrop();
    else if (event.keyCode === 32) playerRotate(-1);
  } else {
    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
    else if (event.keyCode === 32) playerHardDrop();
  }
});

window.addEventListener('resize', resizeCanvas);

// Inicialização
resizeCanvas();
renderHighScores();

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (player.isPlaying) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }

  updateParticles();
  draw();
  requestAnimationFrame(update);
}

update();