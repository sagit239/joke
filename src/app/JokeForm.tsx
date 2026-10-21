"use client";

import { useRef, useState, type FormEvent } from "react";
import type { JokeRequest } from "@/lib/contracts";
import { interpretResponse, parseBody } from "@/lib/interpretResponse";
import { messages } from "@/lib/messages";
import { MAX_TOPIC_CODE_POINTS, normalizeTopic } from "@/lib/normalizeTopic";
import styles from "./page.module.css";

type Status = "idle" | "loading" | "success" | "rejected" | "error";

export default function JokeForm() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [joke, setJoke] = useState("");
  const [hasShownJoke, setHasShownJoke] = useState(false);
  // Guards against a second submit before React re-renders the disabled state.
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setJoke("");

    try {
      // Snapshot of the topic at submit time; the input keeps what the user typed.
      const payload: JokeRequest = { topic: normalizeTopic(topic) };
      const response = await fetch("/api/joke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const outcome = interpretResponse(response.status, parseBody(await response.text()));
      if (outcome.kind === "success") {
        setJoke(outcome.joke);
        setHasShownJoke(true);
      }
      setStatus(outcome.kind);
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  const isLoading = status === "loading";
  const cardText = {
    idle: "",
    loading: messages.loading,
    success: joke,
    rejected: messages.rejected,
    error: messages.error,
  }[status];

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="topic">
          {messages.topicLabel}
        </label>
        <input
          id="topic"
          className={styles.input}
          type="text"
          value={topic}
          maxLength={MAX_TOPIC_CODE_POINTS}
          autoComplete="off"
          disabled={isLoading}
          onChange={(event) => setTopic(event.target.value)}
        />
        <button className={styles.button} type="submit" disabled={isLoading}>
          {messages.submit}
        </button>
      </form>

      <section className={styles.result}>
        <h2 className={styles.resultHeading}>
          {hasShownJoke ? messages.yourJokeHeading : messages.dailyJokeHeading}
        </h2>
        <div className={styles.card} aria-live="polite">
          {cardText}
        </div>
      </section>
    </>
  );
}
