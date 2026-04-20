import { useState, useEffect, useCallback } from "react";

const RANKS = [
  { tier: "Iron", divisions: ["I","II","III"], color: "#8A9099", glow: "#6B7280", icon: "⬡" },
  { tier: "Bronze", divisions: ["I","II","III"], color: "#CD7F32", glow: "#B8651A", icon: "⬡" },
  { tier: "Silver", divisions: ["I","II","III"], color: "#C0C0C0", glow: "#A8A8A8", icon: "⬡" },
  { tier: "Gold", divisions: ["I","II","III"], color: "#FFD700", glow: "#E6C200", icon: "⬡" },
  { tier: "Platinum", divisions: ["I","II","III"], color: "#00CED1", glow: "#00A8AB", icon: "⬡" },
  { tier: "Diamond", divisions: ["I","II","III"], color: "#B9F2FF", glow: "#7DD3FC", icon: "⬡" },
  { tier: "Ascendant", divisions: ["I","II","III"], color: "#4ADE80", glow: "#22C55E", icon: "⬡" },
  { tier: "Immortal", divisions: ["I","II","III"], color: "#FF4655", glow: "#E11D48", icon: "⬡" },
  { tier: "Radiant", divisions: [""], color: "#FFFBAF", glow: "#FCD34D", icon: "✦" },
];

const CATEGORIES = [
  { id: "fitness", name: "Fitness & Health", emoji: "💪", color: "#EF4444", tasks: ["Morning workout (30 min)","Drink 8 glasses of water","Sleep 7-8 hours","10,000 steps","Meal prep for the day","Stretch / mobility work","No junk food today"] },
  { id: "mindset", name: "Mental Mastery", emoji: "🧠", color: "#8B5CF6", tasks: ["Meditate (10 min)","Journaling","Read for 30 min","Practice gratitude","Digital detox (1 hr)","Learn something new","Affirmations"] },
  { id: "career", name: "Career & Skills", emoji: "🚀", color: "#3B82F6", tasks: ["Deep work block (2 hrs)","Learn a new skill (30 min)","Network with 1 person","Complete a project task","Review goals","Write / create content","Attend a course"] },
  { id: "social", name: "Relationships", emoji: "❤️", color: "#EC4899", tasks: ["Call a family member","Do something kind","Spend quality time with a loved one","Resolve a conflict","Make a new friend","Express appreciation","Avoid drama"] },
  { id: "finance", name: "Finance & Growth", emoji: "💰", color: "#10B981", tasks: ["Track expenses","No unnecessary spending","Read financial news","Invest / save today","Review budget","Develop a side income idea","Cut one subscription"] },
  { id: "creativity", name: "Creativity & Flow", emoji: "🎨", color: "#F59E0B", tasks: ["Create something today","Practice a hobby","Explore a new idea","Write/draw/make music","Solve a puzzle","Brainstorm session","Do something spontaneous"] },
];

const ALL_TIER_NAMES = RANKS.flatMap(r => r.divisions[0] === "" ? [r.tier] : r.divisions.map(d => `${r.tier} ${d}`));

function getRankInfo(totalRR) {
  const rr = Math.max(0, totalRR);
  if (rr >= ALL_TIER_NAMES.length * 100 - 100) return { tierName: "Radiant", rr: 100, tierIndex: ALL_TIER_NAMES.length - 1 };
  const tierIndex = Math.min(Math.floor(rr / 100), ALL_TIER_NAMES.length - 1);
  return { tierName: ALL_TIER_NAMES[tierIndex], rr: rr % 100, tierIndex };
}

function getRankData(tierName) {
  const tierParts = tierName.split(" ");
  const tier = tierParts[0];
  return RANKS.find(r => r.tier === tier) || RANKS[0];
}

function isAscendantOrAbove(tierName) {
  const ascIdx = ALL_TIER_NAMES.indexOf("Ascendant I");
  const idx = ALL_TIER_NAMES.indexOf(tierName);
  return idx >= ascIdx;
}

