# סונול — Field Ops

אפליקציית PWA לניהול סבבי הפצה לתחנות דלק. עברית, RTL, mobile-first.

מפיץ מקבל אזורים גיאוגרפיים, בכל אזור רשימת תחנות מסודרת. הוא נוסע לפי הסדר,
מנווט לכל תחנה עם Waze ומסמן אותה כבוצעה. מנהל מנהל תחנות, אזורים ומשתמשים,
עוקב אחרי דשבורד חי, ובסוף הסבב מאפס את הכול.

זהו שכתוב של אפליקציית FlutterFlow + Firebase קיימת. הסיבה לשכתוב: בגרסה
המקורית לא הייתה שום הרשאה בצד השרת, לא הייתה ולידציה לטפסים, והצטברה רשימה
ארוכה של תקלות.

---

## דרישות

- Node.js 22.13 ומעלה
- npm 10 ומעלה
- פרויקט Supabase

## התקנה

```bash
npm install
cp .env.example .env    # ומלאו את שני הערכים
npm run dev
```

`.env` לא נכנס ל-git. שני המשתנים היחידים שמגיעים לדפדפן הם `VITE_SUPABASE_URL`
ו-`VITE_SUPABASE_ANON_KEY`. מפתח ה-`service_role` לא נמצא בקוד הלקוח בשום צורה —
מקומו היחיד הוא ב-Edge Functions.

## פקודות

| פקודה                | מה היא עושה                                         |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | שרת פיתוח                                           |
| `npm run build`      | בדיקת טיפוסים + בילד לפרודקשן                       |
| `npm run preview`    | תצוגה מקדימה של הבילד                               |
| `npm run typecheck`  | בדיקת טיפוסים בלבד                                  |
| `npm run lint`       | ESLint                                              |
| `npm run lint:rtl`   | איתור מאפייני CSS פיזיים שלא מתהפכים ב-RTL          |
| `npm run lint:scale` | נכשל על מחלקות שמחוץ לסולם הטוקנים                  |
| `npm run test`       | Vitest                                              |
| `npm run coverage`   | כיסוי בדיקות                                        |
| `npm run format`     | Prettier                                            |
| `npm run gen:types`  | יצירה מחדש של `src/types/database.types.ts` מהסכימה |
| `npm run gen:icons`  | יצירה מחדש של אייקוני ה-PWA מתוך `favicon.svg`      |
| `npm run verify`     | כל הבדיקות יחד — להריץ לפני כל commit               |
| `npm run test:e2e`   | Playwright — **כותב לבסיס הנתונים**, ראו למטה       |

---

## הקמת בסיס הנתונים

### 1. הרצת המיגרציות

`supabase/migrations/0001_initial_schema.sql` מכיל את כל הסכימה: טבלאות,
אינדקסים, טריגרים, מדיניות RLS, פונקציות RPC, Views, אחסון ו-Realtime.

`0002_round_history.sql` מוסיף שני Views לקריאה בלבד — `round_stats` ו-
`round_user_stats` — שעליהם בנוי מסך היסטוריית הסבבים. שניהם
`security_invoker`, כך שה-RLS של `station_completions` ממשיך לחול: מנהל רואה
את כולם, עובד רואה את עצמו בלבד.

דרך ה-CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

או להדביק את תוכן הקובץ ב-SQL Editor בלוח הבקרה של Supabase.

### 2. יצירת המנהל הראשון

יוצרים חשבון תחת Authentication → Users, ואז מריצים ב-SQL Editor (שרץ עם
הרשאות service role ולכן עוקף את הגבלות העמודות):

```sql
update public.profiles
   set is_admin = true, is_authorized = true
 where email = 'admin@sonol.co.il';
```

### 3. הזנת האזורים

מסך **ניהול אזורים** (דשבורד ← ניהול אזורים) מאפשר הוספה, שינוי שם, סידור
ומחיקה. אזור שיש בו תחנות אינו נמחק — ה-FK הוא `on delete restrict`.

לטעינה ראשונית בבת אחת אפשר גם:

```sql
insert into public.areas (name, sort_order) values
  ('צפון', 1), ('שרון', 2), ('מרכז', 3),
  ('שפלה', 4), ('ירושלים', 5), ('דרום', 6)
on conflict (name) do nothing;
```

### 4. שיוך כל האזורים למנהל

```sql
insert into public.user_areas (user_id, area_id)
select p.id, a.id from public.profiles p cross join public.areas a
where p.email = 'admin@sonol.co.il'
on conflict do nothing;
```

