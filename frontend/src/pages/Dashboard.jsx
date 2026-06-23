/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, publicApi, formatTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlayCircle,
  Plus,
  Trash2,
  Trophy,
  Target,
  Brain,
  Pencil,
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  History as HistoryIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

const RANKS = [
  { v: 1, l: "Bronze", c: "#a06b3b" },
  { v: 2, l: "Silver", c: "#c0c0c0" },
  { v: 3, l: "Gold", c: "#e6c200" },
  { v: 4, l: "Platinum", c: "#9cd9d9" },
  { v: 5, l: "Diamond", c: "#69b8ff" },
  { v: 6, l: "Champion", c: "#9b6cff" },
  { v: 7, l: "Grand Champion", c: "#ff4757" },
  { v: 8, l: "Supersonic Legend", c: "#ffffff" },
];

const GAME_MODES = [
  { v: "duel", l: "1v1 Duel", short: "1s" },
  { v: "doubles", l: "2v2 Doubles", short: "2s" },
  { v: "standard", l: "3v3 Standard", short: "3s" },
  { v: "hoops", l: "Hoops", short: "HOOPS" },
  { v: "snowday", l: "Snowday", short: "SNOW" },
  { v: "rumble", l: "Rumble", short: "RUMBLE" },
  { v: "dropshot", l: "Dropshot", short: "DROP" },
  { v: "tournaments", l: "Tournaments", short: "TOURN" },
  { v: "other", l: "Other", short: "OTHER" },
];

