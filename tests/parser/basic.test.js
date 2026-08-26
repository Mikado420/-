import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'fs';
import { parseTJAForPreview } from '../../src/parser/tja-parser.js';

test('Basic TJA parsing', () => {
    const tja = fs.readFileSync('tests/fixtures/basic.tja', 'utf-8');
    const result = parseTJAForPreview(tja);
    
    // Check Global Config
    assert.strictEqual(result.globalConfig.TITLE, 'Basic Test');
    assert.strictEqual(result.globalConfig.SUBTITLE, 'Test');
    assert.strictEqual(result.globalConfig.BPM, 120);
    assert.strictEqual(result.globalConfig.OFFSET, -0.5);
    
    // Check Course
    assert.ok(result.courses[3]);
    const chart = result.courses[3];
    assert.deepStrictEqual(chart.ballonList, [10, 20]);
    
    // Commands check
    const bpmChanges = chart.commands.filter(c => c.type === 'BPMCHANGE');
    assert.strictEqual(bpmChanges.length, 2); 
    assert.strictEqual(bpmChanges[1].value, 240);
    
    const gogoStarts = chart.commands.filter(c => c.type === 'GOGOSTART');
    assert.strictEqual(gogoStarts.length, 1);
    
    // Note checks
    const notes = chart.notes;
    const hitNotes = notes.filter(n => n.type !== 'BARLINE' && n.type !== '8');
    assert.strictEqual(hitNotes.length, 2 + 8 + 1 + 1); 
    
    // Roll (type 5)
    const rolls = hitNotes.filter(n => n.type === '5');
    assert.strictEqual(rolls.length, 1);
    
    // Balloon (type 7)
    const balloons = hitNotes.filter(n => n.type === '7');
    assert.strictEqual(balloons.length, 1);
    assert.strictEqual(balloons[0].hits, 10);
});
