import {stdin,stdout} from 'node:process';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
async function hidden(prompt){if(!stdin.isTTY)throw Error('手元のターミナルから実行してください');stdout.write(prompt);stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');let text='';return new Promise((yes,no)=>{const listener=chunk=>{for(const ch of chunk){if(ch==='\u0003'){cleanup();no(Error('中止しました'));return;}if(ch==='\r'||ch==='\n'){cleanup();stdout.write('\n');yes(text);return;}if(ch==='\u007f'||ch==='\b')text=text.slice(0,-1);else if(ch>=' ')text+=ch;}};function cleanup(){stdin.off('data',listener);stdin.setRawMode(false);stdin.pause();}stdin.on('data',listener);});}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function wrangler(args,input){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[root+'/node_modules/wrangler/bin/wrangler.js',...args,'--config','cloudflare/wrangler.jsonc'],{cwd:root,stdio:[input?'pipe':'inherit','inherit','inherit']});if(input)child.stdin.end(input+'\n');child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Wranglerの処理に失敗しました。')));});}
try{
 const local=process.argv.includes('--local');
 if(process.argv.slice(2).some(x=>x!=='--local'))throw Error('使用方法: npm run password または npm run password:local');
 const password=await hidden('新しい管理者パスワード（12〜128文字・表示されません）: ');
 if(password.length<12||password.length>128)throw Error('12〜128文字で設定してください');
 if(password!==await hidden('もう一度入力: '))throw Error('入力が一致しません');
 const salt=randomBytes(16).toString('hex');
 const hash='pbkdf2$'+salt+'$'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
 if(local){
  const path=resolve(root,'cloudflare/.dev.vars');const previous=existsSync(path)?readFileSync(path,'utf8'):'';
  const line='ADMIN_PASSWORD_HASH='+JSON.stringify(hash);
  const next=/^ADMIN_PASSWORD_HASH\s*=/m.test(previous)?previous.replace(/^ADMIN_PASSWORD_HASH\s*=.*$/m,()=>line):previous+(previous&&!previous.endsWith('\n')?'\n':'')+line+'\n';
  writeFileSync(path,next,{mode:0o600});chmodSync(path,0o600);
  await wrangler(['d1','execute','ysk-db','--local','--command','DELETE FROM admin_auth; DELETE FROM sessions;']);
  console.log('このMac用のパスワードを設定しました。npm run dev:cloudflare で起動してください。Cloudflare側は変更していません。');
 }else{
 await wrangler(['secret','put','ADMIN_PASSWORD_HASH'],hash);
 // A terminal reset must also clear a password previously changed in the UI.
 await wrangler(['d1','execute','ysk-db','--remote','--command','DELETE FROM admin_auth; DELETE FROM sessions;']);
 console.log('パスワードを設定し、既存セッションを失効しました。');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
