import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Crown, Send, Trash2, ShieldCheck, Users, X, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModerationDialog } from "@/components/ModerationDialog";
import { activeModeration, remainingTime, type ModerationState } from "@/lib/moderation";

export const Route = createFileRoute("/room/$roomId")({
  head: () => ({
    meta: [
      { title: "Room — Hearth" },
      { name: "description", content: "A private Hearth chat room." },
      { property: "og:title", content: "Room — Hearth" },
      { property: "og:description", content: "A private Hearth chat room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

type Room = { id: string; name: string; code: string; host_id: string };
type Member = ModerationState & { room_id: string; user_id: string; display_name: string; status: string };
type Msg = { id: string; user_id: string; display_name: string; body: string; created_at: string };

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <div className="grid min-h-screen place-items-center p-5"><AuthCard /></div>;
  return <Room roomId={roomId} userId={user.id} />;
}

function Room({ roomId, userId }: { roomId: string; userId: string }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [moderating, setModerating] = useState<Member | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  const me = members.find((m) => m.user_id === userId);
  const isHost = room?.host_id === userId;
  const approved = me?.status === "approved" && me.moderation_action !== "ban";
  const restriction = activeModeration(me, now);
  const timedOut = restriction === "timeout";
  const lastMine = [...msgs].reverse().find((m) => m.user_id === userId);
  const slowWait = restriction === "slow" && lastMine ? Math.max(0, Math.ceil((Date.parse(lastMine.created_at) + 30000 - now) / 1000)) : 0;
  const cannotSend = !approved || timedOut || restriction === "mute" || slowWait > 0;
  const pending = members.filter((m) => m.status === "pending");
  const inRoom = members.filter((m) => m.status === "approved" && m.moderation_action !== "ban");
  const banned = members.filter((m) => m.moderation_action === "ban");

  const loadMembers = () =>
    supabase.from("room_members").select("*").eq("room_id", roomId).then(({ data, error }) => { if (!error) { setMembers(data ?? []); setMembersLoaded(true); } });
  const loadMsgs = () =>
    supabase.from("messages").select("*").eq("room_id", roomId).order("created_at").limit(500).then(({ data }) => setMsgs(data ?? []));

  useEffect(() => {
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle().then(({ data }) => (data ? setRoom(data) : setMissing(true)));
    loadMembers();
    const polling = window.setInterval(() => { loadMembers(); }, 2000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const ch = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => loadMembers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, (p) =>
        setMsgs((cur) => (cur.some((m) => m.id === (p.new as Msg).id) ? cur : [...cur, p.new as Msg])),
      )
      .subscribe();
    return () => { window.clearInterval(polling); window.clearInterval(clock); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => { if (approved && !timedOut) loadMsgs(); else setMsgs([]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [approved, timedOut]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me || cannotSend) return;
    setText("");
    const { data, error } = await supabase.from("messages").insert({ room_id: roomId, body, display_name: me.display_name }).select().single();
    if (error) { setText(body); toast.error(error.message); loadMembers(); return; }
    setMsgs((cur) => (cur.some((m) => m.id === data.id) ? cur : [...cur, data]));
  }
  const setStatus = async (uid: string, status: string) => {
    const { error } = await supabase.from("room_members").update({ status }).eq("room_id", roomId).eq("user_id", uid);
    if (error) toast.error(error.message); else loadMembers();
  };
  const leave = async () => {
    if (isHost) {
      if (!confirm("Delete this room for everyone?")) return;
      await supabase.from("rooms").delete().eq("id", roomId);
    } else await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", userId);
    navigate({ to: "/" });
  };

  const grouped = useMemo(() => msgs.map((m, i) => ({ ...m, first: i === 0 || msgs[i - 1]?.user_id !== m.user_id })), [msgs]);

  if (missing) return <Centered title="Room not found" body="It may have been deleted, or you haven't requested to join." />;
  if (membersLoaded && !me) return <Centered title="You're no longer in this room" body="You can request to rejoin from the lobby." />;
  if (!room || !me) return <Centered title="Loading…" body="" />;
  if (me.status === "pending")
    return <Centered icon={<Hourglass className="h-6 w-6 animate-pulse text-primary" />} title="Waiting at the door" body={`The host of “${room.name}” will let you in shortly.`} />;
  if (me.status === "rejected") return <Centered title="Not this time" body="The host declined your request." />;
  if (me.moderation_action === "ban") return <Centered title="Banned from this room" body={me.moderation_reason || "The host has blocked your access."} />;

  return (
    <div className="relative mx-auto flex h-dvh max-w-6xl gap-4 p-2 md:p-4">
      <main className="glass flex min-w-0 flex-1 flex-col rounded-3xl">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <Link to="/" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl">{room.name}</h1>
            <p className="text-xs text-muted-foreground">{inRoom.length} in the room</p>
          </div>
          <Button variant="glass" size="sm" className="px-3 font-mono tracking-widest" onClick={() => { navigator.clipboard.writeText(room.code); toast.success("Code copied"); }}>
            {room.code} <Copy />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Toggle members" onClick={() => setMembersOpen(!membersOpen)}><Users /></Button>
        </header>
        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {timedOut ? <div className="mt-16 text-center"><Hourglass className="mx-auto mb-4 h-8 w-8 text-primary" /><h2 className="text-2xl">Taking a timeout</h2><p role="status" className="mt-2 font-mono text-primary">{remainingTime(me.moderation_until, now)} remaining</p>{me.moderation_reason && <p className="mt-3 break-words text-muted-foreground">{me.moderation_reason}</p>}</div> : grouped.length === 0 && <p className="mt-20 text-center text-muted-foreground">Say hello 👋</p>}
          {(!timedOut ? grouped : []).map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={`flex animate-rise flex-col ${mine ? "items-end" : "items-start"} ${m.first ? "pt-3" : ""}`}>
                {m.first && !mine && <span className="mb-1 px-2 text-xs text-muted-foreground">{m.display_name}{m.user_id === room.host_id && " 👑"}</span>}
                <div className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${mine ? "bg-gradient-primary text-bubble-self-foreground rounded-br-md" : "bg-bubble-other rounded-bl-md"}`}>
                  {m.body}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {!timedOut && restriction !== "none" && <div role="status" className="border-t px-5 py-3 text-sm text-primary"><span>{restriction === "warn" ? "Warning from the host" : `${restriction === "mute" ? "Muted" : "Slow mode"} · ${remainingTime(me.moderation_until, now)} remaining`}</span>{me.moderation_reason && <p className="mt-1 break-words text-muted-foreground">{me.moderation_reason}</p>}</div>}
        <form onSubmit={send} className="flex gap-2 border-t p-4">
          <Input aria-label="Message" disabled={cannotSend} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={slowWait > 0 ? `Wait ${slowWait}s…` : cannotSend ? "Messaging paused" : "Write a message…"} className="h-12 min-w-0 rounded-full px-5" />
          <Button aria-label="Send message" type="submit" variant="hero" className="h-12 w-12 shrink-0 p-0" disabled={!text.trim() || cannotSend}><Send /></Button>
        </form>
      </main>

      <aside className={`glass ${membersOpen ? "absolute inset-y-2 right-2 z-20 flex max-w-[calc(100%-1rem)]" : "hidden"} w-72 shrink-0 flex-col rounded-3xl p-4 md:static md:flex`}>
        <Button aria-label="Close members" size="icon" variant="ghost" className="mb-2 self-end md:hidden" onClick={() => setMembersOpen(false)}><X /></Button>
        {isHost && pending.length > 0 && (
          <section className="mb-5">
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm text-primary">Knocking ({pending.length})</h3>
            {pending.map((p) => (
              <div key={p.user_id} className="mb-2 flex animate-rise items-center gap-2 rounded-2xl bg-secondary p-2 pl-3">
                <span className="flex-1 truncate text-sm">{p.display_name}</span>
                <Button aria-label={`Approve ${p.display_name}`} size="icon" variant="success" className="h-8 w-8" onClick={() => setStatus(p.user_id, "approved")}><Check /></Button>
                <Button aria-label={`Reject ${p.display_name}`} size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setStatus(p.user_id, "rejected")}><X /></Button>
              </div>
            ))}
          </section>
        )}
        <h3 className="mb-2 flex items-center gap-2 px-1 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Members</h3>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {[...inRoom, ...(isHost ? banned : [])].map((m) => (
            <div key={m.user_id} className="group flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-secondary">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">{m.display_name[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1"><span className="block truncate text-sm">{m.display_name}{m.user_id === userId && " (you)"}</span>{activeModeration(m, now) !== "none" && <span className="block text-xs capitalize text-primary">{activeModeration(m, now)}{m.moderation_until && activeModeration(m, now) !== "none" && ` · ${remainingTime(m.moderation_until, now)}`}</span>}</div>
              {m.user_id === room.host_id && <Crown className="h-4 w-4 text-primary" />}
              {isHost && m.user_id !== userId && (
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setModerating(m)} aria-label={`Moderate ${m.display_name}`} title={`Moderate ${m.display_name}`}><ShieldCheck className="h-4 w-4 text-primary" /></Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" className="mt-3 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={leave}>
          {isHost ? <><Trash2 /> Delete room</> : <><ArrowLeft /> Leave room</>}
        </Button>
      </aside>
      {isHost && moderating && <ModerationDialog key={moderating.user_id} roomId={roomId} member={moderating} onClose={() => setModerating(null)} onSaved={() => { loadMembers(); loadMsgs(); }} />}
    </div>
  );
}

function Centered({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-5">
      <div className="glass max-w-sm animate-rise rounded-3xl p-10 text-center">
        {icon && <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary animate-floaty">{icon}</div>}
        <h1 className="text-3xl">{title}</h1>
        {body && <p className="mt-2 text-muted-foreground">{body}</p>}
        <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">Back to lobby</Link>
      </div>
    </div>
  );
}
