import type { SaveData } from './save';
import { CLUE_ID } from './save';
import { CLUES, CLUE_ORDER, ARCHIVE_QUESTIONS, hasAllClues, evaluateArchive } from './archive-data';

interface Action { text:string; id?:string; action:()=>void }
interface Hooks {
  save:SaveData;
  open:(title:string,body:string,actions:Action[],kind:string)=>void;
  close:()=>void;
  persist:()=>void;
  refresh:()=>void;
  toast:(text:string)=>void;
}
type Step = 'meaning'|'context';
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const stationClues:Record<string,string> = {
  mailbox:CLUE_ID, 'old-terminal':'echo-meaning-note',
  'chat-viewer':'echo-chat-context', 'image-cache':'echo-image-variants',
};
const stationNames:Record<string,string> = {
  mailbox:'旧邮箱', 'old-terminal':'旧终端', 'chat-viewer':'聊天记录查看器', 'image-cache':'图片缓存终端',
};

/** All investigations share the existing window and one source of clue content. */
export function createInvestigationUI(hooks:Hooks) {
  const {save}=hooks;
  const owns=(id:string)=>save.clues.includes(id);
  const image=(src:string)=>`<img class="clue-image" src="${escape(import.meta.env.BASE_URL+src)}" alt="人物表情与蓝色蘑菇，底部完整写着蓝瘦香菇" width="112" height="112" />`;
  const source=(id:string)=>{
    const clue=CLUES[id];
    return `<details class="source-note"><summary>资料说明 · ${escape(clue.sourceLabel)}</summary><p>${escape(clue.sourceNote)}</p>${clue.sources?.map(s=>`<p><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><br>${escape(s.note)}</p>`).join('')??''}</details>`;
  };
  const cardBody=(id:string)=>{
    const clue=CLUES[id];
    const visual=clue.image?image(clue.image):`<div class="clue-file" aria-hidden="true">${id==='echo-meaning-note'?'Aa':id==='echo-chat-context'?'[···]':'IMG'}<small>ARCHIVE</small></div>`;
    const variants=clue.variants?.length?`<div class="variant-grid">${clue.variants.map(v=>`<figure>${image(clue.image??CLUES[CLUE_ID].image!)}<figcaption><strong>${escape(v.caption)}</strong><span>${escape(v.context)}</span></figcaption></figure>`).join('')}</div><p class="note">游戏改编示例：保留同一图片，只更换外围配文。两条配文均非已核验的历史变体。</p>`:'';
    return `<span class="label">${escape(clue.sourceLabel)}</span><div class="clue clue-heading">${visual}<div><h2>${escape(clue.name)}</h2><p>${escape(clue.summary)}</p><p class="note">获得地点：${escape(clue.location)}</p></div></div><div class="clue-content">${clue.content.map(p=>`<p>${escape(p)}</p>`).join('')}</div>${variants}${source(id)}`;
  };
  function showClue(id:string,back:()=>void=()=>showBag(),backText='返回线索背包') {
    if(!owns(id))return;
    hooks.open(`线索卡 / ${CLUES[id].name}`,cardBody(id),[{text:backText,id:backText==='返回整理线索'?'return-association':'return-bag',action:back},{text:'关闭窗口',action:hooks.close}],'clue');
  }
  function showBag(back?:()=>void) {
    const found=CLUE_ORDER.filter(owns);
    const cards=CLUE_ORDER.map((id,index)=>{
      const clue=CLUES[id];
      return owns(id)?`<article class="bag-card"><span class="card-number">0${index+1}</span><div><h3>${escape(clue.name)}</h3><p>${escape(clue.summary)}</p><small>${escape(clue.location)}</small></div><button data-clue-id="${id}">查看</button></article>`:`<article class="bag-card missing-card"><span class="card-number">0${index+1}</span><div><h3>尚未收集</h3><p>${escape(clue.location)}</p></div></article>`;
    }).join('');
    const actions:Action[]=[];
    if(back)actions.push({text:'返回整理线索',id:'return-association',action:back});
    actions.push({text:'关闭背包',action:hooks.close});
    hooks.open(`线索背包 / ${found.length} 件物品`, `<span class="label">资料可反复查看 · 重复调查不重复发放</span><h2>已收集 ${found.length} / 4 张线索</h2><div class="bag-list">${cards}</div><p class="note">${save.archive.completed?'档案馆调查已完成。下一目标：前往断链桥。':hasAllClues(save.clues)?'四张线索已齐。到档案馆门前的整理桌，建立含义与语境的联系。':'读完资料后记得点击“收下线索卡”。资料说明会区分用户图片、游戏示例和待核验来源。'}</p>`,actions,'bag');
    document.querySelectorAll<HTMLButtonElement>('[data-clue-id]').forEach(b=>b.onclick=()=>showClue(b.dataset.clueId!,()=>showBag(back)));
  }
  function showStation(stationId:string) {
    if(stationId==='archive-desk'){showAssociation();return;}
    const id=stationClues[stationId];if(!id)return;
    if(stationId==='mailbox'){save.investigated=true;hooks.persist();}
    const found=owns(id);
    const greeting=stationId==='mailbox'?`<span class="label">游戏留言 · 虚构叙述</span><div class="letter">“这张图上明明写着‘蓝瘦香菇’，可我已经忘了它想表达什么、又该在什么时候发。<br><br>去回声档案馆看看，帮我把含义和当时的使用语境找回来吧。”</div>`:'';
    const actions:Action[]=found?[{text:'查看背包',action:()=>showBag()}]:[{text:'收下线索卡',id:'collect-clue',action:()=>{
      if(!owns(id))save.clues.push(id);
      hooks.persist();hooks.refresh();showStation(stationId);hooks.toast(`获得线索：${CLUES[id].name}`);
    }}];
    if(stationId!=='mailbox'&&hasAllClues(save.clues))actions.push({text:'整理线索',id:'organize-clues',action:()=>showAssociation()});
    actions.push({text:found?'收好资料':'稍后再看',action:hooks.close});
    hooks.open(`${stationNames[stationId]} / 调查资料`,`${greeting}${cardBody(id)}<p class="collection-status">${found?'✓ 已收进背包，重复调查不会重复领取。':'阅读后点击下方“收下线索卡”，保存这份资料。'}</p>`,actions,'station');
  }
  function reviewButtons(ids:string[]) {
    return `<div class="review-links"><span>回看依据：</span>${[...new Set(ids)].filter(owns).map(id=>`<button data-review-clue="${id}">${escape(CLUES[id].name)}</button>`).join('')}</div>`;
  }
  function bindReview(back:()=>void) {
    document.querySelectorAll<HTMLButtonElement>('[data-review-clue]').forEach(b=>b.onclick=()=>showClue(b.dataset.reviewClue!,back,'返回整理线索'));
  }
  function showComplete() {
    const conclusions=ARCHIVE_QUESTIONS.map(q=>{
      const selected=q.options.find(o=>o.id===save.archive.answers[q.id])!;
      return `<section class="conclusion"><h3>${escape(q.title)}</h3><p>${escape(selected.feedback)}</p></section>`;
    }).join('');
    hooks.open('回声档案馆 / 调查完成',`<span class="label">调查已保存 · 4 / 4 张线索</span><h2>档案馆调查完成</h2><p>你找回了这张图的表达含义，也区分了熟人自嘲与认真求助的语境。</p>${conclusions}<div class="next-destination"><strong>下一目标：前往断链桥</strong><p>沿门前石板路向南，在路口向东。桥梁本轮保持开放，可以直接通行。</p></div>${reviewButtons(CLUE_ORDER)}<p class="note">本次整理不代表来源已核实。原图出处与原始声音材料仍待核验，聊天与改编配文均为游戏创作。</p>`,[{text:'查看线索背包',action:()=>showBag(()=>showComplete())},{text:'继续探索',id:'continue-exploring',action:hooks.close}],'archive-complete');
    bindReview(()=>showComplete());
  }
  function showAssociation(step:Step='meaning',checked=false) {
    if(!hasAllClues(save.clues)){
      const missing=CLUE_ORDER.filter(id=>!owns(id));
      hooks.open('回声档案馆 / 整理线索',`<span class="label">已收集 ${save.clues.length} / 4</span><h2>还需要一些资料</h2><p>把四张线索收齐后，就可以开始判断。已找到的卡片会一直留在背包里。</p><ul class="missing-list">${missing.map(id=>`<li><strong>${escape(CLUES[id].name)}</strong><br><span>${escape(CLUES[id].location)}</span></li>`).join('')}</ul>`,[{text:'查看背包',action:()=>showBag(()=>showAssociation())},{text:'继续寻找',action:hooks.close}],'association');
      return;
    }
    if(save.archive.completed){showComplete();return;}
    const question=ARCHIVE_QUESTIONS.find(q=>q.id===step)!;
    const choice=question.options.find(o=>o.id===save.archive.answers[step]);
    const result=evaluateArchive(save.archive.answers);
    const refs=choice?.referenceIds??question.options.flatMap(o=>o.referenceIds);
    const feedback=checked?`<div id="association-feedback" class="association-feedback ${choice?.correct?'correct':'retry'}" role="status"><strong>${choice?choice.correct?'这个判断有依据':'再对照一下资料':'请先选择一个判断'}</strong><p>${choice?escape(choice.feedback):'不用猜，先回看下面的线索，再选择最符合材料的一项。'}</p>${step==='context'&&!result.meaning?'<p>第一个含义关联还没有正确完成，请返回“1 · 含义关联”检查。</p>':''}</div>`:'';
    const options=question.options.map(option=>`<label class="answer-option"><input type="radio" name="${step}" data-option-id="${option.id}" value="${option.id}" ${choice?.id===option.id?'checked':''} /><span>${escape(option.text)}</span></label>`).join('');
    const actions:Action[]=[{text:'查看已收集资料',action:()=>showBag(()=>showAssociation(step,checked))}];
    if(step==='meaning'){
      actions.push({text:'检查关联',id:'check-association',action:()=>showAssociation(step,true)});
      if(checked&&choice?.correct)actions.push({text:'下一步：语境判断',id:'next-association',action:()=>showAssociation('context')});
    } else actions.push({text:'提交调查结论',id:'submit-association',action:()=>{
      if(evaluateArchive(save.archive.answers).allCorrect&&hasAllClues(save.clues)){
        save.archive.completed=true;hooks.persist();hooks.refresh();showComplete();hooks.toast('档案馆调查完成 · 下一目标：断链桥');
      }else showAssociation(step,true);
    }});
    hooks.open('回声档案馆 / 整理线索',`<span class="label">4 张线索已齐 · 选择会自动保存</span><div class="association-steps">${ARCHIVE_QUESTIONS.map((q,i)=>`<button data-association-step="${q.id}" aria-current="${q.id===step?'step':'false'}">${i+1} · ${q.id==='meaning'?'含义关联':'语境判断'}</button>`).join('')}</div><section data-question-id="${step}"><h2>${escape(question.title)}</h2><p>${escape(question.prompt)}</p><fieldset class="answer-options"><legend class="sr-only">${escape(question.title)}</legend>${options}</fieldset></section>${feedback}${reviewButtons(refs)}<p class="note">可以回看资料、修改选择并再次尝试；不会扣除或丢失线索。</p>`,actions,'association');
    document.querySelectorAll<HTMLInputElement>('[data-option-id]').forEach(input=>input.onchange=()=>{
      save.archive.answers[step]=input.value;hooks.persist();
      showAssociation(step,false);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-association-step]').forEach(button=>button.onclick=()=>showAssociation(button.dataset.associationStep as Step));
    bindReview(()=>showAssociation(step,checked));
  }
  return {showBag,showStation,showAssociation};
}
