/**
 * The single source of every user-visible string in the app (brief §3, rule 3
 * and §9). No string literal may appear in JSX.
 *
 * Strings that interpolate are exported as functions so the call site cannot
 * silently drop a placeholder.
 *
 * Ordering follows the brief's section numbering to keep the two reviewable
 * side by side.
 */

/* 9.1 Navigation & titles ---------------------------------------------------- */
export const nav = {
  signInTitle: 'התחבר',
  signIn: 'התחברות',
  forgotPasswordLink: 'שכחת סיסמה?',
  back: 'חזרה',
  forgotPasswordTitle: 'שכחת את הסיסמה',
  addStation: 'הוספת תחנה',
  editStation: 'עריכת תחנה',
  dashboard: 'דשבורד',
  users: 'משתמשים',
  newUser: 'משתמש חדש',
  editUser: 'עריכת משתמש',
  home: 'בית',
  add: 'הוסף',
  signOut: 'יציאה',
  /**
   * Added screens, not in §9.
   *
   * §8.2 ends at "a reset link was sent" and never describes the screen that
   * link opens, so the recovery flow had nowhere to land. The rest are the
   * admin and self-service screens the schema always supported.
   */
  resetPasswordTitle: 'בחירת סיסמה חדשה',
  profile: 'הפרופיל שלי',
  areas: 'ניהול אזורים',
  newArea: 'אזור חדש',
  editArea: 'עריכת אזור',
  history: 'היסטוריית סבבים',
} as const;

/* 9.2 Fields ----------------------------------------------------------------- */
export const fields = {
  email: 'אימייל',
  password: 'סיסמה',
  passwordConfirm: 'אימות סיסמה',
  fullName: 'שם מלא',
  admin: 'מנהל',
  worker: 'עובד',
  authorized: 'רשאי',
  stationName: 'שם תחנה',
  stationNumber: 'מספר תחנה',
  area: 'אזור',
  areaPlaceholder: 'בחר אזור',
  fuelType: 'סוג',
  fuelRegular: 'רגיל',
  fuelSuper: 'סופר',
  total: 'כמות',
  flyers: 'פליירים',
  wazeLink: 'קישור ניווט',
  /**
   * Added strings, not in §9.
   * §8.1 mandates a show/hide toggle on the password field but supplies no
   * accessible label, and an icon-only button without one is unusable on a
   * screen reader.
   */
  showPassword: 'הצג סיסמה',
  hidePassword: 'הסתר סיסמה',
  /* Profile, area management and round history — screens §9 does not cover. */
  newPassword: 'סיסמה חדשה',
  newPasswordConfirm: 'אימות הסיסמה החדשה',
  phone: 'טלפון',
  photo: 'תמונת פרופיל',
  areaName: 'שם האזור',
  areaOrder: 'סדר תצוגה',
  round: 'סבב',
  roundOpen: 'סבב פעיל',
  startedAt: 'התחיל',
  endedAt: 'הסתיים',
  stations: 'תחנות',
  /* The position helper on the station form. */
  position: 'מיקום בסבב',
  positionPlaceholder: 'בחר מיקום',
} as const;

/* 9.3 Actions ---------------------------------------------------------------- */
export const actions = {
  save: 'שמור',
  update: 'עדכן',
  add: 'הוסף',
  cancelShort: 'בטל',
  cancel: 'ביטול',
  confirm: 'אישור',
  continue: 'המשך',
  delete: 'מחק',
  deleteStation: 'מחק תחנה',
  resetAll: 'אפס הכל',
  navigate: 'נווט',
  navigateAnyway: 'נווט בכל זאת',
  markDone: 'סמן כבוצע',
  undoDone: 'בטל ביצוע',
  editStation: 'ערוך תחנה',
  markEnvelope: 'סמן מעטפה',
  markFlyers: 'סמן פליירים',
  exportCsv: 'ייצוא ל-CSV',
  backToSignIn: 'חזרה למסך ההתחברות',
  sendResetLink: 'שלח לינק לאיפוס הסיסמה',
  /**
   * Added strings, not in §9 — icon-only controls the brief specifies but does
   * not name, and an icon-only button without a label is unusable on a screen
   * reader.
   */
  toggleSort: 'הפוך סדר מיון',
  openMenu: 'פתח תפריט',
  /** Filter chips on the users list (§8.8 requires the filters, not their labels). */
  filterAll: 'הכל',
  filterUnauthorized: 'לא רשאי',
  search: 'חיפוש לפי שם או אימייל',
  /* Profile, area management, round history and the station search. */
  setNewPassword: 'שמור סיסמה חדשה',
  changePassword: 'שינוי סיסמה',
  uploadPhoto: 'העלאת תמונה',
  removePhoto: 'הסרת תמונה',
  addArea: 'הוספת אזור',
  rename: 'שינוי שם',
  moveUp: 'העלה בסדר התצוגה',
  moveDown: 'הורד בסדר התצוגה',
  searchStations: 'חיפוש לפי שם או מספר תחנה',
  clearSearch: 'ניקוי החיפוש',
  exportHistory: 'ייצוא היסטוריה ל-CSV',
} as const;

