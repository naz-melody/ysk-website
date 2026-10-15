export function el(tag,text,css){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(css)node.className=css;return node;}
export function animal(name,css=''){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class',css);svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','/animals.svg#'+name);svg.append(use);return svg;}
export function memberCard(member,icons,roles=[]){
 const card=el('article',undefined,'member-card');const visual=el('div',undefined,'member-visual '+member.color);
 if(icons.includes(member.id)){const img=el('img');img.src='/media/'+encodeURIComponent(member.id);img.alt=member.name+'のアイコン';img.loading='lazy';visual.append(img);}else visual.append(animal(member.avatar));
 visual.append(el('span','R'+member.rank,'rank-badge rank-'+member.rank));const info=el('div',undefined,'member-info');info.append(el('h3',member.name));
 if(roles.length){const badges=el('div',undefined,'circle-member-roles');for(const role of roles)badges.append(el('span',role));info.append(badges);}
 info.append(el('p',member.bio));const alts=el('div',undefined,'alts');alts.append(el('small','SUB ACCOUNTS'),el('span',member.alts.length?member.alts.join(' / '):'—'));info.append(alts);card.append(visual,info);return card;
}
export function circleArt(theme){
 const art=el('div',undefined,'circle-art');art.setAttribute('aria-hidden','true');
 if(theme==='sleep')art.append(el('span',undefined,'sleep-moon'),animal('sleeping-raccoon','circle-animal'),el('span','z','sleep-zzz z-one'),el('span','z','sleep-zzz z-two'),el('span','Z','sleep-zzz z-three'),el('span','DO NOT DISTURB · すやすや中','circle-caption'));
 else art.append(el('span',undefined,'forest-orb'),el('span',undefined,'forest-leaf leaf-one'),el('span',undefined,'forest-leaf leaf-two'),animal('fox','circle-animal'),el('span','OUR LITTLE FOREST · 帝国の仲間たち','circle-caption'));
 return art;
}
export function roleList(circle,members){const list=el('dl',undefined,'circle-roles');for(const role of circle.roles){const row=el('div');const names=role.memberIds.map(id=>members.find(m=>m.id===id)?.name).filter(Boolean);row.append(el('dt',role.name),el('dd',names.length?names.join(' / '):'担当者未登録'));list.append(row);}return list;}
export function setupMotion(){
 const button=document.querySelector('#motion-toggle');let paused=false;try{paused=localStorage.getItem('ysk-motion')==='paused';}catch{}
 const update=()=>{document.body.classList.toggle('paused',paused);button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'動きを再開する ❄':'動きを止める ❄';};
 update();button.onclick=()=>{paused=!paused;try{localStorage.setItem('ysk-motion',paused?'paused':'running');}catch{}update();};
}