### 5. יצירת קובץ הטיפוסים

```bash
npm run gen:types
```

---

## מודל ההרשאות

כל ההרשאות נאכפות בשרת. ממשק המשתמש רק מסתיר את מה שהשרת ממילא אוסר.

- **RLS מופעל על כל שש הטבלאות.** עובד רואה רק תחנות באזורים שהוקצו לו.
- **`anon` לא מקבל שום הרשאה.** לאפליקציה אין ממשק ציבורי.
- **הדגלים `is_admin`, `is_authorized` ו-`completed_count` אינם ניתנים לכתיבה**
  על ידי התפקיד `authenticated` — לא ברמת המדיניות אלא ברמת ההרשאות עצמן.
  משתמש יכול לעדכן רק את `display_name`, `photo_url` ו-`phone_number` של עצמו.
- **כל שינוי מצב תפעולי עובר דרך פונקציית RPC** מסוג `security definer` שבודקת
  הרשאות מחדש בעצמה: `complete_station`, `uncomplete_station`,
  `set_station_markers`, `reset_round`, `admin_set_user_flags`,
  `admin_set_user_areas`.
- **יצירה, מחיקה ואיפוס סיסמה של משתמשים רצים ב-Edge Function** עם מפתח
  service role, כדי שהסשן של המנהל לא יוחלף, שחשבון ה-auth יימחק יחד עם
  הפרופיל, ושאיש מלבד השרת לא יוכל לגעת ברשומת ה-auth של משתמש אחר. כל שלוש
  הפונקציות מאמתות את ה-JWT של הקורא ואז בודקות `is_admin()` **מול בסיס
  הנתונים**, לא מול משהו שהלקוח שלח.

### שינוי אחד מכוון מהסכימה שנמסרה

נוספו הצהרות `revoke all ... from anon, authenticated` לפני כל קבוצת `grant`.

Supabase מגדיר `alter default privileges in schema public grant all on tables to
anon, authenticated, service_role`, ולכן כל טבלה **נוצרת** עם הרשאות מלאות
לתפקיד `authenticated`. הצהרת `grant update (col, ...)` היא תוספתית בלבד ואינה
מבטלת דבר — כלומר בלי ה-revoke, ההגבלה ברמת העמודה לא נכנסת לתוקף, וכל משתמש
מחובר יכול היה להריץ:

```sql
update public.profiles set is_admin = true where id = auth.uid();
```

זו בדיוק תקלת האבטחה שהשכתוב אמור לתקן. אומת מול PostgreSQL 17.6:
`has_column_privilege('authenticated','public.profiles','is_admin','UPDATE')`
החזיר `true` לפני התיקון ו-`false` אחריו.

**כשמוסיפים טבלה או View — קודם revoke, אחר כך grant.**

### תאריך יעד: מפתחות ה-API הישנים

האפליקציה וה-Edge Functions משתמשים כרגע ב-`anon` וב-`service_role` הישנים.
לפי התיעוד של Supabase הם ימשיכו לעבוד **עד סוף 2026** בלבד, ואז יש לעבור
ל-publishable/secret keys. המשמעות המעשית:

- בלקוח: `VITE_SUPABASE_ANON_KEY` יוחלף במפתח `sb_publishable_...`
- ב-Edge Functions: `SUPABASE_SERVICE_ROLE_KEY` יוחלף בקריאה מתוך
  `SUPABASE_SECRET_KEYS` (מבנה JSON לפי שם מפתח)

שני המפתחות החדשים אינם JWT, ולכן יש לשלוח אותם בכותרת `apikey` ולא ב-
`Authorization: Bearer`, ולכבות `verify_jwt` ולבצע את ההרשאה בקוד. זו לא בעיה
היום — אבל זה מועד שכדאי לתכנן אליו ולא להיתקל בו.

---

## חשבון אישי

- **איפוס סיסמה** — `/forgot-password` שולח קישור, והקישור נוחת ב-
  `/reset-password`, שם נבחרת הסיסמה החדשה בפועל (`auth.updateUser`). המסך
  ציבורי בכוונה, כמו `/blocked`: הסשן שנוצר מהקישור עשוי להיות של משתמש שאינו
  רשאי, ומאחורי `RequireAuth` הוא היה מועבר ל-`/blocked` לפני שהספיק לבחור
  סיסמה.
