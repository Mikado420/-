import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '10201120' }, // 4 notes
        { data: '10200000' }  // 2 notes
    ]
};
const result = analyzePatterns(course);
console.log("Partial Match 2:", result.symbols);
