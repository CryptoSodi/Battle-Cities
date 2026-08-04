export const latencyPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Battle Cities WebSocket Latency</title><style>
:root{color-scheme:dark;font-family:Consolas,"Courier New",monospace;background:#10130f;color:#f2ead2}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 0,#273522,#0c0f0b 58%)}
main{width:min(720px,100%);border:4px solid #090b08;outline:2px solid #887c58;background:#1a2018;box-shadow:0 18px 60px #000b}
header{padding:18px 20px;border-bottom:2px solid #887c58;background:#262d21}h1{margin:0;color:#f0b52d;font-size:clamp(20px,4vw,30px);letter-spacing:2px}p{line-height:1.5;color:#bcb79f}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;background:#3d4935}.card{background:#171c15;padding:18px;min-height:105px}.wide{grid-column:1/-1}
.label{font-size:12px;letter-spacing:1.5px;color:#8f987e}.value{display:block;margin-top:8px;font-size:clamp(24px,6vw,38px);color:#e8e1c8}.good{color:#74d242}.warn{color:#f0b52d}.bad{color:#e45445}
button{width:100%;border:3px solid #11180e;background:#497f2a;color:#fff7d2;padding:14px;font:700 16px inherit;letter-spacing:1px;cursor:pointer;box-shadow:inset 0 0 0 2px #79a34e}button:focus-visible{outline:3px solid #ffd33d;outline-offset:3px}button:active{background:#d5a51f;color:#15130c}
#log{height:130px;overflow:auto;margin:0;white-space:pre-wrap;color:#aeb79d;font-size:12px}.footer{padding:16px 20px}.status{font-weight:700;color:#f0b52d}@media(max-width:520px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><main><header><h1>WEBSOCKET LATENCY</h1><p>Direct browser test against the Cloudflare game transport. Samples are sent individually—no batching.</p><div class="status" id="status">CONNECTING…</div></header>
<section class="grid"><div class="card"><span class="label">PING</span><strong class="value" id="ping">—</strong></div><div class="card"><span class="label">JITTER</span><strong class="value" id="jitter">—</strong></div><div class="card wide"><span class="label">CLOUDFLARE EDGE / REGION</span><strong class="value" id="region" style="font-size:20px">—</strong><p id="detail">Waiting for server metadata…</p></div><div class="card wide"><pre id="log"></pre></div></section>
<div class="footer"><button id="toggle">DISCONNECT</button></div></main><script>
const el=id=>document.getElementById(id),samples=[];let ws,timer,seq=0,last=null;
function write(s){el('log').textContent=(new Date().toLocaleTimeString()+'  '+s+'\n'+el('log').textContent).slice(0,4000)}
function connect(){const u=new URL('/ws-latency',location.href);u.protocol=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(u);el('status').textContent='CONNECTING…';el('toggle').textContent='DISCONNECT';
ws.onopen=()=>{el('status').textContent='CONNECTED';write('socket connected');ping();timer=setInterval(ping,500)};
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='latency-hello'){el('region').textContent=[m.colo,m.city,m.country].filter(Boolean).join(' · ')||'Cloudflare edge';el('detail').textContent='Ingress colo '+(m.colo||'unknown')+'; Durable Object placement is managed by Cloudflare.';return}if(m.type!=='latency-pong')return;const r=performance.now()-m.sentAt;samples.push(r);if(samples.length>40)samples.shift();const j=last===null?0:Math.abs(r-last);last=r;el('ping').textContent=r.toFixed(1)+' ms';el('jitter').textContent=j.toFixed(1)+' ms';el('ping').className='value '+(r<80?'good':r<160?'warn':'bad');write('pong #'+m.id+' '+r.toFixed(1)+' ms')};
ws.onclose=()=>{clearInterval(timer);el('status').textContent='DISCONNECTED';el('toggle').textContent='CONNECT';write('socket closed')}}
function ping(){if(ws?.readyState===1)ws.send(JSON.stringify({type:'latency-ping',id:++seq,sentAt:performance.now()}))}
el('toggle').onclick=()=>ws?.readyState<2?ws.close():connect();connect();
</script></body></html>`;
