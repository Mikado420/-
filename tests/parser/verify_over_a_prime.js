import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '10201120' }, // A
        { data: '22120011' }, // B ?
        { data: '01022120' }  // C ?
    ]
};
const result = analyzePatterns(course);
console.log("Over A Prime:", result.symbols);
