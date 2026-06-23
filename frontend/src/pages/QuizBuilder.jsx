/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import YouTube from "react-youtube";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api, extractYouTubeId, formatTime } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Pin,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { v: "single", l: "Single-Select" },
  { v: "multi", l: "Multi-Select" },
  { v: "rank", l: "Rank Options" },
  { v: "confidence", l: "Confidence Rating" },
  { v: "short", l: "Short Explanation" },
];

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

const uid = () => Math.random().toString(36).slice(2, 11);

export default function QuizBuilder({ edit }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!edit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [minRank, setMinRank] = useState(1);
  const [maxRank, setMaxRank] = useState(8);
  const [duration, setDuration] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoId = extractYouTubeId(youtubeUrl);

  useEffect(() => {
    if (!edit) return;
    (async () => {
      try {
        const cli = await api();
        const { data } = await cli.get(`/quizzes/${id}`);
        setTitle(data.title);
        setDescription(data.description || "");
        setYoutubeUrl(data.youtube_url);
        setMinRank(data.min_rank ?? 1);
        setMaxRank(data.max_rank ?? 8);
        setDuration(data.duration_seconds ?? null);
        setQuestions(data.questions || []);
      } catch (e) {
        toast.error("Failed to load quiz");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [edit, id, navigate]);

  // Poll player time
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p && p.getCurrentTime) {
        try {
          setCurrentTime(p.getCurrentTime() || 0);
        } catch (_err) {
          // player not ready
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  const onReady = (e) => {
    playerRef.current = e.target;
    try {
      const d = e.target.getDuration() || 0;
      if (d) setDuration(d);
    } catch {}
  };

  const addQuestion = () => {
    const newQ = {
      id: uid(),
      timestamp: Math.floor(currentTime),
      type: "single",
      prompt: "",
      options: ["", ""],
      correct: [],
      ideal_confidence: 3,
      explanation: "",
    };
    setQuestions((qs) => [...qs, newQ].sort((a, b) => a.timestamp - b.timestamp));
    setEditingIdx(questions.length);
  };

  const updateQ = (idx, patch) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const removeQ = (idx) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const seekTo = (ts) => {
    if (playerRef.current?.seekTo) playerRef.current.seekTo(ts, true);
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!videoId) return toast.error("Valid YouTube URL required");
    if (questions.length === 0) return toast.error("Add at least one question");
    if (maxRank < minRank) return toast.error("Max rank must be ≥ min rank");
    setSaving(true);
    try {
      const cli = await api();
      const payload = {
        title,
        description,
        youtube_url: youtubeUrl,
        min_rank: minRank,
        max_rank: maxRank,
        duration_seconds: duration,
        questions,
      };
      if (edit) {
        await cli.put(`/quizzes/${id}`, payload);
        toast.success("Quiz updated");
      } else {
        const { data } = await cli.post(`/quizzes`, payload);
        toast.success("Quiz created");
        navigate(`/dashboard`);
        return;
      }
      navigate("/dashboard");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingRule label="Loading Quiz" />;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#007aff] mb-2">
          /// {edit ? "EDIT" : "CREATE"} QUIZ
        </div>
        <h1 className="font-display font-black uppercase text-3xl sm:text-4xl mb-8">
          Build a Decision Drill
        </h1>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* LEFT: Player + Meta */}
          <div className="lg:col-span-7 space-y-6">
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-5">
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
                YOUTUBE URL
              </Label>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="bg-zinc-950 border-white/10 rounded-none mt-1 mb-4"
                data-testid="builder-youtube-input"
              />
              {videoId ? (
                <div className="aspect-video bg-black">
                  <YouTube
                    videoId={videoId}
                    opts={{
                      width: "100%",
                      height: "100%",
                      playerVars: { rel: 0, modestbranding: 1 },
                    }}
                    onReady={onReady}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-black border border-white/10 flex items-center justify-center text-zinc-500 font-mono-rl text-xs">
                  // PASTE A YOUTUBE URL TO BEGIN
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div className="font-mono-rl text-sm text-[#ff6b00]" data-testid="builder-current-time">
                  CURSOR: {formatTime(currentTime)}
                </div>
                <button
                  onClick={addQuestion}
                  disabled={!videoId}
                  className="btn-boost hud-clip px-4 py-2 text-xs inline-flex items-center gap-1.5"
                  data-testid="builder-pin-question-button"
                >
                  <Pin className="w-4 h-4" /> Pin Question Here
                </button>
              </div>
            </div>

            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-5 space-y-4">
              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">TITLE</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. RLCS Finals — Game 7 Rotations"
                  className="bg-zinc-950 border-white/10 rounded-none mt-1"
                  data-testid="builder-title-input"
                />
              </div>
              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">DESCRIPTION</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What should the player focus on?"
                  className="bg-zinc-950 border-white/10 rounded-none mt-1"
                  data-testid="builder-description-input"
                />
              </div>
              <div>
                <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
                  TARGET RANK RANGE
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Select value={String(minRank)} onValueChange={(v) => setMinRank(parseInt(v))}>
                    <SelectTrigger
                      className="bg-zinc-950 border-white/10 rounded-none"
                      data-testid="builder-min-rank-select"
                    >
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                      {RANKS.map((r) => (
                        <SelectItem key={r.v} value={String(r.v)}>
                          {r.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(maxRank)} onValueChange={(v) => setMaxRank(parseInt(v))}>
                    <SelectTrigger
                      className="bg-zinc-950 border-white/10 rounded-none"
                      data-testid="builder-max-rank-select"
                    >
                      <SelectValue placeholder="Max" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                      {RANKS.map((r) => (
                        <SelectItem key={r.v} value={String(r.v)}>
                          {r.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="font-mono-rl text-[10px] text-zinc-500 mt-2">
                  // {RANKS.find((r) => r.v === minRank)?.l.toUpperCase()} → {RANKS.find((r) => r.v === maxRank)?.l.toUpperCase()}
                  {duration ? ` · ${formatTime(duration)} VIDEO` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Questions */}
          <div className="lg:col-span-5 space-y-4">
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-bold uppercase">
                  Questions ({questions.length})
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn-boost hud-clip px-4 py-2 text-xs inline-flex items-center gap-1.5"
                  data-testid="builder-save-button"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
              {questions.length === 0 ? (
                <div className="text-zinc-500 text-sm font-mono-rl tracking-wider py-6 text-center">
                  // NO PINS YET. SEEK TO A MOMENT &amp; PIN IT.
                </div>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1" data-testid="builder-question-list">
                  {questions.map((q, idx) => (
                    <QuestionEditor
                      key={q.id}
                      q={q}
                      idx={idx}
                      open={editingIdx === idx}
                      onOpen={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      onChange={(p) => updateQ(idx, p)}
                      onRemove={() => removeQ(idx)}
                      onSeek={() => seekTo(q.timestamp)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({ q, idx, open, onOpen, onChange, onRemove, onSeek }) {
  const setOption = (i, v) =>
    onChange({ options: q.options.map((o, j) => (i === j ? v : o)) });
  const addOption = () => onChange({ options: [...q.options, ""] });
  const removeOption = (i) =>
    onChange({
      options: q.options.filter((_, j) => j !== i),
      correct: q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
    });
  const toggleCorrect = (i) => {
    const optionText = (q.options[i] || "").trim();
    const explanationStarter = optionText
      ? `"${optionText}" is correct because `
      : "";
    // Auto-seed the explanation when the explanation is empty so the creator
    // can fill in the *why* without having to type the boilerplate.
    const explanationPatch =
      !q.explanation && optionText ? { explanation: explanationStarter } : {};
    if (q.type === "single") return onChange({ correct: [i], ...explanationPatch });
    if (q.type === "multi") {
      const s = new Set(q.correct);
      const wasIn = s.has(i);
      wasIn ? s.delete(i) : s.add(i);
      const patch = { correct: Array.from(s).sort() };
      // Only seed explanation when ADDING a correct option, not when removing
      if (!wasIn) Object.assign(patch, explanationPatch);
      return onChange(patch);
    }
  };
  const moveRank = (i, dir) => {
    const arr = q.correct.length === q.options.length ? [...q.correct] : q.options.map((_, k) => k);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange({ correct: arr });
  };

  // Ensure rank has full ordering
  useEffectInit(() => {
    if (q.type === "rank" && q.correct.length !== q.options.length) {
      onChange({ correct: q.options.map((_, k) => k) });
    }
  }, [q.type, q.options.length]);

  return (
    <div
      className={`border ${
        open ? "border-[#ff6b00]/60" : "border-white/10"
      } bg-black`}
      data-testid={`question-editor-${idx}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onSeek}
          className="font-mono-rl text-xs text-[#007aff] hover:text-white"
          data-testid={`question-seek-${idx}`}
        >
          {formatTime(q.timestamp)}
        </button>
        <button
          onClick={onOpen}
          className="flex-1 text-left text-sm truncate"
          data-testid={`question-toggle-${idx}`}
        >
          {q.prompt || <span className="text-zinc-500">// untitled question</span>}
        </button>
        <span className="tag">{q.type}</span>
        <button
          onClick={onRemove}
          className="text-zinc-500 hover:text-[#ff003c]"
          data-testid={`question-remove-${idx}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-4 border-t border-white/10 space-y-3 bg-[#070707]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">TYPE</Label>
              <Select value={q.type} onValueChange={(v) => onChange({ type: v, correct: [] })}>
                <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none mt-1" data-testid={`question-type-select-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                  {TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">TIMESTAMP (s)</Label>
              <Input
                type="number"
                step="1"
                value={q.timestamp}
                onChange={(e) => onChange({ timestamp: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="bg-zinc-950 border-white/10 rounded-none mt-1"
                data-testid={`question-timestamp-${idx}`}
              />
            </div>
          </div>

          <div>
            <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">PROMPT</Label>
            <Textarea
              value={q.prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
              placeholder="What should the player decide?"
              className="bg-zinc-950 border-white/10 rounded-none mt-1"
              data-testid={`question-prompt-${idx}`}
            />
          </div>

          {(q.type === "single" || q.type === "multi" || q.type === "rank") && (
            <div className="space-y-2">
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
                OPTIONS {q.type === "rank" ? "(ordered = correct order)" : "(click ✓ for correct)"}
              </Label>
              {(q.type === "rank" ? (q.correct.length === q.options.length ? q.correct : q.options.map((_, k) => k)) : q.options.map((_, k) => k)).map((origIdx, displayIdx) => (
                <div key={origIdx} className="flex gap-2 items-center">
                  {q.type === "rank" && (
                    <span className="font-mono-rl text-xs w-6 text-[#ff6b00]">#{displayIdx + 1}</span>
                  )}
                  <Input
                    value={q.options[origIdx]}
                    onChange={(e) => setOption(origIdx, e.target.value)}
                    placeholder={`Option ${displayIdx + 1}`}
                    className="bg-zinc-950 border-white/10 rounded-none flex-1"
                    data-testid={`question-option-${idx}-${displayIdx}`}
                  />
                  {(q.type === "single" || q.type === "multi") && (
                    <button
                      onClick={() => toggleCorrect(origIdx)}
                      className={`px-2 py-2 border ${
                        q.correct.includes(origIdx)
                          ? "border-[#00ff66] bg-[#00ff66]/10 text-[#00ff66]"
                          : "border-white/10 text-zinc-500"
                      }`}
                      data-testid={`question-correct-${idx}-${displayIdx}`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {q.type === "rank" && (
                    <>
                      <button
                        onClick={() => moveRank(displayIdx, -1)}
                        className="px-2 py-2 border border-white/10 text-zinc-400 hover:text-white"
                        data-testid={`question-rank-up-${idx}-${displayIdx}`}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveRank(displayIdx, 1)}
                        className="px-2 py-2 border border-white/10 text-zinc-400 hover:text-white"
                        data-testid={`question-rank-down-${idx}-${displayIdx}`}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => removeOption(origIdx)}
                    className="px-2 py-2 text-zinc-500 hover:text-[#ff003c]"
                    data-testid={`question-remove-option-${idx}-${displayIdx}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={addOption}
                className="btn-ghost-volt hud-clip px-3 py-1.5 text-xs inline-flex items-center gap-1"
                data-testid={`question-add-option-${idx}`}
              >
                <Plus className="w-3 h-3" /> Option
              </button>
            </div>
          )}

          {q.type === "confidence" && (
            <div>
              <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">
                IDEAL CONFIDENCE (1–5)
              </Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={q.ideal_confidence ?? 3}
                onChange={(e) => onChange({ ideal_confidence: parseInt(e.target.value) || 3 })}
                className="bg-zinc-950 border-white/10 rounded-none mt-1 w-32"
                data-testid={`question-ideal-confidence-${idx}`}
              />
              <div className="text-xs text-zinc-500 mt-1 font-mono-rl">
                // PLAYERS WITHIN ±1 GET MARKED CORRECT.
              </div>
            </div>
          )}

          {q.type === "short" && (
            <div className="text-xs text-zinc-500 font-mono-rl">
              // SHORT EXPLANATIONS ARE REFLECTIVE — ANY NON-EMPTY ANSWER COUNTS AS COMPLETED.
            </div>
          )}

          <div>
            <Label className="font-mono-rl text-[10px] tracking-widest text-zinc-400">EXPLANATION</Label>
            <Textarea
              value={q.explanation}
              onChange={(e) => onChange({ explanation: e.target.value })}
              placeholder="Why is the correct answer correct?"
              className="bg-zinc-950 border-white/10 rounded-none mt-1"
              data-testid={`question-explanation-${idx}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// tiny effect helper
function useEffectInit(fn, deps) {
  // Avoid double-invoke issues; simple wrapper
  React.useEffect(fn, deps);
}
