import { drawChart, formatBpm } from '../renderer/chart-renderer.js';
import { updateJiroPreview } from '../player/player.js';
import { getStats, drawDensityGraph } from '../analysis/statistics.js';

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
    }
  }
}

