// 버들 대장간 — 검을 강화하고, 팔고, 대결하는 게임
const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const won = (n) => Math.floor(n).toLocaleString('ko-KR');
function fmtG(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 1 : 2).replace(/\.?0+$/, '') + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만';
  return won(n);
}

// ---------- 검 ----------
// [이름, 칼날 색, 빛 색]
const SWORDS = [
  ['녹슨 단검', '#8a7a6a', '#000000'],
  ['무딘 철검', '#9aa0a8', '#000000'],
  ['수련생의 검', '#b2b8c0', '#000000'],
  ['날 선 철검', '#c6ccd4', '#9fb4ff'],
  ['강철 장검', '#d6dde6', '#9fb4ff'],
  ['기사의 검', '#e0e6ef', '#a8c8ff'],
  ['은빛 세검', '#eef3fa', '#c8e0ff'],
  ['달빛 검', '#dce8ff', '#9fc3ff'],
  ['황금 대검', '#ffd65a', '#ffc53a'],
  ['태양의 검', '#ffe38a', '#ffb02e'],
  ['불꽃 검', '#ff9a4a', '#ff6a2a'],
  ['용암 검', '#ff6a3a', '#ff3a1a'],
  ['서리 검', '#bff4ff', '#5cd6ff'],
  ['폭풍 검', '#a8d8ff', '#4aa8ff'],
  ['번개 검', '#fff6a0', '#ffe030'],
  ['별빛 검', '#e6d8ff', '#b48cff'],
  ['용의 이빨', '#ffb0c0', '#ff4a7a'],
  ['심연의 검', '#9a7aff', '#6a3aff'],
  ['천공의 검', '#d8fff4', '#4affc8'],
  ['여명의 성검', '#fff4d8', '#ffd08a'],
  ['천년 버들 신검', '#d8ffd0', '#7aff9a'],
];
const MAX = SWORDS.length - 1;
// 강화 확률 [성공, 유지, 하락, 파괴] (%)
const ODDS = [[100, 0, 0, 0], [95, 5, 0, 0], [90, 10, 0, 0], [85, 15, 0, 0], [80, 20, 0, 0], [75, 20, 5, 0], [70, 20, 10, 0], [65, 20, 15, 0], [60, 20, 15, 5], [55, 20, 17, 8], [50, 20, 20, 10], [45, 20, 22, 13], [40, 20, 25, 15], [35, 20, 28, 17], [30, 20, 30, 20], [25, 20, 33, 22], [20, 20, 35, 25], [15, 20, 38, 27], [10, 20, 40, 30], [5, 20, 45, 30]];
const costOf = (l) => Math.round(100 * Math.pow(1.32, l) / 10) * 10;
const sellOf = (l) => (l === 0 ? 0 : Math.round(80 * Math.pow(1.72, l) / 10) * 10);
const guardOf = (l) => Math.round(sellOf(l) * 0.25 / 10) * 10; // 파괴 방지권 값
const GUARD_FROM = 10;

// ---------- 상태 ----------
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const NICK_A = ['용감한', '졸린', '반짝이는', '배고픈', '날쌘', '수줍은', '씩씩한', '느긋한', '엉뚱한', '행복한', '무서운', '작은'];
const NICK_B = ['대장장이', '고양이', '너구리', '곰돌이', '수달', '여우', '펭귄', '다람쥐', '올빼미', '기사', '견습생', '햄스터'];
const randNick = () => NICK_A[Math.floor(Math.random() * NICK_A.length)] + NICK_B[Math.floor(Math.random() * NICK_B.length)] + Math.floor(Math.random() * 90 + 10);
const FRESH = () => ({ v: 1, gold: 10000, level: 0, best: 0, seen: [0], tries: 0, destroyed: 0, sold: 0, earned: 0, wins: 0, losses: 0, tickets: 5, ticketAt: Date.now(), checkDay: '', streak: 0, nick: randNick(), guard: false });
let S = Object.assign(FRESH(), store.get('fg-save', {}));
const save = () => store.set('fg-save', S);
const device = (() => { let d = store.get('fg-device', null); if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set('fg-device', d); } return d; })();

// ---------- 도전권 충전 ----------
const TICKET_MAX = 5, TICKET_MS = 12 * 60 * 1000;
function regenTickets() {
  if (S.tickets >= TICKET_MAX) { S.ticketAt = Date.now(); return; }
  const n = Math.floor((Date.now() - S.ticketAt) / TICKET_MS);
  if (n > 0) { S.tickets = Math.min(TICKET_MAX, S.tickets + n); S.ticketAt += n * TICKET_MS; if (S.tickets >= TICKET_MAX) S.ticketAt = Date.now(); save(); }
}

