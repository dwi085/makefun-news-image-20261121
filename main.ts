// The World Today — 21 November 2026 (round 2)
// One image summing up the world's news of Saturday 21 November 2026.
// Node 22, standard library only, no network. Writes /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR/entry.png). Deterministic: two runs are
// byte-identical. All drawing is done from scratch in this file.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------- font --
// Hand-drawn 5x7 bitmap font, capitals + digits + punctuation only.
// Each glyph is 7 rows of 5 bits ("1" = ink). All-caps newspaper style.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"], // bullet dot
};
// One glyph cell is 5 wide + 1 spacing, 7 tall.
const CHAR_W = 6;
const CHAR_H = 7;

// ----------------------------------------------------------------- png --
// Minimal deterministic PNG encoder: 8-bit RGB, no interlace, one IDAT.
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  crc.copy(out, 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines: filter byte 0 + RGB rows.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------- canvas --
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [246, 241, 231]; // warm newsprint
const INK: [number, number, number] = [22, 22, 22];
const NAVY: [number, number, number] = [22, 35, 63];
const RED: [number, number, number] = [179, 38, 30];
const WHITE: [number, number, number] = [255, 253, 247];
const GREY: [number, number, number] = [110, 108, 100];
const LAND: [number, number, number] = [168, 186, 205];
const SEA: [number, number, number] = [232, 238, 244];

const px = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPx(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: [number, number, number], t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: [number, number, number], t = 1): void {
  fillRect(x, y, t, h, c);
}

// Filled circle.
function disc(cx: number, cy: number, r: number, c: [number, number, number]): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

// Scanline polygon fill. pts are [x, y] in canvas pixels.
function fillPoly(pts: Array<[number, number]>, c: [number, number, number]): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, c);
    }
  }
}

// ------------------------------------------------------------ text -----
function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * CHAR_W * scale - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if (bits[col] === "1") fillRect(x + col * scale, y + row * scale, scale, scale, c);
    }
  }
}

// Draws one line, returns its pixel width. The font is capitals-only,
// so all text is upper-cased here to keep mixed-case copy legible.
function drawText(s: string, x: number, y: number, scale: number, c: [number, number, number]): number {
  s = s.toUpperCase();
  let cx = x;
  for (const ch of s) {
    drawChar(ch, cx, y, scale, c);
    cx += CHAR_W * scale;
  }
  return cx - x - scale;
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: [number, number, number]): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Greedy word wrap to lines no wider than maxW px.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text in a box; returns the y just below the last line.
function drawPara(s: string, x: number, y: number, scale: number, maxW: number, c: [number, number, number], leading?: number): number {
  const lh = leading ?? 7 * scale + 2;
  const lines = wrap(s, scale, maxW);
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, scale, c);
    yy += lh;
  }
  return yy;
}

// ---------------------------------------------------------------- data --
// 55 stories, all events or first reports of Saturday 21 November 2026,
// each with the outlet or institution that reported it. Beats:
// C conflict, P politics, M markets, L climate, H health, S science,
// T sport, W world. Colours keyed in the footer legend.
const BEATS: Record<string, [number, number, number]> = {
  C: [179, 38, 30],
  P: [31, 78, 121],
  M: [46, 125, 50],
  L: [14, 124, 123],
  H: [142, 36, 170],
  S: [93, 64, 55],
  T: [230, 81, 0],
  W: [97, 97, 97],
};

type Lead = { head: string; body: string; src: string };
const LEADS: Lead[] = [
  {
    head: "MISSILES LAND IN POLAND",
    body: "Russia fires 400+ drones and 110 missiles at Ukraine. Two Kh-101s and a jet drone crash in south-east Poland. Tusk: provocation; NATO: grave violation.",
    src: "AP - BBC",
  },
  {
    head: "AI ROUT PUSHES S&P AND DOW INTO CORRECTION",
    body: "Wall Street slides as doubts about AI spending grow. Nasdaq falls 5.3%, wiping out all its 2026 gains. Nikkei drops 5.1%. Nvidia sinks 14% as the SEC opens a probe into its books.",
    src: "FT - WSJ",
  },
  {
    head: "ICJ FINDS MYANMAR GUILTY OF GENOCIDE",
    body: "The world court rules Myanmar responsible for genocide against the Rohingya. Survivors in Bangladesh welcome the verdict and say they want to go home.",
    src: "ICJ - REUTERS",
  },
];

