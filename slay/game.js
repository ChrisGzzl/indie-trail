const COLS = 7;
const ROWS = 15;
const MAX_ENERGY = 3;

const CARD_LIBRARY = {
  advance: {
    name: "突进",
    cost: 0,
    type: "位移",
    glyph: "↟",
    accent: "#70c6b5",
    description: "移动至2格内的空位。",
    target: "move",
  },
  strike: {
    name: "斩击",
    cost: 1,
    type: "近战",
    glyph: "╱",
    accent: "#d86654",
    description: "对2格内敌人造成7点伤害。",
    target: "enemy",
  },
  pierce: {
    name: "贯阵",
    cost: 1,
    type: "纵列",
    glyph: "↑",
    accent: "#7da9c7",
    description: "攻击英雄上方同列，造成5点伤害。",
    target: "column",
  },
  sweep: {
    name: "横扫",
    cost: 1,
    type: "横排",
    glyph: "↔",
    accent: "#d58b62",
    description: "选一横排，对该排敌人造成5点伤害。",
    target: "row",
  },
  trap: {
    name: "钉刺陷阱",
    cost: 1,
    type: "机关",
    glyph: "◇",
    accent: "#ddb46a",
    description: "敌人踏入时受8点伤害并减速。",
    target: "trap",
  },
  barrier: {
    name: "拒马",
    cost: 1,
    type: "路障",
    glyph: "▥",
    accent: "#b38a62",
    description: "放置拥有14生命的路障，阻挡敌军。",
    target: "barrier",
  },
  firebomb: {
    name: "燃烧弹",
    cost: 2,
    type: "范围",
    glyph: "✦",
    accent: "#e36f4d",
    description: "目标及周围8格造成7点伤害。",
    target: "area",
  },
  shove: {
    name: "盾撞",
    cost: 1,
    type: "控制",
    glyph: "⇈",
    accent: "#8cb7ad",
    description: "造成3点伤害，并将敌人向上推2格。",
    target: "push",
  },
  guard: {
    name: "守势",
    cost: 1,
    type: "防御",
    glyph: "◆",
    accent: "#78a8c4",
    description: "获得7点护甲，本回合抵挡伤害。",
    target: "self",
  },
};

const ENEMY_LIBRARY = {
  raider: { name: "掠袭者", hp: 11, speed: 2, attack: 5, color: "#a44c42" },
  runner: { name: "疾行兽", hp: 8, speed: 3, attack: 4, color: "#b56546" },
  brute: { name: "铁甲兵", hp: 18, speed: 1, attack: 7, color: "#77514a" },
  shaman: { name: "咒术师", hp: 12, speed: 1, attack: 5, color: "#7360a5", ranged: 3 },
};

const WAVE_SCHEDULE = [
  {
    turn: 1,
    title: "第一波 · 试探",
    units: [
      { type: "raider", col: 1, row: 1 },
      { type: "brute", col: 5, row: 0 },
    ],
  },
  {
    turn: 3,
    title: "第二波 · 夹击",
    units: [
      { type: "runner", col: 0, row: 0 },
      { type: "raider", col: 3, row: 1 },
      { type: "runner", col: 6, row: 0 },
    ],
  },
  {
    turn: 6,
    title: "第三波 · 破阵",
    units: [
      { type: "shaman", col: 2, row: 0 },
      { type: "brute", col: 4, row: 1 },
    ],
  },
];

const board = document.querySelector("#board");
const handElement = document.querySelector("#hand");
const healthText = document.querySelector("#healthText");
const healthFill = document.querySelector("#healthFill");
const armorReadout = document.querySelector("#armorReadout");
const armorValue = document.querySelector("#armorValue");
const turnLabel = document.querySelector("#turnLabel");
const waveLabel = document.querySelector("#waveLabel");
const enemyCount = document.querySelector("#enemyCount");
const energyPips = document.querySelector("#energyPips");
const selectionHint = document.querySelector("#selectionHint");
const stepButton = document.querySelector("#stepButton");
const endTurnButton = document.querySelector("#endTurnButton");
const toast = document.querySelector("#toast");
const waveBanner = document.querySelector("#waveBanner");
const startScreen = document.querySelector("#startScreen");
const resultScreen = document.querySelector("#resultScreen");
const resultEyebrow = document.querySelector("#resultEyebrow");
const resultMark = document.querySelector("#resultMark");
const resultTitle = document.querySelector("#resultTitle");
const resultSummary = document.querySelector("#resultSummary");
const resultStats = document.querySelector("#resultStats");

