require('dotenv').config();
const statusGrup = new Map();
const STATUS_FILE = './status_grup.json';

// Fungsi memuat status dari file
function loadStatus() {
    if (fs.existsSync(STATUS_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATUS_FILE));
        return new Map(Object.entries(data));
    }
    return new Map();
}

// Fungsi menyimpan status ke file
function saveStatus(map) {
    const obj = Object.fromEntries(map);
    fs.writeFileSync(STATUS_FILE, JSON.stringify(obj));
}

// Inisialisasi Map dengan data dari file
const statusGrup = loadStatus();

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    downloadMediaMessage 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal'); // <-- Ini library baru

// Map untuk menyimpan metadata pesan
const storeMessage = new Map(); 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        // printQRInTerminal: true,  <-- INI KITA HAPUS KARENA DEPRECATED
        auth: state,
	browser: ["Ubuntu", "Chrome", "24.0.04"],
        getMessage: async (key) => {
            return {
                conversation: 'hello'
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        // Ambil variable qr, connection, dan lastDisconnect
        const { connection, lastDisconnect, qr } = update;

        // --- INI KODE BARU UNTUK MUNCULKAN QR ---
        if (qr) {
            // small: true agar QR code pas di layar terminal VPS
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, reconnect:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Bot Anti-Delete Berhasil Terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 1. PROSES PESAN MASUK ---
    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return; // Mengabaikan pesan dari bot sendiri
                const id = msg.key.id;
                const from = msg.key.remoteJid;
                const sender = msg.key.participant || msg.key.remoteJid;
                const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

                // Fungsi untuk cek apakah sender adalah admin
                const groupMetadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null;
                const isAdmins = groupMetadata ? groupMetadata.participants.find(p => p.id === sender)?.admin : null;
                const isOwner = sender.split('@')[0] === sock.user.id.split(':')[0] || sender.includes(process.env.OWNER_NUMBER);

                if (body === '!bot off') {
                    if (isAdmins || isOwner) {
                        statusGrup.set(from, false);
                        saveStatus(statusGrup); // Simpan permanen
                        return await sock.sendMessage(from, { text: "❌ Bot dinonaktifkan di grup ini." });
                    }
                }

                if (body === '!bot on') {
                    if (isAdmins || isOwner) {
                        statusGrup.delete(from); // Hapus dari daftar mute
                        saveStatus(statusGrup); // Simpan permanen
                        return await sock.sendMessage(from, { text: "✅ Bot diaktifkan kembali!" });
                    }
                }
                if (body === '!cek') {
                await sock.sendMessage(from, { 
                    text: `User: ${sender}\nIs Owner: ${isOwner}\nIs Admin: ${isAdmins}` 
                });
               }

            const isText = msg.message.conversation || msg.message.extendedTextMessage;
            const isImage = msg.message.imageMessage;
            const isSticker = msg.message.stickerMessage;

            if (isText) {
                const textContent = msg.message.conversation || msg.message.extendedTextMessage.text;
                storeMessage.set(id, {
                    type: 'text',
                    sender: sender,
                    content: textContent,
                    from: from
                });
            } else if (isImage || isSticker) {
                // Pastikan folder temp ada
                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                const buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    { },
                    { 
                        logger: pino({ level: 'silent' }),
                        reuploadRequest: sock.updateMediaMessage
                    }
                );

                const ext = isImage ? '.jpg' : '.webp';
                const filename = path.join(tempDir, `${id}${ext}`);
                fs.writeFileSync(filename, buffer);

                storeMessage.set(id, {
                    type: isImage ? 'image' : 'sticker',
                    sender: sender,
                    path: filename,
                    caption: isImage ? (msg.message.imageMessage.caption || '') : '',
                    from: from
                });
            }

            // Batasi memori max 500 pesan
            if (storeMessage.size > 500) {
                const firstKey = storeMessage.keys().next().value;
                const data = storeMessage.get(firstKey);
                if ((data.type === 'image' || data.type === 'sticker') && fs.existsSync(data.path)) {
                    fs.unlinkSync(data.path);
                }
                storeMessage.delete(firstKey);
            }

        } catch (e) {
            // error diamkan saja agar log bersih
        }
    });

    // --- 2. DETEKSI PENGHAPUSAN ---
    sock.ev.on('messages.update', async updates => {
        for (const update of updates) {
            if (update.update.message === null) { 
                const id = update.key.id;
                const chatJid = update.key.remoteJid;
                if (storeMessage.has(id)) {
                    // Cek apakah grup ini ada di daftar "OFF"
                    const isMuted = statusGrup.get(deletedMsg.from) === false;

                    if (isMuted) {
                        console.log(`Pesan dihapus di ${deletedMsg.from}, tapi bot sedang OFF di grup ini.`);
                        continue; 
                    }
                    const deletedMsg = storeMessage.get(id);
                    const pelakunya = deletedMsg.sender.split('@')[0];

                    const intro = `*Waduh ada yang ngehapus pesan 🥶*\nPelaku: @${pelakunya}\n`;

                    if (deletedMsg.type === 'text') {
                        await sock.sendMessage(deletedMsg.from, { 
                            text: `${intro}Isi: ${deletedMsg.content}`,
                            mentions: [deletedMsg.sender]
                        });
                    } else if (deletedMsg.type === 'image') {
                        if (fs.existsSync(deletedMsg.path)) {
                            await sock.sendMessage(deletedMsg.from, { 
                                image: fs.readFileSync(deletedMsg.path),
                                caption: `${intro}Isi: (Lihat Gambar)${deletedMsg.caption ? `\nCaption asli: ${deletedMsg.caption}` : ''}`,
                                mentions: [deletedMsg.sender]
                            });
                        }
                    } else if (deletedMsg.type === 'sticker') {
                        await sock.sendMessage(deletedMsg.from, { 
                            text: `${intro}Isi: (Stiker di bawah)`,
                            mentions: [deletedMsg.sender]
                        });
                        if (fs.existsSync(deletedMsg.path)) {
                            await sock.sendMessage(deletedMsg.from, { 
                                sticker: fs.readFileSync(deletedMsg.path) 
                            });
                        }
                    }
                }
            }
        }
    });
}

// --- FITUR AUTO CLEAN (PENGGANTI CRONJOB) ---
// Cek setiap 10 menit, hapus file yg umurnya > 1 jam
setInterval(() => {
    const directory = path.join(__dirname, 'temp');
    if (fs.existsSync(directory)) {
        fs.readdir(directory, (err, files) => {
            if (err) return;
            files.forEach(file => {
                const filePath = path.join(directory, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    const now = new Date().getTime();
                    const endTime = new Date(stats.mtime).getTime() + (60 * 60 * 1000); 
                    if (now > endTime) {
                        fs.unlink(filePath, () => {});
                    }
                });
            });
        });
    }
}, 10 * 60 * 1000);

connectToWhatsApp();
