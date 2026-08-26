import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '1000200010002000' },
        { data: '1000200010002000' },
        { data: '1000200010002000' },
        { data: '1000200010002000' },
        { data: '1000100010010010' },
        { data: '1000100010010010' },
        { data: '1000100010010010' },
        { data: '1000100010010010' },
    ]
};
const result = analyzePatterns(course);
console.log("Axes:", result.axes);
