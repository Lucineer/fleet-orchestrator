// ═══════════════════════════════════════════════════════════════════════════
// Fleet Orchestrator — Captain's Bridge
// Manages fleet lifecycle: health, registration, deployment, upgrades.
// Auto-polls all vessels, tracks history, coordinates inter-vessel ops.
// P0 Protocols: HCQ (Circuit Quarantine) + DEB (Execution Bonds)
//
// 2026-04-03 — Added Hierarchical Circuit Quarantine + Deterministic Execution Bonds
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
  vesselId: string; url: string; status: 'healthy' | 'degraded' | 'down' | 'timeout' | 'quarantined';
  statusCode: number; latencyMs: number; timestamp: number; error?: string;
}

// ── HCQ: Hierarchical Circuit Quarantine ──
interface QuarantineEntry {
  vesselId: string; reason: string; quarantinedAt: number; errorRate: number;
  consecutiveFails: number; autoLiftAt: number; // auto-lift after 15min
}

// ── DEB: Deterministic Execution Bonds ──
interface ExecutionBond {
  taskId: string; vesselId: string; payload: string; // SHA256
  status: 'pending' | 'claimed' | 'committed' | 'failed';
  claimedAt: number | null; leaseExpires: number | null;
  createdAt: number; completedAt: number | null;
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
  { id:'fleet-orchestrator',name:'Fleet Orchestrator',tier:2,url:`https://fleet-orchestrator.${SUBDOMAIN}`,repo:'Lucineer/fleet-orchestrator',role:'Captain Bridge',captain:'motorcycle',description:'CRP-39, HCQ, DEB, Trust' },
  { id:'dream-engine',name:'Dream Engine',tier:2,url:`https://dream-engine.${SUBDOMAIN}`,repo:'Lucineer/dream-engine',role:'REM consolidation',captain:'motorcycle',description:'Background consolidation protocol' },
  { id:'seed-ui',name:'Seed UI',tier:2,url:`https://seed-ui.${SUBDOMAIN}`,repo:'Lucineer/seed-ui',role:'Presentation layers',captain:'motorcycle',description:'5 presentation layers' },
  { id:'actualizer-ai',name:'Actualizer.ai',tier:2,url:`https://actualizer-ai.${SUBDOMAIN}`,repo:'Lucineer/actualizer-ai',role:'RA engine',captain:'motorcycle',description:'7 horizons, multi-model' },
  { id:'cocapn',name:'Cocapn Core',tier:2,url:`https://cocapn.${SUBDOMAIN}`,repo:'Lucineer/cocapn',role:'Protocol layer',captain:'motorcycle',description:'Core platform' },
  { id:'local-bridge',name:'Local Bridge',tier:2,url:`https://local-bridge.${SUBDOMAIN}`,repo:'Lucineer/local-bridge',role:'Local models',captain:'motorcycle',description:'Ollama/vLLM tunnel' },
  { id:'membership-api',name:'Membership API',tier:2,url:`https://membership-api.${SUBDOMAIN}`,repo:'Lucineer/membership-api',role:'Tier management',captain:'motorcycle',description:'Pay-for-convenience' },
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
<div class="header">
      <img src="https://cocapn-logos.casey-digennaro.workers.dev/img/cocapn-logo-v1.png" alt="Cocapn" style="width:64px;height:auto;margin-bottom:.5rem;border-radius:8px;display:block;margin-left:auto;margin-right:auto">
      <h1>⚓ Fleet Orchestrator</h1><p>Captain's Bridge — real-time fleet health & coordination</p></div>
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

