import { drawChart, formatBpm } from '../renderer/chart-renderer.js';
import { updateJiroPreview } from '../player/player.js';
import { getStats, drawDensityGraph } from '../analysis/statistics.js';
import { analyzePatterns } from '../analysis/pattern.js';

export function triggerTaikoEffect(part, time) {
    taikoEffects[part].active = true;
    taikoEffects[part].startTime = time;
}

export function clearTaikoEffects() {
    for (const key in taikoEffects) {
        taikoEffects[key].active = false;
    }
    autoLastSide = 'L'; 
}

export function triggerAutoHitSide(hitType, time, isBig = false) {
    const hitQueue = [];

    if (hitType === 'don') {
        if (isBig) {
            hitQueue.push({ part: 'donR', priority: positionPriority.donR });
            hitQueue.push({ part: 'donL', priority: positionPriority.donL });
            autoLastSide = 'R'; 
        } else {
            if (autoLastSide === 'L') {
                hitQueue.push({ part: 'donR', priority: positionPriority.donR });
                autoLastSide = 'R';
            } else {
                hitQueue.push({ part: 'donL', priority: positionPriority.donL });
                autoLastSide = 'L';
            }
        }
    } else if (hitType === 'ka') {
        if (isBig) {
            hitQueue.push({ part: 'kaR', priority: positionPriority.kaR });
            hitQueue.push({ part: 'kaL', priority: positionPriority.kaL });
            autoLastSide = 'R'; 
        } else {
            if (autoLastSide === 'L') {
                hitQueue.push({ part: 'kaR', priority: positionPriority.kaR });
                autoLastSide = 'R';
            } else {
                hitQueue.push({ part: 'kaL', priority: positionPriority.kaL });
                autoLastSide = 'L';
            }
        }
    }

    hitQueue.sort((a, b) => b.priority - a.priority);

    hitQueue.forEach(h => {
        triggerTaikoEffect(h.part, time);
    });
}

