import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { fileTypeFromFile } from 'file-type';

async function UguuSe(filePath) {
	const fileType = await fileTypeFromFile(filePath);
	const ext = fileType ? fileType.ext : 'bin';

	// 1. Try Uguu.se
	try {
		const form = new FormData();
		form.append('files[]', fs.createReadStream(filePath), { filename: 'data.' + ext });
		const res = await axios.post('https://uguu.se/upload.php', form, {
			headers: { ...form.getHeaders() },
			timeout: 10000
		});
		if (res.data && res.data.files && res.data.files[0]) {
			return res.data.files[0];
		}
	} catch (e) {
		console.warn('[Uploader] Uguu.se failed, trying Telegraph...', e.message);
	}

	// 2. Try Telegraph
	try {
		const form = new FormData();
		form.append('file', fs.createReadStream(filePath), { filename: 'data.' + ext });
		const res = await axios.post('https://telegra.ph/upload', form, {
			headers: { ...form.getHeaders() },
			timeout: 10000
		});
		if (res.data && res.data[0] && res.data[0].src) {
			return { url: 'https://telegra.ph' + res.data[0].src };
		}
	} catch (e) {
		console.warn('[Uploader] Telegraph failed, trying Catbox...', e.message);
	}

	// 3. Try Catbox
	try {
		const form = new FormData();
		form.append('reqtype', 'fileupload');
		form.append('fileToUpload', fs.createReadStream(filePath), { filename: 'data.' + ext });
		const res = await axios.post('https://catbox.moe/user/api.php', form, {
			headers: { ...form.getHeaders() },
			timeout: 15000
		});
		if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
			return { url: res.data.trim() };
		}
	} catch (e) {
		console.warn('[Uploader] Catbox failed too...', e.message);
	}

	throw new Error('All image upload services failed');
}

export { UguuSe }