/**
 * F1 Pit Strategy Simulator & Optimizer Engine
 * Core simulation and AI logic
 */

// Sirkuit database
const TRACKS = {
    monaco: {
        name: "Monaco (Monte Carlo)",
        baseLapTime: 75.0, // detik
        pitLoss: 19.5, // waktu hilang di pit lane (detik)
        abrasiveness: 0.25, // degradasi ban sangat rendah
        totalLaps: 78,
        description: "Sirkuit jalan raya sempit dengan degradasi ban terendah, sangat sulit menyalip."
    },
    bahrain: {
        name: "Bahrain (Sakhir)",
        baseLapTime: 94.0,
        pitLoss: 22.5,
        abrasiveness: 0.90, // degradasi sangat tinggi
        totalLaps: 57,
        description: "Permukaan trek yang sangat kasar dan abrasif, degradasi termal tinggi."
    },
    silverstone: {
        name: "Great Britain (Silverstone)",
        baseLapTime: 89.5,
        pitLoss: 20.0,
        abrasiveness: 0.70, // degradasi sedang-tinggi
        totalLaps: 52,
        description: "Trek cepat dengan banyak tikungan berkecepatan tinggi, memberikan beban lateral besar pada ban."
    },
    monza: {
        name: "Italy (Monza)",
        baseLapTime: 81.5,
        pitLoss: 25.0,
        abrasiveness: 0.40,
        totalLaps: 53,
        description: "Kuil Kecepatan (Temple of Speed), beban ban rendah karena trek didominasi lintasan lurus."
    },
    spa: {
        name: "Belgium (Spa-Francorchamps)",
        baseLapTime: 104.5,
        pitLoss: 21.0,
        abrasiveness: 0.55,
        totalLaps: 44,
        description: "Sirkuit terpanjang dalam kalender, cuaca mikro yang sangat tidak terduga."
    },
    singapore: {
        name: "Singapore (Marina Bay)",
        baseLapTime: 102.0,
        pitLoss: 28.0,
        abrasiveness: 0.50,
        totalLaps: 62,
        description: "Suhu udara lembap dan panas, pit stop paling memakan waktu karena batas kecepatan pit lane rendah."
    }
};

// Karakteristik Ban
const TYRES = {
    S: {
        name: "Soft",
        color: "#e10600", // Merah F1
        baseGrip: 1.04, // Paling cepat di trek kering
        baseWearRate: 0.052, // Cepat aus
        wearDegradation: 3.8, // Penalti detik maksimal saat aus
        minLaps: 3,
        maxLife: 25
    },
    M: {
        name: "Medium",
        color: "#ffd129", // Kuning F1
        baseGrip: 1.00,
        baseWearRate: 0.029,
        wearDegradation: 2.8,
        minLaps: 4,
        maxLife: 38
    },
    H: {
        name: "Hard",
        color: "#ffffff", // Putih
        baseGrip: 0.965, // Lebih lambat tapi awet
        baseWearRate: 0.016,
        wearDegradation: 2.0,
        minLaps: 5,
        maxLife: 55
    },
    I: {
        name: "Intermediate",
        color: "#39b54a", // Hijau
        baseGrip: 0.88, // Optimal di lintasan basah ringan
        baseWearRate: 0.024,
        wearDegradation: 3.2,
        minLaps: 3,
        maxLife: 40
    },
    W: {
        name: "Wet",
        color: "#00a2e8", // Biru
        baseGrip: 0.82, // Optimal di lintasan sangat basah
        baseWearRate: 0.018,
        wearDegradation: 3.5,
        minLaps: 3,
        maxLife: 45
    }
};

// Gaya Mengemudi
const DRIVER_STYLES = {
    conservative: { speedFactor: 1.003, wearFactor: 0.78, name: "Konservatif (Hemat Ban)" },
    balanced: { speedFactor: 1.000, wearFactor: 1.00, name: "Seimbang" },
    aggressive: { speedFactor: 0.997, wearFactor: 1.32, name: "Agresif (Push)" }
};

