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

function banUser(user) {
    rl.question('Введите логин пользователя для блокировки: ', (username) => {
        if (!accounts || !Array.isArray(accounts)) {
            console.log('❌ Ошибка: база данных пользователей повреждена.');
            return commandLoop(user);
        }

        const bannedUser = accounts.find(acc => acc.username === username);
        if (bannedUser) {
            bannedUser.banned = !bannedUser.banned;
            saveAccounts();

            const status = bannedUser.banned ? 'заблокирован' : 'разблокирован';
            console.log(`🚫 Пользователь ${username} ${status}!`);

            logAction(user, `${status === 'заблокирован' ? 'Заблокировал' : 'Разблокировал'} пользователя ${username}`);
        } else {
            console.log('❌ Ошибка: пользователь не найден.');
        }
        commandLoop(user);
    });
}

function setPermission(user) {
    rl.question('Введите логин пользователя: ', (username) => {
        rl.question('Введите новую роль (user/vip/admin): ', (newRole) => {
            const tuser = accounts.find(acc => acc.username === username);
            if (tuser && (newRole === 'user' || newRole === 'admin' || newRole === 'vip')) {
                tuser.role = newRole;
                saveAccounts();
                console.log('✅ Роль пользователя обновлена!');
            } else {
                console.log('❌ Ошибка: неверный логин или роль.');
            }
            commandLoop(user);
        });
    });
}

function deleteUser(user) {
    rl.question('Введите логин пользователя для удаления: ', (username) => {
        const index = accounts.findIndex(acc => acc.username === username);
        if (index === -1) {
            console.log('❌ Ошибка: пользователь не найден.');
            return commandLoop(user);
        }

        if (accounts[index].role === 'admin') {
            console.log('❌ Ошибка: нельзя удалить администратора.');
            return commandLoop(user);
        }

        accounts.splice(index, 1);
        saveAccounts();
        console.log(`🗑️ Пользователь ${username} удален.`);
        logAction(user, `Удалил пользователя ${username}`);
        commandLoop(user);
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
    commandLoop(user);
}

function showAccounts() {
    console.log('📜 Список всех пользователей:');
    accounts.forEach(acc => console.log(`👤 Логин: ${acc.username} | Роль: ${acc.role}`));
}

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

//vip users

async function setNickname(user) {

    const newNickname = await askQuestion('Введите новый никнейм: ');

    if (accounts.some(acc => acc.username === newNickname)) {
        console.log('❌ Ошибка: этот никнейм уже занят!');
        return;
    }

    if (newNickname.length < 3 || newNickname.length > 20) {
        console.log('⚠️ Никнейм должен быть от 3 до 20 символов!');
        return;
    }

    if (/[^a-zA-Z0-9_]/.test(newNickname)) {
        console.log('⚠️ Никнейм может содержать только буквы, цифры и символ подчеркивания!');
        return;
    }

    user.username = newNickname;
    saveAccounts();

    console.log(`✅ Никнейм успешно изменён на ${newNickname}!`);
    logAction(user, 'Изменение никнейма');
    commandLoop(user);
}

function commandLoop(user) {
    rl.question('\n💻 Введите команду (help для списка): ', (command) => {
        switch (command) {
            case 'help':
                console.log('📜 Доступные команды:');
                console.log('🔹 whoami — ваш логин и роль');
                console.log('🔹 changepass — сменить пароль');
                console.log('🔹 exit — выйти из аккаунта');
                if (user.role === 'admin') {
                    console.log('🔹 banuser — заблокировать пользователя');
                    console.log('🔹 showusers — показать всех пользователей');
                    console.log('🔹 setperm — изменить роль пользователя');
                    console.log('🔹 betaver — перейти в бета верисю')
                    console.log('🔹 setlogin — изменить логин');
                    console.log('🔹 deluser — удалить пользователя');
                }
                if (user.role === 'vip') {
                    console.log('⭐ [VIP] Дополнительные команды:');
                    console.log('🔹 setlogin — изменить логин');
                    console.log('🔹 betaver — перейти в бета верисю');

                }
                break;
            case 'whoami':
                console.log(`👤 Логин: ${user.username} | Роль: ${user.role} ${user.banned ? '🚫 (ЗАБАНЕН)' : ''}`);
                logAction(user, 'Использовал whoami')
                break;
            case 'banuser':
                if (user.role === 'admin') banUser(user);
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
                if (user.role === 'admin') setPermission(user);
                else console.log('❌ Недостаточно прав!');
                break;
            case 'deluser':
                deleteUser(user);
                break;
            case 'setlogin':
                if (user.role === 'vip' || user.role === 'admin') setNickname(user);
                else console.log('❌ Недостаточно прав!');
                break;
            case 'betaver':
                if (user.role === 'vip' || user.role === 'admin') {
                    console.log('Включен режим бета тестирования')
                    betaLoop(user);
                }
                else console.log('❌ Вы не можете учавтсвовать в бета тестировании');
                break;
            default:
                console.log('❌ Неизвестная команда!');
        }
        commandLoop(user);
    });
}


//Функции для бета версии, в дальнейшем перенос в commandloop

const helpData = [
    {
        keywords: ["пароль", "сменить пароль", "изменить пароль", "как поменять пароль"],
        answer: "Для смены пароля используйте команду 'changepass'. Введите старый и новый пароль."
    },
    {
        keywords: ["бан", "заблокировать", "заблокировать пользователя", "как забанить"],
        answer: "Для блокировки пользователя используйте команду 'banuser'. Введите логин пользователя, которого хотите заблокировать."
    },
    {
        keywords: ["админ", "роль admin", "что такое админ", "admin права"],
        answer: "Роль 'admin' предоставляет доступ к управлению пользователями, включая блокировку и изменение ролей."
    },
    {
        keywords: ["выйти", "как выйти", "выйти из программы", "как ливнуть"],
        answer: "Для выхода из программы используйте команду 'exit'."
    },
    {
        keywords: ["создатель", "кто создал", "автор", "разработчик"],
        answer: "Создатель этого проекта — NeuroTee"
    }
];

function callAssistant(user) {
    rl.question('\n🤖 Личный помощник: Введите ваш вопрос (или "exit" для выхода): ', (question) => {
        question = question.toLowerCase();  // Приводим к нижнему регистру

        if (question === 'exit') {
            betaLoop(user);
            return;
        }

        const response = helpData.find(entry =>
            entry.keywords.some(keyword => question.includes(keyword))
        );

        if (response) {
            console.log(response.answer);
        } else {
            console.log('❓ Я не понял вопрос. Попробуйте задать его иначе.');
        }

        callAssistant(user);
    });
}



function betaLoop(user) {

    rl.question('\n💻 Введите команду (betaver) (help для списка): ', (command) => {
        switch (command) {
            case 'help':
                console.log('📜 Доступные команды:');
                console.log('🤖 ai - пообщатся с личным помощником')
                console.log('🔹 exit - вернутся в обыный режим')
                break;
            case 'ai':
                console.log('Включен режим помощника (может быть очень слабым)');
                callAssistant(user);
                break;
            case 'exit':
                console.log('Включен обычный режим');
                commandLoop(user);
                break;
            default:
                console.log('❌ Неизвестная команда!');
        }
        betaLoop(user);
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
