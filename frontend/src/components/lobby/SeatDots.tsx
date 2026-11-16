export function SeatDots({ filled, max }: { filled: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < filled ? '#c0392b' : '#2a2d38' }} />
      ))}
    </div>
  )
}
