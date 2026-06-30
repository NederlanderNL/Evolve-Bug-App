"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Flame, CircleDot, Plus, X, CheckCircle2, RotateCcw, Trash2, NotebookPen, Lock, Unlock } from "lucide-react";

const PRIORITIES = [
  { id: "high", label: "High", icon: Flame, color: "#e0654a", bg: "rgba(224,101,74,0.12)", border: "rgba(224,101,74,0.4)" },
  { id: "medium", label: "Medium", icon: AlertTriangle, color: "#d9a953", bg: "rgba(217,169,83,0.12)", border: "rgba(217,169,83,0.4)" },
  { id: "low", label: "Low", icon: CircleDot, color: "#3fb6c9", bg: "rgba(63,182,201,0.12)", border: "rgba(63,182,201,0.4)" },
];

const EMBERS = [
  { id: 1, left: "6%", size: "5px", duration: "16s", delay: "0s", drift: "20px", opacity: 0.5 },
  { id: 2, left: "14%", size: "3px", duration: "21s", delay: "3s", drift: "-15px", opacity: 0.35 },
  { id: 3, left: "23%", size: "6px", duration: "18s", delay: "1s", drift: "10px", opacity: 0.55 },
  { id: 4, left: "32%", size: "4px", duration: "24s", delay: "6s", drift: "-25px", opacity: 0.4 },
  { id: 5, left: "41%", size: "3px", duration: "19s", delay: "2s", drift: "15px", opacity: 0.3 },
  { id: 6, left: "52%", size: "5px", duration: "22s", delay: "8s", drift: "-10px", opacity: 0.45 },
  { id: 7, left: "61%", size: "4px", duration: "17s", delay: "4s", drift: "25px", opacity: 0.5 },
  { id: 8, left: "70%", size: "6px", duration: "23s", delay: "0.5s", drift: "-20px", opacity: 0.4 },
  { id: 9, left: "79%", size: "3px", duration: "20s", delay: "7s", drift: "12px", opacity: 0.35 },
  { id: 10, left: "87%", size: "5px", duration: "25s", delay: "5s", drift: "-15px", opacity: 0.5 },
  { id: 11, left: "94%", size: "4px", duration: "18s", delay: "9s", drift: "18px", opacity: 0.4 },
  { id: 12, left: "48%", size: "3px", duration: "26s", delay: "11s", drift: "-8px", opacity: 0.3 },
];

