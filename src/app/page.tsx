import { messages } from "@/lib/messages";
import JokeForm from "./JokeForm";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{messages.title}</h1>
      <JokeForm />
    </main>
  );
}