type Story = { beat: string; head: string; body: string; src: string };
const STORIES: Story[] = [
  { beat: "C", head: "HOUTHIS FIRE ON RIYADH AGAIN", body: "Coalition stops three missiles on a third night of attacks.", src: "AL JAZEERA" },
  { beat: "C", head: "ISRAELI STRIKES KILL IN GAZA", body: "Strikes kill Palestinians; violence flares in the West Bank.", src: "ONE TURN" },
  { beat: "C", head: "HAITI BLAST KILLS SALVADORAN TROOPS", body: "Soldiers die in explosives attack on the Port-au-Prince mission.", src: "ONE TURN" },
  { beat: "C", head: "IRAQ POLICE ENTER JURF AL-SAKHAR", body: "Federal police move in under a new security deal.", src: "IQMIA" },
  { beat: "P", head: "UK AND EU SIGN BIG POST-BREXIT DEALS", body: "Food, carbon, youth pacts for 100,000 young Britons.", src: "GUARDIAN" },
  { beat: "P", head: "TRUMP DEFENDS TIES TO PUTIN AND XI", body: "Trump calls Putin a friend; Zelenskyy calls Putin a killer.", src: "BBC" },
  { beat: "C", head: "POLAND SEEKS MORE NATO JETS", body: "Warsaw invokes Article 4, seeks AWACS and F-35s.", src: "SOFX" },
  { beat: "P", head: "SPAIN HEADS TO 29 NOVEMBER VOTE", body: "Conservatives gain as the election campaign opens in Madrid.", src: "ONE TURN" },
  { beat: "P", head: "ANC FIGHTS TO HOLD ITS CITIES", body: "Worst result since 1994 at 31%; DA takes Johannesburg and Pretoria.", src: "BBC" },
  { beat: "W", head: "MLAMBO-NGCUKA DIES AT 71", body: "South Africa's first woman deputy president dies.", src: "REUTERS" },
  { beat: "P", head: "NEPAL'S NEW PM FACES INDIA TEST", body: "Balendra Shah makes his first visit to New Delhi.", src: "BBC" },
  { beat: "C", head: "DENMARK: RUSSIA PLOTTED KILLING", body: "Copenhagen says Moscow plotted to kill a US-Ukrainian rapper.", src: "BBC" },
  { beat: "W", head: "FRENCH POLICE GUILTY OVER BEATING", body: "Officers sentenced for the assault on music producer Michel Zecler.", src: "BBC" },
  { beat: "P", head: "HEGSETH CURTAILS CANADA DEFENCE TIES", body: "US defence secretary scales back relations with Ottawa.", src: "WASH. POST" },
  { beat: "P", head: "MAMDANI: CLOSE RIKERS BY 2032", body: "New York's mayor-elect sets a date to shut the jail.", src: "BBC" },
  { beat: "L", head: "COP31 RUNS INTO OVERTIME", body: "Draft drops fossil fuels; finance stalls in Antalya.", src: "PANA" },
  { beat: "H", head: "CANCER PILL BREAKTHROUGH", body: "Pill daraxonrasib makes tumours undetectable in 1 in 12.", src: "ONE TURN" },
  { beat: "H", head: "US LOSES MEASLES-FREE TAG", body: "America is no longer certified as having eliminated measles.", src: "ONE TURN" },
  { beat: "S", head: "NASA HALTS MARS SCIENCE", body: "Hardware troubles pause Perseverance and Mars Odyssey work.", src: "IQMIA" },
  { beat: "C", head: "ISRAEL PLANS WEST BANK CITY", body: "Plan advances for a new city of 200,000 settlers.", src: "IQMIA" },
  { beat: "S", head: "RIEMANN PROOF CLAIMED", body: "Anthropic researcher says AI helped prove the great conjecture.", src: "HORIZON" },
  { beat: "W", head: "FBI CRIME DATABASE HACKED", body: "FBI and Agriculture Dept hit as US outages spread.", src: "HORIZON" },
  { beat: "M", head: "BAYER PAYS $7.25BN OVER ROUNDUP", body: "US judge approves the payout to end weedkiller claims.", src: "HORIZON" },
  { beat: "M", head: "BITCOIN SLIDES TOWARD $62,000", body: "Crypto liquidations pass $2bn in the market sell-off.", src: "IQMIA" },
  { beat: "W", head: "19 YEARS OVER PANNUN PLOT", body: "Indian man jailed in the US over a murder-for-hire case.", src: "IQMIA" },
  { beat: "W", head: "PALISADES FIRE ARSONIST GUILTY", body: "Los Angeles man convicted of starting the deadly blaze.", src: "BBC" },
  { beat: "W", head: "PERU SHAKEN BY 6.9 QUAKE", body: "Strong tremor rattles the Andes.", src: "HORIZON" },
  { beat: "W", head: "BASRA PLANT FIRE KILLS FOUR", body: "Blaze at an Iraqi power plant kills at least four.", src: "HORIZON" },
  { beat: "L", head: "INDONESIA HIT BY FOREST FIRES", body: "Massive blazes spread across the archipelago.", src: "HORIZON" },
  { beat: "L", head: "AKVAN'S RAIN LINGERS OVER INDIA", body: "Heavy rain soaks Odisha and Bengal a day after landfall.", src: "IMD" },
  { beat: "P", head: "GEN Z PROTESTS SPREAD IN EUROPE", body: "Youth marches reach 25 countries, from Berlin outward.", src: "ONE TURN" },
  { beat: "W", head: "FIONA THE HIPPO DIES IN CINCINNATI", body: "Beloved young hippo dies after eating a visitor's hat.", src: "CINCINNATI ZOO" },
  { beat: "W", head: "600 WOMEN KILLED IN SOUTH AFRICA", body: "Femicide toll over three months shocks the nation.", src: "BBC" },
  { beat: "W", head: "US RELEASES MORE UFO FOOTAGE", body: "Newly declassified videos were filmed in the Middle East.", src: "BBC" },
  { beat: "C", head: "LIFE UNDER SIEGE IN YEMEN", body: "A mother tells her son the shelling is just fireworks.", src: "BBC" },
  { beat: "M", head: "ANTHROPIC SHARES SLIDE 9%", body: "Record $81bn IPO fades as AI doubts grow on Wall Street.", src: "WSJ" },
  { beat: "M", head: "NVIDIA FACES SEC ACCOUNTING PROBE", body: "Regulator examines the chipmaker's books after Huang resigns.", src: "FT" },
  { beat: "M", head: "GOLD SLIDES 4.6% TO $3,515", body: "Bullion's worst week as the Fed may raise rates again.", src: "HORIZON" },
  { beat: "M", head: "BRENT CRUDE EASES TO $89.95", body: "Oil slips 2.2% as the market rout spreads.", src: "HORIZON" },
  { beat: "M", head: "LEAPMOTOR PROFITS PLUNGE 73%", body: "EV startup's Q3 profit falls despite record deliveries.", src: "CHINA BIZ BUZZ" },
  { beat: "W", head: "78 RANSOMWARE CLAIMS IN 48 HOURS", body: "Attacks recorded worldwide, RansomLook data shows.", src: "HORIZON" },
  { beat: "T", head: "ALCARAZ STAYS PERFECT IN TURIN", body: "Spaniard beats Cobolli to stay unbeaten at the ATP Finals.", src: "ONE TURN" },
  { beat: "T", head: "A LIM KIM LEADS AFTER AN ACE", body: "Ace on the 16th puts the Korean three clear in Naples.", src: "ONE TURN" },
  { beat: "T", head: "CHOI ADVANCES IN SEOUL", body: "Korean star through early short-track rounds in Seoul.", src: "ONE TURN" },
  { beat: "T", head: "SHIMADA LEADS FINLANDIA TROPHY", body: "Japan's Mao Shimada tops the short program in Espoo.", src: "ONE TURN" },
  { beat: "T", head: "SPIRIT REACH NWSL FINAL", body: "Washington Spirit advance to the championship match.", src: "ONE TURN" },
  { beat: "T", head: "WREXHAM WIN 2-0 AT BLACKBURN", body: "Third straight Championship win for the Red Dragons.", src: "BBC" },
  { beat: "T", head: "CLEMSON HOLDS OFF DUKE 20-10", body: "Tigers win in Durham; Sheppard runs for 116 yards.", src: "BVM SPORTS" },
  { beat: "S", head: "FISH FOUND TO LIVE PAST 100", body: "Radiocarbon dating shows a blue sucker over a century old.", src: "ONE TURN" },
  { beat: "S", head: "LASER FLASHES BEAT ATOM SCALE", body: "X-ray laser makes bursts shorter than the gaps between atoms.", src: "ONE TURN" },
  { beat: "S", head: "SUPERMOUNTAINS UNDER ANTARCTICA", body: "Ancient buried ranges mapped beneath the ice sheet.", src: "ONE TURN" },
  { beat: "S", head: "CURIOSITY SPOTS MARTIAN CLOUDS", body: "Rover captures drifting twilight clouds in Gale Crater.", src: "ONE TURN" },
];

