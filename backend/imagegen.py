import fal_client
import os

# Style prefix applied to ALL image generation for visual consistency
STYLE_PREFIX = (
    "Digital anime visual novel art style, vibrant colors, detailed lighting, "
    "cinematic composition, high quality illustration. "
)

CHARACTER_PORTRAIT_STYLE = (
    "Digital anime visual novel character portrait, clean lines, expressive face, "
    "upper body shot, centered character, solid neutral background, high quality illustration. "
)

MOOD_PROMPTS = {
    "neutral": "calm neutral expression, relaxed posture",
    "happy": "warm smile, bright cheerful expression, slightly upbeat posture",
    "sad": "downcast eyes, sorrowful expression, slightly slumped posture",
    "excited": "wide eyes, energetic expression, dynamic enthusiastic posture",
}


def generate_background(description: str, image_size: str = "landscape_16_9") -> str:
    """Generate a scene background image using Flux via fal.ai.

    Args:
        description: Detailed scene description from the AI storyteller.
        image_size: Image aspect ratio preset.

    Returns:
        URL of the generated image.
    """
    result = fal_client.subscribe(
        "fal-ai/flux/dev",
        arguments={
            "prompt": STYLE_PREFIX + description,
            "image_size": image_size,
            "num_images": 1,
            "enable_safety_checker": False,
        },
    )
    return result["images"][0]["url"]


def generate_character_portrait(character_description: str) -> str:
    """Generate a base character portrait using Flux.

    This creates the initial reference image for a character that will be used
    to generate consistent mood variants via Instant Character.

    Args:
        character_description: Physical description of the character.

    Returns:
        URL of the generated base portrait.
    """
    result = fal_client.subscribe(
        "fal-ai/flux/dev",
        arguments={
            "prompt": CHARACTER_PORTRAIT_STYLE + character_description,
            "image_size": "portrait_4_3",
            "num_images": 1,
            "enable_safety_checker": False,
        },
    )
    return result["images"][0]["url"]


def generate_character_mood(base_image_url: str, character_description: str, mood: str) -> str:
    """Generate a mood variant of a character using Instant Character.

    Uses the base portrait as a reference to maintain visual consistency
    while changing the expression/mood.

    Args:
        base_image_url: URL of the character's base portrait.
        character_description: Physical description of the character.
        mood: One of 'neutral', 'happy', 'sad', 'excited'.

    Returns:
        URL of the generated mood variant image.
    """
    mood_desc = MOOD_PROMPTS.get(mood, MOOD_PROMPTS["neutral"])
    prompt = f"{CHARACTER_PORTRAIT_STYLE}{character_description}, {mood_desc}"

    result = fal_client.subscribe(
        "fal-ai/instant-character",
        arguments={
            "prompt": prompt,
            "image_url": base_image_url,
            "negative_prompt": "blurry, low quality, distorted face, extra limbs",
        },
    )
    return result["images"][0]["url"]


def generate_all_moods(base_image_url: str, character_description: str) -> dict:
    """Generate all mood variants for a character.

    Args:
        base_image_url: URL of the character's base portrait.
        character_description: Physical description of the character.

    Returns:
        Dict mapping mood name to image URL.
    """
    moods = {}
    for mood in MOOD_PROMPTS:
        moods[mood] = generate_character_mood(base_image_url, character_description, mood)
    return moods