let idCounter = 0;
let toastTimer;
let state;
const cells = [];

function syncViewportSize() {
  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width || window.innerWidth);
  const height = Math.round(viewport?.height || window.innerHeight);
  document.documentElement.style.setProperty("--app-width", `${width}px`);
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function createBoard() {
  board.innerHTML = "";
  cells.length = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("aria-label", `第${row + 1}行，第${col + 1}列`);
      if (row < 4) cell.classList.add("spawn-zone");
      if (row >= ROWS - 4) cell.classList.add("defense-zone");
      cell.addEventListener("click", () => handleCellClick(row, col));
      board.append(cell);
      cells.push(cell);
    }
  }
}

function newGame() {
  idCounter = 0;
  const deckKeys = [
    "advance", "advance", "strike", "strike", "pierce", "sweep",
    "trap", "trap", "barrier", "firebomb", "shove", "guard",
  ];

  state = {
    phase: "player",
    turn: 1,
    energy: MAX_ENERGY,
    hero: { row: 13, col: 3, hp: 36, maxHp: 36, armor: 0 },
    enemies: [],
    structures: [],
    deck: shuffle(deckKeys.map((key) => ({ ...CARD_LIBRARY[key], key, id: nextId("card") }))),
    discard: [],
    hand: [],
    selectedCardId: null,
    selectionMode: null,
    validTargets: new Set(),
    basicMoveAvailable: true,
    spawnedWaves: 0,
    kills: 0,
    cardsPlayed: 0,
    damageTaken: 0,
    pendingFx: [],
    finished: false,
  };

  resultScreen.hidden = true;
  spawnScheduledWave();
  drawCards(5);
  render();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function drawCards(count) {
  while (state.hand.length < count) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;
      state.deck = shuffle(state.discard);
      state.discard = [];
    }
    state.hand.push(state.deck.pop());
  }
}

function spawnScheduledWave() {
  const wave = WAVE_SCHEDULE.find((item) => item.turn === state.turn);
  if (!wave) return;

  state.spawnedWaves += 1;
  wave.units.forEach((unit) => spawnEnemy(unit));
  showWaveBanner(wave.title);
}

function spawnEnemy(unit) {
  const template = ENEMY_LIBRARY[unit.type];
  let { row, col } = unit;

  if (enemyAt(row, col)) {
    const fallback = [];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < COLS; c += 1) fallback.push({ row: r, col: c });
    }
    const open = fallback.find((position) => !enemyAt(position.row, position.col));
    if (!open) return;
    row = open.row;
    col = open.col;
  }

  state.enemies.push({
    id: nextId("enemy"),
    type: unit.type,
    row,
    col,
    hp: template.hp,
    maxHp: template.hp,
    speed: template.speed,
    attack: template.attack,
    name: template.name,
    color: template.color,
    ranged: template.ranged || 0,
    slow: 0,
  });
}

function showWaveBanner(text) {
  waveBanner.textContent = text;
  waveBanner.hidden = false;
  window.setTimeout(() => {
    waveBanner.hidden = true;
  }, 1150);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1450);
}

function cellIndex(row, col) {
  return row * COLS + col;
}

function keyFor(row, col) {
  return `${row},${col}`;
}

function inside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function distance(aRow, aCol, bRow, bCol) {
  return Math.abs(aRow - bRow) + Math.abs(aCol - bCol);
}

function enemyAt(row, col, excludedId = null) {
  return state.enemies.find((enemy) => enemy.id !== excludedId && enemy.row === row && enemy.col === col);
}

function structureAt(row, col) {
  return state.structures.find((structure) => structure.row === row && structure.col === col);
}

function isOpenForHero(row, col) {
  return inside(row, col) && !enemyAt(row, col) && !structureAt(row, col);
}

function isOpenForPlacement(row, col) {
  return inside(row, col)
    && !(state.hero.row === row && state.hero.col === col)
    && !enemyAt(row, col)
    && !structureAt(row, col);
}

