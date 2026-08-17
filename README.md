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

| פקודה               | מה היא עושה                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | שרת פיתוח                                           |
| `npm run build`     | בדיקת טיפוסים + בילד לפרודקשן                       |
| `npm run preview`   | תצוגה מקדימה של הבילד                               |
| `npm run typecheck` | בדיקת טיפוסים בלבד                                  |
| `npm run lint`      | ESLint                                              |
| `npm run lint:rtl`  | איתור מאפייני CSS פיזיים שלא מתהפכים ב-RTL          |
| `npm run test`      | Vitest                                              |
| `npm run coverage`  | כיסוי בדיקות                                        |
| `npm run format`    | Prettier                                            |
| `npm run gen:types` | יצירה מחדש של `src/types/database.types.ts` מהסכימה |
| `npm run verify`    | כל הבדיקות יחד — להריץ לפני כל commit               |

---

## הקמת בסיס הנתונים

### 1. הרצת המיגרציה

`supabase/migrations/0001_initial_schema.sql` מכיל את כל הסכימה: טבלאות,
אינדקסים, טריגרים, מדיניות RLS, פונקציות RPC, Views, אחסון ו-Realtime.

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
- **יצירה ומחיקה של משתמשים רצות ב-Edge Function** עם מפתח service role, כדי
  שהסשן של המנהל לא יוחלף ושחשבון ה-auth יימחק יחד עם הפרופיל.

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

---

## מבנה הפרויקט

```
src/
  lib/        supabase.ts  copy.ts  utils.ts
  types/      database.types.ts   (נוצר אוטומטית)
  hooks/
  components/
  pages/
  styles/     globals.css         (טוקנים של מערכת העיצוב)
supabase/
  migrations/ 0001_initial_schema.sql
  functions/  admin-create-user  admin-delete-user
```

`CLAUDE.md` מרכז את כללי הפיתוח — RTL, טוקנים, מחרוזות, טיפוסים והרשאות.

---

## פריסה

```bash
npm run build     # התוצר ב-dist/
```

אתר סטטי רגיל. יש להגדיר בסביבת הפריסה את `VITE_SUPABASE_URL` ואת
`VITE_SUPABASE_ANON_KEY`, ולוודא ש-SPA fallback מפנה כל נתיב ל-`index.html`
(האפליקציה משתמשת ב-`createBrowserRouter`).
