const fs = require('fs');
let code = fs.readFileSync('src/ui/ui.js', 'utf8');

// The call is probably const p = analyzePatterns(c);
code = code.replace(/const\s+p\s*=\s*analyzePatterns\s*\(\s*c\s*\);?/g, '');

fs.writeFileSync('src/ui/ui.js', code);
console.log("ui.js patched again.");
