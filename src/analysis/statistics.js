import { processFunc } from '../editor/editor.js';

export function getStats(chart, courseId) {
  const course = chart.courses[courseId];
  let combo = 0, firstT = null, lastT = 0, currentBpm = chart.headers.bpm;
  let bpmMap = new Map(); let bpms = [currentBpm], allNoteTimes = [], rendaSecs = [], rStartT = null;
  let currentTime = 0;
  course.measures.forEach((m) => {
    const mb = (m.length[0] / m.length[1]) * 4; const nis = m.data.length || 1; const duration = (60 / currentBpm) * mb;
    for (let i = 0; i < m.data.length; i++) {
        const char = m.data[i]; const t = currentTime + (duration * i / nis);
        if ("13".includes(char)) { allNoteTimes.push({ time: t, type: 'don' }); combo++; if (firstT === null) firstT = t; lastT = t; }
        else if ("24".includes(char)) { allNoteTimes.push({ time: t, type: 'ka' }); combo++; if (firstT === null) firstT = t; lastT = t; }
        else if (char === "5" || char === "6") rStartT = t;
        else if (char === "8" && rStartT !== null) { rendaSecs.push(t - rStartT); rStartT = null; }
    }
    bpmMap.set(currentBpm, (bpmMap.get(currentBpm) || 0) + duration);
    m.events.forEach(e => { if(e.name === 'bpmchange') { currentBpm = parseFloat(e.value); bpms.push(currentBpm); } });
    currentTime += duration;
  });
  const perfTime = lastT - firstT;
  let measureData = [];
  for (let i = 0; i < 100; i++) {
    const start = firstT + i * (perfTime / 100); const end = start + (perfTime / 100);
    const notesInWindow = allNoteTimes.filter(n => n.time >= start && n.time < end);
    measureData.push({ don: notesInWindow.filter(n => n.type === 'don').length, ka: notesInWindow.filter(n => n.type === 'ka').length, nps: notesInWindow.length / (perfTime / 100 || 1) });
  }
  const mainBpm = bpmMap.size ? [...bpmMap.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0] : currentBpm;
  return { combo, perfTime, minBpm: Math.min(...bpms), maxBpm: Math.max(...bpms), mainBpm, density: (combo - 1) / (perfTime || 1), measures: measureData, rendas: rendaSecs };
}

export function drawDensityGraph(measureData) {
  const container = u('#density-svg-wrapper').first(); const width = container.clientWidth; const height = 100;
  const margin = { left: 25, right: 5, top: 10, bottom: 5 };
  const svg = d3.select("#density-svg").attr("width", width).attr("height", height + 25).html("");
  const x = d3.scaleBand().domain(d3.range(measureData.length)).range([margin.left, width - margin.right]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(measureData, d => d.nps) * 1.1 || 10]).range([height, margin.top]);
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right)).attr("color", "#444");
  const layers = d3.stack().keys(["don", "ka"])(measureData.map(d => { const total = (d.don + d.ka) || 1; return { don: (d.don / total) * d.nps, ka: (d.ka / total) * d.nps }; }));
  svg.append("g").selectAll("g").data(layers).enter().append("g").attr("fill", (d, i) => i === 0 ? "#f33" : "#5cf")
     .selectAll("rect").data(d => d).enter().append("rect").attr("x", (d, i) => x(i)).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth());
}

