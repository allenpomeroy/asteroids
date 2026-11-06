# Asteroids Enhanced (self-hosted)

A standalone, original HTML5 Canvas Asteroids-style game for Rocky Linux 10.
It runs in a browser and can be served to other devices on your LAN. No MAME,
ROM files, external JavaScript libraries, analytics, or internet connection are
needed after installation.

## Features

- Vector-style ship, asteroids, bullets, saucers, particles and screen wrapping
- Three asteroid sizes, splitting, progressive waves and increasing difficulty
- Score, lives, extra life every 10,000 points, pause and game-over screen
- Keyboard controls and touch controls for phones/tablets
- Sound effects generated with Web Audio (starts after user interaction)
- High scores stored locally in each browser's local storage
- Responsive layout and full-screen button

This is an independent implementation inspired by classic vector arcade
gameplay. It is not the AARP/Arkadium game and does not include their code,
artwork, sounds, or branding.

## 1. Install prerequisites on Rocky Linux 10

```bash
sudo dnf install -y python3
```

Python's built-in HTTP server is sufficient for a small private LAN game.
For a persistent service, the included systemd unit runs it as a dedicated
unprivileged account.

## 2. Install the files

Extract the ZIP, then copy the project to `/opt/asteroids-web`:

```bash
unzip asteroids-web-enhanced.zip
sudo mkdir -p /opt/asteroids-web
sudo cp -a asteroids-web-enhanced/public /opt/asteroids-web/
sudo chown -R root:root /opt/asteroids-web
sudo chmod -R a=rX /opt/asteroids-web
```

If you extracted the archive somewhere else, adjust the source path to the
actual extracted directory.

## 3. Test interactively first

```bash
cd /opt/asteroids-web/public
python3 -m http.server 8080 --bind 0.0.0.0
```

From the Rocky Linux desktop, open:

http://localhost:8080

From another device on the same LAN, open:

http://ROCKY-LINUX-IP:8080

Find the server's LAN address with:

```bash
hostname -I
```

Stop the temporary server with `Ctrl+C`.

## 4. Run persistently with systemd

Create a dedicated account and install the service:

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin asteroids 2>/dev/null || true
sudo cp systemd/asteroids-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now asteroids-web
sudo systemctl status asteroids-web
```

The service listens on TCP port 8080 on all interfaces.

Check logs:

```bash
sudo journalctl -u asteroids-web -f
```

## 5. Open the firewall (LAN only)

If firewalld is active, allow TCP/8080. Prefer restricting access to your
trusted LAN zone/subnet rather than opening this service to the public internet.

For a simple trusted-home-LAN setup:

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=home --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

Replace `home` with the active zone reported by `--get-active-zones`.
If you use a different firewall zone, apply the rule to that zone.

Then browse to `http://ROCKY-LINUX-IP:8080`.

## Controls

| Action | Keyboard |
|---|---|
| Rotate left/right | Left/Right arrows or A/D |
| Thrust | Up arrow or W |
| Fire | Space |
| Hyperspace | Shift |
| Start / launch | Enter |
| Pause / resume | P or Escape |
| Sound mute | M |

On touchscreens, use the on-screen left/right/thrust/fire buttons. Touch controls
are displayed automatically on narrow/touch-oriented screens.

## Configuration and notes

- High scores are saved in the browser that played the game, not centrally.
  Each browser/device maintains its own local score table.
- Port 8080 is configurable by editing the `ExecStart` line in the systemd
  unit and then reloading/restarting systemd.
- This basic Python server is appropriate for a trusted LAN. Do not expose it
  directly to the public internet. For remote access, use a VPN such as
  WireGuard/Tailscale or a properly configured reverse proxy with HTTPS and
  access controls.
- The server serves static files only; it does not accept uploads or run
  application-side user code.


## Audio and responsiveness notes

The updated build explicitly unlocks/resumes Web Audio on pointer or keyboard
interaction, raises the effect levels, and makes the Sound control play a short
test tone when sound is enabled. If there is still no sound, check the browser
tab/site mute state, OS output device and volume, and whether the browser has
audio permission.

Movement for asteroids, bullets and particles is now elapsed-time based (with
the existing rock speeds retained approximately), rather than advancing by a
fixed amount per rendered frame. Ship turning, thrust and top speed have been
increased modestly. The canvas glow was reduced to lower rendering overhead.
