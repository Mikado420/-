import test from 'node:test';
import assert from 'node:assert';

function extractAxis(measures) {
    if (measures.length < 2) return null;
    const len = measures[0].length;
    if (!measures.every(m => m.length === len)) return null;
    
    let axis = '';
    let noteCount = 0;
    for (let i = 0; i < len; i++) {
        const c = measures[0][i];
        if (c !== '0' && measures.every(m => m[i] === c)) {
            axis += c;
            noteCount++;
        } else {
            axis += '0';
        }
    }
    
    if (noteCount >= 2) {
        return axis;
    }
    return null;
}

function getVariations(measures, axis) {
    return measures.map(m => {
        let diff = '';
        for (let i = 0; i < m.length; i++) {
            diff += (m[i] === axis[i]) ? '0' : m[i];
        }
        return diff;
    });
}

test('Axis extraction', () => {
    const measures = [
        '1022102012021020',
        '1220122012021120',
        '1022120210221020',
        '1122120211221010'
    ];
    const axis = extractAxis(measures);
    assert.strictEqual(axis, '1020100010021000');
    
    const vars = getVariations(measures, axis);
    assert.strictEqual(vars[0], '0002002002000020');
});
