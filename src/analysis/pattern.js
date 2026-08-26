export function analyzePatterns(course) {
    const measures = course.measures;
    if (!measures || measures.length === 0) return null;

    // 1. Extract valid measures (ignore empty ones for pattern matching, or keep them as 'rest'?)
    // In TJA, empty measure data is often just no notes. Let's keep them so we don't break measure indices.
    
    // Helper to get notes as normalized fractions
    const getNotes = (m) => {
        const notes = [];
        const N = m.data ? m.data.length : 1;
        if (!m.data) return notes;
        for (let i = 0; i < N; i++) {
            const c = m.data[i];
            if (c !== '0') {
                notes.push({ pos: i / N, type: c, char: c });
            }
        }
        return notes;
    };

    const getSimilarity = (n1, n2) => {
        if (n1.length === 0 && n2.length === 0) return 1.0;
        if (n1.length === 0 || n2.length === 0) return 0.0;
        let matchScore = 0;
        let matched2 = new Set();
        for (let i = 0; i < n1.length; i++) {
            let bestIdx = -1, bestDiff = Infinity;
            for (let j = 0; j < n2.length; j++) {
                if (matched2.has(j)) continue;
                const diff = Math.abs(n1[i].pos - n2[j].pos);
                if (diff < 0.01) {
                    if (diff < bestDiff) { bestDiff = diff; bestIdx = j; }
                }
            }
            if (bestIdx !== -1) {
                matched2.add(bestIdx);
                matchScore += (n1[i].type === n2[bestIdx].type) ? 1.0 : 0.5;
            }
        }
        return matchScore / Math.max(n1.length, n2.length);
    };

    const measureNotes = measures.map(getNotes);
    
    // 2. Assign basic symbols
    const symbols = [];
    const baseMeasures = []; // { symbol, notes }
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let nextSymbolIdx = 0;

    for (let i = 0; i < measureNotes.length; i++) {
        const notes = measureNotes[i];
        if (notes.length === 0) {
            symbols.push('-');
            continue;
        }

        let bestMatch = null, bestSim = -1;
        for (const base of baseMeasures) {
            const sim = getSimilarity(base.notes, notes);
            if (sim > bestSim) { bestSim = sim; bestMatch = base; }
        }

        if (bestSim === 1.0) {
            symbols.push(bestMatch.symbol);
        } else if (bestSim >= 0.75) {
            symbols.push(bestMatch.symbol + "'");
        } else {
            const sym = ALPHABET[nextSymbolIdx % ALPHABET.length];
            nextSymbolIdx++;
            baseMeasures.push({ symbol: sym, notes });
            symbols.push(sym);
        }
    }

    // 3. Find composites (合成配置)
    const chunks = [];
    measures.forEach((m, idx) => {
        if (!m.data) return;
        // find contiguous non-zero sequences of length >= 2
        let current = '';
        for (let i = 0; i < m.data.length; i++) {
            if (m.data[i] !== '0') {
                current += m.data[i];
            } else {
                if (current.length >= 2) chunks.push({ str: current, measure: idx });
                current = '';
            }
        }
        if (current.length >= 2) chunks.push({ str: current, measure: idx });
    });

    const uniqueChunks = [...new Set(chunks.map(c => c.str))];
    const composites = [];
    for (const z of uniqueChunks) {
        if (z.length < 3) continue;
        for (let i = 2; i <= z.length - 1; i++) {
            // Try to collect all valid decompositions, prefer longer ones
            // Try to collect all valid decompositions, prefer longer ones
            const checkConsecutive = (x, y, z) => {
                for (let k = 0; k < chunks.length - 2; k++) {
                    if (chunks[k].str === x && chunks[k+1].str === y && chunks[k+2].str === z) return true;
                }
                return false;
            };

            // Case 2: Overlap
            const x2 = z.slice(0, i), y2 = z.slice(i - 1);
            if (y2.length >= 2 && uniqueChunks.includes(x2) && uniqueChunks.includes(y2)) {
                if (!composites.some(c => c.z === z)) composites.push({ x: x2, y: y2, z, overlap: true, continuous: checkConsecutive(x2, y2, z) });
            }
            // Case 1: Concatenation
            const x1 = z.slice(0, i), y1 = z.slice(i);
            if (y1.length >= 2 && uniqueChunks.includes(x1) && uniqueChunks.includes(y1)) {
                if (!composites.some(c => c.z === z)) composites.push({ x: x1, y: y1, z, overlap: false, continuous: checkConsecutive(x1, y1, z) });
            }
        }
    }

    // 4. Find Axis (軸配置)
    const axes = [];
    // We look at blocks of 4 measures
    for (let i = 0; i <= measures.length - 4; i += 4) {
        const block = measures.slice(i, i + 4);
        if (block.some(m => !m.data || m.data.length === 0)) continue;
        const len = block[0].data.length;
        if (!block.every(m => m.data.length === len)) continue;

        let axis = '';
        let noteCount = 0;
        for (let j = 0; j < len; j++) {
            const c = block[0].data[j];
            if (c !== '0' && block.every(m => m.data[j] === c)) {
                axis += c; noteCount++;
            } else {
                axis += '0';
            }
        }
        
        if (noteCount >= 2 && noteCount < len) {
            // It's a valid axis (not fully identical measures, but has common backbone)
            const variations = block.map(m => {
                let diff = '';
                for(let k=0; k<len; k++) diff += (m.data[k] === axis[k]) ? '0' : m.data[k];
                return diff;
            });
            // check if variations actually have notes (if all 0, measures are identical, no axis needed)
            if (variations.some(v => v.split('').some(c => c !== '0'))) {
                axes.push({ startMeasure: i, axis, variations, length: len });
            }
        }
    }

    // 5. Structure sequence
    const sequence = symbols.join('');
    
    return {
        symbols,
        sequence,
        composites,
        axes
    };
}