/* 9.4 Status & labels -------------------------------------------------------- */
export const labels = {
  greetingMorning: 'בוקר טוב',
  greetingNoon: 'צהריים טובים',
  greetingEvening: 'ערב טוב',
  remaining: (n: number) => `נשאר ${n}`,
  tabNotDone: (n: number) => `לא בוצע (${n})`,
  tabDone: (n: number) => `בוצע (${n})`,
  roundProgress: (done: number, total: number) => `הושלמו ${done} מתוך ${total} תחנות`,
  next: 'הבא',
  completedByAt: (date: string, name: string) => `בוצע ב-${date} ע"י ${name}`,
  totalRegular: 'סה"כ רגיל',
  totalSuper: 'סה"כ סופר',
  totalFlyers: 'סה"כ פליירים',
  done: 'בוצע',
  remainingShort: 'נשאר',
  hasEnvelope: 'יש מעטפה',
  hasFlyers: 'יש פליירים',
  /* Profile, area management and round history. */
  myCompletions: (n: number) => `ביצעת ${n} תחנות בסבב הנוכחי`,
  stationsInArea: (n: number) => `${n} תחנות`,
  roundCompletions: (n: number) => `${n} ביצועים`,
  roundWorkers: (n: number) => `${n} עובדים`,
  searchResults: (n: number) => `${n} תוצאות`,
  stillOpen: 'פעיל',
  /* The position helper on the station form. */
  positionFirst: 'ראשונה באזור',
  positionAfter: (name: string) => `אחרי ${name}`,
  /**
   * Durations for the pace stats (§ pace). Built by `formatDuration` in
   * `format.ts`; the `h:mm` run and the minute count are Latin digit runs, so a
   * caller mixing them into a Hebrew sentence wraps them in `.ltr-isolate`. The
   * suffixes use the geresh (׳), not an apostrophe.
   */
  durationMinutes: (n: number) => `${n} דק׳`,
  durationHours: (hoursMinutes: string) => `${hoursMinutes} שע׳`,
  /**
   * Distances for the location checks (§ location). Built by `formatDistance` in
   * `format.ts`; the number is a Latin run, wrapped in `.ltr-isolate` by callers.
   * Uses the geresh (׳) and gershayim (״), not ASCII quotes.
   */
  distanceMeters: (n: number) => `${n} מ׳`,
  distanceKm: (km: string) => `${km} ק״מ`,
  /**
   * Real work span of a round: first completion to last (§ F3, RoundsPage). A
   * static prefix, not an interpolation — the date RANGE that follows must live
   * in its own `.ltr-isolate` span (two dates around an en-dash reorder under
   * the bidi algorithm), while this Hebrew prefix stays in the RTL flow.
   */
  workSpan: 'עבודה בפועל:',
} as const;

