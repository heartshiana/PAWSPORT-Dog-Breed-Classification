"""
PAWSPORT - Python Backend Server
Flask API for dog breed classification using TensorFlow/Keras
"""

import os
import sys
import json
import base64
import requests
import numpy as np
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

# ── TensorFlow import (graceful fallback for demo mode) ──────────────────────
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("[WARN] TensorFlow not installed. Running in DEMO mode.")

app = Flask(__name__)
CORS(app)

# ── Configuration ─────────────────────────────────────────────────────────────
MODEL_PATH = r"D:\[Downloads]\20240717-180059_full-image-set-mobilev2-Adam.h5"
WEATHER_API_KEY = "4d4eb08337c740c6908da321d314e1b1"
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"
IMG_SIZE = (224, 224)

# ── Breed / Origin / Description data ────────────────────────────────────────
BREEDS = [
    "Bernese Mountain Dog",
    "Border Collie",
    "Chihuahua",
    "Corgi",
    "Dachshund",
    "Golden Retriever",
    "Jack Russell Terrier",
    "Pug",
    "Siberian Husky",
]

BREED_ORIGIN = {
    "Bernese Mountain Dog":  {"country": "Switzerland",      "city": "Bern",        "lat": 46.9480, "lon": 7.4474},
    "Border Collie":         {"country": "United Kingdom",   "city": "Edinburgh",   "lat": 55.9533, "lon": -3.1883},
    "Chihuahua":             {"country": "Mexico",           "city": "Chihuahua",   "lat": 28.6320, "lon": -106.0691},
    "Corgi":                 {"country": "Wales",            "city": "Cardiff",     "lat": 51.4816, "lon": -3.1791},
    "Dachshund":             {"country": "Germany",          "city": "Berlin",      "lat": 52.5200, "lon": 13.4050},
    "Golden Retriever":      {"country": "Scotland",         "city": "Inverness",   "lat": 57.4778, "lon": -4.2247},
    "Jack Russell Terrier":  {"country": "England",          "city": "London",      "lat": 51.5074, "lon": -0.1278},
    "Pug":                   {"country": "China",            "city": "Beijing",     "lat": 39.9042, "lon": 116.4074},
    "Siberian Husky":        {"country": "Russia",           "city": "Yakutsk",     "lat": 62.0355, "lon": 129.6755},
}

BREED_DESCRIPTIONS = {
    "Bernese Mountain Dog":  "A gentle giant from the Swiss Alps, bred as a farm and draft dog. Loyal, calm, and great with families.",
    "Border Collie":         "Widely regarded as the world's most intelligent dog. Bred for herding sheep in the Anglo-Scottish border country.",
    "Chihuahua":             "The world's smallest dog breed, originating from Mexico. Bold, loyal, and full of personality despite their tiny size.",
    "Corgi":                 "A beloved herding breed from Wales, famous for being the Queen's favorite. Sturdy, cheerful, and surprisingly agile.",
    "Dachshund":             "Originally bred in Germany to hunt badgers. Known for their long body, short legs, and tenacious, curious nature.",
    "Golden Retriever":      "A friendly, reliable breed from Scotland, originally bred for retrieving game. One of the world's most popular family dogs.",
    "Jack Russell Terrier":  "An energetic, feisty terrier developed in England for fox hunting. Intelligent, determined, and loves adventure.",
    "Pug":                   "An ancient breed from China, once kept by emperors. Known for their wrinkled faces, playful nature, and big hearts.",
    "Siberian Husky":        "A working sled dog from Siberia, bred by the Chukchi people. Athletic, friendly, and built for cold endurance.",
}

BREED_EMOJIS = {
    "Bernese Mountain Dog":  "🏔️",
    "Border Collie":         "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "Chihuahua":             "🌵",
    "Corgi":                 "👑",
    "Dachshund":             "🌭",
    "Golden Retriever":      "🌟",
    "Jack Russell Terrier":  "🦊",
    "Pug":                   "🏮",
    "Siberian Husky":        "❄️",
}

# ── Model loading ─────────────────────────────────────────────────────────────
model = None

