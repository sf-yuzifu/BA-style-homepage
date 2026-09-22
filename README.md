<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<h1 align="center">Fish Archive</h1>

<p align="center">
  <a href='https://gitee.com/sf-yuzifu/homepage/stargazers'><img src='https://gitee.com/sf-yuzifu/homepage/badge/star.svg?theme=white' alt='Gitee stars' /></a>
  <a href='https://gitee.com/sf-yuzifu/homepage/members'><img src='https://gitee.com/sf-yuzifu/homepage/badge/fork.svg?theme=white' alt='Gitee forks' /></a>
  <a href='https://github.com/sf-yuzifu/BA-style-homepage/stargazers'><img alt="GitHub stars" src="https://img.shields.io/github/stars/sf-yuzifu/BA-style-homepage"></a>
  <a href='https://github.com/sf-yuzifu/BA-style-homepage/forks'><img alt="GitHub forks" src="https://img.shields.io/github/forks/sf-yuzifu/BA-style-homepage"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

<div align="center">A Blue Archive-style personal homepage for me.</div>

![Fish Archive](shots/en/pic1.png)

<p align="center"><strong>Live Demo:</strong> <a href="https://yuzifu.top">yuzifu.top</a> · <a href="https://yzf.moe">yzf.moe</a></p>

## 📖 Introduction

**Fish Archive** is a personal homepage that faithfully recreates the style of the game *Blue Archive*. Built with **Vue 3 + Vite**, it renders memorial lobby skeletal animations (Live2D) from the game via **PIXI.js + Spine**, and implements a series of interactive effects such as head-patting, gaze following, cheek dragging, and voice dialogue — striving to reproduce the immersive feeling of "spending time with students" right in your browser.

All site content (site info, contacts, project showcase, music list, Live2D characters, etc.) can be customized through **`_config.yaml`** in the root directory (forks: see **`_config.example.yaml`**). The bio page body lives in `bio/{locale}.md` — deploy your own homepage without touching the source code.

## ✨ Features

### 🎮 Faithful Game UI Recreation

- Loading screen (progress bar + random avatar)
- Main interface recreation (Level / AP / Gold / Pyroxene and other game elements)
- Popup recreation and the "Shittim Chest" curtain transition animation
- Personal bio and other secondary pages

### 🎭 Memorial Lobby Live2D Interactions (Spine Rendering)

- Switch between multiple student memorial lobbies (previous / next page)
- Global viewing mode (hide UI and enjoy the memorial lobby)
- Head-patting: long-press the head area and the student's head follows your finger
- Tap to talk: trigger character lines and voice
- Dialogue bubble viewport clamping: near screen edges the bubble shrinks and wraps, and shifts vertically to stay fully visible
- Gaze following: the student looks at your pointer while dragging (parameters extracted from official game resources)
- Cheek dragging / special bone dragging interactions
- Random blinking and idle motions

### 🎵 Atmosphere

- Banner music player (random playback across multiple sources: NetEase Cloud tracks/playlists, QQ Music, Kugou, Kuwo, self-hosted audio)
- Blue Archive-style click effects
- Custom game-style virtual cursor
- Wallet system: AP syncs with your device battery (falls back to recovering 1 AP per 6 minutes), credits accumulate with time spent on site, and pyroxene comes from daily sign-in rewards (persisted in localStorage, hover for details)

### 🌍 i18n & PWA

- Built-in support for 简体中文 / 繁體中文 / English / 日本語
- Automatic browser language detection, with language packs loaded on demand
- PWA offline caching and site update prompts

### ⚡ Performance Optimization

- CJK fonts are subsetted at build time (cn-font-split) and loaded on demand via unicode-range
- Arco Design imported on demand, route-level lazy loading, grouped vendor chunking
- Automatic image optimization and gzip compression

## 📸 Screenshots

<p align="center">
  <img src="shots/en/pic1.png" alt="Desktop" />
</p>
<p align="center">
  <img src="shots/en/settings.png" alt="Settings" />
</p>
<p align="center">
  <img src="shots/en/pic2.png" alt="Bio" />
</p>
<p align="center">
  <img src="shots/en/mobile.png" alt="Mobile" />
</p>

## 🔗 Preview

