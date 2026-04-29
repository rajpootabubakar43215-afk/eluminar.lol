import { createServerFn } from "@tanstack/react-start";
import type { PlayerStats } from "./leaderboard-types";

function emptyLeaderboard(error: string | null) {
  return { players: [] as PlayerStats[], error, fetchedAt: Date.now() };
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { fetchLeaderboard } = await import("./sftp.server");
    const players: PlayerStats[] = await fetchLeaderboard();
    return { players, error: null as string | null, fetchedAt: Date.now() };
  } catch (err) {
    console.error("Leaderboard fetch failed:", err);
    const rawMessage = err instanceof Error ? err.message : "Unknown error";
    const error = rawMessage.includes("__dirname is not defined")
      ? "Leaderboard connection is temporarily unavailable."
      : rawMessage;

    return emptyLeaderboard(error);
  }
});
