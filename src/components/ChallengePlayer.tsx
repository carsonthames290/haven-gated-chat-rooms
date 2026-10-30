import { useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChallenge, memorySequence, slideStart, slideTile, lightStart, toggleLights, maze, walkMaze, botMove, chessSquares, type ChallengeProof } from "@/lib/challenges";
import { supabase } from "@/integrations/supabase/client";
import mathVideo from "@/assets/boring-math.webm.asset.json";

export function ChallengePlayer({ roomId, challengeId, challengeKey, reason, onComplete }: { roomId: string; challengeId: string; challengeKey: string; reason: string; onComplete: () => void }) {
  const challenge = getChallenge(challengeKey);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [steps, setSteps] = useState<number[]>([]);
  const [moves, setMoves] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [watched, setWatched] = useState(false);
  const [started, setStarted] = useState(false);
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  if (!challenge) return <p>Challenge unavailable. Ask the host to clear your restriction.</p>;
  async function submit(proof: ChallengeProof) {
    if (busy) return; setBusy(true);
    try { const { data, error } = await supabase.rpc("complete_room_challenge", { _room_id: roomId, _challenge_id: challengeId, ...(proof.answer !== undefined ? { _answer: proof.answer } : {}), ...(proof.moves ? { _moves: proof.moves } : {}), ...(proof.steps ? { _steps: proof.steps } : {}) }); if (error) throw new Error(error.message); const result = data as { completed: boolean; message: string }; setFeedback(result.message); if (result.completed) { toast.success(result.message); onComplete(); } }
    catch (e) { setFeedback(e instanceof Error ? e.message : "Could not submit. Try again."); }
    finally { setBusy(false); }
  }
  function chessClick(square: Square) {
    if (game.isGameOver()) return;
    if (!selected) { if (game.get(square)?.color === "w") setSelected(square); return; }
    const next = new Chess(game.fen());
    try {
      const move = next.move({ from: selected, to: square, promotion: "q" });
      const history = [...moves, move.lan];
      if (!next.isGameOver()) { const reply = botMove(next); if (reply) next.move(reply); }
      setMoves(history); setGame(next); setFeedback(next.isCheckmate() ? next.turn() === "b" ? "Checkmate! Submit your victory." : "The bot won. Rematch?" : next.isDraw() ? "Draw. Try a rematch." : next.isCheck() ? "Check!" : "");
    } catch { if (next.get(square)?.color === "w") { setSelected(square); return; } }
    setSelected(null);
  }
  const board = challengeKey === "slide" ? steps.reduce(slideTile, slideStart) : steps.reduce(toggleLights, lightStart);
  const position = moves.reduce(walkMaze, 0);
  const symbols = ["🍌", "🪿", "🧀", "🐸"];
  const pieceSymbols: Record<string, string> = { wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔", bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚" };
  return <section className="mx-auto w-full max-w-xl space-y-5 py-5">
    <div className="flex items-center gap-4"><span className="text-4xl" aria-hidden>{challenge.emoji}</span><div className="min-w-0"><p className="text-xs uppercase text-primary">The goofball correctional facility</p><h2 className="break-words text-2xl">{challenge.title}</h2></div></div>
    {reason && <p className="break-words text-sm text-muted-foreground">Host's note: {reason}</p>}
    <p>{challenge.prompt}</p>
    {challenge.kind === "answer" && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit({ answer }); }}><Input aria-label="Challenge answer" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" /><Button aria-label="Submit answer" type="submit" variant="hero" disabled={busy || !answer.trim()}><Send /></Button></form>}
    {challenge.kind === "video" && <div className="space-y-3">
      {!started ? <Button variant="hero" disabled={busy} onClick={async () => { setBusy(true); try { const { error } = await supabase.rpc("start_room_challenge", { _room_id: roomId, _challenge_id: challengeId }); if (error) throw error; setStarted(true); } catch { setFeedback("Class couldn't start. Try again."); } finally { setBusy(false); } }}>Attend detention</Button> : <video className="aspect-video w-full rounded-lg" src={mathVideo.url} controls playsInline preload="auto" onEnded={() => setWatched(true)} onSeeking={(e) => { const video = e.currentTarget; if (video.currentTime > (Number(video.dataset['furthest']) || 0) + 1) video.currentTime = Number(video.dataset['furthest']) || 0; }} onTimeUpdate={(e) => { const video = e.currentTarget; if (!video.seeking) video.dataset['furthest'] = String(Math.max(Number(video.dataset['furthest']) || 0, video.currentTime)); }} onRateChange={(e) => { if (e.currentTarget.playbackRate !== 1) e.currentTarget.playbackRate = 1; }} />}
      {watched && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void submit({ answer }); }}><label htmlFor="video-answer">Exit question: 1/2 × 1/3 = ?</label><Input id="video-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} /><Button type="submit" disabled={busy}>Finish class</Button></form>}
    </div>}
    {challenge.kind === "chess" && <div className="space-y-3"><div className="grid aspect-square w-full max-w-md grid-cols-8 overflow-hidden rounded-lg border">{chessSquares().map((square, i) => { const piece = game.get(square); return <Button key={square} variant="ghost" aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : " empty"}`} onClick={() => chessClick(square)} className={`h-auto min-h-0 rounded-none p-0 text-3xl ${selected === square ? "bg-primary text-primary-foreground" : (Math.floor(i / 8) + i % 8) % 2 ? "bg-secondary text-foreground" : "bg-accent text-accent-foreground"}`}>{piece ? pieceSymbols[piece.color + piece.type] : ""}</Button>; })}</div><div className="flex flex-wrap gap-2"><Button variant="glass" onClick={() => { setGame(new Chess()); setMoves([]); setSelected(null); setFeedback(""); }}><RotateCcw /> Rematch</Button><Button disabled={busy || !game.isCheckmate() || game.turn() !== "b"} onClick={() => void submit({ moves })}>Claim victory</Button></div></div>}
    {(challenge.kind === "slide" || challenge.kind === "lights") && <div className="space-y-3"><div className="grid aspect-square w-full max-w-xs grid-cols-3 gap-2">{board.map((value, i) => <Button key={i} variant={value ? "hero" : "glass"} className="h-auto text-2xl" aria-label={challenge.kind === "slide" ? `Tile ${value || "empty"}` : `Light ${i + 1} ${value ? "on" : "off"}`} onClick={() => setSteps([...steps, i])}>{challenge.kind === "slide" ? value || "" : value ? "💡" : "·"}</Button>)}</div><Button disabled={busy} onClick={() => void submit({ steps })}>Submit puzzle</Button><Button variant="ghost" onClick={() => setSteps([])}><RotateCcw /> Reset</Button></div>}
    {challenge.kind === "sort" && <div className="space-y-3"><div className="flex flex-wrap gap-2">{[21, 3, 55, 13, 8, 34].map((n) => <Button key={n} disabled={steps.includes(n)} variant="glass" onClick={() => setSteps([...steps, n])}>{n}</Button>)}</div><p className="min-h-6 font-mono">{steps.join(" → ")}</p><Button onClick={() => void submit({ steps })} disabled={busy || steps.length !== 6}>File spreadsheet</Button><Button variant="ghost" onClick={() => setSteps([])}><RotateCcw /> Reset</Button></div>}
    {challenge.kind === "memory" && <div className="space-y-3">{!hidden ? <><div className="flex justify-between text-3xl">{memorySequence(challengeId).map((n, i) => <span key={i}>{symbols[n]}</span>)}</div><Button onClick={() => setHidden(true)}>I've memorized it</Button></> : <><div className="flex gap-2">{symbols.map((symbol, i) => <Button key={symbol} variant="glass" className="text-2xl" aria-label={`Choose ${symbol}`} disabled={steps.length >= 6} onClick={() => setSteps([...steps, i])}>{symbol}</Button>)}</div><p className="min-h-8 text-2xl">{steps.map((n) => symbols[n]).join(" ")}</p><Button disabled={busy || steps.length !== 6} onClick={() => void submit({ steps })}>Get certified</Button><Button variant="ghost" onClick={() => { setSteps([]); setHidden(false); }}><RotateCcw /> Retry</Button></>}</div>}
    {challenge.kind === "maze" && <div className="space-y-3"><div className="grid aspect-square max-w-xs grid-cols-5 gap-1">{maze.join("").split("").map((cell, i) => <div key={i} className={`grid place-items-center rounded-sm text-2xl ${cell === "#" ? "bg-secondary" : "bg-accent/20"}`}>{i === position ? "🐭" : i === 24 ? "🧀" : ""}</div>)}</div><div className="flex gap-2">{[["U", ArrowUp], ["D", ArrowDown], ["L", ArrowLeft], ["R", ArrowRight]].map(([direction, Icon]) => { if (typeof direction !== "string" || typeof Icon === "string" || !Icon) return null; return <Button key={direction} size="icon" variant="glass" aria-label={`Move ${direction}`} onClick={() => setMoves([...moves, direction])}><Icon /></Button>; })}</div><Button disabled={busy || position !== 24} onClick={() => void submit({ moves })}>Escape office</Button></div>}
    {feedback && <p role="status" className="text-sm text-primary">{feedback}</p>}
  </section>;
}