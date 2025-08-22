# [🎵 Music Link Converter](https://musiclinkconverter.com)

> **Bridge the gap between Spotify and Tidal** - Convert music links between streaming services seamlessly

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?logo=cloudflareworkers)](https://workers.cloudflare.com/)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE?logo=astro)](https://astro.build/)

## ✨ What is Music Link Converter?

Music Link Converter is a web application that acts as a bridge between Spotify and Tidal music streaming services. Simply paste a share link from one service, and we'll find the matching track, artist, or album on the other platform.

### 🎯 Features

- **Cross-Platform Conversion**: Convert Spotify links to Tidal and vice versa
- **Multiple Content Types**: Support for tracks, albums, and artists
- **Instant Results**: Real-time API queries for immediate conversion
- **Clean Interface**: Simple, intuitive web interface
- **Cloudflare Powered**: Fast, global deployment with edge computing

## 🚀 Quick Start

### Try it Online

Visit [musiclinkconverter.com](https://musiclinkconverter.com) to start converting links right away!

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/akselinurmio/music-link-converter.git
   cd music-link-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create a .env file with your API keys
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   TIDAL_CLIENT_ID=your_tidal_client_id
   TIDAL_CLIENT_SECRET=your_tidal_client_secret
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:4321`

## 🛠️ Development

### Prerequisites

- Node.js 22+
- Spotify Developer Account
- Tidal Developer Account

### Available Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Build and preview production build locally |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run cf-typegen` | Generate Cloudflare types |

### Project Structure

```
music-link-converter/
├── public/                 # Static assets
├── src/
│   ├── components/         # Astro components
│   ├── layouts/           # Page layouts
│   ├── pages/             # Route pages
│   └── assets/            # Images and styles
├── astro.config.mjs       # Astro configuration
├── wrangler.jsonc         # Cloudflare Workers config
├── tsconfig.json          # TypeScript configuration
├── worker-configuration.d.ts # Cloudflare types
├── .prettierrc           # Prettier configuration
├── .gitignore            # Git ignore rules
└── package.json          # Dependencies and scripts
```

## 🔧 API Integration

This project integrates with:

- **Spotify Web API** and **Tidal API** - For retrieving track, album, and artist information
- **Cloudflare Workers** - For serverless deployment and edge computing

### Required API Keys

You'll need to obtain API credentials from:

1. **Spotify Developer Dashboard**: [developer.spotify.com](https://developer.spotify.com/dashboard)
2. **Tidal Developer Portal**: [developer.tidal.com](https://developer.tidal.com/dashboard)

## 🌐 Deployment

This project is configured for deployment on Cloudflare Workers:

```bash
npm run deploy
```

The application will be deployed to your Cloudflare Workers account and accessible via your configured domain.

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests if applicable
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Astro](https://astro.build/) for the amazing web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless hosting
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) for music data
- [Tidal API](https://developer.tidal.com/) for music data

---

**Made with ❤️ for music lovers everywhere**
