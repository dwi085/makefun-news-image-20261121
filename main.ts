// news-image-20261121 ROUND 3 — "The World Today" broadsheet front page.
// Node 22+, standard library only, no network. Deterministic: same bytes every run.
// Draws the whole page programmatically: embedded 5x7 bitmap font, software
// rasterizer, hand-rolled PNG encoder (zlib deflate + CRC32).

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette ---
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [22, 22, 20];
const SOFT: RGB = [74, 70, 62];
const RED: RGB = [163, 29, 29];
const BLUE: RGB = [30, 79, 138];
const TEAL: RGB = [15, 118, 110];
const GOLD: RGB = [176, 124, 22];
const RULE: RGB = [178, 169, 148];
const PANEL: RGB = [238, 231, 214];
const SKY: RGB = [214, 228, 240];
const NIGHT: RGB = [24, 38, 64];
const CREAM: RGB = [255, 252, 244];

// ------------------------------------------------------------------ font ----
// 5x7 bitmap font, one 35-char "0"/"1" string per glyph, row-major, 7 rows of 5.
const GLYPHS: Record<string, string> = {
  A: '01110100011000111111100011000110001',
  B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111',
  F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111',
  H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001',
  L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001',
  N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101',
  R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110',
  T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100',
  W: '10001100011000110101101011101110001',
  X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100',
  Z: '11111000010001000100010001000011111',
  a: '00000000000111000001011111000101111',
  b: '10000100001111010001100011000111110',
  c: '00000000000111010000100001000101110',
  d: '00001000010111110001100011000101111',
  e: '00000000000111010001111111000001110',
  f: '00110010010100011110010000100001000',
  g: '00000011111000110001011110000101110',
  h: '10000100001111010001100011000110001',
  i: '00100000000110000100001000010001110',
  j: '00010000000011000010000101001001100',
  k: '10000100001001010100110001010010010',
  l: '01100001000010000100001000010001110',
  m: '00000000001101010101101011010110101',
  n: '00000000001111010001100011000110001',
  o: '00000000000111010001100011000101110',
  p: '00000111101000110001111101000010000',
  q: '00000011111000110001011110000100001',
  r: '00000000001011011001100001000010000',
  s: '00000000000111110000011100000111110',
  t: '01000010001111001000010000100000110',
  u: '00000000001000110001100011001101101',
  v: '00000000001000110001100010101000100',
  w: '00000000001000110101101011010101010',
  x: '00000000001000101010001000101010001',
  y: '00000000001000110001011110000101110',
  z: '00000000001111100010001000100011111',
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100110010001000011111',
  '3': '11111000100010000010000011000101110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000',
  '.': '00000000000000000000000000110001100',
  ',': '00000000000000000000001100001000100',
  ':': '00000011000110000000011000110000000',
  ';': '00000011000110000000011000010001000',
  '!': '00100001000010000100001000000000100',
  '?': '01110100010000100110001000000000100',
  "'": '00100001000100000000000000000000000',
  '"': '01010010100000000000000000000000000',
  '(': '00010001000100001000010000010000010',
  ')': '01000001000001000010000100010001000',
  '-': '00000000000000011111000000000000000',
  '/': '00001000100001000100010001000100000',
  '%': '11001110100001000100010000101110011',
  '&': '01100100101010001000101011001001101',
  '+': '00000001000010011111001000010000000',
  '=': '00000000001111100000111110000000000',
  '*': '00000101010111010101000000000000000',
  '#': '01010010101111101010111110101001010',
  '@': '01110100011011110101101101000001110',
  _: '0000000000000000000000000000011111',
  $: '00100011111010001110001011111000100',
  '[': '01110010000100001000010000100001110',
  ']': '01110000100001000010000100010001110',
  '<': '00010001000100010000010000010000010',
  '>': '01000001000001000001000100001000100',
  '^': '00100010101000100000000000000000000',
  '~': '00000000000100110110000000000000000',
  '|': '00100001000010000100001000010000100',
  '\\': '10000010000100000100000100001000001',
  '•': '00000001000111001110011100010000000',
};

