import { analyzeAudio, generateEmptyTja } from './audio/audio.js';
import JSZip from 'jszip';
import { syncLineHeights, syncScroll, processFunc, saveData, initDB, loadData } from './editor/editor.js';
import { stopSimulation, setChartTime, initializeAudio, seekChartState, togglePlay, resetSimulation, findMeasureIndex, updateJiroPreview, seekToMeasure, startSimulation } from './player/player.js';
import { convertMCtoTJA, loadFileWithEncoding, parseTJA } from './parser/tja-parser.js';
import { updateUI } from './ui/ui.js';
import { replaceGradation } from './analysis/statistics.js';

window.tjaParsed = null;
window.selectedDifficulty = '';
window.selectedPage = 'editor';
window.zoomLevel = 100;
window.audioContext = null;
window.musicAudioBuffer = null;
window.musicSourceNode = null;
window.seGainNode = null;
window.musicGainNode = null;
window.audioBuffers = {};
window.isPlaying = false;
window.wasPlayingBeforeHidden = false;
window.currentElapsedTime = 0.0;
window.simulationStartOffset = 0.0;
window.simulationStartTime = 0.0;
window.lastFrameTime = 0;
window.lastLogicTime = 0;
window.animationFrameId = null;
window.logicIntervalId = null;
window.isAutoPlay = true;
window.currentCombo = 0;
window.currentMeasureIndex = 0;
window.currentChartData = null;
window.autoRollSpeed = 30.0;
window.renderFPS = 60;
window.scrollMultiplier = 1.0;
window.seVolume = 0.8;
window.musicVolume = 0.8;
window.playbackSpeed = 1.0;
window.lastAutoEffectTime = 0;
window.stopAtTime = null;
window.chartCoolDownUntil = null;
window.lastGogoStartTime = -Infinity;
window.coolDownTime = 1.0;
window.playerKeys = { donL: ['F'], donR: ['J'], kaL: ['D'], kaR: ['K'] };
window.lastSEPlayTime = { don: 0, ka: 0, balloon: 0 };
window.hitEffectTimeout = { donLeft: null, donRight: null, kaLeft: null, kaRight: null };
window.HIT_POSITION_X_DEFAULT = 175;
window.HIT_POSITION_X = 175;
window.BASE_SCROLL_FACTOR = 2.0;
window.JPOS_INPUT_STANDARD_WIDTH = 946;
window.JPOS_ACTUAL_MEASURE_WIDTH = 480;
window.NOTE_COLORS = { '1': '#F44336', '2': '#2196F3', '3': '#F44336', '4': '#2196F3', '5': '#FFC107', '6': '#FFC107', '7': '#f97902' };
window.NOTE_SIZE = { '1': 15, '2': 15, '3': 22.5, '4': 22.5, '5': 15, '6': 22.5, '7': 22.5 };
window.JUDGE_PERFECT = 0.025;
window.JUDGE_GOOD = 0.075;
window.JUDGE_BAD = 0.107;
window.state_commandIndex = 0;
window.state_currentBPM = 120;
window.state_isGogo = false;
window.state_jposStartTime = -Infinity;
window.state_jposDuration = 0;
window.state_jposStartX = window.HIT_POSITION_X_DEFAULT;
window.state_jposEndX = window.HIT_POSITION_X_DEFAULT;
window.state_jposEasing = 0;
window.taikoEffects = {
    donL: { active: false, startTime: 0 },
    donR: { active: false, startTime: 0 },
    kaL: { active: false, startTime: 0 },
    kaR: { active: false, startTime: 0 }
};
window.EFFECT_DURATION = 0.15;
window.autoLastSide = 'L';
window.positionPriority = { kaR: 4, donR: 3, donL: 2, kaL: 1 };
window.jiroCanvas = null;
window.jiroCtx = null;
window.cachedChartCanvas = null;
window.isChartCacheDirty = true;
window.comboBounceScale = 1.0;
window.uploadedMusicFileName = "";
window.uploadedMusicObjectURL = null;
window.db = null;
window.errorLineNumber = null;
window.textarea = u('.input').first();
window.backdrop = u('.backdrop').first();
window.highlightDiv = u('.highlight').first();
window.syncHeightTimeout = null;
window.pendingHighlightUpdate = false;
window.debounceTimer = null;
window.lastUIUpdateTime = 0;
window.keyState = {
    ArrowLeft: { pressed: false, timer: null, pressStartTime: 0, currentInterval: 100 },
    ArrowRight: { pressed: false, timer: null, pressStartTime: 0, currentInterval: 100 }
};
window.KEY_REPEAT_DELAY = 250;
window.KEY_REPEAT_INTERVAL_BASE = 100;
window.KEY_SPEED_UP_TIME = 2000;

