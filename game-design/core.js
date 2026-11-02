// 可独立验证的查询、导入与引用逻辑；浏览器和检查脚本使用同一实现。
export const STORAGE_KEY='game-design-board-v1';
export const PROTOTYPE_FIELDS={title:'原型名称',fantasy:'角色幻想与定位',resource:'核心资源',loop:'核心循环',decisions:'取舍与反制'};
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export const tokens=q=>String(q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
export function createIndex(data){
 const records=new Map(data.records.map(r=>[r.id,r]));
 const entities=new Map(data.entities.map(e=>[e.id,e]));
 const games=new Map(data.games.map(g=>[g.id,g]));
 for(const r of data.records)r.searchText=[r.name,r.en,r.description,r.sourceKey,games.get(r.game)?.name,...r.tags,...r.owners.flatMap(id=>{const e=entities.get(id);return e?[e.name,e.en,...e.aliases]:[];})].join(' ').toLocaleLowerCase();
 for(const e of data.entities)e.searchText=[e.name,e.en,e.title,e.summary,...e.roles,...e.tags,...e.aliases,games.get(e.game)?.name].join(' ').toLocaleLowerCase();
 return {records,entities,games};
}
export function recordMatches(r,filter={}){
 return (!filter.game||filter.game==='all'||r.game===filter.game)
 &&(!filter.category||filter.category==='all'||(filter.category==='设计'?r.category!=='状态':r.category===filter.category))
 &&(!filter.mechanic||filter.mechanic==='all'||r.tags.includes(filter.mechanic))
 &&(!filter.mode||filter.mode==='all'||r.mode===filter.mode)
 &&tokens(filter.query).every(t=>r.searchText.includes(t));
}
export function entityMatches(e,filter={}){
 return (!filter.game||filter.game==='all'||e.game===filter.game)
 &&(!filter.mechanic||filter.mechanic==='all'||e.tags.includes(filter.mechanic)||e.allTags?.includes(filter.mechanic))
 &&tokens(filter.query).every(t=>e.searchText.includes(t));
}
export function blankBoard(){return {version:1,ids:[],notes:{},prototype:Object.fromEntries(Object.keys(PROTOTYPE_FIELDS).map(k=>[k,'']))};}
export function normalizeBoard(value,recordMap){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!Array.isArray(value.ids))throw new Error('请选择设计图鉴导出的版本1 JSON参考板');
 const board=blankBoard();board.ids=[...new Set(value.ids.filter(id=>typeof id==='string'&&recordMap.has(id)))];
 const notes=value.notes&&typeof value.notes==='object'?value.notes:{};
 board.notes=Object.fromEntries(Object.keys(notes).filter(id=>recordMap.has(id)&&typeof notes[id]==='string').map(id=>[id,notes[id].slice(0,4000)]));
 const p=value.prototype&&typeof value.prototype==='object'?value.prototype:{};
 for(const k of Object.keys(PROTOTYPE_FIELDS))if(typeof p[k]==='string')board.prototype[k]=p[k].slice(0,k==='title'?120:4000);
 return board;
}
export function mergeBoards(current,incoming,records){
 const a=normalizeBoard(current,records),b=normalizeBoard(incoming,records);
 return {version:1,ids:[...new Set([...a.ids,...b.ids])],notes:{...a.notes,...b.notes},
 prototype:Object.fromEntries(Object.keys(PROTOTYPE_FIELDS).map(k=>[k,b.prototype[k]||a.prototype[k]]))};
}
export function reference(r,index,note=''){
 const game=index.games.get(r.game);
 return [`${r.name} · ${game.name} · ${r.category}`,`所属：${r.owners.map(id=>index.entities.get(id)?.name).filter(Boolean).join(' / ')||'通用状态'}`,
 `版本：${r.version}；来源快照：${r.snapshot}`,`说明（${r.descriptionBasis}）：${r.description||'尚未采集机制说明'}`,
 ...Object.entries(r.metrics).map(([k,v])=>`${k}：${v}`),
 ...(r.tier?[`天赋层级：${r.tier}`]:[]),
 ...(r.tags.length?[`辅助机制标签（文本规则）：${r.tags.join('、')}`]:[]),
 `来源：${r.source}`,`数据依据：${r.dataSource}`,`范围说明：${game.limitation}`,
 `条目说明：${r.note}`,note?`设计备注：${note}`:''].filter(Boolean).join('\n');
}
export function markdown(board,index){
 const safeMd=s=>String(s??'').replace(/([\\`*_[\]<>])/g,'\\$1');
 return [`# ${safeMd(board.prototype.title||'GameDesign 原型参考单')}`,
 ...Object.entries(PROTOTYPE_FIELDS).filter(([k])=>k!=='title').map(([k,label])=>`## ${label}\n\n${safeMd(board.prototype[k]||'待补充')}`),
 '## 设计参考\n\n原文属于各游戏权利人；机制标签为辅助归纳。各游戏单位独立，版本和覆盖边界随条目保留。',
 ...board.ids.map(id=>index.records.get(id)).filter(Boolean).map(r=>`### ${safeMd(r.name)}\n\n${reference(r,index,board.notes[r.id]).split('\n').map(safeMd).join('\n\n')}`)].join('\n\n');
}
export function backup(board,index){
 const result=normalizeBoard(board,index.records);
 return {...result,tool:'GameDesign',exportedAt:new Date().toISOString(),items:result.ids.map(id=>{
 const r=index.records.get(id);const {searchText,...record}=r;return {...record,gameName:index.games.get(r.game).name,sourceScope:index.games.get(r.game).limitation};})};
}
