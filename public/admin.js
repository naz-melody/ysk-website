const $=s=>document.querySelector(s);let state,revision,icons=[],dirty=false,busy=false,previewUrl;
function message(text,bad=false){const x=$('#message');x.hidden=false;x.textContent=text;x.classList.toggle('bad',bad);}
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});let v;try{v=await r.json();}catch{throw Error('通信に失敗しました。再度お試しください。');}if(!r.ok){if(r.status===401&&path!=='/api/login'){showLogin();}throw Error(v.error||'保存できませんでした');}return v;}
function showLogin(){$('#dashboard').hidden=true;$('#setup-panel').hidden=true;$('#login-panel').hidden=false;}
async function load(){const r=await api('/api/public');state=r.data;revision=r.revision;icons=r.icons;for(const [key,val]of Object.entries(state.settings)){const control=$('#settings-form').elements.namedItem(key);if(control){if(control.type==='checkbox')control.checked=val;else control.value=val;}}renderLists();}
function renderLists(){
 for(const [key,selector,choose]of [['members','#admin-members',editMember],['news','#admin-news',editNews],['circles','#admin-circles',editCircle]]){
  const list=$(selector);list.replaceChildren();let items=[...(state[key]||[])];
  if(key==='members')items.sort((a,b)=>b.rank-a.rank);else if(key==='news')items.sort((a,b)=>b.date.localeCompare(a.date));
  for(const item of items){const b=document.createElement('button');b.className='edit-item';b.type='button';b.textContent=key==='news'?item.title:item.name;const sub=document.createElement('small');sub.textContent=key==='members'?'R'+item.rank+' · サブ '+item.alts.length+'アカウント':key==='news'?item.date+(item.pinned?' · 固定中':''):(item.enabled?'表示中':'非表示')+' · 役職 '+item.roles.length+'件';b.append(sub);b.onclick=()=>{if(busy)return;if(!dirty||confirm('保存前の変更を破棄しますか？')){dirty=false;choose(item);}};list.append(b);}
  if(!items.length)list.textContent='まだ登録されていません。';
 }
}
function addRole(role={name:'',memberIds:[]}){
 const row=document.createElement('div');row.className='role-row';const top=document.createElement('div');top.className='role-top';const label=document.createElement('label');label.textContent='役職名';const input=document.createElement('input');input.className='role-name';input.maxLength=40;input.required=true;input.value=role.name;label.append(input);const remove=document.createElement('button');remove.type='button';remove.className='button danger';remove.textContent='役職を削除';remove.onclick=()=>{if(busy)return;row.remove();dirty=true;};top.append(label,remove);const title=document.createElement('p');title.className='role-members-title';title.textContent='担当メンバー（複数選択可・未選択でも保存できます）';const members=document.createElement('div');members.className='role-members';
 for(const m of [...state.members].sort((a,b)=>b.rank-a.rank)){const option=document.createElement('label');option.className='checkbox';const cb=document.createElement('input');cb.type='checkbox';cb.value=m.id;cb.checked=role.memberIds.includes(m.id);option.append(cb,document.createTextNode(m.name+'（R'+m.rank+'）'));members.append(option);}
 if(!state.members.length)members.textContent='先にメンバーを登録すると担当者を選べます。';row.append(top,title,members);$('#circle-roles-editor').append(row);
}
function editCircle(circle=null){
 const f=$('#circle-form');f.reset();const value=circle||{id:'',name:'',description:'',theme:'sleep',enabled:true,memberIds:[]};setForm(f,value);$('#circle-form-title').textContent=circle?'サークルを編集':'サークルを追加';$('#delete-circle').hidden=!circle;$('#circle-roles-editor').replaceChildren();for(const role of circle?.roles||[])addRole(role);renderCircleMembers(circle);
}
function renderCircleMembers(circle){
 const box=$('#circle-members-editor');box.replaceChildren();const selected=new Set([...(circle?.memberIds||[]),...(circle?.roles||[]).flatMap(r=>r.memberIds)]);
 for(const m of [...state.members].sort((a,b)=>b.rank-a.rank)){const label=document.createElement('label');label.className='checkbox';const input=document.createElement('input');input.type='checkbox';input.value=m.id;input.checked=selected.has(m.id);label.append(input,document.createTextNode(m.name+'（R'+m.rank+'）'));box.append(label);}
 if(!state.members.length)box.textContent='先にメンバーを登録してください。';
}
function setForm(form,values){for(const [k,v]of Object.entries(values)){const c=form.elements.namedItem(k);if(c){if(c.type==='checkbox')c.checked=v;else c.value=Array.isArray(v)?v.join('\n'):v;}}}
function editMember(m=null){const f=$('#member-form');f.reset();setForm(f,m||{id:'',name:'',rank:3,alts:[],bio:'',avatar:'raccoon',color:'blue'});$('#member-form-title').textContent=m?'メンバーを編集':'メンバーを追加';$('#delete-member').hidden=!m;$('#remove-icon').checked=false;if(previewUrl)URL.revokeObjectURL(previewUrl);const p=$('#icon-preview');p.hidden=!(m&&icons.includes(m.id));if(!p.hidden)p.src='/media/'+m.id+'?v='+Date.now();}
function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function editNews(n=null){const f=$('#news-form');f.reset();setForm(f,n||{id:'',title:'',date:today(),category:'お知らせ',body:'',pinned:false});$('#news-form-title').textContent=n?'お知らせを編集':'お知らせを追加';$('#delete-news').hidden=!n;}
async function save(next){const r=await api('/api/admin/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,data:next})});state=next;revision=r.revision;dirty=false;renderLists();}
async function task(fn){if(busy)return;busy=true;const controls=[...document.querySelectorAll('#dashboard button,#dashboard input,#dashboard textarea,#dashboard select')];const initial=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);try{await fn();}catch(e){message(e.message,true);}finally{controls.forEach((x,i)=>x.disabled=initial[i]);busy=false;}}
async function confirmDelete(text){const dialog=$('#confirm-dialog');$('#confirm-text').textContent=text;dialog.returnValue='cancel';dialog.showModal();return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true}));}
function formValues(form){return Object.fromEntries(new FormData(form));}
async function compress(file){if(file.size>8*1024*1024)throw Error('元画像は8MB以下を選択してください');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG・JPEG・WebPを選択してください');const img=await createImageBitmap(file);try{if(img.width*img.height>32e6)throw Error('画像の縦横サイズが大きすぎます');const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');const size=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,256,256);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(!blob||blob.size>100000)throw Error('圧縮できませんでした。小さい画像を選択してください');return blob;}finally{img.close();}}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#password').value})});$('#password').value='';await enter();message('ログインしました。');}catch(e){message(e.message,true);}finally{b.disabled=false;}};
async function enter(){try{await api('/api/admin/session');}catch(error){if(/ログイン|セッション/.test(error.message))throw Error('ログイン状態を保持できませんでした。サーバーを更新して npm run dev:cloudflare で起動し、同じlocalhostのURLから操作してください。');throw error;}await load();$('#setup-panel').hidden=true;$('#login-panel').hidden=true;$('#dashboard').hidden=false;editMember();editNews();editCircle();}
$('#logout').onclick=()=>task(async()=>{if(dirty&&!confirm('保存前の変更を破棄してログアウトしますか？'))return;await api('/api/admin/logout',{method:'POST'});dirty=false;showLogin();message('ログアウトしました。');});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{if(dirty&&!confirm('保存前の変更を破棄して移動しますか？'))return;dirty=false;for(const x of document.querySelectorAll('[data-panel]')){x.setAttribute('aria-pressed',String(x===b));$('#panel-'+x.dataset.panel).hidden=x!==b;}if(b.dataset.panel==='settings')setForm($('#settings-form'),state.settings);if(b.dataset.panel==='members')editMember();if(b.dataset.panel==='news')editNews();if(b.dataset.panel==='circles')editCircle();});
$('#settings-form').onsubmit=e=>{e.preventDefault();const data=formValues(e.currentTarget);data.sample=e.currentTarget.elements.sample.checked;task(async()=>{await save({...state,settings:data});message('紹介とリンクを保存しました。');});};
$('#member-form').onsubmit=async e=>{e.preventDefault();const values=formValues(e.currentTarget);const file=$('#icon-file').files[0];const remove=$('#remove-icon').checked;values.id||=crypto.randomUUID();values.rank=Number(values.rank);values.alts=values.alts.split('\n').map(x=>x.trim()).filter(Boolean);task(async()=>{const image=file?await compress(file):null;const next=structuredClone(state);const i=next.members.findIndex(x=>x.id===values.id);if(i<0)next.members.push(values);else next.members[i]=values;await save(next);editMember(values);try{if(image){await api('/api/admin/icons/'+values.id,{method:'PUT',headers:{'Content-Type':image.type},body:image});if(!icons.includes(values.id))icons.push(values.id);}else if(remove){await api('/api/admin/icons/'+values.id,{method:'DELETE'});icons=icons.filter(x=>x!==values.id);}editMember(values);message('メンバーを保存しました。');}catch(err){message('メンバーの文章は保存しましたが、画像の変更に失敗しました。画像を選び直して保存してください。\n'+err.message,true);}});};
$('#news-form').onsubmit=e=>{e.preventDefault();const values=formValues(e.currentTarget);values.id||=crypto.randomUUID();values.pinned=e.currentTarget.elements.pinned.checked;task(async()=>{const next=structuredClone(state);const i=next.news.findIndex(x=>x.id===values.id);if(i<0)next.news.push(values);else next.news[i]=values;await save(next);editNews(values);message('お知らせを保存しました。');});};
$('#new-member').onclick=()=>{if(!dirty||confirm('保存前の変更を破棄しますか？')){dirty=false;editMember();}};$('#new-news').onclick=()=>{if(!dirty||confirm('保存前の変更を破棄しますか？')){dirty=false;editNews();}};
$('#delete-member').onclick=async()=>{const id=$('#member-form').elements.id.value;const m=state.members.find(x=>x.id===id);if(!m||!await confirmDelete(m.name+' と、紐づくサブアカウント情報を削除します。'))return;task(async()=>{const next=structuredClone(state);next.members=next.members.filter(x=>x.id!==id);next.circles=(next.circles||[]).map(c=>({...c,memberIds:(c.memberIds||[]).filter(memberId=>memberId!==id),roles:c.roles.map(role=>({...role,memberIds:role.memberIds.filter(memberId=>memberId!==id)}))}));await save(next);editMember();message('メンバーを削除しました。');});};
$('#delete-news').onclick=async()=>{const id=$('#news-form').elements.id.value;if(!await confirmDelete('このお知らせを削除します。'))return;task(async()=>{const next=structuredClone(state);next.news=next.news.filter(x=>x.id!==id);await save(next);editNews();message('お知らせを削除しました。');});};
$('#icon-file').onchange=()=>{const file=$('#icon-file').files[0];if(!file)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);$('#icon-preview').src=previewUrl;$('#icon-preview').hidden=false;};
$('#dashboard').addEventListener('input',()=>dirty=true);window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('#setup-form').onsubmit=async e=>{
  e.preventDefault();const password=$('#setup-password').value;
  if(password!==$('#setup-confirm').value){message('パスワードが一致しません。',true);return;}
  const button=e.submitter;button.disabled=true;
  try{
    await api('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    $('#setup-form').reset();showLogin();message('パスワードを設定しました。ログインしてください。');
    await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    await enter();message('初期設定が完了しました。紹介やメンバーを編集できます。');
  }catch(error){message(error.message,true);}finally{button.disabled=false;}
};
$('#reload-content').onclick=()=>task(async()=>{
  if(dirty&&!confirm('保存前の変更を破棄して最新の内容を読み込みますか？'))return;
  await load();editMember();editNews();editCircle();dirty=false;message('最新の内容を読み込みました。');
});
try{
  const auth=await api('/api/auth/status');
  if(auth.canSetup){$('#login-panel').hidden=true;$('#setup-panel').hidden=false;}
  else if(!auth.configured){showLogin();message('管理者パスワードが未設定です。非公開の確認用サイトは、所有者のChatGPTアカウントで開いてください。Cloudflareへ直接設置した場合は npm run password を実行してください。',true);}
  else{await api('/api/admin/session');await enter();}
}catch(error){showLogin();if(!/ログイン|セッション/.test(error.message))message(error.message,true);}


$('#circle-form').onsubmit=e=>{
 e.preventDefault();const values=formValues(e.currentTarget);values.id||=crypto.randomUUID();values.enabled=e.currentTarget.elements.enabled.checked;
 values.memberIds=[...document.querySelectorAll('#circle-members-editor input:checked')].map(x=>x.value);
 values.roles=[...document.querySelectorAll('#circle-roles-editor .role-row')].map(row=>({name:row.querySelector('.role-name').value.trim(),memberIds:[...row.querySelectorAll('.role-members input:checked')].map(x=>x.value)}));
 values.memberIds=[...new Set([...values.memberIds,...values.roles.flatMap(r=>r.memberIds)])];
 task(async()=>{const next=structuredClone(state);next.circles||=[];const index=next.circles.findIndex(c=>c.id===values.id);if(index<0)next.circles.push(values);else next.circles[index]=values;await save(next);editCircle(values);message('サークルの紹介と役職を保存しました。');});
};
$('#new-circle').onclick=()=>{if(busy)return;if(!dirty||confirm('保存前の変更を破棄しますか？')){dirty=false;editCircle();}};
$('#add-circle-role').onclick=()=>{if(busy)return;if($('#circle-roles-editor').children.length>=20){message('役職は1サークル20件までです。',true);return;}addRole();dirty=true;};
$('#delete-circle').onclick=async()=>{const id=$('#circle-form').elements.id.value;const c=state.circles?.find(x=>x.id===id);if(!c||!await confirmDelete(c.name+'の紹介と役職設定を削除します。メンバー自体は削除されません。'))return;task(async()=>{const next=structuredClone(state);next.circles=next.circles.filter(x=>x.id!==id);await save(next);editCircle();message('サークルを削除しました。');});};
