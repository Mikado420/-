import { analyzePatterns } from '../../src/analysis/pattern.js';
const course = {
    measures: [
        { data: '10201120' },
        { data: '10202120' }, 
        { data: '10201120' }, 
        { data: '11211212' }, 
        { data: '22100000' }, 
        { data: '12100000' },
        { data: '22121000' }, 
        { data: '00000000' }, 
        { data: '1022102012021020' }, 
        { data: '1220122012021120' },
        { data: '1022120210221020' },
        { data: '1122120211221010' }
    ]
};
const result = analyzePatterns(course);
console.log("Composites:", result.composites);
