import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import YouTube from "react-youtube";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, publicApi, formatTime } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowUp, ArrowDown, SkipForward, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function QuizPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState(null); // current question object
  const [answers, setAnswers] = useState({}); // qid -> submission
  const [answeredIds, setAnsweredIds] = useState(new Set());
  const playerRef = useRef(null);
  const lastCheckedTime = useRef(-1);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await publicApi.get(`/quizzes/${id}`);
        // Sort questions by timestamp ascending
        data.questions = (data.questions || []).slice().sort((a, b) => a.timestamp - b.timestamp);
        setQuiz(data);
      } catch (e) {
        toast.error("Quiz not found");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Poll time, trigger questions, lock seeking past unanswered
  useEffect(() => {
    if (!quiz) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      let now;
      try {
        now = p.getCurrentTime() || 0;
      } catch (_err) {
        return;
      }
      // Find earliest unanswered question with ts <= now
      const next = quiz.questions.find(
        (q) => !answeredIds.has(q.id) && q.timestamp <= now + 0.25
      );
      if (next && !activeQ) {
        // Pause and pop modal
        try { p.pauseVideo(); } catch (_e1) { /* ignore */ }
        // Snap to ts to avoid drift
        if (Math.abs(now - next.timestamp) > 1.0) {
          try { p.seekTo(next.timestamp, true); } catch (_e2) { /* ignore */ }
        }
        setActiveQ(next);
      }
      lastCheckedTime.current = now;
    }, 250);
    return () => clearInterval(t);
  }, [quiz, activeQ, answeredIds]);

  const onReady = (e) => (playerRef.current = e.target);

  const recordAnswer = (submission, skipped = false) => {
    if (!activeQ) return;
    setAnswers((a) => ({ ...a, [activeQ.id]: { ...submission, skipped, question_id: activeQ.id, type: activeQ.type } }));
    setAnsweredIds((s) => new Set([...s, activeQ.id]));
    setActiveQ(null);
    setTimeout(() => {
      try { playerRef.current?.playVideo(); } catch (_e) { /* ignore */ }
    }, 200);
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    // Auto-skip any remaining (e.g., end-of-video questions never reached)
    const all = quiz.questions.map((q) => {
      const a = answers[q.id];
      if (a) return a;
      return { question_id: q.id, type: q.type, selected: [], confidence: null, text: "", skipped: true };
    });
    try {
      const cli = await api();
      const { data } = await cli.post("/attempts", { quiz_id: quiz.id, answers: all });
      navigate(`/quizzes/${quiz.id}/results/${data.id}`);
    } catch (e) {
      toast.error("Submission failed");
    }
  };

  const allAnswered = quiz && quiz.questions.every((q) => answeredIds.has(q.id));

  if (loading || !quiz) return <LoadingRule label="Loading Replay" />;

  const totalQ = quiz.questions.length;
  const answeredN = answeredIds.size;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
          /// LIVE TRAINING
        </div>
        <div className="flex justify-between items-end flex-wrap gap-3 mb-6">
          <h1 className="font-display font-black uppercase text-3xl sm:text-4xl">{quiz.title}</h1>
          <div className="font-mono-rl text-xs text-zinc-400" data-testid="quiz-progress">
            ANSWERED <span className="text-[#ff6b00]">{answeredN}</span>/{totalQ}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-900 mb-4 relative">
          <div
            className="h-full bg-[#ff6b00] transition-all"
            style={{ width: `${(answeredN / Math.max(1, totalQ)) * 100}%` }}
          />
          {quiz.questions.map((q, i) => (
            <div
              key={q.id}
              className={`absolute top-1/2 -translate-y-1/2 w-2 h-3 ${
                answeredIds.has(q.id) ? "bg-[#00ff66]" : "bg-[#007aff]"
              }`}
              style={{ left: `${(i / Math.max(1, totalQ - 1)) * 100}%` }}
              title={formatTime(q.timestamp)}
            />
          ))}
        </div>

        <div className="relative aspect-video bg-black border border-white/10" data-testid="quiz-video-container">
          <YouTube
            videoId={quiz.video_id}
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                rel: 0,
                modestbranding: 1,
                disablekb: 1,
                controls: 1,
              },
            }}
            onReady={onReady}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
          {activeQ && (
            <QuestionOverlay
              key={activeQ.id}
              q={activeQ}
              onAnswer={recordAnswer}
              onSkip={() => recordAnswer({ selected: [], confidence: null, text: "" }, true)}
            />
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div className="text-xs text-zinc-500 font-mono-rl tracking-wider flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-[#ffd500]" />
            VIDEO LOCKS AT EACH QUESTION. NO PEEKING — THAT&apos;S RULE #1.
          </div>
          <button
            onClick={submitQuiz}
            disabled={!allAnswered}
            className="btn-boost hud-clip px-6 py-3 text-sm inline-flex items-center gap-2"
            data-testid="quiz-submit-button"
          >
            Submit & See Results <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionOverlay({ q, onAnswer, onSkip }) {
  const [selected, setSelected] = useState([]);
  const [confidence, setConfidence] = useState(3);
  const [text, setText] = useState("");
  const [rankOrder, setRankOrder] = useState(() => q.options.map((_, i) => i));

  const toggleSel = (i) => {
    if (q.type === "single") setSelected([i]);
    else if (q.type === "multi") {
      const s = new Set(selected);
      s.has(i) ? s.delete(i) : s.add(i);
      setSelected(Array.from(s).sort());
    }
  };
  const moveRank = (i, dir) => {
    const a = [...rankOrder];
    const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setRankOrder(a);
  };

  const canSubmit =
    q.type === "single" ? selected.length === 1 :
    q.type === "multi" ? selected.length > 0 :
    q.type === "rank" ? true :
    q.type === "confidence" ? confidence >= 1 && confidence <= 5 :
    q.type === "short" ? text.trim().length > 0 :
    false;

  const submit = () => {
    if (!canSubmit) return;
    if (q.type === "rank") onAnswer({ selected: rankOrder, confidence: null, text: "" });
    else if (q.type === "confidence") onAnswer({ selected: [], confidence, text: "" });
    else if (q.type === "short") onAnswer({ selected: [], confidence: null, text: text.trim() });
    else onAnswer({ selected, confidence: null, text: "" });
  };

  return (
    <div
      className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 hud-in"
      data-testid="question-overlay"
    >
      <div className="hud-clip hud-border bg-black/95 max-w-2xl w-full p-6 sm:p-8 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00]">
            /// DECISION POINT {formatTime(q.timestamp)}
          </div>
          <span className="tag">{q.type.toUpperCase()}</span>
        </div>
        <div className="font-display font-bold uppercase text-xl sm:text-2xl mb-5 leading-snug" data-testid="question-prompt">
          {q.prompt || "Make the call."}
        </div>

        {(q.type === "single" || q.type === "multi") && (
          <div className="space-y-2 mb-5">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => toggleSel(i)}
                className={`w-full text-left px-4 py-3 border flex items-center gap-3 transition-all ${
                  selected.includes(i)
                    ? "border-[#ff6b00] bg-[#ff6b00]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/30"
                }`}
                data-testid={`overlay-option-${i}`}
              >
                <span className={`font-mono-rl text-xs w-6 ${selected.includes(i) ? "text-[#ff6b00]" : "text-zinc-500"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm flex-1">{opt}</span>
              </button>
            ))}
          </div>
        )}

        {q.type === "rank" && (
          <div className="space-y-2 mb-5">
            {rankOrder.map((origIdx, displayIdx) => (
              <div key={origIdx} className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-white/[0.02]">
                <span className="font-mono-rl text-xs w-6 text-[#ff6b00]">#{displayIdx + 1}</span>
                <span className="text-sm flex-1">{q.options[origIdx]}</span>
                <button onClick={() => moveRank(displayIdx, -1)} className="p-1.5 border border-white/10" data-testid={`overlay-rank-up-${displayIdx}`}>
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveRank(displayIdx, 1)} className="p-1.5 border border-white/10" data-testid={`overlay-rank-down-${displayIdx}`}>
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {q.type === "confidence" && (
          <div className="mb-5">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfidence(n)}
                  className={`flex-1 py-4 border font-display font-black text-xl ${
                    confidence === n
                      ? "border-[#ff6b00] bg-[#ff6b00]/10 text-[#ff6b00]"
                      : "border-white/10 text-zinc-400 hover:border-white/30"
                  }`}
                  data-testid={`overlay-confidence-${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="font-mono-rl text-[10px] text-zinc-500 mt-2 flex justify-between">
              <span>NOT SURE</span>
              <span>LOCKED IN</span>
            </div>
          </div>
        )}

        {q.type === "short" && (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Explain your read..."
            className="bg-zinc-950 border-white/10 rounded-none mb-5"
            rows={4}
            data-testid="overlay-short-input"
          />
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onSkip}
            className="btn-ghost-volt hud-clip px-4 py-2 text-xs inline-flex items-center gap-1.5"
            data-testid="overlay-skip-button"
          >
            <SkipForward className="w-4 h-4" /> Skip
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="btn-boost hud-clip px-5 py-2 text-xs inline-flex items-center gap-1.5"
            data-testid="overlay-submit-button"
          >
            Lock In <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
