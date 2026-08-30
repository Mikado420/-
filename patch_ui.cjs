const fs = require('fs');
let code = fs.readFileSync('src/ui/ui.js', 'utf8');

// Remove import
code = code.replace(/import\s+\{\s*analyzePatterns\s*\}\s+from\s+['"]\.\.\/analysis\/pattern\.js['"];?\n?/, '');

// Remove the call and display logic
const searchString = "const patternResult = analyzePatterns(parsed);";
const startIndex = code.indexOf(searchString);
if (startIndex !== -1) {
    const fnEnd = code.indexOf('}', startIndex); // Actually it's inside updateStatistics()
    // Let's replace by regex for the entire block dealing with patternResult.
    code = code.replace(/const patternResult = analyzePatterns\(parsed\);[\s\S]*?stPatterns\.innerHTML = patternHtml;\n/, '');
}

fs.writeFileSync('src/ui/ui.js', code);
console.log("ui.js patched.");
