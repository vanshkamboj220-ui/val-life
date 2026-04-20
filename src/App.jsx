import { useState, useEffect, useRef, useCallback } from "react";

/* ── RANKS ── Iron 1→2→3, Bronze 1→2→3 ... Radiant ── */
const TIERS = [
  { name:"Iron",      color:"#9CA3AF", glow:"#6B7280", bg:"#0E1014", emoji:"🔩" },
  { name:"Bronze",    color:"#CD7F32", glow:"#A0522D", bg:"#130E06", emoji:"🥉" },
  { name:"Silver",    color:"#E2E8F0", glow:"#94A3B8", bg:"#10111A", emoji:"⚔️" },
  { name:"Gold",      color:"#FBBF24", glow:"#D97706", bg:"#141000", emoji:"👑" },
  { name:"Platinum",  color:"#67E8F9", glow:"#0891B2", bg:"#04141A", emoji:"💎" },
  { name:"Diamond",   color:"#C4B5FD", glow:"#7C3AED", bg:"#0D0818", emoji:"💠" },
  { name:"Ascendant", color:"#4ADE80", glow:"#16A34A", bg:"#06140A", emoji:"🌿" },
  { name:"Immortal",  color:"#FB7185", glow:"#E11D48", bg:"#140406", emoji:"☠️" },
  { name:"Radiant",   color:"#FEF08A", glow:"#CA8A04", bg:"#141200", emoji:"✦"  },
];
const ALL_RANKS = TIERS.flatMap(t =>
  t.name === "Radiant"
    ? [{ full:"Radiant", tier:t, div:0 }]
    : [1,2,3].map(d => ({ full:`${t.name} ${d}`, tier:t, div:d }))
);
const RANK_COUNT = ALL_RANKS.length; // 25

// Difficulty multiplier per tier (Iron=0 … Radiant=8)
const DIFF = [1.0,1.15,1.3,1.5,1.7,2.0,2.4,2.9,3.5];

const CATS = [
  {id:"fitness",  name:"Fitness",    color:"#F87171", emoji:"💪"},
  {id:"mindset",  name:"Mindset",    color:"#A78BFA", emoji:"🧠"},
  {id:"career",   name:"Career",     color:"#60A5FA", emoji:"🚀"},
  {id:"social",   name:"Social",     color:"#F472B6", emoji:"❤️"},
  {id:"finance",  name:"Finance",    color:"#34D399", emoji:"💰"},
  {id:"creative", name:"Creativity", color:"#FBBF24", emoji:"🎨"},
];

const SIDE_QUESTS_POOL = [
  {id:"sq1",  text:"Wake up before 6 AM",      rr:8,  emoji:"🌅"},
  {id:"sq2",  text:"No phone first 30 min",    rr:6,  emoji:"📵"},
  {id:"sq3",  text:"Cold shower",              rr:10, emoji:"🚿"},
  {id:"sq4",  text:"20-min outdoor walk",      rr:7,  emoji:"🌿"},
  {id:"sq5",  text:"Zero junk food",           rr:9,  emoji:"🍎"},
  {id:"sq6",  text:"Learn one new thing",      rr:8,  emoji:"📚"},
  {id:"sq7",  text:"Do one scary thing",       rr:12, emoji:"⚡"},
  {id:"sq8",  text:"Help someone today",       rr:7,  emoji:"🤝"},
  {id:"sq9",  text:"Journal for 10 min",       rr:6,  emoji:"📓"},
  {id:"sq10", text:"Drink 3L of water",        rr:7,  emoji:"💧"},
];

