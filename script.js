const API_URL = window.location.origin;

let botCount = 0;

document.getElementById('startBtn').addEventListener('click', startBots);
document.getElementById('stopBtn').addEventListener('click', stopBots);
document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('commandSendBtn').addEventListener('click', sendCommand);

async function startBots() {
    const serverIp = document.getElementById('serverIp').value;
    const serverPort = parseInt(document.getElementById('serverPort').value);
    const botPrefix = document.getElementById('botPrefix').value || 'Bot';
    const count = parseInt(document.getElementById('botCount').value) || 10;
    const version = document.getElementById('version').value || '1.21.4';

    if (!serverIp) {
        alert('Podaj IP serwera!');
        return;
    }

    const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverIp, serverPort, botPrefix, count, version })
    });

    const data = await res.json();
    if (data.success) {
        botCount = count;
        document.getElementById('statusText').textContent = '🟢 Połączono';
        document.getElementById('statusText').style.color = '#3fb950';
        document.getElementById('botCountDisplay').textContent = count;
        fetchBots();
    } else {
        alert('Błąd: ' + data.error);
    }
}

async function stopBots() {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
        botCount = 0;
        document.getElementById('statusText').textContent = '🔴 Zatrzymano';
        document.getElementById('statusText').style.color = '#f85149';
        document.getElementById('botCountDisplay').textContent = '0';
        document.getElementById('botListUl').innerHTML = '';
    }
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
    });

    const data = await res.json();
    if (data.success) {
        input.value = '';
        addChatLog('System', '📨 Wysłano: ' + msg);
    }
}

async function sendCommand() {
    const input = document.getElementById('commandInput');
    const cmd = input.value.trim();
    if (!cmd) return;

    const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
    });

    const data = await res.json();
    if (data.success) {
        input.value = '';
        addChatLog('System', '⚡ Wykonano: ' + cmd);
    }
}

async function fetchBots() {
    const res = await fetch('/api/bots');
    const data = await res.json();
    if (data.bots) {
        const ul = document.getElementById('botListUl');
        ul.innerHTML = '';
        data.bots.forEach(bot => {
            const li = document.createElement('li');
            const status = bot.online ? '🟢 online' : '🔴 offline';
            li.innerHTML = `<span class="${bot.online ? 'online' : 'offline'}">${bot.name}</span> - ${status}`;
            ul.appendChild(li);
        });
    }
}

function addChatLog(sender, msg) {
    const log = document.getElementById('chatLog');
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<span class="bot">[${sender}]</span> ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// WebSocket do odbierania wiadomości z chatów botów
let ws;

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
            addChatLog(data.bot, data.message);
        } else if (data.type === 'status') {
            document.getElementById('botCountDisplay').textContent = data.count;
            fetchBots();
        }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

connectWebSocket();
