const fs = require('fs');
let code = fs.readFileSync('src/ui/ui.js', 'utf8');
code = code.replace(
    "\\${comp.z}</span> \\${comp.overlap ? '(重なりあり)' : '(連結)'}<br>`",
    "\\${comp.z}</span> <span style=\\\"color:#a0a0a8; font-size:10px;\\\">\\${comp.overlap ? '(重合)' : '(連結)'} \${comp.continuous ? '【連続】' : '【非連続】'}</span><br>`"
);
fs.writeFileSync('src/ui/ui.js', code);
