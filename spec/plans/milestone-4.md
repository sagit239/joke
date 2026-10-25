# תוכנית — Milestone 4: פריסה מאובטחת ל־Production

מבוסס על MILESTONES.md (Milestone 4), ARCHITECTURE.md (סעיפים 1.2, 2.5, 2.8, 2.9, 2.10, ADR-3, ADR-5, ADR-9) ו־PRD.md. נקודת המוצא היא הקוד הקיים מ־Milestone 3. אין תלויות חדשות, אין שינוי בממשק ואין שינוי בהתנהגות שמתוארת ב־spec.

אבן הדרך הזו שונה מהקודמות: רוב העבודה היא חיבור שירותים חיצוניים, ש**המשתמש מבצע בעצמו** בהדרכה צעד אחר צעד. Claude כותב את הקוד וההגדרות, בודק מקומית, ובודק את האתר הציבורי אחרי הפריסה.

## 0. תנאים מוקדמים

- Milestone 3 מאושר (✅). ה־Repository `https://github.com/sagit239/joke` קיים ומעודכן.
- המשתמש יכול להיכנס ל־GitHub, ל־OpenAI (Platform) ולפתוח חשבון Vercel חינמי (Hobby) דרך GitHub.
- **Push נדרש כדי להשלים את אבן הדרך** (הפריסה נעשית מ־`main`). לפי CLAUDE.md — לפני כל commit/push Claude עוצר ומבקש אישור מפורש. מרגע החיבור ל־Vercel, כל push ל־`main` מעדכן את האתר הציבורי (ADR-5).
- אין Database ואין Migrations באבן הדרך הזו.

## 1. מצב נוכחי — מה כבר קיים ומה חסר

