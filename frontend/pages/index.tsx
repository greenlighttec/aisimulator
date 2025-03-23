import { useEffect, useState } from "react";
import { startSession, runStep } from "@/lib/api";

interface Block {
  type: "narration" | "dialogue" | "background" | "character_prompt" | "story_prompt";
  text?: string;
  speaker?: string;
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
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentBlock = sceneQueue[currentIndex];

  useEffect(() => {
    (window as unknown as Record<string, unknown>).debug = {
      sceneQueue,
      currentBlock,
      currentIndex,
      backgroundUrl,
      assistantId,
      threadId
    };
  }, [sceneQueue, currentBlock, currentIndex, backgroundUrl, assistantId, threadId]);

  const [speakerColors, setSpeakerColors] = useState<{ [name: string]: string }>({});

  const getColorForSpeaker = (name: string) => {
    if (!speakerColors[name]) {
      const colors = ["text-red-400", "text-green-400", "text-blue-400", "text-yellow-400", "text-purple-400"];
      const color = colors[Object.keys(speakerColors).length % colors.length];
      setSpeakerColors((prev) => ({ ...prev, [name]: color }));
    }
    return speakerColors[name] || "text-white";
  };


  const handleStart = async () => {
    setIsLoading(true);
    const res = await startSession({ name, prompt });
    setAssistantId(res.assistant_id);
    setThreadId(res.thread_id);
    setStarted(true);

    // Immediately run the first step
    const step = await runStep({
      assistant_id: res.assistant_id,
      thread_id: res.thread_id,
      message: `Start the story for ${name}.`
    });
    (window as unknown as Record<string, unknown>).step = step;

    const blocks = step.blocks || [];
    setSceneQueue(blocks);

    const bgBlock = blocks.find((b) => b.type === "background");
      if (bgBlock?.description) {
        setBackgroundUrl(
          "https://via.placeholder.com/1024x768?text=" +
            encodeURIComponent(bgBlock.description)
        );
    }

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

    const res = await runStep({ assistant_id: assistantId, thread_id: threadId, message: input });
    (window as unknown as Record<string, unknown>).res = res;
    setInput("");

    const blocks = res.blocks as Block[];
    setSceneQueue(blocks);
    setIsLoading(false);

    // Preload background image if any
    const bgBlock = blocks.find(b => b.type === "background" && b.description);
    if (bgBlock?.description) {
      setBackgroundUrl("https://via.placeholder.com/1024x768?text=" + encodeURIComponent(bgBlock.description));
    }
  };

  const handleChoice = async (choice: string) => {
    setInput(choice);
    await handleSubmit();
  };

  if (!started) {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">AI Visual Novel</h1>
        <input
          placeholder="Your name"
          className="border px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Story prompt (e.g., haunted castle)"
          className="border px-3 py-2 w-full"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button onClick={handleStart} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={isLoading}>
          {isLoading ? "Starting..." : "Start Game"}
        </button>
      </main>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden text-white">
      {backgroundUrl && (
        <img src={backgroundUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0" />
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-60 p-6">
        {currentBlock && currentBlock.type === "dialogue" && (
          <div>
            <div className={`font-bold mb-1 ${getColorForSpeaker(currentBlock.speaker || "")}`}>{currentBlock.speaker}</div>
            <div className={`${getColorForSpeaker(currentBlock.speaker || "")}`}>{currentBlock.text}</div>
          </div>
        )}

        {currentBlock && currentBlock.type === "narration" && (
          <div className="text-center italic">{currentBlock.text}</div>
        )}

        {currentBlock && currentBlock.type === "background" && (
          <div className="text-center text-sm italic text-gray-300">
            Scene: {currentBlock.description}
          </div>
        )}

        {currentBlock && currentBlock.type === "character_prompt" && (
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

       {currentBlock && currentBlock.type === "story_prompt" && (
          <div className="space-y-2">
            <div className="text-yellow-300">Character: {currentBlock.character}</div>
            <div className="italic">{currentBlock.question}</div>
            <div className="space-y-2">
            <div className="italic">What will you do?</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentBlock.choices?.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(option)}
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

        {!isLoading && currentBlock && currentBlock.type !== "character_prompt" && currentBlock.type !== "story_prompt" && currentIndex < sceneQueue.length - 1 && (
          <button onClick={handleAdvance} className="mt-4 bg-white text-black px-4 py-2 rounded">
            Continue
          </button>
        )}

        </div>
    </div>
  );
}
