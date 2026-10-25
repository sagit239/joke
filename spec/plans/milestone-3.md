# תוכנית — Milestone 3: התאוששות מכשלים ושימוש אמין

מבוסס על MILESTONES.md (Milestone 3), ARCHITECTURE.md (סעיפים 2.2, 2.4, 2.5, 2.7) ו־PRD.md. נקודת המוצא היא הקוד הקיים מ־Milestone 2. אין תלויות חדשות, אין שינויי עיצוב ואין שינוי בהתנהגות שמתוארת ב־spec.

## 0. תנאים מוקדמים

- Milestone 2 מאושר (✅). אין צורך במפתחות או בחשבונות חדשים.
- כל הבדיקות האוטומטיות באבן הדרך הזו הן עם Mocks. אין צורך בקריאות AI חיות, מלבד בדיקת Regression ידנית קצרה אחת (סעיף 7.3) — כמה בקשות בודדות בקלט סינתטי.

## 1. מצב נוכחי — מה כבר קיים ומה חסר

| נושא | קיים | חסר |
| --- | --- | --- |
| `maxRetries: 0` ב־SDK | כן | בדיקה שמוכיחה זאת (ספירת קריאות) |
| `maxDuration = 30` | כן | — |
| Deadline משותף של 25 שניות | `AbortSignal.timeout(25_000)` ב־`jokeService` | חריגה ממנו ממופה היום ל־`GENERATION_FAILED` (502) במקום `GENERATION_TIMEOUT` (504) |
| מיפוי 401 / `insufficient_quota` | כן | בדיקות ל־429 רגיל ול־5xx; כשל חיבור |
| Client Timeout של 28 שניות | **לא** | הלקוח עלול להמתין ללא הגבלה |
| כשל לא־JSON / רשת בלקוח | `parseBody` + `catch` | בדיקות; הוצאת הלוגיקה לפונקציה שניתנת לבדיקה |
| נושא נשמר אחרי כשל | כן (ה־State לא מתאפס) | אימות |
| Focus אחרי סיום בקשה | **לא** — כשהתיבה/הלחצן מושבתים בזמן ההמתנה, ה־Focus נאבד ומשתמש מקלדת צריך לחזור ב־Tab | החזרת Focus |
| Focus נראה | לתיבה וללחצן | — |
| aria-live | `polite` על הכרטיס | הוספת `role="status"` ו־`aria-busy` בזמן המתנה |
| תוצאה כטקסט בלבד | React מציג כטקסט | אימות שאין `dangerouslySetInnerHTML` ובדיקה בדפדפן |

## 2. קבצים — מה נוצר ומה משתנה

| קובץ | פעולה | תוכן |
| --- | --- | --- |
| `src/server/openaiAdapter.ts` | שינוי | מיפוי שגיאות מלא, כולל Timeout/Abort (סעיף 3) |
| `src/server/jokeService.ts` | שינוי | Deadline משותף ניתן להזרקה בבדיקות; חריגה ממנו → `GENERATION_TIMEOUT` (סעיף 4) |
| `src/lib/requestJoke.ts` | חדש | שליחת הבקשה מהלקוח עם Timeout של 28 שניות; לעולם לא זורקת (סעיף 5) |
| `src/app/JokeForm.tsx` | שינוי | שימוש ב־`requestJoke`, החזרת Focus, `role="status"` ו־`aria-busy` (סעיף 6) |
| `tests/openaiAdapter.test.ts` | שינוי | מקרי שגיאות ספק |
| `tests/jokeService.test.ts` | שינוי | Deadline, ספירת קריאות, אין יצירה חוזרת |
| `tests/api-joke.test.ts` | שינוי | קוד HTTP ו־Body לכל מקרה, ללא פרטי תקלה |
| `tests/requestJoke.test.ts` | חדש | כשלי לקוח: רשת, HTML, Timeout, בקשה אחת בלבד |
| `spec/ARCHITECTURE.md` | הוספת ADR בלבד, אם נדרש | למשל אם יתקבלה החלטה טכנית לא צפויה בבנייה |
| `spec/MILESTONES.md` | סימון 🟡 בסיום | — |

