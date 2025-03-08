let ws;

document.addEventListener("DOMContentLoaded", () => {
    refreshAccessToken()
        .then(() => {
            loadChats();
            connectWebSocket();
        })
        .catch(() => console.log("Not authorized!"));
});

function connectWebSocket() {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return console.error("Нет токена");

    ws = new WebSocket(`ws://localhost:8080/ws?token=${encodeURIComponent(token)}`);

    ws.onopen = () => console.log("✅ WebSocket подключён");
    ws.onerror = (err) => console.error("❌ WebSocket ошибка:", err);
    ws.onclose = () => console.log("🔴 WebSocket отключён");
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === "send_message") {
            receiveMessage(event.data);
        }else if (data.action === "delete_message"){
            removeMessage(data.message_id)
        }
        else if (data.action === "edit_message"){
            console.log(data)
            changeMessage(data.message_id, data.new_content)
        }
        else {
            console.log("Invalid action type");
        }
    };
}

function copyMessage(content) {
    navigator.clipboard.writeText(content).then()
}
window.copyMessage = copyMessage

function deleteMessage(id) {
    const message = { action: "delete_message", message_id: id };
    ws.send(JSON.stringify(message))
}
window.deleteMessage = deleteMessage

function removeMessage(id){
    let box = document.getElementById(`${id}`)
    box.remove()
}
window.removeMessage = removeMessage

function changeMessage(id, content){
    let box = document.getElementById(`message_${id}`)
    box.innerText = content
}
window.changeMessage = changeMessage

function editMessage(id) {
    const msgSpan = document.getElementById(`message_${id}`);
    const newContent = prompt("Введите новый текст:", msgSpan.innerText);
    if (!newContent) return;

    const message = { action: "edit_message", message_id: id, new_content: newContent };
    ws.send(JSON.stringify(message));
}
window.editMessage = editMessage

export function login() {
    const username = document.getElementById('username_sign').value;
    const password = document.getElementById('password_sign').value;
    console.log(username, password);
    fetch("http://localhost:8080/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.accessToken) {
                sessionStorage.setItem("accessToken", data.accessToken);
                sessionStorage.setItem("refreshToken", data.refreshToken);
                document.querySelector(".sign_form").style.display = "none";
                connectWebSocket();
                loadChats();
            } else {
                console.error("Ошибка авторизации");
            }
        })
        .catch(err => console.error("Ошибка запроса:", err));
}

function refreshAccessToken() {
    const refreshToken = sessionStorage.getItem("refreshToken");
    if (!refreshToken) {
        console.error("❌ Ошибка: Refresh-токен отсутствует!");
        return Promise.reject("Отсутствует refreshToken");
    }

    return fetch("http://localhost:8080/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${refreshToken}` },
    })
        .then(res => {
            if (!res.ok) throw new Error(`Ошибка обновления токена: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("🔄 Токен обновлён!");
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem("refreshToken", data.refreshToken);
            return data.accessToken;
        })
        .catch(err => {
            console.log("❌ Ошибка обновления токена:", err);
            return Promise.reject(err);
        });
}

function loadMessages(username) {
    fetch(`http://localhost:8080/get-messages?user=${username}`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("accessToken") }
    })
        .then(res => res.json())
        .then(messages => {
            console.log(messages)
            if (!Array.isArray(messages)) return;
            const chatBox = document.querySelector(".chat_screen");
            chatBox.innerHTML = ""
            messages.forEach(msg => {
                const isOutgoing = msg.from === username;
                const messageClass = isOutgoing ? "outgoing" : "incoming";

                if (!isOutgoing) {
                    chatBox.innerHTML += `
                <div class="message ${messageClass}" id="${msg.id}">
                    <div class="message_container">
                        <div id="message_${msg.id}">${msg.content}</div>
                        <div class="time">${formatTime(msg.timestamp)}</div>
                    </div>
                    <div class="context-menu">
                        <img src="images/content_copy_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="copy" onclick="copyMessage('${msg.content}')" draggable="false">
                        <img src="images/edit_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="edit" onclick="editMessage(${msg.id})" draggable="false">
                        <img src="images/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="delete" onclick="deleteMessage(${msg.id})" draggable="false">
                    </div>
                </div>
            `
                }else{
                    chatBox.innerHTML += `
                <div class="message ${messageClass}" id="${msg.id}">
                    <div class="message_container">
                        <div id="message_${msg.id}">${msg.content}</div>
                        <div class="time">${formatTime(msg.timestamp)}</div>
                    </div>
            `
                }
            });
            chatBox.innerHTML +=
                `
                <input placeholder="Написать..." class="chat_send_input" id="${username}">
                `
            document.querySelector(".chat_send_input").addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(document.querySelector(".chat_send_input").value, document.querySelector(".chat_send_input").id);
                    document.querySelector(".chat_send_input").value = "";
                }
            });

            chatBox.scrollTop = chatBox.scrollHeight;
        })
        .catch(err => console.error("Ошибка загрузки сообщений:", err));
}