window.addEventListener('resize', syncLineHeights);

textarea.addEventListener('scroll', syncScroll);

u('.input').on('input', processFunc);

u('#btn-open').on('click', () => u('#file-input').first().click());

u('#file-input').on('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    
    stopSimulation();
    setChartTime(0);

    const ext = f.name.split('.').pop().toLowerCase();
    const allowed = ["tja", "mc", "txt", "zip", "mcz", "mp3", "m4a", "wav", "ogg"];
    if (!allowed.includes(ext)) { u('.errors').text("エラー: 対応していない形式です (.tja, .mc, .zip 等のみ)"); return; }
    try {
        let content = ""; const ab = await f.arrayBuffer();
        if (f.name.toLowerCase().match(/\.(zip|mcz)$/)) {
            const zip = await JSZip.loadAsync(ab);
            const tjaF = Object.values(zip.files).find(file => file.name.toLowerCase().endsWith('.tja') || file.name.toLowerCase().endsWith('.mc'));
            if (!tjaF) throw new Error("譜面が見つかりません");
            const buf = await tjaF.async("arraybuffer");
            content = tjaF.name.endsWith('.mc') ? convertMCtoTJA(await loadFileWithEncoding(buf)) : await loadFileWithEncoding(buf);

            const tempParsed = parseTJA(content);
            const waveName = tempParsed.headers.wave ? tempParsed.headers.wave.toLowerCase() : "";
            
            let audioFileInZip = null;
            if (waveName) {
                audioFileInZip = Object.values(zip.files).find(file => {
                    const fname = file.name.split('/').pop().toLowerCase();
                    return fname === waveName;
                });
            }
            if (!audioFileInZip) {
                const audioExts = [".mp3", ".m4a", ".wav", ".ogg"];
                audioFileInZip = Object.values(zip.files).find(file => {
                    const nameLower = file.name.toLowerCase();
                    return audioExts.some(ext => nameLower.endsWith(ext));
                });
            }
            
            if (audioFileInZip) {
                initializeAudio();
                const audioData = await audioFileInZip.async("arraybuffer");
                try {
                    musicAudioBuffer = await audioContext.decodeAudioData(audioData);
                    uploadedMusicFileName = audioFileInZip.name.split('/').pop();
                    if (uploadedMusicObjectURL) URL.revokeObjectURL(uploadedMusicObjectURL);
                    uploadedMusicObjectURL = URL.createObjectURL(new Blob([audioData]));
                    u('#music-filename-display').text(`音源: ${uploadedMusicFileName}`);

                    await saveData('files', { id: 'music', name: uploadedMusicFileName, data: new Blob([audioData]) });
                } catch (decErr) {
                    console.error("音源デコードエラー:", decErr);
                    u('.errors').text("音源ファイルのデコードに失敗しました: " + decErr.message);
                }
            } else {
                u('#music-filename-display').text("音源: 未ロード");
            }
        } else if (f.name.toLowerCase().match(/\.(mp3|m4a|wav|ogg)$/)) {
            initializeAudio();
            try {
                musicAudioBuffer = await audioContext.decodeAudioData(ab.slice(0));
                uploadedMusicFileName = f.name;
                if (uploadedMusicObjectURL) URL.revokeObjectURL(uploadedMusicObjectURL);
                uploadedMusicObjectURL = URL.createObjectURL(f);
                u('#music-filename-display').text(`音源: ${uploadedMusicFileName}`);

                await saveData('files', { id: 'music', name: uploadedMusicFileName, data: f });
            } catch (decErr) {
                console.error("音源デコードエラー:", decErr);
                u('.errors').text("音源ファイルのデコードに失敗しました: " + decErr.message);
            }
            e.target.value = null;
            return;
        } else { 
            content = f.name.endsWith('.mc') ? convertMCtoTJA(await loadFileWithEncoding(ab)) : await loadFileWithEncoding(ab); 
        }
        u('.input').first().value = content; 
        
        isChartCacheDirty = true;
        processFunc();
    } catch(err) { u('.errors').text(err.message); }
    e.target.value = null;
});

