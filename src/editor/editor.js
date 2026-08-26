import { parseTJA, parseTJAForPreview } from '../parser/tja-parser.js';
import { setChartTime } from '../player/player.js';
import { updateUI } from '../ui/ui.js';

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TJAEditorDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

export function saveData(storeName, data) {
    if (!db) return Promise.reject("DB not initialized");
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

export function loadData(storeName, id) {
    if (!db) return Promise.reject("DB not initialized");
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function calculateEasing(t, type) { switch (type) { case 0: default: return t; } }

export function escapeHtml(string) {
  return string.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}

export function highlightTJA(text) {
  const lines = text.split('\n');
  let rendaState = 0; // 0:通常, 5:黄連打中, 7:風船中
  let inActiveChart = false; // #START〜#END の区間をトラッキング

  const highlightedLines = lines.map((line) => {
    const trimmed = line.trim();
    const upperLine = trimmed.toUpperCase();
    let lineHtml = "";
    
    // 行をトリムしたものが#STARTならアクティブ区間開始
    if (upperLine.startsWith('#START')) {
      inActiveChart = true;
    }
    
    if (trimmed.startsWith('//')) {
      // コメント: 薄いグレー
      lineHtml = `<span style="color: #6e7681; font-style: italic;">${escapeHtml(line)}</span>`;
    } else if (trimmed.startsWith('#')) {
      // 命令コマンド: 鮮やかなブルー（太字）
      lineHtml = `<span style="color: #58a6ff; font-weight: bold;">${escapeHtml(line)}</span>`; 
      
      // #END が現れたらアクティブ区間終了
      if (upperLine.startsWith('#END')) {
        inActiveChart = false;
      }
    } else if (/^[A-Z0-9_\-]+:/.test(trimmed.toUpperCase())) {
      // ヘッダー要素: 白色（太字）
      lineHtml = `<span style="color: #e3e3e6; font-weight: bold;">${escapeHtml(line)}</span>`;
    } else {
      // 譜面データ（ノーツ）: 1文字ずつカラー判定して色分け復元
      let result = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const escapedChar = escapeHtml(char);
        const textShadow = "text-shadow: 0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(255,255,255,0.05);";
        
        if (rendaState === 5) {
          result += `<span style="color: #ffff00; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          if (char === '8') rendaState = 0; 
        } else if (rendaState === 7) {
          result += `<span style="color: #ff9100; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          if (char === '8') rendaState = 0; 
        } else {
          if (char === '5' || char === '6') {
            rendaState = 5;
            result += `<span style="color: #ffff00; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '7') {
            rendaState = 7;
            result += `<span style="color: #ff9100; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '1' || char === '3') {
            result += `<span style="color: #ff3333; font-weight: bold; ${textShadow}">${escapedChar}</span>`; 
          } else if (char === '2' || char === '4') {
            result += `<span style="color: #33ebff; font-weight: bold; ${textShadow}">${escapedChar}</span>`; 
          } else if (char === '0' && inActiveChart) {
            // 【仕様維持】#STARTから#END区間の休符(0)をグレーに
            result += `<span style="color: #6e7681;">${escapedChar}</span>`;
          } else {
            result += escapedChar;
          }
        }
      }
      lineHtml = result;
    }
    
    const finalHtml = lineHtml === "" ? "&#8203;" : lineHtml;
    return `<div class="highlight-row" style="width:100%; word-break:break-all;">${finalHtml}</div>`;
  });
  
  return highlightedLines.join('');
}

export function updateLineNumbers(text) {
  const lineNumbers = u('.line-numbers').first();
  if (!lineNumbers) return;
  const lines = text.split('\n');
  
  const measureStartMap = {}; 
  
  let inActiveChart = false;
  let currentMeasureNum = 1;
  let currentMeasureStartLineIndex = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const rawLine = line.split('//')[0].trim();
    const upperLine = rawLine.toUpperCase();
    
    if (upperLine === '#START') {
      inActiveChart = true;
      currentMeasureNum = 1;
      currentMeasureStartLineIndex = null;
      continue;
    }
    if (upperLine === '#END') {
      inActiveChart = false;
      continue;
    }
    
    if (inActiveChart) {
      if (rawLine !== "") {
        if (currentMeasureStartLineIndex === null) {
          currentMeasureStartLineIndex = i;
          measureStartMap[i] = currentMeasureNum;
        }
        const commaCount = (rawLine.match(/,/g) || []).length;
        if (commaCount > 0) {
          currentMeasureStartLineIndex = null;
          currentMeasureNum += commaCount;
        }
      }
    }
  }
  
  let html = "";
  for (let i = 0; i < lines.length; i++) {
    const isError = ((i + 1) === errorLineNumber);
    const bgStyle = isError ? "background: rgba(255, 0, 0, 0.2);" : "";
    
    let measureSuffix = "";
    if (measureStartMap[i] !== undefined) {
      measureSuffix = `<span style="color: #ff8800; font-size: 6.5px; font-weight: normal; font-family: sans-serif; text-align: right; width: 18px; transform: scale(0.9); display: inline-block;">${measureStartMap[i]}</span>`;
    } else {
      measureSuffix = `<span style="width: 18px; display: inline-block;"></span>`;
    }
    
    html += `<div class="line-number-row" style="${bgStyle} height: 18px;" id="ln-row-${i}">` +
              `<span style="color: #555562; font-size: 8px; text-align: right; width: 18px; font-family: monospace; display: inline-block;">${i + 1}</span>` +
              measureSuffix +
            `</div>`;
  }
  lineNumbers.innerHTML = html;
  
  debouncedSyncLineHeights();
}

