import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from './csv';

describe('escapeCell', () => {
  it('leaves plain values alone', () => {
    expect(escapeCell('צפון')).toBe('צפון');
    expect(escapeCell(42)).toBe('42');
  });

  it('quotes values containing a comma, quote or newline', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('a\nb')).toBe('"a\nb"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel reads Hebrew correctly', () => {
    // Without this, Hebrew columns open as mojibake on Windows — the classic
    // "worked in testing, broken for the user" export bug.
    const csv = toCsv(['אזור'], [['צפון']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']]);
    expect(csv).toBe('﻿a,b\r\n1,2');
  });

  it('round-trips a realistic area row', () => {
    const csv = toCsv(['אזור', 'רגיל', 'סופר', 'פליירים', 'נשאר'], [['שרון', 12, 4, 30, 2]]);
    expect(csv).toContain('שרון,12,4,30,2');
  });

  it('handles an empty row set without producing a stray newline', () => {
    expect(toCsv(['אזור'], [])).toBe('﻿אזור');
  });
});
