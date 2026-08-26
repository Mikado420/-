import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'fs';
import { parseTJAForPreview } from '../../src/parser/tja-parser.js';

test('SCROLL and GOGO parsing', () => {
    const tja = `
TITLE:Scroll Test
BPM:120
COURSE:Oni
#START
#SCROLL 2.0
1000,
#GOGOSTART
1000,
#GOGOEND
#SCROLL 0.5
1000,
#END
    `;
    const result = parseTJAForPreview(tja);
    const chart = result.courses[3];
    
    // Notes: 1000, 1000, 1000 -> 3 notes
    const hitNotes = chart.notes.filter(n => n.type === '1');
    assert.strictEqual(hitNotes.length, 3);
    
    // First note should have scroll 2.0 and gogo false
    // Wait, note objects have `scroll` property? Yes.
    assert.strictEqual(hitNotes[0].scroll, 2.0);
    
    // Commands should contain SCROLL and GOGO
    const scrolls = chart.commands.filter(c => c.type === 'SCROLL');
    assert.strictEqual(scrolls.length, 3); // initial (1.0), 2.0, 0.5
    assert.strictEqual(scrolls[1].value, 2.0);
    assert.strictEqual(scrolls[2].value, 0.5);
    
    const gogos = chart.commands.filter(c => c.type === 'GOGOSTART' || c.type === 'GOGOEND');
    assert.strictEqual(gogos.length, 2);
});
