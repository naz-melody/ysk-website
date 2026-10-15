import {el,kingdomLabel,memberCard,circleArt,roleList,setupMotion} from './ui.js';
const $=s=>document.querySelector(s);let circle,members=[],icons=[],query='';
function renderMembers(){const list=$('#circle-members-list');list.replaceChildren();const filtered=members.filter(m=>!query||[m.name,...m.alts].some(name=>name.toLocaleLowerCase().includes(query)));for(const member of filtered){const roles=circle.roles.filter(role=>role.memberIds.includes(member.id)).map(role=>role.name);list.append(memberCard(member,icons,roles));}if(!filtered.length)list.append(el('p',query?'条件に一致するメンバーが見つかりません。':'所属メンバーはまだ登録されていません。','empty'));}
$('#circle-search').oninput=e=>{query=e.target.value.trim().toLocaleLowerCase();renderMembers();};
setupMotion();
try{
 const id=new URL(location.href).searchParams.get('id');if(!id||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw Error('サークルが指定されていません。帝国のトップページから開いてください。');
 const response=await fetch('/api/public');const data=await response.json();if(!response.ok)throw Error(data.error||'読み込みに失敗しました。');
 circle=data.data.circles.find(c=>c.id===id&&c.enabled);if(!circle)throw Error('このサークルは見つからないか、現在非表示です。');
 const s=data.data.settings;icons=data.icons;const ids=new Set([...(circle.memberIds||[]),...circle.roles.flatMap(role=>role.memberIds)]);members=data.data.members.filter(m=>ids.has(m.id)).sort((a,b)=>b.rank-a.rank);
 document.title=circle.name+'｜'+s.name;$('#brand-name').textContent=s.name;$('#footer-name').textContent=s.name;$('#brand-tag').textContent=s.tag+' · '+kingdomLabel(s.kingdom)+' · '+s.game;$('#circle-name').textContent=circle.name;$('#circle-description').textContent=circle.description;$('#members-heading').textContent=circle.name+'の仲間たち。';$('#member-count').textContent=members.length+' MEMBERS';
 $('#circle-hero').classList.add('circle-'+circle.theme);$('#circle-hero-art').append(circleArt(circle.theme));
 if(circle.roles.length){$('#circle-staff-section').hidden=false;$('#circle-staff').append(roleList(circle,data.data.members));}
 renderMembers();$('#circle-status').hidden=true;$('#circle-content').hidden=false;
}catch(error){$('#circle-content').hidden=true;$('#circle-status').classList.add('error');$('#circle-status').textContent=error.message;}
