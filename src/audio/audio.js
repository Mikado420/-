export async function analyzeAudio(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // 1. Calculate energy in 20ms windows
    const windowSize = Math.floor(sampleRate * 0.02);
    const energies = [];
    for(let i=0; i<data.length; i+=windowSize) {
        let sum = 0;
        for(let j=0; j<windowSize && i+j < data.length; j++) {
            sum += Math.abs(data[i+j]);
        }
        energies.push(sum / windowSize);
    }
    
    // 2. Detect Peaks
    const peaks = [];
    let threshold = 0.05; // Base threshold
    for (let i = 2; i < energies.length - 2; i++) {
        if (energies[i] > energies[i-1] && energies[i] > energies[i+1] && energies[i] > threshold) {
            peaks.push(i * windowSize / sampleRate);
        }
    }
    
    if (peaks.length < 5) {
        return { bpm: 120, offset: 0, beats: [], timeSignature: 4 };
    }
    
    // 3. Find intervals between peaks
    let intervals = [];
    for(let i=1; i<peaks.length; i++) {
        for (let j=1; j<=3 && i-j >= 0; j++) {
            let diff = peaks[i] - peaks[i-j];
            if (diff >= 0.25 && diff <= 1.5) { // 40-240 BPM
                intervals.push(diff);
            }
        }
    }
    
    // 4. Histogram to find dominant interval
    let counts = {};
    for (let interval of intervals) {
        let bin = Math.round(interval * 50) / 50; // 0.02s bins
        counts[bin] = (counts[bin] || 0) + 1;
    }
    let bestBin = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    let estimatedInterval = parseFloat(bestBin);
    
    // Refine interval using peaks that match this interval closely
    let validPairs = [];
    for(let i=1; i<peaks.length; i++) {
        let diff = peaks[i] - peaks[i-1];
        if (Math.abs(diff - estimatedInterval) < 0.05) {
            validPairs.push(diff);
        }
    }
    if(validPairs.length > 0) {
        estimatedInterval = validPairs.reduce((a,b) => a+b, 0) / validPairs.length;
    }
    
    let estimatedBpm = Math.round(60 / estimatedInterval);
    let gridInterval = 60 / estimatedBpm;
    
    // 5. Linear Regression to find robust OFFSET and suppress micro-variations
    // We group peaks into beat indices (N)
    let nValues = [];
    let tValues = [];
    
    let firstPeak = peaks[0];
    for (let t of peaks) {
        let n = Math.round((t - firstPeak) / gridInterval);
        // Only use peaks that are close to the expected grid
        let expectedT = firstPeak + n * gridInterval;
        if (Math.abs(t - expectedT) < 0.08) {
            nValues.push(n);
            tValues.push(t);
        }
    }
    
    let offset = firstPeak;
    if (nValues.length > 5) {
        let sumN = 0, sumT = 0, sumNT = 0, sumNN = 0;
        let count = nValues.length;
        for(let i=0; i<count; i++) {
            sumN += nValues[i];
            sumT += tValues[i];
            sumNT += nValues[i] * tValues[i];
            sumNN += nValues[i] * nValues[i];
        }
        let slope = (count * sumNT - sumN * sumT) / (count * sumNN - sumN * sumN);
        offset = (sumT - slope * sumN) / count;
        estimatedBpm = Math.round(60 / slope);
    }
    
    return {
        bpm: estimatedBpm,
        offset: offset > 0 ? (Math.round(offset * 1000) / 1000) : 0,
        beats: peaks, // Original detected raw peaks
        timeSignature: 4
    };
}

export function generateEmptyTja(title, bpm, offset, filename) {
    let tja = `TITLE:${title || 'New Song'}
SUBTITLE:--
BPM:${bpm}
WAVE:${filename}
OFFSET:${-offset}
SONGVOL:100
SEVOL:100

COURSE:Oni
LEVEL:8
BALLOON:
SCOREINIT:1000
SCOREDIFF:1000

#START
0000,
#END
`;
    return tja;
}