// -------------------------------------------------------------- rasterizer --
const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0]; img[i * 3 + 1] = PAPER[1]; img[i * 3 + 2] = PAPER[2];
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB): void { rect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: RGB): void { rect(x, y, 1, h, c); }
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
  }
}
function ring(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function poly(pts: [number, number][], c: RGB): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let y = Math.ceil(minY); y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= xs[i + 1]; x++) px(x, y, c);
    }
  }
}

// ------------------------------------------------------------------- text ---
function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = GLYPHS[ch] ?? GLYPHS['?'];
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if (g[r * 5 + col] === '1') rect(x + col * s, y + r * s, s, s, c);
  }
}
function text(str: string, x: number, y: number, s: number, c: RGB): number {
  let cx = x;
  for (const ch of str) { drawChar(ch, cx, y, s, c); cx += 6 * s; }
  return cx;
}
function textW(str: string, s: number): number { return str.length * 6 * s - s; }
function wrap(str: string, maxW: number, s: number): string[] {
  const words = str.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textW(t, s) <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function center(str: string, y: number, s: number, c: RGB, x0 = 0, x1 = W): number {
  const x = Math.round(x0 + (x1 - x0 - textW(str, s)) / 2);
  return text(str, x, y, s, c);
}

// -------------------------------------------------------------- PNG encode --
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}