export function syncLineHeights() {
  const container = u('.editor-container').first();
  if (!container) return;
  
  const highlightRows = container.querySelectorAll('.highlight-row');
  const lnRows = container.querySelectorAll('.line-number-row');
  
  const len = Math.min(highlightRows.length, lnRows.length);
  const heights = new Array(len);
  
  // バッチRead処理: 決め打ち制限(textContent.length < 30)を撤廃し、すべての行の物理高さを実測取得してズレを解消！
  for (let i = 0; i < len; i++) {
      heights[i] = highlightRows[i].getBoundingClientRect().height;
  }
  
  const isMobile = window.innerWidth <= 768;
  const defaultHeight = isMobile ? '16px' : '18px';
  
  // バッチWrite処理: 実測された物理高さを左側の行番号ブロックに確実にバインド
  for (let i = 0; i < len; i++) {
      const lnRow = lnRows[i];
      const h = heights[i];
      if (h > 0) {
          lnRow.style.height = h + 'px'; 
      } else {
          lnRow.style.height = defaultHeight;
      }
  }
  syncScroll();
}

export function debouncedSyncLineHeights() {
    if (syncHeightTimeout) clearTimeout(syncHeightTimeout);
    syncHeightTimeout = setTimeout(() => {
        syncLineHeights();
    }, 50); 
}

export function syncScroll() {
  backdrop.scrollTop = textarea.scrollTop;
  backdrop.scrollLeft = textarea.scrollLeft;
  const lineNumbers = u('.line-numbers').first();
  if (lineNumbers) {
    lineNumbers.scrollTop = textarea.scrollTop;
  }
}

export function updateHighlight() {
  if (pendingHighlightUpdate) return;
  pendingHighlightUpdate = true;
  requestAnimationFrame(() => {
    const text = textarea.value;
    highlightDiv.innerHTML = highlightTJA(text);
    updateLineNumbers(text); 
    pendingHighlightUpdate = false;
  });
}

export const processFunc = () => {
  const val = u('.input').first().value;
  
  updateHighlight();
  if(!val) return;
  
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      tjaParsed = parseTJA(val);
      if (!selectedDifficulty || !tjaParsed.courses[selectedDifficulty]) selectedDifficulty = Object.keys(tjaParsed.courses)[0];
      
      currentChartData = tjaParsed.courses[selectedDifficulty] || null;
      if (currentChartData) {
        setChartTime(currentElapsedTime);
      }

      isChartCacheDirty = true; 
      updateUI();
      u('.errors').text('No error');
      
      if (errorLineNumber !== null) {
        errorLineNumber = null;
        updateHighlight();
      }
      
      localStorage.setItem('tja_tools_autosave', val);
    } catch(e) { 
      u('.errors').text(e.message);
      
      const match = e.message.match(/(?:行|line)\s*([0-9]+)/i);
      if (match) {
        errorLineNumber = parseInt(match[1], 10);
      } else {
        errorLineNumber = null;
      }
      updateHighlight(); 
    }
  }, 150);
};

