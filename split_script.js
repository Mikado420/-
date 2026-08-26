const fs = require('fs');

const code = fs.readFileSync('script.js', 'utf-8');

// We will do some pattern matching to separate the code.

let parserCode = [];
let rendererCode = [];
let statsCode = [];
let playerCode = [];
let uiCode = [];
let stateCode = [];

// ... Wait, parsing 3300 lines by AST is better. Let's install acorn and astring.
