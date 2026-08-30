const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove pattern-analysis-container
const patternStart = html.indexOf('<div class="pattern-analysis-container"');
if (patternStart !== -1) {
    const nextDiv = html.indexOf('</div>', html.indexOf('</div>', html.indexOf('</div>', patternStart) + 1) + 1);
    // Actually simpler string replace
    html = html.replace(/<div class="pattern-analysis-container"[^>]*>[\s\S]*?<div id="st-patterns"[^>]*><\/div>\s*<\/div>/, '');
}

// 2. Add Audio page tab button
const statBtnIndex = html.indexOf('<span class="button btn-page-statistics"');
if (statBtnIndex !== -1) {
    html = html.replace('<span class="button btn-page-statistics" data-value=\'statistics\'>情報</span>', 
    '<span class="button btn-page-statistics" data-value=\'statistics\'>情報</span>\n    <span class="button btn-page-audio" data-value=\'audio\'>音源</span>');
}

// 3. Add Audio page content
const gradPageEnd = html.indexOf('</div>', html.indexOf('<div class="page page-gradation')) + 6;
// Wait, the gradation page is quite large. Let's insert before </div>    </div>  </section>
const audioPageHtml = `
      <div class="page page-audio is-hidden">
        <h2>音源設定</h2>
        
        <div style="margin-bottom: 12px;">
          <h3 style="color: #a0a0a8; font-size: 12px; margin-bottom: 6px;">URLから取得</h3>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="audio-url-input" placeholder="YouTube / SoundCloud URL" style="flex: 1; padding: 6px; background: #23232d; border: 1px solid #3c3c4a; color: white; border-radius: 4px; font-size: 11px;">
            <button class="button" id="btn-fetch-url" style="background: #4f46e5; color: white; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 11px; white-space: nowrap;">取得して使用</button>
          </div>
          <div id="audio-url-error" style="color: #ff5555; font-size: 11px; margin-top: 6px; display: none;"></div>
        </div>

        <div style="margin-bottom: 12px;">
          <h3 style="color: #a0a0a8; font-size: 12px; margin-bottom: 6px;">ローカル音源 (OGG推奨)</h3>
          <button class="button" id="btn-load-local-audio" style="width: 100%; background: #2e2e38; color: white; border: 1px solid #444; padding: 6px 12px; border-radius: 4px; font-size: 11px;">ファイルを選択</button>
          <input type="file" id="local-audio-input" class="is-hidden" accept="audio/*">
        </div>

        <div style="margin-bottom: 12px;">
          <h3 style="color: #a0a0a8; font-size: 12px; margin-bottom: 6px;">出力ファイル名</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="audio-filename-input" placeholder="My Song" style="flex: 1; padding: 6px; background: #23232d; border: 1px solid #3c3c4a; color: white; border-radius: 4px; font-size: 11px;">
            <span style="color: #8c8c9e; font-size: 11px;">.ogg</span>
          </div>
        </div>

        <div style="margin-top: 16px; border-top: 1px solid #2c2c35; padding-top: 12px;">
          <h3 style="color: #a0a0a8; font-size: 12px; margin-bottom: 8px;">音源解析結果</h3>
          <div style="font-size: 11px; line-height: 1.6; color: #e3e3e6;" id="audio-analysis-result">
            <span style="color: #6e7681;">音源を読み込むと、拍位置・BPM・OFFSETが解析されます。</span>
          </div>
        </div>
      </div>
`;
html = html.replace('      <div class="page page-gradation is-hidden">', audioPageHtml + '\n      <div class="page page-gradation is-hidden">');

// 4. Add ZIP button to footer
html = html.replace('<button class="button" style="background:#15803d; color:white; border:none;" id="btn-save">PNG</button>',
    '<button class="button" style="background:#15803d; color:white; border:none;" id="btn-save">PNG</button>\n    <button class="button" style="background:#15803d; color:white; border:none;" id="btn-zip-save">ZIP</button>');

// 5. Add Image Display Toggle
html = html.replace('<div style="margin-left:auto; display:flex; gap:3px;">',
    '<div style="margin-left:auto; display:flex; gap:10px; align-items:center;">\n      <label style="font-size: 11px; color: #a0a0a8; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="toggle-chart-image" checked> 譜面画像</label>\n      <div style="display:flex; gap:3px;">');

html = html.replace('      <div style="display:flex; gap:3px;">\n        <button class="button" id="zoom-out"', '<div style="display:flex; gap:3px;">\n        <button class="button" id="zoom-out"');
fs.writeFileSync('index.html', html);
console.log("index.html updated successfully!");