| נושא | קיים | חסר |
| --- | --- | --- |
| `npm run check` (Type Checking + Vitest + Build) | כן | הגדרה שה־Build ב־Vercel מריץ אותו |
| Node.js 24 | `engines: "24.x"` ב־package.json | — (Vercel קורא את השדה הזה) |
| `maxDuration = 30`, `runtime = "nodejs"` | כן | — |
| בדיקת Same-Origin (ADR-4, ADR-9) | כן | אימות שהיא עובדת מאחורי Vercel (כותרת `Host` תואמת לדומיין) |
| `Cache-Control: no-store` בכל תגובות ה־API | כן | — |
| טיפול בלקוח ב־429 שאינו JSON | כן (Milestone 3) | אימות מול חסימת WAF אמיתית |
| Security Headers (CSP, Framing וכו') | **לא** | סעיף 3 |
| השבתת Preview Deployments | **לא** | סעיף 4 |
| WAF Rate Limiting | **לא** | הגדרה בלוח הבקרה של Vercel (סעיף 6, שלב ה) |
| תיעוד פריסה ו־Rollback | **לא** | `docs/deployment.md` (סעיף 7) |

## 2. קבצים — מה נוצר ומה משתנה

| קובץ | פעולה | תוכן |
| --- | --- | --- |
| `next.config.ts` | שינוי | פונקציית `headers()` עם Security Headers לכל הנתיבים (סעיף 3) |
| `src/server/securityHeaders.ts` (או קובץ קטן דומה) | חדש | רשימת ה־Headers וה־CSP כפונקציה טהורה, כדי שאפשר לבדוק אותה ב־Vitest |
| `vercel.json` | חדש | פקודות Install/Build והשבתת Preview Deployments (סעיף 4) |
| `tests/securityHeaders.test.ts` | חדש | בדיקה שה־Headers הנדרשים קיימים ושה־CSP אינו מתיר מקורות חיצוניים |
| `docs/deployment.md` | חדש | URL, מזהה גרסה, נוהל Rollback ומגבלותיו, תוצאות Smoke Test (סעיף 7) |
| `spec/ARCHITECTURE.md` | הוספת ADR בלבד | ADR-10: מבנה ה־CSP (סעיף 3); ADR נוסף רק אם תתקבל החלטה לא צפויה |
| `spec/MILESTONES.md` | סימון 🟡 בסיום | — |

אין שינוי ב־`.env.example` ואין משתנה חדש: אותם שלושה משתנים מוגדרים ב־Vercel.

## 3. Security Headers — `next.config.ts`

מוחלים על כל הנתיבים (`source: "/:path*"`) דרך `headers()` של Next.js:

| Header | ערך |
| --- | --- |
| `Content-Security-Policy` | ראה למטה |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

**CSP** (קבוע, ללא Nonce):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

- **למה `'unsafe-inline'` ל־Scripts:** Next.js מוסיף Scripts קטנים בתוך הדף. החלופה (Nonce) מחייבת רינדור דינמי של כל עמוד דרך Proxy/Middleware — מורכבות שלא נדרשת לדף אחד בלי קלט HTML, בלי Scripts של צד שלישי ובלי `dangerouslySetInnerHTML`. ההגנה העיקרית נשמרת: הדפדפן לא יכול לטעון Script או לשלוח בקשות לשום מקור חיצוני (`script-src`/`connect-src 'self'`). יתועד כ־ADR-10.
- **מצב פיתוח בלבד:** `next dev` צריך `'unsafe-eval'`; הוא מתווסף רק כאשר `NODE_ENV === "development"`, ולא ב־Production.
- **ללא `upgrade-insecure-requests`:** הוא היה שובר בדיקה מקומית ב־HTTP מטלפון ברשת הביתית. ב־Vercel כל פנייה ב־HTTP מועברת אוטומטית ל־HTTPS, ו־Vercel מוסיף `Strict-Transport-Security` לדומיין שלו — ייבדק ב־Smoke Test, ולא מוגדר בקוד.
- **הגופנים** מוגשים מאותו Origin (ADR-7), ולכן `font-src 'self'` מספיק.
- `poweredByHeader: false` ו־`reactStrictMode` נשארים.

## 4. הגדרות פריסה — `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run check",
  "git": { "deploymentEnabled": { "*": false, "main": true } }
}
```

- `buildCommand: "npm run check"` — אם Type Checking או בדיקה נכשלים, ה־Build נכשל ולא מתפרסם דבר (ARCHITECTURE 2.10.1).
- `deploymentEnabled` — רק `main` נפרס; ענפים אחרים לא יוצרים Preview Deployments (ADR-5, 2.10.3). התחביר יאומת מול התיעוד הרשמי של Vercel בזמן הבנייה; אם אינו נתמך כך, מכבים Previews דרך לוח הבקרה, ובכל מקרה משתני הסביבה מוגדרים **ל־Production בלבד**.
- `next build` ב־Vercel צריך גישה לאינטרנט להורדת הגופנים (ADR-7) — זמין ב־Vercel.
- אין הגדרת Region או Plan בקובץ; ברירות המחדל של Hobby.

## 5. בדיקות מקומיות לפני הפריסה (Claude, ללא push)

1. `npm run check` עובר, כולל `tests/securityHeaders.test.ts`:
   - כל ארבעת ה־Headers קיימים.
   - ה־CSP כולל `frame-ancestors 'none'`, `connect-src 'self'`, `object-src 'none'`, ואינו כולל `'unsafe-eval'` כש־`NODE_ENV` אינו development, ואינו כולל שום כתובת `http(s)://` חיצונית.
2. הרצת גרסת Production מקומית (`next start` אחרי ה־Build) ובדיקה בדפדפן המובנה:
   - ה־Headers מופיעים בתגובה לדף ול־`/api/joke`.
   - הדף נטען ללא שגיאות CSP בקונסול, הגופנים נטענים, והטופס עובד (בקשה חיה אחת, קלט סינתטי „כלבים”).
3. בדיקה שאין מפתח בפלט ה־Build: חיפוש `sk-` ו־`OPENAI_API_KEY` בתיקיית `.next/static` (קוד הדפדפן) — אמור להיות ריק.
4. סגירת השרת המקומי.

אחרי שלבים אלה Claude **עוצר ומבקש אישור** ל־commit ול־push של קוד אבן הדרך ל־`main`. ה־push נעשה לפני החיבור ל־Vercel, כך שהפריסה הראשונה כבר כוללת את ה־Headers ואת `vercel.json`.

