const plans = {
    month: {
        name: '1 МЕСЯЦ',
        amount: 129,
        period: 'за 30 дней',
        tag: '',
        days: 30,
        features: ['Все функции клиента', 'Обход античитов', 'Бесплатные обновления']
    },
    year: {
        name: '90 ДНЕЙ',
        amount: 169,
        period: 'за 90 дней',
        tag: 'популярный',
        days: 90,
        features: ['Всё из тарифа «1 месяц»', 'Приоритетная поддержка', 'Ранний доступ к функциям', 'Эксклюзивные темы']
    },
    lifetime: {
        name: 'НАВСЕГДА',
        amount: 229,
        period: 'Lifetime · навсегда',
        tag: 'LIFETIME',
        days: 36500,
        features: ['Всё из тарифа «1 год»', 'Бессрочный доступ', 'Все будущие обновления', 'Приоритет во всём']
    },
    beta: {
        name: 'BETA',
        amount: 349,
        period: 'Премиум-доступ',
        tag: 'BETA',
        days: 36500,
        features: ['Всё из тарифа «Навсегда»', 'Доступ к бета-версиям', 'Личная поддержка', 'Эксклюзивные функции раннего доступа']
    }
};

// Ключи для каждого тарифа
const licenseKeys = {
    'MOSER-MONTH-XXXX-0001': 'month',
    'MOSER-MONTH-XXXX-0002': 'month',
    'MOSER-MONTH-XXXX-0003': 'month',
    'MOSER-MONTH-XXXX-0004': 'month',
    'MOSER-MONTH-XXXX-0005': 'month',
    'MOSER-YEAR-XXXX-0001': 'year',
    'MOSER-YEAR-XXXX-0002': 'year',
    'MOSER-YEAR-XXXX-0003': 'year',
    'MOSER-YEAR-XXXX-0004': 'year',
    'MOSER-YEAR-XXXX-0005': 'year',
    'MOSER-LIFE-XXXX-0001': 'lifetime',
    'MOSER-LIFE-XXXX-0002': 'lifetime',
    'MOSER-LIFE-XXXX-0003': 'lifetime',
    'MOSER-BETA-XXXX-0001': 'beta',
    'MOSER-BETA-XXXX-0002': 'beta',
    'MOSER-BETA-XXXX-0003': 'beta'
};

let currentUser = null;

function getUsers() {
    return JSON.parse(localStorage.getItem('moser_users') || '{}');
}

function saveUsers(users) {
    localStorage.setItem('moser_users', JSON.stringify(users));
}

function getActivatedKeys() {
    return JSON.parse(localStorage.getItem('moser_activated_keys') || '[]');
}

function generateHwid() {
    var hex = '0123456789abcdef';
    var hwid = '';
    for (var i = 0; i < 32; i++) {
        hwid += hex.charAt(Math.floor(Math.random() * 16));
    }
    return hwid;
}

function generateUid() {
    return Math.floor(100000 + Math.random() * 900000);
}

