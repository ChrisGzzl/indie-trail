const PIECES = {
  rK: "帅", rA: "仕", rB: "相", rN: "马", rR: "车", rC: "炮", rP: "兵",
  bK: "将", bA: "士", bB: "象", bN: "马", bR: "车", bC: "炮", bP: "卒"
};
const TYPE_TO_KEY = { k: "K", a: "A", b: "B", n: "N", r: "R", c: "C", p: "P" };
const FILES = "abcdefghi";
const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1";
const ENDGAMES = [
  {
    id: "3y99yTdp", name: "一步杀 · 炮定乾坤", desc: "Pikafish 题库 · 难度 400",
    fen: "3a5/2N1k4/1C6b/8p/3R5/9/3n4P/8B/9/2B2K3 w - - 0 62",
    solution: ["b7b8"]
  },
  {
    id: "rdxMLxCn", name: "一步杀 · 马踏中宫", desc: "Pikafish 题库 · 难度 400",
    fen: "2b1ka3/9/3Rb4/p8/4N4/4C4/9/4B4/4A4/2BAK4 w - - 0 45",
    solution: ["e5f7"]
  },
  {
    id: "1XW0nten", name: "三步杀 · 车马炮合击", desc: "Pikafish 题库 · 难度 1200",
    fen: "5k3/9/2N6/p4r2p/9/9/5R2P/4C4/4A4/2BAK1B2 w - - 0 64",
    solution: ["f3f6", "f9e9", "c7e6", "e9d9", "f6f9"]
  },
  {
    id: "M7g8ECEI", name: "三步杀 · 双车锁宫", desc: "Pikafish 题库 · 难度 1200",
    fen: "2R1Ra3/3k2C2/n4a3/p7p/9/P8/8P/4B4/3rK4/5AB2 w - - 0 45",
    solution: ["e1e0", "d1e1", "e0e1", "a7c8", "c9d9"]
  },
  {
    id: "2DkHJRnv", name: "五步杀 · 马车连攻", desc: "Pikafish 题库 · 难度 2000",
    fen: "2R3b2/4ak3/9/p7p/4P1N2/9/P7P/3C1AN2/c4c3/1rB1KA3 w - - 0 67",
    solution: ["g5h7", "f8f7", "h7g9", "f7f8", "g9h7", "f8f7", "c9c7", "e8d7", "c7d7"]
  },
  {
    id: "cqGBlvbW", name: "五步杀 · 弃子引将", desc: "Pikafish 题库 · 难度 2000",
    fen: "9/3k5/8b/4pRN1p/6b2/p8/3r4P/3Ap4/3C3C1/3AK3c w - - 0 45",
    solution: ["h1h8", "e2e1", "d0e1", "d8e8", "f6e6", "g5e7", "e6e7", "e8d8", "g6f8"]
  }
];

const MATERIAL = { k: 20000, r: 1000, c: 500, n: 450, b: 220, a: 220, p: 120 };
const MATE_SCORE = 100000;
const SEARCH_ABORT = Symbol("search-abort");
const AI_LEVELS = {
  1: { random: true, label: "练习", maxDepth: 1, time: 40, nodes: 1000 },
  2: { label: "入门", maxDepth: 2, time: 260, nodes: 12000 },
  3: { label: "进阶", maxDepth: 3, time: 650, nodes: 50000 },
  4: { label: "挑战", maxDepth: 5, time: 1400, nodes: 140000 },
  5: { label: "大师", maxDepth: 7, time: 2600, nodes: 320000 }
};

let game = new Xiangqi();
let state = {
  version: 5,
  selected: null,
  difficulty: 3,
  flipped: false,
  mode: "标准对弈",
  thinking: false,
  animating: false,
  baseFen: START_FEN,
  lastMove: null,
  puzzle: null,
  puzzlePly: 0
};

let searchNodes = 0;
let searchDeadline = 0;
let searchNodeLimit = 0;
let transposition = new Map();

