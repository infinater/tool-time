/**
 * 专注名言静态数据（不联网）。
 *
 * 收录原则：
 * - 只收出处可查证的句子，不确定出处的宁可不收，绝不编造名人名言；
 * - 中文原文用全角标点，引号用「」；
 * - 单条不超过 40 个字符，保证在 360px 宽的侧栏里两行放得下；
 * - source 记录可查证的出处，便于日后核对。
 */
export type QuoteTag = "focus" | "persist" | "calm";

export interface Quote {
  /** 名言正文，≤ 40 字 */
  text: string;
  /** 作者（能查证的名字；经典著作可直接用书名） */
  author: string;
  /** 出处（书名 / 篇名），可选 */
  source?: string;
  /** 主题标签，可选 */
  tag?: QuoteTag;
}

export const QUOTES: Quote[] = [
  // ---------- 中文：专注 / 坚持 ----------
  {
    text: "其实地上本没有路，走的人多了，也便成了路。",
    author: "鲁迅",
    source: "《故乡》",
    tag: "persist",
  },
  {
    text: "凡人做一事，便须全副精神注在此一事。",
    author: "曾国藩",
    source: "《家书》",
    tag: "focus",
  },
  {
    text: "不积跬步，无以至千里；不积小流，无以成江海。",
    author: "荀子",
    source: "《劝学》",
    tag: "persist",
  },
  {
    text: "千里之行，始于足下。",
    author: "老子",
    source: "《道德经》",
    tag: "persist",
  },
  {
    text: "无欲速，无见小利。欲速则不达，见小利则大事不成。",
    author: "孔子",
    source: "《论语·子路》",
    tag: "calm",
  },
  {
    text: "博观而约取，厚积而薄发。",
    author: "苏轼",
    source: "《稼说送张琥》",
    tag: "persist",
  },
  {
    text: "非淡泊无以明志，非宁静无以致远。",
    author: "诸葛亮",
    source: "《诫子书》",
    tag: "calm",
  },
  {
    text: "盛年不重来，一日难再晨。及时当勉励，岁月不待人。",
    author: "陶渊明",
    source: "《杂诗》",
    tag: "calm",
  },
  {
    text: "人须在事上磨，方立得住。",
    author: "王阳明",
    source: "《传习录》",
    tag: "persist",
  },
  {
    text: "岁月本长，而忙者自促。",
    author: "洪应明",
    source: "《菜根谭》",
    tag: "calm",
  },
  {
    text: "纸上得来终觉浅，绝知此事要躬行。",
    author: "陆游",
    source: "《冬夜读书示子聿》",
    tag: "persist",
  },
  {
    text: "业精于勤，荒于嬉；行成于思，毁于随。",
    author: "韩愈",
    source: "《进学解》",
    tag: "persist",
  },
  {
    text: "用志不分，乃凝于神。",
    author: "庄子",
    source: "《庄子·达生》",
    tag: "focus",
  },
  {
    text: "人有不为也，而后可以有为。",
    author: "孟子",
    source: "《孟子·离娄下》",
    tag: "focus",
  },
  {
    text: "临河而羡鱼，不如归家织网。",
    author: "刘安",
    source: "《淮南子·说林训》",
    tag: "persist",
  },

  // ---------- 外国：专注 / 坚持 / 慢下来 ----------
  {
    text: "人生最大的幸运，是在年富力强时发现自己的使命。",
    author: "斯蒂芬·茨威格",
    source: "《人类群星闪耀时》",
    tag: "persist",
  },
  {
    text: "不是我们的生命太短，而是我们浪费得太多。",
    author: "塞内加",
    source: "《论生命之短暂》",
    tag: "calm",
  },
  {
    text: "把每一件事，都当作生命中最后一件事来做。",
    author: "马可·奥勒留",
    source: "《沉思录》",
    tag: "focus",
  },
  {
    text: "高质量产出，等于时间乘以专注强度。",
    author: "卡尔·纽波特",
    source: "《深度工作》",
    tag: "focus",
  },
  {
    text: "今天不想跑，所以才去跑。",
    author: "村上春树",
    source: "《当我谈跑步时我谈些什么》",
    tag: "persist",
  },
  {
    text: "痛苦难以避免，磨难可以选择。",
    author: "村上春树",
    source: "《当我谈跑步时我谈些什么》",
    tag: "persist",
  },
  {
    text: "你不会升到目标的高度，只会跌到系统的水平。",
    author: "詹姆斯·克利尔",
    source: "《原子习惯》",
    tag: "focus",
  },
  {
    text: "每天进步百分之一，一年后你会强大三十七倍。",
    author: "詹姆斯·克利尔",
    source: "《原子习惯》",
    tag: "persist",
  },
  {
    text: "一只鸟一只鸟地来，一步一步地写。",
    author: "安妮·拉莫特",
    source: "《关于写作》",
    tag: "persist",
  },
  {
    text: "你热爱生命吗？那就别浪费时间，因为生命由时间构成。",
    author: "本杰明·富兰克林",
    source: "《穷理查年鉴》",
    tag: "calm",
  },
  {
    text: "知道自己为什么而活，就能忍受几乎任何一种生活。",
    author: "尼采",
    source: "《偶像的黄昏》",
    tag: "persist",
  },
  {
    text: "世上只有一种英雄主义，就是认清生活真相后依然热爱它。",
    author: "罗曼·罗兰",
    source: "《米开朗琪罗传》",
    tag: "persist",
  },
  {
    text: "我步入丛林，因为我希望活得有意义。",
    author: "梭罗",
    source: "《瓦尔登湖》",
    tag: "calm",
  },
  {
    text: "人类所有的不幸，都源于不能独自安静地待在房间里。",
    author: "帕斯卡尔",
    source: "《思想录》",
    tag: "calm",
  },
  {
    text: "完美不是无可添加，而是无可删减。",
    author: "圣埃克苏佩里",
    source: "《人的大地》",
    tag: "focus",
  },
  {
    text: "时间是最稀缺的资源，不管理好它，别的都管不了。",
    author: "彼得·德鲁克",
    source: "《卓有成效的管理者》",
    tag: "calm",
  },
  {
    text: "扰乱我们的不是事情本身，而是我们对事情的看法。",
    author: "爱比克泰德",
    source: "《手册》",
    tag: "calm",
  },
];
