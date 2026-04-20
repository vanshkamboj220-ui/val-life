import { useState, useEffect, useRef, useCallback } from "react";

const TIERS = [
  { name:"Iron",      color:"#9CA3AF", glow:"#6B7280", bg:"#111318", emoji:"🔩" },
  { name:"Bronze",    color:"#CD7F32", glow:"#A0522D", bg:"#1A1208", emoji:"🥉" },
  { name:"Silver",    color:"#E2E8F0", glow:"#94A3B8", bg:"#13141A", emoji:"⚔️" },
  { name:"Gold",      color:"#FBBF24", glow:"#D97706", bg:"#1A1600", emoji:"👑" },
  { name:"Platinum",  color:"#67E8F9", glow:"#0891B2", bg:"#061A1E", emoji:"💎" },
  { name:"Diamond",   color:"#C4B5FD", glow:"#7C3AED", bg:"#110A22", emoji:"💠" },
  { name:"Ascendant", color:"#4ADE80", glow:"#16A34A", bg:"#081A0D", emoji:"🌿" },
  { name:"Immortal",  color:"#FB7185", glow:"#E11D48", bg:"#1A0608", emoji:"☠️" },
  { name:"Radiant",   color:"#FEF08A", glow:"#CA8A04", bg:"#1A1600", emoji:"✦"  },
];

// Iron 1, Iron 2, Iron 3, Bronze 1 ... Radiant
const ALL_RANKS = TIERS.flatMap(t =>
  t.name === "Radiant"
    ? [{ full:"Radiant", tier:t, div:0 }]
    : [1,2,3].map(d => ({ full:`${t.name} ${d}`, tier:t, div:d }))
);

const RANK_COUNT = ALL_RANKS.length; // 25

// Difficulty: each tier index 0-8 => Iron...Radiant
const DIFF = [1.0, 1.1, 1.25, 1.4, 1.6, 1.85, 2.2, 2.7, 3.3];

const CATS = [
  { id:"fitness",    name:"Fitness",       color:"#F87171", emoji:"💪" },
  { id:"mindset",    name:"Mindset",       color:"#A78BFA", emoji:"🧠" },
  { id:"career",     name:"Career",        color:"#60A5FA", emoji:"🚀" },
  { id:"social",     name:"Social",        color:"#F472B6", emoji:"❤️" },
  { id:"finance",    name:"Finance",       color:"#34D399", emoji:"💰" },
  { id:"creative",   name:"Creativity",    color:"#FBBF24", emoji:"🎨" },
];

const ALL_SIDE_QUESTS = [
  { id:"sq1", text:"Wake up before 6 AM",       rr:8,  emoji:"🌅" },
  { id:"sq2", text:"No phone first 30 min",     rr:6,  emoji:"📵" },
  { id:"sq3", text:"Cold shower",               rr:10, emoji:"🚿" },
  { id:"sq4", text:"20-min outdoor walk",       rr:7,  emoji:"🌿" },
  { id:"sq5", text:"Zero junk food",            rr:9,  emoji:"🍎" },
  { id:"sq6", text:"Learn one new thing",       rr:8,  emoji:"📚" },
  { id:"sq7", text:"Do one scary thing",        rr:12, emoji:"⚡" },
  { id:"sq8", text:"Help someone today",        rr:7,  emoji:"🤝" },
  { id:"sq9", text:"Write in a journal",        rr:6,  emoji:"📓" },
  { id:"sq10",text:"Drink 3L of water",         rr:7,  emoji:"💧" },
];

const KEY = "liferank_v4";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
const todayStr = () => new Date().toISOString().split("T")[0];
const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const toRgba = (hex,a) => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

function computeRR(pct, tierIdx, streakDays, bonus) {
  let base;
  if      (pct >= 1.0) base = ri(20,30);
  else if (pct >= 0.8) base = ri(13,22);
  else if (pct >= 0.6) base = ri(5,13);
  else if (pct >= 0.4) base = -ri(5,14);
  else if (pct >= 0.2) base = -ri(12,22);
  else                  base = -ri(18,30);

  const diff = DIFF[Math.min(tierIdx, 8)];
  if (tierIdx >= 6) {
    // Ascendant+: gains gated by 14-day streak, losses amplified
    if (base > 0) {
      const gate = Math.min(streakDays / 14, 1);
      base = Math.round(base * gate * (1 / diff) * 1.4);
    } else {
      base = Math.round(base * diff);
    }
  }

  base += bonus;
  return Math.max(-30, Math.min(30, base));
}

