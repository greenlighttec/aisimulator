import { useEffect, useRef, useState, useCallback } from "react";
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

interface PrefetchedScene {
  step: Record<string, unknown>;
  blocks: Block[];
  backgroundUrl: string | null;
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

  // Prefetch cache: maps choice text -> fully loaded scene data
  const prefetchCacheRef = useRef<Map<string, PrefetchedScene>>(new Map());
  // Track in-flight prefetch requests to avoid duplicates
  const prefetchingRef = useRef<Set<string>>(new Set());
  // Track which characters are currently being generated
  const generatingCharactersRef = useRef<Set<string>>(new Set());

  const currentBlock = sceneQueue[currentIndex];

  useEffect(() => {
    (window as unknown as Record<string, unknown>).debug = {
      sceneQueue,
      currentBlock,
      currentIndex,
      assistantId,
      threadId,
      prefetchCache: Object.fromEntries(prefetchCacheRef.current),
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

    const cachedUrl = getCharacterMoodUrl(speaker, mood);
    if (cachedUrl) {
      setCharacterSpriteUrl(cachedUrl);
      return;
    }

    if (currentBlock.appearance && !hasCharacter(speaker) && !generatingCharactersRef.current.has(speaker)) {
      generatingCharactersRef.current.add(speaker);
      setCharacterSpriteUrl(null);

      fetch("/api/generate_character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: speaker, description: currentBlock.appearance })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.moods) {
            setCharacterMoods(speaker, data.moods);
            const url = data.moods[mood] || data.moods["neutral"];
            if (url) setCharacterSpriteUrl(url);
          }
        })
        .catch((err) => console.error("Character generation failed:", err))
        .finally(() => generatingCharactersRef.current.delete(speaker));
    } else if (hasCharacter(speaker)) {
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

  // Pre-generate character portraits for blocks that have new characters
  const preGenerateCharacters = useCallback((blocks: Block[]) => {
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
          body: JSON.stringify({ character: block.speaker, description: block.appearance })
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
  }, []);

  // Load background for a scene, returns the URL
  const loadBackground = useCallback(async (step: Record<string, unknown>): Promise<string | null> => {
    const sceneId = String(step.scene_id || "unknown_scene");
    let background = getBackgroundUrl(sceneId);

    if (!background && step.description) {
      const res = await fetch(
        `/api/load_background?scene_id=${sceneId}&description=${encodeURIComponent(step.description as string)}`
      );
      const data = await res.json();
      background = data.url;
      if (background) {
        setBackgroundUrl(sceneId, background);
      }
    }
    return background;
  }, []);

  // Prefetch a single choice: run_step (buffered) + background + characters
  const prefetchChoice = useCallback(async (choice: string, aId: string, tId: string) => {
    if (prefetchCacheRef.current.has(choice) || prefetchingRef.current.has(choice)) return;
    prefetchingRef.current.add(choice);

    try {
      // Step 1: Get the AI response for this choice (buffered)
      const step = await runStep({
        assistant_id: aId,
        thread_id: tId,
        message: choice,
        is_buffer: true,
      });

      const blocks = (step.blocks || []) as Block[];

      // Step 2: Load background and pre-generate characters in parallel
      const [backgroundUrl] = await Promise.all([
        loadBackground(step),
        // Fire-and-forget character generation
        Promise.resolve(preGenerateCharacters(blocks)),
      ]);

      prefetchCacheRef.current.set(choice, {
        step,
        blocks,
        backgroundUrl,
      });
    } catch (err) {
      console.error(`Prefetch failed for choice "${choice}":`, err);
    } finally {
      prefetchingRef.current.delete(choice);
    }
  }, [loadBackground, preGenerateCharacters]);

  // Look-ahead prefetch: find the story_prompt in the current scene queue
  // and start prefetching as soon as blocks are loaded (even while player
  // is still reading narration/dialogue). This gives maximum lead time.
  useEffect(() => {
    if (!assistantId || !threadId || sceneQueue.length === 0) return;

    // Find the story_prompt block in the queue (usually the last block)
    const storyPrompt = sceneQueue.find(
      (b) => b.type === "story_prompt" && b.choices && b.choices.length > 0
    );
    if (!storyPrompt || !storyPrompt.choices) return;

    // Clear old prefetch cache when we get new blocks
    prefetchCacheRef.current.clear();
    prefetchingRef.current.clear();

    // Prefetch all offered choices in parallel
    for (const choice of storyPrompt.choices) {
      prefetchChoice(choice, assistantId, threadId);
    }
  }, [sceneQueue, assistantId, threadId, prefetchChoice]);

  const handleStart = async () => {
    setIsLoading(true);
    const res = await startSession({ name, prompt });
    setAssistantId(res.assistant_id);
    setThreadId(res.thread_id);
    setInstructions(res.instructions);

    const step = await runStep({
      assistant_id: res.assistant_id,
      thread_id: res.thread_id,
      message: `Start the story for ${name}.`
    });
    setPreloadedStep(step);

    const bg = await loadBackground(step);
    if (bg) setBackgroundUrlState(bg);

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

  // Apply a scene (from prefetch cache or fresh API call)
  const applyScene = useCallback((step: Record<string, unknown>, blocks: Block[], bg: string | null) => {
    setSceneQueue(blocks);
    setCurrentIndex(0);
    if (bg) {
      setBackgroundUrlState(bg);
    }
    preGenerateCharacters(blocks);
  }, [preGenerateCharacters]);

  const handleSubmit = async () => {
    if (!input.trim() || !assistantId || !threadId) return;
    const choiceText = input.trim();
    setIsLoading(true);
    setSceneQueue([]);
    setCurrentIndex(0);
    setCharacterSpriteUrl(null);
    setInput("");

    // Check if this choice was prefetched
    const cached = prefetchCacheRef.current.get(choiceText);
    if (cached) {
      prefetchCacheRef.current.clear();
      applyScene(cached.step, cached.blocks, cached.backgroundUrl);
      // Still need to send the real (non-buffered) message to keep the thread in sync
      // Fire this in the background — the AI already generated the response via buffer,
      // but the thread needs the real user message for continuity
      runStep({
        assistant_id: assistantId,
        thread_id: threadId,
        message: choiceText,
      }).catch((err) => console.error("Thread sync failed:", err));
      setIsLoading(false);
      return;
    }

    // No cache hit — custom input or prefetch hasn't finished. Do it live.
    prefetchCacheRef.current.clear();
    const step = await runStep({ assistant_id: assistantId, thread_id: threadId, message: choiceText });
    const blocks = step.blocks as Block[];
    const bg = await loadBackground(step);
    applyScene(step, blocks, bg);
    setIsLoading(false);
  };

  // When a choice button is clicked, set it as input and submit
  const handleChoiceSelect = (choice: string) => {
    setInput(choice);
    // Use a microtask to ensure input state is set before submit reads it
    // Actually, we can just call submit directly with the choice
    handleChoiceSubmit(choice);
  };

  const handleChoiceSubmit = async (choiceText: string) => {
    if (!choiceText.trim() || !assistantId || !threadId) return;
    setIsLoading(true);
    setSceneQueue([]);
    setCurrentIndex(0);
    setCharacterSpriteUrl(null);
    setInput("");

    const cached = prefetchCacheRef.current.get(choiceText);
    if (cached) {
      prefetchCacheRef.current.clear();
      applyScene(cached.step, cached.blocks, cached.backgroundUrl);
      runStep({
        assistant_id: assistantId,
        thread_id: threadId,
        message: choiceText,
      }).catch((err) => console.error("Thread sync failed:", err));
      setIsLoading(false);
      return;
    }

    prefetchCacheRef.current.clear();
    const step = await runStep({ assistant_id: assistantId, thread_id: threadId, message: choiceText });
    const blocks = step.blocks as Block[];
    const bg = await loadBackground(step);
    applyScene(step, blocks, bg);
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
                    onClick={() => handleChoiceSelect(option)}
                    className={`bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition-colors ${
                      prefetchCacheRef.current.has(option) ? "ring-2 ring-green-400" : ""
                    }`}
                    disabled={isLoading}
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