/**
 * Menghitung waktu lap dan tingkat keausan ban berikutnya.
 */
function calculateLapTime(track, lap, tyreType, wear, wetness, driverStyle, totalLaps) {
    const trackInfo = TRACKS[track];
    const tyreInfo = TYRES[tyreType];
    const styleInfo = DRIVER_STYLES[driverStyle];

    // 1. Pengaruh Bahan Bakar (Mobil semakin ringan -> semakin cepat)
    const fuelRemaining = (totalLaps - lap) / totalLaps;
    const fuelPenalty = fuelRemaining * 2.8;

    // 2. Grip Ban berdasarkan Kondisi Basah Trek (Wetness)
    let grip = tyreInfo.baseGrip;
    if (tyreType === 'S' || tyreType === 'M' || tyreType === 'H') {
        if (wetness > 0.1) {
            grip = grip - 2.8 * Math.pow(wetness - 0.1, 1.8);
        }
    } else if (tyreType === 'I') {
        if (wetness < 0.15) {
            grip = grip - 0.4 * (0.15 - wetness);
        } else if (wetness > 0.65) {
            grip = grip - 1.2 * (wetness - 0.65);
        } else {
            const diff = Math.abs(wetness - 0.4);
            grip = grip - 0.1 * diff;
        }
    } else if (tyreType === 'W') {
        if (wetness < 0.5) {
            grip = grip - 0.8 * (0.5 - wetness);
        } else {
            const diff = Math.max(0, 0.8 - wetness);
            grip = grip - 0.15 * diff;
        }
    }
    grip = Math.max(0.3, grip);

    let lapTime = trackInfo.baseLapTime * (2.0 - grip) * styleInfo.speedFactor;
    lapTime += fuelPenalty;

    // 3. Penalti Degradasi Keausan Ban
    let wearPenalty = tyreInfo.wearDegradation * Math.pow(wear, 2);
    if (wear > 0.70) {
        wearPenalty += 6.0 * Math.pow(wear - 0.70, 1.5);
    }
    lapTime += wearPenalty;

    // 4. Hitung Keausan Ban Berikutnya (Next Wear)
    let wearRateMultiplier = trackInfo.abrasiveness * styleInfo.wearFactor;

    if (tyreType === 'I' && wetness < 0.15) {
        wearRateMultiplier *= 8.0 * (1.0 - wetness);
    } else if (tyreType === 'W' && wetness < 0.45) {
        wearRateMultiplier *= 12.0 * (1.0 - wetness);
    }

    const wearIncrease = tyreInfo.baseWearRate * wearRateMultiplier;
    const nextWear = Math.min(1.0, wear + wearIncrease);

    return {
        lapTime: lapTime,
        nextWear: nextWear
    };
}

/**
 * Menghasilkan array kondisi basah trek (wetness) untuk setiap lap berdasarkan prakiraan cuaca.
 */
function generateTrackWetnessHistory(totalLaps, weatherSegments) {
    const wetnessHistory = new Array(totalLaps + 1).fill(0.0);
    const sortedSegments = [...weatherSegments].sort((a, b) => a.fromLap - b.fromLap);

    const targetWetness = new Array(totalLaps + 1).fill(0.0);
    for (let lap = 1; lap <= totalLaps; lap++) {
        const seg = sortedSegments.find(s => lap >= s.fromLap && lap <= s.toLap);
        if (seg) {
            if (seg.type === 'light_rain') targetWetness[lap] = 0.45;
            else if (seg.type === 'heavy_rain') targetWetness[lap] = 0.85;
            else targetWetness[lap] = 0.0;
        } else {
            targetWetness[lap] = 0.0;
        }
    }

    let currentWetness = targetWetness[1];
    wetnessHistory[1] = currentWetness;
    for (let lap = 2; lap <= totalLaps; lap++) {
        const target = targetWetness[lap];
        if (currentWetness < target) {
            currentWetness = Math.min(target, currentWetness + 0.08);
        } else if (currentWetness > target) {
            currentWetness = Math.max(target, currentWetness - 0.04);
        }
        wetnessHistory[lap] = parseFloat(currentWetness.toFixed(3));
    }

    return wetnessHistory;
}