- [yuzifu.top](https://yuzifu.top) — mainland China visitors are routed here automatically
- [yzf.moe](https://yzf.moe) — visitors from other regions are routed here automatically

## 🛠️ Tech Stack

| Technology | Purpose |
| --- | --- |
| [Vue 3](https://vuejs.org/) + [Vue Router](https://router.vuejs.org/) | Frontend framework and routing |
| [Vite](https://vitejs.dev/) | Build tool |
| [PIXI.js](https://github.com/pixijs/pixijs) + [spine-pixi-v8](https://www.npmjs.com/package/@esotericsoftware/spine-pixi-v8) | Memorial lobby Spine skeletal animation rendering |
| [Arco Design](https://arco.design/) | UI component library (imported on demand) |
| [howler.js](https://github.com/goldfire/howler.js) | Music playback (custom poster-style player) / character voice playback |
| [js-yaml](https://github.com/nodeca/js-yaml) | YAML configuration parsing |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) + Workbox | PWA offline caching |
| [cn-font-split](https://github.com/KonghaYao/cn-font-split) (via vite-plugin-font) | CJK font subsetting |
| [ba-click-fx](https://github.com/CialloKing/ba-click-fx) | Click effects |
| [BlueArchive-Cursors](https://github.com/makipom/BlueArchive-Cursors) | Game-style cursors |
| [Resource Han Rounded CN](https://github.com/CyanoHao/Resource-Han-Rounded) | Site font |
| [Iconfont](https://www.iconfont.cn/) | Icon font library |

## 🚀 Deployment

### Third-Party Platforms

#### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/sf-yuzifu/BA-style-homepage)

#### Netlify

1. `Fork` [this project](https://github.com/sf-yuzifu/BA-style-homepage)
2. [Log in to the Netlify console](https://app.netlify.com), then `Add new site` → `Import an existing project`
3. Authorize GitHub, pick your freshly forked repo, and start the deploy

#### EdgeOne Makers (Tencent)

1. In the [EdgeOne Makers console](https://console.cloud.tencent.com/edgeone/makers), choose "Import a Git repository", connect your Git provider (GitHub / Gitee / etc.) and select this repository
2. The repo root already ships [`edgeone.json`](./edgeone.json) (preinstalled Node 24.18.0 + global pnpm 12 install at build time + SPA route fallback + output directory `dist`) — no manual build configuration needed after import
3. Under "Project Settings → Environment Management → Environment Variables", configure `SITE_ICP` / `SITE_GONGAN` per environment (production / preview are independent); they are injected at build time

> **Note:** custom domains on the "Global" region need no filing; the "Chinese Mainland" region requires the domain to hold an ICP filing (which is exactly what this site's filing banner is for). Platform limits: 5 GiB account storage, 20000 files per project, 25 MiB per file — the build log reports errors when exceeded. If you later need a Node version that is not preinstalled, drop a `.nvmrc` in the repo — Makers will download and switch to it automatically, but the downloaded Node ships without package managers, so install pnpm yourself in `edgeone.json`'s `installCommand`.

### Local Build

> **Recommended Environment:**
>
> - Node.js ≥ 22.12 (declared in `package.json` engines; Node 24 LTS recommended — CI and EdgeOne Makers both use 24)
> - pnpm (`npm install -g pnpm`; the version is locked by the `packageManager` field in `package.json` and pnpm switches to it automatically)

1. Install pnpm

```bash
npm install -g pnpm
```

2. Clone this project to your local machine
3. Run the following commands in the project root directory

```bash
# Install dependencies
pnpm install

# Preview (development environment)
pnpm dev

# Build
pnpm build

# Preview (production environment preview)
pnpm preview
```

> After the build is complete, static resources will be generated in the **`dist` directory**. You can upload the **files in the `dist` directory** to your server.
>
> For how to deploy on BtPanel, see ([https://cloud.tencent.com/developer/article/1977167](https://cloud.tencent.com/developer/article/1977167))

### History routes (refresh `/bio` without 404)

The app uses Vue Router `createWebHistory`. The build writes **`dist/bio/index.html`** (its own OG tags), so hosts that serve directory indexes (GitHub Pages, etc.) already work on refresh.

Hosts that only know about the root `index.html` will 404 on `/bio`. This repo ships SPA fallbacks (real files still win, so `bio/index.html` and assets are not overwritten):

| Platform | File |
| --- | --- |
| Vercel | `vercel.json` at the repo root (the Vite preset usually covers git imports; this file matters when you upload `dist` as static files) |
| Netlify / Cloudflare Pages | `public/_redirects` (copied into `dist`) |
| EdgeOne Makers | `edgeone.json` at the repo root (`rewrites` maps `/*` → `/index.html`; the platform recognizes this as a SPA fallback where real files win) |
| Apache | `public/.htaccess` (copied into `dist`) |

The catch-all fallback in `vercel.json` (`/(.*)` → `/index.html`) relies on Vercel's **static-first** semantics: the filesystem is checked before rewrites apply, so real files (assets, `bio/index.html`) are never rewritten. If you copy this rule to a host or gateway that forwards by rewrite alone without a filesystem check, static assets would be rewritten to HTML — narrow the `source` yourself or use that host's own fallback config instead.

Nginx / BtPanel — point the site root at `dist` and add:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Subpath deploys (e.g. `https://user.github.io/homepage/`) also need Vite `base` set to that prefix. This repo assumes the site lives at `/`.

## ⚙️ Customization

After forking, edit mainly:

| File | Purpose |
| --- | --- |
| **`_config.example.yaml`** | Field reference and sample structure — **copy to `_config.yaml`** and fill in |
| **`bio/{locale}.md`** | Bio page body (Markdown; inline HTML OK) |

Run `pnpm build` and redeploy. The build validates `_config.yaml` and `public/` asset paths. Missing bio locales fall back to `bio/en-US.md`. Full field comments: **[`_config.example.yaml`](./_config.example.yaml)**.

### Env var substitution

Any string value in `_config.yaml` may contain `${VAR}` placeholders, resolved from environment variables at build time — handy for values you don't want in a public repo, such as ICP / PSB filing numbers:

```yaml
ICP: '${SITE_ICP}'
gongan: '${SITE_GONGAN}'
```

- **Local dev**: write them in `.env.local` (already gitignored)
- **Deployment platforms**: configure env vars in the console of Vercel / EdgeOne Pages / Netlify etc. (injected into `process.env` at build time, taking precedence over `.env` files)

Unset variables are replaced with an empty string plus a build warning; a whole-value placeholder (e.g. `level: ${SITE_LEVEL}`) keeps number/boolean typing after substitution. Since this is a static site, substitution happens at build time — redeploy after changing variables.

### Music banner sources

`banner.music` is grouped by source; everything merges into one random pool (omit sources you don't use; the legacy `banner.musicID` field still works and is folded into `music.netease`):

| Source | Key | Value | Notes |
| --- | --- | --- | --- |
| NetEase track | `netease` | numeric ID | From share link `/song?id=xxxx`; via public Meting instance, most VIP tracks play |
| NetEase playlist | `neteasePlaylist` | numeric ID | `/playlist?id=xxxx`, expanded once at startup |
| QQ Music | `tencent` | songmid string | Browser-side JSONP to official endpoints; **free tracks only** — VIP entries are skipped automatically |
| Kugou | `kugou` | 32-char hash | Same as above; the hash is in the song page / share parameters on Kugou web |
| Kuwo | `kuwo` | numeric rid | Title/artist/cover fetched automatically; or use `{ id, name, artist }` to override |
| Direct / self-hosted | `local` | `{ url, name, artist, cover? }` | Put audio under `public/` (e.g. `public/music/demo.mp3`); name/artist required |
| Spotify | `spotify` | track/playlist link | **Build-time matching only**, ignored at runtime; see below |

**Spotify playlist sync**: Spotify audio can't be played directly due to DRM + the login wall, but you can use Spotify as the "playlist source" and NetEase/QQ as the "player". After filling public playlist/track links into `banner.music.spotify`, run:

```bash
pnpm spotify:sync
```

The script fetches the track list (title/artist/duration), searches NetEase and QQ Music for matches (scoring: normalized title + artist overlap + duration tolerance), batch-probes NetEase candidates to filter out VIP tracks, and outputs ready-to-paste `netease` / `tencent` snippets for `_config.yaml`. Known limits: embed pages cap playlist tracks at about 50; matching can be off (same-title covers), so spot-check the report; popular VIP tracks without a free domestic original fall back to free cover/Live versions or get skipped.

### Other notes

- **Icons**: Default `public/js/iconfont.js` (`iconfont: /js/iconfont.js`). Use your own [iconfont.cn](https://www.iconfont.cn/) Symbol JS export, or `imgSrc` on `dock` / `contact` items.
- **OG share cards**: at build time, sharp crops `shots/zh/pic1.png` / `pic2.png` into `/og-home.jpg` and `/og-bio.jpg`. To use your own screenshots, point `og.home` / `og.bio` in `_config.yaml` at the new paths — do not delete the source files (the build fails if they are missing).
- **Transition video `transfrom.mov`**: the HEVC+alpha transition track for Safari / iOS, regenerated from `public/transfrom.webm` via `pnpm transition:mov`. The script relies on macOS's `hevc_videotoolbox` encoder, so **it only runs on macOS**. Ignore it if you keep the default transition; to replace it, regenerate the `.mov` on a Mac (deleting the `.mov` outright makes Safari fall back to the WebM track without an alpha channel).
- **History routes / subpath `base`**: see **Deployment** above.

## 🎮 Interaction

When the lobby HUD is visible (not in full-screen Live2D-only mode):

- **← / →**: switch memorial lobby character (same as the on-screen arrows; disable under **Settings → Presentation → Arrow keys**; ignored while typing or when the settings modal is open)

Head-pat, gaze follow, tap-to-talk, etc. are listed under **Features → Memorial lobby Live2D**.

## 💾 localStorage

The site persists data in browser `localStorage`. Forkers and users can clear entries via DevTools → Application → Local Storage, then reload:

| Key | Format | Purpose |
| --- | --- | --- |
| `fa-settings` | JSON | Volume / mute, `introMode` (`always` \| `once`), `introSeen`, `clickEffect`, `lobbyArrowKeys` (← / → character switch) |
| `fa-locale` | string | Language: `auto` or `zh-CN` / `zh-TW` / `en-US` / `ja-JP` |
| `fa-wallet` | JSON | Wallet: `ap`, `apSettleAt`, `gold`, `dwellSeconds`, `pyroxene`, `signInDays`, `lastSignIn` |

Changes to these keys sync across open tabs; deleting a key makes other open tabs fall back to defaults as well.

## 🌐 About i18n

**Base config + language pack overrides**: `_config.yaml` holds paths and links; `src/locales/*.yaml` overrides titles, UI strings, `memorialLobbies[].voice`, etc.; `bio/{locale}.md` is the bio body. Browser language is auto-detected; unmatched locales fall back to English. Language packs are separate chunks loaded on demand.

```
src/locales/   zh-CN.yaml  zh-TW.yaml  en-US.yaml  ja-JP.yaml
bio/           zh-CN.md    zh-TW.md    en-US.md    ja-JP.md
```

Typical keys in locale files: `title`, `manifest`, `dock[].name`, `contact[].name`, `task.name`, `memorialLobbies[].name`, `memorialLobbies[N].voice`, `translate.*`, `bio.btn[].name`. See `src/locales/en-US.yaml` for a full example.

## 🎁 About Student Memorial Lobby L2D File Acquisition

1. Extract from the game yourself
2. Go to [Kivotos Library](https://kivo.fun/), navigate to `Character Collection` — `Switch to Appreciation Mode` — `Memorial Lobby` to capture the files yourself

## 💖 Best Practices Based on This Project

> Thank you to all the experts who use this project for further improving it 😭😭😭
>
> Welcome other experts to submit best practices through Issues ❤❤❤

1. [Home - 杏仁レモンティー](https://apricotlemontea.com/)
2. [ElectroHeavenVN's Homepage](https://electroheavenvn.github.io/homepage/)

## 📄 License & Copyright Notice

### Source code

The **program source code** in this repository (Vue / TypeScript / build scripts, etc., excluding game asset files below) is released under the [MIT License](./LICENSE).

### Game and non-code assets

The following materials that may appear in this repository or on the demo site are owned by **Nexon / Yostar** (*Blue Archive* / 《蔚蓝档案》) and related rights holders. They are **not** covered by the MIT license:

| Type | Typical paths |
|------|----------------|
| Spine / Live2D character models & animations | `public/l2d/` |
| Character voice lines | `zh-CN/` / `ja-JP/` under each character's `memorialLobbies[].path` (e.g. `public/l2d/aris_battle/ja-JP/*.mp3`, named after spine talk event keys) |
| In-game UI art, curtains, loading assets, etc. | `public/shitim/`, parts of `public/img/` |
| Character dialogue text | Locale `memorialLobbies[].voice`, etc. |

### Use & forking

- These assets are for **personal, non-commercial** fan display only. **Do not use them commercially**, in paid services, or for resale.
- **If you fork, deploy, or redistribute**, you are **solely responsible** for complying with applicable law and Nexon / Yostar policies. The maintainers are not liable for claims arising from your use of game assets.
- This repo **does not grant** any commercial license for game materials. Before going public, **replace assets you are not entitled to use**, or ship only the code/config scaffold.

Other third-party assets follow their own licenses (e.g. [BlueArchive-Cursors](https://github.com/makipom/BlueArchive-Cursors) is MIT; see each package’s repo for npm deps such as [ba-click-fx](https://www.npmjs.com/package/ba-click-fx)).

## ⭐ Star History

<a href="https://star-history.com/#sf-yuzifu/BA-style-homepage&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=sf-yuzifu/BA-style-homepage&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=sf-yuzifu/BA-style-homepage&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=sf-yuzifu/BA-style-homepage&type=Date" />
  </picture>
</a>
