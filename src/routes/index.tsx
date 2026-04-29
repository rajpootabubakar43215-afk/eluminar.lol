import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getLeaderboard } from "@/lib/leaderboard.functions";
import type { PlayerStats } from "@/lib/leaderboard-types";
import { Trophy, Search, Radio, Users, ChevronLeft, ChevronRight } from "lucide-react";
import logoUrl from "@/assets/eluminar-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELUMINAR Leaderboard — Call of Duty 1.1" },
      { name: "description", content: "Live player leaderboard for ELUMINAR Rifles S&D — Call of Duty 1.1 server." },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
  }),
  loader: () => getLeaderboard(),
  component: LeaderboardPage,
});

const PAGE_SIZE = 20;

type SortKey = "kills" | "deaths" | "kd" | "accuracy" | "dmg" | "timePlayed" | "shots" | "hits" | "longestDist";

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${h}h ${pad(m)}m ${pad(s)}s`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtRange(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LeaderboardPage() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState(initial);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<PlayerStats | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("kills");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // silent auto-refresh every 3 sec
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await getLeaderboard();
        if (!cancelled) setData(fresh);
      } catch {
        /* silent */
      }
    };
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const players: PlayerStats[] = data.players as PlayerStats[];

  const totalKills = useMemo(
    () => players.reduce((s, p) => s + p.kills, 0),
    [players]
  );

  const sorted = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      const av = (a[sortKey] as number) || 0;
      const bv = (b[sortKey] as number) || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [players, sortKey, sortDir]);

  // assign global rank by kills (always)
  const rankedByKills = useMemo(() => {
    const map = new Map<string, number>();
    [...players]
      .sort((a, b) => b.kills - a.kills)
      .forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, oklch(0.35 0.12 260 / 0.5), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.32 0.18 290 / 0.35), transparent 60%), oklch(0.13 0.03 260)",
        }}
      />

      <Header playerCount={players.length} totalKills={totalKills} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {data.error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Connection error: {data.error}
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
          {/* Card header */}
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-foreground">Top Players</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing {start + 1}-{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} ({PAGE_SIZE} per page)
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search playername..."
                className="w-full rounded-full border border-border bg-background/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-muted-foreground">
                  <th className="px-2 py-3 text-left w-14">#</th>
                  <th className="px-2 py-3 text-left">Player</th>
                  <SortTh label="Kills" k="kills" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Deaths" k="deaths" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="K/D" k="kd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Acc" k="accuracy" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="DMG" k="dmg" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Time" k="timePlayed" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Shots" k="shots" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortTh label="Hits" k="hits" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <th className="px-2 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort("longestDist")}>
                    <span className="inline-flex items-center gap-1">
                      Range <SortIcon active={sortKey === "longestDist"} dir={sortDir} />
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">units</span>
                    </span>
                  </th>
                  
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-muted-foreground">
                      No players found.
                    </td>
                  </tr>
                )}
                {pageItems.map((player) => {
                  const rank = rankedByKills.get(player.id) ?? 0;
                  return (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      rank={rank}
                      onEnter={(p, e) => {
                        setHovered(p);
                        setCursor({ x: e.clientX, y: e.clientY });
                      }}
                      onMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
                      onLeave={() => setHovered(null)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onChange={(p) => setPage(p)}
            />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/80">
          © ELUMINAR  Rifles 
        </p>
      </main>

      <FloatingPlayerCard player={hovered} x={cursor.x} y={cursor.y} />
    </div>
  );
}

function Header({ playerCount, totalKills: _totalKills }: { playerCount: number; totalKills: number }) {
  return (
    <header className="border-b border-border/40 bg-background/30 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="ELUMINAR"
            className="h-12 w-12 rounded-md object-cover ring-1 ring-border/60"
          />
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                ELUMINAR
              </span>
              <span className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                LEADERBOARD
              </span>
              <span className="ml-1 rounded-md border border-border/70 bg-background/60 px-2 py-0.5 text-xs font-bold text-foreground">
                CoD 1.1
              </span>
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live from ELUMINAR RIFLES S&amp;D.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground">
            <Users className="h-3.5 w-3.5" />
            {playerCount} players
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground">
            <Radio className="h-3.5 w-3.5" />
            <ClientClock />
          </div>
        </div>
      </div>
    </header>
  );
}

function ClientClock() {
  const [time, setTime] = useState<string>("--:--:--");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground/50"}`}>
      {active ? (dir === "desc" ? "↓" : "↑") : "⇅"}
    </span>
  );
}

function SortTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-2 py-3 text-right hover:text-foreground"
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label} <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-2.5 py-1 text-[11px] font-black text-yellow-950 shadow-[0_0_12px_rgba(250,204,21,0.45)]">
        <Trophy className="h-3 w-3" /> #1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-slate-300 to-slate-400 px-2.5 py-1 text-[11px] font-black text-slate-900 shadow-[0_0_10px_rgba(203,213,225,0.35)]">
        <Trophy className="h-3 w-3" /> #2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-700 to-orange-600 px-2.5 py-1 text-[11px] font-black text-orange-50 shadow-[0_0_10px_rgba(249,115,22,0.35)]">
        <Trophy className="h-3 w-3" /> #3
      </span>
    );
  }
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

function PlayerRow({
  player,
  rank,
  onEnter,
  onMove,
  onLeave,
}: {
  player: PlayerStats;
  rank: number;
  onEnter: (p: PlayerStats, e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const rowHighlight =
    rank === 1
      ? "bg-yellow-500/[0.06] hover:bg-yellow-500/[0.10]"
      : rank === 2
        ? "bg-slate-400/[0.05] hover:bg-slate-400/[0.09]"
        : rank === 3
          ? "bg-orange-500/[0.05] hover:bg-orange-500/[0.09]"
          : "hover:bg-foreground/[0.03]";

  return (
    <tr
      className={`cursor-pointer border-b border-border/30 transition ${rowHighlight}`}
      onMouseEnter={(e) => onEnter(player, e)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <td className="px-2 py-3">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-3 font-semibold text-foreground">{player.name}</td>
      <td className="px-2 py-3 text-right font-bold text-foreground tabular-nums">{fmtNum(player.kills)}</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">{fmtNum(player.deaths)}</td>
      <td className="px-2 py-3 text-right text-foreground tabular-nums">{player.kd.toFixed(2)}</td>
      <td className="px-2 py-3 text-right text-foreground tabular-nums">{player.accuracy.toFixed(1)}%</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">{fmtNum(player.dmg)}</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums whitespace-nowrap">{fmtTime(player.timePlayed)}</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">{fmtNum(player.shots)}</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">{fmtNum(player.hits)}</td>
      <td className="px-2 py-3 text-right text-muted-foreground tabular-nums">{fmtRange(player.longestDist)}</td>
    </tr>
  );
}

function FloatingPlayerCard({
  player,
  x,
  y,
}: {
  player: PlayerStats | null;
  x: number;
  y: number;
}) {
  if (typeof window === "undefined" || !player) return null;

  const W = 288; // w-72
  const H = 460; // approx
  const pad = 16;
  const offset = 18;
  let left = x + offset;
  let top = y + offset;
  if (left + W + pad > window.innerWidth) left = x - W - offset;
  if (top + H + pad > window.innerHeight) top = Math.max(pad, window.innerHeight - H - pad);
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  return createPortal(
    <div
      style={{ position: "fixed", left, top, zIndex: 1000, pointerEvents: "none" }}
      className="w-72 rounded-md border border-border/60 bg-card/95 p-0 shadow-2xl backdrop-blur-md"
    >
      <div className="border-b border-border/60 p-4">
        <p className="text-base font-black text-foreground">{player.name}</p>
        <p className="text-xs text-muted-foreground">No changes yet today</p>
      </div>
      <div className="flex flex-col">
        <PopStat label="Kills" current={fmtNum(player.kills)} />
        <PopStat label="Deaths" current={fmtNum(player.deaths)} />
        <PopStat label="K/D" current={player.kd.toFixed(2)} delta="0.00" />
        <PopStat label="Accuracy" current={`${player.accuracy.toFixed(1)}%`} delta="0.0%" />
        <PopStat label="Damage" current={fmtNum(player.dmg)} />
        <PopStat label="Time" current={fmtTime(player.timePlayed)} />
        <PopStat label="Shots" current={fmtNum(player.shots)} />
        <PopStat label="Hits" current={fmtNum(player.hits)} />
        <PopStat label="Range" current={fmtRange(player.longestDist)} delta="0.00" />
        
      </div>
    </div>,
    document.body
  );
}

function PopStat({ label, current, delta = "0" }: { label: string; current: string; delta?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-border/30 px-4 py-2.5 last:border-b-0">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">Current: {current}</p>
      </div>
      <span className="text-xs font-medium text-muted-foreground/80">— {delta}</span>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  // build compact list: 1 2 3 ... last
  const pages: (number | "...")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1, 2, 3, "...", totalPages);
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <PgBtn onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}>
        <ChevronLeft className="h-4 w-4" />
      </PgBtn>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-8 min-w-[2rem] rounded-md border text-sm font-semibold transition ${
              p === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background/40 text-foreground hover:border-primary/60"
            }`}
          >
            {p}
          </button>
        )
      )}
      <PgBtn onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
        <ChevronRight className="h-4 w-4" />
      </PgBtn>
    </div>
  );
}

function PgBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/40 text-foreground transition hover:border-primary/60 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
