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
  selectedBranch?: string
  appointmentDate?: string
  appointmentSlot?: string
  status?: string
  currentStep?: string
}
