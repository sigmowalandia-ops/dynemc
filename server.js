const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('.'));

let bots = [];
let botClients = [];
let wsClients = [];

// WebSocket
wss.on('connection', (ws) => {
    wsClients.push(ws);
    ws.on('close', () => {
        wsClients = wsClients.filter(w => w !== ws);
    });
});

function broadcast(data) {
    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

// ENDPOINTY API
app.post('/api/start', (req, res) => {
    const { serverIp, serverPort, botPrefix, count, version } = req.body;

    if (!serverIp || !count) {
        return res.json({ success: false, error: 'Brak IP lub liczby botów' });
    }

    // Zatrzymaj stare boty
    botClients.forEach(b => b.end());
    botClients = [];
    bots = [];

    for (let i = 0; i < count; i++) {
        const botName = `${botPrefix || 'Bot'}${i + 1}`;
        const bot = mineflayer.createBot({
            host: serverIp,
            port: serverPort || 25565,
            username: botName,
            version: version || '1.21.4',
            auth: 'offline'
        });

        bot.on('login', () => {
            console.log(`✅ ${botName} dołączył`);
            bots.push({ name: botName, online: true });
            broadcast({ type: 'status', count: botClients.length });
        });

        bot.on('end', () => {
            console.log(`❌ ${botName} rozłączony`);
            const b = bots.find(b => b.name === botName);
            if (b) b.online = false;
            broadcast({ type: 'status', count: botClients.length });
            // Auto-reconnect po 5s
            setTimeout(() => {
                bot.connect();
            }, 5000);
        });

        bot.on('chat', (username, message) => {
            if (username === botName) {
                broadcast({ type: 'chat', bot: username, message });
            }
        });

        botClients.push(bot);
    }

    res.json({ success: true, count });
});

app.post('/api/stop', (req, res) => {
    botClients.forEach(b => b.end());
    botClients = [];
    bots = [];
    broadcast({ type: 'status', count: 0 });
    res.json({ success: true });
});

app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    botClients.forEach(bot => {
        if (bot && bot.chat) {
            bot.chat(message);
        }
    });
    res.json({ success: true });
});

app.post('/api/command', (req, res) => {
    const { command } = req.body;
    botClients.forEach(bot => {
        if (bot && bot.chat) {
            bot.chat(command);
        }
    });
    res.json({ success: true });
});

app.get('/api/bots', (req, res) => {
    res.json({ bots: bots });
});

// Uruchomienie
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Panel na http://localhost:${PORT}`);
});
