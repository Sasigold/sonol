import { describe, expect, it } from 'vitest';
import { copy } from './copy';

/**
 * The brief supplies the Hebrew dictionary verbatim, punctuation included.
 * These assertions are a regression guard: if someone "tidies" a string, the
 * build fails rather than the wording quietly drifting.
 */
describe('copy', () => {
  it('interpolates the labels that take arguments', () => {
    expect(copy.labels.remaining(7)).toBe('נשאר 7');
    expect(copy.labels.tabNotDone(3)).toBe('לא בוצע (3)');
    expect(copy.labels.tabDone(12)).toBe('בוצע (12)');
    expect(copy.labels.roundProgress(12, 30)).toBe('הושלמו 12 מתוך 30 תחנות');
    expect(copy.labels.completedByAt('14/3 09:20', 'דנה')).toBe('בוצע ב-14/3 09:20 ע"י דנה');
    expect(copy.offline.pendingOperations(2)).toBe('2 פעולות ממתינות לסנכרון');
    expect(copy.labels.myCompletions(5)).toBe('ביצעת 5 תחנות בסבב הנוכחי');
    expect(copy.labels.stationsInArea(18)).toBe('18 תחנות');
    expect(copy.labels.roundCompletions(120)).toBe('120 ביצועים');
    expect(copy.labels.searchResults(0)).toBe('0 תוצאות');
    expect(copy.labels.durationMinutes(23)).toBe('23 דק׳');
    expect(copy.labels.durationHours('1:47')).toBe('1:47 שע׳');
    expect(copy.labels.distanceMeters(320)).toBe('320 מ׳');
    expect(copy.labels.distanceKm('1.2')).toBe('1.2 ק״מ');
    expect(copy.pace.anomalyLeg('תחנת רמלה', 'תחנת לוד')).toBe('תחנת רמלה ← תחנת לוד');
  });

  it('phrases the rapid-completion warning for both time framings', () => {
    expect(copy.dialogs.rapidComplete.body(0, 'תחנת רמלה', 'תחנת לוד')).toBe(
      'לפני פחות מדקה סימנת את תחנת רמלה. בטוח שביצעת גם את תחנת לוד?',
    );
    expect(copy.dialogs.rapidComplete.body(1, 'תחנת רמלה', 'תחנת לוד')).toBe(
      'לפני דקה סימנת את תחנת רמלה. בטוח שביצעת גם את תחנת לוד?',
    );
  });

  it('names the affected entity in every destructive dialog', () => {
    expect(copy.dialogs.confirmComplete.body('תחנת רמלה')).toBe(
      'האם אתה בטוח שביצעת את תחנת רמלה?',
    );
    expect(copy.dialogs.confirmUncomplete.body('תחנת רמלה')).toBe(
      'לבטל את סימון הביצוע של תחנת רמלה?',
    );
    expect(copy.dialogs.deleteStation.body('תחנת רמלה')).toBe(
      'האם אתה בטוח שברצונך למחוק את תחנת רמלה? לא ניתן לבטל פעולה זו.',
    );
    expect(copy.dialogs.deleteUser.body('דנה')).toBe(
      'האם אתה בטוח שברצונך למחוק את דנה? לא ניתן לבטל פעולה זו.',
    );
    expect(copy.dialogs.deleteArea.body('שרון')).toBe(
      'האם אתה בטוח שברצונך למחוק את שרון? לא ניתן לבטל פעולה זו.',
    );
    expect(copy.dialogs.deleteArea.hasStations(4)).toBe(
      'לא ניתן למחוק: יש באזור 4 תחנות. העבר או מחק אותן קודם.',
    );
  });

  it('keeps the reset-round confirmation word matching its instruction', () => {
    expect(copy.dialogs.resetRound.typeToConfirm).toContain(copy.dialogs.resetRound.confirmWord);
    expect(copy.dialogs.resetRound.confirmWord).toBe('אפס');
  });

  it('contains no Latin characters in user-facing text', () => {
    // Guards defect 19: English strings leaking into a Hebrew app.
    // Latin is allowed only where the brief itself uses it (e.g. "ייצוא ל-CSV")
    // or where the Latin run IS the term: file formats and a size in MB have
    // no Hebrew spelling a user would recognise.
    const ALLOWED = new Set<string>([
      copy.actions.exportCsv,
      copy.actions.exportHistory,
      copy.profile.photoHint,
      copy.errors.fileTooLarge,
      copy.errors.unsupportedImage,
    ]);
    const latin = /[A-Za-z]/;

    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (!ALLOWED.has(value)) {
          expect(latin.test(value), `${path} contains Latin text: ${value}`).toBe(false);
        }
        return;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          walk(child, `${path}.${key}`);
        }
      }
    };

    walk(copy, 'copy');
  });
});
