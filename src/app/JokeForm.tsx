"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { messages } from "@/lib/messages";
import { MAX_TOPIC_CODE_POINTS } from "@/lib/normalizeTopic";
import { requestJoke } from "@/lib/requestJoke";
import styles from "./page.module.css";

type Status = "idle" | "loading" | "success" | "rejected" | "error";

export default function JokeForm() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [joke, setJoke] = useState("");
  const [hasShownJoke, setHasShownJoke] = useState(false);
  // Guards against a second submit before React re-renders the disabled state.
  const inFlight = useRef(false);
  // The field or button that had focus at submit; disabling it drops focus,
  // so it is restored once the request ends (keyboard users can press Enter again).
  const focusAfterRequest = useRef<HTMLElement | null>(null);

  const isLoading = status === "loading";

  useEffect(() => {
    if (!isLoading && focusAfterRequest.current) {
      focusAfterRequest.current.focus();
      focusAfterRequest.current = null;
    }
  }, [isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const active = document.activeElement;
    focusAfterRequest.current =
      active instanceof HTMLElement && event.currentTarget.contains(active) ? active : null;
    setStatus("loading");
    setJoke("");

    try {
      // The topic state is kept as typed, so a failed request can be retried as is.
      const outcome = await requestJoke(topic);
      if (outcome.kind === "success") {
        setJoke(outcome.joke);
        setHasShownJoke(true);
      }
      setStatus(outcome.kind);
    } finally {
      inFlight.current = false;
    }
  }

  // The joke is rendered as a React text node only (never as HTML).
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
        <div className={styles.card} role="status" aria-live="polite" aria-busy={isLoading}>
          {cardText}
        </div>
      </section>
    </>
  );
}
