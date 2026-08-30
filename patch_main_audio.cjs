const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf8');

// 1. Add audio imports
const importAudio = `import { analyzeAudio, generateEmptyTja } from './audio/audio.js';\nimport JSZip from 'jszip';\n`;
code = importAudio + code;

// 2. We need to add the Event Listeners. I'll append them at the very end of DOMContentLoaded
let setupCode = `
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
        toggleChartImage.addEventListener('change', (e) => {
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
                analysisResult.innerHTML = \`
                    <span style="color: #8be9fd;">BPM:</span> \${result.bpm} <br>
                    <span style="color: #8be9fd;">OFFSET:</span> \${result.offset.toFixed(3)} s <br>
                    <span style="color: #8be9fd;">拍子:</span> \${result.timeSignature}/4 <br>
                    <span style="color: #50fa7b;">解析完了。エディタに戻ると空のTJAが生成されます。</span>
                \`;

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
                    document.getElementById('music-filename-display').innerText = \`音源: \${dbMusic.name}\`;
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
                        title = data.title.replace(/[\/\\\\?%*:|"<>]/g, '_'); 
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
                tjaTitle = titleMatch[1].trim().replace(/[\/\\\\?%*:|"<>]/g, '_');
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
`;

code = code.replace("console.error(\"Failed to load music from DB:\", error);\n    }\n});", "console.error(\"Failed to load music from DB:\", error);\n    }\n" + setupCode + "\n});");

fs.writeFileSync('src/main.js', code);
console.log("main.js patched.");