/* 9.5 Dialogs ---------------------------------------------------------------- */
export const dialogs = {
  confirmComplete: {
    title: 'אישור ביצוע',
    body: (name: string) => `האם אתה בטוח שביצעת את ${name}?`,
  },
  confirmUncomplete: {
    title: 'ביטול ביצוע',
    body: (name: string) => `לבטל את סימון הביצוע של ${name}?`,
  },
  navigateWarning: {
    title: 'שים לב',
    body: 'נראה שאתה מנווט לתחנה שאינה הבאה ברשימה',
  },
  /**
   * Authored, not in §9. Guards a fat-finger double completion: when a worker
   * confirms a second station within two minutes of the previous one, the
   * confirm body names the previous station and how long ago it was, so an
   * accidental double-tap is caught while a genuine quick pair still goes
   * through. A warning, never a block. The window is under two minutes, so
   * `minutesAgo` is only ever 0 or 1 in practice; the plural branch is a
   * belt-and-braces.
   */
  rapidComplete: {
    title: 'שים לב',
    body: (minutesAgo: number, prevName: string, name: string) => {
      const ago =
        minutesAgo <= 0
          ? 'לפני פחות מדקה'
          : minutesAgo === 1
            ? 'לפני דקה'
            : `לפני ${minutesAgo} דקות`;
      return `${ago} סימנת את ${prevName}. בטוח שביצעת גם את ${name}?`;
    },
  },
  deleteStation: {
    title: 'מחיקת תחנה',
    body: (name: string) => `האם אתה בטוח שברצונך למחוק את ${name}? לא ניתן לבטל פעולה זו.`,
  },
  deleteUser: {
    title: 'מחיקת משתמש',
    body: (name: string) => `האם אתה בטוח שברצונך למחוק את ${name}? לא ניתן לבטל פעולה זו.`,
  },
  resetRound: {
    title: 'סימון הכל כלא בוצע',
    body: 'כל התחנות יעברו לסטטוס "לא בוצע" וכל המונים יאופסו. לא ניתן לבטל פעולה זו.',
    typeToConfirm: 'הקלד "אפס" כדי לאשר',
    /** The word the admin must type. Compared after trimming. */
    confirmWord: 'אפס',
  },
  signOut: {
    title: 'יציאה מהמערכת',
    body: 'האם ברצונך להתנתק?',
  },
  deleteArea: {
    title: 'מחיקת אזור',
    body: (name: string) => `האם אתה בטוח שברצונך למחוק את ${name}? לא ניתן לבטל פעולה זו.`,
    /**
     * The FK from stations.area_id is `on delete restrict`, so the database
     * refuses this anyway — but a Hebrew sentence naming the count is a better
     * answer than a refused write.
     */
    hasStations: (n: number) => `לא ניתן למחוק: יש באזור ${n} תחנות. העבר או מחק אותן קודם.`,
  },
  removePhoto: {
    title: 'הסרת תמונת הפרופיל',
    body: 'התמונה תוסר מהפרופיל שלך.',
  },
  resetUserPassword: {
    title: 'איפוס סיסמה למשתמש',
    body: (name: string) =>
      `תיקבע סיסמה חדשה עבור ${name}. הסיסמה הקודמת תפסיק לעבוד מיד, ויש למסור לו את החדשה.`,
  },
} as const;

/* 9.6 Errors ----------------------------------------------------------------- */
export const errors = {
  invalidCredentials: 'אימייל או סיסמה שגויים',
  emailNotConfirmed: 'החשבון טרם אומת. פנה למנהל המערכת.',
  emailAlreadyRegistered: 'כתובת האימייל כבר רשומה במערכת',
  passwordTooShort: 'הסיסמה חייבת להכיל לפחות 8 תווים',
  offline: 'אין חיבור לאינטרנט. הפעולה תישמר ותסונכרן בהמשך.',
  permissionDenied: 'אין לך הרשאה לבצע פעולה זו',
  generic: 'אירעה שגיאה. נסה שוב.',
  /**
   * Added codes, not in §9.6.
   *
   * The first two are Postgres constraint violations that only became
   * reachable once area management existed; the last two come from
   * `auth.updateUser` on the new password screens.
   */
  duplicateValue: 'הערך שהוזן כבר קיים במערכת',
  stillReferenced: 'לא ניתן למחוק: קיימות רשומות המשויכות לפריט זה',
  samePassword: 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית',
  recoveryLinkInvalid: 'הקישור אינו תקף או שפג תוקפו',
  fileTooLarge: 'הקובץ גדול מדי. הגודל המרבי הוא 2MB.',
  unsupportedImage: 'סוג הקובץ אינו נתמך. יש להעלות JPG, PNG או WebP.',
} as const;

