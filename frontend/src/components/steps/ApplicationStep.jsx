import { useRef } from 'react'
import { BadgeCheck, FileCheck2, Upload } from 'lucide-react'
import {
  accountPreferenceFields,
  accountTransactionTypeOptions,
  employmentFields,
  socialFields,
} from '../../config/onboarding'
import { optionLabel } from '../../utils/form'
import {
  CheckboxField,
  FieldGrid,
  FormSection,
  MultiCheckboxField,
  SelectField,
} from '../forms/FormControls'

export function ApplicationStep({ form, errors, update, incomeProofFile, setIncomeProofFile, onFillDemoData, t }) {
  const employmentDocumentRef = useRef(null)
  const uploadEmploymentDocument = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIncomeProofFile(file)
    update('incomeProofDocument', {
      name: file.name,
      size: file.size,
      type: file.type || 'Document',
    })
    event.target.value = ''
  }

  return (
    <div className="step-body">
      <div className="application-demo-row">
        <p className="lead">{t.application.lead}</p>
        <button type="button" className="button button-secondary demo-fill-button" onClick={onFillDemoData}>
          <BadgeCheck size={18} /> {t.fillDemoData}
        </button>
      </div>

      <div className="section-heading"><span>1</span><div><h2>{t.application.sectionTitle}</h2><p>{t.application.sectionDescription}</p></div></div>
      <div className="form-grid two-columns">
        <SelectField label={t.fieldLabels.employment} name="employment" value={form.employment} onChange={(value) => update('employment', value)} error={errors.employment} options={['Employed', 'Self-employed', 'Retired', 'Student', 'Not currently employed']} placeholder={t.selectOption} getOptionLabel={(option) => optionLabel(option, t)} />
        <SelectField label={t.fieldLabels.income} name="income" value={form.income} onChange={(value) => update('income', value)} error={errors.income} options={['Less than EGP 10,000', 'EGP 10,000-25,000', 'EGP 25,001-50,000', 'More than EGP 50,000']} placeholder={t.selectOption} getOptionLabel={(option) => optionLabel(option, t)} />
      </div>

      <FormSection title={t.sections.socialDetails}>
        <FieldGrid fields={socialFields} form={form} errors={errors} update={update} t={t} />
      </FormSection>

      <FormSection title={t.sections.employmentDetails}>
        <FieldGrid fields={employmentFields} form={form} errors={errors} update={update} t={t} />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="isOrWasPep" label={t.checkboxLabels.isOrWasPep} checked={form.isOrWasPep} update={update} />
        </div>
      </FormSection>

      <FormSection title={t.sections.accountPreferences}>
        <FieldGrid fields={accountPreferenceFields} form={form} errors={errors} update={update} t={t} />
        <MultiCheckboxField
          name="accountTransactionTypes"
          legend={`${t.dynamicFields.accountTransactionTypes} *`}
          options={accountTransactionTypeOptions}
          values={form.accountTransactionTypes}
          update={update}
          error={errors.accountTransactionTypes}
          t={t}
        />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="smsAlertSubscription" label={t.checkboxLabels.smsAlertSubscription} checked={form.smsAlertSubscription} update={update} />
          <CheckboxField name="secureCodeSubscription" label={t.checkboxLabels.secureCodeSubscription} checked={form.secureCodeSubscription} update={update} />
        </div>
      </FormSection>

      {form.employment && (
        <div className="dynamic-checklist">
          <FileCheck2 size={22} />
          <div><strong>{t.application.checklist}</strong><p>{form.employment === 'Employed' ? t.application.employed : form.employment === 'Self-employed' ? t.application.selfEmployed : t.application.other}</p></div>
        </div>
      )}

      <div className={`employment-upload ${form.incomeProofDocument ? 'has-file' : ''}`}>
        <div className="upload-illustration"><FileCheck2 size={25} /></div>
        <div>
          <span className="optional-tag">{t.application.optional}</span>
          <h2>{t.application.uploadTitle}</h2>
          <p>{form.incomeProofDocument ? `${form.incomeProofDocument.name} · ${formatFileSize(form.incomeProofDocument.size)}` : t.application.uploadDescription}</p>
        </div>
        <input
          ref={employmentDocumentRef}
          type="file"
          accept="image/*,.pdf"
          className="visually-hidden"
          onChange={uploadEmploymentDocument}
        />
        <div className="employment-upload-actions">
          {form.incomeProofDocument && (
            <button
              className="text-button compact"
              type="button"
              onClick={() => {
                setIncomeProofFile(null)
                update('incomeProofDocument', null)
              }}
            >
              {t.application.remove}
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={() => employmentDocumentRef.current?.click()}>
            <Upload size={18} /> {form.incomeProofDocument ? t.application.replace : t.application.upload}
          </button>
        </div>
      </div>
    </div>
  )
}