u('#zoom-in').on('click', (e) => { e.preventDefault(); zoomLevel += 20; updateUI(); });

u('#zoom-out').on('click', (e) => { e.preventDefault(); zoomLevel = Math.max(100, zoomLevel - 20); updateUI(); });

u('#btn-save').on('click', () => {
  const cv = u('canvas').first(); if (!cv) return;
  const link = document.createElement('a'); link.download = (tjaParsed.headers.title || 'chart') + '.png'; link.href = cv.toDataURL(); link.click();
});

u('#btn-tja-save').on('click', () => {
  if (!tjaParsed) return;
  const codes = Encoding.convert(Encoding.stringToCode(u('.input').first().value), 'SJIS', 'UNICODE');
  const blob = new Blob([new Uint8Array(codes)], { type: 'application/octet-stream' });
  const name = (tjaParsed.headers.wave || "chart.tja").split('.')[0] + ".tja";
  const link = document.createElement('a'); link.download = name; link.href = URL.createObjectURL(blob); link.click();
});

u('#btn-grad-replace').on('click', () => { replaceGradation(); processFunc(); });

u('.controls-diff .button[data-value]').on('click', e => { 
  selectedDifficulty = u(e.target).data('value'); 
  currentChartData = preparePreviewChart(tjaParsed, selectedDifficulty);
  if (currentChartData) {
    seekChartState(0);
    setChartTime(0);
  }
  isChartCacheDirty = true; 
  updateUI(); 
});

u('.controls-page .button[data-value]').on('click', e => { 
  selectedPage = u(e.target).data('value'); 
  if (selectedPage === 'preview') {
    u('.pane-left').addClass('is-hidden');
  } else {
    u('.pane-left').removeClass('is-hidden');
  }
  updateUI(); 
});

u('.input').on('focus', () => {
    u('body').addClass('focus-mode');
});

u('.input').on('blur', () => {
    u('body').removeClass('focus-mode');
});


u('#jiro-speed').on('change', (e) => {
    const newSpeed = parseFloat(e.target.value) || 1.0;
    if (isPlaying) {
        const currentElapsedTimeTemp = currentElapsedTime;
        if (musicSourceNode) {
            musicSourceNode.playbackRate.value = newSpeed;
        }
        simulationStartOffset = currentElapsedTimeTemp;
        simulationStartTime = (audioContext) ? audioContext.currentTime : 0;
    }
    playbackSpeed = newSpeed;
});

u('#jiro-btn-play').on('click', togglePlay);

u('#jiro-btn-stop').on('click', resetSimulation);

u('#jiro-btn-prev').on('click', () => {
    if (!currentChartData) return;
    const curIndex = findMeasureIndex(currentElapsedTime);
    let targetIndex = curIndex;
    
    if (curIndex > 0 && Math.abs(currentElapsedTime - currentChartData.allMeasureTimes[curIndex]) < 0.5) {
        targetIndex = curIndex - 1;
    }
    
    const targetTime = currentChartData.allMeasureTimes[targetIndex];
    setChartTime(targetTime);
});

u('#jiro-btn-next').on('click', () => {
    if (!currentChartData) return;
    const curIndex = findMeasureIndex(currentElapsedTime);
    const totalMeasures = currentChartData.allMeasureTimes.length - 1;
    const targetIndex = Math.min(totalMeasures, curIndex + 1);
    
    const targetTime = currentChartData.allMeasureTimes[targetIndex];
    setChartTime(targetTime);
});

