import { describe, expect, it } from "vitest";
import { isAcceptableJokeText, parseGeneration, topicInput } from "@/server/contentPolicy";

describe("parseGeneration", () => {
  it("accepts an ok result", () => {
    expect(parseGeneration('{"status":"ok","joke":"למה?\\nכי."}')).toEqual({
      status: "ok",
      joke: "למה?\nכי.",
    });
  });

  it("accepts a rejected result with an empty joke", () => {
    expect(parseGeneration('{"status":"rejected","joke":""}')).toEqual({ status: "rejected" });
  });

  it.each([
    ["broken JSON", "{"],
    ["rejected with text", '{"status":"rejected","joke":"בדיחה"}'],
    ["unknown status", '{"status":"maybe","joke":"x"}'],
    ["missing joke", '{"status":"ok"}'],
    ["extra field", '{"status":"ok","joke":"x","note":"y"}'],
    ["non-string joke", '{"status":"ok","joke":5}'],
    ["array", "[]"],
  ])("returns null for %s", (_name, text) => {
    expect(parseGeneration(text)).toBeNull();
  });
});

describe("isAcceptableJokeText", () => {
  it("accepts a short Hebrew joke with line breaks", () => {
    expect(isAcceptableJokeText("למה הכלב ישב ליד המחשב?\nכי הוא חיפש את העכבר.")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   \n "],
    ["no Hebrew letters", "Why did the dog sit by the computer?"],
    ["over 600 characters", "א".repeat(601)],
  ])("rejects %s", (_name, joke) => {
    expect(isAcceptableJokeText(joke)).toBe(false);
  });
});

describe("topicInput", () => {
  it("wraps the topic as data and marks an empty topic", () => {
    expect(topicInput("כלבים")).toBe("Topic (write the joke in Hebrew): כלבים");
    expect(topicInput("")).toContain("none");
  });
});