## 3. מיפוי שגיאות ספק — `openaiAdapter.ts`

`mapProviderError` מורחב, לפי ARCHITECTURE 2.5 ו־2.7:

| מקור | קוד אפליקטיבי |
| --- | --- |
| `AppError` קיים | כפי שהוא |
| 401 (מפתח לא תקין) | `SERVICE_UNAVAILABLE` |
| 429 עם `insufficient_quota` (יתרה נגמרה) | `SERVICE_UNAVAILABLE` |
| 429 אחר (עומס בספק) | `GENERATION_FAILED` |
| 5xx | `GENERATION_FAILED` |
| `APIConnectionTimeoutError`, `APIUserAbortError`, או שגיאה כאשר ה־Signal כבר בוטל | `GENERATION_TIMEOUT` |
| `APIConnectionError` (אין חיבור לספק) | `GENERATION_FAILED` |
| כל דבר אחר | `GENERATION_FAILED` |

- **חשוב:** קוד 429 של OpenAI **אינו** ממופה ל־`RATE_LIMITED`. `RATE_LIMITED` שמור לחסימת התעבורה של האתר עצמו (WAF, Milestone 4); כשל עומס אצל הספק הוא `GENERATION_FAILED` לפי 2.7.
- הבדיקה „ה־Signal בוטל” נעשית קודם, כך שכל כשל שנגרם מה־Deadline ממופה ל־Timeout ולא לכשל כללי.
- המקרים הקיימים נשמרים: פלט ריק / JSON פגום / `incomplete` → `GENERATION_FAILED`; Safety Refusal → `rejected` (דחיית נושא); תגובת Moderation לא צפויה → `GENERATION_FAILED`.
- שגיאת ה־SDK המקורית לא מועברת הלאה ולא נרשמת בלוג — רק הקוד האפליקטיבי.

## 4. Deadline משותף — `jokeService.ts`

- `createJoke(topic, getProvider, deadlineMs = 25_000)`: הפרמטר השלישי קיים כדי שהבדיקות יוכלו להשתמש ב־Deadline קצר (למשל 50ms) בלי להמתין 25 שניות. בקוד הייצור הוא תמיד 25 שניות.
- אותו Signal מועבר לכל שלוש הקריאות (Moderation קלט, יצירה, Moderation פלט), כך שה־Deadline משותף לכל התזמור ולא לכל קריאה בנפרד.
- אחרי כל שלב: אם ה־Signal בוטל — זורקים `GENERATION_TIMEOUT` (הגנה גם מפני Provider שמתעלם מה־Signal).
- `timeout` ב־SDK נשאר 25 שניות כרשת ביטחון; `maxRetries: 0` נשאר.
- ללא Retry וללא יצירה חוזרת: פלט שנפסל (עברית, אורך, Moderation) זורק מיד `GENERATION_FAILED`. הקוד הקיים כבר כזה — הבדיקות יוכיחו זאת.

## 5. בקשה מהלקוח — `src/lib/requestJoke.ts` (חדש)

פונקציה קטנה שאינה תלויה ב־React, כדי שאפשר לבדוק אותה ב־Vitest בלי דפדפן:

```ts
requestJoke(topic: string, fetchImpl = fetch, timeoutMs = 28_000): Promise<JokeOutcome>
```

- שולחת `POST /api/joke` עם `{ topic: normalizeTopic(topic) }` ו־`signal: AbortSignal.timeout(timeoutMs)`.
- קוראת את התגובה כטקסט, `parseBody`, ואז `interpretResponse` (הקיימים).
- **לעולם לא זורקת:** אובדן רשת, Timeout, Abort, תגובת HTML/טקסט במקום JSON, 429/403 מה־WAF וכל קוד לא צפוי → `{ kind: "error" }`.
- קריאת `fetch` אחת בלבד לכל קריאה לפונקציה — ללא Retry.
- `src/lib/` נשאר ללא קוד שרת.

## 6. הטופס — `JokeForm.tsx`

