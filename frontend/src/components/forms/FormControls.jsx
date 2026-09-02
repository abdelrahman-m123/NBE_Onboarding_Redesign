import { BadgeCheck, Check, Info } from 'lucide-react'
import { fieldLabel, optionLabel } from '../../utils/form'

export function VerificationCard({ icon, title, destination, verified, onEdit, children, t }) {
  return (
    <section className={`verification-card ${verified ? 'is-verified' : ''}`}>
      <div className="verification-heading">
        <div className="verification-icon">{icon}</div>
        <div><h2>{title}</h2><p>{destination}</p></div>
        {verified && <span className="verified-pill"><BadgeCheck size={17} /> {t.verified}</span>}
      </div>
      {verified ? (
        <button className="text-button compact" type="button" onClick={onEdit}>{t.change} {title.toLowerCase()}</button>
      ) : children}
    </section>
  )
}

export function OtpInput({ name, label, value, onChange, error, onVerify, verifyLabel }) {
  return (
    <div className="otp-group">
      <div className="field grow">
        <label htmlFor={name}>{label || verifyLabel}</label>
        <input
          id={name}
          className={error ? 'input-error otp-input' : 'otp-input'}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="• • • • • •"
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={Boolean(error)}
        />
        {error && <FieldError id={`${name}-error`} message={error} />}
      </div>
      <button className="button button-secondary verify-button" type="button" onClick={onVerify}>
        {verifyLabel}
      </button>
    </div>
  )
}

export function FormSection({ title, children }) {
  return (
    <>
      <div className="section-divider" />
      <h2>{title}</h2>
      {children}
    </>
  )
}

function FieldRenderer({ field, form, errors, update, isLoading, t }) {
  const label = fieldLabel(field, t)

  if (field.type === 'select') {
    return (
      <SelectField
        label={`${label}${field.required ? ' *' : ''}`}
        name={field.name}
        value={form[field.name] || ''}
        onChange={(value) => update(field.name, value)}
        error={errors[field.name]}
        options={field.options}
        placeholder={t.selectOption}
        getOptionLabel={(option) => optionLabel(option, t)}
        disabled={field.disabled}
        isLoading={isLoading && field.ocr}
      />
    )
  }

  return (
    <Field
      label={`${label}${field.required ? ' *' : ''}`}
      name={field.name}
      value={form[field.name] || ''}
      onChange={(value) => update(field.name, value)}
      error={errors[field.name]}
      type={field.type || 'text'}
      inputMode={field.inputMode}
      min={field.min}
      minLength={field.minLength}
      maxLength={field.maxLength}
      disabled={field.disabled}
      isLoading={isLoading && field.ocr}
    />
  )
}

export function FieldGrid({ fields, form, errors, update, isLoading = false, t }) {
  return (
    <div className="form-grid two-columns">
      {fields.map((field) => (
        <FieldRenderer key={field.name} field={field} form={form} errors={errors} update={update} isLoading={isLoading} t={t} />
      ))}
    </div>
  )
}

export function CheckboxField({ name, label, checked, update }) {
  return (
    <label className="check-card">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => update(name, event.target.checked)} />
      <span className="custom-check"><Check size={15} /></span>
      <span>{label}</span>
    </label>
  )
}

export function MultiCheckboxField({ name, legend, options, values, update, error, t }) {
  const selected = Array.isArray(values) ? values : []
  const toggle = (option) => {
    update(
      name,
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    )
  }

  return (
    <fieldset className={`checklist-fieldset ${error ? 'has-error' : ''}`}>
      <legend>{legend}</legend>
      <div className="eligibility-grid">
        {options.map((option) => (
          <CheckboxField
            key={option}
            name={`${name}-${option}`}
            label={optionLabel(option, t)}
            checked={selected.includes(option)}
            update={() => toggle(option)}
          />
        ))}
      </div>
      {error && <FieldError message={error} />}
    </fieldset>
  )
}

export function Field({ label, name, value, onChange, error, hint, isLoading, isComplete, ...props }) {
  const filled = isComplete ?? Boolean(value)
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${error ? 'input-error' : ''} ${filled ? 'is-filled' : ''} ${isLoading ? 'is-shimmering' : ''}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      {hint && !error && <small id={`${name}-hint`}>{hint}</small>}
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

export function SelectField({ label, name, value, onChange, error, options, isLoading, placeholder, disabled, getOptionLabel }) {
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <select id={name} value={value} onChange={(event) => onChange(event.target.value)} className={`${error ? 'input-error' : ''} ${value ? 'is-filled' : ''} ${isLoading ? 'is-shimmering' : ''}`.trim()} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} disabled={disabled}>
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map((option) => <option key={option} value={option}>{getOptionLabel ? getOptionLabel(option) : option}</option>)}
      </select>
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

export function FieldError({ id, message }) {
  return <span id={id} className="field-error"><Info size={15} aria-hidden="true" /> {message}</span>
}