// ---------- 검 그리기 ----------
// AI로 만든 검 그림 (배경을 지운 webp). 불러오기 전에는 코드 그림으로 대신한다.
const IMGS = SWORDS.map((_, i) => { const im = new Image(); im.src = `img/s${i}.webp`; return im; });
function drawSword(c, level, w, h, t = 0) {
  const im = IMGS[level];
  if (!im.complete || !im.naturalWidth) return drawSwordVector(c, level, w, h, t);
  const glow = SWORDS[level][2];
  c.save();
  c.clearRect(0, 0, w, h);
  const sh = h * 0.94, sw = sh * im.naturalWidth / im.naturalHeight;
  const scale = Math.min(1, (w * 0.95) / sw);
  const dw = sw * scale, dh = sh * scale, x = (w - dw) / 2, y = (h - dh) / 2;
  // 뒤쪽 빛
  if (level >= 3) {
    const a = Math.min(1, 0.12 + level * 0.04) * (0.85 + 0.15 * Math.sin(t * 3));
    const g = c.createRadialGradient(w / 2, h * 0.42, 5, w / 2, h * 0.42, Math.max(dw, dh * 0.55));
    g.addColorStop(0, hexA(glow, a * 0.6)); g.addColorStop(1, hexA(glow, 0));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  if (level >= 8) { c.shadowColor = glow; c.shadowBlur = 10 + level; }
  c.drawImage(im, x, y, dw, dh);
  c.shadowBlur = 0;
  // 칼날 위를 지나가는 반짝임
  if (level >= 5) {
    const k = (t * 0.6) % 1.6;
    if (k < 1) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = hexA('#ffffff', 0.5 * Math.sin(k * Math.PI));
      star(c, w / 2 + (Math.sin(t) * dw * 0.05), y + dh * (0.08 + k * 0.5), 9 + level * 0.4, 2.5);
      c.globalCompositeOperation = 'source-over';
    }
  }
  c.restore();
}
function drawSwordVector(c, level, w, h, t = 0) {
  const [, blade, glow] = SWORDS[level];
  c.save();
  c.clearRect(0, 0, w, h);
  const cx = w / 2, s = Math.min(w / 300, h / 520);
  const len = 250 + level * 7, bw = 26 + level * 0.9;
  const top = h / 2 - (len + 120) * s / 2;
  c.translate(cx, top); c.scale(s, s);
  // 빛
  if (level >= 3) {
    const a = Math.min(1, 0.15 + level * 0.045) * (0.85 + 0.15 * Math.sin(t * 3));
    const g = c.createRadialGradient(0, len * 0.55, 10, 0, len * 0.55, len * 0.75);
    g.addColorStop(0, hexA(glow, a * 0.55)); g.addColorStop(1, hexA(glow, 0));
    c.fillStyle = g; c.fillRect(-len, -40, len * 2, len * 1.6);
  }
  // 칼날
  c.shadowColor = glow; c.shadowBlur = level >= 3 ? 10 + level * 1.5 : 0;
  const bg = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  bg.addColorStop(0, shade(blade, -0.25)); bg.addColorStop(0.5, shade(blade, 0.25)); bg.addColorStop(0.52, blade); bg.addColorStop(1, shade(blade, -0.35));
  c.fillStyle = bg;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(bw / 2, 38); c.lineTo(bw / 2, len); c.lineTo(-bw / 2, len); c.lineTo(-bw / 2, 38); c.closePath(); c.fill();
  c.shadowBlur = 0;
  // 가운데 홈
  c.strokeStyle = shade(blade, -0.3); c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, 44); c.lineTo(0, len - 10); c.stroke();
  if (level === 0) { c.fillStyle = 'rgba(120,70,30,.55)'; [[-6, 90, 7], [5, 150, 9], [-4, 210, 6]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }); }
  // 반짝임 무늬
  if (level >= 8) {
    c.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) { const y = 60 + ((t * 60 + i * (len / 4)) % (len - 70)); c.fillStyle = '#fff'; star(c, (i % 2 ? 4 : -4), y, 5, 2); }
    c.globalAlpha = 1;
  }
  // 코등이
  const gw = 70 + level * 3;
  const gg = c.createLinearGradient(0, len, 0, len + 18);
  const guardCol = level >= 8 ? '#f0b830' : level >= 4 ? '#8a94a8' : '#6b5a48';
  gg.addColorStop(0, shade(guardCol, 0.3)); gg.addColorStop(1, shade(guardCol, -0.3));
  c.fillStyle = gg;
  c.beginPath(); c.moveTo(-gw / 2, len + 4); c.quadraticCurveTo(0, len - 8, gw / 2, len + 4); c.lineTo(gw / 2 - 6, len + 18); c.quadraticCurveTo(0, len + 10, -gw / 2 + 6, len + 18); c.closePath(); c.fill();
  if (level >= 12) { c.fillStyle = glow; c.shadowColor = glow; c.shadowBlur = 16; c.beginPath(); c.arc(0, len + 9, 8, 0, 7); c.fill(); c.shadowBlur = 0; }
  // 손잡이
  c.fillStyle = level >= 16 ? '#3a1a4a' : '#4a2e1c'; c.fillRect(-9, len + 18, 18, 76);
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3;
  for (let y = len + 24; y < len + 92; y += 10) { c.beginPath(); c.moveTo(-9, y); c.lineTo(9, y + 6); c.stroke(); }
  // 폼멜
  c.fillStyle = guardCol; c.beginPath(); c.arc(0, len + 102, 13, 0, 7); c.fill();
  c.restore();
}
function star(c, x, y, R, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------- 무대 (효과) ----------
const back = $('#back'), bg = back.getContext('2d');
const cv = $('#sword'), g = cv.getContext('2d');
const fx = $('#fx'), fg = fx.getContext('2d');
let W = 0, H = 0, DPR = 1, sparks = [], shake = 0, busy = false, showLevel = S.level;
let rings = [], rays = null, flash = null, pieces = [], charge = 0, chargeTo = 0, vignette = 0, tremble = 0;
const SW = { scale: 1, dy: 0, tint: 0, tintCol: '#ffffff' };
const dimEl = $('#dim'), flashEl = $('#flashEl');
function fit() {
  const r = $('#stage').getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
  [back, cv, fx].forEach((c) => { c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'; });
}
window.addEventListener('resize', fit);
const glowOf = (l) => (SWORDS[l][2] === '#000000' ? '#ffe2b0' : SWORDS[l][2]);
// 화면에 그려지는 검의 자리 (조각내기용)
function swordRect(l) {
  const im = IMGS[l];
  if (!im.complete || !im.naturalWidth) return null;
  const sh = H * 0.94, sw = sh * im.naturalWidth / im.naturalHeight, k = Math.min(1, (W * 0.95) / sw);
  return { im, x: (W - sw * k) / 2, y: (H - sh * k) / 2, w: sw * k, h: sh * k };
}
function burst(n, col, speed = 1, x = W / 2, y = H * 0.5, spread = Math.PI * 2, dir = 0) {
  for (let i = 0; i < n; i++) {
    const a = dir + rand(-spread / 2, spread / 2), v = rand(140, 560) * speed;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.35, 0.9), col, r: rand(1.2, 3), streak: true });
  }
}
function smoke(n, col = 'rgba(160,150,140,') {
  for (let i = 0; i < n; i++) sparks.push({ x: W / 2 + rand(-40, 40), y: H * rand(0.3, 0.7), vx: rand(-30, 30), vy: rand(-50, -15), t: 0, life: rand(0.8, 1.4), smoke: col, r: rand(14, 28), float: true });
}
function ring(col, max, width = 6, life = 0.6) { rings.push({ col, max, width, t: 0, life }); }
function flashIt(col, a) { flash = { col, a }; }
// 검 그림을 가로로 잘라 조각으로 날린다
function shatter(l) {
  const rc = swordRect(l);
  if (!rc) return;
  const iw = rc.im.naturalWidth, ih = rc.im.naturalHeight;
  let y0 = 0;
  while (y0 < 1) {
    const hf = Math.min(1 - y0, rand(0.08, 0.16));
    pieces.push({ im: rc.im, sy: y0 * ih, sw: iw, sh: hf * ih, x: rc.x, y: rc.y + y0 * rc.h, w: rc.w, h: hf * rc.h, vx: rand(-260, 260), vy: rand(-420, -120), rot: 0, vr: rand(-7, 7), t: 0 });
    y0 += hf;
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  charge += (chargeTo - charge) * Math.min(1, dt * 5);
  shake = Math.max(0, shake - dt * 40);
  SW.scale += (1 - SW.scale) * Math.min(1, dt * 7);
  SW.dy += (0 - SW.dy) * Math.min(1, dt * 6);
  if (!busy) SW.tint = Math.max(0, SW.tint - dt * 2.5);
  const cx = W / 2, cy = H * 0.45;
  // 뒤: 달아오르는 빛 + 빛줄기
  bg.setTransform(DPR, 0, 0, DPR, 0, 0); bg.clearRect(0, 0, W, H);
  if (charge > 0.01) {
    const gl = bg.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.5);
    gl.addColorStop(0, `rgba(255,170,80,${0.35 * charge})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
    bg.fillStyle = gl; bg.fillRect(0, 0, W, H);
  }
  if (rays) {
    rays.t += dt;
    const k = rays.t / rays.life;
    if (k >= 1) rays = null;
    else {
      const a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * rays.power;
      bg.save(); bg.translate(cx, cy); bg.rotate(t * 0.6);
      bg.globalCompositeOperation = 'lighter';
      const L = Math.min(W, H) * (0.3 + 0.3 * Math.min(1, k * 3));
      for (let i = 0; i < rays.n; i++) {
        bg.rotate((Math.PI * 2) / rays.n);
        const gr = bg.createLinearGradient(0, 0, L, 0);
        gr.addColorStop(0, hexA(rays.col, 0.55 * a)); gr.addColorStop(1, hexA(rays.col, 0));
        bg.fillStyle = gr; bg.beginPath(); bg.moveTo(0, 0); bg.lineTo(L, -L * 0.07); bg.lineTo(L, L * 0.07); bg.closePath(); bg.fill();
      }
      bg.restore();
    }
  }
  // 검
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  const sx = (shake ? rand(-shake, shake) : 0) + (tremble ? rand(-tremble, tremble) : 0), sy = shake ? rand(-shake, shake) : 0;
  if (showLevel >= 0) {
    g.save();
    g.translate(W / 2 + sx, H / 2 + sy + SW.dy + Math.sin(t * 1.5) * 4); g.scale(SW.scale, SW.scale); g.translate(-W / 2, -H / 2);
    drawSword(g, showLevel, W, H, t);
    if (SW.tint > 0.01) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = hexA(SW.tintCol, SW.tint); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    g.restore();
  }
  // 앞: 가장자리 어둠, 불똥, 연기, 조각, 고리, 번쩍임
  fg.setTransform(DPR, 0, 0, DPR, 0, 0); fg.clearRect(0, 0, W, H);
  dimEl.style.opacity = vignette.toFixed(3);
  if (!busy) vignette = Math.max(0, vignette - dt * 1.2);
  if (showLevel >= 8 && Math.random() < 0.05 + showLevel * 0.01) sparks.push({ x: W / 2 + rand(-60, 60), y: H * 0.85, vx: rand(-10, 10), vy: rand(-60, -30), t: 0, life: 2.5, col: glowOf(showLevel), r: rand(1, 2.5), float: true });
  sparks.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.float) { p.vy += 900 * dt; p.vx *= 0.99; } if (p.smoke) p.r += dt * 20; });
  sparks = sparks.filter((p) => p.t < p.life);
  for (const p of sparks) if (p.smoke) { fg.fillStyle = p.smoke + (0.35 * (1 - p.t / p.life)) + ')'; fg.beginPath(); fg.arc(p.x, p.y, p.r, 0, 7); fg.fill(); }
  fg.globalCompositeOperation = 'lighter';
  for (const p of sparks) {
    if (p.smoke) continue;
    const a = 1 - p.t / p.life;
    fg.globalAlpha = a;
    if (p.streak) { fg.strokeStyle = p.col; fg.lineWidth = p.r; fg.lineCap = 'round'; fg.beginPath(); fg.moveTo(p.x, p.y); fg.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); fg.stroke(); }
    else { fg.fillStyle = p.col; fg.beginPath(); fg.arc(p.x, p.y, p.r, 0, 7); fg.fill(); }
  }
  fg.globalCompositeOperation = 'source-over'; fg.globalAlpha = 1;
  pieces.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1100 * dt; p.rot += p.vr * dt; });
  pieces = pieces.filter((p) => p.t < 1.6 && p.y < H + 200);
  for (const p of pieces) {
    fg.save(); fg.globalAlpha = Math.max(0, 1 - p.t / 1.6);
    fg.translate(p.x + p.w / 2, p.y + p.h / 2); fg.rotate(p.rot);
    fg.drawImage(p.im, 0, p.sy, p.sw, p.sh, -p.w / 2, -p.h / 2, p.w, p.h);
    fg.restore();
  }
  rings.forEach((r) => (r.t += dt)); rings = rings.filter((r) => r.t < r.life);
  for (const r of rings) {
    const k = r.t / r.life, e = 1 - Math.pow(1 - k, 3);
    fg.strokeStyle = hexA(r.col, 1 - k); fg.lineWidth = r.width * (1 - k) + 1;
    fg.beginPath(); fg.arc(cx, cy, 20 + r.max * e, 0, 7); fg.stroke();
  }
  if (flash) { flashEl.style.background = flash.col; flashEl.style.opacity = Math.max(0, flash.a).toFixed(3); flash.a -= dt * 2.2; if (flash.a <= 0) { flash = null; flashEl.style.opacity = 0; } }
  requestAnimationFrame(frame);
}

// ---------- 화면 갱신 ----------
function render() {
  regenTickets();
  const l = S.level, [name] = SWORDS[l];
  $('#gold').textContent = won(S.gold);
  $('#tickets').textContent = `${S.tickets}/${TICKET_MAX}`;
  $('#lvl').textContent = `+${l}`;
  $('#swordName').textContent = name;
  $('#lvl').style.color = SWORDS[l][2] === '#000000' ? '#e8e0d4' : SWORDS[l][2];
  const o = l < MAX ? ODDS[l] : [0, 0, 0, 0];
  ['pS', 'pK', 'pD', 'pX'].forEach((id, i) => ($('#' + id).textContent = o[i] + '%'));
  const guardOn = S.guard && l >= GUARD_FROM && l < MAX;
  const cost = costOf(l) + (guardOn ? guardOf(l) : 0);
  $('#enhanceCost').textContent = l >= MAX ? '최고 단계!' : `💰 ${won(cost)}`;
  $('#enhanceBtn').disabled = busy || l >= MAX || S.gold < cost;
  $('#sellBtn').disabled = busy || l === 0;
  $('#sellPrice').textContent = l === 0 ? '팔 수 없어요' : `💰 ${won(sellOf(l))}`;
  $('#guardRow').hidden = l < GUARD_FROM || l >= MAX;
  $('#guardChk').checked = S.guard;
  $('#guardCost').textContent = won(guardOf(l));
  $('#pXbox').classList.toggle('guarded', guardOn);
  $('#best').textContent = `최고 기록 +${S.best}`;
  const broke = !busy && l === 0 && S.gold < costOf(0);
  $('#broke').hidden = !broke;
  $('#checkDot').hidden = S.checkDay === today();
  $('#battleBtn').disabled = busy;
}

// ---------- 강화 ----------
function toast(msg, cls = '') { const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + cls; clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 2200); }
function result(text, sub, cls) {
  const r = $('#result'); r.innerHTML = `<b></b><span></span>`; r.querySelector('b').textContent = text; r.querySelector('span').textContent = sub;
  r.className = 'result show ' + cls; clearTimeout(result.t); result.t = setTimeout(() => (r.className = 'result'), 1700);
}
function enhance() {
  const l = S.level;
  if (busy || l >= MAX) return;
  const guardOn = S.guard && l >= GUARD_FROM;
  const cost = costOf(l) + (guardOn ? guardOf(l) : 0);
  if (S.gold < cost) { Snd.play('no'); toast('골드가 모자라요'); return; }
  S.gold -= cost; S.tries++; busy = true; save(); render();
  // 망치 세 번: 칠 때마다 검이 달아오른다
  const hitX = W / 2 + 8, hitY = H * 0.5;
  chargeTo = 0.4; vignette = 0.5; SW.tintCol = '#ffd9a0';
  [0, 300, 600].forEach((ms, i) => setTimeout(() => {
    Snd.play('hammer'); shake = 5 + i * 3; SW.scale = 1.03;
    SW.tint = 0.18 + i * 0.14; chargeTo = 0.4 + i * 0.25;
    burst(14 + i * 8, i === 2 ? '#fff4c0' : '#ffb04a', 0.9 + i * 0.2, hitX, hitY, Math.PI * 1.1, -Math.PI / 2);
    ring('#ffcf80', 60 + i * 20, 4, 0.35);
    const hm = $('#hammer'); hm.classList.remove('hit'); void hm.offsetWidth; hm.classList.add('hit');
  }, ms));
  $('#stage').classList.add('forging');
  // 잠깐 숨 고르기: 하얗게 달아오른 검이 떨린다
  setTimeout(() => { tremble = 2.5; SW.tint = 0.6; SW.tintCol = '#ffffff'; }, 820);
  setTimeout(() => {
    $('#stage').classList.remove('forging');
    tremble = 0; chargeTo = 0;
    const [s, k, d] = ODDS[l], r = Math.random() * 100;
    if (r < s) {
      S.level = l + 1; showLevel = S.level;
      if (!S.seen.includes(S.level)) S.seen.push(S.level);
      const record = S.level > S.best; if (record) S.best = S.level;
      const big = S.level >= 10, col = glowOf(S.level);
      Snd.play(big ? 'big' : 'success');
      SW.tint = 0.9; SW.tintCol = '#ffffff'; SW.scale = big ? 1.22 : 1.12;
      flashIt('#ffffff', big ? 0.85 : 0.55);
      ring(col, Math.min(W, H) * 0.45, 10, 0.7);
      if (big) setTimeout(() => ring('#ffffff', Math.min(W, H) * 0.5, 6, 0.9), 120);
      rays = { t: 0, life: big ? 1.6 : 1.0, col, n: big ? 14 : 10, power: big ? 1 : 0.6 };
      burst(big ? 70 : 36, col, big ? 1.4 : 1.1, W / 2, H * 0.45);
      result('강화 성공!', `+${S.level} ${SWORDS[S.level][0]}${record && S.level > 1 ? ' · 최고 기록!' : ''}`, big ? 'ok big' : 'ok');
    } else if (r < s + k) {
      Snd.play('keep'); SW.tint = 0.35; SW.tintCol = '#8a8078'; smoke(12);
      result('유지', '아무 일도 일어나지 않았어요', 'keep');
    } else if (r < s + k + d) {
      S.level = l - 1; showLevel = S.level; shake = 10; SW.dy = 34; SW.tint = 0.5; SW.tintCol = '#ff5a3a';
      flashIt('#ff3a1a', 0.3); burst(24, '#ff8a4a', 0.8, W / 2, H * 0.55, Math.PI * 0.8, Math.PI / 2);
      Snd.play('down'); result('하락…', `+${S.level}로 떨어졌어요`, 'down');
    } else if (guardOn) {
      Snd.play('keep'); SW.tint = 0.6; SW.tintCol = '#8fd0ff'; flashIt('#8fd0ff', 0.4);
      ring('#8fd0ff', Math.min(W, H) * 0.45, 12, 0.8); burst(30, '#bfe6ff', 1, W / 2, H * 0.45);
      result('방지권 발동!', '파괴될 뻔했지만 검을 지켰어요', 'keep');
    } else {
      S.destroyed++; S.level = 0; shake = 22;
      Snd.play('destroy'); flashIt('#ff2a1a', 0.6); shatter(l); showLevel = -1;
      burst(40, '#ffb07a', 1.3, W / 2, H * 0.45); smoke(14, 'rgba(60,40,40,');
      result('파괴…', `+${l} ${SWORDS[l][0]}이(가) 산산조각 났어요`, 'boom');
      setTimeout(() => { showLevel = 0; SW.scale = 0.6; render(); }, 1500);
    }
    busy = false; save(); render();
  }, 1100);
}
function sell() {
  const l = S.level;
  if (busy || l === 0) return;
  const p = sellOf(l);
  confirmBox(`+${l} ${SWORDS[l][0]}을(를) 팔까요?`, `💰 ${won(p)} 골드를 받고, 새 녹슨 단검으로 다시 시작해요.`, '팔기', () => {
    S.gold += p; S.sold++; S.earned += p; S.level = 0; showLevel = 0; save();
    Snd.play('coin'); burst(24, '#ffd65a'); result(`+${won(p)} 골드`, '판매 완료! 새 검을 받았어요', 'ok'); render();
  });
}

// ---------- 창 ----------
function openPanel(title, bodyEl) {
  $('#pTitle').textContent = title; $('#pBody').replaceChildren(bodyEl); $('#panel').hidden = false;
}
$('#pClose').onclick = () => { $('#panel').hidden = true; Snd.play('click'); };
function confirmBox(title, text, okLabel, fn) {
  const d = document.createElement('div');
  d.className = 'confirm';
  d.innerHTML = `<p></p><div class="row"><button class="btn gold"></button><button class="btn ghost">취소</button></div>`;
  d.querySelector('p').textContent = text; d.querySelector('.gold').textContent = okLabel;
  d.querySelector('.gold').onclick = () => { $('#panel').hidden = true; fn(); };
  d.querySelector('.ghost').onclick = () => { $('#panel').hidden = true; };
  openPanel(title, d);
}

// ---------- 출석 ----------
const checkGold = (streak) => 5000 + 1000 * (Math.min(streak, 7) - 1);
function openCheck() {
  Snd.play('click');
  const d = document.createElement('div'); d.className = 'check';
  const done = S.checkDay === today();
  const nextStreak = S.checkDay === yesterday() ? S.streak + 1 : 1;
  const days = Array.from({ length: 7 }, (_, i) => i + 1);
  const cur = done ? S.streak : nextStreak;
  d.innerHTML = `<p class="lead">${done ? '오늘 출석 완료! 내일 또 와 주세요.' : '매일 출석하면 골드를 드려요. 연속으로 오면 더 많이!'}</p>
    <div class="days">${days.map((n) => `<div class="day ${n < cur || (done && n === cur) ? 'got' : n === cur ? 'now' : ''}"><small>${n}일째</small><b>💰${fmtG(checkGold(n))}</b></div>`).join('')}</div>
    <p class="note">연속 출석 ${Math.min(cur, 7)}일째${cur >= 7 ? ' · 최대 보상!' : ''} · 하루라도 빠지면 1일째부터 다시 시작해요</p>`;
  const b = document.createElement('button'); b.className = 'btn gold big';
  b.textContent = done ? '내일 다시 받을 수 있어요' : `💰 ${won(checkGold(nextStreak))} 받기`;
  b.disabled = done;
  b.onclick = () => {
    if (S.checkDay === today()) return;
    S.streak = nextStreak; S.checkDay = today(); const got = checkGold(S.streak); S.gold += got; save();
    Snd.play('coin'); burst(30, '#ffd65a'); $('#panel').hidden = true; result(`+${won(got)} 골드`, `출석 ${S.streak}일째!`, 'ok'); render();
  };
  d.append(b);
  openPanel('📅 출석 체크', d);
}

// ---------- 도감 ----------
function openBook() {
  Snd.play('click');
  const d = document.createElement('div'); d.className = 'book';
  d.innerHTML = `<p class="lead">강화에 성공해 본 검이 모여요. ${S.seen.length} / ${SWORDS.length}</p>`;
  const grid = document.createElement('div'); grid.className = 'grid';
  SWORDS.forEach(([name], i) => {
    const got = S.seen.includes(i);
    const card = document.createElement('div'); card.className = 'bcard' + (got ? '' : ' locked');
    const c = document.createElement('canvas'); c.width = 240; c.height = 400;
    if (got) { const draw = () => drawSword(c.getContext('2d'), i, 240, 400, 0); draw(); if (!IMGS[i].complete) IMGS[i].addEventListener('load', draw, { once: true }); }
    card.append(c);
    const cap = document.createElement('div'); cap.innerHTML = `<b>+${i}</b><span></span><em></em>`;
    cap.querySelector('span').textContent = got ? name : '???';
    cap.querySelector('em').textContent = got && i ? `판매 💰${fmtG(sellOf(i))}` : '';
    card.append(cap); grid.append(card);
  });
  d.append(grid);
  const st = document.createElement('div'); st.className = 'stats';
  [['강화 시도', `${won(S.tries)}번`], ['파괴된 검', `${won(S.destroyed)}자루`], ['판 검', `${won(S.sold)}자루`], ['판매로 번 골드', `💰 ${won(S.earned)}`], ['대결 전적', `${S.wins}승 ${S.losses}패`]].forEach(([a, b]) => {
    const r = document.createElement('div'); r.innerHTML = '<span></span><b></b>'; r.querySelector('span').textContent = a; r.querySelector('b').textContent = b; st.append(r);
  });
  d.append(st);
  openPanel('📖 검 도감', d);
}

// ---------- 대결 ----------
const NET = {
  url: 'https://wkyqotnysmuzjgwlbnlf.supabase.co/rest/v1/rpc/',
  key: 'sb_publishable__JtY-5lIILQt-cjrvVyw0A_VZrSQdsR',
  async call(fn, body) {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(this.url + fn, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', apikey: this.key, Authorization: 'Bearer ' + this.key }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  },
};
const safeNick = (n) => (String(n || '').replace(/[<>]/g, '').trim().slice(0, 10) || '대장장이');
async function findOpponent() {
  const my = S.level;
  try {
    NET.call('forge_submit', { p_device: device, p_name: safeNick(S.nick), p_level: my }).catch(() => {});
    const rows = await NET.call('forge_match', { p_device: device, p_level: my });
    if (Array.isArray(rows) && rows.length) return { name: safeNick(rows[0].name), level: Math.max(1, Math.min(MAX, rows[0].level | 0)), real: true };
  } catch {}
  const lv = Math.max(1, Math.min(MAX, my + Math.floor(rand(-2, 2)))); // -2 ~ +1
  return { name: '수련 상대 · ' + ['허수아비', '떠돌이 검사', '견습 기사', '산적', '늙은 용병'][Math.floor(Math.random() * 5)], level: lv, real: false };
}
const powerOf = (l) => 100 * Math.pow(1.25, l);
const rewardOf = (l) => Math.max(200, Math.round(sellOf(l) * 0.5 / 10) * 10);
function openBattle() {
  Snd.play('click'); regenTickets();
  const d = document.createElement('div'); d.className = 'battle';
  const wait = S.tickets < TICKET_MAX ? Math.ceil((TICKET_MS - (Date.now() - S.ticketAt)) / 60000) : 0;
  d.innerHTML = `<p class="lead">지금 든 검으로 다른 대장장이와 겨뤄요. 이기면 상대 검 값의 절반을 골드로 받아요.<br>진다고 검을 잃지는 않아요.</p>
    <div class="nick-row"><label>내 이름</label><input id="nickIn" maxlength="10"><button class="btn ghost" id="nickDice" title="랜덤 이름">🎲</button></div>
    <div class="tix">⚔️ 도전권 <b>${S.tickets} / ${TICKET_MAX}</b>${wait ? ` <small>· ${wait}분 뒤 1장 충전</small>` : ''}</div>`;
  const b = document.createElement('button'); b.className = 'btn red big';
  b.textContent = S.level === 0 ? '+1 이상 검이 있어야 대결할 수 있어요' : S.tickets <= 0 ? '도전권이 없어요' : '상대 찾기';
  b.disabled = S.level === 0 || S.tickets <= 0;
  b.onclick = async () => {
    b.disabled = true; b.textContent = '상대를 찾는 중…';
    S.nick = safeNick($('#nickIn').value); save();
    const opp = await findOpponent();
    S.tickets--; if (S.tickets === TICKET_MAX - 1) S.ticketAt = Date.now(); save(); render();
    fight(opp);
  };
  d.append(b);
  openPanel('⚔️ 랜덤 대결', d);
  $('#nickIn').value = S.nick;
  $('#nickDice').onclick = () => { $('#nickIn').value = randNick(); Snd.play('click'); };
}
// 대결 화면 가운데에서 튀는 불꽃 (작은 캔버스를 잠깐 띄운다)
function arenaSparks(d, n = 26, col = '#ffc070') {
  let c = d.querySelector('.arena-fx');
  if (!c) { c = document.createElement('canvas'); c.className = 'arena-fx'; d.append(c); }
  const w = (c.width = d.clientWidth), h = (c.height = d.clientHeight), x = c.getContext('2d');
  const ps = Array.from({ length: n }, () => { const a = rand(0, Math.PI * 2), v = rand(120, 420); return { x: w / 2, y: h * 0.38, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.3, 0.7) }; });
  let prev = performance.now();
  (function step(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    x.clearRect(0, 0, w, h); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    let alive = false;
    for (const p of ps) {
      p.t += dt; if (p.t >= p.life) continue; alive = true;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
      x.globalAlpha = 1 - p.t / p.life; x.strokeStyle = col; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); x.stroke();
    }
    if (alive) requestAnimationFrame(step); else x.clearRect(0, 0, w, h);
  })(prev);
}
function fight(opp) {
  const my = S.level;
  const d = document.createElement('div'); d.className = 'arena';
  d.innerHTML = `<div class="side me"><canvas width="280" height="460"></canvas><b></b><span></span><strong class="pow">0</strong></div>
    <div class="vs">VS</div>
    <div class="side op"><canvas width="280" height="460"></canvas><b></b><span></span><strong class="pow">0</strong></div>
    <div class="verdict"></div>`;
  const [me, op] = d.querySelectorAll('.side');
  drawSword(me.querySelector('canvas').getContext('2d'), my, 280, 460);
  drawSword(op.querySelector('canvas').getContext('2d'), opp.level, 280, 460);
  me.querySelector('b').textContent = safeNick(S.nick); me.querySelector('span').textContent = `+${my} ${SWORDS[my][0]}`;
  op.querySelector('b').textContent = opp.name; op.querySelector('span').textContent = `+${opp.level} ${SWORDS[opp.level][0]}`;
  openPanel(opp.real ? '⚔️ 대결 상대를 찾았어요!' : '⚔️ 수련 대결', d);
  $('#pClose').hidden = true;
  const a = Math.round(powerOf(my) * rand(0.6, 1.4)), bpow = Math.round(powerOf(opp.level) * rand(0.6, 1.4));
  const pa = me.querySelector('.pow'), pb = op.querySelector('.pow');
  const t0 = performance.now(), dur = 1600;
  let lastClash = 0;
  (function roll(now) {
    const k = Math.min(1, (now - t0) / dur);
    pa.textContent = won(a * (1 - Math.pow(1 - k, 3)) * (k < 1 ? rand(0.9, 1.1) : 1));
    pb.textContent = won(bpow * (1 - Math.pow(1 - k, 3)) * (k < 1 ? rand(0.9, 1.1) : 1));
    if (now - lastClash > 480 && k < 0.95) { lastClash = now; Snd.play('clash'); d.classList.remove('clash'); void d.offsetWidth; d.classList.add('clash'); arenaSparks(d); }
    if (k < 1) return requestAnimationFrame(roll);
    const win = a >= bpow;
    const v = d.querySelector('.verdict');
    if (win) {
      const got = rewardOf(opp.level); S.gold += got; S.wins++;
      v.innerHTML = `<b class="w">승리!</b><span>💰 ${won(got)} 골드를 얻었어요</span>`; Snd.play('win'); me.classList.add('winner'); op.classList.add('loser'); arenaSparks(d, 40, '#ffe08a');
    } else {
      S.losses++; v.innerHTML = `<b class="l">패배…</b><span>검은 무사해요. 다음엔 이길 거예요!</span>`; Snd.play('lose'); op.classList.add('winner'); me.classList.add('loser');
    }
    save(); render();
    const again = document.createElement('div'); again.className = 'row';
    again.innerHTML = `<button class="btn red">${S.tickets > 0 && S.level > 0 ? '한 번 더' : '닫기'}</button><button class="btn ghost">닫기</button>`;
    const [x, y] = again.querySelectorAll('button');
    x.onclick = () => { $('#pClose').hidden = false; if (S.tickets > 0 && S.level > 0) openBattle(); else $('#panel').hidden = true; };
    y.onclick = () => { $('#pClose').hidden = false; $('#panel').hidden = true; };
    if (!(S.tickets > 0 && S.level > 0)) y.remove();
    d.append(again);
  })(t0);
}

// ---------- 연결 ----------
$('#enhanceBtn').onclick = () => { Snd.unlock(); enhance(); };
$('#sellBtn').onclick = () => { Snd.unlock(); sell(); };
$('#guardChk').onchange = (e) => { S.guard = e.target.checked; save(); render(); };
$('#checkBtn').onclick = openCheck;
$('#brokeCheck').onclick = openCheck;
$('#bookBtn').onclick = openBook;
$('#battleBtn').onclick = openBattle;
function syncSnd() { $('#musicBtn').classList.toggle('off', !Snd.musicOn); $('#sfxBtn').classList.toggle('off', !Snd.sfxOn); }
$('#musicBtn').onclick = () => { Snd.unlock(); Snd.toggleMusic(); Snd.music(true); syncSnd(); };
$('#sfxBtn').onclick = () => { Snd.unlock(); Snd.toggleSfx(); syncSnd(); };
document.addEventListener('pointerdown', () => { Snd.unlock(); Snd.music(Snd.musicOn); }, { once: true });
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && $('#panel').hidden && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); Snd.unlock(); enhance(); } });
syncSnd();
setInterval(render, 5000);
fit(); render(); requestAnimationFrame(frame);
if (S.checkDay !== today()) setTimeout(openCheck, 600);