function square(x, y) { return `${FILES[x]}${9 - y}`; }
function coords(name) { return [FILES.indexOf(name[0]), 9 - Number(name[1])]; }
function sameSquare(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
function pieceAt(x, y) { const p = game.board()[y][x]; return p && `${p.color}${TYPE_TO_KEY[p.type]}`; }
function movesFrom(x, y) { return game.moves({ square: square(x, y), verbose: true }); }
function moveCode(move) { return move.iccs || `${move.from}${move.to}`; }
function displayIndex(value, max) { return state.flipped ? max - value : value; }

function runRuleSmokeTests() {
  const standard = new Xiangqi();
  const cannonMoves = standard.moves({ square: "b2" });
  if (cannonMoves.includes("b2b7") || cannonMoves.includes("b2b8") || !cannonMoves.includes("b2b9")) {
    throw new Error("xiangqi.js 炮规则自检失败");
  }
  const blocked = new Xiangqi("4k4/9/9/9/4R4/9/9/1C1R1r3/9/4K4 r - - 0 1");
  const blockedMoves = blocked.moves({ square: "b2" });
  if (blockedMoves.includes("b2e2") || !blockedMoves.includes("b2f2")) {
    throw new Error("xiangqi.js 炮架自检失败");
  }
  for (const puzzle of ENDGAMES) {
    const test = new Xiangqi(puzzle.fen);
    for (const code of puzzle.solution) {
      const move = test.moves({ verbose: true }).find(item => moveCode(item) === code);
      if (!move || !test.move({ from: move.from, to: move.to })) throw new Error(`残局 ${puzzle.id} 主线无效：${code}`);
    }
    if (!test.in_checkmate()) throw new Error(`残局 ${puzzle.id} 未以将死结束`);
  }
}

function positionalBonus(piece, x, y) {
  const center = 4 - Math.abs(4 - x);
  if (piece.type === "p") {
    const advance = piece.color === "r" ? Math.max(0, 6 - y) : Math.max(0, y - 3);
    const crossedRiver = piece.color === "r" ? y <= 4 : y >= 5;
    return advance * 18 + (crossedRiver ? 36 : 0) + center * 4;
  }
  if (piece.type === "n") return center * 9 + (4 - Math.abs(4.5 - y)) * 3;
  if (piece.type === "c") return center * 5;
  if (piece.type === "r") return center * 2;
  return 0;
}

function evaluatePosition() {
  let score = 0;
  const board = game.board();
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      const piece = board[y][x];
      if (!piece) continue;
      const value = MATERIAL[piece.type] + positionalBonus(piece, x, y);
      score += piece.color === "r" ? value : -value;
    }
  }
  if (game.in_check()) score += game.turn() === "r" ? -28 : 28;
  return score;
}

function ensureSearchBudget() {
  searchNodes++;
  if (searchNodes > searchNodeLimit || Date.now() > searchDeadline) throw SEARCH_ABORT;
}

function orderedMoves(moves, preferred) {
  return [...moves].sort((a, b) => {
    const aPreferred = moveCode(a) === preferred ? 100000 : 0;
    const bPreferred = moveCode(b) === preferred ? 100000 : 0;
    const aCapture = a.captured ? MATERIAL[a.captured] * 12 - MATERIAL[a.piece] : 0;
    const bCapture = b.captured ? MATERIAL[b.captured] * 12 - MATERIAL[b.piece] : 0;
    return (bPreferred + bCapture) - (aPreferred + aCapture);
  });
}

function terminalScore(ply) {
  if (game.in_checkmate()) return game.turn() === "r" ? -MATE_SCORE + ply : MATE_SCORE - ply;
  if (game.game_over()) return 0;
  return null;
}

