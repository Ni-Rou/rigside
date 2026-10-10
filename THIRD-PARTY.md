# Other people's work in Rigside

## Fonts (`src/fonts/`)

These all come from Google Fonts (via Fontsource) and use the SIL Open Font License 1.1: Inter,
JetBrains Mono, Rajdhani, Exo 2, IBM Plex Mono, Oswald, Fraunces, Lora, Nunito, Silkscreen, VT323,
Pixelify Sans, Orbitron, Chakra Petch and Share Tech Mono. Their copyright notices and the licence text are
in `src/fonts/OFL.txt`.

## Icons

The settings gear is from [Lucide](https://lucide.dev), ISC License, Copyright (c) 2026 Lucide Icons and
Contributors. The full notice sits next to it in `src/js/icons.js`. The other icons are my own.

## What goes over the network

Weather, air quality and place search come from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Your PC
asks them directly, for the place you picked.

For updates, Rigside downloads a small file from GitHub at most once a day to see if there's a newer
version. It's a normal web request and Rigside doesn't add anything about you or your PC, though GitHub
sees the request like it would any other. You can turn it off in Settings → About ("Check for updates at
start-up"), and "Check now" still works whenever you want.

That's everything. No account, no analytics, no telemetry.

## Rust crates

Tauri and its plugins (MIT/Apache-2.0), windows-rs (MIT/Apache-2.0), sysinfo (MIT), nvml-wrapper
(MIT/Apache-2.0), rustfft (MIT/Apache-2.0), ureq (MIT/Apache-2.0), serde (MIT/Apache-2.0) and base64
(MIT/Apache-2.0).

## Themes

The themes are original art, loosely inspired by broad game genres (cyberpunk, post-apocalyptic, fantasy,
retro and so on). They don't use any game's names, logos, characters, screenshots, fonts or sounds, and
Rigside isn't affiliated with or endorsed by any game, developer or publisher.
