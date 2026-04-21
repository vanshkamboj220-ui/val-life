import { useState, useEffect, useRef } from "react";

/* ─── RANKS ─────────────────────────────────────────────────── */
const TIERS = [
  { name:"Iron",      color:"#9CA3AF", glow:"#4B5563", bg:"#0E1014", emoji:"🔩" },
  { name:"Bronze",    color:"#CD7F32", glow:"#92400E", bg:"#130E06", emoji:"🥉" },
  { name:"Silver",    color:"#E2E8F0", glow:"#94A3B8", bg:"#10111A", emoji:"⚔️" },
  { name:"Gold",      color:"#FBBF24", glow:"#B45309", bg:"#141000", emoji:"👑" },
  { name:"Platinum",  color:"#67E8F9", glow:"#0891B2", bg:"#04141A", emoji:"💎" },
  { name:"Diamond",   color:"#C4B5FD", glow:"#7C3AED", bg:"#0D0818", emoji:"💠" },
  { name:"Ascendant", color:"#4ADE80", glow:"#16A34A", bg:"#06140A", emoji:"🌿" },
  { name:"Immortal",  color:"#FB7185", glow:"#E11D48", bg:"#140406", emoji:"☠️" },
  { name:"Radiant",   color:"#FEF08A", glow:"#CA8A04", bg:"#141200", emoji:"✦"  },
];
const ALL_RANKS = TIERS.flatMap(t =>
  t.name==="Radiant" ? [{full:"Radiant",tier:t,div:0}] : [1,2,3].map(d=>({full:`${t.name} ${d}`,tier:t,div:d}))
);
const RANK_COUNT = ALL_RANKS.length; // 25
const DIFF = [1.0,1.15,1.3,1.5,1.7,2.0,2.4,2.9,3.5];

const CATS = [
  {id:"fitness",  name:"Fitness",    color:"#F87171", emoji:"💪"},
  {id:"mindset",  name:"Mindset",    color:"#A78BFA", emoji:"🧠"},
  {id:"career",   name:"Career",     color:"#60A5FA", emoji:"🚀"},
  {id:"social",   name:"Social",     color:"#F472B6", emoji:"❤️"},
  {id:"finance",  name:"Finance",    color:"#34D399", emoji:"💰"},
  {id:"creative", name:"Creativity", color:"#FBBF24", emoji:"🎨"},
];

const SQ_POOL = [
  {id:"sq1",  text:"Wake up before 6 AM",    rr:8,  emoji:"🌅", cat:"mindset"},
  {id:"sq2",  text:"No phone first 30 min",  rr:6,  emoji:"📵", cat:"mindset"},
  {id:"sq3",  text:"Cold shower",            rr:10, emoji:"🚿", cat:"fitness"},
  {id:"sq4",  text:"20-min outdoor walk",    rr:7,  emoji:"🌿", cat:"fitness"},
  {id:"sq5",  text:"Zero junk food",         rr:9,  emoji:"🍎", cat:"fitness"},
  {id:"sq6",  text:"Learn one new thing",    rr:8,  emoji:"📚", cat:"career"},
  {id:"sq7",  text:"Do one scary thing",     rr:12, emoji:"⚡", cat:"mindset"},
  {id:"sq8",  text:"Help someone today",     rr:7,  emoji:"🤝", cat:"social"},
  {id:"sq9",  text:"Journal for 10 min",     rr:6,  emoji:"📓", cat:"mindset"},
  {id:"sq10", text:"Drink 3L of water",      rr:7,  emoji:"💧", cat:"fitness"},
];

/* ─── STORAGE ───────────────────────────────────────────────── */
const KEY = "liferank_v7";
const LS  = {
  load: () => { try { return JSON.parse(localStorage.getItem(KEY))||{}; } catch { return {}; } },
  save: o  => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} },
  patch:(p) => { const c=LS.load(); LS.save({...c,...p}); },
};

const todayStr   = () => new Date().toISOString().split("T")[0];
const ri         = (a,b) => a+Math.floor(Math.random()*(b-a+1));
const toRgba     = (hex,a) => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };
const fmtHMS     = ms => { if(!ms||ms<=0) return "00:00:00"; const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return [h,m,sec].map(x=>String(x).padStart(2,"0")).join(":"); };
const fmtMS      = secs => `${String(Math.floor(Math.max(0,secs)/60)).padStart(2,"0")}:${String(Math.max(0,secs)%60).padStart(2,"0")}`;

function calcRR(pct, tIdx, streakDays, bonus) {
  let base;
  if      (pct>=1.0) base=ri(22,30); else if (pct>=0.8) base=ri(13,22);
  else if (pct>=0.6) base=ri(5,13);  else if (pct>=0.4) base=-ri(5,14);
  else if (pct>=0.2) base=-ri(12,22); else base=-ri(18,30);
  const d=DIFF[Math.min(tIdx,8)];
  if (tIdx>=6) { if (base>0) base=Math.round(base*Math.min(streakDays/14,1)*(1/d)*1.5); else base=Math.round(base*d); }
  return Math.max(-30, Math.min(30, base+bonus));
}

/* ─── AI helper — auto-detects localhost vs deployed ────────── */
// Gemini proxy — make sure proxy.cjs is running: node proxy.cjs
const PROXY_URL = "http://localhost:3002/api/chat";

