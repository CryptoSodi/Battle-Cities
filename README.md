[![Build status](https://travis-ci.com/dogballs/cattle-bity.svg?branch=master)](https://travis-ci.com/dogballs/cattle-bity)

### [Play web version](https://dogballs.github.io/cattle-bity/)

Note: mobile not supported

[Screenshots](docs/screenshots.md)

## Description

Clone of Battle City by Namco (1985) written from scratch in TypeScript.

Project is not commercial and was created for learning purposes only.

## Features

- Single player mode
- Multi player mode (2 players on one PC)
- Original 35 maps
- Level editor
  - Save to JSON
  - Load from JSON to continue editing
- Modes
  - Custom maps - load your own maps created in editor
- Keyboard and gamepad support
- Settings
  - Customize keybindings
  - Mute audio

## Deployment Environments

Online matches use the Vercel game client and one native Ubuntu backend:

| Project | Required multiplayer environment |
| --- | --- |
| Vercel game client | `BATTLECITY_API_BASE_URL=https://api.battlecities.com` |
| Ubuntu API + broadcaster | `BATTLECITY_EMBED_BROADCASTER=1`, PostgreSQL, and private server secrets |

See [Deployment Environment Setup](docs/environment-setup.md) for the complete
environment contract. See
[Headless WebRTC Broadcaster](docs/headless-broadcaster.md) for broadcaster
runtime and service API details.

For the single-process Ubuntu API, broadcaster, PostgreSQL, and HTTPS deployment, see
[BattleCities Ubuntu deployment](deploy/ubuntu/README.md).

## License

**MIT**

See `LICENSE.md` and `docs/legal/MIT`
