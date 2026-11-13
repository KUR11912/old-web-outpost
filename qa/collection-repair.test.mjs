import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_BACKUP_KEY, hasCollectionBackup, repairCollection, restoreCollection } from '../src/collection-repair.ts';
import { SAVE_KEY, createDefaultSave, collectPickup, saveGame, loadSave, resetSave } from '../src/save.ts';
import { unlockMemeArchive } from '../src/meme-archives.ts';
import { PICKUPS } from '../src/pickup-data.ts';
const blue='outpost-blue-mushroom-folder';
const four=PICKUPS.filter(p=>p.id!==blue).map(p=>p.id);
const plan={removePickupIds:four,lockMemeIds:['blue-mushroom']};
function storage() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
function complete() {
  const save=createDefaultSave();
  for(const item of PICKUPS){collectPickup(save,item.id);unlockMemeArchive(save,item.memeId);}
  save.pose={x:57,z:-35,yaw:0,pitch:0};save.investigated=true;
  return save;
}
test('targeted repair only returns selected folders and relocks selected archives, with a recoverable backup',()=>{
  const store=storage(),save=complete(),before=structuredClone(save);
  saveGame(save,store);store.setItem('another-game','keep');
  assert.equal(repairCollection(save,plan,store),true);
  assert.deepEqual(save.pickupInventory,[blue]);
  assert.deepEqual(save.queriedMemes,[]);
  assert.deepEqual(save.pose,before.pose);assert.equal(save.investigated,true);
  assert.deepEqual(loadSave(store).pickupInventory,[blue]);
  assert.equal(store.getItem('another-game'),'keep');
  assert.equal(hasCollectionBackup(store),true);
  assert.deepEqual(JSON.parse(store.getItem(COLLECTION_BACKUP_KEY)),before);
  assert.equal(collectPickup(save,four[0]),true);
  assert.deepEqual(save.queriedMemes,[],'restored world folder must be researched again');
  save.pose.x=55;
  assert.equal(restoreCollection(save,store),true);
  assert.deepEqual(save.pickupInventory,before.pickupInventory);
  assert.deepEqual(save.queriedMemes,before.queriedMemes);
  assert.equal(save.pose.x,55,'undo does not teleport the player');
});
test('all five may be explicitly returned without clearing location, letter or sound preferences',()=>{
  const store=storage(),save=complete(),before=structuredClone(save);
  store.setItem('old-web-outpost:music','keep');
  assert.equal(repairCollection(save,{removePickupIds:PICKUPS.map(p=>p.id),lockMemeIds:[]},store),true);
  assert.deepEqual(save.pickupInventory,[]);assert.deepEqual(save.queriedMemes,[]);
  assert.deepEqual(save.pose,before.pose);assert.equal(save.investigated,true);
  assert.equal(store.getItem('old-web-outpost:music'),'keep');
});
test('undo merges collections gained after the repair instead of deleting new progress',()=>{
  const store=storage(),save=createDefaultSave();
  collectPickup(save,blue);unlockMemeArchive(save,'blue-mushroom');
  assert.equal(repairCollection(save,{removePickupIds:[blue],lockMemeIds:[]},store),true);
  collectPickup(save,'field-folder-02');unlockMemeArchive(save,'gg-or-mm');
  assert.equal(restoreCollection(save,store),true);
  assert.deepEqual(save.pickupInventory,[blue,'field-folder-02']);
  assert.deepEqual(save.queriedMemes,['blue-mushroom','gg-or-mm']);
  assert.deepEqual(loadSave(store).pickupInventory,save.pickupInventory);
});
test('backup or primary save failure leaves the live inventory unchanged',()=>{
  for(const failingKey of [COLLECTION_BACKUP_KEY,SAVE_KEY]){
    const store=storage(),save=complete(),before=structuredClone(save);
    const setter=store.setItem;store.setItem=(key,value)=>{if(key===failingKey)throw new Error('denied');setter(key,value);};
    assert.equal(repairCollection(save,plan,store),false);assert.deepEqual(save,before);
  }
});
test('invalid backups cannot wipe current collections',()=>{
  for(const invalid of ['{broken','null','{"version":1}','{"version":9,"pickupInventory":[],"queriedMemes":[]}']){
    const store=storage(),save=complete(),before=structuredClone(save);
    store.setItem(COLLECTION_BACKUP_KEY,invalid);
    assert.equal(hasCollectionBackup(store),false);assert.equal(restoreCollection(save,store),false);
    assert.deepEqual(save,before);
  }
});
test('clear progress removes active save and repair backup while keeping preferences and other games',()=>{
  const store=storage(),save=complete();
  assert.equal(repairCollection(save,plan,store),true);
  store.setItem('old-web-outpost:music','music-preference');
  store.setItem('another-game','keep');
  assert.equal(resetSave(store),true);
  assert.equal(store.getItem(SAVE_KEY),null);
  assert.equal(store.getItem(COLLECTION_BACKUP_KEY),null);
  assert.deepEqual(loadSave(store),createDefaultSave());
  assert.equal(hasCollectionBackup(store),false);
  assert.equal(store.getItem('old-web-outpost:music'),'music-preference');
  assert.equal(store.getItem('another-game'),'keep');
});