- **הפרופיל שלי** — `/profile`, נגיש מהשם בכותרת בכל מסך. שם מלא, טלפון,
  תמונה ושינוי סיסמה. השם אינו קישוט: `complete_station` חותם אותו לתוך
  `stations.completed_by_name`, כך שהוא מופיע ליד כל תחנה שבוצעה ובדשבורד.
- התמונה נשמרת ב-bucket `avatars` תחת `<uid>/avatar` — הנתיב חייב להתחיל
  במזהה המשתמש, כי מדיניות האחסון בודקת בדיוק את זה.
- **איפוס סיסמה ביוזמת המנהל** — במסך עריכת המשתמש, דרך
  `admin-reset-password`. המסלול העצמי דורש גישה לתיבת המייל; עובד ששכח סיסמה
  ואין לו גישה כזו מהטאבלט שברכב לא היה יכול לחזור פנימה כלל, מלבד מחיקת
  החשבון ויצירתו מחדש — שמאבדת את ההיסטוריה שלו. הפעולה מופרדת מכפתור השמירה
  של ההרשאות בכוונה: היא נכנסת לתוקף מיד ומנתקת את הסיסמה הקודמת.

## סדר התחנות בסבב

`stations.sort_number` הוא `numeric(10,2)` מסיבה מוצהרת אחת: כדי שאפשר יהיה
לשבץ תחנה בין 12 ל-13 בתור 12.5 בלי למספר מחדש את כל האזור. הטופס מעולם לא
חשף את זה — המנהל היה צריך לחשב את העשרוני בעצמו.

בטופס התחנה יש כעת **מיקום בסבב**: בוחרים "ראשונה באזור" או "אחרי תחנה X",
והמספר מחושב (`src/lib/ordering.ts`, מעוגל לשתי ספרות כמו העמודה). שדה המספר
נשאר לצד הבורר לעריכה ידנית, ובדיקת הייחודיות של (אזור, מספר) שומרת על שניהם.

## היסטוריית סבבים

`rounds` ו-`station_completions` נכתבו מאז 0001 ולא נקראו על ידי אף מסך: כל
סבב שנסגר הפך לבלתי נגיש מהאפליקציה. `/rounds` (דשבורד ← היסטוריית סבבים)
מציג את הסבבים מהחדש לישן, פותח כל אחד לפירוט לפי עובד, ומייצא ל-CSV.

שם העובד מגיע מ-`user_name` שנשמר בשורת הלוג ולא מ-JOIN לפרופיל — כך סבב ישן
ממשיך להציג את מי שביצע גם אחרי שהחשבון נמחק.

## עבודה ללא חיבור

המשתמש נוסע ברכב. הנחת היסוד היא שהחיבור ייעלם באמצע הסבב.

**רק פעולה אחת נשמרת בתור:** סימון תחנה כבוצעה וביטול הסימון. זו הפעולה
היחידה שמתבצעת בשטח. פעולות הניהול — משתמשים, תחנות, איפוס סבב — נכשלות
בגלוי, בכוונה: הן מתבצעות בישיבה מול מחשב.

התור יושב ב-IndexedDB (`src/lib/offline-queue.ts`) ושורד רענון וסגירת דפדפן.
לכל תחנה רשומה אחת בלבד, ובה **הכוונה** ולא ההפרש — כך סדרת הקשות מתקפלת:
סימון → ביטול → סימון מסתנכרן כקריאה אחת, וסימון → ביטול לא מסתנכרן כלל.

כשל מסווג פעם אחת ב-`classifyMutationError`:

- **אין רשת** — הרשומה נשמרת, והכישלון **אינו** נספר כניסיון. עובד שאיבד
  קליטה חמש פעמים לא יאבד את הסבב שלו.
- **סירוב קבוע** (הרשאה, תחנה שנמחקה) — הרשומה נמחקת והמשתמש מקבל הודעה.
  פעולה שהשרת לעולם לא יקבל אסור שתנסה לנצח.
- **שגיאה לא מזוהה** — ניסיון חוזר, אך חסום: 5 ניסיונות או 24 שעות.

הסנכרון מופעל בשלושה אירועים — פתיחת האפליקציה, חזרת החיבור וחזרה ללשונית
(טלפון שישן במהלך החיבור מחדש לא מייצר אירוע `online`).

