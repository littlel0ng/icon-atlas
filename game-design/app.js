import {STORAGE_KEY,PROTOTYPE_FIELDS,esc,safeUrl,createIndex,recordMatches,entityMatches,blankBoard,normalizeBoard,mergeBoards,reference,markdown,backup} from './core.js';

const $=selector=>document.querySelector(selector);
const fmt=n=>Number(n||0).toLocaleString('zh-CN');
const categories=['技能','被动','天赋','辅助','专精','职业机制','状态'];
const modeName=value=>({pve:'PvE',pvp:'PvP',standard:'常规模式',stadium:'Stadium'}[value]||value);
const countText=counts=>categories.filter(k=>k!=='状态'&&counts[k]).map(k=>counts[k]+' '+k).join(' · ')||'暂无设计条目';
const params=new URL(location.href).searchParams;
const views=['heroes','skills','compare','board','coverage'];
const state={view:views.includes(params.get('view'))?params.get('view'):'heroes',game:params.get('game')||'all',
 query:params.get('q')||'',category:params.get('category')||'设计',mechanic:params.get('mechanic')||'all',mode:params.get('mode')||'all',limit:24,
 compareEntities:(params.get('compareHeroes')||'').split(',').filter(Boolean).slice(0,3),
 compareRecords:(params.get('compareSkills')||'').split(',').filter(Boolean).slice(0,4),compareKind:'entities'};