function formatRegDate() {
    var d = new Date();
    var months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ' г. в ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

function saveActivatedKeys(keys) {
    localStorage.setItem('moser_activated_keys', JSON.stringify(keys));
}

function showAuth() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard(user) {
    currentUser = user;
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userEmail').textContent = user.email;

    var avatarEl = document.getElementById('userAvatar');
    if (user.avatar) {
        avatarEl.innerHTML = '<img src="' + user.avatar + '" alt="Avatar">';
    } else {
        avatarEl.textContent = user.username.charAt(0).toUpperCase();
        var img = avatarEl.querySelector('img');
        if (img) img.remove();
    }

    // Fill details
    document.getElementById('detailUid').textContent = user.uid || '—';
    document.getElementById('detailRole').textContent = user.role || 'Пользователь';
    document.getElementById('detailLogin').textContent = user.username;
    document.getElementById('detailEmail').textContent = user.email;
    document.getElementById('detailDate').textContent = user.regDate || '—';
    document.getElementById('detailHwid').textContent = user.hwid || generateHwid();

    if (!user.hwid) {
        var users = getUsers();
        users[user.email].hwid = generateHwid();
        saveUsers(users);
        currentUser = users[user.email];
        document.getElementById('detailHwid').textContent = currentUser.hwid;
    }

    updateStatus(user);
}

function updateStatus(user) {
    const statusCard = document.getElementById('statusCard');
    if (user.plan && user.planExpiry) {
        const now = Date.now();
        if (user.planExpiry > now || user.plan === 'lifetime') {
            const plan = plans[user.plan];
            const expiry = user.plan === 'lifetime' ? 'Бессрочно' : 'До ' + new Date(user.planExpiry).toLocaleDateString('ru-RU');
            statusCard.className = 'dashboard-status active';
            statusCard.innerHTML = `
                <div class="status-icon">✓</div>
                <div>
                    <h3>Подписка активна — ${plan.name}</h3>
                    <p>${expiry}</p>
                </div>
            `;
            return;
        }
    }
    statusCard.className = 'dashboard-status';
    statusCard.innerHTML = `
        <div class="status-icon">⏳</div>
        <div>
            <h3>Нет активной подписки</h3>
            <p>Введи ключ или купи подписку ниже</p>
        </div>
    `;
}

function switchToRegister() {
    document.getElementById('authTitle').textContent = 'Регистрация';
    document.getElementById('authSubtitle').textContent = 'Создай аккаунт для Moser Client';
    document.getElementById('authBtn').textContent = 'Зарегистрироваться';
    document.getElementById('usernameField').style.display = 'block';
    document.getElementById('authSwitchText').textContent = 'Уже есть аккаунт?';
    document.getElementById('authSwitchLink').textContent = 'Войти';
    document.getElementById('authError').textContent = '';
}

function switchToLogin() {
    document.getElementById('authTitle').textContent = 'Вход в аккаунт';
    document.getElementById('authSubtitle').textContent = 'Добро пожаловать обратно';
    document.getElementById('authBtn').textContent = 'Войти';
    document.getElementById('usernameField').style.display = 'none';
    document.getElementById('authSwitchText').textContent = 'Нет аккаунта?';
    document.getElementById('authSwitchLink').textContent = 'Зарегистрироваться';
    document.getElementById('authError').textContent = '';
}

// Auth
let isLogin = true;

document.getElementById('authSwitchLink').addEventListener('click', function(e) {
    e.preventDefault();
    isLogin = !isLogin;
    if (isLogin) {
        switchToLogin();
    } else {
        switchToRegister();
    }
});

document.getElementById('authForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const loginInput = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    const users = getUsers();

    if (!loginInput || !password) {
        errorEl.textContent = 'Заполни все поля';
        return;
    }

    if (isLogin) {
        let foundUser = null;
        let foundEmail = null;

        if (users[loginInput]) {
            foundUser = users[loginInput];
            foundEmail = loginInput;
        } else {
            for (const email in users) {
                if (users[email].username === loginInput) {
                    foundUser = users[email];
                    foundEmail = email;
                    break;
                }
            }
        }

        if (!foundUser) {
            errorEl.textContent = 'Аккаунт не найден';
            return;
        }
        if (foundUser.password !== password) {
            errorEl.textContent = 'Неверный пароль';
            return;
        }
        if (!foundUser.uid) {
            foundUser.uid = generateUid();
            foundUser.regDate = foundUser.regDate || formatRegDate();
            foundUser.hwid = foundUser.hwid || generateHwid();
            foundUser.role = foundUser.role || 'Пользователь';
            foundUser.avatar = foundUser.avatar || null;
            var users2 = getUsers();
            users2[foundEmail] = foundUser;
            saveUsers(users2);
        }
        showDashboard(foundUser);
    } else {
        const username = document.getElementById('regUsername').value.trim();
        if (!username) {
            errorEl.textContent = 'Придумай логин';
            return;
        }
        if (password.length < 6) {
            errorEl.textContent = 'Пароль минимум 6 символов';
            return;
        }
        if (users[loginInput]) {
            errorEl.textContent = 'Этот email уже зарегистрирован';
            return;
        }
        const user = {
            username: username,
            email: loginInput,
            password: password,
            plan: null,
            planExpiry: null,
            avatar: null,
            uid: generateUid(),
            role: 'Пользователь',
            regDate: formatRegDate(),
            hwid: generateHwid()
        };
        users[loginInput] = user;
        saveUsers(users);
        showDashboard(user);
    }
    errorEl.textContent = '';
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', function() {
    currentUser = null;
    document.getElementById('dashboardSection').style.display = 'none';
    showAuth();
    document.getElementById('authForm').reset();
    switchToLogin();
});

