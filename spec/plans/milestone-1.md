# Plan — Milestone 1: בסיס הפרויקט והרצה מקומית

מקורות: `MILESTONES.md` (Milestone 1), `ARCHITECTURE.md` (סעיפים 1, 2.1–2.5, 2.8–2.10, ADR-4–6), `DESIGN.md` (סעיף 1.1, מבנה בלבד), `PRD.md` (סעיף 3ג).

## מצב פתיחה
- בתיקייה יש רק `spec/`, `CLAUDE.md` ו־`.gitignore`. אין קוד.
- במחשב מותקנים Node.js 24.22 ו־npm 11.19, כנדרש.
- ה־repo מחובר ל־`https://github.com/sagit239/joke.git`. אין חיבור ל־Vercel, ולא יהיה באבן דרך זו (ADR-5).

## גישה
- מקימים את הפרויקט ידנית (קובצי הגדרה כתובים ביד ו־`npm install`), ולא דרך `create-next-app`. כך לא נוצרים קבצים מיותרים, ו־`.gitignore` הקיים לא נדרס.
- הקוד יושב תחת `src/`: `app/` לממשק ולנתיב ה־API, `lib/` לקוד משותף (בלי סודות), `server/` לקוד שרת בלבד.
- ב־M1 היצירה עדיין לא ממומשת: `POST /api/joke` מחזיר תמיד `503 SERVICE_UNAVAILABLE`. כך אפשר לבנות ולבדוק את כל המסלול מהלחצן עד הודעת הכשל.
- חבילת `openai` אינה מותקנת ב־M1. ה־Adapter הוא שלד עם ממשק בלבד, וה־SDK מתווסף ב־M2.
- העיצוב ב־M1 בסיסי: מבנה, סדר, RTL וטור ממורכז ברוחב 480px. גופנים, צבעים, צללים וליטוש נעשים ב־M2.

## קבצים ליצירה

