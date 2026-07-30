"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const UI = {
  stageLabel: document.getElementById("stageLabel"),
  stageName: document.getElementById("stageName"),
  score: document.getElementById("scoreValue"),
  timer: document.getElementById("timerValue"),
  timerBlock: document.getElementById("timerBlock"),
  combo: document.getElementById("comboReadout"),
  toast: document.getElementById("toast"),
  start: document.getElementById("startScreen"),
  reward: document.getElementById("rewardScreen"),
  result: document.getElementById("resultScreen"),
  rewardChoices: document.getElementById("rewardChoices"),
  backpack: document.getElementById("backpack"),
  packStats: document.getElementById("packStats"),
  continueButton: document.getElementById("continueButton"),
  powerCore: document.getElementById("powerCore"),
  powerFill: document.getElementById("powerFill"),
  powerText: document.getElementById("powerText"),
  bossBar: document.getElementById("bossBar"),
  bossHpFill: document.getElementById("bossHpFill"),
  bossHpText: document.getElementById("bossHpText"),
  leftControl: document.getElementById("leftControl"),
  rightControl: document.getElementById("rightControl")
};

const W = 390;
const H = 700;
const TABLE_BOTTOM = 690;
const GRAVITY = 330;
const MAX_BALL_SPEED = 730;
const GRID_COLS = 5;
const GRID_ROWS = 4;
const DEV_FAST = new URLSearchParams(location.search).has("fast");

const stages = [
  { name: "锈铁庭院", target: 2200, hp: 30, monsters: 3, tint: "#21373b" },
  { name: "霓虹回廊", target: 3800, hp: 42, monsters: 4, tint: "#292c45" },
  { name: "熔渣工坊", target: 5800, hp: 58, monsters: 4, tint: "#3d2926" },
  { name: "雷鸣高塔", target: 8200, hp: 72, monsters: 5, tint: "#263730" },
  { name: "炉心守卫", boss: true, hp: 1350, tint: "#3b2027" }
];

const itemCatalog = {
  rustyBlade: { id: "rustyBlade", name: "锈铁长刃", icon: "†", w: 2, h: 1, color: "#b94f47", rarity: "common", desc: "攻击 +8" },
  scoreGear: { id: "scoreGear", name: "计分齿轮", icon: "◆", w: 1, h: 1, color: "#b58d37", rarity: "common", desc: "得分 +15%" },
  tesla: { id: "tesla", name: "雷电线圈", icon: "ϟ", w: 2, h: 2, color: "#267b91", rarity: "epic", desc: "充能后释放全屏连锁闪电" },
  battery: { id: "battery", name: "超载电池", icon: "+", w: 1, h: 2, color: "#318d7b", rarity: "rare", desc: "充能效率 +35%；邻接线圈再 +20%" },
  blast: { id: "blast", name: "爆破核心", icon: "✹", w: 2, h: 2, color: "#bd4e37", rarity: "epic", desc: "击杀引发全场爆炸伤害" },
  hunter: { id: "hunter", name: "猎手徽章", icon: "◎", w: 1, h: 2, color: "#6c9450", rarity: "rare", desc: "连续撞同一怪物，伤害递增" },
  heavy: { id: "heavy", name: "重力锻锤", icon: "T", w: 2, h: 1, color: "#775e8f", rarity: "rare", desc: "攻击 +5；强力撞击伤害 +45%" },
  prism: { id: "prism", name: "分裂棱镜", icon: "◇", w: 2, h: 2, color: "#4b71a9", rarity: "epic", desc: "每 28 次命中生成一颗副球" },
  phoenix: { id: "phoenix", name: "余烬护符", icon: "♠", w: 2, h: 1, color: "#cc6f3c", rarity: "rare", desc: "每关首次落底，立刻救球" },
  focus: { id: "focus", name: "暴击镜片", icon: "✦", w: 1, h: 1, color: "#9d557e", rarity: "rare", desc: "暴击率 +12%，暴击伤害 +60%" },
  magnet: { id: "magnet", name: "蓄能磁石", icon: "U", w: 2, h: 1, color: "#477b9d", rarity: "common", desc: "机关能量 +2，技能伤害 +20%" },
  crown: { id: "crown", name: "连杀王冠", icon: "♛", w: 2, h: 1, color: "#a88335", rarity: "epic", desc: "连杀倍率上限 +2，持续时间 +1秒" }
};

const game = {
  state: "menu",
  stageIndex: 0,
  score: 0,
  stageScore: 0,
  time: 60,
  totalKills: 0,
  stageKills: 0,
  combo: 0,
  comboTimer: 0,
  bestCombo: 0,
  energy: 0,
  chargedTimer: 0,
  hitCount: 0,
  shake: 0,
  flash: 0,
  hitStop: 0,
  lastTime: 0,
  leftActive: false,
  rightActive: false,
  pendingLaunch: 0,
  selectedReward: null,
  stageScores: [],
  items: [],
  derived: {},
  particles: [],
  texts: [],
  arcs: [],
  monsters: [],
  balls: [],
  bumpers: [],
  laneCooldown: 0,
  audio: null,
  savesLeft: 0,
  lastTarget: null,
  sameTargetHits: 0
};