// 24 map pins: [label-or-null, lon, lat]. Labels drawn for the flagged few.
const PINS: Array<[string | null, number, number]> = [
  ["KYIV", 30.5, 50.4],
  ["WARSAW", 21.0, 52.2],
  [null, 4.3, 52.1],
  ["NEW YORK", -74.0, 40.7],
  [null, -0.1, 51.5],
  [null, 4.4, 50.8],
  ["ANTALYA", 30.7, 36.9],
  ["GAZA", 34.5, 31.5],
  [null, -72.3, 18.5],
  [null, 46.7, 24.7],
  [null, 44.4, 33.3],
  [null, -3.7, 40.4],
  [null, 18.4, -33.9],
  [null, 85.3, 27.7],
  [null, 96.2, 19.8],
  [null, 92.0, 21.4],
  ["LIMA", -77.0, -12.0],
  [null, 47.8, 30.5],
  ["JAKARTA", 106.8, -6.2],
  [null, 84.9, 19.3],
  [null, 7.7, 45.1],
  ["SEOUL", 127.0, 37.5],
  [null, -77.0, 38.9],
  [null, 28.0, -26.2],
];

// The day in time, UTC. All times are publication times of the cited report.
const TIMELINE: Array<[string, string, string]> = [
  ["00:48", "ANC FIGHTS TO HOLD SOUTH AFRICA'S CITIES", "BBC"],
  ["03:46", "AP: RUSSIAN MISSILE DOWN IN POLAND", "AP"],
  ["04:01", "WREXHAM WIN 2-0 AT BLACKBURN", "BBC SPORT"],
  ["04:52", "NATO CHIEF: GRAVE VIOLATION IN POLAND", "NATO"],
  ["05:44", "MLAMBO-NGCUKA DIES AT 71", "REUTERS"],
  ["12:00", "ANC TURNS TO SMALLER PARTIES FOR CITY DEALS", "BBC"],
];