- `handleSubmit` משתמש ב־`requestJoke`; ההגנה הקיימת מפני שליחה כפולה (`inFlight`) נשארת.
- **שחרור מצב ההמתנה:** כיוון ש־`requestJoke` לא זורקת ותמיד מסתיימת תוך 28 שניות לכל היותר, המצב תמיד יוצא מ־`loading`; `finally` משחרר את `inFlight`.
- **הנושא נשמר:** ה־State של התיבה לא מתאפס בכשל (כמו היום), כך שלחיצה נוספת שולחת את אותו נושא.
- **החזרת Focus:** בתחילת השליחה נשמר האלמנט שהיה ב־Focus (התיבה או הלחצן). בסיום הבקשה, אחרי שהם חוזרים לפעולה, ה־Focus מוחזר אליו — כך משתמש מקלדת יכול ללחוץ Enter שוב מיד. ללא קפיצת Focus לכרטיס.
- **הודעות מצב:** הכרטיס מקבל `role="status"` (בנוסף ל־`aria-live="polite"` הקיים) ו־`aria-busy` בזמן ההמתנה. הודעות הכשל והדחייה נשארות בתוך הכרטיס בלבד — ללא Toast, חלון קופץ או מסך שגיאה.
- **טקסט בלבד:** הבדיחה מוצגת כ־Text Node של React (כמו היום), עם `white-space: pre-line` הקיים. אסור `dangerouslySetInnerHTML`.
- אין שימוש ב־localStorage / sessionStorage / IndexedDB / Cookies; רענון מאפס הכול. נבדק ב־grep על `src/`.

## 7. בדיקות

### 7.1 בדיקות אוטומטיות עם Mocks (חלק מ־`npm run check`)

**Adapter (`openaiAdapter.test.ts`)** — לקוח OpenAI מדומה שזורק שגיאות SDK אמיתיות (`APIError.generate(...)`, `APIConnectionTimeoutError`, `APIUserAbortError`, `APIConnectionError`):
- 401 → `SERVICE_UNAVAILABLE`; 429 `insufficient_quota` → `SERVICE_UNAVAILABLE`; 429 רגיל → `GENERATION_FAILED`; 500/503 → `GENERATION_FAILED`.
- Timeout / Abort → `GENERATION_TIMEOUT`; כשל חיבור → `GENERATION_FAILED`.
- פלט ריק (`output_text: ""`), JSON פגום, `incomplete`, Safety Refusal — מקרים קיימים, מוודאים שהם עדיין עוברים.
- אותן שגיאות גם ב־`isFlagged` (Moderation).

**Service (`jokeService.test.ts`)** — Provider מדומה שסופר קריאות:
- Provider איטי (מחכה ל־Abort) עם Deadline של 50ms → `GENERATION_TIMEOUT`, ותוך זמן קצר.
- אותו Signal מועבר לשלוש הקריאות.
- **ספירת קריאות:** בקשה מוצלחת = יצירה אחת ושתי בדיקות Moderation; כשל ספק ביצירה = יצירה אחת בלבד (אין Retry); פלט שנכשל בבדיקת עברית / אורך / Moderation = יצירה אחת בלבד (אין יצירה חוזרת).

**API (`api-joke.test.ts`)**:
- לכל אחד מהקודים `GENERATION_FAILED` (502), `SERVICE_UNAVAILABLE` (503), `GENERATION_TIMEOUT` (504): Body הוא בדיוק `{ "error": { "code": ... } }`, עם `Cache-Control: no-store`, ואינו מכיל הודעת ספק, Stack Trace או טקסט מהשגיאה המקורית.
- שגיאה לא צפויה (Error עם הודעה „סודית”) לא נחשפת בתגובה ולא בלוג.

**לקוח (`requestJoke.test.ts`)** — `fetch` מדומה:
- 200 עם בדיחה → success; 422 → rejected.
- `fetch` שזורק `TypeError` (ניתוק רשת) → error, ללא זריקה.
- 504/502 עם Body של HTML, 429 עם טקסט רגיל (כמו WAF), 200 עם Body לא JSON → error.
- `fetch` שלא מסתיים, עם `timeoutMs` קצר → error בזמן קצר (מוכיח שאין loading ללא סוף).
- בכל המקרים `fetch` נקרא פעם אחת בדיוק.
- הנושא נשלח מנורמל (trim + NFC).