function resetRun() {
  Object.assign(game, {
    state: "playing", stageIndex: 0, score: 0, stageScore: 0, time: 60,
    totalKills: 0, stageKills: 0, combo: 0, comboTimer: 0, bestCombo: 0,
    energy: 0, chargedTimer: 0, hitCount: 0, shake: 0, flash: 0,
    hitStop: 0, pendingLaunch: 0, selectedReward: null, stageScores: [],
    particles: [], texts: [], arcs: [], items: [
      { ...itemCatalog.rustyBlade, uid: crypto.randomUUID(), x: 0, y: 0 },
      { ...itemCatalog.scoreGear, uid: crypto.randomUUID(), x: 2, y: 0 }
    ]
  });
  deriveStats();
  startStage(0);
}

function startStage(index) {
  game.stageIndex = index;
  game.stageScore = 0;
  game.stageKills = 0;
  game.time = DEV_FAST ? 6 : 60;
  game.combo = 0;
  game.comboTimer = 0;
  game.energy = 0;
  game.chargedTimer = 0;
  game.hitCount = 0;
  game.lastTarget = null;
  game.sameTargetHits = 0;
  game.particles.length = 0;
  game.texts.length = 0;
  game.arcs.length = 0;
  game.balls.length = 0;
  game.state = "playing";
  deriveStats();
  game.savesLeft = game.derived.saves;
  setupTable();
  spawnMonsters();
  launchBall(true);
  updateHud();
  UI.reward.hidden = true;
  UI.result.hidden = true;
  UI.bossBar.hidden = !stages[index].boss;
  showToast(stages[index].boss ? "首领战" : `目标 ${stageTarget(stages[index]).toLocaleString()} 分`);
}

function stageTarget(stage) {
  if (!DEV_FAST) return stage.target;
  return [120, 180, 240, 320][game.stageIndex] || stage.target;
}

function deriveStats() {
  const has = id => game.items.some(item => item.id === id);
  const count = id => game.items.filter(item => item.id === id).length;
  const tesla = game.items.find(item => item.id === "tesla");
  const batteries = game.items.filter(item => item.id === "battery");
  const adjacentBattery = tesla && batteries.some(b => itemsAdjacent(tesla, b));
  game.derived = {
    attack: 10 + count("rustyBlade") * 8 + count("heavy") * 5,
    crit: .05 + count("focus") * .12,
    critDamage: 1.7 + count("focus") * .6,
    scoreMult: 1 + count("scoreGear") * .15,
    chargeRate: 1 + count("battery") * .35 + (adjacentBattery ? .2 : 0),
    skillPower: 1 + count("magnet") * .2,
    bumperEnergy: 7 + count("magnet") * 2,
    tesla: has("tesla"), blast: has("blast"), hunter: has("hunter"),
    heavy: has("heavy"), prism: has("prism"), phoenix: has("phoenix"),
    crown: has("crown"), saves: has("phoenix") ? 1 : 0,
    comboMax: has("crown") ? 7 : 5,
    comboDuration: has("crown") ? 4.2 : 3.2
  };
  if (UI.packStats) UI.packStats.textContent = `攻击 ${game.derived.attack} · 暴击 ${Math.round(game.derived.crit * 100)}% · 得分 ×${game.derived.scoreMult.toFixed(2)}`;
}

function itemsAdjacent(a, b) {
  const horizontal = (a.x + a.w === b.x || b.x + b.w === a.x) && a.y < b.y + b.h && a.y + a.h > b.y;
  const vertical = (a.y + a.h === b.y || b.y + b.h === a.y) && a.x < b.x + b.w && a.x + a.w > b.x;
  return horizontal || vertical;
}

function setupTable() {
  game.bumpers = [
    { x: 93, y: 212, r: 20, color: "#ff5a57", pulse: 0 },
    { x: 195, y: 175, r: 22, color: "#ffd65a", pulse: 0 },
    { x: 297, y: 212, r: 20, color: "#43d6d2", pulse: 0 }
  ];
}

function spawnMonsters() {
  const stage = stages[game.stageIndex];
  const points = [
    [116, 330], [274, 330], [195, 280], [82, 430], [308, 430]
  ];
  game.monsters = [];
  if (stage.boss) {
    game.monsters.push(makeMonster(195, 340, stage.hp, true, 0));
  } else {
    for (let i = 0; i < stage.monsters; i++) {
      const p = points[i];
      game.monsters.push(makeMonster(p[0], p[1], stage.hp + (i % 2) * 8, false, i));
    }
  }
}

function makeMonster(x, y, hp, boss, index) {
  return { id: `m${index}`, x, y, r: boss ? 40 : 22, hp, maxHp: hp, boss, dead: false, respawn: 0, hit: 0, spawn: 1, hue: index % 3 };
}

function launchBall(initial = false) {
  game.balls.push({ x: 348, y: 518, vx: initial ? -145 : -130, vy: -590, r: 8, main: true, trail: [], invuln: .5, color: "#ffe16b" });
  sound("launch");
}

function launchSideBall() {
  if (game.balls.length >= 4) return;
  const source = game.balls[0] || { x: 195, y: 300 };
  game.balls.push({ x: source.x, y: source.y, vx: -source.vx || 250, vy: -380, r: 6, main: false, trail: [], invuln: .4, color: "#67e2dc" });
  showToast("多球！");
  sound("power");
}