// ============================================================ story data ===
// Every story happened, or was first reported, on Saturday 21 November 2026.
// Source named on each story. pin = number on the world map (0 = no pin).
// Headlines are kept short on purpose: at scale 2 in a 240px column each
// story must wrap to at most 2 lines, or drawStory warns on stderr.
type Story = { pin: number; head: string; src: string };
const HERO: Story[] = [
  { pin: 1, head: 'TRUMP, XI AND PUTIN MEET IN SHENZHEN', src: 'AP' },
  { pin: 2, head: 'RUSSIAN MISSILES FALL IN POLAND', src: 'Guardian' },
  { pin: 18, head: 'CLIMATE TALKS RUN INTO OVERTIME', src: 'Reuters' },
];
const HERO_SUB: string[] = [
  'Trilateral talks open on cutting nuclear risk at the APEC summit',
  "NATO: a 'grave violation'",
  'COP31 deadlocked on fossil fuels',
];
const HERO_PLACE: string[] = ['SHENZHEN, CHINA', 'POLAND', 'ANTALYA, TURKEY'];
// head already includes place + source suffix, e.g. "Kryvyi Rih: ... (AP)"
const COLA: Story[] = [
  { pin: 3, head: 'Missile kills 2 in Zelenskyy town', src: 'AP' },
  { pin: 4, head: 'Drones hit Russian ship Sparta II', src: 'AFP' },
  { pin: 5, head: 'Strike on food-aid van kills 3', src: 'AJ' },
  { pin: 6, head: 'Ukraine hits Kerch Bridge 3rd time', src: 'AP' },
  { pin: 7, head: 'Saudi downs 3 Houthis', src: 'Reports' },
  { pin: 8, head: 'Hormuz attacks hit wartime high', src: 'FT' },
  { pin: 9, head: 'Army clears RSF from 10 areas', src: 'SAF' },
  { pin: 10, head: 'Denmark expels Russian envoy', src: 'Gdn' },
  { pin: 0, head: 'Moscow OK with NATO guarantees', src: 'AP' },
  { pin: 0, head: 'Nepal PM in India, meets Modi', src: 'ST' },
  { pin: 0, head: 'Aoun demands Israeli pullout', src: 'AJ' },
  { pin: 11, head: 'UK expels Myanmar attache', src: 'BBC' },
];
const COLB: Story[] = [
  { pin: 0, head: 'UK-EU seal Brexit reset', src: 'Reports' },
  { pin: 0, head: 'Mamdani to close Rikers', src: 'Reports' },
  { pin: 0, head: 'Canada unaware of US defence memo', src: 'ST' },
  { pin: 12, head: 'Italy: general strike', src: 'Gdn' },
  { pin: 0, head: 'EU approves 1bn for Ukraine', src: 'EU' },
  { pin: 0, head: 'US offers deep-sea leases', src: 'Reports' },
  { pin: 0, head: 'EU-Indonesia sign trade deal', src: 'EU' },
  { pin: 0, head: 'Trump: farm deal favours US', src: 'Reports' },
  { pin: 0, head: 'Pakistan urges SCO dialogue', src: 'ST' },
  { pin: 0, head: 'Autonomous-weapons talks fail', src: 'Gdn' },
  { pin: 0, head: 'Famine confirmed in Gaza, Sudan', src: 'FAO' },
  { pin: 0, head: 'Denmark backs deal 109-0', src: 'Reports' },
];
const COLC: Story[] = [
  { pin: 22, head: 'AI rout hits US stocks', src: 'Reports' },
  { pin: 0, head: 'Chinese AI stocks shed $1.7tn', src: 'ST' },
  { pin: 0, head: 'Nvidia halts H200 exports', src: 'ST' },
  { pin: 0, head: 'Anthropic shares hit $88.91', src: 'Reports' },
  { pin: 0, head: 'Trump: AI centres stay in US', src: 'Reports' },
  { pin: 0, head: 'FBI probes hack of database', src: 'BBC' },
  { pin: 0, head: 'FBI arrests man over crypto', src: 'Reports' },
  { pin: 0, head: 'N. Korea expands enrichment', src: 'IAEA' },
  { pin: 0, head: 'Gen Z walkouts in 25 countries', src: 'Reports' },
  { pin: 0, head: 'Spain heads to snap poll', src: 'Reports' },
  { pin: 20, head: 'Iraq raids Hezbollah', src: 'Reports' },
  { pin: 21, head: 'Finland limits air, sea', src: 'Reports' },
];
const COLD: Story[] = [
  { pin: 0, head: 'Riemann proof gains two checks', src: 'MIT' },
  { pin: 0, head: 'Cancer pill: 1 in 12 tumours gone', src: 'Trial' },
  { pin: 13, head: 'Ebola hits 100 schools', src: 'Reports' },
  { pin: 0, head: 'S. Korea confirms cholera', src: 'Reports' },
  { pin: 19, head: 'Bolsonaro in ICU', src: 'Reports' },
  { pin: 14, head: 'Earthquake shakes central Peru', src: 'ST' },
  { pin: 15, head: 'Pakistan beat Sri Lanka', src: 'Reports' },
  { pin: 16, head: 'Australia edge England', src: 'Reports' },
  { pin: 0, head: 'Alcaraz beats Cobolli', src: 'ATP' },
  { pin: 0, head: 'Leeds stun Chelsea 4-1', src: 'BBC Sport' },
  { pin: 17, head: 'Cartel boss nabbed', src: 'Reports' },
  { pin: 0, head: 'MI Emirates win opener', src: 'Reports' },
];
// 22 map pins: [number, lon, lat, label]
const PINS: [number, number, number, string][] = [
  [1, 114.1, 22.5, 'Shenzhen'], [2, 23.5, 50.5, 'Poland border'], [3, 33.4, 47.9, 'Kryvyi Rih'],
  [4, 27.0, 59.9, 'Baltic Sea'], [5, 34.5, 31.5, 'Gaza City'], [6, 36.5, 45.3, 'Kerch'],
  [7, 46.7, 24.7, 'Riyadh'], [8, 56.5, 26.5, 'Hormuz'], [9, 28.0, 12.0, 'W. Kordofan'],
  [10, 12.6, 55.7, 'Copenhagen'], [11, -0.1, 51.5, 'London'], [12, 12.5, 41.9, 'Rome'],
  [13, 29.0, -1.5, 'E. Congo'], [14, -75.0, -10.0, 'Central Peru'], [15, 73.0, 33.6, 'Rawalpindi'],
  [16, 145.0, -37.8, 'Melbourne'], [17, -107.0, 24.8, 'Sinaloa'], [18, 30.7, 36.9, 'Antalya'],
  [19, -47.9, -15.8, 'Brasilia'], [20, 44.4, 33.3, 'Baghdad'], [21, 25.0, 60.2, 'Helsinki'],
  [22, -74.0, 40.7, 'New York'],
];
// UTC timeline: [hour, label] — all times UTC, 21 November 2026.
const TIMELINE: [number, string][] = [
  [2.7, '02:41 NATO: Poland violation'],
  [9.5, '09:30 Riemann cross-check'],
  [12.9, '12:55 Lean checks pass'],
  [15.1, '15:07 CCTV blast'],
  [18.1, '18:08 Trump: check first'],
];

