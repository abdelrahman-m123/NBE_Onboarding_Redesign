export function fieldLabel(field, t) {
  return t.dynamicFields?.[field.name] || field.label
}

export function optionLabel(option, t) {
  return t.optionLabels?.[option] || option
}

export function templateText(text, replacements) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    text,
  )
}

export function requiredFieldMessage(label, t) {
  return templateText(t.requiredField || '{label} is required.', { label })
}
