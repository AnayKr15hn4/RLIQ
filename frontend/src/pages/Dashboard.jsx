/* eslint-disable */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, publicApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PlayCircle,
  Plus,
  Trash2,
  Trophy,
  Target,
  Brain,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allQuizzes, setAllQuizzes] = useState([]);
  const [myQuizzes, setMyQuizzes] = useState([]);
  const [stats, setStats] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const cli = await api();
      const [a, m, s] = await Promise.all([
        publicApi.get("/quizzes"),
        cli.get("/quizzes?mine=true"),
        cli.get("/me/stats"),
      ]);
      setAllQuizzes(a.data);
      setMyQuizzes(m.data);
      setStats(s.data);
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteQuiz = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    try {
      const cli = await api();
      await cli.delete(`/quizzes/${id}`);
      toast.success("Quiz deleted");
      load();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

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
          <TabsList className="bg-transparent border border-white/10 rounded-none p-0 h-auto">
            <TabsTrigger
              value="play"
              className="rounded-none data-[state=active]:bg-[#ff6b00] data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2"
              data-testid="tab-browse"
            >
              Browse Quizzes
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="rounded-none data-[state=active]:bg-[#007aff] data-[state=active]:text-white font-display uppercase tracking-wider px-5 py-2"
              data-testid="tab-mine"
            >
              My Quizzes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="play" className="mt-6">
            {allQuizzes.length === 0 ? (
              <EmptyState
                title="No quizzes in the vault yet."
                sub="Be the first creator. Drop a replay, plant questions, train your squad."
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="quiz-grid-browse">
                {allQuizzes.map((q) => (
                  <QuizCard key={q.id} q={q} />
                ))}
              </div>
            )}
          </TabsContent>

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
                  <QuizCard key={q.id} q={q} owner onDelete={() => deleteQuiz(q.id)} />
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

function QuizCard({ q, owner, onDelete }) {
  const thumb = `https://i.ytimg.com/vi/${q.video_id}/hqdefault.jpg`;
  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] overflow-hidden group hover:border-[#ff6b00]/60 transition-all" data-testid={`quiz-card-${q.id}`}>
      <div className="relative aspect-video bg-black">
        <img src={thumb} alt={q.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <span className="absolute top-2 left-2 tag">
          {q.questions?.length || 0} Q
        </span>
        <span className="absolute top-2 right-2 tag">
          {q.difficulty?.toUpperCase()}
        </span>
      </div>
      <div className="p-5">
        <div className="font-display font-bold uppercase text-lg leading-tight line-clamp-2">{q.title}</div>
        <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500 mt-1">
          BY {q.creator_name?.toUpperCase()} // {q.play_count} PLAYS
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
