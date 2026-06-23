import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, publicApi, formatTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, XCircle, MinusCircle, ArrowRight, RotateCcw, Trophy, Medal } from "lucide-react";

export default function Results() {
  const { id, attemptId } = useParams();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cli = await api();
        const [a, q, lb] = await Promise.all([
          cli.get(`/attempts/${attemptId}`),
          publicApi.get(`/quizzes/${id}`),
          publicApi.get(`/quizzes/${id}/leaderboard?limit=10`),
        ]);
        q.data.questions = (q.data.questions || []).slice().sort((x, y) => x.timestamp - y.timestamp);
        setAttempt(a.data);
        setQuiz(q.data);
        setLeaderboard(lb.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, attemptId]);

  if (loading || !attempt || !quiz) return <LoadingRule label="Tallying The Score" />;

  const scoreColor =
    attempt.score >= 75 ? "#00ff66" : attempt.score >= 50 ? "#ffd500" : "#ff003c";

  const qMap = Object.fromEntries(quiz.questions.map((q) => [q.id, q]));

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
          /// MATCH SUMMARY
        </div>
        <h1 className="font-display font-black uppercase text-3xl sm:text-4xl mb-6">{quiz.title}</h1>

        <div className="hud-clip hud-border bg-[#0a0a0a] p-8 mb-8 text-center" data-testid="results-score-card">
          <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: scoreColor }} />
          <div className="font-display font-black uppercase text-7xl" style={{ color: scoreColor }}>
            {attempt.score}%
          </div>
          <div className="font-mono-rl text-xs tracking-widest text-zinc-400 mt-2">
            {attempt.correct_count} / {attempt.total_count} CORRECT
          </div>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Link to={`/quizzes/${quiz.id}/play`} data-testid="results-retry-button">
              <button className="btn-boost hud-clip px-6 py-3 text-sm inline-flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Run It Back
              </button>
            </Link>
            <Link to="/dashboard" data-testid="results-dashboard-button">
              <button className="btn-ghost-volt hud-clip px-6 py-3 text-sm inline-flex items-center gap-2">
                More Quizzes <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>

        {/* LEADERBOARD */}
        {leaderboard && leaderboard.entries.length > 0 && (
          <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-6 mb-8" data-testid="results-leaderboard">
            <div className="flex items-center gap-2 mb-4">
              <Medal className="w-5 h-5 text-[#ffd500]" />
              <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ffd500]">
                /// LEADERBOARD — TOP {leaderboard.entries.length}
              </div>
            </div>
            <div className="space-y-1">
              {leaderboard.entries.map((row) => {
                const isMine = user?.id && row.user_id === user.id;
                const isTop3 = row.rank <= 3;
                const rankColor = row.rank === 1 ? "#ffd500" : row.rank === 2 ? "#c0c0c0" : row.rank === 3 ? "#cd7f32" : "#71717a";
                return (
                  <div
                    key={row.attempt_id}
                    className={`flex items-center gap-4 px-3 py-2 ${
                      isMine ? "bg-[#ff6b00]/10 border border-[#ff6b00]/40" : "border border-white/5"
                    }`}
                    data-testid={`leaderboard-row-${row.rank}`}
                  >
                    <div
                      className="font-display font-black text-xl w-8 text-center"
                      style={{ color: rankColor }}
                    >
                      {isTop3 ? `#${row.rank}` : row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold uppercase truncate">
                        {row.user_name || "—"}
                        {isMine && (
                          <span className="ml-2 font-mono-rl text-[10px] text-[#ff6b00] tracking-widest">// YOU</span>
                        )}
                      </div>
                      <div className="font-mono-rl text-[10px] text-zinc-500">
                        {row.correct_count}/{row.total_count} CORRECT
                      </div>
                    </div>
                    <div className="font-display font-black text-xl text-white">{row.score}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {attempt.answers.map((a, idx) => {
            const q = qMap[a.question_id];
            if (!q) return null;
            return (
              <div
                key={a.question_id}
                className={`hud-clip border ${
                  a.skipped ? "border-zinc-700" : a.correct ? "border-[#00ff66]/50" : "border-[#ff003c]/50"
                } bg-[#0a0a0a] p-5`}
                data-testid={`result-question-${idx}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {a.skipped ? (
                    <MinusCircle className="w-5 h-5 text-zinc-500" />
                  ) : a.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-[#00ff66]" />
                  ) : (
                    <XCircle className="w-5 h-5 text-[#ff003c]" />
                  )}
                  <span className="font-mono-rl text-xs text-[#007aff]">{formatTime(q.timestamp)}</span>
                  <span className="tag">{q.type}</span>
                  <span className="ml-auto font-mono-rl text-[10px] text-zinc-500">
                    Q{idx + 1}
                  </span>
                </div>
                <div className="font-display font-bold uppercase mb-3">{q.prompt}</div>

                {(q.type === "single" || q.type === "multi") && (
                  <div className="space-y-1.5 mb-3">
                    {q.options.map((opt, i) => {
                      const isCorrect = (q.correct || []).includes(i);
                      const wasSelected = (a.selected || []).includes(i);
                      return (
                        <div
                          key={i}
                          className={`px-3 py-2 text-sm flex items-center gap-2 border ${
                            isCorrect
                              ? "border-[#00ff66]/50 bg-[#00ff66]/5"
                              : wasSelected
                              ? "border-[#ff003c]/50 bg-[#ff003c]/5"
                              : "border-white/5 bg-white/[0.02]"
                          }`}
                        >
                          <span className="font-mono-rl text-xs w-4">{String.fromCharCode(65 + i)}</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <span className="font-mono-rl text-[10px] text-[#00ff66] tracking-widest">CORRECT</span>}
                          {!isCorrect && wasSelected && (
                            <span className="font-mono-rl text-[10px] text-[#ff003c] tracking-widest">YOUR PICK</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "rank" && (
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <RankCol title="YOUR ORDER" indices={a.selected || []} q={q} bad={!a.correct && !a.skipped} />
                    <RankCol title="CORRECT ORDER" indices={q.correct || []} q={q} good />
                  </div>
                )}

                {q.type === "confidence" && (
                  <div className="text-sm mb-3">
                    Your confidence: <span className="font-mono-rl text-[#ff6b00]">{a.confidence ?? "—"}</span>
                    {" · "}Ideal: <span className="font-mono-rl text-[#00ff66]">{q.ideal_confidence}</span>
                  </div>
                )}

                {q.type === "short" && (
                  <div className="text-sm mb-3">
                    <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500 mb-1">YOUR ANSWER</div>
                    <div className="bg-black/40 border border-white/10 px-3 py-2 italic">
                      {a.text || <span className="text-zinc-600">— skipped —</span>}
                    </div>
                  </div>
                )}

                {q.explanation && (
                  <div className="mt-3 p-3 border-l-2 border-[#ff6b00] bg-[#ff6b00]/5">
                    <div className="font-mono-rl text-[10px] tracking-widest text-[#ff6b00] mb-1">// COACH NOTES</div>
                    <div className="text-sm text-zinc-200">{q.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RankCol({ title, indices, q, good, bad }) {
  return (
    <div>
      <div className={`font-mono-rl text-[10px] tracking-widest mb-2 ${good ? "text-[#00ff66]" : bad ? "text-[#ff003c]" : "text-zinc-400"}`}>
        {title}
      </div>
      <div className="space-y-1">
        {indices.map((origIdx, displayIdx) => (
          <div key={displayIdx} className="px-3 py-2 text-sm border border-white/10 bg-white/[0.02] flex gap-2">
            <span className="font-mono-rl text-xs text-[#ff6b00]">#{displayIdx + 1}</span>
            <span>{q.options[origIdx]}</span>
          </div>
        ))}
        {indices.length === 0 && <div className="text-xs text-zinc-600 italic">— skipped —</div>}
      </div>
    </div>
  );
}
