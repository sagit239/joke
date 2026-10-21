import { messages } from "@/lib/messages";
import JokeForm from "./JokeForm";
import styles from "./page.module.css";

// Decorative Lemon sparks beside the title (DESIGN.md 2.4). Mirrored for the other side.
function Sparks({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      className={styles.sparks}
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <ellipse cx="11" cy="11" rx="3.5" ry="8" transform="rotate(-35 11 11)" />
      <ellipse cx="22" cy="24" rx="3.5" ry="7" transform="rotate(-70 22 24)" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>
        <Sparks />
        <span className={styles.titleText}>{messages.title}</span>
        <Sparks mirrored />
      </h1>
      <JokeForm />
    </main>
  );
}
