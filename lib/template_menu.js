import '../settings.js';
import fs from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function setTemplateMenu(naze, type, m, prefix, setv, db, options = {}) {
	const botname = db?.set?.[options.botNumber]?.botname || global.botname || 'Naze Bot';
	let total = Object.entries(db.hit).sort((a, b) => b[1] - a[1]).slice(0, Math.min(7, Object.keys(db.hit).length)).filter(([command]) => command !== 'totalcmd' && command !== 'todaycmd').slice(0, 5);
	
	let text = `╭──❍「 *TOP MENU* 」❍\n`
	
	if (total && total.length >= 5) {
		total.forEach(([command, hit], index) => {
			text += `│${setv} ${prefix}${command}: ${hit} hits\n`
		})
		text += '╰──────❍'
	} else text += `│${setv} ${prefix}ai
│${setv} ${prefix}brat
│${setv} ${prefix}tiktok
│${setv} ${prefix}cekmati
│${setv} ${prefix}susunkata
╰──────❍`

	const isOwner = options.isCreator || false;
	const isIos = m.device === 'ios';
	const useQuickRepliesOnly = isOwner || isIos;

	if (type == 1 || type == 'buttonMessage' || useQuickRepliesOnly) {
		await naze.sendButtonMsg(m.chat, {
			text: `Halo @${m.sender.split('@')[0]}\n${botname} siap membantu anda\n\n` + text,
			footer: options.ucapanWaktu,
			mentions: [m.sender],
			contextInfo: {
				forwardingScore: 10,
				isForwarded: true,
			},
			buttons: [{
				buttonId: `${prefix}allmenu`,
				buttonText: { displayText: 'All Menu 📋' },
				type: 1
			},{
				buttonId: `${prefix}funmenu`,
				buttonText: { displayText: 'Fun Menu 🎭' },
				type: 1
			},{
				buttonId: `${prefix}gamemenu`,
				buttonText: { displayText: 'Game Menu 🎮' },
				type: 1
			}]
		}, { quoted: m })
	} else if (type == 2 || type == 'listMessage') {
		await naze.sendButtonMsg(m.chat, {
			text: `Halo @${m.sender.split('@')[0]}\n${botname} siap membantu anda\n\n` + text,
			footer: options.ucapanWaktu,
			mentions: [m.sender],
			contextInfo: {
				forwardingScore: 10,
				isForwarded: true,
			},
			buttons: [{
				buttonId: 'list_button',
				buttonText: { displayText: 'list' },
				nativeFlowInfo: {
					name: 'single_select',
					paramsJson: JSON.stringify({
						title: 'Pilih Kategori Menu 📋',
						sections: [{
							title: 'Daftar Kategori Menu',
							rows: (() => {
								const items = [{
									title: 'All Menu',
									description: 'Tampilkan semua fitur bot',
									id: `${prefix}allmenu`
								},{
									title: 'Bot Menu',
									description: 'Tampilkan menu bot',
									id: `${prefix}botmenu`
								},{
									title: 'Group Menu',
									description: 'Tampilkan menu grup',
									id: `${prefix}groupmenu`
								},{
									title: 'Search Menu',
									description: 'Tampilkan menu pencarian',
									id: `${prefix}searchmenu`
								},{
									title: 'Download Menu',
									description: 'Tampilkan menu pengunduh',
									id: `${prefix}downloadmenu`
								},{
									title: 'Quotes Menu',
									description: 'Tampilkan menu kata bijak/quotes',
									id: `${prefix}quotesmenu`
								},{
									title: 'Tools Menu',
									description: 'Tampilkan menu alat bantuan',
									id: `${prefix}toolsmenu`
								},{
									title: 'Ai Menu',
									description: 'Tampilkan menu kecerdasan buatan',
									id: `${prefix}aimenu`
								},{
									title: 'Stalker Menu',
									description: 'Tampilkan menu stalker',
									id: `${prefix}stalkermenu`
								},{
									title: 'Random Menu',
									description: 'Tampilkan menu acak',
									id: `${prefix}randommenu`
								},{
									title: 'Anime Menu',
									description: 'Tampilkan menu anime',
									id: `${prefix}animemenu`
								},{
									title: 'Game Menu',
									description: 'Tampilkan menu permainan',
									id: `${prefix}gamemenu`
								},{
									title: 'Fun Menu',
									description: 'Tampilkan menu kesenangan',
									id: `${prefix}funmenu`
								},{
									title: 'Kampus Menu',
									description: 'Tampilkan menu perkuliahan/kampus',
									id: `${prefix}kampusmenu`
								}];
								
								if (isOwner && !m.isGroup) {
									items.push({
										title: 'Owner Menu',
										description: 'Tampilkan menu khusus pemilik bot',
										id: `${prefix}ownermenu`
									});
								}
								return items;
							})()
						}]
					})
				},
				type: 2
			}]
		}, { quoted: m })
	} else if (type == 3 || type == 'documentMessage') {
		let profile = './src/media/logo.jpg'
		const menunya = `
╭──❍「 *USER INFO* 」❍
├ *Nama* : ${m.pushName ? m.pushName : 'Tanpa Nama'}
├ *Id* : @${m.sender.split('@')[0]}
├ *User* : ${options.isVip ? 'VIP' : options.isPremium ? 'PREMIUM' : 'FREE'}
├ *Limit* : ${options.isVip ? 'VIP' : db.users[m.sender].limit }
├ *Uang* : ${db.users[m.sender] ? db.users[m.sender].money.toLocaleString('id-ID') : '0'}
╰─┬────❍
╭─┴─❍「 *BOT INFO* 」❍
├ *Nama Bot* : ${db?.set?.[options.botNumber]?.botname || 'Naze Bot'}
├ *Powered* : @${'0@s.whatsapp.net'.split('@')[0]}
├ *Owner* : @${owner[0].split('@')[0]}
├ *Mode* : ${naze.public ? 'Public' : 'Self'}
├ *Prefix* :${db.set[options.botNumber].multiprefix ? '「 MULTI-PREFIX 」' : ' *'+prefix+'*' }
╰─┬────❍
╭─┴─❍「 *ABOUT* 」❍
├ *Date* : ${options.date}
├ *Day* : ${options.locale_day}
├ *Time* : ${options.date_time}
╰──────❍\n`
		await m.reply({
			text: menunya + text,
			title: options.author,
			description: options.packname,
			thumbnailUrl: profile,
			sourceUrl: my.gh,
			mentions: [m.sender, '0@s.whatsapp.net', owner[0] + '@s.whatsapp.net'],
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
	} else if (type == 4 || type == 'videoMessage') {
		//tambahin sendiri :v
	} else {
		m.reply(`${options.ucapanWaktu} @${m.sender.split('@')[0]}\nSilahkan Gunakan ${prefix}allmenu\nUntuk Melihat Semua Menunya`)
	}
}

export default setTemplateMenu;

fs.watchFile(__filename, async () => {
	fs.unwatchFile(__filename)
	console.log(chalk.yellowBright(`[UPDATE] ${__filename}`))
	await import(`${import.meta.url}?update=${Date.now()}`)
});