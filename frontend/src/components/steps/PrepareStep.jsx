import { Check, FileText, Info } from 'lucide-react'
import { FieldError } from '../forms/FormControls'

export function PrepareStep({ form, errors, onToggle, t }) {
  const requirements = [
    ['newCustomer', t.prepare.requirements[0]],
    ['resident', t.prepare.requirements[1]],
    ['age', t.prepare.requirements[2]],
    ['validId', t.prepare.requirements[3]],
  ]

  return (
    <div className="step-body">
      <p className="lead">{t.prepare.lead}</p>

      <fieldset className={`checklist-fieldset ${errors.eligibility ? 'has-error' : ''}`}>
        <legend>{t.prepare.legend}</legend>
        <div className="eligibility-grid">
          {requirements.map(([name, label]) => (
            <label className="check-card" key={name}>
              <input
                type="checkbox"
                checked={form.eligibility[name]}
                onChange={() => onToggle(name)}
              />
              <span className="custom-check"><Check size={15} /></span>
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.eligibility && <FieldError message={errors.eligibility} />}
      </fieldset>

      <div className="section-divider" />
      <h2>{t.prepare.laterTitle}</h2>
      <div className="document-preview">
        {t.prepare.docs.map((doc) => (
          <div key={doc.title}><FileText size={21} /><span><strong>{doc.title}</strong><small>{doc.hint}</small></span></div>
        ))}
      </div>
      <button type="button" className="text-button"><Info size={17} /> {t.prepare.branchLink}</button>
    </div>
  )
}