// Friday's market close, as reported on 21 November.
const TICKER_A = "MARKETS - FRIDAY CLOSE:  S&P 500 6,910.39 -3.70%  *  NASDAQ 22,617.73 -5.28%  *  NIKKEI 56,436.65 -5.06%  *  FTSE 100 10,346.34 -1.02%  *  DAX 24,802.78 -2.60%";
const TICKER_B = "CAC 40 7,927.75 -1.89%  *  HANG SENG 22,410.8 -1.89%  *  BRENT $89.95 -2.21%  *  GOLD $3,515.40 -4.62%  *  NAT GAS $3.75 +14.69%  *  BITCOIN ABOUT $62,000";

// ----------------------------------------------------------------- map --
// Simplified continent outlines as [lon, lat] points (equirectangular).
const CONTINENTS: Array<Array<[number, number]>> = [
  [ // North America
    [-168, 66], [-150, 70], [-135, 69], [-125, 71], [-115, 68], [-105, 68], [-95, 69],
    [-85, 66], [-80, 62], [-75, 62], [-65, 60], [-60, 55], [-55, 52], [-60, 47],
    [-65, 44], [-70, 42], [-74, 39], [-76, 35], [-80, 32], [-81, 26], [-84, 30],
    [-89, 29], [-90, 21], [-94, 18], [-97, 16], [-93, 15], [-88, 14], [-84, 12],
    [-80, 9], [-79, 9], [-83, 10], [-87, 13], [-91, 14], [-95, 16], [-100, 17],
    [-105, 20], [-110, 23], [-114, 28], [-117, 32], [-122, 37], [-124, 42], [-125, 48],
    [-130, 54], [-135, 58], [-145, 60], [-155, 58], [-162, 58],
  ],
  [ // South America
    [-79, 9], [-77, 7], [-72, 11], [-68, 11], [-62, 9], [-55, 6], [-52, 4],
    [-50, 0], [-44, -3], [-38, -5], [-35, -8], [-37, -13], [-40, -20], [-48, -26],
    [-52, -32], [-58, -38], [-65, -41], [-68, -47], [-70, -52], [-73, -54], [-72, -48],
    [-73, -40], [-72, -32], [-70, -23], [-70, -18], [-76, -14], [-79, -8], [-81, -4],
    [-80, 1], [-79, 5],
  ],
  [ // Africa
    [-17, 15], [-16, 20], [-12, 27], [-10, 31], [-6, 35], [-2, 35], [3, 37],
    [10, 37], [15, 32], [20, 32], [25, 32], [30, 31], [33, 27], [36, 22],
    [38, 18], [40, 15], [43, 12], [46, 11], [51, 11], [51, 5], [48, 0],
    [42, -5], [40, -10], [38, -15], [35, -20], [33, -26], [31, -29], [27, -33],
    [20, -35], [16, -32], [14, -27], [12, -20], [12, -15], [13, -10], [9, -2],
    [9, 4], [4, 6], [-8, 4], [-13, 8], [-16, 12],
  ],
  [ // Europe
    [-10, 37], [-9, 39], [-9, 43], [-4, 44], [-2, 47], [-4, 48], [-2, 50],
    [0, 51], [2, 53], [5, 53], [8, 55], [8, 57], [10, 59], [12, 58], [18, 56],
    [21, 55], [24, 58], [26, 59], [28, 60], [30, 62], [28, 65], [24, 66],
    [20, 68], [18, 69], [15, 68], [12, 65], [10, 62], [6, 58], [5, 60],
    [5, 58], [0, 55], [-2, 52], [-5, 50], [-8, 48], [-9, 43],
  ],
  [ // Asia
    [30, 62], [35, 65], [40, 68], [50, 69], [60, 69], [70, 72], [80, 73],
    [90, 75], [100, 77], [110, 74], [120, 73], [130, 72], [140, 72], [150, 70],
    [160, 70], [170, 67], [178, 65], [178, 62], [170, 60], [162, 56], [160, 53],
    [156, 51], [150, 48], [142, 50], [140, 45], [138, 40], [135, 35], [130, 33],
    [127, 35], [126, 38], [122, 39], [120, 35], [122, 30], [120, 25], [115, 22],
    [110, 20], [108, 15], [105, 10], [103, 8], [100, 7], [98, 10], [97, 15],
    [94, 17], [92, 21], [89, 22], [86, 20], [83, 18], [80, 15], [77, 8],
    [76, 10], [74, 15], [72, 20], [70, 22], [66, 25], [62, 25], [58, 26],
    [55, 27], [52, 28], [50, 29], [48, 30], [44, 29], [42, 31], [39, 32],
    [36, 36], [34, 36], [32, 38], [30, 40], [28, 42], [30, 45], [32, 48],
    [35, 52], [38, 55], [40, 58], [35, 60], [32, 62],
  ],
  [ // Australia
    [113, -22], [114, -28], [115, -33], [118, -35], [124, -33], [129, -32],
    [132, -32], [135, -35], [137, -38], [140, -38], [145, -38], [149, -37],
    [150, -35], [153, -32], [153, -27], [150, -23], [147, -19], [144, -15],
    [142, -11], [140, -17], [137, -16], [135, -14], [132, -12], [130, -13],
    [127, -14], [124, -16], [121, -19], [117, -20],
  ],
  [ // Greenland
    [-58, 64], [-55, 68], [-52, 71], [-48, 74], [-42, 76], [-35, 76], [-30, 74],
    [-25, 71], [-22, 70], [-28, 68], [-35, 66], [-42, 64], [-48, 61], [-53, 60],
    [-56, 61],
  ],
  [ // United Kingdom
    [-5, 50], [-3, 53], [-5, 56], [-4, 58], [-2, 57], [0, 53], [1, 51], [-2, 50],
  ],
  [ // Japan
    [130, 31], [131, 33], [133, 34], [135, 34], [137, 35], [139, 36], [140, 38],
    [141, 40], [141, 42], [142, 44], [144, 44], [142, 42], [141, 39], [139, 36],
    [137, 34], [134, 34], [132, 33],
  ],
  [ // Borneo
    [109, 1], [112, 3], [116, 4], [118, 1], [117, -3], [114, -4], [110, -3],
  ],
  [ // Sumatra
    [95, 5], [98, 3], [101, 0], [104, -3], [106, -5], [103, -4], [100, 0], [96, 4],
  ],
  [ // New Guinea
    [131, -1], [134, -2], [138, -4], [141, -5], [141, -8], [137, -7], [133, -4],
  ],
  [ // Java
    [105, -6], [108, -7], [112, -7], [114, -8], [111, -8], [107, -7],
  ],
  [ // New Zealand
    [167, -45], [169, -43], [172, -41], [174, -39], [176, -38], [178, -38],
    [176, -40], [174, -41], [172, -43], [169, -45], [167, -46],
  ],
  [ // Madagascar
    [44, -16], [47, -15], [50, -16], [49, -20], [47, -25], [44, -25], [43, -20],
  ],
];

