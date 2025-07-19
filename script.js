document.addEventListener('DOMContentLoaded', function() {
    // Конфигурация приложения
    const CONFIG = {
        PHYSICS: {
            MU_0: 4 * Math.PI * 1e-7, // Магнитная постоянная (Гн/м)
        },
        CONVERSION: {
            MM_TO_M: 1e-3,
            MM2_TO_M2: 1e-6,
        },
        CHART_CONFIG: {
            GRAPH_POINTS: 100,
            MAX_FORCE: 1000 // Максимальное усилие для отображения
        }
    };

    // Получение элементов DOM
    const dom = {
        themeSwitcher: document.getElementById('theme-switcher'),
        inputs: {
            turns: document.getElementById('turns'),
            poleArea: document.getElementById('poleArea'),
            coreLength: document.getElementById('coreLength'),
            corePermeability: document.getElementById('corePermeability'),
            current: document.getElementById('current'),
            maxAirGap: document.getElementById('maxAirGap'),
            initialSpringForce: document.getElementById('initialSpringForce'),
            springStiffness: document.getElementById('springStiffness')
        },
        displays: {
            currentValue: document.getElementById('currentValue'),
            maxAirGapValue: document.getElementById('maxAirGapValue')
        },
        outputs: {
            tripPoint: document.getElementById('trip-point-result'),
            finalDecision: document.getElementById('final-decision')
        },
        chartCanvas: document.getElementById('force-gap-chart')
    };

    // Инициализация графика
    const chart = new Chart(dom.chartCanvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Электромагнитное усилие',
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.2,
                    fill: false,
                    data: []
                },
                {
                    label: 'Усилие пружины',
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.2,
                    fill: false,
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Воздушный зазор (мм)',
                        color: 'var(--text-secondary)'
                    },
                    reverse: true, // Разворот оси X - зазор уменьшается слева направо
                    min: 0,
                    ticks: {
                        color: 'var(--text-secondary)',
                        stepSize: 1
                    },
                    grid: {
                        color: 'var(--border-color)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Усилие (Н)',
                        color: 'var(--text-secondary)'
                    },
                    min: 0,
                    max: CONFIG.CHART_CONFIG.MAX_FORCE,
                    ticks: {
                        color: 'var(--text-secondary)',
                        stepSize: 100
                    },
                    grid: {
                        color: 'var(--border-color)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--text-primary)',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} Н @ ${context.parsed.x.toFixed(2)} мм`;
                        }
                    }
                }
            }
        }
    });

    // Инициализация темы
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        dom.themeSwitcher.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        updateChartColors();
    }

    // Обновление цветов графика для текущей темы
    function updateChartColors() {
        const isDark = document.body.classList.contains('dark-theme');
        chart.data.datasets[0].borderColor = isDark ? '#4dabf7' : '#0d6efd';
        chart.data.datasets[1].borderColor = isDark ? '#ff6b6b' : '#dc3545';
        chart.update();
    }

    // Переключение темы
    dom.themeSwitcher.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        dom.themeSwitcher.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateChartColors();
    });

    // Усовершенствованный расчет электромагнитной силы с учетом сердечника
    function calculateMagneticForce(params) {
        const { turns, poleAreaM2, coreLengthM, corePermeability, current, airGapM } = params;
        
        // Расчет магнитодвижущей силы (МДС)
        const mmf = turns * current;
        
        // Расчет магнитного сопротивления воздушного зазора
        const reluctanceGap = airGapM / (CONFIG.PHYSICS.MU_0 * poleAreaM2);
        
        // Расчет магнитного сопротивления сердечника
        const reluctanceCore = coreLengthM / (CONFIG.PHYSICS.MU_0 * corePermeability * poleAreaM2);
        
        // Общее магнитное сопротивление
        const totalReluctance = reluctanceGap + reluctanceCore;
        
        // Магнитный поток
        const magneticFlux = mmf / totalReluctance;
        
        // Магнитная индукция
        const fluxDensity = magneticFlux / poleAreaM2;
        
        // Электромагнитное усилие (формула Максвелла)
        return (Math.pow(fluxDensity, 2) * poleAreaM2) / (2 * CONFIG.PHYSICS.MU_0);
    }

    // Расчет усилия пружины
    function calculateSpringForce(params) {
        const { initialSpringForce, springStiffness, compressionMM } = params;
        return initialSpringForce + springStiffness * compressionMM;
    }

    // Основная функция обновления интерфейса
    function updateUI() {
        // Обновление отображаемых значений
        dom.displays.currentValue.textContent = dom.inputs.current.value + ' А';
        dom.displays.maxAirGapValue.textContent = dom.inputs.maxAirGap.value + ' мм';
        
        // Сбор параметров
        const params = {
            turns: parseInt(dom.inputs.turns.value) || 1,
            poleAreaM2: (parseFloat(dom.inputs.poleArea.value) || 100) * CONFIG.CONVERSION.MM2_TO_M2,
            coreLengthM: (parseFloat(dom.inputs.coreLength.value) || 50) * CONFIG.CONVERSION.MM_TO_M,
            corePermeability: parseFloat(dom.inputs.corePermeability.value) || 2000,
            current: parseFloat(dom.inputs.current.value) || 2500,
            maxAirGap: parseFloat(dom.inputs.maxAirGap.value) || 5,
            initialSpringForce: parseFloat(dom.inputs.initialSpringForce.value) || 10,
            springStiffness: parseFloat(dom.inputs.springStiffness.value) || 8
        };

        // Подготовка данных для графика
        const magneticData = [];
        const springData = [];
        let tripPoint = null;

        const points = CONFIG.CHART_CONFIG.GRAPH_POINTS;
        const minGap = 0.1; // минимальный зазор 0.1 мм
        const maxGap = params.maxAirGap;
        
        // Создаем точки от максимального зазора к минимальному
        for (let i = 0; i <= points; i++) {
            // Рассчитываем текущий зазор (от max к min)
            const gapMM = maxGap - (maxGap - minGap) * (i / points);
            
            // Сжатие пружины (разница между максимальным и текущим зазором)
            const compressionMM = maxGap - gapMM;
            
            // Расчет сил
            const F_magnetic = calculateMagneticForce({
                ...params,
                airGapM: gapMM * CONFIG.CONVERSION.MM_TO_M
            });
            
            const F_spring = calculateSpringForce({
                ...params,
                compressionMM
            });
            
            // Добавление точек с ограничением по MAX_FORCE
            magneticData.push({
                x: gapMM,
                y: Math.min(F_magnetic, CONFIG.CHART_CONFIG.MAX_FORCE)
            });
            
            springData.push({
                x: gapMM,
                y: Math.min(F_spring, CONFIG.CHART_CONFIG.MAX_FORCE)
            });
            
            // Поиск точки пересечения графиков
            if (tripPoint === null && F_magnetic >= F_spring) {
                tripPoint = {
                    gap: gapMM.toFixed(2),
                    force: F_magnetic.toFixed(1)
                };
            }
        }

        // Обновление графика
        chart.data.datasets[0].data = magneticData;
        chart.data.datasets[1].data = springData;
        chart.update();

        // Обновление результатов анализа
        if (tripPoint) {
            dom.outputs.tripPoint.textContent = `${tripPoint.force} Н @ ${tripPoint.gap} мм`;
            dom.outputs.finalDecision.textContent = 'Сработает';
            dom.outputs.finalDecision.className = 'trip';
        } else {
            dom.outputs.tripPoint.textContent = 'Нет пересечения';
            dom.outputs.finalDecision.textContent = 'Не сработает';
            dom.outputs.finalDecision.className = 'no-trip';
        }
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        Object.values(dom.inputs).forEach(input => {
            input.addEventListener('input', updateUI);
        });
    }

    // Инициализация приложения
    function initApp() {
        initTheme();
        setupEventListeners();
        updateUI();
    }

    // Запуск приложения
    initApp();
});