function quiescence(alpha, beta, ply, depthLeft) {
  ensureSearchBudget();
  const terminal = terminalScore(ply);
  if (terminal !== null) return terminal;

  const maximizing = game.turn() === "r";
  let best = evaluatePosition();
  if (maximizing) {
    if (best >= beta) return best;
    alpha = Math.max(alpha, best);
  } else {
    if (best <= alpha) return best;
    beta = Math.min(beta, best);
  }
  if (depthLeft <= 0) return best;

  const allMoves = game.moves({ verbose: true });
  const tacticalMoves = game.in_check() ? allMoves : allMoves.filter(move => move.captured);
  for (const move of orderedMoves(tacticalMoves)) {
    game.move({ from: move.from, to: move.to });
    let value;
    try { value = quiescence(alpha, beta, ply + 1, depthLeft - 1); }
    finally { game.undo(); }
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function search(depth, alpha, beta, ply) {
  ensureSearchBudget();
  const terminal = terminalScore(ply);
  if (terminal !== null) return terminal;
  if (depth <= 0) return quiescence(alpha, beta, ply, 4);

  const key = game.fen().split(" ").slice(0, 2).join(" ");
  const cached = transposition.get(key);
  if (cached && cached.depth >= depth) return cached.score;

  const maximizing = game.turn() === "r";
  let best = maximizing ? -Infinity : Infinity;
  let cutOff = false;
  const moves = orderedMoves(game.moves({ verbose: true }), cached?.bestMove);
  let bestMove = null;

  for (const move of moves) {
    game.move({ from: move.from, to: move.to });
    let value;
    try { value = search(depth - 1, alpha, beta, ply + 1); }
    finally { game.undo(); }
    if ((maximizing && value > best) || (!maximizing && value < best)) {
      best = value;
      bestMove = moveCode(move);
    }
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) { cutOff = true; break; }
  }
  if (!cutOff) transposition.set(key, { depth, score: best, bestMove });
  return best;
}

function rootSearch(color, depth, preferred) {
  const maximizing = color === "r";
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = null;
  const moves = orderedMoves(game.moves({ verbose: true }), preferred);
  for (const move of moves) {
    ensureSearchBudget();
    game.move({ from: move.from, to: move.to });
    let score;
    try { score = search(depth - 1, -Infinity, Infinity, 1); }
    finally { game.undo(); }
    if ((maximizing && score > bestScore) || (!maximizing && score < bestScore)) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { move: bestMove, score: bestScore };
}

function chooseBestMove(color, level = state.difficulty) {
  const legalMoves = game.moves({ verbose: true });
  if (!legalMoves.length) return null;
  const config = AI_LEVELS[level] || AI_LEVELS[3];
  if (config.random) return legalMoves[Math.floor(Math.random() * legalMoves.length)];

  searchNodes = 0;
  searchDeadline = Date.now() + config.time;
  searchNodeLimit = config.nodes;
  transposition = new Map();
  let completed = { move: orderedMoves(legalMoves)[0], score: 0 };
  let preferred = moveCode(completed.move);

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    try {
      const result = rootSearch(color, depth, preferred);
      if (result.move) {
        completed = result;
        preferred = moveCode(result.move);
      }
      if (Math.abs(result.score) > MATE_SCORE - 100) break;
    } catch (error) {
      if (error !== SEARCH_ABORT) throw error;
      break;
    }
  }
  return completed.move;
}

function render() {
  const board = document.getElementById("board");
  board.innerHTML = '<div class="board-lines" aria-hidden="true"><i class="palace palace-top"></i><i class="palace palace-bottom"></i><div class="river"><span>楚 河</span><span>汉 界</span></div></div>';
  const rows = state.flipped ? [...Array(10).keys()].reverse() : [...Array(10).keys()];
  const cols = state.flipped ? [...Array(9).keys()].reverse() : [...Array(9).keys()];
  const legal = state.selected ? movesFrom(...state.selected) : [];
  const lastFrom = state.lastMove ? coords(state.lastMove.from) : null;
  const lastTo = state.lastMove ? coords(state.lastMove.to) : null;

  rows.forEach(y => cols.forEach(x => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.x = x;
    cell.dataset.y = y;
    const key = pieceAt(x, y);
    if (key) {
      const piece = document.createElement("div");
      piece.className = `piece ${key[0] === "r" ? "red" : "black"}`;
      piece.textContent = PIECES[key];
      if (state.animating && state.lastMove?.color === "b" && sameSquare(lastTo, [x, y])) {
        const fromDisplayX = displayIndex(lastFrom[0], 8);
        const fromDisplayY = displayIndex(lastFrom[1], 9);
        const toDisplayX = displayIndex(lastTo[0], 8);
        const toDisplayY = displayIndex(lastTo[1], 9);
        piece.classList.add("ai-moved");
        piece.style.setProperty("--move-x", `${(fromDisplayX - toDisplayX) * 131.58}%`);
        piece.style.setProperty("--move-y", `${(fromDisplayY - toDisplayY) * 131.58}%`);
      }
      cell.appendChild(piece);
    }
    if (sameSquare(lastFrom, [x, y])) cell.classList.add("last-from");
    if (sameSquare(lastTo, [x, y])) cell.classList.add("last-to");
    if (sameSquare(state.selected, [x, y])) cell.classList.add("selected");
    const move = legal.find(item => sameSquare(coords(item.to), [x, y]));
    if (move) cell.classList.add(key ? "capture" : "legal");
    if (key && key[0] === "r" && game.turn() === "r" && !state.thinking) cell.classList.add("selectable");
    cell.onclick = () => clickCell(x, y);
    board.appendChild(cell);
  }));

  const turnPill = document.getElementById("turnPill");
  turnPill.textContent = state.thinking ? `AI ${AI_LEVELS[state.difficulty].label}级思考中` : (game.turn() === "r" ? "轮到红方" : "轮到黑方");
  turnPill.classList.toggle("thinking", state.thinking);
  document.getElementById("moveCount").textContent = `第 ${Math.floor(game.history().length / 2) + 1} 回合`;
  document.getElementById("modeTitle").textContent = state.mode;
  document.querySelectorAll(".endgame").forEach(button => button.classList.toggle("active", button.dataset.id === state.puzzle?.id));
}