## 6. חיבור השירותים — המשתמש מבצע, Claude מדריך

ההדרכה בזמן הבנייה תהיה בשפה פשוטה, צעד אחד בכל פעם, עם מה ללחוץ ומה אמור להופיע. Claude לא נכנס לחשבונות, לא רואה את המפתח ולא מבקש להדביק אותו בשיחה.

**א. OpenAI — חיוב ומפתח Production**
1. בעמוד ה־Billing: לוודא ש־**Auto Recharge כבוי**, לבדוק את היתרה ותאריך התפוגה שלה. לא מוסיפים אמצעי תשלום ולא רוכשים קרדיט.
2. ליצור **מפתח API חדש** בשם ברור (למשל `joke-production`), נפרד ממפתח הפיתוח.
3. להעתיק אותו **ישירות** לשלב ג׳ — לא לשמור בקובץ במחשב, לא לשלוח בצ'אט.

**ב. Vercel — חשבון וייבוא הפרויקט**
1. הרשמה ל־Vercel עם GitHub, בתוכנית **Hobby** (ללא כרטיס אשראי).
2. מתן גישה ל־Repository `joke` בלבד (לא לכל החשבון).
3. Import של הפרויקט. Vercel יזהה Next.js ויקרא את `vercel.json`. Production Branch = `main`.

**ג. משתני סביבה (לפני הפריסה הראשונה, או מיד אחריה ואז Redeploy)**
- `OPENAI_API_KEY` = מפתח ה־Production משלב א׳, מסומן **Sensitive**.
- `OPENAI_MODEL` = `gpt-6-luna`.
- `GENERATION_ENABLED` = `true`.
- כל השלושה בסביבת **Production בלבד** (לא Preview ולא Development).

**ד. פריסה ראשונה** — Deploy; לחכות שה־Build (כולל `npm run check`) יסתיים בהצלחה. המשתמש מוסר ל־Claude את כתובת האתר (`https://<name>.vercel.app`).

**ה. WAF Rate Limiting** — ב־Firewall של הפרויקט, כלל אחד (כלול ב־Hobby):
- תנאי: Request Path **equals** `/api/joke` **וגם** Method **equals** `POST`.
- פעולה: Rate Limit, Fixed Window, **60 שניות**, **10 בקשות**, מפתח: **IP**, תגובה: 429 (ברירת מחדל).
- שמירה ו־Publish של הכלל.

**ו. Hobby בלבד** — לוודא בהגדרות החשבון שהתוכנית היא Hobby ושלא הופעל ניסיון Pro.

## 7. בדיקות ב־Production (Claude, אחרי הפריסה)

כל הבדיקות בקלט סינתטי בלבד, מספר קטן של בקשות.

1. **Build ומזהה גרסה:** בלוח הבקרה (המשתמש מוסר / Claude קורא בדף הציבורי) — ה־Deployment נבנה מ־`main`, ה־Build log מראה ש־`npm run check` רץ ועבר. מתועדים URL ו־Deployment ID / Commit.
2. **Smoke Test בדפדפן המובנה:**
   - מצב פתיחה: „בדיחה יומית” מעל כרטיס ריק.
   - „כלבים” → בדיחה בעברית; הכותרת מתחלפת ל־„הבדיחה שלכם”.
   - נושא ריק → בדיחה כללית.
   - לחיצה נוספת → בדיחה מחליפה את הקודמת.
   - נושא לא מתאים מטבלת ה־PRD → „בחרו נושא שמתאים לכל המשפחה”.
   - אין שגיאות CSP בקונסול; ה־Network מראה פניות רק לדומיין האתר.
