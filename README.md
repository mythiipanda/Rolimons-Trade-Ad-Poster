# Rolimons Trade Ad Poster

A Chrome extension that automates trade advertisement posting on Rolimons.com for Roblox trading. No programming knowledge required!

## 🚀 Quick Start (For Regular Users)

### Want to just use the extension? It's super easy!

1. **Download**: Click the green "Code" button above → "Download ZIP"
2. **Extract**: Unzip the downloaded file to your computer
3. **Install**: Open Chrome → `chrome://extensions/` → Enable "Developer mode" → "Load unpacked" → Select the `extension` folder
4. **Use**: Click the extension icon and start automating your trades!

📖 **[See INSTALL.md for detailed step-by-step instructions](INSTALL.md)**

---

## 🛠️ Developer Setup (For Contributors)

Only needed if you want to modify the extension code.

### Prerequisites
- Node.js (version 18 or higher)
- npm or pnpm package manager
- Chrome browser (or Chromium-based browser)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/mythiipanda/Rolimons-Trade-Ad-Poster.git
   cd Rolimons-Trade-Ad-Poster
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `build/chrome-mv3-dev` directory

### Production Build

1. **Build the extension**
   ```bash
   npm run build
   # or
   pnpm build
   ```

2. **Package for distribution**
   ```bash
   npm run package
   # or
   pnpm package
   ```

---

## ✨ Features

### 🤖 **Automated Trade Posting**
- Automatically post trade advertisements on Rolimons at customizable intervals
- Set trade intervals from 1 minute and up
- Start/pause functionality for full control

### 📋 **Multiple Trade Configurations**
- Save and manage multiple trade configurations
- Switch between different trading strategies instantly
- Auto-cycle through saved configurations when posting
- Update and modify existing configurations

### 🎒 **Smart Inventory Management**
- Automatic fetching of your Roblox inventory
- Visual item selection with thumbnails and values
- Support for up to 4 items per trade offer
- Automatic value formatting (38K, 1.4M, etc.)

### 🔍 **Advanced Item Search**
- Search through all Rolimons items by name or alias
- Sort items by value (highest to lowest)
- Paginated results for better performance
- Visual item selection with thumbnails

### 🏷️ **Trade Tags Support**
- Support for all Rolimons trade tags: `adds`, `upgrade`, `downgrade`, `any`, `wishlist`, `demand`, `rares`, `rap`, `robux`, `projecteds`
- Combine specific items with trade tags (max 4 total)
- Visual tag management interface

### 🔐 **Secure Authentication**
- Automatic credential fetching from Roblox and Rolimons
- Secure storage of authentication tokens
- Visual connection status indicators

### 💾 **Data Persistence**
- All configurations saved locally using Chrome storage
- Automatic loading of previous settings

## 📖 Usage Guide

### Initial Setup

1. **Install and activate the extension** (see Quick Start above)
2. **Click the extension icon** in your Chrome toolbar
3. **Navigate to Settings tab** and click "Fetch Credentials"
4. **Ensure both Roblox User ID and Rolimons Token show as "Set"**

### Creating Your First Trade Configuration

1. **Go to the Inventory tab**
   - Select up to 4 items you want to offer
   - Items are sorted by value automatically

2. **Go to the Search tab**
   - Search for specific items you want to request
   - Select items from the search results
   - Maximum of 4 items total (including tags)

3. **Go to the Config tab**
   - Add trade tags if desired (`any`, `upgrade`, `adds`, etc.)
   - Save your configuration with a descriptive name

### Starting Automated Trading

1. **Go to the Control tab**
2. **Select a saved configuration** (or use current settings)
3. **Set your desired trade interval** (in minutes)
4. **Click "Start Poster"** to begin automated posting
5. **Click "Pause Poster"** to stop at any time

### Advanced Features

#### Multiple Configurations
- Save different trading strategies for different items
- Enable "Auto Cycle" in Settings to rotate through configurations
- Update existing configurations or create new ones

#### Trade Tags
Use Rolimons trade tags to cast a wider net:
- `any` - Accept any reasonable offers
- `upgrade` - Looking for upgrades only
- `downgrade` - Accepting downgrades
- `adds` - Want additional items (adds)
- `wishlist` - Items from your wishlist
- `demand` - High-demand items only
- `rares` - Rare items only
- `rap` - Recent Average Price based trades
- `robux` - Robux offers accepted
- `projecteds` - Projected value based trades

## 🛠️ Technology Stack

- **Framework**: [Plasmo](https://docs.plasmo.com/) - Modern browser extension development
- **UI**: React 18.2.0 with TypeScript
- **Styling**: Tailwind CSS 3.4.17 with custom components
- **Build Tool**: Plasmo CLI with hot reloading
- **Storage**: Chrome Extension Storage API
- **Messaging**: Plasmo messaging system for background communication

## 🏗️ Project Structure

```
Rolimons-Trade-Ad-Poster/
├── extension/               # 📦 Ready-to-use extension files (for users)
├── contents/                # Content scripts
│   ├── content.ts          # Main content script
│   └── rolimons_auth_fetcher.ts # Authentication handler
├── lib/                    # Core libraries
│   ├── cache_service.ts    # Caching functionality
│   ├── roblox_api_service.ts # Roblox API integration
│   ├── rolimons_item_api.ts # Rolimons item data
│   ├── rolimons_poster.ts  # Trade posting logic
│   └── utils.ts           # Utility functions
├── types/                  # TypeScript type definitions
│   └── messages.ts        # Message type definitions
├── assets/                # Static assets
│   └── icon.png          # Extension icon
├── background.ts          # Background service worker
├── popup.tsx             # Main popup interface
├── INSTALL.md           # 📖 User-friendly installation guide
├── README.md           # This file
└── package.json       # Project dependencies
```

## ⚠️ Important Notes

### Rate Limiting
- Respect Rolimons' rate limits by setting reasonable intervals (15+ minutes recommended)
- The extension includes built-in safeguards against excessive API calls

### Terms of Service
- Ensure your usage complies with both Roblox and Rolimons Terms of Service
- Use responsibly and avoid spamming the platform

### Security
- Credentials are stored locally and never transmitted to third parties
- All API calls go directly to official Roblox/Rolimons endpoints
- No tracking or analytics are included

## 🐛 Troubleshooting

### Common Issues

**Extension not loading:**
- Ensure Developer mode is enabled in Chrome
- Try reloading the extension in chrome://extensions/

**Credentials not fetching:**
- Make sure you're logged into both Roblox and Rolimons
- Clear browser cache and cookies
- Ensure popup blockers aren't interfering

**Trade posting fails:**
- Verify your authentication status in Settings
- Check that you have selected valid items
- Ensure your trade configuration is complete

**Items not loading:**
- Check your internet connection
- Verify Rolimons API accessibility
- Try refreshing the extension

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing code style and patterns
- Test your changes thoroughly with multiple configurations
- Update documentation for any new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, feature requests, or bug reports:
- Open an issue on GitHub
- Provide detailed information about your setup and the issue
- Include console logs if experiencing technical problems

## 🙏 Acknowledgments

- [Plasmo Framework](https://docs.plasmo.com/) for excellent extension development tools
- [Rolimons](https://rolimons.com/) for providing the trading platform
- [Roblox](https://roblox.com/) for the gaming platform and APIs
- The Roblox trading community for feedback and suggestions

---

**⚡ Start automating your Roblox trades today with Rolimons Trade Ad Poster!**

**🎯 For regular users: Just download the ZIP, extract, and load the `extension` folder - no technical setup required!**