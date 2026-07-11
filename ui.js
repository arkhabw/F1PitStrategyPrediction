/**
 * F1 Pit Strategy UI Logic
 * Handles DOM interactions, ChartJS integration, and AI log simulation
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const trackSelect = document.getElementById("trackSelect");
    const driverStyleSelect = document.getElementById("driverStyleSelect");
    const startLapInput = document.getElementById("startLapInput");
    const initialTyreSelect = document.getElementById("initialTyreSelect");
    const initialWearRange = document.getElementById("initialWearRange");
    const wearValueText = document.getElementById("wearValueText");
    const btnAddWeather = document.getElementById("btnAddWeather");
    const weatherListContainer = document.getElementById("weatherListContainer");
    const btnCalculate = document.getElementById("btnCalculate");
    const consoleLines = document.getElementById("consoleLines");
    
    const resultsPanel = document.getElementById("resultsPanel");
    const metricTotalTime = document.getElementById("metricTotalTime");
    const metricStops = document.getElementById("metricStops");
    const metricAvgLap = document.getElementById("metricAvgLap");
    const stintTimeline = document.getElementById("stintTimeline");
    const labelStartLap = document.getElementById("labelStartLap");
    const labelEndLap = document.getElementById("labelEndLap");
    const alternativesGrid = document.getElementById("alternativesGrid");
    
    const visualizationPanel = document.getElementById("visualizationPanel");
    const btnToggleTable = document.getElementById("btnToggleTable");
    const tableContainer = document.getElementById("tableContainer");
    const lapsTableBody = document.getElementById("lapsTableBody");
    
    // Modal Elements
    const weatherModal = document.getElementById("weatherModal");
    const modalClose = document.getElementById("modalClose");
    const btnSaveWeather = document.getElementById("btnSaveWeather");
    const weatherTypeSelect = document.getElementById("weatherTypeSelect");
    const weatherStartLap = document.getElementById("weatherStartLap");
    const weatherEndLap = document.getElementById("weatherEndLap");

    // Premium UI Custom Selectors Elements
    const driverStyleSegmented = document.getElementById("driverStyleSegmented");
    const driverStyleSlider = document.getElementById("driverStyleSlider");
    const driverStyleBtns = driverStyleSegmented.querySelectorAll(".segment-btn");
    
    const initialTyreSegmented = document.getElementById("initialTyreSegmented");
    const tyreBtns = initialTyreSegmented.querySelectorAll(".tyre-btn");

    const btnExportPDF = document.getElementById("btnExportPDF");
    const compareTimelinesSection = document.getElementById("compareTimelinesSection");
    const compareListContainer = document.getElementById("compareListContainer");

    // Track SVG path definitions
    const TRACK_SVGS = {
        monaco: "M 25 50 C 15 30, 40 10, 65 15 C 80 20, 90 40, 80 55 C 70 70, 60 65, 50 80 C 40 90, 25 75, 20 65 C 15 55, 35 65, 25 50 Z",
        bahrain: "M 20 75 L 20 25 L 45 20 L 50 32 L 70 10 L 80 40 L 58 55 L 72 80 L 45 75 L 40 55 Z",
        silverstone: "M 15 55 C 10 35, 25 15, 45 10 C 65 5, 85 25, 90 45 C 95 65, 70 80, 55 70 C 40 60, 30 85, 15 55 Z",
        monza: "M 15 45 C 15 25, 45 20, 75 20 C 90 20, 90 50, 80 60 L 75 55 L 70 65 C 50 65, 40 70, 30 75 C 20 80, 15 65, 15 45 Z",
        spa: "M 15 40 C 25 25, 50 15, 75 10 C 85 10, 90 30, 85 45 C 80 60, 65 75, 55 65 C 45 55, 35 85, 25 85 C 15 85, 10 60, 15 40 Z",
        singapore: "M 15 25 L 45 25 L 48 40 L 80 40 L 80 70 L 50 70 L 45 55 L 15 55 Z"
    };

    // State Variables
    let rainSegments = []; // User-added rain events: { id, fromLap, toLap, type: 'light_rain'|'heavy_rain' }
    let optimizationResult = null;
    let selectedStrategyIndex = -1; // -1 for best strategy, 0+ for alternatives
    let activeChartType = 'laptime'; // 'laptime' | 'wear' | 'wetness'
    let myChart = null;

    // --- Premium Custom Selectors Logics ---
    // 1. Driver Style Segmented Control
    function alignStyleSlider() {
        const activeBtn = driverStyleSegmented.querySelector(".segment-btn.active");
        if (activeBtn) {
            driverStyleSlider.style.left = activeBtn.offsetLeft + "px";
            driverStyleSlider.style.width = activeBtn.offsetWidth + "px";
        }
    }

    driverStyleBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            driverStyleBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            driverStyleSelect.value = btn.getAttribute("data-value");
            alignStyleSlider();
        });
    });

    // Run alignment initial and on resize
    setTimeout(alignStyleSlider, 100);
    window.addEventListener("resize", alignStyleSlider);

    // 2. Tyre Button Selector Control
    tyreBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tyreBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            initialTyreSelect.value = btn.getAttribute("data-value");
        });
    });

    // 3. Export PDF Action
    btnExportPDF.addEventListener("click", () => {
        window.print();
    });

    // 4. Initial Track Art setup
    function updateTrackArt() {
        const selectedTrack = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[selectedTrack];
        
        // Update SVG path
        const svgElement = document.getElementById("trackSvg");
        const pathData = TRACK_SVGS[selectedTrack] || "";
        svgElement.innerHTML = `<path d="${pathData}" stroke="var(--accent-red)" stroke-width="3" fill="none" filter="drop-shadow(0 0 5px rgba(225,6,0,0.5))" />`;
        
        // Update text description
        document.getElementById("trackDescriptionText").innerText = `${trackInfo.name}: ${trackInfo.description}`;
        
        // Set maximum value of start lap input
        startLapInput.max = trackInfo.totalLaps;
        if (parseInt(startLapInput.value) > trackInfo.totalLaps) {
            startLapInput.value = trackInfo.totalLaps;
        }

        // Clean out weather segments that exceed track bounds
        rainSegments = rainSegments.filter(seg => seg.fromLap <= trackInfo.totalLaps);
        rainSegments.forEach(seg => {
            if (seg.toLap > trackInfo.totalLaps) seg.toLap = trackInfo.totalLaps;
        });
        renderWeatherList();
    }
    
    trackSelect.addEventListener("change", updateTrackArt);
    updateTrackArt(); // Initial call

    // Update wear slider text
    initialWearRange.addEventListener("input", (e) => {
        wearValueText.innerText = `${e.target.value}%`;
    });

    // Weather Modal Actions
    btnAddWeather.addEventListener("click", () => {
        const currentTrack = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[currentTrack];
        
        weatherStartLap.max = trackInfo.totalLaps;
        weatherEndLap.max = trackInfo.totalLaps;
        weatherModal.style.display = "flex";
    });

    modalClose.addEventListener("click", () => {
        weatherModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === weatherModal) {
            weatherModal.style.display = "none";
        }
    });

    // Save Weather Segment
    btnSaveWeather.addEventListener("click", () => {
        const fromLap = parseInt(weatherStartLap.value);
        const toLap = parseInt(weatherEndLap.value);
        const type = weatherTypeSelect.value;
        const currentTrack = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[currentTrack];

        // Validate range inputs
        if (isNaN(fromLap) || isNaN(toLap) || fromLap < 1 || toLap < 1) {
            alert("Lap numbers must be positive integers.");
            return;
        }
        if (fromLap > trackInfo.totalLaps || toLap > trackInfo.totalLaps) {
            alert(`Circuit ${trackInfo.name} only has ${trackInfo.totalLaps} Laps.`);
            return;
        }
        if (fromLap > toLap) {
            alert("Start Lap cannot be greater than End Lap.");
            return;
        }

        // Check overlaps with other rain events
        const isOverlap = rainSegments.some(seg => {
            return (fromLap <= seg.toLap && toLap >= seg.fromLap);
        });

        if (isOverlap) {
            alert("The weather segment overlaps with an already scheduled rain event.");
            return;
        }

        // Push new segment
        rainSegments.push({
            id: Date.now(),
            fromLap,
            toLap,
            type
        });

        // Sort rain segments
        rainSegments.sort((a, b) => a.fromLap - b.fromLap);

        // Reset & Close
        weatherModal.style.display = "none";
        renderWeatherList();
        writeConsoleLine(`Weather Forecast Updated: Rain (${type === 'light_rain' ? 'Light' : 'Heavy'}) on Laps ${fromLap}-${toLap}`, "warn");
    });

    // Remove weather segment
    window.deleteWeatherSegment = function(id) {
        rainSegments = rainSegments.filter(seg => seg.id !== id);
        renderWeatherList();
        writeConsoleLine("Weather segment removed from forecast.", "info");
    };

    // Render weather list in DOM
    function renderWeatherList() {
        weatherListContainer.innerHTML = "";
        
        if (rainSegments.length === 0) {
            weatherListContainer.innerHTML = `
                <div class="weather-card" style="color: var(--text-muted); justify-content: center; border-style: dashed;">
                    Dry conditions expected throughout (Dry Race)
                </div>
            `;
            return;
        }

        rainSegments.forEach(seg => {
            const typeClass = seg.type;
            
            const card = document.createElement("div");
            card.className = "weather-card";
            card.innerHTML = `
                <div class="weather-info">
                    <span class="weather-type-badge badge-${typeClass}">${seg.type === 'light_rain' ? 'Inter' : 'Wet'}</span>
                    <span class="weather-laps">Laps ${seg.fromLap} - ${seg.toLap}</span>
                </div>
                <button type="button" class="btn-delete" onclick="deleteWeatherSegment(${seg.id})">&times;</button>
            `;
            weatherListContainer.appendChild(card);
        });
    }
    renderWeatherList(); // Call initially

    // Compile weather segments
    function compileAllWeatherSegments(totalLaps) {
        const segments = [];
        let currentLap = 1;

        rainSegments.forEach(rain => {
            if (rain.fromLap > currentLap) {
                segments.push({
                    fromLap: currentLap,
                    toLap: rain.fromLap - 1,
                    type: 'dry'
                });
            }
            segments.push({
                fromLap: rain.fromLap,
                toLap: rain.toLap,
                type: rain.type
            });
            currentLap = rain.toLap + 1;
        });

        if (currentLap <= totalLaps) {
            segments.push({
                fromLap: currentLap,
                toLap: totalLaps,
                type: 'dry'
            });
        }

        return segments;
    }

    // Console logging helper
    function clearConsole() {
        consoleLines.innerHTML = "";
    }

    function writeConsoleLine(text, type = "info") {
        const line = document.createElement("div");
        line.className = `console-line ${type}`;
        line.innerText = `> ${text}`;
        consoleLines.appendChild(line);
        consoleLines.scrollTop = consoleLines.scrollHeight;
    }

    // Format total time
    function formatTotalTime(seconds) {
        if (seconds === Infinity || isNaN(seconds)) return "DNF / Invalid";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = (seconds % 60).toFixed(3);
        
        let output = "";
        if (h > 0) output += `${h}h `;
        if (m > 0 || h > 0) output += `${m}m `;
        output += `${s}s`;
        return output;
    }

    // Format lap times
    function formatLapTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "--:--.---";
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(3);
        const paddedS = s < 10 ? `0${s}` : s;
        return m > 0 ? `${m}:${paddedS}` : `${s}s`;
    }

    // Run AI Optimization with telemetry animation
    btnCalculate.addEventListener("click", () => {
        const track = trackSelect.value;
        const driverStyle = driverStyleSelect.value;
        const startLap = parseInt(startLapInput.value);
        const initialTyre = initialTyreSelect.value;
        const initialWear = parseInt(initialWearRange.value) / 100;
        
        const trackInfo = F1Simulation.TRACKS[track];
        const driverInfo = F1Simulation.DRIVER_STYLES[driverStyle];

        // Start lap validation
        if (startLap < 1 || startLap > trackInfo.totalLaps) {
            alert(`Current lap must be within range 1 to ${trackInfo.totalLaps}.`);
            return;
        }

        clearConsole();
        resultsPanel.style.display = "none";
        visualizationPanel.style.display = "none";
        btnCalculate.disabled = true;

        const compiledWeather = compileAllWeatherSegments(trackInfo.totalLaps);
        const hasRain = rainSegments.length > 0;

        const logSteps = [
            { text: `Initializing track telemetry: ${trackInfo.name} (${trackInfo.totalLaps} Laps)...`, type: "info", delay: 0 },
            { text: `Loading driver profile: ${driverInfo.name}. Tyre wear multiplier: ${driverInfo.wearFactor}x.`, type: "info", delay: 200 },
            { text: `Detecting weather forecast... ${hasRain ? 'Dynamic rain detected on track!' : 'Track is expected to remain dry.'}`, type: hasRain ? "warn" : "info", delay: 450 },
            { text: `Running AI Optimization Engine (Dynamic Programming & Pruning)...`, type: "info", delay: 700 }
        ];

        logSteps.forEach(step => {
            setTimeout(() => {
                writeConsoleLine(step.text, step.type);
            }, step.delay);
        });

        // Run calculation after logs
        setTimeout(() => {
            const t0 = performance.now();
            optimizationResult = F1Simulation.optimizeStrategy(
                track,
                trackInfo.totalLaps,
                startLap,
                initialTyre,
                initialWear,
                driverStyle,
                compiledWeather
            );
            const t1 = performance.now();
            const calculationTimeMs = (t1 - t0).toFixed(1);

            if (optimizationResult.error) {
                writeConsoleLine(`OPTIMIZATION ERROR: ${optimizationResult.error}`, "highlight");
                btnCalculate.disabled = false;
                return;
            }

            const best = optimizationResult.bestStrategy;
            
            writeConsoleLine(`Evaluating ${optimizationResult.evaluatedCount} viable pit-stop combinations in ${calculationTimeMs}ms.`, "info");
            writeConsoleLine("Verifying F1 tyre regulations (Dry compound diversity & pit stop requirement)...", "info");
            
            setTimeout(() => {
                writeConsoleLine("REGULATIONS VERIFIED. Simulating lap-by-lap profiles and degradation...", "success");
                
                setTimeout(() => {
                    const pitLaps = best.pitStops.map(p => `Lap ${p.lap} (${p.tyre})`).join(", ") || "No Pit (1-Stint)";
                    writeConsoleLine(`OPTIMAL STRATEGY FOUND: ${best.totalStops} Pit Stop(s) [${pitLaps}]`, "success");
                    writeConsoleLine(`Estimated Race Time: ${formatTotalTime(best.totalTime)}`, "highlight");
                    
                    resultsPanel.style.display = "block";
                    visualizationPanel.style.display = "block";
                    btnCalculate.disabled = false;
                    
                    selectedStrategyIndex = -1;
                    renderResults();
                    
                }, 400);
            }, 300);

        }, 1100);
    });

    // Helper to generate visual stint bar elements
    function createStintTimelineHTML(pitStops, startLap, totalLaps, initialTyre) {
        const timeline = document.createElement("div");
        timeline.className = "compare-timeline-mini";

        const pitLaps = pitStops.map(p => p.lap);
        const stintTyres = [initialTyre, ...pitStops.map(p => p.tyre)];
        const totalSimLaps = totalLaps - startLap + 1;
        let lastLap = startLap - 1;

        for (let i = 0; i < stintTyres.length; i++) {
            const nextPitLap = pitLaps[i] || totalLaps;
            const stintLength = nextPitLap - lastLap;
            if (stintLength <= 0) continue;

            const widthPercent = (stintLength / totalSimLaps) * 100;
            const tyreType = stintTyres[i];

            const bar = document.createElement("div");
            bar.className = `compare-bar tyre-${tyreType}`;
            bar.style.width = `${widthPercent}%`;
            bar.innerText = stintLength > 3 ? `${tyreType}` : "";
            bar.title = `${F1Simulation.TYRES[tyreType].name} (${stintLength} Laps)`;

            timeline.appendChild(bar);
            lastLap = nextPitLap;
        }

        return timeline;
    }

    // 5. Render results to DOM
    function renderResults() {
        const track = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[track];
        const startLap = parseInt(startLapInput.value);
        const initialTyre = initialTyreSelect.value;
        
        let activeStrategy = null;
        let strategyName = "AI Recommendation (Fastest)";
        
        if (selectedStrategyIndex === -1) {
            activeStrategy = optimizationResult.bestStrategy;
            strategyName = "AI Recommendation (Fastest)";
        } else {
            activeStrategy = optimizationResult.alternatives[selectedStrategyIndex];
            strategyName = activeStrategy.name;
        }

        // Display main stats
        metricTotalTime.innerText = formatTotalTime(activeStrategy.totalTime);
        metricStops.innerText = `${activeStrategy.totalStops} Stop${activeStrategy.totalStops !== 1 ? 's' : ''}`;
        
        const sumLaps = activeStrategy.lapTimes.reduce((a, b) => a + b, 0);
        const avgTime = sumLaps / activeStrategy.lapTimes.length;
        metricAvgLap.innerText = formatLapTime(avgTime);

        // Update Lap Labels
        labelStartLap.innerText = `Lap ${startLap}`;
        labelEndLap.innerText = `Lap ${trackInfo.totalLaps}`;

        // Render Stint Timeline
        stintTimeline.innerHTML = "";
        
        const pitLaps = activeStrategy.pitStops.map(p => p.lap);
        const stintTyres = [initialTyre, ...activeStrategy.pitStops.map(p => p.tyre)];
        
        const totalSimLaps = trackInfo.totalLaps - startLap + 1;
        let lastLap = startLap - 1;

        for (let i = 0; i < stintTyres.length; i++) {
            const nextPitLap = pitLaps[i] || trackInfo.totalLaps;
            const stintLength = nextPitLap - lastLap;
            
            if (stintLength <= 0) continue;

            const widthPercent = (stintLength / totalSimLaps) * 100;
            const tyreType = stintTyres[i];
            
            const bar = document.createElement("div");
            bar.className = `stint-bar tyre-${tyreType}`;
            bar.style.width = `${widthPercent}%`;
            bar.innerText = `${tyreType} (${stintLength}L)`;
            bar.title = `Stint ${i+1}: ${F1Simulation.TYRES[tyreType].name} Tyre (${stintLength} Laps, L${lastLap+1} - L${nextPitLap})`;
            
            stintTimeline.appendChild(bar);
            lastLap = nextPitLap;
        }

        // --- Render Side-by-Side Visual Compare ---
        compareListContainer.innerHTML = "";
        compareTimelinesSection.style.display = "block";

        // Row 1: AI Best Strategy
        const rowBest = document.createElement("div");
        rowBest.className = "compare-row";
        rowBest.innerHTML = `<div class="compare-name">AI Rec (Fastest) <span>${formatTotalTime(optimizationResult.bestStrategy.totalTime)}</span></div>`;
        const bestTimelineMini = createStintTimelineHTML(optimizationResult.bestStrategy.pitStops, startLap, trackInfo.totalLaps, initialTyre);
        rowBest.appendChild(bestTimelineMini);
        compareListContainer.appendChild(rowBest);

        // Rows for Alternatives
        optimizationResult.alternatives.forEach((alt) => {
            const rowAlt = document.createElement("div");
            rowAlt.className = "compare-row";
            rowAlt.innerHTML = `<div class="compare-name">${alt.name} <span>${formatTotalTime(alt.totalTime)}</span></div>`;
            const altTimelineMini = createStintTimelineHTML(alt.pitStops, startLap, trackInfo.totalLaps, initialTyre);
            rowAlt.appendChild(altTimelineMini);
            compareListContainer.appendChild(rowAlt);
        });

        // Render Alternatives Grid Cards
        alternativesGrid.innerHTML = "";
        
        // AI Recommendation card
        const bestCard = document.createElement("div");
        bestCard.className = `alt-card ${selectedStrategyIndex === -1 ? 'selected' : ''}`;
        bestCard.addEventListener("click", () => {
            selectedStrategyIndex = -1;
            renderResults();
            writeConsoleLine("Displaying data: AI Recommendation (Fastest)", "info");
        });

        const bestSequence = [initialTyre, ...optimizationResult.bestStrategy.pitStops.map(p => p.tyre)];
        let bestTyreBadgesHtml = bestSequence.map(t => `<span class="alt-tyre-badge tyre-${t}">${t}</span>`).join("");
        
        bestCard.innerHTML = `
            <div class="alt-header">
                <span class="alt-name">AI Recommendation (Fastest)</span>
                <span class="alt-time-diff fastest">BASE</span>
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: bold; margin: 5px 0;">
                ${formatTotalTime(optimizationResult.bestStrategy.totalTime)}
            </div>
            <div class="alt-sequence">
                ${bestTyreBadgesHtml}
            </div>
        `;
        alternativesGrid.appendChild(bestCard);

        // Alternatives cards
        optimizationResult.alternatives.forEach((alt, idx) => {
            const card = document.createElement("div");
            card.className = `alt-card ${selectedStrategyIndex === idx ? 'selected' : ''}`;
            card.addEventListener("click", () => {
                selectedStrategyIndex = idx;
                renderResults();
                writeConsoleLine(`Displaying data: ${alt.name}`, "info");
            });

            const diff = alt.totalTime - optimizationResult.bestStrategy.totalTime;
            const diffText = diff <= 0 ? "Fastest" : `+${diff.toFixed(2)}s`;
            const diffClass = diff <= 0 ? "fastest" : "";

            const seq = [initialTyre, ...alt.pitStops.map(p => p.tyre)];
            const badgesHtml = seq.map(t => `<span class="alt-tyre-badge tyre-${t}">${t}</span>`).join("");

            card.innerHTML = `
                <div class="alt-header">
                    <span class="alt-name">${alt.name}</span>
                    <span class="alt-time-diff ${diffClass}">${diffText}</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: bold; margin: 5px 0;">
                    ${formatTotalTime(alt.totalTime)}
                </div>
                <div class="alt-sequence">
                    ${badgesHtml}
                </div>
            `;
            alternativesGrid.appendChild(card);
        });

        renderLapTable(activeStrategy);
        renderChart();
    }

    // Render detailed lap table
    function renderLapTable(strategy) {
        lapsTableBody.innerHTML = "";
        
        const startLap = parseInt(startLapInput.value);
        const initialTyre = initialTyreSelect.value;
        
        const pitLaps = strategy.pitStops.map(p => p.lap);
        const pitTyres = strategy.pitStops.map(p => p.tyre);
        
        let currentTyre = initialTyre;

        for (let i = 0; i < strategy.lapTimes.length; i++) {
            const lapNum = startLap + i;
            const lapTimeVal = strategy.lapTimes[i];
            const wearVal = strategy.wearProgression[i];
            const wetnessVal = (optimizationResult.wetnessHistory[i] * 100).toFixed(0);

            let note = "-";
            const pitMapIndex = pitLaps.indexOf(lapNum);
            
            if (pitMapIndex !== -1) {
                currentTyre = pitTyres[pitMapIndex];
                note = `🔧 PIT STOP: Fitted new ${F1Simulation.TYRES[currentTyre].name} tyres.`;
            } else if (i === 0) {
                note = "🚦 Start of Simulation Stint";
            }
            
            const curWetness = optimizationResult.wetnessHistory[i];
            const prevWetness = i > 0 ? optimizationResult.wetnessHistory[i-1] : curWetness;
            if (curWetness > 0.15 && prevWetness <= 0.15) {
                note = "🌧️ Track surface damp / Rain starts";
            } else if (curWetness <= 0.15 && prevWetness > 0.15) {
                note = "☀️ Track surface drying / Rain ends";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="lap-num">Lap ${lapNum}</td>
                <td>
                    <span class="tyre-dot ${currentTyre}"></span>
                    ${F1Simulation.TYRES[currentTyre].name}
                </td>
                <td style="font-family: var(--font-mono);">${formatLapTime(lapTimeVal)}</td>
                <td style="font-family: var(--font-mono);">${wearVal}%</td>
                <td style="font-family: var(--font-mono);">${wetnessVal}%</td>
                <td style="font-size: 0.8rem; color: ${note.includes('🔧') ? 'var(--accent-blue)' : (note.includes('🌧️') ? '#39b54a' : 'var(--text-secondary)')};">${note}</td>
            `;
            lapsTableBody.appendChild(tr);
        }
    }

    // Toggle Table visibility
    btnToggleTable.addEventListener("click", () => {
        if (tableContainer.style.display === "none") {
            tableContainer.style.display = "block";
            btnToggleTable.innerText = "Hide Detailed Table";
        } else {
            tableContainer.style.display = "none";
            btnToggleTable.innerText = "Show Detailed Table";
        }
    });

    // 6. Chart.js Drawing with premium gradients & glows
    function renderChart() {
        const ctxElement = document.getElementById("strategyChart");
        const ctx = ctxElement.getContext("2d");
        const track = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[track];
        const startLap = parseInt(startLapInput.value);
        const totalSimLaps = trackInfo.totalLaps - startLap + 1;
        
        const labels = Array.from({ length: totalSimLaps }, (_, i) => `L${startLap + i}`);

        if (myChart) {
            myChart.destroy();
        }

        let datasets = [];

        // Creating glowing gradients for line fills
        const redGradient = ctx.createLinearGradient(0, 0, 0, 350);
        redGradient.addColorStop(0, "rgba(225, 6, 0, 0.28)");
        redGradient.addColorStop(1, "rgba(225, 6, 0, 0.0)");

        const yellowGradient = ctx.createLinearGradient(0, 0, 0, 350);
        yellowGradient.addColorStop(0, "rgba(255, 209, 41, 0.22)");
        yellowGradient.addColorStop(1, "rgba(255, 209, 41, 0.0)");

        const blueGradient = ctx.createLinearGradient(0, 0, 0, 350);
        blueGradient.addColorStop(0, "rgba(0, 162, 232, 0.25)");
        blueGradient.addColorStop(1, "rgba(0, 162, 232, 0.0)");

        if (activeChartType === 'laptime') {
            datasets.push({
                label: "AI Best Strategy",
                data: optimizationResult.bestStrategy.lapTimes,
                borderColor: "rgba(225, 6, 0, 1)",
                backgroundColor: redGradient,
                fill: true,
                borderWidth: 3,
                tension: 0.15,
                pointRadius: (context) => {
                    const index = context.dataIndex;
                    const lapNum = startLap + index;
                    const isPit = optimizationResult.bestStrategy.pitStops.some(p => p.lap === lapNum);
                    return isPit ? 7 : 1;
                },
                pointBackgroundColor: "rgba(225, 6, 0, 1)"
            });

            optimizationResult.alternatives.forEach((alt, idx) => {
                const colors = [
                    "rgba(0, 240, 255, 0.8)", // Neon blue
                    "rgba(57, 181, 74, 0.8)"  // Neon green
                ];
                datasets.push({
                    label: alt.name,
                    data: alt.lapTimes,
                    borderColor: colors[idx] || "rgba(255, 255, 255, 0.5)",
                    borderWidth: 2,
                    tension: 0.15,
                    borderDash: [4, 4],
                    pointRadius: (context) => {
                        const index = context.dataIndex;
                        const lapNum = startLap + index;
                        const isPit = alt.pitStops.some(p => p.lap === lapNum);
                        return isPit ? 5 : 0;
                    },
                    pointBackgroundColor: colors[idx]
                });
            });

        } else if (activeChartType === 'wear') {
            let targetStrategy = selectedStrategyIndex === -1 
                ? optimizationResult.bestStrategy 
                : optimizationResult.alternatives[selectedStrategyIndex];

            datasets.push({
                label: `Tyre Wear (% Wear) - ${selectedStrategyIndex === -1 ? 'AI Recommendation' : 'Alternative'}`,
                data: targetStrategy.wearProgression,
                borderColor: "rgba(255, 209, 41, 1)",
                backgroundColor: yellowGradient,
                fill: true,
                borderWidth: 3,
                tension: 0.1,
                pointRadius: 1
            });

        } else if (activeChartType === 'wetness') {
            datasets.push({
                label: "Track Wetness (%)",
                data: optimizationResult.wetnessHistory.map(w => (w * 100).toFixed(0)),
                borderColor: "rgba(0, 162, 232, 1)",
                backgroundColor: blueGradient,
                fill: true,
                borderWidth: 3,
                tension: 0.2,
                pointRadius: 0
            });
        }

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#8e94a5",
                        font: {
                            family: "Outfit",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "#12141c",
                    titleColor: "#fff",
                    bodyColor: "#00f0ff",
                    borderColor: "rgba(255, 255, 255, 0.07)",
                    borderWidth: 1,
                    titleFont: { family: "Outfit", weight: "bold" },
                    bodyFont: { family: "JetBrains Mono" },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (activeChartType === 'laptime') {
                                label += formatLapTime(context.raw);
                            } else {
                                label += context.raw + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255,255,255,0.03)"
                    },
                    ticks: {
                        color: "#8e94a5",
                        font: { family: "Outfit" },
                        maxTicksLimit: 15
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255,255,255,0.03)"
                    },
                    ticks: {
                        color: "#8e94a5",
                        font: { family: "Outfit" }
                    },
                    title: {
                        display: true,
                        text: activeChartType === 'laptime' ? "Lap Time (Seconds)" : (activeChartType === 'wear' ? "Tyre Wear (%)" : "Track Wetness (%)"),
                        color: "#8e94a5",
                        font: { family: "Outfit", size: 12, weight: "bold" }
                    }
                }
            }
        };

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: chartOptions
        });
    }

    // Hook chart toggle buttons
    const chartToggleButtons = document.querySelectorAll(".btn-chart-toggle");
    chartToggleButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            chartToggleButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeChartType = e.target.getAttribute("data-chart-type");
            renderChart();
        });
    });

});