function frame(now) {
  const dt = Math.min(.025, (now - game.lastTime) / 1000 || 0);
  game.lastTime = now;
  if (game.state === "playing") update(dt);
  draw();
  requestAnimationFrame(frame);
}

function update(dt) {
  if (game.hitStop > 0) {
    game.hitStop -= dt;
    updateEffects(dt);
    return;
  }
  game.time -= dt;
  game.shake = Math.max(0, game.shake - dt * 18);
  game.flash = Math.max(0, game.flash - dt * 4);
  game.laneCooldown = Math.max(0, game.laneCooldown - dt);
  if (game.chargedTimer > 0) game.chargedTimer -= dt;
  if (game.comboTimer > 0) game.comboTimer -= dt;
  else if (game.combo > 0) { game.combo = 0; updateCombo(); }
  if (game.pendingLaunch > 0) {
    game.pendingLaunch -= dt;
    if (game.pendingLaunch <= 0 && !game.balls.some(b => b.main)) launchBall();
  }
  game.bumpers.forEach(b => b.pulse = Math.max(0, b.pulse - dt * 5));
  game.monsters.forEach(m => {
    m.hit = Math.max(0, m.hit - dt * 8);
    m.spawn = Math.max(0, m.spawn - dt * 2);
    if (m.dead && !m.boss) {
      m.respawn -= dt;
      if (m.respawn <= 0) {
        m.dead = false; m.hp = m.maxHp; m.spawn = 1;
        burst(m.x, m.y, "#72d3a0", 10, 110);
        sound("spawn");
      }
    }
  });

  const left = getFlipper(true);
  const right = getFlipper(false);
  for (let i = game.balls.length - 1; i >= 0; i--) {
    const ball = game.balls[i];
    updateBall(ball, dt, left, right);
    if (ball.y > TABLE_BOTTOM + 32) loseBall(i, ball);
  }
  updateEffects(dt);
  updateHud();

  const stage = stages[game.stageIndex];
  if (!stage.boss && game.stageScore >= stageTarget(stage)) completeStage();
  else if (stage.boss && game.monsters[0]?.dead) finishRun(true);
  else if (game.time <= 0) {
    if (stage.boss) finishRun(false);
    else finishRun(false, "score");
  }
}

function updateBall(ball, dt, left, right) {
  ball.invuln = Math.max(0, ball.invuln - dt);
  ball.vy += GRAVITY * dt;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_BALL_SPEED) { ball.vx *= MAX_BALL_SPEED / speed; ball.vy *= MAX_BALL_SPEED / speed; }
  const steps = 2;
  for (let step = 0; step < steps; step++) {
    ball.x += ball.vx * dt / steps;
    ball.y += ball.vy * dt / steps;
    collideWalls(ball);
    collideFlipper(ball, left);
    collideFlipper(ball, right);
    game.bumpers.forEach(b => collideBumper(ball, b));
    game.monsters.forEach(m => collideMonster(ball, m));
  }
  if (ball.x > 164 && ball.x < 226 && ball.y > 82 && ball.y < 104 && game.laneCooldown <= 0) {
    game.laneCooldown = .45;
    addEnergy(12);
    addScore(70, ball.x, ball.y, "机关 +70");
    sound("lane");
  }
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 9) ball.trail.shift();
}

function collideWalls(ball) {
  const margin = 18;
  if (ball.x - ball.r < margin) { ball.x = margin + ball.r; ball.vx = Math.abs(ball.vx) * .94; wallSpark(ball.x, ball.y); }
  if (ball.x + ball.r > W - margin) { ball.x = W - margin - ball.r; ball.vx = -Math.abs(ball.vx) * .94; wallSpark(ball.x, ball.y); }
  if (ball.y - ball.r < 18) { ball.y = 18 + ball.r; ball.vy = Math.abs(ball.vy) * .94; wallSpark(ball.x, ball.y); }
  // Sloped lower guides.
  collideSegment(ball, 18, 535, 95, 586, .88);
  collideSegment(ball, 372, 535, 295, 586, .88);
}

function getFlipper(left) {
  const active = left ? game.leftActive : game.rightActive;
  const pivot = left ? { x: 100, y: 610 } : { x: 290, y: 610 };
  const angle = left ? (active ? -.48 : .30) : (active ? Math.PI + .48 : Math.PI - .30);
  return { x1: pivot.x, y1: pivot.y, x2: pivot.x + Math.cos(angle) * 76, y2: pivot.y + Math.sin(angle) * 76, active, left };
}

function collideFlipper(ball, f) {
  const hit = nearestPoint(ball.x, ball.y, f.x1, f.y1, f.x2, f.y2);
  const dx = ball.x - hit.x, dy = ball.y - hit.y;
  const min = ball.r + 8;
  const d2 = dx * dx + dy * dy;
  if (d2 < min * min && d2 > .01) {
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    ball.x = hit.x + nx * min; ball.y = hit.y + ny * min;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0 || f.active) {
      ball.vx -= 1.8 * dot * nx;
      ball.vy -= 1.8 * dot * ny;
      if (f.active) {
        const boost = 360 * (f.left ? 1 : -1);
        ball.vx += boost * .42;
        ball.vy -= 350;
        sound("flipHit");
      }
    }
  }
}

