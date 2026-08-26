import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '1022102010102000' },
        { data: '1011202010102000' },
        { data: '1022102010102000' },
        { data: '1011201020102000' },
        { data: '1022102010102000' },
        { data: '1011202010102000' },
        { data: '1022102010102000' },
        { data: '1011201020102000' }
    ]
};
const result = analyzePatterns(course);
console.log("Symbols:", result.symbols);
