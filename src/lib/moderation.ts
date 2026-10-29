export type ModerationAction = "none" | "warn" | "mute" | "timeout" | "slow" | "kick" | "ban";
export type ModerationState = { moderation_action: string; moderation_until: string | null; moderation_reason: string };
export const moderationOptions: { value: ModerationAction; label: string }[] = [
  { value: "none", label: "No punishment / clear restrictions" },
  { value: "warn", label: "Warning only" },
  { value: "mute", label: "Mute — read only" },
  { value: "timeout", label: "Timeout — pause room access" },
  { value: "slow", label: "Slow mode — one message every 30 seconds" },
  { value: "kick", label: "Remove — may request to rejoin" },
  { value: "ban", label: "Ban — block rejoining" },
];
export function isTimedAction(action: string) {
  return ["mute", "timeout", "slow"].includes(action);
}
export function activeModeration(state: ModerationState | undefined, now: number): string {
  if (!state) return "none";
  if (isTimedAction(state.moderation_action)) {
    return state.moderation_until && Date.parse(state.moderation_until) > now ? state.moderation_action : "none";
  }
  return state.moderation_action;
}
export function remainingTime(until: string | null, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(until ?? "") - now) / 1000) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
}