function collideSegment(ball, x1, y1, x2, y2, bounce) {
  const p = nearestPoint(ball.x, ball.y, x1, y1, x2, y2);
  const dx = ball.x - p.x, dy = ball.y - p.y;
  const min = ball.r + 5, d2 = dx * dx + dy * dy;
  if (d2 < min * min && d2 > .01) {
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    ball.x = p.x + nx * min; ball.y = p.y + ny * min;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= (1 + bounce) * dot * nx; ball.vy -= (1 + bounce) * dot * ny; }
  }
}

function nearestPoint(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
  return { x: x1 + vx * t, y: y1 + vy * t };
}

function collideBumper(ball, bumper) {
  const dx = ball.x - bumper.x, dy = ball.y - bumper.y;
  const min = ball.r + bumper.r;
  if (dx * dx + dy * dy < min * min) {
    const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    ball.x = bumper.x + nx * min; ball.y = bumper.y + ny * min;
    ball.vx = nx * 520; ball.vy = ny * 520;
    bumper.pulse = 1;
    addEnergy(game.derived.bumperEnergy);
    addScore(25, bumper.x, bumper.y, "+25");
    burst(bumper.x, bumper.y, bumper.color, 8, 150);
    sound("bumper");
  }
}

function collideMonster(ball, monster) {
  if (monster.dead) return;
  const dx = ball.x - monster.x, dy = ball.y - monster.y;
  const min = ball.r + monster.r;
  if (dx * dx + dy * dy >= min * min) return;
  const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  ball.x = monster.x + nx * min; ball.y = monster.y + ny * min;
  const approach = -(ball.vx * nx + ball.vy * ny);
  if (approach > 0) {
    ball.vx += (1.72 * approach + 55) * nx;
    ball.vy += (1.72 * approach + 55) * ny;
    hitMonster(monster, Math.hypot(ball.vx, ball.vy), ball);
  }
}

function hitMonster(monster, speed, ball) {
  let impact = speed > 590 ? 2 : speed > 420 ? 1.5 : 1;
  if (!ball.main) impact *= .45;
  let damage = game.derived.attack * impact;
  if (game.derived.heavy && impact >= 1.5) damage *= 1.45;
  if (game.derived.hunter) {
    if (game.lastTarget === monster.id) game.sameTargetHits = Math.min(5, game.sameTargetHits + 1);
    else { game.lastTarget = monster.id; game.sameTargetHits = 0; }
    damage *= 1 + game.sameTargetHits * .16;
  }
  const crit = Math.random() < game.derived.crit;
  if (crit) damage *= game.derived.critDamage;
  if (game.chargedTimer > 0) damage *= 1.18;
  damage = Math.round(damage);
  monster.hp -= damage;
  monster.hit = 1;
  game.hitCount++;
  addEnergy(4 * game.derived.chargeRate);
  addScore(Math.round(damage * 2), monster.x, monster.y - monster.r, crit ? `暴击 ${damage}` : `${damage}`);
  burst(monster.x, monster.y, crit ? "#fff3a1" : "#ff765f", crit ? 12 : 6, crit ? 200 : 120);
  game.shake = Math.max(game.shake, crit ? 4 : 1.5);
  sound(crit ? "crit" : "hit");

  if (game.derived.prism && game.hitCount % 28 === 0) launchSideBall();
  if (game.derived.tesla && game.energy >= 100) triggerTesla(monster);
  if (monster.hp <= 0) killMonster(monster, damage);
}

function triggerTesla(origin) {
  game.energy = 0;
  game.chargedTimer = 6;
  const targets = game.monsters.filter(m => !m.dead && m !== origin);
  targets.forEach((m, i) => {
    const damage = Math.round(game.derived.attack * 1.8 * game.derived.skillPower);
    m.hp -= damage;
    game.arcs.push({ x1: origin.x, y1: origin.y, x2: m.x, y2: m.y, life: .22, seed: Math.random() * 20 });
    game.texts.push({ x: m.x, y: m.y - 25, text: `⚡${damage}`, color: "#69f5ee", life: .8, vy: -28 });
    setTimeout(() => { if (m.hp <= 0 && !m.dead && game.state === "playing") killMonster(m, damage); }, i * 45);
  });
  showToast("雷霆过载");
  game.flash = .5; game.shake = 6; sound("power");
}

function killMonster(monster, overkill) {
  if (monster.dead) return;
  monster.dead = true;
  monster.hp = 0;
  monster.respawn = 2;
  game.totalKills++;
  game.stageKills++;
  game.combo = Math.min(game.derived.comboMax, game.combo + 1);
  game.comboTimer = game.derived.comboDuration;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  const base = monster.boss ? 3000 : 300;
  addScore(Math.round(base * (1 + (game.combo - 1) * .35)), monster.x, monster.y, monster.boss ? "首领击破" : `击破 ×${game.combo}`);
  burst(monster.x, monster.y, monster.boss ? "#ffd65a" : "#ff5a57", monster.boss ? 42 : 20, monster.boss ? 330 : 240);
  game.shake = monster.boss ? 14 : 7;
  game.hitStop = monster.boss ? .14 : .045;
  game.flash = monster.boss ? 1 : .35;
  updateCombo();
  sound(monster.boss ? "bossKill" : "kill");
  vibrate(monster.boss ? 90 : 25);
  if (game.derived.blast && !monster.boss) triggerBlast(monster, overkill);
}