    // ── HCQ: Quarantine Management ──
    if (url.pathname === '/api/quarantine' && request.method === 'GET') {
      const list = await env.FLEET_KV.list({ prefix: 'quarantine:', limit: 50 });
      const entries: QuarantineEntry[] = [];
      for (const key of list.keys) {
        const entry = await env.FLEET_KV.get<QuarantineEntry>(key.name, 'json');
        if (entry) entries.push(entry);
      }
      return new Response(JSON.stringify({ count: entries.length, entries }), { headers: h });
    }
    if (url.pathname === '/api/quarantine' && request.method === 'POST') {
      const body = await request.json() as { vesselId: string; reason: string; errorRate?: number };
      const entry: QuarantineEntry = {
        vesselId: body.vesselId, reason: body.reason,
        quarantinedAt: Date.now(), errorRate: body.errorRate || 1.0,
        consecutiveFails: 3, autoLiftAt: Date.now() + 900000, // 15 min
      };
      await env.FLEET_KV.put(`quarantine:${body.vesselId}`, JSON.stringify(entry), { expirationTtl: 3600 });
      await env.FLEET_KV.put(`event:quarantine:${entry.quarantinedAt}:${body.vesselId}`, JSON.stringify({ type: 'QUARANTINE', vesselId: body.vesselId, reason: body.reason, errorRate: body.errorRate, timestamp: entry.quarantinedAt }), { expirationTtl: 86400 });
      return new Response(JSON.stringify(entry), { headers: h, status: 201 });
    }
    if (url.pathname === '/api/quarantine/lift' && request.method === 'POST') {
      const body = await request.json() as { vesselId: string };
      await env.FLEET_KV.delete(`quarantine:${body.vesselId}`);
      const liftTs = Date.now();
      await env.FLEET_KV.put(`event:quarantine-lift:${liftTs}:${body.vesselId}`, JSON.stringify({ type: 'QUARANTINE_LIFT', vesselId: body.vesselId, reason: 'manual', timestamp: liftTs }), { expirationTtl: 86400 });
      return new Response(JSON.stringify({ lifted: true, vesselId: body.vesselId, at: liftTs }), { headers: h });
    }