function selectBasicMove() {
  if (state.phase !== "player" || !state.basicMoveAvailable || state.finished) return;
  state.selectedCardId = null;
  state.selectionMode = state.selectionMode === "basicMove" ? null : "basicMove";
  state.validTargets = state.selectionMode === "basicMove" ? getMoveTargets(1) : new Set();
  render();
}

function selectCard(cardId) {
  if (state.phase !== "player" || state.finished) return;
  const card = state.hand.find((item) => item.id === cardId);
  if (!card) return;

  if (card.cost > state.energy) {
    showToast("行动力不足");
    return;
  }

  if (card.target === "self") {
    playCard(card, state.hero.row, state.hero.col);
    return;
  }

  if (state.selectedCardId === cardId) {
    clearSelection();
    render();
    return;
  }

  state.selectionMode = null;
  state.selectedCardId = cardId;
  state.validTargets = getCardTargets(card);

  if (state.validTargets.size === 0) {
    clearSelection();
    showToast("当前没有可用目标");
  }
  render();
}

function clearSelection() {
  state.selectedCardId = null;
  state.selectionMode = null;
  state.validTargets = new Set();
}

function getMoveTargets(range) {
  const targets = new Set();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const dist = distance(state.hero.row, state.hero.col, row, col);
      if (dist > 0 && dist <= range && isOpenForHero(row, col)) targets.add(keyFor(row, col));
    }
  }
  return targets;
}

function getCardTargets(card) {
  const targets = new Set();
  const hero = state.hero;

  if (card.target === "move") return getMoveTargets(2);

  if (card.target === "enemy" || card.target === "push") {
    const range = card.target === "enemy" ? 2 : 4;
    state.enemies.forEach((enemy) => {
      if (distance(hero.row, hero.col, enemy.row, enemy.col) <= range) {
        targets.add(keyFor(enemy.row, enemy.col));
      }
    });
    return targets;
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const dist = distance(hero.row, hero.col, row, col);
      if (card.target === "column" && col === hero.col && row < hero.row && hero.row - row <= 7) {
        targets.add(keyFor(row, col));
      }
      if (card.target === "row" && row < hero.row && hero.row - row <= 5) {
        targets.add(keyFor(row, col));
      }
      if (card.target === "area" && row < hero.row && dist <= 7) {
        targets.add(keyFor(row, col));
      }
      if (card.target === "trap" && row < hero.row && dist <= 6 && isOpenForPlacement(row, col)) {
        targets.add(keyFor(row, col));
      }
      if (card.target === "barrier" && row < hero.row && dist <= 4 && isOpenForPlacement(row, col)) {
        targets.add(keyFor(row, col));
      }
    }
  }
  return targets;
}

function handleCellClick(row, col) {
  if (state.phase !== "player" || state.finished) return;
  if (!state.validTargets.has(keyFor(row, col))) return;

  if (state.selectionMode === "basicMove") {
    state.hero.row = row;
    state.hero.col = col;
    state.basicMoveAvailable = false;
    clearSelection();
    showToast("基础移动已使用");
    render();
    return;
  }

  const card = state.hand.find((item) => item.id === state.selectedCardId);
  if (card) playCard(card, row, col);
}

function playCard(card, row, col) {
  if (card.cost > state.energy || state.phase !== "player") return;
  state.energy -= card.cost;
  state.cardsPlayed += 1;

  switch (card.key) {
    case "advance":
      state.hero.row = row;
      state.hero.col = col;
      break;
    case "strike": {
      const enemy = enemyAt(row, col);
      if (enemy) damageEnemy(enemy, 7);
      break;
    }
    case "pierce":
      state.enemies
        .filter((enemy) => enemy.col === state.hero.col && enemy.row < state.hero.row && state.hero.row - enemy.row <= 7)
        .forEach((enemy) => damageEnemy(enemy, 5));
      break;
    case "sweep":
      state.enemies.filter((enemy) => enemy.row === row).forEach((enemy) => damageEnemy(enemy, 5));
      break;
    case "trap":
      state.structures.push({ id: nextId("trap"), type: "trap", row, col });
      break;
    case "barrier":
      state.structures.push({ id: nextId("barrier"), type: "barrier", row, col, hp: 14, maxHp: 14 });
      break;
    case "firebomb":
      state.enemies
        .filter((enemy) => Math.abs(enemy.row - row) <= 1 && Math.abs(enemy.col - col) <= 1)
        .forEach((enemy) => damageEnemy(enemy, 7));
      break;
    case "shove": {
      const enemy = enemyAt(row, col);
      if (enemy) {
        damageEnemy(enemy, 3);
        if (enemy.hp > 0) pushEnemy(enemy, 2);
      }
      break;
    }
    case "guard":
      state.hero.armor += 7;
      showToast("获得7点护甲");
      break;
    default:
      break;
  }

  const handIndex = state.hand.findIndex((item) => item.id === card.id);
  if (handIndex >= 0) {
    state.discard.push(state.hand[handIndex]);
    state.hand.splice(handIndex, 1);
  }
  clearSelection();
  cleanupDefeatedEnemies();
  render();
  flushFx();
  checkBattleEnd();
}