export function updateUI() {
  u('.controls-diff .button').addClass('is-hidden');
  if(tjaParsed && tjaParsed.courses) Object.keys(tjaParsed.courses).forEach(d => u(`.btn-diff-${d}`).removeClass('is-hidden'));
  u('.button.is-active').removeClass('is-active');
  u(`.btn-diff-${selectedDifficulty}`).addClass('is-active');
  u(`.btn-page-${selectedPage}`).addClass('is-active');
  u('.page').addClass('is-hidden'); u(`.page-${selectedPage}`).removeClass('is-hidden');
  if (tjaParsed && selectedDifficulty !== '') {
    if (selectedPage === 'editor') {
      if (isChartCacheDirty || !cachedChartCanvas) {
        cachedChartCanvas = drawChart(tjaParsed, selectedDifficulty);
        isChartCacheDirty = false;
      }
      
      const viewCanvas = document.createElement('canvas');
      viewCanvas.width = cachedChartCanvas.width;
      viewCanvas.height = cachedChartCanvas.height;
      viewCanvas.style.width = cachedChartCanvas.style.width;
      viewCanvas.style.height = cachedChartCanvas.style.height;
      const viewCtx = viewCanvas.getContext('2d');
      viewCtx.drawImage(cachedChartCanvas, 0, 0);

      u('.page-editor').empty().append(viewCanvas);
      u('.page-editor').first().style.width = zoomLevel + '%';
    } else if (selectedPage === 'preview') {
      updateJiroPreview(currentElapsedTime);
    } else if (selectedPage === 'statistics') {
      const s = getStats(tjaParsed, selectedDifficulty); const dNames = ['かんたん','ふつう','むずかしい','おに','裏おに']; const c = tjaParsed.courses[selectedDifficulty];
      u('#st-title').text(tjaParsed.headers.title); u('#st-subtitle').text(tjaParsed.headers.subtitle || '');
      u('#st-diff').text(`${dNames[c.course]} ★${c.headers.level}`);
      let bStr = s.minBpm === s.maxBpm ? `${formatBpm(s.minBpm)}` : `${formatBpm(s.minBpm)}-${formatBpm(s.maxBpm)} (${formatBpm(s.mainBpm)})`;
      u('#st-bpm').text(bStr); u('#st-notes').text(s.combo); u('#st-time').text(s.perfTime.toFixed(2)+"s"); u('#st-density').text(s.density.toFixed(3)+" /s");
      
      let rendaHtml = `
        <div style="margin-bottom: 6px;">
          <div style="color: #8c8c9e; font-weight: bold; margin-bottom: 2px;">黄色連打</div>
          <div style="word-break: break-all; color: #e3e3e6;">`;
      
      if (s.rendas && s.rendas.length > 0) {
        rendaHtml += `${s.rendas.map(r => r.toFixed(2) + "s").join(" + ")}<br>`;
        rendaHtml += `(合計: ${s.rendas.reduce((a,b)=>a+b,0).toFixed(2)}s)`;
      } else {
        rendaHtml += `0.00s<br>(合計: 0.00s)`;
      }
      
      rendaHtml += `
          </div>
        </div>
        <div>
          <div style="color: #8c8c9e; font-weight: bold; margin-bottom: 2px;">風船連打</div>
          <div style="word-break: break-all; color: #e3e3e6;">`;

      const balloons = c.headers.balloon;
      if (balloons && balloons.length > 0) {
        const balloonSum = balloons.reduce((a, b) => a + b, 0);
        rendaHtml += `${balloons.map(b => b + "打").join(" + ")}<br>`;
        rendaHtml += `(合計: ${balloonSum}打)`;
      } else {
        rendaHtml += `なし<br>(合計: 0打)`;
      }
      
      rendaHtml += `
          </div>
        </div>
      `;
      
      u('#st-renda').html(rendaHtml); drawDensityGraph(s.measures);
      
      const p = analyzePatterns(c);
      let patternHtml = '';
      if (p) {
        patternHtml += `<div style="margin-bottom:12px;">
          <strong style="color:#ffffff;">展開構造 (ブロック毎)</strong><br><div style="line-height:1.8; margin-top:4px;">`;
        for(let i=0; i<p.symbols.length; i+=4) {
            patternHtml += `<span style="font-family:monospace; background:#1c1c25; padding:2px 4px; border-radius:3px; margin-right:4px;">${p.symbols.slice(i, i+4).join(' ')}</span>`;
        }
        patternHtml += `</div></div>`;

        if (p.composites.length > 0) {
            patternHtml += `<div style="margin-bottom:12px;">
              <strong style="color:#ffffff;">合成配置の検出</strong><br>`;
            const limit = Math.min(10, p.composites.length);
            for(let i=0; i<limit; i++) {
                const comp = p.composites[i];
                patternHtml += `<span style="color:#ff79c6;">${comp.x}</span> + <span style="color:#50fa7b;">${comp.y}</span> = <span style="color:#f1fa8c;">${comp.z}</span> ${comp.overlap ? '(重なりあり)' : '(連結)'}<br>`;
            }
            if(p.composites.length > limit) patternHtml += `<span style="color:#6e7681;">他 ${p.composites.length - limit} 件</span>`;
            patternHtml += `</div>`;
        }
        
        if (p.axes.length > 0) {
            patternHtml += `<div>
              <strong style="color:#ffffff;">軸配置の検出 (4小節単位)</strong><br>`;
            const limit = Math.min(5, p.axes.length);
            for(let i=0; i<limit; i++) {
                const ax = p.axes[i];
                patternHtml += `<div style="margin-top:4px; padding:6px; background:#1e1e24; border-radius:4px; font-family:monospace; font-size:10px;">
                  <div style="color:#8be9fd;">軸 (${ax.startMeasure + 1}小節〜): ${ax.axis.replace(/0/g, '<span style="color:#444;">0</span>')}</div>
                  <div style="color:#a0a0a8; margin-top:2px;">変形: ${ax.variations.map(v => v.replace(/0/g, '<span style="color:#444;">-</span>')).join(' <span style="color:#666;">|</span> ')}</div>
                </div>`;
            }
            if(p.axes.length > limit) patternHtml += `<span style="color:#6e7681; margin-top:4px; display:inline-block;">他 ${p.axes.length - limit} 件</span>`;
            patternHtml += `</div>`;
        }
      }
      u('#st-patterns').html(patternHtml || '<span style="color:#8c8c9e;">データがありません</span>');
    }
  }
}

