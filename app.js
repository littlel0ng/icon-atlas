const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const games = {dota:{name:'Dota 2',badge:'D2'},lol:{name:'英雄联盟',badge:'LoL'},ow:{name:'守望先锋',badge:'OW'},gw2:{name:'激战 2',badge:'GW2'}};
const kinds = ['技能','被动','技能变体','全部状态','增益 Buff','减益 Debuff','状态（未分类）','状态纹理资源'];
const tagList = ['冰霜','火焰','雷电','护盾','治疗','吸血','控制','加速','减速','毒素','流血','暗影','位移','光环','召唤','强化','隐身','净化','无敌','爆发','范围','弹道','物理','魔法','眩晕'];
const aliases = {'冰冻':'冰霜','寒冰':'冰霜','冻结':'冰霜','frost':'冰霜','freeze':'冰霜','fire':'火焰','灼烧':'火焰','燃烧':'火焰','shield':'护盾','屏障':'护盾','heal':'治疗','回血':'治疗','恢复':'治疗','lifesteal':'吸血','生命汲取':'吸血','毒':'毒素','poison':'毒素','stun':'控制','眩晕':'眩晕','减益':'减益 Debuff','debuff':'减益 Debuff','buff':'状态','增益':'增益 Buff','闪现':'位移','blink':'位移','隐形':'隐身','stealth':'隐身','流血':'流血','boomerang':'回旋镖','回力标':'回旋镖','dagger':'飞刀','匕首':'飞刀','shuriken':'飞刀','手里剑':'飞刀','sword':'剑','刀剑':'剑','ring':'环形','orb':'圆球','cone':'锥形','laser':'光束','bow':'弓箭'};
const state={view:'library',game:'all',kind:'all',tag:'all',element:'all',shape:'all',object:'all',hero:'all',availability:'available',query:'',limit:48,moreTags:false};
let data=[], meta={}, byId=new Map(), selected=null, storageWarning='', toastTimer;
const roleNames={declared:'来源声明纹理','shared-declared':'来源声明 · 共用纹理','declared-texture':'资源清单匹配纹理',related:'关联技能参考','related-item':'关联物品参考','asset-only':'目录纹理 · 未映射状态',unresolved:'未确认图像','official-generic':'官方先天技能通用标识'};
const format=n=>Number(n||0).toLocaleString('zh-CN');
let board={version:1,title:'我的技能图标参考单',ids:[],notes:{}};
try {const raw=localStorage.getItem('icon-atlas-board-v1');if(raw){const b=JSON.parse(raw);if(Array.isArray(b.ids))board={...board,...b,notes:b.notes&&typeof b.notes==='object'?b.notes:{}};}}catch{storageWarning='浏览器存储不可用，收藏仅在本次页面中保留，请及时导出备份。';}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function persist(){try{localStorage.setItem('icon-atlas-board-v1',JSON.stringify(board));}catch{toast('无法写入浏览器存储，请导出 JSON 保存参考板。');}}
function saved(id){return board.ids.includes(id);}
function toggle(id){if(!byId.has(id))return;board.ids=saved(id)?board.ids.filter(x=>x!==id):[...board.ids,id];persist();render();updateDetailSave();toast(saved(id)?'已加入参考板':'已从参考板移除');}
function queryTokens(q){return q.trim().toLowerCase().split(/[\s，,、+＋]+/).filter(Boolean).map(t=>aliases[t]||t);}
function matches(r){
 if(state.game!=='all'&&r.game!==state.game)return false;
 if(state.kind==='全部状态'?!r.isStatus:state.kind!=='all'&&r.kind!==state.kind)return false;
 if(state.tag!=='all'&&!r.tags.includes(state.tag))return false;
 for(const group of ['element','shape','object'])if(state[group]!=='all'&&!r.facets?.[group]?.includes(state[group]))return false;
 if(state.hero!=='all'&&state.hero!==r.game+'|'+(r.heroKey||r.heroEn))return false;
 if(state.availability==='available'&&!r.icon)return false;
 if(state.availability==='direct'&&(!r.icon||!['declared','shared-declared','declared-texture','asset-only'].includes(r.iconRole)))return false;
 if(state.availability==='related'&&(!r.icon||!['related','related-item'].includes(r.iconRole)))return false;
 if(state.availability==='missing'&&r.icon)return false;
 if(state.availability!=='all'&&r.scope==='legacy')return false;
 const hay=[r.name,r.en,r.hero,r.heroEn,...(r.heroAliases||[]),r.sourceKey,r.kind,r.style,games[r.game].name,...r.tags,r.isStatus?'buff debuff 状态 增益 减益':''].join(' ').toLowerCase();
 return queryTokens(state.query).every(t=>hay.includes(t.toLowerCase()));
}
function displayTags(r){return [...new Set([state.object,state.shape,state.element,state.tag,...r.tags].filter(t=>t&&t!=='all'&&(r.tags.includes(t))))].slice(0,3);}
function card(r){const related=['related','related-item'].includes(r.iconRole);return `<article class="card ${saved(r.id)?'saved':''}"><button class="card-visual ${r.icon?'':'no-image'}" data-detail="${esc(r.id)}" aria-label="查看${esc(r.name)}详情"><span class="gameflag">${esc(games[r.game].name.toUpperCase())}</span>${r.icon?`<img loading="lazy" src="${esc(r.icon)}" alt="${esc(r.name)}${related?'关联参考':'图标'}" class="${r.style==='彩绘'?'painted':''}"><span class="broken-label" hidden>图像暂时无法加载<br>可访问公开来源 ↗</span>`:'<span class="missing-symbol">?</span><span class="broken-label">已收录定义 · 待确认图像</span>'}</button><button class="save-btn ${saved(r.id)?'saved':''}" data-save="${esc(r.id)}" aria-label="${saved(r.id)?'移除':'收藏'}${esc(r.name)}" aria-pressed="${saved(r.id)}">${saved(r.id)?'✓':'+'}</button><div class="card-info"><button class="card-name" data-detail="${esc(r.id)}" title="${esc(r.name)}">${esc(r.name)}</button><div class="card-sub"><span>${esc(r.hero)}</span><i>·</i><span>${esc(r.kind)}</span></div><div class="card-labels">${displayTags(r).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="card-foot"><span class="${!r.icon?'role-missing':related?'role-related':''}">${!r.icon?'待补图':related?'关联参考':r.iconRole==='official-generic'?'先天通用标识':r.isStatus?'状态纹理':esc(r.style)}</span><a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(r.name)}公开来源">公开来源 ↗</a></div></div></article>`;}
function controls(){
 $('#games').innerHTML=`<button class="game ${state.game==='all'?'active':''}" data-game="all"><em>ALL</em>全部游戏<span class="gamecount">${data.length}</span></button>`+Object.entries(games).map(([id,g])=>`<button class="game ${state.game===id?'active':''}" data-game="${id}"><em>${g.badge}</em>${g.name}<span class="gamecount">${data.filter(r=>r.game===id).length}</span></button>`).join('');
 $('#kinds').innerHTML=['all',...kinds].map(k=>`<button class="kind ${state.kind===k?'active':''}" data-kind="${esc(k)}">${k==='all'?'全部类别':k}</button>`).join('');
 $('#tags').innerHTML=['all',...(state.moreTags?tagList:tagList.slice(0,8))].map(t=>`<button class="tag ${state.tag===t?'active':''}" data-tag="${t}" aria-pressed="${state.tag===t}">${t==='all'?'全部概念':t}</button>`).join('');
 $('#moreTags').textContent=state.moreTags?'收起标签 −':'更多标签 ＋';
 $('#boardBadge').textContent=board.ids.length;
 for(const group of ['element','shape','object']){
 const select=$('#'+group+'Filter'),info=meta.taxonomy?.[group];
 select.innerHTML='<option value="all">全部'+({'element':'元素','shape':'形状','object':'物件'}[group])+'</option>'+(info?.tags||[]).map(t=>`<option value="${esc(t)}">${esc(t)} (${data.filter(r=>r.facets?.[group]?.includes(t)&&r.icon&&r.scope!=='legacy'&&(state.game==='all'||r.game===state.game)).length})</option>`).join('');select.value=state[group];
 }
 const seen=new Map();for(const r of data){if(!r.heroKey||state.game!=='all'&&r.game!==state.game)continue;seen.set(r.game+'|'+r.heroKey,`${r.hero}${r.heroAliases?.[1]?' / '+r.heroAliases[1]:''} · ${games[r.game].name}`);}
 $('#heroFilter').innerHTML='<option value="all">全部英雄</option>'+[...seen].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN')).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('');$('#heroFilter').value=state.hero;
 $('#availabilityFilter').value=state.availability;
 $('#resetFilters').hidden=state.game==='all'&&state.kind==='all'&&state.tag==='all'&&['element','shape','object','hero'].every(k=>state[k]==='all')&&state.availability==='available'&&!state.query;
}
function render(){
 controls();
 const found=data.filter(matches), shown=found.slice(0,state.limit);
 $('#resultsCount').textContent=`${format(found.length)} 条${state.availability==='missing'?'待补图记录':'图标参考'}`;
 $('#filterSummary').textContent=state.query?`关键词：${state.query}`:'跨游戏发现不同的图标表达';
 $('#grid').innerHTML=shown.map(card).join('');$('#empty').hidden=!!found.length;
 $('#loadMore').hidden=shown.length>=found.length;$('#loadedCount').textContent=found.length?`已显示 ${shown.length} / ${found.length}`:'';
 const picked=board.ids.map(id=>byId.get(id)).filter(Boolean);
 $('#boardGrid').innerHTML=picked.map(card).join('');$('#boardEmpty').hidden=!!picked.length;
 $('#exportJson').disabled=!picked.length;$('#exportMd').disabled=!picked.length;
 $('#clearSearch').hidden=!state.query;
 const url=new URL(location.href);for(const [k,v] of Object.entries({q:state.query,game:state.game,kind:state.kind,tag:state.tag,element:state.element,shape:state.shape,object:state.object,hero:state.hero,images:state.availability==='available'?'':state.availability}))v&&(k==='images'||v!=='all')?url.searchParams.set(k,v):url.searchParams.delete(k);
 try{history.replaceState(null,'',url);}catch{}
}
function reset(){for(const k of ['game','kind','tag','element','shape','object','hero'])state[k]='all';state.availability='available';state.query='';state.limit=48;$('#search').value='';render();}
function setView(view){
 if(!['library','board','coverage','sources'].includes(view))return;state.view=view;
 for(const v of ['library','board','coverage','sources'])$('#'+v+'View').hidden=v!==view;
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
 const titles={coverage:['覆盖审计','看清图鉴的<span>完整与缺口。</span>','以当前官方英雄名单为基线，把来源可证实的覆盖率说清楚。'],library:['图标参考库','给技能一个<span>视觉起点。</span>','从一个概念出发，找到不同游戏的图标表达。'],board:['我的参考板','把灵感变成<span>一份参考。</span>','收集、备注，然后把设计意图交给团队。'],sources:['公开来源导航','去原始世界<span>寻找线索。</span>','技能、状态与视觉符号，都有可追溯的出处。']};
 const t=titles[view];$('#viewTitle').textContent=t[0];$('#headline').innerHTML=t[1];$('#subtitle').textContent=t[2];
 if(view==='sources'){$('#externalQuery').value=state.query;renderSources();}if(view==='coverage')renderCoverage();
 render();window.scrollTo({top:0,behavior:'instant'});
}
function updateDetailSave(){const b=$('#detailSave');if(b&&selected){b.textContent=saved(selected.id)?'✓ 已在参考板':'＋ 加入参考板';b.setAttribute('aria-pressed',saved(selected.id));}}
function detail(id){
 const r=byId.get(id);if(!r)return;selected=r;
 const related=['related','related-item'].includes(r.iconRole);
 const facetMarkup=['element','shape','object','mechanic'].map(g=>{const ts=r.facets?.[g]||[];return ts.length?`<div class="facet-detail-group"><span>${esc(meta.taxonomy?.[g]?.label||'机制效果')}</span><div class="tags">${ts.map(t=>`<button class="tag" data-detail-facet="${g}" data-facet-value="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`:'';}).join('');
 $('#detailContent').innerHTML=`<div class="detail-layout"><div class="detail-left"><div class="detail-image">${r.icon?`<img src="${esc(r.icon)}" alt="${esc(r.name)}${related?'关联参考':'原图'}"><span class="broken-label" hidden>图像暂时无法加载，请访问来源页。</span>`:'<span class="broken-label">已收录状态定义<br>公开资源中尚未确认可用图像</span>'}</div>${r.icon?`<div class="scale-strip">${[24,32,48].map(n=>`<div><img src="${esc(r.icon)}" alt="${n}像素预览" width="${n}" height="${n}"><span>${n} PX</span></div>`).join('')}</div><p>观察缩小后的轮廓与明暗层级</p>`:''}</div><div class="detail-right"><div class="detail-game">${esc(games[r.game].name)} / ${esc(r.style)}</div><h2>${esc(r.name)}</h2><p class="detail-en">${esc(r.en)}</p><div class="detail-meta">${esc(r.hero)} · ${esc(r.heroEn)}<br>图标类别：${esc(r.kind)}<br>来源：${esc(r.sourceLabel)}</div><div class="detail-status-role ${!r.icon?'missing':related?'related':''}">图像依据：${esc(r.icon?roleNames[r.iconRole]||'来源图像':'未补图 / 未确认映射')}</div>${facetMarkup}<p class="tag-basis">${esc(r.tagBasis||'标签用于参考检索')}</p><p class="detail-note">${esc(r.note)}</p>${r.description?`<details class="detail-description"><summary>查看来源描述摘录</summary><p>${esc(r.description)}</p></details>`:''}<label for="detailNote">参考备注 · 随收藏一起导出</label><textarea id="detailNote" maxlength="3000" placeholder="记录要参考的轮廓、构图或色彩…">${esc(board.notes[r.id]||'')}</textarea><div class="detail-actions"><button class="btn primary" id="detailSave" aria-pressed="${saved(r.id)}">＋ 加入参考板</button><a class="btn" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">来源页面 ↗</a></div><div class="detail-links">${r.icon?`<a href="${esc(r.icon)}" target="_blank" rel="noopener noreferrer">打开图像 ↗</a>`:''}<button class="textbtn" id="copyReference">复制参考信息</button></div><p class="definition-id">${esc(r.sourceKey||r.id)}</p></div></div>`;
 updateDetailSave();$('#detail').showModal();
 $('#detailNote').addEventListener('input',e=>{board.notes[r.id]=e.target.value;persist();});$('#detailSave').onclick=()=>toggle(r.id);
 $('#copyReference').onclick=async()=>{try{await navigator.clipboard.writeText(referenceText(r));toast('已复制参考信息、图像依据与来源');}catch{toast('剪贴板不可用，请导出 Markdown 参考单。');}};
}
function renderCoverage(){
 const c=meta.coverage;if(!c)return;$('#coverageTopline').textContent=`${format(data.length)} 条索引记录 · ${format(meta.verification?.verifiedUniqueImages)} 个通过校验的图像地址 · ${format(meta.verification?.missingRecords)} 条待补图记录`;
 $('#coverageSummary').innerHTML=['dota','lol'].map(g=>{const a=c[g],before=c.baseline[g],total=a.rosterTotal;return `<article class="audit-card"><h3>${games[g].name}<span>${esc(g==='lol'?meta.lolVersion:c.asOf)}</span></h3><div class="audit-stat"><strong>${a.heroesIndexed||0} / ${total}</strong><span>英雄已收录</span></div><div class="audit-progress"><i style="width:${100*(a.heroesIndexed||0)/total}%"></i></div><dl><div><dt>官方基础技能槽</dt><dd>${format(a.indexedSlots)} / ${format(a.expectedSlots)}</dd></div><div><dt>基础技能图像可用</dt><dd>${format(a.verifiedSkillIcons)} / ${format(a.expectedSlots)}</dd></div>${g==='dota'?`<div><dt>其中官方先天通用标识</dt><dd>${format(a.officialGenericIcons)}</dd></div>`:''}<div><dt>枚举状态定义</dt><dd>${format(a.statusDefinitions)}</dd></div><div><dt>状态定义含可用声明纹理</dt><dd>${format(a.statusDeclaredImages)}</dd></div><div><dt>状态使用关联参考图</dt><dd>${format(a.statusRelatedImages)}</dd></div>${g==='lol'?`<div><dt>额外状态目录纹理</dt><dd>${format(a.statusAssetImages)} / ${format(a.statusTextureAssets)}</dd></div>`:''}<div><dt>状态记录待补图</dt><dd>${format(a.statusMissingImages)}</dd></div></dl><div class="audit-before">首版：${before.heroes} 位英雄 · ${before.icons} 张技能图标 · ${before.statuses} 条状态</div><button class="btn" data-status-game="${g}">浏览此游戏全部状态记录 ↗</button><p class="audit-scope">${esc(a.statusScope)}</p></article>`;}).join('');
 $('#coverageLimits').textContent=c.limitations.join(' ');
 $('#coverageDetails').innerHTML=['dota','lol'].map(g=>`<details class="roster-details"><summary>${games[g].name} 全英雄清单 · ${c[g].rosterTotal} 位 / 基础技能逐槽核对</summary><div class="table-scroll"><table class="audit-table"><thead><tr><th>英雄</th><th>已索引 / 预期技能槽</th><th>可用图像</th><th>来源</th></tr></thead><tbody>${c[g].heroes.map(h=>`<tr><td>${esc(h.name)}${h.alias?' / '+esc(h.alias):''}<small>${esc(h.en)}</small></td><td>${h.indexedSlots} / ${h.expectedSlots}</td><td class="${h.verifiedIcons<h.expectedSlots?'missing-count':''}">${h.verifiedIcons} / ${h.expectedSlots}</td><td><a href="${esc(h.source)}" target="_blank" rel="noopener noreferrer">核对 ↗</a></td></tr>`).join('')}</tbody></table></div><div class="audit-note">英雄名单和技能槽已列入索引；缺图不会被静默删除。技能变体及历史条目另外统计。</div><button class="btn audit-show-missing" data-missing-game="${g}">查看此游戏待补图记录 ↗</button></details>`).join('')+`<div class="source-note"><h3>图像依据如何区分？</h3><p>“来源声明纹理”：数据字段给出的图像路径，或资源清单明确列出的纹理文件。“关联参考”：根据状态所属技能或物品提供的参考图，尚未确认实际状态栏是否使用。“目录纹理”：有图像文件，但具体状态归属未知。“待补图”：保留定义，不用猜测的图片填充。</p><p>标签目前以文本规则辅助整理。已加入回旋镖、飞刀、剑等指定检索标签；尚未完成所有图片的逐张视觉核验。审计日期：${esc(c.asOf)}。</p></div>`;
}
const sources=[
 {name:'Dota 2',badge:'D2',type:'全英雄技能 + 状态定义',domain:'dota2.com',url:'https://www.dota2.com/heroes',desc:'官方英雄名单与详情逐一采集，状态提示资源另行枚举。关联技能图与独立纹理分别标识。',term:'ability icon'},
 {name:'英雄联盟',badge:'LoL',type:'全英雄技能 + Buff 资源',domain:'leagueoflegends.com',url:'https://www.leagueoflegends.com/en-us/champions/',desc:'Data Dragon 全英雄基础技能，CommunityDragon 提供英雄、通用、装备和符文状态资源。',term:'ability'},
 {name:'守望先锋',badge:'OW',type:'已收录 · 单色技能图标',domain:'overwatch.blizzard.com',url:'https://overwatch.blizzard.com/en-us/heroes/',desc:'官方英雄页中的技能轮廓。适合参考剪影、线条与低尺寸识别度。',term:'abilities'},
 {name:'激战 2',badge:'GW2',type:'已收录 · 独立 Buff / Debuff',domain:'wiki.guildwars2.com',url:'https://wiki.guildwars2.com/wiki/Effect',desc:'增益与症状的独立图标。Wiki 采集时维护中，图库条目提供官方 API 数据出处。',term:'boon condition'},
 {name:'魔兽世界',badge:'WoW',type:'外部检索 · 法术数据库',domain:'wowhead.com',url:'https://www.wowhead.com/spells',desc:'Wowhead 法术数据库，继续寻找职业技能、光环和增益效果。',term:'spell icon'},
 {name:'流放之路',badge:'PoE',type:'外部检索 · 状态与光环',domain:'poewiki.net',url:'https://www.poewiki.net/wiki/Buff',desc:'PoE Wiki 的 Buff 与技能页面，适合查找诅咒、光环和持续效果。',term:'buff icon'}
];
function renderSources(){const q=$('#externalQuery').value.trim();$('#sourceGrid').innerHTML=sources.map(s=>{const en=queryTokens(q).map(t=>({'冰霜':'frost','护盾':'shield','火焰':'fire','治疗':'heal','吸血':'lifesteal','毒素':'poison','控制':'crowd control','加速':'haste','减速':'slow','暗影':'shadow','强化':'empower','位移':'blink','隐身':'stealth','光环':'aura','净化':'cleanse','召唤':'summon','流血':'bleed','无敌':'invulnerability','增益 Buff':'buff','减益 Debuff':'debuff','回旋镖':'boomerang','飞刀':'dagger','剑':'sword','环形':'ring','光束':'beam'}[t]||t)).join(' ');const search='https://www.bing.com/search?'+new URLSearchParams({q:`site:${s.domain} ${en||s.term} ${s.term}`});return `<article class="source-card"><div class="source-card-top"><span class="source-logo">${s.badge}</span><div><h3>${s.name}</h3><small>${s.type}</small></div></div><p>${s.desc}</p><div class="source-card-actions"><a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(search)}">${q?'检索这个概念':'查找技能图标'} ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="${s.url}">打开原站 ↗</a></div></article>`;}).join('');}
function referenceText(r){return `${r.name} / ${r.en}\n游戏：${games[r.game].name} · ${r.hero}\n类别：${r.kind} · ${r.tags.join(' / ')}\n图像：${r.icon||'未确认'}\n图像依据：${roleNames[r.iconRole]||'来源图像'}\n来源：${r.source}${board.notes[r.id]?'\n备注：'+board.notes[r.id]:''}`;}
function download(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(board.title||'技能图标参考单').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,90)+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('已生成下载文件');}
function markdown(){const safe=s=>String(s).replace(/[\\`*_[\]<>#]/g,'\\$&');const title=safe(board.title||'技能图标参考单');return `# ${title}\n\n索引采集：${meta.collected} · 图标版权归原权利方，仅用于设计参考。\n\n`+board.ids.map(id=>{const r=byId.get(id);return `## ${safe(r.name)} · ${safe(games[r.game].name)}\n\n${r.icon?`![${safe(r.name)}](${r.icon})`:'图像待补充'}\n\n- 英雄 / 状态：${safe(r.hero)}\n- 类别：${r.kind}\n- 参考标签：${r.tags.join('、')}\n- [公开来源](${r.source})${r.icon?` · [图像](${r.icon})`:''}\n- 图像依据：${roleNames[r.iconRole]||'来源图像'}\n- 图像说明：${r.note}\n${board.notes[id]?'- 设计备注：'+safe(board.notes[id]).replace(/\n/g,'\n  ')+'\n':''}\n`;}).join('');}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.save)toggle(b.dataset.save);else if(b.dataset.detail)detail(b.dataset.detail);else if(b.dataset.view)setView(b.dataset.view);else if(b.dataset.statusGame){reset();state.game=b.dataset.statusGame;state.kind='全部状态';state.availability='all';setView('library');}else if(b.dataset.missingGame){reset();state.game=b.dataset.missingGame;state.availability='missing';setView('library');}else if(b.dataset.game){state.game=b.dataset.game;state.hero='all';state.limit=48;setView('library');}else if(b.dataset.kind){state.kind=b.dataset.kind;state.limit=48;setView('library');}else if(b.dataset.tag){state.tag=b.dataset.tag;state.limit=48;render();}else if(b.dataset.query){state.query=b.dataset.query;$('#search').value=state.query;state.limit=48;render();}else if(b.dataset.detailFacet){$('#detail').close();const g=b.dataset.detailFacet;state[g==='mechanic'?'tag':g]=b.dataset.facetValue;state.moreTags=true;setView('library');}else if(b.dataset.detailTag){$('#detail').close();state.tag=b.dataset.detailTag;state.moreTags=true;setView('library');}});
document.addEventListener('error',e=>{if(e.target.tagName!=='IMG')return;const img=e.target;img.hidden=true;const fallback=img.parentElement.querySelector('.broken-label');if(fallback)fallback.hidden=false;},true);
$('#searchForm').onsubmit=e=>{e.preventDefault();state.query=$('#search').value;state.limit=48;render();};
$('#search').addEventListener('input',()=>{state.query=$('#search').value;state.limit=48;render();});
$('#clearSearch').onclick=()=>{state.query='';$('#search').value='';render();$('#search').focus();};
$('#resetFilters').onclick=reset;$('#emptyReset').onclick=reset;$('#resetGame').onclick=()=>{state.game='all';state.limit=48;render();};
for(const group of ['element','shape','object','hero'])$('#'+group+'Filter').onchange=e=>{state[group]=e.target.value;state.limit=48;render();};$('#availabilityFilter').onchange=e=>{state.availability=e.target.value;state.limit=48;render();};
$('#loadMore').onclick=()=>{state.limit+=48;render();};$('#moreTags').onclick=()=>{state.moreTags=!state.moreTags;controls();};
$('#background').onchange=e=>{document.body.classList.remove('bg-dark','bg-light','bg-checker');document.body.classList.add('bg-'+e.target.value);};$('#size').onchange=e=>document.body.classList.toggle('compact',e.target.value==='compact');
$('#searchOutside').onclick=()=>setView('sources');$('#externalQuery').oninput=renderSources;
$('#closeDetail').onclick=()=>$('#detail').close();$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#boardName').value=board.title;$('#boardName').oninput=e=>{board.title=e.target.value;persist();};
$('#exportJson').onclick=()=>download(JSON.stringify({...board,items:board.ids.map(id=>byId.get(id)),exportedAt:new Date().toISOString()},null,2),'application/json','json');
$('#exportMd').onclick=()=>download(markdown(),'text/markdown;charset=utf-8','md');
$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5e6)throw new Error('文件过大，请使用小于 5 MB 的参考板 JSON。');const b=JSON.parse(await f.text());if(b.version!==1||!Array.isArray(b.ids)||!b.ids.every(x=>typeof x==='string'))throw new Error('参考板格式不正确，请使用本工具导出的 JSON。');const ids=[...new Set(b.ids)].filter(id=>byId.has(id));const unknown=b.ids.length-ids.length;board.ids=[...new Set([...board.ids,...ids])];for(const id of ids)if(typeof b.notes?.[id]==='string')board.notes[id]=b.notes[id].slice(0,3000);if(typeof b.title==='string')board.title=b.title.slice(0,100);$('#boardName').value=board.title;persist();setView('board');toast(`已合并 ${ids.length} 个参考${unknown?'，跳过 '+unknown+' 个未收录或重复 ID':''}`);}catch(err){toast(err.message||'导入失败，请检查文件格式。');}e.target.value='';};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#detail').open){e.preventDefault();setView('library');$('#search').focus();}});
try{
 const res=await fetch('./data.json');if(!res.ok)throw new Error('HTTP '+res.status);meta=await res.json();data=meta.items;byId=new Map(data.map(r=>[r.id,r]));
 // 首屏优先展示跨游戏的不同表达；其余保持采集顺序。
 const featured=['dota-crystal_maiden_crystal_nova','lol-Ashe-4','ow-mei-blizzard','gw2-743','dota-abaddon_aphotic_shield','lol-Brand-1','ow-mercy-guardian-angel','gw2-736','dota-venomancer_poison_sting','lol-Vladimir-1','ow-zarya-graviton-surge','gw2-719'];
 const priority=r=>featured.includes(r.id)?featured.indexOf(r.id):r.scope==='legacy'?100000:r.isStatus?(['related','related-item'].includes(r.iconRole)?50000:40000):r.kind==='技能变体'?30000:20000;data.sort((a,b)=>priority(a)-priority(b));
 board.ids=[...new Set(board.ids)].filter(id=>byId.has(id));
 const params=new URL(location.href).searchParams;state.query=params.get('q')||'';if(games[params.get('game')])state.game=params.get('game');if(kinds.includes(params.get('kind')))state.kind=params.get('kind');if(tagList.includes(params.get('tag'))){state.tag=params.get('tag');state.moreTags=true;}for(const g of ['element','shape','object'])if(meta.taxonomy?.[g]?.tags.includes(params.get(g)))state[g]=params.get(g);if(params.get('hero')&&data.some(r=>r.game+'|'+(r.heroKey||r.heroEn)===params.get('hero')))state.hero=params.get('hero');if(['available','direct','related','missing','all'].includes(params.get('images')))state.availability=params.get('images');$('#search').value=state.query;
 $('#totalBadge').textContent=format(data.length);$('#heroCount').textContent=format(data.filter(r=>r.icon&&r.scope!=='legacy').length);
 $('#dataNote').innerHTML=`采集日期：${esc(meta.collected)}。共 ${format(data.length)} 条索引，含可用图像与待补图定义；Dota 2 ${meta.coverage?.dota?.rosterTotal||'—'} 位、LoL ${meta.coverage?.lol?.rosterTotal||'—'} 位英雄已逐槽核对。LoL ${esc(meta.lolVersion)} / CommunityDragon ${esc(meta.communityDragonVersion)}。Buff 完整性未证实，请查看覆盖审计。<a href="https://developer.riotgames.com/docs/lol" target="_blank" rel="noopener noreferrer">Riot Data Dragon</a> · <a href="https://communitydragon.org/docs/assets" target="_blank" rel="noopener noreferrer">CommunityDragon</a>`;
 render();renderSources();if(storageWarning)toast(storageWarning);
}catch(err){$('#resultsCount').textContent='图标索引加载失败';$('#grid').innerHTML=`<div class="empty"><h2>暂时无法读取图标数据</h2><p>请刷新页面，或通过 HTTP 服务打开本工具。</p><button class="btn" onclick="location.reload()">重新加载</button></div>`;toast('数据加载失败：'+err.message);}
