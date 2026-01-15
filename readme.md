# WhatsApp Anti-Delete Bot (Transparency Edition)

A Node.js–based WhatsApp bot designed to detect deleted messages in group chats. Built for transparency and maintaining openness between users.

## Key Features
- Text Anti-Delete: Automatically re-sends deleted text messages.
- Media Anti-Delete: Supports recovery of photos and stickers.
- Auto-Clean: Automatically removes old media files to prevent VPS storage from getting full.
- Random Sass: Sends automatic humorous or sarcastic reports related to “transparency.”

## VPS Installation Guide

### 1. Environment Preparation
```
sudo apt update
sudo apt install nodejs npm git -y
```

### 2. Project Installation
Clone this repository and install required dependencies:
```
git clone https://github.com/damaswangsa/bot-antidelete.git
cd bot-antidelete
npm install
```

### 3. Running the Bot

A. Connect Your Account (Scan QR)  
Run the bot for the first time to display a QR code:
```
node index.js
```

Scan the QR code using WhatsApp on your phone through the “Linked Devices” menu.

B. Running 24/7 on VPS  
Use PM2 to keep the bot running in the background:
```
sudo npm install pm2 -g
pm2 start index.js --name "wa-antidelete-bot"
pm2 save
pm2 startup
```
C. Admin Control 
```
Only Group Admins or the Bot Owner can use `!bot on` and `!bot off` commands.
```

## Session Security (Important)
Do NOT upload the `auth_info_baileys` folder to any public repository, as it contains your login credentials.  
Make sure your `.gitignore` file contains:
```
node_modules/
auth_info_baileys/
temp/
```

## Tech Stack
- Baileys (WhatsApp Web API)
- Node.js (JavaScript runtime)
- PM2 (Process manager to keep the bot online)



## Disclaimer
Use this bot responsibly for transparency purposes. Any misuse involving privacy violations is the sole responsibility of the user.
