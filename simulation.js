/**
 * F1 Pit Strategy Simulator & Optimizer Engine
 * Core simulation and AI logic
 */

// Circuit database
const TRACKS = {
    monaco: {
        name: "Monaco (Monte Carlo)",
        baseLapTime: 75.0, // seconds
        pitLoss: 19.5, // time lost in pit lane (seconds)
        abrasiveness: 0.25, // extremely low tyre wear
        totalLaps: 78,
        description: "Narrow street circuit with the lowest tyre degradation, extremely difficult to overtake."
    },
    bahrain: {
        name: "Bahrain (Sakhir)",
        baseLapTime: 94.0,
        pitLoss: 22.5,
        abrasiveness: 0.90, // very high wear
        totalLaps: 57,
        description: "Very rough and abrasive track surface, high thermal degradation."
    },
    silverstone: {
        name: "Great Britain (Silverstone)",
        baseLapTime: 89.5,
        pitLoss: 20.0,
        abrasiveness: 0.70, // medium-high wear
        totalLaps: 52,
        description: "Fast track with many high-speed corners, putting massive lateral loads on tyres."
    },
    monza: {
        name: "Italy (Monza)",
        baseLapTime: 81.5,
        pitLoss: 25.0,
        abrasiveness: 0.40,
        totalLaps: 53,
        description: "Temple of Speed, low tyre load due to long straights."
    },
    spa: {
        name: "Belgium (Spa-Francorchamps)",
        baseLapTime: 104.5,
        pitLoss: 21.0,
        abrasiveness: 0.55,
        totalLaps: 44,
        description: "Longest circuit on the calendar, highly unpredictable microclimate."
    },
    singapore: {
        name: "Singapore (Marina Bay)",
        baseLapTime: 102.0,
        pitLoss: 28.0,
        abrasiveness: 0.50,
        totalLaps: 62,
        description: "Hot and humid conditions, most time-consuming pit lane due to low speed limit."
    }
};

// Tyre Compound Properties
const TYRES = {
    S: {
        name: "Soft",
        color: "#e10600", // F1 Red
        baseGrip: 1.04, // Fastest on dry track
        baseWearRate: 0.052, // Fast wear
        wearDegradation: 3.8, // Maximum seconds penalty when fully worn
        minLaps: 3,
        maxLife: 25
    },
    M: {
        name: "Medium",
        color: "#ffd129", // F1 Yellow
        baseGrip: 1.00,
        baseWearRate: 0.029,
        wearDegradation: 2.8,
        minLaps: 4,
        maxLife: 38
    },
    H: {
        name: "Hard",
        color: "#ffffff", // White
        baseGrip: 0.965, // Slower but durable
        baseWearRate: 0.016,
        wearDegradation: 2.0,
        minLaps: 5,
        maxLife: 55
    },
    I: {
        name: "Intermediate",
        color: "#39b54a", // Green
        baseGrip: 0.88, // Optimal on damp track
        baseWearRate: 0.024,
        wearDegradation: 3.2,
        minLaps: 3,
        maxLife: 40
    },
    W: {
        name: "Wet",
        color: "#00a2e8", // Blue
        baseGrip: 0.82, // Optimal on fully flooded track
        baseWearRate: 0.018,
        wearDegradation: 3.5,
        minLaps: 3,
        maxLife: 45
    }
};

// Driver Styles
const DRIVER_STYLES = {
    conservative: { speedFactor: 1.003, wearFactor: 0.78, name: "Conservative (Save Tyres)" },
    balanced: { speedFactor: 1.000, wearFactor: 1.00, name: "Balanced" },
    aggressive: { speedFactor: 0.997, wearFactor: 1.32, name: "Aggressive (Push)" }
};

/**
 * Calculate lap time and tyre wear for the next lap.
 */