let data,index,board=blankBoard(),selected=null,kitState=null,toastTimer,storageWorks=true;
const featured=['dota:crystal_maiden','lol:Ahri','hots:abathur','gw2:Mesmer','ffxiv:paladin','d3:necromancer','d4:druid','poe2:support'];
const titles={heroes:['英雄 / 职业','从一个角色，<span>拆解一套设计。</span>','英雄定位、技能组合与成长选择，放在同一张工作台上。'],
 skills:['技能 / 天赋','从一个机制，<span>找到不同解法。</span>','查阅技能原文、成长分支与联动，把参考落到具体设计。'],
 compare:['设计对照','并排看见，<span>设计的取舍。</span>','比较定位、资源、技能与成长，不同游戏保留各自语境。'],
 board:['我的原型参考','让参考，<span>成为下一个原型。</span>','写下设计意图、核心循环和反制，再带着来源一起导出。'],
 coverage:['收录与来源','每份参考，<span>都有它的边界。</span>','查看来源快照、资料深度和缺口，明确哪些可以作为依据。']};
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3400);}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(board));storageWorks=true;$('#saveStatus').textContent='已保存到当前浏览器';}catch{storageWorks=false;$('#saveStatus').textContent='浏览器存储不可用，请导出备份';toast('浏览器存储不可用，当前修改仅在本页保留，请导出 JSON 备份。');}}
const saved=id=>board.ids.includes(id);
function imageMarkup(r,extra=''){return r.icon&&safeUrl(r.icon)?`<img class="skill-icon ${extra}" src="${esc(safeUrl(r.icon))}" alt="${esc(r.name)}图标" loading="lazy">`:`<span class="skill-icon missing ${extra}" aria-label="尚无独立图像">${r.category==='天赋'?'✧':'?'}</span>`;}
function tagsMarkup(tags){return tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('');}
function sourceLink(url,label,cls=''){const valid=safeUrl(url);return valid?`<a class="${cls}" href="${esc(valid)}" target="_blank" rel="noopener noreferrer">${label}</a>`:'';}
function gameName(id){return index.games.get(id)?.name||id;}
function ownersText(r){return r.owners.map(id=>index.entities.get(id)?.name).filter(Boolean).join(' / ')||'通用状态参考';}
function card(r,withNote=false){
 return `<article class="skill-card" data-record-id="${esc(r.id)}"><div class="skill-head">${imageMarkup(r)}<div><button class="skill-title" data-detail="${esc(r.id)}">${r.slot?`<span class="slot">${esc(r.slot)}</span>`:''}${esc(r.name)}</button><div class="skill-sub">${esc(gameName(r.game))} · ${esc(ownersText(r))}<br>${esc(r.category)}${r.tier?' · '+r.tier+' 级天赋':''}${r.mode?' · '+modeName(r.mode):''}</div></div></div><p class="skill-description${!r.description?' incomplete':''}">${esc(r.description||'尚未采集机制说明，请访问来源核对。')}</p><div class="badges">${tagsMarkup(r.tags.slice(0,4))}${r.originalKind==='技能变体'?'<span class="badge">技能变体</span>':''}${!r.hasDesign?'<span class="badge warning">设计资料待补</span>':''}</div>${withNote&&board.notes[r.id]?`<div class="board-note">参考意图：${esc(board.notes[r.id])}</div>`:''}<div class="skill-card-footer"><span>${esc(r.metrics['冷却']?'CD '+r.metrics['冷却']:r.snapshot)}</span><div class="card-buttons"><button class="compare-button ${state.compareRecords.includes(r.id)?'selected':''}" data-compare-record="${esc(r.id)}" aria-pressed="${state.compareRecords.includes(r.id)}">${state.compareRecords.includes(r.id)?'✓ 对照':'⇄ 对照'}</button><button class="save-button ${saved(r.id)?'saved':''}" data-save="${esc(r.id)}" aria-pressed="${saved(r.id)}">${saved(r.id)?'✓ 已收藏':'＋ 收藏'}</button></div></div></article>`;
}
function entityCard(e){
 const count=e.counts;
 return `<article class="entity-card" data-entity-id="${esc(e.id)}"><div class="entity-body"><div class="card-eyebrow"><span>${esc(gameName(e.game))}</span><span class="type-badge">${esc(e.type)}</span></div><button class="entity-title" data-kit="${esc(e.id)}">${esc(e.name)}</button><div class="entity-en">${esc(e.en)}${e.title?' · '+esc(e.title):''}</div><p class="entity-summary">${esc(e.summary||'按来源整理的技能与成长选择，点击查看完整套组。')}</p><div class="skill-strip">${e.previewIcons.map(icon=>`<img src="${esc(safeUrl(icon))}" alt="${esc(e.name)}技能图标预览" loading="lazy">`).join('')}${!e.previewIcons.length?'<span>暂无已确认图像</span>':''}</div><div class="badges">${e.roles.filter(Boolean).map(role=>`<span class="badge role">${esc(role)}</span>`).join('')}${tagsMarkup(e.tags.slice(0,e.roles.length?2:3))}${e.referenceOnly?'<span class="badge warning">仅图标精选</span>':''}</div><div class="entity-meta"><span>${esc(countText(count))}</span><span>${esc(e.snapshot)}</span></div></div><div class="entity-actions"><button data-kit="${esc(e.id)}">查看${e.type==='共享体系'?'体系':'套组'} ↗</button><button data-compare-entity="${esc(e.id)}" aria-pressed="${state.compareEntities.includes(e.id)}">${state.compareEntities.includes(e.id)?'✓ 已对照':'＋ 套组对照'}</button></div></article>`;
}
function syncUrl(){
 const url=new URL(location.href);
 const p={view:state.view==='heroes'?'':state.view,game:state.game==='all'?'':state.game,q:state.query,category:state.category==='设计'?'':state.category,
 mechanic:state.mechanic==='all'?'':state.mechanic,mode:state.mode==='all'?'':state.mode,compareHeroes:state.compareEntities.join(','),compareSkills:state.compareRecords.join(',')};
 for(const [key,value] of Object.entries(p))value?url.searchParams.set(key,value):url.searchParams.delete(key);
 url.searchParams.delete('item');url.searchParams.delete('hero');
 history.replaceState(null,'',url);
}
function controls(){
 $('#games').innerHTML=`<button class="game ${state.game==='all'?'active':''}" data-game="all"><em>ALL</em>全部游戏<small>11</small></button>`+data.games.map(g=>`<button class="game ${state.game===g.id?'active':''}" data-game="${g.id}"><em>${esc(g.badge)}</em>${esc(g.name)}<small>${g.entities?g.entities+' 组':g.records?'状态':'待映射'}</small></button>`).join('');
 for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.view===state.view);
 const t=titles[state.view];$('#viewTitle').textContent=t[0];$('#headline').innerHTML=t[1];$('#subtitle').textContent=t[2];
 for(const v of views)$('#'+v+'View').hidden=v!==state.view;
 $('#browseToolbar').hidden=!['heroes','skills'].includes(state.view);$('#loadMoreWrap').hidden=!['heroes','skills'].includes(state.view);
 $('#mode').parentElement.hidden=state.view==='heroes';
 $('#categoryTabs').innerHTML=state.view==='heroes'?'<button class="active">英雄 / 职业 / 共享体系</button>':['设计',...categories,'all'].map(c=>`<button class="${state.category===c?'active':''}" data-category="${c}">${c==='设计'?'设计条目':c==='all'?'全部':c}</button>`).join('');
 $('#mechanic').value=state.mechanic;$('#mode').value=state.mode;$('#query').value=state.query;$('#clearQuery').hidden=!state.query;
 const g=index.games.get(state.game);$('#scopeNotice').hidden=!g;$('#scopeNotice').textContent=g?g.limitation:'';
 $('#boardBadge').textContent=board.ids.length;$('#compareBadge').textContent=state.compareEntities.length+state.compareRecords.length;
}
function render(){
 controls();
 if(state.view==='heroes'){
  let found=data.entities.filter(e=>entityMatches(e,state));
  found.sort((a,b)=>{
   const ai=featured.indexOf(a.id),bi=featured.indexOf(b.id);
   return (ai<0?999:ai)-(bi<0?999:bi)||data.games.findIndex(g=>g.id===a.game)-data.games.findIndex(g=>g.id===b.game)||a.name.localeCompare(b.name,'zh-CN');
  });
  $('#entityGrid').innerHTML=found.slice(0,state.limit).map(entityCard).join('');$('#heroEmpty').hidden=!!found.length;
  $('#heroEmptyText').textContent=index.games.get(state.game)?.limitation||'试试英雄或职业名称；技能名称可以在“技能 / 天赋”中搜索。';
  $('#resultCount').textContent=fmt(found.length)+' 组英雄 / 职业 / 共享体系';$('#resultHint').textContent=state.query?'关键词：'+state.query:'看定位、看组合、看成长';renderLoad(found.length);
 }else if(state.view==='skills'){
  const found=data.records.filter(r=>recordMatches(r,state));$('#skillsGrid').innerHTML=found.slice(0,state.limit).map(r=>card(r)).join('');$('#skillEmpty').hidden=!!found.length;
  $('#skillEmptyText').textContent=index.games.get(state.game)?.limitation||'可清除筛选；英文原文暂未全部翻译，中文机制可通过标签检索。';
  $('#resultCount').textContent=fmt(found.length)+' 条设计参考';$('#resultHint').textContent=state.query?'关键词：'+state.query:'从机制找到不同游戏的表达';renderLoad(found.length);
 }else if(state.view==='board')renderBoard();else if(state.view==='compare')renderCompare();else if(state.view==='coverage')renderCoverage();
 syncUrl();
}
function renderLoad(n){$('#loadMore').hidden=state.limit>=n;$('#loadedCount').textContent=n?`已显示 ${Math.min(state.limit,n)} / ${fmt(n)}`:'';}
function setView(v){if(!views.includes(v))return;state.view=v;state.limit=24;for(const id of ['kit','detail'])if($('#'+id).open)$('#'+id).close();render();window.scrollTo({top:0,behavior:'instant'});}
function reset(){Object.assign(state,{query:'',game:'all',category:'设计',mechanic:'all',mode:'all',limit:24});render();}
function toggleSave(id){if(!index.records.has(id))return;if(saved(id))board.ids=board.ids.filter(x=>x!==id);else board.ids.push(id);persist();render();if(selected?.id===id)updateDetailButtons();if(kitState)renderKit();}
function compare(id,type){
 const list=type==='entities'?state.compareEntities:state.compareRecords;const max=type==='entities'?3:4;
 const at=list.indexOf(id);if(at>=0)list.splice(at,1);else if(list.length<max)list.push(id);else{toast(`最多对照 ${max} ${type==='entities'?'套角色设计':'个技能条目'}，请先移除一项。`);return;}
 state.compareKind=type;render();if(selected)updateDetailButtons();if(kitState)renderKit();
 toast(at>=0?'已移出对照':'已加入对照，可在“设计对照”中并排查看');
}
function updateDetailButtons(){
 if(!selected)return;
 const save=$('#detailSave'),compare=$('#detailCompare');
 if(save){save.textContent=saved(selected.id)?'✓ 已收藏':'＋ 收藏参考';save.setAttribute('aria-pressed',saved(selected.id));}
 if(compare){compare.textContent=state.compareRecords.includes(selected.id)?'✓ 已在对照':'⇄ 加入技能对照';compare.setAttribute('aria-pressed',state.compareRecords.includes(selected.id));}
}
function detail(id){
 const r=index.records.get(id);if(!r)return;selected=r;
 const g=index.games.get(r.game);
 const rel=[...new Set([...r.relations,...r.relatedTo])].map(id=>index.records.get(id)).filter(Boolean);
 $('#detailContent').innerHTML=`<header class="detail-header"><div class="card-eyebrow">${esc(g.name)} / ${esc(r.category)}${r.mode?' / '+modeName(r.mode):''}${r.tier?' / '+r.tier+'级天赋':''}</div><div class="detail-header-top">${imageMarkup(r)}<div><h2 id="detailTitle">${esc(r.name)}</h2><div class="detail-en">${esc(r.en)}<br>${esc(ownersText(r))}</div></div></div></header><div class="detail-body"><span class="detail-section-label">资料依据 · ${esc(r.descriptionBasis)}</span><div class="detail-text${r.description?'':' incomplete'}">${esc(r.description||'尚未采集设计说明。本条仅供图标参考，请访问来源页核实技能机制。')}</div><div class="metrics">${Object.entries(r.metrics).map(([k,v])=>`<div class="metric"><small>${esc(k)}</small>${esc(v)}</div>`).join('')}${!Object.keys(r.metrics).length?'<span class="notice-small">结构化冷却、消耗、射程：未采集或来源未声明。</span>':''}</div>${r.details.length?`<details class="detail-block"><summary>补充说明 / 来源事实</summary>${r.details.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:''}${r.upgrades.length?`<div class="detail-block"><h3>升级变化</h3>${r.upgrades.map(x=>`<p><b>${esc(x.label)}</b><br>${esc(x.text)}</p>`).join('')}</div>`:''}${r.tags.length?`<details class="detail-block"><summary>机制辅助归纳 · 查看证据</summary><p>以下标签根据原文关键词生成；可能包含否定、条件或升级效果，需结合全文判断。</p><ul class="evidence-list">${r.tagEvidence.map(x=>`<li><b>${esc(x.tag)}</b>：“${esc(x.excerpt)}”</li>`).join('')}</ul></details>`:''}${rel.length?`<div class="detail-block"><h3>来源明确关联 · ${rel.length} 条</h3><div class="relation-list">${rel.slice(0,30).map(x=>`<button data-detail="${esc(x.id)}">${esc(x.name)} ↗</button>`).join('')}</div>${rel.length>30?'<p>更多关联可在对应套组中查阅。</p>':''}<p>包括技能链、天赋强化或推荐辅助；关系含义依各游戏来源字段而定。</p></div>`:''}<label class="detail-note-label">参考意图 · 随参考板一起保存<textarea id="detailNote" maxlength="4000" placeholder="想参考哪一环？如何调整为自己的设计？">${esc(board.notes[r.id]||'')}</textarea></label><div class="detail-actions"><button class="btn primary" id="detailSave" data-save="${esc(r.id)}"></button><button class="btn" id="detailCompare" data-compare-record="${esc(r.id)}"></button>${sourceLink(r.source,'查看来源 ↗','btn')}<button class="btn" id="copyReference">复制引用</button></div><div class="detail-actions">${r.owners.map(id=>`<button class="textbtn" data-kit="${esc(id)}">查看${esc(index.entities.get(id)?.name)}套组 ↗</button>`).join('')}${r.atlasId?`<a class="textbtn" href="../?q=${encodeURIComponent(source_itemsName(r))}&game=${esc(r.game)}" target="_blank" rel="noopener noreferrer">图标参考库 ↗</a>`:''}</div><div class="detail-block source-footnote"><b>${esc(r.version)} · 来源快照 ${esc(r.snapshot)}</b><br>${esc(g.limitation)}<br>${esc(r.note)}<br>${sourceLink(r.dataSource,'原始数据依据 ↗')}<br><span class="source-id">${esc(r.sourceKey)}</span>${r.visualVariants?`<br>已合并 ${r.visualVariants.length} 种节点图像状态；不增加技能数。`:''}</div></div>`;
 updateDetailButtons();
 $('#detailNote').addEventListener('input',event=>{board.notes[r.id]=event.target.value;persist();});
 $('#copyReference').onclick=async()=>{try{await navigator.clipboard.writeText(reference(r,index,board.notes[r.id]));toast('已复制带版本与来源的引用');}catch{toast('剪贴板不可用，可通过原型参考板导出。');}};
 if(!$('#detail').open)$('#detail').showModal();$('#detail').scrollTop=0;
}
function source_itemsName(r){return r.name;}
function openKit(id){if(!index.entities.has(id))return;if($('#detail').open)$('#detail').close();kitState={id,category:'技能',mode:'all'};const e=index.entities.get(id);if(!e.counts['技能'])kitState.category=['辅助','专精','职业机制'].find(k=>e.counts[k])||'all';renderKit();if(!$('#kit').open)$('#kit').showModal();$('#kit').scrollTop=0;}
function renderKit(){
 const e=index.entities.get(kitState.id);if(!e)return;const oldScroll=$('#kit').scrollTop;
 const all=e.recordIds.map(id=>index.records.get(id));const cats=categories.filter(k=>e.counts[k]);
 const rows=all.filter(r=>(kitState.category==='all'||r.category===kitState.category)&&(kitState.mode==='all'||r.mode===kitState.mode));
 let markup='';
 if(kitState.category==='天赋'&&rows.some(r=>r.tier)){
  for(const tier of [...new Set(rows.map(r=>r.tier||0))].sort((a,b)=>a-b))markup+=`<h3 class="tier-heading">${tier?tier+' 级 · 同层选择':'未声明层级'}</h3><div class="skills-grid">${rows.filter(r=>(r.tier||0)===tier).map(r=>card(r)).join('')}</div>`;
 }else markup=`<div class="skills-grid">${rows.map(r=>card(r)).join('')}</div>`;
 $('#kitContent').innerHTML=`<header class="kit-header"><div class="card-eyebrow">${esc(gameName(e.game))} / ${esc(e.type)} / ${esc(e.snapshot)}</div><h2 id="kitTitle">${esc(e.name)}</h2><div class="detail-en">${esc(e.en)}${e.title?' · '+esc(e.title):''}</div><div class="kit-summary">${esc(e.summary)}</div><div class="badges">${e.roles.filter(Boolean).map(x=>`<span class="badge role">${esc(x)}</span>`).join('')}${tagsMarkup(e.tags)}</div><div class="kit-facts"><span>核心资源：${esc(e.resource||'未采集 / 未声明')}</span><span>${e.recordIds.length} 条来源记录</span><button class="textbtn" data-compare-entity="${esc(e.id)}">${state.compareEntities.includes(e.id)?'✓ 已加入套组对照':'＋ 加入套组对照'}</button>${sourceLink(e.source,'原始来源 ↗')}</div></header><div class="kit-body"><div class="kit-toolbar"><div class="tabs"><button data-kit-category="all" class="${kitState.category==='all'?'active':''}">全部</button>${cats.map(k=>`<button data-kit-category="${k}" class="${kitState.category===k?'active':''}">${k} ${e.counts[k]}</button>`).join('')}</div>${all.some(r=>r.mode)?`<select id="kitMode" aria-label="套组模式"><option value="all">全部模式</option><option value="pve">PvE</option><option value="pvp">PvP</option><option value="standard">常规模式</option><option value="stadium">Stadium</option></select>`:''}</div>${markup}${!rows.length?'<p class="notice-small">此分类与模式下没有记录。</p>':''}${e.sharedEntityIds?.length?`<div class="detail-block"><h3>共享技能体系</h3><div class="relation-list">${e.sharedEntityIds.map(id=>`<button data-kit="${esc(id)}">${esc(index.entities.get(id).name)} ↗</button>`).join('')}</div></div>`:''}${e.specializationSummary?`<div class="detail-block"><h3>专精方向 · 来源原文</h3><p>${esc(e.specializationSummary)}</p></div>`:''}${e.tips?.length?`<details class="detail-block"><summary>操作提示与反制 · 官方原文</summary><h3>使用提示</h3>${e.tips.map(t=>`<p>${esc(t)}</p>`).join('')}<h3>应对提示</h3>${(e.counterplay||[]).map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}<div class="kit-tip">${esc(index.games.get(e.game).limitation)}<br>机制标签来自文本规则，不代表所有标签都是该角色的核心定位。</div></div>`;
 if($('#kitMode')){$('#kitMode').value=kitState.mode;$('#kitMode').onchange=event=>{kitState.mode=event.target.value;renderKit();};}
 $('#kit').scrollTop=oldScroll;
}
function renderBoard(){
 $('#boardGrid').innerHTML=board.ids.map(id=>index.records.get(id)).filter(Boolean).map(r=>card(r,true)).join('');$('#boardEmpty').hidden=!!board.ids.length;
 $('#boardCount').textContent=board.ids.length+' 条原型参考';
 for(const el of document.querySelectorAll('[data-prototype]'))if(document.activeElement!==el)el.value=board.prototype[el.dataset.prototype]||'';
 $('#saveStatus').textContent=storageWorks?'草稿仅在当前浏览器':'浏览器存储不可用，请导出备份';
}
function renderCompare(){
 for(const el of document.querySelectorAll('[data-compare-kind]'))el.classList.toggle('active',el.dataset.compareKind===state.compareKind);
 const entities=state.compareKind==='entities';const ids=entities?state.compareEntities:state.compareRecords;
 if(!ids.length){$('#compareContent').innerHTML=`<div class="empty"><span>⇄</span><h2>${entities?'挑选两套设计，寻找它们的取舍':'挑选几个技能，看看机制怎样组合'}</h2><p>${entities?'在英雄卡片中点击“套组对照”，或切换到技能条目对照。':'在技能卡片或详情中点击“对照”，最多同时查看 4 条。'}</p><button class="btn primary" data-view="${entities?'heroes':'skills'}">去添加参考 ↗</button></div>`;return;}
 const rows=ids.map(id=>(entities?index.entities:index.records).get(id));
 const columns=entities?[
  ['定位',e=>esc(e.roles.join(' / ')||'未采集')],['核心资源',e=>esc(e.resource||'未采集')],
  ['角色概念',e=>esc(e.summary||'未采集')],['机制归纳',e=>tagsMarkup(e.tags)],
  ['套组条目',e=>e.recordIds.map(id=>index.records.get(id)).filter(r=>r.category!=='状态').slice(0,16).map(r=>`<button class="skill-link" data-detail="${esc(r.id)}">${esc(r.slot||'')} ${esc(r.name)} ↗</button>`).join('')+`<button class="textbtn" data-kit="${esc(e.id)}">打开完整套组 (${e.recordIds.length}) ↗</button>`],
  ['成长选择',e=>esc(countText(e.counts))],
  ['来源与边界',e=>`${sourceLink(e.source,'查看来源 ↗')}<p class="snapshot">${esc(e.snapshot)}<br>${esc(index.games.get(e.game).limitation)}</p>`],
 ]:[['类别 / 所属',r=>esc(r.category+' / '+ownersText(r)+(r.tier?' / '+r.tier+'级天赋':''))],
 ['机制原文',r=>`<div class="compare-description">${esc(r.description||'尚未采集')}</div>`],
 ['机制归纳',r=>tagsMarkup(r.tags)],...['冷却','消耗','射程','持续'].map(label=>[label,r=>esc(r.metrics[label]||'未采集 / 源未声明')]),
 ['全部来源参数',r=>Object.entries(r.metrics).map(([k,v])=>`${esc(k)}：${esc(v)}`).join('<br>')||'未采集'],
 ['备注',r=>esc(board.notes[r.id]||'尚未记录参考意图')],
 ['来源与边界',r=>`${sourceLink(r.source,'查看来源 ↗')}<p class="snapshot">${esc(r.version)} · ${esc(r.snapshot)}<br>${esc(index.games.get(r.game).limitation)}</p>`]];
 $('#compareContent').innerHTML=`<div class="table-scroll"><table class="compare-table"><thead><tr><th>${entities?'设计维度':'机制维度'}</th>${rows.map(r=>`<th><button class="remove" aria-label="移除${esc(r.name)}" data-${entities?'compare-entity':'compare-record'}="${esc(r.id)}">×</button><span class="snapshot">${esc(gameName(r.game))}</span><h3>${esc(r.name)}</h3><button class="textbtn" data-${entities?'kit':'detail'}="${esc(r.id)}">查看详情 ↗</button></th>`).join('')}</tr></thead><tbody>${columns.map(([label,render])=>`<tr><th>${label}</th>${rows.map(r=>`<td>${render(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="notice-small">原文中的条件、等级、强化与模式会改变效果；数值不能脱离各自游戏语境直接比较。</p>`;
}
function renderCoverage(){
 const design=data.records.filter(r=>r.category!=='状态'&&r.hasDesign).length;
 $('#coverageSummary').textContent=`11 款已有游戏 · ${fmt(data.entities.filter(e=>e.type!=='共享体系'&&!e.referenceOnly).length)} 组有设计资料的英雄 / 职业 · ${fmt(design)} 条有说明的设计记录 · ${fmt(data.records.filter(r=>r.category==='状态').length)} 条状态参考`;
 $('#coverageGrid').innerHTML=data.games.map(g=>`<article class="coverage-card"><h3>${esc(g.name)}<small>${esc(g.version)}</small></h3><p class="coverage-scope">${esc(g.scope)}</p><dl><div><dt>英雄 / 职业 / 体系资料组</dt><dd>${g.entities}</dd></div><div><dt>设计条目（不含状态）</dt><dd>${fmt(g.records-(g.counts['状态']||0))}</dd></div><div><dt>状态参考</dt><dd>${fmt(g.counts['状态']||0)}</dd></div><div><dt>有原文说明的记录（含状态）</dt><dd>${fmt(g.designRecords)}</dd></div><div><dt>来源快照</dt><dd>${esc(g.snapshot)}</dd></div></dl><p>${esc(g.limitation)}</p><div class="button-row"><button class="btn" data-browse-game="${g.id}">${g.entities?'查阅套组':'查阅已收录资料'} ↗</button><a class="btn" href="../?game=${g.id}">图标库 ↗</a>${sourceLink(g.source,'公开来源 ↗','textbtn')}</div></article>`).join('');
 $('#limitations').innerHTML=data.limitations.map(s=>`<li>${esc(s)}</li>`).join('');
}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function wire(){
 document.addEventListener('click',event=>{
  const el=event.target.closest('button,a');if(!el)return;const d=el.dataset;
  if(d.view){event.preventDefault();setView(d.view);}
  else if(d.game){state.game=d.game;state.limit=24;if(!['heroes','skills'].includes(state.view))state.view='heroes';render();}
  else if(d.browseGame){Object.assign(state,{query:'',game:d.browseGame,mechanic:'all',mode:'all',category:'all',view:index.games.get(d.browseGame).entities?'heroes':'skills',limit:24});render();window.scrollTo({top:0});}
  else if(d.detail)detail(d.detail);
  else if(d.kit)openKit(d.kit);
  else if(d.save)toggleSave(d.save);
  else if(d.compareEntity)compare(d.compareEntity,'entities');
  else if(d.compareRecord)compare(d.compareRecord,'records');
  else if(d.compareKind){state.compareKind=d.compareKind;renderCompare();}
  else if(d.mechanic){Object.assign(state,{mechanic:d.mechanic,query:'',category:'设计',mode:'all',view:'skills',limit:24});render();}
  else if(d.category){state.category=d.category;state.limit=24;render();}
  else if(d.kitCategory){kitState.category=d.kitCategory;renderKit();}
  else if(d.close)$('#'+d.close).close();
  else if('clear' in d)reset();
 });
 $('#searchForm').onsubmit=event=>{event.preventDefault();state.query=$('#query').value.trim();state.limit=24;render();};
 $('#clearQuery').onclick=()=>{state.query='';render();$('#query').focus();};
 $('#resetFilters').onclick=reset;$('#clearGame').onclick=()=>{state.game='all';render();};
 for(const id of ['mechanic','mode'])$('#'+id).onchange=event=>{state[id]=event.target.value;state.limit=24;render();};
 $('#loadMore').onclick=()=>{state.limit+=state.view==='heroes'?24:36;render();};
 $('#clearCompare').onclick=()=>{state.compareEntities=[];state.compareRecords=[];render();};
 for(const el of document.querySelectorAll('[data-prototype]'))el.addEventListener('input',()=>{board.prototype[el.dataset.prototype]=el.value;persist();});
 $('#exportJson').onclick=()=>download('GameDesign-原型参考.json',JSON.stringify(backup(board,index),null,2),'application/json');
 $('#exportMd').onclick=()=>download('GameDesign-原型参考.md',markdown(board,index),'text/markdown;charset=utf-8');
 $('#importButton').onclick=()=>$('#importFile').click();
 $('#importFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>20*1024*1024)throw new Error('备份超过20MB，请检查文件');const incoming=JSON.parse(await file.text());const imported=normalizeBoard(incoming,index.records);board=mergeBoards(board,imported,index.records);persist();render();toast(`已合并 ${imported.ids.length} 条有效参考，现有收藏保留。`);}catch(error){toast('导入失败：'+error.message);}finally{event.target.value='';}
 };
 document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#kit').open&&!$('#detail').open&&['heroes','skills'].includes(state.view)){event.preventDefault();$('#query').focus();}});
 document.addEventListener('error',event=>{if(event.target.tagName==='IMG'){event.target.classList.add('image-failed');event.target.alt='图像加载失败，请查看来源';}},true);
 $('#kit').addEventListener('close',()=>{kitState=null;});
 $('#detail').addEventListener('close',()=>{selected=null;if(state.view==='board')renderBoard();});
}
try{
 const response=await fetch('./data.json');if(!response.ok)throw new Error('HTTP '+response.status);data=await response.json();index=createIndex(data);
 const validGames=new Set(['all',...data.games.map(g=>g.id)]);if(!validGames.has(state.game))state.game='all';
 if(!['设计',...categories,'all'].includes(state.category))state.category='设计';
 if(!['all',...data.mechanisms].includes(state.mechanic))state.mechanic='all';if(!['all','pve','pvp','standard','stadium'].includes(state.mode))state.mode='all';
 state.compareEntities=[...new Set(state.compareEntities)].filter(id=>index.entities.has(id));state.compareRecords=[...new Set(state.compareRecords)].filter(id=>index.records.has(id));
 if(state.compareRecords.length&&!state.compareEntities.length)state.compareKind='records';
 for(const e of data.entities)e.allTags=[...new Set(e.recordIds.flatMap(id=>index.records.get(id).tags))];
 const paramsItem=params.get('item'),paramsHero=params.get('hero');
 try{const stored=localStorage.getItem(STORAGE_KEY);if(stored)board=normalizeBoard(JSON.parse(stored),index.records);}catch{toast('本地参考板未能读取，当前未覆盖原有存储。请先检查或导出已有备份。');storageWorks=false;}
 $('#mechanic').innerHTML='<option value="all">全部机制</option>'+data.mechanisms.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
 const designEntities=data.entities.filter(e=>e.type!=='共享体系'&&!e.referenceOnly).length;
 const designRecords=data.records.filter(r=>r.category!=='状态').length;
 $('#stats').innerHTML=[[11,'款游戏来源'],[designEntities,'组英雄 / 职业设计'],[designRecords,'条技能与成长记录'],[data.records.filter(r=>r.category==='状态').length,'条状态机制参考']].map(([n,label])=>`<div class="stat"><strong>${fmt(n)}</strong><span>${label}</span></div>`).join('');
 $('#snapshot').textContent=data.generated.replaceAll('-','.');$('#entityBadge').textContent=data.entities.length;$('#skillBadge').textContent=fmt(designRecords);
 wire();$('#loadStatus').hidden=true;$('#appContent').hidden=false;render();
 if(paramsHero&&index.entities.has(paramsHero))openKit(paramsHero);
 if(paramsItem&&index.records.has(paramsItem))detail(paramsItem);
 else if(paramsItem)toast('这条图标暂无独立设计资料，可在“收录与来源”查看范围。');
}catch(error){$('#loadStatus').classList.add('error');$('#loadStatus').textContent='设计资料加载失败：'+error.message+'。请刷新重试；本地预览需要通过 HTTP 打开。';console.error(error);}
