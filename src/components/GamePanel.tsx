import { useState } from "react";
import { ExternalLink, Gamepad2, LoaderCircle, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const GAME_URL = "https://unofun.mathfun.workers.dev";

export function GamePanel({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  return (
    <section aria-label="Game panel" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        <Gamepad2 className="h-5 w-5 shrink-0 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-lg">Card Night</h2>
        <Button size="icon" variant="ghost" aria-label="Reload game" title="Reload game" onClick={() => { setLoading(true); setVersion((value) => value + 1); }}><RotateCw /></Button>
        <Button asChild size="icon" variant="ghost"><a href={GAME_URL} target="_blank" rel="noopener noreferrer" aria-label="Open game in a new tab" title="Open game in a new tab"><ExternalLink /></a></Button>
        <Button size="icon" variant="ghost" aria-label="Close game" title="Close game" onClick={onClose}><X /></Button>
      </header>
      <div className="relative min-h-0 flex-1">
        {loading && <div role="status" className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center"><span className="flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading game…</span></div>}
        <iframe key={version} title="Card Night game" src={GAME_URL} className="h-full w-full border-0" allow="clipboard-write; fullscreen" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} />
      </div>
    </section>
  );
}