> **`useToggleStation` מגדיר `networkMode: 'always'` — אין להסיר.**
> ברירת המחדל של TanStack Query היא **להשהות** מוטציה כשאין רשת: הבקשה לא
> נשלחת, `onError` לא רץ, וההקשה נשמרת בזיכרון בלבד ואובדת ברענון. אומת
> בדפדפן — עם ברירת המחדל שום דבר לא הגיע לתור המתמיד.

**יציאה מהמערכת מנקה גם את התור וגם את מטמון התשובות של Supabase.** פעולה
שממתינה בתור תיזקף למי שמחובר בזמן הסנכרון, ומטמון ה-Service Worker ממופתח
לפי כתובת ה-URL בלבד ומתעלם מכותרת `Authorization` — בטאבלט משותף כל אחד
משניהם היה מוסר את הנתונים של עובד אחד לעובד הבא.

## PWA

האפליקציה ניתנת להתקנה: `manifest.webmanifest` בעברית ו-RTL, אייקונים
192/512 ו-maskable, ו-Service Worker שמקדים ומאחסן את קבצי הבילד.

תשובות `GET` מ-Supabase נשמרות ב-`NetworkFirst` עם פסק זמן של 5 שניות ותוקף
של 5 דקות — מי שפותח את האפליקציה בשטח מת רואה את רשימת התחנות ולא מסך
שגיאה. נתיבי `/auth/v1/` ופעולות שאינן `GET` לא נשמרות במטמון לעולם.

עדכוני גרסה הם `autoUpdate` **בתוספת** `onNeedReload`: הגרסה החדשה מותקנת
לבד, אבל הרענון עצמו מושהה כל עוד יש פעולות בתור, ומוצע כ-toast. רענון עם
הקשות שטרם סונכרנו היה מציג מחדש את תשובת השרת ומבטל סימונים שהעובד יודע
שביצע.

---

## בדיקות E2E

שני התסריטים מ-§12 כתובים ב-`e2e/`, אך **מסרבים לרוץ** ללא
`E2E_ALLOW_WRITES=1`.

תסריט הניהול קורא ל-`reset_round`, שמוחק כל סימון ביצוע ומאפס כל מונה
בפרויקט ש-`.env` מצביע אליו — לכל המשתמשים, ללא אפשרות ביטול. יש להריץ אותם
מול פרויקט חד-פעמי בלבד.

```bash
E2E_ALLOW_WRITES=1 \
E2E_WORKER_EMAIL=... E2E_WORKER_PASSWORD=... \
E2E_ADMIN_EMAIL=...  E2E_ADMIN_PASSWORD=... \
npm run test:e2e
```

---

## מבנה הפרויקט

```
src/
  lib/        supabase.ts  copy.ts  utils.ts  offline-queue.ts  rpc.ts
  types/      database.types.ts   (נוצר אוטומטית)
  hooks/
  components/
  pages/
  styles/     globals.css         (טוקנים של מערכת העיצוב)
e2e/          תסריטי Playwright   (חסומים מאחורי משתנה סביבה)
scripts/      בדיקות RTL וסולם הטוקנים, יצירת אייקונים
supabase/
  migrations/ 0001_initial_schema.sql  0002_round_history.sql
  functions/  admin-create-user  admin-delete-user  admin-reset-password
.github/
  workflows/  verify.yml          (CI)
vercel.json                       (SPA fallback)
```

`CLAUDE.md` מרכז את כללי הפיתוח — RTL, טוקנים, מחרוזות, טיפוסים והרשאות.

---

## אינטגרציה רציפה

`.github/workflows/verify.yml` מריץ `npm run verify` על כל Pull Request ועל כל
דחיפה ל-`main` — בדיקת טיפוסים, ESLint, שומר ה-RTL, שומר סולם הטוקנים,
Prettier, Vitest והבילד.

בדיקות ה-E2E **אינן** רצות שם בכוונה: תסריט הניהול קורא ל-`reset_round`.

## פריסה

```bash
npm run build     # התוצר ב-dist/
```

אתר סטטי רגיל. יש להגדיר בסביבת הפריסה את `VITE_SUPABASE_URL` ואת
`VITE_SUPABASE_ANON_KEY`.

**SPA fallback הוא חובה** — האפליקציה משתמשת ב-`createBrowserRouter`, ובלעדיו
רענון בכתובת כמו `/areas/<id>` יחזיר 404. `vercel.json` שבשורש עושה זאת עבור
Vercel; בהוסטינג אחר יש להגדיר את המקבילה (ב-Netlify: `/* /index.html 200`).
