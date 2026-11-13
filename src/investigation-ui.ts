import type { SaveData } from './save';
import { CLUES } from './archive-data';
import { PICKUPS, getPickupContent, collectedPickupEntries, type PickupDefinition } from './pickup-data';
import { getMemeArchive, hasMemeArchiveContent, searchMemeArchive, unlockMemeArchive } from './meme-archives';

interface Action { text:string; id?:string; action:()=>void }
interface Hooks {
  save:SaveData;
  open:(title:string,body:string,actions:Action[],kind:string)=>void;
  close:()=>void;
  persist:()=>void;
  refresh:()=>void;
  toast:(text:string)=>void;
}
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const LOCKED_HINT = 'You found this meme, but its context is still a mystery. Go to the Old Terminal in the Echo Archive and search its name.';
type MemeArchive = NonNullable<ReturnType<typeof getMemeArchive>>;

/** Only the terminal interaction opens search; collection and knowledge are independent. */
export function createInvestigationUI(hooks:Hooks) {
  const {save}=hooks;
  const image=(src:string,name:string,small=false)=>`<img class="${small?'pickup-icon':'clue-image'}" src="${escape(import.meta.env.BASE_URL+src)}" alt="${escape(name)} meme image" width="${small?44:112}" height="${small?44:112}" />`;
  const placeholder=(small=false)=>`<div class="clue-file archive-placeholder${small?' archive-placeholder-small':''}" role="img" aria-label="IMG / ARCHIVE placeholder">IMG<small>ARCHIVE</small></div>`;
  const archiveFor=(pickup:PickupDefinition)=>pickup.memeId?getMemeArchive(pickup.memeId):undefined;
  const isQueried=(archive:MemeArchive|undefined)=>!!archive&&hasMemeArchiveContent(archive)&&save.queriedMemes.includes(archive.id);
  const source=(id:string)=>{
    const clue=CLUES[id];
    const imageSources=clue.gallery?.map((item,index)=>`<div class="image-source"><h4>Image ${index+1} · ${escape(item.role??'Archive illustration')}</h4><p>${escape(item.caption)}</p>${item.creator?`<p>Credit / image origin: ${escape(item.creator)}</p>`:''}${item.note?`<p>${escape(item.note)}</p>`:''}<p>${item.sourcePage?`<a href="${escape(item.sourcePage)}" target="_blank" rel="noopener noreferrer">Image source page ↗</a>`:''}${item.sourcePage&&item.originalUrl?' · ':''}${item.originalUrl?`<a href="${escape(item.originalUrl)}" target="_blank" rel="noopener noreferrer">Source image ↗</a>`:''}</p></div>`).join('')??'';
    return `<details class="source-note"><summary>Source Notes · ${escape(clue.sourceLabel)}</summary><p>${escape(clue.sourceNote)}</p>${clue.sources?.map(s=>`<p><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><br>${escape(s.note)}</p>`).join('')??''}${imageSources}</details>`;
  };
  const archiveBody=(archive:MemeArchive)=>{
    const visual=archive.image?image(archive.image,archive.name):placeholder();
    const sections=archive.clueIds.filter(id=>!!CLUES[id]).map(id=>{
      const clue=CLUES[id];
      const variantImage=clue.image??archive.image;
      const variants=clue.variants?.length?`<div class="variant-grid">${clue.variants.map(v=>`<figure>${variantImage?image(variantImage,archive.name):placeholder()}<figcaption><strong>${escape(v.caption)}</strong><span>${escape(v.context)}</span></figcaption></figure>`).join('')}</div>`:'';
      const gallery=clue.gallery?.length?`<div class="archive-gallery">${clue.gallery.map((item,index)=>`<figure><button class="archive-image-button" data-archive-image="${escape(id)}:${index}" aria-label="Enlarge: ${escape(item.caption)}"><img class="archive-gallery-image" src="${escape(import.meta.env.BASE_URL+item.src)}" alt="${escape(item.caption)}"><span>Click to enlarge</span></button><figcaption>${item.role?`<strong>${escape(item.role)}</strong> · `:''}${escape(item.caption)}</figcaption></figure>`).join('')}</div>`:'';
      return `<section class="archive-section" data-archive-clue="${escape(id)}"><h3>${escape(clue.name)}</h3>${clue.period?`<p class="archive-period"><strong>Popular period: </strong>${escape(clue.period)}</p>`:''}${clue.content.map(p=>`<p>${escape(p)}</p>`).join('')}${clue.example?`<div class="archive-example"><h4>${escape(clue.example.label)}</h4><p>${escape(clue.example.text)}</p></div>`:''}${clue.contextNote?`<p class="archive-context"><strong>Usage context: </strong>${escape(clue.contextNote)}</p>`:''}${gallery}${variants}${source(id)}</section>`;
    }).join('');
    return `<span class="label" data-archive-state="queried">Researched</span><div class="clue clue-heading">${visual}<div><h2>${escape(archive.name)}</h2>${archive.summary?`<p>${escape(archive.summary)}</p>`:''}<p class="note">Research location: Echo Archive · Old Terminal</p></div></div><div class="clue-content">${sections}</div>`;
  };
  const lockedBody=(name:string)=>`<span class="label" data-archive-state="unqueried">Not Researched</span><div class="clue clue-heading">${placeholder()}<div><h2>${escape(name)}</h2><p class="locked-archive-hint">${LOCKED_HINT}</p></div></div>`;

  function openArchive(title:string,body:string,actions:Action[],kind:string) {
    hooks.open(title,body,actions,kind);
    document.querySelectorAll<HTMLButtonElement>('[data-archive-image]').forEach(button=>{
      button.onclick=()=>{
        const [clueId,index]=button.dataset.archiveImage!.split(':');
        const item=CLUES[clueId]?.gallery?.[Number(index)];
        if(!item)return;
        // Reuse the paused modal. Returning keeps the expanded source notes and reading position.
        const panel=document.getElementById('modal-body')!;
        const returnBody=panel.innerHTML,scrollTop=panel.scrollTop,key=button.dataset.archiveImage;
        hooks.open(`Image Viewer / ${CLUES[clueId].name}`,`<figure class="archive-image-view"><img src="${escape(import.meta.env.BASE_URL+item.src)}" alt="${escape(item.caption)}"><figcaption>${escape(item.caption)}</figcaption></figure>`,[{text:'Back to Archive',id:'return-archive',action:()=>{
          openArchive(title,returnBody,actions,kind);
          document.getElementById('modal-body')!.scrollTop=scrollTop;
          Array.from(document.querySelectorAll<HTMLButtonElement>('[data-archive-image]')).find(candidate=>candidate.dataset.archiveImage===key)?.focus({preventScroll:true});
        }},{text:'Close Window',action:hooks.close}],'archive-image');
      };
    });
  }

  function showPickup(id:string,back:()=>void,backText='Back to Collection') {
    const pickup=PICKUPS.find(item=>item.id===id);
    if(!pickup||!save.pickupInventory.includes(id))return;
    const archive=archiveFor(pickup),name=archive?.name??getPickupContent(pickup).name;
    const body=isQueried(archive)?archiveBody(archive!):lockedBody(name);
    openArchive(`Collection / ${name}`,body,[{text:backText,id:'return-bag',action:back},{text:'Close Window',action:hooks.close}],'pickup-detail');
  }

  function showBag() {
    const collections=collectedPickupEntries(save.pickupInventory);
    const cards=collections.map(pickup=>{
      const archive=archiveFor(pickup),name=archive?.name??getPickupContent(pickup).name,queried=isQueried(archive);
      const visual=queried&&archive?.image?image(archive.image,name,true):placeholder(true);
      const description=queried?archive?.summary??'Archive unlocked. Read it here at any time.':'Search this name at the Old Terminal to unlock its archive.';
      return `<article class="bag-card pickup-bag-card" data-pickup-entry="${escape(pickup.id)}" data-archive-state="${queried?'queried':'unqueried'}">${visual}<div><h3>${escape(name)}</h3><p>${escape(description)}</p><small>${queried?'Researched':'Not Researched'}</small></div><button data-pickup-id="${escape(pickup.id)}">View</button></article>`;
    }).join('');
    hooks.open(`Collection / ${collections.length} ${collections.length===1?'item':'items'}`, `<span class="label">${collections.length} collected</span><section class="extra-collection"><h2>Your Discoveries</h2>${collections.length?`<div class="bag-list">${cards}</div>`:'<p class="note">Your collection is empty. Walk up to a yellow folder in the world to pick it up automatically.</p>'}</section>`,[{text:'Close Collection',action:hooks.close}],'bag');
    document.querySelectorAll<HTMLButtonElement>('[data-pickup-id]').forEach(button=>button.onclick=()=>showPickup(button.dataset.pickupId!,showBag));
  }

  function showSearch(query='') {
    hooks.open('Old Terminal / Meme Search',`<span class="label">Echo Archive · Old Terminal</span><h2>Recover the missing context</h2><p>Enter the name of a meme you have found to recover its lost archive.</p><form id="terminal-search-form" class="terminal-search" novalidate><label class="sr-only" for="terminal-query">Collected meme name</label><div class="terminal-search-row"><input id="terminal-query" type="text" value="${escape(query)}" placeholder="Enter a collected meme name" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="terminal-search-feedback"><button type="button" id="terminal-search-submit">Search</button></div><p id="terminal-search-feedback" class="terminal-search-feedback" role="status" aria-live="polite"></p></form>`,[{text:'Close Window',action:hooks.close}],'terminal-search');
    const form=document.getElementById('terminal-search-form') as HTMLFormElement;
    const input=document.getElementById('terminal-query') as HTMLInputElement;
    const button=document.getElementById('terminal-search-submit') as HTMLButtonElement;
    const feedback=document.getElementById('terminal-search-feedback')!;
    let composing=false,ignoreEnterUntil=0;
    const submit=()=>{
      if(composing)return;
      const result=searchMemeArchive(save,input.value);
      if(result.status!=='success'){
        const messages={empty:'Enter a meme name',unknown:'No matching archive found. Check the meme name.',uncollected:'Find this meme on the map first.'};
        feedback.textContent=result.status==='unavailable'?`Archive temporarily unavailable: ${result.archive.name}`:messages[result.status];
        input.setAttribute('aria-invalid',String(result.status==='empty'||result.status==='unknown'));
        return;
      }
      const archive=result.archive,submittedQuery=input.value;
      // Build/open the actual matching document before recording its successful display.
      const updateFeedback=result.alreadyQueried?'':`<p id="archive-update-feedback" class="archive-update-feedback" role="status">Archive updated: ${escape(archive.name)}</p>`;
      const body=updateFeedback+archiveBody(archive);
      openArchive(`Old Terminal / ${archive.name}`,body,[{text:'Back to Search',id:'return-search',action:()=>showSearch(submittedQuery)},{text:'View Collection',id:'view-bag',action:showBag}],'terminal-detail');
      if(unlockMemeArchive(save,archive.id)){
        hooks.persist();hooks.refresh();
      }
    };
    input.addEventListener('compositionstart',()=>{composing=true;});
    input.addEventListener('compositionend',()=>{composing=false;ignoreEnterUntil=performance.now()+100;});
    input.addEventListener('keydown',event=>{
      // The text field owns all keystrokes; W/A/S/D/B/M/E must never reach game handlers.
      event.stopPropagation();
      if(event.isComposing||event.keyCode===229||composing){
        ignoreEnterUntil=performance.now()+100;
        return;
      }
      if(event.key==='Enter'){
        event.preventDefault();
        if(performance.now()>=ignoreEnterUntil)submit();
      }
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(!composing&&performance.now()>=ignoreEnterUntil)submit();
    });
    button.addEventListener('click',()=>{if(!composing)submit();});
    input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');feedback.textContent='';});
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
  }

  function showStation(stationId:string) {
    if(stationId==='old-terminal'){showSearch();return;}
    if(stationId!=='mailbox')return;
    save.investigated=true;hooks.persist();
    const found=save.pickupInventory.includes('outpost-blue-mushroom-folder');
    const actions:Action[]=[];
    if(found)actions.push({text:'View This Meme',action:()=>showPickup('outpost-blue-mushroom-folder',()=>showStation('mailbox'),'Back to Note')});
    actions.push({text:'Close Note',action:hooks.close});
    hooks.open('Old Mailbox / Note',`<span class="label">In-game note · Fictional narrative</span><h2>To whoever passes through:</h2><div class="letter">“The yellow folder in front of the mailbox holds an old meme called Blue and Mushroom. Walk up to the folder to collect it.<br><br>I still remember the name, but I have forgotten what it means or when to use it. Take the name to the Echo Archive and search for it at the Old Terminal. Perhaps you can recover its missing story.”</div><p class="collection-status">${found?'✓ This meme is in your collection. You can reread this note at any time.':'The folder is beside the stone path in front of the mailbox. Close this window and walk up to it to collect it.'}</p>`,actions,'station');
  }
  return {showBag,showStation};
}