// Simplified continent outlines, [lon, lat] — schematic, not survey-grade.
const LAND: [number, number][][] = [
  // North America
  [[-168, 66], [-150, 70], [-135, 69], [-125, 71], [-115, 73], [-100, 73], [-90, 74], [-85, 70], [-80, 73], [-76, 62], [-68, 58], [-60, 55], [-55, 52], [-60, 47], [-65, 44], [-70, 42], [-75, 36], [-80, 32], [-84, 30], [-90, 29], [-97, 26], [-97, 18], [-92, 15], [-87, 13], [-83, 9], [-80, 8], [-77, 8], [-83, 10], [-90, 14], [-95, 16], [-100, 17], [-105, 20], [-110, 23], [-115, 29], [-122, 37], [-125, 42], [-124, 48], [-130, 55], [-140, 60], [-152, 58], [-162, 58], [-168, 66]],
  // South America
  [[-79, 9], [-76, 11], [-70, 12], [-62, 10], [-55, 6], [-51, 4], [-50, 0], [-44, -3], [-37, -5], [-35, -9], [-39, -15], [-40, -21], [-48, -27], [-53, -33], [-58, -35], [-62, -39], [-66, -41], [-68, -47], [-70, -52], [-73, -54], [-71, -45], [-73, -37], [-71, -30], [-70, -22], [-70, -18], [-75, -15], [-79, -8], [-81, -4], [-80, 1], [-79, 6]],
  // Europe
  [[-10, 36], [-9, 38], [-9, 43], [-2, 44], [-1, 46], [2, 43], [7, 44], [10, 44], [12, 45], [16, 40], [18, 40], [20, 40], [23, 36], [26, 38], [27, 40], [30, 41], [28, 45], [24, 45], [22, 46], [19, 45], [14, 45], [12, 44], [8, 44], [4, 43], [0, 40], [-2, 37], [-6, 36], [-9, 37], [-10, 39], [-9, 42], [-5, 48], [-2, 49], [0, 50], [2, 51], [4, 53], [7, 54], [8, 57], [10, 58], [5, 59], [5, 62], [10, 64], [13, 66], [18, 69], [24, 71], [30, 70], [32, 67], [35, 67], [40, 68], [44, 68], [46, 66], [42, 63], [38, 60], [36, 56], [34, 52], [31, 48], [29, 46], [28, 44], [26, 42], [24, 40], [22, 38], [20, 38], [18, 40], [15, 38], [12, 42], [9, 39], [5, 38], [1, 38], [-2, 37], [-6, 36]],
  // Africa
  [[-6, 35], [-9, 32], [-11, 30], [-15, 27], [-17, 21], [-17, 16], [-16, 12], [-13, 9], [-8, 5], [-4, 5], [2, 6], [6, 4], [9, 4], [9, -1], [12, -5], [13, -10], [12, -17], [14, -22], [15, -27], [18, -32], [20, -35], [26, -34], [32, -29], [34, -26], [36, -20], [38, -15], [40, -11], [42, -5], [46, -1], [51, 2], [51, 11], [48, 11], [44, 11], [42, 12], [40, 15], [38, 18], [37, 22], [35, 27], [33, 31], [30, 32], [25, 32], [20, 32], [15, 33], [11, 34], [8, 37], [3, 37], [0, 36], [-2, 35]],
  // Asia
  [[30, 36], [34, 36], [36, 34], [40, 31], [43, 30], [46, 29], [49, 30], [51, 28], [54, 27], [57, 26], [59, 25], [62, 25], [66, 25], [68, 24], [70, 23], [72, 20], [74, 15], [76, 10], [78, 8], [80, 8], [80, 12], [84, 18], [88, 22], [91, 22], [93, 20], [95, 16], [97, 15], [99, 10], [101, 7], [103, 2], [104, 2], [105, 9], [107, 11], [109, 14], [108, 18], [106, 20], [109, 21], [111, 21], [113, 22], [116, 23], [118, 25], [120, 28], [121, 31], [122, 32], [121, 35], [122, 37], [122, 39], [124, 40], [126, 40], [128, 38], [130, 36], [132, 34], [135, 34], [137, 35], [139, 37], [140, 39], [141, 41], [141, 44], [142, 46], [142, 50], [141, 53], [140, 56], [138, 59], [136, 61], [133, 63], [130, 65], [127, 68], [124, 71], [120, 73], [115, 73], [110, 74], [105, 76], [100, 77], [95, 76], [90, 75], [85, 74], [80, 73], [75, 72], [70, 72], [67, 69], [62, 69], [57, 69], [52, 68], [47, 68], [42, 68], [38, 66], [34, 64], [31, 61], [29, 58], [26, 57], [24, 55], [22, 53], [20, 51], [18, 49], [16, 47], [14, 45], [12, 44], [10, 43], [8, 42], [6, 40], [4, 38], [2, 37], [0, 36], [5, 37], [10, 37], [15, 38], [20, 38], [25, 37], [30, 36]],
  // Australia
  [[114, -22], [114, -30], [115, -33], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [147, -39], [150, -37], [153, -32], [153, -27], [151, -24], [146, -19], [143, -15], [142, -11], [141, -13], [139, -17], [136, -15], [135, -12], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20], [114, -22]],
];