export default function BugTracker() {
  const [bugs, setBugs] = useState(null);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ title: "", description: "", reporter: "", priority: "medium" });
  const [noteFormOpenFor, setNoteFormOpenFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState({ author: "", content: "" });
  const [unlocked, setUnlocked] = useState(false);
  const [editPasscode, setEditPasscode] = useState(""); // sent as header once verified
  const [showUnlock, setShowUnlock] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function authHeaders() {
    return { "Content-Type": "application/json", "x-edit-passcode": editPasscode };
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchBugs() {
      try {
        const res = await fetch("/api/bugs", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const next = await res.json();
        if (!cancelled) {
          setBugs((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        }
      } catch (e) {
        if (!cancelled) setBugs((prev) => prev ?? []);
      }
    }

    // initial load
    fetchBugs();

    // poll for changes from other staff every few seconds
    const interval = setInterval(fetchBugs, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function tryUnlock() {
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-edit-passcode": passInput.trim() },
      });
      if (!res.ok) {
        setPassError(true);
        return;
      }
      setEditPasscode(passInput.trim());
      setUnlocked(true);
      setShowUnlock(false);
      setPassInput("");
      setPassError(false);
    } catch (e) {
      setPassError(true);
    }
  }

  function resetForm() {
    setForm({ title: "", description: "", reporter: "", priority: "medium" });
  }

  async function refreshBugs() {
    try {
      const res = await fetch("/api/bugs", { cache: "no-store" });
      const next = await res.json();
      setBugs(next);
    } catch (e) {
      setError("Couldn't refresh the board.");
    }
  }

  async function addBug() {
    if (!unlocked || !form.title.trim()) return;
    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("failed");
      resetForm();
      setShowForm(false);
      await refreshBugs();
      setError(null);
    } catch (e) {
      setError("Couldn't add the bug — try again.");
    }
  }

  async function setStatus(id, status) {
    if (!unlocked) return;
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("failed");
      await refreshBugs();
      setError(null);
    } catch (e) {
      setError("Couldn't update that bug — try again.");
    }
  }

  async function removeBug(id) {
    if (!unlocked) return;
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("failed");
      await refreshBugs();
      setError(null);
    } catch (e) {
      setError("Couldn't delete that bug — try again.");
    }
  }

  function toggleNoteForm(bugId) {
    if (!unlocked) return;
    setNoteFormOpenFor((cur) => (cur === bugId ? null : bugId));
    setNoteDraft({ author: "", content: "" });
  }

  async function addBugNote(bugId) {
    if (!unlocked || !noteDraft.content.trim()) return;
    try {
      const res = await fetch(`/api/bugs/${bugId}/notes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(noteDraft),
      });
      if (!res.ok) throw new Error("failed");
      setNoteDraft({ author: "", content: "" });
      setNoteFormOpenFor(null);
      await refreshBugs();
      setError(null);
    } catch (e) {
      setError("Couldn't post the note — try again.");
    }
  }

  async function removeBugNote(bugId, noteId) {
    if (!unlocked) return;
    try {
      const res = await fetch(`/api/bugs/${bugId}/notes/${noteId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("failed");
      await refreshBugs();
      setError(null);
    } catch (e) {
      setError("Couldn't delete that note — try again.");
    }
  }

  if (bugs === null) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading the report board…</div>
      </div>
    );
  }

  const order = { high: 0, medium: 1, low: 2 };
  const visible = bugs
    .filter((b) => (filter === "all" ? true : b.status === filter))
    .sort((a, b) => order[a.priority] - order[b.priority] || new Date(b.reportedAt) - new Date(a.reportedAt));

  const counts = {
    open: bugs.filter((b) => b.status === "open").length,
    inProgress: bugs.filter((b) => b.status === "in-progress").length,
    fixed: bugs.filter((b) => b.status === "fixed").length,
    all: bugs.length,
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .bt-card { animation: riseIn 0.25s ease both; }
        .bt-btn:focus-visible, .bt-input:focus-visible, .bt-tab:focus-visible, .bt-icon-btn:focus-visible {
          outline: 2px solid #c9a13b; outline-offset: 2px;
        }
        @keyframes emberDrift {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
          10%  { opacity: var(--ember-op, 0.55); }
          90%  { opacity: var(--ember-op, 0.55); }
          100% { transform: translate3d(var(--ember-x, 12px), -120vh, 0) scale(0.6); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.6; }
        }
        .bt-ember-field { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .bt-ember {
          position: absolute;
          bottom: -10vh;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(95,212,232,0.9) 0%, rgba(63,182,201,0.25) 60%, transparent 80%);
          filter: blur(0.5px);
          animation: emberDrift linear infinite;
        }
        .bt-glow {
          position: fixed;
          top: -10%;
          left: 50%;
          width: 900px;
          height: 600px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(63,182,201,0.10) 0%, rgba(63,182,201,0) 70%);
          pointer-events: none;
          z-index: 0;
          animation: glowPulse 7s ease-in-out infinite;
        }
        .bt-content { position: relative; z-index: 1; }
        @keyframes liveDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(63,182,201,0.5); }
          50% { opacity: 0.5; box-shadow: 0 0 0 4px rgba(63,182,201,0); }
        }
        .bt-live-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3fb6c9;
          margin-right: 6px;
          animation: liveDot 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .bt-card { animation: none; }
          .bt-ember { animation: none; opacity: 0; }
          .bt-glow { animation: none; }
          .bt-live-dot { animation: none; }
        }
      `}</style>

      <div className="bt-glow" aria-hidden="true" />
      <div className="bt-ember-field" aria-hidden="true">
        {EMBERS.map((em) => (
          <span
            key={em.id}
            className="bt-ember"
            style={{
              left: em.left,
              width: em.size,
              height: em.size,
              animationDuration: em.duration,
              animationDelay: em.delay,
              "--ember-x": em.drift,
              "--ember-op": em.opacity,
            }}
          />
        ))}
      </div>

      <div className="bt-content">
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.crest}>
            <Flame size={22} strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={styles.title}>EVOLVE <span style={styles.titleAccent}>Report Board</span></h1>
            <span style={styles.liveTag}><span className="bt-live-dot" />Live — syncs every few seconds</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          {unlocked ? (
            <>
              <span style={styles.unlockedTag}><Unlock size={12} /> Editing unlocked</span>
              <button
                className="bt-btn"
                style={styles.primaryBtn}
                onClick={() => setShowForm((s) => !s)}
              >
                {showForm ? <X size={16} /> : <Plus size={16} />}
                {showForm ? "Close" : "Log a bug"}
              </button>
            </>
          ) : (
            <button className="bt-btn" style={styles.secondaryBtn} onClick={() => setShowUnlock((s) => !s)}>
              <Lock size={15} /> {showUnlock ? "Close" : "Unlock to edit"}
            </button>
          )}
        </div>
      </header>

      {showUnlock && !unlocked && (
        <div className="bt-card" style={styles.unlockForm}>
          <label style={styles.label}>
            Edit passcode
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="bt-input"
                style={{ ...styles.input, flex: 1 }}
                type={showPass ? "text" : "password"}
                value={passInput}
                onChange={(e) => {
                  setPassInput(e.target.value);
                  setPassError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryUnlock();
                  }
                }}
                placeholder="Enter the staff edit passcode"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="bt-icon-btn"
                style={styles.actionBtn}
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {passError && <span style={styles.passError}>That passcode isn't right. Try again.</span>}
          <div style={styles.formActions}>
            <button type="button" className="bt-btn" style={styles.primaryBtn} onClick={tryUnlock}>
              Unlock
            </button>
          </div>
        </div>
      )}

      <div style={styles.tabs}>
        {[
          { id: "open", label: `Open (${counts.open})` },
          { id: "in-progress", label: `In progress (${counts.inProgress})` },
          { id: "fixed", label: `Fixed (${counts.fixed})` },
          { id: "all", label: `All (${counts.all})` },
        ].map((t) => (
          <button
            key={t.id}
            className="bt-tab"
            onClick={() => setFilter(t.id)}
            style={{
              ...styles.tab,
              color: filter === t.id ? "#1a1712" : "#7c8a96",
              background: filter === t.id ? "linear-gradient(180deg, #e9c876 0%, #c9a153 100%)" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {showForm && (
        <div className="bt-card" style={styles.form}>
          <div style={styles.formRow}>
            <label style={styles.label}>
              Title
              <input
                className="bt-input"
                style={styles.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBug();
                  }
                }}
                placeholder="e.g. Dragon fire spell phases through prayer"
                autoFocus
              />
            </label>
          </div>
          <div style={styles.formRow2}>
            <label style={styles.label}>
              Reported by
              <input
                className="bt-input"
                style={styles.input}
                value={form.reporter}
                onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                placeholder="Player name"
              />
            </label>
            <label style={styles.label}>
              Priority
              <div style={styles.priorityPicker}>
                {PRIORITIES.map((p) => {
                  const Icon = p.icon;
                  const active = form.priority === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className="bt-btn"
                      onClick={() => setForm({ ...form, priority: p.id })}
                      style={{
                        ...styles.priorityChip,
                        color: active ? p.color : "#7c8a96",
                        background: active ? p.bg : "transparent",
                        borderColor: active ? p.border : "#344049",
                      }}
                    >
                      <Icon size={14} /> {p.label}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>
          <label style={styles.label}>
            Description
            <textarea
              className="bt-input"
              style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Steps to reproduce, what happened, what should happen…"
            />
          </label>
          <div style={styles.formActions}>
            <button type="button" className="bt-btn" style={styles.primaryBtn} onClick={addBug}>
              Add to board
            </button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {visible.length === 0 && (
          <div style={styles.empty}>
            {filter === "open"
              ? "Nothing open. The realm is, for now, bug-free."
              : filter === "in-progress"
              ? "Nothing being worked on right now."
              : filter === "fixed"
              ? "No fixed reports yet."
              : "No bugs logged yet. Click \"Log a bug\" to start the board."}
          </div>
        )}
        {visible.map((bug) => {
          const p = PRIORITIES.find((x) => x.id === bug.priority) || PRIORITIES[1];
          const Icon = p.icon;
          const fixed = bug.status === "fixed";
          const inProgress = bug.status === "in-progress";
          return (
            <div
              key={bug.id}
              className="bt-card"
              style={{
                ...styles.card,
                borderLeft: `3px solid ${p.color}`,
                opacity: fixed ? 0.6 : 1,
              }}
            >
              <div style={styles.cardTop}>
                <span style={{ ...styles.priorityTag, color: p.color, background: p.bg, borderColor: p.border }}>
                  <Icon size={13} /> {p.label}
                </span>
                {inProgress && (
                  <span style={{ ...styles.priorityTag, color: "#3fb6c9", background: "rgba(63,182,201,0.12)", borderColor: "rgba(63,182,201,0.4)" }}>
                    In progress
                  </span>
                )}
                <h3 style={{ ...styles.cardTitle, textDecoration: fixed ? "line-through" : "none" }}>{bug.title}</h3>
              </div>
              {bug.description && <p style={styles.cardDesc}>{bug.description}</p>}
              <div style={styles.cardMeta}>
                <span>Reported by <strong style={{ color: "#e9c876" }}>{bug.reporter}</strong></span>
                <span style={styles.dot}>•</span>
                <span>{new Date(bug.reportedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              {unlocked && (
              <div style={styles.cardActions}>
                {bug.status === "open" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(bug.id, "in-progress")}>
                    <Flame size={14} /> Start work
                  </button>
                )}
                {bug.status === "in-progress" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(bug.id, "open")}>
                    <RotateCcw size={14} /> Back to open
                  </button>
                )}
                {bug.status !== "fixed" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(bug.id, "fixed")}>
                    <CheckCircle2 size={14} /> Mark fixed
                  </button>
                )}
                {fixed && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(bug.id, "open")}>
                    <RotateCcw size={14} /> Reopen
                  </button>
                )}
                <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => toggleNoteForm(bug.id)}>
                  <NotebookPen size={14} /> {noteFormOpenFor === bug.id ? "Cancel note" : "Add dev note"}
                </button>
                <button className="bt-icon-btn" style={{ ...styles.actionBtn, color: "#9a6b5e" }} onClick={() => removeBug(bug.id)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
              )}

              {noteFormOpenFor === bug.id && (
                <div style={styles.noteForm}>
                  <input
                    className="bt-input"
                    style={styles.input}
                    value={noteDraft.author}
                    onChange={(e) => setNoteDraft({ ...noteDraft, author: e.target.value })}
                    placeholder="Your name"
                    autoFocus
                  />
                  <textarea
                    className="bt-input"
                    style={{ ...styles.input, minHeight: 64, resize: "vertical" }}
                    value={noteDraft.content}
                    onChange={(e) => setNoteDraft({ ...noteDraft, content: e.target.value })}
                    placeholder="What are you working on for this bug?"
                  />
                  <div style={styles.formActions}>
                    <button type="button" className="bt-btn" style={styles.primaryBtn} onClick={() => addBugNote(bug.id)}>
                      Post note
                    </button>
                  </div>
                </div>
              )}

              {bug.notes && bug.notes.length > 0 && (
                <div style={styles.noteList}>
                  {bug.notes
                    .slice()
                    .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
                    .map((note) => (
                      <div key={note.id} style={styles.noteItem}>
                        <div style={styles.cardMeta}>
                          <NotebookPen size={12} style={{ color: "#3fb6c9" }} />
                          <span><strong style={{ color: "#e9c876" }}>{note.author}</strong></span>
                          <span style={styles.dot}>•</span>
                          <span>
                            {new Date(note.postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            {" at "}
                            {new Date(note.postedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                          {unlocked && (
                            <button
                              className="bt-icon-btn"
                              style={{ ...styles.actionBtn, padding: "2px 7px", marginLeft: "auto" }}
                              onClick={() => removeBugNote(bug.id, note.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <p style={{ ...styles.cardDesc, margin: 0, whiteSpace: "pre-wrap" }}>{note.content}</p>
                      </div>
                    ))}
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

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% 0%, #232c36 0%, #161b21 55%, #10141a 100%)",
    color: "#e6e9ec",
    fontFamily: "'Cinzel', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    padding: "32px 20px 60px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
  },
  loading: { textAlign: "center", marginTop: 80, color: "#7c8a96", fontSize: 15 },
  header: {
    maxWidth: 760,
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  headerLeft: { display: "flex", gap: 14, alignItems: "flex-start" },
  crest: {
    width: 46,
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "radial-gradient(circle, rgba(63,182,201,0.22) 0%, rgba(63,182,201,0.06) 70%)",
    border: "1px solid rgba(217,169,83,0.5)",
    color: "#5fd4e8",
    flexShrink: 0,
    boxShadow: "0 0 14px rgba(63,182,201,0.25)",
  },
  title: { margin: 0, fontSize: 25, fontWeight: 700, letterSpacing: 0.5, color: "#e9c876", textTransform: "uppercase" },
  titleAccent: { color: "#cdd5db", fontWeight: 500, fontSize: 18, textTransform: "none", letterSpacing: 0.2 },
  subtitle: { margin: "4px 0 0", fontSize: 13.5, color: "#7c8a96", fontFamily: "system-ui, sans-serif" },
  liveTag: {
    display: "flex",
    alignItems: "center",
    marginTop: 4,
    fontSize: 12,
    color: "#7c8a96",
    fontFamily: "system-ui, sans-serif",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  unlockedTag: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    color: "#3fb6c9",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  },
  secondaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    color: "#cdd5db",
    border: "1px solid #344049",
    borderRadius: 6,
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  unlockForm: {
    maxWidth: 760,
    margin: "0 auto 20px",
    background: "#1b2128",
    border: "1px solid #344049",
    borderRadius: 10,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  passError: {
    fontSize: 12.5,
    color: "#e0654a",
    fontFamily: "system-ui, sans-serif",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "linear-gradient(180deg, #e9c876 0%, #c9a153 100%)",
    color: "#1a1712",
    border: "1px solid #8a6f33",
    borderRadius: 6,
    padding: "10px 16px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  errorBanner: {
    maxWidth: 760,
    margin: "0 auto 16px",
    background: "rgba(224,101,74,0.12)",
    border: "1px solid rgba(224,101,74,0.4)",
    color: "#e0654a",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "system-ui, sans-serif",
  },
  form: {
    maxWidth: 760,
    margin: "0 auto 24px",
    background: "#1b2128",
    border: "1px solid #344049",
    borderRadius: 10,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  formRow: { display: "flex" },
  formRow2: { display: "flex", gap: 16, flexWrap: "wrap" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12.5,
    color: "#8b97a1",
    fontFamily: "system-ui, sans-serif",
    flex: 1,
    minWidth: 200,
  },
  input: {
    background: "#11151a",
    border: "1px solid #344049",
    borderRadius: 6,
    padding: "9px 11px",
    color: "#e6e9ec",
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
  },
  priorityPicker: { display: "flex", gap: 6 },
  priorityChip: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    border: "1px solid",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 12.5,
    fontFamily: "system-ui, sans-serif",
    cursor: "pointer",
    fontWeight: 600,
  },
  formActions: { display: "flex", justifyContent: "flex-end" },
  viewSwitch: {
    maxWidth: 760,
    margin: "0 auto 20px",
    display: "flex",
    gap: 6,
    background: "#1b2128",
    border: "1px solid #344049",
    borderRadius: 8,
    padding: 4,
    width: "fit-content",
  },
  viewTab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    borderRadius: 5,
    padding: "8px 16px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  tabs: {
    maxWidth: 760,
    margin: "0 auto 18px",
    display: "flex",
    gap: 6,
    background: "#1b2128",
    border: "1px solid #344049",
    borderRadius: 8,
    padding: 4,
    width: "fit-content",
  },
  tab: {
    border: "none",
    borderRadius: 5,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  list: { maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 },
  empty: {
    textAlign: "center",
    color: "#5c6772",
    fontSize: 14,
    padding: "40px 20px",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#1b2128",
    borderRadius: 8,
    padding: "16px 18px",
    border: "1px solid #28313a",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 },
  priorityTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid",
    fontFamily: "system-ui, sans-serif",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardTitle: { margin: 0, fontSize: 17, color: "#e9c876", fontWeight: 600 },
  cardDesc: { margin: "0 0 10px", fontSize: 13.5, color: "#aab5bd", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    color: "#5c6772",
    fontFamily: "system-ui, sans-serif",
    marginBottom: 10,
  },
  dot: { opacity: 0.5 },
  cardActions: { display: "flex", gap: 10 },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "1px solid #344049",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12.5,
    color: "#8b97a1",
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  },
  noteForm: {
    marginTop: 12,
    background: "#161b21",
    border: "1px solid #344049",
    borderRadius: 7,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  noteList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  noteItem: {
    background: "#161b21",
    border: "1px solid #28313a",
    borderLeft: "2px solid #3fb6c9",
    borderRadius: 6,
    padding: "8px 10px",
  },
};