// Map frame (canvas px) and equirectangular projection, lat 85..-60.
const MAP = { x: 520, y: 866, w: 488, h: 118 };
function project(lon: number, lat: number): [number, number] {
  return [
    MAP.x + ((lon + 180) / 360) * MAP.w,
    MAP.y + ((85 - lat) / 145) * MAP.h,
  ];
}

// ---------------------------------------------------------- composition --
// Fits body + " - SRC" into at most maxLines wrapped lines, trimming
// words off the end of the body (never the source) when it runs long.
function fitDetail(body: string, src: string, maxW: number, maxLines: number): string[] {
  const suffix = " - " + src;
  let text = body;
  for (;;) {
    const lines = wrap(text + suffix, 1, maxW);
    if (lines.length <= maxLines) return lines;
    const words = text.split(" ");
    if (words.length <= 1) return lines.slice(0, maxLines);
    words.pop();
    text = words.join(" ");
  }
}

// ------------------------------------------------------------ masthead --
fillRect(0, 0, W, 88, NAVY);
drawText("THE WORLD TODAY", 16, 12, 6, WHITE);
drawText("SATURDAY 21 NOVEMBER 2026", 16, 60, 2, WHITE);
drawText("55 STORIES * 24 PLACES", 1008 - textWidth("55 STORIES * 24 PLACES", 2), 16, 2, WHITE);
drawText("DRAWN, NOT PHOTOGRAPHED", 1008 - textWidth("DRAWN, NOT PHOTOGRAPHED", 1), 44, 1, WHITE);
drawText("ONE DAY * ONE PICTURE", 1008 - textWidth("ONE DAY * ONE PICTURE", 1), 58, 1, WHITE);
fillRect(0, 88, W, 2, RED);

