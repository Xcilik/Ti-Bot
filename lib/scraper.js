import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';

const isWindows = process.platform === 'win32';
const ytdlpFilename = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytdlpPath = path.resolve('./database', ytdlpFilename);
const YTDLP_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpFilename}`;

async function downloadYtdlp() {
	if (fs.existsSync(ytdlpPath)) {
		try {
			const stats = fs.statSync(ytdlpPath);
			const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
			if (ageInHours > 24) {
				console.log('[scraper] yt-dlp binary is older than 24 hours. Checking for updates in the background...');
				exec(`"${ytdlpPath}" --update`, (err) => {
					if (err) console.error('[scraper] Failed to update yt-dlp:', err.message);
					else console.log('[scraper] yt-dlp updated successfully!');
				});
			}
		} catch (e) {
			console.error('[scraper] Error checking yt-dlp age:', e.message);
		}
		return ytdlpPath;
	}
	fs.mkdirSync(path.dirname(ytdlpPath), { recursive: true });
	console.log(`[scraper] yt-dlp binary not found. Downloading from ${YTDLP_URL}...`);
	const response = await axios({
		method: 'GET',
		url: YTDLP_URL,
		responseType: 'stream'
	});
	const writer = fs.createWriteStream(ytdlpPath);
	response.data.pipe(writer);
	return new Promise((resolve, reject) => {
		writer.on('finish', () => {
			console.log('[scraper] yt-dlp downloaded successfully!');
			if (!isWindows) {
				try {
					fs.chmodSync(ytdlpPath, '755');
				} catch (e) {
					console.error('[scraper] Failed to chmod yt-dlp:', e.message);
				}
			}
			resolve(ytdlpPath);
		});
		writer.on('error', reject);
	});
}

async function ytMp4(url, options) {
	let rawTempPath = null;
	try {
		await downloadYtdlp();
		const outputPath = path.join('./database/temp', `output_${Date.now()}.mp4`);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		
		let title = 'YouTube Video';
		let desc = '';
		let channel = 'Unknown';
		let uploadDate = '';
		let thumb = '';
		
		try {
			const metadata = await new Promise((resolve, reject) => {
				const cmd = `"${ytdlpPath}" --js-runtimes node --no-playlist --dump-json "${url}"`;
				exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
					if (error) return reject(error);
					try {
						resolve(JSON.parse(stdout));
					} catch (e) {
						reject(e);
					}
				});
			});
			if (metadata.is_live || metadata.live_status === 'is_live' || metadata.live_status === 'is_upcoming') {
				throw new Error('Video ini adalah Live Stream atau Premiere yang belum tayang! Bot tidak dapat mendownload Live Stream.');
			}
			title = metadata.title || title;
			desc = metadata.description || desc;
			channel = metadata.uploader || channel;
			uploadDate = metadata.upload_date || uploadDate;
			thumb = metadata.thumbnail || thumb;
		} catch (metaError) {
			console.error('[scraper] Error fetching yt-dlp metadata:', metaError.message);
			if (metaError.message.includes('Live Stream') || metaError.message.includes('Premiere')) {
				throw metaError;
			}
		}
		
		// Download best video+audio under 360p of any format first
		rawTempPath = path.join('./database/temp', `raw_${Date.now()}.mp4`);
		await new Promise((resolve, reject) => {
			const cmd = `"${ytdlpPath}" --js-runtimes node --no-progress --no-playlist -f "bestvideo[height<=360]+bestaudio/best[height<=360]/best" --merge-output-format mp4 "${url}" -o "${rawTempPath}"`;
			exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) return reject(new Error(`Failed to download video: ${error.message}`));
				resolve();
			});
		});
		
		// Transcode raw download to highly compatible H.264 Baseline MP4 for WhatsApp
		await new Promise((resolve, reject) => {
			const cmd = `ffmpeg -y -loglevel error -i "${rawTempPath}" -c:v libx264 -preset superfast -crf 32 -profile:v baseline -level 3.0 -pix_fmt yuv420p -map 0:v:0 -map 0:a? -c:a:0 aac -ac:0 2 -ar:0 44100 -movflags +faststart "${outputPath}"`;
			exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				// Cleanup raw file immediately
				try { if (fs.existsSync(rawTempPath)) fs.unlinkSync(rawTempPath); } catch {}
				if (error) return reject(new Error(`Failed to transcode video: ${error.message || stderr}`));
				resolve();
			});
		});
		
		return {
			title,
			result: outputPath,
			thumb,
			channel,
			uploadDate,
			desc
		};
	} catch (error) {
		// Clean up raw temp file if it still exists
		try { if (rawTempPath && fs.existsSync(rawTempPath)) fs.unlinkSync(rawTempPath); } catch {}
		throw error;
	}
}

async function ytMp3(url, options) {
	try {
		await downloadYtdlp();
		const outputPath = path.join('./database/temp', `audio_${Date.now()}.mp3`);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		
		let title = 'YouTube Audio';
		let desc = '';
		let channel = 'Unknown';
		let uploadDate = '';
		let thumb = '';
		
		try {
			const metadata = await new Promise((resolve, reject) => {
				const cmd = `"${ytdlpPath}" --js-runtimes node --no-playlist --dump-json "${url}"`;
				exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
					if (error) return reject(error);
					try {
						resolve(JSON.parse(stdout));
					} catch (e) {
						reject(e);
					}
				});
			});
			title = metadata.title || title;
			desc = metadata.description || desc;
			channel = metadata.uploader || channel;
			uploadDate = metadata.upload_date || uploadDate;
			thumb = metadata.thumbnail || thumb;
		} catch (metaError) {
			console.error('[scraper] Error fetching yt-dlp metadata:', metaError.message);
		}
		
		// Download audio and convert to mp3
		await new Promise((resolve, reject) => {
			const cmd = `"${ytdlpPath}" --js-runtimes node --no-progress --no-playlist -f "bestaudio" -x --audio-format mp3 "${url}" -o "${outputPath}"`;
			exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) return reject(new Error(`Failed to download audio: ${error.message}`));
				resolve();
			});
		});
		
		return {
			title,
			result: outputPath,
			thumb,
			channel,
			uploadDate,
			desc
		};
	} catch (error) {
		throw error;
	}
}

export {
	ytMp4,
	ytMp3
};