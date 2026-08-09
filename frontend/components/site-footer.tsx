import Link from "next/link";

import { API_URL } from "@/lib/api";
import { EMOTION_ORDER, metaFor } from "@/lib/emotion-theme";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-sm font-semibold text-ink">EmotionSense</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Six-way emotion classification for short English text, powered by a DistilBERT model
              fine-tuned on 16,000 labelled examples.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
              {EMOTION_ORDER.map((emotion) => {
                const meta = metaFor(emotion);
                return (
                  <span
                    key={emotion}
                    className="size-2 rounded-full"
                    style={{ background: meta.color }}
                    title={meta.label}
                  />
                );
              })}
            </div>
          </div>

          <nav aria-label="Product">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/analyze" className="text-body transition-colors hover:text-ink">
                  Analyzer
                </Link>
              </li>
              <li>
                <Link href="/batch" className="text-body transition-colors hover:text-ink">
                  Batch analysis
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-body transition-colors hover:text-ink">
                  Model &amp; metrics
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Resources">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Resources</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`${API_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-body transition-colors hover:text-ink"
                >
                  API reference
                </a>
              </li>
              <li>
                <a
                  href="https://huggingface.co/datasets/dair-ai/emotion"
                  target="_blank"
                  rel="noreferrer"
                  className="text-body transition-colors hover:text-ink"
                >
                  Dataset card
                </a>
              </li>
              <li>
                <a
                  href="https://aclanthology.org/D18-1404/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-body transition-colors hover:text-ink"
                >
                  CARER paper
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 space-y-3 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            Trained on{" "}
            <a
              href="https://huggingface.co/datasets/dair-ai/emotion"
              target="_blank"
              rel="noreferrer"
              className="text-body underline-offset-2 hover:underline"
            >
              dair-ai/emotion
            </a>{" "}
            (Saravia et al., <em>CARER: Contextualized Affect Representations for Emotion
            Recognition</em>, EMNLP 2018). The dataset card states the data is provided for{" "}
            <strong className="font-medium text-body">research and educational use</strong>, and this
            project is built and published on that basis.
          </p>
          <p>
            EmotionSense is not a clinical or diagnostic tool. It infers emotional tone from wording
            alone and should not inform decisions about anyone&apos;s health, employment, or wellbeing.
          </p>
          <p className="pt-1">© {new Date().getFullYear()} EmotionSense · MIT licensed</p>
        </div>
      </div>
    </footer>
  );
}