function calculateLapTime(track, lap, tyreType, wear, wetness, driverStyle, totalLaps) {
    const trackInfo = TRACKS[track];
    const tyreInfo = TYRES[tyreType];
    const styleInfo = DRIVER_STYLES[driverStyle];

    // 1. Fuel Weight Effect (Car gets lighter -> faster)
    const fuelRemaining = (totalLaps - lap) / totalLaps;
    const fuelPenalty = fuelRemaining * 2.8; // Max 2.8s penalty at start of race

    // 2. Tyre Grip based on Track Wetness
    let grip = tyreInfo.baseGrip;
    if (tyreType === 'S' || tyreType === 'M' || tyreType === 'H') {
        // Slick tyres lose grip rapidly if water is present
        if (wetness > 0.1) {
            grip = grip - 2.8 * Math.pow(wetness - 0.1, 1.8);
        }
    } else if (tyreType === 'I') {
        // Intermediate works best in wetness 0.15 - 0.65
        if (wetness < 0.15) {
            // Too dry for inter
            grip = grip - 0.4 * (0.15 - wetness);
        } else if (wetness > 0.65) {
            // Too wet
            grip = grip - 1.2 * (wetness - 0.65);
        } else {
            // Optimal intermediate zone
            const diff = Math.abs(wetness - 0.4);
            grip = grip - 0.1 * diff;
        }
    } else if (tyreType === 'W') {
        // Wet works best in wetness > 0.5
        if (wetness < 0.5) {
            // Too dry for wet
            grip = grip - 0.8 * (0.5 - wetness);
        } else {
            // Optimal wet zone
            const diff = Math.max(0, 0.8 - wetness);
            grip = grip - 0.15 * diff;
        }
    }
    // Limit minimum grip to prevent negative/unrealistic lap times
    grip = Math.max(0.3, grip);

    // Calculate base lap time adjusted for grip and driver style
    let lapTime = trackInfo.baseLapTime * (2.0 - grip) * styleInfo.speedFactor;

    // Add fuel penalty
    lapTime += fuelPenalty;

    // 3. Tyre Wear Degradation Penalty
    let wearPenalty = tyreInfo.wearDegradation * Math.pow(wear, 2);
    
    // Cliff Effect (Sudden drop in performance if wear > 0.70)
    if (wear > 0.70) {
        wearPenalty += 6.0 * Math.pow(wear - 0.70, 1.5);
    }
    
    lapTime += wearPenalty;

    // 4. Calculate Next Wear State
    let wearRateMultiplier = trackInfo.abrasiveness * styleInfo.wearFactor;

    // Inters/Wets wear out extremely fast on dry track
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
 * Generate track wetness history array based on weather segments.
 */
function generateTrackWetnessHistory(totalLaps, weatherSegments) {
    const wetnessHistory = new Array(totalLaps + 1).fill(0.0);
    const sortedSegments = [...weatherSegments].sort((a, b) => a.fromLap - b.fromLap);

    // Set target wetness for each lap
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

    // Simulate transition of track dampness (gradual puddle buildup / drying)
    let currentWetness = targetWetness[1];
    wetnessHistory[1] = currentWetness;
    for (let lap = 2; lap <= totalLaps; lap++) {
        const target = targetWetness[lap];
        if (currentWetness < target) {
            // Rain starts, track gets wet quickly (+0.08 per lap)
            currentWetness = Math.min(target, currentWetness + 0.08);
        } else if (currentWetness > target) {
            // Rain stops, track dries gradually (-0.04 per lap)
            currentWetness = Math.max(target, currentWetness - 0.04);
        }
        wetnessHistory[lap] = parseFloat(currentWetness.toFixed(3));
    }

    return wetnessHistory;
}

/**
 * Simulate race from startLap to totalLaps using a designated strategy.
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

        // Check if a pit stop is scheduled on this lap
        if (pitMap[lap] && pitMap[lap] !== currentTyre) {
            isPitLap = true;
            currentTyre = pitMap[lap];
            currentWear = 0.0; // Fresh tyres
            pitTimeLoss = TRACKS[track].pitLoss + 2.5; // pit loss + 2.5s tyre swap
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

        // Safety limit: if tyres hit >95% wear, the strategy is failed
        if (currentWear >= 0.95) {
            return {
                isValid: false,
                validationError: `Tyre ${TYRES[currentTyre].name} is too worn (exceeded safety limit >95%) on Lap ${lap}.`,
                totalTime: Infinity,
                lapTimes,
                wearProgression,
                tyreHistory
            };
        }
    }

    // F1 Sporting Regulations Check:
    // If the race is dry (no Intermediate or Wet tyres used), drivers MUST run at least 2 different slick compounds
    // and perform at least 1 pit stop.
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
                validationError: "F1 Regulation: In a dry race, drivers must make at least 1 pit stop to change tyre compounds.",
                totalTime: totalTime,
                lapTimes,
                wearProgression,
                tyreHistory
            };
        }
        if (usedSlickCount < 2) {
            return {
                isValid: false,
                validationError: "F1 Regulation: In a dry race, drivers must use at least 2 different Slick compounds (e.g. Soft and Medium).",
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
 * Employs a recursive backtracking search engine with pruning to find the absolute fastest strategies.
 */
function optimizeStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, weatherSegments) {
    const wetnessHistory = generateTrackWetnessHistory(totalLaps, weatherSegments);
    
    // Check if rain exists in weather report
    const hasRain = weatherSegments.some(s => s.type === 'light_rain' || s.type === 'heavy_rain');
    const allowedTyres = hasRain ? ['S', 'M', 'H', 'I', 'W'] : ['S', 'M', 'H'];

    let bestStrategy = null;
    let bestTime = Infinity;
    let evaluatedCount = 0;

    // Normal dry race: max 2 stops. Wet/changeable weather: allow up to 3 stops.
    const maxStops = hasRain ? 3 : 2;

    /**
     * Backtracking function for stint exploration
     */
    function search(stintStartLap, currentTyre, currentWear, accumulatedTime, history, compoundsUsed) {
        if (stintStartLap > totalLaps) {
            evaluatedCount++;
            
            // F1 Regulation validation
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

        // Branch-and-bound pruning
        if (accumulatedTime >= bestTime) {
            return;
        }

        const trackInfo = TRACKS[track];
        const tyreInfo = TYRES[currentTyre];

        let tempWear = currentWear;
        let lapsSimulated = 0;
        let stintTime = 0;
        let stintData = [];

        // Simulate forward lap-by-lap to find potential pit laps
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

            // Limit tyre wear to 88% for racing safety limits
            if (tempWear > 0.88) {
                break;
            }
        }

        const minLapsBeforePit = Math.min(tyreInfo.minLaps, lapsSimulated);

        // Option A: Carry on this stint until end of race (No more pits)
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

        // Option B: Schedule a pit stop on a valid lap in this stint
        if (history.length < maxStops) {
            for (let i = minLapsBeforePit - 1; i < stintData.length; i++) {
                const step = stintData[i];
                const pitLap = step.lap;

                if (pitLap >= totalLaps - 1) continue;

                const timeAtPit = step.accumTime + trackInfo.pitLoss + 2.5;
                const nextLapWetness = wetnessHistory[pitLap + 1] || 0;
                
                // Try compound choices for next stint
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

    // Initialize search
    const initialCompounds = new Set([initialTyre]);
    search(startLap, initialTyre, initialWear, 0.0, [], initialCompounds);

    if (!bestStrategy) {
        return {
            error: "Unable to find a safe strategy within tyre wear constraints.",
            evaluatedCount
        };
    }

    // Re-simulate optimal strategy to acquire lap data
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

    // Get alternatives for dashboard comparisons
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
 * Generate comparison alternatives
 */
function findAlternativeStrategies(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, bestStrategy, allowedTyres) {
    const alternatives = [];
    const bestStopsCount = bestStrategy.pitStops.length;
    
    // Alternative 1: Add 1 stop
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
                name: `${targetStops}-Stop (Fast Alternative)`,
                pitStops,
                totalTime: sim.totalTime,
                lapTimes: sim.lapTimes,
                wearProgression: sim.wearProgression,
                tyreHistory: sim.tyreHistory,
                totalStops: sim.totalStops
            });
        }
    }

    // Alternative 2: Subtract 1 stop (if best strategy > 1 stop)
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
                name: `${targetStops}-Stop (Saver Alternative)`,
                pitStops,
                totalTime: sim.totalTime,
                lapTimes: sim.lapTimes,
                wearProgression: sim.wearProgression,
                tyreHistory: sim.tyreHistory,
                totalStops: sim.totalStops
            });
        }
    }

    // If no alternatives found, make a default simple 1-stop
    if (alternatives.length === 0) {
        const halfLap = Math.floor((totalLaps + startLap) / 2);
        const nextTyre = initialTyre === 'M' ? 'H' : 'M';
        const pitStops = [{ lap: halfLap, tyre: nextTyre }];
        const sim = simulateStrategy(track, totalLaps, startLap, initialTyre, initialWear, driverStyle, wetnessHistory, pitStops);
        if (sim.isValid) {
            alternatives.push({
                name: "1-Stop (Standard Strategy)",
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

// Export for node checking or browser namespace
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TRACKS, TYRES, DRIVER_STYLES, calculateLapTime, simulateStrategy, optimizeStrategy, generateTrackWetnessHistory };
} else {
    window.F1Simulation = { TRACKS, TYRES, DRIVER_STYLES, calculateLapTime, simulateStrategy, optimizeStrategy, generateTrackWetnessHistory };
}
