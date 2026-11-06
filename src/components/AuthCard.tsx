import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const nameKey = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const emailFor = (k: string) => `${k}@guest.hearth.app`;
const passFor = (a: string) => `hearth::${a.trim().toLowerCase().replace(/\s+/g, " ")}`;

export function AuthCard() {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "new" | "existing">("name");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const key = nameKey(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const display_name = name.trim().slice(0, 40);
    if (!display_name) return;
    if (key.length < 2) { toast.error("Use at least 2 letters or numbers in your name."); return; }
    setBusy(true);
    try {
      if (step === "name") {
        const { data, error } = await supabase.rpc("name_security_question", { _name_key: key });
        if (error) throw error;
        if (data) { setQuestion(data); setStep("existing"); } else setStep("new");
        return;
      }
      if (!answer.trim()) return;
      if (step === "existing") {
        const { error } = await supabase.auth.signInWithPassword({ email: emailFor(key), password: passFor(answer) });
        if (error) toast.error("That answer isn't right.");
        return;
      }
      if (!question.trim()) return;
      const { error } = await supabase.auth.signUp({
        email: emailFor(key),
        password: passFor(answer),
        options: { data: { display_name, name_key: key, security_question: question.trim().slice(0, 120) } },
      });
      if (error) toast.error(error.message.includes("registered") ? "That name was just taken." : error.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass w-full max-w-md rounded-3xl p-8 animate-rise">
      <h2 className="text-3xl">{step === "existing" ? "Welcome back" : "Pull up a chair"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "name" && "Pick a display name to host or join rooms."}
        {step === "new" && "Set a security question so you can come back as this name."}
        {step === "existing" && "That name is taken. Answer its security question to sign in."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input required maxLength={40} placeholder="Display name" value={name} disabled={step !== "name"} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        {step === "new" && (
          <Input required maxLength={120} placeholder="Security question (e.g. First pet's name?)" value={question} onChange={(e) => setQuestion(e.target.value)} className="h-11 rounded-xl" />
        )}
        {step === "existing" && <p className="rounded-xl bg-secondary px-3 py-2 text-sm">{question}</p>}
        {step !== "name" && (
          <Input required type="password" maxLength={100} placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className="h-11 rounded-xl" />
        )}
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {step === "name" ? "Continue" : "Enter"}
        </Button>
        {step !== "name" && (
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => { setStep("name"); setAnswer(""); setQuestion(""); }}>
            Use a different name
          </button>
        )}
      </form>
    </div>
  );
}
