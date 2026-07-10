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

    // 1. Inisialisasi Tampilan Sirkuit awal
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

        // Jalankan pembersihan segmen hujan yang melebihi lap sirkuit
        rainSegments = rainSegments.filter(seg => seg.fromLap <= trackInfo.totalLaps);
        rainSegments.forEach(seg => {
            if (seg.toLap > trackInfo.totalLaps) seg.toLap = trackInfo.totalLaps;
        });
        renderWeatherList();
    }
    
    trackSelect.addEventListener("change", updateTrackArt);
    updateTrackArt(); // Initial call

    // Update wear text slider
    initialWearRange.addEventListener("input", (e) => {
        wearValueText.innerText = `${e.target.value}%`;
    });

    // 2. Weather Modal Actions
    btnAddWeather.addEventListener("click", () => {
        const currentTrack = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[currentTrack];
        
        // Set default values based on current input
        weatherStartLap.max = trackInfo.totalLaps;
        weatherEndLap.max = trackInfo.totalLaps;
        
        // Open modal
        weatherModal.style.display = "flex";
    });

    modalClose.addEventListener("click", () => {
        weatherModal.style.display = "none";
    });

    // Close modal if user clicks outside content
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

        // Validasi input
        if (isNaN(fromLap) || isNaN(toLap) || fromLap < 1 || toLap < 1) {
            alert("Nomor lap harus berupa angka positif.");
            return;
        }
        if (fromLap > trackInfo.totalLaps || toLap > trackInfo.totalLaps) {
            alert(`Sirkuit ${trackInfo.name} hanya memiliki ${trackInfo.totalLaps} lap.`);
            return;
        }
        if (fromLap > toLap) {
            alert("Lap Mulai tidak boleh lebih besar dari Lap Selesai.");
            return;
        }

        // Periksa apakah ada overlap dengan segmen hujan yang sudah ada
        const isOverlap = rainSegments.some(seg => {
            return (fromLap <= seg.toLap && toLap >= seg.fromLap);
        });

        if (isOverlap) {
            alert("Lap hujan yang baru tumpang tindih (overlap) dengan jadwal hujan yang sudah ada.");
            return;
        }

        // Tambahkan segmen baru
        rainSegments.push({
            id: Date.now(),
            fromLap,
            toLap,
            type
        });

        // Urutkan segmen
        rainSegments.sort((a, b) => a.fromLap - b.fromLap);

        // Reset & Close
        weatherModal.style.display = "none";
        renderWeatherList();
        writeConsoleLine(`Prakiraan Cuaca Diperbarui: Hujan (${type === 'light_rain' ? 'Ringan' : 'Lebat'}) pada Lap ${fromLap}-${toLap}`, "warn");
    });

    // Hapus weather segment
    window.deleteWeatherSegment = function(id) {
        rainSegments = rainSegments.filter(seg => seg.id !== id);
        renderWeatherList();
        writeConsoleLine("Segmen cuaca dihapus dari jadwal.", "info");
    };

    // Render weather list in DOM
    function renderWeatherList() {
        weatherListContainer.innerHTML = "";
        
        if (rainSegments.length === 0) {
            weatherListContainer.innerHTML = `
                <div class="weather-card" style="color: var(--text-muted); justify-content: center; border-style: dashed;">
                    Trek kering sepanjang balapan (Dry Race)
                </div>
            `;
            return;
        }

        rainSegments.forEach(seg => {
            const typeLabel = seg.type === 'light_rain' ? 'Hujan Ringan (Inter)' : 'Hujan Lebat (Wet)';
            const typeClass = seg.type;
            
            const card = document.createElement("div");
            card.className = "weather-card";
            card.innerHTML = `
                <div class="weather-info">
                    <span class="weather-type-badge badge-${typeClass}">${seg.type === 'light_rain' ? 'Inter' : 'Wet'}</span>
                    <span class="weather-laps">Lap ${seg.fromLap} - ${seg.toLap}</span>
                </div>
                <button type="button" class="btn-delete" onclick="deleteWeatherSegment(${seg.id})">&times;</button>
            `;
            weatherListContainer.appendChild(card);
        });
    }
    renderWeatherList(); // Call initially

    // 3. Compile weather segments (menggabungkan area dry + rain)
    function compileAllWeatherSegments(totalLaps) {
        const segments = [];
        let currentLap = 1;

        // rainSegments sudah diurutkan berdasarkan fromLap
        rainSegments.forEach(rain => {
            // Jika ada celah sebelum hujan, tandai sebagai kering (dry)
            if (rain.fromLap > currentLap) {
                segments.push({
                    fromLap: currentLap,
                    toLap: rain.fromLap - 1,
                    type: 'dry'
                });
            }
            // Tambahkan segmen hujan
            segments.push({
                fromLap: rain.fromLap,
                toLap: rain.toLap,
                type: rain.type
            });
            currentLap = rain.toLap + 1;
        });

        // Jika masih ada lap sisa sampai akhir balapan, tandai kering
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

    // Format waktu balapan
    function formatTotalTime(seconds) {
        if (seconds === Infinity || isNaN(seconds)) return "DNF / Tidak Valid";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = (seconds % 60).toFixed(3);
        
        let output = "";
        if (h > 0) output += `${h}j `;
        if (m > 0 || h > 0) output += `${m}m `;
        output += `${s}d`;
        return output;
    }

    // Format waktu lap
    function formatLapTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "--:--.---";
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(3);
        const paddedS = s < 10 ? `0${s}` : s;
        return m > 0 ? `${m}:${paddedS}` : `${s}s`;
    }

    // 4. Run AI Optimization & Simulasikan logs telemetry
    btnCalculate.addEventListener("click", () => {
        const track = trackSelect.value;
        const driverStyle = driverStyleSelect.value;
        const startLap = parseInt(startLapInput.value);
        const initialTyre = initialTyreSelect.value;
        const initialWear = parseInt(initialWearRange.value) / 100;
        
        const trackInfo = F1Simulation.TRACKS[track];
        const driverInfo = F1Simulation.DRIVER_STYLES[driverStyle];

        // Validasi starting lap
        if (startLap < 1 || startLap > trackInfo.totalLaps) {
            alert(`Lap saat ini harus berada di rentang 1 s/d ${trackInfo.totalLaps}.`);
            return;
        }

        clearConsole();
        resultsPanel.style.display = "none";
        visualizationPanel.style.display = "none";
        btnCalculate.disabled = true;

        // Dapatkan data cuaca penuh
        const compiledWeather = compileAllWeatherSegments(trackInfo.totalLaps);
        const hasRain = rainSegments.length > 0;

        // Rangkaian log animasi simulasi AI
        const logSteps = [
            { text: `Menginisialisasi telemetri sirkuit: ${trackInfo.name} (${trackInfo.totalLaps} Lap)...`, type: "info", delay: 0 },
            { text: `Membaca profil driver: ${driverInfo.name}. Memuat faktor keausan ban: ${driverInfo.wearFactor}x.`, type: "info", delay: 200 },
            { text: `Mendeteksi prakiraan cuaca... ${hasRain ? 'Ditemukan anomali hujan dinamis pada trek!' : 'Trek diperkirakan tetap kering sepenuhnya.'}`, type: hasRain ? "warn" : "info", delay: 450 },
            { text: `Menjalankan algoritma Optimasi AI (Dynamic Programming & Pruning)...`, type: "info", delay: 700 }
        ];

        logSteps.forEach(step => {
            setTimeout(() => {
                writeConsoleLine(step.text, step.type);
            }, step.delay);
        });

        // Run calculation setelah log awal selesai
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
                writeConsoleLine(`KESALAHAN OPTIMASI: ${optimizationResult.error}`, "highlight");
                btnCalculate.disabled = false;
                return;
            }

            const best = optimizationResult.bestStrategy;
            
            writeConsoleLine(`Mengevaluasi ${optimizationResult.evaluatedCount} opsi strategi dalam ${calculationTimeMs}ms.`, "info");
            writeConsoleLine("Memverifikasi regulasi ban F1 (Dry compound diversity & pit requirement check)...", "info");
            
            setTimeout(() => {
                writeConsoleLine("REGULASI TERVERIFIKASI. Menghitung profil lap time dan degradasi...", "success");
                
                setTimeout(() => {
                    const pitLaps = best.pitStops.map(p => `Lap ${p.lap} (${p.tyre})`).join(", ") || "Tanpa Pit (1-Stint)";
                    writeConsoleLine(`STRATEGI OPTIMAL DITEMUKAN: ${best.totalStops} Pit Stop [${pitLaps}]`, "success");
                    writeConsoleLine(`Estimasi Waktu Balapan: ${formatTotalTime(best.totalTime)}`, "highlight");
                    
                    // Tampilkan UI Hasil
                    resultsPanel.style.display = "block";
                    visualizationPanel.style.display = "block";
                    btnCalculate.disabled = false;
                    
                    // Set default selected strategy to Best (-1)
                    selectedStrategyIndex = -1;
                    
                    // Render UI Data
                    renderResults();
                    
                }, 400);
            }, 300);

        }, 1100);
    });

    // 5. Render Hasil ke DOM
    function renderResults() {
        const track = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[track];
        const startLap = parseInt(startLapInput.value);
        
        // Ambil strategi aktif (Best atau salah satu Alternatif)
        let activeStrategy = null;
        let strategyName = "Best Strategy (AI)";
        
        if (selectedStrategyIndex === -1) {
            activeStrategy = optimizationResult.bestStrategy;
            strategyName = "Rekomendasi AI (Tercepat)";
        } else {
            activeStrategy = optimizationResult.alternatives[selectedStrategyIndex];
            strategyName = activeStrategy.name;
        }

        // Tampilkan metrik utama
        metricTotalTime.innerText = formatTotalTime(activeStrategy.totalTime);
        metricStops.innerText = `${activeStrategy.totalStops} Stop${activeStrategy.totalStops !== 1 ? 's' : ''}`;
        
        // Hitung rata-rata lap time
        const sumLaps = activeStrategy.lapTimes.reduce((a, b) => a + b, 0);
        const avgTime = sumLaps / activeStrategy.lapTimes.length;
        metricAvgLap.innerText = formatLapTime(avgTime);

        // Update Lap Labels
        labelStartLap.innerText = `Lap ${startLap}`;
        labelEndLap.innerText = `Lap ${trackInfo.totalLaps}`;

        // Render Stint Timeline
        stintTimeline.innerHTML = "";
        
        // Tentukan titik-titik pembagian stint
        const pitLaps = activeStrategy.pitStops.map(p => p.lap);
        const stintTyres = [initialTyreSelect.value, ...activeStrategy.pitStops.map(p => p.tyre)];
        
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
            bar.title = `Stint ${i+1}: Ban ${F1Simulation.TYRES[tyreType].name} (${stintLength} Lap, L${lastLap+1} - L${nextPitLap})`;
            
            stintTimeline.appendChild(bar);
            lastLap = nextPitLap;
        }

        // Render Alternatives Grid
        alternativesGrid.innerHTML = "";
        
        // Buat tombol/kartu untuk Best Strategy sendiri terlebih dahulu
        const bestCard = document.createElement("div");
        bestCard.className = `alt-card ${selectedStrategyIndex === -1 ? 'selected' : ''}`;
        bestCard.addEventListener("click", () => {
            selectedStrategyIndex = -1;
            renderResults();
            writeConsoleLine("Menampilkan data: Rekomendasi AI (Tercepat)", "info");
        });

        // Sequence of tyres
        const bestSequence = [initialTyreSelect.value, ...optimizationResult.bestStrategy.pitStops.map(p => p.tyre)];
        let bestTyreBadgesHtml = bestSequence.map(t => `<span class="alt-tyre-badge tyre-${t}">${t}</span>`).join("");
        
        bestCard.innerHTML = `
            <div class="alt-header">
                <span class="alt-name">Rekomendasi AI (Tercepat)</span>
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

        // Alternatif lainnya
        optimizationResult.alternatives.forEach((alt, idx) => {
            const card = document.createElement("div");
            card.className = `alt-card ${selectedStrategyIndex === idx ? 'selected' : ''}`;
            card.addEventListener("click", () => {
                selectedStrategyIndex = idx;
                renderResults();
                writeConsoleLine(`Menampilkan data: ${alt.name}`, "info");
            });

            const diff = alt.totalTime - optimizationResult.bestStrategy.totalTime;
            const diffText = diff <= 0 ? "Fastest" : `+${diff.toFixed(2)}d`;
            const diffClass = diff <= 0 ? "fastest" : "";

            const seq = [initialTyreSelect.value, ...alt.pitStops.map(p => p.tyre)];
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

        // Render detailed breakdown table
        renderLapTable(activeStrategy);

        // Render Chart
        renderChart();
    }

    // Render Table Body
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

            // Cek pit note
            let note = "-";
            const pitMapIndex = pitLaps.indexOf(lapNum);
            
            if (pitMapIndex !== -1) {
                currentTyre = pitTyres[pitMapIndex];
                note = `🔧 PIT STOP: Pasang ban ${F1Simulation.TYRES[currentTyre].name} baru.`;
            } else if (i === 0) {
                note = "🚦 Awal Simulasi Stint";
            }
            
            // Catatan cuaca jika wetness mendadak naik
            const curWetness = optimizationResult.wetnessHistory[i];
            const prevWetness = i > 0 ? optimizationResult.wetnessHistory[i-1] : curWetness;
            if (curWetness > 0.15 && prevWetness <= 0.15) {
                note = "🌧️ Lintasan mulai Basah / Hujan";
            } else if (curWetness <= 0.15 && prevWetness > 0.15) {
                note = "☀️ Lintasan mulai Mengering";
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

    // 6. Chart.js Drawing
    function renderChart() {
        const ctx = document.getElementById("strategyChart").getContext("2d");
        const track = trackSelect.value;
        const trackInfo = F1Simulation.TRACKS[track];
        const startLap = parseInt(startLapInput.value);
        const totalSimLaps = trackInfo.totalLaps - startLap + 1;
        
        // Buat labels untuk sumbu X (Lap)
        const labels = Array.from({ length: totalSimLaps }, (_, i) => `L${startLap + i}`);

        // Bersihkan chart lama jika ada
        if (myChart) {
            myChart.destroy();
        }

        // Tentukan data berdasarkan tipe chart aktif
        let datasets = [];

        if (activeChartType === 'laptime') {
            // Gambar lap times dari Best Strategy + Alternatives
            datasets.push({
                label: "AI Best Strategy",
                data: optimizationResult.bestStrategy.lapTimes,
                borderColor: "rgba(225, 6, 0, 1)",
                backgroundColor: "rgba(225, 6, 0, 0.05)",
                borderWidth: 3,
                tension: 0.1,
                pointRadius: (context) => {
                    // Beri titik tebal pada lap pit stop
                    const index = context.dataIndex;
                    const lapNum = startLap + index;
                    const isPit = optimizationResult.bestStrategy.pitStops.some(p => p.lap === lapNum);
                    return isPit ? 6 : 1;
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
                    tension: 0.1,
                    borderDash: [5, 5],
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
            // Tampilkan degradasi keausan ban dari strategi terpilih
            let targetStrategy = selectedStrategyIndex === -1 
                ? optimizationResult.bestStrategy 
                : optimizationResult.alternatives[selectedStrategyIndex];

            datasets.push({
                label: `Degradasi Ban (% Wear) - ${selectedStrategyIndex === -1 ? 'Rekomendasi AI' : 'Alternatif'}`,
                data: targetStrategy.wearProgression,
                borderColor: "rgba(255, 209, 41, 1)", // Kuning medium
                backgroundColor: "rgba(255, 209, 41, 0.1)",
                fill: true,
                borderWidth: 3,
                tension: 0.1,
                pointRadius: 1
            });

        } else if (activeChartType === 'wetness') {
            // Tampilkan kebasahan trek (wetness)
            datasets.push({
                label: "Tingkat Kebasahan Trek (Wetness %)",
                data: optimizationResult.wetnessHistory.map(w => (w * 100).toFixed(0)),
                borderColor: "rgba(0, 162, 232, 1)", // Biru wet
                backgroundColor: "rgba(0, 162, 232, 0.1)",
                fill: true,
                borderWidth: 3,
                tension: 0.2,
                pointRadius: 0
            });
        }

        // Options Chart kustom bertema F1
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "var(--text-secondary)",
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
                    borderColor: "var(--border-color)",
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
                        color: "var(--text-secondary)",
                        font: { family: "Outfit" },
                        maxTicksLimit: 15
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255,255,255,0.03)"
                    },
                    ticks: {
                        color: "var(--text-secondary)",
                        font: { family: "Outfit" }
                    },
                    title: {
                        display: true,
                        text: activeChartType === 'laptime' ? "Lap Time (Detik)" : (activeChartType === 'wear' ? "Keausan Ban (%)" : "Kebasahan Trek (%)"),
                        color: "var(--text-secondary)",
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