// ============================================================== layout ======
const MX = 16; // page margin
const COLW = 240; // grid column width
const COLX = [MX, MX + COLW + 10, MX + 2 * (COLW + 10), MX + 3 * (COLW + 10)];

function drawPinDot(x: number, y: number, n: number): void {
  disc(x, y, 9, RED);
  ring(x, y, 9, CREAM);
  const s = String(n);
  const w = textW(s, 1);
  text(s, x - Math.round(w / 2), y - 4, 1, CREAM);
}

function drawStory(col: number, y: number, st: Story): number {
  const x = COLX[col];
  const full = (st.pin > 0 ? st.pin + ' ' : '') + st.head + ' (' + st.src + ')';
  const lines = wrap(full, COLW, 2);
  if (lines.length > 2) console.error('OVERFLOW 3+ lines: ' + full);
  let ly = y;
  for (const ln of lines.slice(0, 2)) {
    text(ln, x, ly, 2, INK);
    ly += 14;
  }
  // overdraw the pin number in red on the first line
  if (st.pin > 0) {
    const d = String(st.pin);
    for (let k = 0; k < d.length; k++) drawChar(d[k], x + k * 12, y, 2, RED);
  }
  return y + lines.slice(0, 2).length * 14 + 4;
}

function drawHeroPanel(x: number, y: number, w: number, h: number, idx: number): void {
  const st = HERO[idx];
  rect(x, y, w, h, CREAM);
  rect(x, y, w, 3, RED);
  if (idx === 0) {
    // Shenzhen skyline + summit table with three leaders and three flags
    rect(x, y + 3, w, 74, SKY);
    const base = y + 77;
    const bw = [26, 40, 30, 48, 34, 24, 44, 30, 36, 28, 42, 26];
    let bx = x + 10;
    for (const bwid of bw) {
      const bh = 26 + ((bwid * 7) % 34);
      rect(bx, base - bh, bwid, bh, [58, 74, 96]);
      bx += bwid + 6;
    }
    rect(x, base, w, 3, [58, 74, 96]);
    // table
    rect(x + 30, y + 118, w - 60, 8, [122, 84, 52]);
    rect(x + 44, y + 126, 10, 22, [122, 84, 52]);
    rect(x + w - 54, y + 126, 10, 22, [122, 84, 52]);
    // three leaders: head + shoulders
    const skins: RGB[] = [[232, 190, 150], [240, 200, 160], [225, 185, 145]];
    const suits: RGB[] = [[30, 50, 90], [140, 20, 20], [40, 40, 40]];
    const cx = [x + 90, x + Math.round(w / 2), x + w - 90];
    for (let i = 0; i < 3; i++) {
      disc(cx[i], y + 96, 13, skins[i]);
      poly([[cx[i] - 20, y + 118], [cx[i] + 20, y + 118], [cx[i] + 12, y + 104], [cx[i] - 12, y + 104]], suits[i]);
    }
    // flags on the table: US, China, Russia
    const fx = x + Math.round(w / 2) - 45;
    for (let i = 0; i < 3; i++) vline(fx + i * 32 + 8, y + 96, 24, INK);
    rect(fx, y + 84, 16, 12, [178, 34, 52]);
    rect(fx, y + 84, 16, 4, [255, 255, 255]);
    rect(fx + 32, y + 84, 16, 12, [222, 41, 16]);
    disc(fx + 40, y + 90, 2, GOLD);
    rect(fx + 64, y + 84, 16, 4, [255, 255, 255]);
    rect(fx + 64, y + 88, 16, 4, [0, 57, 166]);
    rect(fx + 64, y + 92, 16, 4, [213, 0, 50]);
  } else if (idx === 1) {
    // night sky, missile trail arcing over a border, explosion starburst
    rect(x, y + 3, w, 110, NIGHT);
    for (let i = 0; i < 26; i++) disc(x + 14 + i * 9, y + 18 + ((i * i) >> 5), 1, [200, 210, 230]);
    line(x + 20, y + 20, x + 210, y + 92, [255, 220, 120]);
    line(x + 20, y + 22, x + 210, y + 94, [255, 220, 120]);
    disc(x + 214, y + 96, 5, [255, 220, 120]);
    // starburst
    const ex = x + w - 52, ey = y + 62;
    for (let a = 0; a < 12; a++) {
      const t = (a * Math.PI) / 6;
      line(ex, ey, Math.round(ex + 26 * Math.cos(t)), Math.round(ey + 26 * Math.sin(t)), [255, 180, 60]);
    }
    disc(ex, ey, 12, [255, 200, 80]);
    disc(ex, ey, 6, [255, 240, 180]);
    // border line + labels
    hline(x + 8, y + 108, w - 16, [200, 210, 230]);
    text('UKRAINE', x + 12, y + 96, 1, [200, 210, 230]);
    text('POLAND', x + w - 62, y + 96, 1, [255, 220, 120]);
  } else {
    // COP31: sun + globe + clock in overtime
    rect(x, y + 3, w, 110, [206, 232, 226]);
    disc(x + 52, y + 52, 26, GOLD);
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4;
      line(x + 52 + Math.round(30 * Math.cos(t)), y + 52 + Math.round(30 * Math.sin(t)),
        x + 52 + Math.round(38 * Math.cos(t)), y + 52 + Math.round(38 * Math.sin(t)), GOLD);
    }
    disc(x + w - 62, y + 56, 30, BLUE);
    ring(x + w - 62, y + 56, 30, CREAM);
    hline(x + w - 92, y + 56, 60, CREAM);
    line(x + w - 88, y + 40, x + w - 36, y + 72, CREAM);
    line(x + w - 88, y + 72, x + w - 36, y + 40, CREAM);
    // clock
    disc(x + Math.round(w / 2), y + 56, 20, CREAM);
    ring(x + Math.round(w / 2), y + 56, 20, INK);
    line(x + Math.round(w / 2), y + 56, x + Math.round(w / 2) + 10, y + 48, INK);
    line(x + Math.round(w / 2), y + 56, x + Math.round(w / 2), y + 44, INK);
  }
  // headline block
  const ty = y + 144;
  text(HERO_PLACE[idx], x + 10, ty, 1, RED);
  const srct = 'Source: ' + st.src;
  text(srct, x + w - 10 - textW(srct, 1), ty, 1, SOFT);
  const hs = idx === 0 ? 3 : 2;
  const hpitch = hs === 3 ? 22 : 14;
  const lines = wrap(st.head, w - 20, hs);
  let ly = ty + 13;
  for (const ln of lines.slice(0, 2)) { text(ln, x + 10, ly, hs, INK); ly += hpitch; }
  const sub = wrap(HERO_SUB[idx], w - 20, 2);
  ly += 2;
  for (const ln of sub.slice(0, 2)) { text(ln, x + 10, ly, 2, SOFT); ly += 14; }
  if (st.pin > 0) drawPinDot(x + w - 16, y + h - 12, st.pin);
}

