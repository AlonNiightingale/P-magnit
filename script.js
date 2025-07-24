// --- Global Chart Instances ---
let forceAirGapChart;
let forceCurrentChart;
let coreTempTimeChart;

// --- Constants ---
const MU_0 = 4 * Math.PI * 1e-7; // Магнитная проницаемость вакуума (Гн/м)
const CP_COPPER = 385;           // Удельная теплоемкость меди (Дж/(кг·К))

// --- Helper function to calculate Force ---
// This function is extracted to be reusable for chart data generation
function calculateForceValue(current_ikz, current_N, current_mu_r, current_l_core, current_l_airGap, current_S) {
    const mu_core = current_mu_r * MU_0;
    const mmf = current_N * current_ikz;
    const reluctance_core = current_l_core / (mu_core * current_S);
    const reluctance_airGap = current_l_airGap / (MU_0 * current_S);
    const total_reluctance = reluctance_core + reluctance_airGap;
    
    // Avoid division by zero if reluctance is extremely small
    if (total_reluctance === 0) return 0;

    const flux = mmf / total_reluctance;
    const induction = flux / current_S;
    const force = (induction * induction * current_S) / (2 * MU_0);
    return force;
}

// --- Main calculation for Force & Chart Updates ---
function calculateForce() {
    // Input data
    const ikz = parseFloat(document.getElementById('ikzInput').value);
    const N = parseFloat(document.getElementById('nInput').value);
    const mu_r = parseFloat(document.getElementById('muInput').value);
    const l_core = parseFloat(document.getElementById('lCoreInput').value);
    const l_airGap = parseFloat(document.getElementById('lAirGapInput').value);
    const S = parseFloat(document.getElementById('sAreaInput').value);

    // Validation
    if (isNaN(ikz) || isNaN(N) || isNaN(mu_r) || isNaN(l_core) || isNaN(l_airGap) || isNaN(S) || ikz <= 0 || N <= 0 || mu_r <= 0 || l_core <= 0 || l_airGap < 0 || S <= 0) {
        alert('Пожалуйста, введите корректные положительные числовые значения для всех параметров.');
        return;
    }

    const mu_core = mu_r * MU_0;
    const mmf = N * ikz;

    const reluctance_core = l_core / (mu_core * S);
    const reluctance_airGap = l_airGap / (MU_0 * S);
    const total_reluctance = reluctance_core + reluctance_airGap;
    
    let flux = 0;
    let induction = 0;
    let force = 0;

    if (total_reluctance !== 0) { // Avoid division by zero
        flux = mmf / total_reluctance;
        induction = flux / S;
        force = (induction * induction * S) / (2 * MU_0);
    }
    

    // Output results
    document.getElementById('outputMmf').textContent = mmf.toFixed(2);
    document.getElementById('outputTotalReluctance').textContent = total_reluctance.toExponential(2);
    document.getElementById('outputFlux').textContent = flux.toExponential(2);
    document.getElementById('outputInduction').textContent = induction.toFixed(3);
    document.getElementById('outputForce').textContent = force.toFixed(2);

    // --- Update Charts ---
    updateForceAirGapChart(ikz, N, mu_r, l_core, S);
    updateForceCurrentChart(N, mu_r, l_core, l_airGap, S);
}

// --- Update Force vs. Air Gap Chart ---
function updateForceAirGapChart(ikz, N, mu_r, l_core, S) {
    const airGapValues = [];
    const forceValues = [];
    const maxAirGap = 0.005; // Max air gap for the plot, e.g., 5 mm
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
        const currentAirGap = (i / steps) * maxAirGap;
        airGapValues.push(currentAirGap * 1000); // Convert to mm for label
        const force = calculateForceValue(ikz, N, mu_r, l_core, currentAirGap, S);
        forceValues.push(force);
    }

    const ctx = document.getElementById('forceAirGapChart').getContext('2d');
    if (forceAirGapChart) {
        forceAirGapChart.destroy(); // Destroy previous chart instance
    }
    forceAirGapChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: airGapValues.map(val => val.toFixed(1)), // Labels in mm
            datasets: [{
                label: 'Сила притяжения (Н)',
                data: forceValues,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Воздушный зазор (мм)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Сила притяжения (Н)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Зазор: ${context[0].label} мм`;
                        },
                        label: function(context) {
                            return `Сила: ${context.parsed.y.toFixed(2)} Н`;
                        }
                    }
                }
            }
        }
    });
}

// --- Update Force vs. Current Chart ---
function updateForceCurrentChart(N, mu_r, l_core, l_airGap, S) {
    const currentValues = [];
    const forceValues = [];
    const maxCurrent = 10000; // Max current for the plot, e.g., 10000 A
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
        const current_ikz = (i / steps) * maxCurrent;
        currentValues.push(current_ikz);
        const force = calculateForceValue(current_ikz, N, mu_r, l_core, l_airGap, S);
        forceValues.push(force);
    }

    const ctx = document.getElementById('forceCurrentChart').getContext('2d');
    if (forceCurrentChart) {
        forceCurrentChart.destroy(); // Destroy previous chart instance
    }
    forceCurrentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: currentValues.map(val => val.toFixed(0)), // Labels in Amps
            datasets: [{
                label: 'Сила притяжения (Н)',
                data: forceValues,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Ток (А)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Сила притяжения (Н)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Ток: ${context[0].label} А`;
                        },
                        label: function(context) {
                            return `Сила: ${context.parsed.y.toFixed(2)} Н`;
                        }
                    }
                }
            }
        }
    });
}


