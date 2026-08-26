import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '1020112010201120' },
        { data: '3020112030201120' },
        { data: '1040112010401120' }
    ]
};
const result = analyzePatterns(course);
console.log("Big Note Symbols:", result.symbols);
