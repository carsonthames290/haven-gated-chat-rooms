import { Chess, type Square } from "chess.js";

export type ChallengeKind = "answer" | "chess" | "video" | "slide" | "sort" | "memory" | "maze" | "lights";
export type Challenge = { key: string; title: string; emoji: string; kind: ChallengeKind; prompt: string; answer?: string };
export const challenges: Challenge[] = [
  { key: "riddle", title: "The Sphinx Is Disappointed", emoji: "🗿", kind: "answer", prompt: "What has keys but cannot open a single door?", answer: "piano" },
  { key: "banana", title: "Banana Accounting", emoji: "🍌", kind: "answer", prompt: "You have 17 bananas. A suspicious monkey takes 8. How many remain?", answer: "9" },
  { key: "sequence", title: "Number Goblin", emoji: "👺", kind: "answer", prompt: "The goblin demands the next number: 2, 6, 12, 20, 30, ?", answer: "42" },
  { key: "algebra", title: "Find the Missing X", emoji: "🔎", kind: "answer", prompt: "X has escaped again. Solve 3x + 7 = 28.", answer: "7" },
  { key: "binary", title: "Speak Toaster", emoji: "🤖", kind: "answer", prompt: "Your toaster speaks binary. Convert 101101 to decimal.", answer: "45" },
  { key: "roman", title: "Roman Tax Office", emoji: "🏛️", kind: "answer", prompt: "The emperor's invoice says XLIV. What is that in decimal?", answer: "44" },
  { key: "caesar", title: "Caesar's Group Chat", emoji: "📜", kind: "answer", prompt: "Decode KHOOR by moving every letter three places backward.", answer: "hello" },
  { key: "anagram", title: "Scrambled Breakfast", emoji: "🥚", kind: "answer", prompt: "Unscramble LISTEN into a word meaning quiet.", answer: "silent" },
  { key: "logic", title: "Sock Goblin Insurance", emoji: "🧦", kind: "answer", prompt: "A drawer contains red and blue socks. Without looking, how many must you take to guarantee a matching pair?", answer: "3" },
  { key: "fraction", title: "Pizza Court", emoji: "🍕", kind: "answer", prompt: "The judge demands a fraction: 1/2 + 1/3 = ? Use a/b format.", answer: "5/6" },
  { key: "prime", title: "Prime Time Detention", emoji: "📺", kind: "answer", prompt: "Which is prime: 21, 27, 29, or 33?", answer: "29" },
  { key: "clock", title: "Late for Absolutely Nothing", emoji: "⏰", kind: "answer", prompt: "It is 14:35. What time is it 95 minutes later? Use HH:MM.", answer: "16:10" },
  { key: "percentage", title: "Discount on Bad Decisions", emoji: "🏷️", kind: "answer", prompt: "A 120-coin hat is 25% off. What is its final price?", answer: "90" },
  { key: "geometry", title: "Triangle Bureaucracy", emoji: "📐", kind: "answer", prompt: "Two triangle angles are 50 and 60 degrees. Find the third.", answer: "70" },
  { key: "word", title: "Tiny Dictionary Jail", emoji: "📚", kind: "answer", prompt: "What five-letter word becomes shorter when you add two letters?", answer: "short" },
  { key: "reverse", title: "Backwards Banana", emoji: "🙃", kind: "answer", prompt: "Type the word BANANA backward.", answer: "ananab" },
  { key: "typing", title: "Official Goose Apology", emoji: "🪿", kind: "answer", prompt: "Type this exactly: I solemnly apologize to the council of geese.", answer: "I solemnly apologize to the council of geese." },
  { key: "count", title: "Count Your Chickens", emoji: "🐔", kind: "answer", prompt: "Count the chickens: 🐔 🦆 🐔 🐔 🦆 🐔 🦆 🐔 🐔", answer: "6" },
  { key: "chess", title: "Defeat Sir Blunders-a-Lot", emoji: "♟️", kind: "chess", prompt: "Checkmate the bot as White. It loves free pieces and questionable decisions." },
  { key: "video", title: "Extremely Ordinary Math Class", emoji: "🎓", kind: "video", prompt: "Attend all 40 seconds of fractions class. Then answer the exit question." },
  { key: "slide", title: "Tiny Tile Purgatory", emoji: "🧩", kind: "slide", prompt: "Slide adjacent tiles into the empty space. Put 1–8 in order, with the blank last." },
  { key: "sort", title: "Spreadsheet Intern", emoji: "🗂️", kind: "sort", prompt: "Put the numbers in ascending order. The spreadsheet overlord is watching." },
  { key: "memory", title: "Goldfish Certification", emoji: "🐠", kind: "memory", prompt: "Remember the six-symbol sequence, hide it, then repeat it." },
  { key: "maze", title: "Escape the Cheese Office", emoji: "🧀", kind: "maze", prompt: "Get the mouse to the cheese. Walls are not a suggestion." },
  { key: "lights", title: "Turn Off the Drama", emoji: "💡", kind: "lights", prompt: "Switch off every light. Each switch flips itself and its neighboring lights." },
];
export function getChallenge(key: string | null | undefined) { return challenges.find((c) => c.key === key); }
export function seedNumber(id: string) { return [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); }
export function memorySequence(id: string) { let seed = seedNumber(id); return Array.from({ length: 6 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 4; }); }
export function toggleLights(board: number[], index: number) {
  return board.map((value, i) => Math.abs(Math.floor(i / 3) - Math.floor(index / 3)) + Math.abs(i % 3 - index % 3) <= 1 ? 1 - value : value);
}
export const lightStart = [0, 4, 8].reduce(toggleLights, Array<number>(9).fill(0));
export const slideStart = [1, 2, 3, 4, 0, 6, 7, 5, 8];
export function slideTile(board: number[], index: number) {
  const empty = board.indexOf(0);
  if (Math.abs(Math.floor(empty / 3) - Math.floor(index / 3)) + Math.abs(empty % 3 - index % 3) !== 1) return board;
  const next = [...board]; next[empty] = board[index] ?? 0; next[index] = 0; return next;
}
export const maze = [".....", ".###.", "...#.", "##.#.", "....."];
export function walkMaze(position: number, direction: string): number {
  const offsets: Record<string, [number, number]> = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const offset = offsets[direction]; if (!offset) return position;
  const y = Math.floor(position / 5) + offset[0], x = position % 5 + offset[1];
  return y >= 0 && y < 5 && x >= 0 && x < 5 && maze[y]?.[x] === "." ? y * 5 + x : position;
}
export function botMove(game: Chess) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const moves = game.moves({ verbose: true });
  return moves.sort((a, b) => (values[b.captured ?? ""] ?? 0) - (values[a.captured ?? ""] ?? 0) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))[0];
}
export function replayChess(moves: string[]) {
  const game = new Chess();
  for (const move of moves) {
    if (game.isGameOver() || game.turn() !== "w") return null;
    try { game.move(move); } catch { return null; }
    if (!game.isGameOver()) { const bot = botMove(game); if (bot) game.move(bot); }
  }
  return game;
}
export type ChallengeProof = { answer?: string; moves?: string[]; steps?: number[] };
export function validateChallenge(key: string, id: string, proof: ChallengeProof) {
  const challenge = getChallenge(key); if (!challenge) return false;
  if (challenge.kind === "answer") return (proof.answer ?? "").trim().toLowerCase() === challenge.answer?.toLowerCase();
  if (key === "video") return proof.answer?.trim() === "1/6";
  if (key === "chess") { const game = replayChess(proof.moves ?? []); return !!game && game.isCheckmate() && game.turn() === "b"; }
  if (key === "sort") return proof.steps?.join(",") === "3,8,13,21,34,55";
  if (key === "memory") return proof.steps?.join(",") === memorySequence(id).join(",");
  if (key === "maze") return (proof.moves ?? []).reduce(walkMaze, 0) === 24;
  if (key === "lights") return (proof.steps ?? []).reduce(toggleLights, lightStart).every((v) => v === 0);
  if (key === "slide") return (proof.steps ?? []).reduce(slideTile, slideStart).join(",") === "1,2,3,4,5,6,7,8,0";
  return false;
}
export function chessSquares(): Square[] { return Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}` as Square); }