3. **Headers ו־HTTPS:** בקשה לדף ול־`/api/joke` — קיימים CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`; פנייה ב־`http://` מועברת ל־`https://`.
4. **Origin של אתר אחר:** `curl -X POST` עם `Origin: https://example.com` → 403 `FORBIDDEN_ORIGIN`. בקשה ללא Origin → 403. זה גם מאמת את ADR-9 (ה־Host ב־Vercel תואם לדומיין, אחרת גם הטופס האמיתי היה נכשל בשלב 2).
5. **WAF (בדיקה מבוקרת, ללא עלות AI):** 12 בקשות POST רצופות עם Origin זר (נדחות לפני כל קריאה לספק) → הראשונות 403, ומשלב מסוים 429 מה־WAF. לא יותר מ־15 בקשות. מיד אחר כך, באותה דקה, לחיצה בטופס בדפדפן המובנה (אותו IP) → מוצגת „לא הצלחנו ליצור בדיחה. נסו שוב” למרות שתגובת החסימה אינה JSON. בדיקה שבלוג ה־Function לא נרשמו הבקשות החסומות (הוכחה שנחסמו לפני הפעלת הקוד).
6. **מפתח לא חשוף:** חיפוש `sk-` בקובצי ה־JS שהאתר הציבורי מגיש ובתגובות ה־API; בדיקה שבלוגים של Vercel אין מפתח, נושא או בדיחה (רק שורת `joke_request` עם קודים וזמנים). המשתמש מאשר שמפתח ה־Production לא נשמר במחשב ולא ב־GitHub (חיפוש ב־Repository עם `git grep sk-`).
7. **`GENERATION_ENABLED=false`:** המשתמש משנה ל־`false` ומבצע Redeploy → בקשה בטופס מציגה את הודעת הכשל (503 `SERVICE_UNAVAILABLE`). אחר כך מחזיר ל־`true` ו־Redeploy → בדיחה חוזרת לעבוד.
8. **Rollback:** המשתמש מבצע ב־Vercel Instant Rollback לגרסה הקודמת (למשל זו שלפני ה־Redeploy של שלב 7) ומחזיר לגרסה האחרונה (Promote). Claude מוודא שהאתר עובד לאחר מכן. אם ב־Hobby אין גרסה קודמת מתאימה — מתעדים את הנוהל ומסמנים את התרגול כחסר.

**`docs/deployment.md`** מסכם: URL, Deployment ID ו־Commit, הגדרות WAF, תוצאות כל הבדיקות למעלה (מסומנות: Mocks / בדיקה חיה ב־Production / בדיקה ידנית של המשתמש), נוהל Rollback צעד אחר צעד, ו**המגבלה**: Rollback מחזיר רק את הקוד — הוא אינו מחזיר בהכרח כללי WAF, משתני סביבה/Secrets או הגדרות Billing ב־OpenAI; אלה נבדקים ידנית אחרי כל Rollback. כולל גם איך לעצור יצירה בחירום (`GENERATION_ENABLED=false` + Redeploy).

## 8. מחוץ ל־Scope

- PWA, Manifest ואייקונים — Milestone 5.
- דומיין מותאם אישית — לא נדרש; משתמשים בכתובת `*.vercel.app`.
- Analytics, Speed Insights, Monitoring של צד שלישי — אסורים לפי 2.8.
- בדיקת עומס, תוכנית Pro, רכישת קרדיט — אסורים.
- שינויים בממשק או בלוגיקת היצירה — אין.

## 9. Definition of Done — איך כל תנאי ייבדק

| תנאי | אופן הבדיקה |
| --- | --- |
| פריסה אוטומטית מ־main רק אחרי `npm run check`; מתועדים URL ומזהה גרסה | `vercel.json` (סעיף 4), Build log ותיעוד (7.1) |
| מפתח Production רק ב־Vercel, לא במחשב/GitHub/Bundle/תגובות/לוגים | 5.3, 6.א–ג, 7.6 |
| Auto Recharge כבוי, תוכנית Hobby | 6.א.1, 6.ו — אישור המשתמש, מתועד |
| Smoke Test: פתיחה, נושא, כללי, החלפה, דחייה | 7.2 |
| WAF חוסם לפני קריאה לספק; הלקוח מציג הודעת כשל גם בלי JSON; בדיקה מבוקרת | 6.ה, 7.5 |
| Origin זר נדחה; HTTPS ו־Headers פועלים בלי לשבור את הטופס | 3, 7.2–7.4 |
| `GENERATION_ENABLED=false` עוצר יצירה אחרי פריסה חדשה | 7.7 |
| Rollback ומגבלתו מתועדים | 7.8 + `docs/deployment.md` |
