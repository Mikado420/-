import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '2210000' }, // X
        { data: '1210000' }, // Y
        { data: '2212100' }, // X+Y continuous
        { data: '0000000' }, // separate
        { data: '1110000' }, // A
        { data: '0000000' }, 
        { data: '2220000' }, // B
        { data: '0000000' }, 
        { data: '1112220' }, // A+B discontinuous
    ]
};
const result = analyzePatterns(course);
console.log("Composites:", result.composites);