### 7.2 בדיקות ידניות בדפדפן (שרת מקומי, Claude מריץ בעצמו)

בדפדפן המובנה, עם החלפה זמנית של `window.fetch` דרך כלי ה־JavaScript (בלי לשנות קוד), כדי לדמות:
1. **ניתוק רשת** (fetch שנכשל) → הודעת הכשל, התיבה והלחצן חוזרים לפעולה, הנושא נשאר.
2. **תגובת HTML** (502 עם `<html>…`) → הודעת הכשל, ללא תוכן ה־HTML.
3. **תגובה איטית** (מעבר ל־28 שניות) → הודעת הכשל אחרי כ־28 שניות, לא נשאר ב־loading.
4. **בדיחה שנראית כ־HTML** (200 עם `"<img src=x onerror=alert(1)><b>שלום</b>"`) → מוצגת כטקסט גולמי, ללא תמונה, הדגשה או הרצת קוד.
5. **ניסיון חוזר מצליח:** אחרי כשל מדומה מחזירים את `fetch` המקורי ולוחצים שוב → בדיחה אמיתית.
6. **מקלדת:** Tab לתיבה, הקלדה, Enter → המתנה → בסיום ה־Focus חוזר לתיבה; Enter נוסף מפעיל בקשה חדשה. Focus נראה על התיבה והלחצן.
7. **aria:** בדיקת עץ הנגישות — לכרטיס יש `role="status"`/`aria-live`, ו־`aria-busy` בזמן המתנה.
8. **רענון:** אחרי בדיחה, רענון מחזיר תיבה ריקה, כרטיס ריק וכותרת „בדיחה יומית”. בדיקה ש־`localStorage`/`sessionStorage` ריקים ושאין IndexedDB של האתר.

### 7.3 Regression

- `npm run check` עובר (Type Checking, כל בדיקות Vitest, Build).
- בדיקה חיה קצרה ידנית מול השרת המקומי (כמה בקשות בודדות בקלט סינתטי: „כלבים”, נושא ריק, נושא לא מתאים) — כדי לוודא שמסלולי Milestone 2 לא נשברו. מסומנת בדיווח כ„בדיקת AI חיה”, בנפרד מבדיקות ה־Mocks. אין צורך להריץ את כל `scripts/live-check.mjs`.

## 8. מחוץ ל־Scope

- WAF, Rate Limiting אמיתי ו־Security Headers — Milestone 4. בשלב זה הלקוח רק יודע לטפל בתגובת 429 שאינה JSON.
- Retry אוטומטי, Toast, מסך שגיאה, שמירת נושא או בדיחה בין רענונים — אסורים לפי ה־spec.
- שינויי עיצוב — אין (מלבד מה שנדרש לנגישות, אם יתגלה חוסר).

## 9. Definition of Done — איך כל תנאי ייבדק

| תנאי | אופן הבדיקה |
| --- | --- |
| פלט ריק, JSON פגום, Incomplete, Safety Refusal, 401, 429, 5xx | 7.1 Adapter + API |
| ניתוק רשת, HTML במקום JSON, חריגה מה־Deadline — ללא loading תקוע וללא פרטי תקלה | 7.1 לקוח + Service, 7.2 סעיפים 1–3 |
| אחרי כשל: תיבה ולחצן חוזרים, נושא נשמר, ניסיון נוסף מצליח | 7.2 סעיפים 1 ו־5 |
| אין Retry סמוי, בקשה כפולה או יצירה חוזרת | 7.1 ספירת קריאות (Service + לקוח) |
| טקסט שנראה כ־HTML מוצג כטקסט | 7.2 סעיף 4 + grep על `dangerouslySetInnerHTML` |
| מקלדת, Focus נראה, aria-live, ללא Toast | 7.2 סעיפים 6–7 |
| רענון מאפס; אין אחסון בדפדפן או בשרת | 7.2 סעיף 8 + grep על `src/` |
| Regression ו־`npm run check` | 7.3 |
