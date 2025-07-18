// Константы
const μ0 = 4 * Math.PI * 1e-7; // Магнитная постоянная (Гн/м)
const DENSITY_COPPER = 8960; // Плотность меди (кг/м³)
const RESISTIVITY_COPPER = 1.68e-8; // Удельное сопротивление меди (Ом·м)
let pChart = null;
let vChart = null;

// Инициализация при загрузке
window.onload = function() {
    // Настройка переключения типов пружин
    document.getElementById('spring_type').addEventListener('change', function() {
        document.getElementById('rotational_params').style.display = 
            this.value === 'rotational' ? 'block' : 'none';
        document.getElementById('linear_params').style.display = 
            this.value === 'linear' ? 'block' : 'none';
    });

    document.getElementById('valve_spring_type').addEventListener('change', function() {
        document.getElementById('valve_linear_params').style.display = 
            this.value === 'linear' ? 'block' : 'none';
    });

    // Первоначальный расчёт
    calculateP();
    openTab('tab1');
};

// Функции для работы с вкладками
function openTab(tabId) {
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    document.getElementById(tabId).classList.add('active');
    
    // Обновить активные кнопки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
}

// Расчёт для П-образного электромагнита
function calculateP() {
    // Считываем входные параметры и преобразуем в СИ
    const delta0 = parseFloat(document.getElementById('delta0').value) / 1000; // м
    const L_arm = parseFloat(document.getElementById('L_arm').value) / 1000; // м
    const S_eff = parseFloat(document.getElementById('S_eff').value) / 1e6; // м²
    const N = parseFloat(document.getElementById('N').value);
    const alpha_start_deg = parseFloat(document.getElementById('alpha_start').value);
    const I_threshold = parseFloat(document.getElementById('I_threshold_input').value);
    
    // Переводим угол в радианы
    const alpha_start_rad = alpha_start_deg * Math.PI / 180;
    
    // Расчёт параметров магнитной цепи
    const delta_start = delta0 + L_arm * Math.sin(alpha_start_rad);
    const mmf = I_threshold * N; // МДС
    
    // Магнитная индукция в зазоре
    const B_gap = (μ0 * mmf) / (2 * delta_start);
    
    // Магнитная сила
    const F_mag = (Math.pow(B_gap, 2) * S_eff) / (2 * μ0);
    
    // Магнитный поток
    const Phi = B_gap * S_eff;
    
    // Магнитный момент
    const M_mag = F_mag * L_arm;
    
    // Расчёт противодействия в зависимости от типа
    const springType = document.getElementById('spring_type').value;
    let M_spring = 0;
    let springParams = [];
    
    if (springType === 'rotational') {
        const F_spring_end = parseFloat(document.getElementById('F_spring_end').value);
        const L_spring_end = parseFloat(document.getElementById('L_spring_end').value) / 1000; // м
        const k_spring_angular = parseFloat(document.getElementById('k_spring_angular').value) * (Math.PI/180); // Н·м/рад
        M_spring = F_spring_end * L_spring_end + k_spring_angular * alpha_start_rad;
        springParams = [F_spring_end, L_spring_end, k_spring_angular];
    } 
    else if (springType === 'linear') {
        const linear_spring_force = parseFloat(document.getElementById('linear_spring_force').value);
        const linear_spring_rate = parseFloat(document.getElementById('linear_spring_rate').value) * 1000; // Н/м
        const spring_attach_point = parseFloat(document.getElementById('spring_attach_point').value) / 1000; // м
        const F_spring = linear_spring_force + linear_spring_rate * (L_arm * Math.sin(alpha_start_rad));
        M_spring = F_spring * spring_attach_point;
        springParams = [linear_spring_force, linear_spring_rate, spring_attach_point];
    }
    
    // Коэффициент запаса
    const safety_factor = M_mag / M_spring;
    
    // Выводим результаты
    document.getElementById('mmf').textContent = mmf.toFixed(1) + ' А·вит';
    document.getElementById('F_mag').textContent = F_mag.toFixed(2) + ' Н';
    document.getElementById('B_gap').textContent = B_gap.toFixed(3) + ' Тл';
    document.getElementById('M_mag').textContent = (M_mag * 1000).toFixed(1) + ' Н·мм';
    document.getElementById('M_spring').textContent = (M_spring * 1000).toFixed(1) + ' Н·мм';
    document.getElementById('safety_factor').textContent = safety_factor.toFixed(2);
    
    // Расчёт времени срабатывания
    calculatePResponseTime(alpha_start_rad, M_mag, M_spring);
    
    // Строим графики
    buildMomentChart(alpha_start_rad, M_spring, springType, springParams, I_threshold, 
                    delta0, L_arm, μ0, N, S_eff);
}