// --- Main calculation for Winding Heat ---
function calculateWindingHeat() {
    // Input data
    const ikz = parseFloat(document.getElementById('ikzHeatInput').value);
    const tkz = parseFloat(document.getElementById('tkzHeatInput').value);
    const windingResistance = parseFloat(document.getElementById('windingResistInput').value);
    const windingMass = parseFloat(document.getElementById('windingMassInput').value);
    const cpCopper = parseFloat(document.getElementById('cpCopperInput').value);

    // Validation
    if (isNaN(ikz) || isNaN(tkz) || isNaN(windingResistance) || isNaN(windingMass) || isNaN(cpCopper) || ikz <= 0 || tkz <= 0 || windingResistance < 0 || windingMass <= 0 || cpCopper <= 0) {
        alert('Пожалуйста, введите корректные положительные числовые значения для всех параметров.');
        return;
    }

    // Calculations
    const heatGenerated = ikz * ikz * windingResistance * tkz;
    const tempIncrease = heatGenerated / (windingMass * cpCopper);

    // Output results
    document.getElementById('outputWindingHeat').textContent = heatGenerated.toFixed(2);
    document.getElementById('outputWindingTemp').textContent = tempIncrease.toFixed(2);
}

// --- Main calculation for Core Heat & Chart Update ---
function calculateCoreHeat() {
    // Input data
    const bMax = parseFloat(document.getElementById('bMaxHeatInput').value);
    const fEff = parseFloat(document.getElementById('fEffInput').value);
    const dEff = parseFloat(document.getElementById('dEffInput').value);
    const rhoSteel = parseFloat(document.getElementById('rhoSteelInput').value);
    const coreVolume = parseFloat(document.getElementById('coreVolumeInput').value);
    const tkz = parseFloat(document.getElementById('tkzCoreHeatInput').value);
    const densitySteel = parseFloat(document.getElementById('densitySteelInput').value);
    const cpSteel = parseFloat(document.getElementById('cpSteelInput').value);

    // Validation
    if (isNaN(bMax) || isNaN(fEff) || isNaN(dEff) || isNaN(rhoSteel) || isNaN(coreVolume) || isNaN(tkz) || isNaN(densitySteel) || isNaN(cpSteel) ||
        bMax <= 0 || fEff <= 0 || dEff <= 0 || rhoSteel <= 0 || coreVolume <= 0 || tkz <= 0 || densitySteel <= 0 || cpSteel <= 0) {
        alert('Пожалуйста, введите корректные положительные числовые значения для всех параметров.');
        return;
    }

    // Calculations (simplified formula for eddy current losses)
    const eddyCurrentPower = (Math.PI * bMax * fEff * dEff) ** 2 * coreVolume / (6 * rhoSteel);

    const heatGenerated = eddyCurrentPower * tkz;
    const coreMass = coreVolume * densitySteel;
    const tempIncrease = heatGenerated / (coreMass * cpSteel);

    // Output results
    document.getElementById('outputEddyPower').textContent = eddyCurrentPower.toFixed(2);
    document.getElementById('outputCoreHeat').textContent = heatGenerated.toFixed(2);
    document.getElementById('outputCoreTemp').textContent = tempIncrease.toFixed(2);

    // Update conceptual Core Temp vs Time Chart
    updateCoreTempTimeChart(eddyCurrentPower, coreMass, cpSteel, tkz);
}

// --- Conceptual Core Temperature vs. Time Chart ---
function updateCoreTempTimeChart(power, mass, cp, actual_tkz) {
    const timeValues = [];
    const tempValues = [];
    const maxTime = actual_tkz * 5; // Plot for 5 times the actual KZ duration
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
        const currentTime = (i / steps) * maxTime;
        timeValues.push(currentTime);
        const currentTempRise = (power * currentTime) / (mass * cp);
        tempValues.push(currentTempRise);
    }

    const ctx = document.getElementById('coreTempTimeChart').getContext('2d');
    if (coreTempTimeChart) {
        coreTempTimeChart.destroy(); // Destroy previous chart instance
    }
    coreTempTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeValues.map(val => val.toFixed(3)),
            datasets: [{
                label: 'Прирост температуры (°C)',
                data: tempValues,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Время (с)'
                    },
                    // Highlight the actual KZ duration
                    afterBuildTicks: function(axis) {
                        const ticks = axis.ticks;
                        ticks.forEach(tick => {
                            if (Math.abs(tick.value - actual_tkz) < (maxTime / steps / 2)) {
                                tick.label = `${tick.label} (время КЗ)`;
                            }
                        });
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Прирост температуры (°C)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Время: ${context[0].label} с`;
                        },
                        label: function(context) {
                            return `Темп. прирост: ${context.parsed.y.toFixed(2)} °C`;
                        }
                    }
                }
            }
        }
    });
}

// --- Initial chart drawing when page loads (optional, but good practice) ---
// You can call calculateForce() and calculateCoreHeat() once on load to populate initial charts
document.addEventListener('DOMContentLoaded', () => {
    calculateForce(); // To initialize the force charts
    calculateCoreHeat(); // To initialize the core heat chart
});