const fs = require('fs');
let code = fs.readFileSync('src/ui/ui.js', 'utf8');

const startBlock = code.indexOf('if (p && p.symbols) {');
if (startBlock !== -1) {
    const endBlock = code.indexOf('u(\'#st-patterns\').html', startBlock);
    if (endBlock !== -1) {
        const endLine = code.indexOf('}', endBlock);
        code = code.slice(0, startBlock) + code.slice(endLine + 1);
    }
}
fs.writeFileSync('src/ui/ui.js', code);
console.log("ui.js block removed.");