// Расчёт времени срабатывания для П-образного
function calculatePResponseTime(angle, M_mag, M_spring) {
    const moment_inertia = parseFloat(document.getElementById('moment_inertia').value) / 1e6; // кг·м²
    const voltage = parseFloat(document.getElementById('voltage').value);
    const wire_diameter = parseFloat(document.getElementById('wire_diameter').value) / 1000; // м
    
    // Оценочное сопротивление катушки
    const N = parseFloat(document.getElementById('N').value);
    const mean_length = 0.1; // Средняя длина витка (м)
    const wire_area = Math.PI * Math.pow(wire_diameter/2, 2);
    const resistance = (RESISTIVITY_COPPER * N * mean_length) / wire_area;
    
    // Электрическая постоянная времени
    const L = 0.1; // Оценочная индуктивность (Гн)
    const tau_e = L / resistance;
    
    // Механическая постоянная времени
    const torque = M_mag - M_spring;
    const angular_accel = torque / moment_inertia;
    const t_mech = Math.sqrt(2 * angle / angular_accel);
    const t_total = Math.sqrt(Math.pow(tau_e, 2) + Math.pow(t_mech, 2)) * 1000; // мс
    
    document.getElementById('response_time').textContent = t_total.toFixed(2) + ' мс';
    document.getElementById('angular_accel').textContent = angular_accel.toFixed(2) + ' рад/с²';
}

