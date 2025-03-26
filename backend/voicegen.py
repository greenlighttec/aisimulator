import requests
from typing import Generator
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TTS_URL = "https://api.openai.com/v1/audio/speech"
DEFAULT_MODEL = "tts-1-hd"
DEFAULT_VOICE = "nova"

def text_to_voice_stream(text: str, voice: str = DEFAULT_VOICE, model: str = DEFAULT_MODEL) -> Generator[bytes, None, None]:
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "input": text,
        "voice": voice
    }

    response = requests.post(TTS_URL, headers=headers, json=payload, stream=True)
    response.raise_for_status()
    return response.iter_content(chunk_size=1024)
