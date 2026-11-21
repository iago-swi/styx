"use strict";
const SHARED = "https://styx-vector-scores.iago-swi.workers.dev/";
const scoreKey = "styx-scores";
const initialsKey = "styx-initials";
const listKey = "styx-score-list";
function read(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
const initialsOf = name => (name.toUpperCase().match(/[\p{L}\p{N}]/gu) || []).slice(0,3).join("");
const runKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,"0")).join("");
function today() {
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function validDate(d) {
  if(typeof d!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
  const date=new Date(d+"T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0,10)===d;
}
function scoreRows(data,device) {
  if(!Array.isArray(data))return [];
  const rows=[];
  for(const r of data){
    if(!r || typeof r.n!=="string" || !Number.isFinite(r.s))continue;
    const s=Math.round(r.s),w=Number.isFinite(r.w)?Math.round(r.w):null;
    if(!Number.isSafeInteger(s) || s<=0)continue;
    const legacy=device && r.legacy===true && r.w===null && r.d===null;
    if(!legacy && (!Number.isFinite(r.w) || !Number.isSafeInteger(w) || w<1 || !validDate(r.d)))continue;
    const row={n:initialsOf(r.n),s,w:legacy?null:w,d:legacy?null:r.d};
    if(device){
      if(legacy)row.legacy=true;
      row.id=typeof r.id==="string" && /^[0-9a-f]{32}$/.test(r.id)?r.id:runKey();
    }else if(r.me===true)row.me=true;
    rows.push(row);
  }
  return rows.sort((a,b)=>b.s-a.s).slice(0,10);
}

class Scoreboard {
  constructor(playAgain,quit) {
    this.dialog=$("score-dialog");
    this.rows=[];this.current=null;this.remote=[];this.rank=null;
    this.requestId=0;this.pending=false;this.failed=false;this.gameOver=false;
    this.tab=SHARED && read(listKey,"device")==="everyone"?"everyone":"device";
    this.load();
    $("score-open").onclick=()=>this.open();
    $("score-done").onclick=()=>{
      const replay=this.gameOver;
      this.close();
      if(replay)playAgain();
    };
    $("score-quit").onclick=()=>{
      this.close();
      quit();
    };
    $("initials").addEventListener("input",()=>this.rename());
    this.dialog.addEventListener("keydown",e=>{
      if(e.target===$("initials")){
        e.stopPropagation();
        if(e.repeat || e.key==="Enter" || e.key==="Escape")e.preventDefault();
        if(!e.repeat && (e.key==="Enter" || e.key==="Escape"))$("score-done").focus();
      }else if(this.gameOver && e.target===$("score-done") && e.key==="Enter"){
        e.stopPropagation();e.preventDefault();if(!e.repeat)$("score-done").click();
      }else if(!this.gameOver && e.key==="Escape"){
        e.stopPropagation();e.preventDefault();this.close();
      }
    });
    this.dialog.addEventListener("cancel",e=>{e.preventDefault();if(!this.gameOver)this.close();});
    document.querySelectorAll("[data-list]").forEach(b=>b.onclick=()=>{
      this.tab=b.dataset.list;save(listKey,this.tab);this.render();
      if(this.tab==="everyone" && !this.current?.submit)this.fetchTop();
    });
    window.addEventListener("storage",e=>{
      if(e.key===scoreKey || e.key===null){this.load();this.updateBest();if(this.dialog.open)this.render();}
    });
  }
  load() {
    let raw;
    try{raw=localStorage.getItem(scoreKey);}catch{return;}
    if(raw===this.stored)return;
    this.stored=raw;
    try{this.rows=raw===null?[]:scoreRows(JSON.parse(raw),true);}catch{this.rows=[];}
    if(raw!==null && JSON.stringify(this.rows)!==raw)this.saveRows();
    const old=Math.round(Number(read("styx-best",0)));
    if(!this.rows.length && Number.isSafeInteger(old) && old>0){
      this.rows=[{id:runKey(),n:"",s:old,w:null,d:null,legacy:true}];
      this.saveRows();
    }
  }
  saveRows(){
    const value=JSON.stringify(this.rows);
    try{localStorage.setItem(scoreKey,value);this.stored=value;}catch{}
  }
  updateBest(){$("best").textContent=String(this.rows[0]?.s||0).padStart(6,"0");}
  invalidate(){
    this.requestId++;this.remote=this.remote.map(({n,s,w,d})=>({n,s,w,d}));
    this.rank=null;this.pending=false;this.failed=false;
  }
  open(){
    this.gameOver=false;this.current=null;this.invalidate();this.load();
    $("score-heading").textContent="High scores";$("score-summary").textContent="";
    $("score-done").textContent="Back";this.render();this.dialog.showModal();$("score-done").focus();
    if(this.tab==="everyone")this.fetchTop();
  }
  close(){
    this.dialog.close();this.gameOver=false;
  }
  finish(game){
    this.load();this.invalidate();this.gameOver=true;
    const remembered=read(initialsKey,null);
    const row={id:runKey(),n:initialsOf(remembered||""),s:game.score,w:game.level,d:today()};
    const eligible=game.score>0;
    const run={row,listed:false,submit:Boolean(SHARED && eligible),chain:Promise.resolve(),failedPost:false};
    this.current=run;
    if(eligible && (this.rows.length<10 || row.s>this.rows[9].s)){
      this.rows.push(row);this.rows.sort((a,b)=>b.s-a.s);this.rows=this.rows.slice(0,10);
      run.listed=true;this.saveRows();
    }
    const place=this.rows.indexOf(row)+1;
    const message=
      place===1?"That is your best yet.":place?"That is number "+place+" on this device.":"Your best is "+(this.rows[0]?.s||0)+".";
    $("score-heading").textContent="Game over";$("score-summary").textContent="Sector "+game.level+" · "+game.score.toLocaleString()+" points. "+message;
    $("score-done").textContent="Play again";$("initials").value=row.n;this.updateBest();
    this.render();this.dialog.showModal();
    ((run.listed||run.submit) && remembered===null?$("initials"):$("score-done")).focus();
    if(run.submit)this.post(run);
    else if(this.tab==="everyone")this.fetchTop();
  }
  rename(){
    const run=this.current;if(!run)return;
    const n=initialsOf($("initials").value);$("initials").value=n;save(initialsKey,n);run.row.n=n;
    if(run.listed){
      this.load();const own=this.rows.find(r=>r.id===run.row.id);
      if(own){own.n=n;this.saveRows();}
    }
    this.render();
    if(run.submit && !run.failedPost){
      clearTimeout(run.timer);run.timer=setTimeout(()=>this.post(run),700);
    }
  }
  render(){
    const local=this.tab==="device",run=this.current,rows=local?this.rows:this.remote;
    $("score-quit").hidden=!this.gameOver;
    $("score-tabs").hidden=!SHARED;
    document.querySelectorAll("[data-list]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.list===this.tab)));
    $("initials-label").hidden=!(this.gameOver && (run?.listed || run?.submit));
    const list=$("score-rows");list.replaceChildren();
    $("score-columns").hidden=!rows.length;
    rows.forEach((row,i)=>{
      const li=document.createElement("li");
      const own=this.gameOver && (local?run?.row.id===row.id:row.me);
      if(own)li.className="current";
      const values=[["rank",i+1],["name",(own?run.row.n:row.n)||"—"],["points",row.s],["level",row.w?"Sector "+row.w:"—"],["date",row.d?row.d.split("-").reverse().join("."):"—"]];
      for(const [cls,value] of values){const el=document.createElement("span");el.className=cls;el.textContent=value;li.append(el);}
      list.append(li);
    });
    let note="";
    if(this.failed && (!local || (this.gameOver && run?.failedPost)))note="The shared list cannot be reached right now."+(this.gameOver&&run?.listed?" Your score is kept on this device.":"");
    else if(!local && this.pending && !rows.length)note="Fetching the shared list…";
    else if(!local && this.gameOver && this.rank>rows.length)note="Your score is number "+this.rank+" on the shared list.";
    else if(!rows.length)note="No scores yet.";
    $("score-notice").textContent=note;
  }
  fetchTop(){return this.request(null);}
  post(run){
    // Keep a run's edits in order, including an edit made before its first reply.
    run.chain=run.chain.then(()=>run.failedPost?undefined:this.request(run));
  }
  async request(run){
    if(!SHARED)return;
    const visible=()=>!run || this.current===run;
    const id=visible()?++this.requestId:0;
    const latest=()=>visible() && this.requestId===id;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    if(latest()){this.failed=false;this.pending=true;this.render();}
    try{
      const options={signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"};
      if(run){
        const {id:k,n,s,w}=run.row;
        options.method="POST";options.body=JSON.stringify({k,n,s,w});
      }
      const res=await fetch(SHARED,options);
      if(!res.ok)throw Error();
      const data=await res.json();
      if(!Array.isArray(data?.top) || (run && (!Number.isSafeInteger(data.rank)||data.rank<1)))throw Error();
      if(latest()){
        this.remote=scoreRows(data.top,false);this.rank=run?data.rank:null;
      }
    }catch{
      if(run)run.failedPost=true;
      if(latest())this.failed=true;
    }finally{
      clearTimeout(timer);
      if(latest()){this.pending=false;this.render();}
    }
  }
}