// Построение графиков для П-образного магнита
function buildMomentChart(alpha_start_rad, M_spring, springType, springParams, I_threshold, 
                         delta0, L_arm, μ0, N, S_eff) {
    const showSpring = document.getElementById('showSpringChart').checked;
    
    // Подготовка данных
    const angles = [];
    const M_spring_arr = [];
    const M_mag_arr = [];
    
    const steps = 30;
    const angle_step = alpha_start_rad / steps;
    
    for (let i = 0; i <= steps; i++) {
        const alpha = i * angle_step;
        const angle_deg = alpha * 180 / Math.PI;
        angles.push(angle_deg.toFixed(1));
        
        // Магнитный момент
        const delta = delta0 + L_arm * Math.sin(alpha);
        const M_mag_val = (μ0 * Math.pow(N, 2) * Math.pow(I_threshold, 2) * S_eff * L_arm) / 
                          (4 * Math.pow(delta, 2));
        M_mag_arr.push(M_mag_val * 1000); // в Н·мм
        
        // Противодействующий момент
        let springMoment = 0;
        
        if (springType === 'rotational') {
            const [F_spring_end, L_spring_end, k_spring_angular] = springParams;
            springMoment = F_spring_end * (L_spring_end/1000) + 
                           k_spring_angular * (alpha_start_rad - alpha);
        } 
        else if (springType === 'linear') {
            const [linear_spring_force, linear_spring_rate, spring_attach_point] = springParams;
            const springDeflection = L_arm * Math.sin(alpha_start_rad) - L_arm * Math.sin(alpha);
            const F_spring = linear_spring_force + linear_spring_rate * springDeflection;
            springMoment = F_spring * spring_attach_point;
        }
        
        M_spring_arr.push(springMoment * 1000); // в Н·мм
    }
    
    // Создаем или обновляем график
    const ctx = document.getElementById('momentChart').getContext('2d');
    
    if (pChart) {
        pChart.destroy();
    }
    
    const datasets = [{
        label: 'Магнитный момент',
        data: M_mag_arr,
        borderColor: 'rgba(220, 53, 69, 1)',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.1
    }];
    
    if (showSpring && springType !== 'none') {
        datasets.push({
            label: 'Противодействующий момент',
            data: M_spring_arr,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1
        });
    }
    
    pChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: angles,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Момент (Н·мм)'
                    },
                    beginAtZero: true
                },
                x: {
                    title: {
                        display: true,
                        text: 'Угол поворота якоря (°)'
                    },
                    reverse: true
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Н·мм`;
                        }
                    }
                }
            }
        }
    });
}

// Расчёт для клапанного электромагнита (1 виток)
function calculateValve() {
    const gap = parseFloat(document.getElementById('valve_gap').value) / 1000; // м
    const area = parseFloat(document.getElementById('valve_area').value) / 1e6; // м²
    const current = parseFloat(document.getElementById('valve_current').value);
    const mass = parseFloat(document.getElementById('valve_mass').value) / 1000; // кг
    
    // Расчёт магнитных параметров (N = 1)
    const mmf = current * 1; // МДС (1 виток)
    const B = (μ0 * mmf) / (2 * gap); // Индукция для двух зазоров
    const F_mag = (Math.pow(B, 2) * area) / (2 * μ0); // Сила притяжения
    const flux = B * area;
    
    // Расчёт противодействия
    const springType = document.getElementById('valve_spring_type').value;
    let F_spring = 0;
    let springRate = 0;
    
    if (springType === 'linear') {
        F_spring = parseFloat(document.getElementById('valve_spring_force').value);
        springRate = parseFloat(document.getElementById('valve_spring_rate').value) * 1000; // Н/м
    }
    
    // Ускорение якоря
    const accel = (F_mag - F_spring) / mass;
    
    // Коэффициент запаса
    const safety_factor = F_mag / F_spring;
    
    // Выводим результаты
    document.getElementById('valve_mmf').textContent = mmf.toFixed(1) + ' А·вит';
    document.getElementById('valve_force').textContent = F_mag.toFixed(2) + ' Н';
    document.getElementById('valve_B').textContent = B.toFixed(3) + ' Тл';
    document.getElementById('valve_spring').textContent = F_spring.toFixed(2) + ' Н';
    document.getElementById('valve_accel').textContent = accel.toFixed(2) + ' м/с²';
    document.getElementById('valve_safety').textContent = safety_factor.toFixed(2);
    
    // Расчёт времени срабатывания
    calculateValveTime(F_mag, F_spring, mass);
    
    // Строим графики
    buildValveChart(gap, F_mag, F_spring, springRate);
}

// Расчёт времени срабатывания для клапанного
function calculateValveTime(F_mag, F_spring, mass) {
    const voltage = parseFloat(document.getElementById('valve_voltage').value);
    const resistance = parseFloat(document.getElementById('valve_resistance').value) / 1000; // Ом
    const stroke = parseFloat(document.getElementById('valve_stroke').value) / 1000; // м
    
    // Оценочная индуктивность (N=1)
    const area = parseFloat(document.getElementById('valve_area').value) / 1e6; // м²
    const gap = parseFloat(document.getElementById('valve_gap').value) / 1000; // м
    const L = (μ0 * Math.pow(1, 2) * area) / (2 * gap); // Индуктивность
    
    // Электрическая постоянная времени
    const tau_e = L / resistance;
    
    // Механическое время
    const accel = (F_mag - F_spring) / mass;
    const t_mech = Math.sqrt(2 * stroke / accel);
    
    // Общее время
    const t_total = Math.sqrt(Math.pow(tau_e, 2) + Math.pow(t_mech, 2)) * 1000; // мс
    
    // Скорость в момент удара
    const impact_velocity = Math.sqrt(2 * accel * stroke);
    
    document.getElementById('valve_time').textContent = t_total.toFixed(2) + ' мс';
    document.getElementById('impact_velocity').textContent = impact_velocity.toFixed(2) + ' м/с';
}

// Построение графиков для клапанного магнита
function buildValveChart(max_gap, F_mag, F_spring, springRate) {
    const showSpring = document.getElementById('showValveSpring').checked;
    
    // Подготовка данных
    const gaps = [];
    const F_mag_arr = [];
    const F_spring_arr = [];
    
    const steps = 20;
    const gap_step = max_gap / steps;
    const stroke = parseFloat(document.getElementById('valve_stroke').value) / 1000; // м
    
    for (let i = 0; i <= steps; i++) {
        const gap = i * gap_step;
        gaps.push((gap * 1000).toFixed(1));
        
        // Магнитная сила (N=1)
        const current = parseFloat(document.getElementById('valve_current').value);
        const mmf = current * 1;
        const B = (μ0 * mmf) / (2 * gap);
        const F_mag_val = (Math.pow(B, 2) * (parseFloat(document.getElementById('valve_area').value)/1e6)) / (2 * μ0);
        F_mag_arr.push(F_mag_val);
        
        // Сила пружины
        const springDeflection = max_gap - gap;
        const F_spring_val = F_spring + springRate * springDeflection;
        F_spring_arr.push(F_spring_val);
    }
    
    // Создаем или обновляем график
    const ctx = document.getElementById('valveChart').getContext('2d');
    
    if (vChart) {
        vChart.destroy();
    }
    
    const datasets = [{
        label: 'Магнитная сила',
        data: F_mag_arr,
        borderColor: 'rgba(220, 53, 69, 1)',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.1
    }];
    
    if (showSpring && F_spring > 0) {
        datasets.push({
            label: 'Противодействующая сила',
            data: F_spring_arr,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1
        });
    }
    
    vChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: gaps,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Сила (Н)'
                    },
                    beginAtZero: true
                },
                x: {
                    title: {
                        display: true,
                        text: 'Зазор (мм)'
                    },
                    reverse: true
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Н`;
                        }
                    }
                }
            }
        }
    });
}