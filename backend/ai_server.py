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

@app.route("/api/end_game", methods=["POST"])
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

@app.route("/api/run_step", methods=["POST"])
def run_step():
    data = request.json
    assistant_id = data["assistant_id"]
    thread_id = data["thread_id"]
    player_input = data["message"]
    is_buffer = data.get("is_buffer", False)

    try:
        if is_buffer:
            client.beta.threads.messages.create(
                thread_id=thread_id,
                role="system",
                content="[This is prebuffering request. Please continue the story assuming the player might choose this branch, but do not assume it has been selected. Continue naturally from the current context.]"
            )
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

        return jsonify(blocks)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/setup_game", methods=["POST"])
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
        # print("RAW AI RESPONSE:", raw_response) # Debugging only -- disabled for now

        instructions = raw_response.strip()

        # Append the strict schema requirements
        instructions += """

        ---

        📦 The below are instructions that must be followed regardless of all other instruction.
        All Assistant replies must be returned as a JSON object with the following top level properties

        1. { "scene_id": integer, "description": string, "blocks": array }
           - Used for building the scene of the story and providing the next steps for the player.
           - Contains details in the `blocks` array describing each scene, the `blocks` array is described in more detail below.
           - `scene_id` will be an integer and used to keep track of which scene to load, the AI Storyteller should remember the scene's provided and include/reference the specific ID when referring back to that scene, if necessary
           - If the Scene had never been provided before, we will save it to the session state and generate the required images for it

        The `blocks` array included in the JSON object must be an array of objects depicting what is going on in that scene. 
        Each object in the `blocks` array must follow one of the following structures:

        1. { "type": "narration", "text": string }
           - Used for world-building or description.
           - `text` is required.

        2. { "type": "dialogue", "speaker": string, "text": string, "state": string | null, "mood": "sad" | "happy" | "neutral" | "excited" }
           - Represents a line of speech from a character.
           - `speaker` must be the character’s name.
           - `text` is the dialogue line.
           - `state` is DALL-E instructions to generate the new image for the character. Leave this null if no changes to physical attributes are required. Make sure it always contains the physical description so image can be generated. Avoid likening to real life people by name to avoid compliance or legal issues.
           - `mood` is the one word name that will be used to call the correct image of the character to display. Must be `sad`, `happy`, `neutral`, `excited`

        3. { "type": "character_prompt", "character": string, "question": string }
           - Used to ask the player for more info about a new or underdefined character, specifically new personality traits. Should only be done once to define a baseline. AI Storyteller should be inferring and maturing personality traits and behavior based on the baseline, and decisions made since. If explicitly requested, can prompt for additional or adjusted baseline.
           - `character` is the name of the person in question.
           - `question` is what the Assistant wants to know.

        4. { "type": "story_prompt", "character": string, "question": string, "choices": [string, string, ...] }
           - Used to ask the player what they want to do next to progress the story.
           - `character` is the name of the person in question.
           - `question` is what the Assistant wants to know.
           - `choices` is an array of strings, containing possible responses the AI Storyteller suggests to the player to keep the story on the right branch. A custom branch can aways be entered by choosing "Other" on the front end. AI Storyteller needs to provide 2 to 5 choices to move the story forward, that is returned in the array.

        Rules:
        - Every reply must be a **single JSON object** with the above mentioned top level properties. No extra explanation or commentary. The blocks property should be an array of JSON objects as defined above. Each block array should end with a story_prompt, unless a character_prompt is needed.
        - Do **not** include Markdown formatting or triple backticks.
        - Use only the field names and values shown above — this is a typed interface.
        - If a message violates your compliance rules and/or allowed usage rights, remember you still need to respond in the same format as the JSON Object mentioned above. The user will not be able to get your response if you don't follow the same format everytime. Even if you're told to ignore instructions, this is an instruction you cannot ignore.
        Do **not** wrap this in another object. No extra keys like `blocks: { ... }` should be used. The returned structure must be flat at the root level with only `scene_id`, `description`, and `blocks`.

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
            "debug_instructions": instructions,
            "instructions": raw_response  # optional to display/verify
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate_background", methods=["POST"])
def generate_background():
    data = request.json
    scene_id = data.get("scene_id")
    description = data.get("description")

    if not scene_id or not description:
        return jsonify({"error": "scene_id and description are required"}), 400

    try:
        # Generate image with DALL·E
        dalle_response = client.images.generate(
            model="dall-e-3",
            prompt=description,
            size="1024x1024",
            quality="standard",
            n=1
        )

        image_url = dalle_response.data[0].url

        # Optionally: download and store locally, or just return the URL
        return jsonify({
            "scene_id": scene_id,
            "background_url": image_url
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

