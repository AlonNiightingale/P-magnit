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
            MAX_FORCE: 1000
        },
        STORAGE_KEY: 'em_calculator_state'
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
    let chart;
    function initChart() {
        const isDark = document.body.classList.contains('dark-theme');
        const electromagnetColor = isDark ? '#ffcc00' : '#0d6efd';
        const springColor = '#dc3545';
        
        if (chart) {
            chart.destroy();
        }
        
        chart = new Chart(dom.chartCanvas, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Электромагнитное усилие',
                        borderColor: electromagnetColor,
                        backgroundColor: 'transparent',
                        tension: 0.2,
                        fill: false,
                        data: [],
                        borderWidth: 2,
                        pointRadius: 0,
                        class: 'electromagnet-line'
                    },
                    {
                        label: 'Усилие пружины',
                        borderColor: springColor,
                        backgroundColor: 'transparent',
                        tension: 0.2,
                        fill: false,
                        data: [],
                        borderWidth: 2,
                        pointRadius: 0,
                        class: 'spring-line'
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
                            color: isDark ? '#ffffff' : '#6c757d'
                        },
                        reverse: true,
                        min: 0,
                        ticks: {
                            color: isDark ? '#ffffff' : '#6c757d',
                            stepSize: 1
                        },
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Усилие (Н)',
                            color: isDark ? '#ffffff' : '#6c757d'
                        },
                        min: 0,
                        max: CONFIG.CHART_CONFIG.MAX_FORCE,
                        ticks: {
                            color: isDark ? '#ffffff' : '#6c757d',
                            stepSize: 100
                        },
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: isDark ? '#ffffff' : '#212529',
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
    }

    // Инициализация темы
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        dom.themeSwitcher.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        initChart(); // Инициализируем график с правильными цветами
    }

    // Переключение темы
    dom.themeSwitcher.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        dom.themeSwitcher.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        initChart(); // Пересоздаём график с новыми цветами
        updateUI(); // Обновляем данные
    });

    // Усовершенствованный расчет электромагнитной силы
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

    // Сохранение состояния
    function saveState() {
        const state = {};
        Object.keys(dom.inputs).forEach(key => {
            state[key] = dom.inputs[key].value;
        });
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    }

    // Загрузка состояния
    function loadState() {
        const savedState = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
        if (savedState) {
            Object.keys(dom.inputs).forEach(key => {
                if (savedState[key] !== undefined) {
                    dom.inputs[key].value = savedState[key];
                }
            });
        }
    }

    // Основная функция обновления интерфейса
    function updateUI() {
        // Сохраняем состояние перед обновлением
        saveState();
        
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
                initialSpringForce: params.initialSpringForce,
                springStiffness: params.springStiffness,
                compressionMM
            });
            
            // Добавление точек
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
        if (chart) {
            chart.data.datasets[0].data = magneticData;
            chart.data.datasets[1].data = springData;
            chart.update();
        }

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
        loadState();
        setupEventListeners();
        updateUI();
    }

    // Запуск приложения
    initApp();
});