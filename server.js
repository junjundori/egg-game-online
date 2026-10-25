const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    return res.end('페이지를 찾을 수 없습니다.');
  }
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); return res.end('index.html 파일을 읽을 수 없습니다.'); }
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(data);
  });
});
const wss = new WebSocket.Server({server, maxPayload: 4096});
const players = new Map();
function cleanText(value, max=16) {
  return String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0,max) || '플레이어';
}
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function snapshot() { const out = {}; for (const [id,p] of players) out[id] = p; return out; }
function broadcast(data, except=null) { const text=JSON.stringify(data); for (const [id,ws] of sockets) if(id!==except && ws.readyState===WebSocket.OPEN) ws.send(text); }
const sockets = new Map();
wss.on('connection', ws => {
  const id = Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  sockets.set(id, ws);
  ws.on('message', raw => {
    let msg; try { msg=JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'join') {
      players.set(id, {id, nick:cleanText(msg.nick), char:msg.char==='🧍‍♀️'?'🧍‍♀️':'🧍‍♂️', x:clamp(msg.x,20,4975), y:clamp(msg.y,100,32970)});
      send(ws,{type:'welcome',id,players:snapshot()});
      broadcast({type:'system',text:players.get(id).nick+' 님이 접속했습니다.'},id);
      broadcast({type:'players',players:snapshot()});
    } else if (msg.type === 'move') {
      const p=players.get(id); if(!p)return;
      p.x=clamp(msg.x,20,4975);p.y=clamp(msg.y,100,32970);
      if(typeof msg.char==='string')p.char=msg.char.slice(0,8);
      broadcast({type:'players',players:snapshot()});
    } else if (msg.type === 'chat') {
      const p=players.get(id);if(!p)return;
      const text=String(msg.text??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,120);
      if(text)broadcast({type:'chat',nick:p.nick,text});
    }
  });
  ws.on('close',()=>{const p=players.get(id);players.delete(id);sockets.delete(id);if(p)broadcast({type:'system',text:p.nick+' 님이 나갔습니다.'});broadcast({type:'players',players:snapshot()});});
});
function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
server.listen(PORT,'0.0.0.0',()=>console.log(`달걀 훔치기 멀티플레이 서버 실행 중: ${PORT}`));
