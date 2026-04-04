// ═══════════════════════════════════════════════════════════════════════════
// Fleet Orchestrator — Captain's Bridge
// Manages fleet lifecycle: health, registration, deployment, upgrades.
// Auto-polls all vessels, tracks history, coordinates inter-vessel ops.
//
// Superinstance & Lucineer (DiGennaro et al.) — 2026-04-03
// ═══════════════════════════════════════════════════════════════════════════

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*;";
const SUBDOMAIN = 'casey-digennaro.workers.dev';

interface Env { FLEET_KV: KVNamespace; }

type Tier = 1 | 2 | 3;

interface VesselDef {
  id: string; name: string; tier: Tier; url: string; repo: string;
  role: string; captain: string; description: string;
}

interface HealthResult {
  vesselId: string; url: string; status: 'healthy' | 'degraded' | 'down' | 'timeout';
  statusCode: number; latencyMs: number; timestamp: number; error?: string;
}

interface FleetSnapshot {
  total: number; healthy: number; degraded: number; down: number; timeout: number;
  avgLatencyMs: number; timestamp: number; results: HealthResult[];
}

// Default fleet registry
const DEFAULT_FLEET: VesselDef[] = [
  { id:'studylog-ai',name:'StudyLog.ai',tier:1,url:`https://studylog-ai.${SUBDOMAIN}`,repo:'Lucineer/studylog-ai',role:'Hippocampus — learning',captain:'crane',description:'AI classroom, strategic priority' },
  { id:'makerlog-ai',name:'MakerLog.ai',tier:1,url:`https://makerlog-ai.${SUBDOMAIN}`,repo:'Lucineer/makerlog-ai',role:'Motor cortex — coding',captain:'pickup',description:'Smarter Claude Code' },
  { id:'dmlog-ai',name:'DMLog.ai',tier:1,url:`https://dmlog-ai.${SUBDOMAIN}`,repo:'Lucineer/dmlog-ai',role:'Prefrontal — creativity',captain:'excavator',description:'AI Dungeon Master, 29K lines' },
  { id:'actualizer-ai',name:'Actualizer.ai',tier:1,url:`https://actualizer-ai.${SUBDOMAIN}`,repo:'Lucineer/actualizer-ai',role:'CNS — strategy',captain:'motorcycle',description:'Reverse-actualization, 7 horizons' },
  { id:'deckboss-ai',name:'DeckBoss.ai',tier:1,url:`https://deckboss-ai.${SUBDOMAIN}`,repo:'Lucineer/deckboss-ai',role:'Cerebellum — coordination',captain:'pickup',description:'Spreadsheet where cells are agents' },
  { id:'fishinglog-ai',name:'FishingLog.ai',tier:1,url:`https://fishinglog-ai.${SUBDOMAIN}`,repo:'Lucineer/fishinglog-ai',role:'Vestibular — patterns',captain:'pickup',description:'Fishing companion' },
  { id:'luciddreamer-ai',name:'LucidDreamer.ai',tier:1,url:`https://luciddreamer-ai.${SUBDOMAIN}`,repo:'Lucineer/luciddreamer-ai',role:'REM — consolidation',captain:'motorcycle',description:'Preprocessing intelligence' },
  { id:'businesslog-ai',name:'BusinessLog.ai',tier:1,url:`https://businesslog-ai.${SUBDOMAIN}`,repo:'Lucineer/businesslog-ai',role:'Frontal — business',captain:'semi',description:'Business CRM' },
  { id:'personallog-ai',name:'PersonalLog.ai',tier:1,url:`https://personallog-ai.${SUBDOMAIN}`,repo:'Lucineer/personallog-ai',role:'Insular — self',captain:'pickup',description:'Personal journal' },
  { id:'cocapn-com',name:'Cocapn.com',tier:2,url:`https://cocapn-com.${SUBDOMAIN}`,repo:'Lucineer/cocapn-com',role:'Catalog — equipment',captain:'pickup',description:'"Guns, lots of guns"' },
  { id:'kungfu-ai',name:'KungFu.ai',tier:2,url:`https://kungfu-ai.${SUBDOMAIN}`,repo:'Lucineer/kungfu-ai',role:'Dojo — skills',captain:'pickup',description:'"I know kung fu"' },
  { id:'bid-engine',name:'Bid Engine',tier:2,url:`https://bid-engine.${SUBDOMAIN}`,repo:'Lucineer/bid-engine',role:'Economy — bidding',captain:'pickup',description:'Portfolio tracking' },
  { id:'cocapn-logos',name:'Cocapn Logos',tier:2,url:`https://cocapn-logos.${SUBDOMAIN}`,repo:'Lucineer/cocapn-logos',role:'Branding — logos',captain:'motorcycle',description:'Logo gallery' },
  { id:'reallog-ai',name:'RealLog.ai',tier:2,url:`https://reallog-ai.${SUBDOMAIN}`,repo:'Lucineer/reallog-ai',role:'Journalism',captain:'semi',description:'Content creation' },
  { id:'playerlog-ai',name:'PlayerLog.ai',tier:2,url:`https://playerlog-ai.${SUBDOMAIN}`,repo:'Lucineer/playerlog-ai',role:'Gaming',captain:'pickup',description:'Coaching & play' },
  { id:'activelog-ai',name:'ActiveLog.ai',tier:2,url:`https://activelog-ai.${SUBDOMAIN}`,repo:'Lucineer/activelog-ai',role:'Athletics',captain:'pickup',description:'Fitness tracking' },
  { id:'activeledger-ai',name:'ActiveLedger.ai',tier:2,url:`https://activeledger-ai.${SUBDOMAIN}`,repo:'Lucineer/activeledger-ai',role:'Finance',captain:'semi',description:'Trading agent' },
  { id:'musiclog-ai',name:'MusicLog.ai',tier:2,url:`https://musiclog-ai.${SUBDOMAIN}`,repo:'Lucineer/musiclog-ai',role:'Music',captain:'pickup',description:'Music companion' },
  { id:'artistlog-ai',name:'ArtistLog.ai',tier:3,url:`https://artistlog-ai.${SUBDOMAIN}`,repo:'Lucineer/artistlog-ai',role:'Art',captain:'pickup',description:'Art portfolio' },
  { id:'parentlog-ai',name:'ParentLog.ai',tier:3,url:`https://parentlog-ai.${SUBDOMAIN}`,repo:'Lucineer/parentlog-ai',role:'Family',captain:'pickup',description:'Parenting companion' },
  { id:'doclog-ai',name:'DocLog.ai',tier:3,url:`https://doclog-ai.${SUBDOMAIN}`,repo:'Lucineer/doclog-ai',role:'Documentation',captain:'pickup',description:'Living docs' },
  { id:'cooklog-ai',name:'CookLog.ai',tier:3,url:`https://cooklog-ai.${SUBDOMAIN}`,repo:'Lucineer/cooklog-ai',role:'Cooking',captain:'motorcycle',description:'Recipe companion' },
  { id:'healthlog-ai',name:'HealthLog.ai',tier:3,url:`https://healthlog-ai.${SUBDOMAIN}`,repo:'Lucineer/healthlog-ai',role:'Health',captain:'pickup',description:'Wellness tracker' },
  { id:'travlog-ai',name:'TravLog.ai',tier:3,url:`https://travlog-ai.${SUBDOMAIN}`,repo:'Lucineer/travlog-ai',role:'Travel',captain:'motorcycle',description:'Trip planner' },
  { id:'petlog-ai',name:'PetLog.ai',tier:3,url:`https://petlog-ai.${SUBDOMAIN}`,repo:'Lucineer/petlog-ai',role:'Pets',captain:'motorcycle',description:'Pet care' },
  { id:'gardenlog-ai',name:'GardenLog.ai',tier:3,url:`https://gardenlog-ai.${SUBDOMAIN}`,repo:'Lucineer/gardenlog-ai',role:'Garden',captain:'motorcycle',description:'Plant tracker' },
  { id:'sciencelog-ai',name:'ScienceLog.ai',tier:3,url:`https://sciencelog-ai.${SUBDOMAIN}`,repo:'Lucineer/sciencelog-ai',role:'Science',captain:'pickup',description:'Experiment tracker' },
  { id:'nightlog-ai',name:'NightLog.ai',tier:3,url:`https://nightlog-ai.${SUBDOMAIN}`,repo:'Lucineer/nightlog-ai',role:'Night mode',captain:'motorcycle',description:'Autonomous tasks' },
  { id:'personlog-ai',name:'PersonLog.ai',tier:3,url:`https://personlog-ai.${SUBDOMAIN}`,repo:'Lucineer/personlog-ai',role:'Social',captain:'pickup',description:'Contact management' },
  { id:'spreadsheet-moment',name:'Spreadsheet Moment',tier:3,url:`https://spreadsheet-moment.${SUBDOMAIN}`,repo:'Lucineer/spreadsheet-moment',role:'Demo',captain:'motorcycle',description:'Spreadsheet agent demo' },
];

