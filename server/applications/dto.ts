export interface CreateApplicationBody {
  currentStep?: string
  language?: string
}

export interface SaveProfileBody {
  onboardingFields?: Record<string, unknown>
  nationalId?: string
  fullName?: string
  dateOfBirth?: string
  governorate?: string
  address?: string
  mobile?: string
  email?: string
  employment?: string
  income?: string
  method?: string
  status?: string
  currentStep?: string
}
