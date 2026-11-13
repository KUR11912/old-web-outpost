/** Archive materials are deliberately separated from UI and save state.
 * Report references support the word relationship, not original-media provenance.
 */
export interface ClueCard {
  id: string;
  name: string;
  location: string;
  summary: string;
  content: string[];
  sourceLabel: string;
  sourceNote: string;
  image?: string;
  period?: string;
  example?: { label: string; text: string };
  contextNote?: string;
  gallery?: {
    src: string; caption: string; role?: string; creator?: string;
    sourcePage?: string; originalUrl?: string; note?: string;
  }[];
  variants?: { caption: string; context: string }[];
  sources?: { title: string; url: string; note: string }[];
}

export type ArchiveQuestionId = 'meaning' | 'context';
export interface ArchiveAnswers { meaning: string | null; context: string | null }
export interface ArchiveState { answers: ArchiveAnswers; completed: boolean }
export interface ArchiveOption {
  id: string;
  text: string;
  correct: boolean;
  feedback: string;
  referenceIds: string[];
}
export interface ArchiveQuestion {
  id: ArchiveQuestionId;
  title: string;
  prompt: string;
  options: ArchiveOption[];
}

export const CLUE_ORDER: string[] = [
  'missing-caption-image',
  'echo-meaning-note',
  'echo-chat-context',
  'echo-image-variants',
];