function loadChats() {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
        console.error("❌ Ошибка: Токен отсутствует! Пользователь не авторизован.");
        return;
    }

    fetch("http://localhost:8080/get-chats", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    })
        .then(res => {
            if (res.status === 401) {
                console.warn("⚠️ Токен истёк, пробуем обновить...");
                return refreshAccessToken().then(loadChats);
            }
            if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
            return res.json();
        })
        .then(chats => {
            if (!Array.isArray(chats)) throw new Error("Ответ сервера не является массивом!");
            console.log(chats)
            const chatList = document.querySelector(".chats_box");
            chatList.innerHTML = "";
            chats.forEach(chat => {
                chatList.innerHTML += `<div id="${chat.username}" class="chat_box_item">
                <div class="chat_box_item_info">
                    <div class="chat_box_name">${chat.username}</div>
                    <div class="chat_box_item_time">${chat.timestamp ? formatTime(chat.timestamp) : "Неизвестное время"}</div>
                </div>
                <div class="chat_box_text">
                    ${chat.last_message || "Нет сообщений"}
                </div>
            </div>`;
            })

            document.querySelector(".chats_box").addEventListener("click", (e) => {
                const chatItem = e.target.closest(".chat_box_item")
                if (!chatItem) return
                const chatId = chatItem.id
                loadMessages(chatId);
            })
        })
        .catch(err => console.error("❌ Ошибка загрузки чатов:", err));
}

function sendMessage(message,  recipient) {
    if (!message || !ws) return;

    // const username = localStorage.getItem("username");
    // const recipient = localStorage.getItem("to");
    if (!recipient) return console.error("Не выбран чат!");

    const msgObj = { action: "send_message", from: "mike", to: recipient, content: message };
    ws.send(JSON.stringify(msgObj));
    console.log("Send")
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    // Форматы времени
    const optionsTime = { hour: "2-digit", minute: "2-digit" };
    const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };

    // Получаем разницу в днях
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString("ru-RU", optionsTime); // Сегодня HH:mm
    } else if (diffDays === 1) {
        return `Вчера ${date.toLocaleTimeString("ru-RU", optionsTime)}`; // Вчера HH:mm
    } else {
        return date.toLocaleDateString("ru-RU", optionsDate);
    }
}

function receiveMessage(data) {
    const msg = JSON.parse(data);
    const username = document.querySelector(".chat_send_input").id;
    const chat = document.querySelector(".chat_screen");
    const isOutgoing = msg.from === username;
    const messageClass = isOutgoing ? "outgoing" : "incoming";

    console.log(msg);

    const newMessage = document.createElement("div");
    newMessage.classList.add("message", messageClass);
    newMessage.id = msg.message_id;
    if (!isOutgoing){
        newMessage.innerHTML = `
        <div class="message_container">
            <div id="message_${msg.message_id}">${msg.content}</div>
            <div class="time">${formatTime(msg.created)}</div>
        </div>
        <div class="context-menu">
            <img src="images/content_copy_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="copy" onclick="copyMessage('${msg.content}')" draggable="false">
            <img src="images/edit_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="edit" onclick="editMessage(${msg.message_id})" draggable="false">
            <img src="images/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="delete" onclick="deleteMessage(${msg.message_id})" draggable="false">
        </div>
    `;
    }else{
        newMessage.innerHTML = `
        <div class="message_container">
            <div id="message_${msg.message_id}">${msg.content}</div>
            <div class="time">${formatTime(msg.created)}</div>
        </div>
    `;
    }

    const inputField = document.querySelector(".chat_send_input");
    chat.insertBefore(newMessage, inputField); // Теперь передаём DOM-элемент, а не строку
    chat.scrollTop = chat.scrollHeight;
}