u('#jiro-vol-music').on('input', (e) => {
    musicVolume = parseFloat(e.target.value) / 100;
    if (musicGainNode) musicGainNode.gain.value = musicVolume;
});

u('#jiro-vol-se').on('input', (e) => {
    seVolume = parseFloat(e.target.value) / 100;
    if (seGainNode) seGainNode.gain.value = seVolume;
});

u('#jiro-seekbar').on('input', (e) => {
    if (!currentChartData) return;
    const totalDuration = musicAudioBuffer ? Math.max(currentChartData.endTime, musicAudioBuffer.duration) : currentChartData.endTime;
    const ratio = parseFloat(e.target.value) / 1000;
    const time = ratio * totalDuration;
    u('#jiro-time-display').text(`${time.toFixed(2)} / ${totalDuration.toFixed(2)}s`);
    
    currentElapsedTime = time;
    seekChartState(time);
    updateJiroPreview(time);
});

u('#jiro-seekbar').on('change', (e) => {
    if (!currentChartData) return;
    const totalDuration = musicAudioBuffer ? Math.max(currentChartData.endTime, musicAudioBuffer.duration) : currentChartData.endTime;
    const ratio = parseFloat(e.target.value) / 1000;
    const targetTime = ratio * totalDuration;
    
    let closestTime = 0;
    let minDiff = Infinity;
    currentChartData.allMeasureTimes.forEach(t => {
        const diff = Math.abs(t - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestTime = t;
        }
    });
    
    setChartTime(closestTime);
});

window.addEventListener('keydown', (e) => {
    if (selectedPage !== 'preview') return;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) return;
    
    if (e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        togglePlay();
        return;
    }

    if (!isPlaying && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (!currentChartData || currentChartData.barlineTimes.length === 0) return;
        if (e.key === 'ArrowUp') setChartTime(currentChartData.barlineTimes[currentChartData.barlineTimes.length - 1]);
        else if (e.key === 'ArrowDown') setChartTime(currentChartData.barlineTimes[0]);
        return;
    }

    if (keyState[e.key]) {
        e.preventDefault();
        if (keyState[e.key].pressed) return;
        keyState[e.key].pressed = true;
        keyState[e.key].pressStartTime = performance.now();
        keyState[e.key].currentInterval = KEY_REPEAT_INTERVAL_BASE;
        seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
        keyState[e.key].timer = setTimeout(() => {
            if (keyState[e.key].timer) clearInterval(keyState[e.key].timer);
            keyState[e.key].timer = setInterval(() => {
                const elapsedTime = performance.now() - keyState[e.key].pressStartTime;
                const speedUpCount = Math.floor(elapsedTime / KEY_SPEED_UP_TIME);
                const newInterval = KEY_REPEAT_INTERVAL_BASE / Math.pow(2, speedUpCount);
                if (newInterval !== keyState[e.key].currentInterval) {
                    clearInterval(keyState[e.key].timer);
                    keyState[e.key].currentInterval = newInterval;
                    keyState[e.key].timer = setInterval(() => seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1), keyState[e.key].currentInterval);
                }
                seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
            }, keyState[e.key].currentInterval);
        }, KEY_REPEAT_DELAY);
    }
});

window.addEventListener('keyup', (e) => {
    if (keyState[e.key]) {
        e.preventDefault();
        keyState[e.key].pressed = false;
        if (keyState[e.key].timer) {
            clearInterval(keyState[e.key].timer);
            keyState[e.key].timer = null;
        }
    }
});

