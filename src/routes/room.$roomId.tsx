import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Crown, Send, Trash2, UserMinus, Users, X, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
type Member = { room_id: string; user_id: string; display_name: string; status: string };
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
  const endRef = useRef<HTMLDivElement>(null);

  const me = members.find((m) => m.user_id === userId);
  const isHost = room?.host_id === userId;
  const approved = me?.status === "approved";
  const pending = members.filter((m) => m.status === "pending");
  const inRoom = members.filter((m) => m.status === "approved");

  const loadMembers = () =>
    supabase.from("room_members").select("*").eq("room_id", roomId).then(({ data }) => setMembers(data ?? []));
  const loadMsgs = () =>
    supabase.from("messages").select("*").eq("room_id", roomId).order("created_at").limit(500).then(({ data }) => setMsgs(data ?? []));

  useEffect(() => {
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle().then(({ data }) => (data ? setRoom(data) : setMissing(true)));
    loadMembers();
    const ch = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, () => loadMembers())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, (p) =>
        setMsgs((cur) => (cur.some((m) => m.id === (p.new as Msg).id) ? cur : [...cur, p.new as Msg])),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => { if (approved) loadMsgs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [approved]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setText("");
    const { data, error } = await supabase.from("messages").insert({ room_id: roomId, body, display_name: me.display_name }).select().single();
    if (error) { toast.error(error.message); return; }
    setMsgs((cur) => (cur.some((m) => m.id === data.id) ? cur : [...cur, data]));
  }
  const setStatus = async (uid: string, status: string) => {
    const { error } = await supabase.from("room_members").update({ status }).eq("room_id", roomId).eq("user_id", uid);
    if (error) toast.error(error.message); else loadMembers();
  };
  const kick = async (uid: string) => {
    await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", uid);
    loadMembers();
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
  if (!room || !me) return <Centered title="Loading…" body="" />;
  if (me.status === "pending")
    return <Centered icon={<Hourglass className="h-6 w-6 animate-pulse text-primary" />} title="Waiting at the door" body={`The host of “${room.name}” will let you in shortly.`} />;
  if (me.status === "rejected") return <Centered title="Not this time" body="The host declined your request." />;

  return (
    <div className="mx-auto flex h-screen max-w-6xl gap-4 p-4">
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
        </header>
        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {grouped.length === 0 && <p className="mt-20 text-center text-muted-foreground">Say hello 👋</p>}
          {grouped.map((m) => {
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
        <form onSubmit={send} className="flex gap-2 border-t p-4">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a message…" className="h-12 rounded-full px-5" />
          <Button type="submit" variant="hero" className="h-12 w-12 p-0" disabled={!text.trim()}><Send /></Button>
        </form>
      </main>

      <aside className="glass hidden w-72 shrink-0 flex-col rounded-3xl p-4 md:flex">
        {isHost && pending.length > 0 && (
          <section className="mb-5">
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm text-primary">Knocking ({pending.length})</h3>
            {pending.map((p) => (
              <div key={p.user_id} className="mb-2 flex animate-rise items-center gap-2 rounded-2xl bg-secondary p-2 pl-3">
                <span className="flex-1 truncate text-sm">{p.display_name}</span>
                <Button size="icon" variant="success" className="h-8 w-8" onClick={() => setStatus(p.user_id, "approved")}><Check /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setStatus(p.user_id, "rejected")}><X /></Button>
              </div>
            ))}
          </section>
        )}
        <h3 className="mb-2 flex items-center gap-2 px-1 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Members</h3>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {inRoom.map((m) => (
            <div key={m.user_id} className="group flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-secondary">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">{m.display_name[0]?.toUpperCase()}</div>
              <span className="flex-1 truncate text-sm">{m.display_name}{m.user_id === userId && " (you)"}</span>
              {m.user_id === room.host_id && <Crown className="h-4 w-4 text-primary" />}
              {isHost && m.user_id !== userId && (
                <button onClick={() => kick(m.user_id)} className="opacity-0 transition-opacity group-hover:opacity-100" title="Remove"><UserMinus className="h-4 w-4 text-destructive" /></button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" className="mt-3 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={leave}>
          {isHost ? <><Trash2 /> Delete room</> : <><ArrowLeft /> Leave room</>}
        </Button>
      </aside>
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
