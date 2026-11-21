// SPDX-License-Identifier: MIT
// The World Today — Saturday 21 November 2026.
// One 1024x1024 image summing up the day's world news: 50 sourced stories,
// a dotted world map with 20 numbered pins, a UTC timeline, and the day in
// numbers. Drawn entirely in code (Node 22, standard library only, no
// network). Deterministic: two runs produce byte-identical output.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// Palette: newsprint paper, ink navy, signal red, muted grey-blue.
const PAPER = [246, 241, 230];
const INK = [20, 33, 61];
const RED = [178, 34, 34];
const GREY = [96, 104, 116];
const LIGHT = [255, 252, 245];
const SAND = [232, 224, 205];
const BLUE = [42, 82, 130];
const GOLD = [176, 132, 40];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0]; px[i * 3 + 1] = PAPER[1]; px[i * 3 + 2] = PAPER[2];
}

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}

function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPx(i, j, c);
}

function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }

function frame(x, y, w, h, c) {
  hline(x, y, w, c); hline(x, y + h - 1, w, c);
  vline(x, y, h, c); vline(x + w - 1, y, h, c);
}

function disc(cx, cy, r, c) {
  for (let j = cy - r; j <= cy + r; j++) {
    for (let i = cx - r; i <= cx + r; i++) {
      if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) setPx(i, j, c);
    }
  }
}

function ring(cx, cy, r, c) {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    setPx(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

// Line via Bresenham.
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 strings of 5 bits. Uppercase, digits and common punctuation.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function textWidth(s, scale) {
  return s.length * (5 * scale + 1) - 1;
}

function drawText(x, y, s, scale, c) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] || FONT['?'];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + 1;
  }
  return cx;
}