export const CLUES: Record<string, ClueCard> = {
  // Exploration collections have content cards, but are not in CLUE_ORDER.
  'collection-friendship-boat': {
    "id": "collection-friendship-boat",
    "name": "友谊的小船",
    "location": "回声档案馆北侧草地",
    "summary": "把朋友间的小分歧，夸张成一场说翻就翻的“绝交事故”。",
    "period": "2016年春走红",
    "content": [
      "两只企鹅坐在小船上，其中一只突然变瘦，船就失去平衡翻了。这组荒诞的漫画，把看不见的“友谊”画成了一条经不起折腾的小船。",
      "2016年春，喃东尼的企鹅漫画广泛传播，网友不断更换对白，把抢零食、意见不合、说好一起偷懒却偷偷努力等日常吐槽装进同一条船。说“友谊的小船说翻就翻”，通常是在熟人之间假装生气，不一定真的要绝交。"
    ],
    "example": {
      "label": "使用示例（新写的情境）",
      "text": "说好一起迷路，你却偷偷开了地图？友谊的小船说翻就翻！"
    },
    "contextNote": "适合熟人之间的轻松互损；如果对方正在认真表达难过，就别只用一个“翻船”表情敷衍。",
    "sourceLabel": "资料包档案 · 含来源说明",
    "sourceNote": "广泛传播的企鹅漫画作者为喃东尼。这句话在漫画走红之前已经流传，不能把漫画作者直接等同于句子的最早发明者。",
    "image": "assets/memes/friendship-boat.jpg",
    "gallery": [
      {
        "src": "assets/memes/friendship-boat.jpg",
        "caption": "喃东尼的企鹅漫画；新华网2016年报道所附版本。",
        "role": "当年报道配图",
        "creator": "喃东尼",
        "sourcePage": "https://www.xinhuanet.com/politics/2016-04/15/c_128896932.htm",
        "originalUrl": "https://www.xinhuanet.com/politics/2016-04/15/128896932_14606747597881n.jpg",
        "note": "当年报道的转载配图，不标为首次上传文件。"
      }
    ],
    "sources": [
      {
        "title": "揭秘“友谊的小船”漫画原作者：宅男 大学退学",
        "url": "https://www.xinhuanet.com/politics/2016-04/15/c_128896932.htm",
        "note": "成都商报／新华网 · 2016-04-15"
      }
    ]
  },
  'collection-gg-or-mm': {
    "id": "collection-gg-or-mm",
    "name": "你是GG还是MM",
    "location": "回声档案馆东南侧 · 河流西岸林隙",
    "summary": "早期聊天室里的搭话暗号：GG指“哥哥”，MM指“妹妹”或“美眉”。",
    "period": "世纪之交至2000年代初常见",
    "content": [
      "在早期聊天室、论坛和QQ里，网友常把“哥哥”“妹妹”写成拼音首字母GG、MM。“你是GG还是MM？”大致是在问对方是男生还是女生，也是陌生网友打开话题的一种方式。这里的称呼并不表示亲属关系，也不一定对应真实年龄。",
      "至少在2000年的网络用语报道里，GG、MM这些缩写已经出现。今天重新敲出这句话，往往是在模仿早期上网聊天的口吻，唤起“刚认识一个网友”的感觉。"
    ],
    "example": {
      "label": "使用示例（新写的情境）",
      "text": "你好，你是GG还是MM？你也喜欢玩游戏吗？"
    },
    "contextNote": "这是特定年代的聊天用语。在这个问句里，GG按“哥哥”理解；它与游戏对局中的英文缩写GG属于不同语境。",
    "sourceLabel": "资料包档案 · 含来源说明",
    "sourceNote": "属于早期网友共同形成的网络用语，尚未确认单一创作者或精确首发日期。配图只展示旧版QQ界面，未包含这句对话。",
    "image": "assets/memes/gg-mm-qq-context.jpg",
    "gallery": [
      {
        "src": "assets/memes/gg-mm-qq-context.jpg",
        "caption": "旧版QQ界面，作为早期网络聊天的背景配图；不是该问句的原始聊天记录。",
        "role": "时代背景配图",
        "creator": "旧版QQ界面；截图制作者未标明",
        "sourcePage": "https://sdxw.iqilu.com/share/YS0yMS02MTYyMDU=.html",
        "originalUrl": "https://img9.iqilu.com/wx/2017/11/22/191447nyouaueu0hl0.jpg",
        "note": "时代背景配图。图中没有GG/MM对话；页面标注年代与图中文字有差异，不为截图指定确切年份。"
      }
    ],
    "sources": [
      {
        "title": "网络“黑话”你懂吗？",
        "url": "https://news.zol.com.cn/2000/0605/5062.shtml",
        "note": "中关村在线 · 2000-06-05"
      },
      {
        "title": "上海语言专家提出：网络语言是汉语发展",
        "url": "https://news.sina.com.cn/c/2001-08-09/324406.html",
        "note": "新闻晨报／新浪 · 2001-08-09"
      }
    ]
  },
  'collection-awesome-my-bro': {
    "id": "collection-awesome-my-bro",
    "name": "厉害了我的哥",
    "location": "地图南部 · 河流西侧草地",
    "summary": "把一句“你好厉害”，说成夸张、亲近又带点喜剧感的赞叹。",
    "period": "2016年广泛流行",
    "content": [
      "看到别人完成高难度操作、展示意想不到的本事，网友会回复“厉害了我的哥”。“哥”在这里常是一种拉近距离的称呼，并不要求对方真是自己的哥哥。配上夸张的表情，普通的称赞就变得像在给对方现场鼓掌。",
      "2016年的报道已经记录了它的刷屏传播，以及“厉害了，word哥”等变体。“word”在这里是对“我的”的谐音写法。它既可以是真心佩服，也可以在离谱的场面里带一点反讽，具体要看双方的语气。"
    ],
    "example": {
      "label": "使用示例（新写的情境）",
      "text": "你用记事本画出了整座地图？厉害了我的哥！"
    },
    "contextNote": "看见真正精彩的表现时可以用来称赞；用在别人出丑或失误之后，就可能被理解为嘲讽。",
    "sourceLabel": "资料包档案 · 含来源说明",
    "sourceNote": "同期报道存在多个起源版本。关于军训教官接过手机打游戏的故事，目前不足以确认其为唯一源头；本档案记录可核实的流行时期和用法。",
    "image": "assets/memes/lihai-le-wode-ge.jpg",
    "gallery": [
      {
        "src": "assets/memes/lihai-le-wode-ge.jpg",
        "caption": "带有“厉害了我的哥”文字的网络表情图；图片作者未标明。",
        "role": "代表性表情图",
        "creator": "未标明",
        "sourcePage": "https://www.chinlingo.com/articles/601702/",
        "originalUrl": "https://www.chinlingo.com/daily/upload/ueditor/image/20161116/13781479278344956.jpg",
        "note": "图片已下载查看；本次来源页抓取失败，图片路径日期不作为首发日期。"
      }
    ],
    "sources": [
      {
        "title": "最近刷屏的“厉害了我的哥”到底是什么梗？",
        "url": "https://www.ithome.com/0/258/417.htm",
        "note": "IT之家 · 2016-09-18"
      },
      {
        "title": "厉害了，我的网络流行语",
        "url": "https://paper.people.com.cn/rmrbhwb/html/2016-10/24/content_1720841.htm",
        "note": "人民日报海外版 · 2016-10-24"
      }
    ]
  },
  'collection-devil-or-showoff': {
    "id": "collection-devil-or-showoff",
    "name": "你是魔鬼还是秀儿",
    "location": "桥梁东南侧 · 河流东岸林隙",
    "summary": "把“你太狠了”和“你也太会秀了”放在一起，在惊讶、佩服和吐槽之间摇摆。",
    "period": "相关表达在2018年流行；整句改编歌于2019年初已有报道",
    "content": [
      "“你是魔鬼吗”常用来回应扎心的话或出乎意料的操作；“秀儿，是你吗”则把“你真优秀、真会玩”说成一个带调侃意味的称呼。它们的共同点，是用夸张的反应表达“你这一下让我没想到”。",
      "2019年1月的报道已经把“你是魔鬼还是秀儿”记作一首热门改编歌：它借用《魔鬼中的天使》的旋律，串联了当时的多个短视频热梗。放到聊天里，这个问句可以表达一种又佩服又想吐槽的心情。"
    ],
    "example": {
      "label": "使用示例（新写的情境）",
      "text": "你把电脑报错截图设成了桌面壁纸？你是魔鬼还是秀儿！"
    },
    "contextNote": "适合彼此理解语气的玩笑；其中的“魔鬼”是夸张说法，“秀儿”也不是在认真询问某个人的姓名。",
    "sourceLabel": "资料包档案 · 含来源说明",
    "sourceNote": "可确认2019年初已有整句改编歌的报道，最早上传者尚未核实。“你是魔鬼吗”的节目截图只解释相关表达，不能据此把整句话写成节目原台词。",
    "image": "assets/memes/mogui-related.jpg",
    "gallery": [
      {
        "src": "assets/memes/mogui-related.jpg",
        "caption": "相关表达“你是魔鬼吗”的节目截图；用于解释前半句，不是该改编歌的封面。",
        "role": "相关表达配图 · 节目截图",
        "creator": "《爸爸去哪儿》节目画面，来源页转载",
        "sourcePage": "https://www.mnw.cn/keji/internet/2090147.html",
        "originalUrl": "https://upload.mnw.cn/2018/1126/1543224577315.jpg",
        "note": "相关表达截图，保留原水印。不作为“你是魔鬼还是秀儿”改编歌的原始图片。"
      },
      {
        "src": "assets/memes/xiuer-related.png",
        "caption": "2018年报道中的“秀儿，是你吗”评论区截图。",
        "role": "评论区传播示例",
        "creator": "评论区截图，原始截取者未标明",
        "sourcePage": "https://shouyou.3dmgame.com/gl/103617.html",
        "originalUrl": "https://syimg.3dmgame.com/uploadimg/upload/image/20181204/20181204102602_42919.png",
        "note": "相关表达传播示例，保留原水印。"
      }
    ],
    "sources": [
      {
        "title": "你是魔鬼还是秀儿是什么歌改编的",
        "url": "https://www.mnw.cn/yinyue/huayu/2108545.html",
        "note": "闽南网，页面注明来源QQ音乐 · 2019-01-03"
      },
      {
        "title": "抖音上的秀儿是什么意思 秀儿梗怎么来的出处",
        "url": "https://www.mnw.cn/keji/internet/2093904.html",
        "note": "闽南网 · 2018-12-04"
      },
      {
        "title": "抖音评论你是魔鬼吗是什么梗和意思",
        "url": "https://www.mnw.cn/keji/internet/2090147.html",
        "note": "闽南网 · 2018-11-26"
      }
    ]
  },
  'missing-caption-image': {
    id: 'missing-caption-image',
    name: '蓝瘦香菇图片',
    location: '旧网驿站 · 邮箱前的漂浮文件夹',
    summary: '一张带有人物表情、蓝色蘑菇与“蓝瘦香菇”文字的图片。它表达的心情，需要结合文字和语境理解。',
    content: [
      '图中能看到人物表情、蓝色蘑菇、自然背景，以及底部“蓝瘦香菇”四个字。',
      '仅凭图片，可以识别这些视觉元素；要理解它为什么用于聊天，还需要寻找文字含义与使用语境。',
      '在回声档案馆的旧终端里，可以查看与这张图片相关的读音便笺。',
    ],
    sourceLabel: '用户提供图片 · 来源待核验',
    sourceNote: '本游戏使用用户上传的原始图片。原作者、制作时间与最初传播出处尚未核验，不将其标为首发原件。',
    image: 'assets/blue-mushroom-meme.png',
  },
  'echo-meaning-note': {
    id: 'echo-meaning-note',
    name: '读音便笺',
    location: '回声档案馆 · 旧终端',
    summary: '“蓝瘦香菇”与“难受，想哭”的读音联系，帮助解释图片为什么能表达情绪。',
    image: 'assets/blue-mushroom-meme.png',
    content: [
      '读音示意：“难受，想哭” ↔ “蓝瘦香菇”。这里用文字并列提示近似读音关系，不提供或冒充原始录音。',
      '“难受，想哭”指向难过、委屈或失落的感受；在熟悉这一表达的聊天中，“蓝瘦香菇”可以借这种读音联系表达心情。',
      '“蓝”和“香菇”又能被画成蓝色蘑菇，让一句情绪表达变成容易认出的图像。它不是在认真介绍蘑菇品种。',
      '理解这层联系，只说明你认出了意思；是否适合发送，还要看对方的处境和彼此约定的语气。',
    ],
    sourceLabel: '读音示意 · 无原始录音',
    sourceNote: '本卡依据下列已复核的新闻报道整理为文字读音示意。报道是二手参考，不是首发原件。本项目未收录或核验原始录音，也未确认上传图片的最初出处。',
    sources: [
      {
        title: '新华社／新华网：《咬文嚼字》公布2016年十大流行语',
        url: 'https://www.xinhuanet.com/politics/2016-12/15/c_1120121641.htm',
        note: '报道的第十项说明“蓝瘦，香菇”与“难受，想哭”的谐音联系，并讨论文字表达的视觉化。用于支持本卡的词语解释，不用于认定上传图片的出处。',
      },
      {
        title: 'SBS中文：为什么大家都在搜“蓝瘦香菇”？南宁失恋小哥一夜刷爆朋友圈',
        url: 'https://www.sbs.com.au/language/chinese/zh-hans/article/why-are-chinese-netizens-crazy-about-blue-skinny-mushroom/2ijwznvas',
        note: '报道并列呈现两种文字写法，并提到模仿、歌曲及表情包改编。本游戏仅参考报道文字，未把页面嵌入的视频当作已核验的原始录音。',
      },
    ],
  },
  // Retired station cards remain recognized only for v1 save compatibility.
  'echo-chat-context': {
    id: 'echo-chat-context',
    name: '聊天片段',
    location: '回声档案馆 · 聊天窗口',
    summary: '同一张图片，在熟悉朋友主动自嘲和认真求助两种语境中，会产生不同效果。',
    content: [
      '游戏创作示例。小林和阿遥是熟悉彼此语气的游戏好友，也都理解“蓝瘦香菇”的意思。',
      '小林：“刚才那局又输啦，我先蓝瘦香菇一下哈哈。歇一会儿再开！”',
      '阿遥：“收到这朵香菇，缓一缓，下一局一起。”小林先用轻松的方式自嘲失利，阿遥在双方理解的前提下接上相近语气。',
      '对照情境。小林：“最近真的很难受，我不是在开玩笑。能听我说一会儿吗？”',
      '这时可以用普通语言回应：“我在，你慢慢说。你希望我先听着，还是一起想办法？”直接抛出表情梗可能让对方觉得没有被认真听见。',
      '能认出图片不等于所有时候都适合发它。先确认语气、关系与当下需要，也可以一直选择普通语言。',
    ],
    sourceLabel: '游戏情境示例 · 非历史聊天记录',
    sourceNote: '人物、关系和对话均为本游戏创作，用于比较语境；不是从真实聊天或早期传播材料中摘录的证据。',
  },
  'echo-image-variants': {
    id: 'echo-image-variants',
    name: '图片改编记录',
    location: '回声档案馆 · 图片缓存',
    summary: '保留原图的识别线索，给同一张图添加新配文，表达具体经历。',
    content: [
      '参考素材：已收集的“蓝瘦香菇图片”。以下版本只复用这张原图并附上新配文，不声称它们是历史上流传过的版本。',
      '游戏改编示例 A：“最后一局还是输了，先休息，明天再来。”配文把失落感放进游戏连败后的轻松自嘲。',
      '游戏改编示例 B：“刚排好的版又要返工，我先叹一口气。”配文把失落感放进自己面对项目返工时的一次吐槽。',
      '保留部分：人物表情、蓝色蘑菇、背景与“蓝瘦香菇”文字。改动部分：新增一句讲述具体经历的配文。',
      '新情境会改变接收者的理解；配文并不会自动保证合适。面对认真求助的人，优先清楚地表达关心，而不是照搬这些示例。',
    ],
    sourceLabel: '游戏改编示例 · 原图加配文',
    sourceNote: '底图来自用户提供图片，原始出处待核验。A/B 配文为游戏创作，未将其标为已有历史改编。',
    image: 'assets/blue-mushroom-meme.png',
    variants: [
      { caption: '最后一局还是输了，先休息，明天再来。', context: '游戏连败后，对熟悉的好友轻松自嘲。' },
      { caption: '刚排好的版又要返工，我先叹一口气。', context: '自己遇到项目返工，讲述具体经历、轻轻吐槽。' },
    ],
  },
};