function endStateMessage() {
  if (!game.game_over()) return false;
  const title = game.in_checkmate() ? (game.turn() === "r" ? "这一局很可惜" : "恭喜你赢了！") : "棋局结束";
  const detail = game.in_checkmate() ? (game.turn() === "r" ? "你的帅被将死了，看看提示再试一次。" : "你成功将死了 AI。") : "这盘棋已结束，可以复盘或开始新局。";
  showModal(title, detail);
  return true;
}

function announceMove(result, actor) {
  const key = `${result.color}${TYPE_TO_KEY[result.piece.toLowerCase()]}`;
  const side = result.color === "b" ? "黑方" : "红方";
  const action = result.captured ? "吃到" : "走到";
  document.getElementById("message").textContent = `${side}${actor === "ai" ? " AI" : ""}：${PIECES[key]} ${result.from} ${action} ${result.to}`;
}

function finishPuzzleIfNeeded() {
  if (!state.puzzle || state.puzzlePly < state.puzzle.solution.length) return false;
  showModal("破解成功", `你完成了「${state.puzzle.name}」的 Pikafish 主线。可以换一道更难的题继续训练。`);
  document.getElementById("message").textContent = "残局破解成功！";
  return true;
}

function makeMove(move, options = {}) {
  const actor = options.actor || "human";
  const code = moveCode(move);
  if (state.puzzle && code !== state.puzzle.solution[state.puzzlePly]) {
    if (actor === "human") {
      state.selected = null;
      document.getElementById("message").textContent = "这步不是题库主线，再观察一下将军、吃子和封路。";
      render();
    }
    return false;
  }

  const result = game.move({ from: move.from, to: move.to });
  if (!result) {
    document.getElementById("message").textContent = "这一步不符合棋规，请选择绿色落点。";
    return false;
  }

  state.selected = null;
  state.lastMove = { from: result.from, to: result.to, color: result.color, piece: result.piece, captured: result.captured || null };
  if (state.puzzle) state.puzzlePly++;
  if (options.animate && result.color === "b") {
    state.animating = true;
    window.setTimeout(() => { state.animating = false; render(); }, 560);
  }
  announceMove(result, actor);
  render();
  if (finishPuzzleIfNeeded()) return true;
  if (endStateMessage()) return true;
  if (game.turn() === "b") aiTurn();
  return true;
}

function clickCell(x, y) {
  if (state.thinking || state.animating || game.turn() !== "r") return;
  const key = pieceAt(x, y);
  if (state.selected) {
    const target = square(x, y);
    const move = movesFrom(...state.selected).find(item => item.to === target);
    if (move) { makeMove(move, { actor: "human" }); return; }
    state.selected = null;
  }
  if (key && key[0] === "r") state.selected = [x, y];
  render();
}

function puzzleReply() {
  if (!state.puzzle) return null;
  const expected = state.puzzle.solution[state.puzzlePly];
  return game.moves({ verbose: true }).find(move => moveCode(move) === expected) || null;
}

function aiTurn() {
  state.thinking = true;
  render();
  window.setTimeout(() => {
    const move = state.puzzle ? puzzleReply() : chooseBestMove("b");
    state.thinking = false;
    if (move) makeMove(move, { actor: "ai", animate: true });
    else render();
  }, 220);
}

function showModal(title, text) {
  document.getElementById("modalContent").innerHTML = `<h3>${title}</h3><p>${text}</p><button class="primary-button" id="modalContinue">继续研究</button>`;
  document.getElementById("modalContinue").onclick = () => { document.getElementById("modal").hidden = true; };
  document.getElementById("modal").hidden = false;
}

