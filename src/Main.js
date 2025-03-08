const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
            output: process.stdout
});

let accounts = [];

function loadAccounts() {
    if (fs.existsSync('accounts.json')) {
        const data = fs.readFileSync('accounts.json', 'utf8');
        accounts = JSON.parse(data);
    }
}

function saveAccounts() {
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 4));
}

function registerAccount() {
    rl.question('Введите логин: ', (username) => {
    if (accounts.some(acc => acc.username === username)) {
        console.log('❌ Ошибка: этот логин уже занят!');
        mainMenu();
        return;
    }

    rl.question('Введите пароль: ', (password) => {
            accounts.push({ username, password, role: 'user' });
    saveAccounts();
    console.log('✅ Аккаунт успешно создан!');
    mainMenu();
        });
    });
}

function login() {
    rl.question('Введите логин: ', (username) => {
            rl.question('Введите пароль: ', (password) => {
            const user = accounts.find(acc => acc.username === username && acc.password === password);
    if (user) {
        console.log('✅ Вход выполнен!');
        commandLoop(user);
    } else {
        console.log('❌ Ошибка: неверный логин или пароль!');
        mainMenu();
    }
        });
    });
}

function showAccounts() {
    console.log('📜 Список всех пользователей:');
    accounts.forEach(acc => console.log(`👤 Логин: ${acc.username} | Роль: ${acc.role}`));
}

function deleteUser() {
    rl.question('Введите логин пользователя для удаления: ', (username) => {
            accounts = accounts.filter(acc => acc.username !== username);
    saveAccounts();
    console.log('✅ Пользователь удалён.');
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
    mainMenu();
        });
    });
}

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function changePassword(user) {
    const oldPassword = await askQuestion("🔐 Введите старый пароль: ");

    if (oldPassword !== user.password) {
        console.log("❌ Ошибка: старый пароль неверный!");
        return;
    }

    const newPassword = await askQuestion("🔑 Введите новый пароль: ");
    const confirmPassword = await askQuestion("🔑 Повторите новый пароль: ");

    if (newPassword !== confirmPassword) {
        console.log("❌ Ошибка: пароли не совпадают!");
        return;
    }

    user.password = newPassword;
    saveAccounts();
    console.log("✅ Пароль успешно изменён!");

    mainMenu();
}

function commandLoop(user) {
    rl.question('\n💻 Введите команду (help для списка): ', (command) => {
            switch (command) {
                case 'help':
                    console.log('📜 Доступные команды:');
                    console.log('🔹 whoami — ваш логин и роль');
                    console.log('🔹 showusers — показать всех пользователей (admin)');
                    console.log('🔹 deluser — удалить пользователя (admin)');
                    console.log('🔹 setperm — изменить права пользователя (admin)');
                    console.log('🔹 exit — выйти из аккаунта');
                    break;
                case 'whoami':
                    console.log(`👤 Логин: ${user.username} | Роль: ${user.role}`);
                break;
                case 'showusers':
                    if (user.role === 'admin') showAccounts();
                    else console.log('❌ Недостаточно прав!');
                    break;
                case 'deluser':
                    if (user.role === 'admin') deleteUser();
                    else console.log('❌ Недостаточно прав!');
                    break;
                case 'setperm':
                    if (user.role === 'admin') setPermission();
                    else console.log('❌ Недостаточно прав!');
                    break;
                case 'exit':
                    mainMenu();
                    return;
                case "changepass":
                    if (!user) {
                        console.log("❌ Ошибка: вы не вошли в аккаунт!");
                    } else {
                        changePassword(user);
                    }
                    return;
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
            process.exit(0); // Завершение программы
        }
        else {
            console.log('❌ Неизвестная команда!');
            mainMenu();
        }
    });
}

loadAccounts();
mainMenu();
