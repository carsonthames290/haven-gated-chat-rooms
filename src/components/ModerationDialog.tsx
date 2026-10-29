import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isTimedAction, moderationOptions, type ModerationAction } from "@/lib/moderation";

export function ModerationDialog({ roomId, member, onClose, onSaved }: {
  roomId: string;
  member: { user_id: string; display_name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<ModerationAction>("none");
  const [duration, setDuration] = useState("300");
  const [custom, setCustom] = useState("10");
  const [unit, setUnit] = useState("60");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const seconds = duration === "custom" ? Number(custom) * Number(unit) : Number(duration);
  const invalid = isTimedAction(action) && (!Number.isInteger(seconds) || seconds < 1 || seconds > 604800);
  async function apply() {
    if (invalid || saving) return;
    setSaving(true);
    const { error } = await supabase.rpc("moderate_member", {
      _room: roomId, _user: member.user_id, _action: action,
      ...(isTimedAction(action) ? { _seconds: seconds } : {}), _reason: reason.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "none" ? "Restrictions cleared" : "Moderation applied");
    onSaved();
    onClose();
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border bg-popover text-popover-foreground">
      <DialogHeader>
        <ShieldCheck className="mb-2 h-7 w-7 text-primary" />
        <DialogTitle className="break-words text-2xl">Moderate {member.display_name}</DialogTitle>
        <DialogDescription>Room host controls</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <label htmlFor="moderation-action" className="text-sm font-medium">Action</label>
        <Select value={action} onValueChange={(value) => setAction(value as ModerationAction)}>
          <SelectTrigger id="moderation-action" className="h-auto min-h-11 [&>span]:whitespace-normal [&>span]:text-left"><SelectValue /></SelectTrigger>
          <SelectContent>{moderationOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isTimedAction(action) && <div className="space-y-3">
        <label htmlFor="moderation-duration" className="text-sm font-medium">Duration</label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger id="moderation-duration"><SelectValue /></SelectTrigger>
          <SelectContent>{([ ["60", "1 minute"], ["300", "5 minutes"], ["600", "10 minutes"], ["1800", "30 minutes"], ["3600", "1 hour"], ["86400", "1 day"], ["604800", "7 days"], ["custom", "Custom duration"] ] as const).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        {duration === "custom" && <div className="flex gap-2">
          <Input aria-label="Custom duration" type="number" min="1" value={custom} onChange={(e) => setCustom(e.target.value)} className="min-w-0 flex-1" />
          <Select value={unit} onValueChange={setUnit}><SelectTrigger aria-label="Duration unit" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Seconds</SelectItem><SelectItem value="60">Minutes</SelectItem><SelectItem value="3600">Hours</SelectItem><SelectItem value="86400">Days</SelectItem></SelectContent></Select>
        </div>}
        {invalid && <p className="text-sm text-destructive">Choose between 1 second and 7 days.</p>}
      </div>}
      {action !== "none" && <div className="space-y-2"><label htmlFor="moderation-reason" className="text-sm font-medium">Reason (optional)</label><Input id="moderation-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>}
      <DialogFooter><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button variant={action === "ban" || action === "kick" ? "destructive" : "hero"} disabled={invalid || saving} onClick={apply}>{saving ? "Applying…" : "Apply"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}