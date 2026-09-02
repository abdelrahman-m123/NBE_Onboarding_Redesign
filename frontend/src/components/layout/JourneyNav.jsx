import { Check } from 'lucide-react'

export function JourneyNav({ step, onStepSelect, submitted, t }) {
  return (
    <aside className="journey-nav" aria-label="Application progress">
      <p className="journey-label">{t.accountOpening}</p>
      <ol>
        {t.steps.map((item, index) => {
          const complete = index < step
          const active = index === step
          const canVisit = index < step || (submitted && index === 6)
          return (
            <li key={item.short} className={active ? 'active' : complete ? 'complete' : ''}>
              <button
                type="button"
                disabled={!canVisit || active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onStepSelect(index)}
              >
                <span className="step-dot">{complete ? <Check size={15} /> : index + 1}</span>
                <span>{item.short}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
