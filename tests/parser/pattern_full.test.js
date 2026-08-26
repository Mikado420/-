import test from 'node:test';
import assert from 'node:assert';
import { analyzePatterns } from '../../src/analysis/pattern.js';

test('Full Pattern Analysis', () => {
    const course = {
        measures: [
            { data: '10201120' },
            { data: '10202120' }, // similar to A -> A'
            { data: '10201120' }, // exact A
            { data: '11211212' }, // different -> B
            { data: '22100000' }, 
            { data: '12100000' },
            { data: '22121000' }, // composite!
            { data: '00000000' }, 
            { data: '1022102012021020' }, // axis tests
            { data: '1220122012021120' },
            { data: '1022120210221020' },
            { data: '1122120211221010' }
        ]
    };
    
    const result = analyzePatterns(course);
    assert.strictEqual(result.symbols[0], 'A');
    assert.strictEqual(result.symbols[1], "A'");
    assert.strictEqual(result.symbols[2], 'A');
    assert.strictEqual(result.symbols[3], 'B');
    
    // Check composite
    const comp = result.composites.find(c => c.x === '221' && c.y === '121' && c.z === '22121');
    assert.ok(comp, 'Should find composite 221+121=22121');
    
    // Check axis
    assert.strictEqual(result.axes.length, 2, 'Should find 2 axis blocks');
    assert.strictEqual(result.axes[1].axis, '1020100010021000');
});