// Activate key
document.getElementById('keyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const key = document.getElementById('licenseKey').value.trim().toUpperCase();
    const resultEl = document.getElementById('keyResult');

    if (!currentUser) {
        resultEl.textContent = 'Сначала войди в аккаунт';
        resultEl.className = 'key-result error';
        return;
    }

    if (!licenseKeys[key]) {
        resultEl.textContent = 'Неверный ключ';
        resultEl.className = 'key-result error';
        return;
    }

    const activatedKeys = getActivatedKeys();
    if (activatedKeys.includes(key)) {
        resultEl.textContent = 'Этот ключ уже был использован';
        resultEl.className = 'key-result error';
        return;
    }

    const planKey = licenseKeys[key];
    const plan = plans[planKey];
    const users = getUsers();

    users[currentUser.email].plan = planKey;
    users[currentUser.email].planExpiry = Date.now() + plan.days * 24 * 60 * 60 * 1000;
    saveUsers(users);

    activatedKeys.push(key);
    saveActivatedKeys(activatedKeys);

    currentUser = users[currentUser.email];
    showDashboard(currentUser);

    resultEl.textContent = 'Ключ активирован! Подписка ' + plan.name + ' — активна';
    resultEl.className = 'key-result success';
    document.getElementById('licenseKey').value = '';
});

// Pricing
document.querySelectorAll('.plan-option').forEach(function(option) {
    option.addEventListener('click', function() {
        document.querySelectorAll('.plan-option').forEach(function(o) {
            o.classList.remove('active');
        });
        this.classList.add('active');
        this.querySelector('input').checked = true;

        const planKey = this.dataset.plan;
        const plan = plans[planKey];

        document.getElementById('detailsBadge').textContent = plan.name;
        document.getElementById('detailsAmount').textContent = plan.amount;
        document.getElementById('detailsPeriod').textContent = plan.period;
        document.getElementById('buyBtn').textContent = 'Купить за ' + plan.amount + ' ₽';

        const tagEl = document.getElementById('detailsTag');
        if (plan.tag) {
            tagEl.textContent = plan.tag;
            tagEl.style.display = 'inline-block';
        } else {
            tagEl.style.display = 'none';
        }

        const listEl = document.getElementById('detailsList');
        listEl.innerHTML = plan.features.map(function(f) {
            return '<li>' + f + '</li>';
        }).join('');
    });
});

// Buy button
document.getElementById('buyBtn').addEventListener('click', function() {
    const activePlan = document.querySelector('.plan-option.active');
    if (!activePlan) return;
    const planKey = activePlan.dataset.plan;

    if (!currentUser) {
        alert('Сначала войди в аккаунт');
        return;
    }

    window.open('https://funpay.com/users/18355333/', '_blank');
});

// HWID
var hwidBtnEl = document.getElementById('hwidBtn');
if (hwidBtnEl) {
    hwidBtnEl.addEventListener('click', function() {
        if (!currentUser) {
            alert('Сначала войди в аккаунт');
            return;
        }
        window.open('https://t.me/shkwww', '_blank');
    });
}

// Avatar upload
document.getElementById('avatarInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file || !currentUser) return;
    if (file.size > 2 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 2 МБ.');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) {
        var dataUrl = ev.target.result;
        var users = getUsers();
        users[currentUser.email].avatar = dataUrl;
        saveUsers(users);
        currentUser = users[currentUser.email];
        var avatarEl = document.getElementById('userAvatar');
        avatarEl.innerHTML = '<img src="' + dataUrl + '" alt="Avatar">';
    };
    reader.readAsDataURL(file);
});

// Sidebar tabs
document.querySelectorAll('.sidebar-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        var tab = this.dataset.tab;
        document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
        this.classList.add('active');
        document.querySelectorAll('.dashboard-tab').forEach(function(t) { t.classList.remove('active'); });
        var target = document.getElementById('tab-' + tab);
        if (target) target.classList.add('active');
    });
});
