import {sample} from './sample.js';
const enc = new TextEncoder();
function cookieOptions(request,env){
  const u=new URL(request.url);
  const local=env.LOCAL_DEV_AUTH==='true'&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  return {name:local?'ysk_local_session':'__Host-ysk_session',secure:!local};
}
function cookieHeader(request,env,token,maxAge){const {name,secure}=cookieOptions(request,env);return `${name}=${token}; Path=/; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Max-Age=${maxAge}`;}
export const security = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export async function sha(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']); const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256); return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
const validHash = value => /^pbkdf2\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value || '');
async function authConfig(env) {
  const stored = await env.DB.prepare('SELECT password_hash, owner_id FROM admin_auth WHERE id=1').first();
  return {hash: stored?.password_hash || env.ADMIN_PASSWORD_HASH, stored};
}
function setupAllowed(request, env, config) {
  // This flag is enabled only on the owner-private Sites deployment. Standalone
  // Cloudflare does not trust ChatGPT headers and starts with this flag absent.
  return env.PRIVATE_SETUP_ENABLED === 'true' && !config.stored && !validHash(config.hash)
    && Boolean(request.headers.get('oai-authenticated-user-id'));
}
function newPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail('パスワードは12〜128文字で設定してください');
  return value;
}
async function makeHash(password) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return 'pbkdf2$'+salt+'$'+await passwordHash(password,salt);
}
async function body(request,max){const reader=request.body?.getReader();if(!reader)fail('データがありません');let chunks=[],size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('データが大きすぎます',413);}chunks.push(value);}const all=new Uint8Array(size);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}return all;}
async function readJson(r,max=450000){try{return JSON.parse(new TextDecoder().decode(await body(r,max)));}catch(e){if(e.status)throw e;fail('JSON形式を確認してください');}}
function str(v,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('入力内容・文字数を確認してください');return v.trim();}
function url(v){const s=str(v,500);if(!s)return '';let u;try{u=new URL(s);}catch{fail('リンクは https:// から入力してください');}if(u.protocol!=='https:'||u.username||u.password)fail('HTTPSのリンクを入力してください');return s;}
export function validateContent(input){
  if(!input||!input.settings||!Array.isArray(input.members)||!Array.isArray(input.news)||input.members.length>120||input.news.length>100)fail('保存形式または件数を確認してください');
  const s=input.settings; const settings={name:str(s.name,60,true),tag:str(s.tag,12,true),game:str(s.game,60,true),headline:str(s.headline,100,true),description:str(s.description,3000,true),recruitment:str(s.recruitment,1000),discordUrl:url(s.discordUrl),giftUrl:url(s.giftUrl),sample:s.sample===true};
  for (const key of ['heroNote','aboutTitle','value1Title','value1Body','value2Title','value2Body','value3Title','value3Body']) settings[key]=str(s[key] ?? sample.settings[key],key==='heroNote'?500:200);
  const seen=new Set();const id=(v)=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(v)||seen.has(v))fail('IDが不正または重複しています');seen.add(v);return v;};
  const members=input.members.map(m=>{if(!m||!Number.isInteger(m.rank)||m.rank<1||m.rank>5||!Array.isArray(m.alts)||m.alts.length>10)fail('階級またはサブアカウントを確認してください');return {id:id(m.id),name:str(m.name,60,true),rank:m.rank,alts:m.alts.map(a=>str(a,60,true)),bio:str(m.bio,1000),avatar:['raccoon','bear','fox','rabbit','penguin'].includes(m.avatar)?m.avatar:'raccoon',color:['peach','blue','yellow','mint','lavender'].includes(m.color)?m.color:'blue'};});
  seen.clear();const news=input.news.map(n=>{if(!n||typeof n.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||!Number.isFinite(Date.parse(n.date))||new Date(n.date).toISOString().slice(0,10)!==n.date)fail('日付を確認してください');return {id:id(n.id),title:str(n.title,120,true),body:str(n.body,5000,true),date:n.date,category:str(n.category,30,true),pinned:n.pinned===true};});const inputCircles=input.circles??sample.circles;
  if(!Array.isArray(inputCircles)||inputCircles.length>16)fail('サークルは16件まで登録できます');
  const memberIds=new Set(members.map(m=>m.id));seen.clear();
  const circles=inputCircles.map(c=>{
    if(!c||!Array.isArray(c.roles)||c.roles.length>20||typeof c.enabled!=='boolean'||!['sleep','forest'].includes(c.theme))fail('サークルの設定を確認してください');
    const names=new Set();const roles=c.roles.map(role=>{
      if(!role||!Array.isArray(role.memberIds)||role.memberIds.length>120)fail('役職の担当者を確認してください');
      const name=str(role.name,40,true);if(names.has(name))fail('同じサークル内の役職名は重複できません');names.add(name);
      if(new Set(role.memberIds).size!==role.memberIds.length||role.memberIds.some(value=>typeof value!=='string'||!memberIds.has(value)))fail('役職の担当者は登録済みメンバーから選んでください');
      return {name,memberIds:[...role.memberIds]};
    });
    const selected=c.memberIds??[];
    if(!Array.isArray(selected)||selected.length>120||new Set(selected).size!==selected.length||selected.some(value=>typeof value!=='string'||!memberIds.has(value)))fail('サークルの所属メンバーは登録済みメンバーから選んでください');
    return {id:id(c.id),name:str(c.name,60,true),description:str(c.description,3000),theme:c.theme,enabled:c.enabled,roles,memberIds:[...new Set([...selected,...roles.flatMap(r=>r.memberIds)])]};
  });return {settings,members,news,circles};
}
async function getContent(db){const row=await db.prepare('SELECT revision, data FROM content WHERE id = 1').first();if(!row)return {revision:0,data:sample};const data=JSON.parse(row.data);data.settings={...sample.settings,...data.settings};const legacyCircles=data.circles===undefined;data.circles??=structuredClone(sample.circles);data.circles=data.circles.map(c=>({...c,memberIds:[...new Set([...(c.memberIds||[]),...c.roles.flatMap(r=>r.memberIds)])]}));if(legacyCircles&&!data.settings.giftUrl)data.settings.giftUrl=sample.settings.giftUrl;return {revision:row.revision,data};}
function sessionCookie(r,env){const cookieName=cookieOptions(r,env).name;return r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
async function authenticate(r,env,config){const token=sessionCookie(r,env);if(!/^[a-f0-9]{64}$/.test(token))fail('ログインしてください',401);const hash=await sha(token);const row=await env.DB.prepare('SELECT token_hash, auth_fingerprint FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(hash,Date.now()).first();if(!row||!validHash(config.hash)||row.auth_fingerprint!==await sha(config.hash))fail('セッションの有効期限が切れました',401);return hash;}
async function api(request,env){
  const path=new URL(request.url).pathname;
  if(!env.DB)return json({error:'D1の接続設定が必要です'},503);
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==new URL(request.url).origin)fail('同じサイトから操作してください',403);
  if(path==='/api/public'&&request.method==='GET'){const content=await getContent(env.DB);const icons=await env.DB.prepare('SELECT member_id FROM icons').all();return json({...content,icons:icons.results.map(x=>x.member_id)});}
  const config = await authConfig(env);
  if(path==='/api/auth/status'&&request.method==='GET') return json({configured:validHash(config.hash),canSetup:setupAllowed(request,env,config)});
  if(path==='/api/auth/setup'&&request.method==='POST') {
    if(!setupAllowed(request,env,config)) fail('初期設定はこの非公開サイトの所有者だけが実行できます',403);
    const data=await readJson(request,3000);
    const hash=await makeHash(newPassword(data?.password));
    const result=await env.DB.prepare('INSERT OR IGNORE INTO admin_auth (id,password_hash,owner_id,updated_at) VALUES (1,?,?,?)').bind(hash,request.headers.get('oai-authenticated-user-id'),Date.now()).run();
    if(!result.meta.changes) fail('初期設定は完了しています。ログインしてください',409);
    return json({ok:true});
  }
  if(path==='/api/login'&&request.method==='POST'){
    const hashValue=config.hash;if(!validHash(hashValue))return json({error:'管理者パスワードがまだ設定されていません'},503);
    const data=await readJson(request,3000);if(typeof data?.password!=='string'||data.password.length>256)fail('パスワードを確認してください');
    const now=Date.now();const ip=await sha(request.headers.get('CF-Connecting-IP')||'local');
    await env.DB.prepare('DELETE FROM login_limits WHERE reset_at < ?').bind(now).run();
    const count=await env.DB.prepare('INSERT INTO login_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END RETURNING count').bind(ip,now+15*60*1000,now,now).first();
    if(count.count>5)return json({error:'試行回数の上限です。15分ほど待ってください'},429,{'Retry-After':'900'});
    const [,salt,expected]=hashValue.split('$');if(!equal(await passwordHash(data.password,salt),expected))fail('パスワードが違います',401);
    const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),env.DB.prepare('INSERT INTO sessions (token_hash,expires_at,auth_fingerprint) VALUES (?,?,?)').bind(await sha(token),now+8*60*60*1000,await sha(hashValue))]);
    return json({ok:true},200,{'Set-Cookie':cookieHeader(request,env,token,28800)});
  }
  if(!path.startsWith('/api/admin/'))fail('見つかりません',404);
  const session=await authenticate(request,env,config);
  if(path==='/api/admin/session'&&request.method==='GET')return json({ok:true});
  if(path==='/api/admin/password'&&request.method==='PUT') {
    const data=await readJson(request,3000);
    const password=newPassword(data?.password);
    const hash=await makeHash(password);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO admin_auth (id,password_hash,owner_id,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at').bind(hash,config.stored?.owner_id||null,Date.now()),
      env.DB.prepare('DELETE FROM sessions')
    ]);
    return json({ok:true},200,{'Set-Cookie':cookieHeader(request,env,'',0)});
  }
  if(path==='/api/admin/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session).run();return json({ok:true},200,{'Set-Cookie':cookieHeader(request,env,'',0)});}
  if(path==='/api/admin/content'&&request.method==='PUT'){
    const payload=await readJson(request);const {revision,data}=payload||{};if(!Number.isInteger(revision)||revision<0)fail('更新番号を確認してください');const clean=validateContent(data);let result;
    if(revision===0)result=await env.DB.prepare('INSERT OR IGNORE INTO content (id,revision,data) VALUES (1,1,?)').bind(JSON.stringify(clean)).run();
    else result=await env.DB.prepare('UPDATE content SET data=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(clean),revision).run();
    if(!result.meta.changes)fail('別の画面で更新されました。再読み込みしてから編集してください',409);
    await env.DB.prepare("DELETE FROM icons WHERE member_id NOT IN (SELECT json_extract(value,'$.id') FROM content, json_each(content.data,'$.members'))").run();
    return json({ok:true,revision:revision+1});
  }
  const imageMatch=path.match(/^\/api\/admin\/icons\/([a-zA-Z0-9_-]{1,64})$/);
  if(imageMatch&&['PUT','DELETE'].includes(request.method)){
    const memberId=imageMatch[1];const current=await getContent(env.DB);if(!current.data.members.some(m=>m.id===memberId))fail('先にメンバーを保存してください',404);
    if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM icons WHERE member_id=?').bind(memberId).run();return json({ok:true});}
    const bytes=await body(request,100000);const mime=request.headers.get('Content-Type')?.split(';')[0];
    const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!((mime==='image/webp'&&webp)||(mime==='image/png'&&png)||(mime==='image/jpeg'&&jpeg)))fail('PNG・JPEG・WebP画像を選択してください');
    await env.DB.prepare('INSERT INTO icons (member_id,mime,bytes) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes').bind(memberId,mime,bytes.buffer).run();return json({ok:true});
  }
  fail('見つかりません',404);
}
export default {async fetch(request,env){try{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return await api(request,env);
  const match=path.match(/^\/media\/([a-zA-Z0-9_-]{1,64})$/);
  if(match){if(!env.DB)return json({error:'接続設定が必要です'},503);const row=await env.DB.prepare('SELECT mime,bytes FROM icons WHERE member_id=?').bind(match[1]).first();if(!row)return new Response(null,{status:404});return new Response(new Uint8Array(row.bytes),{headers:{...security,'Content-Type':row.mime,'Cache-Control':'no-cache'}});}
  const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);return new Response(response.body,{status:response.status,headers});
}catch(e){if(!e.status)console.error('Request failed',e.message);return json({error:e.status?e.message:'処理に失敗しました。時間をおいて再度お試しください'},e.status||500);}}};
