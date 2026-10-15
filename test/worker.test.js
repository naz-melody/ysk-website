import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{passwordHash,sha,validateContent} from '../src/worker.js';
import {sample} from '../src/sample.js';
class D1 {
 constructor(){this.db=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0002_admin_auth.sql'])this.db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));}
 prepare(sql){const db=this.db;let args=[];return {bind(...values){args=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}
 async batch(items){this.db.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());this.db.exec('COMMIT');return results;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
async function setup(){const salt='a'.repeat(32),pw='test-password-only';return {DB:new D1(),ADMIN_PASSWORD_HASH:'pbkdf2$'+salt+'$'+await passwordHash(pw,salt),ASSETS:{fetch:async()=>new Response('static')}};}
function call(env,path,method='GET',data,cookie,origin='https://ysk.test'){const headers={Origin:origin};if(cookie)headers.Cookie=cookie;let body;if(data!==undefined){if(data instanceof Uint8Array){body=data;headers['Content-Type']='image/webp';}else{body=JSON.stringify(data);headers['Content-Type']='application/json';}}return worker.fetch(new Request('https://ysk.test'+path,{method,headers,body}),env);}
async function login(env){const response=await call(env,'/api/login','POST',{password:'test-password-only'});assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);return cookie.split(';')[0];}
test('public sample available; unauthenticated edits rejected',async()=>{const env=await setup();const r=await call(env,'/api/public');assert.equal(r.status,200);const v=await r.json();assert.equal(v.revision,0);assert.equal(v.data.members.length,6);assert.equal((await call(env,'/api/admin/content','PUT',{revision:0,data:sample})).status,401);});
test('origin, invalid passwords, rate limiting, missing secret',async()=>{const env=await setup();assert.equal((await call(env,'/api/login','POST',{password:'wrong'},null,'https://evil.test')).status,403);for(let i=0;i<5;i++)assert.equal((await call(env,'/api/login','POST',{password:'wrong'})).status,401);assert.equal((await call(env,'/api/login','POST',{password:'test-password-only'})).status,429);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);delete env.ADMIN_PASSWORD_HASH;assert.equal((await call(env,'/api/login','POST',{password:'anything'})).status,503);});
test('content CRUD persists, optimistic conflict rejects overwrite',async()=>{const env=await setup(),cookie=await login(env);const data=structuredClone(sample);data.settings.description='Updated introduction';data.members.push({id:'new-1',name:'New member',rank:1,alts:['Second'],bio:'bio',avatar:'fox',color:'blue'});data.news=[];let r=await call(env,'/api/admin/content','PUT',{revision:0,data},cookie);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);assert.equal((await call(env,'/api/admin/content','PUT',{revision:0,data},cookie)).status,409);data.members[0].rank=4;data.members=data.members.filter(m=>m.id!=='new-1');r=await call(env,'/api/admin/content','PUT',{revision:1,data},cookie);assert.equal(r.status,200);const stored=await (await call(env,'/api/public')).json();assert.equal(stored.revision,2);assert.equal(stored.data.members.length,6);assert.equal(stored.data.members[0].rank,4);assert.equal(stored.data.settings.description,'Updated introduction');assert.deepEqual(stored.data.news,[]);assert.equal((await call(env,'/api/admin/content','PUT',{revision:2,data},cookie,'https://evil.test')).status,403);});
test('validation rejects bad rank, duplicate IDs, unsafe URLs, oversized body',async()=>{const env=await setup(),cookie=await login(env);for(const change of [d=>d.members[0].rank=9,d=>d.members[1].id=d.members[0].id,d=>d.settings.discordUrl='javascript:alert(1)',d=>d.settings.giftUrl='https://user:pw@example.com',d=>d.members[0].alts=Array(11).fill('x')]){const data=structuredClone(sample);change(data);assert.equal((await call(env,'/api/admin/content','PUT',{revision:0,data},cookie)).status,400);}assert.equal((await call(env,'/api/admin/content','PUT',{padding:'x'.repeat(460000)},cookie)).status,413);assert.throws(()=>validateContent(null));});
test('icons require auth, validate magic and size, persist and remove with member',async()=>{const env=await setup(),cookie=await login(env);const data=structuredClone(sample);await call(env,'/api/admin/content','PUT',{revision:0,data},cookie);const bytes=new TextEncoder().encode('RIFF1234WEBPimage');assert.equal((await call(env,'/api/admin/icons/sample-1','PUT',bytes)).status,401);assert.equal((await call(env,'/api/admin/icons/missing','PUT',bytes,cookie)).status,404);assert.equal((await call(env,'/api/admin/icons/sample-1','PUT',new TextEncoder().encode('<svg/>'),cookie)).status,400);assert.equal((await call(env,'/api/admin/icons/sample-1','PUT',new Uint8Array(100001),cookie)).status,413);assert.equal((await call(env,'/api/admin/icons/sample-1','PUT',bytes,cookie)).status,200);let r=await call(env,'/media/sample-1');assert.equal(r.headers.get('Content-Type'),'image/webp');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);data.members=data.members.filter(m=>m.id!=='sample-1');assert.equal((await call(env,'/api/admin/content','PUT',{revision:1,data},cookie)).status,200);assert.equal((await call(env,'/media/sample-1')).status,404);});
test('session stored as hash, expiry and logout enforced',async()=>{const env=await setup();let cookie=await login(env);const token=cookie.split('=')[1];const row=env.DB.db.prepare('SELECT token_hash FROM sessions').get();assert.equal(row.token_hash,await sha(token));assert.equal((await call(env,'/api/admin/session','GET',undefined,cookie)).status,200);await call(env,'/api/admin/logout','POST',undefined,cookie);assert.equal((await call(env,'/api/admin/session','GET',undefined,cookie)).status,401);cookie=await login(env);env.DB.db.exec('UPDATE sessions SET expires_at=0');assert.equal((await call(env,'/api/admin/session','GET',undefined,cookie)).status,401);});
test('static and JSON security headers; unknown routes fail closed',async()=>{const env=await setup();const r=await call(env,'/');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);const cookie=await login(env);assert.equal((await call(env,'/api/admin/unknown','POST',{},cookie)).status,404);assert.equal((await call(env,'/api/admin/session','DELETE',undefined,cookie)).status,404);});