const DEFAULT_TASKS = CATEGORIES.flatMap(c => c.tasks.slice(0,3).map(t => ({ id: `${c.id}_${t}`, text: t, category: c.id, isCustom: false })));

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const STORAGE_KEY = "liferank_v2";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

const today = () => new Date().toISOString().split("T")[0];

export default function LifeRankApp() {
  const [screen, setScreen] = useState("home");
  const [totalRR, setTotalRR] = useState(0);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [completedToday, setCompletedToday] = useState({});
  const [lastDate, setLastDate] = useState(today());
  const [history, setHistory] = useState([]);
  const [bonusMission, setBonusMission] = useState(null);
  const [bonusDone, setBonusDone] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(["fitness","mindset","career"]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCat, setNewTaskCat] = useState("fitness");
  const [streak, setStreak] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [showRRGain, setShowRRGain] = useState(null);
  const [dailyLocked, setDailyLocked] = useState(false);
  const [tab, setTab] = useState("tasks");

  useEffect(() => {
    const s = loadState();
    if (s) {
      setTotalRR(s.totalRR ?? 0);
      setTasks(s.tasks ?? DEFAULT_TASKS);
      setSelectedCategories(s.selectedCategories ?? ["fitness","mindset","career"]);
      setHistory(s.history ?? []);
      setStreak(s.streak ?? 0);
      setStreakDays(s.streakDays ?? 0);
      const d = s.lastDate ?? today();
      setLastDate(d);
      if (d === today()) {
        setCompletedToday(s.completedToday ?? {});
        setBonusDone(s.bonusDone ?? false);
        setDailyLocked(s.dailyLocked ?? false);
      } else {
        setCompletedToday({});
        setBonusDone(false);
        setDailyLocked(false);
      }
    }
    fetchBonusMission();
  }, []);

  const persist = useCallback((patch) => {
    const base = loadState() || {};
    const next = { ...base, ...patch, lastDate: today() };
    saveState(next);
  }, []);

  async function fetchBonusMission() {
    setAiLoading(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a life coach AI for a gamified self-improvement app. Respond ONLY with valid JSON. No markdown, no backticks.",
          messages: [{
            role: "user",
            content: `Generate a daily bonus mission for a life improvement challenge. Return JSON: { "title": "short mission name", "description": "1 sentence what to do", "category": "fitness|mindset|career|social|finance|creativity", "bonusRR": 15, "difficulty": "easy|medium|hard", "tip": "motivational one-liner" }`
          }]
        })
      });
      const d = await r.json();
      const text = d.content?.map(x => x.text || "").join("") || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      const mission = JSON.parse(clean);
      setBonusMission(mission);
    } catch {
      setBonusMission({ title: "The Discipline Challenge", description: "Do one thing today that your future self will thank you for.", category: "mindset", bonusRR: 15, difficulty: "medium", tip: "Consistency is the mother of mastery." });
    }
    setAiLoading(false);
  }

  async function getAICoach(prompt) {
    setAiLoading(true);
    setAiMsg("");
    try {
      const { tierName } = getRankInfo(totalRR);
      const isAsc = isAscendantOrAbove(tierName);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an intense Valorant-style life coach AI. The user is currently rank ${tierName}. ${isAsc ? "They are in Ascendant+ — be DEMANDING, tell them the grind is harder now, more is expected." : "Be encouraging but push them."} Keep responses under 80 words. Be hype, direct, use gaming language occasionally.`,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const d = await r.json();
      setAiMsg(d.content?.map(x => x.text || "").join("") || "Keep grinding!");
    } catch {
      setAiMsg("Keep grinding. Every task completed is RR in the bank. Don't let your rank decay!");
    }
    setAiLoading(false);
  }

  const activeTasks = tasks.filter(t => selectedCategories.includes(t.category));
  const completedCount = activeTasks.filter(t => completedToday[t.id]).length;
  const totalCount = activeTasks.length;
  const pct = totalCount > 0 ? completedCount / totalCount : 0;

  function toggleTask(id) {
    if (dailyLocked) return;
    setCompletedToday(prev => {
      const next = { ...prev, [id]: !prev[id] };
      persist({ completedToday: next });
      return next;
    });
  }

  function lockAndCalculateRR() {
    if (dailyLocked) return;
    const { tierName } = getRankInfo(totalRR);
    const isAsc = isAscendantOrAbove(tierName);
    let base;
    const roll = Math.random();
    if (pct === 1) base = 18 + Math.floor(Math.random() * 12);
    else if (pct >= 0.8) base = 12 + Math.floor(Math.random() * 10);
    else if (pct >= 0.6) base = 5 + Math.floor(Math.random() * 8);
    else if (pct >= 0.4) base = -(8 + Math.floor(Math.random() * 10));
    else if (pct >= 0.2) base = -(12 + Math.floor(Math.random() * 12));
    else base = -(18 + Math.floor(Math.random() * 12));

    if (bonusDone && bonusMission) {
      base += bonusMission.bonusRR || 10;
    }

    if (isAsc) {
      if (streakDays >= 14) {
        base = Math.round(base * 0.9);
      } else {
        if (base > 0) base = Math.round(base * 0.6);
        else base = Math.round(base * 1.5);
      }
    }

    base = Math.max(-30, Math.min(30, base));
    const newTotal = Math.max(0, totalRR + base);

    const newStreakDays = base > 0 ? streakDays + 1 : 0;
    const newStreak = base > 0 ? streak + 1 : 0;

    const entry = {
      date: today(),
      rr: base,
      completed: completedCount,
      total: totalCount,
      tier: getRankInfo(totalRR).tierName,
      newTier: getRankInfo(newTotal).tierName,
    };

    const newHistory = [entry, ...history].slice(0, 30);

    setTotalRR(newTotal);
    setStreak(newStreak);
    setStreakDays(newStreakDays);
    setHistory(newHistory);
    setDailyLocked(true);
    setShowRRGain(base);

    persist({
      totalRR: newTotal,
      streak: newStreak,
      streakDays: newStreakDays,
      history: newHistory,
      dailyLocked: true,
      tasks,
      selectedCategories,
    });

    const msg = base > 0
      ? `I completed ${completedCount}/${totalCount} tasks and gained ${base} RR. I'm now ${getRankInfo(newTotal).tierName}. What should I focus on tomorrow?`
      : `I only completed ${completedCount}/${totalCount} tasks and lost ${Math.abs(base)} RR. I'm ${getRankInfo(newTotal).tierName}. How do I bounce back?`;
    setTimeout(() => getAICoach(msg), 500);
  }

  function addCustomTask() {
    if (!newTaskText.trim()) return;
    const t = { id: `custom_${Date.now()}`, text: newTaskText.trim(), category: newTaskCat, isCustom: true };
    const next = [...tasks, t];
    setTasks(next);
    setNewTaskText("");
    persist({ tasks: next });
  }

  function removeTask(id) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next);
    persist({ tasks: next });
  }

  const { tierName, rr, tierIndex } = getRankInfo(totalRR);
  const rankData = getRankData(tierName);
  const isAsc = isAscendantOrAbove(tierName);
  const maxTierIndex = ALL_TIER_NAMES.length - 1;

  const styles = {
    app: { minHeight: "100vh", background: "#0A0A0F", color: "#E8E8F0", fontFamily: "'Rajdhani', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" },
    bg: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: `radial-gradient(ellipse at 20% 20%, ${hexToRgba(rankData.color, 0.06)} 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, ${hexToRgba(rankData.glow, 0.04)} 0%, transparent 60%)` },
    content: { position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "0 0 80px" },
    header: { padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" },
    logo: { fontSize: 22, fontWeight: 700, letterSpacing: 3, color: rankData.color, textTransform: "uppercase" },
    rankCard: { margin: "16px", background: "linear-gradient(135deg, #12121A 0%, #1A1A28 100%)", border: `1px solid ${hexToRgba(rankData.color, 0.3)}`, borderRadius: 16, padding: "20px 24px", position: "relative", overflow: "hidden" },
    rankBadge: { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 },
    rankIcon: { width: 64, height: 64, borderRadius: "50%", background: `radial-gradient(circle, ${hexToRgba(rankData.color, 0.2)} 0%, ${hexToRgba(rankData.color, 0.05)} 100%)`, border: `2px solid ${rankData.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 },
    rankName: { fontSize: 26, fontWeight: 700, color: rankData.color, letterSpacing: 2, textTransform: "uppercase", lineHeight: 1 },
    rankSub: { fontSize: 13, color: "#888", marginTop: 4, letterSpacing: 1 },
    rrBar: { height: 6, background: "#1E1E2E", borderRadius: 3, overflow: "hidden", marginTop: 12 },
    rrFill: { height: "100%", background: `linear-gradient(90deg, ${rankData.color}99, ${rankData.color})`, borderRadius: 3, transition: "width 1s ease", width: `${rr}%` },
    rrLabel: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginTop: 6 },
    ascWarning: { background: hexToRgba("#4ADE80", 0.1), border: "1px solid #4ADE8044", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#4ADE80", marginTop: 12, display: streakDays < 14 && isAsc ? "block" : "none" },
    streakBar: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0D0D15", borderTop: "1px solid #1E1E30", display: "flex", zIndex: 100 },
    navBtn: (active) => ({ flex: 1, padding: "12px 4px", background: "none", border: "none", color: active ? rankData.color : "#555", fontSize: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }),
    section: { margin: "0 16px 16px" },
    sectionTitle: { fontSize: 11, letterSpacing: 3, color: "#555", textTransform: "uppercase", marginBottom: 10 },
    taskCard: (done) => ({ background: done ? "#0D1F0D" : "#12121A", border: `1px solid ${done ? "#22C55E44" : "#1E1E30"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: dailyLocked ? "default" : "pointer", transition: "all 0.2s", opacity: done ? 0.8 : 1 }),
    checkbox: (done) => ({ width: 20, height: 20, borderRadius: 4, border: `2px solid ${done ? "#22C55E" : "#333"}`, background: done ? "#22C55E" : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }),
    taskText: (done) => ({ fontSize: 15, color: done ? "#4ADE80" : "#CCC", textDecoration: done ? "line-through" : "none", flex: 1 }),
    catDot: (catId) => ({ width: 6, height: 6, borderRadius: "50%", background: CATEGORIES.find(c => c.id === catId)?.color || "#555", flexShrink: 0 }),
    bigBtn: { width: "100%", padding: "16px", background: `linear-gradient(135deg, ${rankData.color}22, ${rankData.color}11)`, border: `1px solid ${rankData.color}66`, borderRadius: 12, color: rankData.color, fontSize: 16, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", transition: "all 0.2s" },
    progressRing: { textAlign: "center", marginBottom: 16 },
    pct: { fontSize: 42, fontWeight: 700, color: rankData.color },
    bonusCard: { background: "#12121A", border: `1px solid ${hexToRgba("#F59E0B", 0.3)}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 },
    aiBox: { background: "#0D0D15", border: "1px solid #1E1E30", borderRadius: 12, padding: "14px 16px", marginTop: 12 },
    histCard: (rr) => ({ background: "#12121A", border: `1px solid ${rr > 0 ? "#22C55E33" : "#EF444433"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }),
    input: { background: "#12121A", border: "1px solid #1E1E30", borderRadius: 8, padding: "10px 14px", color: "#E8E8F0", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" },
    select: { background: "#12121A", border: "1px solid #1E1E30", borderRadius: 8, padding: "10px 14px", color: "#E8E8F0", fontSize: 14, fontFamily: "inherit", outline: "none" },
    catBtn: (active) => ({ padding: "8px 14px", borderRadius: 20, border: `1px solid ${active ? "#555" : "#222"}`, background: active ? "#1E1E30" : "none", color: active ? "#E8E8F0" : "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1, transition: "all 0.2s" }),
    rrPop: { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200, textAlign: "center", pointerEvents: "none" },
    removeBtn: { background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 },
  };

  const screens = {
    home: (
      <div>
        <div style={styles.header}>
          <div style={styles.logo}>LifeRank</div>
          <div style={{ fontSize: 12, color: "#555", letterSpacing: 2 }}>EPISODE 1</div>
        </div>

        <div style={styles.rankCard}>
          <div style={styles.rankBadge}>
            <div style={styles.rankIcon}>{rankData.icon}</div>
            <div>
              <div style={styles.rankName}>{tierName}</div>
              <div style={styles.rankSub}>TOTAL RR: {totalRR}</div>
            </div>
          </div>
          <div style={styles.rrBar}><div style={styles.rrFill}/></div>
          <div style={styles.rrLabel}><span>{rr} RR</span><span>100 RR</span></div>
          <div style={styles.streakBar}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 13, color: "#888" }}>{streak} day streak</span>
            {isAsc && <span style={{ fontSize: 11, color: streakDays >= 14 ? "#4ADE80" : "#F59E0B", marginLeft: "auto" }}>Consistency: {streakDays}/14 days</span>}
          </div>
          <div style={styles.ascWarning}>⚠ Ascendant difficulty: maintain 14-day streak for bonus RR gains</div>
        </div>

        <div style={styles.section}>
          <div style={styles.progressRing}>
            <div style={styles.pct}>{Math.round(pct * 100)}%</div>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>Daily Progress — {completedCount}/{totalCount} tasks</div>
          </div>

          {bonusMission && !aiLoading && (
            <div style={styles.bonusCard}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#F59E0B", marginBottom: 6, textTransform: "uppercase" }}>⚡ Daily Bonus Mission</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", marginBottom: 4 }}>{bonusMission.title}</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>{bonusMission.description}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#F59E0B" }}>+{bonusMission.bonusRR} bonus RR</span>
                <button
                  onClick={() => { if (!dailyLocked) { setBonusDone(true); persist({ bonusDone: true }); } }}
                  style={{ ...styles.catBtn(!bonusDone), background: bonusDone ? "#22C55E22" : undefined, color: bonusDone ? "#22C55E" : undefined, border: bonusDone ? "1px solid #22C55E44" : undefined }}
                >{bonusDone ? "✓ Done!" : "Complete"}</button>
              </div>
            </div>
          )}

          {!dailyLocked ? (
            <button style={styles.bigBtn} onClick={lockAndCalculateRR}>
              END DAY — CALCULATE RR
            </button>
          ) : (
            <div style={{ ...styles.bigBtn, opacity: 0.5, cursor: "default", textAlign: "center" }}>
              ✓ DAY COMPLETE — COME BACK TOMORROW
            </div>
          )}

          {aiLoading && <div style={{ textAlign: "center", color: "#555", fontSize: 13, marginTop: 12, letterSpacing: 2 }}>COACH AI ANALYZING...</div>}
          {aiMsg && (
            <div style={styles.aiBox}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: rankData.color, marginBottom: 8, textTransform: "uppercase" }}>🤖 Coach AI</div>
              <div style={{ fontSize: 14, color: "#CCC", lineHeight: 1.6 }}>{aiMsg}</div>
            </div>
          )}
        </div>

        {showRRGain !== null && (
          <div style={styles.rrPop}>
            <div style={{ fontSize: 56, fontWeight: 900, color: showRRGain > 0 ? "#22C55E" : "#EF4444", textShadow: `0 0 40px ${showRRGain > 0 ? "#22C55E" : "#EF4444"}`, animation: "fadeOut 3s forwards" }}>
              {showRRGain > 0 ? "+" : ""}{showRRGain} RR
            </div>
            <style>{`@keyframes fadeOut { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 70%{opacity:1;transform:translate(-50%,-60%) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-80%) scale(0.8)} }`}</style>
          </div>
        )}
      </div>
    ),

    tasks: (
      <div>
        <div style={{ ...styles.header, paddingBottom: 16 }}>
          <div style={styles.logo}>Tasks</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTab("tasks")} style={styles.catBtn(tab === "tasks")}>Today</button>
            <button onClick={() => setTab("manage")} style={styles.catBtn(tab === "manage")}>Manage</button>
          </div>
        </div>

        {tab === "tasks" && (
          <div style={{ padding: "0 16px" }}>
            {CATEGORIES.filter(c => selectedCategories.includes(c.id)).map(cat => {
              const catTasks = activeTasks.filter(t => t.category === cat.id);
              if (!catTasks.length) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, letterSpacing: 3, color: cat.color, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{cat.emoji}</span> {cat.name}
                  </div>
                  {catTasks.map(t => (
                    <div key={t.id} style={styles.taskCard(!!completedToday[t.id])} onClick={() => toggleTask(t.id)}>
                      <div style={styles.checkbox(!!completedToday[t.id])}>{completedToday[t.id] ? "✓" : ""}</div>
                      <span style={styles.taskText(!!completedToday[t.id])}>{t.text}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {dailyLocked && <div style={{ textAlign: "center", color: "#555", fontSize: 13, letterSpacing: 2, marginTop: 20 }}>DAY LOCKED — SEE YOU TOMORROW</div>}
          </div>
        )}

        {tab === "manage" && (
          <div style={{ padding: "0 16px" }}>
            <div style={styles.sectionTitle}>Active Categories</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} style={{ ...styles.catBtn(selectedCategories.includes(c.id)), borderColor: selectedCategories.includes(c.id) ? c.color + "66" : "#222", color: selectedCategories.includes(c.id) ? c.color : "#555" }}
                  onClick={() => {
                    const next = selectedCategories.includes(c.id) ? selectedCategories.filter(x => x !== c.id) : [...selectedCategories, c.id];
                    setSelectedCategories(next);
                    persist({ selectedCategories: next });
                  }}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>

            <div style={styles.sectionTitle}>Add Custom Task</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <input style={styles.input} value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Task description..." />
              <select style={styles.select} value={newTaskCat} onChange={e => setNewTaskCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
              <button style={styles.bigBtn} onClick={addCustomTask}>+ Add Task</button>
            </div>

            <div style={styles.sectionTitle}>All Tasks</div>
            {tasks.map(t => {
              const cat = CATEGORIES.find(c => c.id === t.category);
              return (
                <div key={t.id} style={{ ...styles.taskCard(false), cursor: "default" }}>
                  <div style={styles.catDot(t.category)}/>
                  <span style={{ fontSize: 13, color: "#AAA", flex: 1 }}>{t.text}</span>
                  <span style={{ fontSize: 11, color: cat?.color || "#555" }}>{cat?.emoji}</span>
                  {t.isCustom && <button style={styles.removeBtn} onClick={() => removeTask(t.id)}>✕</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    ),

    ranks: (
      <div>
        <div style={{ ...styles.header, paddingBottom: 16 }}>
          <div style={styles.logo}>Rank Ladder</div>
          <div style={{ fontSize: 12, color: rankData.color }}>{tierName}</div>
        </div>
        <div style={{ padding: "0 16px" }}>
          {[...RANKS].reverse().map(rank => {
            const divs = rank.divisions[0] === "" ? [""] : rank.divisions;
            return divs.map(div => {
              const fullName = div ? `${rank.tier} ${div}` : rank.tier;
              const tIdx = ALL_TIER_NAMES.indexOf(fullName);
              const isCurrent = fullName === tierName;
              const isPast = tIdx < tierIndex;
              return (
                <div key={fullName} style={{ background: isCurrent ? hexToRgba(rank.color, 0.12) : "#12121A", border: `1px solid ${isCurrent ? rank.color + "66" : isPast ? "#1E1E2E" : "#1A1A26"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${rank.color}${isPast ? "44" : isCurrent ? "FF" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, opacity: isPast ? 0.4 : 1 }}>{rank.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isCurrent ? rank.color : isPast ? "#444" : "#888", letterSpacing: 1 }}>{fullName}</div>
                    {rank.tier === "Ascendant" && <div style={{ fontSize: 11, color: "#4ADE8088", marginTop: 2 }}>+50% harder • needs 14d streak</div>}
                  </div>
                  {isCurrent && <div style={{ fontSize: 10, letterSpacing: 2, color: rank.color, background: hexToRgba(rank.color, 0.15), padding: "4px 10px", borderRadius: 20 }}>YOU</div>}
                  {isPast && <div style={{ fontSize: 16 }}>✓</div>}
                  {rank.tier === "Radiant" && !isPast && !isCurrent && <div style={{ fontSize: 10, color: "#888", letterSpacing: 1 }}>PEAK</div>}
                </div>
              );
            });
          })}
        </div>
      </div>
    ),

    history: (
      <div>
        <div style={{ ...styles.header, paddingBottom: 16 }}>
          <div style={styles.logo}>Match History</div>
        </div>
        <div style={{ padding: "0 16px" }}>
          {history.length === 0 && <div style={{ textAlign: "center", color: "#555", fontSize: 14, marginTop: 40, letterSpacing: 2 }}>NO MATCHES YET</div>}
          {history.map((h, i) => (
            <div key={i} style={styles.histCard(h.rr)}>
              <div>
                <div style={{ fontSize: 13, color: "#888" }}>{h.date}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{h.tier} → {h.newTier} · {h.completed}/{h.total} tasks</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: h.rr > 0 ? "#22C55E" : "#EF4444" }}>{h.rr > 0 ? "+" : ""}{h.rr}</div>
            </div>
          ))}
        </div>
      </div>
    ),

    coach: (
      <div>
        <div style={{ ...styles.header, paddingBottom: 16 }}>
          <div style={styles.logo}>AI Coach</div>
        </div>
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 13, color: "#555", letterSpacing: 1, marginBottom: 16 }}>Ask your coach anything about your grind</div>
          {[
            "How do I stop losing RR?",
            "What habits should I build this week?",
            "Motivate me to keep going",
            `What does reaching ${tierName} mean for my life?`,
            "Give me a mental reset routine",
            "How do I stay consistent for 14 days?",
          ].map(q => (
            <button key={q} style={{ ...styles.taskCard(false), cursor: "pointer", width: "100%", textAlign: "left", border: "1px solid #1E1E30" }} onClick={() => getAICoach(q)}>
              <span style={{ color: rankData.color, fontSize: 16 }}>›</span>
              <span style={{ fontSize: 14, color: "#AAA" }}>{q}</span>
            </button>
          ))}
          {aiLoading && <div style={{ textAlign: "center", color: "#555", fontSize: 13, marginTop: 20, letterSpacing: 2 }}>COACH THINKING...</div>}
          {aiMsg && (
            <div style={{ ...styles.aiBox, marginTop: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: rankData.color, marginBottom: 10, textTransform: "uppercase" }}>🤖 Coach Response</div>
              <div style={{ fontSize: 15, color: "#DDD", lineHeight: 1.7 }}>{aiMsg}</div>
            </div>
          )}
        </div>
      </div>
    ),
  };

  const navItems = [
    { key: "home", label: "HOME", icon: "⌂" },
    { key: "tasks", label: "TASKS", icon: "☑" },
    { key: "ranks", label: "RANKS", icon: "◆" },
    { key: "history", label: "HISTORY", icon: "◎" },
    { key: "coach", label: "COACH", icon: "★" },
  ];

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={styles.bg}/>
      <div style={styles.content}>
        {screens[screen]}
      </div>
      <nav style={styles.nav}>
        {navItems.map(n => (
          <button key={n.key} style={styles.navBtn(screen === n.key)} onClick={() => setScreen(n.key)}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