export function replaceGradation() {
    const editor = u('.input').first();
    let text = editor.value;

    const getInitialState = (fullText, startIndex) => {
        let bpm = 120, measure = [4, 4];
        const lines = fullText.substring(0, startIndex).split(/\r?\n/);
        for (let line of lines) {
            const rawLine = line.split('//')[0].trim();
            if (!rawLine) continue;
            const parts = rawLine.split(/[ \t]+/);
            const cmdName = parts[0].toUpperCase();

            if (rawLine.toUpperCase().startsWith('BPM:')) bpm = parseFloat(rawLine.substring(4).trim()) || bpm;
            if (cmdName === '#BPMCHANGE') bpm = parseFloat(parts[1]) || bpm;
            if (cmdName === '#MEASURE') {
                const v = parts[1];
                if (v && v.includes('/')) {
                    const p = v.split('/');
                    measure = [parseInt(p[0]) || 4, parseInt(p[1]) || 4];
                }
            }
        }
        return { bpm, measure };
    };

    const checkNesting = (targetText) => {
        const startIndices = [];
        const endIndices = [];
        let sPos = targetText.indexOf('#GRADSTART');
        while (sPos !== -1) { startIndices.push(sPos); sPos = targetText.indexOf('#GRADSTART', sPos + 10); }
        let ePos = targetText.indexOf('#GRADEND');
        while (ePos !== -1) { endIndices.push(ePos); ePos = targetText.indexOf('#GRADEND', ePos + 8); }
        if (startIndices.length !== endIndices.length) throw new Error("エラー: #GRADSTART と #GRADEND の対が一致しません。");
        const segments = [];
        for (let i = 0; i < startIndices.length; i++) {
            if (i < startIndices.length - 1 && startIndices[i + 1] < endIndices[i]) {
                throw new Error(`エラー: 行 ${targetText.substring(0, startIndices[i + 1]).split('\n').length} 付近で入れ子を検出しました。`);
            }
            segments.push({ start: startIndices[i], end: endIndices[i] + 8 });
        }
        return segments;
    };

    const isNote = (token) => token.length === 1 && /^[0-9A-G]$/i.test(token);

    try {
        const segments = checkNesting(text);
        if (segments.length === 0) return;

        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            const blockRaw = text.substring(seg.start, seg.end);
            const headerMatch = blockRaw.match(/#GRADSTART\s+([^\n]+)/);
            if (!headerMatch) continue;

            const args = headerMatch[1].trim().split(/\s+/);
            const sHS = parseFloat(args[0]), eHS = parseFloat(args[1]);
            const accelArg = args.find(a => a.toLowerCase().startsWith('a'));
            const accel = accelArg ? parseFloat(accelArg.substring(1)) : 1.0;
            const hasAccel = !!accelArg;

            const content = blockRaw.substring(headerMatch[0].length, blockRaw.lastIndexOf('#GRADEND')).trim();
            const initialState = getInitialState(text, seg.start);
            let curBPM = initialState.bpm, curMeas = [...initialState.measure], totalTime = 0;
            let timeline = [];

            const tokens = content.match(/(#[A-Z0-9_]+(?:[ \t]+[^\n\r]+)?|[0-9A-G]|,)/gi) || [];
            let measures = [], tempM = [];
            
            tokens.forEach(t => { 
                tempM.push(t); 
                if (t === ',') { measures.push(tempM); tempM = []; } 
            });
            if (tempM.length) measures.push(tempM);

            measures.forEach((mTokens) => {
                if (mTokens.filter(isNote).length === 0) {
                    const commaIdx = mTokens.lastIndexOf(',');
                    if (commaIdx !== -1) {
                        mTokens.splice(commaIdx, 0, '0');
                    } else {
                        mTokens.push('0');
                    }
                }

                const notesInMeas = mTokens.filter(isNote);
                const noteCountInMeasure = notesInMeas.length;

                let noteIndex = 0;

                mTokens.forEach((t) => {
                    if (isNote(t)) {
                        const measureBeats = (curMeas[0] / curMeas[1]) * 4;
                        const measureDurationInBeats = (60 / curBPM) * measureBeats;
                        const noteInterval = measureDurationInBeats / noteCountInMeasure;
                        
                        timeline.push({ type: 'note', value: t, time: totalTime, isFirst: noteIndex === 0 });
                        
                        totalTime += noteInterval;
                        noteIndex++;
                    } 
                    else if (t === ',') {
                        timeline.push({ type: 'comma', value: ',', time: totalTime });
                    } 
                    else if (t.startsWith('#')) {
                        const cmdParts = t.trim().split(/[ \t]+/);
                        const cmdName = cmdParts[0].toUpperCase();

                        if (cmdName === '#BPMCHANGE') {
                            curBPM = parseFloat(cmdParts[1]) || curBPM;
                            timeline.push({ type: 'cmd', value: t, time: totalTime });
                        } 
                        else if (cmdName === '#MEASURE') {
                            const v = cmdParts[1];
                            if (v && v.includes('/')) {
                                const p = v.split('/');
                                curMeas = [parseInt(p[0]) || 4, parseInt(p[1]) || 4];
                            }
                            timeline.push({ type: 'cmd', value: t, time: totalTime });
                        } 
                        else if (cmdName === '#DELAY') {
                            const dVal = parseFloat(cmdParts[1]) || 0;
                            timeline.push({ type: 'cmd', value: t, time: totalTime });
                            totalTime += dVal;
                        } 
                        else {
                            timeline.push({ type: 'cmd', value: t, time: totalTime });
                        }
                    }
                });
            });

            let result = "", lastHS = -1;
            const finalDuration = totalTime;
            timeline.forEach((item, idx) => {
                const progress = finalDuration > 0 ? Math.min(1, item.time / finalDuration) : 0;
                let hs;
                if (hasAccel) {
                    hs = sHS * Math.pow(eHS / sHS, Math.pow(progress, 1 + (accel - 1) * 0.4));
                } else {
                    hs = sHS + (eHS - sHS) * progress;
                }
                hs = Math.round(hs * 1000) / 1000;

                if (item.type === 'cmd') {
                    if (hs !== lastHS) { 
                        result += (result && !result.endsWith('\n') ? '\n' : '') + `#SCROLL ${parseFloat(hs.toFixed(3))}\n`; 
                        lastHS = hs; 
                    }
                    result += item.value + "\n";
                } 
                else if (item.type === 'note') {
                    if ((item.value !== '0' || item.isFirst) && hs !== lastHS) {
                        result += (result && !result.endsWith('\n') ? '\n' : '') + `#SCROLL ${parseFloat(hs.toFixed(3))}\n`;
                        lastHS = hs;
                    }
                    result += item.value;
                } 
                else if (item.type === 'comma') {
                    result += ",\n";
                    if (idx === timeline.length - 1) {
                        result += `#SCROLL ${parseFloat(eHS.toFixed(3))}\n`;
                    }
                }
            });
            text = text.substring(0, seg.start) + result.trim() + text.substring(seg.end);
        }
        u('.input').first().value = text;
        processFunc();
    } catch (e) { u('.errors').text(e.message); }
}

