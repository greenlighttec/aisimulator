import { useEffect, useRef, useState } from "react";
import { startSession, runStep } from "@/lib/api";
import { getBackgroundUrl, setBackgroundUrl } from "@/lib/backgroundCache";
import { getCharacterMoodUrl, hasCharacter, setCharacterMoods } from "@/lib/characterCache";

interface Block {
  type: "narration" | "dialogue" | "character_prompt" | "story_prompt";
  text?: string;
  speaker?: string;
  appearance?: string;
  mood?: "neutral" | "happy" | "sad" | "excited";
  description?: string;
  character?: string;
  question?: string;
  choices?: string[];
}

export default function Home() {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [started, setStarted] = useState(false);
  const [sceneQueue, setSceneQueue] = useState<Block[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [backgroundUrl, setBackgroundUrlState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [preloadedStep, setPreloadedStep] = useState<Awaited<ReturnType<typeof runStep>> | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [characterSpriteUrl, setCharacterSpriteUrl] = useState<string | null>(null);

  // Track which characters are currently being generated to avoid duplicate requests
  const generatingCharactersRef = useRef<Set<string>>(new Set());

  const currentBlock = sceneQueue[currentIndex];

  useEffect(() => {
    (window as unknown as Record<string, unknown>).debug = {
      sceneQueue,
      currentBlock,
      currentIndex,
      assistantId,
      threadId
    };
  }, [sceneQueue, currentBlock, currentIndex, assistantId, threadId]);

  useEffect(() => {
    if (
      voiceEnabled &&
      currentBlock &&
      ["narration", "dialogue"].includes(currentBlock.type) &&
      currentBlock.text
    ) {
      fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentBlock.text })
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
        });
    }
  }, [currentBlock, voiceEnabled]);

  // Handle character sprite display and generation
  useEffect(() => {
    if (!currentBlock || currentBlock.type !== "dialogue" || !currentBlock.speaker) {
      setCharacterSpriteUrl(null);
      return;
    }

    const speaker = currentBlock.speaker;
    const mood = currentBlock.mood || "neutral";

    // Check cache for existing mood image
    const cachedUrl = getCharacterMoodUrl(speaker, mood);
    if (cachedUrl) {
      setCharacterSpriteUrl(cachedUrl);
      return;
    }

    // If this character has an appearance and hasn't been generated yet, generate them
    if (currentBlock.appearance && !hasCharacter(speaker) && !generatingCharactersRef.current.has(speaker)) {
      generatingCharactersRef.current.add(speaker);
      setCharacterSpriteUrl(null);

      fetch("/api/generate_character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: speaker,
          description: currentBlock.appearance
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.moods) {
            setCharacterMoods(speaker, data.moods);
            // Show the current mood now that it's ready
            const url = data.moods[mood] || data.moods["neutral"];
            if (url) setCharacterSpriteUrl(url);
          }
        })
        .catch((err) => console.error("Character generation failed:", err))
        .finally(() => generatingCharactersRef.current.delete(speaker));
    } else if (hasCharacter(speaker)) {
      // Character exists but we don't have this specific mood cached — show neutral fallback
      const fallback = getCharacterMoodUrl(speaker, "neutral");
      setCharacterSpriteUrl(fallback);
    } else {
      setCharacterSpriteUrl(null);
    }
  }, [currentBlock]);

  const speakerColorsRef = useRef<{ [name: string]: string }>({});

  const getColorForSpeaker = (name: string) => {
    if (!speakerColorsRef.current[name]) {
      const colors = ["text-red-400", "text-green-400", "text-blue-400", "text-yellow-400", "text-purple-400"];
      const color = colors[Object.keys(speakerColorsRef.current).length % colors.length];
      speakerColorsRef.current[name] = color;
    }
    return speakerColorsRef.current[name];
  };

  const updateBackground = (sceneId: string, url: string | null) => {
    if (!url) return;
    setBackgroundUrl(sceneId, url);
    setBackgroundUrlState(url);
  };

  // Scan blocks for new characters and pre-generate their portraits
  const preGenerateCharacters = (blocks: Block[]) => {
    for (const block of blocks) {
      if (
        block.type === "dialogue" &&
        block.speaker &&
        block.appearance &&
        !hasCharacter(block.speaker) &&
        !generatingCharactersRef.current.has(block.speaker)
      ) {
        generatingCharactersRef.current.add(block.speaker);
        fetch("/api/generate_character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character: block.speaker,
            description: block.appearance
          })
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.moods) {
              setCharacterMoods(block.speaker!, data.moods);
            }
          })
          .catch((err) => console.error("Character pre-generation failed:", err))
          .finally(() => generatingCharactersRef.current.delete(block.speaker!));
      }
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    const res = await startSession({ name, prompt });
    setAssistantId(res.assistant_id);
    setThreadId(res.thread_id);
    setInstructions(res.instructions);

    // Preload the first step while user reads instructions
    const step = await runStep({
      assistant_id: res.assistant_id,
      thread_id: res.thread_id,
      message: `Start the story for ${name}.`
    });
    setPreloadedStep(step);

    const sceneId = String(step.scene_id || "unknown_scene");
    let background = getBackgroundUrl(sceneId);

    if (!background && step.description) {
      const resBg = await fetch(`/api/load_background?scene_id=${sceneId}&description=${encodeURIComponent(step.description)}`);
      const data = await resBg.json();
      background = data.url;
      updateBackground(sceneId, background);
    } else {
      setBackgroundUrlState(background);
    }

    // Pre-generate characters while user reads instructions
    if (step.blocks) {
      preGenerateCharacters(step.blocks);
    }

    setIsLoading(false);
  };

  const beginGame = async () => {
    if (!preloadedStep) return;
    setIsLoading(true);
    setStarted(true);
    const blocks = preloadedStep.blocks || [];
    setSceneQueue(blocks);
    setCurrentIndex(0);
    setIsLoading(false);
  };

  const handleAdvance = () => {
    if (currentIndex < sceneQueue.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || !assistantId || !threadId) return;
    setIsLoading(true);
    setSceneQueue([]);
    setCurrentIndex(0);
    setCharacterSpriteUrl(null);
    const step = await runStep({ assistant_id: assistantId, thread_id: threadId, message: input });
    const sceneId = String(step.scene_id || "unknown_scene");
    let background = getBackgroundUrl(sceneId);
    setInput("");
    const blocks = step.blocks as Block[];
    setSceneQueue(blocks);

    // Pre-generate any new characters in this scene
    preGenerateCharacters(blocks);

    if (!background && step.description) {
      const res = await fetch(`/api/load_background?scene_id=${sceneId}&description=${encodeURIComponent(step.description)}`);
      const data = await res.json();
      background = data.url;
      updateBackground(sceneId, background);
    } else {
      setBackgroundUrlState(background);
    }
    setIsLoading(false);
  };

  if (!assistantId) {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">AI Visual Novel</h1>
        <input
          placeholder="Your name"
          className="border px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          placeholder="Story prompt (e.g., haunted castle)"
          className="border px-3 py-4 w-full h-32"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button onClick={handleStart} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={isLoading}>
          {isLoading ? "Preparing..." : "Generate Story Instructions"}
        </button>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(e) => setVoiceEnabled(e.target.checked)}
          />
          <label>Enable Voice Narration</label>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <div className="relative w-full h-screen overflow-hidden text-white">
        {backgroundUrl && (
          <img src={backgroundUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0" />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-70 p-6 z-10 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold mb-4">Story Setup Instructions</h2>
          <pre className="bg-gray-900 text-green-300 p-4 rounded w-full max-w-3xl max-h-96 overflow-auto text-sm whitespace-pre-wrap">
            {instructions}
          </pre>
          <button onClick={beginGame} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded">
            Begin Story
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden text-white">
      {backgroundUrl && (
        <img src={backgroundUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0" />
      )}

      {/* Character sprite */}
      {characterSpriteUrl && currentBlock?.type === "dialogue" && (
        <div className="absolute bottom-32 left-8 z-10">
          <img
            src={characterSpriteUrl}
            alt={currentBlock.speaker || "Character"}
            className="h-80 w-auto object-contain drop-shadow-lg"
          />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black bg-opacity-60 p-6">
        {currentBlock?.type === "dialogue" && (
          <div className={characterSpriteUrl ? "ml-72" : ""}>
            <div className={`font-bold mb-1 ${getColorForSpeaker(currentBlock.speaker || "")}`}>{currentBlock.speaker}</div>
            <div className={`${getColorForSpeaker(currentBlock.speaker || "")}`}>{currentBlock.text}</div>
          </div>
        )}
        {currentBlock?.type === "narration" && (
          <div className="text-center italic">{currentBlock.text}</div>
        )}
        {currentBlock?.type === "character_prompt" && (
          <div className="space-y-2">
            <div className="text-yellow-300">Character: {currentBlock.character}</div>
            <div className="italic">{currentBlock.question}</div>
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 p-2 bg-white text-black rounded"
                placeholder="Describe this character..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded"
                disabled={isLoading || !input.trim()}
              >
                Go
              </button>
            </div>
          </div>
        )}
        {currentBlock?.type === "story_prompt" && (
          <div className="space-y-2">
            <div className="text-yellow-300">Character: {currentBlock.character}</div>
            <div className="italic">{currentBlock.question}</div>
            <div className="space-y-2">
              <div className="italic">What will you do?</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentBlock.choices?.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(option)}
                    className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 p-2 bg-white text-black rounded"
                  placeholder="Or enter your own..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                  disabled={isLoading || !input.trim()}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        )}
        {!isLoading && currentBlock && !["character_prompt", "story_prompt"].includes(currentBlock.type) && currentIndex < sceneQueue.length - 1 && (
          <button onClick={handleAdvance} className="mt-4 bg-white text-black px-4 py-2 rounded">
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
