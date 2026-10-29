import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LogOut, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hearth — Private chat rooms" },
      { name: "description", content: "Host private chat rooms, share a code, and approve who gets in." },
      { property: "og:title", content: "Hearth — Private chat rooms" },
      { property: "og:description", content: "Host private chat rooms, share a code, and approve who gets in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Room = { id: string; name: string; code: string; host_id: string };

function Index() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen px-5 py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl">Hearth</span>
        </div>
        {user && (
          <Button variant="glass" size="sm" className="px-4" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Sign out
          </Button>
        )}
      </header>

      <main className="mx-auto mt-14 grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section className="animate-rise">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Invite-only by design
          </span>
          <h1 className="mt-6 text-5xl leading-[1.05] md:text-7xl">
            Rooms that feel <em className="text-gradient-primary">warm</em>, private, and yours.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Spin up a room, share a six-letter code, and let in only the people you approve.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Step n="1" t="Create a room" />
            <Step n="2" t="Share the code" />
            <Step n="3" t="Approve & chat" />
          </div>
        </section>
        <section className="flex justify-center lg:justify-end">
          {loading ? <div className="glass h-96 w-full max-w-md animate-pulse rounded-3xl" /> : user ? <Lobby userId={user.id} /> : <AuthCard />}
        </section>
      </main>
    </div>
  );
}

function Step({ n, t }: { n: string; t: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full border font-display text-foreground">{n}</span>
      {t}
    </div>
  );
}

function Lobby({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    supabase.from("rooms").select("id,name,code,host_id").order("created_at", { ascending: false }).then(({ data }) => setRooms(data ?? []));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_room", { _name: name || "Untitled room" });
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/room/$roomId", params: { roomId: (data as Room).id } });
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("request_join", { _code: code });
    if (error) { toast.error(error.message.includes("not found") ? "No room with that code" : error.message); return; }
    navigate({ to: "/room/$roomId", params: { roomId: data as string } });
  }

  return (
    <div className="w-full max-w-md space-y-4 animate-rise">
      <form onSubmit={create} className="glass rounded-3xl p-6">
        <h2 className="flex items-center gap-2 text-2xl"><Plus className="h-5 w-5 text-primary" /> Host a room</h2>
        <div className="mt-4 flex gap-2">
          <Input placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          <Button type="submit" variant="hero" className="h-11 px-5">Create</Button>
        </div>
      </form>
      <form onSubmit={join} className="glass rounded-3xl p-6">
        <h2 className="flex items-center gap-2 text-2xl"><KeyRound className="h-5 w-5 text-accent" /> Join with a code</h2>
        <div className="mt-4 flex gap-2">
          <Input required maxLength={6} placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-11 rounded-xl font-mono tracking-[0.3em] uppercase" />
          <Button type="submit" variant="glass" className="h-11 px-5">Knock</Button>
        </div>
      </form>
      {rooms.length > 0 && (
        <div className="glass rounded-3xl p-3">
          <p className="px-3 pb-2 pt-1 text-xs uppercase tracking-widest text-muted-foreground">Your rooms</p>
          {rooms.map((r) => (
            <Link key={r.id} to="/room/$roomId" params={{ roomId: r.id }} className="flex items-center justify-between rounded-2xl px-3 py-3 transition-colors hover:bg-secondary">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{r.code} {r.host_id === userId && "· host"}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
