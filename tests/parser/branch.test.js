import test from 'node:test';
import assert from 'node:assert';
import { parseTJA } from '../../src/parser/tja-parser.js';

test('Branch commands are preserved in Editor data', () => {
    const tja = `
TITLE:Branch Test
BPM:120
COURSE:Oni
#START
#BRANCHSTART r,10,20
1111,
#N
2222,
#E
3333,
#M
4444,
#END
    `;
    const result = parseTJA(tja);
    const measures = result.courses[3].measures;
    
    // First measure has BRANCHSTART
    assert.strictEqual(measures[0].events.find(e => e.name === 'branchstart').value, 'r,10,20');
    // Second measure has N
    assert.strictEqual(measures[1].events.find(e => e.name === 'n').name, 'n');
    // Third measure has E
    assert.strictEqual(measures[2].events.find(e => e.name === 'e').name, 'e');
    // Fourth measure has M
    assert.strictEqual(measures[3].events.find(e => e.name === 'm').name, 'm');
});
