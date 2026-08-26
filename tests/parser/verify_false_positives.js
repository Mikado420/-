import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '10201120' }, // A
        { data: '22121221' }, // B
        { data: '01022120' }, // C
        { data: '20112220' }  // D
    ]
};
const result = analyzePatterns(course);
console.log("False Positives:", result.symbols);
console.log("Composites:", result.composites);
console.log("Axes:", result.axes);