// -------------------------------------------------------------- ticker --
fillRect(0, 90, W, 26, [26, 26, 26]);
drawText(TICKER_A, 16, 93, 1, WHITE);
drawText(TICKER_B, 16, 104, 1, WHITE);

// --------------------------------------------------------------- leads --
const LEAD_X = [16, 351, 686];
const LEAD_W = 322;
LEADS.forEach((L, i) => {
  const x = LEAD_X[i];
  const y = 120;
  fillRect(x, y, LEAD_W, 144, WHITE);
  hline(x, y, LEAD_W, NAVY, 2);
  hline(x, y + 142, LEAD_W, NAVY, 2);
  vline(x, y, 144, NAVY, 2);
  vline(x + LEAD_W - 2, y, 144, NAVY, 2);
  const hl = wrap(L.head, 3, LEAD_W - 24);
  let hy = y + 10;
  for (const ln of hl.slice(0, 3)) {
    drawText(ln, x + 12, hy, 3, NAVY);
    hy += 22;
  }
  fillRect(x + 12, y + 80, 48, 3, RED);
  const bl = wrap(L.body, 1, LEAD_W - 24);
  let by = y + 90;
  for (const ln of bl.slice(0, 4)) {
    drawText(ln, x + 12, by, 1, [60, 60, 60]);
    by += 9;
  }
  drawText(L.src, x + 12, y + 128, 1, RED);
});
fillRect(0, 266, W, 2, NAVY);

