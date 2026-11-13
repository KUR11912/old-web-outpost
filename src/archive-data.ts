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
  "collection-friendship-boat": {
    "id": "collection-friendship-boat",
    "name": "Friendship Boat",
    "location": "Grassland north of the Echo Archive",
    "summary": "A small disagreement between friends becomes an exaggerated friendship-ending shipwreck.",
    "period": "Became popular in spring 2016",
    "content": [
      "Two penguins sit in a little boat. When one suddenly becomes thinner, the boat loses its balance and capsizes. This absurd comic turns the invisible idea of friendship into a fragile little boat.",
      "Nandongni's penguin comics spread widely in spring 2016. People replaced the dialogue with everyday complaints about stolen snacks, disagreements, or a friend who secretly worked hard after agreeing to slack off together. Saying that the friendship boat can capsize at any moment usually means pretending to be angry with a friend, rather than actually ending the friendship."
    ],
    "example": {
      "label": "Example written for this game",
      "text": "We agreed to get lost together, but you secretly opened the map? There goes our friendship boat!"
    },
    "contextNote": "Works as light teasing between friends. If someone is seriously upset, replying with only a capsizing-boat meme can feel dismissive.",
    "sourceLabel": "Supplied archive pack · source notes",
    "sourceNote": "The widely circulated penguin comics are by Nandongni. The phrase was already in circulation before those comics became popular, so the comic artist should not automatically be credited as the first person to invent the phrase.",
    "image": "assets/memes/friendship-boat.jpg",
    "gallery": [
      {
        "src": "assets/memes/friendship-boat.jpg",
        "caption": "A penguin comic by Nandongni, in the version accompanying a 2016 Xinhua article.",
        "role": "Illustration from a contemporary news report",
        "creator": "Nandongni",
        "sourcePage": "https://www.xinhuanet.com/politics/2016-04/15/c_128896932.htm",
        "originalUrl": "https://www.xinhuanet.com/politics/2016-04/15/128896932_14606747597881n.jpg",
        "note": "An image republished in a contemporary report; not identified as the first uploaded file."
      }
    ],
    "sources": [
      {
        "title": "Meet the original artist of the Friendship Boat comics",
        "url": "https://www.xinhuanet.com/politics/2016-04/15/c_128896932.htm",
        "note": "Chengdu Business Daily / Xinhua · 2016-04-15"
      }
    ]
  },
  "collection-gg-or-mm": {
    "id": "collection-gg-or-mm",
    "name": "Are You GG or MM?",
    "location": "Woodland clearing southeast of the Echo Archive · west riverbank",
    "summary": "An icebreaker from early chat rooms: GG stands for gege (older brother), while MM means meimei (younger sister) or meimei (pretty girl).",
    "period": "Common around the turn of the millennium and in the early 2000s",
    "content": [
      "In early Chinese chat rooms, forums and QQ conversations, people shortened gege and meimei to their pinyin initials, GG and MM. \"Are you GG or MM?\" roughly asked whether the other person was a boy or a girl, and served as an opening line between strangers online. These terms did not imply a family relationship or necessarily indicate someone's actual age.",
      "GG and MM already appeared in reports about internet slang in 2000. Using the question today often imitates the tone of early online chat, recalling the feeling of meeting a new internet friend."
    ],
    "example": {
      "label": "Example written for this game",
      "text": "Hi, are you GG or MM? Do you like playing games too?"
    },
    "contextNote": "This is chat slang from a particular era. Here, GG means gege, or older brother; it is a different use from the English gaming abbreviation for \"good game\".",
    "sourceLabel": "Supplied archive pack · source notes",
    "sourceNote": "This language developed collectively among early internet users. No single creator or exact first publication date has been confirmed. The accompanying image shows an old QQ interface and does not contain this conversation.",
    "image": "assets/memes/gg-mm-qq-context.jpg",
    "gallery": [
      {
        "src": "assets/memes/gg-mm-qq-context.jpg",
        "caption": "An old QQ interface, provided as background for early online chatting. This is not an original chat record containing the question.",
        "role": "Historical interface context",
        "creator": "Old QQ interface; screenshot creator not identified",
        "sourcePage": "https://sdxw.iqilu.com/share/YS0yMS02MTYyMDU=.html",
        "originalUrl": "https://img9.iqilu.com/wx/2017/11/22/191447nyouaueu0hl0.jpg",
        "note": "Background image only. There is no GG/MM conversation in it. The date given on the source page differs from text visible in the image, so no exact year is assigned to this screenshot."
      }
    ],
    "sources": [
      {
        "title": "Do you understand internet slang?",
        "url": "https://news.zol.com.cn/2000/0605/5062.shtml",
        "note": "ZOL · 2000-06-05"
      },
      {
        "title": "Shanghai language experts: internet language is part of the development of Chinese",
        "url": "https://news.sina.com.cn/c/2001-08-09/324406.html",
        "note": "Morning News / Sina · 2001-08-09"
      }
    ]
  },
  "collection-awesome-my-bro": {
    "id": "collection-awesome-my-bro",
    "name": "Awesome, My Bro!",
    "location": "Southern grassland · west of the river",
    "summary": "An exaggerated, friendly and slightly comic way to say, \"You are amazing!\"",
    "period": "Widely popular in 2016",
    "content": [
      "When someone pulls off a difficult move or reveals an unexpected skill, people may reply with \"Li hai le wo de ge\" — roughly, \"Awesome, my bro!\" Here, \"bro\" is often a friendly way to address someone, rather than a reference to an actual older brother. An exaggerated reaction image makes the compliment feel like a round of applause.",
      "Reports from 2016 already documented its widespread use and variations such as \"Li hai le, word ge.\" In that version, the English word \"word\" playfully approximates the sound of wo de (my). The phrase can express sincere admiration or a touch of sarcasm in an absurd situation, depending on the tone shared by the people involved."
    ],
    "example": {
      "label": "Example written for this game",
      "text": "You drew the entire map in Notepad? Awesome, my bro!"
    },
    "contextNote": "It can praise a genuinely impressive performance. After someone embarrasses themselves or makes a mistake, the same reply may sound mocking.",
    "sourceLabel": "Supplied archive pack · source notes",
    "sourceNote": "Contemporary reports offer several origin stories. The story of a military-training instructor taking over a phone to play a game is not sufficiently verified as the sole source. This archive records the documented period of popularity and usage.",
    "image": "assets/memes/lihai-le-wode-ge.jpg",
    "gallery": [
      {
        "src": "assets/memes/lihai-le-wode-ge.jpg",
        "caption": "An online reaction image bearing the Chinese phrase translated here as \"Awesome, My Bro!\" The image creator is not identified.",
        "role": "Representative reaction image",
        "creator": "Not identified",
        "sourcePage": "https://www.chinlingo.com/articles/601702/",
        "originalUrl": "https://www.chinlingo.com/daily/upload/ueditor/image/20161116/13781479278344956.jpg",
        "note": "The supplied pack reports that the image was downloaded and inspected, but its source page could not be retrieved during preparation. The date in the image URL is not treated as a first publication date."
      }
    ],
    "sources": [
      {
        "title": "What does the viral phrase \"Awesome, My Bro!\" mean?",
        "url": "https://www.ithome.com/0/258/417.htm",
        "note": "IT Home · 2016-09-18"
      },
      {
        "title": "Awesome, my internet buzzwords",
        "url": "https://paper.people.com.cn/rmrbhwb/html/2016-10/24/content_1720841.htm",
        "note": "People's Daily Overseas Edition · 2016-10-24"
      }
    ]
  },
  "collection-devil-or-showoff": {
    "id": "collection-devil-or-showoff",
    "name": "Devil or Show-off?",
    "location": "Woodland clearing southeast of the bridge · east riverbank",
    "summary": "A reaction somewhere between \"That was ruthless!\" and \"What a show-off!\", mixing surprise, admiration and teasing.",
    "period": "Related expressions were popular in 2018; a parody song using the combined phrase was reported in early 2019",
    "content": [
      "\"Are you a devil?\" often reacts to a cutting remark or an unexpected move. \"Xiu'er, is that you?\" turns the idea of being outstanding or showing off into a teasing nickname. Both use exaggerated surprise to say, \"I did not see that coming.\"",
      "A January 2019 report already described \"Are you a devil or Xiu'er?\" as a popular parody song. It used the melody of \"Mo Gui Zhong De Tian Shi\" (Angel in the Devil) and linked together several short-video catchphrases of the time. In conversation, the question can convey both admiration and an urge to tease."
    ],
    "example": {
      "label": "Example written for this game",
      "text": "You made a screenshot of a computer error your wallpaper? Devil or show-off?"
    },
    "contextNote": "Best suited to jokes between people who understand each other's tone. \"Devil\" is an exaggeration, and \"Xiu'er\" is not a serious request for someone's name.",
    "sourceLabel": "Supplied archive pack · source notes",
    "sourceNote": "Reports confirm that a parody song using the full phrase existed by early 2019, but its first uploader has not been verified. The television screenshot of \"Are you a devil?\" explains a related expression; it does not establish that the full combined phrase was an original line from the show.",
    "image": "assets/memes/mogui-related.jpg",
    "gallery": [
      {
        "src": "assets/memes/mogui-related.jpg",
        "caption": "A television screenshot of the related expression \"Are you a devil?\" It illustrates the first half of the phrase and is not the parody song's cover image.",
        "role": "Related expression · television screenshot",
        "creator": "Frame from Where Are We Going, Dad?, republished on the source page",
        "sourcePage": "https://www.mnw.cn/keji/internet/2090147.html",
        "originalUrl": "https://upload.mnw.cn/2018/1126/1543224577315.jpg",
        "note": "A screenshot illustrating a related expression, with its original watermark retained. It is not presented as an original image for the \"Devil or Show-off?\" parody song."
      },
      {
        "src": "assets/memes/xiuer-related.png",
        "caption": "A comment-section screenshot showing \"Xiu'er, is that you?\", included in a 2018 report.",
        "role": "Example of circulation in comments",
        "creator": "Comment-section screenshot; original screenshot creator not identified",
        "sourcePage": "https://shouyou.3dmgame.com/gl/103617.html",
        "originalUrl": "https://syimg.3dmgame.com/uploadimg/upload/image/20181204/20181204102602_42919.png",
        "note": "An example of a related expression in circulation. The original watermark is retained."
      }
    ],
    "sources": [
      {
        "title": "Which song was adapted into \"Are you a devil or Xiu'er?\"",
        "url": "https://www.mnw.cn/yinyue/huayu/2108545.html",
        "note": "Minnan Net; the page credits QQ Music as its source · 2019-01-03"
      },
      {
        "title": "What does Xiu'er mean on Douyin, and where did the meme come from?",
        "url": "https://www.mnw.cn/keji/internet/2093904.html",
        "note": "Minnan Net · 2018-12-04"
      },
      {
        "title": "What does \"Are you a devil?\" mean in Douyin comments?",
        "url": "https://www.mnw.cn/keji/internet/2090147.html",
        "note": "Minnan Net · 2018-11-26"
      }
    ]
  },
  "missing-caption-image": {
    "id": "missing-caption-image",
    "name": "Blue and Mushroom Image",
    "location": "Old Web Outpost · floating folder in front of the mailbox",
    "summary": "An image combining a face, a blue mushroom and the Chinese words \"Lan Shou Xiang Gu.\" Its emotional meaning depends on the wording and context.",
    "content": [
      "The image contains a face, a blue mushroom, a natural background and the Chinese characters for \"Lan Shou Xiang Gu\" along the bottom.",
      "The visual elements are easy to recognize on their own. Understanding why the image is used in conversation also requires the meaning of the words and the context in which they are sent.",
      "The old terminal at the Echo Archive contains a pronunciation note related to this image."
    ],
    "sourceLabel": "User-supplied image · origin unverified",
    "sourceNote": "The game uses the original image file supplied by the user. Its creator, production date and earliest circulation have not been verified, so it is not presented as the first published original.",
    "image": "assets/blue-mushroom-meme.png"
  },
  "echo-meaning-note": {
    "id": "echo-meaning-note",
    "name": "Pronunciation Note",
    "location": "Echo Archive · old terminal",
    "summary": "The similar sounds of \"Lan Shou Xiang Gu\" and \"nan shou, xiang ku\" (feeling awful, wanting to cry) explain how the image conveys emotion.",
    "image": "assets/blue-mushroom-meme.png",
    "content": [
      "Pronunciation comparison: \"nan shou, xiang ku\" (feeling awful, wanting to cry) ↔ \"lan shou, xiang gu\" (blue, skinny, mushroom). This written comparison illustrates a resemblance in sound; it does not supply or impersonate an original recording.",
      "\"Feeling awful, wanting to cry\" conveys sadness, hurt or disappointment. In conversations where people know this expression, \"Lan Shou Xiang Gu\" can use the resemblance in sound to express that feeling.",
      "The words for blue and mushroom can also be drawn as a blue mushroom, turning an emotional expression into a recognizable image. It is not a serious description of a mushroom species.",
      "Recognizing the connection means you understand the expression. Whether it is appropriate to send still depends on the other person's situation and the tone you share."
    ],
    "sourceLabel": "Written pronunciation guide · no original recording",
    "sourceNote": "This card summarizes the word relationship described in the news reports listed below. Those reports are secondary references, not original first publications. The project does not include or verify an original recording, and the earliest source of the supplied image remains unconfirmed.",
    "sources": [
      {
        "title": "Xinhua: Yaowen Jiaozi announces its ten buzzwords of 2016",
        "url": "https://www.xinhuanet.com/politics/2016-12/15/c_1120121641.htm",
        "note": "The tenth entry explains the similar sounds of \"Lan Shou Xiang Gu\" and \"nan shou, xiang ku\" and discusses turning written expressions into images. It supports this card's explanation of the words, not a provenance claim about the uploaded image."
      },
      {
        "title": "SBS Chinese: Why are Chinese netizens searching for \"Blue Skinny Mushroom\"?",
        "url": "https://www.sbs.com.au/language/chinese/zh-hans/article/why-are-chinese-netizens-crazy-about-blue-skinny-mushroom/2ijwznvas",
        "note": "The report places the two written expressions side by side and mentions imitations, songs and reaction-image adaptations. The game refers only to the report's text; its embedded video is not treated as a verified original recording."
      }
    ]
  },
  "echo-chat-context": {
    "id": "echo-chat-context",
    "name": "Chat Excerpt",
    "location": "Echo Archive · chat window",
    "summary": "The same image can have different effects when a familiar friend is joking about a setback and when someone is seriously asking for support.",
    "content": [
      "Example written for this game. Lin and Yao are gaming friends who know each other's tone and both understand \"Blue and Mushroom.\"",
      "Lin: \"Lost another round. Time for a little Blue and Mushroom moment, haha. Let's take a break and play again!\"",
      "Yao: \"Mushroom received. Take a breather; we'll play the next one together.\" Lin first jokes lightly about losing, and Yao replies in a similar tone that both understand.",
      "A different situation. Lin: \"I've been feeling really awful lately. I'm not joking. Could you listen for a while?\"",
      "A plain-language reply could be: \"I'm here. Take your time. Would you like me to listen first, or help you think things through?\" Sending only a meme could make the other person feel unheard.",
      "Recognizing an image does not mean it fits every situation. Consider the tone, your relationship and what the person needs now. Plain language is always an option."
    ],
    "sourceLabel": "Fictional game example · not a historical chat record",
    "sourceNote": "The characters, their relationship and the dialogue were written for this game to compare contexts. They are not evidence quoted from real conversations or early circulation records."
  },
  "echo-image-variants": {
    "id": "echo-image-variants",
    "name": "Image Adaptation Notes",
    "location": "Echo Archive · image cache",
    "summary": "Keep the recognizable features of an image while adding a new caption about a specific experience.",
    "content": [
      "Reference material: the collected Blue and Mushroom image. The versions below reuse that image with new captions. They are not claimed to be versions that circulated historically.",
      "Game example A: \"Lost the last round too. Time for a break; I'll try again tomorrow.\" The caption turns disappointment after a losing streak into light self-mockery.",
      "Game example B: \"The layout I just finished needs redoing. Let me sigh for a moment.\" The caption turns disappointment about revising a project into a small personal complaint.",
      "Retained: the face, blue mushroom, background and original Chinese text. Added: one caption describing a specific experience.",
      "A new context changes how the recipient reads an image; a caption does not automatically make it appropriate. When someone is seriously asking for support, express care clearly instead of copying these examples."
    ],
    "sourceLabel": "Game adaptations · original image with new captions",
    "sourceNote": "The base image was supplied by the user, and its original source remains unverified. Captions A and B were written for the game and are not presented as existing historical adaptations.",
    "image": "assets/blue-mushroom-meme.png",
    "variants": [
      {
        "caption": "Lost the last round too. Time for a break; I'll try again tomorrow.",
        "context": "Light self-mockery shared with a familiar friend after a losing streak."
      },
      {
        "caption": "The layout I just finished needs redoing. Let me sigh for a moment.",
        "context": "A small complaint about the specific experience of having to revise a project."
      }
    ]
  }
};