/* 9.6 Validation ------------------------------------------------------------- */
export const validation = {
  required: 'שדה חובה',
  invalidEmail: 'כתובת אימייל לא תקינה',
  passwordsDoNotMatch: 'הסיסמאות אינן תואמות',
  passwordMin8: 'הסיסמה חייבת להכיל לפחות 8 תווים',
  /**
   * Added string, not in the brief's §9 list.
   *
   * §8.1 specifies sign-in validation as "password required, min 6", but the
   * only password message in §9.6 says 8. Rather than show an 8-character
   * message for a 6-character rule, sign-in gets its own. User CREATION (§8.8)
   * still uses `passwordMin8`.
   */
  passwordMin6: 'הסיסמה חייבת להכיל לפחות 6 תווים',
  positiveNumber: 'יש להזין מספר חיובי',
  stationNumberTaken: 'מספר תחנה זה כבר קיים באזור',
  cannotParseLocation: 'לא ניתן לחלץ מיקום מהקישור',
  nameMin2: 'השם חייב להכיל לפחות 2 תווים',
  /* Profile and area management. */
  invalidPhone: 'מספר טלפון לא תקין',
} as const;

/* 9.7 Empty & error states --------------------------------------------------- */
export const states = {
  noAreasAssigned: {
    title: 'לא הוקצו לך אזורים',
    body: 'פנה למנהל המערכת',
  },
  noStationsInArea: {
    title: 'אין תחנות באזור זה',
    body: 'הוסף תחנה כדי להתחיל',
  },
  noCompletedStations: 'עדיין לא בוצעו תחנות באזור זה',
  noUsersFound: 'לא נמצאו משתמשים',
  loadError: {
    title: 'אירעה שגיאה בטעינת הנתונים',
    retry: 'נסה שוב',
  },
  /**
   * Added string, not in §9. A skeleton is silent to a screen reader — it needs
   * an accessible name announcing that content is on its way.
   */
  loading: 'טוען…',
  noStationLocation: 'לא הוגדר מיקום לתחנה זו',
  /* Empty states for the screens added after §9 was written. */
  noAreas: {
    title: 'עדיין לא הוגדרו אזורים',
    body: 'הוסף אזור כדי שאפשר יהיה לשייך אליו תחנות ומשתמשים',
  },
  noRounds: {
    title: 'אין עדיין היסטוריית סבבים',
    body: 'סבב נסגר ונפתח מחדש בכל פעם שמאפסים את המערכת',
  },
  noSearchResults: {
    title: 'לא נמצאו תחנות',
    body: 'נסה מונח חיפוש אחר',
  },
} as const;

/* 9.8 Toasts ----------------------------------------------------------------- */
export const toasts = {
  stationCompleted: 'התחנה סומנה כבוצעה',
  stationUncompleted: 'סימון הביצוע בוטל',
  stationAdded: 'התחנה נוספה',
  stationUpdated: 'התחנה עודכנה',
  stationDeleted: 'התחנה נמחקה',
  roundReset: 'הסבב אופס בהצלחה',
  userCreated: 'המשתמש נוצר בהצלחה',
  userUpdated: 'המשתמש עודכן',
  userDeleted: 'המשתמש נמחק',
  permissionsUpdated: 'ההרשאות עודכנו',
  resetEmailSent: 'נשלח אליך אימייל לאיפוס הסיסמה',
  /* Profile and area management. */
  passwordChanged: 'הסיסמה עודכנה',
  profileUpdated: 'הפרופיל עודכן',
  photoUpdated: 'תמונת הפרופיל עודכנה',
  photoRemoved: 'תמונת הפרופיל הוסרה',
  areaAdded: 'האזור נוסף',
  areaUpdated: 'האזור עודכן',
  areaDeleted: 'האזור נמחק',
  userPasswordReset: 'הסיסמה של המשתמש עודכנה',
} as const;