function newGame() {
  game = new Xiangqi();
  state = { ...state, version: 5, selected: null, mode: "标准对弈", thinking: false, animating: false, baseFen: START_FEN, lastMove: null, puzzle: null, puzzlePly: 0 };
  render();
  document.getElementById("message").textContent = "请选择一个棋子";
}

function loadPuzzle(puzzle) {
  game = new Xiangqi(puzzle.fen);
  state = { ...state, version: 5, selected: null, mode: `真实残局 · ${puzzle.name}`, thinking: false, animating: false, baseFen: puzzle.fen, lastMove: null, puzzle, puzzlePly: 0 };
  document.getElementById("message").textContent = "红方先行：找出连续将杀主线";
  render();
}

function undoMove() {
  if (state.thinking || state.animating || !game.history().length) return;
  let undone = 0;
  if (game.undo()) undone++;
  if (game.turn() === "b" && game.history().length && game.undo()) undone++;
  if (state.puzzle) state.puzzlePly = Math.max(0, state.puzzlePly - undone);
  state.selected = null;
  state.lastMove = null;
  document.getElementById("message").textContent = "已退回上一回合";
  render();
}

function showHint() {
  if (state.thinking || state.animating || game.turn() !== "r") return;
  let move;
  if (state.puzzle) {
    const expected = state.puzzle.solution[state.puzzlePly];
    move = game.moves({ verbose: true }).find(item => moveCode(item) === expected);
  } else {
    document.getElementById("message").textContent = "正在计算最佳选择…";
    move = chooseBestMove("r", Math.max(3, Math.min(5, state.difficulty)));
  }
  if (!move) return;
  state.selected = coords(move.from);
  render();
  const key = pieceAt(...state.selected);
  showModal("推荐一步", `推荐 ${PIECES[key]} 从 ${move.from} 走到 ${move.to}。棋盘上的绿色落点就是目标位置。`);
}

document.getElementById("difficulty").onchange = event => { state.difficulty = Number(event.target.value); render(); };
document.getElementById("saveBtn").onclick = () => {
  localStorage.setItem("xiangqi-save", JSON.stringify({
    version: 5,
    fen: game.fen(),
    mode: state.mode,
    difficulty: state.difficulty,
    flipped: state.flipped,
    puzzleId: state.puzzle?.id || null,
    puzzlePly: state.puzzlePly
  }));
  document.getElementById("message").textContent = "棋局已保存，下次打开可继续";
};
document.getElementById("newBtn").onclick = newGame;
document.getElementById("undoBtn").onclick = undoMove;
document.getElementById("flipBtn").onclick = () => { state.flipped = !state.flipped; render(); };
document.getElementById("hintBtn").onclick = showHint;
document.getElementById("modalClose").onclick = () => { document.getElementById("modal").hidden = true; };
document.getElementById("modal").onclick = event => { if (event.target.id === "modal") event.currentTarget.hidden = true; };
document.getElementById("endgames").innerHTML = ENDGAMES.map(puzzle => `<button class="endgame" data-id="${puzzle.id}"><strong>${puzzle.name}</strong><small>${puzzle.desc}</small></button>`).join("");
document.querySelectorAll(".endgame").forEach(button => {
  button.onclick = () => loadPuzzle(ENDGAMES.find(item => item.id === button.dataset.id));
});

runRuleSmokeTests();
const saved = localStorage.getItem("xiangqi-save");
if (saved) {
  try {
    const data = JSON.parse(saved);
    if (data.version === 5 && data.fen) {
      const puzzle = ENDGAMES.find(item => item.id === data.puzzleId) || null;
      game = new Xiangqi(data.fen);
      state = {
        ...state,
        mode: data.mode || "标准对弈",
        difficulty: data.difficulty || 3,
        flipped: Boolean(data.flipped),
        baseFen: puzzle?.fen || data.fen,
        puzzle,
        puzzlePly: puzzle ? Math.min(Number(data.puzzlePly) || 0, puzzle.solution.length) : 0
      };
      document.getElementById("difficulty").value = String(state.difficulty);
    } else {
      localStorage.removeItem("xiangqi-save");
    }
  } catch {
    localStorage.removeItem("xiangqi-save");
  }
}
render();