/** Legacy answer validation for v1 saves; there is no active association UI. */
export const ARCHIVE_QUESTIONS: ArchiveQuestion[] = [
  {
    "id": "meaning",
    "title": "Question 1: What does the image express?",
    "prompt": "Using the Blue and Mushroom Image and the Pronunciation Note, why can this image convey a feeling?",
    "options": [
      {
        "id": "emotion",
        "text": "It echoes the sound of \"feeling awful, wanting to cry,\" then turns the resulting words into a blue mushroom.",
        "correct": true,
        "feedback": "Connection found. The Pronunciation Note compares \"nan shou, xiang ku\" with \"Lan Shou Xiang Gu,\" and the Blue and Mushroom Image turns the words for blue and mushroom into something recognizable.",
        "referenceIds": [
          "echo-meaning-note",
          "missing-caption-image"
        ]
      },
      {
        "id": "food",
        "text": "The blue color identifies an edible species of mushroom.",
        "correct": false,
        "feedback": "There is a mushroom in the image, but the Pronunciation Note explains a connection to sadness and sound, not an edible species. Read the note again and consider what the image expresses in conversation.",
        "referenceIds": [
          "echo-meaning-note"
        ]
      },
      {
        "id": "celebration",
        "text": "It always celebrates a victory, regardless of the caption or context.",
        "correct": false,
        "feedback": "The Pronunciation Note points to disappointment. In the Chat Excerpt, Lin jokes lightly after losing a game. Without its caption and context, the image cannot always be read as a celebration.",
        "referenceIds": [
          "echo-meaning-note",
          "echo-chat-context"
        ]
      }
    ]
  },
  {
    "id": "context",
    "title": "Question 2: When does this reply fit?",
    "prompt": "Based on the Chat Excerpt, which situation best matches this use of Blue and Mushroom?",
    "options": [
      {
        "id": "shared-self-mockery",
        "text": "A familiar friend has already joked lightly about their setback, and you both understand the image, so you can reply in the same tone.",
        "correct": true,
        "feedback": "This choice considers the context. In the Chat Excerpt, Lin jokes about losing first; Yao, who knows Lin well, follows that tone. The contrasting request for support calls for plain language. The Image Adaptation Notes also show why a new caption should fit the particular situation.",
        "referenceIds": [
          "echo-chat-context",
          "echo-image-variants"
        ]
      },
      {
        "id": "serious-help",
        "text": "A friend says they are not joking and seriously asks for support, so send the image first to tell them not to worry.",
        "correct": false,
        "feedback": "In the contrasting Chat Excerpt, the person explicitly needs someone to listen seriously. Responding to that need in plain language is more appropriate; a meme might feel dismissive. Read the two conversations again.",
        "referenceIds": [
          "echo-chat-context"
        ]
      },
      {
        "id": "anyone-anytime",
        "text": "Once you know the sound connection, you can send it to anyone at any time.",
        "correct": false,
        "feedback": "The Pronunciation Note explains the meaning, but the Chat Excerpt also asks you to consider the relationship, tone and current needs. The new captions in the Image Adaptation Notes fit specific situations rather than serving as universal replies.",
        "referenceIds": [
          "echo-meaning-note",
          "echo-chat-context",
          "echo-image-variants"
        ]
      }
    ]
  }
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
