import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '1020200010002000' },
        { data: '1000202010002000' },
        { data: '1000200010202000' },
        { data: '1000200010002020' },
        
        { data: '1020100010010010' },
        { data: '1000102010010010' },
        { data: '1000100010210010' },
        { data: '1000100010010210' },
    ]
};
const result = analyzePatterns(course);
console.log("Axes:", result.axes);