function triggerBlast(origin, overkill) {
  const damage = Math.round((25 + Math.max(0, overkill - origin.maxHp) * .3) * game.derived.skillPower);
  game.monsters.forEach(m => {
    if (m.dead || m === origin) return;
    m.hp -= damage;
    game.arcs.push({ x1: origin.x, y1: origin.y, x2: m.x, y2: m.y, life: .14, blast: true });
    game.texts.push({ x: m.x, y: m.y - 22, text: `爆 ${damage}`, color: "#ff9a55", life: .7, vy: -25 });
    if (m.hp <= 0) setTimeout(() => game.state === "playing" && killMonster(m, damage), 35);
  });
  sound("blast");
}

function addEnergy(value) {
  if (!game.derived.tesla) game.energy = Math.min(65, game.energy + value * .45);
  else game.energy = Math.min(100, game.energy + value);
}

function addScore(points, x, y, label) {
  const comboMult = 1 + Math.max(0, game.combo - 1) * .25;
  const total = Math.round(points * game.derived.scoreMult * comboMult);
  game.score += total;
  game.stageScore += total;
  if (label) game.texts.push({ x, y, text: label, color: "#fff0a0", life: .75, vy: -34 });
}

function loseBall(index, ball) {
  game.balls.splice(index, 1);
  if (!ball.main) return;
  if (game.savesLeft > 0) {
    game.savesLeft--;
    game.balls.push({ ...ball, x: 195, y: 585, vx: 0, vy: -600, trail: [], invuln: 1 });
    showToast("余烬救球");
    sound("save");
    return;
  }
  game.combo = 0; game.comboTimer = 0; game.energy = Math.max(0, game.energy - 20);
  updateCombo();
  showToast("失球");
  sound("lose");
  if (!game.balls.some(b => b.main)) game.pendingLaunch = 1.1;
}

function completeStage() {
  if (game.state !== "playing") return;
  game.state = "reward";
  game.stageScores.push(game.stageScore);
  game.balls.length = 0;
  showReward();
}

function showReward() {
  const stage = stages[game.stageIndex];
  document.getElementById("rewardTitle").textContent = game.stageScore >= stageTarget(stage) ? "目标达成 · 选择战利品" : "时间到 · 选择战利品";
  document.getElementById("rewardScore").textContent = `本关得分 ${game.stageScore.toLocaleString()} · 击破 ${game.stageKills}`;
  UI.reward.hidden = false;
  UI.continueButton.disabled = true;
  game.selectedReward = null;
  const owned = new Set(game.items.map(i => i.id));
  const pool = Object.values(itemCatalog).filter(i => !owned.has(i.id) && !["rustyBlade", "scoreGear"].includes(i.id));
  shuffle(pool);
  const choices = pool.slice(0, 3);
  UI.rewardChoices.innerHTML = "";
  choices.forEach(item => {
    const button = document.createElement("button");
    button.className = "reward-card";
    button.innerHTML = `<small class="rarity-${item.rarity}">${rarityName(item.rarity)}</small><span class="item-pixel-icon" style="background:${item.color}">${item.icon}</span><strong>${item.name}</strong><p>${item.desc}</p>`;
    button.addEventListener("click", () => selectReward(item, button));
    UI.rewardChoices.appendChild(button);
  });
  renderBackpack();
}

function selectReward(item, button) {
  let previous = null;
  if (game.selectedReward) {
    previous = game.items.find(i => i.uid === game.selectedReward);
    game.items = game.items.filter(i => i.uid !== game.selectedReward);
    game.selectedReward = null;
    if (previous) deriveStats();
  }
  const placed = autoPlace(item);
  if (!placed) {
    if (previous) { game.items.push(previous); game.selectedReward = previous.uid; }
    deriveStats(); renderBackpack(); showToast("背包空间不足"); return;
  }
  game.selectedReward = placed.uid;
  UI.rewardChoices.querySelectorAll(".reward-card").forEach(c => c.classList.remove("selected"));
  button.classList.add("selected");
  UI.continueButton.disabled = false;
  deriveStats(); renderBackpack(); sound("reward");
}

function autoPlace(template) {
  for (let rotated = 0; rotated < 2; rotated++) {
    const w = rotated ? template.h : template.w;
    const h = rotated ? template.w : template.h;
    for (let y = 0; y <= GRID_ROWS - h; y++) for (let x = 0; x <= GRID_COLS - w; x++) {
      const candidate = { ...template, uid: crypto.randomUUID(), x, y, w, h };
      if (canPlace(candidate)) { game.items.push(candidate); return candidate; }
    }
  }
  return null;
}

function canPlace(item, ignoreUid = null) {
  if (item.x < 0 || item.y < 0 || item.x + item.w > GRID_COLS || item.y + item.h > GRID_ROWS) return false;
  return !game.items.some(other => other.uid !== ignoreUid && item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y);
}

function renderBackpack() {
  UI.backpack.innerHTML = "";
  game.items.forEach(item => {
    const el = document.createElement("div");
    el.className = `pack-item${item.uid === game.selectedReward ? " pending" : ""}`;
    el.dataset.uid = item.uid;
    Object.assign(el.style, {
      left: `calc(${item.x * 20}% + 2px)`, top: `calc(${item.y * 25}% + 2px)`,
      width: `calc(${item.w * 20}% - 4px)`, height: `calc(${item.h * 25}% - 4px)`, background: item.color
    });
    el.textContent = `${item.icon} ${item.name}`;
    attachPackDrag(el, item);
    UI.backpack.appendChild(el);
  });
}