document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
        // バックグラウンド移行時：即座に一時停止し、オーディオスレッド・タイマースレッドを完全にクリーンアップして初期化
        if (isPlaying) {
            wasPlayingBeforeHidden = true;
            stopSimulation();
        } else {
            wasPlayingBeforeHidden = false;
        }
    } else {
        // フォアグラウンド復帰時：AudioContextを非同期で確実に復旧
        if (audioContext) {
            if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
                try { 
                    await audioContext.resume(); 
                } catch(e) {
                    console.warn("VisibilityChange: resume failed", e);
                }
            }
        }
        
        // 以前再生中だった場合、非同期のオーディオ準備を十分に待つため250msの安全ディレイを挟んで安定再開
        if (wasPlayingBeforeHidden) {
            wasPlayingBeforeHidden = false;
            setTimeout(async () => {
                // すでに別スレッドで走っていないことを確認した上で起動 (startSimulation内部で時刻基準をキャリブレーションしてラグを完全相殺)
                if (!isPlaying) {
                    await startSimulation();
                }
            }, 250);
        } else {
            // 【ラグ相殺】非表示中の蓄積されたラグを完全にクリーンアップし、復帰直前の正確な時間で演奏位置をリセット・再描画
            seekChartState(currentElapsedTime);
            updateJiroPreview(currentElapsedTime);
        }
    }
});

window.addEventListener('focus', async () => {
    if (audioContext && audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch(e){}
    }
    updateJiroPreview(currentElapsedTime);
});

window.addEventListener('touchstart', async () => {
    if (audioContext && audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch(e){}
    }
}, { passive: true });

