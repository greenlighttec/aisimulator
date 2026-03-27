type Props = {
  choices: string[]
  onSelect: (choice: string) => void
}

export default function ChoiceMenu({ choices, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {choices.map((choice, index) => (
        <button
          key={index}
          onClick={() => onSelect(choice)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full text-left"
        >
          {choice}
        </button>
      ))}
    </div>
  )
}
