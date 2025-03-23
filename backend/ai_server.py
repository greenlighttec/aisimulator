from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import openai
import os
import requests
import json
import uuid

app = Flask(__name__)
CORS(app)


openai_api_key = os.environ.get("OPENAI_API_KEY")
client = openai.OpenAI(api_key=openai_api_key)

@app.route("api/end_game", methods=["POST"])
def end_game():
    data = request.json
    assistant_id = data["assistant_id"]
    thread_id = data["thread_id"]

    try:
        client.beta.assistants.delete(assistant_id)
        client.beta.threads.delete(thread_id)
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("api/run_step", methods=["POST"])
def run_step():
    data = request.json
    assistant_id = data["assistant_id"]
    thread_id = data["thread_id"]
    player_input = data["message"]

    try:
        # Add the player's message to the thread
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=player_input
        )

        # Create the run (non-streaming)
        run = client.beta.threads.runs.create(
            assistant_id=assistant_id,
            thread_id=thread_id
        )

        # Poll for completion
        import time
        while True:
            run_status = client.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
            if run_status.status in ["completed", "failed", "cancelled"]:
                break
            time.sleep(0.5)

        if run_status.status != "completed":
            return jsonify({"error": f"Run status: {run_status.status}"}), 500

        # Fetch messages
        messages = client.beta.threads.messages.list(thread_id=thread_id)

        # Get the last assistant message
        for msg in messages.data:
            if msg.role == "assistant":
                assistant_msg = msg
                break
        else:
            return jsonify({"error": "No assistant message returned."}), 500

        # Expecting a structured JSON array in the assistant message
        content = assistant_msg.content[0].text.value

        try:
            blocks = json.loads(content)
        except Exception as e:
            return jsonify({"error": f"Invalid JSON format from assistant: {str(e)}", "raw": content}), 500

        return jsonify({"blocks": blocks})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("api/setup_game", methods=["POST"])
