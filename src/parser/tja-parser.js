import { formatBpm } from '../renderer/chart-renderer.js';

export const gcd = (a, b) => b ? gcd(b, a % b) : a;

export const lcm = (a, b) => (a === 0 || b === 0) ? 0 : Math.abs(a * b) / gcd(a, b);

export function convertMCtoTJA(mcContent) {
    const mc = JSON.parse(mcContent); 
    let tja = "";
    const balloons = mc.note.filter(n => n.style === 6 && n.hits).map(n => n.hits).join(',');
    
    let metaEvents = [];
    if (mc.time) metaEvents = metaEvents.concat(mc.time);
    if (mc.effect) metaEvents = metaEvents.concat(mc.effect);
    
    const firstBpmEvent = metaEvents.find(t => t.bpm !== undefined);
    const initialBpm = firstBpmEvent ? firstBpmEvent.bpm : 120;
    
    const barBegin = mc.meta.mode_ext ? (mc.meta.mode_ext.bar_begin || 0) : 0;
    const mcNoteWithOffset = mc.note.find(n => n.sound);
    const mcOffset = mcNoteWithOffset ? (mcNoteWithOffset.offset || 0) : 0;
    const tjaOffsetValue = -(60 / initialBpm * barBegin) + (mcOffset / 1000);

    tja += `TITLE:${mc.meta.song.title || ""}\nSUBTITLE:--${mc.meta.song.artist || ""}\nBPM:${formatBpm(initialBpm)}\nWAVE:${mc.note.find(n => n.sound)?.sound || ""}\nOFFSET:${tjaOffsetValue.toFixed(3)}\nDEMOSTART:${mc.meta && mc.meta.preview ? (mc.meta.preview / 1000).toFixed(3) : "0"}\n\nCOURSE:Oni\nLEVEL:${mc.meta.version ? mc.meta.version.replace(/[^0-9]/g, '') : "10"}\nBALLOON:${balloons}\n\n#START\n`;
    
    metaEvents.forEach(t => { 
        t.adjustedBeat = t.beat[0] + (t.beat[1] / t.beat[2]) - barBegin; 
    });

    let signEvents = metaEvents
        .filter(t => t.sign !== undefined)
        .map(t => ({ tb: t.adjustedBeat, sign: parseInt(t.sign, 10), original: t }))
        .filter(t => t.tb >= 0)
        .sort((a, b) => a.tb - b.tb);

    let currentSign = 4;
    let bars = [];
    let curTb = 0;
    let barIdx = 0;
    
    if (signEvents.length > 0 && signEvents[0].tb <= 1e-6) {
        currentSign = signEvents[0].sign;
        signEvents = signEvents.filter(t => t.tb > 1e-6);
    }

    let maxTb = 0;
    mc.note.forEach(n => {
        let tb = n.beat[0] + (n.beat[1] / n.beat[2]) - barBegin;
        if (n.endbeat) {
            let etb = n.endbeat[0] + (n.endbeat[1] / n.endbeat[2]) - barBegin;
            if (etb > maxTb) maxTb = etb;
        }
        if (tb > maxTb) maxTb = tb;
    });
    metaEvents.forEach(t => {
        if (t.adjustedBeat > maxTb) maxTb = t.adjustedBeat;
    });

    while (curTb <= maxTb + currentSign) {
        let nextEvent = signEvents.length > 0 ? signEvents[0] : null;
        let nextTb = curTb + currentSign;
        
        if (nextEvent && nextEvent.tb <= curTb + 1e-6) {
            currentSign = nextEvent.sign;
            nextTb = curTb + nextEvent.sign;
            while(signEvents.length > 0 && signEvents[0].tb <= curTb + 1e-6) {
                currentSign = signEvents[0].sign;
                nextTb = curTb + currentSign;
                signEvents.shift();
            }
            nextEvent = signEvents.length > 0 ? signEvents[0] : null;
        }
        
        if (nextEvent && nextEvent.tb < nextTb - 1e-6) {
            nextTb = nextEvent.tb;
        }
        
        let actualBeats = nextTb - curTb;
        if (actualBeats <= 0) {
            actualBeats = currentSign;
            nextTb = curTb + actualBeats;
        }
        
        bars.push({ startTb: curTb, endTb: nextTb, sign: currentSign, actualBeats: actualBeats, barIdx: barIdx });
        barIdx++;
        curTb = nextTb;
        
        if (curTb > maxTb + currentSign) break;
    }

    function getBarInfo(tb) {
        let found = bars[0];
        for (let i = 0; i < bars.length; i++) {
            if (tb >= bars[i].startTb - 1e-6) {
                found = bars[i];
            } else {
                break;
            }
        }
        return found;
    }

    const notesByBar = {}; 
    const endbeatsByBar = {};
    const bpmChangesByBar = {}; 
    
    mc.note.forEach(n => { 
        if (n.hasOwnProperty('column')) { 
            const tb = n.beat[0] + (n.beat[1] / n.beat[2]) - barBegin; 
            if (tb < 0) return; 
            const bar = getBarInfo(tb);
            const bi = bar.barIdx;
            if (!notesByBar[bi]) notesByBar[bi] = []; 
            notesByBar[bi].push({...n, bib: tb - bar.startTb}); 
            
            if (n.endbeat) {
                const etb = n.endbeat[0] + (n.endbeat[1] / n.endbeat[2]) - barBegin; 
                if (etb >= 0) {
                    const ebar = getBarInfo(etb);
                    const ebi = ebar.barIdx;
                    if (!endbeatsByBar[ebi]) endbeatsByBar[ebi] = [];
                    endbeatsByBar[ebi].push({ bib: etb - ebar.startTb, split: n.endbeat[2] });
                }
            }
        } 
    });
    
    metaEvents.forEach(t => { 
        if (t.bpm === undefined && t.sign === undefined) return; 
        const tb = t.adjustedBeat; 
        if (tb < 0) return; 
        const bar = getBarInfo(tb);
        const bi = bar.barIdx; 
        if (!bpmChangesByBar[bi]) bpmChangesByBar[bi] = []; 
        bpmChangesByBar[bi].push({...t, bib: tb - bar.startTb, _isInit: t === firstBpmEvent}); 
    });
    
    for (let b = 0; b < bars.length; b++) {
        const bar = bars[b];
        const barBeats = bar.actualBeats; 
        
        if (bar.startTb > maxTb + 1e-6) break;
        
        const cn = notesByBar[b] || []; 
        const ce = endbeatsByBar[b] || [];
        const cb = bpmChangesByBar[b] || []; 
        
        let barLCM = 1;
        const MAX_LCM = 3840;
        
        const updateLCM = (bib, beatDenom) => {
            const num = Math.round(bib * beatDenom);
            const den = Math.round(barBeats * beatDenom);
            if (den === 0) return;
            let g = gcd(num, den);
            if (g === 0) g = 1;
            const target = Math.round(den / g);
            barLCM = lcm(barLCM, target);
            if (barLCM > MAX_LCM || !isFinite(barLCM)) barLCM = MAX_LCM;
        };

        cn.forEach(n => updateLCM(n.bib, n.beat[2] || 1));
        ce.forEach(e => updateLCM(e.bib, e.split || 1));
        cb.forEach(t => updateLCM(t.bib, t.beat[2] || 1));
        
        if (barLCM > MAX_LCM) barLCM = MAX_LCM;
        if (barLCM <= 0 || !isFinite(barLCM)) barLCM = 1;
        
        const bChars = new Array(barLCM).fill('0'); 
        const bTicks = {};
        
        cb.forEach(t => { 
            const pos = Math.round((t.bib / barBeats) * barLCM); 
            let cmds = bTicks[pos] ? bTicks[pos].split('\n') : [];
            if (t.sign !== undefined) {
                const measureVal = parseInt(t.sign, 10);
                cmds = cmds.filter(x => !x.startsWith('#MEASURE'));
                cmds.push(`#MEASURE ${measureVal}/4`);
            }
            if (t.bpm !== undefined && !t._isInit) {
                cmds = cmds.filter(x => !x.startsWith('#BPMCHANGE'));
                cmds.push(`#BPMCHANGE ${formatBpm(t.bpm)}`);
            }
            if (cmds.length) bTicks[pos] = cmds.join('\n');
        });
        
        cn.forEach(n => { 
            const pos = Math.round((n.bib / barBeats) * barLCM);
            let type = "1"; 
            if (n.style === 2) type = "2"; 
            if (n.style === 1) type = "3"; 
            if (n.style === 3) type = "4"; 
            if (n.style === 4) type = "5"; 
            if (n.style === 5) type = "6"; 
            if (n.style === 6) type = "7";
            if (pos >= 0 && pos < barLCM) bChars[pos] = type;
        });

        ce.forEach(e => {
            const pos = Math.round((e.bib / barBeats) * barLCM);
            if (pos >= 0 && pos < barLCM) {
                if (bChars[pos] === '0') {
                    bChars[pos] = "8";
                } else if (parseInt(bChars[pos]) < 5) {
                    bChars[pos] = "8"; 
                }
            }
        });
        
        let bOut = ""; 
        for (let i = 0; i < barLCM; i++) { 
            if (bTicks[i]) bOut += (bOut === "" ? "" : "\n") + bTicks[i] + "\n"; 
            bOut += bChars[i]; 
        }
        
        tja += bOut + ",\n";
    }
    tja += "#END"; return tja;
}

