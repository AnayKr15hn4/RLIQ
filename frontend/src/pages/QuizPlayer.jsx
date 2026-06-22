/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import YouTube from "react-youtube";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, publicApi, formatTime } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  XCircle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Client-side grader (mirrors backend grade_answer)
function grade(q, sub) {
  if (sub.skipped) return false;
  if (q.type === "single") return sub.selected.length === 1 && JSON.stringify(sub.selected) === JSON.stringify(q.correct);
  if (q.type === "multi") return JSON.stringify([...sub.selected].sort()) === JSON.stringify([...(q.correct || [])].sort());
  if (q.type === "rank") return JSON.stringify(sub.selected) === JSON.stringify(q.correct);
  if (q.type === "confidence") {
    if (q.ideal_confidence == null || sub.confidence == null) return false;
    return Math.abs(sub.confidence - q.ideal_confidence) <= 1;
  }
  if (q.type === "short") return (sub.text || "").trim().length > 0;
  return false;
}

export default function QuizPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answeredIds, setAnsweredIds] = useState(new Set());
  const [feedback, setFeedback] = useState(null); // {q, correct, sub}

  // player state
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2); // 1x

  useEffect(() => {
    (async () => {
      try {
        const { data } = await publicApi.get(`/quizzes/${id}`);
        data.questions = (data.questions || []).slice().sort((a, b) => a.timestamp - b.timestamp);
        setQuiz(data);
      } catch {
        toast.error("Quiz not found");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Lock-ahead barrier = earliest unanswered question's timestamp (or duration if all answered)
  const barrier = (() => {
    if (!quiz) return Infinity;
    const next = quiz.questions.find((q) => !answeredIds.has(q.id));
    return next ? next.timestamp : duration || Infinity;
  })();

  // Poll time + trigger questions
  useEffect(() => {
    if (!quiz) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      let now;
      try { now = p.getCurrentTime() || 0; } catch { return; }
      setCurrentTime(now);

      if (!duration) {
        try { const d = p.getDuration() || 0; if (d) setDuration(d); } catch {}
      }

      // Enforce lock-ahead: if user somehow gets past barrier (shouldn't, but safety), pull back
      if (now > barrier + 0.5 && !activeQ && !feedback) {
        try { p.seekTo(barrier, true); } catch {}
      }

      // Trigger question
      const next = quiz.questions.find((q) => !answeredIds.has(q.id) && q.timestamp <= now + 0.25);
      if (next && !activeQ && !feedback) {
        try { p.pauseVideo(); } catch {}
        if (Math.abs(now - next.timestamp) > 1.0) {
          try { p.seekTo(next.timestamp, true); } catch {}
        }
        setActiveQ(next);
      }
    }, 250);
    return () => clearInterval(t);
  }, [quiz, activeQ, answeredIds, duration, barrier, feedback]);

  const onReady = (e) => {
    playerRef.current = e.target;
    try { setDuration(e.target.getDuration() || 0); } catch {}
  };
  const onStateChange = (e) => {
    // 1=playing, 2=paused, 0=ended
    setIsPlaying(e.data === 1);
  };

  // ====== Controls ======
  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (activeQ || feedback) return; // locked
    try {
      if (isPlaying) p.pauseVideo();
      else p.playVideo();
    } catch {}
  };
  const rewind10 = () => {
    const p = playerRef.current;
    if (!p) return;
    try { p.seekTo(Math.max(0, (p.getCurrentTime() || 0) - 10), true); } catch {}
  };
  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    try { playerRef.current?.setPlaybackRate(SPEEDS[next]); } catch {}
  };
  const fullscreen = () => {
    const el = document.getElementById("rl-fs-wrap");
    if (!document.fullscreenElement && el?.requestFullscreen) el.requestFullscreen();
    else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
  };
  const seekTo = (sec) => {
    const target = Math.min(barrier, Math.max(0, sec));
    try { playerRef.current?.seekTo(target, true); } catch {}
  };

  // Detect fullscreen state changes
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ====== Answer flow ======
  const submitAnswer = (sub, skipped = false) => {
    if (!activeQ) return;
    const full = { question_id: activeQ.id, type: activeQ.type, selected: [], confidence: null, text: "", ...sub, skipped };
    const correct = !skipped && grade(activeQ, full);
    setAnswers((a) => ({ ...a, [activeQ.id]: full }));
    setFeedback({ q: activeQ, correct, sub: full, skipped });
    setActiveQ(null);
  };

  const continueAfterFeedback = () => {
    if (!feedback) return;
    setAnsweredIds((s) => new Set([...s, feedback.q.id]));
    setFeedback(null);
    setTimeout(() => { try { playerRef.current?.playVideo(); } catch {} }, 150);
  };

  const rewatch10 = () => {
    // Close active question modal temporarily, rewind 10s, play, will re-trigger
    if (activeQ) {
      const ts = activeQ.timestamp;
      setActiveQ(null);
      const target = Math.max(0, ts - 10);
      setTimeout(() => {
        try { playerRef.current?.seekTo(target, true); } catch {}
        try { playerRef.current?.playVideo(); } catch {}
      }, 100);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    const all = quiz.questions.map((q) => {
      const a = answers[q.id];
      return a ?? { question_id: q.id, type: q.type, selected: [], confidence: null, text: "", skipped: true };
    });
    try {
      const cli = await api();
      const { data } = await cli.post("/attempts", { quiz_id: quiz.id, answers: all });
      navigate(`/quizzes/${quiz.id}/results/${data.id}`);
    } catch {
      toast.error("Submission failed");
    }
  };

  if (loading || !quiz) return <LoadingRule label="Loading Replay" />;

  const totalQ = quiz.questions.length;
  const answeredN = answeredIds.size;
  const allAnswered = answeredN === totalQ;
  const pct = duration ? (currentTime / duration) * 100 : 0;
  const barrierPct = duration ? Math.min(100, (barrier / duration) * 100) : 100;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end flex-wrap gap-3 mb-5">
          <div>
            <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
              /// LIVE TRAINING
            </div>
            <h1 className="font-display font-black uppercase text-3xl sm:text-4xl">{quiz.title}</h1>
          </div>
          <div className="font-mono-rl text-xs text-zinc-400" data-testid="quiz-progress">
            ANSWERED <span className="text-[#ff6b00]">{answeredN}</span>/{totalQ}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* LEFT: Video + custom controls */}
          <div className="lg:col-span-7">
            <div
              id="rl-fs-wrap"
              className={`relative bg-black ${isFullscreen ? "w-screen h-screen flex items-center" : ""}`}
              data-testid="rl-fs-wrap"
            >
              <div
                id="rl-video-wrap"
                className={`relative bg-black border border-white/10 ${
                  isFullscreen
                    ? activeQ || feedback
                      ? "w-[calc(100%-420px)] h-full"
                      : "w-full h-full"
                    : "aspect-video"
                }`}
                data-testid="quiz-video-container"
              >
              <YouTube
                videoId={quiz.video_id}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    rel: 0,
                    modestbranding: 1,
                    disablekb: 1,
                    controls: 0,        // hide YouTube native bar
                    fs: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                  },
                }}
                onReady={onReady}
                onStateChange={onStateChange}
                className="w-full h-full"
                iframeClassName="w-full h-full pointer-events-none"
              />
              {/* Block any direct interaction with the YouTube iframe */}
              <div className="absolute inset-0" onClick={togglePlay} data-testid="video-click-shield" />
              </div>

              {/* Fullscreen-only slide-in sidebar */}
              {isFullscreen && (activeQ || feedback) && (
                <div
                  className="absolute top-0 right-0 h-full w-[420px] bg-[#0a0a0a] border-l border-white/10 overflow-y-auto p-6 hud-in"
                  data-testid="fs-sidebar"
                >
                  {feedback ? (
                    <FeedbackPanel feedback={feedback} onContinue={continueAfterFeedback} />
                  ) : (
                    <QuestionPanel
                      key={activeQ.id}
                      q={activeQ}
                      onSubmit={(sub) => submitAnswer(sub)}
                      onSkip={() => submitAnswer({}, true)}
                      onRewatch={rewatch10}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Custom controls */}
            <div className="mt-3 bg-[#0a0a0a] border border-white/10 hud-clip p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={togglePlay}
                  disabled={!!activeQ || !!feedback}
                  className="w-9 h-9 flex items-center justify-center text-white hover:text-[#ff6b00] disabled:opacity-30"
                  data-testid="ctrl-play"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={rewind10}
                  className="w-9 h-9 flex items-center justify-center text-white hover:text-[#ff6b00]"
                  title="Back 10s"
                  data-testid="ctrl-rewind"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={cycleSpeed}
                  className="px-2 h-9 font-mono-rl text-xs text-white hover:text-[#ff6b00] border border-white/10"
                  data-testid="ctrl-speed"
                >
                  {SPEEDS[speedIdx]}x
                </button>
                <span className="font-mono-rl text-[11px] text-zinc-400 w-12 text-right" data-testid="ctrl-current-time">
                  {formatTime(currentTime)}
                </span>

                {/* Progress bar */}
                <div
                  className="relative flex-1 h-2 bg-zinc-800 cursor-pointer"
                  data-testid="ctrl-progress-bar"
                  onClick={(e) => {
                    if (!duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    seekTo(ratio * duration);
                  }}
                >
                  {/* watched portion */}
                  <div
                    className="absolute inset-y-0 left-0 bg-[#007aff]"
                    style={{ width: `${pct}%` }}
                  />
                  {/* locked region beyond barrier */}
                  <div
                    className="absolute inset-y-0 right-0 bg-[#1a1a1a] opacity-60"
                    style={{ width: `${Math.max(0, 100 - barrierPct)}%` }}
                  />
                  {/* question markers */}
                  {quiz.questions.map((q) => {
                    if (!duration) return null;
                    const left = (q.timestamp / duration) * 100;
                    const answered = answeredIds.has(q.id);
                    return (
                      <div
                        key={q.id}
                        className="absolute -top-2 -translate-x-1/2"
                        style={{ left: `${left}%` }}
                        title={`Question at ${formatTime(q.timestamp)}`}
                        data-testid={`ctrl-marker-${q.id}`}
                      >
                        <div
                          className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent ${
                            answered ? "border-t-[#00ff66]" : "border-t-[#ff6b00]"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <span className="font-mono-rl text-[11px] text-zinc-400 w-12" data-testid="ctrl-duration">
                  {formatTime(duration)}
                </span>
                <button
                  onClick={fullscreen}
                  className="w-9 h-9 flex items-center justify-center text-white hover:text-[#ff6b00]"
                  data-testid="ctrl-fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
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

          {/* RIGHT: Question / feedback panel */}
          <div className="lg:col-span-5">
            <div className="bg-[#0a0a0a] border border-white/10 hud-clip p-6 min-h-[420px]" data-testid="question-panel">
              {feedback ? (
                <FeedbackPanel feedback={feedback} onContinue={continueAfterFeedback} />
              ) : activeQ ? (
                <QuestionPanel
                  key={activeQ.id}
                  q={activeQ}
                  onSubmit={(sub) => submitAnswer(sub)}
                  onSkip={() => submitAnswer({}, true)}
                  onRewatch={rewatch10}
                />
              ) : (
                <IdlePanel
                  total={totalQ}
                  answered={answeredN}
                  isPlaying={isPlaying}
                  onPlay={togglePlay}
                  allAnswered={allAnswered}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdlePanel({ total, answered, isPlaying, onPlay, allAnswered }) {
  return (
    <div className="h-full flex flex-col justify-center items-center text-center" data-testid="idle-panel">
      <ListChecks className="w-10 h-10 text-[#ff6b00] mb-3" />
      <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">/// STAND-BY</div>
      <div className="font-display font-black uppercase text-2xl mb-2">
        {allAnswered ? "All questions answered." : "Press play to start training."}
      </div>
      <div className="text-zinc-400 text-sm max-w-xs">
        {allAnswered
          ? "Hit Submit to lock in your results."
          : `The video will pause at each question marker. ${answered}/${total} answered so far.`}
      </div>
      {!allAnswered && (
        <button
          onClick={onPlay}
          className="btn-boost hud-clip px-5 py-2 text-xs inline-flex items-center gap-1.5 mt-6"
          data-testid="idle-play-button"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? "Pause" : "Play"}
        </button>
      )}
    </div>
  );
}

function FeedbackPanel({ feedback, onContinue }) {
  const { q, correct, skipped } = feedback;
  return (
    <div data-testid="feedback-panel">
      <div className={`flex items-center gap-2 mb-3 font-mono-rl text-xs tracking-[0.3em] ${skipped ? "text-zinc-400" : correct ? "text-[#00ff66]" : "text-[#ff003c]"}`}>
        {skipped ? "/// SKIPPED" : correct ? "/// NICE READ" : "/// MISSED IT"}
      </div>
      <div className="flex items-center gap-3 mb-4">
        {skipped ? (
          <SkipForward className="w-8 h-8 text-zinc-400" />
        ) : correct ? (
          <CheckCircle2 className="w-8 h-8 text-[#00ff66]" />
        ) : (
          <XCircle className="w-8 h-8 text-[#ff003c]" />
        )}
        <div className="font-display font-black uppercase text-2xl">
          {skipped ? "Skipped" : correct ? "Correct" : "Not quite"}
        </div>
      </div>

      {(q.type === "single" || q.type === "multi") && (
        <div className="space-y-1.5 mb-4">
          {q.options.map((opt, i) => {
            const isC = (q.correct || []).includes(i);
            const wasS = (feedback.sub.selected || []).includes(i);
            return (
              <div
                key={i}
                className={`px-3 py-2 text-sm flex items-center gap-2 border ${
                  isC ? "border-[#00ff66]/50 bg-[#00ff66]/5" :
                  wasS ? "border-[#ff003c]/50 bg-[#ff003c]/5" :
                  "border-white/5 bg-white/[0.02]"
                }`}
              >
                <span className="font-mono-rl text-xs w-4">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{opt}</span>
                {isC && <CheckCircle2 className="w-4 h-4 text-[#00ff66]" />}
                {!isC && wasS && <XCircle className="w-4 h-4 text-[#ff003c]" />}
              </div>
            );
          })}
        </div>
      )}

      {q.type === "rank" && (
        <div className="space-y-2 mb-4 text-sm">
          <div className="font-mono-rl text-[10px] tracking-widest text-[#00ff66]">CORRECT ORDER</div>
          {(q.correct || []).map((origIdx, i) => (
            <div key={i} className="px-3 py-2 border border-white/10 bg-white/[0.02] flex gap-2">
              <span className="font-mono-rl text-xs text-[#ff6b00]">#{i + 1}</span>
              <span>{q.options[origIdx]}</span>
            </div>
          ))}
        </div>
      )}

      {q.type === "confidence" && !skipped && (
        <div className="text-sm mb-4">
          Your confidence: <span className="font-mono-rl text-[#ff6b00]">{feedback.sub.confidence}</span> · Ideal:{" "}
          <span className="font-mono-rl text-[#00ff66]">{q.ideal_confidence}</span>
        </div>
      )}

      {q.explanation && (
        <div className="p-3 border-l-2 border-[#ff6b00] bg-[#ff6b00]/5 mb-4">
          <div className="font-mono-rl text-[10px] tracking-widest text-[#ff6b00] mb-1">// COACH NOTES</div>
          <div className="text-sm text-zinc-200">{q.explanation}</div>
        </div>
      )}

      <button
        onClick={onContinue}
        className="btn-boost hud-clip w-full py-3 text-sm inline-flex items-center justify-center gap-1.5"
        data-testid="feedback-continue-button"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function QuestionPanel({ q, onSubmit, onSkip, onRewatch }) {
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
    q.type === "short" ? text.trim().length > 0 : false;

  const submit = () => {
    if (!canSubmit) return;
    if (q.type === "rank") onSubmit({ selected: rankOrder });
    else if (q.type === "confidence") onSubmit({ confidence });
    else if (q.type === "short") onSubmit({ text: text.trim() });
    else onSubmit({ selected });
  };

  const typeLabel = {
    single: "MULTIPLE-CHOICE QUESTION",
    multi: "MULTI-SELECT QUESTION",
    rank: "RANK THE OPTIONS",
    confidence: "CONFIDENCE RATING",
    short: "SHORT EXPLANATION",
  }[q.type];

  return (
    <div data-testid="question-overlay">
      <div className="inline-flex items-center gap-2 px-2 py-1 bg-[#007aff]/15 border border-[#007aff]/40 mb-4">
        <ListChecks className="w-4 h-4 text-[#007aff]" />
        <span className="font-mono-rl text-[10px] tracking-widest text-[#007aff]">{typeLabel}</span>
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
              <span className={`w-4 h-4 border ${selected.includes(i) ? "bg-[#ff6b00] border-[#ff6b00]" : "border-white/30"}`} />
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
                  confidence === n ? "border-[#ff6b00] bg-[#ff6b00]/10 text-[#ff6b00]" : "border-white/10 text-zinc-400 hover:border-white/30"
                }`}
                data-testid={`overlay-confidence-${n}`}
              >
                {n}
              </button>
            ))}
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

      <div className="flex gap-3 justify-between items-center pt-4 border-t border-white/10">
        <button
          onClick={onRewatch}
          className="font-display uppercase tracking-wider text-sm text-zinc-300 hover:text-[#007aff] inline-flex items-center gap-1.5"
          data-testid="overlay-rewatch-button"
          title="Back 10s and replay"
        >
          <RotateCcw className="w-4 h-4" /> Rewatch
        </button>
        <button
          onClick={onSkip}
          className="font-display uppercase tracking-wider text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1.5"
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
          Submit
        </button>
      </div>
    </div>
  );
}
