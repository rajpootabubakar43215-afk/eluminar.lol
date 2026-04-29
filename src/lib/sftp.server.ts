// Server-only SFTP fetcher for COD 1.1 leaderboard data
import SftpClient from "ssh2-sftp-client";
import type { PlayerStats } from "./leaderboard-types";

export type { PlayerStats };

function parseDelimited(content: string): { header: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split("%");
  const rows = lines.slice(1).map((l) => l.split("%"));
  return { header, rows };
}

async function fetchFile(sftp: SftpClient, remotePath: string): Promise<string> {
  const buf = (await sftp.get(remotePath)) as Buffer;
  return buf.toString("utf-8");
}

export async function fetchLeaderboard(): Promise<PlayerStats[]> {
  const host = process.env.SFTP_HOST || "upsilon.optiklink.com";
  const port = parseInt(process.env.SFTP_PORT || "22", 10);
  const username = process.env.SFTP_USER || "m7wuj930.52cd468a";
  const password = process.env.SFTP_PASS || "lolopopo"
  const usersFile = process.env.SFTP_USERS_FILE || "main/users.dat";
  const statsFile = process.env.SFTP_STATS_FILE || "main/stat.dat";

  if (!host || !username || !password) {
    throw new Error("SFTP credentials not configured");
  }

  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host,
      port,
      username,
      password,
      readyTimeout: 15000,
    });

    const [usersText, statsText] = await Promise.all([
      fetchFile(sftp, usersFile),
      fetchFile(sftp, statsFile),
    ]);

    const users = parseDelimited(usersText);
    const stats = parseDelimited(statsText);

    // Build id -> name map from users file
    // header looks like: id%name%password%ip%id%591  (last two are junk)
    const nameById = new Map<string, string>();
    for (const row of users.rows) {
      if (row.length >= 2) {
        nameById.set(row[0], row[1]);
      }
    }

    const players: PlayerStats[] = [];
    for (const row of stats.rows) {
      if (row.length < 11) continue;
      const id = row[0];
      const kills = Number(row[1]) || 0;
      const deaths = Number(row[2]) || 0;
      const headshots = Number(row[3]) || 0;
      const bash = Number(row[4]) || 0;
      const timePlayed = Number(row[5]) || 0;
      const longestDist = Number(row[6]) || 0;
      const shots = Number(row[7]) || 0;
      const hits = Number(row[8]) || 0;
      const dmg = Number(row[9]) || 0;
      const suicides = Number(row[10]) || 0;
      const kd = deaths > 0 ? kills / deaths : kills;
      const accuracy = shots > 0 ? (hits / shots) * 100 : 0;
      players.push({
        id,
        name: nameById.get(id) || `Player#${id}`,
        kills,
        deaths,
        headshots,
        bash,
        timePlayed,
        longestDist,
        shots,
        hits,
        dmg,
        suicides,
        kd,
        accuracy,
      });
    }

    players.sort((a, b) => b.kills - a.kills);
    return players;
  } finally {
    try {
      await sftp.end();
    } catch {
      /* ignore */
    }
  }
}