function pushEnemy(enemy, spaces) {
  for (let step = 0; step < spaces; step += 1) {
    const nextRow = enemy.row - 1;
    if (!inside(nextRow, enemy.col) || enemyAt(nextRow, enemy.col, enemy.id) || structureAt(nextRow, enemy.col)) break;
    enemy.row = nextRow;
  }
}

function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  state.pendingFx.push({ row: enemy.row, col: enemy.col, text: `-${amount}` });
}

function cleanupDefeatedEnemies() {
  const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
  state.kills += defeated.length;
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function damageHero(amount) {
  const absorbed = Math.min(state.hero.armor, amount);
  const hpDamage = amount - absorbed;
  state.hero.armor -= absorbed;
  state.hero.hp -= hpDamage;
  state.damageTaken += hpDamage;
  state.pendingFx.push({ row: state.hero.row, col: state.hero.col, text: hpDamage > 0 ? `-${hpDamage}` : "格挡" });
}

async function endTurn() {
  if (state.phase !== "player" || state.finished) return;
  state.phase = "enemy";
  clearSelection();
  state.discard.push(...state.hand);
  state.hand = [];
  render();
  showToast("敌军行动");
  await delay(280);

  const actingEnemies = [...state.enemies];
  for (const enemy of actingEnemies) {
    if (!state.enemies.some((item) => item.id === enemy.id) || state.finished) continue;
    await actEnemy(enemy);
    cleanupDefeatedEnemies();
    render();
    flushFx();
    if (state.hero.hp <= 0) {
      finishBattle(false);
      return;
    }
  }

  if (checkBattleEnd()) return;

  state.turn += 1;
  state.phase = "player";
  state.energy = MAX_ENERGY;
  state.hero.armor = 0;
  state.basicMoveAvailable = true;
  spawnScheduledWave();
  drawCards(5);
  render();
}

async function actEnemy(enemy) {
  if (enemy.ranged > 0 && enemy.col === state.hero.col) {
    const verticalDistance = state.hero.row - enemy.row;
    if (verticalDistance > 0 && verticalDistance <= enemy.ranged) {
      damageHero(enemy.attack);
      await delay(230);
      return;
    }
  }

  let movement = Math.max(0, enemy.speed - (enemy.slow > 0 ? 1 : 0));
  if (enemy.slow > 0) enemy.slow -= 1;

  for (let step = 0; step < movement; step += 1) {
    if (distance(enemy.row, enemy.col, state.hero.row, state.hero.col) === 1) {
      damageHero(enemy.attack);
      await delay(210);
      return;
    }

    if (enemy.row >= ROWS - 1) {
      damageHero(6);
      state.enemies = state.enemies.filter((item) => item.id !== enemy.id);
      showToast("敌军突破防线");
      await delay(210);
      return;
    }

    const action = chooseEnemyStep(enemy);
    if (!action) return;

    if (action.type === "hero") {
      damageHero(enemy.attack);
      await delay(210);
      return;
    }

    if (action.type === "barrier") {
      action.structure.hp -= enemy.attack;
      state.pendingFx.push({ row: action.structure.row, col: action.structure.col, text: `-${enemy.attack}` });
      if (action.structure.hp <= 0) {
        state.structures = state.structures.filter((item) => item.id !== action.structure.id);
      }
      await delay(210);
      return;
    }

    enemy.row = action.row;
    enemy.col = action.col;
    const trap = structureAt(enemy.row, enemy.col);
    if (trap?.type === "trap") {
      damageEnemy(enemy, 8);
      enemy.slow = 1;
      state.structures = state.structures.filter((item) => item.id !== trap.id);
      showToast("钉刺陷阱触发");
      cleanupDefeatedEnemies();
      render();
      flushFx();
      await delay(240);
      if (enemy.hp <= 0) return;
    } else {
      render();
      await delay(150);
    }
  }
}

function chooseEnemyStep(enemy) {
  const candidates = [
    { row: enemy.row + 1, col: enemy.col },
    { row: enemy.row, col: enemy.col - 1 },
    { row: enemy.row, col: enemy.col + 1 },
  ].filter((position) => inside(position.row, position.col));

  const scored = candidates
    .map((position) => {
      if (position.row === state.hero.row && position.col === state.hero.col) {
        return { ...position, type: "hero", score: -100 };
      }
      if (enemyAt(position.row, position.col, enemy.id)) return null;
      const structure = structureAt(position.row, position.col);
      const score = distance(position.row, position.col, state.hero.row, state.hero.col)
        - (position.row > enemy.row ? 1.8 : 0)
        + (structure?.type === "barrier" ? 8 : 0);
      return { ...position, type: structure?.type === "barrier" ? "barrier" : "move", structure, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  const open = scored.find((candidate) => candidate.type !== "barrier");
  if (open) return open;
  return scored[0] || null;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function checkBattleEnd() {
  if (state.finished) return true;
  if (state.hero.hp <= 0) {
    finishBattle(false);
    return true;
  }
  const allWavesSpawned = state.spawnedWaves >= WAVE_SCHEDULE.length;
  if (allWavesSpawned && state.enemies.length === 0) {
    finishBattle(true);
    return true;
  }
  return false;
}

function finishBattle(victory) {
  state.finished = true;
  state.phase = "finished";
  render();

  resultEyebrow.textContent = victory ? "防线稳定" : "防线失守";
  resultMark.textContent = victory ? "VII" : "×";
  resultTitle.textContent = victory ? "三波敌军已清除" : "守线者倒下了";
  resultSummary.textContent = victory
    ? "你通过位移、控速和范围攻击守住了纵向战场。下一步可以继续验证卡组构筑与关卡奖励。"
    : "观察敌军速度与下落列，提前用路障聚怪、用陷阱换取一个回合，再尝试一次。";
  resultStats.innerHTML = `
    <div><b>${state.turn}</b><span>坚持回合</span></div>
    <div><b>${state.kills}</b><span>消灭敌军</span></div>
    <div><b>${state.cardsPlayed}</b><span>打出卡牌</span></div>
  `;
  window.setTimeout(() => { resultScreen.hidden = false; }, 420);
}

function render() {
  renderHud();
  renderBoard();
  renderHand();
}

function renderHud() {
  const hpPercent = Math.max(0, state.hero.hp / state.hero.maxHp) * 100;
  healthText.textContent = `${Math.max(0, state.hero.hp)} / ${state.hero.maxHp}`;
  healthFill.style.width = `${hpPercent}%`;
  armorReadout.hidden = state.hero.armor <= 0;
  armorValue.textContent = state.hero.armor;
  turnLabel.textContent = `回合 ${state.turn}`;
  waveLabel.textContent = state.spawnedWaves < WAVE_SCHEDULE.length
    ? `第 ${Math.max(1, state.spawnedWaves)} / ${WAVE_SCHEDULE.length} 波`
    : "最终波";
  enemyCount.textContent = `威胁 ${state.enemies.length}`;

  energyPips.innerHTML = "";
  for (let index = 0; index < MAX_ENERGY; index += 1) {
    const pip = document.createElement("i");
    pip.className = `energy-pip${index < state.energy ? " filled" : ""}`;
    energyPips.append(pip);
  }

  stepButton.disabled = !state.basicMoveAvailable || state.phase !== "player";
  stepButton.classList.toggle("selected", state.selectionMode === "basicMove");
  endTurnButton.disabled = state.phase !== "player";

  if (state.phase === "enemy") {
    selectionHint.textContent = "敌军正在执行意图";
  } else if (state.selectionMode === "basicMove") {
    selectionHint.textContent = "选择相邻空格移动";
  } else if (state.selectedCardId) {
    const card = state.hand.find((item) => item.id === state.selectedCardId);
    selectionHint.textContent = card ? `${card.name}：点击高亮目标` : "选择目标";
  } else {
    selectionHint.textContent = "选择卡牌或使用基础移动";
  }
}

function renderBoard() {
  cells.forEach((cell) => {
    cell.innerHTML = "";
    cell.classList.remove("valid-target", "danger-target", "range-preview");
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const key = keyFor(row, col);
    if (state.validTargets.has(key)) {
      cell.classList.add("valid-target");
      const selected = state.hand.find((card) => card.id === state.selectedCardId);
      if (selected && ["enemy", "column", "row", "area", "push"].includes(selected.target)) {
        cell.classList.add("danger-target");
      }
    }
  });

  renderStructureLayer();
  renderEnemyLayer();
  renderHeroLayer();
}

function renderStructureLayer() {
  state.structures.forEach((structure) => {
    const cell = cells[cellIndex(structure.row, structure.col)];
    const element = document.createElement("div");
    element.className = `structure structure--${structure.type}`;
    if (structure.type === "barrier") {
      const hp = document.createElement("span");
      hp.className = "hp-chip";
      hp.textContent = structure.hp;
      element.append(hp);
    }
    cell.append(element);
  });
}

function renderEnemyLayer() {
  state.enemies.forEach((enemy) => {
    const cell = cells[cellIndex(enemy.row, enemy.col)];
    const unit = document.createElement("div");
    unit.className = `unit unit--enemy type-${enemy.type}`;
    unit.style.setProperty("--enemy-color", enemy.color);
    unit.setAttribute("aria-label", `${enemy.name}，生命${enemy.hp}，速度${enemy.speed}`);
    unit.innerHTML = `
      <div class="unit-body"></div>
      <span class="intent-chip">↓${Math.max(0, enemy.speed - (enemy.slow > 0 ? 1 : 0))}</span>
      <span class="hp-chip">${enemy.hp}</span>
      ${enemy.slow > 0 ? '<span class="status-chip">缓</span>' : ""}
    `;
    cell.append(unit);
  });
}

function renderHeroLayer() {
  const cell = cells[cellIndex(state.hero.row, state.hero.col)];
  const unit = document.createElement("div");
  unit.className = "unit unit--hero";
  unit.setAttribute("aria-label", `守线者，生命${state.hero.hp}`);
  unit.innerHTML = '<div class="unit-body"></div>';
  cell.append(unit);
}

function renderHand() {
  handElement.innerHTML = "";
  state.hand.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.style.setProperty("--card-accent", card.accent);
    button.dataset.glyph = card.glyph;
    button.classList.toggle("selected", state.selectedCardId === card.id);
    button.classList.toggle("unaffordable", card.cost > state.energy);
    button.disabled = state.phase !== "player";
    button.innerHTML = `
      <div class="card-top">
        <span class="card-name">${card.name}</span>
        <span class="card-cost"><b>${card.cost}</b></span>
      </div>
      <p class="card-desc">${card.description}</p>
      <span class="card-type">${card.type}</span>
    `;
    button.addEventListener("click", () => selectCard(card.id));
    handElement.append(button);
  });
}

function flushFx() {
  state.pendingFx.forEach((fx) => {
    const cell = cells[cellIndex(fx.row, fx.col)];
    if (!cell) return;
    const pop = document.createElement("span");
    pop.className = "damage-pop";
    pop.textContent = fx.text;
    cell.append(pop);
    window.setTimeout(() => pop.remove(), 650);
  });
  state.pendingFx = [];
}

document.querySelector("#startButton").addEventListener("click", () => {
  startScreen.hidden = true;
  newGame();
});

document.querySelector("#restartButton").addEventListener("click", newGame);
stepButton.addEventListener("click", selectBasicMove);
endTurnButton.addEventListener("click", endTurn);
window.addEventListener("resize", syncViewportSize, { passive: true });
window.addEventListener("orientationchange", syncViewportSize, { passive: true });
window.visualViewport?.addEventListener("resize", syncViewportSize, { passive: true });
window.visualViewport?.addEventListener("scroll", syncViewportSize, { passive: true });

syncViewportSize();
createBoard();
newGame();
