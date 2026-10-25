# פריסה ל־Production — Milestone 4

> הקובץ מתמלא במהלך אבן הדרך. שדות שמסומנים „ממתין” יושלמו אחרי החיבור ל־Vercel.

## פרטי הפריסה

| פרט | ערך |
| --- | --- |
| כתובת האתר | ממתין |
| Deployment ID | ממתין |
| Commit | ממתין |
| תוכנית Vercel | Hobby (ממתין לאישור המשתמש) |
| Production Branch | `main` (רק ענף זה נפרס — `vercel.json`) |
| פקודת Build | `npm run check` (Type Checking, Vitest, next build) |
| Auto Recharge ב־OpenAI | ממתין לאישור המשתמש שכבוי |

## משתני סביבה ב־Vercel (Production בלבד)

| שם | ערך |
| --- | --- |
| `OPENAI_API_KEY` | מפתח Production נפרד, מסומן Sensitive. לא נשמר במחשב ולא ב־GitHub |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `GENERATION_ENABLED` | `true` (`false` לעצירת יצירה) |

שינוי משתנה חל רק אחרי Redeploy.

## כלל WAF

POST ל־`/api/joke`, Fixed Window של 60 שניות, 10 בקשות לפי IP, תגובה 429. ממתין להגדרה.

## בדיקות

### בדיקות מקומיות (לפני הפריסה)

| בדיקה | סוג | תוצאה |
| --- | --- | --- |
| `npm run check` — 119 בדיקות, כולל Security Headers | Mocks | עבר |
| Headers בדף וב־API (`next start` מקומי) | ידנית מקומית | עבר |
| Origin זר → 403 | ידנית מקומית | עבר |
| יצירת בדיחה בגרסת Production מקומית, ללא שגיאות CSP, גופנים נטענים, פניות רק לאתר עצמו | בדיקת AI חיה מקומית | עבר |
| מצב פיתוח (`npm run dev`) עובד עם ה־CSP | בדיקת AI חיה מקומית | עבר |
| אין מפתח בקוד הדפדפן (`.next/static`) ובקוד ב־Git (רק מפתח מזויף בבדיקות) | סריקה | עבר |

### בדיקות ב־Production

ממתין.

## Rollback

ממתין לתרגול. נוהל צפוי: ב־Vercel ← הפרויקט ← Deployments ← בחירת הגרסה הקודמת ← Instant Rollback.

**מגבלה:** Rollback מחזיר רק את הקוד. הוא אינו מחזיר בהכרח את כללי ה־WAF, משתני הסביבה (כולל המפתח) או הגדרות ה־Billing ב־OpenAI — יש לבדוק אותם ידנית אחרי כל Rollback.

## עצירת חירום

ב־Vercel ← Settings ← Environment Variables: לשנות את `GENERATION_ENABLED` ל־`false`, ואז Redeploy. האתר יציג את הודעת הכשל ולא יפנה ל־OpenAI.