def load_model():
    global model
    if not TF_AVAILABLE:
        print("[INFO] TF unavailable — demo mode active.")
        return
    if not os.path.exists(MODEL_PATH):
        print(f"[WARN] Model not found at: {MODEL_PATH}")
        print("[INFO] Running in DEMO mode.")
        return
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        print("[OK] Model loaded successfully.")
    except Exception as e:
        print(f"[ERROR] Could not load model: {e}")

# ── Image preprocessing ───────────────────────────────────────────────────────
def preprocess_image(image_data: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_data)).convert("RGB")
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

# ── Weather fetch ─────────────────────────────────────────────────────────────
def get_weather(lat: float, lon: float, city: str) -> dict:
    try:
        params = {
            "lat": lat, "lon": lon,
            "appid": WEATHER_API_KEY,
            "units": "metric",
        }
        resp = requests.get(WEATHER_API_URL, params=params, timeout=5)
        data = resp.json()
        if resp.status_code == 200:
            return {
                "temp_c":      round(data["main"]["temp"]),
                "feels_like":  round(data["main"]["feels_like"]),
                "humidity":    data["main"]["humidity"],
                "description": data["weather"][0]["description"].title(),
                "icon":        data["weather"][0]["icon"],
                "city":        data.get("name", city),
                "wind_speed":  round(data["wind"]["speed"] * 3.6),   # m/s → km/h
            }
    except Exception as e:
        print(f"[WARN] Weather fetch failed: {e}")
    return {
        "temp_c": "N/A", "feels_like": "N/A", "humidity": "N/A",
        "description": "Unavailable", "icon": "01d",
        "city": city, "wind_speed": "N/A",
    }

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None, "demo_mode": model is None})

@app.route("/analyze", methods=["POST"])
def analyze():
    # ── Accept image from multipart OR base64 JSON ────────────────────────────
    image_bytes = None

    if "image" in request.files:
        image_bytes = request.files["image"].read()
    elif request.is_json:
        body = request.get_json()
        b64 = body.get("image_base64", "")
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)
    else:
        return jsonify({"error": "No image provided"}), 400

    if not image_bytes:
        return jsonify({"error": "Empty image data"}), 400

    # ── Validate it's actually an image ───────────────────────────────────────
    try:
        Image.open(BytesIO(image_bytes)).verify()
    except Exception:
        return jsonify({"error": "Invalid image file. Please upload a JPG or PNG."}), 400

    # ── Predict ───────────────────────────────────────────────────────────────
    if model is not None:
        try:
            tensor = preprocess_image(image_bytes)
            preds  = model.predict(tensor)[0]
            idx    = int(np.argmax(preds))
            conf   = float(preds[idx])
            if idx >= len(BREEDS):
                breed = "Unknown"
                conf  = 0.0
            else:
                breed = BREEDS[idx]
        except Exception as e:
            return jsonify({"error": f"Model inference failed: {str(e)}"}), 500
    else:
        # Demo mode: cycle pseudo-randomly by image size
        import random
        random.seed(len(image_bytes))
        breed = random.choice(BREEDS)
        conf  = round(random.uniform(0.72, 0.98), 4)

    # ── Origin + Weather ──────────────────────────────────────────────────────
    if breed not in BREED_ORIGIN:
        return jsonify({
            "breed":       "Unknown breed (outside supported classes)",
            "confidence":  0,
            "origin":      "Unknown",
            "description": "This breed could not be identified within our supported classes.",
            "emoji":       "🐕",
            "weather":     {},
        })

    origin  = BREED_ORIGIN[breed]
    weather = get_weather(origin["lat"], origin["lon"], origin["city"])

    return jsonify({
        "breed":       breed,
        "confidence":  round(conf * 100, 1),
        "origin":      origin["country"],
        "city":        origin["city"],
        "description": BREED_DESCRIPTIONS[breed],
        "emoji":       BREED_EMOJIS[breed],
        "weather":     weather,
    })

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("PORT", 5000))
    print(f"[PAWSPORT] Server running on http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
