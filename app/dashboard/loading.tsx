export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12">
        <div className="h-4 w-16 rounded mb-4" style={{ background: 'var(--avorio-scuro)' }} />
        <div className="h-10 w-64 rounded mb-3" style={{ background: 'var(--avorio-scuro)' }} />
        <div className="h-6 w-80 rounded" style={{ background: 'var(--avorio-scuro)' }} />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div
            key={i}
            className="h-32 rounded"
            style={{
              background: 'var(--avorio-scuro)',
              animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