const rankLabel = (v) => RANKS.find((r) => r.v === v)?.l || "—";
const rankColor = (v) => RANKS.find((r) => r.v === v)?.c || "#888";
const modeLabel = (v) => GAME_MODES.find((g) => g.v === v)?.short || v?.toUpperCase();

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allQuizzes, setAllQuizzes] = useState([]);
  const [myQuizzes, setMyQuizzes] = useState([]);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState({ quiz_ids: [], creator_ids: [], quizzes: [], creators: [] });

  // search & filters
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [creator, setCreator] = useState("");
  const [minRank, setMinRank] = useState("any");
  const [maxRank, setMaxRank] = useState("any");
  const [minMinutes, setMinMinutes] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [selectedModes, setSelectedModes] = useState([]); // array of mode values

  const fetchBrowse = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (creator) params.set("creator", creator);
    if (minRank !== "any") params.set("min_rank", minRank);
    if (maxRank !== "any") params.set("max_rank", maxRank);
    if (minMinutes) params.set("min_duration", String(parseFloat(minMinutes) * 60));
    if (maxMinutes) params.set("max_duration", String(parseFloat(maxMinutes) * 60));
    if (selectedModes.length > 0) params.set("game_mode", selectedModes.join(","));
    const { data } = await publicApi.get(`/quizzes?${params.toString()}`);
    setAllQuizzes(data);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const cli = await api();
      const [m, s, h, f] = await Promise.all([
        cli.get("/quizzes?mine=true&include_drafts=true"),
        cli.get("/me/stats"),
        cli.get("/me/attempts"),
        cli.get("/me/favorites"),
      ]);
      setMyQuizzes(m.data);
      setStats(s.data);
      setHistory(h.data);
      setFavorites(f.data);
      await fetchBrowse();
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, []);

  // Re-fetch browse when filter inputs change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      fetchBrowse().catch(() => {});
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, creator, minRank, maxRank, minMinutes, maxMinutes, selectedModes]);

  const deleteQuiz = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    try {
      const cli = await api();
      await cli.delete(`/quizzes/${id}`);
      toast.success("Quiz deleted");
      loadAll();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const toggleFavQuiz = async (quizId) => {
    const isFav = favorites.quiz_ids.includes(quizId);
    try {
      const cli = await api();
      if (isFav) await cli.delete(`/me/favorites/quizzes/${quizId}`);
      else await cli.post(`/me/favorites/quizzes/${quizId}`);
      const { data } = await cli.get(`/me/favorites`);
      setFavorites(data);
      toast.success(isFav ? "Removed from favorites" : "Saved to favorites");
    } catch {
      toast.error("Couldn't update favorite");
    }
  };

  const toggleFavCreator = async (creatorId) => {
    const isFav = favorites.creator_ids.includes(creatorId);
    try {
      const cli = await api();
      if (isFav) await cli.delete(`/me/favorites/creators/${creatorId}`);
      else await cli.post(`/me/favorites/creators/${creatorId}`);
      const { data } = await cli.get(`/me/favorites`);
      setFavorites(data);
    } catch {
      toast.error("Couldn't update favorite");
    }
  };

  const clearFilters = () => {
    setQ("");
    setCreator("");
    setMinRank("any");
    setMaxRank("any");
    setMinMinutes("");
    setMaxMinutes("");
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (q) n++;
    if (creator) n++;
    if (minRank !== "any") n++;
    if (maxRank !== "any") n++;
    if (minMinutes) n++;
    if (maxMinutes) n++;
    return n;
  }, [q, creator, minRank, maxRank, minMinutes, maxMinutes]);

  if (loading) return <LoadingRule label="Booting Replay Vault" />;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
              /// COMMAND CENTER
            </div>
            <h1 className="font-display font-black uppercase text-4xl sm:text-5xl">
              GG, {user?.user_metadata?.display_name || user?.email?.split("@")[0]}
            </h1>
          </div>
          <Link to="/quizzes/new" data-testid="dashboard-create-quiz-button">
            <button className="btn-boost hud-clip px-6 py-3 text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Quiz
            </button>
          </Link>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" data-testid="dashboard-stats">
          <StatBox icon={<Trophy className="w-5 h-5" />} label="BEST SCORE" v={`${stats?.best_score ?? 0}%`} accent="orange" />
          <StatBox icon={<Target className="w-5 h-5" />} label="AVG SCORE" v={`${stats?.avg_score ?? 0}%`} accent="blue" />
          <StatBox icon={<Brain className="w-5 h-5" />} label="ATTEMPTS" v={stats?.attempts ?? 0} accent="orange" />
          <StatBox icon={<PlayCircle className="w-5 h-5" />} label="QUIZZES BUILT" v={stats?.quizzes_created ?? 0} accent="blue" />
        </div>

        <Tabs defaultValue="play">
          <TabsList className="bg-transparent border border-white/10 rounded-none p-0 h-auto flex-wrap">
            <TabsTrigger value="play" className="rounded-none data-[state=active]:bg-[#ff6b00] data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="tab-browse">Browse</TabsTrigger>
            <TabsTrigger value="mine" className="rounded-none data-[state=active]:bg-[#007aff] data-[state=active]:text-white font-display uppercase tracking-wider px-5 py-2" data-testid="tab-mine">My Quizzes</TabsTrigger>
            <TabsTrigger value="favs" className="rounded-none data-[state=active]:bg-[#ffd500] data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="tab-favorites">Favorites</TabsTrigger>
            <TabsTrigger value="history" className="rounded-none data-[state=active]:bg-zinc-200 data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          {/* BROWSE */}
          <TabsContent value="play" className="mt-6">
            <SearchAndFilters
              {...{ q, setQ, creator, setCreator, minRank, setMinRank, maxRank, setMaxRank, minMinutes, setMinMinutes, maxMinutes, setMaxMinutes, selectedModes, setSelectedModes }}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              activeCount={activeFilterCount}
              onClear={clearFilters}
            />
            {allQuizzes.length === 0 ? (
              <EmptyState title="No quizzes match." sub="Loosen your filters or be the first to build one." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="quiz-grid-browse">
                {allQuizzes.map((q) => (
                  <QuizCard key={q.id} q={q} isFav={favorites.quiz_ids.includes(q.id)} onFav={() => toggleFavQuiz(q.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* MY QUIZZES */}
          <TabsContent value="mine" className="mt-6">
            {myQuizzes.length === 0 ? (
              <EmptyState
                title="You haven't built a quiz yet."
                sub="Become a creator. Best way to learn is to teach."
                cta={
                  <Link to="/quizzes/new">
                    <button className="btn-boost hud-clip px-5 py-2 text-xs mt-4">+ Build first quiz</button>
                  </Link>
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="quiz-grid-mine">
                {myQuizzes.map((q) => (
                  <QuizCard key={q.id} q={q} owner onDelete={() => deleteQuiz(q.id)} isFav={favorites.quiz_ids.includes(q.id)} onFav={() => toggleFavQuiz(q.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* FAVORITES */}
          <TabsContent value="favs" className="mt-6 space-y-8">
            <div>
              <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ffd500] mb-3">// FAVORITE QUIZZES</div>
              {favorites.quizzes.length === 0 ? (
                <EmptyState title="No favorite quizzes yet." sub="Tap the star icon on any quiz card to save it." />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="quiz-grid-favs">
                  {favorites.quizzes.map((qz) => (
                    <QuizCard key={qz.id} q={qz} isFav onFav={() => toggleFavQuiz(qz.id)} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ffd500] mb-3">// FAVORITE CREATORS</div>
              {favorites.creators.length === 0 ? (
                <EmptyState title="No favorite creators yet." sub="Follow a creator from their card to see their quizzes here." />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="creator-grid-favs">
                  {favorites.creators.map((c) => (
                    <CreatorCard
                      key={c.creator_id}
                      c={c}
                      onUnfav={() => toggleFavCreator(c.creator_id)}
                      onSearch={() => { setCreator(c.creator_name); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-6">
            {history.length === 0 ? (
              <EmptyState title="No quiz history yet." sub="Play a quiz to start building your training log." />
            ) : (
              <div className="space-y-2" data-testid="history-list">
                {history.map((h) => (
                  <HistoryRow key={h.id} h={h} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatBox({ icon, label, v, accent }) {
  const color = accent === "orange" ? "#ff6b00" : "#007aff";
  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono-rl text-[10px] tracking-widest text-zinc-500">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="font-display font-black text-3xl" style={{ color }}>
        {v}
      </div>
    </div>
  );
}

function SearchAndFilters({
  q, setQ, creator, setCreator,
  minRank, setMinRank, maxRank, setMaxRank,
  minMinutes, setMinMinutes, maxMinutes, setMaxMinutes,
  selectedModes, setSelectedModes,
  showFilters, setShowFilters, activeCount, onClear,
}) {
  const toggleMode = (v) => {
    setSelectedModes((cur) => (cur.includes(v) ? cur.filter((m) => m !== v) : [...cur, v]));
  };
  return (
    <div className="mb-6">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quiz title..."
            className="bg-zinc-950 border-white/10 rounded-none pl-10"
            data-testid="search-quiz-input"
          />
        </div>
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            placeholder="Search creator..."
            className="bg-zinc-950 border-white/10 rounded-none pl-10"
            data-testid="search-creator-input"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`px-4 py-2 border ${showFilters ? "border-[#ff6b00] text-[#ff6b00]" : "border-white/10 text-zinc-300"} font-display uppercase text-xs tracking-wider inline-flex items-center gap-1.5`}
          data-testid="filters-toggle-button"
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeCount > 0 && (
            <span className="ml-1 bg-[#ff6b00] text-black w-5 h-5 inline-flex items-center justify-center font-mono-rl text-[10px]">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="px-3 py-2 border border-white/10 text-zinc-400 hover:text-white text-xs font-mono-rl tracking-widest inline-flex items-center gap-1"
            data-testid="filters-clear-button"
          >
            <X className="w-3.5 h-3.5" /> CLEAR
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-3 hud-clip border border-white/10 bg-[#0a0a0a] p-4 space-y-4" data-testid="filters-panel">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-1">MIN RANK</div>
              <Select value={String(minRank)} onValueChange={(v) => setMinRank(v === "any" ? "any" : parseInt(v))}>
                <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none" data-testid="filter-min-rank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                  <SelectItem value="any">Any</SelectItem>
                  {RANKS.map((r) => <SelectItem key={r.v} value={String(r.v)}>{r.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-1">MAX RANK</div>
              <Select value={String(maxRank)} onValueChange={(v) => setMaxRank(v === "any" ? "any" : parseInt(v))}>
                <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none" data-testid="filter-max-rank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                  <SelectItem value="any">Any</SelectItem>
                  {RANKS.map((r) => <SelectItem key={r.v} value={String(r.v)}>{r.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-1">MIN MINUTES</div>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={minMinutes}
                onChange={(e) => setMinMinutes(e.target.value)}
                placeholder="e.g. 2"
                className="bg-zinc-950 border-white/10 rounded-none"
                data-testid="filter-min-minutes"
              />
            </div>
            <div>
              <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-1">MAX MINUTES</div>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={maxMinutes}
                onChange={(e) => setMaxMinutes(e.target.value)}
                placeholder="e.g. 10"
                className="bg-zinc-950 border-white/10 rounded-none"
                data-testid="filter-max-minutes"
              />
            </div>
          </div>
          <div>
            <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-2">GAME MODES (TOGGLE TO ADD)</div>
            <div className="flex flex-wrap gap-2" data-testid="filter-game-modes">
              {GAME_MODES.map((g) => {
                const on = selectedModes.includes(g.v);
                return (
                  <button
                    key={g.v}
                    onClick={() => toggleMode(g.v)}
                    className={`px-3 py-1.5 text-xs font-display uppercase tracking-wider border transition ${
                      on
                        ? "border-[#ff6b00] bg-[#ff6b00]/15 text-[#ff6b00]"
                        : "border-white/10 text-zinc-400 hover:border-white/30 hover:text-zinc-200"
                    }`}
                    data-testid={`filter-mode-${g.v}`}
                  >
                    {g.l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizCard({ q, owner, onDelete, isFav, onFav }) {
  const thumb = `https://i.ytimg.com/vi/${q.video_id}/hqdefault.jpg`;
  const min = q.min_rank ?? 1;
  const max = q.max_rank ?? 8;
  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] overflow-hidden group hover:border-[#ff6b00]/60 transition-all" data-testid={`quiz-card-${q.id}`}>
      <div className="relative aspect-video bg-black">
        <img src={thumb} alt={q.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <span className="absolute top-2 left-2 tag">{q.questions?.length || 0} Q</span>
        {q.game_mode && (
          <span
            className="absolute top-2 left-14 tag"
            style={{ borderColor: "#007aff", color: "#69b8ff" }}
            data-testid={`quiz-mode-${q.id}`}
          >
            {modeLabel(q.game_mode)}
          </span>
        )}
        {q.is_draft && (
          <span
            className="absolute bottom-2 right-2 tag"
            style={{ borderColor: "#ffd500", color: "#ffd500" }}
            data-testid={`quiz-draft-badge-${q.id}`}
          >
            DRAFT
          </span>
        )}
        {q.duration_seconds ? (
          <span className="absolute bottom-2 left-2 tag inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatTime(q.duration_seconds)}
          </span>
        ) : null}
        {onFav && (
          <button
            onClick={onFav}
            className={`absolute top-2 right-2 p-1.5 border ${isFav ? "border-[#ffd500] bg-[#ffd500]/10 text-[#ffd500]" : "border-white/20 bg-black/40 text-zinc-300"} hover:scale-105 transition`}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
            data-testid={`favorite-quiz-${q.id}`}
          >
            <Star className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
      <div className="p-5">
        <div className="font-display font-bold uppercase text-lg leading-tight line-clamp-2">{q.title}</div>
        <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500 mt-1">
          BY {q.creator_name?.toUpperCase()} // {q.play_count} PLAYS
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] font-mono-rl tracking-widest">
          <span className="px-1.5 py-0.5 border" style={{ borderColor: rankColor(min), color: rankColor(min) }}>
            {rankLabel(min).toUpperCase()}
          </span>
          <span className="text-zinc-600">→</span>
          <span className="px-1.5 py-0.5 border" style={{ borderColor: rankColor(max), color: rankColor(max) }}>
            {rankLabel(max).toUpperCase()}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <Link to={`/quizzes/${q.id}/play`} className="flex-1" data-testid={`play-quiz-${q.id}`}>
            <button className="btn-boost hud-clip w-full py-2 text-xs inline-flex items-center justify-center gap-1.5">
              <PlayCircle className="w-4 h-4" /> Play
            </button>
          </Link>
          {owner && (
            <>
              <Link to={`/quizzes/${q.id}/edit`} data-testid={`edit-quiz-${q.id}`}>
                <button className="btn-ghost-volt hud-clip px-3 py-2">
                  <Pencil className="w-4 h-4" />
                </button>
              </Link>
              <button
                onClick={onDelete}
                className="border border-[#ff003c]/40 text-[#ff5577] px-3 py-2 hover:bg-[#ff003c]/10"
                data-testid={`delete-quiz-${q.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorCard({ c, onUnfav, onSearch }) {
  return (
    <div
      className="hud-clip border border-white/10 bg-[#0a0a0a] p-4 flex items-center gap-3"
      data-testid={`creator-card-${c.creator_id}`}
    >
      <div className="w-10 h-10 hud-clip bg-[#ffd500]/10 border border-[#ffd500]/40 flex items-center justify-center font-display font-black text-[#ffd500]">
        {(c.creator_name || "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold uppercase truncate">{c.creator_name || "—"}</div>
        <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500">{c.quiz_count} QUIZ{c.quiz_count === 1 ? "" : "ES"}</div>
      </div>
      <button onClick={onSearch} className="text-zinc-400 hover:text-white p-1.5" title="Show their quizzes" data-testid={`creator-show-${c.creator_id}`}>
        <Search className="w-4 h-4" />
      </button>
      <button onClick={onUnfav} className="text-[#ffd500] p-1.5" title="Unfavorite" data-testid={`creator-unfav-${c.creator_id}`}>
        <Star className="w-4 h-4 fill-current" />
      </button>
    </div>
  );
}

function HistoryRow({ h }) {
  const thumb = h.video_id ? `https://i.ytimg.com/vi/${h.video_id}/default.jpg` : null;
  const date = new Date(h.created_at);
  const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const scoreColor = h.score >= 75 ? "#00ff66" : h.score >= 50 ? "#ffd500" : "#ff003c";
  return (
    <Link
      to={`/quizzes/${h.quiz_id}/results/${h.id}`}
      className="block hud-clip border border-white/10 bg-[#0a0a0a] p-3 hover:border-[#ff6b00]/60 transition-all"
      data-testid={`history-row-${h.id}`}
    >
      <div className="flex items-center gap-3">
        {thumb && <img src={thumb} alt="" className="w-20 h-12 object-cover" />}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold uppercase truncate">{h.quiz_title}</div>
          <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500">
            BY {h.creator_name?.toUpperCase() || "—"} · {dateStr}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-black text-2xl" style={{ color: scoreColor }}>
            {h.score}%
          </div>
          <div className="font-mono-rl text-[10px] text-zinc-500">
            {h.correct_count}/{h.total_count}
          </div>
        </div>
        <HistoryIcon className="w-4 h-4 text-zinc-500" />
      </div>
    </Link>
  );
}

function EmptyState({ title, sub, cta }) {
  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-14 text-center">
      <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-3">
        // RULE #88: EMPTY VAULT = OPPORTUNITY
      </div>
      <div className="font-display font-black uppercase text-2xl">{title}</div>
      <div className="text-zinc-400 mt-2">{sub}</div>
      {cta}
    </div>
  );
}