// ---------------------------------------------------------------- grid --
const GRID_TOP = 268;
const ROW_H = 44;
const COL_X = [16, 267, 518, 769];
const COL_W = 239;
for (let i = 0; i < STORIES.length; i++) {
  const s = STORIES[i];
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = COL_X[col];
  const y = GRID_TOP + row * ROW_H;
  fillRect(x, y + 2, 7, 7, BEATS[s.beat]);
  const hl = wrap(s.head, 2, COL_W - 11);
  drawText(hl[0] ?? "", x + 11, y, 2, INK);
  if (hl[1]) drawText(hl[1], x + 11, y + 14, 2, INK);
  const dl = fitDetail(s.body, s.src, COL_W - 11, 2);
  drawText(dl[0] ?? "", x + 11, y + 28, 1, [70, 70, 70]);
  if (dl[1]) drawText(dl[1], x + 11, y + 36, 1, [70, 70, 70]);
  if (row < 12) hline(x, y + ROW_H - 2, COL_W, [222, 216, 203]);
}
fillRect(0, 838, W, 2, NAVY);

// ------------------------------------------------------- timeline + map --
drawText("THE DAY IN TIME - UTC", 16, 848, 2, NAVY);
TIMELINE.forEach(([t, ev, src], i) => {
  const y = 874 + i * 19;
  drawText(t, 16, y, 1, RED);
  drawText(ev, 56, y, 1, INK);
  drawText(src, 504 - textWidth(src, 1), y, 1, GREY);
});

drawText("THE DAY IN PLACES - 24 PINS", 520, 848, 2, NAVY);
fillRect(MAP.x, MAP.y, MAP.w, MAP.h, SEA);
for (let lon = -150; lon <= 150; lon += 30) {
  const [gx] = project(lon, 85);
  vline(Math.round(gx), MAP.y, MAP.h, [205, 214, 224]);
}
for (let lat = 60; lat >= -30; lat -= 30) {
  const [, gy] = project(-180, lat);
  hline(MAP.x, Math.round(gy), MAP.w, [205, 214, 224]);
}
for (const poly of CONTINENTS) {
  fillPoly(poly.map(([lo, la]) => project(lo, la)), LAND);
}
hline(MAP.x, MAP.y, MAP.w, INK);
hline(MAP.x, MAP.y + MAP.h - 1, MAP.w, INK);
vline(MAP.x, MAP.y, MAP.h, INK);
vline(MAP.x + MAP.w - 1, MAP.y, MAP.h, INK);
const LABEL_OFF: Record<string, [number, number]> = {
  KYIV: [8, -9],
  WARSAW: [-46, -14],
  "NEW YORK": [8, -9],
  ANTALYA: [-52, 2],
  GAZA: [-4, 8],
  LIMA: [8, -9],
  JAKARTA: [-50, -9],
  SEOUL: [-38, -9],
};
for (const [name, lon, lat] of PINS) {
  const [px2, py2] = project(lon, lat);
  const cx = Math.round(px2);
  const cy = Math.round(py2);
  disc(cx, cy, 5, WHITE);
  disc(cx, cy, 3, RED);
  if (name) {
    const [dx, dy] = LABEL_OFF[name] ?? [8, -9];
    drawText(name, cx + dx, cy + dy, 1, INK);
  }
}
vline(512, 844, 144, [200, 195, 185]);

// -------------------------------------------------------------- footer --
hline(16, 992, 992, [200, 195, 185]);
const LEGEND: Array<[string, [number, number, number]]> = [
  ["CONFLICT", BEATS.C],
  ["POLITICS", BEATS.P],
  ["MARKETS", BEATS.M],
  ["CLIMATE", BEATS.L],
  ["HEALTH", BEATS.H],
  ["SCIENCE", BEATS.S],
  ["SPORT", BEATS.T],
  ["WORLD", BEATS.W],
];
let lx = 16;
for (const [name, col] of LEGEND) {
  fillRect(lx, 999, 6, 6, col);
  lx += 9;
  drawText(name, lx, 998, 1, INK);
  lx += textWidth(name, 1) + 12;
}
drawText(
  "SOURCES: AP * BBC * REUTERS * FT * WSJ * GUARDIAN * AL JAZEERA * PANA * WASHINGTON POST * SOFX * ISW * UNFCCC * IMD * ONE TURN * HORIZON * IQMIA * BVM SPORTS",
  16,
  1010,
  1,
  GREY,
);

// ---------------------------------------------------------------- write --
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + "/entry.png", encodePNG(W, H, px));