/**
 * Mensimulasikan jalannya balapan dari startLap hingga totalLaps dengan strategi pit stop tertentu.
 */
function simulateStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, pitStops) {
    let currentTyre = initialTyre;
    let currentWear = initialWear;
    let lapTimes = [];
    let wearProgression = [];
    let tyreHistory = [];
    let totalTime = 0;
    
    const pitMap = {};
    pitStops.forEach(p => {
        pitMap[p.lap] = p.tyre;
    });

    let currentStintLaps = 0;
    let usedCompounds = new Set([initialTyre]);
    let totalStops = 0;

    for (let lap = startLap; lap <= totalLaps; lap++) {
        let isPitLap = false;
        let pitTimeLoss = 0;

        if (pitMap[lap] && pitMap[lap] !== currentTyre) {
            isPitLap = true;
            currentTyre = pitMap[lap];
            currentWear = 0.0;
            pitTimeLoss = TRACKS[track].pitLoss + 2.5;
            currentStintLaps = 0;
            usedCompounds.add(currentTyre);
            totalStops++;
        }

        const wetness = wetnessHistory[lap];
        const result = calculateLapTime(track, lap, currentTyre, currentWear, wetness, driverStyle, totalLaps);
        
        let actualLapTime = result.lapTime + pitTimeLoss;
        totalTime += actualLapTime;

        lapTimes.push(parseFloat(actualLapTime.toFixed(3)));
        wearProgression.push(parseFloat((currentWear * 100).toFixed(1)));
        tyreHistory.push(currentTyre);

        currentWear = result.nextWear;
        currentStintLaps++;

        if (currentWear >= 0.95) {
            return {
                isValid: false,
                validationError: `Ban ${TYRES[currentTyre].name} terlalu aus (mencapai batas bahaya >95%) pada Lap ${lap}.`,
                totalTime: Infinity,
                lapTimes,
                wearProgression,
                tyreHistory
            };
        }
    }

    let dryRace = true;
    let usedSlickCount = 0;
    const slickTypes = new Set(['S', 'M', 'H']);
    usedCompounds.forEach(c => {
        if (!slickTypes.has(c)) {
            dryRace = false;
        } else {
            usedSlickCount++;
        }
    });

    if (dryRace && totalLaps > 15) {
        if (totalStops === 0) {
            return {
                isValid: false,
                validationError: "Aturan F1: Dalam balapan kering, pembalap wajib melakukan minimal 1 pit stop untuk mengganti tipe ban.",
                totalTime: totalTime,
                lapTimes,
                wearProgression,
                tyreHistory
            };
        }
        if (usedSlickCount < 2) {
            return {
                isValid: false,
                validationError: "Aturan F1: Dalam balapan kering, pembalap wajib menggunakan minimal 2 tipe ban Slick yang berbeda (misal Soft dan Medium).",
                totalTime: totalTime,
                lapTimes,
                wearProgression,
                tyreHistory
            };
        }
    }

    return {
        isValid: true,
        totalTime: parseFloat(totalTime.toFixed(3)),
        lapTimes,
        wearProgression,
        tyreHistory,
        totalStops
    };
}

/**
 * AI Strategy Optimizer
 */
function optimizeStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, weatherSegments) {
    const wetnessHistory = generateTrackWetnessHistory(totalLaps, weatherSegments);
    const hasRain = weatherSegments.some(s => s.type === 'light_rain' || s.type === 'heavy_rain');
    const allowedTyres = hasRain ? ['S', 'M', 'H', 'I', 'W'] : ['S', 'M', 'H'];

    let bestStrategy = null;
    let bestTime = Infinity;
    let evaluatedCount = 0;
    const maxStops = hasRain ? 3 : 2;

    function search(stintStartLap, currentTyre, currentWear, accumulatedTime, history, compoundsUsed) {
        if (stintStartLap > totalLaps) {
            evaluatedCount++;
            
            let dryRace = true;
            let slickCount = 0;
            compoundsUsed.forEach(c => {
                if (c === 'I' || c === 'W') dryRace = false;
                else slickCount++;
            });

            const totalStops = history.length;
            if (dryRace && totalLaps > 15) {
                if (totalStops === 0 || slickCount < 2) {
                    return;
                }
            }

            if (accumulatedTime < bestTime) {
                bestTime = accumulatedTime;
                bestStrategy = {
                    pitStops: [...history],
                    totalTime: parseFloat(accumulatedTime.toFixed(3))
                };
            }
            return;
        }

        if (accumulatedTime >= bestTime) {
            return;
        }

        const trackInfo = TRACKS[track];
        const tyreInfo = TYRES[currentTyre];

        let tempWear = currentWear;
        let lapsSimulated = 0;
        let stintTime = 0;
        let stintData = [];

        for (let lap = stintStartLap; lap <= totalLaps; lap++) {
            const wetness = wetnessHistory[lap];
            const result = calculateLapTime(track, lap, currentTyre, tempWear, wetness, driverStyle, totalLaps);
            
            stintTime += result.lapTime;
            lapsSimulated++;
            tempWear = result.nextWear;

            stintData.push({
                lap: lap,
                accumTime: stintTime,
                wear: tempWear
            });

            if (tempWear > 0.88) {
                break;
            }
        }

        const minLapsBeforePit = Math.min(tyreInfo.minLaps, lapsSimulated);

        if (stintStartLap + lapsSimulated - 1 === totalLaps) {
            const lastLapData = stintData[stintData.length - 1];
            if (lastLapData.wear < 0.90) {
                search(
                    totalLaps + 1,
                    currentTyre,
                    lastLapData.wear,
                    accumulatedTime + lastLapData.accumTime,
                    history,
                    compoundsUsed
                );
            }
        }

        if (history.length < maxStops) {
            for (let i = minLapsBeforePit - 1; i < stintData.length; i++) {
                const step = stintData[i];
                const pitLap = step.lap;

                if (pitLap >= totalLaps - 1) continue;

                const timeAtPit = step.accumTime + trackInfo.pitLoss + 2.5;
                const nextLapWetness = wetnessHistory[pitLap + 1] || 0;
                
                for (const nextTyre of allowedTyres) {
                    if (nextTyre === currentTyre && !hasRain) continue;
                    if ((nextTyre === 'I' || nextTyre === 'W') && nextLapWetness < 0.15) continue;
                    if ((nextTyre === 'S' || nextTyre === 'M' || nextTyre === 'H') && nextLapWetness > 0.55) continue;
                    if (nextTyre === 'W' && nextLapWetness < 0.35) continue;
                    if (nextTyre === 'S' && nextLapWetness > 0.20) continue;

                    const nextHistory = [...history, { lap: pitLap, tyre: nextTyre }];
                    const nextCompounds = new Set(compoundsUsed);
                    nextCompounds.add(nextTyre);

                    search(
                        pitLap + 1,
                        nextTyre,
                        0.0,
                        accumulatedTime + timeAtPit,
                        nextHistory,
                        nextCompounds
                    );
                }
            }
        }
    }

    const initialCompounds = new Set([initialTyre]);
    search(startLap, initialTyre, initialWear, 0.0, [], initialCompounds);

    if (!bestStrategy) {
        return {
            error: "Tidak dapat menemukan strategi optimal yang aman dalam batas toleransi ban.",
            evaluatedCount
        };
    }

    const simulationResult = simulateStrategy(
        track,
        totalLaps,
        startLap,
        initialTyre,
        initialWear,
        driverStyle,
        wetnessHistory,
        bestStrategy.pitStops
    );

    const alternatives = findAlternativeStrategies(
        track,
        totalLaps,
        startLap,
        initialTyre,
        initialWear,
        driverStyle,
        wetnessHistory,
        bestStrategy,
        allowedTyres
    );

    return {
        bestStrategy: {
            pitStops: bestStrategy.pitStops,
            totalTime: bestStrategy.totalTime,
            lapTimes: simulationResult.lapTimes,
            wearProgression: simulationResult.wearProgression,
            tyreHistory: simulationResult.tyreHistory,
            totalStops: simulationResult.totalStops
        },
        alternatives: alternatives,
        wetnessHistory: wetnessHistory.slice(startLap),
        evaluatedCount: evaluatedCount
    };
}

