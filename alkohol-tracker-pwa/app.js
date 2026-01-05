// Lokale Speicherung
const STORAGE_KEY = 'alcohol_entries_v1';
const entries = loadEntries();
function loadEntries() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function saveEntries() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function gramsAlcohol(ml, abv) { return ml * (abv / 100) * 0.789; }
function toDateInputValue(dt = new Date()) { const pad = (n) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`; }

// Initiale Werte setzen
const dtEl = document.getElementById('dt'); const typeEl = document.getElementById('type'); const mlEl = document.getElementById('ml'); const abvEl = document.getElementById('abv');
dtEl.value = toDateInputValue(new Date());
document.getElementById('reset-form').addEventListener('click', () => { dtEl.value = toDateInputValue(new Date()); typeEl.value = ''; mlEl.value = ''; abvEl.value = ''; });

// Eintrag hinzufügen
const form = document.getElementById('entry-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const dt = new Date(dtEl.value); const rawType = (typeEl.value || 'Unbekannt').trim();
  const ml = Number(mlEl.value); const abv = Number(abvEl.value);
  if (!dt || isNaN(dt.getTime()) || ml <= 0 || abv <= 0) return;
  const grams = gramsAlcohol(ml, abv);
  entries.push({ id: crypto.randomUUID(), ts: dt.toISOString(), type: rawType, ml, abv, grams });
  saveEntries(); renderEntries(); updateStatsAndCharts(); form.reset(); dtEl.value = toDateInputValue(new Date());
});

// Tabelle rendern
const tbody = document.querySelector('#entries-table tbody');
function renderEntries(filtered = null) {
  const list = filtered || entries; tbody.innerHTML = '';
  list.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts)).forEach((e)=>{
    const tr = document.createElement('tr'); const dt = new Date(e.ts);
    tr.innerHTML = `<td>${dt.toLocaleString()}</td><td>${escapeHtml(e.type)}</td><td>${e.ml}</td><td>${e.abv}</td><td>${e.grams.toFixed(1)}</td><td><button class="ghost" data-id="${e.id}">Löschen</button></td>`; tbody.appendChild(tr);
  });
}

tbody.addEventListener('click', (ev) => { const btn = ev.target.closest('button'); if (!btn) return; const id = btn.getAttribute('data-id'); const idx = entries.findIndex(e=>e.id===id); if (idx>=0 && confirm('Diesen Eintrag wirklich löschen?')) { entries.splice(idx,1); saveEntries(); renderEntries(); updateStatsAndCharts(); } });
function escapeHtml(str){return str.replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}

// Filter
const fromEl = document.getElementById('from-date'); const toEl = document.getElementById('to-date');

// --- Filter-Zeitraum Chart & Kennzahlen ---
let chartFiltered; const filteredCtx = document.getElementById('chartFiltered');
const avgFilterEl = document.getElementById('avg-filter'); const sumFilterEl = document.getElementById('sum-filter');
let currentFilter = { from: null, to: null };
function setFilterRange(from, to){ currentFilter.from = from ? startOfDay(from) : null; currentFilter.to = to ? endOfDay(to) : null; }
function getFilteredEntries(){ const list=entries.slice(); if(!currentFilter.from && !currentFilter.to) return list; return list.filter(e=>{ const t=new Date(e.ts); if(currentFilter.from && t<currentFilter.from) return false; if(currentFilter.to && t>currentFilter.to) return false; return true; }); }
function daysInRange(from,to){ if(!from||!to) return 0; const ms=endOfDay(to)-startOfDay(from); return Math.floor(ms/86400000)+1; }
function buildFiltered(){ if(!filteredCtx) return; const list=getFilteredEntries(); let from=currentFilter.from, to=currentFilter.to; if(list.length>0){ const times=list.map(e=>new Date(e.ts).getTime()); const minT=new Date(Math.min(...times)); const maxT=new Date(Math.max(...times)); from=from||startOfDay(minT); to=to||endOfDay(maxT); }
  if(!from||!to){ if(chartFiltered) chartFiltered.destroy(); avgFilterEl&&(avgFilterEl.textContent='0 g'); sumFilterEl&&(sumFilterEl.textContent='0 g'); return; }
  const labels=[]; const data=[]; const days=daysInRange(from,to); let cur=new Date(startOfDay(from)); let total=0; for(let i=0;i<days;i++){ const dayStart=new Date(cur); const dayEnd=endOfDay(cur); const sum=list.reduce((acc,e)=>{ const t=new Date(e.ts); return (t>=dayStart && t<=dayEnd)? acc+e.grams: acc; },0); labels.push(`${dayStart.getDate()}.${dayStart.getMonth()+1}.`); data.push(sum); total+=sum; cur.setDate(cur.getDate()+1); }
  const avg=days>0? total/days: 0; avgFilterEl&&(avgFilterEl.textContent=`${avg.toFixed(1)} g`); sumFilterEl&&(sumFilterEl.textContent=`${total.toFixed(1)} g`);
  if(chartFiltered) chartFiltered.destroy(); chartFiltered=new Chart(filteredCtx,{ type:'bar', data:{ labels, datasets:[{ label:'g/Tag im Zeitraum', data, backgroundColor:'#f59e0b' }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } }); }

document.getElementById('apply-filter').addEventListener('click', () => { const from = fromEl.value ? new Date(fromEl.value) : null; const to = toEl.value ? new Date(toEl.value) : null; const filtered = entries.filter(e=>{ const t=new Date(e.ts); if(from && t<startOfDay(from)) return false; if(to && t>endOfDay(to)) return false; return true; }); setFilterRange(from, to); renderEntries(filtered); buildFiltered(); });

document.getElementById('clear-filter').addEventListener('click', () => { fromEl.value=''; toEl.value=''; setFilterRange(null,null); renderEntries(); buildFiltered(); });

// Export / Import
function download(filename, text, type='text/plain'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

document.getElementById('export-json').addEventListener('click', ()=>{ download('alkohol-entries.json', JSON.stringify(entries,null,2), 'application/json'); });

document.getElementById('export-csv').addEventListener('click', ()=>{ const header=['id','timestamp','typ','ml','abv','gramm']; const rows=entries.map(e=>[e.id,e.ts,e.type,e.ml,e.abv,e.grams.toFixed(2)]); const csv=[header,...rows].map(r=>r.map(v=>'"'+String(v).replace('"','""')+'"').join(',')).join('\n'); download('alkohol-entries.csv', csv, 'text/csv'); });

document.getElementById('import-json').addEventListener('change', async (ev)=>{ const file=ev.target.files?.[0]; if(!file) return; const text=await file.text(); try{ const data=JSON.parse(text); if(!Array.isArray(data)) throw new Error('JSON muss ein Array sein'); const mapped=data.map(x=>({ id:x.id||crypto.randomUUID(), ts:new Date(x.ts).toISOString(), type:(x.type||'Unbekannt').toString(), ml:Number(x.ml)||0, abv:Number(x.abv)||0, grams:Number(x.grams)||gramsAlcohol(Number(x.ml)||0, Number(x.abv)||0) })).filter(x=>x.ml>0 && x.abv>0); if(!confirm(`Importiere ${mapped.length} Einträge?`)) return; entries.length=0; entries.push(...mapped); saveEntries(); renderEntries(); updateStatsAndCharts(); buildFiltered(); } catch(err){ alert('Fehler beim Import: '+err.message); } finally { ev.target.value=''; } });

// Zeit-Helfer
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d){ const x=startOfDay(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }
function startOfMonth(d){ const x=startOfDay(d); x.setDate(1); return x; }

// Statistiken
const statTodayEl=document.getElementById('stat-today'); const statWeekEl=document.getElementById('stat-week'); const statMonthEl=document.getElementById('stat-month');
function sumBetween(from,to){ return entries.reduce((acc,e)=>{ const t=new Date(e.ts); return (t>=from && t<=to)? acc+e.grams: acc; },0); }
function updateStats(){ const now=new Date(); const sToday=sumBetween(startOfDay(now), endOfDay(now)); const sWeek=sumBetween(startOfWeek(now), endOfDay(now)); const sMonth=sumBetween(startOfMonth(now), endOfDay(now)); statTodayEl.textContent=`${sToday.toFixed(0)} g`; statWeekEl.textContent=`${sWeek.toFixed(0)} g`; statMonthEl.textContent=`${sMonth.toFixed(0)} g`; }

// Charts
let chartDaily, chartWeekly, chartTypes;
const dailyCtx=document.getElementById('chartDaily'); const weeklyCtx=document.getElementById('chartWeekly'); const typesCtx=document.getElementById('chartTypes');

function buildDaily(){ const days=[]; const labels=[]; for(let i=29;i>=0;i--){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); const eod=new Date(d); eod.setHours(23,59,59,999); const sum=sumBetween(d,eod); days.push(sum); labels.push(`${d.getDate()}.${d.getMonth()+1}.`); } if(chartDaily) chartDaily.destroy(); chartDaily=new Chart(dailyCtx,{ type:'bar', data:{ labels, datasets:[{ label:'g/Tag', data:days, backgroundColor:'#0ea5e9' }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } }); }

function buildWeekly(){ const labels=[]; const data=[]; const now=new Date(); let start=startOfWeek(now); for(let i=11;i>=0;i--){ const wStart=new Date(start); wStart.setDate(wStart.getDate()-7*i); const wEnd=new Date(wStart); wEnd.setDate(wEnd.getDate()+6); wEnd.setHours(23,59,59,999); const sum=sumBetween(wStart,wEnd); const weekNum=weekNumber(wStart); labels.push(`KW ${weekNum}`); data.push(sum); } if(chartWeekly) chartWeekly.destroy(); chartWeekly=new Chart(weeklyCtx,{ type:'line', data:{ labels, datasets:[{ label:'g/Woche', data, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.2)', fill:true, tension:0.3 }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } }); }

function buildTypes(){
  const sums = new Map();
  const labelMap = new Map(); // lowercase key -> first-seen label (original casing)
  for (const e of entries) {
    const raw = (e.type || 'Unbekannt').toString().trim();
    const key = raw.toLowerCase();
    if (!labelMap.has(key)) labelMap.set(key, raw);
    sums.set(key, (sums.get(key) || 0) + e.grams);
  }
  const keys = Array.from(sums.keys());
  const labels = keys.map(k => labelMap.get(k));
  const data = keys.map(k => sums.get(k));
  const colors = labels.map((_, i) => `hsl(${(i*67)%360} 70% 50%)`);
  if (chartTypes) chartTypes.destroy();
  chartTypes = new Chart(typesCtx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
}

function weekNumber(d){ const date=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dayNum=(date.getUTCDay()+6)%7; date.setUTCDate(date.getUTCDate()-dayNum+3); const firstThursday=new Date(Date.UTC(date.getUTCFullYear(),0,4)); const diff=(date-firstThursday)/86400000; return 1+Math.floor(diff/7); }
function updateCharts(){ buildDaily(); buildWeekly(); buildTypes(); buildFiltered(); }
function updateStatsAndCharts(){ updateStats(); updateCharts(); }

// Start
renderEntries(); updateStatsAndCharts(); setFilterRange(null,null); buildFiltered();

document.getElementById('delete-all').addEventListener('click',()=>{ if(confirm('Wirklich alle Einträge löschen?')){ entries.length=0; localStorage.removeItem(STORAGE_KEY); renderEntries(); updateStatsAndCharts(); buildFiltered(); }});
