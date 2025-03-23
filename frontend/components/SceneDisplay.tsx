import Image from 'next/image'
import ChoiceMenu from './ChoiceMenu'

type Props = {
  background: string
  story: string
  characterLine: string
  choices: { label: string; scene_id: string }[]
  onChoice: (id: string) => void
}

export default function SceneDisplay({ background, story, characterLine, choices, onChoice }: Props) {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background image */}
      <Image
        src={background}
        alt="Scene background"
        fill
        className="object-cover z-0"
        unoptimized
      />

      {/* Overlay content */}
      <div className="absolute inset-0 bg-black bg-opacity-50 z-10 flex flex-col justify-end p-8 space-y-4">
        <div className="text-lg leading-relaxed max-h-1/2 overflow-y-auto">
          <p className="mb-4 whitespace-pre-wrap">{story}</p>
          {characterLine && (
            <p className="text-yellow-300 font-semibold mt-2">“{characterLine}”</p>
          )}
        </div>

        {choices.length > 0 && (
          <ChoiceMenu choices={choices} onSelect={onChoice} />
        )}
      </div>
    </div>
  )
}
