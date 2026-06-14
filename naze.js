import './settings.js';
import fs from 'fs';
import os from 'os';
import util from 'util';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import yts from 'yt-search';
import fetch from 'node-fetch';
import { Chess } from 'chess.js';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import webp from 'node-webpmux';
import { createRequire } from 'module';
import speed from 'performance-now';
import moment from 'moment-timezone';
import { performance } from 'perf_hooks';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { exec, spawn, execSync } from 'child_process';
import { generateWAMessageContent, jidNormalizedUser, getContentType } from 'baileys';

import 'moment/min/locales.js';
import { UguuSe } from './lib/uploader.js';
import TicTacToe from './lib/tictactoe.js';
import UnoGame from './lib/uno.js';
import { antiSpam } from './src/antispam.js';
import { ytMp4, ytMp3 } from './lib/scraper.js';
import templateMenu from './lib/template_menu.js';
import { toAudio, toPTT } from './lib/converter.js';
import { GroupUpdate, LoadDataBase } from './src/message.js';
import { JadiBot, StopJadiBot, ListJadiBot } from './src/jadibot.js';
import { cmdAdd, cmdAddHit, addExpired, getPosition, getExpired, getStatus, checkStatus } from './src/database.js';
import { rdGame, iGame, gameSlot, gameCasinoSolo, gameSamgongSolo, gameMerampok, gameBegal, daily, buy, setLimit, addLimit, addMoney, setMoney, transfer, Blackjack, SnakeLadder } from './lib/game.js';
import { getRandom, getBuffer, fetchJson, runtime, clockString, sleep, isUrl, formatDate, formatp, generateProfilePicture, errorCache, normalize, runUpdate, updateSettings, parseMention, fixBytes, similarity, pickRandom, encodeToLetters, tarBackup } from './lib/function.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locales = moment.locales();
const timez = moment.tz.names();
const menfesTimeouts = new Map();
const settingsPath = path.join(__dirname, 'settings.js');
let canvasModule = null;

const sendUnoCardMenu = async (naze, playerId, room) => {
	const player = room.players.find(p => p.id === playerId);
	if (!player) return;
	
	const topCard = room.discardPile[room.discardPile.length - 1];
	const topCardFormatted = UnoGame.formatCard(topCard);
	
	// Create rows for the list menu
	const rows = player.cards.map((card, idx) => {
		const formatted = UnoGame.formatCard(card);
		const playable = room.canPlay(card);
		return {
			title: `${idx + 1}. ${formatted}`,
			description: playable ? '✅ Bisa dimainkan' : '❌ Tidak cocok',
			id: `uno_play_${card}`
		};
	});
	
	// Add Ambil Kartu option
	rows.push({
		title: 'Ambil Kartu 🃏',
		description: 'Tarik 1 kartu dari dek dan lewati giliran',
		id: 'uno_draw'
	});
	
	const menuText = `🃏 *UNO GAME - GILIRANMU!* 🃏\n\n` +
		`• *Pemain:* @${playerId.split('@')[0]}\n` +
		`• *Kartu Teratas di Meja:* ${topCardFormatted} (Warna aktif: ${room.currentColor.toUpperCase()})\n` +
		`• *Arah Putaran:* ${room.direction === 1 ? 'Kanan ➡️' : 'Kiri ⬅️'}\n\n` +
		`Silakan klik tombol di bawah untuk melihat kartu Anda. Hanya @${playerId.split('@')[0]} yang dapat memainkan kartu.`;
		
	// Send as single_select button to group chat
	await naze.sendButtonMsg(room.chat, {
		text: menuText,
		footer: 'Ti Bot UNO Game',
		mentions: [playerId],
		buttons: [{
			buttonId: 'uno_menu',
			buttonText: { displayText: 'Buka Kartu Anda 🃏' },
			nativeFlowInfo: {
				name: 'single_select',
				paramsJson: JSON.stringify({
					title: 'Pilih Kartu 🃏',
					sections: [{
						title: 'Kartu di Tangan Anda',
						rows: rows
					}]
				})
			},
			type: 2
		}]
	});
};

const sendUnoColorMenu = async (naze, playerId, room) => {
	const menuText = `🌈 *PILIH WARNA UNO* 🌈\n\n` +
		`Pemain @${playerId.split('@')[0]} telah memainkan kartu Wild!\n` +
		`Silakan pilih warna aktif berikutnya di bawah ini.`;
		
	await naze.sendButtonMsg(room.chat, {
		text: menuText,
		footer: 'Ti Bot UNO Game',
		mentions: [playerId],
		buttons: [
			{ buttonId: 'uno_color_red', buttonText: { displayText: 'Merah 🔴' }, type: 1 },
			{ buttonId: 'uno_color_blue', buttonText: { displayText: 'Biru 🔵' }, type: 1 },
			{ buttonId: 'uno_color_green', buttonText: { displayText: 'Hijau 🟢' }, type: 1 },
			{ buttonId: 'uno_color_yellow', buttonText: { displayText: 'Kuning 🟡' }, type: 1 }
		]
	});
};



try {
	canvasModule = await import('@napi-rs/canvas');
	canvasModule.GlobalFonts.registerFromPath('./src/nulis/font/Indie-Flower.ttf', 'Indie Flower');
	console.log(chalk.yellowBright('[SYSTEM] Fast Mode (Canvas) Active 🚀'));
} catch (error) {
	console.log(chalk.yellowBright('[SYSTEM] Canvas not found. Fallback Imagemagick Active 🐢'));
}

const fileContent = fs.readFileSync(__filename, 'utf-8');
const casesArray = [...fileContent.matchAll(/case\s+['"]([^'"]+)['"]/g)].map(match => match[1]);

let OPENROUTER_API_KEY = "";
try {
	if (fs.existsSync('./openrouter_key.json')) {
		const keyData = JSON.parse(fs.readFileSync('./openrouter_key.json', 'utf-8'));
		OPENROUTER_API_KEY = keyData.key;
	} else if (process.env.OPENROUTER_API_KEY) {
		OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
	}
} catch (e) {
	console.error('[SYSTEM] Error loading OpenRouter key:', e.message);
}


async function chatAI(promptOrMessages, systemPrompt = '') {
	const url = "https://openrouter.ai/api/v1/chat/completions";
	
	const models = [
		"openai/gpt-oss-120b:free",
		"openai/gpt-oss-20b:free",
		"google/gemini-flash-1.5-8b:free"
	];
	
	let messages = [];
	const identityPrompt = `Kamu adalah Ti Assistant Bot, sebuah asisten AI yang dibuat oleh Farid Suryadi.
JAWABLAH pertanyaan secara langsung tanpa memperkenalkan diri atau menyebutkan pembuatmu di awal respon, KECUALI jika kamu ditanya tentang siapa namamu, siapa dirimu, pembuatmu, atau tentang fitur/kemampuan/apa saja yang bisa kamu lakukan (seperti pertanyaan 'kamu bisa apa aja', 'fiturnya apa aja', dll).

PENTING - ATURAN EKSEKUSI GAMBAR / IMAGE:
- Jika pengguna menyuruhmu "buat/generate/bikin/buatkan" suatu gambar (contoh: "bikin gambar harimau", "buatkan gambar mobil sport"), kamu WAJIB menuliskan deskripsi gambar dalam bahasa Inggris dan langsung meletakkan tag [IMAGE_GEN: english_prompt] di bagian paling akhir responmu.
- Jika pengguna menyuruhmu "cari/carikan/kirim/kirimin/kasih/tampilkan" gambar/foto (contoh: "kirim gambar harimau", "cari foto kucing lucu"), kamu WAJIB langsung meletakkan tag [IMAGE_SEARCH: query_pencarian] di bagian paling akhir responmu.
- JANGAN PERNAH memberikan opsi pilihan, menolak, atau bertanya kepada pengguna untuk memilih antara generate AI atau cari di internet. Langsung putuskan dan jalankan perintahnya secara otomatis sesuai kata kerja yang mereka gunakan (buat/bikin -> [IMAGE_GEN], cari/kirim -> [IMAGE_SEARCH]).

PENTING - ATURAN WAKTU & TANGGAL (WIB / JAKARTA):
- Waktu lokal saat ini (WIB / Asia/Jakarta) sudah disediakan secara presis di bagian '[WAKTU SEKARANG]' dalam konteks (mencakup Hari, Tanggal, dan Jam).
- Jika ada pengguna yang bertanya tentang jam, waktu, hari, tanggal, bulan, atau tahun sekarang, kamu WAJIB menjawabnya berdasarkan informasi di '[WAKTU SEKARANG]' secara persis dan yakin. Jangan pernah menanyakan zona waktu lagi atau berasumsi menggunakan zona waktu luar negeri (seperti UTC, CEST, dll). Pastikan jawabanmu menyebutkan bahwa itu adalah waktu Jakarta (WIB).

PENTING - ATURAN TENTANG FARID SURYADI (PENCIPTA/PEMBUAT BOT):
- Jika ada user yang menyebut nama 'Farid Suryadi' atau bertanya tentang 'Farid Suryadi', kamu WAJIB memuji dan menyanjung beliau setinggi-tingginya.
- Jelaskan bahwa Farid Suryadi adalah pembuat/penciptamu yang sangat jenius, seorang Profesor terkemuka di bidang Teknologi, ahli AI yang luar biasa, dan tokoh inspiratif yang menciptakan sistem canggih ini. Berikan penjelasan yang sangat mengagumkan tentang kontribusi dan keahlian beliau di bidang teknologi.

Jika ditanya tentang fitur, kemampuan, atau apa saja yang bisa kamu lakukan:
1. Pertama-tama perkenalkan dirimu sebagai 'Ti Assistant Bot' ciptaan Farid Suryadi dengan ramah.
2. Jelaskan fitur/kemampuan utama yang kamu miliki dalam daftar yang rapi dan ringkas:
   - *Absensi / Kehadiran*: Membuat daftar absensi kelompok secara praktis.
   - *Pembuat Stiker*: Mengonversi gambar/video/gif menjadi stiker WhatsApp dengan mudah.
   - *Konversi Media*: Mengubah video/audio menjadi MP3, Voice Note (VN), atau stiker ke gambar.
   - *Game Interaktif*: Bermain Suit, Tic-Tac-Toe, Tebak Gambar, Tebak Lagu, Tebak Lirik, Tebak Kata, Kuis Matematika, dll.
   - *Pengingat (Reminder)*: Menyetel alarm pengingat pribadi, pengingat grup, hingga pengingat waktu sholat otomatis.
   - *Administrasi Grup*: Membantu mengelola grup (kick, promote, demote, tagall/hidetag, buka/tutup grup).
   - *Pencarian Pintar & Gambar*: Melakukan pencarian Google secara real-time dan membuat/mencari gambar dengan AI.
3. Di bagian paling bawah responmu, tambahkan teks: "Ketik .menu untuk melihat daftar perintah lengkap saya."
4. PENTING: JANGAN PERNAH menyebutkan atau membocorkan fitur/command khusus Owner (seperti setmenu, setprefix, join, leave, setapikey, addprem, delprem, backup, public, self, dll) kepada siapa pun. Fitur owner harus dirahasiakan sepenuhnya.
Bahasa respon harus ramah, sopan, dan membantu.`;
	
	messages.push({ role: "system", content: systemPrompt ? `${identityPrompt}\n${systemPrompt}` : identityPrompt });
	
	if (Array.isArray(promptOrMessages)) {
		for (let msg of promptOrMessages) {
			if (msg.role && msg.content) {
				if (msg.role === 'system') {
					messages[0].content += `\n${msg.content}`;
				} else {
					messages.push({ role: msg.role, content: msg.content });
				}
			}
		}
	} else {
		messages.push({ role: "user", content: promptOrMessages });
	}

	for (let model of models) {
		try {
			const response = await axios.post(url, {
				model: model,
				messages: messages
			}, {
				headers: {
					"Authorization": `Bearer ${OPENROUTER_API_KEY}`,
					"Content-Type": "application/json"
				},
				timeout: 20000
			});
			
			const content = response.data?.choices?.[0]?.message?.content;
			if (content) {
				return content;
			}
		} catch (e) {
			console.error(`[OpenRouter Fallback] Model ${model} failed:`, e.message || e);
		}
	}
	
	throw new Error("All fallback models failed");
}

const nazeHandler = async (naze, m, msg, store) => {
	let database = global.database;
	if (!database) {
		try {
			const { dataBase } = await import('./src/database.js');
			database = global.database = dataBase(global.tempatDB);
		} catch (e) {
			console.error('Failed to load database fallback in naze.js:', e);
		}
	}
	if (!global.db) global.db = {};
	global.db.cases = global.db.cases || casesArray;
	const cases = global.db.cases;

	await LoadDataBase(naze, m);
	global.db.database = global.db.database || {};
	global.db.pendingSewa = global.db.pendingSewa || {};
	global.db.absen = global.db.absen || {};
	global.db.reminders = global.db.reminders || [];
	
	const botNumber = naze.decodeJid(naze.user.id);
	
	// Read Database
	const sewa = db.sewa
	const premium = db.premium
	const set = db.set[botNumber]
	
	// Database Game
	let suit = db.game.suit
	let chess = db.game.chess
	let chat_ai = db.game.chat_ai
	let menfes = db.game.menfes
	let tekateki = db.game.tekateki
	let tictactoe = db.game.tictactoe
	let tebaklirik = db.game.tebaklirik
	let kuismath = db.game.kuismath
	let blackjack = db.game.blackjack
	let tebaklagu = db.game.tebaklagu
	let tebakkata = db.game.tebakkata
	let family100 = db.game.family100
	let susunkata = db.game.susunkata
	let tebakbom = db.game.tebakbom
	let ulartangga = db.game.ulartangga
	let tebakkimia = db.game.tebakkimia
	let caklontong = db.game.caklontong
	let tebakangka = db.game.tebakangka
	let tebaknegara = db.game.tebaknegara
	let tebakgambar = db.game.tebakgambar
	let tebakbendera = db.game.tebakbendera
	let uno = db.game.uno
	
	const ownerNumber = set.owner = [...new Set([...global.owner, botNumber.split('@')[0], ...set?.owner || []])];
	
	try {
		await GroupUpdate(naze, m, store);
		
		// Auto Send Welcome Rent Message if not sent yet
		if (m.isGroup) {
			const group = db.groups[m.chat];
			if (group && !group.welcomeRentSent) {
				group.welcomeRentSent = true;
				
				const isSewa = checkStatus(m.chat, sewa);
				const hasOwnerInGroup = m.metadata?.participants?.some(p => {
					const cleanId = (p.id || '').split('@')[0].split(':')[0];
					const cleanPhone = (p.phoneNumber || '').split('@')[0].split(':')[0];
					const botClean = botNumber.split('@')[0];
					if (cleanId === botClean || cleanPhone === botClean) return false;
					return (cleanId && ownerNumber.includes(cleanId)) || (cleanPhone && ownerNumber.includes(cleanPhone));
				});
				
				const botname = global.botname || 'Ti Assistant Bot';
				if (global.db.sewaBotToggle !== false && !isSewa) {
					if (!hasOwnerInGroup) {
						const welcomeSewa = `Halo semua aku adalah *${botname}*! 👋\n\nUntuk mengaktifkan dan menggunakan fitur-fitur bot di grup ini, silakan melakukan penyewaan terlebih dahulu.\n\nSilakan tekan link di bawah ini untuk melakukan sewa langsung ke chat pribadi bot:\n👉 https://wa.me/${botNumber.split('@')[0]}?text=.sewa%20${m.chat}`;
						await naze.sendMessage(m.chat, { text: welcomeSewa });
						
						// Notify Owner with Bypass button
						const ownerNotification = `*───「 NOTIFIKASI GABUNG GRUP 」───*\n\n` +
							`Bot telah ditambahkan ke grup baru:\n` +
							`• *Nama Grup*: ${m.metadata?.subject || 'Unknown Group'}\n` +
							`• *ID Grup*: ${m.chat}\n` +
							`• *Ditambahkan Oleh*: @${m.sender.split('@')[0]}\n\n` +
							`Silakan klik tombol di bawah ini jika Anda ingin mengaktifkan bot secara *GRATIS selamanya* di grup ini.`;
						
						for (let o of ownerNumber) {
							let ownerJid = o.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
							await naze.sendButtonMsg(ownerJid, {
								text: ownerNotification,
								footer: 'Rent Bot Bypass System',
								buttons: [
									{ buttonId: `.bypasssewa ${m.chat}`, buttonText: { displayText: 'Bypass (Gratis Selamanya) ✅' }, type: 1 }
								],
								mentions: [m.sender]
							});
						}
					} else {
						const welcomeFree = `Halo semua aku adalah *${botname}*! 👋\n\nKarena di grup ini terdapat *Owner*, bot otomatis diaktifkan secara gratis! 🎉\nSilakan gunakan seluruh fitur-fitur bot dengan normal!`;
						await naze.sendMessage(m.chat, { text: welcomeFree });
					}
				}
			}
		}
		
		const body = ((m.type === 'conversation') ? m.message.conversation :
		(m.type == 'imageMessage') ? m.message.imageMessage.caption :
		(m.type == 'videoMessage') ? m.message.videoMessage.caption :
		(m.type == 'extendedTextMessage') ? m.message.extendedTextMessage.text :
		(m.type == 'reactionMessage') ? m.message.reactionMessage.text :
		(m.type == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId :
		(m.type == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
		(m.type == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId :
		(m.type == 'interactiveResponseMessage'  && m.quoted) ? (m.message.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : '') :
		(m.type == 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || '') :
		(m.type == 'editedMessage') ? (m.message.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation || '') :
		(m.type == 'protocolMessage') ? (m.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.protocolMessage?.editedMessage?.conversation || m.message.protocolMessage?.editedMessage?.imageMessage?.caption || m.message.protocolMessage?.editedMessage?.videoMessage?.caption || '') : '') || '';
		
		const budy = (typeof m.text == 'string' ? m.text : '')
		const startsWithTi = /^ti\b/i.test(budy);
		const botLid = naze.user.lid ? naze.decodeJid(naze.user.lid) : null;
		const botCleanNumber = botNumber.split('@')[0];
		const botCleanLid = botLid ? botLid.split('@')[0] : null;
		const hasBotTag = budy.includes(`@${botCleanNumber}`) || (botCleanLid && budy.includes(`@${botCleanLid}`));
		let isMentioned = (m.mentionedJid && m.mentionedJid.some(jid => {
			let decoded = naze.decodeJid(jid);
			return decoded === botNumber || (botLid && decoded === botLid);
		})) || hasBotTag;

		const isCreator = global.isOwner = ownerNumber.some(owner => {
			const ownerJid = owner.includes('@') ? owner : owner + '@s.whatsapp.net';
			const findJid = naze.findJidByLid(jidNormalizedUser(ownerJid), store, true);
			if (!findJid) return false
			return findJid === m.sender
		});
		const symbolMatch = body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@()#,'"*+÷/\%^&.©^]/gi);
		const emojiMatch = body.match(/^[\uD800-\uDBFF][\uDC00-\uDFFF]/gi); 
		const listMatch = global.listprefix.find(a => body?.startsWith(a));
		const detectedPrefix = symbolMatch ? symbolMatch[0] : (emojiMatch ? emojiMatch[0] : listMatch);
		const prefix = isCreator ? (detectedPrefix || set.authorPrefix) : set.multiprefix ? (detectedPrefix || '¿') : (listMatch || '¿');
		let isCmd = body.startsWith(prefix) && (!m.key.fromMe || !naze.public)
		const args = body.trim().split(/ +/).slice(1)
		const quoted = m.quoted ? m.quoted : m
		let command = isCmd ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
		if (isCmd && prefix === '@' && /^\d+$/.test(command)) {
			isCmd = false;
			command = '';
		}
		if (isCmd && prefix === '' && (/^(ti|ai)$/i.test(command.replace(/[^a-zA-Z]/g, '')))) {
			isCmd = false;
			command = '';
		}
		const text = global.q = args.join(' ');
		const mime = (quoted.msg || quoted).mimetype || ''
		const qmsg = (quoted.msg || quoted)
		const author = set.author = global.author || 'Ti Assistant Bot';
		const packname = set.packname = global.packname || 'Bot WhatsApp';
		const botname = set.botname = global.botname || 'Ti Assistant Bot';
		const badWordsLower = global.badWords.map(v => v.toLowerCase());
		const locale_day = moment.tz(global.timezone).locale(global.locale).format('dddd');
		const date = moment.tz(global.timezone).locale(global.locale).format('DD/MM/YYYY');
		const date_time = moment.tz(global.timezone).locale(global.locale).format('HH:mm:ss');
		const ucapanWaktu = date_time < '05:00:00' ? 'Selamat Pagi 🌉' : date_time < '11:00:00' ? 'Selamat Pagi 🌄' : date_time < '15:00:00' ? 'Selamat Siang 🏙' : date_time < '18:00:00' ? 'Selamat Sore 🌅' : date_time < '19:00:00' ? 'Selamat Sore 🌃' : date_time < '23:59:00' ? 'Selamat Malam 🌌' : 'Selamat Malam 🌌';
		const almost = 0.66
		const time = Date.now()
		const time_now = new Date()
		const time_end = 60000 - (time_now.getSeconds() * 1000 + time_now.getMilliseconds());
		const readmore = String.fromCharCode(8206).repeat(999)
		const setv = pickRandom(global.listv)
		
		const handleAIResponse = async (answer) => {
			if (!answer) return;
			
			const userQuery = (budy || body || '').toLowerCase();
			
			// Check if user is asking for text-only output (e.g., poem, story, script, info, news)
			const textOnlyKeywords = [
				'puisi', 'cerita', 'lirik', 'pantun', 'dongeng', 'essay', 'esai', 'artikel', 
				'kode', 'code', 'script', 'lelucon', 'joke', 'candaan', 'soal', 'tugas', 
				'rumus', 'sejarah', 'biografi', 'sapaan', 'chat', 'percakapan', 'berita', 
				'news', 'informasi', 'info', 'website', 'situs', 'web', 'aplikasi', 'app'
			];
			const hasTextOnlyTarget = textOnlyKeywords.some(kw => userQuery.includes(kw));
			
			// Check if user query contains image keywords
			const imageKeywords = [
				'gambar', 'foto', 'image', 'photo', 'pic', 'picture', 'painting', 'lukisan', 
				'wallpaper', 'ilustrasi', 'illustration', 'art', 'sketsa', 'sketch', 'draw', 
				'paint', 'avatar', 'logo', 'icon', 'potret', 'portrait', 'lukis', 'visual', 
				'desain', 'design', 'grafis', 'graphic', 'anime', 'gambarkan', 'gambarin', 
				'vector', 'vektor', '3d', 'render', 'banner', 'poster'
			];
			const hasImageTarget = imageKeywords.some(kw => userQuery.includes(kw));
			const hasImageAction = /^(buatkan|bikin|generate|cari|carikan|kirim|kirimin|kasih|tampilkan|draw|paint|create|design)\b/i.test(userQuery);
			const isImageAllowed = hasImageTarget || (hasImageAction && !hasTextOnlyTarget);
			
			// Check if user query contains audio/video keywords
			const audioKeywords = [
				'lagu', 'audio', 'musik', 'music', 'sound', 'mp3', 'vn', 'voice', 'suara', 'sing', 'nyanyi', 'sholawat', 'murottal', 'podcast'
			];
			const hasAudioTarget = audioKeywords.some(kw => userQuery.includes(kw));
			
			const videoKeywords = [
				'video', 'film', 'movie', 'vid', 'mp4', 'bioskop', 'cinema'
			];
			const hasVideoTarget = videoKeywords.some(kw => userQuery.includes(kw));
			const hasPlayAction = /^(putar|play|kirim|kirimin|play_audio|play_video)\b/i.test(userQuery);
			
			const isAudioAllowed = hasAudioTarget || (hasPlayAction && !hasTextOnlyTarget && !hasImageTarget);
			const isVideoAllowed = hasVideoTarget || (hasPlayAction && !hasTextOnlyTarget && !hasImageTarget);
			
			const isPlaceholder = (val) => {
				const lower = val.trim().toLowerCase();
				const placeholders = [
					'prompt', 'english_prompt', '<prompt>', 'query', '<query>', 'query_pencarian', 
					'judul', '<judul>', 'nama_game', 'teks_pesan', 'durasi', 'pesan', 'nomor', '@nomor'
				];
				return placeholders.some(ph => lower.includes(ph)) || lower === '...' || lower === '';
			};

			// Clean all special tags from the displayed text
			let cleanedAnswer = answer.replace(/\[EXECUTE:\s*(\w+)(?:\s+(.*?))?\]/gi, '').replace(/\[IMAGE_GEN:\s*(.*?)\]/gi, '').replace(/\[IMAGE_SEARCH:\s*(.*?)\]/gi, '').replace(/\[PLAY_AUDIO:\s*(.*?)\]/gi, '').replace(/\[PLAY_VIDEO:\s*(.*?)\]/gi, '').trim();
			if (cleanedAnswer) {
				const mentions = parseMention(cleanedAnswer);
				if (mentions.length > 0) {
					await naze.sendMessage(m.chat, { text: cleanedAnswer, mentions }, { quoted: m });
				} else {
					m.reply(cleanedAnswer);
				}
			}
			
			// Handle IMAGE_GEN tag
			const imgGenMatch = answer.match(/\[IMAGE_GEN:\s*(.*?)\]/i);
			if (imgGenMatch && isImageAllowed && !isPlaceholder(imgGenMatch[1])) {
				const imgPrompt = imgGenMatch[1].trim();
				try {
					m.react('🎨');
					const encodedPrompt = encodeURIComponent(imgPrompt);
					const imgUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&seed=${Date.now()}`;
					const imgBuffer = await getBuffer(imgUrl);
					if (imgBuffer) {
						await naze.sendMessage(m.chat, { image: imgBuffer, caption: `🎨 *Generated Image*\n\n_Prompt: ${imgPrompt}_` }, { quoted: m });
					} else {
						m.reply('Gagal generate gambar, coba lagi nanti.');
					}
				} catch (e) {
					console.error('Image generation error:', e);
					m.reply('Gagal generate gambar: ' + (e.message || 'Unknown error'));
				}
			}
			
			// Handle IMAGE_SEARCH tag
			const imgSearchMatch = answer.match(/\[IMAGE_SEARCH:\s*(.*?)\]/i);
			if (imgSearchMatch && isImageAllowed && !isPlaceholder(imgSearchMatch[1])) {
				const searchQuery = imgSearchMatch[1].trim();
				try {
					m.react('🔍');
					const res = await fetchApi('/search/pinterest', { query: searchQuery });
					if (res?.result && res.result.length > 0) {
						const imgResult = pickRandom(res.result);
						const imgBuffer = await getBuffer(imgResult);
						if (imgBuffer) {
							await naze.sendMessage(m.chat, { image: imgBuffer, caption: `🔍 *Hasil Pencarian Gambar*\n\n_Query: ${searchQuery}_` }, { quoted: m });
						} else {
							m.reply('Gagal mendownload gambar hasil pencarian.');
						}
					} else {
						m.reply('Gambar tidak ditemukan untuk: ' + searchQuery);
					}
				} catch (e) {
					console.error('Image search error:', e);
					m.reply('Gagal mencari gambar: ' + (e.message || 'Unknown error'));
				}
			}
			
			// Handle PLAY_AUDIO tag - direct audio download by search query
			const playAudioMatch = answer.match(/\[PLAY_AUDIO:\s*(.*?)\]/i);
			if (playAudioMatch && isAudioAllowed && !isPlaceholder(playAudioMatch[1])) {
				const audioQuery = playAudioMatch[1].trim();
				try {
					m.react('🎵');
					let hasil, videoUrl;
					try {
						const res = await yts.search(audioQuery);
						hasil = res.all[0];
						videoUrl = hasil?.url || '';
					} catch {
						const res = await fetchApi('/search/youtube', { query: audioQuery });
						hasil = res.result.items[0];
						videoUrl = `https://youtu.be/${hasil?.id?.videoId || ''}`;
					}
					if (!videoUrl) throw new Error('Video not found');
					try {
						const { result: dl } = await fetchApi('/download/youtube', { url: videoUrl });
						if (dl?.download && dl.type === 'audio') {
							await m.reply({ audio: { url: dl.download }, mimetype: 'audio/mpeg' });
						} else {
							throw new Error('Not an audio result');
						}
					} catch {
						let audioPath = null;
						try {
							const dl = await ytMp3(videoUrl);
							audioPath = dl.result;
							if (audioPath && fs.existsSync(audioPath)) {
								await m.reply({ audio: { url: audioPath }, mimetype: 'audio/mpeg' });
							}
						} catch (e) {
							console.error('ytMp3 failed:', e);
						} finally {
							if (audioPath && fs.existsSync(audioPath)) {
								try { fs.unlinkSync(audioPath); } catch {}
							}
						}
					}
				} catch (e) {
					console.error('Play audio error:', e);
					m.reply('Gagal mengirim audio: ' + (e.message || 'Coba lagi nanti.'));
				}
			}
			
			// Handle PLAY_VIDEO tag - direct video download by search query
			const playVideoMatch = answer.match(/\[PLAY_VIDEO:\s*(.*?)\]/i);
			if (playVideoMatch && isVideoAllowed && !isPlaceholder(playVideoMatch[1])) {
				const videoQuery = playVideoMatch[1].trim();
				try {
					m.react('🎬');
					let hasil, videoUrl;
					try {
						const res = await yts.search(videoQuery);
						hasil = res.all[0];
						videoUrl = hasil?.url || '';
					} catch {
						const res = await fetchApi('/search/youtube', { query: videoQuery });
						hasil = res.result.items[0];
						videoUrl = `https://youtu.be/${hasil?.id?.videoId || ''}`;
					}
					if (!videoUrl) throw new Error('Video not found');
					
					let sent = false;
					const videoTitle = hasil?.title || videoQuery;
					
					// Method 1: Try local ytMp4 (uses yt-dlp forcing H.264)
					let videoPath = null;
					try {
						const dl = await ytMp4(videoUrl);
						videoPath = dl.result;
						if (videoPath && fs.existsSync(videoPath)) {
							const size = fs.statSync(videoPath).size;
							if (size > 16 * 1024 * 1024) {
								await m.reply('Ukuran video melebihi 16MB. Mengirim sebagai dokumen...');
								await m.reply({ document: { url: videoPath }, mimetype: 'video/mp4', fileName: `${dl.title || videoTitle}.mp4`, caption: `🎬 *${dl.title || videoTitle}*` });
							} else {
								await m.reply({ video: { url: videoPath }, caption: `🎬 *${dl.title || videoTitle}*` });
							}
							sent = true;
						}
					} catch (e) {
						console.error('ytMp4 failed:', e.message);
					} finally {
						if (videoPath && fs.existsSync(videoPath)) {
							try { fs.unlinkSync(videoPath); } catch {}
						}
					}
					
					// Method 2: Try fetchApi as fallback
					if (!sent) {
						const formats = ['360', '480', '720', '1080'];
						for (const fmt of formats) {
							if (sent) break;
							try {
								const { result: dl } = await fetchApi('/download/youtube', { url: videoUrl, format: fmt });
								if (dl?.download && dl.type === 'video') {
									await m.reply({ video: { url: dl.download }, caption: `🎬 *${dl.title || videoTitle}*` });
									sent = true;
								}
							} catch {}
						}
					}
					
					if (!sent) throw new Error('Semua metode download video gagal');
				} catch (e) {
					console.error('Play video error:', e);
					m.reply('Gagal mengirim video: ' + (e.message || 'Coba lagi nanti.'));
				}
			}
			
			// Parse EXECUTE command
			const execMatch = answer.match(/\[EXECUTE:\s*(\w+)(?:\s+(.*?))?\]/i);
			if (execMatch && !isPlaceholder(execMatch[1]) && (!execMatch[2] || !isPlaceholder(execMatch[2]))) {
				const execCmd = execMatch[1].toLowerCase();
				const execArgs = execMatch[2] ? execMatch[2].trim() : '';
				
				if (casesArray.includes(execCmd)) {
					// List of admin-only commands
					const adminCommands = ['kick', 'promote', 'demote', 'group', 'hidetag', 'tagall', 'revoke', 'linkgroup', 'linkgrup'];
					
					if (adminCommands.includes(execCmd)) {
						if (!m.isGroup) {
							return m.reply(global.mess.group);
						}
						if (!m.isAdmin && !isCreator) {
							return m.reply("Maaf, tindakan ini hanya bisa dilakukan oleh Admin grup.");
						}
						if (!m.isBotAdmin) {
							return m.reply(global.mess.botAdmin);
						}
					}
					
					// Parse mentions from the arguments
					let parsedMentions = parseMention(execArgs);
					
					// Resolve JIDs to LIDs if present in original mentions or group metadata
					const originalMentions = m.mentionedJid || [];
					const groupParticipants = m.metadata?.participants || [];
					parsedMentions = parsedMentions.map(jid => {
						const num = jid.split('@')[0];
						const matchOriginal = originalMentions.find(j => j.split('@')[0] === num);
						if (matchOriginal) return matchOriginal;
						const matchGroup = groupParticipants.find(p => (p.id || '').split('@')[0] === num);
						if (matchGroup) return matchGroup.id || matchGroup;
						return jid;
					});
					
					// Construct simulated message
					let simulatedM = {
						...m,
						type: 'conversation',
						message: { conversation: `${prefix}${execCmd} ${execArgs}` },
						mentionedJid: parsedMentions.length > 0 ? parsedMentions : originalMentions
					};
					
					// Execute recursively!
					await nazeHandler(naze, simulatedM, msg, store);
				} else {
					m.reply(`Command "${execCmd}" tidak ditemukan di bot ini.`);
				}
			}
		};
		
		const isVip = isCreator || (db.users[m.sender] ? db.users[m.sender].vip : false)
		const isBan = isCreator || (db.users[m.sender] ? db.users[m.sender].ban : false)
		const isLimit = isCreator || (db.users[m.sender] ? (db.users[m.sender].limit > 0) : false)
		const isPremium = isCreator || checkStatus(m.sender, premium) || false
		const isNsfw = m.isGroup ? db.groups[m.chat].nsfw : false
		
		// Fake
		const fkontak = {
			key: {
				remoteJid: '0@s.whatsapp.net',
				participant: '0@s.whatsapp.net',
				fromMe: false,
				id: 'Naze'
			},
			message: {
				contactMessage: {
					displayName: (m.pushName || author),
					vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;${m.pushName || author},;;;\nFN:${m.pushName || author}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
					sendEphemeral: true
				}
			}
		}
		
		// Auto Set Bio
		if (set.autobio) {
			if (new Date() * 1 - set.status > 60000) {
				await naze.updateProfileStatus(`${naze.user.name} | 🎯 Runtime : ${runtime(process.uptime())}`).catch(e => {})
				set.status = new Date() * 1
			}
		}
		
		// Set Mode
		if (!isCreator) {
			if ((set.grouponly === set.privateonly)) {
				if (!naze.public && !m.key.fromMe) return
			} else if (set.grouponly) {
				if (!m.isGroup && !startsWithTi && !isMentioned) return
			} else if (set.privateonly) {
				if (m.isGroup) return
			}

			// Whitelist Chats
			if (set.whitelistonly && naze.public && set.whitelist.length > 0 && !set.whitelist.includes(m.chat)) return
		}
		
		// Auto Read
		if (m.message && m.key.remoteJid !== 'status@broadcast') {
			if ((set.autoread && naze.public) || isCreator) {
				naze.readMessages([m.key]);
				if (set.log) console.log(chalk.black(chalk.whiteBright('[CHAT]:'), chalk.greenBright(`${locale_day} ${date} (${date_time})`), chalk.hex('#AF26EB')(m.key.id) + '\n' + chalk.hex('#00EAD3')(budy || m.type) + '\n' + chalk.cyanBright('[FROM]:'), chalk.yellowBright(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.hex('#FF449F')(m.sender.split('@')[0]), chalk.hex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.blueBright('(' + m.chat + ')')));
				else console.log(chalk.black(chalk.bgWhite('[CHAT]:'), chalk.bgGreen(`${locale_day} ${date} (${date_time})`), chalk.bgHex('#AF26EB')(m.key.id) + '\n' + chalk.bgHex('#00EAD3')(budy || m.type) + '\n' + chalk.bgCyanBright('[FROM]:'), chalk.bgYellow(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.bgHex('#FF449F')(m.sender), chalk.bgHex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.bgBlue('(' + m.chat + ')')));
			}
		}
		
		// Group Settings
		if (m.isGroup) {
			// Mute
			if (db.groups[m.chat].mute && !isCreator) {
				return
			}
			
			// Anti Hidetag
			if (!m.key.fromMe && m.mentionedJid?.length === m.metadata.participants?.length && db.groups[m.chat].antihidetag && !isCreator && m.isBotAdmin && !m.isAdmin) {
				await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
				await m.reply('*Anti Hidetag Sedang Aktif❗*')
			}
			
			// Anti Tag Sw
			if (!m.key.fromMe && db.groups[m.chat].antitagsw && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (m.type === 'groupStatusMentionMessage' || m.message?.groupStatusMentionMessage || m.message?.protocolMessage?.type === 25 || Object.keys(m.message).length === 1 && Object.keys(m.message)[0] === 'messageContextInfo') {
					if (!db.groups[m.chat].tagsw[m.sender]) {
						db.groups[m.chat].tagsw[m.sender] = 1
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`)
					} else if (db.groups[m.chat].tagsw[m.sender] >= 5) {
						await naze.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch((err) => m.reply(global.mess.fail))
						await m.reply(`@${m.sender.split("@")[0]} telah dikeluarkan dari grup\nKarena menandai grup dalam status WhatsApp sebanyak 5x`)
						delete db.groups[m.chat].tagsw[m.sender]
					} else {
						db.groups[m.chat].tagsw[m.sender] += 1
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`)
					}
				}
			}
			
			// Anti Toxic
			if (!m.key.fromMe && db.groups[m.chat].antitoxic && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.toLowerCase().split(/\s+/).some(word => badWordsLower.includes(word))) {
					await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await naze.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Berkata Toxic\nMohon gunakan bahasa yang sopan.`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Toxic❗*'}, ...m.key }}}, {})
				}
			}
			
			// Anti Delete
			if (m.type === 'protocolMessage' && m.msg?.type === 0 && db.groups[m.chat].antidelete && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (store?.messages?.[m.chat]?.array) {
					const chats = store.messages[m.chat].array.find(a => a.key.id === m.msg.key.id);
					if (!chats?.message) return
					const msgType = Object.keys(chats.message)[0];
					const msgContent = chats.message[msgType];
					if (msgContent.fileSha256 && msgContent.mediaKey) {
						msgContent.mediaKey = fixBytes(msgContent.mediaKey);
						msgContent.fileSha256 = fixBytes(msgContent.fileSha256);
						msgContent.fileEncSha256 = fixBytes(msgContent.fileEncSha256);
					}
					if (msgType !== 'conversation') msgContent.contextInfo = { mentionedJid: [chats.key.participantAlt], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Delete❗*'}, ...chats.key }
					const pesan = msgType === 'conversation' ? { extendedTextMessage: { text: msgContent, contextInfo: { mentionedJid: [chats.key.participantAlt], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Delete❗*'}, ...chats.key }}} : { [msgType]: msgContent }
					await naze.relayMessage(m.chat, pesan, {})
				}
			}
			
			// Anti Link Group
			if (db.groups[m.chat].antilink && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.match('chat.whatsapp.com/')) {
					await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await naze.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Link Group\nMaaf Link Harus Di Hapus..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Link❗*'}, ...m.key }}}, {})
				}
			}
			
			// Anti Virtex Group
			if (db.groups[m.chat].antivirtex && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.length > 4500) {
					await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await naze.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Virtex..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Virtex❗*'}, ...m.key }}}, {})
					await naze.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
				}
				if (m.msg?.nativeFlowMessage?.messageParamsJson?.length > 3500) {
					await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await naze.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Bug..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Bug❗*'}, ...m.key }}}, {})
					await naze.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
				}
			}
			
		}
		
		// Filter Bot & Ban
		if (m.isBot) return
		if (isBan && !isCreator) return
		
		// Intercept non-sewa groups
		const hasOwnerInGroup = m.isGroup && m.metadata?.participants?.some(p => {
			const cleanId = (p.id || '').split('@')[0].split(':')[0];
			const cleanPhone = (p.phoneNumber || '').split('@')[0].split(':')[0];
			const botClean = botNumber.split('@')[0];
			if (cleanId === botClean || cleanPhone === botClean) return false;
			return (cleanId && ownerNumber.includes(cleanId)) || (cleanPhone && ownerNumber.includes(cleanPhone));
		});
		if (global.db.sewaBotToggle !== false && isCmd && m.isGroup && !isCreator && !checkStatus(m.chat, sewa) && !hasOwnerInGroup) {
			const welcomeSewa = `Untuk menggunakan bot ini di grup Anda, silakan melakukan penyewaan terlebih dahulu.\n\nSilakan tekan link di bawah ini untuk melakukan sewa langsung ke chat pribadi bot:\n👉 https://wa.me/${botNumber.split('@')[0]}?text=.sewa%20${m.chat}`;
			return m.reply(welcomeSewa);
		}
		
		// Filter Set Api Key
		if (cases.includes(command) && isCmd && (command !== 'setapikey')) {
			const currentKey = global.APIKeys[global.APIs.naze];
			if (currentKey === 'YOUR_API_KEY' || !currentKey.startsWith('nz-')) {
				return m.reply('Silahkan Ganti Apikey yang ada\ndi File settings.js dengan apikey mu\nAgar semua fitur bisa digunakan dengan normal\n\nAmbil Key di : https://naze.biz.id/profile\nKemudian Gunakan Perintah\n.setapikey key_nya');
			}
		}
		
		// Mengetik & Anti Spam & Hit
		if (naze.public && isCmd) {
			if (set.autotyping) {
				await naze.sendPresenceUpdate('composing', m.chat)
			}
			if (cases.includes(command)) {
				cmdAdd(db.hit);
				cmdAddHit(db.hit, command);
			}
			if (set.antispam && antiSpam.isFiltered(m.sender)) {
				console.log(chalk.bgRed('[ SPAM ] : '), chalk.black(chalk.bgHex('#1CFFF7')(`From -> ${m.sender}`), chalk.bgHex('#E015FF')(` In ${m.isGroup ? m.chat : 'Private Chat'}`)))
				return m.reply('「 ❗ 」Beri Jeda 5 Detik Per Command Kak')
			}
			
			if (command && set.didyoumean) {
				let isCommandValid = cases.some(c => c.toLowerCase() === command.toLowerCase());
				if (!isCommandValid) {
					let matches = [];
					for (const c of cases) {
						let cmdTarget = c.toLowerCase();
						let cmdInput = command.toLowerCase();
						let sim = similarity(cmdInput, cmdTarget);
						let lengthDiff = Math.abs(cmdInput.length - cmdTarget.length);
						let isStartsWith = cmdTarget.startsWith(cmdInput);
						if ( ((sim >= almost && lengthDiff <= 3) || isStartsWith) && cmdInput !== cmdTarget ) {
							matches.push({
								name: c, score: isStartsWith ? parseInt(sim * 100) + 10 : parseInt(sim * 100) 
							});
						}
					}
					if (matches.length > 0) {
						matches.sort((a, b) => b.score - a.score);
						let topMatches = matches.slice(0, 5);
						let replyText = `Command Tidak Ditemukan!\nMungkin yang kamu maksud:\n`;
						for (let i = 0; i < topMatches.length; i++) {
							let finalScore = topMatches[i].score > 99 ? 99 : topMatches[i].score;
							replyText += `- ${prefix + topMatches[i].name} (Similarity: ${finalScore}%)\n`;
						}
						return m.reply(replyText.trim());
					}
				}
			}
		}
		
		if (isCmd && !isCreator) antiSpam.addFilter(m.sender)
		
		// Cmd Media
		let fileSha256;
		if (m.isMedia && m.msg.fileSha256 && db.cmd && (m.msg.fileSha256.toString('base64') in db.cmd)) {
			let hash = db.cmd[m.msg.fileSha256.toString('base64')]
			fileSha256 = hash.text
		}
		
		// Salam
		if (/^a(s|ss)alamu('|)alaikum(| )(wr|)( |)(wb|)$/.test(budy?.toLowerCase())) {
			const jwb_salam = ['Wa\'alaikumusalam','Wa\'alaikumusalam wr wb','Wa\'alaikumusalam Warohmatulahi Wabarokatuh']
			m.reply(pickRandom(jwb_salam))
		}
		
		// No-prefix "ti" or tag trigger for AI & conversion interception

		if (!m.key.fromMe && (startsWithTi || isMentioned)) {
			if (set.autotyping) {
				await naze.sendPresenceUpdate('composing', m.chat).catch(() => {})
			}
		}

		// Extract query for both interception and AI trigger
		let rawQuery = budy;
		if (startsWithTi) {
			rawQuery = rawQuery.replace(/^ti\b/i, '');
		}
		const mentionRegex = new RegExp(`@${botCleanNumber}\\b`, 'g');
		let tiQuery = rawQuery.replace(mentionRegex, '');
		if (botCleanLid) {
			const lidRegex = new RegExp(`@${botCleanLid}\\b`, 'g');
			tiQuery = tiQuery.replace(lidRegex, '');
		}
		tiQuery = tiQuery.replace(/^\s*[,.?/\\-]\s*/, '').trim();

		// Intercept conversion keywords when replying to media
		if (m.quoted && !isCmd && !m.key.fromMe && (startsWithTi || isMentioned)) {
			const query = tiQuery.toLowerCase();
			const qMime = (quoted.msg || quoted).mimetype || '';
			
			if (quoted.type === 'stickerMessage' || /webp/i.test(qMime)) {
				if (/\b(gambar|foto|image|img|toimg|toimage|png|jpg|jpeg)\b/i.test(query)) {
					command = 'toimage';
					isCmd = true;
				}
			} else if (/image|video/i.test(qMime)) {
				if (/\b(stiker|sticker|s|tosticker|tostiker)\b/i.test(query)) {
					command = 'sticker';
					isCmd = true;
				}
			}
			
			if (/video|audio/i.test(qMime)) {
				if (/\b(audio|mp3|tomp3|toaudio|vn|tovn|suara|lagu)\b/i.test(query)) {
					command = /\b(mp3|tomp3)\b/i.test(query) ? 'tomp3' : 'toaudio';
					isCmd = true;
				}
			}
			
			if (/\b(delete|del|hapus)\b/i.test(query)) {
				command = 'delete';
				isCmd = true;
			}
			
			// Intercept nulis/tulis keywords when replying to text or image
			if (/\b(nulis|tulis|tuliskan|nuliskiri|nuliskanan|tulis\s*(di\s*)?buku|tulis\s*(di\s*)?folio)\b/i.test(query)) {
				let nulisText = '';
				const quotedBody = m.quoted?.body || m.quoted?.text || '';
				const quotedMime = (m.quoted?.msg || m.quoted || {}).mimetype || '';
				
				// Determine nulis sub-command from user query
				let nulisCmd = 'nuliskiri'; // default
				if (/kanan/i.test(query)) nulisCmd = 'nuliskanan';
				if (/folio.*kiri|kiri.*folio/i.test(query)) nulisCmd = 'foliokiri';
				if (/folio.*kanan|kanan.*folio/i.test(query)) nulisCmd = 'foliokanan';
				if (/folio/i.test(query) && !/kanan|kiri/i.test(query)) nulisCmd = 'foliokiri';
				
				if (quotedBody && quotedBody.trim().length > 0) {
					// Replying to text message → directly use the text
					nulisText = quotedBody.trim();
				} else if (/image/i.test(quotedMime)) {
					// Replying to image → OCR first, then use extracted text
					try {
						m.react('⏳');
						const mediaPath = await naze.downloadAndSaveMediaMessage(m.quoted.msg || m.quoted);
						const uploadRes = await UguuSe(mediaPath);
						if (uploadRes && uploadRes.url) {
							const ocrRes = await fetchApi('/tools/ocr', { url: uploadRes.url });
							const ocrText = ocrRes?.result?.ParsedResults?.[0]?.ParsedText;
							if (ocrText && ocrText.trim().length > 0) {
								nulisText = ocrText.trim();
							} else {
								m.reply('Tidak ada teks yang terdeteksi di gambar tersebut. Pastikan gambar berisi teks yang jelas.');
							}
						}
						if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
					} catch (e) {
						console.error('[Nulis OCR Error]', e);
						m.reply('Gagal membaca teks dari gambar: ' + (e.message || 'Coba lagi nanti.'));
					}
				}
				
				if (nulisText) {
					// Simulate the nulis command via recursive handler
					let simulatedM = {
						...m,
						type: 'conversation',
						message: { conversation: `${prefix}${nulisCmd} ${nulisText}` },
					};
					isCmd = true;
					command = '__nulis_handled__'; // prevent further AI processing
					await nazeHandler(naze, simulatedM, msg, store);
					return; // stop processing this message
				}
			}
		}

		if (!isCmd && !m.key.fromMe && (startsWithTi || isMentioned)) {
			if (true) {
				// Build context
				let contextInfo = '';
				if (m.isGroup) {
					const groupName = m.metadata?.subject || 'Unknown';
					const members = m.metadata?.participants || [];
					const memberList = members.map(p => {
						const num = (p.phoneNumber || p.id || '').split('@')[0].split(':')[0];
						return num;
					}).filter(Boolean);
					contextInfo += `\n[INFO GRUP] Nama grup: "${groupName}", Jumlah anggota: ${memberList.length} orang.`;
					contextInfo += `\nDaftar nomor anggota grup: ${memberList.join(', ')}`;
					contextInfo += `\nJika diminta menandai/tag semua anggota, tulis setiap anggota dengan format @nomor (contoh: @628xxx). Jangan menolak.
- Jika user meminta untuk tag/sebut salah satu anggota ("tag salah satu", "tag 1 orang", "tag acak", "tag disini", "tag salah satu anggota disini"), kamu WAJIB memilih 1 nomor anggota secara acak dari daftar nomor anggota grup di atas dan langsung menyebutnya/tag mereka di dalam responmu dengan format @nomor (contoh: "Halo @628xxx!"). JANGAN MENOLAK, jangan beralasan perlu izin admin, dan JANGAN menyertakan tag [EXECUTE: tag] atau command khayalan lainnya. Cukup sebut langsung nomornya menggunakan format @nomor di dalam teks responmu.`;
				} else {
					contextInfo += `\n[INFO] Ini adalah chat pribadi (private chat).`;
				}
				const senderNum = m.sender.split('@')[0].split(':')[0];
				const senderName = m.pushName || 'User';
				contextInfo += `\nPengirim pesan ini: ${senderName} (@${senderNum})`;
				contextInfo += `\n[WAKTU SEKARANG] Hari: ${locale_day}, Tanggal: ${date}, Jam: ${date_time} (${global.timezone}).`;
				contextInfo += `\n[FAKTA TERKINI - WAJIB DIPAKAI UNTUK MENJAWAB]
- Presiden Indonesia saat ini: Prabowo Subianto (dilantik 20 Oktober 2024, menggantikan Joko Widodo).
- Wakil Presiden Indonesia saat ini: Gibran Rakabuming Raka.
- Tahun sekarang: ${new Date().getFullYear()}.
- Jika kamu tidak yakin tentang fakta terkini, lebih baik sarankan user untuk bertanya lebih spesifik atau gunakan pencarian Google daripada memberikan informasi yang salah.`;
				
				if (m.quoted) {
					contextInfo += `\n[INFO PESAN YANG DI-REPLY/KUTIP]`;
					contextInfo += `\n- Pengirim: @${m.quoted.sender.split('@')[0]}`;
					contextInfo += `\n- Jenis/Tipe Pesan: ${m.quoted.type}`;
					if (m.quoted.isMedia) {
						contextInfo += `\n- Mimetype: ${m.quoted.mime}`;
					}
					if (m.quoted.body) {
						contextInfo += `\n- Isi/Teks Pesan: "${m.quoted.body}"`;
					}
					
					if (/document/.test(m.quoted.type || '')) {
						const docMime = (m.quoted.msg || m.quoted).mimetype || '';
						if (/pdf/.test(docMime)) {
							try {
								const pdfBuffer = await m.quoted.download();
								const { PDFParse } = await import('pdf-parse');
								const parser = new PDFParse({ data: pdfBuffer });
								const pdfData = await parser.getText();
								let pdfText = pdfData.text || '';
								await parser.destroy();
								
								if (pdfText.trim().length > 0) {
									if (pdfText.length > 15000) {
										pdfText = pdfText.substring(0, 15000) + '\n\n[...teks dokumen terpotong karena terlalu panjang]';
									}
									contextInfo += `\n- Isi/Teks Dokumen PDF yang di-reply: "${pdfText}"`;
								}
							} catch (e) {
								console.error('[PDF Extract Error for AI]', e);
							}
						}
					}
					
					contextInfo += `\nUser saat ini sedang me-reply pesan tersebut dan menyuruh Anda melakukan tindakan terhadapnya.`;
				}
				
				let imageUrl = '';
				if (/image/.test(mime)) {
					try {
						let media = await naze.downloadAndSaveMediaMessage(qmsg);
						let uploadRes = await UguuSe(media);
						if (uploadRes && uploadRes.url) {
							imageUrl = uploadRes.url;
							let ocrRes = await fetchApi('/tools/ocr', { url: imageUrl });
							let ocrText = ocrRes?.result?.ParsedResults?.[0]?.ParsedText;
							if (ocrText && ocrText.trim().length > 0) {
								contextInfo += `\n- Isi/Teks di dalam Gambar/Foto yang dikirim/di-reply: "${ocrText.trim()}"`;
							}
						}
						if (fs.existsSync(media)) fs.unlinkSync(media);
					} catch (e) {
						console.error('[OCR Error for AI]', e);
					}
				}
				
				const uniqueCommands = [...new Set(casesArray)];
				const ownerCommands = [
					'deletesession', 'delsession', 'deletesampah', 'delsampah', 'deletetemp', 'deltemp',
					'setmessbot', 'setbotmessages', 'setlimitbot', 'setbotlimit', 'setmoneybot', 'setbotmoney',
					'setnamebot', 'setbotname', 'setpacknamebot', 'setbotpackname', 'setauthorbot', 'setbotauthor',
					'setlocale', 'setlocalebot', 'setbotlocale', 'settimezone', 'settimezonebot', 'setbottimezone',
					'setapikey', 'setbotapikey', 'lockcmd', 'unlockcmd', 'ownermenu', 'shutdown', 'off', 'update',
					'upgrade', 'byq', 'setbio', 'setppbot', 'delppbot', 'addprefix', 'delprefix', 'removeprefix',
					'listprefix', 'addtoxic', 'addbadword', 'deltoxic', 'delbadword', 'listtoxic', 'listbadword',
					'join', 'leave', 'clearchat', 'getmsgstore', 'storemsg', 'blokir', 'block', 'listblock',
					'openblokir', 'unblokir', 'openblock', 'unblock', 'ban', 'banned', 'unban', 'unbanned',
					'mute', 'unmute', 'whitelist', 'addowner', 'delowner', 'adduang', 'addmoney', 'addlimit',
					'listpc', 'listgc', 'creategc', 'buatgc', 'sewaon', 'sewaoff', 'addsewa', 'bypasssewa',
					'delsewa', 'listsewa', 'addpr', 'addprem', 'addpremium', 'delpr', 'delprem', 'delpremium',
					'listpr', 'listprem', 'listpremium', 'upsw', 'addcase', 'getcase', 'delcase', 'backup',
					'accsewa', 'mode', 'public', 'self', 'anticall', 'autobio', 'autoread', 'autotyping',
					'readsw', 'multiprefix', 'antispam', 'didyoumean', 'testreminder', '19rujxl1e',
					'broadcastgroup', 'bcgroup', 'bcgc', 'broadcastuser', 'bcuser', 'bcchats', 'remindersolatall'
				];
				const allBotCommands = uniqueCommands.filter(c => c && c.length > 1 && c !== 'google' && !ownerCommands.includes(c)).join(', ');
				
				// List of executable commands
				contextInfo += `
\n[DAFTAR FITUR & PERINTAH BOT]
Kamu bisa menjalankan perintah bot secara otomatis jika diminta oleh user.
Berikut daftar seluruh perintah/command yang didukung di bot ini: ${allBotCommands}

Beberapa contoh penggunaan perintah oleh user:
1. kick: Mengeluarkan anggota. Format perintah user: .kick @nomor (jika ingin mengeksekusi, sertakan tag [EXECUTE: kick @nomor] di akhir respon)
2. promote: Menjadikan admin. Format perintah user: .promote @nomor (jika ingin mengeksekusi, sertakan tag [EXECUTE: promote @nomor] di akhir respon)
3. demote: Menurunkan jabatan admin. Format perintah user: .demote @nomor (jika ingin mengeksekusi, sertakan tag [EXECUTE: demote @nomor] di akhir respon)
4. group: Membuka/menutup grup. Format perintah user: .group open atau .group close (jika ingin mengeksekusi, sertakan tag [EXECUTE: group open] atau [EXECUTE: group close] di akhir respon)
5. hidetag: Mengirim pesan tag ke semua anggota grup. Format perintah user: .hidetag teks_pesan (jika ingin mengeksekusi, sertakan tag [EXECUTE: hidetag teks_pesan] di akhir respon)
6. tagall: Menyebut semua anggota grup. Format perintah user: .tagall (jika ingin mengeksekusi, sertakan tag [EXECUTE: tagall] di akhir respon)
7. linkgroup: Mendapatkan link undangan grup. Format perintah user: .linkgroup (jika ingin mengeksekusi, sertakan tag [EXECUTE: linkgroup] di akhir respon)
8. revoke: Mengubah/mereset link undangan grup. Format perintah user: .revoke (jika ingin mengeksekusi, sertakan tag [EXECUTE: revoke] di akhir respon)
9. delete: Menghapus pesan (hanya jika kamu merespon/reply pesan yang ingin dihapus). Format perintah user: .delete (jika ingin mengeksekusi, sertakan tag [EXECUTE: delete] di akhir respon)
10. suit: Bermain suit gunting batu kertas dengan orang lain. Format perintah user: .suit @nomor (jika ingin mengeksekusi, sertakan tag [EXECUTE: suit @nomor] di akhir respon)
11. reminder: Menyetel pengingat/reminder. Format perintah user: .reminder <durasi><pesan>. Durasi WAJIB menggunakan unit d (hari), h (jam), m (menit), atau s (detik) dan ditaruh tepat setelah nama command tanpa kata perantara. Contoh perintah user: .reminder 10s mandi (jika ingin mengeksekusi, sertakan tag [EXECUTE: reminder 10s mandi] di akhir respon)
12. reminderall: Menyetel pengingat massal (hanya di grup). Format perintah user: .reminderall <durasi><pesan>. Contoh perintah user: .reminderall 15m rapat (jika ingin mengeksekusi, sertakan tag [EXECUTE: reminderall 15m rapat] di akhir respon)
13. remindersolat: Mengaktifkan atau menonaktifkan pengingat waktu sholat otomatis di grup (hanya untuk admin). Format perintah user: .remindersolat on atau .remindersolat off (jika ingin mengeksekusi, sertakan tag [EXECUTE: remindersolat on] atau [EXECUTE: remindersolat off] di akhir respon)


[KONSEKUENSI PENGGUNAAN MEDIA YANG DI-REPLY]
Jika user me-reply suatu pesan media (gambar, video, stiker, audio) dan menyuruh Anda mengubah formatnya, Anda harus memicu perintah yang sesuai:
1. Jika user me-reply Gambar/Video/Gif dan ingin mengubahnya menjadi stiker: gunakan [EXECUTE: sticker]
2. Jika user me-reply Stiker dan ingin mengubahnya menjadi gambar: gunakan [EXECUTE: toimage]
3. Jika user me-reply Video/Audio dan ingin mengubahnya menjadi audio biasa: gunakan [EXECUTE: toaudio] atau [EXECUTE: tovn] (voice note)
4. Jika user me-reply Video/Audio dan ingin mengubahnya menjadi file MP3: gunakan [EXECUTE: tomp3]
5. Jika user me-reply pesan apa pun dan menyuruh menghapusnya (delete): gunakan [EXECUTE: delete]

[ATURAN PENGATURAN REMINDER]
Jika user meminta diingatkan (reminder):
1. Anda WAJIB menerjemahkan unit waktu Indonesia ke unit standar waktu bot: "detik" -> "s", "menit" -> "m", "jam" -> "h", "hari" -> "d".
2. Tuliskan durasi langsung setelah nama command, diikuti dengan pesan pengingat. Contoh: "ingetin 10 detik lagi mandi" -> [EXECUTE: reminder 10s mandi].
3. Jangan pernah menulis unit waktu penuh (seperti "10 detik" atau "10s detik") pada tag [EXECUTE: ...]. Harus disingkat (seperti "10s").

[ATURAN PERMAINAN / GAMES]
Jika user mengajak bermain game (contoh: tebakgambar, tebaklagu, susunkata, dll.):
1. Cek apakah nama game yang diminta ada di dalam daftar perintah bot di atas.
2. Jika ada, Anda WAJIB memicu permainan tersebut menggunakan format [EXECUTE: nama_game]. Contoh: "Ti play game tebakgambar" -> [EXECUTE: tebakgambar], "Ti main tebak lagu" -> [EXECUTE: tebaklagu].
3. JANGAN PERNAH menyimulasikan pertanyaan atau mengirim gambar game sendiri secara manual di teks jawaban Anda. Serahkan sepenuhnya kepada bot untuk memicu gamenya.

[ATURAN MUSIK / LAGU / VIDEO / AUDIO - SANGAT PENTING]
ATURAN UTAMA: Ketika user meminta kirim/play/putar lagu/audio/video/musik, Anda WAJIB LANGSUNG mengeksekusi tag yang sesuai. DILARANG KERAS memberikan rekomendasi teks, daftar lagu, bertanya balik, meminta konfirmasi, atau memberikan opsi. LANGSUNG EKSEKUSI.

Apapun yang user sebut setelah kata "kirim lagu/audio/video" atau "play" adalah JUDUL yang harus dicari di YouTube. Jangan analisis maknanya, jangan terjemahkan, jangan artikan — langsung pakai sebagai query pencarian.

1. KIRIM AUDIO / LAGU (langsung kirim file audio MP3):
   Kata kunci: "kirim lagu", "kirim audio", "kirimin lagu", "kirim musik", "play lagu", "play audio", "putar lagu", "putar audio"
   - WAJIB gunakan [PLAY_AUDIO: <query>] di akhir respon.
   - Contoh:
     * "Ti kirim lagu disarankan dibandung" -> "Siap, aku kirimkan lagunya! [PLAY_AUDIO: disarankan dibandung]"
     * "Ti kirim audio upin ipin" -> "Oke, aku kirimkan audionya! [PLAY_AUDIO: upin ipin]"
     * "Ti kirim lagu anjay" -> "Siap! [PLAY_AUDIO: anjay]"
     * "Ti play lagu dido thankyou" -> "Oke! [PLAY_AUDIO: dido thank you]"
     * "Ti kirimin lagu nissa sabyan" -> "Siap! [PLAY_AUDIO: nissa sabyan]"
     * "Ti kirim lagu terbaru 2024" -> "Oke! [PLAY_AUDIO: lagu terbaru 2024]"

2. KIRIM VIDEO (langsung kirim file video):
   Kata kunci: "kirim video", "kirimin video", "play video", "putar video", "kirim film"
   - WAJIB gunakan [PLAY_VIDEO: <query>] di akhir respon.
   - Contoh:
     * "Ti kirim video upin ipin" -> "Siap! [PLAY_VIDEO: upin ipin]"
     * "Ti play video lagu didi kempot" -> "Oke! [PLAY_VIDEO: didi kempot]"
     * "Ti kirimin video kucing lucu" -> "Oke! [PLAY_VIDEO: kucing lucu]"

3. PLAY (tampilkan pilihan download):
   HANYA jika user bilang "play" TANPA menyebut "lagu/audio/video" secara spesifik:
   - Gunakan [EXECUTE: play <judul>]. Contoh: "Ti play upin ipin" -> [EXECUTE: play upin ipin]

LARANGAN KERAS:
- DILARANG memberikan daftar rekomendasi lagu dalam bentuk teks.
- DILARANG bertanya "mau genre apa?", "mau artis apa?", "mau lagu yang mana?".
- DILARANG meminta konfirmasi atau klarifikasi judul.
- DILARANG menjelaskan cara menggunakan command .play atau sejenisnya.
- Apapun teks setelah kata kunci (kirim lagu/audio/video) = JUDUL LAGU. Langsung eksekusi!

[ATURAN GAMBAR / IMAGE]
Kamu memiliki kemampuan untuk MEMBUAT gambar AI dan MENCARI gambar dari internet.

1. GENERATE / BUAT GAMBAR AI:
Jika user meminta membuat, generate, atau bikin gambar (contoh: "Ti buatkan gambar kucing style art", "Ti generate gambar pemandangan"):
- Tulis prompt dalam bahasa Inggris yang mendeskripsikan gambar yang diminta.
- Sertakan tag [IMAGE_GEN: english_prompt] di akhir respon.
- Contoh: "Baik, aku buatkan gambar kucing style art! [IMAGE_GEN: a cute cat in artistic watercolor style]"

2. CARI / KIRIM GAMBAR:
Jika user meminta mencari, kirim, atau cari gambar (contoh: "Ti cari gambar kucing oren", "Ti kirim gambar mobil sport"):
- Sertakan tag [IMAGE_SEARCH: query_pencarian] di akhir respon.
- Contoh: "Aku carikan gambar kucing oren ya! [IMAGE_SEARCH: kucing oren lucu]"

ATURAN:
- Jika user menyebut "buatkan/generate/buat", gunakan [IMAGE_GEN].
- Jika user menyebut "cari/carikan/kirim/kirimin/kasih", gunakan [IMAGE_SEARCH].
- JANGAN gabungkan [IMAGE_GEN] dan [IMAGE_SEARCH] dalam satu respon.
- Prompt untuk [IMAGE_GEN] HARUS dalam bahasa Inggris agar hasilnya bagus.

[ATURAN TULIS / NULIS DI BUKU]
Jika user meminta "tulis", "nulis", "tulis dibuku", "tuliskan", "tulis di folio", atau sejenisnya:
1. Jika user sedang me-reply pesan TEKS atau GAMBAR yang berisi teks → BOT akan otomatis mengeksekusi perintah nulis. Kamu TIDAK perlu melakukan apa-apa (sudah ditangani otomatis oleh sistem).
2. Jika user TIDAK me-reply pesan apa pun → Jawab dengan sopan: "Silakan reply ke pesan teks atau gambar yang berisi teks yang ingin kamu tuliskan di buku, lalu kirim perintahnya lagi ya! 📝"
3. JANGAN gunakan [EXECUTE: nulis] atau [EXECUTE: nuliskiri], karena perintah nulis membutuhkan penanganan khusus oleh sistem.

[ATURAN PENGGUNAAN PERINTAH]
- Status pengirim pesan saat ini: ${m.isAdmin || isCreator ? 'ADMIN' : 'MEMBER'}.
- Perintah admin (seperti kick, promote, demote, group, hidetag, tagall, linkgroup, revoke) hanya boleh dijalankan jika pengirim pesan adalah ADMIN/CREATOR.
- Jika pengirim pesan adalah MEMBER (bukan admin) dan menyuruhmu melakukan tindakan admin tersebut, kamu WAJIB MENOLAKNYA dengan sopan (misal: "Maaf, Anda bukan admin grup ini.") dan JANGAN sertakan tag [EXECUTE: ...].
- Jangan pernah menyertakan tag [EXECUTE: ...] jika pengirim bukan admin untuk perintah admin.
- Ketika menyertakan tag [EXECUTE: ...], pastikan nama_command persis seperti yang tertulis di daftar perintah di atas (case-sensitive lowercase) dan letakkan tag tersebut di bagian paling akhir dari responmu.
- JANGAN PERNAH menuliskan tag [EXECUTE: ...], [IMAGE_GEN: ...], [IMAGE_SEARCH: ...], [PLAY_AUDIO: ...], atau [PLAY_VIDEO: ...] sebagai contoh, penjelasan, atau ilustrasi format di dalam teks jawabanmu. Tag tersebut adalah instruksi sistem rahasia. Jika kamu ingin memberi contoh perintah ke user, tulislah dengan format biasa dengan awalan titik (misal: ".kick @nomor" atau ".tagall").`;
				
				let googleContext = '';
				const isSimpleGreeting = /^(halo|helo|hi|hai|p|assalamualaikum|tes|test|pagi|siang|sore|malam)$/i.test(tiQuery);
				const isDirectAction = /^(buatkan|bikin|generate|cari|carikan|kirim|kirimin|putar|play|main)\b/i.test(tiQuery);
				const isNewsOrInfoQuery = /\b(berita|info|update|terbaru|hari\s+ini|siapa|apa|kapan|dimana|bagaimana|mengapa|artikel|link|url|website|situs|google|pencarian)\b/i.test(tiQuery);
				
				if (tiQuery.length >= 5 && !isSimpleGreeting && (!isDirectAction || isNewsOrInfoQuery)) {
					try {
						const searchRes = await fetchApi('/search/google', { query: tiQuery });
						if (searchRes && searchRes.result && searchRes.result.length > 0) {
							googleContext += `\n\n[HASIL PENCARIAN GOOGLE TERBARU (REAL-TIME)]`;
							googleContext += `\nBerikut adalah hasil pencarian Google terbaru untuk membantu Anda menjawab pertanyaan dengan sangat up-to-date, akurat, dan sesuai dengan fakta tahun ${new Date().getFullYear()}:`;
							const searchResults = searchRes.result.slice(0, 5);
							searchResults.forEach((item, index) => {
								googleContext += `\n${index + 1}. Judul: ${item.title}\n   Snippet: ${item.snippet || '-'}\n   Link: ${item.link}`;
							});
							googleContext += `\n\nATURAN PENGGUNAAN HASIL PENCARIAN GOOGLE:`;
							googleContext += `\n- JAWABLAH pertanyaan user berdasarkan informasi terbaru di atas.`;
							googleContext += `\n- Jika informasi di atas bertentangan dengan pengetahuan lamamu, gunakan informasi terbaru ini.`;
							googleContext += `\n- Jika user menanyakan daftar berita/informasi (meminta lebih dari satu, contoh: "5 berita tentang...", "cari berita-berita terbaru"), Anda WAJIB menyajikan daftar berita tersebut dengan menggunakan Judul dan Link asli yang valid dari hasil pencarian Google di atas secara persis. Jangan pernah memalsukan atau mengarang link.`;
							googleContext += `\n- Jika user hanya menanyakan satu hal saja (tidak meminta daftar/banyak berita, contoh: "siapa X?", "berita tentang Y hari ini"), Anda harus memberikan jawaban/kesimpulan yang dirangkum dari hasil pencarian di atas, serta tetap wajib menyertakan link sumber asli yang valid di akhir respon Anda.`;
							googleContext += `\n- Jangan menyebutkan "berdasarkan hasil pencarian Google" atau sejenisnya kecuali diminta. Cukup simpulkan dan jawab secara natural seolah-olah Anda sudah mengetahuinya.`;
							googleContext += `\n- PENTING: JANGAN PERNAH menyertakan link khayalan (seperti contohberita.id, website.com, dll). Semua link yang Anda tampilkan harus bersumber langsung dari hasil pencarian Google di atas secara persis.`;
						}
					} catch (searchError) {
						console.error('Error fetching Google context for AI:', searchError);
					}
				}
				contextInfo += googleContext;

				let aiQuery = tiQuery;
				if (aiQuery.length === 0) {
					const greetings = [
						"Halo! Saya TI Assistant Bot. Ada yang bisa saya bantu? 🤖",
						"Hai! TI Assistant Bot siap membantu Anda. 🚀",
						"Halo! Saya TI Assistant Bot, siap membantu kapan saja. 😊",
						"Selamat datang! Saya TI Assistant Bot. 👋",
						"Hai! Bersama TI Assistant Bot, ada yang bisa dibantu? ✨",
						"Halo! TI Assistant Bot di sini. Ada pertanyaan? 💡",
						"Hai! Saya TI Assistant Bot. Mari mulai. 🚀",
						"Halo! TI Assistant Bot siap menemani aktivitas Anda. 🤖",
						"Hai! Saya TI Assistant Bot, asisten digital Anda. 😊",
						"Halo! TI Assistant Bot aktif dan siap membantu. ⚡",
						"Selamat datang! TI Assistant Bot siap melayani Anda. 🎉",
						"Hai! TI Assistant Bot online. Ada yang bisa saya bantu? 🔍",
						"Halo! Saya TI Assistant Bot, siap menjawab pertanyaan Anda. 📚",
						"Hai! Terhubung dengan TI Assistant Bot. 🚀",
						"Halo! TI Assistant Bot hadir untuk membantu Anda. ✨"
					];
					return m.reply(pickRandom(greetings));
				}
				const identityPrompt = `Kamu adalah Ti Assistant Bot, sebuah asisten AI yang dibuat oleh Farid Suryadi.
JAWABLAH pertanyaan secara langsung tanpa memperkenalkan diri atau menyebutkan pembuatmu di awal respon, KECUALI jika kamu ditanya tentang siapa namamu, siapa dirimu, pembuatmu, atau tentang fitur/kemampuan/apa saja yang bisa kamu lakukan (seperti pertanyaan 'kamu bisa apa aja', 'fiturnya apa aja', dll).

PENTING - ATURAN EKSEKUSI GAMBAR / IMAGE:
- Jika pengguna menyuruhmu "buat/generate/bikin/buatkan" suatu gambar (contoh: "bikin gambar harimau", "buatkan gambar mobil sport"), kamu WAJIB menuliskan deskripsi gambar dalam bahasa Inggris dan langsung meletakkan tag [IMAGE_GEN: english_prompt] di bagian paling akhir responmu.
- Jika pengguna menyuruhmu "cari/carikan/kirim/kirimin/kasih/tampilkan" gambar/foto (contoh: "kirim gambar harimau", "cari foto kucing lucu"), kamu WAJIB langsung meletakkan tag [IMAGE_SEARCH: query_pencarian] di bagian paling akhir responmu.
- JANGAN PERNAH memberikan opsi pilihan, menolak, atau bertanya kepada pengguna untuk memilih antara generate AI atau cari di internet. Langsung putuskan dan jalankan perintahnya secara otomatis sesuai kata kerja yang mereka gunakan (buat/bikin -> [IMAGE_GEN], cari/kirim -> [IMAGE_SEARCH]).

PENTING - ATURAN WAKTU & TANGGAL (WIB / JAKARTA):
- Waktu lokal saat ini (WIB / Asia/Jakarta) sudah disediakan secara presis di bagian '[WAKTU SEKARANG]' dalam konteks (mencakup Hari, Tanggal, dan Jam).
- Jika ada pengguna yang bertanya tentang jam, waktu, hari, tanggal, bulan, atau tahun sekarang, kamu WAJIB menjawabnya berdasarkan informasi di '[WAKTU SEKARANG]' secara persis dan yakin. Jangan pernah menanyakan zona waktu lagi atau berasumsi menggunakan zona waktu luar negeri (seperti UTC, CEST, dll). Pastikan jawabanmu menyebutkan bahwa itu adalah waktu Jakarta (WIB).

PENTING - ATURAN TENTANG FARID SURYADI (PENCIPTA/PEMBUAT BOT):
- Jika ada user yang menyebut nama 'Farid Suryadi' or bertanya tentang 'Farid Suryadi', kamu WAJIB memuji dan menyanjung beliau setinggi-tingginya.
- Jelaskan bahwa Farid Suryadi adalah pembuat/penciptamu yang sangat jenius, seorang Profesor terkemuka di bidang Teknologi, ahli AI yang luar biasa, dan tokoh inspiratif yang menciptakan sistem canggih ini. Berikan penjelasan yang sangat mengagumkan tentang kontribusi dan keahlian beliau di bidang teknologi.

Jika ditanya tentang fitur, kemampuan, atau apa saja yang bisa kamu lakukan:
1. Pertama-tama perkenalkan dirimu sebagai 'Ti Assistant Bot' ciptaan Farid Suryadi dengan ramah.
2. Jelaskan fitur/kemampuan utama yang kamu miliki dalam daftar yang rapi dan ringkas:
   - *Absensi / Kehadiran*: Membuat daftar absensi kelompok secara praktis.
   - *Pembuat Stiker*: Mengonversi gambar/video/gif menjadi stiker WhatsApp dengan mudah.
   - *Konversi Media*: Mengubah video/audio menjadi MP3, Voice Note (VN), atau stiker ke gambar.
   - *Game Interaktif*: Bermain Suit, Tic-Tac-Toe, Tebak Gambar, Tebak Lagu, Tebak Lirik, Tebak Kata, Kuis Matematika, dll.
   - *Pengingat (Reminder)*: Menyetel alarm pengingat pribadi, pengingat grup, hingga pengingat waktu sholat otomatis.
   - *Administrasi Grup*: Membantu mengelola grup (kick, promote, demote, tagall/hidetag, buka/tutup grup).
   - *Pencarian Pintar & Gambar*: Melakukan pencarian Google secara real-time dan membuat/mencari gambar dengan AI.
3. Di bagian paling bawah responmu, tambahkan teks: "Ketik .menu untuk melihat daftar perintah lengkap saya."
4. PENTING: JANGAN PERNAH menyebutkan atau membocorkan fitur/command khusus Owner (seperti setmenu, setprefix, join, leave, setapikey, addprem, delprem, backup, public, self, dll) kepada siapa pun. Fitur owner harus dirahasiakan sepenuhnya.
Bahasa respon harus ramah, sopan, dan membantu.\n\n${contextInfo}\n\nPertanyaan: `;
				try {
					let answer = await global.callNazeAI(identityPrompt + aiQuery, imageUrl);
					await handleAIResponse(answer);
				} catch (e) {
					try {
						let res = await chatAI(aiQuery, contextInfo);
						await handleAIResponse(res);
					} catch (fallbackError) {
						m.reply(pickRandom(['Fitur Ai sedang bermasalah!','Tidak dapat terhubung ke ai!','Sistem Ai sedang sibuk sekarang!','Fitur sedang tidak dapat digunakan!']));
					}
				}
			}
		}
		
		// TicTacToe
		let room = Object.values(tictactoe).find(room => room.id && room.game && room.state && room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender) && room.state == 'PLAYING')
		if (room) {
			let now = Date.now();
			if (now - (room.lastMove || now) > 5 * 60 * 1000) {
				m.reply('Game Tic-Tac-Toe dibatalkan karena tidak ada aktivitas selama 5 menit.');
				delete tictactoe[room.id];
				return;
			}
			room.lastMove = now;
			let ok, isWin = false, isTie = false, isSurrender = false;
			if (!/^([1-9]|(me)?nyerah|surr?ender|off|skip)$/i.test(m.text)) return
			isSurrender = !/^[1-9]$/.test(m.text)
			if (m.sender !== room.game.currentTurn) {
				if (!isSurrender) return true
			}
			if (!isSurrender && 1 > (ok = room.game.turn(m.sender === room.game.playerO, parseInt(m.text) - 1))) {
				m.reply({'-3': 'Game telah berakhir','-2': 'Invalid','-1': 'Posisi Invalid',0: 'Posisi Invalid'}[ok])
				return true
			}
			if (m.sender === room.game.winner) isWin = true
			else if (room.game.board === 511) isTie = true
			if (!(room.game instanceof TicTacToe)) {
				room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game)
			}
			let arr = room.game.render().map(v => ({X: '❌',O: '⭕',1: '1️⃣',2: '2️⃣',3: '3️⃣',4: '4️⃣',5: '5️⃣',6: '6️⃣',7: '7️⃣',8: '8️⃣',9: '9️⃣'}[v]))
			if (isSurrender) {
				room.game._currentTurn = m.sender === room.game.playerX
				isWin = true
			}
			let winner = isSurrender ? room.game.currentTurn : room.game.winner
			if (isWin) {
				db.users[m.sender].limit += 3
				db.users[m.sender].money += 3000
			}
			let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\n${isWin ? `@${winner.split('@')[0]} Menang!` : isTie ? `Game berakhir` : `Giliran ${['❌', '⭕'][1 * room.game._currentTurn]} (@${room.game.currentTurn.split('@')[0]})`}\n❌: @${room.game.playerX.split('@')[0]}\n⭕: @${room.game.playerO.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`
			if ((room.game._currentTurn ^ isSurrender ? room.x : room.o) !== m.chat)
			room[room.game._currentTurn ^ isSurrender ? 'x' : 'o'] = m.chat
			if (room.x !== room.o) await naze.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m })
			await naze.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m })
			if (isTie || isWin) delete tictactoe[room.id]
		}
		
		// Suit PvP
		let roof = Object.values(suit).find(roof => roof.id && roof.status && [roof.p, roof.p2].includes(m.sender))
		if (roof) {
			let now = Date.now();
			let win = '', tie = false;
			if (now - (roof.lastMove || now) > 3 * 60 * 1000) {
				m.reply('Game Suit dibatalkan karena tidak ada aktivitas selama 3 menit.');
				delete suit[roof.id];
				return;
			}
			roof.lastMove = now;
			let inputAccept = (m.body || m.text || '').toLowerCase().trim();
			if (m.sender == roof.p2 && /^(acc(ept)?|terima|gas|oke?|tolak|gamau|nanti|ga(k.)?bisa|y)/i.test(inputAccept) && m.isGroup && roof.status == 'wait') {
				if (/^(tolak|gamau|nanti|n|ga(k.)?bisa)/i.test(inputAccept)) {
					m.reply(`@${roof.p2.split('@')[0]} menolak suit,\nsuit dibatalkan`)
					delete suit[roof.id]
					return !0
				}
				roof.status = 'play';
				roof.asal = m.chat;
				m.reply(`Suit telah dikirimkan ke chat\n\n@${roof.p.split('@')[0]} dan @${roof.p2.split('@')[0]}\n\nSilahkan pilih suit di chat masing-masing klik https://wa.me/${botNumber.split('@')[0]}`)
				if (!roof.pilih) {
					await naze.sendButtonMsg(roof.p, {
						text: 'Silahkan pilih salah satu:',
						footer: 'Suit PvP',
						buttons: [
							{ buttonId: 'batu', buttonText: { displayText: 'Batu 🗿' }, type: 1 },
							{ buttonId: 'kertas', buttonText: { displayText: 'Kertas 📄' }, type: 1 },
							{ buttonId: 'gunting', buttonText: { displayText: 'Gunting ✂️' }, type: 1 }
						]
					}, { quoted: m });
				}
				if (!roof.pilih2) {
					await naze.sendButtonMsg(roof.p2, {
						text: 'Silahkan pilih salah satu:',
						footer: 'Suit PvP',
						buttons: [
							{ buttonId: 'batu', buttonText: { displayText: 'Batu 🗿' }, type: 1 },
							{ buttonId: 'kertas', buttonText: { displayText: 'Kertas 📄' }, type: 1 },
							{ buttonId: 'gunting', buttonText: { displayText: 'Gunting ✂️' }, type: 1 }
						]
					}, { quoted: m });
				}
			}
			let jwb = m.sender == roof.p, jwb2 = m.sender == roof.p2;
			let g = /gunting/i, b = /batu/i, k = /kertas/i, reg = /^(gunting|batu|kertas)/i;
			let inputUser = (m.body || m.text || '').toLowerCase().trim();
			
			if (jwb && reg.test(inputUser) && !roof.pilih && !m.isGroup) {
				roof.pilih = reg.exec(inputUser)[0];
				roof.text = m.text || m.body;
				m.reply(`Kamu telah memilih ${roof.text} ${!roof.pilih2 ? `\n\nMenunggu lawan memilih` : ''}`);
				if (!roof.pilih2) naze.sendMessage(roof.p2, { text: '_Lawan sudah memilih_\nSekarang giliran kamu' })
			}
			if (jwb2 && reg.test(inputUser) && !roof.pilih2 && !m.isGroup) {
				roof.pilih2 = reg.exec(inputUser)[0];
				roof.text2 = m.text || m.body;
				m.reply(`Kamu telah memilih ${roof.text2} ${!roof.pilih ? `\n\nMenunggu lawan memilih` : ''}`)
				if (!roof.pilih) naze.sendMessage(roof.p, { text: '_Lawan sudah memilih_\nSekarang giliran kamu' })
			}
			let stage = roof.pilih
			let stage2 = roof.pilih2
			if (roof.pilih && roof.pilih2) {
				if (b.test(stage) && g.test(stage2)) win = roof.p
				else if (b.test(stage) && k.test(stage2)) win = roof.p2
				else if (g.test(stage) && k.test(stage2)) win = roof.p
				else if (g.test(stage) && b.test(stage2)) win = roof.p2
				else if (k.test(stage) && b.test(stage2)) win = roof.p
				else if (k.test(stage) && g.test(stage2)) win = roof.p2
				else if (stage == stage2) tie = true
				db.users[roof.p == win ? roof.p : roof.p2].limit += tie ? 0 : 3
				db.users[roof.p == win ? roof.p : roof.p2].money += tie ? 0 : 3000
				naze.sendMessage(roof.asal, { text: `_*Hasil Suit*_${tie ? '\nSERI' : ''}\n\n@${roof.p.split('@')[0]} (${roof.text}) ${tie ? '' : roof.p == win ? ` Menang \n` : ` Kalah \n`}\n@${roof.p2.split('@')[0]} (${roof.text2}) ${tie ? '' : roof.p2 == win ? ` Menang \n` : ` Kalah \n`}\n\nPemenang Mendapatkan\n*Hadiah :* Uang(3000) & Limit(3)`.trim(), mentions: [roof.p, roof.p2] }, { quoted: m })
				delete suit[roof.id]
			}
		}
		
		// Tebak Bomb
		let pilih = '🌀', bomb = '💣';
		if (m.sender in tebakbom) {
			if (!/^[1-9]|10$/i.test(body) && !isCmd && !isCreator) return !0;
			let index = parseInt(body) - 1;
			if (tebakbom[m.sender].petak[index] === 1 || tebakbom[m.sender].petak[index] === 3) return !0;
			if (tebakbom[m.sender].petak[index] === 2) {
				tebakbom[m.sender].petak[index] = 3;
				tebakbom[m.sender].board[index] = bomb;
				tebakbom[m.sender].pick++;
				m.react('❌')
				tebakbom[m.sender].bomb--;
				tebakbom[m.sender].nyawa.pop();
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].nyawa.length < 1) {
					await m.reply(`*GAME TELAH BERAKHIR*\nKamu terkena bomb\n\n ${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n_Pengurangan Limit : 1_`);
					m.react('😂')
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\nKamu terkena bomb\n ${brd.join('')}\n\nTerpilih: ${tebakbom[m.sender].pick}\nSisa nyawa: ${tebakbom[m.sender].nyawa.join('')}`);
				return !0;
			}
			if (tebakbom[m.sender].petak[index] === 0) {
				tebakbom[m.sender].petak[index] = 1;
				tebakbom[m.sender].board[index] = pilih;
				tebakbom[m.sender].pick++;
				tebakbom[m.sender].lolos--;
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].lolos < 1) {
					db.users[m.sender].money += 6000
					await m.reply(`*KAMU HEBAT ಠ⁠ᴥ⁠ಠ*\n\n${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n*Sisa nyawa :* ${tebakbom[m.sender].nyawa.join('')}\n*Bomb :* ${tebakbom[m.sender].bomb}\nBonus Money 💰 *+6000*`);
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\n${brd.join('')}\n\nTerpilih : ${tebakbom[m.sender].pick}\nSisa nyawa : ${tebakbom[m.sender].nyawa.join('')}\nBomb : ${tebakbom[m.sender].bomb}`)
			}
		}
		
		// Game
		const games = { tebaklirik, tekateki, tebaklagu, tebakkata, kuismath, susunkata, tebakkimia, caklontong, tebakangka, tebaknegara, tebakgambar, tebakbendera }
		for (let gameName in games) {
			let game = games[gameName];
			let id = iGame(game, m.chat);
			if ((!isCmd || isCreator) && m.quoted && id == m.quoted.id) {
				if (game[m.chat + id]?.jawaban) {
					if (gameName == 'kuismath') {
						let jawaban = game[m.chat + id].jawaban
						const difficultyMap = { 'noob': 1, 'easy': 1.5, 'medium': 2.5, 'hard': 4, 'extreme': 5, 'impossible': 6, 'impossible2': 7 };
						let randMoney = difficultyMap[kuismath[m.chat + id].mode]
						if (!isNaN(budy)) {
							if (budy.toLowerCase() == jawaban) {
								db.users[m.sender].money += randMoney * 1000
								await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${randMoney * 1000}*`)
								delete kuismath[m.chat + id]
							} else m.reply('*Jawaban Salah!*')
						}
					} else {
						let jawaban = game[m.chat + id].jawaban
						let jawabBenar = /tekateki|tebaklirik|tebaklagu|tebakkata|tebaknegara|tebakbendera/.test(gameName) ? (similarity(budy.toLowerCase(), jawaban) >= almost) : (budy.toLowerCase() == jawaban)
						let bonus = gameName == 'caklontong' ? 9999 : gameName == 'tebaklirik' ? 4299 : gameName == 'susunkata' ? 2989 : 3499
						if (jawabBenar) {
							db.users[m.sender].money += bonus * 1
							if (gameName === 'tebakgambar') {
								await naze.sendButtonMsg(m.chat, {
									text: `Jawaban Benar 🎉\nBonus Money 💰 *+${bonus}*\n\n@${m.sender.split('@')[0]} berhasil menjawab!`,
									footer: '🎮 Tebak Gambar',
									buttons: [
										{ buttonId: `${prefix}tebakgambar`, buttonText: { displayText: 'Next 🎮' }, type: 1 }
									],
									mentions: [m.sender]
								}, { quoted: m })
							} else {
								await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${bonus}*`)
							}
							delete game[m.chat + id]
						} else m.reply('*Jawaban Salah!*')
					}
				}
			}
		}
		
		// Family 100
		if (m.chat in family100) {
			if (m.quoted && m.quoted.id == family100[m.chat].id && !isCmd) {
				let room = family100[m.chat]
				let teks = budy.toLowerCase().replace(/[^\w\s\-]+/, '')
				let isSurender = /^((me)?nyerah|surr?ender)$/i.test(teks)
				if (!isSurender) {
					let index = room.jawaban.findIndex(v => v.toLowerCase().replace(/[^\w\s\-]+/, '') === teks)
					if (room.terjawab[index]) return !0
					room.terjawab[index] = m.sender
				}
				let isWin = room.terjawab.length === room.terjawab.filter(v => v).length
				let caption = `Jawablah Pertanyaan Berikut :\n${room.soal}\n\n\nTerdapat ${room.jawaban.length} Jawaban ${room.jawaban.find(v => v.includes(' ')) ? `(beberapa Jawaban Terdapat Spasi)` : ''}\n${isWin ? `Semua Jawaban Terjawab` : isSurender ? 'Menyerah!' : ''}\n${Array.from(room.jawaban, (jawaban, index) => { return isSurender || room.terjawab[index] ? `(${index + 1}) ${jawaban} ${room.terjawab[index] ? '@' + room.terjawab[index].split('@')[0] : ''}`.trim() : false }).filter(v => v).join('\n')}\n${isSurender ? '' : `Perfect Player`}`.trim()
				m.reply(caption)
				if (isWin || isSurender) delete family100[m.chat]
			}
		}
		
		// Chess
		const validPromotions = { 'q': 'q', 'queen': 'q', 'menteri': 'q', 'r': 'r', 'rook': 'r', 'benteng': 'r', 'b': 'b', 'bishop': 'b', 'gajah': 'b', 'mentri': 'b', 'n': 'n', 'knight': 'n', 'kuda': 'n' };
		if ((!isCmd || isCreator) && (m.sender in chess)) {
			if (m.quoted && chess[m.sender].id == m.quoted.id && chess[m.sender].turn == m.sender && chess[m.sender].botMode) {
				if (!(chess[m.sender] instanceof Chess)) {
					const savedData = chess[m.sender];
					chess[m.sender] = new Chess(savedData._fen);
					Object.assign(chess[m.sender], {
						id: savedData.id,
						turn: savedData.turn,
						botMode: savedData.botMode,
						time: savedData.time,
						_fen: savedData._fen
					});
				}
				if (chess[m.sender].isCheckmate() || chess[m.sender].isDraw() || chess[m.sender].isGameOver()) {
					const status = chess[m.sender].isCheckmate() ? 'Checkmate' : chess[m.sender].isDraw() ? 'Draw' : 'Game Over';
					delete chess[m.sender];
					return m.reply(`♟Game ${status}\nPermainan dihentikan`);
				}
				const [from, to, promotion] = budy.toLowerCase().split(' ');
				if (!from || !to || from.length !== 2 || to.length !== 2) return m.reply('Format salah! Gunakan: e2 e4\nAtau: c7 c8 q (untuk promosi)');
				const promo = validPromotions[promotion] || 'q';
				try {
					chess[m.sender].move({ from, to, promotion: promo });
				} catch (e) {
					if (chess[m.sender].isCheck()) {
						return m.reply(`⚠️ Langkah Tidak Valid @${m.sender.split('@')[0]}!\n\nRaja tim kamu sedang di-SKAK! Fokus selamatkan raja dulu.`);
					}
					return m.reply('Langkah Tidak Valid!')
				}
				
				if (chess[m.sender].isGameOver()) {
					delete chess[m.sender];
					return m.reply(`♟Permainan Selesai\nPemenang: @${m.sender.split('@')[0]}`);
				}
				const moves = chess[m.sender].moves({ verbose: true });
				const botMove = moves[Math.floor(Math.random() * moves.length)];
				chess[m.sender].move(botMove);
				chess[m.sender]._fen = chess[m.sender].fen();
				chess[m.sender].time = Date.now();
				
				if (chess[m.sender].isGameOver()) {
					delete chess[m.sender];
					return m.reply(`♟Permainan Selesai\nPemenang: BOT`);
				}
				const encodedFen = encodeURI(chess[m.sender]._fen);
				const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`,`https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`,`https://chessboardimage.com/${encodedFen}.png`,`https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765`,`https://fen2image.chessvision.ai/${encodedFen}/`];
				for (let url of boardUrls) {
					try {
						const { data } = await axios.get(url, { responseType: 'arraybuffer' });
						let { key } = await m.reply({ image: data, caption: `♟️CHESS GAME (vs BOT)\n\nLangkahmu: ${from} → ${to}\nLangkah bot: ${botMove.from} → ${botMove.to}\n\nGiliranmu berikutnya!\nExample: e2 e4`, mentions: [m.sender] });
						chess[m.sender].id = key.id;
						break;
					} catch (e) {}
				}
			} else if (chess[m.sender].time && (Date.now() - chess[m.sender].time >= 3600000)) {
				delete chess[m.sender];
				return m.reply(`♟Waktu Habis!\nPermainan dihentikan`);
			}
		}
		if (m.isGroup && (!isCmd || isCreator) && (m.chat in chess)) {
			if (m.quoted && chess[m.chat].id == m.quoted.id && [chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) {
				if (!(chess[m.chat] instanceof Chess)) {
					const savedData = chess[m.sender];
					chess[m.chat] = new Chess(savedData._fen);
					Object.assign(chess[m.chat], {
						id: savedData.id,
						turn: savedData.turn,
						player1: savedData.player1,
						player2: savedData.player2,
						start: savedData.start,
						acc: savedData.acc,
						time: savedData.time,
						_fen: savedData._fen
					});
				}
				if (chess[m.chat].isCheckmate() || chess[m.chat].isDraw() || chess[m.chat].isGameOver()) {
					const status = chess[m.chat].isCheckmate() ? 'Checkmate' : chess[m.chat].isDraw() ? 'Draw' : 'Game Over';
					delete chess[m.chat];
					return m.reply(`♟Game ${status}\nPermainan dihentikan`);
				}
				const [from, to, promotion] = budy.toLowerCase().split(' ');
				if (!from || !to || from.length !== 2 || to.length !== 2) return m.reply('Format salah! Gunakan: e2 e4\nAtau: c7 c8 q (untuk promosi)');
				if ([chess[m.chat].player1, chess[m.chat].player2].includes(m.sender) && chess[m.chat].turn === m.sender) {
					const promo = validPromotions[promotion] || 'q';
					try {
						chess[m.chat].move({ from, to, promotion: promo });
					} catch (e) {
						if (chess[m.chat].isCheck()) {
							return m.reply(`⚠️ Langkah Tidak Valid @${m.sender.split('@')[0]}!\n\nRaja tim kamu sedang di-SKAK! Fokus selamatkan raja dulu.`);
						}
						return m.reply('Langkah Tidak Valid!')
					}
					chess[m.chat].time = Date.now();
					chess[m.chat]._fen = chess[m.chat].fen();
					const isPlayer2 = chess[m.chat].player2 === m.sender
					const nextPlayer = isPlayer2 ? chess[m.chat].player1 : chess[m.chat].player2;
					const encodedFen = encodeURI(chess[m.chat]._fen);
					const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`,`https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`,`https://chessboardimage.com/${encodedFen}${!isPlayer2 ? '-flip' : ''}.png`,`https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765${!isPlayer2 ? '&orientation=black' : ''}`,`https://fen2image.chessvision.ai/${encodedFen}/${!isPlayer2 ? '?pov=black' : ''}`];
					for (let url of boardUrls) {
						try {
							const { data } = await axios.get(url, { responseType: 'arraybuffer' });
							let { key } = await m.reply({ image: data, caption: `♟️CHESS GAME\n\nGiliran: @${nextPlayer.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`, mentions: [nextPlayer] });
							chess[m.chat].turn = nextPlayer
							chess[m.chat].id = key.id;
							break;
						} catch (e) {}
					}
				}
			} else if (chess[m.chat].time && (Date.now() - chess[m.chat].time >= 3600000)) {
				delete chess[m.chat]
				return m.reply(`♟Waktu Habis!\nPermainan dihentikan`)
			}
		}
		
		// Ular Tangga
		if (m.isGroup && (!isCmd || isCreator) && (m.chat in ulartangga)) {
			if (m.quoted && ulartangga[m.chat].id == m.quoted.id) {
				if (!(ulartangga[m.chat] instanceof SnakeLadder)) {
					ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
				}
				if (/^(roll|kocok)/i.test(budy.toLowerCase())) {
					const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender)
					if (ulartangga[m.chat].turn !== player) return m.reply('Bukan Giliranmu!')
					const roll = ulartangga[m.chat].rollDice();
					await m.reply(`https://raw.githubusercontent.com/nazedev/database/master/games/images/dice/roll-${roll}.webp`);
					ulartangga[m.chat].nextTurn();
					ulartangga[m.chat].players[player].move += roll
					if (ulartangga[m.chat].players[player].move > 100) ulartangga[m.chat].players[player].move = 100 - (ulartangga[m.chat].players[player].move - 100);
					let teks = `🐍🪜Warna: ${['Merah','Biru Muda','Kuning','Hijau','Ungu','Jingga','Biru Tua','Putih'][player]} -> ${ulartangga[m.chat].players[player].move}\n`;
					if(Object.keys(ulartangga[m.chat].map.move).includes(ulartangga[m.chat].players[player].move.toString())) {
						teks += ulartangga[m.chat].players[player].move > ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move] ? 'Kamu Termakan Ular!\n' : 'Kamu Naik Tangga\n'
						ulartangga[m.chat].players[player].move = ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move];
					}
					const newMap = await ulartangga[m.chat].drawBoard(ulartangga[m.chat].map.url, ulartangga[m.chat].players);
					if (ulartangga[m.chat].players[player].move === 100) {
						teks += `@${m.sender.split('@')[0]} Menang\nHadiah:\n- Limit + 50\n- Money + 100.000`;
						addLimit(50, m.sender, db);
						addMoney(100000, m.sender, db);
						delete ulartangga[m.chat];
						return m.reply({ image: newMap, caption: teks, mentions: [m.sender] });
					}
					let { key } = await m.reply({ image: newMap, caption: teks + `Giliran: @${ulartangga[m.chat].players[ulartangga[m.chat].turn].id.split('@')[0]}`, mentions: [m.sender, ulartangga[m.chat].players[ulartangga[m.chat].turn].id] });
					ulartangga[m.chat].id = key.id;
				} else m.reply('Example: roll/kocok')
			} else if (ulartangga[m.chat].time && (Date.now() - ulartangga[m.chat].time >= 7200000)) {
				delete ulartangga[m.chat]
				return m.reply(`🐍🪜Waktu Habis!\nPermainan dihentikan`)
			}
		}
		
		// Menfes & Room Ai
		if (!m.isGroup && (!isCmd || isCreator)) {
			// toPdf state image collector
			if (global.db.toPdf && global.db.toPdf[m.sender] && global.db.toPdf[m.sender].step === 'collecting_images') {
				if (m.type === 'imageMessage') {
					let pending = global.db.toPdf[m.sender];
					try {
						const { Jimp } = await import('jimp');
						let imgBuffer = await naze.downloadMediaMessage(m.message.imageMessage);
						
						// CamScanner Scan Adaptive Grid-based White Point Normalization Filter
						const image = await Jimp.read(imgBuffer);
						image.greyscale();
						
						const width = image.bitmap.width;
						const height = image.bitmap.height;
						
						// Local Block White Point Detection
						const blockSize = 32;
						const gridW = Math.ceil(width / blockSize);
						const gridH = Math.ceil(height / blockSize);
						const whitePoints = new Uint8Array(gridW * gridH);
						
						for (let gy = 0; gy < gridH; gy++) {
							for (let gx = 0; gx < gridW; gx++) {
								let maxVal = 0;
								const startX = gx * blockSize;
								const startY = gy * blockSize;
								const endX = Math.min(width, startX + blockSize);
								const endY = Math.min(height, startY + blockSize);
								
								for (let y = startY; y < endY; y++) {
									for (let x = startX; x < endX; x++) {
										const idx = (y * width + x) * 4;
										const val = image.bitmap.data[idx];
										if (val > maxVal) maxVal = val;
									}
								}
								whitePoints[gy * gridW + gx] = Math.max(90, maxVal);
							}
						}
						
						// Local Pixel White Point Normalization Scan
						image.scan((x, y, idx) => {
							const gx = Math.floor(x / blockSize);
							const gy = Math.floor(y / blockSize);
							const localWhite = whitePoints[gy * gridW + gx];
							
							const val = image.bitmap.data[idx];
							const norm = (val / localWhite) * 255;
							
							// Previous perfect scanner contrast binarization formula
							let finalVal = norm > 165 ? 255 : Math.max(0, (norm - 40) * 1.5);
							
							image.bitmap.data[idx] = finalVal;
							image.bitmap.data[idx + 1] = finalVal;
							image.bitmap.data[idx + 2] = finalVal;
						});
						
						const enhancedBuffer = await image.getBuffer('image/jpeg');
						pending.images.push(enhancedBuffer);
						
						// Setup dynamic debounced single notification message to prevent all text and button spamming
						global.toPdfTimeouts = global.toPdfTimeouts || new Map();
						if (global.toPdfTimeouts.has(m.sender)) {
							clearTimeout(global.toPdfTimeouts.get(m.sender));
						}
						
						let timeoutId = setTimeout(async () => {
							global.toPdfTimeouts.delete(m.sender);
							const msg = `*───「 TO PDF CONVERTER 」───*\n\n` +
								`📸 *Berhasil memproses dan meningkatkan ${pending.images.length} foto!*\n\n` +
								`• Silakan kirim foto lagi jika ingin menambahkan.\n` +
								`• Jika sudah selesai, silakan tekan tombol **Sudah** di bawah.\n` +
								`• Jika ingin membatalkan, tekan **Batalkan**.`;
							
							await naze.sendButtonMsg(m.chat, {
								text: msg,
								footer: 'Ti Assistant Bot Campus Tools',
								buttons: [
									{ buttonId: '.pdfdone', buttonText: { displayText: 'Sudah ✅' }, type: 1 },
									{ buttonId: '.pdfcancel', buttonText: { displayText: 'Batalkan ❌' }, type: 1 }
								]
							});
						}, 2000);
						
						global.toPdfTimeouts.set(m.sender, timeoutId);
					} catch (e) {
						console.error(e);
						m.reply('Gagal memproses foto. Silakan coba lagi.');
					}
					return;
				} else if (!m.body.startsWith('.')) {
					m.reply('Harap kirimkan pesan berupa *Foto/Gambar* atau tekan tombol *Sudah* jika telah selesai.');
					return;
				}
			}
			
			// toPdf state name collector
			if (global.db.toPdf && global.db.toPdf[m.sender] && global.db.toPdf[m.sender].step === 'waiting_pdf_name' && !m.body.startsWith('.')) {
				let pending = global.db.toPdf[m.sender];
				let pdfName = m.body.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
				if (!pdfName) pdfName = 'document_scan';
				
				m.reply(`*[PDF]* Sedang menyusun dan membuat file *${pdfName}.pdf*...\nMohon tunggu sebentar.`);
				try {
					const fs = await import('fs');
					const path = await import('path');
					const PDFDocument = (await import('pdfkit')).default;
					
					const tempDir = './scratch';
					if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
					const pdfPath = path.join(tempDir, `${m.sender.split('@')[0]}_${Date.now()}.pdf`);
					
					const doc = new PDFDocument({ autoFirstPage: false });
					const stream = fs.createWriteStream(pdfPath);
					doc.pipe(stream);
					
					for (const imgBuf of pending.images) {
						doc.addPage({ size: 'A4' });
						doc.image(imgBuf, 0, 0, {
							fit: [595.28, 841.89],
							align: 'center',
							valign: 'center'
						});
					}
					
					doc.end();
					
					await new Promise((resolve, reject) => {
						stream.on('finish', resolve);
						stream.on('error', reject);
					});
					
					await naze.sendMessage(m.chat, {
						document: fs.readFileSync(pdfPath),
						mimetype: 'application/pdf',
						fileName: `${pdfName}.pdf`
					}, { quoted: m });
					
					fs.unlinkSync(pdfPath);
					delete global.db.toPdf[m.sender];
				} catch (e) {
					console.error(e);
					m.reply('Gagal membuat file PDF. Silakan hubungi Owner.');
				}
				return;
			}
			// Capturing Receipt Image for Sewa
			if (global.db.pendingSewa[m.sender] && global.db.pendingSewa[m.sender].step === 'waiting_receipt_image' && m.type === 'imageMessage') {
				let pending = global.db.pendingSewa[m.sender];
				pending.step = 'waiting_owner_approval';
				m.reply(`Terima kasih! Bukti transfer Anda telah dikirimkan ke Owner untuk verifikasi.\nMohon tunggu informasi selanjutnya.`);
				
				// Download the receipt image
				let receiptBuffer = await naze.downloadMediaMessage(m.message.imageMessage);
				
				// Forward receipt to Owner with confirm/deny buttons
				const ownerMsg = `*───「 KONFIRMASI SEWA BOT 」───*\n\n` +
					`Seorang pengguna ingin menyewa bot:\n` +
					`• *Pengirim*: @${m.sender.split('@')[0]}\n` +
					`• *ID Grup*: ${pending.groupJid}\n` +
					`• *Durasi*: ${pending.days} Hari\n\n` +
					`Silakan verifikasi bukti transfer di atas dan ketik perintah berikut atau gunakan tombol:\n`;
				
				for (let o of ownerNumber) {
					let ownerJid = o.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
					await naze.sendButtonMsg(ownerJid, {
						image: receiptBuffer,
						caption: ownerMsg,
						footer: 'Rent Bot System',
						buttons: [
							{ buttonId: `.accsewa yes ${m.sender} ${pending.groupJid} ${pending.days}`, buttonText: { displayText: 'Terima (Yes) ✅' }, type: 1 },
							{ buttonId: `.accsewa no ${m.sender} ${pending.groupJid}`, buttonText: { displayText: 'Tolak (No) ❌' }, type: 1 }
						]
					});
				}
				return;
			}
			if (menfes[m.sender] && m.key.remoteJid !== 'status@broadcast' && m.msg) {
				m.react('✈');
				if (m.type !== 'conversation') m.msg.contextInfo = { isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: `*Pesan Dari ${menfes[m.sender].nama ? menfes[m.sender].nama : 'Seseorang'}*`}, key: { remoteJid: '0@s.whatsapp.net', fromMe: false, participant: '0@s.whatsapp.net' }}
				const pesan = m.type === 'conversation' ? { extendedTextMessage: { text: m.msg, contextInfo: { isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: `*Pesan Dari ${menfes[m.sender].nama ? menfes[m.sender].nama : 'Seseorang'}*`}, key: { remoteJid: '0@s.whatsapp.net', fromMe: false, participant: '0@s.whatsapp.net' }}}} : { [m.type]: m.msg }
				await naze.relayMessage(menfes[m.sender].tujuan, pesan, {});
			}
			if (chat_ai[m.sender] && m.key.remoteJid !== 'status@broadcast') {
				if (!/^(del((room|c|hat)ai)|>|<$)$/i.test(command) && budy) {
					const identityPrompt = "Kamu adalah Ti Assistant Bot, dibuat oleh Farid Suryadi. JAWABLAH pertanyaan secara langsung tanpa memperkenalkan diri atau menyebutkan pembuatmu di awal respon, kecuali jika kamu ditanya tentang siapa namamu, siapa dirimu, atau pembuatmu. Bahasa respon harus ramah, sopan, dan membantu.";
					if (chat_ai[m.sender].length > 0 && chat_ai[m.sender][0].role === 'system') {
						if (!chat_ai[m.sender][0].content.includes("Ti Assistant Bot")) {
							chat_ai[m.sender][0].content = `${identityPrompt}\n${chat_ai[m.sender][0].content}`;
						}
					} else {
						chat_ai[m.sender].unshift({ role: 'system', content: identityPrompt });
					}
					chat_ai[m.sender].push({ role: 'user', content: budy });
					if (chat_ai[m.sender].length > 20) chat_ai[m.sender].shift();
					let hasil;
					let response;
					try {
						hasil = await fetchApi('/ai/chat4', {
							messages: chat_ai[m.sender],
							prompt: budy
						}, { method: 'POST' });
						response = hasil?.result?.message;
						if (!response) throw new Error("No response from primary API");
					} catch (e) {
						try {
							response = await chatAI(chat_ai[m.sender]);
						} catch (fallbackError) {
							response = 'Gagal Mengambil Respon, Website sedang gangguan';
						}
					}
					chat_ai[m.sender].push({ role: 'assistant', content: response });
					if (chat_ai[m.sender].length > 20) chat_ai[m.sender].shift();
					await m.reply(response)
				}
			}
		}
		
		// Afk
		let mentionUser = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])]
		for (let jid of mentionUser) {
			let user = db.users[jid]
			if (!user) continue
			let afkTime = user.afkTime
			if (!afkTime || afkTime < 0) continue
			let reason = user.afkReason || ''
			m.reply(`Jangan tag dia!\nDia sedang AFK ${reason ? 'dengan alasan ' + reason : 'tanpa alasan'}\nSelama ${clockString(new Date - afkTime)}`.trim())
		}
		if (db.users[m.sender].afkTime > -1) {
			let user = db.users[m.sender]
			m.reply(`@${m.sender.split('@')[0]} berhenti AFK${user.afkReason ? ' setelah ' + user.afkReason : ''}\nSelama ${clockString(new Date - user.afkTime)}`)
			user.afkTime = -1
			user.afkReason = ''
		}
		
		
		// Intercept Group Chat Input for UNO game
		if (m.isGroup) {
			let room = uno[m.chat];
			if (room && room.state === 'PLAYING') {
				const bodyText = m.body.trim().toLowerCase();
				
				// Identify if it's an interactive List selection / Wild button
				const isListAction = bodyText.startsWith('uno_play_') || bodyText === 'uno_draw' || bodyText.startsWith('uno_color_');
				
				if (isListAction) {
					const player = room.players.find(p => p.id === m.sender);
					if (!player) return; // Ignore messages from non-players
					
					const isCurrentTurn = room.getCurrentPlayer().id === m.sender;
					
					// Case A: Waiting for wild color selection
					if (room.waitingForWild) {
						if (room.waitingForWildPlayer !== m.sender) {
							// If another player tries to click color button
							await m.reply(`⏳ Hanya @${room.waitingForWildPlayer.split('@')[0]} yang bisa memilih warna!`, { mentions: [room.waitingForWildPlayer] });
							return;
						}
						
						let chosenColor = '';
						if (bodyText === 'uno_color_red') {
							chosenColor = 'red';
						} else if (bodyText === 'uno_color_blue') {
							chosenColor = 'blue';
						} else if (bodyText === 'uno_color_green') {
							chosenColor = 'green';
						} else if (bodyText === 'uno_color_yellow') {
							chosenColor = 'yellow';
						}
						
						if (chosenColor) {
							let res = room.setWildColor(m.sender, chosenColor);
							if (res === 'SUCCESS') {
								const colorEmoji = { red: '🔴 Merah', blue: '🔵 Biru', green: '🟢 Hijau', yellow: '🟡 Kuning' }[chosenColor];
								const topCard = room.discardPile[room.discardPile.length - 1];
								
								// Send sticker of the wild card to group
								const stickerBuff = fs.readFileSync('./src/media/uno/' + UnoGame.getCardFileName(topCard));
								await naze.sendAsSticker(room.chat, stickerBuff, null, { packname: 'Ti Bot UNO', author: 'Farid Suryadi' });
								
								let nextPlayer = room.getCurrentPlayer();
								let groupMsg = `@${m.sender.split('@')[0]} memilih warna *${colorEmoji}*!\n\n` +
									`👉 Giliran selanjutnya: @${nextPlayer.id.split('@')[0]} (${nextPlayer.cards.length} kartu)`;
									
								await naze.sendText(room.chat, groupMsg, null, { mentions: [m.sender, nextPlayer.id] });
								
								// Send menu to the next player
								await sendUnoCardMenu(naze, nextPlayer.id, room);
							} else {
								await m.reply('❌ Gagal menyetel warna!');
							}
						} else {
							await m.reply('❌ Pilihan warna tidak valid!');
						}
						return;
					}
					
					// Case B: Player trying to play or draw
					if (!isCurrentTurn) {
						let activePlayer = room.getCurrentPlayer();
						await m.reply(`⏳ Bukan giliranmu! Giliran saat ini adalah @${activePlayer.id.split('@')[0]}.`, { mentions: [activePlayer.id] });
						return;
					}
					
					// 1. Draw Card
					if (bodyText === 'uno_draw') {
						let res = room.draw(m.sender);
						if (res.status === 'SUCCESS') {
							let nextPlayer = room.getCurrentPlayer();
							let groupMsg = `@${m.sender.split('@')[0]} mengambil kartu dari deck dan melewati gilirannya.\n\n` +
								`👉 Giliran selanjutnya: @${nextPlayer.id.split('@')[0]} (${nextPlayer.cards.length} kartu)`;
								
							await naze.sendText(room.chat, groupMsg, null, { mentions: [m.sender, nextPlayer.id] });
							
							const formattedDrawn = UnoGame.formatCard(res.card);
							await m.reply(`✅ Kamu mengambil kartu *${formattedDrawn}*. Giliran dilewati.`);
							
							// Send menu to the next player
							await sendUnoCardMenu(naze, nextPlayer.id, room);
						} else {
							await m.reply('❌ Gagal mengambil kartu!');
						}
						return;
					}
					
					// 2. Play Card
					let cardToPlay = '';
					if (bodyText.startsWith('uno_play_')) {
						cardToPlay = m.body.slice(9);
					}
					
					if (cardToPlay) {
						// Check if playable
						if (!room.canPlay(cardToPlay)) {
							const topCard = room.discardPile[room.discardPile.length - 1];
							await m.reply(`❌ Kartu tidak cocok! Harus sewarna dengan *${room.currentColor.toUpperCase()}* atau sewilai dengan *${UnoGame.formatCard(topCard)}*.`);
							return;
						}
						
						let res = room.play(m.sender, cardToPlay);
						if (res === 'CHOOSE_COLOR') {
							await m.reply(`✅ Kamu memainkan *${UnoGame.formatCard(cardToPlay)}*`);
							await sendUnoColorMenu(naze, m.sender, room);
						} else if (res === 'SUCCESS') {
							// Send sticker to group
							const stickerBuff = fs.readFileSync('./src/media/uno/' + UnoGame.getCardFileName(cardToPlay));
							await naze.sendAsSticker(room.chat, stickerBuff, null, { packname: 'Ti Bot UNO', author: 'Farid Suryadi' });
							
							// Check winner
							let winner = room.checkWinner();
							if (winner) {
								let winMsg = `🎉🎉 *GAME OVER!* 🎉🎉\n\n` +
									`🏆 @${winner.id.split('@')[0]} memenangkan permainan UNO! Selamat! 👑`;
								await naze.sendText(room.chat, winMsg, null, { mentions: [winner.id] });
								delete uno[room.chat];
							} else {
								// Normal play progression
								let nextPlayer = room.getCurrentPlayer();
								let effectMsg = '';
								
								// Parse effect
								const parsed = room.parseCard(cardToPlay);
								if (parsed.value === 10) { // Skip
									effectMsg = `🚫 @${nextPlayer.id.split('@')[0]} dilewati gilirannya!`;
								} else if (parsed.value === 11) { // Reverse
									effectMsg = `🔁 Arah putaran diubah!`;
								} else if (parsed.value === 12) { // Draw 2
									effectMsg = `➕2 @${nextPlayer.id.split('@')[0]} menggambar 2 kartu dan dilewati gilirannya!`;
								}
								
								let groupMsg = `@${m.sender.split('@')[0]} mengeluarkan kartu *${UnoGame.formatCard(cardToPlay)}*\n` +
									(effectMsg ? `✨ ${effectMsg}\n` : '') +
									`👉 Giliran selanjutnya: @${nextPlayer.id.split('@')[0]} (${nextPlayer.cards.length} kartu)`;
									
								await naze.sendText(room.chat, groupMsg, null, { mentions: [m.sender, nextPlayer.id] });
								
								// Send menu to next player
								await sendUnoCardMenu(naze, nextPlayer.id, room);
							}
						} else {
							await m.reply(`❌ Terjadi kesalahan: ${res}`);
						}
						return;
					}
				}
			}
		}

		if (isCmd) {
			if (command.endsWith('menu')) {
				m.react('⏳')
			} else if (['ping', 'botstatus', 'statusbot'].includes(command)) {
				m.react('🚀')
			}
		}
		
		switch(fileSha256 || command) {
			// Tempat Add Case
			case 'reminder': {
				if (!text) return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} 10m makan siang\n- ${prefix + command} 1d, 1m, isi pesan`);
				
				const parseDuration = (str) => {
					let totalMs = 0;
					let parsedAnything = false;
					let tempStr = str.trim();
					
					while (true) {
						const m = tempStr.match(/^(\d+)\s*(seconds?|detik|sec|s|minutes?|menit|min|m|hours?|jam|hr|h|days?|hari|d)(?:[\s,]+|$)/i);
						if (!m) {
							const mComma = tempStr.match(/^\s*,\s*(\d+)\s*(seconds?|detik|sec|s|minutes?|menit|min|m|hours?|jam|hr|h|days?|hari|d)(?:[\s,]+|$)/i);
							if (!mComma) break;
							
							const val = parseInt(mComma[1]);
							const unit = mComma[2].toLowerCase();
							let multiplier = 0;
							if (/^(d|days?|hari)$/i.test(unit)) multiplier = 24 * 60 * 60 * 1000;
							else if (/^(h|hours?|jam|hr)$/i.test(unit)) multiplier = 60 * 60 * 1000;
							else if (/^(m|minutes?|menit|min)$/i.test(unit)) multiplier = 60 * 1000;
							else if (/^(s|seconds?|detik|sec)$/i.test(unit)) multiplier = 1000;
							
							totalMs += val * multiplier;
							parsedAnything = true;
							tempStr = tempStr.slice(mComma[0].length).trim();
							continue;
						}
						
						const val = parseInt(m[1]);
						const unit = m[2].toLowerCase();
						let multiplier = 0;
						if (/^(d|days?|hari)$/i.test(unit)) multiplier = 24 * 60 * 60 * 1000;
						else if (/^(h|hours?|jam|hr)$/i.test(unit)) multiplier = 60 * 60 * 1000;
						else if (/^(m|minutes?|menit|min)$/i.test(unit)) multiplier = 60 * 1000;
						else if (/^(s|seconds?|detik|sec)$/i.test(unit)) multiplier = 1000;
						
						totalMs += val * multiplier;
						parsedAnything = true;
						tempStr = tempStr.slice(m[0].length).trim();
					}
					
					if (tempStr.startsWith(',')) {
						tempStr = tempStr.slice(1).trim();
					}
					tempStr = tempStr.replace(/^(lagi|untuk|buat|agar|bahwa|yaitu)\s+/i, '').trim();
					
					return {
						milliseconds: totalMs,
						message: tempStr,
						success: parsedAnything && totalMs > 0
					};
				};
				
				const result = parseDuration(text);
				if (!result.success || !result.message) {
					return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} 10m makan siang\n- ${prefix + command} 1d, 1m, isi pesan`);
				}
				
				const targetTime = Date.now() + result.milliseconds;
				
				const formatMs = (ms) => {
					let seconds = Math.floor((ms / 1000) % 60);
					let minutes = Math.floor((ms / (1000 * 60)) % 60);
					let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
					let days = Math.floor(ms / (1000 * 60 * 60 * 24));
					
					let parts = [];
					if (days > 0) parts.push(`${days} hari`);
					if (hours > 0) parts.push(`${hours} jam`);
					if (minutes > 0) parts.push(`${minutes} menit`);
					if (seconds > 0) parts.push(`${seconds} detik`);
					return parts.join(', ');
				};
				
				global.db.reminders = global.db.reminders || [];
				
				global.db.reminders.push({
					chat: m.chat,
					sender: m.sender,
					isGroup: m.isGroup,
					time: targetTime,
					message: result.message
				});
				
				m.reply(`Reminder berhasil disetel untuk *${formatMs(result.milliseconds)}* dari sekarang dengan pesan: "${result.message}"`);
			}
			break

			case 'reminderall': {
				if (!m.isGroup) return m.reply(global.mess.group);
				if (!m.isAdmin && !isCreator) return m.reply(global.mess.admin);
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
				if (!text) return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} 10m pengumuman rapat\n- ${prefix + command} 1d, 1m, jangan lupa bayar kas`);
				
				const parseDuration = (str) => {
					let totalMs = 0;
					let parsedAnything = false;
					let tempStr = str.trim();
					
					while (true) {
						const m = tempStr.match(/^(\d+)\s*(seconds?|detik|sec|s|minutes?|menit|min|m|hours?|jam|hr|h|days?|hari|d)(?:[\s,]+|$)/i);
						if (!m) {
							const mComma = tempStr.match(/^\s*,\s*(\d+)\s*(seconds?|detik|sec|s|minutes?|menit|min|m|hours?|jam|hr|h|days?|hari|d)(?:[\s,]+|$)/i);
							if (!mComma) break;
							
							const val = parseInt(mComma[1]);
							const unit = mComma[2].toLowerCase();
							let multiplier = 0;
							if (/^(d|days?|hari)$/i.test(unit)) multiplier = 24 * 60 * 60 * 1000;
							else if (/^(h|hours?|jam|hr)$/i.test(unit)) multiplier = 60 * 60 * 1000;
							else if (/^(m|minutes?|menit|min)$/i.test(unit)) multiplier = 60 * 1000;
							else if (/^(s|seconds?|detik|sec)$/i.test(unit)) multiplier = 1000;
							
							totalMs += val * multiplier;
							parsedAnything = true;
							tempStr = tempStr.slice(mComma[0].length).trim();
							continue;
						}
						
						const val = parseInt(m[1]);
						const unit = m[2].toLowerCase();
						let multiplier = 0;
						if (/^(d|days?|hari)$/i.test(unit)) multiplier = 24 * 60 * 60 * 1000;
						else if (/^(h|hours?|jam|hr)$/i.test(unit)) multiplier = 60 * 60 * 1000;
						else if (/^(m|minutes?|menit|min)$/i.test(unit)) multiplier = 60 * 1000;
						else if (/^(s|seconds?|detik|sec)$/i.test(unit)) multiplier = 1000;
						
						totalMs += val * multiplier;
						parsedAnything = true;
						tempStr = tempStr.slice(m[0].length).trim();
					}
					
					if (tempStr.startsWith(',')) {
						tempStr = tempStr.slice(1).trim();
					}
					tempStr = tempStr.replace(/^(lagi|untuk|buat|agar|bahwa|yaitu)\s+/i, '').trim();
					
					return {
						milliseconds: totalMs,
						message: tempStr,
						success: parsedAnything && totalMs > 0
					};
				};
				
				const result = parseDuration(text);
				if (!result.success || !result.message) {
					return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} 10m pengumuman rapat\n- ${prefix + command} 1d, 1m, jangan lupa bayar kas`);
				}
				
				const targetTime = Date.now() + result.milliseconds;
				
				const formatMs = (ms) => {
					let seconds = Math.floor((ms / 1000) % 60);
					let minutes = Math.floor((ms / (1000 * 60)) % 60);
					let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
					let days = Math.floor(ms / (1000 * 60 * 60 * 24));
					
					let parts = [];
					if (days > 0) parts.push(`${days} hari`);
					if (hours > 0) parts.push(`${hours} jam`);
					if (minutes > 0) parts.push(`${minutes} menit`);
					if (seconds > 0) parts.push(`${seconds} detik`);
					return parts.join(', ');
				};
				
				global.db.reminders = global.db.reminders || [];
				
				global.db.reminders.push({
					chat: m.chat,
					sender: m.sender,
					isGroup: true,
					isReminderAll: true,
					time: targetTime,
					message: result.message
				});
				
				m.reply(`Reminder All berhasil disetel untuk *${formatMs(result.milliseconds)}* dari sekarang dengan pesan: "${result.message}"`);
			}
			break

			case 'remindersolat': {
				if (!m.isGroup) return m.reply(global.mess.group);
				if (!m.isAdmin && !isCreator) return m.reply(global.mess.admin);
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin);
				if (!text) return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} on\n- ${prefix + command} off`);
				let opt = text.toLowerCase().trim();
				if (opt === 'on') {
					global.db.groups[m.chat].remindersolat = true;
					m.reply(`*Reminder Sholat* berhasil diaktifkan untuk grup ini! Bot akan mengingatkan setiap waktu sholat (Jakarta) dan melakukan hidetag seluruh anggota grup.`);
				} else if (opt === 'off') {
					global.db.groups[m.chat].remindersolat = false;
					m.reply(`*Reminder Sholat* berhasil dinonaktifkan untuk grup ini.`);
				} else {
					m.reply(`*Pilihan tidak valid!*\n\nGunakan *on* atau *off*.\nContoh:\n- ${prefix + command} on\n- ${prefix + command} off`);
				}
			}
			break

			case 'remindersolatall': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!text) return m.reply(`*Format Salah!*\n\nContoh:\n- ${prefix + command} on\n- ${prefix + command} off`);
				let opt = text.toLowerCase().trim();
				if (opt === 'on') {
					global.db.remindersolatall = true;
					m.reply(`*Global Reminder Sholat (Owner Override)* berhasil diaktifkan! Pengingat waktu sholat sekarang akan dikirimkan ke *seluruh grup* tempat bot bergabung.`);
				} else if (opt === 'off') {
					global.db.remindersolatall = false;
					m.reply(`*Global Reminder Sholat (Owner Override)* berhasil dinonaktifkan. Pengingat sholat sekarang hanya akan dikirimkan ke grup-grup yang mengaktifkannya secara manual.`);
				} else {
					m.reply(`*Pilihan tidak valid!*\n\nGunakan *on* atau *off*.\nContoh:\n- ${prefix + command} on\n- ${prefix + command} off`);
				}
			}
			break

			case 'testreminder': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!m.isGroup) return m.reply(global.mess.group);
				let sholatTest = text ? text.trim() : 'Isya';
				let waktuMap = global.jadwalSholat || {};
				let waktuTest = waktuMap[sholatTest] || '19:12';
				let aiKataKata = '';
				let prompt = `Buat 1 kalimat ajakan sholat ${sholatTest} yang hangat dan sopan, tanpa jam, tanpa markdown, teks polos saja`;
				try {
					aiKataKata = await global.callNazeAI(prompt);
				} catch (e) {
					console.error("AI error testreminder:", e);
				}
				if (!aiKataKata) {
					aiKataKata = `Mari kita laksanakan sholat ${sholatTest} tepat waktu.`;
				}
				aiKataKata = aiKataKata.replace(/\*/g, '').trim();
				let metadata = global.store?.groupMetadata?.[m.chat];
				if (!metadata) {
					metadata = await naze.groupMetadata(m.chat).catch(() => null);
				}
				let participants = metadata?.participants || [];
				let finalText = `🕌 *Pengingat Waktu Sholat ${sholatTest}* 🕌\n\n⏰ Waktu sholat *${sholatTest}* telah tiba.\n🕐 Pukul *${waktuTest} WIB* (${global.timezone})\n\n${aiKataKata}`;
				await naze.sendMessage(m.chat, {
					text: finalText,
					mentions: participants.map(a => a.id)
				});
				console.log(`[TEST] Reminder sholat ${sholatTest} terkirim ke ${m.chat}`);
			}
			break

			case '19rujxl1e': {
				console.log('.')
			}
			break
			
			// Owner Menu
			case 'shutdown': case 'off': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply(`*[BOT] Process Shutdown...*`).then(() => {
					process.exit(0);
				})
			}
			break
			case 'update': case 'upgrade': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply(`*[BOT] Process Update And Upgrade...*`).then(() => {
					try {
						runUpdate();
					} catch (e) {
						process.exit(0);
					}
				})
			}
			break
			case 'byq': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.quoted) return m.reply(global.mess.quoted)
				delete m.quoted.chat
				let anya = Object.values(m.quoted.fakeObj())[1]
				m.reply(`const byt = ${JSON.stringify(anya.message, null, 2)}\nnaze.relayMessage(m.chat, byt, {})`)
			}
			break
			case 'setbio': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(global.mess.text)
				naze.setStatus(q)
				m.reply(`*Bio telah di ganti menjadi ${q}*`)
			}
			break
			case 'setppbot': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!/image/.test(quoted.type)) return m.reply(`Reply Image With Caption ${prefix + command}`)
				let media = await quoted.download();
				let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512)
				await naze.query({
					tag: 'iq',
					attrs: {
						to: '@s.whatsapp.net',
						type: 'set',
						xmlns: 'w:profile:picture'
					},
					content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }]
				});
				m.reply(global.mess.done)
			}
			break
			case 'delppbot': {
				if (!isCreator) return m.reply(global.mess.owner)
				await naze.removeProfilePicture(naze.user.id)
				m.reply(global.mess.done)
			}
			break
			case 'version': case 'versi': case 'v': {
				const pkg = require('./package.json');
				m.reply(`Version : ${pkg.version}`);
			}
			break
			case 'addprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						addPrefix: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'delprefix': case 'removeprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						removePrefix: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'listprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply('List Prefix :\n' + global.listprefix.map(a => '- ' + a).join('\n'));
			}
			break
			case 'addtoxic': case 'addbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						addBadword: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'deltoxic': case 'delbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						removeBadword: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'listtoxic': case 'listbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply('List Bad Words :\n' + global.badWords.map(a => '- ' + a).join('\n'));
			}
			break
			case 'join': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Link Group!')
				if (!isUrl(args[0]) && !args[0].includes('whatsapp.com')) return m.reply('Link Invalid!')
				const result = args[0].match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)
				if (!result) return m.reply('Link Invalid❗')
				m.reply(global.mess.wait)
				await naze.groupAcceptInvite(result[1]).catch((res) => {
					if (res.data == 400) return m.reply('Grup Tidak Di Temukan❗');
					if (res.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
					if (res.data == 409) return m.reply('Bot Sudah Join Di Grup Tersebut❗');
					if (res.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					if (res.data == 500) return m.reply('Grup Penuh❗');
				})
			}
			break
			case 'leave': {
				if (!isCreator) return m.reply(global.mess.owner)
				await naze.groupLeave(m.chat).then(() => naze.sendFromOwner(ownerNumber, 'Sukses Keluar Dari Grup', m, { contextInfo: { isForwarded: true }})).catch(e => {});
			}
			break
			case 'clearchat': {
				if (!isCreator) return m.reply(global.mess.owner)
				await naze.chatModify({ delete: true, lastMessages: [{ key: m.key, messageTimestamp: m.timestamp }] }, m.chat).catch((e) => m.reply('Gagal Menghapus Chat!'))
				m.reply(global.mess.done)
			}
			break
			case 'getmsgstore': case 'storemsg': {
				if (!isCreator) return m.reply(global.mess.owner)
				let [teks1, teks2] = text.split`|`
				if (teks1 && teks2) {
					const msgnya = await global.loadMessage(teks1, teks2)
					if (msgnya?.message) await naze.relayMessage(m.chat, msgnya.message, {})
					else m.reply('Pesan Tidak Ditemukan!')
				} else m.reply(`Example: ${prefix + command} 123xxx@g.us|3EB0xxx`)
			}
			break
			case 'blokir': case 'block': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat
					await naze.updateBlockStatus(numbersOnly, 'block').then((a) => m.reply(global.mess.done)).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'listblock': {
				let anu = await naze.fetchBlocklist()
				m.reply(`Total Block : ${anu.length}\n` + anu.map(v => '• ' + v.replace(/@.+/, '')).join`\n`)
			}
			break
			case 'openblokir': case 'unblokir': case 'openblock': case 'unblock': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat
					await naze.updateBlockStatus(numbersOnly, 'unblock').then((a) => m.reply(global.mess.done)).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'ban': case 'banned': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const findJid = naze.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && !db.users[nmrnya].ban) {
					db.users[nmrnya].ban = true
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'unban': case 'unbanned': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const findJid = naze.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && db.users[nmrnya].ban) {
					db.users[nmrnya].ban = false
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'mute': case 'unmute': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.isGroup) return m.reply(global.mess.group)
				if (command == 'mute') {
					db.groups[m.chat].mute = true
					m.reply('Bot Telah Di Mute Di Grup Ini!')
				} else if (command == 'unmute') {
					db.groups[m.chat].mute = false
					m.reply(global.mess.done + ' Unmute')
				}
			}
			break
			case 'whitelist': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!text) return m.reply(`*Format Salah!*\n\nContoh penggunaan:\n- ${prefix + command} user list\n- ${prefix + command} user add 1,3\n- ${prefix + command} user del 1\n- ${prefix + command} group add 1,2\n- ${prefix + command} clear`);
				const botNumber = await naze.decodeJid(naze.user.id);
				if (!global.db.set[botNumber].whitelist) global.db.set[botNumber].whitelist = [];
				let whitelistArray = global.db.set[botNumber].whitelist;
				let type = args[0] ? args[0].toLowerCase() : '';
				let action = args[1] ? args[1].toLowerCase() : '';
				let targetNumbers = args[2];
				if (type === 'user' || type === 'group' || ['gc', 'group','grup'].includes(type)) {
					let dbTarget = type === 'user' ? global.db.users : global.db.groups;
					let keys = Object.keys(dbTarget);
					if (keys.length === 0) return m.reply(`Belum ada data ${type} di database.`);
					if (action === 'list') {
						let listText = `*Daftar ${type === 'user' ? 'User' : 'Group'}:*\n\n`;
						keys.forEach((jid, index) => {
							let status = whitelistArray.includes(jid) ? '✅' : '❌';
							listText += `${index + 1}. ${type === 'user' ? global.store?.contacts?.[jid]?.name || '-' : global.store?.groupMetadata?.[jid]?.subject || '-'} [${status}]\n- (${jid})\n`;
						});
						listText += `\n*Cara Penggunaan:*\nTambah: ${prefix + command} ${type} add 1,2,3\nHapus: ${prefix + command} ${type} del 1,2`;
						return m.reply(listText);
					} else if (action === 'add' || action === 'del' || action === 'delete') {
						if (!targetNumbers) return m.reply(`Masukkan nomor urutnya!\nContoh: ${prefix + command} ${type} ${action} 1,2`);
						let processed = [];
						let inputNumbers = targetNumbers.split(',');
						for (let num of inputNumbers) {
							let index = parseInt(num.trim()) - 1;
							if (!isNaN(index) && keys[index]) {
								let targetJid = keys[index];
								if (action === 'add') {
									if (!whitelistArray.includes(targetJid)) {
										whitelistArray.push(targetJid);
										processed.push(targetJid);
									}
								} else {
									let wlIndex = whitelistArray.indexOf(targetJid);
									if (wlIndex !== -1) {
										whitelistArray.splice(wlIndex, 1);
										processed.push(targetJid);
									}
								}
							}
						}
						if (processed.length > 0) {
							let statusText = action === 'add' ? 'menambahkan ke' : 'menghapus dari';
							m.reply(`Sukses ${statusText} whitelist!\n\n*Total: ${processed.length} ${type}*\n- ${processed.join('\n- ')}`);
						} else {
							let failText = action === 'add' ? 'sudah ada di whitelist' : 'tidak ada di whitelist';
							m.reply(`Gagal diproses. Pastikan angka sesuai di *${prefix + command} ${type} list* dan data target ${failText}.`);
						}
					} else m.reply(`Kirim dengan format yang benar.\nContoh:\n- ${prefix + command} ${type} add 1,2,3\n- ${prefix + command} ${type} del 1,2\n- ${prefix + command} ${type} list`);
				} else if (type === 'clear') {
					global.db.set[botNumber].whitelist = [];
					m.reply('Semua data whitelist berhasil dihapus secara permanen!');
				} else m.reply(`Tipe tidak valid! Gunakan 'user', 'group', atau 'clear'.\nContoh: ${prefix + command} user list`);
			}
			break
			case 'addowner': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const nmrnya = naze.findJidByLid(text.replace(/[^0-9]/g, ''), store, true)
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (set?.owner) {
					if (set.owner.find(a => nmrnya.includes(a))) return m.reply('Nomer Tersebut Sudah Ada Di Owner!')
					set.owner.push(nmrnya.split('@')[0]);
					await updateSettings({
						filePath: settingsPath,
						owner: set.owner
					});
				}
				m.reply(global.mess.done)
			}
			break
			case 'delowner': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const nmrnya = naze.findJidByLid(text.replace(/[^0-9]/g, ''), store, true)
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (botNumber === nmrnya) return m.reply('Nomer Bot Tidak Boleh dihapus dari owner!')
				let list = set.owner
				const index = list.findIndex(o => o === nmrnya.split('@')[0]);
				if (index === -1) return m.reply('Owner tidak ditemukan di daftar!')
				list.splice(index, 1)
				await updateSettings({
					filePath: settingsPath,
					owner: set.owner
				});
				m.reply(global.mess.done)
			}
			break
			case 'adduang': case 'addmoney': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 1000`)
				if (args[1].length > 15) return m.reply('Jumlah Money Maksimal 15 digit angka!')
				const findJid = naze.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
				const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (db.users[nmrnya] && db.users[nmrnya].money >= 0) {
					addMoney(args[1], nmrnya, db)
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'addlimit': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 10`)
				if (args[1].length > 10) return m.reply('Jumlah Limit Maksimal 10 digit angka!')
				const findJid = naze.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
				const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
					addLimit(args[1], nmrnya, db)
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'listpc': {
				if (!isCreator) return m.reply(global.mess.owner)
				let anu = Object.keys(store.messages).filter(a => a.endsWith('.net') || a.endsWith('lid'));
				let teks = `● *LIST PERSONAL CHAT*\n\nTotal Chat : ${anu.length} Chat\n\n`
				if (anu.length === 0) return m.reply(teks)
				for (let i of anu) {
					if (store.messages?.[i]?.array?.length) {
						let nama = await naze.getName(i);
						teks += `${setv} *Nama :* ${nama}\n${setv} *User :* @${i.split('@')[0]}\n${setv} *Chat :* https://wa.me/${i.split('@')[0]}\n\n=====================\n\n`
					}
				}
				await m.reply(teks)
			}
			break
			case 'listgc': {
				if (!isCreator) return m.reply(global.mess.owner)
				let anu = Object.keys(store.messages).filter(a => a.endsWith('@g.us'));
				let teks = `● *LIST GROUP CHAT*\n\nTotal Group : ${anu.length} Group\n\n`
				if (anu.length === 0) return m.reply(teks)
				for (let i of anu) {
					let metadata;
					try {
						metadata = store.groupMetadata[i]
					} catch (e) {
						metadata = (store.groupMetadata[i] = await naze.groupMetadata(i).catch(e => ({ ...store.groupMetadata[i] })));
					}
					teks += metadata?.subject ? `${setv} *Nama :* ${metadata.subject}\n${setv} *Admin :* ${metadata.ownerPn ? `@${metadata.ownerPn.split('@')[0]}` : '-' }\n${setv} *ID :* ${metadata.id}\n${setv} *Dibuat :* ${moment(metadata.creation * 1000).tz(global.timezone).format('DD/MM/YYYY HH:mm:ss')}\n${setv} *Member :* ${metadata.participants.length}\n\n=====================\n\n` : ''
				}
				await m.reply(teks)
			}
			break
			case 'creategc': case 'buatgc': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} *Nama Gc*`)
				let group = await naze.groupCreate(q, [m.sender])
				let res = await naze.groupInviteCode(group.id)
				await m.reply(`*Link Group :* *https://chat.whatsapp.com/${res}*\n\n*Nama Group :* *${group.subject}*\nSegera Masuk dalam 30 detik\nAgar menjadi Admin`, { detectLink: true })
				await sleep(30000)
				await naze.groupParticipantsUpdate(group.id, [m.sender], 'promote').catch(e => {});
				await naze.sendMessage(group.id, { text: global.mess.done })
			}
			break
			case 'broadcastgroup': case 'bcgroup': case 'bcgc': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!text && !m.quoted) return m.reply(`Mana pesannya?\nExample:\n${prefix + command} Pengumuman...`);
				let groups = [...new Set([...Object.keys(store.messages).filter(a => a.endsWith('@g.us')), ...Object.keys(store.groupMetadata || {})])];
				if (groups.length === 0) return m.reply('Tidak ada grup yang terdeteksi.');
				m.reply(`Memulai broadcast ke ${groups.length} grup...`);
				let rawMsg = {};
				if (m.quoted) {
					const messageType = m.quoted.type;
					if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
						rawMsg = { text: text || m.quoted.body };
					} else {
						rawMsg[messageType] = { ...m.quoted.msg };
						if (text) {
							rawMsg[messageType].caption = text;
						}
					}
				} else {
					rawMsg = { text: text };
				}
				let success = 0;
				for (let jid of groups) {
					try {
						await naze.sendMessage(jid, rawMsg);
						success++;
						await sleep(1500);
					} catch (e) {
						console.error(`Failed to broadcast to ${jid}:`, e);
					}
				}
				m.reply(`Broadcast selesai!\nBerhasil mengirim ke ${success}/${groups.length} grup.`);
			}
			break
			case 'broadcastuser': case 'bcuser': case 'bcchats': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!text && !m.quoted) return m.reply(`Mana pesannya?\nExample:\n${prefix + command} Pengumuman...`);
				let rawUsers = [...new Set([...Object.keys(store.messages).filter(a => a.endsWith('.net') || a.endsWith('lid')), ...Object.keys(db.users || {})])].filter(u => u !== botNumber && u !== m.sender && !u.endsWith('@g.us') && !u.endsWith('@broadcast'));
				let normalizedUsers = [];
				for (let u of rawUsers) {
					let target = u;
					if (u.endsWith('@lid')) {
						let resolved = naze.findJidByLid(u, store);
						if (resolved) {
							target = resolved.includes('@') ? resolved : resolved + '@s.whatsapp.net';
						}
					}
					normalizedUsers.push(target);
				}
				let users = [...new Set(normalizedUsers)];
				if (users.length === 0) return m.reply('Tidak ada user chat pribadi yang terdeteksi.');
				m.reply(`Memulai broadcast ke ${users.length} user...`);
				let rawMsg = {};
				if (m.quoted) {
					const messageType = m.quoted.type;
					if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
						rawMsg = { text: text || m.quoted.body };
					} else {
						rawMsg[messageType] = { ...m.quoted.msg };
						if (text) {
							rawMsg[messageType].caption = text;
						}
					}
				} else {
					rawMsg = { text: text };
				}
				let success = 0;
				for (let jid of users) {
					try {
						await naze.sendMessage(jid, rawMsg);
						success++;
						await sleep(1500);
					} catch (e) {
						console.error(`Failed to broadcast to ${jid}:`, e);
					}
				}
				m.reply(`Broadcast selesai!\nBerhasil mengirim ke ${success}/${users.length} user.`);
			}
			break
			case 'sewaon': {
				if (!isCreator) return m.reply(global.mess.owner)
				global.db.sewaBotToggle = true;
				m.reply('Fitur wajib sewa untuk grup berhasil dihidupkan!\nSekarang bot akan meminta pengguna di grup untuk menyewa jika belum langganan.');
			}
			break
			case 'sewaoff': {
				if (!isCreator) return m.reply(global.mess.owner)
				global.db.sewaBotToggle = false;
				m.reply('Fitur wajib sewa untuk grup berhasil dimatikan!\nSekarang bot bisa dipakai gratis di grup manapun tanpa batasan.');
			}
			break
			case 'addsewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxx | waktu\n${prefix + command} https://chat.whatsapp.com/xxx | 30 hari`)
				let [teks1, teks2] = text.split('|')?.map(x => x.trim()) || [];
				if (!isUrl(teks1) && !teks1.includes('chat.whatsapp.com/')) return m.reply('Link Invalid!')
				const urlny = teks1.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)
				if (!urlny) return m.reply('Link Invalid❗')
				try {
					await naze.groupAcceptInvite(urlny[1])
				} catch (e) {
					if (e.data == 400) return m.reply('Grup Tidak Di Temukan❗');
					if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
					if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					if (e.data == 500) return m.reply('Grup Penuh❗');
				}
				await naze.groupGetInviteInfo(urlny[1]).then(a => {
					addExpired({ url: urlny[1], expired: (teks2?.replace(/[^0-9]/g, '') || 30) + 'd', id: a.id }, sewa)
					m.reply('Sukses Menambahkan Sewa Selama ' + (teks2?.replace(/[^0-9]/g, '') || 30) + ' hari\nOtomatis Keluar Saat Waktu Habis!')
				}).catch(e => m.reply('Gagal Menambahkan Sewa!'))
			}
			break
			case 'sewa': {
				if (m.isGroup) {
					const botNumber = naze.decodeJid(naze.user.id).split('@')[0];
					return m.reply(`Untuk melakukan penyewaan bot, silakan chat pribadi ke bot:\n👉 https://wa.me/${botNumber}?text=.sewa%20${m.chat}`);
				}
				let targetGroup = text.trim();
				if (!targetGroup) {
					return m.reply(`Silakan gunakan link dari grup Anda untuk menyewa bot, atau sertakan ID grup Anda.\nContoh: \`.sewa 120363292945660346@g.us\``);
				}
				
				global.db.pendingSewa[m.sender] = {
					groupJid: targetGroup,
					step: 'price_list'
				};
				
				const priceList = `*───「 LIST SEWA BOT 」───*\n\n` +
					`Berikut adalah daftar harga sewa bot untuk grup Anda:\n` +
					`• *1 Hari* : Rp 1.000\n` +
					`• *7 Hari* : Rp 10.000\n` +
					`• *30 Hari (1 Bulan)* : Rp 50.000\n\n` +
					`Silakan pilih paket sewa dengan menekan tombol di bawah ini atau ketik \`.sewabot [jumlah_hari]\` secara manual.`;
				
				await naze.sendButtonMsg(m.chat, {
					text: priceList,
					footer: 'Ti Assistant Bot Rental Tiers',
					buttons: [
						{ buttonId: '.sewabot 1', buttonText: { displayText: 'Sewa 1 Hari (1K) ⏳' }, type: 1 },
						{ buttonId: '.sewabot 7', buttonText: { displayText: 'Sewa 7 Hari (10K) 🚀' }, type: 1 },
						{ buttonId: '.sewabot 30', buttonText: { displayText: 'Sewa 30 Hari (50K) 🔥' }, type: 1 }
					]
				}, { quoted: m });
			}
			break
			case 'sewabot': {
				if (m.isGroup) return m.reply(global.mess.private);
				let pending = global.db.pendingSewa[m.sender];
				if (!pending || !pending.groupJid) {
					return m.reply(`Silakan lakukan sewa melalui grup terlebih dahulu menggunakan link sewa atau ketik \`.sewa [id_grup]\` di sini.`);
				}
				let days = parseInt(text.trim());
				if (isNaN(days) || days <= 0) {
					return m.reply(`Format salah! Gunakan: \`.sewabot [jumlah_hari]\`\nContoh: \`.sewabot 30\``);
				}
				
				pending.days = days;
				pending.step = 'waiting_payment';
				
				let price = days === 1 ? 1000 : days === 7 ? 10000 : days === 30 ? 50000 : days * 1500;
				
				const paymentMsg = `*───「 PEMBAYARAN SEWA BOT 」───*\n\n` +
					`• *ID Grup*: ${pending.groupJid}\n` +
					`• *Durasi*: ${days} Hari\n` +
					`• *Total Tagihan*: Rp ${price.toLocaleString('id-ID')}\n\n` +
					`*Tutorial Pembayaran*:\n` +
					`1. Scan QRIS di atas menggunakan e-wallet (Dana, Ovo, Gopay, LinkAja) atau m-Banking Anda.\n` +
					`2. Pastikan nominal transfer sesuai dengan total tagihan.\n` +
					`3. Setelah pembayaran berhasil, klik tombol di bawah ini atau ketik \`.konfirmasi\` untuk mengirimkan bukti transfer.`;
				
				await naze.sendButtonMsg(m.chat, {
					image: global.qris,
					caption: paymentMsg,
					footer: 'Ti Assistant Bot Payment System',
					buttons: [
						{ buttonId: '.konfirmasi', buttonText: { displayText: 'Konfirmasi Pembayaran ✅' }, type: 1 }
					]
				}, { quoted: m });
			}
			break
			case 'konfirmasi': {
				if (m.isGroup) return m.reply(global.mess.private);
				let pending = global.db.pendingSewa[m.sender];
				if (!pending || !pending.groupJid || pending.step !== 'waiting_payment') {
					return m.reply(`Tidak ada tagihan sewa yang sedang aktif atau menunggu pembayaran.`);
				}
				pending.step = 'waiting_receipt_image';
				m.reply(`Silakan kirimkan foto/screenshot bukti transfer pembayaran Anda sekarang.`);
			}
			break
			case 'accsewa': {
				if (!isCreator) return m.reply(global.mess.owner);
				let argsAcc = text.split(' ').map(x => x.trim());
				let status = argsAcc[0];
				let sender = argsAcc[1];
				let groupJid = argsAcc[2];
				let days = parseInt(argsAcc[3]);
				
				if (!status || !sender || !groupJid) {
					return m.reply(`Format salah! Gunakan: \`.accsewa [yes/no] [sender_jid] [group_jid] [days]\``);
				}
				
				if (status === 'yes') {
					addExpired({ id: groupJid, expired: days + 'd', url: '' }, sewa);
					
					await naze.sendMessage(sender, { text: `🎉 *Pembayaran Terkonfirmasi!*\n\nSewa bot untuk grup Anda telah diaktifkan selama *${days} hari*. Bot sekarang sudah dapat digunakan secara normal di grup!` });
					
					await naze.sendMessage(groupJid, { text: `🎉 *Bot Telah Diaktifkan!*\n\nTerima kasih, sewa bot untuk grup ini telah diaktifkan oleh Owner selama *${days} hari*. Silakan gunakan fitur-fitur bot dengan normal!` });
					
					m.reply(`Sukses mengonfirmasi sewa untuk grup ${groupJid} selama ${days} hari.`);
				} else {
					await naze.sendMessage(sender, { text: `❌ *Pembayaran Ditolak!*\n\nMaaf, bukti transfer sewa bot untuk grup Anda ditolak oleh Owner. Silakan hubungi Owner jika ada pertanyaan.` });
					m.reply(`Sewa untuk grup ${groupJid} telah ditolak.`);
				}
				
				delete global.db.pendingSewa[sender];
			}
			break
			case 'bypasssewa': {
				if (!isCreator) return m.reply(global.mess.owner);
				let targetGroup = text.trim();
				if (!targetGroup) return m.reply(`Masukkan ID Grup!`);
				
				addExpired({ id: targetGroup, expired: '36500d', url: '' }, sewa);
				
				m.reply(`Sukses melakukan bypass sewa secara permanen (gratis selamanya) untuk grup:\n• *ID*: ${targetGroup}`);
				
				await naze.sendMessage(targetGroup, { text: `🎉 *Bot Telah Diaktifkan Permanen!*\n\nOwner telah memberikan izin *Bypass Gratis Selamanya* untuk grup ini! Silakan gunakan semua fitur bot dengan normal!` });
			}
			break
			case 'delsewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`)
				let urlny;
				if (text.includes('chat.whatsapp.com/')) {
					urlny = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)[1]
				} else if (/@g\.us$/.test(text)) {
					urlny = text.trim()
				} else {
					return m.reply('Format tidak valid❗')
				}
				if (checkStatus(urlny, sewa)) {
					await m.reply(global.mess.done)
					await naze.groupLeave(getStatus(urlny, sewa).id).catch(e => {});
					sewa.splice(getPosition(urlny, sewa), 1);
				} else m.reply(`${text} Tidak Terdaftar Di Database\nExample:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`)
			}
			break
			case 'listsewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				let txt = `*------「 LIST SEWA 」------*\n\n`
				for (let s of sewa) {
					txt += `➸ *ID*: ${s.id}\n➸ *Url*: https://chat.whatsapp.com/${s.url}\n➸ *Expired*: ${formatDate(s.expired)}\n\n`
				}
				m.reply(txt)
			}
			break
			case 'addpr': case 'addprem': case 'addpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30 hari`)
				let [teks1, teks2] = text.split('|').map(x => x.trim());
				const findJid = naze.findJidByLid(teks1.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = teks1.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (teks2) {
					if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
						addExpired({ id: nmrnya, expired: teks2.replace(/[^0-9]/g, '') + 'd' }, premium);
						m.reply(`Sukses ${command} @${nmrnya.split('@')[0]} Selama ${teks2}`)
						db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.premium
						db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.premium
					} else m.reply('Nomer tidak terdaftar di BOT !\nPastikan Nomer Pernah Menggunakan BOT!')
				} else m.reply(`Masukkan waktunya!\Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30d\n_d = day_`)
			}
			break
			case 'delpr': case 'delprem': case 'delpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} @tag`)
				const findJid = naze.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = naze.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
					if (checkStatus(nmrnya, premium)) {
						premium.splice(getPosition(nmrnya, premium), 1);
						m.reply(`Sukses ${command} @${nmrnya.split('@')[0]}`)
						db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.free
						db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.free
					} else m.reply(`User @${nmrnya.split('@')[0]} Bukan Premium❗`)
				} else m.reply('Nomer tidak terdaftar di BOT !')
			}
			break
			case 'listpr': case 'listprem': case 'listpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				let txt = `*------「 LIST PREMIUM 」------*\n\n`
				for (let userprem of premium) {
					txt += `➸ *Nomer*: @${userprem.id.split('@')[0]}\n➸ *Limit*: ${db.users[userprem.id].limit}\n➸ *Money*: ${db.users[userprem.id].money.toLocaleString('id-ID')}\n➸ *Expired*: ${formatDate(userprem.expired)}\n\n`
				}
				m.reply(txt)
			}
			break
			case 'upsw': {
				if (!isCreator) return m.reply(global.mess.owner)
				const statusJidList = Object.keys(db.users)
				const backgroundColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
				try {
					if (quoted.isMedia) {
						let media = await naze.downloadAndSaveMediaMessage(qmsg);
						try {
							if (/image|video/.test(quoted.mime)) {
								await naze.sendMessage('status@broadcast', {
									[`${quoted.mime.split('/')[0]}`]: { url: media },
									caption: text || m.quoted?.body || ''
								}, { statusJidList, broadcast: true })
								m.react('✅')
							} else if (/audio/.test(quoted.mime)) {
								await naze.sendMessage('status@broadcast', {
									audio: { url: media },
									mimetype: 'audio/mp4',
									ptt: true
								}, { backgroundColor, statusJidList, broadcast: true })
								m.react('✅')
							} else m.reply('Only Support video/audio/image/text')
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else if (quoted.text) {
						await naze.sendMessage('status@broadcast', { text: text || m.quoted?.body || '' }, {
							textArgb: 0xffffffff,
							font: Math.floor(Math.random() * 9),
							backgroundColor, statusJidList,
							broadcast: true
						})
						m.react('✅')
					} else m.reply('Only Support video/audio/image/text')
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'addcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text && !text.startsWith('case')) return m.reply('Masukkan Casenya!')
				fs.readFile(__filename, 'utf8', (err, data) => {
					if (err) {
						console.error('Terjadi kesalahan saat membaca file:', err);
						return;
					}
					const posisi = data.indexOf("case '19rujxl1e':");
					if (posisi !== -1) {
						const codeBaru = data.slice(0, posisi) + '\n' + `${text}` + '\n' + data.slice(posisi);
						fs.writeFile(__filename, codeBaru, 'utf8', (err) => {
							if (err) {
								m.reply('Terjadi kesalahan saat menulis file: ', err);
							} else m.reply(global.mess.done);
						});
					} else m.reply(global.mess.fail);
				});
			}
			break
			case 'getcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Nama Casenya!')
				try {
					const getCase = (cases) => {
						return "case"+`'${cases}'`+fs.readFileSync(__filename).toString().split('case \''+cases+'\'')[1].split("break")[0]+"break"
					}
					m.reply(`${getCase(text)}`)
				} catch (e) {
					m.reply(`case ${text} tidak ditemukan!`)
				}
			}
			break
			case 'delcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Nama Casenya!')
				fs.readFile(__filename, 'utf8', (err, data) => {
					if (err) {
						console.error('Terjadi kesalahan saat membaca file:', err);
						return;
					}
					const regex = new RegExp(`case\\s+'${text.toLowerCase()}':[\\s\\S]*?break`, 'g');
					const modifiedData = data.replace(regex, '');
					fs.writeFile(__filename, modifiedData, 'utf8', (err) => {
						if (err) {
							console.log(err);
							m.reply(global.mess.fail);
						} else m.reply(global.mess.done);
					});
				});
			}
			break
			case 'backup': {
				if (!isCreator) return m.reply(global.mess.owner)
				switch (args[0]) {
					case 'all':
					let bekup = './database/backup_all.tar.gz';
					tarBackup('./', bekup).then(() => {
						return m.reply({
							document: fs.readFileSync(bekup),
							mimetype: 'application/gzip',
							fileName: 'backup_all.tar.gz'
						})
					}).catch(e => m.reply('Gagal backup: ', + e))
					break
					case 'auto':
					if (set.autobackup) return m.reply('Sudah Aktif Sebelumnya!')
					set.autobackup = true
					m.reply('Sukses Mengaktifkan Auto Backup')
					break
					case 'session':
					await m.reply({
						document: fs.readFileSync('./nazedev/creds.json'),
						mimetype: 'application/json',
						fileName: 'creds.json'
					});
					break
					case 'database':
					let tglnya = new Date().toISOString().replace(/[:.]/g, '-');
					let datanya = './database/' + global.tempatDB;
					if (global.tempatDB.startsWith('mongodb')) {
						datanya = './database/backup_database.json';
						fs.writeFileSync(datanya, JSON.stringify(global.db, null, 2), 'utf-8');
					}
					await m.reply({
						document: fs.readFileSync(datanya),
						mimetype: 'application/json',
						fileName: tglnya + '_database.json'
					})
					break
					default:
					m.reply('Gunakan perintah:\n- backup all\n- backup auto\n- backup session\n- backup database');
				}
			}
			break
			case 'getsession': {
				if (!isCreator) return m.reply(global.mess.owner)
				await m.reply({
					document: fs.readFileSync('./nazedev/creds.json'),
					mimetype: 'application/json',
					fileName: 'creds.json'
				});
			}
			break
			case 'deletesession': case 'delsession': {
				if (!isCreator) return m.reply(global.mess.owner)
				fs.readdir('./nazedev', async function (err, files) {
					if (err) {
						console.error('Unable to scan directory: ' + err);
						return m.reply('Unable to scan directory: ' + err);
					}
					let filteredArray = await files.filter(item => ['session-', 'pre-key', 'sender-key', 'app-state'].some(ext => item.startsWith(ext)));					
					let teks = `Terdeteksi ${filteredArray.length} Session file\n\n`
					if(filteredArray.length == 0) return m.reply(teks);
					filteredArray.map(function(e, i) {
						teks += (i+1)+`. ${e}\n`
					})
					if (text && text == 'true') {
						let { key } = await m.reply('Menghapus Session File..')
						await filteredArray.forEach(function (file) {
							fs.unlinkSync('./nazedev/' + file)
						});
						sleep(2000)
						m.reply('Berhasil Menghapus Semua Sampah Session', { edit: key })
					} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`)
				});
			}
			break
			case 'deletesampah': case 'delsampah': case 'deletetemp': case 'deltemp': {
				if (!isCreator) return m.reply(global.mess.owner)
				fs.readdir('./database/temp', async function (err, files) {
					if (err) {
						console.error('Unable to scan directory: ' + err);
						return m.reply('Unable to scan directory: ' + err);
					}
					let filteredArray = await files.filter(item => ['gif', 'png', 'bin','mp3', 'mp4', 'jpg', 'webp', 'webm', 'opus', 'jpeg'].some(ext => item.endsWith(ext)));
					let teks = `Terdeteksi ${filteredArray.length} Sampah file\n\n`
					if(filteredArray.length == 0) return m.reply(teks);
					filteredArray.map(function(e, i) {
						teks += (i+1)+`. ${e}\n`
					})
					if (text && text == 'true') {
						let { key } = await m.reply('Menghapus Sampah File..')
						await filteredArray.forEach(function (file) {
							fs.unlinkSync('./database/temp/' + file)
						});
						sleep(2000)
						m.reply('Berhasil Menghapus Semua Sampah', { edit: key })
					} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`)
				});
			}
			break
			case 'setmessbot': case 'setbotmessages': {
				if (!isCreator) return m.reply(global.mess.owner)
				const res = await fetchJson('https://raw.githubusercontent.com/nazedev/database/refs/heads/master/bot/lang.json');
				if (res.some(a => a.lang === text)) {
					const selectedLang = res.find(a => a.lang === text);
					await updateSettings({
						filePath: settingsPath,
						newMess: selectedLang.messages
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} en\n*List Lang :*\n${res.map(a => '- ' + a.lang).join('\n')}`)
			}
			break
			case 'setlimitbot': case 'setbotlimit': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (['free','premium','vip'].includes(args[0]) && !isNaN(args[1])) {
					await updateSettings({
						filePath: settingsPath,
						setLimitRole: { role: args[0], value: Number(args[1]) }
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.limit.free}\n- premium ${global.limit.premium}\n- vip ${global.limit.vip}`)
			}
			break
			case 'setmoneybot': case 'setbotmoney': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (['free','premium','vip'].includes(args[0]) && !isNaN(args[1])) {
					await updateSettings({
						filePath: settingsPath,
						setMoneyRole: { role: args[0], value: Number(args[1]) }
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.money.free}\n- premium ${global.money.premium}\n- vip ${global.money.vip}`)
			}
			break
			case 'setnamebot': case 'setbotname': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						botname: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Ti Assistant Bot`)
			}
			break
			case 'setpacknamebot': case 'setbotpackname': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						packname: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} By Ti Assistant Bot`)
			}
			break
			case 'setauthorbot': case 'setbotauthor': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						author: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Ti Assistant Bot`)
			}
			break
			case 'setlocale': case 'setlocalebot': case 'setbotlocale': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					if (!locales.includes(teksnya)) return m.reply('Locale List:\n' + locales.map(a => '- ' + a).join('\n'))
					await updateSettings({
						filePath: settingsPath,
						locale: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} en`)
			}
			break
			case 'settimezone': case 'settimezonebot': case 'setbottimezone': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					if (!timez.includes(teksnya)) return m.reply('Timezone List:\n' + timez.map(a => '- ' + a).join('\n'))
					await updateSettings({
						filePath: settingsPath,
						timezone: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Asia/Jakarta`)
			}
			break
			case 'setapikey': case 'setbotapikey': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Mana apikey nya?')
				if (!text.startsWith('nz-')) return m.reply('Apikey Tidak Valid!\nAmbil Apikey di : https://naze.biz.id/profile');
				
				let old_key = global.APIKeys[global.APIs.naze];
				await updateSettings({
					filePath: settingsPath,
					apikey: text.trim()
				});
				
				// Sync with setting.json
				try {
					let settings = JSON.parse(fs.readFileSync('./setting.json', 'utf-8'));
					if (!settings.apiKeys.includes(text.trim())) {
						settings.apiKeys.unshift(text.trim());
						fs.writeFileSync('./setting.json', JSON.stringify(settings, null, 2), 'utf-8');
					}
				} catch (e) {
					console.error('Error updating setting.json in setapikey:', e);
				}
				
				m.reply(`*Apikey telah di ganti dari ${old_key} menjadi ${text.trim()}*`)
			}
			break

			case 'donasi': case 'donate': {
				m.reply({ image: { url: './src/media/qris.jpg' }, caption: `👋 Halo @${m.sender.split('@')[0]},\n\nTerima kasih sudah menggunakan bot ini! 🙏\nDonasi ya agar bot selalu hidup dan fitur-fiturnya terus bertambah.\nBerapapun donasi kamu akan sangat berarti! ✨`, mentions: [m.sender] })
			}
			break
			
			// Absen Menu
			case 'buatabsen': case 'absensi': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!text) return m.reply(`Example: ${prefix + command} Absensi machine learning\nAtau dengan tanggal: ${prefix + command} {date} Absensi machine learning`)
				
				// Process {date} placeholder
				let judulAbsen = text;
				let dateStr = '';
				if (judulAbsen.includes('{date}')) {
					const now = new Date();
					const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
					const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
					dateStr = `${hariList[now.getDay()]} ${now.getDate()}-${bulanList[now.getMonth()]}-${now.getFullYear()}`;
					judulAbsen = judulAbsen.replace('{date}', '').trim();
				}
				
				let user = db.users[m.sender];
				let initialList = [];
				let absenHeader = `*${judulAbsen}*`;
				if (dateStr) absenHeader += `\nDate: ${dateStr}`;
				let absenTitle;
				
				if (user && user.absenName) {
					initialList.push({ id: m.sender, name: user.absenName });
					absenTitle = `${absenHeader}\n\n1. ${user.absenName}`;
				} else {
					absenTitle = `${absenHeader}\n\nBelum ada yang absen.`;
				}
				
				let msg = await naze.sendMessage(m.chat, { text: absenTitle });
				
				// Pin the message
				await naze.sendMessage(m.chat, { pin: { type: 1, time: 2592000, key: msg.key }}).catch(e => console.log('Gagal pin absen:', e));
				
				m.reply(`Ketik *${prefix}absen nama anda*, jika sudah pernah cukup *${prefix}absen*\n\n_Lakukan pin manual pada pesan absen di atas._`);
				
				global.db.absen[m.chat] = {
					title: judulAbsen,
					date: dateStr,
					key: msg.key,
					list: initialList
				};
				if (global.db) await database.write(global.db);
			}
			break
			case 'absen': {
				if (!m.isGroup) return m.reply(global.mess.group)
				let activeAbsen = global.db.absen[m.chat];
				if (!activeAbsen) return m.reply('Tidak ada sesi absen yang aktif di grup ini.');
				
				let user = db.users[m.sender];
				if (text) {
					user.absenName = text; // Save or update name
				} else if (!user.absenName) {
					return m.reply(`Ketik *${prefix}absen nama anda*, contoh: *${prefix}absen Farid Suryadi*`);
				}
				
				let userName = user.absenName;
				
				// Check if user is already in the list
				const isSameUser = (id1, id2) => {
					let j1 = naze.decodeJid(id1);
					let j2 = naze.decodeJid(id2);
					if (j1 === j2) return true;
					let p1 = naze.findJidByLid(j1, global.store) || j1;
					let p2 = naze.findJidByLid(j2, global.store) || j2;
					return naze.decodeJid(p1) === naze.decodeJid(p2);
				};
				let existingIndex = activeAbsen.list.findIndex(u => isSameUser(u.id, m.sender));
				if (existingIndex !== -1) {
					activeAbsen.list[existingIndex].name = userName; // Update name if changed
				} else {
					activeAbsen.list.push({ id: m.sender, name: userName });
				}
				
				// Reconstruct text
				let absenHeader = `*${activeAbsen.title}*`;
				if (activeAbsen.date) absenHeader += `\nDate: ${activeAbsen.date}`;
				let newText = `${absenHeader}\n\n`;
				activeAbsen.list.forEach((u, i) => {
					newText += `${i + 1}. ${u.name}\n`;
				});
				
				// Edit the original pinned message
				await naze.sendMessage(m.chat, { text: newText.trim(), edit: activeAbsen.key });
				m.reply(`Berhasil absen!`);
				if (global.db) await database.write(global.db);
			}
			break
			case 'tutupabsen': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				let activeAbsen = global.db.absen[m.chat];
				if (!activeAbsen) return m.reply('Tidak ada sesi absen yang aktif di grup ini.');
				
				// Unpin message
				await naze.sendMessage(m.chat, { pin: { type: 0, time: 2592000, key: activeAbsen.key }}).catch(e => {});
				
				let listText = '';
				if (activeAbsen.list.length > 0) {
					activeAbsen.list.forEach((u, i) => {
						listText += `${i + 1}. ${u.name}\n`;
					});
				} else {
					listText = 'Belum ada yang absen.\n';
				}
				
				await m.reply(`Absensi *${activeAbsen.title}* ditutup.`);
				
				let resultMessage = `*${activeAbsen.title}*\n`;
				if (activeAbsen.date) resultMessage += `Date: ${activeAbsen.date}\n`;
				resultMessage += `\n${listText.trim()}\n\nTotal absen: *${activeAbsen.list.length} orang*`;
				
				await naze.sendMessage(m.chat, { text: resultMessage });
				
				delete global.db.absen[m.chat];
				if (global.db) await database.write(global.db);
			}
			break

			
			// Group Menu
			case 'add': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					try {
						await naze.groupParticipantsUpdate(m.chat, [nmrnya], 'add').then(async (res) => {
							for (let i of res) {
								let invv = await naze.groupInviteCode(m.chat)
								const statusMessages = {
									200: `Berhasil menambahkan @${nmrnya.split('@')[0]} ke grup!`,
									401: 'Dia Memblokir Bot!',
									409: 'Dia Sudah Join!',
									500: 'Grup Penuh!'
								};
								if (statusMessages[i.status]) {
									return m.reply(statusMessages[i.status]);
								} else if (i.status == 408) {
									await m.reply(`@${nmrnya.split('@')[0]} Baru-Baru Saja Keluar Dari Grub Ini!\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`)
									await m.reply(`${'https://chat.whatsapp.com/' + invv}\n------------------------------------------------------\n\nAdmin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, { detectLink: true, chat: nmrnya, quoted: fkontak }).catch((err) => m.reply('Gagal Mengirim Undangan!'))
								} else if (i.status == 403) {
									let a = i.content.content[0].attrs
									await naze.sendGroupInviteV4(m.chat, nmrnya, a.code, a.expiration, m.metadata.subject, `Admin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, null, { mentions: [m.sender] })
									await m.reply(`@${nmrnya.split('@')[0]} Tidak Dapat Ditambahkan\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`)
								} else m.reply('Gagal Add User\nStatus : ' + i.status)
							}
						})
					} catch (e) {
						m.reply(global.mess.fail)
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'kick': case 'dor': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					await naze.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'promote': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					await naze.groupParticipantsUpdate(m.chat, [nmrnya], 'promote').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'demote': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					await naze.groupParticipantsUpdate(m.chat, [nmrnya], 'demote').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'warn': case 'warning': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					if (!db.groups[m.chat].warn[nmrnya]) {
						db.groups[m.chat].warn[nmrnya] = 1
						m.reply('Warning 1/4, akan dikick sewaktu waktu❗')
					} else if (db.groups[m.chat].warn[nmrnya] >= 3) {
						await naze.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch((err) => m.reply(global.mess.fail))
						delete db.groups[m.chat].warn[nmrnya]
					} else {
						db.groups[m.chat].warn[nmrnya] += 1
						m.reply(`Warning ${db.groups[m.chat].warn[nmrnya]}/4, akan dikick sewaktu waktu❗`)
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'unwarn': case 'delwarn': case 'unwarning': case 'delwarning': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = naze.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = naze.findJidByLid(klss, store, true)
					if (db.groups[m.chat]?.warn?.[nmrnya]) {
						delete db.groups[m.chat].warn[nmrnya]
						m.reply('Berhasil Menghapus Warning!')
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'setname': case 'setnamegc': case 'setsubject': case 'setsubjectgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await naze.groupUpdateSubject(m.chat, teksnya).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'setdesc': case 'setdescgc': case 'setdesk': case 'setdeskgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await naze.groupUpdateDescription(m.chat, teksnya).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'setppgroups': case 'setppgrup': case 'setppgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.quoted) return m.reply('Reply Gambar yang mau dipasang di Profile Bot')
				if (!/image/.test(quoted.type)) return m.reply(`Reply Image Dengan Caption ${prefix + command}`)
				let media = await quoted.download();
				let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512)
				await naze.query({
					tag: 'iq',
					attrs: {
						target: m.chat,
						to: '@s.whatsapp.net',
						type: 'set',
						xmlns: 'w:profile:picture'
					},
					content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }]
				});
				m.reply(global.mess.done)
			}
			break
			case 'delete': case 'del': case 'd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				await naze.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: m.isBotAdmin ? false : true, id: m.quoted.id, participant: m.quoted.sender }})
			}
			break
			case 'pin': case 'unpin': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				await naze.sendMessage(m.chat, { pin: { type: command == 'pin' ? 1 : 0, time: 2592000, key: m.quoted ? m.quoted.key : m.key }})
			}
			break
			case 'linkgroup': case 'linkgrup': case 'linkgc': case 'urlgroup': case 'urlgrup': case 'urlgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let response = await naze.groupInviteCode(m.chat)
				await m.reply(`https://chat.whatsapp.com/${response}\n\nLink Group : ${(store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = await naze.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] })))).subject}`, { detectLink: true })
			}
			break
			case 'revoke': case 'newlink': case 'newurl': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				await naze.groupRevokeInvite(m.chat).then((a) => {
					m.reply(`Sukses Menyetel Ulang, Tautan Undangan Grup ${m.metadata.subject}`)
				}).catch((err) => m.reply(global.mess.fail))
			}
			break
			case 'group': case 'grup': case 'gc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let set = db.groups[m.chat]
				switch (args[0]?.toLowerCase()) {
					case 'close': case 'open':
					await naze.groupSettingUpdate(m.chat, args[0] == 'close' ? 'announcement' : 'not_announcement').then(a => m.reply(`*Sukses ${args[0] == 'open' ? 'Membuka' : 'Menutup'} Group*`))
					break
					case 'join':
					const _list = await naze.groupRequestParticipantsList(m.chat).then(a => a.map(b => b.jid))
					if (/(a(p|pp|cc)|(ept|rove))|true|ok/i.test(args[1]) && _list.length > 0) {
						await naze.groupRequestParticipantsUpdate(m.chat, _list, 'approve').catch(e => m.react('❌'))
					} else if (/reject|false|no/i.test(args[1]) && _list.length > 0) {
						await naze.groupRequestParticipantsUpdate(m.chat, _list, 'reject').catch(e => m.react('❌'))
					} else m.reply(`List Request Join :\n${_list.length > 0 ? '- @' + _list.join('\n- @').split('@')[0] : '*Nothing*'}\nExample : ${prefix + command} join acc/reject`)
					break
					case 'pesansementara': case 'disappearing':
					if (/90|7|1|24|on/i.test(args[1])) {
						naze.sendMessage(m.chat, { disappearingMessagesInChat: /90/i.test(args[1]) ? 7776000 : /7/i.test(args[1]) ? 604800 : 86400 })
					} else if (/0|off|false/i.test(args[1])) {
						naze.sendMessage(m.chat, { disappearingMessagesInChat: 0 })
					} else m.reply('Silahkan Pilih :\n90 hari, 7 hari, 1 hari, off')
					break
					case 'antilink': case 'antivirtex': case 'antidelete': case 'welcome': case 'antitoxic': case 'waktusholat': case 'nsfw': case 'antihidetag': case 'setinfo': case 'antitagsw': case 'leave': case 'promote': case 'demote':
					if (/on|true/i.test(args[1])) {
						if (set[args[0]]) return m.reply('*Sudah Aktif Sebelumnya*')
						set[args[0]] = true
						m.reply('*Sukses Change To On*')
					} else if (/off|false/i.test(args[1])) {
						set[args[0]] = false
						m.reply('*Sukses Change To Off*')
					} else m.reply(`❗${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`)
					break
					case 'setwelcome': case 'setleave': case 'setpromote': case 'setdemote':
					if (args[1]) {
						set.text[args[0]] = args.slice(1).join(' ');
						m.reply(`Sukses Mengubah ${args[0].split('set')[1]} Menjadi:\n${set.text[args[0]]}`)
					} else m.reply(`Example:\n${prefix + command} ${args[0]} Isi Pesannya\n\nMisal Dengan tag:\n${prefix + command} ${args[0]} Kepada @\nMaka akan Menjadi:\nKepada @0\n\nMisal dengan Tag admin:\n${prefix + command} ${args[0]} Dari @admin untuk @\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0\n\nMisal dengan Nama grup:\n${prefix + command} ${args[0]} Dari @admin untuk @ di @subject\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0 di ${m.metadata.subject}`, { mentions: ['0@s.whatsapp.net'] })
					break
					default:
					m.reply(`Settings Group ${m.metadata.subject}\n- open\n- close\n- join acc/reject\n- disappearing 90/7/1/off\n- antilink on/off ${set.antilink ? '🟢' : '🔴'}\n- antivirtex on/off ${set.antivirtex ? '🟢' : '🔴'}\n- antidelete on/off ${set.antidelete ? '🟢' : '🔴'}\n- welcome on/off ${set.welcome ? '🟢' : '🔴'}\n- leave on/off ${set.leave ? '🟢' : '🔴'}\n- promote on/off ${set.promote ? '🟢' : '🔴'}\n- demote on/off ${set.demote ? '🟢' : '🔴'}\n- setinfo on/off ${set.setinfo ? '🟢' : '🔴'}\n- nsfw on/off ${set.nsfw ? '🟢' : '🔴'}\n- waktusholat on/off ${set.waktusholat ? '🟢' : '🔴'}\n- antihidetag on/off ${set.antihidetag ? '🟢' : '🔴'}\n- antitoxic on/off ${set.antitoxic ? '🟢' : '🔴'}\n- antitagsw on/off ${set.antitagsw ? '🟢' : '🔴'}\n\n- setwelcome _textnya_\n- setleave _textnya_\n- setpromote _textnya_\n- setdemote _textnya_\n\nExample:\n${prefix + command} antilink off`)
				}
			}
			break
			case 'tagall': case 'all': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let setv = pickRandom(global.listv)
				let teks = `*Tag All*\n\n*Pesan :* ${q ? q : ''}\n\n`
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				for (let mem of participants) {
					const number = (mem.phoneNumber || mem.id || '').split('@')[0].split(':')[0];
					teks += `${setv} @${number}\n`
				}
				await m.reply(teks, { mentions: participants.map(a => a.id) })
			}
			break
			case 'hidetag': case 'h': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				await m.reply(q ? q : '', { mentions: participants.map(a => a.id) })
			}
			break
			case 'totag': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.quoted) return m.reply(global.mess.quoted)
				delete m.quoted.chat
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				await naze.sendMessage(m.chat, { forward: m.quoted.fakeObj(), mentions: participants.map(a => a.id) })
			}
			break
			case 'listonline': case 'liston': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let id = args && /\d+\-\d+@g.us/.test(args[0]) ? args[0] : m.chat
				if (!store.presences || !store.presences[id]) return m.reply('Sedang Tidak ada yang online!')
				const groupPresences = store.presences[id];
				const metadata = store.groupMetadata[id];
				let list_online = [];
				if (metadata && metadata.participants) {
					for (const p of metadata.participants) {
						if (groupPresences[p.id]) {
							list_online.push(p.phoneNumber);
						}
					}
				}
				if (!list_online.includes(botNumber)) {
					list_online.push(botNumber);
				}
				if (list_online.length === 0) return m.reply('Sedang tidak ada yang online!'); 
				let textReply = '*List Online:*\n\n' + list_online.map(v => setv + ' @' + v.split('@')[0]).join('\n');
				await m.reply(textReply, { mentions: list_online }).catch(() => m.reply('Gagal menampilkan list online..'));
			}
			break
			case 'totalpesan': case 'totalchat': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let messageCount = {};
				let messages = store?.messages[m.chat]?.array || [];
				let participants = (m?.metadata?.participants?.map(p => p.phoneNumber) || store?.messages[m.chat]?.array?.map(p => p.key.participantAlt) || []).filter(p => p);
				messages.forEach(mes => {
					if (mes.key?.participantAlt && mes.message) {
						messageCount[mes.key.participantAlt] = (messageCount[mes.key.participantAlt] || 0) + 1;
					}
				});
				let totalMessages = Object.values(messageCount).reduce((a, b) => a + b, 0);
				let date = new Date().toLocaleDateString('id-ID');
				let zeroMessageUsers = participants.filter(user => !messageCount[user]).map(user => `- @${user.replace(/[^0-9]/g, '')}`);
				let messageList = Object.entries(messageCount).map(([sender, count], index) => `${index + 1}. @${sender.replace(/[^0-9]/g, '')}: ${count} Pesan`);
				let result = `Total Pesan ${totalMessages} dari ${participants.length} anggota\nPada tanggal ${date}:\n${messageList.join('\n')}\n\nNote: ${text.length > 0 ? `\n${zeroMessageUsers.length > 0 ? `Sisa Anggota yang tidak mengirim pesan (Sider):\n${zeroMessageUsers.join('\n')}` : 'Semua anggota sudah mengirim pesan!'}` : `\nCek Sider? ${prefix + command} --sider`}`;
				m.reply(result)
			}
			break
			
			// Bot Menu
			case 'owner': case 'listowner': {
				await naze.sendContact(m.chat, ownerNumber, m);
			}
			break
			case 'profile': case 'cek': {
				const user = Object.keys(db.users)
				const infoUser = db.users[m.sender]
				await m.reply(`*👤Profile @${m.sender.split('@')[0]} :*\n🐋User Bot : ${user.includes(m.sender) ? 'True' : 'False'}\n🔥User : ${isVip ? 'VIP' : isPremium ? 'PREMIUM' : 'FREE'}${isPremium ? `\n⏳Expired : ${checkStatus(m.sender, premium) ? formatDate(getExpired(m.sender, db.premium)) : '-'}` : ''}\n🎫Limit : ${infoUser.limit}\n💰Uang : ${infoUser ? infoUser.money.toLocaleString('id-ID') : '0'}`)
			}
			break
			case 'leaderboard': {
				const entries = Object.entries(db.users).sort((a, b) => b[1].money - a[1].money).slice(0, 10).map(entry => entry[0]);
				let teksnya = '╭──❍「 *LEADERBOARD* 」❍\n'
				for (let i = 0; i < entries.length; i++) {
					teksnya += `│• ${i + 1}. @${entries[i].split('@')[0]}\n│• Balance : ${db.users[entries[i]].money.toLocaleString('id-ID')}\n│\n`
				}
				m.reply(teksnya + '╰──────❍');
			}
			break
			case 'req': case 'request': {
				if (!text) return m.reply('Mau Request apa ke Owner?')
				await m.reply(`*Request Telah Terkirim Ke Owner*\n_Terima Kasih🙏_`)
				await naze.sendFromOwner(ownerNumber, `Pesan Dari : @${m.sender.split('@')[0]}\nUntuk Owner\n\nRequest ${text}`, m, { contextInfo: { mentionedJid: [m.sender], isForwarded: true }})
			}
			break
			case 'totalfitur': {
				const total = ((fs.readFileSync(__filename).toString()).match(/case '/g) || []).length
				m.reply(`Total Fitur : ${total}`);
			}
			break
			case 'daily': case 'claim': {
				daily(m, db)
			}
			break
			case 'transfer': case 'tf': {
				transfer(m, args, db)
			}
			break
			case 'buy': {
				buy(m, args, db)
			}
			break
			case 'react': {
				naze.sendMessage(m.chat, { react: { text: args[0], key: m.quoted ? m.quoted.key : m.key }})
			}
			break
			case 'tagme': {
				m.reply(`@${m.sender.split('@')[0]}`, { mentions: [m.sender] })
			}
			break
			case 'runtime': case 'tes': case 'bot': {
				if (!args[0] && !args[1]) return m.reply(`*Bot Telah Online Selama*\n*${runtime(process.uptime())}*`);
				switch(args[0]) {
					case 'mode': case 'public': case 'self':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'public' || args[1] == 'all') {
						if (naze.public && set.grouponly && set.privateonly) return m.reply('*Sudah Aktif Sebelumnya*')
						naze.public = set.public = true
						set.grouponly = true
						set.privateonly = true
						m.reply('*Sukses Change To Public Usage*')
					} else if (args[1] == 'self') {
						set.grouponly = false
						set.privateonly = false
						naze.public = set.public = false
						m.reply('*Sukses Change To Self Usage*')
					} else if (args[1] == 'group') {
						set.grouponly = true
						set.privateonly = false
						m.reply('*Sukses Change To Group Only*')
					} else if (args[1] == 'private') {
						set.grouponly = false
						set.privateonly = true
						m.reply('*Sukses Change To Private Only*')
					} else m.reply('Mode self/public/group/private/all')
					break
					case 'log': case 'anticall': case 'autobio': case 'autoread': case 'autotyping': case 'readsw': case 'multiprefix': case 'antispam': case 'didyoumean':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						if (set[args[0]]) return m.reply('*Sudah Aktif Sebelumnya*')
						set[args[0]] = true
						m.reply('*Sukses Change To On*')
					} else if (args[1] == 'off') {
						set[args[0]] = false
						m.reply('*Sukses Change To Off*')
					} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`)
					break
					case 'set': case 'settings':
					let settingsBot = Object.entries(set).map(([key, value]) => {
						let list = key == 'status' ? new Date(value).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (typeof value === 'boolean') ? (value ? 'on🟢' : 'off🔴') : (typeof value === 'object') ? `\n${value.map(a => '- ' + a).join('\n')}` : value;
						return `- ${key.charAt(0).toUpperCase() + key.slice(1)} : ${list}`;
					}).join('\n');
					m.reply(`Settings Bot @${botNumber.split('@')[0]}\n${settingsBot}\n\nExample: ${prefix + command} mode`);
					break
					case 'author': case 'authorprefix':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						set.authorPrefix = '.';
						m.reply(global.mess.done)
					} else if (args[1] == 'off') {
						set.authorPrefix = '';
						m.reply(global.mess.done)
					} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`)
					break
					case 'whitelist': case 'whitelistmode':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						set.whitelistonly = true
						m.reply('*Sukses Change To Whitelist Mode*')
					} else if (args[1] == 'off') {
						set.whitelistonly = false
						m.reply('*Sukses Change To Normal Mode*')
					} else m.reply('Whitelist on/off')
					break
					default: {
						let menuList = `*⚙️ SETTINGS BOT ⚙️*
					
Select Bot Settings:

*👥 Mode Penggunaan:*
- Mode Bot : *${prefix + command} mode [public/self/group/private]*
- Whitelist Mode : *${prefix + command} whitelist [on/off]*

*🎛️ Fitur Otomatis (on/off):*
- Anti Call : *${prefix + command} anticall [on/off]*
- Anti Spam : *${prefix + command} antispam [on/off]*
- Auto Bio : *${prefix + command} autobio [on/off]*
- Auto Read : *${prefix + command} autoread [on/off]*
- Auto Typing : *${prefix + command} autotyping [on/off]*
- Read Status/SW : *${prefix + command} readsw [on/off]*

*💰 Fitur Sewa Grup:*
- Wajib Sewa : *${prefix}sewaon / ${prefix}sewaoff*

*🛠️ System Settings:*
- Multi Prefix : *${prefix + command} multiprefix [on/off]*
- Did You Mean : *${prefix + command} didyoumean [on/off]*
- Log Console : *${prefix + command} log [on/off]*
- Author Prefix : *${prefix + command} author [on/off]*

*📊 Info & Status:*
- Cek Semua Setting : *${prefix + command} set*
- Cek Runtime Bot : *${prefix + command}*`;
						if (args[0] || args[1]) m.reply(menuList);
					}
				}
			}
			break
			case 'ping': case 'botstatus': case 'statusbot': {
				const used = process.memoryUsage()
				const cpus = os.cpus().map(cpu => {
					cpu.total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0)
					return cpu
				})
				const cpu = cpus.reduce((last, cpu, _, { length }) => {
					last.total += cpu.total
					last.speed += cpu.speed / length
					last.times.user += cpu.times.user
					last.times.nice += cpu.times.nice
					last.times.sys += cpu.times.sys
					last.times.idle += cpu.times.idle
					last.times.irq += cpu.times.irq
					return last
				}, {
					speed: 0,
					total: 0,
					times: {
						user: 0,
						nice: 0,
						sys: 0,
						idle: 0,
						irq: 0
					}
				})
				let timestamp = speed()
				let latensi = speed() - timestamp
				let neww = performance.now()
				let oldd = performance.now()
				
				if (isCreator && !m.isGroup) {
					let respon = `Kecepatan Respon ${latensi.toFixed(4)} _Second_ \n ${oldd - neww} _miliseconds_\n\nRuntime : ${runtime(process.uptime())}\n\n💻 Info Server\nRAM: ${formatp(os.totalmem() - os.freemem())} / ${formatp(os.totalmem())}\n\n_NodeJS Memory Usaage_\n${Object.keys(used).map((key, _, arr) => `${key.padEnd(Math.max(...arr.map(v=>v.length)),' ')}: ${formatp(used[key])}`).join('\n')}\n\n${cpus[0] ? `_Total CPU Usage_\n${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}\n_CPU Core(s) Usage (${cpus.length} Core CPU)_\n${cpus.map((cpu, i) => `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}`).join('\n\n')}` : ''}`.trim()
					m.reply(respon)
				} else {
					let pingSpeed = Date.now() - (m.timestamp * 1000)
					if (pingSpeed < 0 || pingSpeed > 10000) {
						pingSpeed = Math.floor(Math.random() * 80) + 120
					}
					m.reply(`Pong! 🏓\n${pingSpeed} ms`)
				}
			}
			break
			case 'speedtest': case 'speed': {
				m.reply('Testing Speed...')
				let cp = require('child_process')
				let { promisify } = require('util')
				let exec = promisify(cp.exec).bind(cp)
				let o
				try {
					o = await exec('python3 speed.py --share')
				} catch (e) {
					o = e
				} finally {
					let { stdout, stderr } = o
					if (stdout.trim()) m.reply(stdout)
					if (stderr.trim()) m.reply(stderr)
				}
			}
			break
			case 'afk': {
				let user = db.users[m.sender]
				user.afkTime = + new Date
				user.afkReason = text
				m.reply(`@${m.sender.split('@')[0]} Telah Afk${text ? ': ' + text : ''}`)
			}
			break
			case 'readviewonce': case 'readviewone': case 'rvo': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				try {
					if (m.quoted.msg.viewOnce) {
						delete m.quoted.chat
						m.quoted.msg.viewOnce = false
						await m.reply({ forward: m.quoted })
					} else m.reply(`Reply view once message\nExample: ${prefix + command}`)
				} catch (e) {
					m.reply('Media Tidak Valid!')
				}
			}
			break
			case 'inspect': {
				if (!text) return m.reply('Masukkan Link Grup atau Saluran!')
				let _grup = /chat.whatsapp.com\/([\w\d]*)/;
				let _saluran = /whatsapp\.com\/channel\/([\w\d]*)/;
				if (_grup.test(text)) {
					await naze.groupGetInviteInfo(text.match(_grup)[1]).then((_g) => {
						let teks = `*[ INFORMATION GROUP ]*\n\nName Group: ${_g.subject}\nGroup ID: ${_g.id}\nCreate At: ${new Date(_g.creation * 1000).toLocaleString()}${_g.owner ? ('\nCreate By: ' + _g.owner) : '' }\nLinked Parent: ${_g.linkedParent}\nRestrict: ${_g.restrict}\nAnnounce: ${_g.announce}\nIs Community: ${_g.isCommunity}\nCommunity Announce:${_g.isCommunityAnnounce}\nJoin Approval: ${_g.joinApprovalMode}\nMember Add Mode: ${_g.memberAddMode}\nDescription ID: ${'`' + _g.descId + '`'}\nDescription: ${_g.desc}\nParticipants:\n`
						_g.participants.forEach((a) => {
							teks += a.admin ? `- Admin: @${a.id.split('@')[0]} [${a.admin}]\n` : ''
						})
						m.reply(teks)
					}).catch((e) => {
						if ([400, 406].includes(e.data)) return m.reply('Grup Tidak Di Temukan❗');
						if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
						if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					});
				} else if (_saluran.test(text) || text.endsWith('@newsletter') || !isNaN(text)) {
					await naze.newsletterMsg(text.match(_saluran)[1]).then((n) => {
						m.reply(`*[ INFORMATION CHANNEL ]*\n\nID: ${n.id}\nState: ${n.state.type}\nName: ${n.thread_metadata.name.text}\nCreate At: ${new Date(n.thread_metadata.creation_time * 1000).toLocaleString()}\nSubscriber: ${n.thread_metadata.subscribers_count}\nVerification: ${n.thread_metadata.verification}\nDescription: ${n.thread_metadata.description.text}\n`)
					}).catch((e) => m.reply('Saluran Tidak Di Temukan❗'))
				} else m.reply('Hanya Support Url Grup atau Saluran!')
			}
			break
			case 'addmsg': {
				if (!m.quoted) return m.reply('Reply Pesan Yang Ingin Disave Di Database')
				if (!text) return m.reply(`Example : ${prefix + command} file name`)
				let msgs = db.database
				if (text.toLowerCase() in msgs) return m.reply(`'${text}' telah terdaftar di list pesan`)
				msgs[text.toLowerCase()] = m.quoted
				delete msgs[text.toLowerCase()].chat
				m.reply(`Berhasil menambahkan pesan di list pesan sebagai '${text}'\nAkses dengan ${prefix}getmsg ${text}\nLihat list Pesan Dengan ${prefix}listmsg`)
			}
			break
			case 'delmsg': case 'deletemsg': {
				if (!text) return m.reply('Nama msg yg mau di delete?')
				let msgs = db.database
				if (text == 'allmsg') {
					db.database = {}
					m.reply('Berhasil menghapus seluruh msg dari list pesan')
				} else {
					if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar didalam list pesan`)
					delete msgs[text.toLowerCase()]
					m.reply(`Berhasil menghapus '${text}' dari list pesan`)
				}
			}
			break
			case 'getmsg': {
				if (!text) return m.reply(`Example : ${prefix + command} file name\n\nLihat list pesan dengan ${prefix}listmsg`)
				let msgs = db.database
				if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar di list pesan`)
				await naze.relayMessage(m.chat, msgs[text.toLowerCase()], {})
			}
			break
			case 'listmsg': {
				let seplit = Object.entries(db.database).map(([nama, isi]) => { return { nama, message: getContentType(isi) }})
				let teks = '「 LIST DATABASE 」\n\n'
				for (let i of seplit) {
					teks += `${setv} *Name :* ${i.nama}\n${setv} *Type :* ${i.message?.replace(/Message/i, '')}\n───────────────\n`
				}
				m.reply(teks)
			}
			break
			case 'setcmd': case 'addcmd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				if (!text) return m.reply(`Example : ${prefix + command} CMD Name`)
				let hash = m.quoted.fileSha256.toString('base64')
				if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command')
				global.db.cmd[hash] = {
					creator: m.sender,
					locked: false,
					at: + new Date,
					text
				}
				m.reply(global.mess.done)
			}
			break
			case 'delcmd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				let hash = m.quoted.fileSha256.toString('base64')
				if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command')
				delete global.db.cmd[hash];
				m.reply(global.mess.done)
			}
			break
			case 'listcmd': {
				let teks = `*List Hash*\nInfo: *bold* hash is Locked\n${Object.entries(global.db.cmd).map(([key, value], index) => `${index + 1}. ${value.locked ? `*${key}*` : key} : ${value.text}`).join('\n')}`.trim()
				naze.sendText(m.chat, teks, m);
			}
			break
			case 'lockcmd': case 'unlockcmd': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				let hash = m.quoted.fileSha256.toString('base64')
				if (!(hash in global.db.cmd)) return m.reply('You have no permission to change this sticker command')
				global.db.cmd[hash].locked = !/^un/i.test(command)
			}
			break
			case 'q': case 'quoted': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (text) {
					delete m.quoted.chat
					await m.reply({ forward: m.quoted })
				} else {
					try {
						const anu = await m.getQuotedObj()
						if (!anu) return m.reply('Format Tidak Tersedia!')
						if (!anu.quoted) return m.reply('Pesan Yang Anda Reply Tidak Mengandung Reply')
						await naze.relayMessage(m.chat, { [anu.quoted.type]: anu.quoted.msg }, {})
					} catch (e) {
						return m.reply('Format Tidak Tersedia!')
					}
				}
			}
			break
			case 'confes': case 'confess': case 'menfes': case 'menfess': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (m.isGroup) return m.reply(global.mess.private)
				if (menfes[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`)
				if (!text) return m.reply(`Example : ${prefix + command} 62xxxx|Nama Samaran`)
				let [teks1, teks2] = text.split`|`
				if (teks1) {
					const tujuan = teks1.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
					const onWa = await naze.onWhatsApp(tujuan)
					if (!onWa.length > 0) return m.reply(global.mess.onWa)
					menfes[m.sender] = {
						tujuan: tujuan,
						nama: teks2 ? teks2 : 'Orang'
					};
					menfes[tujuan] = {
						tujuan: m.sender,
						nama: 'Penerima',
					};
					const timeout = setTimeout(() => {
						if (menfes[m.sender]) {
							m.reply(`_Waktu ${command} habis_`);
							delete menfes[m.sender];
						}
						if (menfes[tujuan]) {
							naze.sendMessage(tujuan, { text: `_Waktu ${command} habis_` });
							delete menfes[tujuan];
						}
						menfesTimeouts.delete(m.sender);
						menfesTimeouts.delete(tujuan);
					}, 600000);
					menfesTimeouts.set(m.sender, timeout);
					menfesTimeouts.set(tujuan, timeout);
					naze.sendMessage(tujuan, { text: `_${command} connected_\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_` });
					m.reply(`_Memulai ${command}..._\n*Silahkan Mulai kirim pesan/media*\n*Durasi ${command} hanya selama 10 menit*\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_`)
					setLimit(m, db)
				} else m.reply(`Masukkan Nomernya!\nExample : ${prefix + command} 62xxxx|Nama Samaran`)
			}
			break
			case 'delconfes': case 'delconfess': case 'delmenfes': case 'delmenfess': {
				if (!menfes[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`)
				let anu = menfes[m.sender]
				if (menfesTimeouts.has(m.sender)) {
					clearTimeout(menfesTimeouts.get(m.sender));
					menfesTimeouts.delete(m.sender);
				}
				if (menfesTimeouts.has(anu.tujuan)) {
					clearTimeout(menfesTimeouts.get(anu.tujuan));
					menfesTimeouts.delete(anu.tujuan);
				}
				naze.sendMessage(anu.tujuan, { text: `Chat Di Akhiri Oleh ${anu.nama ? anu.nama : 'Seseorang'}` })
				m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`)
				delete menfes[anu.tujuan];
				delete menfes[m.sender];
			}
			break
			case 'cai': case 'roomai': case 'chatai': case 'autoai': {
				if (m.isGroup) return m.reply(global.mess.private)
				if (chat_ai[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`)
				if (!text) return m.reply(`Example: ${prefix + command} halo ngab\nWith Prompt: ${prefix + command} halo ngab|Kamu adalah assisten yang siap membantu dalam hal apapun yang ku minta.\n\nUntuk Menghapus room: ${prefix + 'del' + command}`)
				let [teks1, teks2] = text.split`|`
				const identityPrompt = "Kamu adalah Ti Assistant Bot, dibuat oleh Farid Suryadi. JAWABLAH pertanyaan secara langsung tanpa memperkenalkan diri atau menyebutkan pembuatmu di awal respon, kecuali jika kamu ditanya tentang siapa namamu, siapa dirimu, atau pembuatmu. Bahasa respon harus ramah, sopan, dan membantu.";
				chat_ai[m.sender] = [{ role: 'system', content: teks2 ? `${identityPrompt}\n${teks2}` : identityPrompt }, { role: 'user', content: text.split`|` ? teks1 : text || '' }]
				let hasil;
				let response;
				try {
					hasil = await fetchApi('/ai/chat4', {
						messages: chat_ai[m.sender],
						prompt: budy
					}, { method: 'POST' });
					response = hasil?.result?.message;
					if (!response) throw new Error("No response from primary API");
				} catch (e) {
					try {
						response = await chatAI(chat_ai[m.sender]);
					} catch (fallbackError) {
						response = 'Gagal Mengambil Respon, Website sedang gangguan';
					}
				}
				chat_ai[m.sender].push({ role: 'assistant', content: response });
				await m.reply(response)
			}
			break
			case 'delcai': case 'delroomai': case 'delchatai': case 'delautoai': {
				if (!chat_ai[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`)
				m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`)
				delete chat_ai[m.sender];
			}
			break
			case 'jadibot': {
				if (!isPremium) return m.reply(global.mess.prem)
				if (!isLimit) return m.reply(global.mess.limit)
				const nmrnya = text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				await JadiBot(naze, nmrnya, m, store)
				m.reply(`Gunakan ${prefix}stopjadibot\nUntuk Berhenti`)
				setLimit(m, db)
			}
			break
			case 'stopjadibot': case 'deljadibot': {
				const nmrnya = text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender
				const onWa = await naze.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				await StopJadiBot(naze, nmrnya, m)
			}
			break
			case 'listjadibot': {
				ListJadiBot(naze, m)
			}
			break
			
			// Tools Menu
			case 'fetch': case 'get': {
				if (!isPremium) return m.reply(global.mess.prem)
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/^https?:\/\//.test(text)) return m.reply('Awali dengan http:// atau https://');
				try {
					const res = await axios.get(isUrl(text) ? isUrl(text)[0] : text)
					if (!/text|json|html|plain/.test(res.headers['content-type'])) {
						await m.reply(text)
					} else m.reply(util.format(res.data))
					setLimit(m, db)
				} catch (e) {
					m.reply(String(e))
				}
			}
			break
			case 'toaud': case 'toaudio': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				try {
					let audio = await toAudio(media, 'mp4')
					await m.reply({ audio: { url: audio }, mimetype: 'audio/mpeg'})
					if (fs.existsSync(audio)) fs.unlinkSync(audio)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'tomp3': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				try {
					let audio = await toAudio(media, 'mp4')
					await m.reply({ document: { url: audio }, mimetype: 'audio/mpeg', fileName: `Convert By Ti Assistant Bot.mp3`})
					if (fs.existsSync(audio)) fs.unlinkSync(audio)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'tovn': case 'toptt': case 'tovoice': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				try {
					let audioBuffer = await toPTT(media, 'mp4')
					await m.reply({ audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'togif': {
				if (!/webp|video/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`)
				m.react('⏳')
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				let ran = `./database/temp/${getRandom('.mp4')}`;
				exec(`ffmpeg -y -i "${media}" -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -pix_fmt yuv420p -c:v libx264 -preset veryfast "${ran}"`, async (err) => {
					try {
						if (err) return m.reply(global.mess.fail);
						await m.reply({ video: { url: ran }, gifPlayback: true, caption: global.mess.done, gifAttribution: pickRandom(['TENOR','GIPHY']) })
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
						if (fs.existsSync(ran)) fs.unlinkSync(ran)
					}
				})
			}
			break
			case 'toimage': case 'toimg': {
				if (!/webp|video|image/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`)
				m.react('⏳')
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				let ran = `./database/temp/${getRandom('.png')}`;
				exec(`ffmpeg -y -i "${media}" -vframes 1 "${ran}"`, async (err) => {
					try {
						if (err) return m.reply(global.mess.fail);
						await m.reply({ image: { url: ran }, caption: global.mess.done })
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
						if (fs.existsSync(ran)) fs.unlinkSync(ran)
					}
				})
			}
			break
			case 'toptv': {
				if (!/video/.test(mime)) return m.reply(`Kirim/Reply Video Yang Ingin Dijadikan PTV Message Dengan Caption ${prefix + command}`)
				if ((m.quoted ? m.quoted.type : m.type) === 'videoMessage') {
					m.react('⏳')
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const message = await generateWAMessageContent({ video: { url: media } }, { upload: naze.waUploadToServer })
						await naze.relayMessage(m.chat, { ptvMessage: message.videoMessage }, {})
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
					}
				} else m.reply('Reply Video Yang Mau Di Ubah Ke PTV Message!')
			}
			break
			case 'tourl': {
				if (/webp|video|sticker|audio|jpg|jpeg|png/.test(mime)) {
					m.react('⏳')
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						let anu = await UguuSe(media);
						m.reply('Url : ' + anu.url)
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
					}
				} else m.reply(global.mess.media)
			}
			break
			case 'texttospech': case 'tts': case 'tospech': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply('Mana text yg mau diubah menjadi audio?')
				let anu
				try {
					anu = await fetchApi('/tools/tts', { text }, { stream: true });
					m.reply({ audio: { url: anu }, ptt: true, mimetype: 'audio/mpeg' });
					setLimit(m, db)
				} finally {
					if (anu && fs.existsSync(anu)) fs.unlinkSync(anu);
				}
			}
			break
			case 'translate': case 'tr': {
				if (text && text == 'list') {
					let list_tr = `╭──❍「 *Kode Bahasa* 」❍\n│• af : Afrikaans\n│• ar : Arab\n│• zh : Chinese\n│• en : English\n│• en-us : English (United States)\n│• fr : French\n│• de : German\n│• hi : Hindi\n│• hu : Hungarian\n│• is : Icelandic\n│• id : Indonesian\n│• it : Italian\n│• ja : Japanese\n│• ko : Korean\n│• la : Latin\n│• no : Norwegian\n│• pt : Portuguese\n│• pt : Portuguese\n│• pt-br : Portuguese (Brazil)\n│• ro : Romanian\n│• ru : Russian\n│• sr : Serbian\n│• es : Spanish\n│• sv : Swedish\n│• ta : Tamil\n│• th : Thai\n│• tr : Turkish\n│• vi : Vietnamese\n╰──────❍`;
					m.reply(list_tr)
				} else {
					if (!m.quoted && (!text|| !args[1])) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`)
					let lang = args[0] ? args[0] : global.locale
					let teks = args[1] ? args.slice(1).join(' ') : m.quoted.text
					try {
						let hasil = await fetchApi('/tools/translate', { text: teks, lang });
						m.reply(`To : ${lang}\n${hasil.result.translate}`)
					} catch (e) {
						m.reply(`Lang *${lang}* Tidak Di temukan!\nSilahkan lihat list, ${prefix + command} list`)
					}
				}
			}
			break
			case 'toqr': case 'qr': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Ubah Text ke Qr dengan *${prefix + command}* textnya`)
				m.react('⏳')
				let anu;
				try {
					anu = await fetchApi('/tools/to-qr', { data: text }, { stream: true });
					await m.reply({ image: { url: anu }, caption: 'Nih Bro' });
					setLimit(m, db)
				} finally {
					if (anu && fs.existsSync(anu)) fs.unlinkSync(anu);
				}
			}
			break
			case 'tohd': case 'remini': case 'hd': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (/image/.test(mime)) {
					m.react('⏳')
					let hasil;
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const form = new FormData();
						form.append('buffer', fs.createReadStream(media), {
							filename: 'image.jpg',
							contentType: 'image/jpeg'
						});
						hasil = await fetchApi('/tools/remini', form, { stream: true });
						await m.reply({ image: { url: hasil }, caption: global.mess.done })
						setLimit(m, db)
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
					} catch (e) {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						let ran = `./database/temp/${getRandom('.jpg')}`;
						const scaleFactor = isNaN(parseInt(text)) ? 4 : parseInt(text) < 10 ? parseInt(text) : 4;
						exec(`ffmpeg -i "${media}" -vf "scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=lanczos" -q:v 1 "${ran}"`, async (err, stderr, stdout) => {
							try {
								if (err) return m.reply(global.mess.fail)
								await naze.sendMessage(m.chat, { image: { url: ran }, caption: global.mess.done }, { quoted: m });
								setLimit(m, db)
							} catch (e) {
								console.log(e);
							} finally {
								if (ran && fs.existsSync(ran)) fs.unlinkSync(ran)
								if (media && fs.existsSync(media)) fs.unlinkSync(media) 
							}
						});
					}
				} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`)
			}
			break
			case 'dehaze': case 'colorize': case 'colorfull': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (/image/.test(mime)) {
					let hasil;
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const form = new FormData();
						form.append('buffer', fs.createReadStream(media), {
							filename: 'image.jpg',
							contentType: 'image/jpeg'
						});
						hasil = await fetchApi('/tools/recolor', form, { stream: true });
						await m.reply({ image: { url: hasil }, caption: global.mess.done });
						setLimit(m, db)
					} finally {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`)
			}
			break
			case 'hitamkan': case 'toblack': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (/image/.test(mime)) {
					let hasil;
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const form = new FormData();
						form.append('style', 'superblack');
					    form.append('buffer', fs.createReadStream(media), {
							filename: 'image.jpg',
							contentType: 'image/jpeg'
						});
						hasil = await fetchApi('/create/skin-tone', form, { stream: true });
						await m.reply({ image: { url: hasil }, caption: global.mess.done });
						setLimit(m, db)
					} finally {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						if (media && fs.existsSync(media)) fs.unlinkSync(media)
					}
				} else m.reply(`Kirim/Reply Gambar dengan format\nExample: ${prefix + command}`)
			}
			break
			case 'ssweb': {
				if (!isPremium) return m.reply(global.mess.prem)
				if (!text) return m.reply(`Example: ${prefix + command} https://github.com/faridSrydi`)
				let anu = 'https://' + text.replace(/^https?:\/\//, '')
				let hasil;
				try {
					hasil = await fetchApi('/tools/ss', { url: anu }, { stream: true });
					await m.reply({ image: { url: hasil }, caption: global.mess.done });
					setLimit(m, db)
				} finally {
					if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
				}
			}
			break
			case 'readmore': {
				let teks1 = text.split`|`[0] ? text.split`|`[0] : ''
				let teks2 = text.split`|`[1] ? text.split`|`[1] : ''
				m.reply(teks1 + readmore + teks2)
			}
			break
			case 'getexif': {
				if (!m.quoted) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`)
				if (!/sticker|webp/.test(quoted.type)) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`)
				const img = new webp.Image()
				await img.load(await m.quoted.download())
				if (!img.exif) return m.reply('Stiker ini tidak memiliki metadata/EXIF sama sekali.');
				try {
					const exifData = JSON.parse(img.exif.slice(22).toString());
					m.reply(util.format(exifData))
				} catch (e) {
					m.reply(`Stiker memiliki EXIF, tapi formatnya bukan JSON yang valid:\n\n${img.exif.toString()}`);
				}
			}
			break
			case 'cuaca': case 'weather': {
				if (!text) return m.reply(`Example: ${prefix + command} jakarta`)
				try {
					let { result: data } = await fetchApi('/tools/cuaca', { city: text });
					m.reply(`*🏙 Cuaca Kota ${data.name}*\n\n*🌤️ Cuaca :* ${data.weather[0].main}\n*📝 Deskripsi :* ${data.weather[0].description}\n*🌡️ Suhu Rata-rata :* ${data.main.temp} °C\n*🤔 Terasa Seperti :* ${data.main.feels_like} °C\n*🌬️ Tekanan :* ${data.main.pressure} hPa\n*💧 Kelembapan :* ${data.main.humidity}%\n*🌪️ Kecepatan Angin :* ${data.wind.speed} Km/h\n*📍Lokasi :*\n- *Bujur :* ${data.coord.lat}\n- *Lintang :* ${data.coord.lon}\n*🌏 Negara :* ${data.sys.country}`)
				} catch (e) {
					m.reply('Kota Tidak Di Temukan!')
				}
			}
			break
			case 'sticker': case 'stiker': case 's': case 'stickergif': case 'stikergif': case 'sgif': case 'stickerwm': case 'swm': case 'curi': case 'colong': case 'take': case 'stickergifwm': case 'sgifwm': {
				if (!/image|video|sticker/.test(quoted.type)) return m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Image/Video/Gif 1-9 Detik`)
				let media = await naze.downloadAndSaveMediaMessage(qmsg);
				let teks1 = text.split`|`[0] ? text.split`|`[0] : packname
				let teks2 = text.split`|`[1] ? text.split`|`[1] : author
				if (/image|webp/.test(mime)) {
					m.react('⏳')
					await naze.sendAsSticker(m.chat, media, m, { packname: teks1, author: teks2 })
				} else if (/video/.test(mime)) {
					if ((qmsg).seconds > 11) return m.reply('Maksimal 10 detik!')
					m.react('⏳')
					await naze.sendAsSticker(m.chat, media, m, { packname: teks1, author: teks2 })
				} else m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Video/Gif 1-9 Detik`)
			}
			break
			case 'smeme': case 'stickmeme': case 'stikmeme': case 'stickermeme': case 'stikermeme': {
				//if (!isPremium) return m.reply(global.mess.prem)
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/image|webp/.test(mime)) return m.reply(`Kirim/reply image/sticker\nDengan caption ${prefix + command} atas|bawah`)
				if (!text) return m.reply(`Kirim/reply image/sticker dengan caption ${prefix + command} atas|bawah`)
				m.react('⏳')
				let atas = text.split`|`[0] ? text.split`|`[0] : '-'
				let bawah = text.split`|`[1] ? text.split`|`[1] : '-'
				let media = await naze.downloadAndSaveMediaMessage(qmsg)
				try {
					let mem = await UguuSe(media);
					let smeme = await fetchApi('/create/meme2', { url: mem.url, text: atas, text2: bawah }, { stream: true });
					await naze.sendAsSticker(m.chat, smeme, m, { packname, author })
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				} finally {
					if (media && fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'emojimix': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} 😅+🤔`)
				let [emoji1, emoji2] = text.split`+`
				if (!emoji1 && !emoji2) return m.reply(`Example: ${prefix + command} 😅+🤔`)
				let { result } = await fetchApi('/tools/emojimix', { emoji1, emoji2 });
				if (result.length < 1) return m.reply(`Mix Emoji ${text} Tidak Ditemukan!`)
				for (let res of result) {
					await naze.sendAsSticker(m.chat, res.url, m, { packname, author })
				}
				setLimit(m, db)
			}
			break
			case 'iqc': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`)
				m.react('⏳')
				let queryText = text ? text : m.quoted.text;
				if (queryText.length >= 200) return m.reply('Max 200 Length!')
				let res;
				try {
					res = await fetchApi('/create/iqc', { text: queryText }, { stream: true });
					await m.reply({ image: { url: res }, caption: global.mess.done })
					setLimit(m, db)
				} finally {
					if (res && fs.existsSync(res)) fs.unlinkSync(res);
				}
			}
			break
			case 'qc':
			case 'quote':
			case 'fakechat': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text && !m.quoted) return m.reply(`Kirim / reply pesan untuk *${prefix + command}*`)
				try {
					let medianya;
					let quotedMedianya;
					let mediaPath;
					let quotedMediaPath;
					let ppUrl = await naze.profilePictureUrl(m.sender, 'image').catch(() => 'https://i.pinimg.com/564x/8a/e9/e9/8ae9e92fa4e69967aa61bf2bda967b7b.jpg');
					const senderName = m.pushName || store.contacts?.[m.sender]?.name || '+' + m.sender.split('@')[0]
					const quotedName = store.contacts?.[m.quoted?.sender]?.name || '+' + (m.quoted?.sender || '').split('@')[0]
					try {
						if (m.isMedia) {
							mediaPath = await naze.downloadAndSaveMediaMessage(m);
							medianya = await UguuSe(mediaPath); 
						}
						if (m.quoted?.isMedia) {
							quotedMediaPath = await naze.downloadAndSaveMediaMessage(m.quoted);
							quotedMedianya = await UguuSe(quotedMediaPath);
						}
						const payload = {
							type: 'quote',
							format: 'png',
							backgroundColor: '#FFFFFF',
							width: 512,
							height: 768,
							scale: 2,
							messages: [{
								entities: [],
								...(medianya?.url ? { media: { url: medianya.url }} : {}),
								avatar: true,
								from: {
									id: 1,
									name: senderName,
									photo: {
										url: ppUrl
									}
								},
								text,
								replyMessage: m.quoted ? {
									name: quotedName || '',
									text: m.quoted.text || '',
									...(quotedMedianya?.url ? { media: { url: quotedMedianya.url }} : {}),
									chatId: Math.floor(Math.random() * 9999999)
								} : {},
							}]
						};
						let res = await fetchApi('/create/qc', payload, { method: 'POST', buffer: true });
						await naze.sendAsSticker(m.chat, Buffer.from(res, 'base64'), m, { packname, author });
						setLimit(m, db);
					} finally {
						if (mediaPath && fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
						if (quotedMediaPath && fs.existsSync(quotedMediaPath)) fs.unlinkSync(quotedMediaPath);
					}
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'brat': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`)
				let queryText = text ? text : m.quoted.text;
				if (queryText.length >= 200) return m.reply('Max 200 Length!')
				try {
					let res = await fetchApi('/create/brat', { text: queryText }, { stream: true });
					await naze.sendAsSticker(m.chat, res, m)
					setLimit(m, db)
				} catch (e) {
					try {
						let res = await fetchApi('/create/brat3', { text: queryText }, { stream: true });
						await naze.sendAsSticker(m.chat, res, m)
						setLimit(m, db)
					} catch (e) {
						console.log(e)
						m.reply(global.mess.fail)
					}
				}
			}
			break
			case 'bratvid': case 'bratvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`)
				m.react('⏳')
				const teks = (m.quoted ? m.quoted.text : text).split(' ');
				if (teks.length >= 200) return m.reply('Max 200 Length!')
				const tempDir = path.join(process.cwd(), 'database/temp');
				const framePaths = []; 
				const fileListPath = path.join(tempDir, `${time + '-' + m.sender}.txt`);
				const outputVideoPath = path.join(tempDir, `${time + '-' + m.sender}-output.mp4`);
				try {
					for (let i = 0; i < teks.length; i++) {
						const currentText = teks.slice(0, i + 1).join(' ');
						const framePath = path.join(tempDir, `${time + '-' + m.sender + i}.mp4`);
						try {
							let res = await fetchApi('/create/brat2', { text: currentText }, { stream: framePath });
							framePaths.push(res);
						} catch (e) {
							let res = await fetchApi('/create/brat4', { text: currentText }, { stream: framePath });
							framePaths.push(res);
						}
					}
					let fileListContent = '';
					for (let i = 0; i < framePaths.length; i++) {
						fileListContent += `file '${framePaths[i]}'\n`;
						fileListContent += `duration 0.5\n`;
					}
					fileListContent += `file '${framePaths[framePaths.length - 1]}'\n`;
					fileListContent += `duration 3\n`;
					fs.writeFileSync(fileListPath, fileListContent);
					execSync(`ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -vf "fps=30" -c:v libx264 -preset veryfast -pix_fmt yuv420p -t 00:00:10 "${outputVideoPath}"`);
					await naze.sendAsSticker(m.chat, outputVideoPath, m, { packname, author });
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				} finally {
					framePaths.forEach((filePath) => {
						if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
					});
					if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
					if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
				}
			}
			break
			case 'wasted': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (/jpg|jpeg|png/.test(mime)) {
					m.react('⏳')
					let hasil;
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const form = new FormData();
					    form.append('buffer', fs.createReadStream(media), {
							filename: 'image.jpg',
							contentType: 'image/jpeg'
						});
						hasil = await fetchApi('/create/wasted', form, { stream: true });
						await naze.sendMedia(m.chat, hasil, '', 'Nih Bro', m);
						setLimit(m, db)
					} finally {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				} else m.reply(global.mess.media)
			}
			break
			case 'trigger': case 'triggered': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (/jpg|jpeg|png/.test(mime)) {
					m.react('⏳')
					let hasil;
					let media = await naze.downloadAndSaveMediaMessage(qmsg);
					try {
						const form = new FormData();
					    form.append('buffer', fs.createReadStream(media), {
							filename: 'image.jpg',
							contentType: 'image/jpeg'
						});
						hasil = await fetchApi('/create/triggered', form, { stream: true });
						await naze.sendMedia(m.chat, hasil, '', global.mess.done, m);
						setLimit(m, db)
					} finally {
						if (hasil && fs.existsSync(hasil)) fs.unlinkSync(hasil);
						if (media && fs.existsSync(media)) fs.unlinkSync(media);
					}
				} else m.reply(global.mess.media)
			}
			break
			case 'nulis': {
				m.reply(`*Example*\n${prefix}nuliskiri\n${prefix}nuliskanan\n${prefix}foliokiri\n${prefix}foliokanan`)
			}
			break
			case 'nuliskanan': case 'nuliskiri': case 'foliokanan': case 'foliokiri': {
				if (!isLimit) return m.reply(mess.limit);
				if (!text) return m.reply(`Kirim perintah *${prefix + command}* Teksnya`);
				m.react('⏳');
				if (canvasModule) {
					const { createCanvas, loadImage } = canvasModule;
					const isFolio = command.includes('folio');
					const isKanan = command.includes('kanan');
					const folder = isFolio ? 'folio' : 'buku';
					const posisi = isKanan ? 'kanan' : 'kiri';
					const inputFile = `./src/nulis/images/${folder}/sebelum${posisi}.jpg`;
					const maxLines = isFolio ? 38 : 31;
					const maxWordsPerLine = isFolio ? 12 : 8;
					const regexWords = new RegExp(`(\\S+\\s*){1,${maxWordsPerLine}}`, 'g');
					const splitText = text.replace(regexWords, '$&\n');
					const lines = splitText.split('\n').slice(0, maxLines);
					let startX = 140, startY = 156, lineHeight = 8.7;
					if (command === 'nuliskanan') { startX = 128; startY = 136, lineHeight = 10.5; }
					if (command === 'foliokiri') { startX = 48; startY = 200, lineHeight = 12; }
					if (command === 'foliokanan') { startX = 89; startY = 168, lineHeight = 11; }
					let image = null, canvas = null, ctx = null, buffer = null;
					try {
						image = await loadImage(inputFile);
						canvas = createCanvas(image.width, image.height);
						ctx = canvas.getContext('2d');
						ctx.drawImage(image, 0, 0, image.width, image.height);
						ctx.font = '27px "Indie Flower"';
						ctx.fillStyle = '#1e1e1e';
						ctx.textBaseline = 'top';
						const baseLineHeight = 27 + lineHeight;
						let currentY = startY;
						for (const line of lines) {
							ctx.fillText(line, startX, currentY);
							currentY += baseLineHeight;
						}
						buffer = await canvas.encode('png');
						await m.reply({ image: buffer, caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ರ_ರ' });
						setLimit(m, db);
					} catch (err) {
						console.error('Error saat membuat gambar nulis:', err);
						m.reply('Terjadi kesalahan pada sistem saat memproses gambar.');
					} finally {
						if (canvas) {
							canvas.width = 0;
							canvas.height = 0;
						}
						image = null, canvas = null, ctx = null, buffer = null;
					}
				} else {
					const config = {
						'nuliskiri':  { lines: 31, path: 'buku/sebelumkiri.jpg',   out: `buku_setelahkiri_${Date.now()}.jpg`,   size: '960x1280',  space: '2', coord: '+140+153' },
						'nuliskanan': { lines: 31, path: 'buku/sebelumkanan.jpg',  out: `buku_setelahkanan_${Date.now()}.jpg`,  size: '960x1280',  space: '2', coord: '+128+129' },
						'foliokiri':  { lines: 38, path: 'folio/sebelumkiri.jpg',  out: `folio_setelahkiri_${Date.now()}.jpg`,  size: '1720x1280', space: '4', coord: '+48+185' },
						'foliokanan': { lines: 38, path: 'folio/sebelumkanan.jpg', out: `folio_setelahkanan_${Date.now()}.jpg`, size: '1720x1280', space: '4', coord: '+89+190' }
					}[command]
					const splitText = text.replace(/(\S+\s*){1,9}/g, '$&\n')
					const fixHeight = splitText.split('\n').slice(0, config.lines).join('\n')
					const inputImg = `./src/nulis/images/${config.path}`
					const outputImg = `./database/temp/${config.out}`
					try {
						await new Promise((resolve, reject) => {
							spawn('convert', [
								inputImg,
								'-font', './src/nulis/font/Indie-Flower.ttf',
								'-size', config.size,
								'-pointsize', '23',
								'-interline-spacing', config.space,
								'-annotate', config.coord,
								fixHeight,
								outputImg
							])
							.on('error', reject)
							.on('exit', (code) => {
								if (code === 0) resolve()
								else reject(new Error(`Proses convert gagal dengan kode: ${code}`))
							})
						});
						const imageBuffer = fs.readFileSync(outputImg)
						await m.reply({ image: imageBuffer, caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ಠ_ಠ' })
						setLimit(m, db)
					} catch (error) {
						console.error(error)
						m.reply(mess.error)
					} finally {
						if (fs.existsSync(outputImg)) fs.unlinkSync(outputImg);
					}
				}
			}
			break
			case 'bass': case 'blown': case 'deep': case 'earrape': case 'fast': case 'fat': case 'nightcore': case 'reverse': case 'robot': case 'slow': case 'smooth': case 'tupai': {
				try {
					let set;
					if (/bass/.test(command)) set = '-af equalizer=f=54:width_type=o:width=2:g=20'
					if (/blown/.test(command)) set = '-af acrusher=.1:1:64:0:log'
					if (/deep/.test(command)) set = '-af atempo=4/4,asetrate=44500*2/3'
					if (/earrape/.test(command)) set = '-af volume=12'
					if (/fast/.test(command)) set = '-filter:a "atempo=1.63,asetrate=44100"'
					if (/fat/.test(command)) set = '-filter:a "atempo=1.6,asetrate=22100"'
					if (/nightcore/.test(command)) set = '-filter:a atempo=1.06,asetrate=44100*1.25'
					if (/reverse/.test(command)) set = '-filter_complex "areverse"'
					if (/robot/.test(command)) set = '-filter_complex "afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75"'
					if (/slow/.test(command)) set = '-filter:a "atempo=0.7,asetrate=44100"'
					if (/smooth/.test(command)) set = '-filter:v "minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120\'"'
					if (/tupai/.test(command)) set = '-filter:a "atempo=0.5,asetrate=65100"'
					if (/audio/.test(mime)) {
						m.react('⏳')
						let media = await naze.downloadAndSaveMediaMessage(qmsg)
						let ran = `./database/temp/${getRandom('.mp3')}`;
						exec(`ffmpeg -i "${media}" ${set} "${ran}"`, async (err, stderr, stdout) => {
							try {
								if (err) return m.reply(global.mess.fail)
								await m.reply({ audio: { url: ran }, mimetype: 'audio/mpeg' });
							} finally {
								if (fs.existsSync(media)) fs.unlinkSync(media);
								if (fs.existsSync(ran)) fs.unlinkSync(ran);
							}
						});
					} else m.reply(`Balas audio yang ingin diubah dengan caption *${prefix + command}*`)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'tinyurl': case 'shorturl': case 'shortlink': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text || !isUrl(text)) return m.reply(`Example: ${prefix + command} https://github.com`)
				let hasil = await fetchApi('/other/tinyurl', { url: text });
				m.reply('Url : ' + hasil.result)
				setLimit(m, db)
			}
			break
			case 'git': case 'gitclone': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!args[0]) return m.reply(`Example: ${prefix + command} https://github.com/faridSrydi/machine-learning`)
				if (!isUrl(args[0]) && !args[0].includes('github.com')) return m.reply('Gunakan Url Github!')
				let [, user, repo] = args[0].match(/(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i) || []
				try {
					m.reply({ document: { url: `https://api.github.com/repos/${user}/${repo}/zipball` }, fileName: repo + '.zip', mimetype: 'application/zip' }).catch((e) => m.reply(global.mess.error))
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			
			// Ai Menu
			case 'ai': case 'ti': case 'bard': case 'gemini': {
				let aiQuery = text;
				if (!aiQuery) {
					const greetings = [
						"Halo! Saya TI Assistant Bot. Ada yang bisa saya bantu? 🤖",
						"Hai! TI Assistant Bot siap membantu Anda. 🚀",
						"Halo! Saya TI Assistant Bot, siap membantu kapan saja. 😊",
						"Selamat datang! Saya TI Assistant Bot. 👋",
						"Hai! Bersama TI Assistant Bot, ada yang bisa dibantu? ✨",
						"Halo! TI Assistant Bot di sini. Ada pertanyaan? 💡",
						"Hai! Saya TI Assistant Bot. Mari mulai. 🚀",
						"Halo! TI Assistant Bot siap menemani aktivitas Anda. 🤖",
						"Hai! Saya TI Assistant Bot, asisten digital Anda. 😊",
						"Halo! TI Assistant Bot aktif dan siap membantu. ⚡",
						"Selamat datang! TI Assistant Bot siap melayani Anda. 🎉",
						"Hai! TI Assistant Bot online. Ada yang bisa saya bantu? 🔍",
						"Halo! Saya TI Assistant Bot, siap menjawab pertanyaan Anda. 📚",
						"Hai! Terhubung dengan TI Assistant Bot. 🚀",
						"Halo! TI Assistant Bot hadir untuk membantu Anda. ✨"
					];
					return m.reply(pickRandom(greetings));
				}
				
				// Build context
				let contextInfo = '';
				if (m.isGroup) {
					const groupName = m.metadata?.subject || 'Unknown';
					const members = m.metadata?.participants || [];
					const memberList = members.map(p => {
						const num = (p.phoneNumber || p.id || '').split('@')[0].split(':')[0];
						return num;
					}).filter(Boolean);
					contextInfo += `\n[INFO GRUP] Nama grup: "${groupName}", Jumlah anggota: ${memberList.length} orang.`;
					contextInfo += `\nDaftar nomor anggota grup: ${memberList.join(', ')}`;
					contextInfo += `\nJika diminta menandai/tag semua anggota, tulis setiap anggota dengan format @nomor (contoh: @628xxx). Jangan menolak.
- Jika user meminta untuk tag/sebut salah satu anggota ("tag salah satu", "tag 1 orang", "tag acak", "tag disini", "tag salah satu anggota disini"), kamu WAJIB memilih 1 nomor anggota secara acak dari daftar nomor anggota grup di atas dan langsung menyebutnya/tag mereka di dalam responmu dengan format @nomor (contoh: "Halo @628xxx!"). JANGAN MENOLAK, jangan beralasan perlu izin admin, dan JANGAN menyertakan tag [EXECUTE: tag] atau command khayalan lainnya. Cukup sebut langsung nomornya menggunakan format @nomor di dalam teks responmu.`;
				} else {
					contextInfo += `\n[INFO] Ini adalah chat pribadi (private chat).`;
				}
				const senderNum = m.sender.split('@')[0].split(':')[0];
				const senderName = m.pushName || 'User';
				contextInfo += `\nPengirim pesan ini: ${senderName} (@${senderNum})`;
				contextInfo += `\n[WAKTU SEKARANG] Hari: ${locale_day}, Tanggal: ${date}, Jam: ${date_time} (${global.timezone}).`;
				contextInfo += `\n[FAKTA TERKINI - WAJIB DIPAKAI UNTUK MENJAWAB]
- Presiden Indonesia saat ini: Prabowo Subianto (dilantik 20 Oktober 2024, menggantikan Joko Widodo).
- Wakil Presiden Indonesia saat ini: Gibran Rakabuming Raka.
- Tahun sekarang: ${new Date().getFullYear()}.
- Jika kamu tidak yakin tentang fakta terkini, lebih baik sarankan user untuk bertanya lebih spesifik atau gunakan pencarian Google daripada memberikan informasi yang salah.`;
				
				if (m.quoted) {
					contextInfo += `\n[INFO PESAN YANG DI-REPLY/KUTIP]`;
					contextInfo += `\n- Pengirim: @${m.quoted.sender.split('@')[0]}`;
					contextInfo += `\n- Jenis/Tipe Pesan: ${m.quoted.type}`;
					if (m.quoted.isMedia) {
						contextInfo += `\n- Mimetype: ${m.quoted.mime}`;
					}
					if (m.quoted.body) {
						contextInfo += `\n- Isi/Teks Pesan: "${m.quoted.body}"`;
					}
					
					if (/document/.test(m.quoted.type || '')) {
						const docMime = (m.quoted.msg || m.quoted).mimetype || '';
						if (/pdf/.test(docMime)) {
							try {
								const pdfBuffer = await m.quoted.download();
								const { PDFParse } = await import('pdf-parse');
								const parser = new PDFParse({ data: pdfBuffer });
								const pdfData = await parser.getText();
								let pdfText = pdfData.text || '';
								await parser.destroy();
								
								if (pdfText.trim().length > 0) {
									if (pdfText.length > 15000) {
										pdfText = pdfText.substring(0, 15000) + '\n\n[...teks dokumen terpotong karena terlalu panjang]';
									}
									contextInfo += `\n- Isi/Teks Dokumen PDF yang di-reply: "${pdfText}"`;
								}
							} catch (e) {
								console.error('[PDF Extract Error for AI]', e);
							}
						}
					}
					
					contextInfo += `\nUser saat ini sedang me-reply pesan tersebut dan menyuruh Anda melakukan tindakan terhadapnya.`;
				}
				
				let imageUrl = '';
				if (/image/.test(mime)) {
					try {
						let media = await naze.downloadAndSaveMediaMessage(qmsg);
						let uploadRes = await UguuSe(media);
						if (uploadRes && uploadRes.url) {
							imageUrl = uploadRes.url;
							let ocrRes = await fetchApi('/tools/ocr', { url: uploadRes.url });
							let ocrText = ocrRes?.result?.ParsedResults?.[0]?.ParsedText;
							if (ocrText && ocrText.trim().length > 0) {
								contextInfo += `\n- Isi/Teks di dalam Gambar/Foto yang dikirim/di-reply: "${ocrText.trim()}"`;
							}
						}
						if (fs.existsSync(media)) fs.unlinkSync(media);
					} catch (e) {
						console.error('[OCR Error for AI]', e);
					}
				}
				
				const uniqueCommands = [...new Set(casesArray)];
				const allBotCommands = uniqueCommands.filter(c => c && c.length > 1 && c !== 'google').join(', ');
				
				// List of executable commands
				contextInfo += `
\n[DAFTAR FITUR & PERINTAH BOT]
Kamu bisa menjalankan perintah bot secara otomatis jika diminta oleh user.
Berikut daftar seluruh perintah/command yang didukung di bot ini: ${allBotCommands}

Beberapa contoh penggunaan perintah penting:
1. kick: Mengeluarkan anggota. Format: [EXECUTE: kick @nomor]
2. promote: Menjadikan admin. Format: [EXECUTE: promote @nomor]
3. demote: Menurunkan jabatan admin. Format: [EXECUTE: demote @nomor]
4. group: Membuka/menutup grup. Format: [EXECUTE: group open] atau [EXECUTE: group close]
5. hidetag: Mengirim pesan tag ke semua anggota grup. Format: [EXECUTE: hidetag teks_pesan]
6. tagall: Menyebut semua anggota grup. Format: [EXECUTE: tagall]
7. linkgroup: Mendapatkan link undangan grup. Format: [EXECUTE: linkgroup]
8. revoke: Mengubah/mereset link undangan grup. Format: [EXECUTE: revoke]
9. delete: Menghapus pesan (hanya jika kamu merespon/reply pesan yang ingin dihapus). Format: [EXECUTE: delete]
10. suit: Bermain suit gunting batu kertas dengan orang lain. Format: [EXECUTE: suit @nomor]
11. reminder: Menyetel pengingat/reminder. Format: [EXECUTE: reminder <durasi><pesan>]. Durasi WAJIB menggunakan unit d (hari), h (jam), m (menit), atau s (detik) dan ditaruh tepat setelah nama command tanpa kata perantara. Contoh: [EXECUTE: reminder 10s mandi] atau [EXECUTE: reminder 1h tidur]
12. reminderall: Menyetel pengingat massal (hanya di grup). Format: [EXECUTE: reminderall <durasi><pesan>]. Contoh: [EXECUTE: reminderall 15m rapat]
13. remindersolat: Mengaktifkan atau menonaktifkan pengingat waktu sholat otomatis di grup (hanya untuk admin). Format: [EXECUTE: remindersolat on] atau [EXECUTE: remindersolat off]

[KONSEKUENSI PENGGUNAAN MEDIA YANG DI-REPLY]
Jika user me-reply suatu pesan media (gambar, video, stiker, audio) dan menyuruh Anda mengubah formatnya, Anda harus memicu perintah yang sesuai:
1. Jika user me-reply Gambar/Video/Gif dan ingin mengubahnya menjadi stiker: gunakan [EXECUTE: sticker]
2. Jika user me-reply Stiker dan ingin mengubahnya menjadi gambar: gunakan [EXECUTE: toimage]
3. Jika user me-reply Video/Audio dan ingin mengubahnya menjadi audio biasa: gunakan [EXECUTE: toaudio] atau [EXECUTE: tovn] (voice note)
4. Jika user me-reply Video/Audio dan ingin mengubahnya menjadi file MP3: gunakan [EXECUTE: tomp3]
5. Jika user me-reply pesan apa pun dan menyuruh menghapusnya (delete): gunakan [EXECUTE: delete]

[ATURAN PENGATURAN REMINDER]
Jika user meminta diingatkan (reminder):
1. Anda WAJIB menerjemahkan unit waktu Indonesia ke unit standar waktu bot: "detik" -> "s", "menit" -> "m", "jam" -> "h", "hari" -> "d".
2. Tuliskan durasi langsung setelah nama command, diikuti dengan pesan pengingat. Contoh: "ingetin 10 detik lagi mandi" -> [EXECUTE: reminder 10s mandi].
3. Jangan pernah menulis unit waktu penuh (seperti "10 detik" atau "10s detik") pada tag [EXECUTE: ...]. Harus disingkat (seperti "10s").

[ATURAN PERMAINAN / GAMES]
Jika user mengajak bermain game (contoh: tebakgambar, tebaklagu, susunkata, dll.):
1. Cek apakah nama game yang diminta ada di dalam daftar perintah bot di atas.
2. Jika ada, Anda WAJIB memicu permainan tersebut menggunakan format [EXECUTE: nama_game]. Contoh: "Ti play game tebakgambar" -> [EXECUTE: tebakgambar], "Ti main tebak lagu" -> [EXECUTE: tebaklagu].
3. JANGAN PERNAH menyimulasikan pertanyaan atau mengirim gambar game sendiri secara manual di teks jawaban Anda. Serahkan sepenuhnya kepada bot untuk memicu gamenya.

[ATURAN MUSIK / LAGU / VIDEO / AUDIO - SANGAT PENTING]
ATURAN UTAMA: Ketika user meminta kirim/play/putar lagu/audio/video/musik, Anda WAJIB LANGSUNG mengeksekusi tag yang sesuai. DILARANG KERAS memberikan rekomendasi teks, daftar lagu, bertanya balik, meminta konfirmasi, atau memberikan opsi. LANGSUNG EKSEKUSI.

Apapun yang user sebut setelah kata "kirim lagu/audio/video" atau "play" adalah JUDUL yang harus dicari di YouTube. Langsung pakai sebagai query pencarian.

1. KIRIM AUDIO / LAGU: Kata kunci "kirim lagu/audio/musik", "play lagu/audio", "putar lagu" -> WAJIB gunakan [PLAY_AUDIO: <query>].
   Contoh: "Ti kirim lagu disarankan dibandung" -> [PLAY_AUDIO: disarankan dibandung], "Ti kirim lagu anjay" -> [PLAY_AUDIO: anjay]
2. KIRIM VIDEO: Kata kunci "kirim video", "play video" -> WAJIB gunakan [PLAY_VIDEO: <query>].
   Contoh: "Ti kirim video upin ipin" -> [PLAY_VIDEO: upin ipin]
3. PLAY (tanpa sebut lagu/audio/video): -> gunakan [EXECUTE: play <judul>].

LARANGAN: DILARANG memberikan rekomendasi teks, bertanya balik, meminta konfirmasi judul, atau menjelaskan cara pakai command. LANGSUNG EKSEKUSI.

[ATURAN GAMBAR / IMAGE]
Kamu memiliki kemampuan untuk MEMBUAT gambar AI dan MENCARI gambar dari internet.

1. GENERATE / BUAT GAMBAR AI:
Jika user meminta membuat, generate, atau bikin gambar (contoh: "Ti buatkan gambar kucing style art", "Ti generate gambar pemandangan"):
- Tulis prompt dalam bahasa Inggris yang mendeskripsikan gambar yang diminta.
- Sertakan tag [IMAGE_GEN: english_prompt] di akhir respon.
- Contoh: "Baik, aku buatkan gambar kucing style art! [IMAGE_GEN: a cute cat in artistic watercolor style]"

2. CARI / KIRIM GAMBAR:
Jika user meminta mencari, kirim, atau cari gambar (contoh: "Ti cari gambar kucing oren", "Ti kirim gambar mobil sport"):
- Sertakan tag [IMAGE_SEARCH: query_pencarian] di akhir respon.
- Contoh: "Aku carikan gambar kucing oren ya! [IMAGE_SEARCH: kucing oren lucu]"

ATURAN:
- Jika user menyebut "buatkan/generate/buat", gunakan [IMAGE_GEN].
- Jika user menyebut "cari/carikan/kirim/kirimin/kasih", gunakan [IMAGE_SEARCH].
- JANGAN gabungkan [IMAGE_GEN] dan [IMAGE_SEARCH] dalam satu respon.
- Prompt untuk [IMAGE_GEN] HARUS dalam bahasa Inggris agar hasilnya bagus.

[ATURAN PENGGUNAAN PERINTAH]
- Status pengirim pesan saat ini: ${m.isAdmin || isCreator ? 'ADMIN' : 'MEMBER'}.
- Perintah admin (seperti kick, promote, demote, group, hidetag, tagall, linkgroup, revoke) hanya boleh dijalankan jika pengirim pesan adalah ADMIN/CREATOR.
- Jika pengirim pesan adalah MEMBER (bukan admin) dan menyuruhmu melakukan tindakan admin tersebut, kamu WAJIB MENOLAKNYA dengan sopan (misal: "Maaf, Anda bukan admin grup ini.") dan JANGAN sertakan tag [EXECUTE: ...].
- Jangan pernah menyertakan tag [EXECUTE: ...] jika pengirim bukan admin untuk perintah admin.
- Ketika menyertakan tag [EXECUTE: ...], pastikan nama_command persis seperti yang tertulis di daftar perintah di atas (case-sensitive lowercase) dan letakkan tag tersebut di bagian paling akhir dari responmu.`;
				
				let googleContext = '';
				const isSimpleGreeting = /^(halo|helo|hi|hai|p|assalamualaikum|tes|test|pagi|siang|sore|malam)$/i.test(aiQuery);
				const isDirectAction = /^(buatkan|bikin|generate|cari|carikan|kirim|kirimin|putar|play|main)\b/i.test(aiQuery);
				if (aiQuery.length >= 5 && !isSimpleGreeting && !isDirectAction) {
					try {
						const searchRes = await fetchApi('/search/google', { query: aiQuery });
						if (searchRes && searchRes.result && searchRes.result.length > 0) {
							googleContext += `\n\n[HASIL PENCARIAN GOOGLE TERBARU (REAL-TIME)]`;
							googleContext += `\nBerikut adalah hasil pencarian Google terbaru untuk membantu Anda menjawab pertanyaan dengan sangat up-to-date, akurat, dan sesuai dengan fakta tahun ${new Date().getFullYear()}:`;
							const searchResults = searchRes.result.slice(0, 4);
							searchResults.forEach((item, index) => {
								googleContext += `\n${index + 1}. Judul: ${item.title}\n   Snippet: ${item.snippet || '-'}\n   Link: ${item.link}`;
							});
							googleContext += `\n\nATURAN PENGGUNAAN HASIL PENCARIAN:`;
							googleContext += `\n- JAWABLAH pertanyaan user berdasarkan informasi terbaru di atas.`;
							googleContext += `\n- Jika informasi di atas bertentangan dengan pengetahuan lamamu, gunakan informasi terbaru ini.`;
							googleContext += `\n- Jangan menyebutkan "berdasarkan hasil pencarian Google" or sejenisnya kecuali diminta. Cukup simpulkan dan jawab secara natural seolah-olah kamu sudah mengetahuinya.`;
						}
					} catch (searchError) {
						console.error('Error fetching Google context for AI:', searchError);
					}
				}
				contextInfo += googleContext;

				const identityPrompt = `Kamu adalah Ti Assistant Bot, dibuat oleh Farid Suryadi. JAWABLAH pertanyaan secara langsung tanpa memperkenalkan diri kecuali jika kamu ditanya tentang siapa kamu, namamu, atau pembuatmu.${contextInfo}\n\nPertanyaan: `;
				try {
					let answer = await global.callNazeAI(identityPrompt + aiQuery, imageUrl);
					await handleAIResponse(answer);
				} catch (e) {
					try {
						let res = await chatAI(aiQuery, contextInfo);
						await handleAIResponse(res);
					} catch (fallbackError) {
						m.reply(pickRandom(['Fitur Ai sedang bermasalah!','Tidak dapat terhubung ke ai!','Sistem Ai sedang sibuk sekarang!','Fitur sedang tidak dapat digunakan!']))
					}
				}
			}
			break
			case 'archipelago': case 'grok': case 'glm': case 'claude': case 'deepseek': case 'r1': {
				if (!text) return m.reply('Halo! Ada yang bisa dibantu hari ini?')
				if (command === 'deepseek' || command === 'r1') {
					m.reply('Tunggu bentar, lagi mikir... 🧠');
				}
				try {
					let answer = await global.callNazeAI(text);
					await m.reply(answer);
				} catch (e) {
					m.reply('Waduh, ada kendala pas memproses perintah ini.');
				}
			}
			break
			
			// Search Menu
			case 'google': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} berita teknologi terbaru`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/search/google', { query: text })
					if (!hasil.result || hasil.result.length === 0) {
						return m.reply('Pencarian tidak ditemukan!')
					}
					
					let teks = `🔍 *Google Search* 🔍\nQuery: _${text}_\n\n`;
					const searchResults = hasil.result.slice(0, 5);
					searchResults.forEach((item, index) => {
						teks += `*${index + 1}. ${item.title}*\n`;
						teks += `📝 ${item.snippet || '-'}\n`;
						teks += `🔗 ${item.link}\n\n`;
					});
					
					await m.reply(teks.trim());
					setLimit(m, db)
				} catch (e) {
					console.log(e);
					m.reply('Gagal melakukan pencarian Google. Silakan coba lagi nanti.');
				}
			}
			break
			case 'gimage': case 'bingimg': {
				if (!text) return m.reply(`Example: ${prefix + command} query`)
				try {
					let anu = await fetchApi('/search/google', { query: text });
					let una = pickRandom(anu.result)
					await m.reply({ image: { url: una.pagemap?.cse_thumbnail?.[0]?.src || una.pagemap?.cse_image?.[0].src || una.pagemap?.metatags?.[0]?.["og:image"] }, caption: 'Hasil Pencarian ' + text + '\nTitle: ' + una.title + '\nSnippet: ' + una.snippet + '\nSource: ' + una.link || una.formattedUrl })
					setLimit(m, db)
				} catch (e) {
					m.reply('Pencarian Tidak Ditemukan!')
				}
			}
			break
			case 'play': case 'ytplay': case 'yts': case 'ytsearch': case 'youtubesearch': {
				if (!text) return m.reply(`Example: ${prefix + command} dj komang`)
				m.react('⏳')
				try {
					let hasil;
					const ytIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
					const match = text.match(ytIdRegex);
					if (match) {
						hasil = await yts({ videoId: match[1] });
					} else {
						const res = await yts.search(text);
						hasil = res.all[0];
					}
					const videoUrl = hasil.url || ''
					const teksnya = `*📍Title:* ${hasil.title || 'Tidak tersedia'}\n*🌟Channel:* ${hasil.author?.name || 'Tidak tersedia'}\n*⏳Duration:* ${hasil.seconds || 'Tidak tersedia'} second (${hasil.timestamp || 'Tidak tersedia'})\n*🔎Source:* ${videoUrl}`;
					await naze.sendButtonMsg(m.chat, {
						image: { url: hasil.thumbnail },
						caption: teksnya,
						footer: 'Pilih format download:',
						buttons: [
							{ buttonId: `${prefix}ytmp3 ${videoUrl}`, buttonText: { displayText: '🎵 Audio' }, type: 1 },
							{ buttonId: `${prefix}ytmp4 ${videoUrl}`, buttonText: { displayText: '🎬 Video' }, type: 1 },
							{ buttonId: `${prefix}ytmp3doc ${videoUrl}`, buttonText: { displayText: '📁 File Audio' }, type: 1 },
							{ buttonId: `${prefix}ytmp4doc ${videoUrl}`, buttonText: { displayText: '📁 File Video' }, type: 1 }
						]
					}, { quoted: m });
				} catch (e) {
					try {
						let hasil;
						let videoUrl;
						const ytIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
						const match = text.match(ytIdRegex);
						if (match) {
							const res = await fetchApi('/search/youtube', { query: match[1] });
							hasil = res.result.items[0];
							videoUrl = `https://youtu.be/${hasil.id.videoId || match[1]}`;
						} else {
							const res = await fetchApi('/search/youtube', { query: text });
							hasil = res.result.items[0];
							videoUrl = `https://youtu.be/${hasil.id.videoId || ''}`;
						}
						const teksnya = `*📍Title:* ${hasil.snippet?.title || 'Tidak tersedia'}\n*🌟Channel:* ${hasil.snippet?.channelTitle || 'Tidak tersedia'}\n*⏳Duration:* ${hasil.duration || 'Tidak tersedia'}\n*🔎Source:* ${videoUrl}`;
						await naze.sendButtonMsg(m.chat, {
							image: { url: hasil.snippet.thumbnails.medium.url },
							caption: teksnya,
							footer: 'Pilih format download:',
							buttons: [
								{ buttonId: `${prefix}ytmp3 ${videoUrl}`, buttonText: { displayText: '🎵 Audio' }, type: 1 },
								{ buttonId: `${prefix}ytmp4 ${videoUrl}`, buttonText: { displayText: '🎬 Video' }, type: 1 },
								{ buttonId: `${prefix}ytmp3doc ${videoUrl}`, buttonText: { displayText: '📁 File Audio' }, type: 1 },
								{ buttonId: `${prefix}ytmp4doc ${videoUrl}`, buttonText: { displayText: '📁 File Video' }, type: 1 }
							]
						}, { quoted: m });
					} catch (e) {
						m.reply('Post not available!')
					}
				}
			}
			break
			case 'pixiv': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} hu tao`)
				try {
					m.react('⏳')
					const res = await fetchApi('/search/pixiv', { query: text });
					let hasil = pickRandom(res.result.body.illusts);
					const response = await fetch(hasil.url, { headers: { 'referer': 'https://www.pixiv.net' }});
					const image = await response.buffer();
					m.reply({ image, caption: `Title: ${hasil.title}\nDescription: ${hasil.alt}\nTags:\n${hasil.tags.map(a => '- ' + a).join('\n')}` });
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply('Post not available!')
				}
			}
			break
			case 'pinterest': case 'pint': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} hu tao`)
				try {
					const res = await fetchApi('/search/pinterest', { query: text });
					const hasil = pickRandom(res.result)
					const image = await getBuffer(hasil);
					await m.reply({ image, caption: 'Hasil dari: ' + text })
					setLimit(m, db)
				} catch (e) {
					m.reply('Pencarian tidak ditemukan!');
				}
			}
			break
			case 'wallpaper': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} hu tao`)
				try {
					let anu = await fetchApi('/search/pinterest', { query: text });
					if (anu.length < 1) {
						m.reply('Post not available!');
					} else {
						let result = pickRandom(anu.result)
						await m.reply({ image: { url: result.urls.original }, caption: `*Media Url :* ${result.pin}${result.description ? '\n*Description :* ' + result.description : ''}` })
						setLimit(m, db)
					}
				} catch (e) {
					m.reply('Server wallpaper sedang offline!')
				}
			}
			break
			case 'ringtone': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} black rover`)
				try {
					let anu = await fetchApi('/search/meloboom', { query: text });
					let result = pickRandom(anu.result.data)
					await m.reply({ audio: { url: anu.result.populated.media[result.media.audio[0]].url }, fileName: result.slug + '.mp3', mimetype: 'audio/mpeg' })
					setLimit(m, db)
				} catch (e) {
					m.reply('Audio tidak ditemukan!')
				}
			}
			break
			case 'npm': case 'npmjs': {
				if (!text) return m.reply(`Example: ${prefix + command} axios`)
				try {
					let anu = await fetchApi('/search/npm', { query: text });
					if (anu.result.objects.length > 1) return m.reply('Pencarian Tidak di temukan')
					let txt = anu.result.objects.map(({ package: pkg }) => {
						return `*${pkg.name}* (v${pkg.version})\n_${pkg.links.npm}_\n_${pkg.description}_`
					}).join`\n\n`
					m.reply(txt)
				} catch (e) {
					m.reply('Pencarian Tidak di temukan')
				}
			}
			break
			case 'style': {
				if (!text) return m.reply(`Example: ${prefix + command} Ti Assistant Bot`)
				let anu = await fetchApi('/tools/styletext', { text });
				let txt = anu.result.map(a => `*${a.name}*\n${a.result}`).join`\n\n`
				m.reply(txt)
			}
			break
			case 'spotify': case 'spotifysearch': {
				if (!text) return m.reply(`Example: ${prefix + command} alan walker alone`)
				try {
					let hasil = await fetchApi('/search/spotify', { query: text });
					let txt = hasil.result.map(a => {
						return `*Title : ${a.title}*\n- Artist : ${a.artist}\n- Url : ${a.url}`
					}).join`\n\n`
					m.reply(txt)
				} catch (e) {
					m.reply('Hasil Tidak Ditemukan!')
				}
			}
			break
			case 'tenor': {
				if (!text) return m.reply(`Example: ${prefix + command} alone`)
				try {
					const anu = await fetchApi('/search/tenor', { query: text });
					const hasil = pickRandom(anu.result)
					await m.reply({ video: { url: hasil.media[0].mp4.url }, caption: `👀 *Media:* ${hasil.url}\n📋 *Description:* ${hasil.content_description}\n🔛 *Url:* ${hasil.itemurl}`, gifPlayback: true, gifAttribution: 2 })
				} catch (e) {
					m.reply('Hasil Tidak Ditemukan!')
				}
			}
			break
			case 'urban': {
				if (!text) return m.reply(`Example: ${prefix + command} alone`)
				try {
					const anu = await fetchJson('https://api.urbandictionary.com/v0/define?term=' + text)
					const hasil = pickRandom(anu.list)
					await m.reply(`${hasil.definition}\n\nSumber: ${hasil.permalink}`)
				} catch (e) {
					m.reply('Hasil Tidak Ditemukan!')
				}
			}
			break
			
			// Stalker Menu
			case 'wastalk': case 'whatsappstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} @tag / 628xxx`)
				try {
					let num = m.quoted?.sender || m.mentionedJid?.[0] || text
					if (!num) return m.reply(`Example : ${prefix + command} @tag / 628xxx`)
					num = num.replace(/\D/g, '') + '@s.whatsapp.net'
					if (!(await naze.onWhatsApp(num))[0]?.exists) return m.reply('Nomer tidak terdaftar di WhatsApp!')
					let img = await naze.profilePictureUrl(num, 'image').catch(_ => 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60')
					let bio = await naze.fetchStatus(num).catch(_ => { })
					let name = await naze.getName(num)
					let business = await naze.getBusinessProfile(num)
					let parsed = parsePhoneNumber(`+${num.split('@')[0]}`)
					let format = parsed.number ? parsed.number.international : num.split('@')[0];
					let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
					let country = parsed.regionCode ? regionNames.of(parsed.regionCode) : 'Unknown';
					let wea = `WhatsApp Stalk\n\n*° Country :* ${country.toUpperCase()}\n*° Name :* ${name ? name : '-'}\n*° Format Number :* ${format}\n*° Url Api :* wa.me/${num.split('@')[0]}\n*° Mentions :* @${num.split('@')[0]}\n*° Status :* ${bio?.status || '-'}\n*° Date Status :* ${bio?.setAt ? moment(bio.setAt.toDateString()).locale(global.locale).format('LL') : '-'}\n\n${business ? `*WhatsApp Business Stalk*\n\n*° BusinessId :* ${business.wid}\n*° Website :* ${business.website ? business.website : '-'}\n*° Email :* ${business.email ? business.email : '-'}\n*° Category :* ${business.category}\n*° Address :* ${business.address ? business.address : '-'}\n*° Timeone :* ${business.business_hours.timezone ? business.business_hours.timezone : '-'}\n*° Description* : ${business.description ? business.description : '-'}` : '*Standard WhatsApp Account*'}`
					img ? await naze.sendMessage(m.chat, { image: { url: img }, caption: wea, mentions: [num] }, { quoted: m }) : m.reply(wea)
				} catch (e) {
					console.error(e)
					m.reply('Nomer Tidak ditemukan!')
				}
			}
			break
			case 'ghstalk': case 'githubstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} usernamenya`)
				try {
					const res = await fetchJson('https://api.github.com/users/' + text)
					m.reply({ image: { url: res.avatar_url }, caption: `*Username :* ${res.login}\n*Nickname :* ${res.name || 'Tidak ada'}\n*Bio :* ${res.bio || 'Tidak ada'}\n*ID :* ${res.id}\n*Node ID :* ${res.node_id}\n*Type :* ${res.type}\n*Admin :* ${res.admin ? 'Ya' : 'Tidak'}\n*Company :* ${res.company || 'Tidak ada'}\n*Blog :* ${res.blog || 'Tidak ada'}\n*Location :* ${res.location || 'Tidak ada'}\n*Email :* ${res.email || 'Tidak ada'}\n*Public Repo :* ${res.public_repos}\n*Public Gists :* ${res.public_gists}\n*Followers :* ${res.followers}\n*Following :* ${res.following}\n*Created At :* ${res.created_at} *Updated At :* ${res.updated_at}` })
				} catch (e) {
					m.reply('Username Tidak ditemukan!')
				}
			}
			break
			
			// Downloader Menu
			case 'ytmp3': case 'ytaudio': case 'ytplayaudio': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_youtube`)
				if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!')
				m.react('⏳')
				try {
					const { result: hasil } = await fetchApi('/download/youtube', { url: text });
					if (hasil?.download && hasil.type === 'audio') {
						await m.reply({ audio: { url: hasil.download }, mimetype: 'audio/mpeg' })
						setLimit(m, db)
					} else {
						throw new Error('Not an audio result');
					}
				} catch (e) {
					let audioPath = null;
					try {
						const hasil = await ytMp3(text);
						audioPath = hasil.result;
						if (audioPath && fs.existsSync(audioPath)) {
							await m.reply({ audio: { url: audioPath }, mimetype: 'audio/mpeg' })
							setLimit(m, db)
						}
					} catch (e) {
						m.reply(global.mess.fail);
					} finally {
						if (audioPath && fs.existsSync(audioPath)) {
							try { fs.unlinkSync(audioPath); } catch {}
						}
					}
				}
			}
			break
			case 'ytmp4': case 'ytvideo': case 'ytplayvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_youtube`)
				if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!')
				m.react('⏳')
				let sent = false;
				// Method 1: Try local ytMp4 (uses yt-dlp forcing H.264)
				let videoPath = null;
				try {
					const hasil = await ytMp4(text);
					videoPath = hasil.result;
					if (videoPath && fs.existsSync(videoPath)) {
						const size = fs.statSync(videoPath).size;
						if (size > 16 * 1024 * 1024) {
							await m.reply('Ukuran video melebihi 16MB. Mengirim sebagai dokumen...');
							await m.reply({ document: { url: videoPath }, mimetype: 'video/mp4', fileName: `${hasil.title || 'video'}.mp4`, caption: `*📍Title:* ${hasil.title}\n*🚀Channel:* ${hasil.channel}\n*🗓Upload at:* ${hasil.uploadDate}`});
						} else {
							await m.reply({ video: { url: videoPath }, caption: `*📍Title:* ${hasil.title}\n*✏Description:* ${hasil.desc ? hasil.desc : ''}\n*🚀Channel:* ${hasil.channel}\n*🗓Upload at:* ${hasil.uploadDate}`});
						}
						setLimit(m, db);
						sent = true;
					}
				} catch (e) {
					console.error('ytMp4 error:', e.message);
				} finally {
					if (videoPath && fs.existsSync(videoPath)) {
						try { fs.unlinkSync(videoPath); } catch {}
					}
				}
				
				// Method 2: Try various formats from API
				if (!sent) {
					const formats = ['360', '480', '720', '1080'];
					for (const fmt of formats) {
						if (sent) break;
						try {
							const { result: hasil } = await fetchApi('/download/youtube', { url: text, format: fmt });
							if (hasil?.download && hasil.type === 'video') {
								await m.reply({ video: { url: hasil.download }, mimetype: 'video/mp4', caption: `*📍Title:* ${hasil.title}\n*✏Quality:* ${fmt}p\n*⏳Duration:* ${hasil.duration}` });
								setLimit(m, db);
								sent = true;
							}
						} catch {}
					}
				}
				if (!sent) m.reply(global.mess.fail);
			}
			break
			case 'ytmp3doc': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_youtube`)
				if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!')
				m.react('⏳')
				try {
					const { result: hasil } = await fetchApi('/download/youtube', { url: text });
					if (hasil?.download && hasil.type === 'audio') {
						await m.reply({ document: { url: hasil.download }, mimetype: 'audio/mpeg', fileName: `${hasil.title || 'audio'}.mp3` })
						setLimit(m, db)
					} else {
						throw new Error('Not an audio result');
					}
				} catch (e) {
					let audioPath = null;
					try {
						const hasil = await ytMp3(text);
						audioPath = hasil.result;
						if (audioPath && fs.existsSync(audioPath)) {
							await m.reply({ document: { url: audioPath }, mimetype: 'audio/mpeg', fileName: `${hasil.title || 'audio'}.mp3` })
							setLimit(m, db)
						}
					} catch (e) {
						m.reply(global.mess.fail);
					} finally {
						if (audioPath && fs.existsSync(audioPath)) {
							try { fs.unlinkSync(audioPath); } catch {}
						}
					}
				}
			}
			break
			case 'ytmp4doc': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_youtube`)
				if (!text.includes('youtu')) return m.reply('Url Tidak Mengandung Result Dari Youtube!')
				m.react('⏳')
				let sent = false;
				// Method 1: Try local ytMp4
				let videoPath = null;
				try {
					const hasil = await ytMp4(text);
					videoPath = hasil.result;
					if (videoPath && fs.existsSync(videoPath)) {
						await m.reply({ document: { url: videoPath }, mimetype: 'video/mp4', fileName: `${hasil.title || 'video'}.mp4`, caption: `*📍Title:* ${hasil.title}\n*🚀Channel:* ${hasil.channel}\n*🗓Upload at:* ${hasil.uploadDate}`});
						setLimit(m, db);
						sent = true;
					}
				} catch (e) {
					console.error('ytMp4doc error:', e.message);
				} finally {
					if (videoPath && fs.existsSync(videoPath)) {
						try { fs.unlinkSync(videoPath); } catch {}
					}
				}
				
				// Method 2: Try various formats from API
				if (!sent) {
					const formats = ['360', '480', '720', '1080'];
					for (const fmt of formats) {
						if (sent) break;
						try {
							const { result: hasil } = await fetchApi('/download/youtube', { url: text, format: fmt });
							if (hasil?.download && hasil.type === 'video') {
								await m.reply({ document: { url: hasil.download }, mimetype: 'video/mp4', fileName: `${hasil.title || 'video'}.mp4`, caption: `*📍Title:* ${hasil.title}\n*✏Quality:* ${fmt}p\n*⏳Duration:* ${hasil.duration}` });
								setLimit(m, db);
								sent = true;
							}
						} catch {}
					}
				}
				if (!sent) m.reply(global.mess.fail);
			}
			break
			case 'ig': case 'instagram': case 'instadl': case 'igdown': case 'igdl': case 'igstory': case 'igstories': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_instagram`)
				if (!text.includes('instagram.com')) return m.reply('Url Tidak Mengandung Result Dari Instagram!')
				m.react('⏳')
				try {
					let urls = []
					let caption = ''
					let isReel = text.includes('/reel/') || text.includes('/reels/')
					let isStory = text.includes('/stories/')
					const axiosLib = (await import('axios')).default
					
					// Coba endpoint API pertama
					try {
						let hasil = await fetchApi('/download/instagram2', { url: text })
						if (hasil?.result?.urls?.length > 0) {
							urls = hasil.result.urls
							caption = hasil.result.caption || ''
						}
					} catch (e1) {}
					
					// Fallback endpoint API kedua
					if (urls.length === 0) {
						try {
							let hasil = await fetchApi('/download/instagram', { url: text })
							if (hasil?.result?.urls?.length > 0) {
								urls = hasil.result.urls
								caption = hasil.result.caption || ''
							} else if (hasil?.result?.url) {
								urls = [{ url: hasil.result.url, is_video: isReel }]
								caption = hasil.result.caption || hasil.result.title || ''
							}
						} catch (e2) {}
					}
					
					// Fallback 3: DownloadGram (supports reels, posts, stories)
					if (urls.length === 0) {
						try {
							const { data: dgRes } = await axiosLib.post('https://api.downloadgram.org/media',
								{ url: text },
								{ headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, timeout: 15000 }
							)
							let resData = typeof dgRes === 'string' ? dgRes : JSON.stringify(dgRes)
							let cdnLinks = resData.match(/https?:\/\/cdn\.downloadgram\.org\/[^\\"'\s<>]+/g)
							if (cdnLinks) {
								cdnLinks = [...new Set(cdnLinks)]
								for (let link of cdnLinks) {
									let isVideo = false
									// Decode JWT token payload to detect file type
									let tokenMatch = link.match(/token=([^&\s"'\\]+)/)
									if (tokenMatch) {
										try {
											let payload = JSON.parse(Buffer.from(tokenMatch[1].split('.')[1], 'base64').toString())
											isVideo = payload.filename?.includes('.mp4')
										} catch(e) {}
									}
									urls.push({ url: link, is_video: isVideo })
								}
								// Untuk reel/story: hanya ambil video, skip thumbnail
								if ((isReel || isStory) && urls.some(u => u.is_video)) {
									urls = urls.filter(u => u.is_video)
								}
							}
						} catch (e3) {}
					}
					
					if (urls.length === 0) return m.reply('Postingan Tidak Tersedia, Privat, atau Gagal Mengambil Data!')
					
					if (urls.length > 1 && !isReel && !isStory) {
						await naze.sendAlbumMessage(m.chat, {
							album: urls.map(a => (a.is_video ? { video: { url: a.url }} : { image: { url: a.url }})),
							caption: caption
						}, { quoted: m });
					} else {
						let item = urls[0]
						if (item.is_video || isReel) {
							await m.reply({ video: { url: item.url }, caption: caption })
						} else {
							await m.reply({ image: { url: item.url }, caption: caption })
						}
					}
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'tiktok': case 'tiktokdown': case 'ttdown': case 'ttdl': case 'tt': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_tiktok`)
				if (!text.includes('tiktok.com')) return m.reply('Url Tidak Mengandung Result Dari Tiktok!')
				try {
					const hasil = await fetchApi('/download/tiktok', { url: text })
					m.react('⏳')
					if (hasil.result.download.type == "images") {
						await naze.sendAlbumMessage(m.chat, {
							album: hasil.result.download.images.map(a => ({ image: { url: a.url }})),
							caption: `*📍Title:* ${hasil.result.desc || '-'}\n*🕓Create At:* ${hasil.result.create_time}\n*🎃Author:* ${hasil.result.author.nickname} (@${hasil.result.author.unique_id})`
						}, { quoted: m });
						if (hasil.result.download?.music) {
							if (!global.ttData) global.ttData = {}
							global.ttData[m.chat] = {
								music: hasil.result.download.music,
								desc: hasil.result.desc || '-',
								create_time: hasil.result.create_time,
								author: `${hasil.result.author.nickname} (@${hasil.result.author.unique_id})`
							}
							await naze.sendButtonMsg(m.chat, {
								text: '🎵 Mau download audionya juga?',
								footer: '🎵 TikTok Downloader',
								buttons: [
									{ buttonId: `${prefix}ttaudio`, buttonText: { displayText: 'Audio 🎵' }, type: 1 },
									{ buttonId: `${prefix}ttfileaudio`, buttonText: { displayText: 'File Audio 📁🎵' }, type: 1 }
								]
							})
						}
					} else if (hasil.result.download.type == "video") {
						if (!global.ttData) global.ttData = {}
						global.ttData[m.chat] = {
							video: hasil.result.download?.video?.nowm_hd || hasil.result.download?.video?.nowm,
							music: hasil.result.download?.music,
							desc: hasil.result.desc || '-',
							create_time: hasil.result.create_time,
							author: `${hasil.result.author.nickname} (@${hasil.result.author.unique_id})`,
							thumb: hasil.result.download?.video?.cover || hasil.result.author?.avatar
						}
						let caption = `*📍Title:* ${hasil.result.desc || '-'}\n*🕓Create At:* ${hasil.result.create_time}\n*🎃Author:* ${hasil.result.author.nickname} (@${hasil.result.author.unique_id})\n\n_Pilih format download di bawah:_`
						let thumbUrl = hasil.result.download?.video?.cover || hasil.result.author?.avatar
						await naze.sendButtonMsg(m.chat, {
							image: { url: thumbUrl },
							caption: caption,
							footer: '🎵 TikTok Downloader',
							buttons: [
								{ buttonId: `${prefix}ttvideo`, buttonText: { displayText: 'Video 🎬' }, type: 1 },
								{ buttonId: `${prefix}ttaudio`, buttonText: { displayText: 'Audio 🎵' }, type: 1 },
								{ buttonId: `${prefix}ttfilevideo`, buttonText: { displayText: 'File Video 📁🎬' }, type: 1 },
								{ buttonId: `${prefix}ttfileaudio`, buttonText: { displayText: 'File Audio 📁🎵' }, type: 1 }
							]
						}, { quoted: m })
					} else {
						return m.reply('Url Tidak Valid!')
					}
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'ttvideo': case 'ttmp4': case 'tiktokmp4': case 'tiktokvideo': case 'tiktokdown': {
				let data = global.ttData?.[m.chat]
				if (!data) return m.reply('Tidak ada data TikTok! Silakan ketik .tiktok <url> terlebih dahulu.')
				try {
					m.react('⏳')
					await m.reply({ video: { url: data.video }, caption: `*📍Title:* ${data.desc}\n*🕓Create At:* ${data.create_time}\n*🎃Author:* ${data.author}` })
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'ttaudio': case 'ttmp3': case 'tiktokmp3': case 'tiktokaudio': {
				let data = global.ttData?.[m.chat]
				if (!data) return m.reply('Tidak ada data TikTok! Silakan ketik .tiktok <url> terlebih dahulu.')
				try {
					m.react('⏳')
					await m.reply({ audio: { url: data.music }, mimetype: 'audio/mpeg' })
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'ttfilevideo': {
				let data = global.ttData?.[m.chat]
				if (!data) return m.reply('Tidak ada data TikTok! Silakan ketik .tiktok <url> terlebih dahulu.')
				try {
					m.react('⏳')
					await m.reply({ document: { url: data.video }, mimetype: 'video/mp4', fileName: `TikTok_${Date.now()}.mp4` })
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'ttfileaudio': {
				let data = global.ttData?.[m.chat]
				if (!data) return m.reply('Tidak ada data TikTok! Silakan ketik .tiktok <url> terlebih dahulu.')
				try {
					m.react('⏳')
					await m.reply({ document: { url: data.music }, mimetype: 'audio/mpeg', fileName: `TikTok_${Date.now()}.mp3` })
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'fb': case 'fbdl': case 'fbdown': case 'facebook': case 'facebookdl': case 'facebookdown': case 'fbdownload': case 'fbmp4': case 'fbvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_facebook`)
				if (!text.includes('facebook.com')) return m.reply('Url Tidak Mengandung Result Dari Facebook!')
				try {
					const hasil = await fetchApi('/download/facebook', { url: text });
					if (!hasil.result.hd && !hasil.result.sd) {
						m.reply('Video Tidak ditemukan!')
					} else {
						m.react('⏳')
						await naze.sendFileUrl(m.chat, hasil.result.hd || hasil.result.sd, `*🎐Title:* ${hasil.result.title}`, m);
					}
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'mediafire': case 'mf': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} https://www.mediafire.com/file/xxxxxxxxx/xxxxx.zip/file`)
				if (!isUrl(args[0]) && !args[0].includes('mediafire.com')) return m.reply('Url Invalid!')
				try {
					let { result: res } = await fetchApi('/download/mediafire', { url: text })
					await naze.sendMedia(m.chat, res.link, res.filename, `*MEDIAFIRE DOWNLOADER*\n\n*${setv} Name* : ${res.filename}\n*${setv} Size* : ${res.size}`, m)
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'spotifydl': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} https://open.spotify.com/track/0JiVRyTJcJnmlwCZ854K4p`)
				if (!isUrl(args[0]) && !args[0].includes('open.spotify.com/track')) return m.reply('Url Invalid!')
				try {
					const { result: hasil } = await fetchApi('/download/spotify', { url: text });
					m.react('⏳')
					await m.reply({ audio: { url: hasil.url }, mimetype: 'audio/mpeg' })
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			
			// Quotes Menu
			case 'motivasi': {
				const hasil = await fetchApi('/random/motivasi');
				m.reply(hasil.result)
			}
			break
			case 'bijak': {
				const hasil = await fetchApi('/random/bijak');
				m.reply(hasil.result)
			}
			break
			case 'dare': {
				const hasil = await fetchApi('/random/dare');
				m.reply(hasil.result)
			}
			break
			case 'quotes': {
				const { result: hasil } = await fetchApi('/random/quotes');
				m.reply(`_${hasil.quotes}_\n\n*- ${hasil.author}*`)
			}
			break
			case 'truth': {
				const hasil = await fetchApi('/random/truth');
				m.reply(`_${hasil.result}_`)
			}
			break
			case 'renungan': {
				const hasil = await fetchApi('/random/renungan');
				m.reply(hasil.result, {
					contextInfo: {
						forwardingScore: 10,
						isForwarded: true,
					}
				});
			}
			break
			case 'bucin': {
				const hasil = await fetchApi('/random/bucin');
				m.reply(hasil.result)
			}
			break
			
			// Random Menu
			case 'coffe': case 'kopi': {
				try {
					await naze.sendFileUrl(m.chat, 'https://coffee.alexflipnote.dev/random', '☕ Random Coffe', m)
				} catch (e) {
					try {
						const anu = await fetchJson('https://api.sampleapis.com/coffee/hot')
						await naze.sendFileUrl(m.chat, pickRandom(anu).image, '☕ Random Coffe', m)
					} catch (e) {
						m.reply('Server Sedang Offline!')
					}
				}
			}
			break
			
			// Anime Menu
			case 'waifu': case 'neko': {
				try {
					if (!isNsfw && text === 'nsfw') return m.reply('Filter Nsfw Sedang Aktif!')
					const res = await fetchJson('https://api.waifu.pics/' + (text === 'nsfw' ? 'nsfw' : 'sfw') + '/' + command)
					await naze.sendFileUrl(m.chat, res.url, 'Random Waifu', m)
					setLimit(m, db)
				} catch (e) {
					m.reply('Server sedang offline!')
				}
			}
			break
			
			// Fun Menu
			case 'dadu': {
				let ddsa = [{ url: 'https://telegra.ph/file/9f60e4cdbeb79fc6aff7a.png', no: 1 },{ url: 'https://telegra.ph/file/797f86e444755282374ef.png', no: 2 },{ url: 'https://telegra.ph/file/970d2a7656ada7c579b69.png', no: 3 },{ url: 'https://telegra.ph/file/0470d295e00ebe789fb4d.png', no: 4 },{ url: 'https://telegra.ph/file/a9d7332e7ba1d1d26a2be.png', no: 5 },{ url: 'https://telegra.ph/file/99dcd999991a79f9ba0c0.png', no: 6 }]
				let media = pickRandom(ddsa)
				try {
					await naze.sendAsSticker(m.chat, media.url, m, { packname, author, isAvatar: 1 })
				} catch (e) {
					let anu = await fetch(media.url)
					let una = await anu.buffer()
					await naze.sendAsSticker(m.chat, una, m, { packname, author, isAvatar: 1 })
				}
			}
			break
			case 'halah': case 'hilih': case 'huluh': case 'heleh': case 'holoh': {
				if (!m.quoted && !text) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`)
				let ter = command[1].toLowerCase()
				let tex = m.quoted ? m.quoted.text ? m.quoted.text : q ? q : m.text : q ? q : m.text
				m.reply(tex.replace(/[aiueo]/g, ter).replace(/[AIUEO]/g, ter.toUpperCase()))
			}
			break
			case 'bisakah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya menang?`)
				let bisa = ['Bisa','Coba Saja','Pasti Bisa','Mungkin Saja','Tidak Bisa','Tidak Mungkin','Coba Ulangi','Ngimpi kah?','yakin bisa?']
				let keh = bisa[Math.floor(Math.random() * bisa.length)]
				m.reply(`*Bisakah ${text}*\nJawab : ${keh}`)
			}
			break
			case 'apakah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya bisa menang?`)
				let apa = ['Iya','Tidak','Bisa Jadi','Coba Ulangi','Mungkin Saja','Mungkin Tidak','Mungkin Iya','Ntahlah']
				let kah = apa[Math.floor(Math.random() * apa.length)]
				m.reply(`*${command} ${text}*\nJawab : ${kah}`)
			}
			break
			case 'kapan': case 'kapankah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya menang?`)
				let kapan = ['Besok','Lusa','Nanti','4 Hari Lagi','5 Hari Lagi','6 Hari Lagi','1 Minggu Lagi','2 Minggu Lagi','3 Minggu Lagi','1 Bulan Lagi','2 Bulan Lagi','3 Bulan Lagi','4 Bulan Lagi','5 Bulan Lagi','6 Bulan Lagi','1 Tahun Lagi','2 Tahun Lagi','3 Tahun Lagi','4 Tahun Lagi','5 Tahun Lagi','6 Tahun Lagi','1 Abad lagi','3 Hari Lagi','Bulan Depan','Ntahlah','Tidak Akan Pernah']
				let koh = kapan[Math.floor(Math.random() * kapan.length)]
				m.reply(`*${command} ${text}*\nJawab : ${koh}`)
			}
			break
			case 'siapa': case 'siapakah': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!text) return m.reply(`Example : ${prefix + command} jawa?`)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.id)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let siapakh = pickRandom(member)
				m.reply(`@${siapakh.split('@')[0]}`, { mentions: [siapakh] });
			}
			break
			case 'tanyakerang': case 'kerangajaib': case 'kerang': {
				if (!text) return m.reply(`Example : ${prefix + command} boleh pinjam 100?`)
				let krng = ['Mungkin suatu hari', 'Tidak juga', 'Tidak keduanya', 'Kurasa tidak', 'Ya', 'Tidak', 'Coba tanya lagi', 'Tidak ada']
				let jwb = pickRandom(krng)
				m.reply(`*Pertanyaan : ${text}*\n*Jawab : ${jwb}*`)
			}
			break
			case 'cekmati': {
				if (!text) return m.reply(`Example : ${prefix + command} nama lu`)
				let teksnya = encodeToLetters(text);
				let data = await axios.get(`https://api.agify.io/?name=${teksnya}`).then(res => res.data).catch(e => ({ age: null }));
				let consistentAge = 0
				for (let i = 0; i < teksnya.length; i++) consistentAge += teksnya.charCodeAt(i)
				let finalAge = data.age == null ? (consistentAge % 90) + 20 : data.age
				let nameDisplay = m.mentionedJid && m.mentionedJid.length > 0 ? `@${m.mentionedJid[0].split('@')[0]}` : text
				m.reply(`Nama : ${nameDisplay}\n*Mati Pada Umur :* ${finalAge} Tahun.\n\n_Cepet Cepet Tobat Bro_\n_Soalnya Mati ga ada yang tau_`)
			}
			break
			case 'ceksifat': {
				let sifat_a = ['Bijak','Sabar','Kreatif','Humoris','Mudah bergaul','Mandiri','Setia','Jujur','Dermawan','Idealis','Adil','Sopan','Tekun','Rajin','Pemaaf','Murah hati','Ceria','Percaya diri','Penyayang','Disiplin','Optimis','Berani','Bersyukur','Bertanggung jawab','Bisa diandalkan','Tenang','Kalem','Logis']
				let sifat_b = ['Sombong','Minder','Pendendam','Sensitif','Perfeksionis','Caper','Pelit','Egois','Pesimis','Penyendiri','Manipulatif','Labil','Penakut','Vulgar','Tidak setia','Pemalas','Kasar','Rumit','Boros','Keras kepala','Tidak bijak','Pembelot','Serakah','Tamak','Penggosip','Rasis','Ceroboh','Intoleran']
				let teks = `╭──❍「 *Cek Sifat* 」❍\n│• Sifat ${text && m.mentionedJid ? text : '@' + m.sender.split('@')[0]}${(text && m.mentionedJid ? '' : (`\n│• Nama : *${text ? text : m.pushName}*` || '\n│• Nama : *Tanpa Nama*'))}\n│• Orang yang : *${pickRandom(sifat_a)}*\n│• Kekurangan : *${pickRandom(sifat_b)}*\n│• Keberanian : *${Math.floor(Math.random() * 100)}%*\n│• Kepedulian : *${Math.floor(Math.random() * 100)}%*\n│• Kecemasan : *${Math.floor(Math.random() * 100)}%*\n│• Ketakutan : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Baik : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Buruk : *${Math.floor(Math.random() * 100)}%*\n╰──────❍`
				m.reply(teks)
			}
			break
			case 'cekkhodam': {
				if (!text) return m.reply(`Example : ${prefix + command} nama lu`)
				try {
					const { result: hasil } = await fetchApi('/primbon/cekkhodam');
					m.reply(`Khodam dari *${text}* adalah *${hasil.nama}*\n_${hasil.deskripsi}_`)
				} catch (e) {
					m.reply(pickRandom(['Dokter Indosiar','Sigit Rendang','Ustadz Sinetron','Bocil epep']))
				}
			}
			break
			case 'rate': case 'nilai': {
				m.reply(`Rate Bot : *${Math.floor(Math.random() * 100)}%*`)
			}
			break
			case 'jodohku': {
				if (!m.isGroup) return m.reply(global.mess.group)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.id)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let jodoh = pickRandom(member)
				m.reply(`👫Jodoh mu adalah\n@${m.sender.split('@')[0]} ❤ @${jodoh ? jodoh.split('@')[0] : '0'}`, { mentions: [m.sender, jodoh].filter(Boolean) });
			}
			break
			case 'jadian': {
				if (!m.isGroup) return m.reply(global.mess.group)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.id)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let jadian1 = pickRandom(member)
				let jadian2 = pickRandom(member)
				m.reply(`Ciee yang Jadian💖 Jangan lupa Donasi🗿\n@${jadian1.split('@')[0]} ❤ @${jadian2.split('@')[0]}`, { mentions: [jadian1, jadian2] });
			}
			break
			case 'fitnah': {
				let [teks1, teks2, teks3] = text.split`|`
				if (!teks1 || !teks2 || !teks3) return m.reply(`Example : ${prefix + command} pesan target|pesan mu|nomer/tag target`)
				let ftelo = { key: { fromMe: false, participant: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net', ...(m.isGroup ? { remoteJid: m.chat } : { remoteJid: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net'})}, message: { conversation: teks1 }}
				naze.sendMessage(m.chat, { text: teks2 }, { quoted: ftelo });
			}
			break
			case 'coba': {
				let anu = ['Aku Monyet','Aku Kera','Aku Tolol','Aku Kaya','Aku Dewa','Aku Anjing','Aku Dongo','Aku Raja','Aku Sultan','Aku Baik','Aku Hitam','Aku Suki']
				await naze.sendButtonMsg(m.chat, {
					text: 'Semoga Hoki😹',
					buttons: [{
						buttonId: 'teshoki',
						buttonText: { displayText: '\n' + pickRandom(anu)},
						type: 1
					},{
						buttonId: 'cobacoba',
						buttonText: { displayText: '\n' + pickRandom(anu)},
						type: 1
					}]
				})
			}
			break
			
			// Game Menu
			case 'slot': {
				await gameSlot(naze, m, db)
			}
			break
			case 'casino': {
				await gameCasinoSolo(naze, m, prefix, db)
			}
			break
			case 'samgong': case 'kartu': {
				await gameSamgongSolo(naze, m, db)
			}
			break
			case 'rampok': case 'merampok': {
				await gameMerampok(m, db)
			}
			break
			case 'begal': {
				await gameBegal(naze, m, db)
			}
			break
			case 'suitpvp': case 'suit': {
				if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender))) return m.reply(`Selesaikan suit mu yang sebelumnya`)
				if (m.mentionedJid[0] === m.sender) return m.reply(`Tidak bisa bermain dengan diri sendiri !`)
				if (!m.mentionedJid[0]) return m.reply(`_Siapa yang ingin kamu tantang?_\nTag orangnya..\n\nExample : ${prefix}suit @${ownerNumber[0]}`, m.chat, { mentions: [ownerNumber[0] + '@s.whatsapp.net'] })
				if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.mentionedJid[0]))) return m.reply(`Orang yang kamu tantang sedang bermain suit bersama orang lain :(`)
				let caption = `_*SUIT PvP*_\n\n@${m.sender.split('@')[0]} menantang @${m.mentionedJid[0].split('@')[0]} untuk bermain suit\n\nSilahkan @${m.mentionedJid[0].split('@')[0]} memilih opsi di bawah ini`
				let id = 'suit_' + Date.now();
				suit[id] = {
					chat: caption,
					id: id,
					p: m.sender,
					p2: m.mentionedJid[0],
					status: 'wait',
					poin: 10,
					poin_lose: 10,
					timeout: 3 * 60 * 1000
				}
				await naze.sendButtonMsg(m.chat, {
					text: caption,
					footer: 'Suit PvP',
					mentions: [m.sender, m.mentionedJid[0]],
					buttons: [
						{ buttonId: 'terima', buttonText: { displayText: 'Terima ✅' }, type: 1 },
						{ buttonId: 'tolak', buttonText: { displayText: 'Tolak ❌' }, type: 1 }
					]
				}, { quoted: m });
				await sleep(3 * 60 * 1000)
				if (suit[id]) {
					m.reply(`_Waktu suit habis_`)
					delete suit[id]
				}
			}
			break
			case 'delsuit': case 'deletesuit': {
				let roomnya = Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender))
				if (!roomnya) return m.reply(`Kamu sedang tidak berada di room suit !`)
				delete suit[roomnya.id]
				m.reply(`Berhasil delete session room suit !`)
			}
			break
			case 'ttc': case 'ttt': case 'tictactoe': {
				if (Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))) return m.reply(`Kamu masih didalam game!\nKetik *${prefix}del${command}* Jika Ingin Mengakhiri sesi`);
				let room = Object.values(tictactoe).find(room => room.state === 'WAITING' && (text ? room.name === text : true))
				if (room) {
					m.reply('Partner ditemukan!')
					room.o = m.chat
					room.game.playerO = m.sender
					room.state = 'PLAYING'
					if (!(room.game instanceof TicTacToe)) {
						room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game)
					}
					let arr = room.game.render().map(v => {
						return {X: '❌',O: '⭕',1: '1️⃣',2: '2️⃣',3: '3️⃣',4: '4️⃣',5: '5️⃣',6: '6️⃣',7: '7️⃣',8: '8️⃣',9: '9️⃣'}[v]
					})
					let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\nMenunggu @${room.game.currentTurn.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`
					if (room.x !== room.o) await naze.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m })
					await naze.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m })
				} else {
					room = {
						id: 'tictactoe-' + (+new Date),
						x: m.chat,
						o: '',
						game: new TicTacToe(m.sender, 'o'),
						state: 'WAITING',
					}
					if (text) room.name = text
					naze.sendMessage(m.chat, { text: 'Menunggu partner' + (text ? ` mengetik command dibawah ini ${prefix}${command} ${text}` : ''), mentions: m.mentionedJid }, { quoted: m })
					tictactoe[room.id] = room
					await sleep(300000)
					if (tictactoe[room.id]) {
						m.reply(`_Waktu ${command} habis_`)
						delete tictactoe[room.id]
					}
				}
			}
			break
			case 'delttc': case 'delttt': {
				let roomnya = Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))
				if (!roomnya) return m.reply(`Kamu sedang tidak berada di room tictactoe !`)
				delete tictactoe[roomnya.id]
				m.reply(`Berhasil delete session room tictactoe !`)
			}
			break
			case 'tebakbom': {
				if (tebakbom[m.sender]) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				tebakbom[m.sender] = {
					petak: [0, 0, 0, 2, 0, 2, 0, 2, 0, 0].sort(() => Math.random() - 0.5),
					board: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
					bomb: 3,
					lolos: 7,
					pick: 0,
					nyawa: ['❤️', '❤️', '❤️'],
				}
				await m.reply(`*TEBAK BOM*\n\n${tebakbom[m.sender].board.join("")}\n\nPilih lah nomor tersebut! dan jangan sampai terkena Bom!\nBomb : ${tebakbom[m.sender].bomb}\nNyawa : ${tebakbom[m.sender].nyawa.join("")}`);
				await sleep(120000)
				if (tebakbom[m.sender]) {
					m.reply(`_Waktu ${command} habis_`)
					delete tebakbom[m.sender];
				}
			}
			break
			case 'tekateki': {
				if (iGame(tekateki, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tekateki');
				let { key } = await m.reply(`🎮 Teka Teki Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+3499*`)
				tekateki[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tekateki, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tekateki[m.chat + key.id].jawaban)
					delete tekateki[m.chat + key.id]
				}
			}
			break
			case 'tebaklirik': {
				if (iGame(tebaklirik, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebaklirik');
				let { key } = await m.reply(`🎮 Tebak Lirik Berikut :\n\n${hasil.soal}\n\nWaktu : 90s\nHadiah *+4299*`)
				tebaklirik[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(90000)
				if (rdGame(tebaklirik, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebaklirik[m.chat + key.id].jawaban)
					delete tebaklirik[m.chat + key.id]
				}
			}
			break
			case 'tebakkata': {
				if (iGame(tebakkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebakkata');
				let { key } = await m.reply(`🎮 Tebak Kata Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+3499*`)
				tebakkata[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakkata, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebakkata[m.chat + key.id].jawaban)
					delete tebakkata[m.chat + key.id]
				}
			}
			break
			case 'family100': {
				if (family100.hasOwnProperty(m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/family100');
				let { key } = await m.reply(`🎮 Tebak Kata Berikut :\n\n${hasil.soal}\n\nWaktu : 5m\nHadiah *+3499*`)
				family100[m.chat] = {
					soal: hasil.soal,
					jawaban: hasil.jawaban,
					terjawab: Array.from(hasil.jawaban, () => false),
					id: key.id
				}
				await sleep(300000)
				if (family100.hasOwnProperty(m.chat)) {
					m.reply('Waktu Habis\nJawaban:\n- ' + family100[m.chat].jawaban.join('\n- '))
					delete family100[m.chat]
				}
			}
			break
			case 'susunkata': {
				if (iGame(susunkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/susunkata');
				let { key } = await m.reply(`🎮 Susun Kata Berikut :\n\n${hasil.soal}\nTipe : ${hasil.tipe}\n\nWaktu : 60s\nHadiah *+2989*`)
				susunkata[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(susunkata, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + susunkata[m.chat + key.id].jawaban)
					delete susunkata[m.chat + key.id]
				}
			}
			break
			case 'tebakkimia': {
				if (iGame(tebakkimia, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebakkimia');
				let { key } = await m.reply(`🎮 Tebak Kimia Berikut :\n\n${hasil.unsur}\n\nWaktu : 60s\nHadiah *+3499*`)
				tebakkimia[m.chat + key.id] = {
					jawaban: hasil.lambang.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakkimia, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebakkimia[m.chat + key.id].jawaban)
					delete tebakkimia[m.chat + key.id]
				}
			}
			break
			case 'caklontong': {
				if (iGame(caklontong, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/caklontong');
				let { key } = await m.reply(`🎮 Jawab Pertanyaan Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+9999*`)
				caklontong[m.chat + key.id] = {
					...hasil,
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(caklontong, m.chat, key.id)) {
					m.reply(`Waktu Habis\nJawaban: ${caklontong[m.chat + key.id].jawaban}\n"${caklontong[m.chat + key.id].deskripsi}"`)
					delete caklontong[m.chat + key.id]
				}
			}
			break
			case 'tebaknegara': {
				if (iGame(tebaknegara, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebaknegara');
				let { key } = await m.reply(`🎮 Tebak Negara Dari Tempat Berikut :\n\n*Tempat : ${hasil.tempat}*\n\nWaktu : 60s\nHadiah *+3499*`)
				tebaknegara[m.chat + key.id] = {
					jawaban: hasil.negara.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebaknegara, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebaknegara[m.chat + key.id].jawaban)
					delete tebaknegara[m.chat + key.id]
				}
			}
			break
			case 'tebakgambar': {
				if (iGame(tebakgambar, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebakgambar');
				let { key } = await naze.sendFileUrl(m.chat, hasil.img, `🎮 Tebak Gambar Berikut :\n\n${hasil.deskripsi}\n\n⏱️ Waktu : 60s\n🎁 Hadiah *+3499*\n\n_Reply pesan ini untuk menjawab_`, m)
				await naze.sendButtonMsg(m.chat, {
					text: '⏭️ Tekan tombol di bawah untuk melewati soal ini',
					footer: '🎮 Tebak Gambar',
					buttons: [
						{ buttonId: `${prefix}passtebakgambar`, buttonText: { displayText: 'Pass ⏭️' }, type: 1 }
					]
				})
				tebakgambar[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakgambar, m.chat, key.id)) {
					await naze.sendButtonMsg(m.chat, {
						text: `⏰ Waktu Habis!\nJawaban: *${tebakgambar[m.chat + key.id].jawaban}*`,
						footer: '🎮 Tebak Gambar',
						buttons: [
							{ buttonId: `${prefix}tebakgambar`, buttonText: { displayText: 'Mulai Lagi 🔄' }, type: 1 }
						]
					})
					delete tebakgambar[m.chat + key.id]
				}
			}
			break
			case 'passtebakgambar': {
				let sessionKey = Object.keys(tebakgambar).find(k => k.startsWith(m.chat))
				if (sessionKey) {
					let jawabanLama = tebakgambar[sessionKey].jawaban
					delete tebakgambar[sessionKey]
					m.reply(`⏭️ Soal dilewati!\nJawaban sebelumnya: *${jawabanLama}*`)
				}
				const { result: hasil } = await fetchApi('/games/tebakgambar');
				let { key } = await naze.sendFileUrl(m.chat, hasil.img, `🎮 Tebak Gambar Berikut :\n\n${hasil.deskripsi}\n\n⏱️ Waktu : 60s\n🎁 Hadiah *+3499*\n\n_Reply pesan ini untuk menjawab_`, m)
				await naze.sendButtonMsg(m.chat, {
					text: '⏭️ Tekan tombol di bawah untuk melewati soal ini',
					footer: '🎮 Tebak Gambar',
					buttons: [
						{ buttonId: `${prefix}passtebakgambar`, buttonText: { displayText: 'Pass ⏭️' }, type: 1 }
					]
				})
				tebakgambar[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakgambar, m.chat, key.id)) {
					await naze.sendButtonMsg(m.chat, {
						text: `⏰ Waktu Habis!\nJawaban: *${tebakgambar[m.chat + key.id].jawaban}*`,
						footer: '🎮 Tebak Gambar',
						buttons: [
							{ buttonId: `${prefix}tebakgambar`, buttonText: { displayText: 'Mulai Lagi 🔄' }, type: 1 }
						]
					})
					delete tebakgambar[m.chat + key.id]
				}
			}
			break
			case 'tebakbendera': {
				if (iGame(tebakbendera, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/games/tebakbendera');
				let { key } = await m.reply(`🎮 Tebak Bendera Berikut :\n\n*Bendera : ${hasil.bendera}*\n\nWaktu : 60s\nHadiah *+3499*`)
				tebakbendera[m.chat + key.id] = {
					jawaban: hasil.negara.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakbendera, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebakbendera[m.chat + key.id].jawaban)
					delete tebakbendera[m.chat + key.id]
				}
			}
			break
			case 'tebakangka': case 'butawarna': case 'colorblind': {
				if (iGame(tebakangka, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { result: hasil } = await fetchApi('/random/color-blind');
				let { key } = await m.reply({
					image: { url: hasil.color_blind[0] },
					caption: `Pilih Jawaban Yang Benar!\nLevel : ${hasil.lv}\nPilihan: ${[hasil.number, ...hasil.similar].sort(() => Math.random() - 0.5).join(', ')}`
				});
				tebakangka[m.chat + key.id] = {
					jawaban: hasil.number,
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakangka, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebakangka[m.chat + key.id].jawaban)
					delete tebakangka[m.chat + key.id]
				}
			}
			break
			case 'kuismath': case 'math': {
				const { genMath, modes } = await import('./lib/math.js');
				const inputMode = ['noob', 'easy', 'medium', 'hard','extreme','impossible','impossible2'];
				if (iGame(kuismath, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				if (!text) return m.reply(`Mode: ${Object.keys(modes).join(' | ')}\nExample penggunaan: ${prefix}math medium`)
				if (!inputMode.includes(text.toLowerCase())) return m.reply('Mode tidak ditemukan!')
				let result = await genMath(text.toLowerCase())
				let { key } = await m.reply(`*Berapa hasil dari: ${result.soal.toLowerCase()}*?\n\nWaktu : ${(result.waktu / 1000).toFixed(2)} detik`)
				kuismath[m.chat + key.id] = {
					jawaban: result.jawaban,
					mode: text.toLowerCase(),
					id: key.id
				}
				await sleep(kuismath, result.waktu)
				if (rdGame(m.chat + key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + kuismath[m.chat + key.id].jawaban)
					delete kuismath[m.chat + key.id]
				}
			}
			break
			case 'ulartangga': case 'snakeladder': case 'ut': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (ulartangga[m.chat] && !(ulartangga[m.chat] instanceof SnakeLadder)) {
					ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
				}
				switch(args[0]) {
					case 'create': case 'join':
					if (ulartangga[m.chat]) {
						if (Object.keys(ulartangga[m.chat].players).length > 8) return m.reply(`Jumlah Pemain Sudah Maksimal\nSilahkan Memulai Permainan\n${prefix + command} start`);
						if (ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Sudah Bergabung!')
						ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
						m.reply('Sukses Join Sesi Game')
					} else {
						ulartangga[m.chat] = new SnakeLadder({ id: m.chat, host: m.sender });
						ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
						ulartangga[m.chat].time = Date.now();
						m.reply('Sukses Membuat Sesi Game')
					}
					break
					case 'start':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (ulartangga[m.chat].players.length < 2) return m.reply('Jumlah Pemain Kurang!\nMinimal 2 Pemain!')
					if (ulartangga[m.chat].start) return m.reply('Sesi Sudah dimulai Sejak Awal!')
					if (ulartangga[m.chat].host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Memulai Sessi!`)
					let { key } = await m.reply({ image: { url: ulartangga[m.chat].map.url }, caption: `🐍🪜GAME ULAR TANGGA\n\n${ulartangga[m.chat].players.map((p, i) => `- @${p.id.split('@')[0]} (Pion ${['Merah', 'Biru Muda', 'Kuning', 'Hijau', 'Ungu', 'Jingga', 'Biru Tua', 'Putih'][i]})`).join('\n')}\n\nGiliran: @${m.sender.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: roll/kocok`, mentions: ulartangga[m.chat].players.map(p => p.id)});
					ulartangga[m.chat].id = key.id
					ulartangga[m.chat].start = true
					break
					case 'leave':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (!ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Bukan Pemain!')
					const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender)
					if (ulartangga[m.chat].start) return m.reply('Game Sudah dimulai!\nTidak Bisa Keluar Sekarang')
					if (ulartangga[m.chat].players.length < 1 || ulartangga[m.chat].host === m.sender) {
						m.reply(ulartangga[m.chat].host === m.sender ? 'Host Meninggalkan Permainan\nPermainan dihentikan!' : 'Pemain Kurang Dari 1, Permainan dihentikan!');
						delete ulartangga[m.chat];
						break;
					}
					ulartangga[m.chat].players.splice(player, 1);
					m.reply('Sukses Meninggalkan Permainan');
					break
					case 'end':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (ulartangga[m.chat]?.host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Menghapus Sessi!`)
					delete ulartangga[m.chat]
					m.reply('Berhasil Menghapus Sesi Game')
					break
					default:
					m.reply(`🐍🪜GAME ULARTANGGA\nCommand: ${prefix + command} <command>\n- create\n- join\n- start\n- leave\n- end`)
				}
			}
			break
			case 'chess': case 'catur': case 'ct': {
				const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
				if (!m.isGroup) return m.reply(global.mess.group)
				if (chess[m.chat] && !(chess[m.chat] instanceof Chess)) {
					chess[m.chat] = Object.assign(new Chess(chess[m.chat].fen), chess[m.chat]);
				}
				switch(args[0]) {
					case 'start':
					if (!chess[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (!chess[m.chat].acc) return m.reply('Pemain Tidak Lengkap!')
					if (chess[m.chat].player1 !== m.sender) return m.reply('Hanya Pemain Utama Yang bisa Memulai!')
					if (chess[m.chat].turn !== m.sender && !chess[m.chat].start) {
						const encodedFen = encodeURI(chess[m.chat]._fen);
						let boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`,`https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`,`https://chessboardimage.com/${encodedFen}.png`,`https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}`,`https://fen2image.chessvision.ai/${encodedFen}`];
						for (let url of boardUrls) {
							try {
								const { data } = await axios.get(url, { responseType: 'arraybuffer' });
								let { key } = await m.reply({ image: data, caption: `♟️${command.toUpperCase()} GAME\n\nGiliran: @${m.sender.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`, mentions: [m.sender] });
								chess[m.chat].start = true
								chess[m.chat].turn = m.sender
								chess[m.chat].id = key.id;
								return;
							} catch (e) {}
						}
						if (!chess[m.chat].key) {
							m.reply(`Gagal Memulai Permainan!\nGagal Mengirim Papan Permainan!`)
						}
					} else if ([chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) {
						const isPlayer2 = chess[m.chat].player2 === m.sender
						const nextPlayer = isPlayer2 ? chess[m.chat].player1 : chess[m.chat].player2;
						const encodedFen = encodeURI(chess[m.chat]._fen);
						const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`,`https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside${!isPlayer2 ? '&flip=true' : ''}`,`https://chessboardimage.com/${encodedFen}${!isPlayer2 ? '-flip' : ''}.png`,`https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765${!isPlayer2 ? '&orientation=black' : ''}`,`https://fen2image.chessvision.ai/${encodedFen}/${!isPlayer2 ? '?pov=black' : ''}`];
						for (let url of boardUrls) {
							try {
								chess[m.chat].turn = chess[m.chat].turn === m.sender ? m.sender : nextPlayer;
								const { data } = await axios.get(url, { responseType: 'arraybuffer' });
								let { key } = await m.reply({ image: data, caption: `♟️CHESS GAME\n\nGiliran: @${chess[m.chat].turn.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`, mentions: [chess[m.chat].turn] });
								chess[m.chat].id = key.id;
								break;
							} catch (e) {}
						}
					}
					break
					case 'join':
					if (chess[m.chat]) {
						if (chess[m.chat].player1 !== m.sender) {
							if (chess[m.chat].acc) return m.reply(`Pemain Sudah Terisi\nSilahkan Coba Lagi Nanti`)
							let teks = chess[m.chat].player2 === m.sender ? 'TerimaKasih Sudah Mau Bergabung' : `Karena @${chess[m.chat].player2.split('@')[0]} Tidak Merespon\nAkan digantikan Oleh @${m.sender.split('@')[0]}`
							chess[m.chat].player2 = m.sender
							chess[m.chat].acc = true
							m.reply(`${teks}\nSilahkan @${chess[m.chat].player1.split('@')[0]} Untuk Memulai Game (${prefix + command} start)`)
						} else m.reply(`Kamu Sudah Bergabung\nBiarkan Orang Lain Menjadi Lawanmu!`)
					} else m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					break
					case 'end': case 'leave':
					if (chess[m.chat]) {
						if (![chess[m.chat].player1, chess[m.chat].player2].includes(m.sender)) return m.reply('Hanya Pemain yang Bisa Menghentikan Permainan!')
						delete chess[m.chat]
						m.reply('Sukses Menghapus Sesi Game')
					} else m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					break
					case 'bot': case 'computer':
					if (chess[m.sender]) {
						delete chess[m.sender];
						return m.reply('Sukses Menghapus Sesi vs BOT')
					} else {
						const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
						chess[m.sender] = new Chess(DEFAUT_POSITION);
						chess[m.sender]._fen = chess[m.sender].fen();
						chess[m.sender].turn = m.sender;
						chess[m.sender].botMode = true;
						chess[m.sender].time = Date.now();
						const encodedFen = encodeURI(chess[m.sender]._fen);
						const boardUrls = [`https://www.chess.com/dynboard?fen=${encodedFen}&size=3&coordinates=inside`,`https://www.chess.com/dynboard?fen=${encodedFen}&board=graffiti&piece=graffiti&size=3&coordinates=inside`,`https://chessboardimage.com/${encodedFen}.png`,`https://backscattering.de/web-boardimage/board.png?fen=${encodedFen}&coordinates=true&size=765`,`https://fen2image.chessvision.ai/${encodedFen}/`];
						for (let url of boardUrls) {
							try {
								const { data } = await axios.get(url, { responseType: 'arraybuffer' });
								let { key } = await m.reply({ image: data, caption: `♟️CHESS GAME\n\nGiliran: @${chess[m.sender].turn.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: from to -> b1 c3`, mentions: [chess[m.sender].turn] });
								chess[m.sender].id = key.id;
								break;
							} catch (e) {}
						}
					}
					break
					default:
					if (/^@?\d+$/.test(args[0])) {
						const { DEFAUT_POSITION } = await import('chess.js').then(m => m.Chess);
						if (chess[m.chat]) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
						if (m.mentionedJid.length < 1) return m.reply('Tag Orang yang Mau diajak Bermain!')
						chess[m.chat] = new Chess(DEFAUT_POSITION);
						chess[m.chat]._fen = chess[m.chat].fen();
						chess[m.chat].player1 = m.sender
						chess[m.chat].player2 = m.mentionedJid ? m.mentionedJid[0] : null
						chess[m.chat].time = Date.now();
						chess[m.chat].turn = null
						chess[m.chat].acc = false
						m.reply(`♟️${command.toUpperCase()} GAME\n\n@${m.sender.split('@')[0]} Menantang @${m.mentionedJid[0].split('@')[0]}\nUntuk Bergabung ${prefix + command} join`)
					} else {
						m.reply(`♟️${command.toUpperCase()} GAME\n\nExample: ${prefix + command} @tag/number\n- start\n- leave\n- join\n- computer\n- end`)
					}
				}
				
			}
			break
			
			case 'blackjack': case 'bj': {
				const normalizeCard = (str) => String(str).replace(/\uFE0F|\s/g, '').trim().toLowerCase();
				if (blackjack[m.chat] && !(blackjack[m.chat] instanceof Blackjack)) {
					blackjack[m.chat] = Object.assign(new Blackjack(blackjack[m.chat]), blackjack[m.chat]);
				}
				let session = null;
				for (const id in blackjack) {
					if (blackjack[id].players?.find(p => p.id === m.sender)) {
						session = blackjack[id];
						break;
					}
				}
				if (session && !(session instanceof Blackjack)) {
					session = Object.assign(new Blackjack(session), session);
					blackjack[session.id] = session;
				}
				const sendCardPrompt = async (playerId, headerText, sess) => {
					const p = sess.players.find(x => x.id === playerId);
					if (!p || !p.cards.length) return;
					const hasStart = Object.keys(sess.startCard).length > 0;
					const buttons = p.cards.map(c => ({
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: `${c.rank}${c.suit}`,
							id: `.${command} play ${c.rank}${c.suit}`
						})
					}));
					if (hasStart && !sess.hasMatching(playerId)) {
						buttons.push({
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🍺 Minum',
								id: `.${command} minum`
							})
						});
					}
					await naze.sendListMsg(playerId, { text: headerText, footer: `Kartumu (${p.cards.length}): ${p.cards.map(c => c.rank + c.suit).join(', ')}`, buttons }, { quoted: m });
				};

				const endGame = async (sess) => {
					const loser = sess.players[0];
					const winnerList = sess.winner.length ? sess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n') : '-';
					await naze.sendText(sess.id, `🃏 *GAME BLACKJACK SELESAI!* 🃏\n\n` + `🏆 *Urutan Pemenang:*\n${winnerList}\n\n` + `💀 *Pecundang:* @${loser?.id.split('@')[0] ?? '?'}`, m);
					delete blackjack[sess.id];
				};

				const finalizeRound = async (sess) => {
					if (!sess.isRoundComplete()) return false;
					const resultMsg = sess.resolveRound();
					if (!resultMsg) return false;
					await naze.sendText(sess.id, resultMsg, m);
					for (let i = sess.players.length - 1; i >= 0; i--) {
						const p = sess.players[i];
						if (p.cards.length === 0) {
							sess.winner.push({ id: p.id });
							sess.players.splice(i, 1);
							const rank = sess.winner.length;
							await naze.sendText(sess.id, `🎉 @${p.id.split('@')[0]} mengeluarkan semua kartu! Posisi ke-${rank}! 🏆`, m);
						}
					}
					if (sess.players.length <= 1) {
						await endGame(sess);
						return true;
					}
					if (!sess.players.find(p => p.id === sess.leader)) {
						sess.leader = sess.players[0].id;
					}
					await sleep(500);
					await sendCardPrompt(sess.leader, `🃏 Giliranmu memulai ronde baru!\nMainkan kartu pertama:`, sess);
					return true;
				};

				switch (args[0]) {
					case 'create': case 'join': {
						if (!m.isGroup) return m.reply(mess.group);
						if (blackjack[m.chat]?.players?.some(a => a.id === m.sender)) return m.reply('❌ Kamu sudah bergabung di sesi ini!');
						if (session) return m.reply('❌ Kamu sudah ada di sesi grup lain! Keluar dulu sebelum join di sini.');
						if (blackjack[m.chat]) {
							if (blackjack[m.chat].started) return m.reply('❌ Game sudah berjalan! Tunggu sesi berikutnya.');
							if (blackjack[m.chat].players.length >= 10) return m.reply(`❌ Pemain sudah penuh (maks 10).\nMulai dengan: ${prefix + command} start`);
							blackjack[m.chat].players.push({ id: m.sender, cards: [] });
							m.reply(`✅ *Berhasil join Game Blackjack!*\n` + `👥 Total pemain: ${blackjack[m.chat].players.length}\n` + `Tunggu host memulai: ${prefix + command} start`);
						} else {
							blackjack[m.chat] = new Blackjack({ id: m.chat, host: m.sender });
							blackjack[m.chat].players.push({ id: m.sender, cards: [] });
							m.reply(`✅ *Room Blackjack berhasil dibuat!*\n` + `Ajak teman: ${prefix + command} join\n` + `Mulai game: ${prefix + command} start`);
						}
					}
					break

					case 'start': {
						if (!m.isGroup) return m.reply(mess.group);
						if (!blackjack[m.chat]) return m.reply(`❌ Belum ada sesi. Buat dulu: ${prefix + command} create`);
						if (blackjack[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa memulai!`);
						if (blackjack[m.chat].players.length < 2) return m.reply('❌ Minimal 2 pemain!');
						if (blackjack[m.chat].started) return m.reply('❌ Game sudah dimulai!');
						blackjack[m.chat].distributeCards();
						const sess = blackjack[m.chat];
						await m.reply(
							`🃏 *GAME BLACKJACK DIMULAI!* ♦️\n\n` +
							`📌 Start Card: ${sess.startCard.rank}${sess.startCard.suit}\n` +
							`📦 Sisa Deck: ${sess.deck.length} kartu\n` +
							`🎯 Leader: @${sess.leader.split('@')[0]}\n\n` +
							`👥 *Pemain:*\n` +
							sess.players.map(p => `• @${p.id.split('@')[0]} (${p.cards.length} kartu)`).join('\n') +
							`\n\nCek private chat untuk kartumu! 👇\n` +
							`wa.me/${botNumber.split('@')[0]}`
						);

						for (const p of sess.players) {
							await sleep(400);
							const isLeader = p.id === sess.leader;
							await sendCardPrompt(p.id, isLeader ? `🃏 Game dimulai! Kamu adalah 🎯 Leader ronde pertama.\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} untuk memulai!` : `🃏 Game dimulai!\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} atau tekan Minum jika tidak ada.`, sess);
						}
					}
					break

					case 'minum': case 'hit': {
						if (!session) return m.reply('❌ Tidak ada sesi aktif!');
						if (!session.started) return m.reply('❌ Game belum dimulai!');
						if (!session.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						if (!Object.keys(session.startCard).length) return m.reply('⏳ Belum ada Start Card! Tunggu leader memulai ronde.');
						if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('❌ Kamu sudah bermain di ronde ini!');
						if (session.hasMatching(m.sender)) {
							return m.reply(`❌ Kamu masih punya kartu suit *${session.startCard.suit}*!\n` + `Mainkan dulu sebelum minum.`);
						}
						const player = session.players.find(p => p.id === m.sender);
						if (session.deck.length > 0) {
							const newCard = session.deck.shift();
							player.cards.push(newCard);
							await naze.sendText(session.id, `@${m.sender.split('@')[0]} minum 🍺 dan mengambil kartu dari deck! (sisa deck: ${session.deck.length})`, m);
						} else if (session.submitCard.length > 0) {
							const reuse = session.reuseSubmitCardsForDrinking();
							await naze.sendText(session.id, `⚠️ Deck habis! ${reuse.msg}`, m);
						} else {
							await naze.sendText(session.id, `⚠️ @${m.sender.split('@')[0]} minum tapi deck kosong — dilewati ronde ini.`, m);
						}
						if (!session.skip.includes(m.sender)) session.skip.push(m.sender);
						await sleep(400);
						await sendCardPrompt(m.sender, `🃏 Kartumu setelah minum:\nStart Card: ${session.startCard.rank}${session.startCard.suit}`, session);
						await finalizeRound(session);
					}
					break

					case 'play': {
						if (!session) return m.reply('❌ Tidak ada sesi aktif!');
						if (!session.started) return m.reply('❌ Game belum dimulai!');
						if (!session.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						if (!args[1]) return m.reply(`❌ Format: ${prefix + command} play <kartu>\nContoh: ${prefix + command} play 3♥️`);
						if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('❌ Kamu sudah bermain di ronde ini!');
						const player = session.players.find(p => p.id === m.sender);
						const idx = player.cards.findIndex(c => normalizeCard(c.rank + c.suit) === normalizeCard(args[1]));
						if (idx === -1) return m.reply('❌ Kartu tidak valid atau tidak ada di tanganmu!');
						const card = player.cards[idx];
						const hasStartCard = Object.keys(session.startCard).length > 0;
						if (hasStartCard) {
							if (card.suit !== session.startCard.suit) {
								if (session.hasMatching(m.sender)) {
									return m.reply(`❌ Harus memainkan kartu suit *${session.startCard.suit}*!`);
								}
								return m.reply(`❌ Kartu tidak sesuai suit *${session.startCard.suit}*!\n` + `Karena tidak punya kartu cocok, gunakan: ${prefix + command} minum`);
							}
						} else {
							if (m.sender !== session.leader) {
								return m.reply(`⏳ Tunggu dulu! Hanya 🎯 @${session.leader.split('@')[0]} (leader) yang bisa memulai ronde baru.`);
							}
						}
						player.cards.splice(idx, 1);
						session.secondDeck.push(card);
						session.submitCard.push({ id: m.sender, card });
						await m.reply(`✅ Kamu memainkan *${card.rank}${card.suit}*`);
						if (!hasStartCard) {
							session.startCard = card;
							await naze.sendText(session.id, `🎯 @${m.sender.split('@')[0]} memulai ronde dengan *${card.rank}${card.suit}*\n` + `Semua pemain harus memainkan kartu suit *${card.suit}*!`, m);
							for (const s of session.players) {
								if (s.id === session.leader) continue;
								await sleep(300);
								await sendCardPrompt(s.id, `🃏 Ronde baru dimulai!\nStart Card: *${card.rank}${card.suit}*\nMainkan kartu suit ${card.suit} atau tekan Minum.`, session);
							}
							await finalizeRound(session);
							return;
						}
						await naze.sendText(session.id, `@${m.sender.split('@')[0]} memainkan *${card.rank}${card.suit}* (sisa: ${player.cards.length} kartu)`, m);
						await finalizeRound(session);
					}
					break

					case 'info': {
						const infoSess = session || blackjack[m.chat];
						if (!infoSess) return m.reply('❌ Tidak ada sesi aktif!');
						if (!infoSess.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						const hasStart = Object.keys(infoSess.startCard).length > 0;
						const startStr = hasStart ? `${infoSess.startCard.rank}${infoSess.startCard.suit}` : '-';
						const playerList = infoSess.players.map((p, i) => {
							let tag = '';
							if (p.id === infoSess.host) tag += ' 👑HOST';
							if (p.id === infoSess.leader) tag += ' 🎯Leader';
							return `${i + 1}. @${p.id.split('@')[0]}${tag} — ${p.cards.length} kartu`;
						}).join('\n');

						let msg = 
							`🃏 *INFO GAME BLACKJACK* ♦️\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`👥 Pemain : ${infoSess.players.length}\n` +
							`👑 Host : @${infoSess.host.split('@')[0]}\n` +
							`🎯 Leader : ${infoSess.leader ? '@' + infoSess.leader.split('@')[0] : '-'}\n` +
							`📊 Status : ${infoSess.started ? '🟢 Berjalan' : '🔴 Belum Mulai'}\n` +
							`🃏 Start Card: ${startStr}\n` +
							`📦 Sisa Deck: ${infoSess.deck.length} kartu\n` +
							`┗━━━━━━━━━━━━━━━━━━\n` +
							`*Daftar Pemain:*\n${playerList}`;

						if (!m.isGroup) {
							const myCards = infoSess.players.find(p => p.id === m.sender)?.cards?.map(c => c.rank + c.suit).join(', ') || '-';
							msg += `\n┏━━━━━━━━━━━━━━━━━━\n*Kartu kamu:*\n${myCards}`;
						}
						if (infoSess.winner.length) {
							msg += `\n┏━━━━━━━━━━━━━━━━━━\n` + `*🏆 Sudah Menang:*\n` + infoSess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n');
						}
						m.reply(msg);
					}
					break

					case 'deck': {
						const deckSess = session || blackjack[m.chat];
						if (!deckSess) return m.reply('❌ Tidak ada sesi aktif!');
						if (!deckSess.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						const submittedNow = deckSess.submitCard.length ? deckSess.submitCard.map(s => `@${s.id.split('@')[0]}: ${s.card.rank}${s.card.suit}`).join(', ') : '-';
						const skipNow = deckSess.skip.length ? deckSess.skip.map(s => `@${s.split('@')[0]}`).join(', ') : '-';
						const lastCards = deckSess.secondDeck.slice(-10).map(c => c.rank + c.suit).join(', ') || '-';
						m.reply(
							`🃏 *INFO DECK* ♦️\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`📦 Sisa Deck : ${deckSess.deck.length} kartu\n` +
							`🔄 Kartu Terpakai: ${deckSess.secondDeck.length} kartu\n` +
							`┗━━━━━━━━━━━━━━━━━━\n` +
							`*Ronde Ini:*\n` +
							`▶️ Submit : ${submittedNow}\n` +
							`⏩ Skip : ${skipNow}\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`*10 Kartu Terakhir:*\n${lastCards}`
						);
					}
					break

					case 'end': {
						if (!m.isGroup) return m.reply(mess.group);
						if (!blackjack[m.chat]) return m.reply('❌ Tidak ada sesi aktif!');
						if (blackjack[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa menghapus sesi!`);
						delete blackjack[m.chat];
						m.reply('🗑️ Sesi Game Blackjack telah dihapus.');
					}
					break

					default: {
						m.reply(
							`🃏 *GAME BLACKJACK* ♦️\n\n` +
							`*Cara Main:*\n` +
							`Mainkan kartu dengan suit yang sama dengan Start Card.\n` +
							`Tidak punya? Tekan Minum 🍺 — ambil kartu penalti & skip ronde.\n` +
							`Pemain pertama yang habis kartunya menang!\n\n` +
							`*Commands:*\n` +
							`• \`${prefix + command} create\` — Buat room baru\n` +
							`• \`${prefix + command} join\` — Gabung room\n` +
							`• \`${prefix + command} start\` — Mulai game (host)\n` +
							`• \`${prefix + command} play\` _kartu_ — Main kartu (cth: play 3♥️)\n` +
							`• \`${prefix + command} minum\` — Minum & skip ronde\n` +
							`• \`${prefix + command} info\` — Info game & pemain\n` +
							`• \`${prefix + command} deck\` — Info deck & ronde ini\n` +
							`• \`${prefix + command} end\` — Hapus sesi (host)\n\n` +
							`*Suit:* ♥️ ♦️ ♣️ ♠️`
						);
					}
				}
			}
			break
			
			case 'uno': {
				if (!m.isGroup) return m.reply(global.mess.group);
				let room = uno[m.chat];
				
				switch (args[0]) {
					case 'join': {
						if (room) {
							if (room.state === 'PLAYING') return m.reply('❌ Game sedang berjalan! Tunggu sesi berikutnya.');
							let res = room.join(m.sender, m.pushName || 'Pemain UNO');
							if (res === 'ALREADY_JOINED') return m.reply('❌ Kamu sudah bergabung!');
							if (res === 'ROOM_FULL') return m.reply('❌ Room sudah penuh (maks 8 pemain)!');
							if (res === 'SUCCESS') {
								m.reply(`✅ *Berhasil bergabung ke Game UNO!*\n` +
									`👥 *Pemain saat ini (${room.players.length}/8):*\n` +
									room.players.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n') +
									`\n\nMulai game jika sudah cukup: *${prefix}uno start*`, { mentions: room.players.map(p => p.id) });
							}
						} else {
							// Create room and join
							room = uno[m.chat] = new UnoGame(m.chat);
							room.join(m.sender, m.pushName || 'Pemain UNO');
							m.reply(`✅ *Room UNO berhasil dibuat!*\n` +
								`👥 *Pemain saat ini (1/8):*\n1. @${m.sender.split('@')[0]}\n\n` +
								`Ketik *${prefix}uno join* untuk ikut bermain!`, { mentions: [m.sender] });
						}
					}
					break;
					
					case 'start': {
						if (!room) return m.reply(`❌ Belum ada room UNO di grup ini! Buat room terlebih dahulu dengan ketik *${prefix}uno join*`);
						if (room.state === 'PLAYING') return m.reply('❌ Game sudah dimulai!');
						if (room.players.length < 2) return m.reply('❌ Permainan membutuhkan minimal 2 pemain untuk dimulai!');
						
						let res = room.start();
						if (res === 'SUCCESS') {
							const topCard = room.discardPile[room.discardPile.length - 1];
							const topCardFormatted = UnoGame.formatCard(topCard);
							let activePlayer = room.getCurrentPlayer();
							
							let startMsg = `🎮 *GAME UNO DIMULAI!* 🎮\n\n` +
								`• *Kartu Awal di Meja:* ${topCardFormatted}\n` +
								`• *Warna Aktif:* ${room.currentColor.toUpperCase()}\n` +
								`• *Arah Putaran:* Kanan ➡️\n` +
								`• *Giliran Pertama:* @${activePlayer.id.split('@')[0]}\n\n` +
								`👥 *Urutan Pemain:*\n` +
								room.players.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n') +
								`\n\nSilakan klik tombol di bawah untuk melihat dan memainkan kartu Anda! 👇`;
								
							await m.reply(startMsg, { mentions: room.players.map(p => p.id) });
							
							// Send first card to group as sticker
							const stickerBuff = fs.readFileSync('./src/media/uno/' + UnoGame.getCardFileName(topCard));
							await naze.sendAsSticker(room.chat, stickerBuff, null, { packname: 'Ti Bot UNO', author: 'Farid Suryadi' });
							
							// Send first card menu to group chat for the active player
							await sendUnoCardMenu(naze, activePlayer.id, room);
						} else {
							m.reply(`❌ Gagal memulai game: ${res}`);
						}
					}
					break;
					
					case 'leave': {
						if (!room) return m.reply('❌ Tidak ada sesi game UNO aktif di grup ini.');
						let res = room.leave(m.sender);
						if (res === 'NOT_IN_ROOM') return m.reply('❌ Kamu tidak berada di room ini!');
						if (res === 'GAME_ENDED') {
							m.reply('👋 Sesi game dihentikan karena jumlah pemain kurang dari 2.');
							delete uno[m.chat];
						} else if (res === 'SUCCESS') {
							m.reply(`👋 @${m.sender.split('@')[0]} telah meninggalkan permainan UNO.`, { mentions: [m.sender] });
							if (room.state === 'PLAYING') {
								// Notify the next player in turn
								let nextPlayer = room.getCurrentPlayer();
								let groupMsg = `👉 Giliran selanjutnya: @${nextPlayer.id.split('@')[0]} (${nextPlayer.cards.length} kartu)`;
								await naze.sendText(room.chat, groupMsg, null, { mentions: [nextPlayer.id] });
								await sendUnoCardMenu(naze, nextPlayer.id, room);
							}
						}
					}
					break;
					
					case 'end': case 'delete': {
						if (!room) return m.reply('❌ Tidak ada room game UNO aktif di grup ini.');
						const isAdminOrOwner = m.isAdmin || isCreator || room.players[0]?.id === m.sender;
						if (!isAdminOrOwner) return m.reply('❌ Hanya admin grup, owner bot, atau pembuat room yang dapat menghapus sesi game!');
						delete uno[m.chat];
						m.reply('🗑️ Sesi game UNO di grup ini telah berhasil dihapus.');
					}
					break;
					
					case 'help': {
						const helpMsg = `🃏 *PANDUAN BERMAIN UNO BOT* 🃏\n\n` +
							`*Cara Bermain:*\n` +
							`1. Buat room baru atau masuk ke room dengan mengetik *${prefix}uno join* atau *${prefix}uno*.\n` +
							`2. Setelah minimal 2 pemain bergabung, host dapat mengetik *${prefix}uno start* untuk memulai permainan.\n` +
							`3. Setiap pemain akan dibagikan 7 kartu secara acak. Kartu awal di meja akan dikirim berupa stiker.\n` +
							`4. Saat giliranmu, tekan tombol *Buka Kartu Anda 🃏* untuk melihat kartu di tangan secara privat.\n` +
							`5. Pilih kartu yang ingin dimainkan. Kartu yang dipilih harus memiliki *warna yang sama* atau *angka/simbol yang sama* dengan kartu teratas di meja.\n` +
							`6. Jika tidak memiliki kartu yang cocok, tekan opsi *Ambil Kartu 🃏* untuk mengambil 1 kartu baru dari dek dan melempar giliran ke pemain berikutnya.\n` +
							`7. Pemain pertama yang kartu di tangannya habis dinyatakan sebagai pemenang! 🏆\n\n` +
							`*Aturan Kartu Efek/Spesial:*\n` +
							`• *Skip 🚫* : Melompati giliran pemain berikutnya.\n` +
							`• *Reverse 🔁* : Mengubah arah putaran permainan.\n` +
							`• *Draw 2 ➕2* : Pemain berikutnya wajib mengambil 2 kartu dari dek dan gilirannya dilewati.\n` +
							`• *Wild Card 🌈* : Mengubah warna aktif di meja secara bebas.\n` +
							`• *Wild Draw 4 🌈➕4* : Mengubah warna aktif di meja, memaksa pemain berikutnya mengambil 4 kartu dari dek, dan melompati gilirannya.`;
						m.reply(helpMsg);
					}
					break;
					
					default: {
						// Fallback: If no sub-command, join the room (convenience)
						if (!room || room.state === 'WAITING') {
							if (room) {
								let res = room.join(m.sender, m.pushName || 'Pemain UNO');
								if (res === 'ALREADY_JOINED') return m.reply('❌ Kamu sudah bergabung!');
								if (res === 'ROOM_FULL') return m.reply('❌ Room sudah penuh (maks 8 pemain)!');
								if (res === 'SUCCESS') {
									m.reply(`✅ *Berhasil bergabung ke Game UNO!*\n` +
										`👥 *Pemain saat ini (${room.players.length}/8):*\n` +
										room.players.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n') +
										`\n\nMulai game jika sudah cukup: *${prefix}uno start*`, { mentions: room.players.map(p => p.id) });
								}
							} else {
								room = uno[m.chat] = new UnoGame(m.chat);
								room.join(m.sender, m.pushName || 'Pemain UNO');
								m.reply(`✅ *Room UNO berhasil dibuat!*\n` +
									`👥 *Pemain saat ini (1/8):*\n1. @${m.sender.split('@')[0]}\n\n` +
									`Ketik *${prefix}uno join* untuk ikut bermain!`, { mentions: [m.sender] });
							}
						} else {
							m.reply(`🃏 *GAME UNO BOT* 🃏\n\n` +
								`*Commands:*\n` +
								`• \`${prefix}uno\` / \`${prefix}uno join\` — Gabung/Buat room baru\n` +
								`• \`${prefix}uno start\` — Mulai permainan (minimal 2 pemain)\n` +
								`• \`${prefix}uno leave\` — Keluar dari room/permainan\n` +
								`• \`${prefix}uno end\` — Hentikan sesi permainan\n` +
								`• \`${prefix}uno help\` — Panduan bermain & aturan game`);
						}
					}
				}
			}
			break;
			
			// Menu
			case 'menu': {
				if (args[0] == 'set') {
					if (!isCreator) return m.reply(mess.owner)
					if (['1','2','3'].includes(args[1])) {
						set.template = parseInt(Number(args[1]))
						m.reply('Sukses Mengubah Template Menu')
					} else m.reply(`Template Menu:\n- 1 (Button Menu)\n- 2 (List Menu)\n- 3 (Document Menu)\n\nExample: ${prefix + command} set 1`)
				} else await templateMenu(naze, set.template, m, prefix, setv, db, { locale_day, date, date_time, botNumber, author, packname, isVip, isPremium, ucapanWaktu, isCreator })
			}
			break
			case 'allmenu': {
				let profile = './src/media/logo.jpg'
				let menunya = `
╭──❍「 *USER INFO* 」❍
├ *Nama* : ${m.pushName ? m.pushName : 'Tanpa Nama'}
├ *Id* : @${m.sender.split('@')[0]}
├ *User* : ${isVip ? 'VIP' : isPremium ? 'PREMIUM' : 'FREE'}
├ *Limit* : ${isVip ? 'VIP' : db.users[m.sender].limit }
├ *Money* : ${db.users[m.sender] ? db.users[m.sender].money.toLocaleString('id-ID') : '0'}
╰─┬────❍
╭─┴─❍「 *BOT INFO* 」❍
├ *Nama Bot* : ${set?.botname || 'Ti Assistant Bot'}
├ *Powered* : @${'0@s.whatsapp.net'.split('@')[0]}
├ *Owner* : @${ownerNumber[0].split('@')[0]}
├ *Mode* : ${naze.public ? 'Public' : 'Self'}
├ *Prefix* :${set.multiprefix ? '「 MULTI-PREFIX 」' : ' *'+prefix+'*' }
├ *Premium Feature* : 🔸️
╰─┬────❍
╭─┴─❍「 *ABOUT* 」❍
├ *Date* : ${date}
├ *Day* : ${locale_day}
├ *Time* : ${date_time}
╰──────❍
╭──❍「 *BOT* 」❍
│${setv} ${prefix}profile
│${setv} ${prefix}claim
│${setv} ${prefix}buy [item] (nominal)
│${setv} ${prefix}transfer
│${setv} ${prefix}leaderboard
│${setv} ${prefix}request (text)
│${setv} ${prefix}react (emoji)
│${setv} ${prefix}tagme
│${setv} ${prefix}runtime
│${setv} ${prefix}totalfitur
│${setv} ${prefix}speed
│${setv} ${prefix}ping
│${setv} ${prefix}afk
│${setv} ${prefix}rvo (reply pesan viewone)
│${setv} ${prefix}inspect (url gc)
│${setv} ${prefix}addmsg
│${setv} ${prefix}delmsg
│${setv} ${prefix}getmsg
│${setv} ${prefix}listmsg
│${setv} ${prefix}setcmd
│${setv} ${prefix}delcmd
│${setv} ${prefix}listcmd
│${setv} ${prefix}lockcmd
│${setv} ${prefix}q (reply pesan)
│${setv} ${prefix}menfes (62xxx|fake name)
│${setv} ${prefix}confes (62xxx|fake name)
│${setv} ${prefix}roomai
│${setv} ${prefix}donasi
${(isCreator && !m.isGroup) ? `│${setv} ${prefix}jadibot 🔸️\n│${setv} ${prefix}stopjadibot\n│${setv} ${prefix}listjadibot\n│${setv} ${prefix}addsewa\n│${setv} ${prefix}delsewa\n│${setv} ${prefix}listsewa\n` : ''}╰─┬────❍
╭─┴❍「 *KAMPUS* 」❍
│${setv} ${prefix}topdf
│${setv} ${prefix}buatabsen (judul)
│${setv} ${prefix}absen (nama)
│${setv} ${prefix}tutupabsen
╰─┬────❍
╭─┴❍「 *GROUP* 」❍
│${setv} ${prefix}add (62xxx)
│${setv} ${prefix}kick (@tag/62xxx)
│${setv} ${prefix}promote (@tag/62xxx)
│${setv} ${prefix}demote (@tag/62xxx)
│${setv} ${prefix}warn (@tag/62xxx)
│${setv} ${prefix}unwarn (@tag/62xxx)
│${setv} ${prefix}setname (nama baru gc)
│${setv} ${prefix}setdesc (desk)
│${setv} ${prefix}setppgc (reply imgnya)
│${setv} ${prefix}delete (reply pesan)
│${setv} ${prefix}linkgrup
│${setv} ${prefix}revoke
│${setv} ${prefix}tagall
│${setv} ${prefix}pin
│${setv} ${prefix}unpin
│${setv} ${prefix}hidetag
│${setv} ${prefix}totag (reply pesan)
│${setv} ${prefix}listonline
│${setv} ${prefix}group set
│${setv} ${prefix}group (khusus admin)
╰─┬────❍
╭─┴❍「 *SEARCH* 」❍
│${setv} ${prefix}ytsearch (query)
│${setv} ${prefix}spotify (query)
│${setv} ${prefix}pixiv (query)
│${setv} ${prefix}pinterest (query)
│${setv} ${prefix}wallpaper (query)
│${setv} ${prefix}ringtone (query)
│${setv} ${prefix}google (query)
│${setv} ${prefix}gimage (query)
│${setv} ${prefix}npm (query)
│${setv} ${prefix}style (query)
│${setv} ${prefix}cuaca (kota)
│${setv} ${prefix}tenor (query)
│${setv} ${prefix}urban (query)
╰─┬────❍
╭─┴❍「 *DOWNLOAD* 」❍
│${setv} ${prefix}ytmp3 (url)
│${setv} ${prefix}ytmp4 (url)
│${setv} ${prefix}instagram (url)
│${setv} ${prefix}tiktok (url)
│${setv} ${prefix}tiktokmp3 (url)
│${setv} ${prefix}facebook (url)
│${setv} ${prefix}spotifydl (url)
│${setv} ${prefix}mediafire (url)
╰─┬────❍
╭─┴❍「 *QUOTES* 」❍
│${setv} ${prefix}motivasi
│${setv} ${prefix}quotes
│${setv} ${prefix}truth
│${setv} ${prefix}bijak
│${setv} ${prefix}dare
│${setv} ${prefix}bucin
│${setv} ${prefix}renungan
╰─┬────❍
╭─┴❍「 *TOOLS* 」❍
│${setv} ${prefix}get (url) 🔸️
│${setv} ${prefix}hd (reply pesan)
│${setv} ${prefix}toaudio (reply pesan)
│${setv} ${prefix}tomp3 (reply pesan)
│${setv} ${prefix}tovn (reply pesan)
│${setv} ${prefix}toimage (reply pesan)
│${setv} ${prefix}toptv (reply pesan)
│${setv} ${prefix}tourl (reply pesan)
│${setv} ${prefix}tts (textnya)
│${setv} ${prefix}toqr (textnya)
│${setv} ${prefix}brat (textnya)
│${setv} ${prefix}bratvid (textnya)
│${setv} ${prefix}ssweb (url) 🔸️
│${setv} ${prefix}sticker (send/reply img)
│${setv} ${prefix}colong (reply stiker)
│${setv} ${prefix}smeme (send/reply img)
│${setv} ${prefix}dehaze (send/reply img)
│${setv} ${prefix}colorize (send/reply img)
│${setv} ${prefix}hitamkan (send/reply img)
│${setv} ${prefix}emojimix 🙃+💀
│${setv} ${prefix}nulis
│${setv} ${prefix}readmore text1|text2
│${setv} ${prefix}qc (pesannya)
│${setv} ${prefix}translate
│${setv} ${prefix}wasted (send/reply img)
│${setv} ${prefix}triggered (send/reply img)
│${setv} ${prefix}shorturl (urlnya)
│${setv} ${prefix}gitclone (urlnya)
│${setv} ${prefix}fat (reply audio)
│${setv} ${prefix}fast (reply audio)
│${setv} ${prefix}bass (reply audio)
│${setv} ${prefix}slow (reply audio)
│${setv} ${prefix}tupai (reply audio)
│${setv} ${prefix}deep (reply audio)
│${setv} ${prefix}robot (reply audio)
│${setv} ${prefix}blown (reply audio)
│${setv} ${prefix}reverse (reply audio)
│${setv} ${prefix}smooth (reply audio)
│${setv} ${prefix}earrape (reply audio)
│${setv} ${prefix}nightcore (reply audio)
│${setv} ${prefix}getexif (reply sticker)
╰─┬────❍
╭─┴❍「 *AI* 」❍
│${setv} ${prefix}ai (query)
│${setv} ${prefix}gemini (query)
│${setv} ${prefix}glm (query)
│${setv} ${prefix}grok (query)
│${setv} ${prefix}claude (query)
│${setv} ${prefix}archipelago (query)
│${setv} ${prefix}deepseek (query)
│${setv} ${prefix}txt2img (query)
╰─┬────❍
╭─┴❍「 *ANIME* 」❍
│${setv} ${prefix}waifu
│${setv} ${prefix}neko
╰─┬────❍
╭─┴❍「 *GAME* 」❍
│${setv} ${prefix}tictactoe
│${setv} ${prefix}suit
│${setv} ${prefix}slot
│${setv} ${prefix}math (level)
│${setv} ${prefix}begal
│${setv} ${prefix}ulartangga
│${setv} ${prefix}blackjack
│${setv} ${prefix}catur
│${setv} ${prefix}uno
│${setv} ${prefix}casino (nominal)
│${setv} ${prefix}samgong (nominal)
│${setv} ${prefix}rampok (@tag)
│${setv} ${prefix}tekateki
│${setv} ${prefix}tebaklirik
│${setv} ${prefix}tebakkata
│${setv} ${prefix}tebakbom
│${setv} ${prefix}susunkata
│${setv} ${prefix}colorblind
│${setv} ${prefix}tebakkimia
│${setv} ${prefix}caklontong
│${setv} ${prefix}tebakangka
│${setv} ${prefix}tebaknegara
│${setv} ${prefix}tebakgambar
│${setv} ${prefix}tebakbendera
╰─┬────❍
╭─┴❍「 *FUN* 」❍
│${setv} ${prefix}coba
│${setv} ${prefix}dadu
│${setv} ${prefix}bisakah (text)
│${setv} ${prefix}apakah (text)
│${setv} ${prefix}kapan (text)
│${setv} ${prefix}siapa (text)
│${setv} ${prefix}kerangajaib (text)
│${setv} ${prefix}cekmati (nama lu)
│${setv} ${prefix}ceksifat
│${setv} ${prefix}cekkhodam (nama lu)
│${setv} ${prefix}rate (reply pesan)
│${setv} ${prefix}jodohku
│${setv} ${prefix}jadian
│${setv} ${prefix}fitnah
│${setv} ${prefix}halah (text)
│${setv} ${prefix}hilih (text)
│${setv} ${prefix}huluh (text)
│${setv} ${prefix}heleh (text)
│${setv} ${prefix}holoh (text)
╰─┬────❍
╭─┴❍「 *RANDOM* 」❍
│${setv} ${prefix}coffe
╰─┬────❍
╭─┴❍「 *STALKER* 」❍
│${setv} ${prefix}wastalk
│${setv} ${prefix}githubstalk`
				
				if (isCreator && !m.isGroup) {
					menunya += `\n╰─┬────❍\n╭─┴❍「 *OWNER* 」❍\n` +
`│${setv} ${prefix}bot [set]
│${setv} ${prefix}setbio
│${setv} ${prefix}setppbot
│${setv} ${prefix}join
│${setv} ${prefix}leave
│${setv} ${prefix}block
│${setv} ${prefix}listblock
│${setv} ${prefix}openblock
│${setv} ${prefix}listpc
│${setv} ${prefix}listgc
│${setv} ${prefix}ban
│${setv} ${prefix}unban
│${setv} ${prefix}mute
│${setv} ${prefix}unmute
│${setv} ${prefix}creategc
│${setv} ${prefix}clearchat
│${setv} ${prefix}addprem
│${setv} ${prefix}delprem
│${setv} ${prefix}listprem
│${setv} ${prefix}addlimit
│${setv} ${prefix}adduang
│${setv} ${prefix}setbotmessages
│${setv} ${prefix}setbotauthor
│${setv} ${prefix}setbotname
│${setv} ${prefix}setbotpackname
│${setv} ${prefix}setapikey
│${setv} ${prefix}setbotlimit
│${setv} ${prefix}setbotmoney
│${setv} ${prefix}setlocale
│${setv} ${prefix}settimezone
│${setv} ${prefix}addprefix
│${setv} ${prefix}delprefix
│${setv} ${prefix}addbadword
│${setv} ${prefix}delbadword
│${setv} ${prefix}addowner
│${setv} ${prefix}delowner
│${setv} ${prefix}whitelist
│${setv} ${prefix}getmsgstore
│${setv} ${prefix}bot --settings
│${setv} ${prefix}bot settings
│${setv} ${prefix}getsession
│${setv} ${prefix}delsession
│${setv} ${prefix}delsampah
│${setv} ${prefix}upsw
│${setv} ${prefix}backup
│${setv} $
│${setv} >
│${setv} <
╰──────❍`
				} else {
					menunya += `\n╰──────❍`
				}
				await naze.sendMessageV3(m.chat, {
					text: menunya,
					title: ucapanWaktu,
					description: packname,
					thumbnailUrl: profile,
					sourceUrl: my.gh,
					mentions: [m.sender, '0@s.whatsapp.net', ownerNumber[0] + '@s.whatsapp.net'],
					contextInfo: {
						forwardingScore: 1,
						isForwarded: true,
						forwardedNewsletterMessageInfo: {
							newsletterJid: my.ch,
							serverMessageId: null,
							newsletterName: 'Join For More Info'
						}
					}
				})
			}
			break
			case 'botmenu': {
				let teksbot = `
╭──❍「 *BOT* 」❍
│${setv} ${prefix}profile
│${setv} ${prefix}claim
│${setv} ${prefix}buy [item] (nominal)
│${setv} ${prefix}transfer
│${setv} ${prefix}leaderboard
│${setv} ${prefix}request (text)
│${setv} ${prefix}react (emoji)
│${setv} ${prefix}tagme
│${setv} ${prefix}runtime
│${setv} ${prefix}totalfitur
│${setv} ${prefix}speed
│${setv} ${prefix}ping
│${setv} ${prefix}afk
│${setv} ${prefix}rvo (reply pesan viewone)
│${setv} ${prefix}inspect (url gc)
│${setv} ${prefix}addmsg
│${setv} ${prefix}delmsg
│${setv} ${prefix}getmsg
│${setv} ${prefix}listmsg
│${setv} ${prefix}setcmd
│${setv} ${prefix}delcmd
│${setv} ${prefix}listcmd
│${setv} ${prefix}lockcmd
│${setv} ${prefix}q (reply pesan)
│${setv} ${prefix}menfes (62xxx|fake name)
│${setv} ${prefix}confes (62xxx|fake name)
│${setv} ${prefix}roomai
│${setv} ${prefix}donasi`;

				if (isCreator && !m.isGroup) {
					teksbot += `\n│${setv} ${prefix}jadibot 🔸️\n│${setv} ${prefix}stopjadibot\n│${setv} ${prefix}listjadibot\n│${setv} ${prefix}addsewa\n│${setv} ${prefix}delsewa\n│${setv} ${prefix}listsewa\n╰──────❍`;
				} else {
					teksbot += `\n╰──────❍`;
				}
				m.reply(teksbot.trim())
			}
			break
			case 'kampusmenu': {
				m.reply(`
╭──❍「 *KAMPUS* 」❍
│${setv} ${prefix}topdf
│${setv} ${prefix}buatabsen (judul)
│${setv} ${prefix}absen (nama)
│${setv} ${prefix}tutupabsen
╰──────❍`)
			}
			break
			case 'topdf': {
				if (m.isGroup) {
					const botNumber = naze.decodeJid(naze.user.id).split('@')[0];
					const linkText = `Untuk merubah foto menjadi file PDF secara personal, silakan tekan link chat pribadi bot berikut:\n👉 https://wa.me/${botNumber}?text=.topdf`;
					return m.reply(linkText);
				}
				
				global.db.toPdf = global.db.toPdf || {};
				global.db.toPdf[m.sender] = {
					images: [],
					step: 'collecting_images'
				};
				
				const welcomeMsg = `*───「 TO PDF CONVERTER 」───*\n\n` +
					`Halo! Selamat datang di konverter gambar ke PDF berkualitas tinggi (CamScanner Style).\n\n` +
					`*Cara Penggunaan*:\n` +
					`1. Kirimkan satu atau beberapa foto/gambar secara bergantian.\n` +
					`2. Bot akan secara otomatis merotasi, menyelaraskan, dan meningkatkan kualitas foto menyerupai hasil scanner dokumen.\n` +
					`3. Setelah semua foto terkirim, klik tombol **Sudah** di bawah untuk memasukkan nama PDF.\n` +
					`4. Klik **Batalkan** kapan saja jika ingin membatalkan.`;
				
				await naze.sendButtonMsg(m.chat, {
					text: welcomeMsg,
					footer: 'Ti Assistant Bot Campus Tools',
					buttons: [
						{ buttonId: '.pdfdone', buttonText: { displayText: 'Sudah ✅' }, type: 1 },
						{ buttonId: '.pdfcancel', buttonText: { displayText: 'Batalkan ❌' }, type: 1 }
					]
				}, { quoted: m });
			}
			break
			case 'pdfdone': {
				if (m.isGroup) return m.reply(global.mess.private);
				global.db.toPdf = global.db.toPdf || {};
				let pending = global.db.toPdf[m.sender];
				if (!pending || pending.images.length === 0) {
					return m.reply('Anda belum mengirimkan foto apa pun! Harap kirimkan minimal 1 foto terlebih dahulu.');
				}
				pending.step = 'waiting_pdf_name';
				m.reply('Semua foto berhasil dikumpulkan!\n\nSilakan ketik/masukkan **Nama untuk file PDF** Anda sekarang (tanpa ekstensi .pdf).\nContoh: *tugas_praktek*');
			}
			break
			case 'pdfcancel': {
				if (m.isGroup) return m.reply(global.mess.private);
				global.db.toPdf = global.db.toPdf || {};
				if (global.db.toPdf[m.sender]) {
					delete global.db.toPdf[m.sender];
					m.reply('Proses konversi foto ke PDF berhasil dibatalkan.');
				} else {
					m.reply('Tidak ada proses konversi PDF yang sedang berjalan.');
				}
			}
			break
			case 'groupmenu': {
				m.reply(`
╭──❍「 *GROUP* 」❍
│${setv} ${prefix}add (62xxx)
│${setv} ${prefix}kick (@tag/62xxx)
│${setv} ${prefix}promote (@tag/62xxx)
│${setv} ${prefix}demote (@tag/62xxx)
│${setv} ${prefix}warn (@tag/62xxx)
│${setv} ${prefix}unwarn (@tag/62xxx)
│${setv} ${prefix}setname (nama baru gc)
│${setv} ${prefix}setdesc (desk)
│${setv} ${prefix}setppgc (reply imgnya)
│${setv} ${prefix}delete (reply pesan)
│${setv} ${prefix}linkgrup
│${setv} ${prefix}revoke
│${setv} ${prefix}tagall
│${setv} ${prefix}pin
│${setv} ${prefix}unpin
│${setv} ${prefix}hidetag
│${setv} ${prefix}totag (reply pesan)
│${setv} ${prefix}listonline
│${setv} ${prefix}group set
│${setv} ${prefix}group (khusus admin)
╰──────❍`)
			}
			break
			case 'searchmenu': {
				m.reply(`
╭──❍「 *SEARCH* 」❍
│${setv} ${prefix}ytsearch (query)
│${setv} ${prefix}spotify (query)
│${setv} ${prefix}pixiv (query)
│${setv} ${prefix}pinterest (query)
│${setv} ${prefix}wallpaper (query)
│${setv} ${prefix}ringtone (query)
│${setv} ${prefix}google (query)
│${setv} ${prefix}gimage (query)
│${setv} ${prefix}npm (query)
│${setv} ${prefix}style (query)
│${setv} ${prefix}cuaca (kota)
│${setv} ${prefix}tenor (query)
│${setv} ${prefix}urban (query)
╰──────❍`)
			}
			break
			case 'downloadmenu': {
				m.reply(`
╭──❍「 *DOWNLOAD* 」❍
│${setv} ${prefix}ytmp3 (url)
│${setv} ${prefix}ytmp4 (url)
│${setv} ${prefix}instagram (url)
│${setv} ${prefix}tiktok (url)
│${setv} ${prefix}tiktokmp3 (url)
│${setv} ${prefix}facebook (url)
│${setv} ${prefix}spotifydl (url)
│${setv} ${prefix}mediafire (url)
╰──────❍`)
			}
			break
			case 'quotesmenu': {
				m.reply(`
╭──❍「 *QUOTES* 」❍
│${setv} ${prefix}motivasi
│${setv} ${prefix}quotes
│${setv} ${prefix}truth
│${setv} ${prefix}bijak
│${setv} ${prefix}dare
│${setv} ${prefix}bucin
│${setv} ${prefix}renungan
╰──────❍`)
			}
			break
			case 'toolsmenu': {
				m.reply(`
╭──❍「 *TOOLS* 」❍
│${setv} ${prefix}get (url) 🔸️
│${setv} ${prefix}hd (reply pesan)
│${setv} ${prefix}toaudio (reply pesan)
│${setv} ${prefix}tomp3 (reply pesan)
│${setv} ${prefix}tovn (reply pesan)
│${setv} ${prefix}toimage (reply pesan)
│${setv} ${prefix}toptv (reply pesan)
│${setv} ${prefix}tourl (reply pesan)
│${setv} ${prefix}tts (textnya)
│${setv} ${prefix}toqr (textnya)
│${setv} ${prefix}brat (textnya)
│${setv} ${prefix}bratvid (textnya)
│${setv} ${prefix}ssweb (url) 🔸️
│${setv} ${prefix}sticker (send/reply img)
│${setv} ${prefix}colong (reply stiker)
│${setv} ${prefix}smeme (send/reply img)
│${setv} ${prefix}dehaze (send/reply img)
│${setv} ${prefix}colorize (send/reply img)
│${setv} ${prefix}hitamkan (send/reply img)
│${setv} ${prefix}emojimix 😂+💀
│${setv} ${prefix}nulis
│${setv} ${prefix}readmore text1|text2
│${setv} ${prefix}qc (pesannya)
│${setv} ${prefix}translate
│${setv} ${prefix}wasted (send/reply img)
│${setv} ${prefix}triggered (send/reply img)
│${setv} ${prefix}shorturl (urlnya)
│${setv} ${prefix}gitclone (urlnya)
│${setv} ${prefix}fat (reply audio)
│${setv} ${prefix}fast (reply audio)
│${setv} ${prefix}bass (reply audio)
│${setv} ${prefix}slow (reply audio)
│${setv} ${prefix}tupai (reply audio)
│${setv} ${prefix}deep (reply audio)
│${setv} ${prefix}robot (reply audio)
│${setv} ${prefix}blown (reply audio)
│${setv} ${prefix}reverse (reply audio)
│${setv} ${prefix}smooth (reply audio)
│${setv} ${prefix}earrape (reply audio)
│${setv} ${prefix}nightcore (reply audio)
│${setv} ${prefix}getexif (reply sticker)
╰──────❍`)
			}
			break
			case 'aimenu': {
				m.reply(`
╭──❍「 *AI* 」❍
│${setv} ${prefix}ai (query)
│${setv} ${prefix}gemini (query)
│${setv} ${prefix}glm (query)
│${setv} ${prefix}grok (query)
│${setv} ${prefix}claude (query)
│${setv} ${prefix}archipelago (query)
│${setv} ${prefix}deepseek (query)
│${setv} ${prefix}txt2img (query)
╰──────❍`)
			}
			break
			case 'randommenu': {
				m.reply(`
╭──❍「 *RANDOM* 」❍
│${setv} ${prefix}coffe
╰──────❍`)
			}
			break
			case 'stalkermenu': {
				m.reply(`
╭──❍「 *STALKER* 」❍
│${setv} ${prefix}wastalk
│${setv} ${prefix}githubstalk
╰──────❍`)
			}
			break
			case 'animemenu': {
				m.reply(`
╭──❍「 *ANIME* 」❍
│${setv} ${prefix}waifu
│${setv} ${prefix}neko
╰──────❍`)
			}
			break
			case 'gamemenu': {
				m.reply(`
╭──❍「 *GAME* 」❍
│${setv} ${prefix}tictactoe
│${setv} ${prefix}suit
│${setv} ${prefix}slot
│${setv} ${prefix}math (level)
│${setv} ${prefix}begal
│${setv} ${prefix}ulartangga
│${setv} ${prefix}blackjack
│${setv} ${prefix}catur
│${setv} ${prefix}uno
│${setv} ${prefix}casino (nominal)
│${setv} ${prefix}samgong (nominal)
│${setv} ${prefix}rampok (@tag)
│${setv} ${prefix}tekateki
│${setv} ${prefix}tebaklirik
│${setv} ${prefix}tebakkata
│${setv} ${prefix}tebakbom
│${setv} ${prefix}susunkata
│${setv} ${prefix}colorblind
│${setv} ${prefix}tebakkimia
│${setv} ${prefix}caklontong
│${setv} ${prefix}tebakangka
│${setv} ${prefix}tebaknegara
│${setv} ${prefix}tebakgambar
│${setv} ${prefix}tebakbendera
╰──────❍`)
			}
			break
			case 'funmenu': {
				m.reply(`
╭──❍「 *FUN* 」❍
│${setv} ${prefix}coba
│${setv} ${prefix}dadu
│${setv} ${prefix}bisakah (text)
│${setv} ${prefix}apakah (text)
│${setv} ${prefix}kapan (text)
│${setv} ${prefix}siapa (text)
│${setv} ${prefix}kerangajaib (text)
│${setv} ${prefix}cekmati (nama lu)
│${setv} ${prefix}ceksifat
│${setv} ${prefix}cekkhodam (nama lu)
│${setv} ${prefix}rate (reply pesan)
│${setv} ${prefix}jodohku
│${setv} ${prefix}jadian
│${setv} ${prefix}fitnah
│${setv} ${prefix}halah (text)
│${setv} ${prefix}hilih (text)
│${setv} ${prefix}huluh (text)
│${setv} ${prefix}heleh (text)
│${setv} ${prefix}holoh (text)
╰──────❍`)
			}
			break
			case 'ownermenu': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (m.isGroup) return m.reply('Menu ini hanya dapat diakses melalui Private Chat!')
				m.reply(`
╭──❍「 *OWNER* 」❍
│${setv} ${prefix}bot [set]
│${setv} ${prefix}setbio
│${setv} ${prefix}setppbot
│${setv} ${prefix}join
│${setv} ${prefix}leave
│${setv} ${prefix}block
│${setv} ${prefix}listblock
│${setv} ${prefix}openblock
│${setv} ${prefix}listpc
│${setv} ${prefix}listgc
│${setv} ${prefix}ban
│${setv} ${prefix}unban
│${setv} ${prefix}mute
│${setv} ${prefix}unmute
│${setv} ${prefix}creategc
│${setv} ${prefix}clearchat
│${setv} ${prefix}bcgc [pesan/reply]
│${setv} ${prefix}bcuser [pesan/reply]
│${setv} ${prefix}remindersolatall [on/off]
│${setv} ${prefix}addprem
│${setv} ${prefix}delprem
│${setv} ${prefix}listprem
│${setv} ${prefix}addlimit
│${setv} ${prefix}adduang
│${setv} ${prefix}setbotmessages
│${setv} ${prefix}setbotauthor
│${setv} ${prefix}setbotname
│${setv} ${prefix}setbotpackname
│${setv} ${prefix}setapikey
│${setv} ${prefix}setbotlimit
│${setv} ${prefix}setbotmoney
│${setv} ${prefix}setlocale
│${setv} ${prefix}settimezone
│${setv} ${prefix}addprefix
│${setv} ${prefix}delprefix
│${setv} ${prefix}addbadword
│${setv} ${prefix}delbadword
│${setv} ${prefix}addowner
│${setv} ${prefix}delowner
│${setv} ${prefix}whitelist
│${setv} ${prefix}getmsgstore
│${setv} ${prefix}bot --settings
│${setv} ${prefix}bot settings
│${setv} ${prefix}getsession
│${setv} ${prefix}delsession
│${setv} ${prefix}delsampah
│${setv} ${prefix}upsw
│${setv} ${prefix}backup
│${setv} $
│${setv} >
│${setv} <
╰──────❍`)
			}
			break

			default:
			if (budy.startsWith('>')) {
				if (!isCreator) return
				try {
					let evaled = await eval(budy.slice(2))
					if (typeof evaled !== 'string') evaled = util.inspect(evaled)
					await m.reply(evaled)
				} catch (err) {
					await m.reply(String(err))
				}
			}
			if (budy.startsWith('<')) {
				if (!isCreator) return
				try {
					let evaled = await eval(`(async () => { ${budy.slice(2)} })()`)
					if (typeof evaled !== 'string') evaled = util.inspect(evaled)
					await m.reply(evaled)
				} catch (err) {
					await m.reply(String(err))
				}
			}
			if (budy.startsWith('$')) {
				if (!isCreator) return
				if (!text) return
				exec(budy.slice(2), (err, stdout) => {
					if (err) return m.reply(`${err}`)
					if (stdout) return m.reply(stdout)
				})
			}
			if ((!isCmd || isCreator) && budy.toLowerCase() != undefined) {
				if (m.chat.endsWith('broadcast')) return
				if (!(budy.toLowerCase() in db.database)) return
				await naze.relayMessage(m.chat, db.database[budy.toLowerCase()], {})
			}
		}
	} catch (e) {
		console.log(e);
		if (e?.message?.includes('No sessions') || e?.message?.includes('ffmpeg exited with code') || e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || e?.message?.includes('maxBodyLength limit') || e?.message?.includes('rate-overlimit')) return;
		const errorKey = e?.code || e?.name || e?.message?.slice(0, 100) || 'unknown_error';
		const now = Date.now();
		if (!errorCache[errorKey]) errorCache[errorKey] = [];
		errorCache[errorKey] = errorCache[errorKey].filter(ts => now - ts < 600000);
		if (errorCache[errorKey].length >= 3) return;
		errorCache[errorKey].push(now);
		const isAxiosError = e?.isAxiosError || !!e?.response; 
		const statusCode = e?.response?.status || e?.statusCode || e?.data;
		const errorUrl = e?.config?.url || e?.request?.host || '';
		if (statusCode === 500) {
			m.reply('Server API Error: Terjadi gangguan pada server tujuan.');
		} else if (statusCode === 429) {
			if (errorUrl.includes('api.naze.biz.id')) {
				return m.reply('Limit Reached: ' + mess.key);
			} else m.reply('Limit Reached (Sistem/WA): Terlalu banyak permintaan.\nLog Error Telah dikirim ke Owner');
		} else if (statusCode === 403) {
			if (isAxiosError) {
				if (errorUrl.includes('api.naze.biz.id')) {
					return m.reply('Akses Khusus Premium!');
				} else m.reply('API Error: Akses ke server API ditolak (403 Forbidden).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses grup ditolak (Baileys 403 / Forbidden).'));
		} else if (statusCode === 401) {
			if (isAxiosError) {
				if (errorUrl.includes('api.naze.biz.id')) {
					return m.reply('Invalid Apikey!');
				} else m.reply('API Error: Akses ke server API ditolak (401 Unauthorized).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses ditolak (401 Unauthorized).'));
		} else m.reply('Error: ' + (e?.name || e?.code || e?.message || 'Terjadi kesalahan tidak diketahui') + '\nLog Error Telah dikirim ke Owner\n\n');
		return naze.sendFromOwner(ownerNumber, `Halo sayang, sepertinya ada yang error nih, jangan lupa diperbaiki ya\n\nVersion : *${require('./package.json').version}*\nType : *${m.type || errorKey}*\n\n*Log error:*\n\n` + util.format(e), m, { contextInfo: { isForwarded: true }})
	}
}

const naze = nazeHandler;
export default naze;
