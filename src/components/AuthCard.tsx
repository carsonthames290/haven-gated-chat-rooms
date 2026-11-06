import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthCard() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const display_name = name.trim().slice(0, 40);
    if (!display_name) return;
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name } } });
    if (error) toast.error(error.message);
    setBusy(false);
  }

  return (
    <div className="glass w-full max-w-md rounded-3xl p-8 animate-rise">
      <h2 className="text-3xl">Pull up a chair</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick a display name to host or join rooms.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input required maxLength={40} placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          Enter
        </Button>
      </form>
    </div>
  );
}
