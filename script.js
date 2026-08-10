document.getElementById('startBtn').addEventListener('click', startBots);
document.getElementById('stopBtn').addEventListener('click', stopBots);
document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('commandSendBtn').addEventListener('click', sendCommand);

async function startBots() {
    const serverIp = document.getElementById('serverIp').value;
    const serverPort = document.getElementById('serverPort').value || 25565;
    const botPrefix = document.getElementById('botPrefix').value || 'Bot';
    const count = document.getElementById('botCount').value || 5;
    const version = document.getElementById('version').value || '1.21.4';

    if (!serverIp) {
        alert('Podaj IP serwera!');
        return;
    }

    document.getElementById('statusText').textContent = '🔄 Łączenie...';
    document.getElementById('statusText').style.color = '#ffa657';

    const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverIp, serverPort, botPrefix, count, version })
    });

    const data = await res.json();
    if (data.success) {
        document.getElementById('statusText').textContent = '🟢 Połączono';
        document.getElementById('statusText').style.color = '#3fb950';
    } else {
        alert('Błąd: ' + data.error);
        document.getElementById('statusText').textContent = '🔴 Błąd';
        document.getElementById('statusText').style.color = '#f85149';
    }
}

async function stopBots() {
    const res = await fetch('/api/stop', { method: 'POST' });
    if (res.ok) {
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

    await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
    });

    input.value = '';
    addChatLog('System', '📨 Wysłano: ' + msg);
}

async function sendCommand() {
    const input = document.getElementById('commandInput');
    const cmd = input.value.trim();
    if (!cmd) return;

    await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
    });

    input.value = '';
    addChatLog('System', '⚡ Wykonano: ' + cmd);
}

function addChatLog(sender, msg) {
    const log = document.getElementById('chatLog');
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<span class="bot">[${sender}]</span> ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function updateBotList(bots) {
    const ul = document.getElementById('botListUl');
    ul.innerHTML = '';
    bots.forEach(bot => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="${bot.online ? 'online' : 'offline'}">${bot.name}</span> - ${bot.online ? '🟢 online' : '🔴 offline'}`;
        ul.appendChild(li);
    });
}

// WebSocket
let ws;
function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
            document.getElementById('botCountDisplay').textContent = data.connected || 0;
            if (data.event === 'join') {
                addChatLog('System', `✅ ${data.bot} dołączył (${data.connected}/${data.total})`);
            }
            if (data.event === 'leave') {
                addChatLog('System', `❌ ${data.bot} wyszedł: ${data.reason || 'rozłączono'}`);
            }
        }
        if (data.type === 'chat') {
            addChatLog(data.bot, data.message);
        }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

connectWebSocket();

// Odświeżanie listy botów co 3s
setInterval(async () => {
    const res = await fetch('/api/bots');
    const data = await res.json();
    if (data.bots) updateBotList(data.bots);
}, 3000);