export async function loadFileWithEncoding(arrayBuffer) {
    const ui8 = new Uint8Array(arrayBuffer);
    try { return new TextDecoder('utf-8', {fatal: true}).decode(ui8); } 
    catch(e) { return new TextDecoder('shift-jis').decode(ui8); }
}

export function parseTJA(tja) {
    const lines = tja.split(/\r?\n/).map(l => {
        const commentIndex = l.indexOf('//');
        return (commentIndex !== -1) ? l.substring(0, commentIndex).trim() : l.trim();
    });

    const headers = { 
        title: "No Title", 
        subtitle: "", 
        bpm: 120, 
        wave: "", 
        offset: 0, 
        balloon: [] 
    };

    const courses = {}; 
    let currentCourseKey = 3;
    let currentCourse = null;

    let currentBPM = 120;
    let currentTime = 1.0;
    let currentMeasureRatio = 1.0;
    let currentRoll = null;
    let isGogo = false;
    let currentScroll = 1.0;
    let currentScrollY = 0.0;
    let currentBarline = true;
    let barlineNeeded = false;
    let measureCommands = [];

    let dataBuf = "";
    let eventBuf = [];
    let currentMeasure = [4, 4];

    function resetCourseState(key) {
        currentCourse = { 
            course: key, 
            headers: { level: 0, balloon: [], ttRowBeat: 16 }, 
            measures: [],
            
            notes: [], 
            commands: [], 
            errors: [], 
            maxCombo: 0, 
            endTime: 0, 
            barlineTimes: [], 
            allMeasureTimes: [], 
            ballonList: [], 
            balloonIndex: 0, 
            courseName: key.toString()
        };
        courses[key] = currentCourse;
        
        currentBPM = headers.bpm;
        currentTime = 1.0;
        if (headers.offset < 0) {
            currentTime -= headers.offset;
        }
        currentMeasureRatio = 1.0;
        currentRoll = null;
        isGogo = false;
        currentScroll = 1.0;
        currentScrollY = 0.0;
        currentBarline = true;
        barlineNeeded = false;
        measureCommands = [];
        
        dataBuf = "";
        eventBuf = [];
        currentMeasure = [4, 4];

        currentCourse.commands.push({ time: -Infinity, type: 'BPMCHANGE', value: currentBPM });
        currentCourse.commands.push({ time: -Infinity, type: 'SCROLL', value: 1.0, valueY: 0.0 });
        currentCourse.commands.push({ time: -Infinity, type: 'BARLINEON' });
    }

    function parseCommandForPlayer(commandStr) {
        if (!currentCourse) return;
        const spaceIndex = commandStr.indexOf(' ');
        let commandName = commandStr, valueStr = "";
        if (spaceIndex !== -1) {
            commandName = commandStr.substring(0, spaceIndex);
            valueStr = commandStr.substring(spaceIndex + 1).trim();
        }
        switch (commandName.toUpperCase()) {
            case "#BPMCHANGE":
                const bpmValue = parseFloat(valueStr);
                if (!isNaN(bpmValue)) {
                    currentBPM = bpmValue;
                    currentCourse.commands.push({ time: currentTime, type: 'BPMCHANGE', value: bpmValue });
                }
                break;
            case "#DELAY":
                const delayValue = parseFloat(valueStr);
                if (!isNaN(delayValue)) {
                    const adjustedDelay = delayValue;
                    currentCourse.commands.push({ time: currentTime, type: 'DELAY', value: adjustedDelay });
                    currentTime += adjustedDelay;
                }
                break;
            case "#MEASURE":
                const parts = valueStr.split('/');
                if (parts.length === 2) {
                    const num = parseFloat(parts[0]), den = parseFloat(parts[1]);
                    if (!isNaN(num) && !isNaN(den) && den > 0) {
                        currentMeasureRatio = num / den;
                        currentCourse.commands.push({ time: currentTime, type: 'MEASURE', value: valueStr, ratio: currentMeasureRatio });
                    }
                }
                break;
            case "#GOGOSTART":
                isGogo = true;
                currentCourse.commands.push({ time: currentTime, type: 'GOGOSTART' });
                break;
            case "#GOGOEND":
                isGogo = false;
                currentCourse.commands.push({ time: currentTime, type: 'GOGOEND' });
                break;
            case "#SCROLL":
                const sVal = parseFloat(valueStr);
                if (!isNaN(sVal)) {
                    currentScroll = sVal;
                    currentScrollY = 0.0;
                    currentCourse.commands.push({ time: currentTime, type: 'SCROLL', value: currentScroll, valueY: 0.0 });
                }
                break;
            case "#BARLINEON":
                currentBarline = true;
                currentCourse.commands.push({ time: currentTime, type: 'BARLINEON' });
                break;
            case "#BARLINEOFF":
                currentBarline = false;
                currentCourse.commands.push({ time: currentTime, type: 'BARLINEOFF' });
                break;
        }
    }

    function processMeasureForPlayer(noteChars, cmdsInMeasure) {
        if (!currentCourse) return;
        if (barlineNeeded && currentBarline) {
            currentCourse.notes.push({ 
                time: currentTime, 
                type: 'BARLINE', 
                hitProcessed: true, 
                judgeResult: 'pending', 
                bpm: currentBPM, 
                scroll: currentScroll, 
                scrollY: currentScrollY, 
                barlineVisible: currentBarline 
            });
            currentCourse.barlineTimes.push(currentTime);
        }
        if (barlineNeeded) {
            currentCourse.allMeasureTimes.push(currentTime);
        }
        barlineNeeded = false;
        
        if (noteChars.length === 0 && cmdsInMeasure.length === 0) {
            noteChars = "0";
        }
        
        const noteCountInMeasure = noteChars.length;
        const measureDurationInBeats = 4.0 * currentMeasureRatio;
        const beatsPerNote = (noteCountInMeasure > 0) ? (measureDurationInBeats / noteCountInMeasure) : 0;
        
        let commandIndex = 0;
        for (let j = 0; j < noteChars.length; j++) {
            while (commandIndex < cmdsInMeasure.length && cmdsInMeasure[commandIndex].noteIndex === j) {
                parseCommandForPlayer(cmdsInMeasure[commandIndex].commandStr);
                commandIndex++;
            }
            const char = noteChars[j];
            const charTime = currentTime;
            const secondsPerThisNote = beatsPerNote * (60.0 / currentBPM);
            currentTime += secondsPerThisNote;
            const noteState = { bpm: currentBPM, scroll: currentScroll, scrollY: currentScrollY };
            
            switch (char) {
                case '0': break;
                case '1':
                case '2':
                case '3':
                case '4':
                    currentCourse.notes.push({ time: charTime, endTime: currentTime, type: char, hits: 0, hitProcessed: false, seScheduled: false, judgeResult: 'pending', ...noteState });
                    currentCourse.maxCombo++;
                    currentCourse.endTime = Math.max(currentCourse.endTime, currentTime);
                    break;
                case '5':
                case '6':
                case '7':
                    if (currentRoll) {
                        currentRoll.endTime = charTime;
                        currentCourse.notes.push(currentRoll);
                        currentCourse.endTime = Math.max(currentCourse.endTime, currentRoll.endTime);
                        currentRoll = null;
                    }
                    let hits = 0;
                    if (char === '7') {
                        const ballonList = (currentCourse.ballonList.length > 0) ? currentCourse.ballonList : headers.balloon;
                        if (ballonList.length > 0) {
                            hits = ballonList[Math.min(currentCourse.balloonIndex, ballonList.length - 1)] || 0;
                        }
                        currentCourse.balloonIndex++;
                    }
                    currentRoll = { time: charTime, endTime: currentTime, type: char, hits: hits, currentHits: 0, hitProcessed: false, lastAutoHitTime: 0, judgeResult: 'pending', seScheduled: false, ...noteState };
                    break;
                case '8':
                    if (currentRoll) {
                        currentRoll.endTime = charTime;
                        currentCourse.notes.push(currentRoll);
                        currentCourse.endTime = Math.max(currentCourse.endTime, currentRoll.endTime);
                        currentRoll = null;
                    }
                    break;
            }
        }
        while (commandIndex < cmdsInMeasure.length) {
            parseCommandForPlayer(cmdsInMeasure[commandIndex].commandStr);
            commandIndex++;
        }
    }

    let parsingNotes = false;

    for (let line of lines) {
        if (line.length === 0) continue;
        
        if (!parsingNotes) {
            if (line.toUpperCase().startsWith('TITLE:')) headers.title = line.substring(6).trim();
            else if (line.toUpperCase().startsWith('SUBTITLE:')) headers.subtitle = line.substring(9).trim().replace(/^--\s*/, '').replace(/^[+-]/, '');
            else if (line.toUpperCase().startsWith('BPM:')) headers.bpm = parseFloat(line.substring(4)) || 120;
            else if (line.toUpperCase().startsWith('WAVE:')) headers.wave = line.substring(5).trim();
            else if (line.toUpperCase().startsWith('OFFSET:')) headers.offset = parseFloat(line.substring(7)) || 0;
            else if (line.toUpperCase().startsWith('COURSE:')) {
                const cv = line.substring(7).trim().toLowerCase();
                let id = 0; 
                if (cv === 'easy' || cv === '0') id = 0;
                else if (cv === 'normal' || cv === '1') id = 1;
                else if (cv === 'hard' || cv === '2') id = 2;
                else if (cv === 'oni' || cv === '3') id = 3;
                else if (cv === 'edit' || cv === '4') id = 4;
                currentCourseKey = id;
                if (!courses[currentCourseKey]) resetCourseState(currentCourseKey);
                currentCourse = courses[currentCourseKey];
            } else if (line.toUpperCase() === "#START") {
                if (!currentCourse) {
                    currentCourseKey = 3;
                    if (!courses[currentCourseKey]) resetCourseState(currentCourseKey);
                    currentCourse = courses[currentCourseKey];
                }
                parsingNotes = true;
                barlineNeeded = true;
            } else if (line.toUpperCase().startsWith('BALLOON:')) {
                const vals = line.substring(8).split(/[, ]+/).filter(x => x).map(Number);
                if (currentCourse) {
                    currentCourse.headers.balloon = vals;
                    currentCourse.ballonList = vals;
                } else {
                    headers.balloon = vals;
                }
            } else if (currentCourse) {
                if (line.toUpperCase().startsWith('LEVEL:')) currentCourse.headers.level = parseInt(line.substring(6)) || 0;
            }
        } else {
            if (line.toUpperCase() === "#END") {
                if (dataBuf.length > 0 || measureCommands.length > 0 || barlineNeeded) {
                    processMeasureForPlayer(dataBuf, measureCommands);
                    currentCourse.measures.push({ length: [...currentMeasure], data: dataBuf, events: [...eventBuf] });
                }
                if (currentRoll) {
                    currentRoll.endTime = currentTime;
                    currentCourse.notes.push(currentRoll);
                    currentCourse.endTime = Math.max(currentCourse.endTime, currentRoll.endTime);
                    currentRoll = null;
                }
                parsingNotes = false;
                currentCourse = null;
                dataBuf = "";
                eventBuf = [];
                measureCommands = [];
                continue;
            }

            if (line.startsWith("#")) {
                const m = line.match(/^#([A-Z]+)(?:\s+(.+))?/i);
                if (m) {
                    // For Editor
                    if (m[1].toUpperCase() === 'MEASURE' && m[2]) {
                        const p = m[2].split('/').map(Number);
                        if (p.length === 2 && p[1] !== 0 && !isNaN(p[0]) && !isNaN(p[1])) currentMeasure = p;
                    }
                    eventBuf.push({ name: m[1].toLowerCase(), value: m[2] || '', pos: dataBuf.length });
                    
                    // For Player
                    if (dataBuf.length === 0 && measureCommands.length === 0) {
                        parseCommandForPlayer(line);
                    } else {
                        measureCommands.push({ commandStr: line, noteIndex: dataBuf.length });
                    }
                }
            } else if (line.match(/^[0-9A-G,]*$/)) {
                let i = 0;
                while (i < line.length) {
                    const char = line[i];
                    if (char >= '0' && char <= '8') {
                        dataBuf += char;
                        i++;
                    } else if (char === ',') {
                        // Process measure
                        processMeasureForPlayer(dataBuf, measureCommands);
                        currentCourse.measures.push({ length: [...currentMeasure], data: dataBuf, events: [...eventBuf] });
                        
                        dataBuf = "";
                        eventBuf = [];
                        measureCommands = [];
                        barlineNeeded = true;
                        i++;
                    } else {
                        i++;
                    }
                }
            }
        }
    }

    for (const key in courses) {
        const chart = courses[key];
        chart.notes.sort((a, b) => a.time - b.time);
        if (chart.barlineTimes.length > 0) {
            const lastBarlineTime = chart.barlineTimes.pop();
            if (chart.notes.length > 0 && chart.notes[chart.notes.length - 1].type === 'BARLINE' && chart.notes[chart.notes.length - 1].time === lastBarlineTime) {
                chart.notes.pop();
            }
        }
        if (chart.allMeasureTimes.length > 0) {
            chart.allMeasureTimes.pop();
        }
        chart.commands.sort((a, b) => a.time - b.time);
        chart.endTime = (chart.notes.length > 0) ? chart.notes.reduce((max, note) => Math.max(max, note.endTime || note.time), 0) : 0;
        
        chart.drawBarlines = chart.notes.filter(n => n.type === 'BARLINE');
        chart.drawNormalNotes = chart.notes.filter(n => n.type !== 'BARLINE');
    }

    return { headers, courses, globalConfig: { ...headers, TITLE: headers.title, SUBTITLE: headers.subtitle, BPM: headers.bpm, OFFSET: headers.offset, WAVE: headers.wave } };
}

// Ensure alias exists for backward compatibility if needed, 
// but we will update the call sites.
export const parseTJAForPreview = parseTJA;
