const fs = require('fs');
let code = fs.readFileSync('src/ui/ui.js', 'utf8');

const search = `      drawDensityGraph(s.measures);`;

const replace = `      drawDensityGraph(s.measures);
      
      const p = analyzePatterns(c);
      let patternHtml = '';
      if (p) {
        patternHtml += \`<div style="margin-bottom:12px;">
          <strong style="color:#ffffff;">展開構造 (ブロック毎)</strong><br><div style="line-height:1.8; margin-top:4px;">\`;
        for(let i=0; i<p.symbols.length; i+=4) {
            patternHtml += \`<span style="font-family:monospace; background:#1c1c25; padding:2px 4px; border-radius:3px; margin-right:4px;">\${p.symbols.slice(i, i+4).join(' ')}</span>\`;
        }
        patternHtml += \`</div></div>\`;

        if (p.composites.length > 0) {
            patternHtml += \`<div style="margin-bottom:12px;">
              <strong style="color:#ffffff;">合成配置の検出</strong><br>\`;
            const limit = Math.min(10, p.composites.length);
            for(let i=0; i<limit; i++) {
                const comp = p.composites[i];
                patternHtml += \`<span style="color:#ff79c6;">\${comp.x}</span> + <span style="color:#50fa7b;">\${comp.y}</span> = <span style="color:#f1fa8c;">\${comp.z}</span> \${comp.overlap ? '(重なりあり)' : '(連結)'}<br>\`;
            }
            if(p.composites.length > limit) patternHtml += \`<span style="color:#6e7681;">他 \${p.composites.length - limit} 件</span>\`;
            patternHtml += \`</div>\`;
        }
        
        if (p.axes.length > 0) {
            patternHtml += \`<div>
              <strong style="color:#ffffff;">軸配置の検出 (4小節単位)</strong><br>\`;
            const limit = Math.min(5, p.axes.length);
            for(let i=0; i<limit; i++) {
                const ax = p.axes[i];
                patternHtml += \`<div style="margin-top:4px; padding:6px; background:#1e1e24; border-radius:4px; font-family:monospace; font-size:10px;">
                  <div style="color:#8be9fd;">軸 (\${ax.startMeasure + 1}小節〜): \${ax.axis.replace(/0/g, '<span style="color:#444;">0</span>')}</div>
                  <div style="color:#a0a0a8; margin-top:2px;">変形: \${ax.variations.map(v => v.replace(/0/g, '<span style="color:#444;">-</span>')).join(' <span style="color:#666;">|</span> ')}</div>
                </div>\`;
            }
            if(p.axes.length > limit) patternHtml += \`<span style="color:#6e7681; margin-top:4px; display:inline-block;">他 \${p.axes.length - limit} 件</span>\`;
            patternHtml += \`</div>\`;
        }
      }
      u('#st-patterns').html(patternHtml || '<span style="color:#8c8c9e;">データがありません</span>');`;

if (code.includes(search)) {
    code = code.replace(search, replace);
    fs.writeFileSync('src/ui/ui.js', code);
    console.log("Patched ui.js successfully.");
} else {
    console.log("Search string not found!");
}