/* 9.9 Offline ---------------------------------------------------------------- */
export const offline = {
  noConnection: 'אין חיבור לאינטרנט',
  pendingOperations: (n: number) => `${n} פעולות ממתינות לסנכרון`,
  synced: 'הנתונים סונכרנו',
  // Authored: §9.9 has no wording for a queued action the server refused.
  // Saying nothing would leave the worker believing a station was marked.
  syncFailed: 'סימון תחנה לא הצליח להסתנכרן ובוטל',
} as const;

/* New version available (§11) — authored, §9 supplies no wording. */
export const update = {
  available: 'גרסה חדשה זמינה',
  action: 'רענן',
} as const;

/* Forgot password (§8.2) ------------------------------------------------------
   §8.2 calls for an "explanatory paragraph" but never supplies its text, so
   this one is authored. */
export const forgotPassword = {
  intro: 'הזן את כתובת האימייל שאיתה נרשמת, ונשלח אליך קישור לאיפוס הסיסמה.',
  sent: 'אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס הסיסמה. בדוק גם בתיקיית הספאם.',
} as const;

/* Reset password (the screen the §8.2 email link opens) -----------------------
   Authored: §8.2 stops at "a link was sent" and never describes this screen. */
export const resetPassword = {
  intro: 'בחר סיסמה חדשה לחשבון שלך.',
  /** Shown when the page is opened without a valid recovery session. */
  invalid: 'הקישור אינו תקף או שפג תוקפו. אפשר לבקש קישור חדש.',
  requestNew: 'בקשת קישור חדש',
  done: 'הסיסמה הוחלפה. אפשר להמשיך לעבוד.',
  continue: 'המשך לאפליקציה',
} as const;

/* Profile (§9 has no self-service screen) ------------------------------------- */
export const profile = {
  contactIntro: 'השם הזה מוצג ליד כל תחנה שביצעת ובדשבורד המנהל.',
  passwordIntro: 'שינוי הסיסמה מתבצע מיד ואינו מנתק אותך מהמכשירים האחרים.',
  photoHint: 'JPG, PNG או WebP, עד 2MB',
  emailReadOnly: 'האימייל אינו ניתן לשינוי',
} as const;

/* Area management (§9 has no area screen) ------------------------------------- */
export const areas = {
  intro: 'האזורים קובעים לאילו תחנות עובד יכול לגשת, ואת סדר ההצגה במסך הבית.',
  orderHint: 'הסדר כאן הוא הסדר שבו האזורים מוצגים לעובדים',
} as const;

/* Admin user management, beyond what §8.8 covers ------------------------------ */
export const users = {
  passwordIntro:
    'קביעת סיסמה חדשה למשתמש ששכח את שלו ואין לו גישה לאימייל. יש למסור לו אותה באופן אישי, והוא יוכל להחליף אותה במסך הפרופיל.',
} as const;

/* The station form's position helper (§8.6 has the number field, not this) ---- */
export const stations = {
  positionHint: 'בחירת מיקום מחשבת את מספר התחנה. אפשר גם להקליד מספר ידנית.',
} as const;

/* Round history (§9 has no history screen) ------------------------------------ */
export const history = {
  intro: 'כל איפוס סוגר סבב ופותח חדש. הנתונים של הסבבים הקודמים נשמרים.',
  perWorker: 'פירוט לפי עובד',
  /**
   * Authored, for the real work span (§ F3). A round's `started_at`/`ended_at`
   * are administrative — a round can sit open for a month — so the honest span
   * is the first completion to the last. CSV column headers, and the accordion
   * builds a sentence from these via `labels.workSpan`.
   */
  firstCompletion: 'ביצוע ראשון',
  lastCompletion: 'ביצוע אחרון',
} as const;

/* Blocked screen (§8.3) ------------------------------------------------------ */
export const blocked = {
  title: 'מצטערים',
  body: 'אינך רשאי לצפות באפליקציה כעת',
} as const;

/* App-level -------------------------------------------------------------------
   `appName` is the PWA manifest name from §10. `adminOnly` is the Hebrew toast
   §7 requires when a non-admin hits an admin route. */