// ── Health Check Engine ──

async function checkFleet(vessels: VesselDef[]): Promise<HealthResult[]> {
  const results = await Promise.allSettled(
    vessels.map(async (v) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${v.url}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        const latency = Date.now() - start;
        const status = resp.status === 200 ? 'healthy' : resp.status >= 500 ? 'down' : 'degraded';
        return { vesselId: v.id, url: v.url, status: status as HealthResult['status'], statusCode: resp.status, latencyMs: latency, timestamp: Date.now() };
      } catch (e: any) {
        return { vesselId: v.id, url: v.url, status: 'timeout', statusCode: 0, latencyMs: Date.now() - start, timestamp: Date.now(), error: e.message?.slice(0, 50) };
      }
    })
  );
  return results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<HealthResult>).value);
}

function buildSnapshot(results: HealthResult[]): FleetSnapshot {
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;
  const timeout = results.filter(r => r.status === 'timeout').length;
  const avgLat = results.length > 0 ? Math.round(results.reduce((a, r) => a + r.latencyMs, 0) / results.length) : 0;
  return { total: results.length, healthy, degraded, down, timeout, avgLatencyMs: avgLat, timestamp: Date.now(), results };
}

// ── Landing Page ──

function landingPage(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fleet Orchestrator — Captain's Bridge</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;background:#0a0a1a;color:#e2e8f0}
.header{text-align:center;padding:2rem;background:radial-gradient(ellipse at 50% 0%,#0a1a2e 0%,#0a0a1a 70%)}
.header h1{font-size:1.8rem;background:linear-gradient(135deg,#3b82f6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header p{color:#64748b;margin:.5rem 0}
.stats{display:flex;justify-content:center;gap:2rem;padding:1rem;flex-wrap:wrap}
.stat{text-align:center}.stat .n{font-size:2.5rem;font-weight:800}.stat .l{font-size:.75rem;color:#64748b}
.n-ok{color:#10b981}.n-warn{color:#f59e0b}.n-err{color:#ef4444}.n-info{color:#3b82f6}
.dashboard{padding:1.5rem;max-width:1400px;margin:0 auto}
.filters{display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;justify-content:center}
.filter{padding:.3rem .8rem;background:#111;border:1px solid #334155;border-radius:20px;color:#94a3b8;cursor:pointer;font-size:.8rem}
.filter.active{border-color:#3b82f6;color:#60a5fa}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.6rem}
.v{background:#111;border:1px solid #1e293b;border-radius:8px;padding:.6rem .75rem;display:flex;gap:.6rem;align-items:flex-start;transition:border-color .2s}
.v:hover{border-color:#3b82f6}
.v .dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}
.dot-ok{background:#10b981;box-shadow:0 0 6px #10b98166}
.dot-warn{background:#f59e0b;box-shadow:0 0 6px #f59e0b66}
.dot-err{background:#ef4444;box-shadow:0 0 6px #ef444466}
.dot-off{background:#475569}
.v h4{font-size:.8rem;color:#e2e8f0;margin-bottom:.1rem}
.v .role{font-size:.7rem;color:#94a3b8}
.v .meta{display:flex;gap:.5rem;margin-top:.2rem;font-size:.65rem;color:#475569}
.tag{padding:.05rem .3rem;border-radius:8px;font-size:.6rem;font-weight:600}
.t1{background:#7c3aed33;color:#a78bfa}.t2{background:#3b82f633;color:#60a5fa}.t3{background:#05966933;color:#34d399}
#last-update{text-align:center;color:#475569;font-size:.75rem;margin-top:1rem}
.auto{position:fixed;top:1rem;right:1rem;display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:#64748b}
</style></head><body>
<div class="header"><h1>⚓ Fleet Orchestrator</h1><p>Captain's Bridge — real-time fleet health & coordination</p></div>
<div class="stats">
<div class="stat"><div class="n n-info" id="total">-</div><div class="l">Vessels</div></div>
<div class="stat"><div class="n n-ok" id="healthy">-</div><div class="l">Healthy</div></div>
<div class="stat"><div class="n n-warn" id="degraded">-</div><div class="l">Degraded</div></div>
<div class="stat"><div class="n n-err" id="down">-</div><div class="l">Down</div></div>
<div class="stat"><div class="n n-info" id="latency">-</div><div class="l">Avg Latency</div></div>
</div>
<div class="dashboard">
<div class="filters" id="filters">
<div class="filter active" data-f="all">All</div>
<div class="filter" data-f="1">Capital Ships</div>
<div class="filter" data-f="2">Support Vessels</div>
<div class="filter" data-f="3">Drones</div>
<div class="filter" data-f="ok">✅ Healthy</div>
<div class="filter" data-f="err">❌ Issues</div>
</div>
<div class="vgrid" id="grid"></div>
<div id="last-update"></div>
</div>
<script>
const TIER={1:'Capital Ships',2:'Support Vessels',3:'Autonomous Drones'};
let currentFilter='all';
let allResults=[];

document.getElementById('filters').addEventListener('click',e=>{
  if(e.target.classList.contains('filter')){
    document.querySelectorAll('.filter').forEach(f=>f.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter=e.target.dataset.f;
    render();
  }
});

async function check(){
  // Check from browser (client-side, reliable)
  const promises = FLEET.map(async (v) => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(v.url + '/health', { signal: controller.signal });
      clearTimeout(timeout);
      return { vesselId: v.id, url: v.url, status: resp.status === 200 ? 'healthy' : resp.status >= 500 ? 'down' : 'degraded', statusCode: resp.status, latencyMs: Date.now() - start, timestamp: Date.now() };
    } catch (e) {
      return { vesselId: v.id, url: v.url, status: 'timeout', statusCode: 0, latencyMs: Date.now() - start, timestamp: Date.now() };
    }
  });
  allResults = await Promise.allSettled(promises).then(r => r.filter(x => x.status === 'fulfilled').map(x => x.value));
  
  // Report to server for caching
  fetch('/api/fleet/report', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(allResults) }).catch(()=>{});
  
  const healthy = allResults.filter(r => r.status === 'healthy').length;
  const down = allResults.filter(r => r.status !== 'healthy').length;
  const avgLat = allResults.length > 0 ? Math.round(allResults.reduce((a,r) => a + r.latencyMs, 0) / allResults.length) : 0;
  
  document.getElementById('total').textContent = allResults.length;
  document.getElementById('healthy').textContent = healthy;
  document.getElementById('degraded').textContent = 0;
  document.getElementById('down').textContent = down;
  document.getElementById('latency').textContent = avgLat + 'ms';
  document.getElementById('last-update').textContent = 'Last check: ' + new Date().toLocaleTimeString();
  render();
}

function render(){
  let filtered=allResults;
  if(currentFilter==='ok')filtered=allResults.filter(r=>r.status==='healthy');
  else if(currentFilter==='err')filtered=allResults.filter(r=>r.status!=='healthy');
  else if(currentFilter!=='all')filtered=allResults.filter(r=>{const v=FLEET.find(f=>f.id===r.vesselId);return v&&v.tier==currentFilter;});

  document.getElementById('grid').innerHTML=filtered.map(r=>{
    const v=FLEET.find(f=>f.id===r.vesselId)||{name:r.vesselId,role:'',tier:3,captain:''};
    const dc=r.status==='healthy'?'dot-ok':r.status==='degraded'?'dot-warn':'dot-err';
    return '<div class="v"><div class="dot '+dc+'"></div><div><h4>'+v.name+'</h4><div class="role">'+v.role+'</div><div class="meta"><span class="tag t'+v.tier+'">T'+v.tier+'</span><span>'+r.latencyMs+'ms</span><span>'+v.captain+'</span>'+(r.error?'<span style="color:#ef4444">'+r.error+'</span>':'')+'</div></div></div>';
  }).join('');
}

const FLEET=${JSON.stringify(DEFAULT_FLEET)};
check();
setInterval(check,30000);
</script></body></html>`;
}

// ── Worker ──

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const h = { 'Content-Type': 'application/json', 'Content-Security-Policy': CSP };
    const hh = { 'Content-Type': 'text/html;charset=UTF-8', 'Content-Security-Policy': CSP };

    if (url.pathname === '/') return new Response(landingPage(), { headers: hh });
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', vessel: 'fleet-orchestrator', fleet: DEFAULT_FLEET.length }), { headers: h });
    }

    // Fleet check — server-side poll (best effort from worker)
    if (url.pathname === '/api/fleet/check') {
      const results = await checkFleet(DEFAULT_FLEET);
      const snapshot = buildSnapshot(results);
      await env.FLEET_KV.put('snapshot:latest', JSON.stringify(snapshot));
      await env.FLEET_KV.put(`snapshot:${snapshot.timestamp}`, JSON.stringify(snapshot), { expirationTtl: 86400 });
      return new Response(JSON.stringify(snapshot), { headers: h });
    }

    // Fleet check — client-reported results (from browser)
    if (url.pathname === '/api/fleet/report' && request.method === 'POST') {
      const body = await request.json() as HealthResult[];
      const snapshot = buildSnapshot(body);
      await env.FLEET_KV.put('snapshot:latest', JSON.stringify(snapshot));
      await env.FLEET_KV.put(`snapshot:${snapshot.timestamp}`, JSON.stringify(snapshot), { expirationTtl: 86400 });
      return new Response(JSON.stringify(snapshot), { headers: h });
    }

    // Fleet status — quick summary from cached snapshot
    if (url.pathname === '/api/fleet/status') {
      const cached = await env.FLEET_KV.get('snapshot:latest', 'json') as FleetSnapshot | null;
      if (cached) return new Response(JSON.stringify(cached), { headers: h });
      // No cache, do a quick check
      const results = await checkFleet(DEFAULT_FLEET);
      const snapshot = buildSnapshot(results);
      await env.FLEET_KV.put('snapshot:latest', JSON.stringify(snapshot));
      return new Response(JSON.stringify(snapshot), { headers: h });
    }

    // Fleet registry
    if (url.pathname === '/api/fleet/registry') {
      return new Response(JSON.stringify({ version: '1.0', vessels: DEFAULT_FLEET, count: DEFAULT_FLEET.length }), { headers: h });
    }

    // Register new vessel
    if (url.pathname === '/api/fleet/register' && request.method === 'POST') {
      const body = await request.json() as Omit<VesselDef, 'url'> & { healthUrl?: string };
      const vessel: VesselDef = { ...body, url: body.healthUrl || `https://${body.id}.${SUBDOMAIN}` };
      // Store in KV (append to custom vessels list)
      const custom = await env.FLEET_KV.get('vessels:custom', 'json') as VesselDef[] || [];
      const exists = custom.findIndex(v => v.id === vessel.id);
      if (exists >= 0) custom[exists] = vessel; else custom.push(vessel);
      await env.FLEET_KV.put('vessels:custom', JSON.stringify(custom));
      return new Response(JSON.stringify(vessel), { headers: h, status: 201 });
    }

    // Health history
    if (url.pathname === '/api/fleet/history') {
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const cutoff = Date.now() - (hours * 3600000);
      const list = await env.FLEET_KV.list({ prefix: 'snapshot:', limit: 100 });
      const snapshots: FleetSnapshot[] = [];
      for (const key of list.keys) {
        const ts = parseInt(key.name.split(':')[1]);
        if (ts >= cutoff) {
          const snap = await env.FLEET_KV.get<FleetSnapshot>(key.name, 'json');
          if (snap) snapshots.push(snap);
        }
      }
      snapshots.sort((a, b) => a.timestamp - b.timestamp);
      return new Response(JSON.stringify({ hours, snapshots }), { headers: h });
    }

    // A2A: machine-readable orchestration state
    if (url.pathname === '/api/a2a/orchestrate') {
      const cached = await env.FLEET_KV.get('snapshot:latest', 'json') as FleetSnapshot | null;
      return new Response(JSON.stringify({
        version: '1.0',
        fleet: DEFAULT_FLEET.map(v => ({ id: v.id, name: v.name, tier: v.tier, url: v.url, repo: v.repo, role: v.role, captain: v.captain })),
        health: cached ? { healthy: cached.healthy, down: cached.down + cached.timeout, avgLatencyMs: cached.avgLatencyMs, timestamp: cached.timestamp } : null,
        economy: {
          catalogUrl: `https://cocapn-com.${SUBDOMAIN}/api/a2a/catalog`,
          dojoUrl: `https://kungfu-ai.${SUBDOMAIN}/api/a2a/skills`,
          bidUrl: `https://bid-engine.${SUBDOMAIN}/api/portfolios`,
        },
      }), { headers: h });
    }

    return new Response('Not found', { status: 404 });
  },
};
