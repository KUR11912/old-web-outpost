import { collectedPickupEntries, getPickupContent } from './pickup-data';
import { hasCollectionBackup, repairCollection, restoreCollection, type CollectionRepairPlan } from './collection-repair';
import type { SaveData } from './save';

interface Action { text:string; id?:string; action:()=>void }
interface Hooks {
  save:SaveData;
  open:(title:string,body:string,actions:Action[],kind:string)=>void;
  back:()=>void;
  refresh:()=>void;
}
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function showCollectionRepair(hooks:Hooks) {
  const owned=collectedPickupEntries(hooks.save.pickupInventory);
  const rows=owned.map(pickup=>`<label class="collection-repair-row"><span>${escape(getPickupContent(pickup).name)}</span><select data-repair-pickup="${escape(pickup.id)}" aria-label="${escape(getPickupContent(pickup).name)}的收藏处理"><option value="keep">保留现状</option><option value="remove">没捡过，放回地图</option><option value="lock">已捡过，资料改为尚未查询</option></select></label>`).join('');
  const actions:Action[]=[{text:'返回',id:'repair-back',action:hooks.back}];
  if(owned.length)actions.push({text:'应用修正',id:'apply-collection-repair',action:()=>{
    const plan:CollectionRepairPlan={removePickupIds:[],lockMemeIds:[]};
    document.querySelectorAll<HTMLSelectElement>('[data-repair-pickup]').forEach(select=>{
      const pickup=owned.find(item=>item.id===select.dataset.repairPickup);
      if(!pickup)return;
      if(select.value==='remove')plan.removePickupIds.push(pickup.id);
      if(select.value==='lock'&&pickup.memeId)plan.lockMemeIds.push(pickup.memeId);
    });
    if(!plan.removePickupIds.length&&!plan.lockMemeIds.length){document.getElementById('repair-feedback')!.textContent='请选择需要修正的收藏。';return;}
    if(!repairCollection(hooks.save,plan)){document.getElementById('repair-feedback')!.textContent='修正未保存，原有收藏保持不变。';return;}
    hooks.refresh();
    hooks.open('收藏记录已修正',`<p>已将 ${plan.removePickupIds.length} 件收藏放回地图，${plan.lockMemeIds.length} 件收藏的资料改为尚未查询。</p><p>重新靠近文件夹才能收入背包，之后需到旧终端查询资料。</p><p class="note">位置、音量和其他进度已保留。可以撤销本次修正。</p>`,[{text:'返回进度设置',id:'repair-done',action:hooks.back},{text:'撤销本次修正',id:'undo-collection-repair',action:()=>undo(hooks)}],'collection-repair-done');
  }});
  if(hasCollectionBackup())actions.push({text:'恢复修正前的收藏',id:'restore-collection-backup',action:()=>undo(hooks)});
  hooks.open('修正旧收藏记录',`<p>如果旧版本把没有捡过的梗放进了背包，可以将它放回地图。已经捡到、但没有查询过的梗，可以只重新锁定资料。</p><div class="collection-repair-list">${rows||'<p>背包为空，所有梗都需要在地图中拾取。</p>'}</div><p class="note">只修改你选择的条目，并保留一份可恢复的收藏备份。</p><p id="repair-feedback" role="status"></p>`,actions,'collection-repair');
}

function undo(hooks:Hooks) {
  if(restoreCollection(hooks.save)){
    hooks.refresh();
    hooks.open('已恢复收藏记录','<p>已恢复修正前的收藏与查询记录，也保留了修正之后新获得的收藏和资料。当前位置保持不变。</p>',[{text:'返回进度设置',id:'repair-done',action:hooks.back}],'collection-repair-restored');
  }else hooks.open('收藏记录未恢复','<p>备份无法读取或保存失败，现有收藏保持不变。</p>',[{text:'返回',action:hooks.back}],'collection-repair-error');
}