async function callAI(systemPrompt, userMsg) {
  // Gemini has no system prompt field, so merge both into one message
  const combined = systemPrompt ? `${systemPrompt}\n\n${userMsg}` : userMsg;
  let r, d;
  try {
    r = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: combined }),
    });
    d = await r.json();
  } catch (err) {
    throw new Error("Proxy offline — run: node proxy.cjs");
  }
  if (d && d.text) return d.text;
  throw new Error("Empty Gemini response");
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const b = LS.load();

  const [phase,       setPhase]       = useState(b.phase      ||"setup");
  const [screen,      setScreen]      = useState("home");
  const [tasks,       setTasks]       = useState(b.tasks      ||[]);
  const [rankIdx,     setRankIdx]     = useState(b.rankIdx    ??0);
  const [rrNow,       setRrNow]       = useState(b.rrNow      ??0);
  const [history,     setHistory]     = useState(b.history    ||[]);
  const [streak,      setStreak]      = useState(b.streak     ??0);
  const [streakDays,  setStreakDays]  = useState(b.streakDays ??0);
  const [timerEnd,    setTimerEnd]    = useState(b.timerEnd   ||null);
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [doneTasks,   setDoneTasks]   = useState(b.doneTasks  ||{});  // {id: true}
  const [overtimeRR,  setOvertimeRR]  = useState(b.overtimeRR ||{});  // {id: extraRR}
  const [doneSQ,      setDoneSQ]      = useState(b.doneSQ     ||{});
  const [bonusDone,   setBonusDone]   = useState(b.bonusDone  ||false);
  const [sideQuests,  setSideQuests]  = useState(b.sideQuests ||[]);
  const [bonusMission,setBonusMission]= useState(b.bonusMission||null);
  const [popup,       setPopup]       = useState(null);
  const [aiMsg,       setAiMsg]       = useState(b.aiMsg      ||"");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [coachQ,      setCoachQ]      = useState("");

  // Setup form
  const [newText, setNewText] = useState("");
  const [newCat,  setNewCat]  = useState("fitness");
  const [newMins, setNewMins] = useState("30");

  // Per-task active timer: which task is currently being timed
  // taskTimerState: { id: { secsLeft, overtime, running, startedAt } }
  const [taskTimerState, setTaskTimerState] = useState({});
  // Task AI tips: { id: tipText }
  const [taskTips,  setTaskTips]  = useState(b.taskTips  ||{});
  // SQ AI reasons: { id: reasonText }
  const [sqReasons, setSqReasons] = useState(b.sqReasons ||{});
  const [tipsLoading, setTipsLoading] = useState({});

  const processingRef = useRef(false);

  const rank  = ALL_RANKS[rankIdx];
  const tier  = rank.tier;
  const tIdx  = TIERS.findIndex(t=>t.name===tier.name);
  const C     = tier.color;

  const doneCnt  = tasks.filter(t=>doneTasks[t.id]).length;
  const pctDone  = tasks.length>0 ? doneCnt/tasks.length : 0;
  const timerRunning = timerEnd ? timerEnd > Date.now() : false;

  /* ── Persist ── */
  function persist(patch={}) {
    const cur = LS.load();
    LS.save({...cur, phase,tasks,rankIdx,rrNow,history,streak,streakDays,
      timerEnd,doneTasks,overtimeRR,doneSQ,bonusDone,sideQuests,bonusMission,aiMsg,taskTips,sqReasons,...patch});
  }

  /* ── 24-hr global countdown tick ── */
  useEffect(()=>{
    const iv = setInterval(()=>{
      if (!timerEnd) return;
      const left = timerEnd - Date.now();
      if (left<=0) {
        setTimeLeft(0);
        if (!processingRef.current) {
          const s = LS.load();
          processDay(s);
        }
      } else setTimeLeft(left);
    }, 1000);
    return ()=>clearInterval(iv);
  },[timerEnd]);

  /* ── On mount: catch up if timer expired while closed ── */
  useEffect(()=>{
    if (b.timerEnd && b.timerEnd<=Date.now() && b.phase==="rank") processDay(b);
    if (b.phase==="rank") {
      if (!b.bonusMission) fetchBonus(b.sideQuests||[]);
      if (!b.sideQuests?.length) pickSQ(b.tasks||[]);
    }
  },[]);

  /* ── Per-task timer tick ── */
  useEffect(()=>{
    const iv = setInterval(()=>{
      setTaskTimerState(prev=>{
        const next = {...prev};
        let changed = false;
        for (const id in next) {
          const t = next[id];
          if (!t.running) continue;
          changed = true;
          const elapsed = Math.floor((Date.now()-t.startedAt)/1000);
          const secsLeft = t.totalSecs - elapsed;
          if (secsLeft<=0) {
            // Task duration hit — mark as done, start overtime counting
            next[id] = {...t, secsLeft:0, overtime: elapsed - t.totalSecs, overRunning:true};
            // Auto-mark task done when timer hits 0
            setDoneTasks(prev2=>{
              if (prev2[id]) return prev2;
              const n={...prev2,[id]:true};
              LS.patch({doneTasks:n}); return n;
            });
          } else {
            next[id] = {...t, secsLeft};
            if (t.overRunning) next[id].overtime = elapsed - t.totalSecs;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return ()=>clearInterval(iv);
  },[]);

  /* ── Process end of day ── */
  function processDay(s) {
    if (processingRef.current) return;
    processingRef.current = true;

    const myTasks   = s.tasks || tasks;
    const myDone    = s.doneTasks || {};
    const myDoneSQ  = s.doneSQ   || {};
    const myOT      = s.overtimeRR || {};
    const myBD      = s.bonusDone  || false;
    const myBM      = s.bonusMission||null;
    const mySQ      = s.sideQuests ||[];
    const myRank    = s.rankIdx    ?? rankIdx;
    const myRR      = s.rrNow      ?? rrNow;
    const myStreak  = s.streak     ?? streak;
    const mySD      = s.streakDays ?? streakDays;
    const myHist    = s.history    ||[];

    const myTIdx    = TIERS.findIndex(t=>t.name===ALL_RANKS[myRank].tier.name);
    const done      = myTasks.filter(t=>myDone[t.id]).length;
    const total     = myTasks.length;
    const pct       = total>0 ? done/total : 0;
    const sqBonus   = mySQ.filter(q=>myDoneSQ[q.id]).reduce((s,q)=>s+q.rr,0);
    const bBonus    = myBD&&myBM ? (myBM.bonusRR||12) : 0;
    const otBonus   = Object.values(myOT).reduce((s,v)=>s+v,0);
    const rr        = calcRR(pct, myTIdx, mySD, sqBonus+bBonus+otBonus);

    let newIdx=myRank, newRR=myRR+rr;
    while(newRR>=100&&newIdx<RANK_COUNT-1){newRR-=100;newIdx++;}
    while(newRR<0&&newIdx>0){newIdx--;newRR+=100;}
    newRR=Math.max(0,Math.min(99,newRR));

    const promoted   = newIdx>myRank;
    const newStreak  = rr>0 ? myStreak+1 : 0;
    const newSD      = rr>0 ? mySD+1     : 0;
    const entry      = {date:todayStr(),rr,from:ALL_RANKS[myRank].full,to:ALL_RANKS[newIdx].full,done,total,pct:Math.round(pct*100),otBonus};
    const newHist    = [entry,...myHist].slice(0,60);
    const nextEnd    = Date.now()+24*60*60*1000;
    const newSQ      = [...SQ_POOL].sort(()=>Math.random()-0.5).slice(0,3);

    setRankIdx(newIdx); setRrNow(newRR); setHistory(newHist);
    setStreak(newStreak); setStreakDays(newSD);
    setDoneTasks({}); setDoneSQ({}); setBonusDone(false); setOvertimeRR({});
    setSideQuests(newSQ); setBonusMission(null);
    setTimerEnd(nextEnd); setTaskTimerState({});

    LS.save({phase,tasks:myTasks,rankIdx:newIdx,rrNow:newRR,history:newHist,
      streak:newStreak,streakDays:newSD,timerEnd:nextEnd,
      doneTasks:{},doneSQ:{},bonusDone:false,overtimeRR:{},
      sideQuests:newSQ,bonusMission:null,aiMsg,taskTips,sqReasons});

    if (promoted) setTimeout(()=>setPopup({type:"promote",rank:ALL_RANKS[newIdx]}),400);
    else { setPopup({type:"rr",rr,col:rr>0?"#4ADE80":"#F87171"}); setTimeout(()=>setPopup(null),4000); }

    fetchBonus(newSQ);
    const ctx = rr>0
      ? `Day ended. Gained ${rr} RR (+${otBonus} overtime bonus). ${done}/${total} tasks. Rank: ${ALL_RANKS[newIdx].full}. ${promoted?"PROMOTED!":""} Brief analysis.`
      : `Day ended. Lost ${Math.abs(rr)} RR. ${done}/${total} tasks done. Fell to ${ALL_RANKS[newIdx].full}. Brief brutal feedback.`;
    setTimeout(()=>runCoach(ctx,newIdx,newSD,newHist,myTasks),900);
    setTimeout(()=>{ processingRef.current=false; },3000);
  }

  /* ── Start Day ── */
  function startDay() {
    const end = Date.now()+24*60*60*1000;
    const sq  = [...SQ_POOL].sort(()=>Math.random()-0.5).slice(0,3);
    setTimerEnd(end); setSideQuests(sq);
    setDoneTasks({}); setDoneSQ({}); setBonusDone(false); setOvertimeRR({}); setTaskTimerState({});
    LS.save({...LS.load(),timerEnd:end,sideQuests:sq,doneTasks:{},doneSQ:{},bonusDone:false,overtimeRR:{},taskTips,sqReasons});
    fetchBonus(sq);
    generateAllTips(tasks, sq);
    setScreen("home");
    runCoach("Just started a new ranked day. Hype me up briefly.");
  }

  /* ── Manual end ── */
  function manualEnd() { processDay(LS.load()); }

  /* ── Task timer controls ── */
  function startTaskTimer(id) {
    const t = tasks.find(x=>x.id===id);
    if (!t) return;
    setTaskTimerState(prev=>({
      ...prev,
      [id]: { totalSecs: (t.mins||30)*60, secsLeft: (t.mins||30)*60, overtime:0, running:true, overRunning:false, startedAt:Date.now() }
    }));
  }

  function stopTaskTimer(id) {
    setTaskTimerState(prev=>{
      const ts = prev[id];
      if (!ts) return prev;
      // Calculate overtime bonus RR: +1 per 5 min of overtime, max +5
      if (ts.overRunning && ts.overtime>0) {
        const bonus = Math.min(5, Math.floor(ts.overtime/300));
        if (bonus>0) {
          setOvertimeRR(p=>{ const n={...p,[id]:(p[id]||0)+bonus}; LS.patch({overtimeRR:n}); return n; });
        }
      }
      const next = {...prev}; delete next[id]; return next;
    });
  }

  function markDoneManual(id) {
    // Only callable after timer ran OR task has no timer requirement check
    setDoneTasks(prev=>{ const n={...prev,[id]:!prev[id]}; LS.patch({doneTasks:n}); return n; });
  }

  /* ── Fetch bonus mission ── */
  async function fetchBonus(sq) {
    try {
      const txt = await callAI(
        "Respond ONLY with valid JSON. No markdown or backticks.",
        `Create a daily bonus mission for a Valorant-themed life-improvement app. JSON: {"title":"short name","description":"one sentence task","bonusRR":12,"tip":"short motivational quote"}`
      );
      const m = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setBonusMission(m); LS.patch({bonusMission:m});
    } catch {
      const m={title:"Iron Will Protocol",description:"Do one meaningful thing today your future self will thank you for.",bonusRR:12,tip:"Discipline is choosing between what you want now and what you want most."};
      setBonusMission(m); LS.patch({bonusMission:m});
    }
  }

  /* ── Pick side quests ── */
  function pickSQ(myTasks) {
    // Prefer quests that match the user's task categories
    const userCats = [...new Set((myTasks||tasks).map(t=>t.cat))];
    const scored = SQ_POOL.map(q=>({...q, score: userCats.includes(q.cat)?2:0+Math.random()}));
    const sq = scored.sort((a,b)=>b.score-a.score).slice(0,3);
    setSideQuests(sq); LS.patch({sideQuests:sq});
  }

  /* ── Generate AI tip for one task ── */
  async function getTip(taskId) {
    const t = tasks.find(x=>x.id===taskId);
    if (!t || taskTips[taskId]) return;
    setTipsLoading(p=>({...p,[taskId]:true}));
    try {
      const cat = CATS.find(c=>c.id===t.cat);
      const msg = await callAI(
        `You are an expert life coach and ${cat?.name||"personal development"} specialist. Give sharp, specific, actionable advice. Max 60 words. No fluff.`,
        `The user has a daily task: "${t.text}" (category: ${cat?.name||t.cat}, duration: ${t.mins||30} min). Give them 2-3 specific tips on how to maximize results from this exact task. Be concrete, not generic.`
      );
      const tips = {...taskTips,[taskId]:msg};
      setTaskTips(tips); LS.patch({taskTips:tips});
    } catch { /* silent fail */ }
    setTipsLoading(p=>({...p,[taskId]:false}));
  }

  /* ── Generate AI reason for side quest ── */
  async function getSQReason(sqId) {
    const q = sideQuests.find(x=>x.id===sqId)||SQ_POOL.find(x=>x.id===sqId);
    if (!q || sqReasons[sqId]) return;
    setTipsLoading(p=>({...p,[sqId]:true}));
    try {
      const userCats = [...new Set(tasks.map(t=>t.cat))].join(", ");
      const msg = await callAI(
        "You are a life optimization coach. Be direct and specific. Max 50 words.",
        `Side quest: "${q.text}". The user's main focus areas are: ${userCats}. Explain in 2 sentences why this side quest is specifically beneficial for them given their focus areas.`
      );
      const reasons = {...sqReasons,[sqId]:msg};
      setSqReasons(reasons); LS.patch({sqReasons:reasons});
    } catch { /* silent fail */ }
    setTipsLoading(p=>({...p,[sqId]:false}));
  }

  /* ── Generate tips for all tasks on day start ── */
  async function generateAllTips(myTasks, mySQ) {
    for (const t of myTasks) {
      if (!taskTips[t.id]) await getTip(t.id).catch(()=>{});
    }
    for (const q of (mySQ||[])) {
      if (!sqReasons[q.id]) await getSQReason(q.id).catch(()=>{});
    }
  }

  /* ── Coach AI ── */
  async function runCoach(ctx, rIdx=rankIdx, sd=streakDays, hist=history, myTasks=tasks) {
    setAiLoading(true);
    const done = myTasks.filter(t=>doneTasks[t.id]).length;
    const taskList = myTasks.map(t=>t.text).join(", ");
    const sys = `You are an elite Valorant-style life coach AI. Intense, data-driven, direct, gaming lingo. Max 100 words. Rank: ${ALL_RANKS[rIdx].full}. Streak: ${sd} days. Tasks: ${taskList}. Completed today: ${done}/${myTasks.length}. Last 5 days: ${JSON.stringify(hist.slice(0,5))}. Difficulty: ×${DIFF[tIdx].toFixed(1)}.`;
    try {
      const msg = await callAI(sys, ctx);
      setAiMsg(msg); LS.patch({aiMsg:msg});
    } catch {
      const fb=["Network timeout — execute anyway. Your tasks are waiting.","AI offline. You know what to do. Lock in.","Connection failed. Grind doesn't stop."];
      setAiMsg(fb[ri(0,2)]);
    }
    setAiLoading(false);
  }

  /* ── Add task ── */
  function addTask() {
    if (!newText.trim()) return;
    const mins = Math.max(1, parseInt(newMins)||30);
    const t = {id:`t${Date.now()}`,text:newText.trim(),cat:newCat,mins};
    const n = [...tasks,t]; setTasks(n); setNewText(""); setNewMins("30");
    LS.patch({tasks:n});
  }
  function removeTask(id) {
    const n=tasks.filter(t=>t.id!==id); setTasks(n); LS.patch({tasks:n});
  }

  /* ─────────────────────────────────────────────────────────────
     STYLES
  ──────────────────────────────────────────────────────────────*/
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{background:#05050D;}
    .app{min-height:100vh;background:#05050D;font-family:'Barlow Condensed',sans-serif;color:#E2E8F0;overflow-x:hidden;}
    .orb{font-family:'Orbitron',monospace!important;}
    .scr{max-width:480px;margin:0 auto;padding-bottom:96px;}
    input,select{background:#0C0C1A;border:1px solid #1E1E30;border-radius:10px;padding:11px 14px;color:#E2E8F0;font-family:'Barlow Condensed',sans-serif;font-size:15px;width:100%;transition:all .2s;}
    input:focus,select:focus{outline:none;border-color:${toRgba(C,.6)};box-shadow:0 0 0 3px ${toRgba(C,.12)};}
    input[type=number]{-moz-appearance:textfield;}
    input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
    button{cursor:pointer;font-family:'Barlow Condensed',sans-serif;transition:all .18s;}
    button:active{transform:scale(.97);}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
    @keyframes glow{0%,100%{box-shadow:0 0 8px ${toRgba(C,.28)}}50%{box-shadow:0 0 28px ${toRgba(C,.65)}}}
    @keyframes rankBounce{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-6deg)}70%{transform:scale(.93)}100%{transform:scale(1)}}
    @keyframes confettiFall{from{opacity:1;transform:translateY(0) rotate(0)}to{opacity:0;transform:translateY(220px) rotate(720deg)}}
    @keyframes rrFloat{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}65%{opacity:1;transform:translate(-50%,-64%) scale(1)}100%{opacity:0;transform:translate(-50%,-98%) scale(.8)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes timerPulse{0%,100%{background:${toRgba("#F87171",.12)}}50%{background:${toRgba("#F87171",.25)}}}
    @keyframes slideDown{from{opacity:0;max-height:0;padding:0}to{opacity:1;max-height:200px}}
    .hl:hover{transform:translateX(3px);transition:transform .15s;}
    .bg:hover{filter:brightness(1.12);transform:translateY(-1px);}
    .shimmer-txt{background:linear-gradient(90deg,${C} 0%,#fff 50%,${C} 100%);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite;}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:${toRgba(C,.3)};border-radius:2px;}
    .tip-box{animation:slideDown .3s ease;overflow:hidden;}
    .overtime{animation:timerPulse 1s infinite;}
  `;
  const cb  = {background:"#0C0C1A",border:"1px solid #181828",borderRadius:14,padding:"16px"};
  const sl  = {fontSize:10,letterSpacing:4,color:"#2E2E48",textTransform:"uppercase",marginBottom:10};

  /* ─────────────────────────────────────────────────────────────
     SETUP SCREEN
  ──────────────────────────────────────────────────────────────*/
  const Setup = (
    <div style={{padding:"0 18px"}}>
      <div style={{textAlign:"center",padding:"44px 0 28px"}}>
        <div className="orb shimmer-txt" style={{fontSize:38,fontWeight:900,letterSpacing:6}}>LIFERANK</div>
        <div style={{fontSize:12,color:"#2A2A44",letterSpacing:4,marginTop:6}}>RANKED SELF-IMPROVEMENT</div>
        <div style={{marginTop:18,padding:"14px 16px",background:toRgba(C,.07),border:`1px solid ${toRgba(C,.2)}`,borderRadius:14,fontSize:14,color:"#777",lineHeight:1.85,textAlign:"left"}}>
          <span style={{color:C,fontWeight:700}}>Build your task list first.</span> Set a duration for each task — the timer will run, and <span style={{color:"#FBBF24"}}>overtime earns bonus RR</span> (+1 RR per extra 5 min, max +5). AI will give you personalized tips for each task.
        </div>
      </div>

      <div style={sl}>Your Tasks ({tasks.length})</div>
      {tasks.length===0&&<div style={{textAlign:"center",padding:"18px",color:"#1E1E30",fontSize:14,border:"1px dashed #181828",borderRadius:12,marginBottom:14}}>No tasks yet — add at least one.</div>}
      {tasks.map(t=>{
        const cat=CATS.find(c=>c.id===t.cat);
        return(
          <div key={t.id} className="hl" style={{...cb,marginBottom:7,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{cat?.emoji}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:15,color:"#C0C8E0"}}>{t.text}</div>
              <div style={{fontSize:11,color:"#444",marginTop:2}}>⏱ {t.mins||30} min · {cat?.name}</div>
            </div>
            <button onClick={()=>removeTask(t.id)} style={{background:"none",border:"none",color:"#2A2A44",fontSize:20,lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
        );
      })}

      <div style={{...cb,marginBottom:16,marginTop:12}}>
        <div style={sl}>Add New Task</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="What will you do every day? (e.g. Gym workout)"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
              {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
            <div style={{position:"relative"}}>
              <input type="number" min="1" max="480" value={newMins} onChange={e=>setNewMins(e.target.value)} placeholder="30" style={{paddingRight:40}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#444",pointerEvents:"none"}}>min</span>
            </div>
          </div>
          <button className="bg" onClick={addTask} style={{padding:"13px",background:toRgba(C,.12),border:`1px solid ${toRgba(C,.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2,fontWeight:700}}>+ ADD TASK</button>
        </div>
      </div>

      {tasks.length>0&&(
        <button className="bg" onClick={()=>{setPhase("rank");LS.patch({phase:"rank"});}} style={{width:"100%",padding:"18px",background:`linear-gradient(135deg,${toRgba(C,.28)},${toRgba(C,.1)})`,border:`1px solid ${C}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:900,letterSpacing:5,boxShadow:`0 0 26px ${toRgba(C,.35)}`}}>
          ENTER RANKED ▶
        </button>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     HOME SCREEN
  ──────────────────────────────────────────────────────────────*/
  const isLow = timeLeft<3600000 && timeLeft>0;
  const Home = (
    <div>
      <div style={{padding:"18px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div>
          <div className="orb shimmer-txt" style={{fontSize:24,fontWeight:900,letterSpacing:5}}>LIFERANK</div>
          <div style={{fontSize:9,letterSpacing:5,color:toRgba(C,.38),marginTop:1}}>EPISODE 1 · SEASON 1</div>
        </div>
        {timerEnd?(
          <div className="orb" style={{background:toRgba(isLow?"#F87171":C,.13),border:`1px solid ${toRgba(isLow?"#F87171":C,.35)}`,borderRadius:20,padding:"7px 14px",fontSize:17,fontWeight:700,color:isLow?"#F87171":C,letterSpacing:2,animation:isLow?"pulse 1s infinite":"none",textAlign:"center"}}>
            {fmtHMS(timeLeft)}
            <div style={{fontSize:8,letterSpacing:3,color:toRgba(isLow?"#F87171":C,.5),marginTop:1}}>{timerRunning?"RANKED DAY LIVE":"NEXT DAY STARTING"}</div>
          </div>
        ):(
          <div style={{fontSize:11,color:"#2A2A44",letterSpacing:2,textAlign:"right"}}>NO TIMER<br/><span style={{fontSize:9}}>START BELOW</span></div>
        )}
      </div>

      {/* Rank card */}
      <div style={{margin:"14px 18px",background:tier.bg,border:`1px solid ${toRgba(C,.3)}`,borderRadius:20,padding:"20px",position:"relative",overflow:"hidden",animation:"glow 4s infinite"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${toRgba(C,.03)} 1px,transparent 1px)`,backgroundSize:"22px 22px",pointerEvents:"none"}}/>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16,position:"relative"}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`radial-gradient(circle,${toRgba(C,.25)} 0%,transparent 70%)`,border:`2.5px solid ${C}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,boxShadow:`0 0 24px ${toRgba(C,.5)}`,flexShrink:0}}>{tier.emoji}</div>
          <div style={{flex:1}}>
            <div className="orb" style={{fontSize:24,fontWeight:900,color:C,letterSpacing:3,textShadow:`0 0 16px ${toRgba(C,.45)}`,lineHeight:1}}>{rank.full}</div>
            <div style={{fontSize:12,color:toRgba(C,.5),marginTop:5,letterSpacing:2}}>RR {rrNow}/100 · ×{DIFF[tIdx].toFixed(1)} DIFF</div>
            {tIdx>=6&&<div style={{fontSize:11,marginTop:4,color:streakDays>=14?"#4ADE80":"#FBBF24"}}>{streakDays>=14?"⚡ STREAK BONUS ACTIVE":`⚠ HARD MODE · ${streakDays}/14d STREAK`}</div>}
          </div>
        </div>
        <div style={{height:9,background:"#080816",borderRadius:5,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${toRgba(C,.5)},${C})`,borderRadius:5,width:`${rrNow}%`,transition:"width 1.4s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 10px ${C}`}}/>
        </div>
        <div className="orb" style={{display:"flex",justifyContent:"space-between",fontSize:10,color:toRgba(C,.4),marginTop:5}}><span>{rrNow} RR</span><span>100 RR → PROMOTE</span></div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"0 18px 14px"}}>
        {[["TASKS",`${doneCnt}/${tasks.length}`],["STREAK",`🔥 ${streak}`],["DAYS",`${history.length}`]].map(([l,v])=>(
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
          <div style={{height:"100%",background:`linear-gradient(90deg,${toRgba(C,.5)},${C})`,borderRadius:4,width:`${pctDone*100}%`,transition:"width .9s ease",boxShadow:`0 0 8px ${C}`}}/>
        </div>
        {Object.keys(overtimeRR).length>0&&(
          <div style={{fontSize:12,color:"#FBBF24",marginTop:8}}>⚡ Overtime bonus: +{Object.values(overtimeRR).reduce((a,b)=>a+b,0)} RR earned today</div>
        )}
      </div>

      {/* Bonus mission */}
      {bonusMission&&(
        <div style={{...cb,margin:"0 18px 14px",background:"#0E0B00",border:"1px solid #FBBF2428"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"#FBBF24",marginBottom:7,textTransform:"uppercase"}}>⚡ DAILY BONUS MISSION</div>
          <div style={{fontSize:17,fontWeight:700,color:"#FEF3C7",marginBottom:4}}>{bonusMission.title}</div>
          <div style={{fontSize:13,color:"#777",lineHeight:1.6,marginBottom:10}}>{bonusMission.description}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span className="orb" style={{fontSize:14,color:"#FBBF24"}}>+{bonusMission.bonusRR} RR</span>
            <button onClick={()=>{const n=!bonusDone;setBonusDone(n);LS.patch({bonusDone:n});}} style={{padding:"7px 18px",borderRadius:20,border:`1px solid ${bonusDone?"#22C55E44":"#252535"}`,background:bonusDone?toRgba("#22C55E",.1):"none",color:bonusDone?"#22C55E":"#555",fontSize:13,cursor:"pointer"}}>{bonusDone?"✓ Claimed":"Mark Done"}</button>
          </div>
          {bonusMission.tip&&<div style={{fontSize:11,color:"#333",marginTop:8,fontStyle:"italic"}}>"{bonusMission.tip}"</div>}
        </div>
      )}

      {/* Action button */}
      {!timerEnd?(
        <button className="bg" onClick={startDay} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:`linear-gradient(135deg,${toRgba(C,.22)},${toRgba(C,.08)})`,border:`1px solid ${toRgba(C,.55)}`,borderRadius:14,color:C,fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:900,letterSpacing:4}}>▶ START RANKED DAY</button>
      ):timerRunning?(
        <button className="bg" onClick={manualEnd} style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:toRgba("#F87171",.1),border:"1px solid #F8717148",borderRadius:14,color:"#F87171",fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,letterSpacing:3}}>■ END DAY EARLY — SUBMIT RR</button>
      ):(
        <div style={{display:"block",width:"calc(100% - 36px)",margin:"0 18px 14px",padding:"17px",background:"#0C0C1A",border:"1px solid #161624",borderRadius:14,color:"#2A2A44",fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,textAlign:"center"}}>⟳ NEXT DAY STARTING...</div>
      )}

      {timerEnd&&<div style={{margin:"0 18px 14px",padding:"10px 14px",background:toRgba(C,.04),border:`1px solid ${toRgba(C,.1)}`,borderRadius:10,fontSize:12,color:"#2A2A44",lineHeight:1.7}}>⏱ Timer runs 24h in background. Close the app anytime — rank updates automatically when the cycle ends.</div>}

      {aiLoading&&<div style={{textAlign:"center",color:"#2A2A44",fontSize:12,letterSpacing:3,margin:"0 18px 10px"}}>COACH AI ANALYZING...</div>}
      {aiMsg&&(
        <div style={{...cb,margin:"0 18px 14px",background:"#080810",border:`1px solid ${toRgba(C,.13)}`}}>
          <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:9,textTransform:"uppercase"}}>🤖 COACH AI — ANALYSIS</div>
          <div style={{fontSize:15,color:"#909AAA",lineHeight:1.85}}>{aiMsg}</div>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     TASKS SCREEN — with per-task countdown timers
  ──────────────────────────────────────────────────────────────*/
  const Tasks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>TASKS</div>
        <div style={{fontSize:11,color:timerRunning?"#22C55E":"#2A2A44",letterSpacing:2,display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:timerRunning?"#22C55E":"#2A2A44",display:"inline-block",animation:timerRunning?"pulse 1s infinite":"none"}}/>
          {timerRunning?"RANKED LIVE":"TIMER INACTIVE"}
        </div>
      </div>

      <div style={{padding:"0 18px"}}>
        <div style={sl}>Daily Tasks — {doneCnt}/{tasks.length} done</div>

        {tasks.map(t=>{
          const cat   = CATS.find(c=>c.id===t.cat);
          const done  = !!doneTasks[t.id];
          const ts    = taskTimerState[t.id];
          const tip   = taskTips[t.id];
          const loading = tipsLoading[t.id];
          const otRR  = overtimeRR[t.id]||0;
          const isRunning    = ts?.running;
          const isOvertime   = ts?.overRunning;
          const secsLeft     = ts?.secsLeft??0;
          const overtimeSecs = ts?.overtime??0;

          return (
            <div key={t.id} style={{marginBottom:10}}>
              {/* Main task row */}
              <div className="hl" style={{background:done?toRgba("#22C55E",.07):"#0C0C1A",border:`1px solid ${done?"#22C55E44":isRunning?toRgba(C,.4):"#181828"}`,borderRadius:12,padding:"13px 14px",display:"flex",alignItems:"center",gap:12,userSelect:"none"}}>
                {/* Checkbox — only tappable if timer ran or task has no active timer */}
                <div onClick={()=>markDoneManual(t.id)} style={{width:24,height:24,borderRadius:6,border:`2px solid ${done?"#22C55E":isRunning?"#444":"#2A2A40"}`,background:done?"#22C55E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#000",flexShrink:0,transition:"all .15s",cursor:"pointer",boxShadow:done?"0 0 8px #22C55E66":"none",opacity:isRunning&&!done?.5:1}}>{done?"✓":""}</div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,color:done?"#4ADE80":"#C0C8E0",textDecoration:done?"line-through":"none"}}>{t.text}</div>
                  <div style={{display:"flex",gap:8,marginTop:3,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:cat?.color,background:toRgba(cat?.color||"#555",.12),padding:"2px 8px",borderRadius:10}}>{cat?.emoji} {cat?.name}</span>
                    <span style={{fontSize:11,color:"#444"}}>⏱ {t.mins} min</span>
                    {otRR>0&&<span style={{fontSize:11,color:"#FBBF24",background:toRgba("#FBBF24",.12),padding:"2px 8px",borderRadius:10}}>+{otRR} overtime RR</span>}
                  </div>
                </div>

                {/* Timer display or start button */}
                {isRunning?(
                  <div style={{textAlign:"center",flexShrink:0}}>
                    {isOvertime?(
                      <div className="overtime" style={{borderRadius:8,padding:"6px 10px",border:"1px solid #F8717155"}}>
                        <div className="orb" style={{fontSize:16,fontWeight:700,color:"#F87171"}}>+{fmtMS(overtimeSecs)}</div>
                        <div style={{fontSize:9,color:"#F87171",letterSpacing:2}}>OVERTIME</div>
                        <div style={{fontSize:10,color:"#FBBF24",marginTop:2}}>+{Math.min(5,Math.floor(overtimeSecs/300))} RR</div>
                      </div>
                    ):(
                      <div style={{background:toRgba(C,.1),borderRadius:8,padding:"6px 10px",border:`1px solid ${toRgba(C,.3)}`}}>
                        <div className="orb" style={{fontSize:16,fontWeight:700,color:C}}>{fmtMS(secsLeft)}</div>
                        <div style={{fontSize:9,color:toRgba(C,.5),letterSpacing:2}}>REMAINING</div>
                      </div>
                    )}
                    <button onClick={()=>stopTaskTimer(t.id)} style={{marginTop:5,padding:"4px 10px",background:"#1A1A28",border:"1px solid #2A2A40",borderRadius:6,color:"#888",fontSize:11,letterSpacing:1}}>STOP</button>
                  </div>
                ):(
                  !done&&(
                    <button onClick={()=>startTaskTimer(t.id)} className="bg" style={{padding:"8px 12px",background:toRgba(C,.1),border:`1px solid ${toRgba(C,.3)}`,borderRadius:8,color:C,fontFamily:"'Orbitron',monospace",fontSize:11,letterSpacing:1,flexShrink:0,whiteSpace:"nowrap"}}>
                      ▶ START
                    </button>
                  )
                )}
              </div>

              {/* Timer progress bar */}
              {isRunning&&!isOvertime&&(
                <div style={{height:3,background:"#0A0A16",borderRadius:2,margin:"0 0 0 0",overflow:"hidden"}}>
                  <div style={{height:"100%",background:C,borderRadius:2,transition:"width 1s linear",width:`${100-(secsLeft/((t.mins||30)*60)*100)}%`}}/>
                </div>
              )}

              {/* AI tip accordion */}
              <div style={{marginTop:4}}>
                {!tip&&!loading&&(
                  <button onClick={()=>getTip(t.id)} style={{padding:"5px 12px",background:"none",border:`1px solid ${toRgba(C,.2)}`,borderRadius:8,color:toRgba(C,.6),fontSize:11,letterSpacing:1,width:"100%",textAlign:"left"}}>
                    🤖 Get AI tips for this task ›
                  </button>
                )}
                {loading&&<div style={{fontSize:11,color:"#2A2A44",letterSpacing:2,padding:"6px 0"}}>AI analyzing your task...</div>}
                {tip&&(
                  <div className="tip-box" style={{background:"#080814",border:`1px solid ${toRgba(C,.15)}`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C,marginBottom:6,textTransform:"uppercase"}}>🤖 AI Coach Tips</div>
                    <div style={{fontSize:13,color:"#8090A8",lineHeight:1.75}}>{tip}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Side quests */}
        <div style={{...sl,marginTop:22,color:"#FBBF2255"}}>⚡ SIDE QUESTS — BONUS RR ({sideQuests.filter(q=>doneSQ[q.id]).length}/{sideQuests.length})</div>
        {sideQuests.map(q=>{
          const done    = !!doneSQ[q.id];
          const reason  = sqReasons[q.id];
          const loading = tipsLoading[q.id];
          return(
            <div key={q.id} style={{marginBottom:10}}>
              <div className="hl" onClick={()=>{setDoneSQ(p=>{const n={...p,[q.id]:!p[q.id]};LS.patch({doneSQ:n});return n;});}} style={{background:done?toRgba("#FBBF24",.07):"#0C0C1A",border:`1px solid ${done?"#FBBF2444":"#181828"}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
                <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${done?"#FBBF24":"#2A2A40"}`,background:done?"#FBBF24":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#000",flexShrink:0,transition:"all .15s",boxShadow:done?"0 0 8px #FBBF2466":"none"}}>{done?"✓":""}</div>
                <span style={{fontSize:18}}>{q.emoji}</span>
                <span style={{flex:1,fontSize:15,color:done?"#FBBF24":"#C0C8E0",textDecoration:done?"line-through":"none"}}>{q.text}</span>
                <span className="orb" style={{fontSize:12,color:"#FBBF24",flexShrink:0}}>+{q.rr}</span>
              </div>
              {/* AI reason */}
              <div style={{marginTop:4}}>
                {!reason&&!loading&&(
                  <button onClick={()=>getSQReason(q.id)} style={{padding:"5px 12px",background:"none",border:"1px solid #FBBF2428",borderRadius:8,color:"#FBBF2488",fontSize:11,letterSpacing:1,width:"100%",textAlign:"left"}}>
                    🤖 Why is this good for me? ›
                  </button>
                )}
                {loading&&<div style={{fontSize:11,color:"#2A2A44",letterSpacing:2,padding:"6px 0"}}>AI thinking...</div>}
                {reason&&(
                  <div className="tip-box" style={{background:"#0A0900",border:"1px solid #FBBF2422",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:9,letterSpacing:3,color:"#FBBF24",marginBottom:6,textTransform:"uppercase"}}>🤖 Why This Quest Suits You</div>
                    <div style={{fontSize:13,color:"#8A7A50",lineHeight:1.75}}>{reason}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add task */}
        <div style={{...cb,marginTop:22,marginBottom:14}}>
          <div style={sl}>Add / Remove Tasks</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="New task name..."/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
              <div style={{position:"relative"}}>
                <input type="number" min="1" max="480" value={newMins} onChange={e=>setNewMins(e.target.value)} placeholder="30"/>
                <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#444",pointerEvents:"none"}}>min</span>
              </div>
            </div>
            <button className="bg" onClick={addTask} style={{padding:"12px",background:toRgba(C,.1),border:`1px solid ${toRgba(C,.28)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2}}>+ ADD</button>
          </div>
          {tasks.map(t=>{
            const cat=CATS.find(c=>c.id===t.cat);
            return(
              <div key={t.id} style={{padding:"9px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10,background:"#090914",borderRadius:8,border:"1px solid #141422"}}>
                <span>{cat?.emoji}</span>
                <span style={{flex:1,fontSize:14,color:"#666"}}>{t.text}</span>
                <span style={{fontSize:11,color:"#444"}}>{t.mins}m</span>
                <span style={{fontSize:11,color:cat?.color}}>{cat?.name}</span>
                <button onClick={()=>removeTask(t.id)} style={{background:"none",border:"none",color:"#222",fontSize:18,lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     RANKS SCREEN
  ──────────────────────────────────────────────────────────────*/
  const Ranks = (
    <div>
      <div style={{padding:"18px 18px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>RANK LADDER</div>
        <div style={{fontSize:11,color:C,letterSpacing:2}}>{rank.full}</div>
      </div>
      <div style={{padding:"0 18px"}}>
        <div style={{fontSize:13,color:"#2A2A44",lineHeight:1.9,marginBottom:16}}>Difficulty increases every tier. Ascendant+ amplifies losses and gates gains behind a 14-day streak.</div>
        {[...ALL_RANKS].reverse().map((r,i)=>{
          const rIdx2=RANK_COUNT-1-i,cur=rIdx2===rankIdx,past=rIdx2<rankIdx;
          const tIdx2=TIERS.findIndex(t=>t.name===r.tier.name),t2=r.tier;
          return(
            <div key={r.full} style={{background:cur?toRgba(t2.color,.1):"#0C0C1A",border:`1px solid ${cur?toRgba(t2.color,.4):past?"#101020":"#181828"}`,borderRadius:10,padding:"12px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:12,opacity:past?.42:1}}>
              <div style={{width:38,height:38,borderRadius:"50%",border:`2px solid ${cur?t2.color:toRgba(t2.color,past?.22:.18)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:cur?`0 0 14px ${toRgba(t2.color,.5)}`:undefined,flexShrink:0}}>{t2.emoji}</div>
              <div style={{flex:1}}>
                <div className="orb" style={{fontSize:13,fontWeight:700,color:cur?t2.color:past?toRgba(t2.color,.32):"#2A2A44",letterSpacing:1}}>{r.full}</div>
                <div style={{fontSize:11,color:"#1E1E30",marginTop:2}}>×{DIFF[tIdx2].toFixed(2)} difficulty{tIdx2>=6?" · Hard mode":""}</div>
              </div>
              {cur&&<div className="orb" style={{fontSize:9,letterSpacing:2,color:t2.color,background:toRgba(t2.color,.12),padding:"4px 10px",borderRadius:20}}>YOU</div>}
              {past&&<span style={{color:"#22C55E",fontSize:18}}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     HISTORY SCREEN
  ──────────────────────────────────────────────────────────────*/
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
              <div style={{fontSize:11,color:"#1E1E30",marginTop:2}}>{h.done}/{h.total} tasks · {h.pct}%{h.otBonus>0?` · +${h.otBonus} overtime`:""}</div>
            </div>
            <div className="orb" style={{fontSize:28,fontWeight:900,color:h.rr>0?"#22C55E":"#F87171"}}>{h.rr>0?"+":""}{h.rr}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     COACH SCREEN
  ──────────────────────────────────────────────────────────────*/
  const Coach = (
    <div>
      <div style={{padding:"18px 18px 14px"}}>
        <div className="orb" style={{fontSize:20,fontWeight:900,color:C,letterSpacing:4}}>AI COACH</div>
        <div style={{fontSize:12,color:"#2A2A44",letterSpacing:2,marginTop:4}}>PERSONALIZED TO YOUR TASKS & HISTORY</div>
      </div>
      <div style={{padding:"0 18px"}}>
        {[
          {q:`Analyze my tasks (${tasks.map(t=>t.text).join(", ")}) and tell me specifically how to improve performance in each one.`, l:"📊 Task-Specific Advice"},
          {q:"What patterns in my history are costing me the most RR? Be specific.",       l:"🔍 History Analysis"},
          {q:"I want to maximize overtime RR. Which tasks should I extend and how?",       l:"⚡ Overtime Strategy"},
          {q:"Based on my task list, what am I neglecting in life? What should I add?",    l:"🧠 Life Balance Audit"},
          {q:"Give me a 7-day challenge tailored to my exact task list.",                  l:"🗓 7-Day Challenge"},
          {q:"I'm losing RR. Brutal honest plan to bounce back this week.",                l:"📈 Recovery Plan"},
          {q:"Am I on pace for Radiant? Realistic timeline based on my performance.",      l:"🎯 Radiant Projection"},
        ].map(({q,l})=>(
          <button key={l} className="hl" onClick={()=>runCoach(q)} style={{width:"100%",marginBottom:8,padding:"13px 16px",background:"#0C0C1A",border:"1px solid #181828",borderRadius:10,color:"#C0C8E0",fontSize:15,textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
            <span style={{flex:1}}>{l}</span>
            <span style={{color:C,fontSize:18}}>›</span>
          </button>
        ))}
        <div style={{...cb,marginBottom:14,marginTop:8}}>
          <div style={sl}>Ask Anything</div>
          <div style={{display:"flex",gap:8}}>
            <input value={coachQ} onChange={e=>setCoachQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&coachQ.trim()&&runCoach(coachQ)} placeholder="Custom question..."/>
            <button className="bg" onClick={()=>coachQ.trim()&&runCoach(coachQ)} style={{padding:"11px 16px",background:toRgba(C,.12),border:`1px solid ${toRgba(C,.3)}`,borderRadius:10,color:C,fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:1,whiteSpace:"nowrap",flexShrink:0}}>ASK ›</button>
          </div>
        </div>
        {aiLoading&&<div style={{textAlign:"center",color:"#2A2A44",fontSize:12,letterSpacing:3}}>PROCESSING...</div>}
        {aiMsg&&(
          <div style={{...cb,background:"#080810",border:`1px solid ${toRgba(C,.15)}`,marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:4,color:C,marginBottom:10,textTransform:"uppercase"}}>🤖 Coach Response</div>
            <div style={{fontSize:15,color:"#909AAA",lineHeight:1.85}}>{aiMsg}</div>
          </div>
        )}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────
     POPUPS
  ──────────────────────────────────────────────────────────────*/
  const PromotePopup = popup?.type==="promote"&&(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPopup(null)}>
      {Array.from({length:22}).map((_,i)=>(
        <div key={i} style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:[C,"#22C55E","#FBBF24","#F87171","#A78BFA"][i%5],left:`${4+i*4.2}%`,top:`${18+Math.random()*18}%`,animation:`confettiFall ${.7+Math.random()*.9}s ${Math.random()*.5}s forwards`}}/>
      ))}
      <div style={{textAlign:"center",animation:"scaleIn .5s cubic-bezier(.34,1.56,.64,1)",padding:"42px 32px",background:"rgba(5,5,13,.95)",border:`1px solid ${toRgba(popup.rank.tier.color,.42)}`,borderRadius:24,maxWidth:340,width:"90%",boxShadow:`0 0 60px ${toRgba(popup.rank.tier.color,.32)}`}}>
        <div style={{fontSize:76,marginBottom:10,animation:"rankBounce .9s ease"}}>{popup.rank.tier.emoji}</div>
        <div className="orb" style={{fontSize:11,letterSpacing:6,color:toRgba(popup.rank.tier.color,.6),marginBottom:10}}>CONGRATULATIONS</div>
        <div className="orb" style={{fontSize:14,color:"#555",letterSpacing:4,marginBottom:8}}>YOU ARE PROMOTED TO</div>
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

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────*/
  const SCREENS = {home:Home,tasks:Tasks,ranks:Ranks,history:History,coach:Coach};
  const NAV = [{k:"home",l:"HOME",i:"⌂"},{k:"tasks",l:"TASKS",i:"☑"},{k:"ranks",l:"RANKS",i:"◆"},{k:"history",l:"LOG",i:"◉"},{k:"coach",l:"COACH",i:"★"}];

  return (
    <div className="app">
      <style>{CSS}</style>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:`radial-gradient(ellipse 70% 40% at 0% 0%,${toRgba(C,.07)} 0%,transparent 65%),radial-gradient(ellipse 50% 30% at 100% 100%,${toRgba(tier.glow,.05)} 0%,transparent 60%)`}}/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(${toRgba(C,.03)} 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div className="scr">
          {phase==="setup" ? Setup : SCREENS[screen]}
        </div>
      </div>
      {phase==="rank"&&(
        <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(5,5,13,.97)",borderTop:`1px solid ${toRgba(C,.14)}`,backdropFilter:"blur(16px)",display:"flex",zIndex:100,padding:"4px 0 6px"}}>
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
