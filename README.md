# 🤖 Ti Assistant Bot

<div align="center">
  <img src="https://raw.githubusercontent.com/Xcilik/Ti_Bot/main/src/media/naze.png" width="150" height="150" alt="Ti Bot Logo" style="border-radius: 50%;" />
  <h3>Modern WhatsApp Assistant Bot with Real-time Google Search, AI Generation, and Media Tools</h3>
  <p>Created by <b>Farid Suryadi</b>, powered by Node.js & Baileys.</p>
</div>

---

## 🌟 Key Features

- 🧠 **Google Search integration (RAG)**: Automatically searches Google in real-time to answer factual questions accurately.
- 🎨 **AI Image Generation**: Directly generate images from text prompts (via Pollinations.ai).
- 🔍 **Image Search**: Search and fetch images from Pinterest/Google directly.
- 🎵 **Music & Video Playback**: Search and download songs/videos from YouTube.
- 🛠️ **Utility Commands**: Administration commands (kick, promote, demote, group, hidetag) and games.

---

## 📦 Requirements

- **Node.js** v20.x or higher
- **FFmpeg** (for audio/video conversion)
- **ImageMagick** (for sticker/image processing)
- **Git**

---

## 🚀 VPS Deployment Guide (Ubuntu 20.04/22.04 LTS)

Follow these step-by-step instructions to deploy Ti Bot on a Ubuntu VPS and keep it running 24/7.

### 1️⃣ Update System & Install Dependencies
First, connect to your VPS via SSH and run:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ffmpeg imagemagick curl build-essential
```

### 2️⃣ Install Node.js (v20)
Install Node.js from NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
Verify the installation:
```bash
node -v
npm -v
```

### 3️⃣ Clone the Repository
Clone your project to the VPS:
```bash
git clone https://github.com/Xcilik/Ti_Bot.git
cd Ti_Bot
```

### 4️⃣ Install Package Dependencies & PM2
Install PM2 globally to manage the process in the background, then install the bot's dependencies:
```bash
sudo npm install -g pm2
npm install
```

### 5️⃣ Configuration
Edit the configuration file `settings.js` to customize your bot settings (e.g., owner number, bot name, pairing code settings):
```bash
nano settings.js
```
*Press `CTRL+O` then `Enter` to save, and `CTRL+X` to exit nano editor.*

### 6️⃣ Initial WhatsApp Connection
Run the bot interactively first to link it to your WhatsApp account:
```bash
npm start
```
- If `pairing_code` is enabled in `settings.js`, enter the Pairing Code shown in WhatsApp.
- Otherwise, scan the QR code displayed in the terminal.
- Once the bot is connected and loaded successfully, press `CTRL+C` to stop the interactive session.

### 7️⃣ Keep Bot Running 24/7 with PM2
Now start the bot in the background using PM2:
```bash
pm2 start start.js --name "ti-bot"
```

#### Useful PM2 Commands:
- **View logs in real-time**: `pm2 logs ti-bot`
- **Restart the bot**: `pm2 restart ti-bot`
- **Stop the bot**: `pm2 stop ti-bot`
- **List running processes**: `pm2 list`
- **Enable auto-start on VPS boot**:
  ```bash
  pm2 startup
  pm2 save
  ```

---

## ⚙️ Configuration File (`settings.js`)

You can customize the bot settings in `settings.js`:
- **Owner Number**: `global.owner = ['6289652411405']`
- **Bot Name**: `global.botname = 'Ti Bot'`
- **Pairing Code / Bot Number**: Enable `global.pairing_code = true` and set `global.number_bot = '628...'` for passwordless pairing.

---

## 🧩 License
This project is licensed under the MIT License.