### הגדרות פרויקט
| קובץ | תוכן |
| --- | --- |
| `package.json` | `"private": true`, `"engines": { "node": "24.x" }`. סקריפטים: `dev` (`next dev`), `build` (`next build`), `start`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `check` (`npm run typecheck && npm run test && npm run build`). |
| תלויות | `next@16` (הגרסה היציבה האחרונה), `react` ו־`react-dom` בגרסה התואמת, `server-only` |
| תלויות פיתוח | `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `vitest` |
| `package-lock.json` | נוצר על ידי `npm install`, ונבדק אחר כך עם `npm ci` |
| `tsconfig.json` | `strict: true`, `noEmit`, `moduleResolution: "bundler"`, `jsx: "preserve"`, plugin של Next, alias `@/*` ל־`src/*` |
| `next.config.ts` | `reactStrictMode: true`, `poweredByHeader: false`. בלי הגדרות נוספות. |
| `vitest.config.ts` | סביבת `node`. alias של `@` ל־`src`, ו־alias של `server-only` לקובץ ריק (`tests/stubs/server-only.ts`), משום שהחבילה זורקת שגיאה מחוץ לסביבת השרת של React. |
| `.env.example` | `OPENAI_API_KEY=`, `OPENAI_MODEL=`, `GENERATION_ENABLED=`, בלי ערכים, עם הערה באנגלית לכל משתנה |
| `.env` | העתקה חד־פעמית של `.env.example`. לא קוראים אותו ולא כותבים לו ערכים; המשתמש ממלא. |
| `.gitignore` | הוספת השורה `next-env.d.ts` בלבד. כל השאר כבר מכוסה (`.next/`, `node_modules/`, `.env`, `*.tsbuildinfo`). |

### קוד משותף — `src/lib/` (ללא קוד שרת או סודות)
| קובץ | תוכן |
| --- | --- |
| `contracts.ts` | טיפוסים: `JokeRequest { topic?: string }`, `JokeSuccess { joke: string }`, `ErrorCode` (כל 11 הקודים מ־ARCHITECTURE 2.5), `ErrorResponse { error: { code: ErrorCode } }` |
| `messages.ts` | כל הטקסטים בעברית: כותרת „בדיחה לפי נושא”, תווית „נושא לבדיחה”, לחצן „צרו בדיחה”, „בדיחה יומית”, „הבדיחה שלכם”, „מכינים לכם בדיחה…”, „בחרו נושא שמתאים לכל המשפחה”, „לא הצלחנו ליצור בדיחה. נסו שוב” |
| `interpretResponse.ts` | פונקציה טהורה שמקבלת status ו־body (שאולי אינו JSON) ומחזירה `{ kind: "success", joke }`, `{ kind: "rejected" }` או `{ kind: "error" }`. רק 200 עם `joke` מסוג string הוא הצלחה; רק 422 עם `TOPIC_NOT_ALLOWED` הוא דחייה; כל השאר, כולל HTML או גוף ריק, הוא שגיאה. |

### קוד שרת — `src/server/` (כל קובץ מתחיל ב־`import "server-only"`)
| קובץ | תוכן |
| --- | --- |
| `config.ts` | קריאת `process.env`: `generationEnabled` (רק המחרוזת `"true"` נחשבת true), `openaiModel`, ובדיקה אם `OPENAI_API_KEY` קיים. הערך של המפתח לא נחשף מחוץ לקובץ ולא נרשם בלוג. |
| `errors.ts` | מחלקה `AppError(code)` ומפה מקוד ל־HTTP status לפי ARCHITECTURE 2.5 |
| `openaiAdapter.ts` | ממשק `JokeGenerator { generate(topic: string, signal: AbortSignal): Promise<GenerationResult> }` ושלד שזורק `AppError("SERVICE_UNAVAILABLE")`. בלי SDK. |
| `jokeService.ts` | `createJoke(topic)`: אם `generationEnabled` כבוי או שהמפתח חסר, זורק `SERVICE_UNAVAILABLE`; אחרת קורא ל־Adapter (שב־M1 זורק גם הוא). מבנה הפונקציה כבר מוכן לסדר הסינון של M2. |

### API — `src/app/api/joke/route.ts`
- `export const runtime = "nodejs"` ו־`export const maxDuration = 30`.
- `POST`: קורא את הגוף, מעביר ל־`createJoke`, וממפה `AppError` לתגובת JSON `{ error: { code } }` עם הסטטוס המתאים. כל שגיאה לא צפויה ממופה ל־`502 GENERATION_FAILED`, בלי פרטים בתגובה.
- `GET`, `PUT`, `PATCH`, `DELETE`: `405 METHOD_NOT_ALLOWED` עם כותרת `Allow: POST`.
- לכל תגובה: `Cache-Control: no-store`.
- בדיקות Origin, גודל וסוג תוכן אינן נדרשות ב־M1 ונוספות ב־M2. עם זאת, הקוד מחולק כך שיהיה להן מקום ברור בפונקציה נפרדת ב־route.

### ממשק — `src/app/`
| קובץ | תוכן |
| --- | --- |
| `layout.tsx` | `<html lang="he" dir="rtl">`, `metadata.title = "בדיחה לפי נושא"`, `viewport` למובייל, ייבוא `globals.css` |
| `globals.css` | reset מינימלי, רקע לבן, טקסט `#171717`, גופן מערכת זמני (Rubik/Heebo נוספים ב־M2) |
| `page.tsx` | Server Component: `<main>` עם הכותרת „בדיחה לפי נושא” ורכיב `<JokeForm />` |
| `JokeForm.tsx` | Client Component (`"use client"`). מבנה: `<form>` עם `<label htmlFor>`, `<input maxLength={200}>`, `<button type="submit">`; מתחתיו `<h2>` של אזור התוצאה ו־`<div aria-live="polite">` ככרטיס. State: `topic`, `status` (`idle`/`loading`/`success`/`rejected`/`error`), `joke`, `hasShownJoke`. Submit (גם ב־Enter): מתעלם אם כבר `loading`; מעביר ל־`loading`; `fetch("/api/joke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) })`; קורא את הגוף כטקסט, מנסה `JSON.parse`, ומעביר ל־`interpretResponse`. כשל רשת נחשב `error`. בזמן `loading` השדה והלחצן מקבלים `disabled`. |
| `page.module.css` | טור ממורכז, `max-width: 480px`, `padding-inline: 16px`, סדר אנכי ומרווחים מסולם 8/16/24/32, כרטיס עם מסגרת פשוטה וגובה מינימלי, `white-space: pre-line` לבדיחה |

תוכן הכרטיס לפי מצב (DESIGN 1.1): `idle` ריק; `loading` „מכינים לכם בדיחה…”; `success` הבדיחה; `rejected` הודעת הדחייה; `error` הודעת הכשל. הכותרת היא „בדיחה יומית” עד ש־`hasShownJoke` נעשה true.

### בדיקות — `tests/`
| קובץ | מה נבדק |
| --- | --- |
| `stubs/server-only.ts` | קובץ ריק עבור ה־alias |
| `api-joke.test.ts` | ייבוא ישיר של `POST` ו־`GET` מ־route: POST עם generation כבוי מחזיר 503 ו־`{ error: { code: "SERVICE_UNAVAILABLE" } }`; POST עם generation דלוק ומפתח מדומה מחזיר גם 503 (שלד); GET מחזיר 405; לכל תגובה יש `Cache-Control: no-store`; גוף התגובה אינו מכיל את ערך המפתח המדומה. |
| `interpretResponse.test.ts` | 200 עם joke היא הצלחה; 422 עם TOPIC_NOT_ALLOWED היא דחייה; 503, 429, גוף HTML, גוף ריק ו־200 בלי joke הם כולם שגיאה |
| `jokeService.test.ts` | `generationEnabled=false` אינו קורא ל־Adapter (Mock עם ספירת קריאות = 0) |

## עדכונים במסמכים
- `CLAUDE.md`, סעיף פקודות הרצה: הרצה `npm run dev`; בדיקות `npm run check`. זה המילוי שהקובץ עצמו מבקש, ולא שינוי כללים.
- `MILESTONES.md`: סימון 🟡 ליד כותרת Milestone 1 בסיום הבנייה.
- אין ADR חדש, משום שאין החלטה טכנית מעבר למה שכבר מתועד.

## בדיקה עצמית בסיום (לפני סימון 🟡)
1. מחיקת `node_modules` (תיקייה שנוצרה בבנייה עצמה), ואז `npm ci` ו־`npm run check`. הכול חייב לעבור.
2. `npm run dev` ברקע, ובדפדפן הפנימי פתיחת `http://localhost:3000`:
   - מופיעים כותרת, Label, שדה, לחצן, „בדיחה יומית” וכרטיס ריק, ב־RTL, בלי ניווט.
   - לחיצה על הלחצן, ובנפרד Enter בשדה: „מכינים לכם בדיחה…” ואחריה הודעת הכשל בכרטיס.
   - בדיקה ברוחב מובייל (375px) שאין גלילה אופקית.
3. חיפוש בתוצרי ה־Build הנשלחים לדפדפן (`.next/static`) אחר `OPENAI_API_KEY` ו־`sk-`: אין התאמות.
4. `git status`: `.env` אינו מופיע ברשימת הקבצים למעקב.
5. סגירת שרת הפיתוח.

## Definition of Done — איך כל תנאי נבדק
| תנאי | בדיקה |
| --- | --- |
| `npm ci` ו־`npm run check` עוברים | שלב 1 |
| האפליקציה רצה מקומית | שלב 2 |
| מבנה: כותרת, Label, שדה, לחצן, „בדיחה יומית”, כרטיס ריק, בלי ניווט | שלב 2, בדיקה חזותית |
| לחצן או Enter מציגים המתנה ואז הודעת כשל, בלי Stack Trace | שלב 2, ו־`interpretResponse.test.ts` |
| אין מפתח ב־Repository, ב־Client Bundle או בתגובות; `.env` לא ב־Git | שלבים 3–4, ו־`api-joke.test.ts` |
| הסבר מה שלד ומה Mock | בסיכום הבנייה: Adapter ו־Service הם שלד; בדיקת ה־Service משתמשת ב־Mock ל־Adapter |

## מחוץ ל־M1
Validation מלא (Origin, גודל, סוג תוכן, נרמול), SDK של OpenAI וקריאות אמיתיות, גופנים וצבעים, Timeouts, Manifest ואייקונים, WAF, Vercel.