def setup_game():
    data = request.json
    name = data.get("name", "Player")
    prompt = data.get("prompt", "an adventure")
    characters = data.get("characters", [])  # Optional array of named characters/roles

    # Build the setup prompt for GPT-4
    system_prompt = (
        "You are helping design a narrative-driven visual novel powered by an AI storyteller. "
        "The player has input a general story prompt and may have specified named characters. "
        "Generate a concise set of instructions for the AI storyteller persona that:\n"
        "- Establishes tone and world rules\n"
        "- Describes the main character (the player)\n"
        "- Incorporates any defined characters\n"
        "- Ensures the Assistant responds as a storyteller, not a chatbot\n"
        "- Focuses on immersive, branching narrative\n\n"

    )

    character_section = ""
    if characters:
        for char in characters:
            character_section += f"\n- {char.get('name')} — {char.get('role')}"

    user_prompt = (
        f"Player Name: {name}\n"
        f"Story Prompt: {prompt}\n"
        f"Characters: {character_section or 'None specified'}"
    )

    try:
        # Step 1: Use GPT-4 to build persona
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.9
        )

        raw_response = completion.choices[0].message.content
        print("RAW AI RESPONSE:", raw_response)

        instructions = raw_response.strip()

        # Append the strict schema requirements
        instructions += """

        ---

        📦 All Assistant replies must be returned as a JSON array of scene blocks.
        Each object in the array must follow this structure exactly:

        1. { "type": "narration", "text": string }
           - Used for world-building or description.
           - `text` is required.

        2. { "type": "dialogue", "speaker": string, "text": string, "state": string | null, "mood": "sad" | "happy" | "neutral" | "excited" }
           - Represents a line of speech from a character.
           - `speaker` must be the character’s name.
           - `text` is the dialogue line.
           - `state` is DALL-E instructions to generate the new image for the character. Leave this null if no changes to physical attributes are required. Make sure it always contains the physical description so image can be generated. Avoid likening to real life people by name to avoid compliance or legal issues.
           - `mood` is the one word name that will be used to call the correct image of the character to display. Must be `sad`, `happy`, `neutral`, `excited`

        3. { "type": "background", "description": string }
           - Triggers a background change.
           - `description` is a rich visual scene description used for DALL·E image generation.

        4. { "type": "character_prompt", "character": string, "question": string }
           - Used to ask the player for more info about a new or underdefined character, specifically new personality traits. Should only be done once to define a baseline. AI Storyteller should be inferring and maturing personality traits and behavior based on the baseline, and decisions made since. If explicitly requested, can prompt for additional or adjusted baseline.
           - `character` is the name of the person in question.
           - `question` is what the Assistant wants to know.

        5. { "type": "story_prompt", "character": string, "question": string, "choices": [string, string, ...] }
           - Used to ask the player what they want to do next to progress the story.
           - `character` is the name of the person in question.
           - `question` is what the Assistant wants to know.
           - `choices` is an array of strings, containing possible responses the AI Storyteller suggests to the player to keep the story on the right branch. A custom branch can aways be entered by choosing "Other" on the front end. AI Storyteller needs to provide 2 to 5 choices to move the story forward, that is returned in the array.

        Rules:
        - Every reply must be a **single JSON array**. No extra explanation or commentary. Each block should end with a story_prompt, unless a character_prompt is needed.
        - Do **not** include Markdown formatting or triple backticks.
        - Use only the field names and values shown above — this is a typed interface.

        """

        # Step 2: Create Assistant
        assistant = client.beta.assistants.create(
            model="gpt-4o",
            instructions=instructions
        )

        # Step 3: Create thread
        thread = client.beta.threads.create()

        return jsonify({
            "assistant_id": assistant.id,
            "thread_id": thread.id,
            "instructions": instructions  # optional to display/verify
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# The below route is legacy and will be removed or updated at some point
@app.route("api/generate", methods=["POST"])
def generate():
    data = request.json
    player_name = data.get("name", "Player")
    prompt = data.get("prompt", "an adventure")
    scene_id = data.get("scene_id", "root")

    system_prompt = (
        "You are an AI storyteller for a visual novel. "
        "Given a player's name and story idea, generate two possible next scenes. "
        "Each scene should have:\n"
        "- label: a short player-facing option label\n"
        "- scene_id: a unique string like 'scene_abc123'\n"
        "- story: short narration (2–3 lines)\n"
        "- character_line: something a character says\n"
        "- background_description: a visual prompt for an AI image model\n\n"
        "Return JSON with 'scene_id' for the current one, and 'choices' as a list of 2 scenes."
    )

    user_prompt = f"Player name: {player_name}\nPrompt: {prompt}\nCurrent Scene ID: {scene_id}"

    try:
        # Generate scenes with GPT-4
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.9
        )

        # Parse the JSON result
        reply_text = completion.choices[0].message.content
        response_data = eval(reply_text)

        for choice in response_data["choices"]:
            scene_filename = f"{choice['scene_id']}.json"
            image_filename = f"{choice['scene_id']}.jpg"

            # Generate background image with DALL·E
            dalle_response = client.images.generate(
                model="dall-e-3",
                prompt=choice["background_description"],
                size="1024x1024",
                quality="standard",
                n=1
            )

            image_url = dalle_response.data[0].url
            image_data = requests.get(image_url).content

            # Save image
            with open(os.path.join(RENPY_GAME_FOLDER, image_filename), "wb") as f:
                f.write(image_data)

            # Save JSON
            with open(os.path.join(RENPY_GAME_FOLDER, scene_filename), "w", encoding="utf-8") as f:
                json.dump(choice, f, ensure_ascii=False, indent=2)

        return jsonify({
            "scene_id": scene_id,
            "choices": [
                {
                    "label": response_data["choices"][0]["label"],
                    "scene_id": response_data["choices"][0]["scene_id"]
                },
                {
                    "label": response_data["choices"][1]["label"],
                    "scene_id": response_data["choices"][1]["scene_id"]
                }
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("api/scene/<scene_id>", methods=["GET"])
def get_scene(scene_id):
    try:
        scene_path = os.path.join(RENPY_GAME_FOLDER, f"{scene_id}.json")
        with open(scene_path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 404


if __name__ == "__main__":
    app.run(port=5000)
