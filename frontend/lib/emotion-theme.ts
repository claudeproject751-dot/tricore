/**
 * One source of truth for how each emotion looks and reads across the product.
 * Colours mirror the CSS custom properties in app/globals.css and the training
 * charts in ml/common.py, so a bar, a radar spoke and a confusion matrix all
 * agree on what "joy" looks like.
 */

export const EMOTIONS = ["sadness", "joy", "love", "anger", "fear", "surprise"] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type EmotionMeta = {
  label: string;
  emoji: string;
  /** CSS var reference — theme-aware, resolves per light/dark. */
  color: string;
  /** Literal hex, for contexts that cannot read CSS vars (canvas, meta tags). */
  hex: string;
  /** Shown under the dominant-emotion card. Descriptive, never diagnostic. */
  blurb: string;
  /** One-word register used in chips and tooltips. */
  tone: string;
};

export const EMOTION_META: Record<Emotion, EmotionMeta> = {
  joy: {
    label: "Joy",
    emoji: "😊",
    color: "hsl(var(--joy))",
    hex: "#F5B942",
    blurb: "Bright, energised language — delight, gratitude, celebration.",
    tone: "elated",
  },
  sadness: {
    label: "Sadness",
    emoji: "😔",
    color: "hsl(var(--sadness))",
    hex: "#4A7FE0",
    blurb: "Low, heavy phrasing — loss, disappointment, withdrawal.",
    tone: "downcast",
  },
  love: {
    label: "Love",
    emoji: "🥰",
    color: "hsl(var(--love))",
    hex: "#E85D8C",
    blurb: "Warm and attached — affection, tenderness, devotion.",
    tone: "tender",
  },
  anger: {
    label: "Anger",
    emoji: "😠",
    color: "hsl(var(--anger))",
    hex: "#E5484D",
    blurb: "Sharp and confrontational — frustration, outrage, blame.",
    tone: "heated",
  },
  fear: {
    label: "Fear",
    emoji: "😨",
    color: "hsl(var(--fear))",
    hex: "#8B5CF6",
    blurb: "Tense and anticipatory — worry, dread, unease.",
    tone: "anxious",
  },
  surprise: {
    label: "Surprise",
    emoji: "😮",
    color: "hsl(var(--surprise))",
    hex: "#2DD4BF",
    blurb: "Abrupt and unexpected — astonishment, disbelief, shock.",
    tone: "startled",
  },
};

/** Display order for charts and legends: warm to cool, joy first. */
export const EMOTION_ORDER: Emotion[] = ["joy", "love", "surprise", "sadness", "fear", "anger"];

export function isEmotion(value: string): value is Emotion {
  return (EMOTIONS as readonly string[]).includes(value);
}

export function metaFor(label: string): EmotionMeta {
  return isEmotion(label) ? EMOTION_META[label] : FALLBACK_META;
}

const FALLBACK_META: EmotionMeta = {
  label: "Unknown",
  emoji: "🫥",
  color: "hsl(var(--muted))",
  hex: "#71717A",
  blurb: "Outside the six trained classes.",
  tone: "unclear",
};

/**
 * How firmly to phrase a result. The model always returns a winner, so the copy
 * has to carry the uncertainty that a single top label hides.
 */
export function confidenceBand(score: number): {
  key: "certain" | "confident" | "leaning" | "unsure";
  label: string;
  note: string;
} {
  if (score >= 0.9) {
    return { key: "certain", label: "Very confident", note: "A clear, unambiguous signal." };
  }
  if (score >= 0.7) {
    return { key: "confident", label: "Confident", note: "One emotion is clearly ahead." };
  }
  if (score >= 0.45) {
    return {
      key: "leaning",
      label: "Leaning",
      note: "Mixed signals — the runner-up is close behind.",
    };
  }
  return {
    key: "unsure",
    label: "Uncertain",
    note: "No emotion stands out. Longer or more expressive text helps.",
  };
}

export function formatPercent(score: number, digits = 1): string {
  return `${(score * 100).toFixed(digits)}%`;
}

/** Sample sentences used by the hero demo and the analyzer's empty state. */
export const SAMPLE_TEXTS: { emotion: Emotion; text: string }[] = [
  { emotion: "joy", text: "i cant stop smiling this is the best news all year" },
  { emotion: "sadness", text: "i feel so empty and alone since everyone left" },
  { emotion: "love", text: "i feel so loved and cared for by my family" },
  { emotion: "anger", text: "i am absolutely furious about how they handled this" },
  { emotion: "fear", text: "i feel terrified about what might happen tomorrow" },
  { emotion: "surprise", text: "i cant believe this actually happened i am stunned" },
];
