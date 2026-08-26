import test from 'node:test';
import assert from 'node:assert';

function findComposites(chunks) {
    // chunks is array of { str, pos }
    const uniqueStrs = [...new Set(chunks.map(c => c.str))];
    const results = [];
    
    for (const z of uniqueStrs) {
        // Try to split z into x and y
        for (let i = 2; i <= z.length - 2; i++) {
            // Case 1: Concatenation without overlap
            const x1 = z.slice(0, i);
            const y1 = z.slice(i);
            if (uniqueStrs.includes(x1) && uniqueStrs.includes(y1)) {
                results.push({ x: x1, y: y1, z, overlap: false });
            }
            
            // Case 2: Concatenation with 1-char overlap
            const x2 = z.slice(0, i);
            const y2 = z.slice(i - 1);
            if (uniqueStrs.includes(x2) && uniqueStrs.includes(y2)) {
                results.push({ x: x2, y: y2, z, overlap: true });
            }
        }
    }
    return results;
}

test('Composite finding', () => {
    const chunks = [
        { str: '221', pos: 1 },
        { str: '121', pos: 2 },
        { str: '22121', pos: 3 }
    ];
    const res = findComposites(chunks);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].x, '221');
    assert.strictEqual(res[0].y, '121');
    assert.strictEqual(res[0].z, '22121');
    assert.strictEqual(res[0].overlap, true);
});
