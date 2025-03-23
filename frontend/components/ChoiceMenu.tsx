type Props = {
  choices: { label: string; scene_id: string }[]
  onSelect: (id: string) => void
}

export default function ChoiceMenu({ choices, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {choices.map((choice, index) => (
        <button
          key={index}
          onClick={() => onSelect(choice.scene_id)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full text-left"
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}
