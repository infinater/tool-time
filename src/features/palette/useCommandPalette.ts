import { useEffect } from "react";

/* ------------------------------------------------------------------ *
 * 对外类型
 * ------------------------------------------------------------------ */

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  /** 额外参与搜索的文本（拼音、别名等） */
  keywords?: string;
  run: () => void;
}

/* ------------------------------------------------------------------ *
 * 快捷键：Ctrl+K / Cmd+K 切换
 * ------------------------------------------------------------------ */

/**
 * 监听 Ctrl+K / Cmd+K 并阻止浏览器默认行为。
 * Esc 不在全局处理，由面板自身在打开状态下接管。
 */
export function useCommandPaletteHotkey(
  open: boolean,
  onOpenChange: (open: boolean) => void,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      // 严格对应 Ctrl+K / Cmd+K，避免抢占 Ctrl+Shift+K 等组合
      if (event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      onOpenChange(!open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);
}

/* ------------------------------------------------------------------ *
 * 模糊匹配
 *
 * - 对 title / subtitle / keywords 逐字段做子序列匹配；
 * - 中文额外支持拼音首字母（如 "rj" → "日记"），通过 Intl 拼音排序
 *   推断首字母，无需引入任何数据表或依赖；
 * - 评分偏好：连续命中 > 词首命中 > 靠前命中 > 短文本；
 * - 返回命中位置，供 accent 色高亮。
 * ------------------------------------------------------------------ */

const CHAR_SCORE = 10;
const LITERAL_BONUS = 3;
const CONSECUTIVE_BONUS = 14;
const WORD_START_BONUS = 12;
const FIRST_CHAR_BONUS = 6;
const EXACT_BONUS = 60;
const PREFIX_BONUS = 24;
const MAX_GAP_PENALTY = 6;

const HAN_RE = /\p{Script=Han}/u;
const WORD_BOUNDARY_RE = /[\s\-_/·.,:;!?()[\]{}<>|"'“”‘’]/;

/** 每个首字母对应的拼音区间下界（按拼音顺序排列） */
const PINYIN_BOUNDARIES: ReadonlyArray<readonly [string, string]> = [
  ["a", "阿"],
  ["b", "八"],
  ["c", "擦"],
  ["d", "搭"],
  ["e", "俄"],
  ["f", "发"],
  ["g", "噶"],
  ["h", "哈"],
  ["j", "击"],
  ["k", "喀"],
  ["l", "拉"],
  ["m", "妈"],
  ["n", "拿"],
  ["o", "哦"],
  ["p", "啪"],
  ["q", "期"],
  ["r", "然"],
  ["s", "撒"],
  ["t", "塌"],
  ["w", "挖"],
  ["x", "昔"],
  ["y", "压"],
  ["z", "匝"],
];

let collator: Intl.Collator | null | undefined;
const initialCache = new Map<string, string>();

function getPinyinCollator(): Intl.Collator | null {
  if (collator !== undefined) return collator;
  collator = null;
  const locales = ["zh-Hans-u-co-pinyin", "zh-Hans", "zh"];
  for (const locale of locales) {
    try {
      const candidate = new Intl.Collator(locale);
      // 用两个已知字符确认该 locale 确实按拼音排序
      if (candidate.compare("阿", "八") < 0 && candidate.compare("日", "然") >= 0) {
        collator = candidate;
        return collator;
      }
    } catch {
      /* 继续尝试下一个 locale */
    }
  }
  return collator;
}

/** 单个汉字的拼音首字母；非汉字或无法推断时返回空串 */
function pinyinInitialOf(char: string): string {
  if (!HAN_RE.test(char)) return "";
  const cached = initialCache.get(char);
  if (cached !== undefined) return cached;

  const zh = getPinyinCollator();
  let initial = "";
  if (zh) {
    for (const [letter, boundary] of PINYIN_BOUNDARIES) {
      if (zh.compare(char, boundary) >= 0) initial = letter;
    }
  }
  initialCache.set(char, initial);
  return initial;
}

interface CharToken {
  lower: string;
  pinyin: string;
  wordStart: boolean;
}

function tokenize(text: string): CharToken[] {
  const chars = Array.from(text);
  return chars.map((raw, index) => {
    const previous = index > 0 ? chars[index - 1] : "";
    const wordStart =
      index === 0 ||
      WORD_BOUNDARY_RE.test(previous) ||
      (/[a-z]/.test(previous) && /[A-Z]/.test(raw));
    return {
      lower: raw.toLowerCase(),
      pinyin: pinyinInitialOf(raw),
      wordStart,
    };
  });
}

function tokenMatches(queryChar: string, token: CharToken): boolean {
  return queryChar === token.lower || (token.pinyin !== "" && queryChar === token.pinyin);
}

export interface FuzzyMatch {
  score: number;
  indices: number[];
}

/**
 * 子序列模糊匹配。查询中的每个字符都必须按顺序命中文本中的一个字符；
 * 汉字既可以按字面命中，也可以按拼音首字母命中。
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const queryChars = Array.from(query.toLowerCase());
  const tokens = tokenize(text);
  const queryLength = queryChars.length;
  const textLength = tokens.length;

  if (queryLength === 0 || textLength === 0 || queryLength > textLength) return null;

  const scores: number[][] = Array.from({ length: queryLength }, () =>
    new Array<number>(textLength).fill(Number.NEGATIVE_INFINITY),
  );
  const parents: number[][] = Array.from({ length: queryLength }, () =>
    new Array<number>(textLength).fill(-1),
  );

  for (let i = 0; i < textLength; i += 1) {
    const token = tokens[i];
    if (!tokenMatches(queryChars[0], token)) continue;
    scores[0][i] =
      CHAR_SCORE +
      (queryChars[0] === token.lower ? LITERAL_BONUS : 0) +
      (token.wordStart ? WORD_START_BONUS : 0) +
      (i === 0 ? FIRST_CHAR_BONUS : 0) -
      Math.min(i, 10) * 0.4;
  }

  for (let q = 1; q < queryLength; q += 1) {
    for (let i = q; i < textLength; i += 1) {
      const token = tokens[i];
      if (!tokenMatches(queryChars[q], token)) continue;

      const charBase =
        CHAR_SCORE +
        (queryChars[q] === token.lower ? LITERAL_BONUS : 0) +
        (token.wordStart ? WORD_START_BONUS : 0);

      let best = Number.NEGATIVE_INFINITY;
      let bestParent = -1;
      for (let p = 0; p < i; p += 1) {
        const previous = scores[q - 1][p];
        if (!Number.isFinite(previous)) continue;
        const gap = i - p - 1;
        const gapCost = gap === 0 ? CONSECUTIVE_BONUS : -(Math.min(MAX_GAP_PENALTY, gap) + 1);
        const candidate = previous + charBase + gapCost;
        if (candidate > best) {
          best = candidate;
          bestParent = p;
        }
      }

      if (bestParent >= 0) {
        scores[q][i] = best;
        parents[q][i] = bestParent;
      }
    }
  }

  let end = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < textLength; i += 1) {
    if (scores[queryLength - 1][i] > bestScore) {
      bestScore = scores[queryLength - 1][i];
      end = i;
    }
  }
  if (end < 0) return null;

  const indices = new Array<number>(queryLength).fill(0);
  let cursor = end;
  for (let q = queryLength - 1; q >= 0; q -= 1) {
    indices[q] = cursor;
    cursor = parents[q][cursor];
  }

  const lowered = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = bestScore - Math.min(text.length, 120) * 0.08;
  if (lowered === normalizedQuery) score += EXACT_BONUS;
  else if (lowered.startsWith(normalizedQuery)) score += PREFIX_BONUS;

  return { score, indices };
}

/* ------------------------------------------------------------------ *
 * 命令排序与分组
 * ------------------------------------------------------------------ */

export interface RankedCommand {
  command: PaletteCommand;
  score: number;
  titleIndices: number[];
  subtitleIndices: number[];
  order: number;
}

export interface CommandGroup {
  name: string;
  items: RankedCommand[];
}

const FIELD_WEIGHTS = {
  title: 1,
  subtitle: 0.55,
  keywords: 0.68,
} as const;

type FieldKey = keyof typeof FIELD_WEIGHTS;

interface FieldSpan {
  key: FieldKey;
  start: number;
  end: number;
}

function matchCommand(command: PaletteCommand, query: string): Omit<RankedCommand, "command" | "order"> | null {
  const fields: Array<{ key: FieldKey; text: string }> = [
    { key: "title", text: command.title },
    { key: "subtitle", text: command.subtitle ?? "" },
    { key: "keywords", text: command.keywords ?? "" },
  ];

  let bestScore = Number.NEGATIVE_INFINITY;
  let titleIndices: number[] = [];
  let subtitleIndices: number[] = [];

  for (const field of fields) {
    if (!field.text) continue;
    const match = fuzzyMatch(query, field.text);
    if (!match) continue;
    const weighted = match.score * FIELD_WEIGHTS[field.key];
    if (weighted > bestScore) {
      bestScore = weighted;
      titleIndices = field.key === "title" ? match.indices : [];
      subtitleIndices = field.key === "subtitle" ? match.indices : [];
    }
  }

  if (Number.isFinite(bestScore)) {
    return { score: bestScore, titleIndices, subtitleIndices };
  }

  // 兜底：允许查询跨字段命中（例如 "设置 主题"），命中位置映射回各字段
  let combined = "";
  const spans: FieldSpan[] = [];
  for (const field of fields) {
    if (!field.text) continue;
    if (combined.length > 0) combined += " ";
    const start = combined.length;
    combined += field.text;
    spans.push({ key: field.key, start, end: combined.length });
  }
  if (!combined) return null;

  const crossField = fuzzyMatch(query, combined);
  if (!crossField) return null;

  titleIndices = [];
  subtitleIndices = [];
  for (const index of crossField.indices) {
    const span = spans.find((item) => index >= item.start && index < item.end);
    if (!span) continue;
    if (span.key === "title") titleIndices.push(index - span.start);
    else if (span.key === "subtitle") subtitleIndices.push(index - span.start);
  }

  return {
    score: crossField.score * 0.5,
    titleIndices,
    subtitleIndices,
  };
}

/**
 * 过滤 + 排序。空查询时按原始顺序取前 `emptyLimit` 条。
 */
export function rankCommands(
  commands: readonly PaletteCommand[],
  query: string,
  emptyLimit = 10,
): RankedCommand[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return commands.slice(0, emptyLimit).map((command, order) => ({
      command,
      score: 0,
      titleIndices: [],
      subtitleIndices: [],
      order,
    }));
  }

  const ranked: RankedCommand[] = [];
  commands.forEach((command, order) => {
    const match = matchCommand(command, normalized);
    if (match) ranked.push({ ...match, command, order });
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.command.title.length - b.command.title.length ||
      a.order - b.order,
  );

  return ranked;
}

/** 按 group 首次出现顺序分组，组内保持传入顺序 */
export function groupRanked(items: readonly RankedCommand[]): CommandGroup[] {
  const groups = new Map<string, RankedCommand[]>();
  for (const item of items) {
    const existing = groups.get(item.command.group);
    if (existing) existing.push(item);
    else groups.set(item.command.group, [item]);
  }
  return Array.from(groups, ([name, groupItems]) => ({ name, items: groupItems }));
}
