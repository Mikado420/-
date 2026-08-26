const fs = require('fs');
let code = fs.readFileSync('src/analysis/pattern.js', 'utf8');

const search = `            // Case 1: Concatenation
            const x1 = z.slice(0, i), y1 = z.slice(i);
            if (y1.length >= 2 && uniqueChunks.includes(x1) && uniqueChunks.includes(y1)) {
                composites.push({ x: x1, y: y1, z, overlap: false });
                break;
            }
            // Case 2: Overlap
            const x2 = z.slice(0, i), y2 = z.slice(i - 1);
            if (y2.length >= 2 && uniqueChunks.includes(x2) && uniqueChunks.includes(y2)) {
                composites.push({ x: x2, y: y2, z, overlap: true });
                break;
            }`;

const replace = `            // Try to collect all valid decompositions, prefer longer ones
            // Case 2: Overlap
            const x2 = z.slice(0, i), y2 = z.slice(i - 1);
            if (y2.length >= 2 && uniqueChunks.includes(x2) && uniqueChunks.includes(y2)) {
                if (!composites.some(c => c.z === z)) composites.push({ x: x2, y: y2, z, overlap: true });
            }
            // Case 1: Concatenation
            const x1 = z.slice(0, i), y1 = z.slice(i);
            if (y1.length >= 2 && uniqueChunks.includes(x1) && uniqueChunks.includes(y1)) {
                if (!composites.some(c => c.z === z)) composites.push({ x: x1, y: y1, z, overlap: false });
            }`;

code = code.replace(search, replace);
fs.writeFileSync('src/analysis/pattern.js', code);