export const app = {
  name: 'סונול',
  adminOnly: 'אין לך הרשאה לבצע פעולה זו',
  missingConfig: 'תצורת החיבור לשרת חסרה. פנה למנהל המערכת.',
  notFound: 'הדף לא נמצא',
  toggleTheme: 'החלף ערכת נושא',
  /**
   * Added strings, not in §9. §8.8 requires a read-only note and a tooltip on
   * the self-demotion guard but supplies text for neither.
   */
  readOnlyNote: 'שם ואימייל אינם ניתנים לעריכה לאחר יצירת המשתמש',
  cannotDemoteSelf: 'לא ניתן להסיר לעצמך הרשאת ניהול',
  passwordStrength: 'חוזק הסיסמה',
} as const;

/* Pace between stations (§ F1, admin dashboard) -------------------------------
   Authored — §9 predates this screen. The manager wanted to see how long a
   worker takes between stations and be told about abnormally long legs. A leg
   is anomalous when its gap exceeds three times that worker's own median gap in
   the round, so a dense city area and a spread-out rural one each judge against
   their own normal, with no per-area threshold to maintain. */
export const pace = {
  title: 'קצב בין תחנות',
  intro: 'הזמן שעובר בין תחנות עוקבות שאותו עובד סימן, בסבב הנוכחי.',
  colWorker: 'עובד',
  colMedian: 'זמן חציוני',
  colMax: 'פער מרבי',
  colAnomalies: 'חריגות',
  /** Disclosure that lazily loads the anomalous-legs list. */
  showAnomalies: 'הצג פערים חריגים',
  anomalyHint: 'פער הארוך מפי שלושה מהזמן החציוני של אותו עובד',
  /** Shown instead of an anomaly count when a worker has too few legs to judge. */
  fewLegs: 'מעט מדי נתונים',
  /** A leg, as one label: the arrow points (in RTL) from the first station to the second. */
  anomalyLeg: (from: string, to: string) => `${from} ← ${to}`,
  empty: {
    title: 'אין עדיין מספיק נתונים',
    body: 'הקצב יופיע לאחר שעובדים יסמנו כמה תחנות ברצף בסבב הנוכחי',
  },
} as const;

/* Daily progress (§ F3, admin dashboard) -------------------------------------
   Authored — a day-by-day view of the current round's completions. Buckets come
   from `round_daily_stats`, already in Asia/Jerusalem. */
export const daily = {
  title: 'התקדמות יומית',
  /** Series name, shown in the chart tooltip and the table fallback. */
  seriesLabel: 'ביצועים',
  colDay: 'תאריך',
  empty: {
    title: 'אין עדיין ביצועים בסבב הנוכחי',
    body: 'הגרף יתמלא ככל שתחנות יסומנו',
  },
} as const;

/* Location verification (§ F4, admin dashboard + station card) ----------------
   Authored — §9 predates GPS capture. The worker's position at completion is
   compared to the station's own coordinates; a completion more than 500m away
   (after allowing for the fix's accuracy) is flagged so the manager can check
   it. Only completions with a captured position and a station that has
   coordinates can be judged; the rest simply do not appear. */
export const location = {
  title: 'ביצועים רחוק מהתחנה',
  intro: 'ביצועים שנרשמו יותר מ-500 מטר ממיקום התחנה, בסבב הנוכחי.',
  colWorker: 'עובד',
  colStation: 'תחנה',
  colDistance: 'מרחק',
  /**
   * Suffix on the admin station card: the distance renders before it in its own
   * `.ltr-isolate` span, this Hebrew word stays in the RTL flow → "320 מ׳ מהתחנה".
   */
  fromStation: 'מהתחנה',
  /** Marks a card/row whose completion is beyond the threshold. */
  farBadge: 'רחוק מהתחנה',
  empty: {
    title: 'אין ביצועים חריגים במיקום',
    body: 'כל הביצועים עם מיקום נרשמו סמוך לתחנה',
  },
} as const;

export const copy = {
  nav,
  fields,
  actions,
  labels,
  dialogs,
  errors,
  validation,
  states,
  toasts,
  offline,
  update,
  forgotPassword,
  resetPassword,
  profile,
  areas,
  users,
  stations,
  history,
  pace,
  daily,
  location,
  blocked,
  app,
} as const;

export type Copy = typeof copy;