/**
 * Menghasilkan beberapa strategi alternatif yang layak untuk dibandingkan
 */
function findAlternativeStrategies(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, bestStrategy, allowedTyres) {
    const alternatives = [];
    const bestStopsCount = bestStrategy.pitStops.length;
    
    if (bestStopsCount < 3) {
        const targetStops = bestStopsCount + 1;
        const interval = Math.floor((totalLaps - startLap) / (targetStops + 1));
        const pitStops = [];
        let curTyre = initialTyre;
        
        for (let i = 1; i <= targetStops; i++) {
            const pitLap = startLap + i * interval;
            let nextTyre = 'M';
            if (curTyre === 'M') nextTyre = 'H';
            else if (curTyre === 'H') nextTyre = 'S';
            else nextTyre = 'M';
            
            if (wetnessHistory[pitLap] > 0.5) nextTyre = 'W';
            else if (wetnessHistory[pitLap] > 0.15) nextTyre = 'I';

            pitStops.push({ lap: pitLap, tyre: nextTyre });
            curTyre = nextTyre;
        }

        const sim = simulateStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, pitStops);
        if (sim.isValid && Math.abs(sim.totalTime - bestStrategy.totalTime) < 60) {
            alternatives.push({
                name: `${targetStops}-Stop (Alternatif Cepat)`,
                pitStops,
                totalTime: sim.totalTime,
                lapTimes: sim.lapTimes,
                wearProgression: sim.wearProgression,
                tyreHistory: sim.tyreHistory,
                totalStops: sim.totalStops
            });
        }
    }

    if (bestStopsCount > 1) {
        const targetStops = bestStopsCount - 1;
        const interval = Math.floor((totalLaps - startLap) / (targetStops + 1));
        const pitStops = [];
        let curTyre = initialTyre;
        
        for (let i = 1; i <= targetStops; i++) {
            const pitLap = startLap + i * interval;
            let nextTyre = curTyre === 'H' ? 'M' : 'H';
            if (wetnessHistory[pitLap] > 0.5) nextTyre = 'W';
            else if (wetnessHistory[pitLap] > 0.15) nextTyre = 'I';

            pitStops.push({ lap: pitLap, tyre: nextTyre });
            curTyre = nextTyre;
        }

        const sim = simulateStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, pitStops);
        if (sim.isValid && Math.abs(sim.totalTime - bestStrategy.totalTime) < 90) {
            alternatives.push({
                name: `${targetStops}-Stop (Alternatif Hemat)`,
                pitStops,
                totalTime: sim.totalTime,
                lapTimes: sim.lapTimes,
                wearProgression: sim.wearProgression,
                tyreHistory: sim.tyreHistory,
                totalStops: sim.totalStops
            });
        }
    }

    if (alternatives.length === 0) {
        const halfLap = Math.floor((totalLaps + startLap) / 2);
        const nextTyre = initialTyre === 'M' ? 'H' : 'M';
        const pitStops = [{ lap: halfLap, tyre: nextTyre }];
        const sim = simulateStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, pitStops);
        if (sim.isValid) {
            alternatives.push({
                name: "1-Stop (Strategi Standar)",
                pitStops,
                totalTime: sim.totalTime,
                lapTimes: sim.lapTimes,
                wearProgression: sim.wearProgression,
                tyreHistory: sim.tyreHistory,
                totalStops: sim.totalStops
            });
        }
    }

    return alternatives.slice(0, 2);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TRACKS, TYRES, DRIVER_STYLES, calculateLapTime, simulateStrategy, optimizeStrategy, generateTrackWetnessHistory };
} else {
    window.F1Simulation = { TRACKS, TYRES, DRIVER_STYLES, calculateLapTime, simulateStrategy, optimizeStrategy, generateTrackWetnessHistory };
}
