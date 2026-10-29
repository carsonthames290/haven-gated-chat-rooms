import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateChallenge } from "@/lib/challenges";

const input = z.object({ roomId: z.string().uuid(), challengeId: z.string().uuid(), answer: z.string().max(500).optional(), moves: z.array(z.string().max(12)).max(1000).optional(), steps: z.array(z.number().int().min(0).max(100)).max(2000).optional() });
export const startChallenge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => input.pick({ roomId: true, challengeId: true }).parse(data)).handler(async ({ data, context }) => {
  const { data: member, error } = await context.supabase.from("room_members").select("challenge_id,moderation_action,challenge_started_at").eq("room_id", data.roomId).eq("user_id", context.userId).single();
  if (error || member?.challenge_id !== data.challengeId || member.moderation_action !== "challenge") throw new Error("This challenge is no longer active");
  if (!member.challenge_started_at) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.from("room_members").update({ challenge_started_at: new Date().toISOString() }).eq("room_id", data.roomId).eq("user_id", context.userId).eq("challenge_id", data.challengeId).is("challenge_started_at", null);
    if (updateError) throw new Error("Unable to start challenge");
  }
  return { started: true };
});
export const completeChallenge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => input.parse(data)).handler(async ({ data, context }) => {
  const { data: member, error } = await context.supabase.from("room_members").select("challenge_key,challenge_id,challenge_started_at,moderation_action").eq("room_id", data.roomId).eq("user_id", context.userId).single();
  if (error || member?.challenge_id !== data.challengeId || member.moderation_action !== "challenge" || !member.challenge_key) throw new Error("This challenge is no longer active");
  if (!validateChallenge(member.challenge_key, data.challengeId, { ...(data.answer !== undefined ? { answer: data.answer } : {}), ...(data.moves ? { moves: data.moves } : {}), ...(data.steps ? { steps: data.steps } : {}) })) return { completed: false, message: "Not quite! The council grants unlimited retries." };
  if (member.challenge_key === "video" && (!member.challenge_started_at || Date.now() - Date.parse(member.challenge_started_at) < 40000)) return { completed: false, message: "Class is still in session. Finish the video first." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cleared, error: updateError } = await supabaseAdmin.from("room_members").update({ moderation_action: "none", moderation_reason: "", challenge_key: null, challenge_id: null, challenge_started_at: null }).eq("room_id", data.roomId).eq("user_id", context.userId).eq("challenge_id", data.challengeId).eq("moderation_action", "challenge").select("user_id");
  if (updateError || !cleared?.length) throw new Error("The host changed your challenge. Refresh and try again.");
  return { completed: true, message: "Sentence served. Welcome back, menace." };
});