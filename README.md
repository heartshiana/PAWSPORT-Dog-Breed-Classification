<img width="1354" height="496" alt="image" src="https://github.com/user-attachments/assets/44528062-808b-4e0e-ba47-07ac2c8cdb32" /># PAWSPORT — Setup Guide


## Quickstart (Windows)

1. Double-click **`launch.bat`**
   - It checks for Node.js and Python automatically
   - Installs all dependencies if missing
   - Launches the full app

That's it. `launch.bat` handles everything.

---

## Manual Setup

### Prerequisites
| Tool | Version | Link |
|---|---|---|
| Node.js + npm | 18+ | https://nodejs.org |
| Python | 3.9+ | https://python.org |

### Step 1 — Install Python dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Set your model path
Open `server.py` and update line 20:
```python
MODEL_PATH = r"D:\[Downloads]\20240717-180059_full-image-set-mobilev2-Adam.h5"
```
Change the path to wherever your `.h5` file actually lives.

> **No model?** The app runs in demo mode with random predictions — useful for UI testing.

### Step 3 — Install Node dependencies
```bash
npm install
```

### Step 4 — Launch
```bash
npm start
```
Electron will automatically start `server.py` in the background.

---

## File Structure

```
PAWSPORT/
├── launch.bat       ← Double-click to run on Windows
├── main.js          ← Electron entry (spawns Python, creates window)
├── preload.js       ← Secure IPC bridge (contextBridge)
├── index.html       ← UI layout
├── styles.css       ← Passport-themed styles
├── renderer.js      ← Frontend logic
├── server.py        ← Flask + TensorFlow backend
├── requirements.txt ← Python deps
└── package.json     ← Node/Electron config
```

---

## Supported Breeds

| Breed | Homeland |
|---|---|
| Bernese Mountain Dog | Switzerland |
| Border Collie | United Kingdom |
| Chihuahua | Mexico |
| Corgi | Wales |
| Dachshund | Germany |
| Golden Retriever | Scotland |
| Jack Russell Terrier | England |
| Pug | China |
| Siberian Husky | Russia |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `server.py not found` | You're using Electron Fiddle — **don't**. Use `npm start` from the project folder. |
| `PID: undefined` | Same as above — Fiddle's sandbox blocks `spawn`. |
| Python not found | Install Python from python.org and make sure it's on your PATH |
| `npm install` fails | Check internet connection; run as Administrator if on Windows |
| Weather shows N/A | Check internet; OpenWeatherMap key is pre-configured |
| Model not loading | Verify `MODEL_PATH` in `server.py` points to your `.h5` file |
| TensorFlow install error | Try `pip install tensorflow-cpu` instead |

---

## API Key

OpenWeatherMap key is pre-configured in `server.py`. No action needed.

---

## Author

Heart Shiana Ursua

![Uploading UI (1).png…]()
<img width="1354" height="496" alt="UI (2)" src="https://github.com/user-attachments/assets/ef6fc857-41c0-4377-92c7-20344326b46b" />




