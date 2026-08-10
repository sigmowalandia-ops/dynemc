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
let wsClients = [];
let isRunning = false;
let botStatus = {};

wss.on('connection', (ws) => {
    wsClients.push(ws);
    ws.on('close', () => wsClients = wsClients.filter(w => w !== ws));
});

function broadcast(data) {
    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

app.post('/api/start', (req, res) => {
    const { serverIp, serverPort, botPrefix, count, version } = req.body;

    if (!serverIp || !count) {
        return res.json({ success: false, error: 'Brak IP lub liczby botów' });
    }

    // Zatrzymaj stare
    bots.forEach(b => { try { b.end(); } catch(e) {} });
    bots = [];
    botStatus = {};
    isRunning = true;

    let connected = 0;
    const total = parseInt(count) || 10;
    const prefix = botPrefix || 'Bot';
    const port = parseInt(serverPort) || 25565;
    const ver = version || '1.21.4';

    for (let i = 0; i < total; i++) {
        const botName = `${prefix}${i + 1}`;

        const bot = mineflayer.createBot({
            host: serverIp,
            port: port,
            username: botName,
            version: ver,
            auth: 'offline',
            connectTimeout: 10000,
            checkTimeoutInterval: 5000,
            hideErrors: true,
            keepAlive: true,
        });

        let isConnected = false;

        bot.on('login', () => {
            isConnected = true;
            connected++;
            botStatus[botName] = { online: true, name: botName };
            broadcast({
                type: 'status',
                connected,
                total,
                bot: botName,
                event: 'join'
            });
            console.log(`✅ ${botName} dołączył (${connected}/${total})`);
        });

        bot.on('end', (reason) => {
            isConnected = false;
            if (botStatus[botName]) {
                botStatus[botName].online = false;
            }
            broadcast({
                type: 'status',
                connected: Object.values(botStatus).filter(b => b.online).length,
                total,
                bot: botName,
                event: 'leave',
                reason: reason || 'rozłączono'
            });
            console.log(`❌ ${botName} wyszedł: ${reason || 'nieznany'}`);

            setTimeout(() => {
                if (isRunning && !isConnected) {
                    console.log(`🔄 ${botName} łączy ponownie...`);
                    bot.connect();
                }
            }, 3000);
        });

        bot.on('error', (err) => {
            if (!err.message.includes('ECONNRESET') && !err.message.includes('ETIMEDOUT')) {
                console.log(`⚠️ ${botName}: ${err.message}`);
            }
        });

        bot.on('chat', (username, message) => {
            if (username === botName) {
                broadcast({ type: 'chat', bot: botName, message });
            }
        });

        // Anti-AFK
        let afkInterval = setInterval(() => {
            if (bot && bot.entity && isConnected) {
                try {
                    bot.setControlState('jump', true);
                    setTimeout(() => {
                        try { if (bot) bot.setControlState('jump', false); } catch(e) {}
                    }, 100);
                    if (Math.random() > 0.5) {
                        try { bot.look(Math.random() * Math.PI * 2, Math.random() * 0.3 - 0.15); } catch(e) {}
                    }
                } catch(e) {}
            }
        }, 8000);

        bot._afkInterval = afkInterval;
        bot._connected = isConnected;
        bots.push(bot);

        // Małe opóźnienie między botami
        setTimeout(() => {}, i * 150);
    }

    res.json({ success: true, count: total });
});

app.post('/api/stop', (req, res) => {
    isRunning = false;
    bots.forEach(b => {
        try {
            if (b._afkInterval) clearInterval(b._afkInterval);
            b.end();
        } catch(e) {}
    });
    bots = [];
    botStatus = {};
    broadcast({ type: 'status', connected: 0, total: 0 });
    res.json({ success: true });
});

app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    bots.forEach(b => {
        try { if (b && b.chat) b.chat(message); } catch(e) {}
    });
    res.json({ success: true });
});

app.post('/api/command', (req, res) => {
    const { command } = req.body;
    bots.forEach(b => {
        try { if (b && b.chat) b.chat(command); } catch(e) {}
    });
    res.json({ success: true });
});

app.get('/api/bots', (req, res) => {
    const list = Object.values(botStatus);
    res.json({ bots: list });
});

app.get('/api/status', (req, res) => {
    res.json({
        running: isRunning,
        count: Object.values(botStatus).filter(b => b.online).length,
        total: bots.length
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Panel na http://localhost:${PORT}`);
});
