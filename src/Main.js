const fs = require('fs');
const readline = require('readline');
const bcrypt = require('bcrypt');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const saltRounds = 10;
let accounts = [];
let failedAttempts = {};

function loadAccounts() {
    if (fs.existsSync('accounts.json')) {
        const data = fs.readFileSync('accounts.json', 'utf8');
        accounts = JSON.parse(data);
    }
}

function saveAccounts() {
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 4));
}

function logAction(user, action) {
    const logEntry = `${new Date().toISOString()} | ${user.username} | ${action}\n`;
    fs.appendFileSync('logs.txt', logEntry);
}

function registerAccount() {
    rl.question('Введите логин: ', (username) => {
        if (accounts.some(acc => acc.username === username)) {
            console.log('❌ Ошибка: этот логин уже занят!');
            mainMenu();
            return;
        }

        rl.question('Введите пароль: ', async (password) => {
            if (password.length < 6) {
                console.log('⚠️ Пароль должен быть не менее 6 символов!');
                mainMenu();
                return;
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            accounts.push({ username, password: hashedPassword, role: 'user', banned: false });
            saveAccounts();
            console.log('✅ Аккаунт успешно создан!');
            mainMenu();
        });
    });
}

function login() {
    rl.question('Введите логин: ', (username) => {
        if (failedAttempts[username] >= 3) {
            console.log('🚫 Слишком много неудачных попыток! Попробуйте позже.');
            mainMenu();
            return;
        }

        rl.question('Введите пароль: ', async (password) => {
            const user = accounts.find(acc => acc.username === username);
            if (!user) {
                console.log('❌ Ошибка: пользователь не найден!');
                mainMenu();
                return;
            }
            if (user.banned) {
                console.log('🚫 Ваш аккаунт заблокирован!');
                mainMenu();
                return;
            }

            if (await bcrypt.compare(password, user.password)) {
                console.log('✅ Вход выполнен!');
                failedAttempts[username] = 0;
                logAction(user, 'Вход в систему');
                commandLoop(user);
            } else {
                failedAttempts[username] = (failedAttempts[username] || 0) + 1;
                console.log(`❌ Ошибка: неверный пароль! (${failedAttempts[username]}/3)`);
                mainMenu();
            }
        });
    });
}

function banUser() {
    rl.question('Введите логин пользователя для блокировки: ', (username) => {
        const user = accounts.find(acc => acc.username === username);
        if (user) {
            user.banned = true;
            saveAccounts();
            console.log(`🚫 Пользователь ${username} заблокирован!`);
            logAction(user, 'Бан аккаунта');
        } else {
            console.log('❌ Ошибка: пользователь не найден.');
        }
        mainMenu();
    });
}

function setPermission() {
    rl.question('Введите логин пользователя: ', (username) => {
        rl.question('Введите новую роль (user/admin): ', (newRole) => {
            const user = accounts.find(acc => acc.username === username);
            if (user && (newRole === 'user' || newRole === 'admin')) {
                user.role = newRole;
                saveAccounts();
                console.log('✅ Роль пользователя обновлена!');
            } else {
                console.log('❌ Ошибка: неверный логин или роль.');
            }
            commandLoop();
        });
    });
}

async function changePassword(user) {
    const oldPassword = await askQuestion("🔐 Введите старый пароль: ");
    if (!await bcrypt.compare(oldPassword, user.password)) {
        console.log("❌ Ошибка: старый пароль неверный!");
        return;
    }

    const newPassword = await askQuestion("🔑 Введите новый пароль: ");
    if (newPassword.length < 6) {
        console.log("⚠️ Пароль должен быть не менее 6 символов!");
        return;
    }

    if (await bcrypt.compare(newPassword, user.password)) {
        console.log("⚠️ Новый пароль не должен совпадать со старым!");
        return;
    }

    const confirmPassword = await askQuestion("🔑 Повторите новый пароль: ");
    if (newPassword !== confirmPassword) {
        console.log("❌ Ошибка: пароли не совпадают!");
        return;
    }

    user.password = await bcrypt.hash(newPassword, saltRounds);
    saveAccounts();
    console.log("✅ Пароль успешно изменён!");
    logAction(user, 'Смена пароля');
    mainMenu();
}

function showAccounts() {
    console.log('📜 Список всех пользователей:');
    accounts.forEach(acc => console.log(`👤 Логин: ${acc.username} | Роль: ${acc.role}`));
}

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function commandLoop(user) {
    rl.question('\n💻 Введите команду (help для списка): ', (command) => {
        switch (command) {
            case 'help':
                console.log('📜 Доступные команды:');
                console.log('🔹 whoami — ваш логин и роль');
                console.log('🔹 banuser — заблокировать пользователя (admin)');
                console.log('🔹 exit — выйти из аккаунта');
                console.log('🔹 changepass — сменить пароль');
                console.log('🔹 showusers — показать всех пользователей (admin)')
                console.log('🔹 setperm — изменить роль пользователя (admin)')
                break;
            case 'whoami':
                console.log(`👤 Логин: ${user.username} | Роль: ${user.role} ${user.banned ? '🚫 (ЗАБАНЕН)' : ''}`);
                break;
            case 'banuser':
                if (user.role === 'admin') banUser();
                else console.log('❌ Недостаточно прав!');
                break;
            case 'changepass':
                changePassword(user);
                break;
            case 'exit':
                mainMenu();
                break;
            case 'showusers':
                if (user.role === 'admin') showAccounts();
                else console.log('❌ Недостаточно прав!');
                break;
            case 'setperm':
                if (user.role === 'admin') setPermission();
                else console.log('❌ Недостаточно прав!');
                break;
            default:
                console.log('❌ Неизвестная команда!');
        }
        commandLoop(user);
    });
}

function mainMenu() {
    console.log('\n🔹 Добро пожаловать в систему аккаунтов!');
    console.log('Выберите действие: login / register / exit');
    rl.question('> ', (choice) => {
        if (choice === 'login') login();
        else if (choice === 'register') registerAccount();
        else if (choice === 'exit') {
            console.log('👋 Выход из программы...');
            process.exit(0);
        } else {
            console.log('❌ Неизвестная команда!');
            mainMenu();
        }
    });
}

loadAccounts();
mainMenu();