function attachPackDrag(el, item) {
  let startX = 0, startY = 0, moved = false;
  el.addEventListener("pointerdown", e => {
    startX = e.clientX; startY = e.clientY; moved = false;
    el.setPointerCapture(e.pointerId); el.classList.add("dragging");
  });
  el.addEventListener("pointermove", e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) moved = true;
  });
  el.addEventListener("pointerup", e => {
    el.classList.remove("dragging");
    const rect = UI.backpack.getBoundingClientRect();
    const old = { x: item.x, y: item.y, w: item.w, h: item.h };
    if (!moved) { item.w = old.h; item.h = old.w; }
    else {
      item.x = Math.floor((e.clientX - rect.left) / (rect.width / GRID_COLS));
      item.y = Math.floor((e.clientY - rect.top) / (rect.height / GRID_ROWS));
    }
    if (!canPlace(item, item.uid)) Object.assign(item, old);
    deriveStats(); renderBackpack();
  });
}

function finishRun(win, reason = "boss") {
  if (game.state !== "playing") return;
  game.state = "result";
  game.stageScores.push(game.stageScore);
  document.getElementById("resultEyebrow").textContent = win ? "试炼完成" : "挑战结束";
  document.getElementById("resultTitle").textContent = win ? "炉心已熄灭" : reason === "score" ? "目标分数未达成" : "炉心仍在燃烧";
  document.getElementById("resultIcon").textContent = win ? "★" : "×";
  document.getElementById("finalScore").textContent = game.score.toLocaleString();
  document.getElementById("runSummary").innerHTML = `击破怪物 ${game.totalKills} 只<br>最高连杀 ×${game.bestCombo}<br>装备 ${game.items.length} 件`;
  UI.result.hidden = false;
}

function updateEffects(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.texts.length - 1; i >= 0; i--) {
    const t = game.texts[i]; t.life -= dt; t.y += t.vy * dt;
    if (t.life <= 0) game.texts.splice(i, 1);
  }
  for (let i = game.arcs.length - 1; i >= 0; i--) {
    game.arcs[i].life -= dt; if (game.arcs[i].life <= 0) game.arcs.splice(i, 1);
  }
}

function draw() {
  const stage = stages[game.stageIndex] || stages[0];
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - .5) * game.shake, (Math.random() - .5) * game.shake);
  drawBackground(stage);
  drawTableLights();
  drawBumpers();
  drawMonsters();
  drawFlippers();
  drawBalls();
  drawEffects();
  ctx.restore();
  if (game.flash > 0) { ctx.fillStyle = `rgba(255,245,190,${game.flash * .16})`; ctx.fillRect(0, 0, W, H); }
}

function drawBackground(stage) {
  ctx.fillStyle = stage.tint; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#11161d";
  for (let y = 0; y < H; y += 32) for (let x = (y / 32 % 2) * 16; x < W; x += 32) ctx.fillRect(x, y, 15, 15);
  ctx.fillStyle = "#0a0d12"; ctx.fillRect(0, 0, 18, H); ctx.fillRect(W - 18, 0, 18, H);
  ctx.fillStyle = "#566171"; ctx.fillRect(12, 0, 6, 540); ctx.fillRect(W - 18, 0, 6, 540); ctx.fillRect(18, 12, W - 36, 6);
  // Top charge lane.
  ctx.fillStyle = "#101720"; ctx.fillRect(154, 66, 82, 54);
  ctx.strokeStyle = "#70d6d0"; ctx.lineWidth = 4; ctx.strokeRect(160, 75, 70, 35);
  ctx.fillStyle = "#70d6d0"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("CHARGE", 195, 97);
  // Lower guides.
  drawThickLine(18, 535, 95, 586, "#7b4950", 12);
  drawThickLine(372, 535, 295, 586, "#7b4950", 12);
  ctx.fillStyle = "#080a0e"; ctx.fillRect(112, 654, 166, 46);
  ctx.fillStyle = "#2a323e"; ctx.fillRect(119, 660, 152, 8);
}

function drawTableLights() {
  const colors = ["#ff5a57", "#ffd65a", "#43d6d2", "#7ad66d"];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const active = i < Math.floor(game.energy / 12.5);
    ctx.globalAlpha = active ? 1 : .18;
    ctx.fillRect(40 + i * 40, 42, 16, 6);
  }
  ctx.globalAlpha = 1;
}

function drawBumpers() {
  game.bumpers.forEach((b, idx) => {
    ctx.save(); ctx.translate(b.x, b.y);
    const scale = 1 + b.pulse * .18; ctx.scale(scale, scale);
    ctx.fillStyle = "#0a0d12"; pixelCircle(3, 4, b.r + 5);
    ctx.fillStyle = b.color; pixelCircle(0, 0, b.r);
    ctx.fillStyle = "#f5f0dc"; pixelCircle(-5, -5, 6);
    ctx.fillStyle = "#1b222b"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(String(idx + 1), 0, 4);
    ctx.restore();
  });
}

