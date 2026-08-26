const fs = require('fs');
let text = fs.readFileSync('index.html', 'utf8');
const search = `</svg></div>\n        </div>\n      </div>`;
const replace = `</svg></div>\n        </div>\n        <div class="pattern-analysis-container" style="border-top: 1px solid #2c2c35; padding-top: 12px; margin-top: 12px;">\n          <h3 style="margin-bottom: 8px; color: #a0a0a8;">譜面構造・パターン解析</h3>\n          <div id="st-patterns" style="font-size: 11px; line-height: 1.5; color: #e3e3e6; max-height: 250px; overflow-y: auto; padding-right: 4px;"></div>\n        </div>\n      </div>`;
text = text.replace(search, replace);
fs.writeFileSync('index.html', text);
