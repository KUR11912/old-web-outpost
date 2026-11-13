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
  const rows=owned.map(pickup=>`<label class="collection-repair-row"><span>${escape(getPickupContent(pickup).name)}</span><select data-repair-pickup="${escape(pickup.id)}" aria-label="Collection action for ${escape(getPickupContent(pickup).name)}"><option value="keep">Keep as is</option><option value="remove">Not collected: return to map</option><option value="lock">Collected: reset archive to Not Researched</option></select></label>`).join('');
  const actions:Action[]=[{text:'Back',id:'repair-back',action:hooks.back}];
  if(owned.length)actions.push({text:'Apply Changes',id:'apply-collection-repair',action:()=>{
    const plan:CollectionRepairPlan={removePickupIds:[],lockMemeIds:[]};
    document.querySelectorAll<HTMLSelectElement>('[data-repair-pickup]').forEach(select=>{
      const pickup=owned.find(item=>item.id===select.dataset.repairPickup);
      if(!pickup)return;
      if(select.value==='remove')plan.removePickupIds.push(pickup.id);
      if(select.value==='lock'&&pickup.memeId)plan.lockMemeIds.push(pickup.memeId);
    });
    if(!plan.removePickupIds.length&&!plan.lockMemeIds.length){document.getElementById('repair-feedback')!.textContent='Choose the items you want to repair.';return;}
    if(!repairCollection(hooks.save,plan)){document.getElementById('repair-feedback')!.textContent='Changes could not be saved. Your collection is unchanged.';return;}
    hooks.refresh();
    hooks.open('Collection Repaired',`<p>Returned ${plan.removePickupIds.length} items to the map and reset ${plan.lockMemeIds.length} archives to Not Researched.</p><p>Walk up to the folders to collect them again, then research their names at the Old Terminal.</p><p class="note">Your position, volume, and other progress are preserved. You can undo these changes.</p>`,[{text:'Back to Progress Settings',id:'repair-done',action:hooks.back},{text:'Undo Changes',id:'undo-collection-repair',action:()=>undo(hooks)}],'collection-repair-done');
  }});
  if(hasCollectionBackup())actions.push({text:'Restore Previous Collection',id:'restore-collection-backup',action:()=>undo(hooks)});
  hooks.open('Repair Old Collection',`<p>If an older version added a meme you never picked up, you can return it to the map. For a meme you collected but never researched, you can relock just its archive.</p><div class="collection-repair-list">${rows||'<p>Your collection is empty. Find the memes on the map to collect them.</p>'}</div><p class="note">Only your selected items will change. A collection backup will be kept so you can undo the repair.</p><p id="repair-feedback" role="status"></p>`,actions,'collection-repair');
}

function undo(hooks:Hooks) {
  if(restoreCollection(hooks.save)){
    hooks.refresh();
    hooks.open('Collection Restored','<p>Your previous collection and research records are restored. Any items and archives you gained since the repair are also kept. Your current position is unchanged.</p>',[{text:'Back to Progress Settings',id:'repair-done',action:hooks.back}],'collection-repair-restored');
  }else hooks.open('Collection Not Restored','<p>The backup could not be read or saved. Your current collection is unchanged.</p>',[{text:'Back',action:hooks.back}],'collection-repair-error');
}