export default function App() {
  const st = load();

  const [phase,          setPhase]          = useState(st?.phase || "setup");
  const [screen,         setScreen]         = useState("home");
  const [tasks,          setTasks]          = useState(st?.tasks || []);
  const [newText,        setNewText]        = useState("");
  const [newCat,         setNewCat]         = useState("fitness");
  const [rankIdx,        setRankIdx]        = useState(st?.rankIdx ?? 0);
  const [rrNow,          setRrNow]          = useState(st?.rrNow ?? 0);
  const [history,        setHistory]        = useState(st?.history || []);
  const [timerEnd,       setTimerEnd]       = useState(st?.timerEnd || null);
  const [timerActive,    setTimerActive]    = useState(st?.timerActive || false);
  const [timeLeft,       setTimeLeft]       = useState(0);
  const [doneTasks,      setDoneTasks]      = useState(st?.doneTasks || {});
  const [doneSQ,         setDoneSQ]         = useState(st?.doneSQ || {});
  const [dayLocked,      setDayLocked]      = useState(st?.dayLocked || false);
  const [streak,         setStreak]         = useState(st?.streak || 0);
  const [streakDays,     setStreakDays]      = useState(st?.streakDays || 0);
  const [sideQuests,     setSideQuests]     = useState(st?.sideQuests || []);
  const [bonusMission,   setBonusMission]   = useState(st?.bonusMission || null);
  const [bonusDone,      setBonusDone]      = useState(st?.bonusDone || false);
  const [aiMsg,          setAiMsg]          = useState(st?.aiMsg || "");
  const [aiLoading,      setAiLoading]      = useState(false);
  const [popup,          setPopup]          = useState(null);
  const [coachQ,         setCoachQ]         = useState("");

  const rank = ALL_RANKS[rankIdx];
  const tier = rank.tier;
  const tierIdx = TIERS.findIndex(t => t.name === tier.name);
  const C = tier.color;

  const p = useCallback((patch={}) => {
    const base = load()||{};
    save({...base, phase,tasks,rankIdx,rrNow,history,timerEnd,timerActive,doneTasks,doneSQ,dayLocked,streak,streakDays,sideQuests,bonusMission,bonusDone,aiMsg,...patch});
  },[phase,tasks,rankIdx,rrNow,history,timerEnd,timerActive,doneTasks,doneSQ,dayLocked,streak,streakDays,sideQuests,bonusMission,bonusDone,aiMsg]);

  // Tick
  useEffect(() => {
    const iv = setInterval(() => {
      if (timerActive && timerEnd) {
        const left = Math.max(0, timerEnd - Date.now());
        setTimeLeft(left);
        if (left === 0 && !dayLocked) handleEnd(true);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timerActive, timerEnd, dayLocked]);

  useEffect(() => {
    if (phase === "rank") {
      if (!bonusMission) fetchBonus();
      if (!sideQuests.length) pickSQ();
    }
  }, [phase]);

  function pickSQ() {
    const sq = [...ALL_SIDE_QUESTS].sort(()=>Math.random()-0.5).slice(0,3);
    setSideQuests(sq); p({sideQuests:sq});
  }

  async function fetchBonus() {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300,
          system:"Respond ONLY with valid JSON, no backticks, no markdown.",
          messages:[{role:"user",content:`Create a daily bonus mission JSON for a gamified life-improvement app. Format: {"title":"short name","description":"one sentence task","bonusRR":12,"tip":"short motivational quote"}`}]
        })
      });
      const d = await r.json();
      const txt = d.content?.map(x=>x.text||"").join("").replace(/```json|```/g,"").trim();
      const m = JSON.parse(txt);
      setBonusMission(m); p({bonusMission:m});
    } catch {
      const m={title:"Iron Will Protocol",description:"Do one task today that your future self will thank you for.",bonusRR:12,tip:"Discipline is choosing between what you want now and what you want most."};
      setBonusMission(m); p({bonusMission:m});
    }
  }

  async function callCoach(ctx) {
    setAiLoading(true);
    const done = tasks.filter(t=>doneTasks[t.id]).length;
    const sys = `You are an elite Valorant-style life coach AI. Be intense, data-driven, direct, use gaming lingo. Max 90 words. Player rank: ${rank.full}. Streak: ${streakDays} days. Tasks today: ${done}/${tasks.length}. Recent history (last 5 days): ${JSON.stringify(history.slice(0,5))}. Difficulty tier: ${DIFF[tierIdx]}x.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:500,
          system:sys, messages:[{role:"user",content:ctx}]
        })
      });
      const d = await r.json();
      const msg = d.content?.map(x=>x.text||"").join("")||"Stay locked in. Every day is ranked.";
      setAiMsg(msg); p({aiMsg:msg});
    } catch {
      setAiMsg("Network issue. But your grind doesn't stop. Lock in and execute.");
    }
    setAiLoading(false);
  }

  function startDay() {
    const end = Date.now() + 24*60*60*1000;
    setTimerActive(true); setTimerEnd(end);
    setDoneTasks({}); setDoneSQ({});
    setDayLocked(false); setBonusDone(false);
    pickSQ(); fetchBonus();
    p({timerActive:true,timerEnd:end,doneTasks:{},doneSQ:{},dayLocked:false,bonusDone:false});
    setScreen("home");
    callCoach("I just started a new ranked day. Hype me up and tell me what to focus on.");
  }

  function handleEnd(auto=false) {
    if (dayLocked) return;
    const done = tasks.filter(t=>doneTasks[t.id]).length;
    const total = tasks.length;
    const pct = total>0 ? done/total : 0;
    const sqBonus = sideQuests.filter(q=>doneSQ[q.id]).reduce((s,q)=>s+q.rr,0);
    const bBonus = bonusDone&&bonusMission ? (bonusMission.bonusRR||12) : 0;
    const rr = computeRR(pct, tierIdx, streakDays, sqBonus+bBonus);

    const oldIdx = rankIdx;
    let newIdx = rankIdx, newRR = rrNow + rr;
    while (newRR >= 100 && newIdx < RANK_COUNT-1) { newRR -= 100; newIdx++; }
    while (newRR < 0   && newIdx > 0)             { newIdx--;     newRR += 100; }
    newRR = Math.max(0, Math.min(99, newRR));

    const promoted = newIdx > oldIdx;
    const newStreak = rr>0 ? streak+1 : 0;
    const newSD     = rr>0 ? streakDays+1 : 0;
    const entry = { date:todayStr(), rr, from:ALL_RANKS[oldIdx].full, to:ALL_RANKS[newIdx].full, done, total, pct:Math.round(pct*100) };
    const newHist = [entry,...history].slice(0,60);

    setRankIdx(newIdx); setRrNow(newRR); setHistory(newHist);
    setStreak(newStreak); setStreakDays(newSD);
    setDayLocked(true); setTimerActive(false); setTimeLeft(0);
    p({rankIdx:newIdx,rrNow:newRR,history:newHist,streak:newStreak,streakDays:newSD,dayLocked:true,timerActive:false});

    if (promoted) setTimeout(()=>setPopup({type:"promote",rank:ALL_RANKS[newIdx]}), 400);
    else { setPopup({type:"rr",rr,col:rr>0?"#4ADE80":"#F87171"}); setTimeout(()=>setPopup(null),3800); }

    const ctx = rr>0
      ? `Day ended. Gained ${rr} RR. ${done}/${total} tasks. Now ${ALL_RANKS[newIdx].full}. ${promoted?"JUST PROMOTED!":""} Analyze.`
      : `Bad day. Lost ${Math.abs(rr)} RR. ${done}/${total} tasks. Fell to ${ALL_RANKS[newIdx].full}. Brutal honest feedback.`;
    setTimeout(()=>callCoach(ctx), 900);
  }

  const doneCnt   = tasks.filter(t=>doneTasks[t.id]).length;
  const pctDone   = tasks.length>0 ? doneCnt/tasks.length : 0;
  const sqDone    = sideQuests.filter(q=>doneSQ[q.id]).length;

  // ── STYLES ───────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body { background:#06060E; }
    .app { min-height:100vh; background:#06060E; font-family:'Barlow Condensed',sans-serif; color:#E2E8F0; overflow-x:hidden; }
    .orb { font-family:'Orbitron',monospace !important; }
    .screen { max-width:480px; margin:0 auto; padding-bottom:92px; }
    input,select { background:#0C0C18; border:1px solid #1E1E30; border-radius:10px; padding:11px 14px; color:#E2E8F0; font-family:'Barlow Condensed',sans-serif; font-size:15px; width:100%; transition:all 0.2s; }
    input:focus, select:focus { outline:none; border-color:${toRgba(C,0.6)}; box-shadow:0 0 0 3px ${toRgba(C,0.12)}; }
    button { cursor:pointer; font-family:'Barlow Condensed',sans-serif; transition:all 0.18s; }
    button:active { transform:scale(0.97); }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scaleIn { from{opacity:0;transform:scale(0.6)} to{opacity:1;transform:scale(1)} }
    @keyframes glow { 0%,100%{box-shadow:0 0 8px ${toRgba(C,0.3)}} 50%{box-shadow:0 0 25px ${toRgba(C,0.65)}} }
    @keyframes rankBounce { 0%{transform:scale(1)} 40%{transform:scale(1.3) rotate(-5deg)} 70%{transform:scale(0.95)} 100%{transform:scale(1)} }
    @keyframes confettiFall { from{opacity:1;transform:translateY(0) rotate(0)} to{opacity:0;transform:translateY(200px) rotate(720deg)} }
    @keyframes rrFloat { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)} 15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)} 65%{opacity:1;transform:translate(-50%,-60%) scale(1)} 100%{opacity:0;transform:translate(-50%,-90%) scale(0.85)} }
    @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
    .card-hover { transition:all 0.18s; }
    .card-hover:hover { transform:translateX(3px); }
    .btn-hover:hover { filter:brightness(1.12); transform:translateY(-1px); }
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${toRgba(C,0.3)}; border-radius:2px; }
    .shimmer-text { background:linear-gradient(90deg,${C} 0%,#fff 50%,${C} 100%); background-size:200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 3s linear infinite; }
  `;

  // reusable dim vars
  const cardBase = { background:"#0C0C18", border:`1px solid #1A1A28`, borderRadius:14, padding:"16px" };
  const sectionLabel = { fontSize:10, letterSpacing:4, color:"#3A3A50", textTransform:"uppercase", marginBottom:10 };

  // ── SETUP SCREEN ─────────────────────────────────────────────
  const Setup = (
    <div style={{padding:"0 18px"}}>
      <div style={{textAlign:"center",padding:"44px 0 28px"}}>
        <div className="orb shimmer-text" style={{fontSize:36,fontWeight:900,letterSpacing:6}}>LIFERANK</div>
        <div style={{fontSize:13,color:"#3A3A50",letterSpacing:4,marginTop:6}}>RANKED SELF-IMPROVEMENT</div>
        <div style={{marginTop:22,padding:"14px 18px",background:toRgba(C,0.07),border:`1px solid ${toRgba(C,0.18)}`,borderRadius:14,fontSize:14,color:"#888",lineHeight:1.8,textAlign:"left"}}>
          <span style={{color:C,fontWeight:700}}>Before entering rank,</span> build your task list. Only tasks YOU create count toward your RR. Make them realistic — you'll do these every single day.
        </div>
      </div>

      <div style={sectionLabel}>Your Daily Tasks ({tasks.length})</div>
      {tasks.length===0 && (
        <div style={{textAlign:"center",padding:"18px",color:"#2A2A40",fontSize:14,border:"1px dashed #1A1A28",borderRadius:12,marginBottom:14}}>
          No tasks yet — add at least one to begin.
        </div>
      )}
      {tasks.map(t => {
        const cat = CATS.find(c=>c.id===t.cat);
        return (
          <div key={t.id} className="card-hover" style={{...cardBase,marginBottom:7,display:"flex",alignItems:"center",gap:10,padding:"11px 14px"}}>
            <span style={{fontSize:18}}>{cat?.emoji}</span>
            <span style={{flex:1,fontSize:15,color:"#C0C8E0"}}>{t.text}</span>
            <span style={{fontSize:11,color:cat?.color,background:toRgba(cat?.color||"#555",0.12),padding:"2px 8px",borderRadius:10}}>{cat?.name}</span>
            <button onClick={()=>{const n=tasks.filter(x=>x.id!==t.id);setTasks(n);p({tasks:n});}} style={{background:"none",border:"none",color:"#2A2A40",fontSize:20,lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
        );
      })}

      <div style={{...cardBase,marginBottom:16,marginTop:14}}>
        <div style={sectionLabel}>Add New Task</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(()=>{if(!newText.trim())return;const t={id:`t${Date.now()}`,text:newText.trim(),cat:newCat};const n=[...tasks,t];setTasks(n);setNewText("");p({tasks:n});})()}  placeholder="What will you do every day?"/>
          <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <button className="btn-hover" onClick={()=>{if(!newText.trim())return;const t={id:`t${Date.now()}`,text:newText.trim(),cat:newCat};const n=[...tasks,t];setTasks(n);setNewText("");p({tasks:n});}} style={{padding:"13px",background:toRgba(C,0.12),border:`1px solid ${toRgba(C,0.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2,fontWeight:700}}>
            + ADD TASK
          </button>
        </div>
      </div>

      {tasks.length>0 && (
        <button className="btn-hover" onClick={()=>{setPhase("rank");p({phase:"rank"});}} style={{width:"100%",padding:"18px",background:`linear-gradient(135deg,${toRgba(C,0.28)},${toRgba(C,0.1)})`,border:`1px solid ${C}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:900,letterSpacing:5,boxShadow:`0 0 24px ${toRgba(C,0.35)}`}}>
          ENTER RANKED ▶
        </button>
      )}
    </div>
  );

  // ── HOME ─────────────────────────────────────────────────────
  const fmtTime = ms => {
    if(!ms||ms<=0) return "00:00:00";
    const sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":");
  };

  const Home = (
    <div>
      {/* Header */}
      <div style={{padding:"18px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div className="orb" style={{fontSize:22,fontWeight:900,letterSpacing:5,color:C,textShadow:`0 0 20px ${toRgba(C,0.5)}`}}>LIFERANK</div>
          <div style={{fontSize:9,letterSpacing:5,color:toRgba(C,0.4),marginTop:1}}>EPISODE 1 · SEASON 1</div>
        </div>
        {timerActive
          ? <div className="orb" style={{background:toRgba(C,0.12),border:`1px solid ${toRgba(C,0.3)}`,borderRadius:20,padding:"7px 14px",fontSize:17,fontWeight:700,color:timeLeft<3600000?"#F87171":C,letterSpacing:2,animation:timeLeft<3600000?"pulse 1s infinite":"none"}}>{fmtTime(timeLeft)}</div>
          : <div style={{fontSize:11,color:"#2A2A40",letterSpacing:2}}>NO ACTIVE TIMER</div>
        }
      </div>

      {/* Rank card */}
      <div style={{margin:"16px 18px",background:tier.bg,border:`1px solid ${toRgba(C,0.28)}`,borderRadius:20,padding:"20px",position:"relative",overflow:"hidden",animation:"glow 4s infinite"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`repeating-linear-gradient(60deg,${toRgba(C,0.025)} 0,${toRgba(C,0.025)} 1px,transparent 1px,transparent 40px),repeating-linear-gradient(120deg,${toRgba(C,0.025)} 0,${toRgba(C,0.025)} 1px,transparent 1px,transparent 40px)`,backgroundSize:"40px 70px",pointerEvents:"none"}}/>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:18,position:"relative"}}>
          <div style={{width:70,height:70,borderRadius:"50%",background:`radial-gradient(circle,${toRgba(C,0.22)} 0%,transparent 70%)`,border:`2.5px solid ${C}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:`0 0 22px ${toRgba(C,0.45)}`,flexShrink:0}}>{tier.emoji}</div>
          <div style={{flex:1}}>
            <div className="orb" style={{fontSize:24,fontWeight:900,color:C,letterSpacing:3,textShadow:`0 0 14px ${toRgba(C,0.4)}`,lineHeight:1}}>{rank.full}</div>
            <div style={{fontSize:12,color:toRgba(C,0.55),marginTop:5,letterSpacing:2}}>RR {rrNow}/100 · DIFF ×{DIFF[tierIdx].toFixed(1)}</div>
            {tierIdx>=6 && <div style={{fontSize:11,marginTop:4,color:streakDays>=14?"#4ADE80":"#FBBF24",letterSpacing:1}}>{streakDays>=14?"⚡ STREAK BONUS ACTIVE":`⚠ HARD MODE · ${streakDays}/14d STREAK`}</div>}
          </div>
        </div>
        <div style={{height:9,background:"#0A0A16",borderRadius:5,overflow:"hidden",position:"relative"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${toRgba(C,0.5)},${C})`,borderRadius:5,width:`${rrNow}%`,transition:"width 1.4s cubic-bezier(0.4,0,0.2,1)",boxShadow:`0 0 10px ${C}`}}/>
        </div>
        <div className="orb" style={{display:"flex",justifyContent:"space-between",fontSize:10,color:toRgba(C,0.45),marginTop:5}}>
          <span>{rrNow} RR</span><span>100 RR → PROMOTE</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"0 18px 14px"}}>
        {[["TASKS",`${doneCnt}/${tasks.length}`],["STREAK",`🔥${streak}`],["DAYS",`${history.length}`]].map(([l,v])=>(
          <div key={l} style={{background:"#0C0C18",border:"1px solid #181828",borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
            <div className="orb" style={{fontSize:22,fontWeight:700,color:C,lineHeight:1}}>{v}</div>
            <div style={{fontSize:9,letterSpacing:3,color:"#3A3A50",marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{...cardBase,margin:"0 18px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:10,letterSpacing:4,color:"#3A3A50",textTransform:"uppercase"}}>Daily Progress</span>
          <span className="orb" style={{fontSize:30,fontWeight:900,color:C}}>{Math.round(pctDone*100)}%</span>
        </div>
        <div style={{height:7,background:"#0A0A16",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${toRgba(C,0.55)},${C})`,borderRadius:4,width:`${pctDone*100}%`,transition:"width 0.9s ease",boxShadow:`0 0 8px ${C}`}}/>
        </div>
        <div style={{fontSize:12,color:"#3A3A50",marginTop:8}}>{pctDone===1?"✓ Maximum RR eligible! Submit now.":pctDone>=0.8?"Almost done — push for 100%":pctDone>=0.5?"Halfway there — keep the momentum":pctDone>0?"You started — now finish.":"Activate timer and begin your tasks"}</div>
      </div>

      {/* Bonus mission */}
      {bonusMission && (
        <div style={{...cardBase,margin:"0 18px 14px",background:"#0E0C00",border:"1px solid #FBBF2430"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"#FBBF24",marginBottom:7,textTransform:"uppercase"}}>⚡ DAILY BONUS MISSION</div>
          <div style={{fontSize:17,fontWeight:700,color:"#FEF3C7",marginBottom:4}}>{bonusMission.title}</div>
          <div style={{fontSize:13,color:"#888",lineHeight:1.6,marginBottom:10}}>{bonusMission.description}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span className="orb" style={{fontSize:14,color:"#FBBF24"}}>+{bonusMission.bonusRR} RR</span>
            <button onClick={()=>{if(!dayLocked){setBonusDone(true);p({bonusDone:true});}}} style={{padding:"7px 18px",borderRadius:20,border:`1px solid ${bonusDone?"#22C55E44":"#2A2A40"}`,background:bonusDone?toRgba("#22C55E",0.1):"none",color:bonusDone?"#22C55E":"#555",fontSize:13,letterSpacing:1}}>{bonusDone?"✓ Claimed":"Mark Done"}</button>
          </div>
          {bonusMission.tip && <div style={{fontSize:11,color:"#444",marginTop:8,fontStyle:"italic"}}>"{bonusMission.tip}"</div>}
        </div>
      )}

      {/* Action button */}
      {!timerActive && !dayLocked
        ? <button className="btn-hover" onClick={startDay} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:`linear-gradient(135deg,${toRgba(C,0.22)},${toRgba(C,0.08)})`,border:`1px solid ${toRgba(C,0.55)}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:900,letterSpacing:4}}>
            ▶ START RANKED DAY
          </button>
        : timerActive && !dayLocked
        ? <button className="btn-hover" onClick={()=>handleEnd(false)} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:toRgba("#F87171",0.1),border:"1px solid #F8717155",borderRadius:14,color:"#F87171",fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:900,letterSpacing:3}}>
            ■ END DAY — SUBMIT RR
          </button>
        : <div style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:"#0C0C18",border:"1px solid #1A1A28",borderRadius:14,color:"#2A2A40",fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:3,textAlign:"center"}}>
            ✓ DAY LOCKED · SEE YOU TOMORROW
          </div>
      }

      {/* AI */}
      {aiLoading && <div style={{textAlign:"center",color:"#3A3A50",fontSize:12,letterSpacing:3,margin:"0 18px"}}>COACH AI PROCESSING...</div>}
      {aiMsg && (
        <div style={{...cardBase,margin:"0 18px 14px",background:"#09090F",border:`1px solid ${toRgba(C,0.12)}`}}>
          <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:9,textTransform:"uppercase"}}>🤖 Coach AI — Real-time Analysis</div>
          <div style={{fontSize:15,color:"#A0AEC0",lineHeight:1.8}}>{aiMsg}</div>
        </div>
      )}
    </div>
  );

  // ── TASKS ────────────────────────────────────────────────────
  const Tasks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>TASKS</div>
        <div style={{fontSize:11,color:timerActive?"#22C55E":"#2A2A40",letterSpacing:2}}>{timerActive?"● RANKED LIVE":"● START TIMER FIRST"}</div>
      </div>

      <div style={{padding:"0 18px"}}>
        {!timerActive && !dayLocked && (
          <div style={{padding:"10px 14px",background:toRgba(C,0.07),border:`1px solid ${toRgba(C,0.18)}`,borderRadius:10,fontSize:13,color:toRgba(C,0.7),marginBottom:14}}>
            Start your ranked day from Home to check off tasks and earn RR.
          </div>
        )}

        <div style={sectionLabel}>Daily Tasks — {doneCnt}/{tasks.length}</div>
        {tasks.map(t => {
          const cat = CATS.find(c=>c.id===t.cat);
          const done = !!doneTasks[t.id];
          return (
            <div key={t.id} className="card-hover" onClick={()=>{if(dayLocked||!timerActive)return;setDoneTasks(p=>{const n={...p,[t.id]:!p[t.id]};p({doneTasks:n});return n;});}} style={{background:done?toRgba("#22C55E",0.06):"#0C0C18",border:`1px solid ${done?"#22C55E2A":"#1A1A28"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:(dayLocked||!timerActive)?"default":"pointer"}}>
              <div style={{width:22,height:22,borderRadius:5,border:`2px solid ${done?"#22C55E":"#252538"}`,background:done?"#22C55E":"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#000",flexShrink:0,transition:"all 0.15s"}}>{done?"✓":""}</div>
              <span style={{fontSize:18}}>{cat?.emoji}</span>
              <span style={{flex:1,fontSize:15,color:done?"#4ADE80":"#C0C8E0",textDecoration:done?"line-through":"none"}}>{t.text}</span>
              <span style={{fontSize:11,color:cat?.color,background:toRgba(cat?.color||"#555",0.1),padding:"2px 8px",borderRadius:10}}>{cat?.name}</span>
            </div>
          );
        })}

        {/* Side quests */}
        <div style={{...sectionLabel,marginTop:20,color:"#FBBF2466"}}>⚡ Side Quests — Bonus RR ({sqDone}/{sideQuests.length})</div>
        {sideQuests.map(q => {
          const done = !!doneSQ[q.id];
          return (
            <div key={q.id} className="card-hover" onClick={()=>{if(dayLocked||!timerActive)return;setDoneSQ(p=>{const n={...p,[q.id]:!p[q.id]};p({doneSQ:n});return n;});}} style={{background:done?toRgba("#FBBF24",0.06):"#0C0C18",border:`1px solid ${done?"#FBBF2430":"#1A1A28"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:(dayLocked||!timerActive)?"default":"pointer"}}>
              <div style={{width:22,height:22,borderRadius:5,border:`2px solid ${done?"#FBBF24":"#252538"}`,background:done?"#FBBF24":"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",flexShrink:0,transition:"all 0.15s"}}>{done?"✓":""}</div>
              <span style={{fontSize:18}}>{q.emoji}</span>
              <span style={{flex:1,fontSize:15,color:done?"#FBBF24":"#C0C8E0",textDecoration:done?"line-through":"none"}}>{q.text}</span>
              <span className="orb" style={{fontSize:12,color:"#FBBF24"}}>+{q.rr}</span>
            </div>
          );
        })}

        {/* Add task */}
        <div style={{...cardBase,marginTop:20,marginBottom:14}}>
          <div style={sectionLabel}>Add New Task</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(()=>{if(!newText.trim())return;const t={id:`t${Date.now()}`,text:newText.trim(),cat:newCat};const n=[...tasks,t];setTasks(n);setNewText("");p({tasks:n});})()}  placeholder="Add a new daily task..."/>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
              {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
            <button className="btn-hover" onClick={()=>{if(!newText.trim())return;const t={id:`t${Date.now()}`,text:newText.trim(),cat:newCat};const n=[...tasks,t];setTasks(n);setNewText("");p({tasks:n});}} style={{padding:"12px",background:toRgba(C,0.1),border:`1px solid ${toRgba(C,0.28)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2}}>+ ADD TASK</button>
          </div>
        </div>

        {/* Manage existing tasks */}
        {tasks.length>0 && (
          <>
            <div style={sectionLabel}>Manage Tasks</div>
            {tasks.map(t=>{
              const cat=CATS.find(c=>c.id===t.cat);
              return (
                <div key={t.id} style={{...cardBase,marginBottom:7,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,border:"1px solid #151525"}}>
                  <span>{cat?.emoji}</span>
                  <span style={{flex:1,fontSize:14,color:"#888"}}>{t.text}</span>
                  <span style={{fontSize:11,color:cat?.color}}>{cat?.name}</span>
                  <button onClick={()=>{const n=tasks.filter(x=>x.id!==t.id);setTasks(n);p({tasks:n});}} style={{background:"none",border:"none",color:"#2A2A40",fontSize:20,lineHeight:1}}>×</button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  // ── RANKS ────────────────────────────────────────────────────
  const Ranks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>RANK LADDER</div>
        <div style={{fontSize:11,color:C,letterSpacing:2}}>{rank.full}</div>
      </div>
      <div style={{padding:"0 18px"}}>
        <div style={{fontSize:12,color:"#3A3A50",lineHeight:1.8,marginBottom:16}}>
          Every tier has increased difficulty. Ascendant and above: gains are gated by streak, losses are amplified. 14-day streak unlocks bonus RR.
        </div>
        {[...ALL_RANKS].reverse().map((r,i)=>{
          const rIdx = RANK_COUNT-1-i;
          const cur = rIdx===rankIdx;
          const past = rIdx<rankIdx;
          const tIdx2 = TIERS.findIndex(t=>t.name===r.tier.name);
          const t2 = r.tier;
          return (
            <div key={r.full} style={{background:cur?toRgba(t2.color,0.09):"#0C0C18",border:`1px solid ${cur?toRgba(t2.color,0.38):past?"#111120":"#181828"}`,borderRadius:10,padding:"12px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:12,opacity:past?0.45:1,transition:"all 0.2s"}}>
              <div style={{width:38,height:38,borderRadius:"50%",border:`2px solid ${cur?t2.color:toRgba(t2.color,past?0.25:0.18)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:cur?`0 0 14px ${toRgba(t2.color,0.5)}`:undefined,flexShrink:0}}>{t2.emoji}</div>
              <div style={{flex:1}}>
                <div className="orb" style={{fontSize:13,fontWeight:700,color:cur?t2.color:past?toRgba(t2.color,0.35):"#3A3A50",letterSpacing:1}}>{r.full}</div>
                <div style={{fontSize:11,color:"#252535",marginTop:2}}>×{DIFF[tIdx2].toFixed(1)} difficulty{tIdx2>=6?" · Hard mode after Ascendant":""}</div>
              </div>
              {cur && <div className="orb" style={{fontSize:9,letterSpacing:2,color:t2.color,background:toRgba(t2.color,0.12),padding:"4px 10px",borderRadius:20}}>YOU</div>}
              {past && <span style={{color:"#22C55E",fontSize:18}}>✓</span>}
              {r.full==="Radiant"&&!cur&&!past && <span style={{fontSize:10,color:"#3A3A50",letterSpacing:1}}>FINAL</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── HISTORY ──────────────────────────────────────────────────
  const History = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>MATCH LOG</div>
        <div className="orb" style={{fontSize:12,color:"#3A3A50",letterSpacing:2}}>{history.length} DAYS</div>
      </div>
      <div style={{padding:"0 18px"}}>
        {history.length===0 && <div style={{textAlign:"center",color:"#2A2A40",fontSize:14,marginTop:40,letterSpacing:3}}>NO MATCH HISTORY YET</div>}
        {history.map((h,i)=>(
          <div key={i} style={{background:"#0C0C18",border:`1px solid ${h.rr>0?"#22C55E22":"#F8717122"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div className="orb" style={{fontSize:10,color:"#3A3A50",letterSpacing:2}}>{h.date}</div>
              <div style={{fontSize:14,color:"#888",marginTop:3}}>{h.from} <span style={{color:h.rr>0?"#22C55E":"#F87171"}}>{h.rr>0?"▲":"▼"}</span> {h.to}</div>
              <div style={{fontSize:11,color:"#2A2A40",marginTop:2}}>{h.done}/{h.total} tasks · {h.pct}% completion</div>
            </div>
            <div className="orb" style={{fontSize:26,fontWeight:900,color:h.rr>0?"#22C55E":"#F87171"}}>{h.rr>0?"+":""}{h.rr}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── COACH ────────────────────────────────────────────────────
  const Coach = (
    <div>
      <div style={{padding:"18px 18px 14px"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>AI COACH</div>
        <div style={{fontSize:12,color:"#3A3A50",letterSpacing:2,marginTop:4}}>POWERED BY CLAUDE · DATA-DRIVEN ANALYSIS</div>
      </div>
      <div style={{padding:"0 18px"}}>
        {[
          {q:"Analyze my full history and tell me what patterns are hurting my RR gains.",        l:"📊 Full Performance Audit"},
          {q:"What bad habits show up in my data? Be brutally honest.",                           l:"🔍 Habit Breakdown"},
          {q:"I'm stuck. Give me a concrete bounce-back plan based on my stats.",                l:"📈 Recovery Plan"},
          {q:"What does my current rank reveal about my life progress?",                         l:"🏆 Rank Psychology"},
          {q:"Build me a 7-day challenge to maximize RR gains this week.",                       l:"⚡ 7-Day Battle Plan"},
          {q:"Am I on pace for Radiant this year? Give me a realistic timeline.",                l:"🎯 Radiant Projection"},
          {q:"Which category of tasks am I neglecting most? What does that cost me?",           l:"🧠 Category Analysis"},
          {q:"Give me one mindset shift that will change everything for my ranking.",             l:"💡 Mindset Unlock"},
        ].map(({q,l})=>(
          <button key={q} className="card-hover" onClick={()=>callCoach(q)} style={{width:"100%",marginBottom:8,padding:"13px 16px",background:"#0C0C18",border:"1px solid #1A1A28",borderRadius:10,color:"#C0C8E0",fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
            <span style={{flex:1}}>{l}</span>
            <span style={{color:C,fontSize:18}}>›</span>
          </button>
        ))}

        <div style={{...cardBase,marginBottom:14,marginTop:8}}>
          <div style={sectionLabel}>Ask Anything</div>
          <div style={{display:"flex",gap:8}}>
            <input value={coachQ} onChange={e=>setCoachQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&coachQ.trim()&&callCoach(coachQ)} placeholder="Custom question..."/>
            <button className="btn-hover" onClick={()=>{if(coachQ.trim())callCoach(coachQ);}} style={{padding:"11px 18px",background:toRgba(C,0.12),border:`1px solid ${toRgba(C,0.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:1,whiteSpace:"nowrap"}}>ASK ›</button>
          </div>
        </div>

        {aiLoading && <div style={{textAlign:"center",color:"#3A3A50",fontSize:12,letterSpacing:3,marginTop:10}}>COACH PROCESSING YOUR DATA...</div>}
        {aiMsg && (
          <div style={{...cardBase,background:"#09090F",border:`1px solid ${toRgba(C,0.15)}`,marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:10,textTransform:"uppercase"}}>🤖 Coach Response</div>
            <div style={{fontSize:15,color:"#A0AEC0",lineHeight:1.8}}>{aiMsg}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ── POPUP ────────────────────────────────────────────────────
  const PromotePopup = popup?.type==="promote" && (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}} onClick={()=>setPopup(null)}>
      {Array.from({length:20}).map((_,i)=>(
        <div key={i} style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:[C,"#22C55E","#FBBF24","#F87171","#A78BFA"][i%5],left:`${5+i*4.5}%`,top:`${20+Math.random()*20}%`,animation:`confettiFall ${0.8+Math.random()*0.8}s ${Math.random()*0.4}s forwards`}}/>
      ))}
      <div style={{textAlign:"center",animation:"scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",padding:"40px 32px",background:"rgba(6,6,14,0.9)",border:`1px solid ${toRgba(popup.rank.tier.color,0.4)}`,borderRadius:24,maxWidth:340,width:"90%",boxShadow:`0 0 60px ${toRgba(popup.rank.tier.color,0.3)}`}}>
        <div style={{fontSize:72,marginBottom:8,animation:"rankBounce 0.8s ease"}}>{popup.rank.tier.emoji}</div>
        <div className="orb" style={{fontSize:11,letterSpacing:6,color:toRgba(popup.rank.tier.color,0.6),marginBottom:10}}>CONGRATULATIONS</div>
        <div className="orb" style={{fontSize:15,fontWeight:900,color:"#888",letterSpacing:4,marginBottom:8}}>YOU ARE PROMOTED TO</div>
        <div className="orb" style={{fontSize:38,fontWeight:900,color:popup.rank.tier.color,letterSpacing:5,textShadow:`0 0 30px ${popup.rank.tier.color}`,lineHeight:1.1}}>{popup.rank.full}</div>
        <div style={{fontSize:12,color:"#3A3A50",marginTop:20}}>Tap anywhere to continue</div>
      </div>
    </div>
  );

  const RRPopup = popup?.type==="rr" && (
    <div style={{position:"fixed",top:"42%",left:"50%",zIndex:300,pointerEvents:"none",animation:"rrFloat 3.8s forwards",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div className="orb" style={{fontSize:64,fontWeight:900,color:popup.col,textShadow:`0 0 40px ${popup.col}`,lineHeight:1}}>{popup.rr>0?"+":""}{popup.rr}</div>
      <div className="orb" style={{fontSize:14,color:popup.col,letterSpacing:5,marginTop:4}}>RR {popup.rr>0?"GAINED":"LOST"}</div>
    </div>
  );

  // ── MAIN RENDER ──────────────────────────────────────────────
  const MAP = {home:Home, tasks:Tasks, ranks:Ranks, history:History, coach:Coach};
  const NAV = [{k:"home",l:"HOME",i:"⌂"},{k:"tasks",l:"TASKS",i:"☑"},{k:"ranks",l:"RANKS",i:"◆"},{k:"history",l:"LOG",i:"◉"},{k:"coach",l:"COACH",i:"★"}];

  return (
    <div className="app">
      <style>{CSS}</style>
      {/* Ambient bg */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:`radial-gradient(ellipse 70% 40% at 0% 0%,${toRgba(C,0.06)} 0%,transparent 65%), radial-gradient(ellipse 50% 30% at 100% 100%,${toRgba(tier.glow,0.04)} 0%,transparent 60%)`}}/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(${toRgba(C,0.04)} 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>

      <div style={{position:"relative",zIndex:1}}>
        <div className="screen">
          {phase==="setup" ? Setup : MAP[screen]}
        </div>
      </div>

      {phase==="rank" && (
        <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(6,6,14,0.96)",borderTop:`1px solid ${toRgba(C,0.15)}`,backdropFilter:"blur(16px)",display:"flex",zIndex:100,padding:"4px 0 6px"}}>
          {NAV.map(n=>(
            <button key={n.k} onClick={()=>setScreen(n.k)} style={{flex:1,padding:"10px 4px 5px",background:"none",border:"none",color:screen===n.k?C:"#2A2A40",fontSize:9,display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:"'Orbitron',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.2s"}}>
              <span style={{fontSize:20,filter:screen===n.k?`drop-shadow(0 0 6px ${C})`:"none",transition:"filter 0.2s"}}>{n.i}</span>
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
