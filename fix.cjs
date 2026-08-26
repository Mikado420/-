const fs = require('fs');

let mainJs = fs.readFileSync('src/main.js', 'utf-8');
const match = mainJs.match(/async function loadAudioBuffer[\s\S]*?\n}\n/);

if (match) {
    let func = match[0];
    mainJs = mainJs.replace(func, '');
    fs.writeFileSync('src/main.js', mainJs);
    
    let playerJs = fs.readFileSync('src/player/player.js', 'utf-8');
    playerJs = playerJs + '\nexport ' + func;
    fs.writeFileSync('src/player/player.js', playerJs);
}