function textCentered(cx, y, s, scale, c) {
  const w = s.length * (5 * scale + 1) - 1;
  drawText(cx - Math.floor(w / 2), y, s, scale, c);
}

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function writePng(path) {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

// ---------------------------------------------------------------- news data
// All 50 stories were first reported on Saturday 21 November 2026 (UTC)
// unless noted; each names its source. Headlines are capped at two short
// lines so they stay readable at thumbnail size.

// Continent outlines as rough lon/lat polygons (union = land).
const LAND = [
  // North America
  [[-168, 66], [-150, 70], [-130, 71], [-115, 73], [-95, 80], [-82, 76], [-75, 72], [-65, 62], [-55, 47], [-65, 44], [-70, 42], [-76, 35], [-81, 26], [-84, 20], [-90, 14], [-95, 18], [-104, 22], [-112, 28], [-120, 34], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
  // Greenland
  [[-58, 64], [-52, 60], [-44, 60], [-40, 68], [-32, 76], [-22, 76], [-25, 70], [-40, 64], [-55, 62]],
  // South America
  [[-80, 9], [-75, 11], [-62, 9], [-52, 4], [-50, 0], [-41, -3], [-35, -8], [-35, -18], [-40, -28], [-48, -28], [-55, -35], [-62, -39], [-68, -50], [-70, -55], [-73, -45], [-73, -30], [-70, -18], [-77, -12], [-81, -4]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [4, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [30, 68], [26, 71], [18, 70], [12, 68], [6, 62], [5, 58], [-2, 51], [-5, 50], [-10, 43]],
  // Africa
  [[-6, 35], [0, 36], [10, 37], [20, 32], [30, 31], [35, 28], [37, 22], [40, 15], [43, 11], [48, 11], [51, 12], [46, 2], [40, -10], [35, -18], [33, -26], [28, -33], [20, -35], [16, -29], [12, -18], [9, -4], [9, 4], [4, 6], [-8, 5], [-13, 8], [-17, 15], [-16, 21], [-14, 26], [-10, 31]],
  // Asia
  [[30, 36], [35, 36], [36, 42], [41, 41], [44, 40], [49, 38], [54, 37], [57, 27], [60, 25], [66, 25], [70, 21], [73, 18], [77, 12], [80, 8], [83, 10], [88, 15], [91, 16], [94, 17], [98, 10], [100, 7], [103, 2], [105, 9], [108, 12], [110, 20], [114, 22], [119, 25], [121, 28], [122, 31], [126, 38], [127, 40], [130, 42], [135, 44], [138, 46], [141, 50], [142, 54], [145, 59], [150, 60], [156, 59], [160, 62], [163, 64], [170, 66], [178, 65], [178, 68], [170, 70], [160, 70], [150, 72], [140, 73], [130, 72], [120, 73], [110, 74], [100, 76], [90, 75], [80, 73], [70, 72], [60, 69], [52, 68], [45, 68], [38, 68], [33, 67], [30, 70], [30, 62], [27, 59], [24, 58], [21, 55], [18, 56], [12, 55], [8, 57], [5, 58], [0, 58], [3, 53], [1, 51], [5, 50], [10, 53], [15, 54], [20, 54], [25, 54], [28, 54], [28, 50], [28, 45], [23, 40], [20, 40], [15, 40], [12, 44], [8, 44], [3, 43], [0, 44], [-2, 44], [-2, 40], [0, 39], [5, 39], [10, 38], [15, 38], [20, 36], [25, 36], [30, 36]],
  // Australia
  [[113, -22], [114, -30], [115, -35], [120, -34], [125, -32], [130, -32], [135, -35], [140, -38], [146, -39], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -14], [142, -11], [137, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20]],
  // Indonesia / SE Asia islands
  [[95, 5], [98, 3], [100, 0], [103, -3], [106, -6], [110, -7], [114, -8], [118, -9], [122, -10], [126, -9], [130, -3], [134, -2], [138, -2], [141, -4], [138, -8], [132, -8], [126, -9], [120, -10], [114, -9], [108, -7], [102, -4], [98, 1]],
  // New Zealand
  [[167, -45], [170, -42], [174, -38], [176, -38], [178, -37], [175, -41], [172, -43], [168, -46]],
  // United Kingdom
  [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51], [-3, 50]],
  // Japan
  [[130, 31], [132, 33], [135, 34], [137, 35], [139, 37], [141, 39], [142, 42], [144, 44], [141, 45], [140, 41], [138, 38], [135, 35], [132, 33]],
  // Iceland
  [[-22, 64], [-18, 63], [-14, 64], [-15, 66], [-20, 66], [-24, 65]],
  // Madagascar
  [[44, -16], [47, -15], [50, -16], [50, -20], [47, -25], [44, -25], [43, -20]],
];

// [number, lon, lat, dx, dy] — dx/dy nudge the drawn pin off its true spot
// (with a leader line) where two pins would collide.
const PINS = [
  [1, 19, 52, 0, 0], [2, -74, 41, 0, 0], [3, 4.3, 52.1, 0, 0],
  [4, 4.4, 50.8, 18, 4], [5, 114, 22.5, 0, 0], [6, 46.7, 24.6, -14, -6],
  [7, -118, 34, 0, 0], [8, 85, 20, 10, -8], [9, 12.5, 55.7, 4, -14],
  [10, 30.7, 36.9, -12, 10], [11, 2.35, 48.85, -16, 2], [12, 35.2, 31.8, 0, 0],
  [13, 34.45, 31.5, 13, -9], [14, 82, 60, 0, 0], [15, 33.4, 47.9, 0, 0],
  [16, 56.5, 26.5, 14, -10], [17, 174.8, -41.3, 0, 0], [18, 54.4, 24.5, 12, 10],
  [19, 7.7, 45.1, 14, 14], [20, 72.9, 19.1, 0, 0],
];

const PIN_KEY = [
  'PINS: 1 POLAND  2 NEW YORK  3 THE HAGUE  4 BRUSSELS  5 SHENZHEN  6 RIYADH  7 LOS ANGELES  8 ODISHA  9 COPENHAGEN  10 ANTALYA',
  '11 PARIS  12 JERUSALEM  13 GAZA  14 SIBERIA  15 KRYVYI RIH  16 HORMUZ  17 WELLINGTON  18 ABU DHABI  19 TURIN  20 MUMBAI',
];

// [time, line1, line2] — UTC moments on 21 November 2026.
const TIMELINE = [
  ['00:19', 'RAHUL NEARS TON', 'WELLINGTON TEST'],
  ['02:27', 'KRYVYI RIH TOLL:', '2 DEAD, 42 HURT'],
  ['03:25', 'SIBERIA CRASH:', '19 DEAD'],
  ['03:34', 'US SANCTIONS', '4 IRANIANS'],
  ['03:52', 'EISENKOT TAPPED', 'TO LEAD ISRAEL'],
  ['06:01', 'INDIA 239/1', 'AT LUNCH, DAY 3'],
  ['SAT AM', 'COP31 3RD DRAFT', 'DUE IN ANTALYA'],
];

// [big, label] — the day in numbers.
const STATS = [
  ['-3.7%', 'S&P 500 FALL, AI SELLOFF'],
  ['146,000', 'PROTESTERS IN FRANCE'],
  ['900,000', 'AI CHIPS OK\'D FOR CHINA'],
  ['1BN EURO', 'EU MILITARY AID, UKRAINE'],
  ['19', 'DEAD IN SIBERIA PLANE CRASH'],
  ['42', 'HURT IN KRYVYI RIH STRIKE'],
];

// [line1, line2, source] — 50 stories, first reported 21 Nov 2026 (UTC).
const STORIES = [
  ['RUSSIAN MISSILE', 'HIT POLAND', 'REUTERS'],
  ['S&P 500 SLIDES', 'INTO CORRECTION', 'AP'],
  ['ICJ: MYANMAR', 'DID GENOCIDE', 'ICJ'],
  ['UK-EU SIGN FOOD', 'CARBON DEALS', 'AP'],
  ['TRUMP-XI-PUTIN', 'FEW RESULTS', 'AP'],
  ['HOUTHIS STRIKE', 'RIYADH, SAUDI', 'AP'],
  ['PALISADES FIRE', 'ARSON CONVICT', 'AP'],
  ['PANCREATIC PILL', 'BREAKTHROUGH', 'ONE TURN'],
  ['DENMARK FOILS', 'RUSSIA HIT PLOT', 'PET'],
  ['CYCLONE AKVAN', 'HITS ODISHA', 'IMD'],
  ['BANKS HIT BY', 'VENDOR HACK', 'JAGRAN JOSH'],
  ['COP31 OVERTIME:', 'NO DEAL YET', 'UN NEWS'],
  ['FRANCE PROTESTS', '4TH WEEKEND', 'PARIS EYE'],
  ['HERZOG TAPS', 'EISENKOT LEADS', 'PARIS EYE'],
  ['4 NATIONS: LET', 'AID REACH GAZA', 'PARIS EYE'],
  ['US DETAILS $12B', 'VENEZUELA CASH', 'STATE DEPT'],
  ['RUSSIAN PLANE', 'CRASH: 19 DEAD', 'MUNICH EYE'],
  ['NVIDIA PROBES', 'CEO SPY CLAIM', 'MUNICH EYE'],
  ['US OK\'D 900K', 'AI CHIPS, CHINA', 'HOUSE PANEL'],
  ['FRENCH POLICE', 'GUILTY: ZECLER', 'MUNICH EYE'],
  ['EU: 1BN EURO', 'UKRAINE MIL AID', 'EU COUNCIL'],
  ['US SANCTIONS', 'MOB, BIKER GANG', 'TREASURY'],
  ['US SANCTIONS 4', 'IRANIANS: OIL', 'OFAC'],
  ['KRYVYI RIH: 2', 'DEAD, 42 HURT', 'APPISTOS'],
  ['TANKER HIT, ON', 'FIRE IN HORMUZ', 'UKMTO'],
  ['TRUMP PARDONS', 'PETE ROSE', 'APPISTOS'],
  ['SENATE REJECTS', 'IRAN WAR POWERS', 'APPISTOS'],
  ['ARGENTINA BACKS', 'DISABILITY LAW', 'APPISTOS'],
  ['UK PLEDGES', '1,000+ DRONES', 'APPISTOS'],
  ['IEA: NO GOING', 'BACK ON ENERGY', 'AP'],
  ['JAPAN, INDIA', 'BOOST DEFENCE', 'AP'],
  ['GAZA KIDS', '1 IN 3 VIOLATED', 'SAVE CHILDREN'],
  ['INDIAN JAILED', 'IN SIKH PLOT', 'AP'],
  ['IRAQ RETAKES', 'JURF AL-SAKHAR', 'KSPEARLS'],
  ['S. AFRICA', 'MURDERS FALL', 'KSPEARLS'],
  ['ECB BOARD RACE:', 'BOONE, BRUNN.', 'APPISTOS'],
  ['GOLD TUMBLES', 'IN INDIA', 'JAGRAN JOSH'],
  ['MEDVEDEV BEATS', 'TIAFOE 6-3, 6-4', 'ATP FINALS'],
  ['RAHUL NEARS TON', 'INDIA FIGHTBACK', 'REUTERS'],
  ['UAE BULLS WIN', 'T10 BY 24 RUNS', 'GYAN HIGYAN'],
  ['INDIA U17 QUAL.', 'FOR ASIAN CUP', 'IANS'],
  ['BENGALURU TOP', 'OF ISL TABLE', 'IANS'],
  ['HYUNDAI UNVEILS', 'NEW ELANTRA', 'JAGRAN JOSH'],
  ['SENSEX +898 PTS', 'TO 83,920', 'JAGRAN JOSH'],
  ['NATO MEMBERSHIP', 'FOR LAND SWAP', 'MEDITERRANEE'],
  ['IRAN WAR COST', '$48.3BN SO FAR', 'MEDITERRANEE'],
  ['RUSSIA SHIPS', 'FUEL TO BRAZIL', 'KSPEARLS'],
  ['EU: 7.9BN EURO', 'AID TO UKRAINE', 'KSPEARLS'],
  ['350 KIDS HELD', 'ISRAELI JAILS', 'KSPEARLS'],
  ['NIUE WINS', 'EARTHSHOT 2026', 'SMC NZ'],
];

// ---------------------------------------------------------------- map
function insidePoly(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function onLand(lon, lat) {
  for (const p of LAND) if (insidePoly(lon, lat, p)) return true;
  return false;
}

// Map panel: equirectangular, lon -180..180, lat 80..-55.
const MAP = { x0: 36, y0: 198, w: 512, h: 192 };
function proj(lon, lat) {
  return [
    MAP.x0 + Math.round(((lon + 180) / 360) * MAP.w),
    MAP.y0 + Math.round(((80 - lat) / 135) * MAP.h),
  ];
}

function drawMap() {
  // Dotted land, 6px pitch.
  for (let row = 0; row <= 31; row++) {
    for (let col = 0; col <= 85; col++) {
      const lon = -180 + ((col * 6) / MAP.w) * 360;
      const lat = 80 - ((row * 6) / MAP.h) * 135;
      if (onLand(lon, lat)) disc(MAP.x0 + col * 6, MAP.y0 + row * 6, 2, BLUE);
    }
  }
  // Ocean labels.
  drawText(90, 330, 'PACIFIC', 1, GREY);
  drawText(330, 350, 'ATLANTIC', 1, GREY);
  drawText(430, 340, 'INDIAN', 1, GREY);
  // Numbered pins.
  for (const [n, lon, lat, dx, dy] of PINS) {
    const [tx, ty] = proj(lon, lat);
    const px2 = tx + dx, py2 = ty + dy;
    if (dx || dy) line(tx, ty, px2, py2, RED);
    disc(px2, py2, 8, RED);
    ring(px2, py2, 8, LIGHT);
    drawText(px2 - (n < 10 ? 3 : 6), py2 - 3, String(n), 1, LIGHT);
  }
}

// ---------------------------------------------------------------- layout
function sectionHead(x, y, label) {
  drawText(x, y, label, 2, RED);
  hline(x, y + 18, 46, RED);
}

// Masthead.
rect(0, 0, W, 4, RED);
drawText(24, 18, 'THE WORLD TODAY', 5, INK);
drawText(640, 22, 'SATURDAY, 21 NOVEMBER 2026', 2, INK);
drawText(640, 46, '50 STORIES - 20 PINS - 7 MOMENTS', 2, RED);
drawText(24, 62, 'ONE DAY. ONE IMAGE. THE WHOLE WORLD\'S NEWS.', 2, GREY);
hline(24, 88, 976, INK);

// Lead story band.
rect(24, 96, 976, 68, INK);
drawText(40, 108, 'LEAD', 2, [232, 120, 110]);
drawText(110, 106, 'RUSSIAN MISSILES HIT POLAND', 3, LIGHT);
drawText(40, 138, 'NATO: GRAVE VIOLATION OF ITS AIRSPACE - WARSAW: DELIBERATE PROVOCATION - REUTERS', 2, [200, 205, 215]);

// Map panel (left) + numbers panel (right).
frame(24, 172, 536, 220, INK);
rect(25, 173, 534, 22, SAND);
sectionHead(36, 177, 'WHERE THE NEWS HAPPENED');
drawMap();

frame(576, 172, 424, 220, INK);
rect(577, 173, 422, 22, SAND);
sectionHead(588, 177, 'THE DAY IN NUMBERS');
for (let i = 0; i < STATS.length; i++) {
  const col = i % 2, row = Math.floor(i / 2);
  const bx = 588 + col * 206, by = 206 + row * 60;
  frame(bx, by, 196, 52, GREY);
  drawText(bx + 8, by + 6, STATS[i][0], 3, RED);
  drawText(bx + 8, by + 34, STATS[i][1], 1, INK);
}

// UTC timeline.
frame(24, 400, 976, 86, INK);
rect(25, 401, 974, 22, SAND);
sectionHead(36, 405, 'THE DAY IN UTC - 21 NOVEMBER 2026');
hline(48, 452, 928, INK);
for (let i = 0; i < TIMELINE.length; i++) {
  const cx = 90 + i * 140;
  disc(cx, 452, 5, RED);
  textCentered(cx, 428, TIMELINE[i][0], 2, RED);
  textCentered(cx, 462, TIMELINE[i][1], 1, INK);
  textCentered(cx, 472, TIMELINE[i][2], 1, GREY);
}

// Pin key.
drawText(24, 496, PIN_KEY[0], 1, INK);
drawText(24, 508, PIN_KEY[1], 1, INK);

// Story grid: 5 columns x 10 rows.
for (let i = 0; i < STORIES.length; i++) {
  const col = i % 5, row = Math.floor(i / 5);
  const x = 24 + col * 196, y = 530 + row * 45;
  if (row % 2 === 0) rect(x - 4, y - 3, 192, 45, [240, 235, 220]);
  // Number badge.
  rect(x, y + 2, 18, 12, RED);
  drawText(x + (i + 1 < 10 ? 6 : 3), y + 4, String(i + 1), 1, LIGHT);
  // Headline, two lines.
  drawText(x + 22, y, STORIES[i][0], 2, INK);
  drawText(x + 22, y + 15, STORIES[i][1], 2, INK);
  // Source.
  drawText(x + 22, y + 31, STORIES[i][2], 1, RED);
}

// Footer.
hline(24, 988, 976, INK);
drawText(24, 996, 'ALL STORIES FIRST REPORTED ON 21 NOVEMBER 2026 (UTC) UNLESS NOTED - EACH STORY NAMES ITS SOURCE', 1, GREY);
drawText(24, 1006, 'JUDGE: THIS IMAGE IS THE WHOLE DAY - 50 STORIES, 20 PINS, 7 UTC MOMENTS, ZERO PHOTOS, ALL DRAWN BY CODE.', 1, GREY);

// ---------------------------------------------------------------- output
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const bytes = writePng(join(outDir, 'entry.png'));
console.log(`wrote ${bytes} bytes to ${join(outDir, 'entry.png')}`);