/* ── STORAGE ── */
const KEY = "liferank_v5";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
const todayStr = () => new Date().toISOString().split("T")[0];
const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const rgba = (hex,a) => {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

function computeRR(pct, tIdx, streakDays, bonus) {
  let base;
  if      (pct >= 1.0) base = ri(22,30);
  else if (pct >= 0.8) base = ri(13,22);
  else if (pct >= 0.6) base = ri(5,13);
  else if (pct >= 0.4) base = -ri(5,14);
  else if (pct >= 0.2) base = -ri(12,22);
  else                  base = -ri(18,30);
  const d = DIFF[Math.min(tIdx,8)];
  if (tIdx >= 6) {
    if (base > 0) base = Math.round(base * Math.min(streakDays/14,1) * (1/d) * 1.5);
    else           base = Math.round(base * d);
  }
  return Math.max(-30, Math.min(30, base + bonus));
}

/* ══════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Boot: load everything from storage ── */
  const boot = load();

  const [phase,        setPhase]        = useState(boot.phase       || "setup");
  const [screen,       setScreen]       = useState("home");
  const [tasks,        setTasks]        = useState(boot.tasks       || []);
  const [rankIdx,      setRankIdx]      = useState(boot.rankIdx     ?? 0);
  const [rrNow,        setRrNow]        = useState(boot.rrNow       ?? 0);
  const [history,      setHistory]      = useState(boot.history     || []);
  const [streak,       setStreak]       = useState(boot.streak      ?? 0);
  const [streakDays,   setStreakDays]   = useState(boot.streakDays  ?? 0);
  // Timer stored as epoch ms end-time in localStorage — survives close
  const [timerEnd,     setTimerEnd]     = useState(boot.timerEnd    || null);
  const [timerRunning, setTimerRunning] = useState(boot.timerEnd    ? boot.timerEnd > Date.now() : false);
  const [timeLeft,     setTimeLeft]     = useState(0);
  // Daily progress
  const [doneTasks,    setDoneTasks]    = useState(boot.doneTasks   || {});
  const [doneSQ,       setDoneSQ]       = useState(boot.doneSQ      || {});
  const [bonusDone,    setBonusDone]    = useState(boot.bonusDone   || false);
  const [sideQuests,   setSideQuests]   = useState(boot.sideQuests  || []);
  const [bonusMission, setBonusMission] = useState(boot.bonusMission|| null);
  // UI
  const [popup,        setPopup]        = useState(null);
  const [aiMsg,        setAiMsg]        = useState(boot.aiMsg       || "");
  const [aiLoading,    setAiLoading]    = useState(false);
  const [newText,      setNewText]      = useState("");
  const [newCat,       setNewCat]       = useState("fitness");
  const [coachQ,       setCoachQ]       = useState("");
  // New day in progress flag (prevents double-trigger)
  const processingRef = useRef(false);

  const rank   = ALL_RANKS[rankIdx];
  const tier   = rank.tier;
  const tIdx   = TIERS.findIndex(t => t.name === tier.name);
  const C      = tier.color;
  const doneCnt = tasks.filter(t => doneTasks[t.id]).length;
  const pctDone = tasks.length > 0 ? doneCnt / tasks.length : 0;

  /* ── Persist helper ── */
  const persist = useCallback((patch = {}) => {
    const cur = load();
    save({ ...cur, phase, tasks, rankIdx, rrNow, history, streak, streakDays,
           timerEnd, doneTasks, doneSQ, bonusDone, sideQuests, bonusMission, aiMsg, ...patch });
  }, [phase,tasks,rankIdx,rrNow,history,streak,streakDays,timerEnd,doneTasks,doneSQ,bonusDone,sideQuests,bonusMission,aiMsg]);

  /* ── END-OF-DAY logic (called by tick or on-open catch-up) ── */
  const processDay = useCallback((dTasksSnap, dSQSnap, bDoneSnap, sqSnap, bmSnap, rankSnap, rrSnap, streakSnap, sdSnap, histSnap) => {
    if (processingRef.current) return;
    processingRef.current = true;

    const done  = tasks.filter(t => dTasksSnap[t.id]).length;
    const total = tasks.length;
    const pct   = total > 0 ? done / total : 0;
    const sqBonus = (sqSnap||[]).filter(q => dSQSnap[q.id]).reduce((s,q) => s+q.rr, 0);
    const bBonus  = bDoneSnap && bmSnap ? (bmSnap.bonusRR||12) : 0;
    const rr      = computeRR(pct, tIdx, sdSnap, sqBonus + bBonus);

    let newIdx = rankSnap, newRR = rrSnap + rr;
    while (newRR >= 100 && newIdx < RANK_COUNT-1) { newRR -= 100; newIdx++; }
    while (newRR < 0   && newIdx > 0)             { newIdx--;     newRR += 100; }
    newRR = Math.max(0, Math.min(99, newRR));

    const promoted  = newIdx > rankSnap;
    const newStreak = rr > 0 ? streakSnap+1 : 0;
    const newSD     = rr > 0 ? sdSnap+1     : 0;
    const entry = { date:todayStr(), rr, from:ALL_RANKS[rankSnap].full, to:ALL_RANKS[newIdx].full, done, total, pct:Math.round(pct*100) };
    const newHist = [entry, ...histSnap].slice(0, 60);

    // Start next 24h cycle immediately
    const nextEnd = Date.now() + 24*60*60*1000;

    // Pick new side quests & fetch bonus for next day
    const newSQ = [...SIDE_QUESTS_POOL].sort(()=>Math.random()-0.5).slice(0,3);

    setRankIdx(newIdx); setRrNow(newRR); setHistory(newHist);
    setStreak(newStreak); setStreakDays(newSD);
    setDoneTasks({}); setDoneSQ({}); setBonusDone(false);
    setSideQuests(newSQ); setBonusMission(null);
    setTimerEnd(nextEnd); setTimerRunning(true);

    save({
      phase, tasks, rankIdx:newIdx, rrNow:newRR, history:newHist,
      streak:newStreak, streakDays:newSD,
      doneTasks:{}, doneSQ:{}, bonusDone:false,
      sideQuests:newSQ, bonusMission:null,
      timerEnd:nextEnd, aiMsg,
    });

    if (promoted) setTimeout(()=>setPopup({type:"promote",rank:ALL_RANKS[newIdx]}), 300);
    else { setPopup({type:"rr",rr,col:rr>0?"#4ADE80":"#F87171"}); setTimeout(()=>setPopup(null),4000); }

    fetchBonus(newSQ);
    setTimeout(()=>{ processingRef.current = false; }, 2000);

    const ctx = rr>0
      ? `Day auto-ended. Gained ${rr} RR. ${done}/${total} tasks done. Rank: ${ALL_RANKS[newIdx].full}. ${promoted?"PROMOTED!":""} Brief analysis.`
      : `Day auto-ended. Lost ${Math.abs(rr)} RR. Only ${done}/${total} tasks. Rank: ${ALL_RANKS[newIdx].full}. Brief brutal feedback.`;
    setTimeout(()=>callCoach(ctx, newIdx, newSD, newHist), 800);
  }, [tasks, tIdx, phase, aiMsg]);

  /* ── On mount: check if timer expired while app was closed ── */
  useEffect(() => {
    if (boot.timerEnd && boot.timerEnd <= Date.now() && boot.phase === "rank") {
      // Timer expired while app was closed — process immediately
      processDay(
        boot.doneTasks   || {},
        boot.doneSQ      || {},
        boot.bonusDone   || false,
        boot.sideQuests  || [],
        boot.bonusMission|| null,
        boot.rankIdx     ?? 0,
        boot.rrNow       ?? 0,
        boot.streak      ?? 0,
        boot.streakDays  ?? 0,
        boot.history     || [],
      );
    }
    // Fetch bonus if we don't have one
    if (boot.phase === "rank" && !boot.bonusMission) fetchBonus(boot.sideQuests||[]);
    if (boot.phase === "rank" && (!boot.sideQuests || !boot.sideQuests.length)) {
      const sq = [...SIDE_QUESTS_POOL].sort(()=>Math.random()-0.5).slice(0,3);
      setSideQuests(sq); persist({sideQuests:sq});
    }
  }, []);

  /* ── Tick every second using stored timerEnd ── */
  useEffect(() => {
    const iv = setInterval(() => {
      if (!timerEnd) return;
      const left = timerEnd - Date.now();
      if (left <= 0) {
        setTimeLeft(0);
        setTimerRunning(false);
        if (!processingRef.current) {
          // Read latest state from storage to avoid stale closure
          const s = load();
          processDay(
            s.doneTasks   || {},
            s.doneSQ      || {},
            s.bonusDone   || false,
            s.sideQuests  || [],
            s.bonusMission|| null,
            s.rankIdx     ?? rankIdx,
            s.rrNow       ?? rrNow,
            s.streak      ?? streak,
            s.streakDays  ?? streakDays,
            s.history     || history,
          );
        }
      } else {
        setTimeLeft(left);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timerEnd]);

  /* ── Start first day ── */
  function startDay() {
    const end = Date.now() + 24*60*60*1000;
    const sq = [...SIDE_QUESTS_POOL].sort(()=>Math.random()-0.5).slice(0,3);
    setTimerEnd(end); setTimerRunning(true);
    setDoneTasks({}); setDoneSQ({}); setBonusDone(false);
    setSideQuests(sq); setBonusMission(null);
    save({ phase, tasks, rankIdx, rrNow, history, streak, streakDays,
           timerEnd:end, doneTasks:{}, doneSQ:{}, bonusDone:false,
           sideQuests:sq, bonusMission:null, aiMsg });
    setScreen("home");
    fetchBonus(sq);
    callCoach("Just started my ranked day. Hype me up and tell me what to focus on.", rankIdx, streakDays, history);
  }

  /* ── Manual end-day ── */
  function manualEndDay() {
    const s = load();
    processDay(
      s.doneTasks   || doneTasks,
      s.doneSQ      || doneSQ,
      s.bonusDone   ?? bonusDone,
      s.sideQuests  || sideQuests,
      s.bonusMission|| bonusMission,
      s.rankIdx     ?? rankIdx,
      s.rrNow       ?? rrNow,
      s.streak      ?? streak,
      s.streakDays  ?? streakDays,
      s.history     || history,
    );
  }

  /* ── Fetch bonus mission from AI ── */
  async function fetchBonus(sq) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:300,
          system:"Respond ONLY with valid JSON. No markdown, no backticks.",
          messages:[{role:"user",content:`Generate a daily bonus mission for a Valorant-themed life-improvement app. JSON format: {"title":"short mission name","description":"one sentence task","bonusRR":12,"tip":"short motivational quote"}`}]
        })
      });
      const d = await r.json();
      const txt = d.content?.map(x=>x.text||"").join("").replace(/```json|```/g,"").trim();
      const m = JSON.parse(txt);
      setBonusMission(m);
      const cur = load(); save({...cur, bonusMission:m});
    } catch {
      const m = {title:"Iron Will Protocol",description:"Do one meaningful thing today your future self will thank you for.",bonusRR:12,tip:"Discipline is choosing between what you want now and what you want most."};
      setBonusMission(m);
      const cur = load(); save({...cur, bonusMission:m});
    }
  }

  /* ── Coach AI ── */
  async function callCoach(ctx, rIdx=rankIdx, sd=streakDays, hist=history) {
    setAiLoading(true);
    const done = tasks.filter(t => doneTasks[t.id]).length;
    const sys = `You are an elite Valorant-style life coach AI. Be intense, data-driven, direct. Use gaming lingo. Max 90 words. Rank: ${ALL_RANKS[rIdx].full}. Streak: ${sd} days. Tasks today: ${done}/${tasks.length}. History (5d): ${JSON.stringify(hist.slice(0,5))}. Difficulty: ×${DIFF[tIdx].toFixed(1)}.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,system:sys,messages:[{role:"user",content:ctx}]})
      });
      const d = await r.json();
      const msg = d.content?.map(x=>x.text||"").join("") || "Stay locked in.";
      setAiMsg(msg);
      const cur = load(); save({...cur, aiMsg:msg});
    } catch(e) {
      const fallbacks = [
        "Network timeout — but your rank doesn't care. Every hour that timer ticks is a chance to gain RR. Execute.",
        "Connection failed. Doesn't matter. Your tasks are still there. Complete them.",
        "AI offline — but you know what to do. Lock in, complete your tasks, earn your RR.",
      ];
      const msg = fallbacks[Math.floor(Math.random()*fallbacks.length)];
      setAiMsg(msg);
    }
    setAiLoading(false);
  }

  /* ── Task helpers ── */
  function addTask() {
    if (!newText.trim()) return;
    const t = {id:`t${Date.now()}`,text:newText.trim(),cat:newCat};
    const n = [...tasks,t]; setTasks(n); setNewText("");
    persist({tasks:n});
  }
  function removeTask(id) {
    const n = tasks.filter(t=>t.id!==id); setTasks(n); persist({tasks:n});
  }
  function toggleTask(id) {
    setDoneTasks(prev => {
      const n = {...prev, [id]: !prev[id]};
      const cur = load();
      save({...cur, doneTasks: n});
      return n;
    });
  }
  function toggleSQ(id) {
    setDoneSQ(prev => {
      const n = {...prev, [id]: !prev[id]};
      const cur = load();
      save({...cur, doneSQ: n});
      return n;
    });
  }

  /* ── Format timer ── */
  const fmtTime = ms => {
    if (!ms || ms <= 0) return "00:00:00";
    const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return [h,m,sec].map(x=>String(x).padStart(2,"0")).join(":");
  };

  /* ══════════════════════════════════════════════════════════════
     CSS
  ══════════════════════════════════════════════════════════════ */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{background:#05050D;}
    .app{min-height:100vh;background:#05050D;font-family:'Barlow Condensed',sans-serif;color:#E2E8F0;overflow-x:hidden;}
    .orb{font-family:'Orbitron',monospace!important;}
    .screen{max-width:480px;margin:0 auto;padding-bottom:92px;}
    input,select{background:#0C0C1A;border:1px solid #1E1E30;border-radius:10px;padding:11px 14px;color:#E2E8F0;font-family:'Barlow Condensed',sans-serif;font-size:15px;width:100%;transition:all .2s;}
    input:focus,select:focus{outline:none;border-color:${rgba(C,.6)};box-shadow:0 0 0 3px ${rgba(C,.12)};}
    button{cursor:pointer;font-family:'Barlow Condensed',sans-serif;transition:all .18s;}
    button:active{transform:scale(.97);}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
    @keyframes glow{0%,100%{box-shadow:0 0 8px ${rgba(C,.28)}}50%{box-shadow:0 0 26px ${rgba(C,.6)}}}
    @keyframes rankBounce{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-6deg)}70%{transform:scale(.93)}100%{transform:scale(1)}}
    @keyframes confettiFall{from{opacity:1;transform:translateY(0) rotate(0)}to{opacity:0;transform:translateY(220px) rotate(720deg)}}
    @keyframes rrFloat{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}65%{opacity:1;transform:translate(-50%,-62%) scale(1)}100%{opacity:0;transform:translate(-50%,-95%) scale(.8)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .hover-lift{transition:all .18s;}.hover-lift:hover{transform:translateX(4px);}
    .btn-glow:hover{filter:brightness(1.14);transform:translateY(-1px);}
    .shimmer-txt{background:linear-gradient(90deg,${C} 0%,#fff 50%,${C} 100%);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite;}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:${rgba(C,.3)};border-radius:2px;}
  `;

  const cb = {background:"#0C0C1A",border:"1px solid #181828",borderRadius:14,padding:"16px"};
  const sl = {fontSize:10,letterSpacing:4,color:"#303048",textTransform:"uppercase",marginBottom:10};

  /* ══════════════════════════════════════════════════════════════
     SETUP
  ══════════════════════════════════════════════════════════════ */
  const Setup = (
    <div style={{padding:"0 18px"}}>
      <div style={{textAlign:"center",padding:"46px 0 30px"}}>
        <div className="orb shimmer-txt" style={{fontSize:38,fontWeight:900,letterSpacing:6}}>LIFERANK</div>
        <div style={{fontSize:12,color:"#2A2A44",letterSpacing:4,marginTop:6}}>RANKED SELF-IMPROVEMENT</div>
        <div style={{marginTop:20,padding:"14px 16px",background:rgba(C,.07),border:`1px solid ${rgba(C,.2)}`,borderRadius:14,fontSize:14,color:"#777",lineHeight:1.85,textAlign:"left"}}>
          <span style={{color:C,fontWeight:700}}>First, build your task list.</span> These are your daily ranked tasks — you'll do them every day to earn RR. Only tasks you create count. Add at least one, then enter ranked.
        </div>
      </div>

      <div style={sl}>Your Tasks ({tasks.length})</div>
      {tasks.length===0&&<div style={{textAlign:"center",padding:"18px",color:"#222",fontSize:14,border:"1px dashed #181828",borderRadius:12,marginBottom:14}}>No tasks yet.</div>}
      {tasks.map(t=>{
        const cat=CATS.find(c=>c.id===t.cat);
        return(
          <div key={t.id} className="hover-lift" style={{...cb,marginBottom:7,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{cat?.emoji}</span>
            <span style={{flex:1,fontSize:15,color:"#C0C8E0"}}>{t.text}</span>
            <span style={{fontSize:11,color:cat?.color,background:rgba(cat?.color||"#555",.12),padding:"2px 8px",borderRadius:10}}>{cat?.name}</span>
            <button onClick={()=>removeTask(t.id)} style={{background:"none",border:"none",color:"#2A2A44",fontSize:20,lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
        );
      })}

      <div style={{...cb,marginBottom:16,marginTop:14}}>
        <div style={sl}>Add New Task</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="What will you do every day?"/>
          <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <button className="btn-glow" onClick={addTask} style={{padding:"13px",background:rgba(C,.12),border:`1px solid ${rgba(C,.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2,fontWeight:700}}>+ ADD TASK</button>
        </div>
      </div>

      {tasks.length>0&&(
        <button className="btn-glow" onClick={()=>{setPhase("rank");persist({phase:"rank"});}} style={{width:"100%",padding:"18px",background:`linear-gradient(135deg,${rgba(C,.28)},${rgba(C,.1)})`,border:`1px solid ${C}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:900,letterSpacing:5,boxShadow:`0 0 26px ${rgba(C,.35)}`}}>
          ENTER RANKED ▶
        </button>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     HOME
  ══════════════════════════════════════════════════════════════ */
  const isLow = timeLeft < 3600000 && timerRunning;
  const Home = (
    <div>
      <div style={{padding:"18px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div>
          <div className="orb shimmer-txt" style={{fontSize:24,fontWeight:900,letterSpacing:5}}>LIFERANK</div>
          <div style={{fontSize:9,letterSpacing:5,color:rgba(C,.38),marginTop:1}}>EPISODE 1 · SEASON 1</div>
        </div>
        <div>
          {timerEnd?(
            <div className="orb" style={{background:rgba(isLow?"#F87171":C,.13),border:`1px solid ${rgba(isLow?"#F87171":C,.35)}`,borderRadius:20,padding:"7px 14px",fontSize:17,fontWeight:700,color:isLow?"#F87171":C,letterSpacing:2,animation:isLow?"pulse 1s infinite":"none",textAlign:"center"}}>
              {timerRunning ? fmtTime(timeLeft) : "00:00:00"}
              <div style={{fontSize:8,letterSpacing:3,color:rgba(isLow?"#F87171":C,.5),marginTop:1}}>{timerRunning?"RANKED DAY LIVE":"PROCESSING..."}</div>
            </div>
          ):(
            <div style={{fontSize:11,color:"#2A2A44",letterSpacing:2,textAlign:"right"}}>
              NO TIMER<br/><span style={{fontSize:9}}>START DAY BELOW</span>
            </div>
          )}
        </div>
      </div>

      {/* Rank card */}
      <div style={{margin:"14px 18px",background:tier.bg,border:`1px solid ${rgba(C,.3)}`,borderRadius:20,padding:"20px",position:"relative",overflow:"hidden",animation:"glow 4s infinite"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${rgba(C,.035)} 1px,transparent 1px)`,backgroundSize:"22px 22px",pointerEvents:"none"}}/>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:18,position:"relative"}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`radial-gradient(circle,${rgba(C,.25)} 0%,transparent 70%)`,border:`2.5px solid ${C}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,boxShadow:`0 0 24px ${rgba(C,.5)}`,flexShrink:0}}>{tier.emoji}</div>
          <div style={{flex:1}}>
            <div className="orb" style={{fontSize:25,fontWeight:900,color:C,letterSpacing:3,textShadow:`0 0 16px ${rgba(C,.45)}`,lineHeight:1}}>{rank.full}</div>
            <div style={{fontSize:12,color:rgba(C,.5),marginTop:5,letterSpacing:2}}>RR {rrNow}/100 · ×{DIFF[tIdx].toFixed(1)} DIFFICULTY</div>
            {tIdx>=6&&<div style={{fontSize:11,marginTop:4,color:streakDays>=14?"#4ADE80":"#FBBF24",letterSpacing:1}}>{streakDays>=14?"⚡ STREAK BONUS ACTIVE":`⚠ HARD MODE · ${streakDays}/14d STREAK`}</div>}
          </div>
        </div>
        <div style={{height:9,background:"#080816",borderRadius:5,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${rgba(C,.5)},${C})`,borderRadius:5,width:`${rrNow}%`,transition:"width 1.4s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 10px ${C}`}}/>
        </div>
        <div className="orb" style={{display:"flex",justifyContent:"space-between",fontSize:10,color:rgba(C,.4),marginTop:5}}><span>{rrNow} RR</span><span>100 RR → PROMOTE</span></div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"0 18px 14px"}}>
        {[["TASKS",`${doneCnt}/${tasks.length}`],["STREAK",`🔥 ${streak}`],["DAYS PLAYED",`${history.length}`]].map(([l,v])=>(
          <div key={l} style={{background:"#0C0C1A",border:"1px solid #161624",borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
            <div className="orb" style={{fontSize:20,fontWeight:700,color:C,lineHeight:1}}>{v}</div>
            <div style={{fontSize:9,letterSpacing:3,color:"#2A2A44",marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{...cb,margin:"0 18px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:10,letterSpacing:4,color:"#303048",textTransform:"uppercase"}}>Today's Progress</span>
          <span className="orb" style={{fontSize:32,fontWeight:900,color:C}}>{Math.round(pctDone*100)}%</span>
        </div>
        <div style={{height:8,background:"#080816",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${rgba(C,.5)},${C})`,borderRadius:4,width:`${pctDone*100}%`,transition:"width .9s ease",boxShadow:`0 0 8px ${C}`}}/>
        </div>
        <div style={{fontSize:13,color:"#2A2A44",marginTop:8,lineHeight:1.6}}>
          {pctDone===1?"✓ Full completion — max RR eligible. Submit whenever.":pctDone>=.8?"Almost done — push for 100%.":pctDone>=.5?"Past halfway — keep the momentum.":timerRunning?"You have time — go complete your tasks.":"Start your day to begin earning RR."}
        </div>
      </div>

      {/* Bonus mission */}
      {bonusMission&&(
        <div style={{...cb,margin:"0 18px 14px",background:"#0E0B00",border:"1px solid #FBBF2428"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"#FBBF24",marginBottom:7,textTransform:"uppercase"}}>⚡ DAILY BONUS MISSION</div>
          <div style={{fontSize:17,fontWeight:700,color:"#FEF3C7",marginBottom:4}}>{bonusMission.title}</div>
          <div style={{fontSize:13,color:"#777",lineHeight:1.6,marginBottom:10}}>{bonusMission.description}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span className="orb" style={{fontSize:14,color:"#FBBF24"}}>+{bonusMission.bonusRR} RR</span>
            <button onClick={()=>{ const next=!bonusDone; setBonusDone(next); const cur=load(); save({...cur,bonusDone:next}); }} style={{padding:"7px 18px",borderRadius:20,border:`1px solid ${bonusDone?"#22C55E44":"#252535"}`,background:bonusDone?rgba("#22C55E",.1):"none",color:bonusDone?"#22C55E":"#555",fontSize:13,letterSpacing:1,cursor:"pointer"}}>{bonusDone?"✓ Claimed":"Mark Done"}</button>
          </div>
          {bonusMission.tip&&<div style={{fontSize:11,color:"#333",marginTop:8,fontStyle:"italic"}}>"{bonusMission.tip}"</div>}
        </div>
      )}

      {/* Action button */}
      {!timerEnd?(
        <button className="btn-glow" onClick={startDay} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:`linear-gradient(135deg,${rgba(C,.22)},${rgba(C,.08)})`,border:`1px solid ${rgba(C,.55)}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:900,letterSpacing:4}}>
          ▶ START RANKED DAY
        </button>
      ):timerRunning?(
        <button className="btn-glow" onClick={manualEndDay} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:rgba("#F87171",.1),border:"1px solid #F8717148",borderRadius:14,color:"#F87171",fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,letterSpacing:3}}>
          ■ END DAY EARLY — SUBMIT RR
        </button>
      ):(
        <div style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:"#0C0C1A",border:"1px solid #161624",borderRadius:14,color:"#2A2A44",fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,textAlign:"center"}}>
          ⟳ NEXT DAY STARTING...
        </div>
      )}

      {/* Timer explanation */}
      {timerEnd&&(
        <div style={{margin:"0 18px 14px",padding:"10px 14px",background:rgba(C,.05),border:`1px solid ${rgba(C,.12)}`,borderRadius:10,fontSize:12,color:"#3A3A54",lineHeight:1.7}}>
          ⏱ Timer runs in the background — even when app is closed. After 24h, your RR updates automatically and the next cycle begins. You don't need to keep the app open.
        </div>
      )}

      {/* AI */}
      {aiLoading&&<div style={{textAlign:"center",color:"#2A2A44",fontSize:12,letterSpacing:3,margin:"0 18px 10px"}}>COACH AI ANALYZING...</div>}
      {aiMsg&&(
        <div style={{...cb,margin:"0 18px 14px",background:"#080810",border:`1px solid ${rgba(C,.13)}`}}>
          <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:9,textTransform:"uppercase"}}>🤖 COACH AI — LIVE ANALYSIS</div>
          <div style={{fontSize:15,color:"#909AAA",lineHeight:1.85}}>{aiMsg}</div>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     TASKS
  ══════════════════════════════════════════════════════════════ */
  const Tasks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>TASKS</div>
        <div style={{fontSize:11,color:timerRunning?"#22C55E":"#2A2A44",letterSpacing:2,display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:timerRunning?"#22C55E":"#2A2A44",display:"inline-block",animation:timerRunning?"pulse 1s infinite":"none"}}/>
          {timerRunning?"RANKED LIVE":"START TIMER FIRST"}
        </div>
      </div>
      <div style={{padding:"0 18px"}}>
        {!timerRunning&&!timerEnd&&<div style={{padding:"10px 14px",background:rgba(C,.07),border:`1px solid ${rgba(C,.18)}`,borderRadius:10,fontSize:13,color:rgba(C,.7),marginBottom:14}}>Start your ranked day from Home to check off tasks and earn RR.</div>}

        <div style={sl}>Daily Tasks — {doneCnt}/{tasks.length}</div>
        {tasks.map(t=>{
          const cat=CATS.find(c=>c.id===t.cat), done=!!doneTasks[t.id];
          return(
            <div key={t.id} className="hover-lift" onClick={()=>toggleTask(t.id)} style={{background:done?rgba("#22C55E",.07):"#0C0C1A",border:`1px solid ${done?"#22C55E44":"#181828"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${done?"#22C55E":"#303050"}`,background:done?"#22C55E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#000",fontWeight:700,flexShrink:0,transition:"all .15s",boxShadow:done?`0 0 8px #22C55E66`:"none"}}>{done?"✓":""}</div>
              <span style={{fontSize:18}}>{cat?.emoji}</span>
              <span style={{flex:1,fontSize:15,color:done?"#4ADE80":"#C0C8E0",textDecoration:done?"line-through":"none",transition:"all .15s"}}>{t.text}</span>
              <span style={{fontSize:11,color:cat?.color,background:rgba(cat?.color||"#555",.1),padding:"2px 8px",borderRadius:10}}>{cat?.name}</span>
            </div>
          );
        })}

        <div style={{...sl,marginTop:20,color:"#FBBF2255"}}>⚡ SIDE QUESTS — BONUS RR ({sideQuests.filter(q=>doneSQ[q.id]).length}/{sideQuests.length})</div>
        {sideQuests.map(q=>{
          const done=!!doneSQ[q.id];
          return(
            <div key={q.id} className="hover-lift" onClick={()=>toggleSQ(q.id)} style={{background:done?rgba("#FBBF24",.07):"#0C0C1A",border:`1px solid ${done?"#FBBF2444":"#181828"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${done?"#FBBF24":"#303050"}`,background:done?"#FBBF24":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#000",fontWeight:700,flexShrink:0,transition:"all .15s",boxShadow:done?`0 0 8px #FBBF2466`:"none"}}>{done?"✓":""}</div>
              <span style={{fontSize:18}}>{q.emoji}</span>
              <span style={{flex:1,fontSize:15,color:done?"#FBBF24":"#C0C8E0",textDecoration:done?"line-through":"none",transition:"all .15s"}}>{q.text}</span>
              <span className="orb" style={{fontSize:12,color:"#FBBF24"}}>+{q.rr}</span>
            </div>
          );
        })}

        <div style={{...cb,marginTop:20,marginBottom:14}}>
          <div style={sl}>Add / Remove Tasks</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="New daily task..."/>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)}>{CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select>
            <button className="btn-glow" onClick={addTask} style={{padding:"12px",background:rgba(C,.1),border:`1px solid ${rgba(C,.28)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2}}>+ ADD</button>
          </div>
          {tasks.map(t=>{
            const cat=CATS.find(c=>c.id===t.cat);
            return(
              <div key={t.id} style={{padding:"9px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10,background:"#090914",borderRadius:8,border:"1px solid #141422"}}>
                <span>{cat?.emoji}</span>
                <span style={{flex:1,fontSize:14,color:"#666"}}>{t.text}</span>
                <span style={{fontSize:11,color:cat?.color}}>{cat?.name}</span>
                <button onClick={()=>removeTask(t.id)} style={{background:"none",border:"none",color:"#222",fontSize:18,lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     RANKS
  ══════════════════════════════════════════════════════════════ */
  const Ranks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>RANK LADDER</div>
        <div style={{fontSize:11,color:C,letterSpacing:2}}>{rank.full}</div>
      </div>
      <div style={{padding:"0 18px"}}>
        <div style={{fontSize:13,color:"#2A2A44",lineHeight:1.9,marginBottom:16}}>Every tier increases difficulty. At Ascendant+ losses are amplified, gains need a 14-day streak. Reach Radiant to achieve life mastery.</div>
        {[...ALL_RANKS].reverse().map((r,i)=>{
          const rIdx2=RANK_COUNT-1-i, cur=rIdx2===rankIdx, past=rIdx2<rankIdx;
          const tIdx2=TIERS.findIndex(t=>t.name===r.tier.name), t2=r.tier;
          return(
            <div key={r.full} style={{background:cur?rgba(t2.color,.1):"#0C0C1A",border:`1px solid ${cur?rgba(t2.color,.4):past?"#101020":"#181828"}`,borderRadius:10,padding:"12px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:12,opacity:past?.42:1,transition:"all .2s"}}>
              <div style={{width:38,height:38,borderRadius:"50%",border:`2px solid ${cur?t2.color:rgba(t2.color,past?.22:.18)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:cur?`0 0 14px ${rgba(t2.color,.5)}`:undefined,flexShrink:0}}>{t2.emoji}</div>
              <div style={{flex:1}}>
                <div className="orb" style={{fontSize:13,fontWeight:700,color:cur?t2.color:past?rgba(t2.color,.32):"#2A2A44",letterSpacing:1}}>{r.full}</div>
                <div style={{fontSize:11,color:"#1E1E30",marginTop:2}}>×{DIFF[tIdx2].toFixed(2)} difficulty{tIdx2>=6?" · Hard mode":""}</div>
              </div>
              {cur&&<div className="orb" style={{fontSize:9,letterSpacing:2,color:t2.color,background:rgba(t2.color,.12),padding:"4px 10px",borderRadius:20}}>YOU</div>}
              {past&&<span style={{color:"#22C55E",fontSize:18}}>✓</span>}
              {r.full==="Radiant"&&!cur&&!past&&<span style={{fontSize:10,color:"#2A2A44",letterSpacing:1}}>FINAL</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     HISTORY
  ══════════════════════════════════════════════════════════════ */
  const History = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>MATCH LOG</div>
        <div className="orb" style={{fontSize:12,color:"#2A2A44",letterSpacing:2}}>{history.length} DAYS</div>
      </div>
      <div style={{padding:"0 18px"}}>
        {history.length===0&&<div style={{textAlign:"center",color:"#1E1E30",fontSize:14,marginTop:40,letterSpacing:3}}>NO HISTORY YET</div>}
        {history.map((h,i)=>(
          <div key={i} style={{background:"#0C0C1A",border:`1px solid ${h.rr>0?"#22C55E20":"#F8717120"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div className="orb" style={{fontSize:10,color:"#2A2A44",letterSpacing:2}}>{h.date}</div>
              <div style={{fontSize:14,color:"#777",marginTop:3}}>{h.from} <span style={{color:h.rr>0?"#22C55E":"#F87171"}}>{h.rr>0?"▲":"▼"}</span> {h.to}</div>
              <div style={{fontSize:11,color:"#1E1E30",marginTop:2}}>{h.done}/{h.total} tasks · {h.pct}% done</div>
            </div>
            <div className="orb" style={{fontSize:28,fontWeight:900,color:h.rr>0?"#22C55E":"#F87171"}}>{h.rr>0?"+":""}{h.rr}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     COACH
  ══════════════════════════════════════════════════════════════ */
  const Coach = (
    <div>
      <div style={{padding:"18px 18px 14px"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>AI COACH</div>
        <div style={{fontSize:12,color:"#2A2A44",letterSpacing:2,marginTop:4}}>DATA-DRIVEN LIFE ANALYSIS</div>
      </div>
      <div style={{padding:"0 18px"}}>
        {[
          {q:"Analyze my full history and tell me exactly what patterns are hurting my RR.",     l:"📊 Full Audit"},
          {q:"What bad habits show in my data? Be brutally honest.",                            l:"🔍 Habit Breakdown"},
          {q:"I'm losing RR. Give me a concrete bounce-back plan.",                             l:"📈 Recovery Plan"},
          {q:"What does my current rank say about my real-life progress?",                      l:"🏆 Rank Psychology"},
          {q:"Build me a 7-day challenge to maximize my RR gains.",                             l:"⚡ 7-Day Plan"},
          {q:"Am I on pace for Radiant? Give me a realistic honest timeline.",                  l:"🎯 Radiant Projection"},
          {q:"Which life area am I neglecting most based on my completed tasks?",              l:"🧠 Category Analysis"},
          {q:"Give me one mindset shift that will change my ranking trajectory.",               l:"💡 Mindset Unlock"},
        ].map(({q,l})=>(
          <button key={q} className="hover-lift" onClick={()=>callCoach(q)} style={{width:"100%",marginBottom:8,padding:"13px 16px",background:"#0C0C1A",border:"1px solid #181828",borderRadius:10,color:"#C0C8E0",fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
            <span style={{flex:1}}>{l}</span>
            <span style={{color:C,fontSize:18}}>›</span>
          </button>
        ))}
        <div style={{...cb,marginBottom:14,marginTop:8}}>
          <div style={sl}>Ask Anything</div>
          <div style={{display:"flex",gap:8}}>
            <input value={coachQ} onChange={e=>setCoachQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&coachQ.trim()&&callCoach(coachQ)} placeholder="Custom question..."/>
            <button className="btn-glow" onClick={()=>{if(coachQ.trim())callCoach(coachQ);}} style={{padding:"11px 16px",background:rgba(C,.12),border:`1px solid ${rgba(C,.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:1,whiteSpace:"nowrap",flexShrink:0}}>ASK ›</button>
          </div>
        </div>
        {aiLoading&&<div style={{textAlign:"center",color:"#2A2A44",fontSize:12,letterSpacing:3}}>PROCESSING YOUR DATA...</div>}
        {aiMsg&&(
          <div style={{...cb,background:"#080810",border:`1px solid ${rgba(C,.15)}`,marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:10,textTransform:"uppercase"}}>🤖 Coach Response</div>
            <div style={{fontSize:15,color:"#909AAA",lineHeight:1.85}}>{aiMsg}</div>
          </div>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     POPUPS
  ══════════════════════════════════════════════════════════════ */
  const PromotePopup = popup?.type==="promote"&&(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}} onClick={()=>setPopup(null)}>
      {Array.from({length:22}).map((_,i)=>(
        <div key={i} style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:[C,"#22C55E","#FBBF24","#F87171","#A78BFA"][i%5],left:`${4+i*4.2}%`,top:`${18+Math.random()*18}%`,animation:`confettiFall ${.7+Math.random()*.9}s ${Math.random()*.5}s forwards`}}/>
      ))}
      <div style={{textAlign:"center",animation:"scaleIn .5s cubic-bezier(.34,1.56,.64,1)",padding:"42px 32px",background:"rgba(5,5,13,0.92)",border:`1px solid ${rgba(popup.rank.tier.color,.42)}`,borderRadius:24,maxWidth:340,width:"90%",boxShadow:`0 0 60px ${rgba(popup.rank.tier.color,.32)}`}}>
        <div style={{fontSize:76,marginBottom:10,animation:"rankBounce .9s ease"}}>{popup.rank.tier.emoji}</div>
        <div className="orb" style={{fontSize:11,letterSpacing:6,color:rgba(popup.rank.tier.color,.6),marginBottom:10}}>CONGRATULATIONS</div>
        <div className="orb" style={{fontSize:14,fontWeight:900,color:"#666",letterSpacing:4,marginBottom:8}}>YOU ARE PROMOTED TO</div>
        <div className="orb" style={{fontSize:40,fontWeight:900,color:popup.rank.tier.color,letterSpacing:5,textShadow:`0 0 32px ${popup.rank.tier.color}`,lineHeight:1.1}}>{popup.rank.full}</div>
        <div style={{fontSize:12,color:"#2A2A44",marginTop:20}}>Tap anywhere to continue</div>
      </div>
    </div>
  );

  const RRPopup = popup?.type==="rr"&&(
    <div style={{position:"fixed",top:"42%",left:"50%",zIndex:300,pointerEvents:"none",animation:"rrFloat 4s forwards",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div className="orb" style={{fontSize:66,fontWeight:900,color:popup.col,textShadow:`0 0 42px ${popup.col}`,lineHeight:1}}>{popup.rr>0?"+":""}{popup.rr}</div>
      <div className="orb" style={{fontSize:14,color:popup.col,letterSpacing:5,marginTop:4}}>RR {popup.rr>0?"GAINED":"LOST"}</div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  const SCREENS = {home:Home,tasks:Tasks,ranks:Ranks,history:History,coach:Coach};
  const NAV = [{k:"home",l:"HOME",i:"⌂"},{k:"tasks",l:"TASKS",i:"☑"},{k:"ranks",l:"RANKS",i:"◆"},{k:"history",l:"LOG",i:"◉"},{k:"coach",l:"COACH",i:"★"}];

  return (
    <div className="app">
      <style>{CSS}</style>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:`radial-gradient(ellipse 70% 40% at 0% 0%,${rgba(C,.07)} 0%,transparent 65%),radial-gradient(ellipse 50% 30% at 100% 100%,${rgba(tier.glow,.05)} 0%,transparent 60%)`}}/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(${rgba(C,.03)} 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div className="screen">
          {phase==="setup" ? Setup : SCREENS[screen]}
        </div>
      </div>
      {phase==="rank"&&(
        <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(5,5,13,.97)",borderTop:`1px solid ${rgba(C,.14)}`,backdropFilter:"blur(16px)",display:"flex",zIndex:100,padding:"4px 0 6px"}}>
          {NAV.map(n=>(
            <button key={n.k} onClick={()=>setScreen(n.k)} style={{flex:1,padding:"10px 4px 5px",background:"none",border:"none",color:screen===n.k?C:"#242434",fontSize:9,display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:"'Orbitron',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all .2s"}}>
              <span style={{fontSize:20,filter:screen===n.k?`drop-shadow(0 0 6px ${C})`:"none",transition:"filter .2s"}}>{n.i}</span>
              <span>{n.l}</span>
            </button>
          ))}
        </nav>
      )}
      {PromotePopup}
      {RRPopup}
    </div>
  );
}
