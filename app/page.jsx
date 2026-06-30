"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Flame, CircleDot, Plus, X, CheckCircle2, RotateCcw, Trash2, NotebookPen, ThumbsUp, ThumbsDown } from "lucide-react";

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
  const [view, setView] = useState("bugs"); // "bugs" | "suggestions"
  const [bugs, setBugs] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("open");
  const [sortBy, setSortBy] = useState("priority"); // "priority" | "date"
  const [form, setForm] = useState({ title: "", description: "", reporter: "", priority: "medium" });
  const [noteFormOpenFor, setNoteFormOpenFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState({ author: "", content: "" });
  const [myVotes, setMyVotes] = useState({}); // { [suggestionId]: "up" | "down" }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("evolve-suggestion-votes");
      if (stored) setMyVotes(JSON.parse(stored));
    } catch (e) {
      // ignore — voting will just not be remembered this session
    }
  }, []);

  async function castVote(itemId, type) {
    const previousType = myVotes[itemId] || null;
    const nextType = previousType === type ? null : type; // clicking your current vote again retracts it
    try {
      const res = await fetch(`/api/suggestions/${itemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType, previousType }),
      });
      if (!res.ok) throw new Error("failed");
      const counts = await res.json();
      setSuggestions((prev) =>
        (prev || []).map((s) => (s.id === itemId ? { ...s, upvotes: counts.upvotes, downvotes: counts.downvotes } : s))
      );
      const nextVotes = { ...myVotes };
      if (nextType) nextVotes[itemId] = nextType;
      else delete nextVotes[itemId];
      setMyVotes(nextVotes);
      try {
        localStorage.setItem("evolve-suggestion-votes", JSON.stringify(nextVotes));
      } catch (e) {
        // ignore
      }
      setError(null);
    } catch (e) {
      setError("Couldn't record your vote — try again.");
    }
  }

  const endpoint = view === "bugs" ? "/api/bugs" : "/api/suggestions";
  const items = view === "bugs" ? bugs : suggestions;
  const setItems = view === "bugs" ? setBugs : setSuggestions;

  const LABELS = {
    bugs: {
      tabLabel: "Bugs",
      addBtn: "Log a bug",
      titlePlaceholder: "e.g. Dragon fire spell phases through prayer",
      reporterLabel: "Reported by",
      reporterPlaceholder: "Player name",
      descPlaceholder: "Steps to reproduce, what happened, what should happen…",
      submitBtn: "Add to board",
      emptyOpen: "Nothing open. The realm is, for now, bug-free.",
      emptyInProgress: "Nothing being worked on right now.",
      emptyFixed: "No fixed reports yet.",
      emptyAll: "No bugs logged yet. Click \"Log a bug\" to start the board.",
      fixedLabel: "Mark fixed",
      reopenLabel: "Reopen",
      reportedByName: (r) => r,
    },
    suggestions: {
      tabLabel: "Suggestions",
      addBtn: "Log a suggestion",
      titlePlaceholder: "e.g. Add a slayer task reroll option",
      reporterLabel: "Suggested by",
      reporterPlaceholder: "Player name",
      descPlaceholder: "What's the idea, and why would it help the server?",
      submitBtn: "Add suggestion",
      emptyOpen: "No open suggestions right now.",
      emptyInProgress: "Nothing being worked on right now.",
      emptyFixed: "No suggestions implemented yet.",
      emptyAll: "No suggestions logged yet. Click \"Log a suggestion\" to start.",
      fixedLabel: "Mark implemented",
      reopenLabel: "Reopen",
    },
  }[view];

  useEffect(() => {
    let cancelled = false;

    async function fetchOne(url, setter) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const next = await res.json();
        if (!cancelled) {
          setter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        }
      } catch (e) {
        if (!cancelled) setter((prev) => prev ?? []);
      }
    }

    function fetchAll() {
      fetchOne("/api/bugs", setBugs);
      fetchOne("/api/suggestions", setSuggestions);
    }

    // initial load
    fetchAll();

    // poll for changes from other staff every few seconds
    const interval = setInterval(fetchAll, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function resetForm() {
    setForm({ title: "", description: "", reporter: "", priority: "medium" });
  }

  async function refreshItems() {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const next = await res.json();
      setItems(next);
    } catch (e) {
      setError("Couldn't refresh the board.");
    }
  }

  async function addItem() {
    if (!form.title.trim()) return;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("failed");
      resetForm();
      setShowForm(false);
      await refreshItems();
      setError(null);
    } catch (e) {
      setError(view === "bugs" ? "Couldn't add the bug — try again." : "Couldn't add the suggestion — try again.");
    }
  }

  async function setStatus(id, status) {
    try {
      const res = await fetch(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("failed");
      await refreshItems();
      setError(null);
    } catch (e) {
      setError("Couldn't update that entry — try again.");
    }
  }

  async function removeItem(id) {
    try {
      const res = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("failed");
      await refreshItems();
      setError(null);
    } catch (e) {
      setError("Couldn't delete that entry — try again.");
    }
  }

  function toggleNoteForm(itemId) {
    setNoteFormOpenFor((cur) => (cur === itemId ? null : itemId));
    setNoteDraft({ author: "", content: "" });
  }

  async function addItemNote(itemId) {
    if (!noteDraft.content.trim()) return;
    try {
      const res = await fetch(`${endpoint}/${itemId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteDraft),
      });
      if (!res.ok) throw new Error("failed");
      setNoteDraft({ author: "", content: "" });
      setNoteFormOpenFor(null);
      await refreshItems();
      setError(null);
    } catch (e) {
      setError("Couldn't post the note — try again.");
    }
  }

  async function removeItemNote(itemId, noteId) {
    try {
      const res = await fetch(`${endpoint}/${itemId}/notes/${noteId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("failed");
      await refreshItems();
      setError(null);
    } catch (e) {
      setError("Couldn't delete that note — try again.");
    }
  }

  if (items === null) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading the report board…</div>
      </div>
    );
  }

  const order = { high: 0, medium: 1, low: 2 };
  const visible = items
    .filter((b) => (filter === "all" ? true : b.status === filter))
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      }
      return order[a.priority] - order[b.priority] || new Date(b.reportedAt) - new Date(a.reportedAt);
    });

  const counts = {
    open: items.filter((b) => b.status === "open").length,
    inProgress: items.filter((b) => b.status === "in-progress").length,
    fixed: items.filter((b) => b.status === "fixed").length,
    all: items.length,
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
          <button
            className="bt-btn"
            style={styles.primaryBtn}
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close" : LABELS.addBtn}
          </button>
        </div>
      </header>

      <div style={styles.viewSwitch}>
        {["bugs", "suggestions"].map((v) => (
          <button
            key={v}
            className="bt-tab"
            onClick={() => {
              setView(v);
              setShowForm(false);
              setNoteFormOpenFor(null);
              setFilter("open");
            }}
            style={{
              ...styles.viewTab,
              color: view === v ? "#1a1712" : "#cdd5db",
              background: view === v ? "linear-gradient(180deg, #e9c876 0%, #c9a153 100%)" : "transparent",
            }}
          >
            {v === "bugs" ? "Bugs" : "Suggestions"}
          </button>
        ))}
      </div>

      <div style={styles.controlsRow}>
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

        <div style={styles.sortTabs}>
          {[
            { id: "priority", label: "Priority" },
            { id: "date", label: "Newest" },
          ].map((s) => (
            <button
              key={s.id}
              className="bt-tab"
              onClick={() => setSortBy(s.id)}
              style={{
                ...styles.sortTab,
                color: sortBy === s.id ? "#1a1712" : "#7c8a96",
                background: sortBy === s.id ? "linear-gradient(180deg, #5fd4e8 0%, #3fb6c9 100%)" : "transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
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
                    addItem();
                  }
                }}
                placeholder={LABELS.titlePlaceholder}
                autoFocus
              />
            </label>
          </div>
          <div style={styles.formRow2}>
            <label style={styles.label}>
              {LABELS.reporterLabel}
              <input
                className="bt-input"
                style={styles.input}
                value={form.reporter}
                onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                placeholder={LABELS.reporterPlaceholder}
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
              placeholder={LABELS.descPlaceholder}
            />
          </label>
          <div style={styles.formActions}>
            <button type="button" className="bt-btn" style={styles.primaryBtn} onClick={addItem}>
              {LABELS.submitBtn}
            </button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {visible.length === 0 && (
          <div style={styles.empty}>
            {filter === "open"
              ? LABELS.emptyOpen
              : filter === "in-progress"
              ? LABELS.emptyInProgress
              : filter === "fixed"
              ? LABELS.emptyFixed
              : LABELS.emptyAll}
          </div>
        )}
        {visible.map((item) => {
          const p = PRIORITIES.find((x) => x.id === item.priority) || PRIORITIES[1];
          const Icon = p.icon;
          const fixed = item.status === "fixed";
          const inProgress = item.status === "in-progress";
          return (
            <div
              key={item.id}
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
                <h3 style={{ ...styles.cardTitle, textDecoration: fixed ? "line-through" : "none" }}>{item.title}</h3>
              </div>
              {item.description && <p style={styles.cardDesc}>{item.description}</p>}
              <div style={styles.cardMeta}>
                <span>{LABELS.reporterLabel} <strong style={{ color: "#e9c876" }}>{item.reporter}</strong></span>
                <span style={styles.dot}>•</span>
                <span>{new Date(item.reportedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>

              {view === "suggestions" && (
                <div style={styles.voteRow}>
                  <button
                    className="bt-icon-btn"
                    onClick={() => castVote(item.id, "up")}
                    title={myVotes[item.id] === "up" ? "Click to retract your vote" : "Vote this suggestion up"}
                    style={{
                      ...styles.voteBtn,
                      ...(myVotes[item.id] === "up" ? styles.voteBtnActiveUp : {}),
                    }}
                  >
                    <ThumbsUp size={14} /> {item.upvotes || 0}
                  </button>
                  <button
                    className="bt-icon-btn"
                    onClick={() => castVote(item.id, "down")}
                    title={myVotes[item.id] === "down" ? "Click to retract your vote" : "Vote this suggestion down"}
                    style={{
                      ...styles.voteBtn,
                      ...(myVotes[item.id] === "down" ? styles.voteBtnActiveDown : {}),
                    }}
                  >
                    <ThumbsDown size={14} /> {item.downvotes || 0}
                  </button>
                  {myVotes[item.id] && (
                    <span style={styles.voteThanks}>
                      You voted {myVotes[item.id] === "up" ? "up" : "down"} — click again to change
                    </span>
                  )}
                </div>
              )}
              <div style={styles.cardActions}>
                {item.status === "open" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(item.id, "in-progress")}>
                    <Flame size={14} /> Start work
                  </button>
                )}
                {item.status === "in-progress" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(item.id, "open")}>
                    <RotateCcw size={14} /> Back to open
                  </button>
                )}
                {item.status !== "fixed" && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(item.id, "fixed")}>
                    <CheckCircle2 size={14} /> {LABELS.fixedLabel}
                  </button>
                )}
                {fixed && (
                  <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => setStatus(item.id, "open")}>
                    <RotateCcw size={14} /> {LABELS.reopenLabel}
                  </button>
                )}
                <button className="bt-icon-btn" style={styles.actionBtn} onClick={() => toggleNoteForm(item.id)}>
                  <NotebookPen size={14} /> {noteFormOpenFor === item.id ? "Cancel note" : "Add dev note"}
                </button>
                <button className="bt-icon-btn" style={{ ...styles.actionBtn, color: "#9a6b5e" }} onClick={() => removeItem(item.id)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              {noteFormOpenFor === item.id && (
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
                    placeholder={view === "bugs" ? "What are you working on for this bug?" : "What's the plan for this suggestion?"}
                  />
                  <div style={styles.formActions}>
                    <button type="button" className="bt-btn" style={styles.primaryBtn} onClick={() => addItemNote(item.id)}>
                      Post note
                    </button>
                  </div>
                </div>
              )}

              {item.notes && item.notes.length > 0 && (
                <div style={styles.noteList}>
                  {item.notes
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
                          <button
                            className="bt-icon-btn"
                            style={{ ...styles.actionBtn, padding: "2px 7px", marginLeft: "auto" }}
                            onClick={() => removeItemNote(item.id, note.id)}
                          >
                            <Trash2 size={12} />
                          </button>
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
  controlsRow: {
    maxWidth: 760,
    margin: "0 auto 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  tabs: {
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
  sortTabs: {
    display: "flex",
    gap: 6,
    background: "#1b2128",
    border: "1px solid #344049",
    borderRadius: 8,
    padding: 4,
    width: "fit-content",
  },
  sortTab: {
    border: "none",
    borderRadius: 5,
    padding: "7px 14px",
    fontSize: 12.5,
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
  voteRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  voteBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "1px solid #344049",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12.5,
    color: "#8b97a1",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
    cursor: "pointer",
  },
  voteBtnActiveUp: {
    color: "#5fd4e8",
    borderColor: "rgba(63,182,201,0.5)",
    background: "rgba(63,182,201,0.1)",
  },
  voteBtnActiveDown: {
    color: "#e0654a",
    borderColor: "rgba(224,101,74,0.5)",
    background: "rgba(224,101,74,0.1)",
  },
  voteThanks: {
    fontSize: 11.5,
    color: "#5c6772",
    fontFamily: "system-ui, sans-serif",
    fontStyle: "italic",
  },
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