function drawMonsters() {
  game.monsters.forEach(m => {
    if (m.dead) {
      if (m.boss) return;
      const alpha = .18 + Math.max(0, .5 - m.respawn) * 1.3;
      ctx.globalAlpha = Math.min(.8, alpha);
      ctx.strokeStyle = "#89d2a4"; ctx.lineWidth = 3; pixelCircleStroke(m.x, m.y, m.r);
      ctx.fillStyle = "#bce7ca"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(Math.max(1, Math.ceil(m.respawn)), m.x, m.y + 4);
      ctx.globalAlpha = 1; return;
    }
    ctx.save(); ctx.translate(m.x, m.y);
    const s = m.spawn > 0 ? 1 - m.spawn * .35 : 1; ctx.scale(s + m.hit * .08, s - m.hit * .08);
    if (m.boss) drawBossSprite(m);
    else drawMonsterSprite(m);
    ctx.restore();
    // HP bar.
    const width = m.boss ? 74 : 42;
    ctx.fillStyle = "#11151b"; ctx.fillRect(m.x - width / 2, m.y + m.r + 8, width, 6);
    ctx.fillStyle = m.boss ? "#ff5a57" : "#7ad66d"; ctx.fillRect(m.x - width / 2 + 1, m.y + m.r + 9, (width - 2) * Math.max(0, m.hp / m.maxHp), 4);
  });
}

function drawMonsterSprite(m) {
  const palettes = [["#7ad66d", "#387843"], ["#ff765f", "#8e3d42"], ["#6ca4df", "#37547d"]];
  const [main, shade] = palettes[m.hue];
  ctx.fillStyle = "#090c10"; ctx.fillRect(-18, -15, 36, 34); ctx.fillRect(-22, -7, 44, 19);
  ctx.fillStyle = shade; ctx.fillRect(-18, -14, 36, 29); ctx.fillRect(-21, -6, 42, 15);
  ctx.fillStyle = main; ctx.fillRect(-14, -13, 28, 21); ctx.fillRect(-18, -5, 36, 10);
  ctx.fillStyle = "#f5f0dc"; ctx.fillRect(-10, -7, 6, 6); ctx.fillRect(5, -7, 6, 6);
  ctx.fillStyle = "#14171c"; ctx.fillRect(-8, -5, 3, 3); ctx.fillRect(6, -5, 3, 3); ctx.fillRect(-7, 7, 14, 4);
}

function drawBossSprite() {
  ctx.fillStyle = "#090b0e"; ctx.fillRect(-37, -32, 74, 65); ctx.fillRect(-43, -17, 86, 38);
  ctx.fillStyle = "#7b333a"; ctx.fillRect(-35, -30, 70, 60); ctx.fillRect(-40, -15, 80, 30);
  ctx.fillStyle = "#bd503e"; ctx.fillRect(-27, -26, 54, 47); ctx.fillRect(-35, -11, 70, 25);
  ctx.fillStyle = "#35232a"; ctx.fillRect(-20, -17, 40, 34);
  ctx.fillStyle = game.chargedTimer > 0 ? "#6cf3e8" : "#ffcf52"; ctx.fillRect(-12, -11, 24, 22); ctx.fillRect(-17, -6, 34, 12);
  ctx.fillStyle = "#f5f0dc"; ctx.fillRect(-25, -22, 7, 7); ctx.fillRect(18, -22, 7, 7);
}

function drawFlippers() {
  [getFlipper(true), getFlipper(false)].forEach(f => {
    drawThickLine(f.x1 + 3, f.y1 + 4, f.x2 + 3, f.y2 + 4, "#080a0d", 20);
    drawThickLine(f.x1, f.y1, f.x2, f.y2, f.active ? "#ffd65a" : "#e05c53", 15);
    ctx.fillStyle = "#f5f0dc"; pixelCircle(f.x1, f.y1, 7);
  });
}

function drawBalls() {
  game.balls.forEach(ball => {
    ball.trail.forEach((p, i) => {
      ctx.globalAlpha = (i / ball.trail.length) * .25;
      ctx.fillStyle = ball.color; pixelCircle(p.x, p.y, Math.max(2, ball.r - 3));
    });
    ctx.globalAlpha = 1;
    if (game.chargedTimer > 0) { ctx.fillStyle = "#5df0e8"; pixelCircle(ball.x, ball.y, ball.r + 4); }
    ctx.fillStyle = "#0b0d10"; pixelCircle(ball.x + 2, ball.y + 3, ball.r + 1);
    ctx.fillStyle = ball.color; pixelCircle(ball.x, ball.y, ball.r);
    ctx.fillStyle = "#fff8c8"; ctx.fillRect(Math.round(ball.x - 3), Math.round(ball.y - 4), 3, 3);
  });
}

function drawEffects() {
  game.arcs.forEach(a => {
    ctx.strokeStyle = a.blast ? "#ff8b4c" : "#6ff7ef"; ctx.lineWidth = a.blast ? 5 : 3;
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
    const segments = 5;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = a.x1 + (a.x2 - a.x1) * t + (Math.random() - .5) * 17;
      const y = a.y1 + (a.y2 - a.y1) * t + (Math.random() - .5) * 17;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(a.x2, a.y2); ctx.stroke();
  });
  game.particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    const s = Math.max(2, p.size * p.life); ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  });
  ctx.globalAlpha = 1;
  ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
  game.texts.forEach(t => { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); });
  ctx.globalAlpha = 1;
}

