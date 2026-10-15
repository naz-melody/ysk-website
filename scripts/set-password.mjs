import {stdin,stdout} from 'node:process';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
async function hidden(prompt){if(!stdin.isTTY)throw Error('手元のターミナルから実行してください');stdout.write(prompt);stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');let text='';return new Promise((yes,no)=>{const listener=chunk=>{for(const ch of chunk){if(ch==='\u0003'){cleanup();no(Error('中止しました'));return;}if(ch==='\r'||ch==='\n'){cleanup();stdout.write('\n');yes(text);return;}if(ch==='\u007f'||ch==='\b')text=text.slice(0,-1);else if(ch>=' ')text+=ch;}};function cleanup(){stdin.off('data',listener);stdin.setRawMode(false);stdin.pause();}stdin.on('data',listener);});}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function wrangler(args,input){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[root+'/node_modules/wrangler/bin/wrangler.js',...args,'--config','cloudflare/wrangler.jsonc'],{cwd:root,stdio:[input?'pipe':'inherit','inherit','inherit']});if(input)child.stdin.end(input+'\n');child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Wranglerの処理に失敗しました。')));});}
try{
 const password=await hidden('新しい管理者パスワード（12〜128文字・表示されません）: ');
 if(password.length<12||password.length>128)throw Error('12〜128文字で設定してください');
 if(password!==await hidden('もう一度入力: '))throw Error('入力が一致しません');
 const salt=randomBytes(16).toString('hex');
 const hash='pbkdf2$'+salt+'$'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
 await wrangler(['secret','put','ADMIN_PASSWORD_HASH'],hash);
 // A terminal reset must also clear a password previously changed in the UI.
 await wrangler(['d1','execute','ysk-db','--remote','--command','DELETE FROM admin_auth; DELETE FROM sessions;']);
 console.log('パスワードを設定し、既存セッションを失効しました。');
}catch(error){console.error(error.message);process.exitCode=1;}