/** Legacy answer validation for v1 saves; there is no active association UI. */
export const ARCHIVE_QUESTIONS: ArchiveQuestion[] = [
  {
    id: 'meaning',
    title: '判断一：图片在表达什么？',
    prompt: '结合“蓝瘦香菇图片”和“读音便笺”，这张图为什么能用来表达心情？',
    options: [
      {
        id: 'emotion',
        text: '借近似读音联系“难受，想哭”，再把它画成蓝色蘑菇。',
        correct: true,
        feedback: '联系建立了。“读音便笺”给出“难受，想哭”与“蓝瘦香菇”的读音示意；“蓝瘦香菇图片”把文字中的颜色与香菇变成了可辨认的图像。',
        referenceIds: ['echo-meaning-note', 'missing-caption-image'],
      },
      {
        id: 'food',
        text: '蓝色是一种可食用蘑菇的品种说明。',
        correct: false,
        feedback: '图片里确实有蘑菇，但“读音便笺”提供的是“难受，想哭”的情绪与读音联系，没有介绍可食用品种。请回看“读音便笺”，再判断它在聊天里表达什么。',
        referenceIds: ['echo-meaning-note'],
      },
      {
        id: 'celebration',
        text: '不看配文和语境，也能确定它一直是在庆祝胜利。',
        correct: false,
        feedback: '“读音便笺”指向失落感；“聊天片段”中的小林是在比赛失利后轻松自嘲。它不能脱离配文与语境，被固定解释成庆祝胜利。',
        referenceIds: ['echo-meaning-note', 'echo-chat-context'],
      },
    ],
  },
  {
    id: 'context',
    title: '判断二：什么时候适合接这个梗？',
    prompt: '根据“聊天片段”，下面哪个情境最符合这次使用“蓝瘦香菇”的方式？',
    options: [
      {
        id: 'shared-self-mockery',
        text: '熟悉的朋友已主动轻松自嘲，双方也理解这张图，可以顺着相同语气回应。',
        correct: true,
        feedback: '这个选择看到了语境。“聊天片段”里，小林先自嘲比赛失利，熟悉他的阿遥才接上相近语气；认真求助的对照情境则适合普通语言回应。“图片改编记录”也说明新配文要与具体处境相配。',
        referenceIds: ['echo-chat-context', 'echo-image-variants'],
      },
      {
        id: 'serious-help',
        text: '朋友明确说不是开玩笑、正在认真求助时，先发这张图让他别想太多。',
        correct: false,
        feedback: '“聊天片段”的对照情境里，对方明确需要被认真倾听。先用普通语言回应他的需要更合适；发梗可能让他觉得自己的难受被轻轻带过。请回看“聊天片段”的两段对话。',
        referenceIds: ['echo-chat-context'],
      },
      {
        id: 'anyone-anytime',
        text: '只要自己知道读音关系，就可以对任何人、在任何时候发送。',
        correct: false,
        feedback: '“读音便笺”帮助理解意思，但“聊天片段”还要求注意关系、语气和当下需要。“图片改编记录”中的新配文也只适用于给定情境，不能当成通用回复。',
        referenceIds: ['echo-meaning-note', 'echo-chat-context', 'echo-image-variants'],
      },
    ],
  },
];

export function createArchiveState(): ArchiveState {
  return { answers: { meaning: null, context: null }, completed: false };
}

export function hasAllClues(clues: readonly string[]): boolean {
  return CLUE_ORDER.every(id => clues.includes(id));
}

/** Unknown answers are dropped; valid incorrect attempts remain available after refresh. */
export function normalizeArchiveAnswers(raw: unknown): ArchiveAnswers {
  const result: ArchiveAnswers = { meaning: null, context: null };
  if (!raw || typeof raw !== 'object') return result;
  const candidate = raw as Record<string, unknown>;
  for (const question of ARCHIVE_QUESTIONS) {
    const id = candidate[question.id];
    if (typeof id === 'string' && question.options.some(option => option.id === id)) result[question.id] = id;
  }
  return result;
}

export function evaluateArchive(answers: Partial<ArchiveAnswers> | null | undefined): { meaning: boolean; context: boolean; allCorrect: boolean } {
  const meaning = ARCHIVE_QUESTIONS[0].options.some(option => option.id === answers?.meaning && option.correct);
  const context = ARCHIVE_QUESTIONS[1].options.some(option => option.id === answers?.context && option.correct);
  return { meaning, context, allCorrect: meaning && context };
}
