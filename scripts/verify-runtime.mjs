// An isolated workerd + D1 integration test; never deploys or starts a preview.
import {createRequire} from 'node:module';
import {readFile, mkdtemp, mkdir, rm} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {passwordHash} from '../src/worker.js';
const require=createRequire(realpathSync('node_modules/wrangler/package.json'));
const {build}=require('esbuild');const {Miniflare}=require('miniflare');
await mkdir('.sites-runtime',{recursive:true});
const temp=await mkdtemp(resolve('.sites-runtime/ysk-runtime-'));
let mf;
try {
 const script=join(temp,'worker.mjs');
 await build({entryPoints:['src/worker.js'],bundle:true,format:'esm',platform:'browser',outfile:script});
 const salt='f'.repeat(32), password='runtime-test-password';
 mf=new Miniflare({modules:true,scriptPath:script,compatibilityDate:'2026-05-15',d1Databases:{DB:'runtime-test'},bindings:{ADMIN_PASSWORD_HASH:'pbkdf2$'+salt+'$'+await passwordHash(password,salt)},cf:false});
 const db=await mf.getD1Database('DB');
 for(const name of ['0001_initial.sql','0002_admin_auth.sql'])await db.exec(await readFile('migrations/'+name,'utf8'));
 const call=(path,method='GET',data,cookie)=>{
  const binary=data instanceof Uint8Array;
  return mf.dispatchFetch('https://ysk.test'+path,{method,headers:{Origin:'https://ysk.test',...(cookie?{Cookie:cookie}:{}),'Content-Type':binary?'image/png':'application/json'},...(data!==undefined?{body:binary?data:JSON.stringify(data)}:{})});
 };
 let response=await call('/api/public');assert.equal(response.status,200);
 const original=await response.json();assert.equal(original.data.members.length,6);
 assert.equal((await call('/api/admin/content','PUT',{revision:0,data:original.data})).status,401);
 response=await call('/api/login','POST',{password});assert.equal(response.status,200);
 const cookie=response.headers.get('Set-Cookie').split(';')[0];
 const data=structuredClone(original.data);data.circles[0].roles[0].memberIds=['sample-1'];data.circles[1].enabled=false;data.settings.description='実際のD1への保存確認';data.news.push({id:'runtime-news',date:'2026-10-16',title:'テスト',body:'追加と削除の確認',category:'確認',pinned:false});
 response=await call('/api/admin/content','PUT',{revision:0,data},cookie);assert.equal(response.status,200);
 const stored=(await (await call('/api/public')).json()).data;assert.equal(stored.settings.description,data.settings.description);assert.deepEqual(stored.circles,data.circles);
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVn0AAAAASUVORK5CYII=','base64'));
 response=await call('/api/admin/icons/sample-1','PUT',png,cookie);assert.equal(response.status,200);
 response=await call('/media/sample-1');assert.equal(response.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
 assert.equal((await call('/api/admin/content','PUT',{revision:0,data},cookie)).status,409);
 assert.equal((await call('/api/admin/icons/sample-1','DELETE',undefined,cookie)).status,200);
 assert.equal((await call('/media/sample-1')).status,404);
 response=await call('/api/admin/content','PUT',{revision:1,data:original.data},cookie);assert.equal(response.status,200);
 assert.deepEqual((await (await call('/api/public')).json()).data,original.data);
 assert.equal((await call('/api/admin/logout','POST',undefined,cookie)).status,200);
 assert.equal((await call('/api/admin/session','GET',undefined,cookie)).status,401);
 console.log('PASS: workerd + real D1 binding: login, circles/roles, CRUD, BLOB upload/read/delete, conflict, restore, logout');
}finally{await mf?.dispose();await rm(temp,{recursive:true,force:true});}