function pixelCircle(x, y, r) {
  ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); ctx.fill();
}
function pixelCircleStroke(x, y, r) { ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); ctx.stroke(); }
function drawThickLine(x1, y1, x2, y2, color, width) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineCap = "butt"; }

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (.35 + Math.random() * .65);
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, life: .35 + Math.random() * .45, size: 3 + Math.random() * 4 });
  }
}
function wallSpark(x, y) { if (Math.random() < .25) burst(x, y, "#7d8b9c", 2, 45); }

function updateHud() {
  const stage = stages[game.stageIndex];
  UI.stageLabel.textContent = stage.boss ? "首领战" : `第 ${game.stageIndex + 1} 关`;
  UI.stageName.textContent = stage.name;
  UI.score.textContent = game.score.toLocaleString();
  UI.timer.textContent = Math.max(0, game.time).toFixed(1);
  UI.timerBlock.classList.toggle("danger", game.time <= 10);
  const power = Math.round(game.energy);
  UI.powerFill.style.height = `${power}%`; UI.powerText.textContent = game.derived.tesla ? `${power}%` : "未装线圈";
  UI.powerCore.classList.toggle("charged", game.chargedTimer > 0 || game.energy >= 95);
  if (stage.boss && game.monsters[0]) {
    const boss = game.monsters[0];
    UI.bossHpText.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
    UI.bossHpFill.style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
  }
  if (DEV_FAST) canvas.dataset.debug = JSON.stringify(window.__pinballDebug());
}

function updateCombo() {
  UI.combo.textContent = game.combo >= 2 ? `连杀 ×${game.combo}` : "";
  UI.combo.classList.remove("pop"); void UI.combo.offsetWidth; UI.combo.classList.add("pop");
}

function showToast(text) {
  UI.toast.textContent = text; UI.toast.classList.remove("show"); void UI.toast.offsetWidth; UI.toast.classList.add("show");
}

function rarityName(rarity) { return { common: "普通", rare: "稀有", epic: "史诗" }[rarity]; }
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }

function ensureAudio() {
  if (!game.audio) game.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (game.audio.state === "suspended") game.audio.resume();
}

function sound(type) {
  if (!game.audio) return;
  const specs = {
    hit: [150, .035, "square", .03], crit: [230, .07, "square", .06], kill: [310, .1, "square", .07],
    bumper: [440, .045, "square", .035], lane: [650, .08, "sine", .05], flipHit: [120, .035, "square", .025],
    launch: [180, .12, "sawtooth", .035], power: [720, .25, "square", .07], blast: [85, .18, "sawtooth", .07],
    spawn: [260, .08, "sine", .025], save: [540, .2, "square", .06], lose: [90, .25, "sawtooth", .05],
    reward: [520, .14, "square", .05], bossKill: [65, .5, "sawtooth", .1]
  };
  const [freq, duration, wave, volume] = specs[type] || specs.hit;
  const osc = game.audio.createOscillator(), gain = game.audio.createGain();
  osc.type = wave; osc.frequency.setValueAtTime(freq, game.audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(35, freq * (type === "lose" ? .45 : 1.35)), game.audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, game.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, game.audio.currentTime + duration);
  osc.connect(gain).connect(game.audio.destination); osc.start(); osc.stop(game.audio.currentTime + duration);
}

function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

function bindControl(button, side) {
  const set = active => {
    if (game.state !== "playing") return;
    game[side] = active; button.classList.toggle("active", active);
    if (active) { ensureAudio(); sound("hit"); }
  };
  button.addEventListener("pointerdown", e => { e.preventDefault(); button.setPointerCapture(e.pointerId); set(true); });
  button.addEventListener("pointerup", e => { e.preventDefault(); setTimeout(() => set(false), 55); });
  button.addEventListener("pointercancel", () => set(false));
}

bindControl(UI.leftControl, "leftActive");
bindControl(UI.rightControl, "rightActive");
window.addEventListener("keydown", e => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) { game.leftActive = true; UI.leftControl.classList.add("active"); }
  if (["ArrowRight", "KeyD"].includes(e.code)) { game.rightActive = true; UI.rightControl.classList.add("active"); }
});
window.addEventListener("keyup", e => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) { game.leftActive = false; UI.leftControl.classList.remove("active"); }
  if (["ArrowRight", "KeyD"].includes(e.code)) { game.rightActive = false; UI.rightControl.classList.remove("active"); }
});

document.getElementById("startButton").addEventListener("click", () => { ensureAudio(); UI.start.hidden = true; resetRun(); });
document.getElementById("restartButton").addEventListener("click", () => { ensureAudio(); UI.result.hidden = true; resetRun(); });
UI.continueButton.addEventListener("click", () => { ensureAudio(); startStage(game.stageIndex + 1); });
document.addEventListener("visibilitychange", () => { if (document.hidden) game.lastTime = performance.now(); });

window.__pinballDebug = () => ({
  state: game.state,
  time: game.time,
  score: game.score,
  balls: game.balls.map(({ x, y, vx, vy, main }) => ({ x, y, vx, vy, main })),
  monsters: game.monsters.map(({ hp, maxHp, dead, respawn }) => ({ hp, maxHp, dead, respawn }))
});

deriveStats();
setupTable();
spawnMonsters();
requestAnimationFrame(frame);