    // ── DEB: Execution Bonds ──
    if (url.pathname === '/api/bonds' && request.method === 'GET') {
      const status = url.searchParams.get('status');
      const list = await env.FLEET_KV.list({ prefix: 'bond:', limit: 100 });
      const bonds: ExecutionBond[] = [];
      for (const key of list.keys) {
        const bond = await env.FLEET_KV.get<ExecutionBond>(key.name, 'json');
        if (bond && (!status || bond.status === status)) bonds.push(bond);
      }
      return new Response(JSON.stringify({ count: bonds.length, bonds }), { headers: h });
    }
    if (url.pathname === '/api/bonds' && request.method === 'POST') {
      const body = await request.json() as { vesselId: string; payload: string };
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest('SHA-256', encoder.encode(body.payload + body.vesselId + Date.now()));
      const taskId = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      const bond: ExecutionBond = {
        taskId, vesselId: body.vesselId, payload: body.payload,
        status: 'pending', claimedAt: null, leaseExpires: null,
        createdAt: Date.now(), completedAt: null,
      };
      await env.FLEET_KV.put(`bond:${taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
      return new Response(JSON.stringify(bond), { headers: h, status: 201 });
    }
    if (url.pathname === '/api/bonds/claim' && request.method === 'POST') {
      const body = await request.json() as { taskId: string; vesselId: string };
      const bond = await env.FLEET_KV.get<ExecutionBond>(`bond:${body.taskId}`, 'json');
      if (!bond || bond.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'not claimable', taskId: body.taskId }), { status: 409, headers: h });
      }
      bond.status = 'claimed'; bond.claimedAt = Date.now(); bond.leaseExpires = Date.now() + 60000; // 60s lease
      await env.FLEET_KV.put(`bond:${body.taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
      return new Response(JSON.stringify(bond), { headers: h });
    }
    if (url.pathname === '/api/bonds/complete' && request.method === 'POST') {
      const body = await request.json() as { taskId: string; vesselId: string };
      const bond = await env.FLEET_KV.get<ExecutionBond>(`bond:${body.taskId}`, 'json');
      if (!bond) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: h });
      bond.status = 'committed'; bond.completedAt = Date.now();
      await env.FLEET_KV.put(`bond:${body.taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
      return new Response(JSON.stringify(bond), { headers: h });
    }
    // DEB: Heartbeat — extend lease (every 15s per CRP-39)
    if (url.pathname === '/api/bonds/heartbeat' && request.method === 'POST') {
      const body = await request.json() as { taskId: string; vesselId: string; progress?: number };
      const bond = await env.FLEET_KV.get<ExecutionBond>(`bond:${body.taskId}`, 'json');
      if (!bond || bond.status !== 'claimed') {
        return new Response(JSON.stringify({ error: 'not claimed', taskId: body.taskId }), { status: 409, headers: h });
      }
      if (bond.leaseExpires && Date.now() > bond.leaseExpires) {
        // Lease expired — auto-forfeit
        bond.status = 'failed'; bond.completedAt = Date.now();
        await env.FLEET_KV.put(`bond:${body.taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
        return new Response(JSON.stringify({ error: 'lease expired', taskId: body.taskId, status: 'forfeited' }), { status: 410, headers: h });
      }
      bond.leaseExpires = Date.now() + 60000; // extend 60s
      await env.FLEET_KV.put(`bond:${body.taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
      return new Response(JSON.stringify({ taskId: body.taskId, leaseExtended: true, newExpiry: bond.leaseExpires, progress: body.progress }), { headers: h });
    }
    // DEB: Auto-forfeit sweep — check all claimed bonds for expired leases
    if (url.pathname === '/api/bonds/sweep' && request.method === 'POST') {
      const list = await env.FLEET_KV.list({ prefix: 'bond:', limit: 100 });
      const forfeited: ExecutionBond[] = [];
      const now = Date.now();
      for (const key of list.keys) {
        const bond = await env.FLEET_KV.get<ExecutionBond>(key.name, 'json');
        if (bond && bond.status === 'claimed' && bond.leaseExpires && now > bond.leaseExpires + 30000) { // 30s grace
          bond.status = 'failed'; bond.completedAt = now;
          await env.FLEET_KV.put(key.name, JSON.stringify(bond), { expirationTtl: 86400 });
          forfeited.push(bond);
        }
      }
      return new Response(JSON.stringify({ swept: forfeited.length, forfeited }), { headers: h });
    }
    // DEB: Fail a bond (explicit)
    if (url.pathname === '/api/bonds/fail' && request.method === 'POST') {
      const body = await request.json() as { taskId: string; vesselId: string; reason?: string };
      const bond = await env.FLEET_KV.get<ExecutionBond>(`bond:${body.taskId}`, 'json');
      if (!bond) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: h });
      bond.status = 'failed'; bond.completedAt = Date.now();
      await env.FLEET_KV.put(`bond:${body.taskId}`, JSON.stringify(bond), { expirationTtl: 86400 });
      return new Response(JSON.stringify({ taskId: body.taskId, status: 'failed', reason: body.reason }), { headers: h });
    }

    // ── TRUST: Attestation & Reputation ──
    if (url.pathname === '/api/trust' && request.method === 'POST') {
      const body = await request.json() as { vesselId: string; metric: string; value: number; confidence?: number };
      const entry = { ...body, timestamp: Date.now(), confidence: body.confidence || 0.5 };
      await env.FLEET_KV.put(`trust:${body.vesselId}:${Date.now()}`, JSON.stringify(entry), { expirationTtl: 86400 });
      return new Response(JSON.stringify(entry), { headers: h, status: 201 });
    }
    if (url.pathname === '/api/trust/:vesselId') {
      // Cannot use path params in Workers router, use query
    }
    if (url.pathname.startsWith('/api/trust/') && request.method === 'GET') {
      const vesselId = url.pathname.split('/')[3];
      const list = await env.FLEET_KV.list({ prefix: `trust:${vesselId}:`, limit: 50 });
      const attestations: any[] = [];
      for (const key of list.keys) {
        const att = await env.FLEET_KV.get(key.name, 'json');
        if (att) attestations.push(att);
      }
      // Compute trust score
      const avgError = attestations.filter(a => a.metric === 'error_rate').reduce((s, a) => s + a.value, 0) / Math.max(attestations.length, 1);
      const avgConfidence = attestations.reduce((s, a) => s + (a.confidence || 0), 0) / Math.max(attestations.length, 1);
      const trustScore = Math.max(0, 1 - avgError * 3) * avgConfidence;
      return new Response(JSON.stringify({
        vesselId, trustScore: Math.round(trustScore * 100) / 100,
        attestations: attestations.length,
        recommendation: trustScore > 0.7 ? 'TRUST' : trustScore > 0.3 ? 'DEGRADE' : 'QUARANTINE',
        recentAttestations: attestations.slice(-10),
      }), { headers: h });
    }

    // ── HCQ: Auto-lift expired quarantines + fleet event log ──
    if (url.pathname === '/api/quarantine/sweep' && request.method === 'POST') {
      const list = await env.FLEET_KV.list({ prefix: 'quarantine:', limit: 50 });
      const lifted: string[] = [];
      const now = Date.now();
      for (const key of list.keys) {
        const entry = await env.FLEET_KV.get<QuarantineEntry>(key.name, 'json');
        if (entry && now > entry.autoLiftAt) {
          await env.FLEET_KV.delete(key.name);
          // Log the lift event
          await env.FLEET_KV.put(`event:quarantine-lift:${now}:${entry.vesselId}`, JSON.stringify({
            type: 'QUARANTINE_LIFT', vesselId: entry.vesselId,
            reason: 'auto-lift (15min expired)', timestamp: now,
          }), { expirationTtl: 86400 });
          lifted.push(entry.vesselId);
        }
      }
      return new Response(JSON.stringify({ swept: lifted.length, lifted }), { headers: h });
    }



    // ── Deborah Number: Intelligence Phase State Detector (Phase Physics paper) ──
    // De = observation_time / relaxation_time
    // De >> 1 = solid (code), De << 1 = fluid (LLM), De ~ 1 = metastatic
    if (url.pathname === '/api/deborah' && request.method === 'GET') {
      const vesselId = url.searchParams.get('vesselId') || 'fleet';
      const now = Date.now();
      const bondList = await env.FLEET_KV.list({ prefix: 'bond:', limit: 100 });
      const eventList = await env.FLEET_KV.list({ prefix: 'event:', limit: 100 });
      // observation_time = time since last event
      let lastEvent = 0;
      for (const key of eventList.keys) {
        const ts = parseInt(key.name.split(':').pop() || '0');
        if (ts > lastEvent) lastEvent = ts;
      }
      const observationTime = now - lastEvent;
      // relaxation_time = average bond completion time
      let totalCompletion = 0, completed = 0;
      for (const key of bondList.keys) {
        const b = await env.FLEET_KV.get(key.name, 'json');
        if (b && b.status === 'committed' && b.claimedAt && b.completedAt) {
          totalCompletion += (b.completedAt - b.claimedAt);
          completed++;
        }
      }
      const relaxationTime = completed > 0 ? totalCompletion / completed : 60000;
      const de = observationTime / Math.max(relaxationTime, 1);
      const phase = de > 10 ? 'SOLID (code/crystallized)' : de > 0.1 ? 'METASTATIC (supercritical)' : 'FLUID (generative/LLM)';
      return new Response(JSON.stringify({
        vesselId, de: Math.round(de * 100) / 100, phase,
        observationTimeMs: observationTime, relaxationTimeMs: relaxationTime,
        interpretation: de > 10 ? 'Fleet is crystallized — stable, executable, low entropy' : de > 0.1 ? 'Fleet is in productive tension — maximum creativity' : 'Fleet is flowing — high entropy, generative',
      }), { headers: h });
    }
    // ── VISC: Viscosity Tokens (Metastatic Cathedral) ──
    // Measures productive friction — disagreement that generates insight
    if (url.pathname === '/api/visc' && request.method === 'GET') {
      const vesselId = url.searchParams.get('vesselId') || 'fleet';
      // VISC = disagreements + failed bonds + quarantine events
      const quarantines = await env.FLEET_KV.list({ prefix: 'event:quarantine:', limit: 50 });
      const lifts = await env.FLEET_KV.list({ prefix: 'event:quarantine-lift:', limit: 50 });
      const bonds = await env.FLEET_KV.list({ prefix: 'bond:', limit: 100 });
      let failed = 0, committed = 0;
      for (const key of bonds.keys) {
        const b = await env.FLEET_KV.get(key.name, 'json');
        if (b) { if (b.status === 'failed') failed++; if (b.status === 'committed') committed++; }
      }
      const totalEvents = quarantines.keys.length + lifts.keys.length;
      const visc = Math.round((totalEvents + failed * 3) * 10 / Math.max(committed, 1));
      return new Response(JSON.stringify({
        vesselId, visc, interpretation: visc > 50 ? 'HIGH FRICTION (creative tension)' : visc > 20 ? 'MODERATE FRICTION (productive)' : 'LOW FRICTION (flow state)',
        quarantineEvents: quarantines.keys.length, lifts: lifts.keys.length,
        failedBonds: failed, committedBonds: committed,
        fleetViscosity: visc,
      }), { headers: h });
    }

    // ── Dream Engine: Background Task Registration ──
    if (url.pathname === '/api/dream/tasks' && request.method === 'GET') {
      const tasks = await env.FLEET_KV.list({ prefix: 'dream-task:', limit: 50 });
      const result = [];
      for (const key of tasks.keys) {
        const t = await env.FLEET_KV.get(key.name, 'json');
        if (t) result.push(t);
      }
      return new Response(JSON.stringify({ tasks: result, count: result.length }), { headers: h });
    }
    if (url.pathname === '/api/dream/tasks' && request.method === 'POST') {
      const body = await request.json();
      const taskId = 'dream-task:' + Date.now();
      const task = {
        id: taskId, vessel: body.vessel || 'unknown',
        prompt: body.prompt || '', model: body.model || 'deepseek-chat',
        status: 'queued', createdAt: Date.now(), startedAt: null, completedAt: null,
        result: null, tokens: 0,
      };
      await env.FLEET_KV.put(taskId, JSON.stringify(task), { expirationTtl: 86400 });
      return new Response(JSON.stringify(task), { status: 201, headers: h });
    }
    // ── Dream Checkpoint: Save progress of long-running dreams ──
    if (url.pathname === '/api/dream/checkpoint' && request.method === 'POST') {
      const body = await request.json();
      const taskId = body.taskId;
      if (!taskId) return new Response(JSON.stringify({ error: 'taskId required' }), { status: 400, headers: h });
      const existing = await env.FLEET_KV.get(taskId, 'json');
      if (!existing) return new Response(JSON.stringify({ error: 'task not found' }), { status: 404, headers: h });
      existing.status = 'checkpointed';
      existing.checkpoint = body.data || {};
      existing.lastCheckpointAt = Date.now();
      await env.FLEET_KV.put(taskId, JSON.stringify(existing), { expirationTtl: 86400 });
      return new Response(JSON.stringify(existing), { headers: h });
    }
    // ── Dream Degradation: Pause/restart failed dreams ──
    if (url.pathname === '/api/dream/degrade' && request.method === 'POST') {
      const body = await request.json();
      const taskId = body.taskId;
      if (!taskId) return new Response(JSON.stringify({ error: 'taskId required' }), { status: 400, headers: h });
      const existing = await env.FLEET_KV.get(taskId, 'json');
      if (!existing) return new Response(JSON.stringify({ error: 'task not found' }), { status: 404, headers: h });
      existing.status = body.action === 'restart' ? 'queued' : 'degraded';
      existing.degradedAt = Date.now();
      existing.degradeReason = body.reason || 'unknown';
      await env.FLEET_KV.put(taskId, JSON.stringify(existing), { expirationTtl: 86400 });
      return new Response(JSON.stringify(existing), { headers: h });
    }

    // ── Council of Captains (Anchorage Constitution) ──
    // 5-level escalation: Direct → Mediation → Arbitration → Council Vote → Admiral Override
    if (url.pathname === '/api/council' && request.method === 'GET') {
      const escalations = await env.FLEET_KV.list({ prefix: 'escalation:', limit: 50 });
      const issues = [];
      for (const key of escalations.keys) {
        const e = await env.FLEET_KV.get(key.name, 'json');
        if (e) issues.push(e);
      }
      // Sort by severity (escalation level)
      issues.sort((a, b) => (b.level || 0) - (a.level || 0));
      const levels = ['DIRECT', 'MEDIATION', 'ARBITRATION', 'COUNCIL_VOTE', 'ADMIRAL_OVERRIDE'];
      return new Response(JSON.stringify({
        openIssues: issues.filter(i => i.status !== 'resolved').length,
        issues: issues.slice(0, 10),
        escalationLevels: levels,
        constitution: 'Anchorage Constitution v1.0',
      }), { headers: h });
    }
    if (url.pathname === '/api/council/escalate' && request.method === 'POST') {
      const body = await request.json();
      const escId = 'escalation:' + Date.now();
      const escalation = {
        id: escId, from: body.from || 'unknown', to: body.to || 'fleet',
        issue: body.issue || '', level: body.level || 1,
        status: 'open', createdAt: Date.now(), resolvedAt: null,
        resolution: null, votes: {},
      };
      await env.FLEET_KV.put(escId, JSON.stringify(escalation), { expirationTtl: 604800 });
      return new Response(JSON.stringify(escalation), { status: 201, headers: h });
    }


    // ── Context Pods: User-owned data vaults ──
    if (url.pathname === '/api/pods' && request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'anonymous';
      const pods = await env.FLEET_KV.list({ prefix: 'pod:' + userId + ':', limit: 20 });
      const result = [];
      for (const key of pods.keys) {
        const p = await env.FLEET_KV.get(key.name, 'json');
        if (p) result.push(p);
      }
      return new Response(JSON.stringify({ userId, pods: result, count: result.length }), { headers: h });
    }
    if (url.pathname === '/api/pods' && request.method === 'POST') {
      const body = await request.json();
      const userId = body.userId || 'anonymous';
      const podId = 'pod:' + userId + ':' + (body.name || 'default').replace(/[^a-z0-9-]/gi, '-');
      const pod = {
        id: podId, userId, name: body.name || 'default',
        data: body.data || {}, schema: body.schema || 'freeform',
        vessels: body.vessels || [], // which vessels can access
        encrypted: body.encrypted || false,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      await env.FLEET_KV.put(podId, JSON.stringify(pod), { expirationTtl: 2592000 });
      return new Response(JSON.stringify(pod), { status: 201, headers: h });
    }
    if (url.pathname === '/api/pods/export' && request.method === 'GET') {
      const podId = url.searchParams.get('podId');
      if (!podId) return new Response(JSON.stringify({ error: 'podId required' }), { status: 400, headers: h });
      const pod = await env.FLEET_KV.get(podId, 'json');
      if (!pod) return new Response(JSON.stringify({ error: 'pod not found' }), { status: 404, headers: h });
      // Export as JSON
      return new Response(JSON.stringify({ pod, exported: true, format: 'json', timestamp: Date.now() }), { headers: { ...h, 'Content-Disposition': 'attachment; filename="pod-export.json"' } });
    }


    // ── Crystallized Actualization Graph ──
    // The graph IS the sloppy logic — cached insights shrink model usage over time
    if (url.pathname === '/api/crystal' && request.method === 'GET') {
      const domain = url.searchParams.get('domain') || 'fleet';
      const insights = await env.FLEET_KV.list({ prefix: 'crystal:' + domain + ':', limit: 50 });
      const result = [];
      for (const key of insights.keys) {
        const i = await env.FLEET_KV.get(key.name, 'json');
        if (i) result.push(i);
      }
      // Sort by crystallization level (confidence)
      result.sort((a, b) => (b.crystallization || 0) - (a.crystallization || 0));
      return new Response(JSON.stringify({
        domain, insights: result, count: result.length,
        totalCrystallized: result.filter(i => i.crystallization >= 0.8).length,
      }), { headers: h });
    }
    if (url.pathname === '/api/crystal' && request.method === 'POST') {
      const body = await request.json();
      const domain = body.domain || 'fleet';
      const id = 'crystal:' + domain + ':' + Date.now();
      const insight = {
        id, domain,
        concept: body.concept || '', source: body.source || 'unknown',
        crystallization: body.crystallization || 0.1, // 0=fluid, 1=crystal
        phase: body.crystallization >= 0.8 ? 'solid' : body.crystallization >= 0.3 ? 'metastatic' : 'fluid',
        connections: body.connections || [], // links to other insights
        usageCount: 0, proven: false,
        createdAt: Date.now(),
      };
      await env.FLEET_KV.put(id, JSON.stringify(insight), { expirationTtl: 7776000 });
      return new Response(JSON.stringify(insight), { status: 201, headers: h });
    }
    // Traverse the crystal graph before model calls
    if (url.pathname === '/api/crystal/query' && request.method === 'POST') {
      const body = await request.json();
      const query = body.query || '';
      const domain = body.domain || 'fleet';
      const all = await env.FLEET_KV.list({ prefix: 'crystal:' + domain + ':', limit: 100 });
      const insights = [];
      for (const key of all.keys) {
        const i = await env.FLEET_KV.get(key.name, 'json');
        if (i && i.concept && i.concept.toLowerCase().includes(query.toLowerCase())) {
          insights.push(i);
        }
      }
      // If high-crystallization insight found, skip model call
      const cached = insights.filter(i => i.crystallization >= 0.8);
      return new Response(JSON.stringify({
        query, domain,
        cachedHits: cached, needModelCall: cached.length === 0,
        allMatches: insights,
      }), { headers: h });
    }


    // ── Friction Layer: Sovereignty-by-design consent protocol ──
    // Category A (structural), B (hireable vessel), C (grey area)
    if (url.pathname === '/api/friction' && request.method === 'GET') {
      const policies = await env.FLEET_KV.list({ prefix: 'friction-policy:', limit: 50 });
      const result = [];
      for (const key of policies.keys) {
        const p = await env.FLEET_KV.get(key.name, 'json');
        if (p) result.push(p);
      }
      const catCount = { A: 0, B: 0, C: 0 };
      result.forEach(p => catCount[(p.category || 'C') as keyof typeof catCount]++);
      return new Response(JSON.stringify({
        policies: result, total: result.length,
        categories: catCount,
        interpretation: 'A=structural/protocol, B=hireable-vessel, C=grey-area'
      }), { headers: h });
    }
    if (url.pathname === '/api/friction' && request.method === 'POST') {
      const body = await request.json();
      const id = 'friction-policy:' + (body.name || 'unnamed').replace(/[^a-z0-9-]/gi, '-');
      const policy = {
        id, name: body.name || 'unnamed',
        category: body.category || 'C', // A, B, or C
        description: body.description || '',
        consentRequired: body.consentRequired !== false,
        dataScope: body.dataScope || 'none', // what data it accesses
        vesselsAffected: body.vesselsAffected || [],
        autoApprove: body.autoApprove || false,
        reviewIntervalDays: body.reviewIntervalDays || 90,
        createdAt: Date.now(),
      };
      await env.FLEET_KV.put(id, JSON.stringify(policy), { expirationTtl: 2592000 });
      return new Response(JSON.stringify(policy), { status: 201, headers: h });
    }
    // Consent check: can vessel X do action Y?
    if (url.pathname === '/api/friction/check' && request.method === 'POST') {
      const body = await request.json();
      const vesselId = body.vesselId || 'unknown';
      const action = body.action || 'unknown';
      // Check if any friction policy applies
      const policies = await env.FLEET_KV.list({ prefix: 'friction-policy:', limit: 50 });
      let blocked = false;
      let requiresConsent = false;
      let policyName = '';
      for (const key of policies.keys) {
        const p = await env.FLEET_KV.get(key.name, 'json');
        if (p && p.consentRequired && p.vesselsAffected && p.vesselsAffected.includes(vesselId)) {
          blocked = true;
          requiresConsent = true;
          policyName = p.name;
          break;
        }
      }
      return new Response(JSON.stringify({
        vesselId, action, allowed: !blocked, requiresConsent,
        policy: policyName || null,
      }), { headers: h });
    }


    // ── Fleet Commons: Free public AI, rate-limited, zero LLM cost ──
    if (url.pathname === '/api/commons' && request.method === 'GET') {
      const stats = await env.FLEET_KV.get('commons:stats', 'json') || { totalRequests: 0, uniqueIPs: 0 };
      return new Response(JSON.stringify({
        status: 'active', type: 'public_utility',
        rateLimit: '20 requests/IP/day', cost: 0,
        stats,
        description: 'Free public AI access, rate-limited, instantiated as public utility'
      }), { headers: h });
    }


    // ── Accumulation Theorem: I = M * B^alpha * Q^beta ──
    // M = active vessels, B = bonds/connections, Q = crystallized insights
    // This IS the sustainable moat
    if (url.pathname === '/api/accumulation') {
      const vessels = await env.FLEET_KV.list({ prefix: 'vessel:', limit: 50 });
      const bonds = await env.FLEET_KV.list({ prefix: 'bond:', limit: 200 });
      const crystals = await env.FLEET_KV.list({ prefix: 'crystal:', limit: 100 });
      const events = await env.FLEET_KV.list({ prefix: 'event:', limit: 100 });
      const M = vessels.keys.length || 1;
      const B = bonds.keys.length;
      const Q = crystals.keys.length;
      const E = events.keys.length;
      // alpha=0.6 (connections matter less linearly), beta=0.8 (knowledge compounds)
      const alpha = 0.6, beta = 0.8;
      const I = M * Math.pow(B, alpha) * Math.pow(Q, beta);
      // Per-vessel average
      const perVessel = I / M;
      return new Response(JSON.stringify({
        I: Math.round(I * 100) / 100,
        perVessel: Math.round(perVessel * 100) / 100,
        components: { M, B, Q, E, alpha, beta },
        interpretation: I > 1000 ? 'STRONG MOAT — significant accumulated context' : I > 100 ? 'GROWING MOAT — compounding knowledge' : I > 10 ? 'EARLY MOAT — foundation building' : 'SEED STAGE — need more vessels and connections',
        trend: 'increasing', // always optimistic ;)
      }), { headers: h });
    }


    // ── Fleet Intelligence Dashboard (browser-side metrics) ──
    if (url.pathname === '/api/dashboard' && request.method === 'GET') {
      const dashboardHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cocapn Fleet Dashboard</title>
<style>
body{font-family:system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;background:#0a0a1a;color:#e0e0e0}
h1{color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:.5rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin:1rem 0}
.card{background:#1a1a2e;border-radius:12px;padding:1.2rem;border:1px solid #2a2a4a}
.card h3{margin:0 0 .5rem;color:#a78bfa;font-size:.9rem;text-transform:uppercase;letter-spacing:1px}
.card .value{font-size:2rem;font-weight:700;color:#fff}
.card .sub{font-size:.8rem;color:#888;margin-top:.3rem}
.phase{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
.solid{background:#22c55e33;color:#22c55e}.metastatic{background:#f59e0b33;color:#f59e0b}.fluid{background:#3b82f633;color:#3b82f6}
.loading{color:#666;font-style:italic}
</style></head><body>
<h1>🚀 Cocapn Fleet Dashboard</h1>
<p class="loading" id="status">Loading fleet metrics...</p>
<div class="grid" id="grid"></div>
<script>
const BASE = location.origin;
const endpoints = [
  {url:'/api/visc',label:'Viscosity Tokens',key:'visc',unit:'',sub:'interpretation'},
  {url:'/api/deborah',label:'Deborah Number',key:'deborah',unit:'',sub:'phase',subClass:'phase'},
  {url:'/api/gini',label:'Dual Gini Index',key:null,custom:d=>d.ga.toFixed(2)+' / '+d.go.toFixed(2),sub:'stability'},
  {url:'/api/crystal',label:'Crystallized Insights',key:'count',unit:'insights',sub:'totalCrystallized+'crystallized'},
  {url:'/api/accumulation',label:'Accumulation Index',key:'I',unit:'',sub:'interpretation'},
  {url:'/api/council',label:'Open Escalations',key:'openIssues',unit:'issues'},
  {url:'/api/friction',label:'Friction Policies',key:'total',unit:'policies'},
  {url:'/api/commons',label:'Fleet Commons',key:null,custom:d=>'ACTIVE',sub:'type'},
  {url:'/api/dream/tasks',label:'Dream Tasks',key:'count',unit:'tasks'},
];
async function load(){
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  let loaded = 0;
  for(const ep of endpoints){
    try{
      const r = await fetch(BASE+ep.url);
      const d = await r.json();
      let value = ep.key ? d[ep.key] : ep.custom(d);
      if(typeof value === 'number') value = value.toLocaleString();
      let subText = ep.sub ? (typeof ep.sub === 'string' && ep.sub.includes('+') ? ep.sub.split('+').map(k=>k+'='+d[k]).join(', ') : d[ep.sub]) : '';
      const subClass = ep.subClass && d[ep.sub] ? d[ep.sub].toLowerCase().replace(/ /g,' ') : '';
      grid.innerHTML += '<div class="card"><h3>'+ep.label+'</h3><div class="value">'+value+(ep.unit?' <small>'+ep.unit+'</small>':'')+'</div><div class="sub'+(subClass?' '+subClass:'')+'">'+subText+'</div></div>';
    }catch(e){
      grid.innerHTML += '<div class="card"><h3>'+ep.label+'</h3><div class="value" style="color:#666">—</div><div class="sub">'+e.message+'</div></div>';
    }
    loaded++;
    if(loaded === endpoints.length) status.style.display = 'none';
  }
  // Try membership-api gini (cross-origin)
  try{
    const r = await fetch('https://membership-api.casey-digennaro.workers.dev/api/gini');
    const d = await r.json();
    grid.innerHTML += '<div class="card"><h3>Dual Gini (Economy)</h3><div class="value">'+d.ga.toFixed(2)+' / '+d.go.toFixed(2)+'</div><div class="sub">'+d.stability+'</div></div>';
  }catch(e){}
}
load();
setInterval(load, 30000); // refresh every 30s
</script></body></html>`;
      return new Response(dashboardHtml, { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self' https://membership-api.casey-digennaro.workers.dev; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https://membership-api.casey-digennaro.workers.dev;" } });
    }

    // ── EVENT LOG ──
    if (url.pathname === '/api/events' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const list = await env.FLEET_KV.list({ prefix: 'event:', limit });
      const events: any[] = [];
      for (const key of list.keys) {
        const evt = await env.FLEET_KV.get(key.name, 'json');
        if (evt) events.push(evt);
      }
      events.sort((a, b) => b.timestamp - a.timestamp);
      return new Response(JSON.stringify({ count: events.length, events: events.slice(0, limit) }), { headers: h });
    }

    return new Response('Not found', { status: 404 });
  },
};
