import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '10201120' }, // 4 notes
        { data: '10209999' }  // 2 notes match, 2 notes are '9' (which means non-note but technically parsed as note if it was valid TJA, let's use 10200000)
    ]
};
const result = analyzePatterns(course);
console.log("Partial Match:", result.symbols);