function drawMap(x0: number, y0: number, x1: number, y1: number): void {
  rect(x0, y0, x1 - x0, y1 - y0, [226, 236, 242]);
  const proj = (lon: number, lat: number): [number, number] => [
    Math.round(x0 + ((lon + 170) / 360) * (x1 - x0)),
    Math.round(y0 + ((75 - lat) / 130) * (y1 - y0)),
  ];
  for (const cont of LAND) {
    poly(cont.map(([lo, la]) => proj(lo, la)), [176, 190, 170]);
  }
  for (const [n, lo, la] of PINS) {
    const [pxx, pyy] = proj(lo, la);
    drawPinDot(pxx, pyy, n);
  }
}

function main(): void {
  // ---------------------------------------------------------- masthead ----
  hline(MX, 10, W - 2 * MX, INK);
  rect(MX, 12, W - 2 * MX, 2, RED);
  text('THE WORLD TODAY', MX, 24, 6, INK);
  text('SATURDAY', 867, 28, 3, RED);
  text('21 NOVEMBER 2026', 628, 54, 4, INK);
  hline(MX, 100, W - 2 * MX, INK);
  text('51 SOURCED STORIES  •  22 PLACES  •  ONE DAY', MX, 106, 2, SOFT);
  text('EVERY STORY LABELLED WITH ITS SOURCE', 566, 106, 2, SOFT);

  // -------------------------------------------------------------- hero ----
  const hy = 128, hh = 232;
  drawHeroPanel(MX, hy, 484, hh, 0);
  drawHeroPanel(MX + 500, hy, 248, hh, 1);
  drawHeroPanel(MX + 764, hy, 228, hh, 2);

  // -------------------------------------------------------------- grid ----
  const gy = 368;
  hline(MX, gy - 6, W - 2 * MX, INK);
  text('CONFLICT', COLX[0], gy + 6, 2, RED);
  text('POLITICS', COLX[1], gy + 6, 2, TEAL);
  text('MARKETS & TECH', COLX[2], gy + 6, 2, BLUE);
  text('SCIENCE & SPORT', COLX[3], gy + 6, 2, GOLD);
  for (const cx of COLX) hline(cx, gy + 26, COLW, RULE);
  let ys = [gy + 34, gy + 34, gy + 34, gy + 34];
  for (const st of COLA) ys[0] = drawStory(0, ys[0], st);
  for (const st of COLB) ys[1] = drawStory(1, ys[1], st);
  for (const st of COLC) ys[2] = drawStory(2, ys[2], st);
  for (const st of COLD) ys[3] = drawStory(3, ys[3], st);
  console.error('COLUMN END Y: ' + ys.join(', '));

  // --------------------------------------------------------------- map ----
  const my = 792;
  hline(MX, my - 6, W - 2 * MX, INK);
  text('WHERE IT HAPPENED - 22 PLACES, NUMBERED TO MATCH THE STORIES', MX, my + 2, 2, INK);
  drawMap(MX, my + 24, W - MX, my + 118);
  text('PIN NUMBERS MATCH THE RED NUMBERS IN THE STORIES ABOVE', MX, my + 122, 1, SOFT);

  // ---------------------------------------------------------- timeline ----
  const ty = 922;
  hline(MX, ty, W - 2 * MX, INK);
  text('THE DAY IN UTC', MX, ty + 6, 2, RED);
  const tx0 = 150, tx1 = W - MX;
  hline(tx0, ty + 36, tx1 - tx0, RULE);
  for (let h = 0; h <= 24; h += 6) {
    const x = Math.round(tx0 + (h / 24) * (tx1 - tx0));
    vline(x, ty + 32, 8, INK);
    text(String(h).padStart(2, '0') + ':00', x - 15, ty + 24, 1, SOFT);
  }
  TIMELINE.forEach(([h, label], i) => {
    const x = Math.round(tx0 + (h / 24) * (tx1 - tx0));
    disc(x, ty + 36, 4, RED);
    const above = i % 2 === 0;
    text(label, Math.max(MX, Math.min(x - 10, W - MX - textW(label, 1))), above ? ty + 14 : ty + 54, 1, INK);
  });

  // ------------------------------------------------------------ footer ----
  hline(MX, 994, W - 2 * MX, INK);
  center('SATURDAY 21 NOVEMBER 2026  •  EVERY STORY ABOVE HAPPENED OR WAS FIRST REPORTED ON 21 NOVEMBER 2026', 1000, 1, SOFT);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
