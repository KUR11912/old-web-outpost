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
const LOCKED_HINT = '已找到这个梗，但它的语境还不清楚。前往回声档案馆的旧终端，输入梗名查询。';
type MemeArchive = NonNullable<ReturnType<typeof getMemeArchive>>;

/** Only the terminal interaction opens search; collection and knowledge are independent. */
export function createInvestigationUI(hooks:Hooks) {
  const {save}=hooks;
  const image=(src:string,name:string,small=false)=>`<img class="${small?'pickup-icon':'clue-image'}" src="${escape(import.meta.env.BASE_URL+src)}" alt="${escape(name)}梗图" width="${small?44:112}" height="${small?44:112}" />`;
  const placeholder=(small=false)=>`<div class="clue-file archive-placeholder${small?' archive-placeholder-small':''}" role="img" aria-label="IMG / ARCHIVE，占位图">IMG<small>ARCHIVE</small></div>`;
  const archiveFor=(pickup:PickupDefinition)=>pickup.memeId?getMemeArchive(pickup.memeId):undefined;
  const isQueried=(archive:MemeArchive|undefined)=>!!archive&&hasMemeArchiveContent(archive)&&save.queriedMemes.includes(archive.id);
  const source=(id:string)=>{
    const clue=CLUES[id];
    const imageSources=clue.gallery?.map((item,index)=>`<div class="image-source"><h4>配图 ${index+1} · ${escape(item.role??'档案配图')}</h4><p>${escape(item.caption)}</p>${item.creator?`<p>署名／画面来源：${escape(item.creator)}</p>`:''}${item.note?`<p>${escape(item.note)}</p>`:''}<p>${item.sourcePage?`<a href="${escape(item.sourcePage)}" target="_blank" rel="noopener noreferrer">图片来源页 ↗</a>`:''}${item.sourcePage&&item.originalUrl?' · ':''}${item.originalUrl?`<a href="${escape(item.originalUrl)}" target="_blank" rel="noopener noreferrer">来源图片 ↗</a>`:''}</p></div>`).join('')??'';
    return `<details class="source-note"><summary>资料说明 · ${escape(clue.sourceLabel)}</summary><p>${escape(clue.sourceNote)}</p>${clue.sources?.map(s=>`<p><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><br>${escape(s.note)}</p>`).join('')??''}${imageSources}</details>`;
  };
  const archiveBody=(archive:MemeArchive)=>{
    const visual=archive.image?image(archive.image,archive.name):placeholder();
    const sections=archive.clueIds.filter(id=>!!CLUES[id]).map(id=>{
      const clue=CLUES[id];
      const variantImage=clue.image??archive.image;
      const variants=clue.variants?.length?`<div class="variant-grid">${clue.variants.map(v=>`<figure>${variantImage?image(variantImage,archive.name):placeholder()}<figcaption><strong>${escape(v.caption)}</strong><span>${escape(v.context)}</span></figcaption></figure>`).join('')}</div>`:'';
      const gallery=clue.gallery?.length?`<div class="archive-gallery">${clue.gallery.map((item,index)=>`<figure><button class="archive-image-button" data-archive-image="${escape(id)}:${index}" aria-label="放大查看：${escape(item.caption)}"><img class="archive-gallery-image" src="${escape(import.meta.env.BASE_URL+item.src)}" alt="${escape(item.caption)}"><span>点击放大查看</span></button><figcaption>${item.role?`<strong>${escape(item.role)}</strong> · `:''}${escape(item.caption)}</figcaption></figure>`).join('')}</div>`:'';
      return `<section class="archive-section" data-archive-clue="${escape(id)}"><h3>${escape(clue.name)}</h3>${clue.period?`<p class="archive-period"><strong>流行时期：</strong>${escape(clue.period)}</p>`:''}${clue.content.map(p=>`<p>${escape(p)}</p>`).join('')}${clue.example?`<div class="archive-example"><h4>${escape(clue.example.label)}</h4><p>${escape(clue.example.text)}</p></div>`:''}${clue.contextNote?`<p class="archive-context"><strong>使用语境：</strong>${escape(clue.contextNote)}</p>`:''}${gallery}${variants}${source(id)}</section>`;
    }).join('');
    return `<span class="label" data-archive-state="queried">已查询</span><div class="clue clue-heading">${visual}<div><h2>${escape(archive.name)}</h2>${archive.summary?`<p>${escape(archive.summary)}</p>`:''}<p class="note">检索地点：回声档案馆 · 旧终端</p></div></div><div class="clue-content">${sections}</div>`;
  };
  const lockedBody=(name:string)=>`<span class="label" data-archive-state="unqueried">尚未查询</span><div class="clue clue-heading">${placeholder()}<div><h2>${escape(name)}</h2><p class="locked-archive-hint">${LOCKED_HINT}</p></div></div>`;

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
        hooks.open(`查看大图 / ${CLUES[clueId].name}`,`<figure class="archive-image-view"><img src="${escape(import.meta.env.BASE_URL+item.src)}" alt="${escape(item.caption)}"><figcaption>${escape(item.caption)}</figcaption></figure>`,[{text:'返回档案',id:'return-archive',action:()=>{
          openArchive(title,returnBody,actions,kind);
          document.getElementById('modal-body')!.scrollTop=scrollTop;
          Array.from(document.querySelectorAll<HTMLButtonElement>('[data-archive-image]')).find(candidate=>candidate.dataset.archiveImage===key)?.focus({preventScroll:true});
        }},{text:'关闭窗口',action:hooks.close}],'archive-image');
      };
    });
  }

  function showPickup(id:string,back:()=>void,backText='返回收藏背包') {
    const pickup=PICKUPS.find(item=>item.id===id);
    if(!pickup||!save.pickupInventory.includes(id))return;
    const archive=archiveFor(pickup),name=archive?.name??getPickupContent(pickup).name;
    const body=isQueried(archive)?archiveBody(archive!):lockedBody(name);
    openArchive(`收藏 / ${name}`,body,[{text:backText,id:'return-bag',action:back},{text:'关闭窗口',action:hooks.close}],'pickup-detail');
  }

  function showBag() {
    const collections=collectedPickupEntries(save.pickupInventory);
    const cards=collections.map(pickup=>{
      const archive=archiveFor(pickup),name=archive?.name??getPickupContent(pickup).name,queried=isQueried(archive);
      const visual=queried&&archive?.image?image(archive.image,name,true):placeholder(true);
      const description=queried?archive?.summary??'档案资料已解锁，可随时查看。':'前往旧终端输入梗名，查询资料。';
      return `<article class="bag-card pickup-bag-card" data-pickup-entry="${escape(pickup.id)}" data-archive-state="${queried?'queried':'unqueried'}">${visual}<div><h3>${escape(name)}</h3><p>${escape(description)}</p><small>${queried?'已查询':'尚未查询'}</small></div><button data-pickup-id="${escape(pickup.id)}">查看</button></article>`;
    }).join('');
    hooks.open(`收藏背包 / ${collections.length} 件物品`, `<span class="label">已收藏 ${collections.length} 项</span><section class="extra-collection"><h2>探索收藏</h2>${collections.length?`<div class="bag-list">${cards}</div>`:'<p class="note">还没有探索收藏。靠近场景里的黄色文件夹即可自动拾取。</p>'}</section>`,[{text:'关闭背包',action:hooks.close}],'bag');
    document.querySelectorAll<HTMLButtonElement>('[data-pickup-id]').forEach(button=>button.onclick=()=>showPickup(button.dataset.pickupId!,showBag));
  }

  function showSearch(query='') {
    hooks.open('旧终端 / 老梗检索',`<span class="label">回声档案馆 · 旧终端</span><h2>检索遗失的资料</h2><p>输入你已经找到的梗名，检索遗失的资料。</p><form id="terminal-search-form" class="terminal-search" novalidate><label class="sr-only" for="terminal-query">已收集的梗名</label><div class="terminal-search-row"><input id="terminal-query" type="text" value="${escape(query)}" placeholder="请输入已收集的梗名" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="terminal-search-feedback"><button type="button" id="terminal-search-submit">搜索</button></div><p id="terminal-search-feedback" class="terminal-search-feedback" role="status" aria-live="polite"></p></form>`,[{text:'关闭窗口',action:hooks.close}],'terminal-search');
    const form=document.getElementById('terminal-search-form') as HTMLFormElement;
    const input=document.getElementById('terminal-query') as HTMLInputElement;
    const button=document.getElementById('terminal-search-submit') as HTMLButtonElement;
    const feedback=document.getElementById('terminal-search-feedback')!;
    let composing=false,ignoreEnterUntil=0;
    const submit=()=>{
      if(composing)return;
      const result=searchMemeArchive(save,input.value);
      if(result.status!=='success'){
        const messages={empty:'请输入梗名',unknown:'没有找到匹配的资料，请检查梗名',uncollected:'请先在地图中找到这个梗'};
        feedback.textContent=result.status==='unavailable'?`终端资料暂缺：${result.archive.name}。`:messages[result.status];
        input.setAttribute('aria-invalid',String(result.status==='empty'||result.status==='unknown'));
        return;
      }
      const archive=result.archive,submittedQuery=input.value;
      // Build/open the actual matching document before recording its successful display.
      const updateFeedback=result.alreadyQueried?'':`<p id="archive-update-feedback" class="archive-update-feedback" role="status">档案已更新：${escape(archive.name)}</p>`;
      const body=updateFeedback+archiveBody(archive);
      openArchive(`旧终端 / ${archive.name}`,body,[{text:'返回检索',id:'return-search',action:()=>showSearch(submittedQuery)},{text:'查看背包',id:'view-bag',action:showBag}],'terminal-detail');
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
    if(found)actions.push({text:'查看老梗收藏',action:()=>showPickup('outpost-blue-mushroom-folder',()=>showStation('mailbox'),'返回留言')});
    actions.push({text:'收好留言',action:hooks.close});
    hooks.open('旧邮箱 / 留言',`<span class="label">游戏留言 · 虚构叙述</span><h2>给路过这里的人：</h2><div class="letter">“邮箱前的黄色文件夹里，保存着一个叫‘蓝瘦香菇’的老梗。靠近文件夹，就能把它收好。<br><br>名字还在，可我已经忘了它想表达什么、又该在什么时候发。带着找到的梗名去回声档案馆，在旧终端输入名字查询，也许能找回遗失的资料。”</div><p class="collection-status">${found?'✓ 这份老梗已经在收藏里。旧信可随时回看。':'文件夹就在邮箱前方的石板路旁。关闭窗口后，靠近它即可自动拾取。'}</p>`,actions,'station');
  }
  return {showBag,showStation};
}