test('private setup requires platform identity and opt-in, succeeds once, then password login works',async()=>{
 const env=await setup();delete env.ADMIN_PASSWORD_HASH;
 const request=(path,method='GET',data,identity='owner-private')=>worker.fetch(new Request('https://ysk.test'+path,{method,headers:{Origin:'https://ysk.test',...(identity?{'oai-authenticated-user-id':identity}:{}),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
 assert.equal((await (await request('/api/auth/status')).json()).canSetup,false);
 assert.equal((await request('/api/auth/setup','POST',{password:'new-private-password'})).status,403);
 env.PRIVATE_SETUP_ENABLED='true';
 assert.equal((await (await request('/api/auth/status','GET',undefined,'')).json()).canSetup,false);
 assert.equal((await request('/api/auth/setup','POST',{password:'new-private-password'},'')).status,403);
 assert.equal((await request('/api/auth/setup','POST',{password:'short'})).status,400);
 assert.equal((await (await request('/api/auth/status')).json()).canSetup,true);
 assert.equal((await request('/api/auth/setup','POST',{password:'new-private-password'})).status,200);
 assert.equal((await request('/api/auth/setup','POST',{password:'attacker-password'})).status,403);
 assert.equal((await (await request('/api/auth/status')).json()).configured,true);
 const row=env.DB.db.prepare('SELECT * FROM admin_auth').get();assert.equal(row.owner_id,'owner-private');assert.notEqual(row.password_hash,'new-private-password');
 assert.equal((await call(env,'/api/login','POST',{password:'new-private-password'})).status,200);
});
test('password changes revoke all sessions, keep content, and supersede an older deployment secret',async()=>{
 const env=await setup();const first=await login(env),second=await login(env);
 await call(env,'/api/admin/content','PUT',{revision:0,data:sample},first);
 assert.equal((await call(env,'/api/admin/password','PUT',{password:'short'},first)).status,400);
 assert.equal((await call(env,'/api/admin/password','PUT',{password:'changed-password-123'},first,'https://evil.test')).status,403);
 const changed=await call(env,'/api/admin/password','PUT',{password:'changed-password-123'},first);assert.equal(changed.status,200);assert.match(changed.headers.get('Set-Cookie'),/Max-Age=0/);
 for(const cookie of [first,second])assert.equal((await call(env,'/api/admin/session','GET',undefined,cookie)).status,401);
 assert.equal((await call(env,'/api/login','POST',{password:'test-password-only'})).status,401);
 assert.equal((await call(env,'/api/login','POST',{password:'changed-password-123'})).status,200);
 assert.equal((await (await call(env,'/api/public')).json()).revision,1);
});
test('deployment secret rotation immediately invalidates existing sessions',async()=>{
 const env=await setup(),cookie=await login(env);const salt='b'.repeat(32);env.ADMIN_PASSWORD_HASH='pbkdf2$'+salt+'$'+await passwordHash('rotated-password',salt);
 assert.equal((await call(env,'/api/admin/session','GET',undefined,cookie)).status,401);
 assert.equal((await call(env,'/api/admin/content','PUT',{revision:0,data:sample},cookie)).status,401);
});
test('malformed payloads and impossible dates return 400 without losing saved content',async()=>{
 const env=await setup(),cookie=await login(env);
 for(const payload of [null,{revision:0,data:null}])assert.equal((await call(env,'/api/admin/content','PUT',payload,cookie)).status,400);
 for(const mutate of [d=>d.members[0]=null,d=>d.news[0]=null,d=>d.news[0].date='2026-02-30',d=>d.settings.value1Title='x'.repeat(201)]){
  const data=structuredClone(sample);mutate(data);assert.equal((await call(env,'/api/admin/content','PUT',{revision:0,data},cookie)).status,400);
 }
 assert.equal((await call(env,'/api/login','POST',null)).status,400);
 assert.equal((await (await call(env,'/api/public')).json()).revision,0);
});
test('uploaded icon deletion restores fallback; content and news can become empty',async()=>{
 const env=await setup(),cookie=await login(env);await call(env,'/api/admin/content','PUT',{revision:0,data:sample},cookie);
 const bytes=new TextEncoder().encode('RIFF1234WEBPimage');await call(env,'/api/admin/icons/sample-1','PUT',bytes,cookie);
 assert.deepEqual((await (await call(env,'/api/public')).json()).icons,['sample-1']);
 assert.equal((await call(env,'/api/admin/icons/sample-1','DELETE',undefined,cookie)).status,200);
 assert.equal((await call(env,'/media/sample-1')).status,404);
 const data=structuredClone(sample);data.members=[];data.news=[];
 assert.equal((await call(env,'/api/admin/content','PUT',{revision:1,data},cookie)).status,200);
 const stored=await (await call(env,'/api/public')).json();assert.deepEqual(stored.data.members,[]);assert.deepEqual(stored.data.news,[]);assert.deepEqual(stored.icons,[]);
});
