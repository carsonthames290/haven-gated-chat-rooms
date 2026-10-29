import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="glass w-full max-w-md rounded-3xl p-8 animate-rise">
      <h2 className="text-3xl">{mode === "up" ? "Pull up a chair" : "Welcome back"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "up" ? "Create an account to host or join rooms." : "Sign in to your rooms."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "up" && (
          <Input required placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        )}
        <Input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        <Input required type="password" minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {mode === "up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>
      <Button variant="glass" size="lg" className="w-full" onClick={google}>Continue with Google</Button>
      <button onClick={() => setMode(mode === "up" ? "in" : "up")} className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground">
        {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