window.addEventListener('DOMContentLoaded', async () => {
    jiroCanvas = document.getElementById('jiro-previewCanvas');
    if (jiroCanvas) {
        jiroCtx = jiroCanvas.getContext('2d');
    }

    await initDB();

    const saved = localStorage.getItem('tja_tools_autosave');
    if (saved) {
        u('.input').first().value = saved;
        processFunc();
    }

    try {
        const musicFile = await loadData('files', 'music');
        if (musicFile && musicFile.data) {
            uploadedMusicObjectURL = URL.createObjectURL(musicFile.data);
            uploadedMusicFileName = musicFile.name;
            u('#music-filename-display').text(`音源: ${musicFile.name}`);
            
            initializeAudio();
            const arrayBuffer = await musicFile.data.arrayBuffer();
            musicAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        }
    } catch (error) {
        console.error("Failed to load music from DB:", error);
    }

    // Audio Page Listeners
    const btnLoadAudio = document.getElementById('btn-load-local-audio');
    const localAudioInput = document.getElementById('local-audio-input');
    const filenameInput = document.getElementById('audio-filename-input');
    const analysisResult = document.getElementById('audio-analysis-result');
    const urlInput = document.getElementById('audio-url-input');
    const btnFetchUrl = document.getElementById('btn-fetch-url');
    const urlError = document.getElementById('audio-url-error');

    // Chart Image Toggle
    const toggleChartImage = document.getElementById('toggle-chart-image');
    if (toggleChartImage) {
        const savedToggle = localStorage.getItem('tja_tools_show_image');
        if (savedToggle !== null) {
            toggleChartImage.checked = (savedToggle === 'true');
            const container = document.getElementById('chart-canvas-container');
            if (container) {
                if (toggleChartImage.checked) container.classList.remove('is-hidden');
                else container.classList.add('is-hidden');
            }
        }
    }
    if (toggleChartImage) {
        toggleChartImage.addEventListener('change', (e) => {
            localStorage.setItem('tja_tools_show_image', e.target.checked);
            const container = document.getElementById('chart-canvas-container');
            if (container) {
                if (e.target.checked) {
                    container.classList.remove('is-hidden');
                } else {
                    container.classList.add('is-hidden');
                }
            }
        });
    }

    if (btnLoadAudio && localAudioInput) {
        btnLoadAudio.addEventListener('click', () => localAudioInput.click());
        localAudioInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Set filename default
            let nameWithoutExt = file.name;
            const lastDot = nameWithoutExt.lastIndexOf('.');
            if (lastDot > 0) nameWithoutExt = nameWithoutExt.substring(0, lastDot);
            filenameInput.value = nameWithoutExt;

            // Save to DB
            await saveData('files', 'music', file);
            
            // Analyze
            analysisResult.innerHTML = '<span style="color: #6e7681;">解析中...</span>';
            try {
                if (!window.audioContext) {
                    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
                
                const result = await analyzeAudio(audioBuffer);
                analysisResult.innerHTML = `
                    <span style="color: #8be9fd;">BPM:</span> ${result.bpm} <br>
                    <span style="color: #8be9fd;">OFFSET:</span> ${result.offset.toFixed(3)} s <br>
                    <span style="color: #8be9fd;">拍子:</span> ${result.timeSignature}/4 <br>
                    <span style="color: #50fa7b;">解析完了。エディタに戻ると空のTJAが生成されます。</span>
                `;

                // If empty editor or no valid TJA, generate one
                const currentText = document.querySelector('.input').value;
                if (!currentText || currentText.trim().length === 0 || !window.tjaParsed) {
                    const tja = generateEmptyTja(nameWithoutExt, result.bpm, result.offset, nameWithoutExt + '.ogg');
                    document.querySelector('.input').value = tja;
                    processFunc();
                } else {
                    // Update WAVE field if exists
                    let tjaText = document.querySelector('.input').value;
                    tjaText = tjaText.replace(/WAVE:.*/, 'WAVE:' + nameWithoutExt + '.ogg');
                    document.querySelector('.input').value = tjaText;
                    processFunc();
                }

                // Load for preview
                const dbMusic = await loadData('files', 'music');
                if (dbMusic && dbMusic.data) {
                    uploadedMusicObjectURL = URL.createObjectURL(dbMusic.data);
                    uploadedMusicFileName = dbMusic.name;
                    document.getElementById('music-filename-display').innerText = `音源: ${dbMusic.name}`;
                    initializeAudio();
                    const ab = await dbMusic.data.arrayBuffer();
                    musicAudioBuffer = await window.audioContext.decodeAudioData(ab);
                }

            } catch(e) {
                analysisResult.innerHTML = '<span style="color: #ff5555;">解析エラー: ' + e.message + '</span>';
            }
        });
    }

    if (filenameInput) {
        filenameInput.addEventListener('change', () => {
            const newName = filenameInput.value.trim() + '.ogg';
            let tjaText = document.querySelector('.input').value;
            if (tjaText) {
                tjaText = tjaText.replace(/WAVE:.*/, 'WAVE:' + newName);
                document.querySelector('.input').value = tjaText;
                processFunc();
            }
        });
    }

    if (btnFetchUrl) {
        btnFetchUrl.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (!url) return;
            
            if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('soundcloud.com')) {
                // Determine title via oEmbed
                let title = "Audio";
                try {
                    const oembedUrl = 'https://noembed.com/embed?url=' + encodeURIComponent(url);
                    const res = await fetch(oembedUrl);
                    const data = await res.json();
                    if (data && data.title) {
                        title = data.title.replace(/[/\\?%*:|"<>]/g, '_'); 
                    }
                } catch(e) { }

                filenameInput.value = title;
                urlError.innerText = '利用規約により、このサービスからの直接の音源ダウンロードはできません。ローカルの音源ファイルを選択してください。';
                urlError.style.display = 'block';
                return;
            } else {
                urlError.innerText = '対応していないURLです。';
                urlError.style.display = 'block';
            }
        });
    }

    const btnZipSave = document.getElementById('btn-zip-save');
    if (btnZipSave) {
        btnZipSave.addEventListener('click', async () => {
            const tjaText = document.querySelector('.input').value;
            if (!tjaText) return;
            
            let tjaTitle = "chart";
            const titleMatch = tjaText.match(/TITLE:(.+)/);
            if (titleMatch) {
                tjaTitle = titleMatch[1].trim().replace(/[/\\?%*:|"<>]/g, '_');
            }
            
            let waveName = tjaTitle + '.ogg';
            const waveMatch = tjaText.match(/WAVE:(.+)/);
            if (waveMatch) {
                waveName = waveMatch[1].trim();
            }

            const zip = new JSZip();
            zip.file(tjaTitle + '.tja', tjaText);
            
            const dbMusic = await loadData('files', 'music');
            if (dbMusic && dbMusic.data) {
                zip.file(waveName, dbMusic.data);
            }
            
            const content = await zip.generateAsync({type:"blob"});
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = tjaTitle + ".zip";
            a.click();
        });
    }

});

