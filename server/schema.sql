create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default ('NBE-' || to_char(now(), 'YY') || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8))),
  status text not null default 'draft',
  current_step text not null default 'prepare',
  language text not null default 'en',
  submission_method text,
  submitted_at timestamptz,
  assigned_officer text default 'Unassigned',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_status_check check (status in ('draft', 'submitted', 'under_review', 'awaiting_documents', 'manual_review', 'approved', 'rejected', 'cancelled')),
  constraint applications_current_step_check check (current_step in ('prepare', 'identity', 'contact', 'application', 'review', 'track')),
  constraint applications_language_check check (language in ('en', 'ar')),
  constraint applications_submission_method_check check (submission_method is null or submission_method in ('ebranch', 'branch', 'employee_visit', 'digital'))
);

create table if not exists public.applicant_profiles (
  application_id uuid primary key references public.applications(id) on delete cascade,
  national_id_hash text,
  national_id_encrypted bytea,
  mobile_hash text,
  mobile_encrypted bytea,
  email_hash text,
  email_encrypted bytea,
  first_name text,
  last_name text,
  date_of_birth date,
  nationality text default 'Egyptian',
  birth_country text,
  has_us_nationality boolean,
  has_foreign_residency boolean,
  address_line text,
  governorate text,
  employment_status text,
  profession text,
  income_range text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applicant_profiles drop column if exists gender;

create table if not exists public.eligibility_confirmations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  is_new_retail_customer boolean not null,
  is_egypt_resident boolean not null,
  is_21_or_older boolean not null,
  has_valid_national_id boolean not null,
  has_power_of_attorney boolean not null default false,
  is_minor boolean not null default false,
  is_gift_account boolean not null default false,
  can_read_and_write boolean not null default true,
  confirmed_at timestamptz not null default now()
);

create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  channel text not null,
  destination_hash text not null,
  otp_hash text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  resend_count integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint otp_challenges_channel_check check (channel in ('sms', 'email')),
  constraint otp_challenges_status_check check (status in ('pending', 'verified', 'expired', 'replaced', 'locked'))
);

create table if not exists public.contact_verifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  channel text not null,
  destination_hash text not null,
  verified_at timestamptz not null default now(),
  challenge_id uuid references public.otp_challenges(id),
  constraint contact_verifications_channel_check check (channel in ('sms', 'email'))
);

create table if not exists public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  document_type text not null default 'national_id',
  side text not null default 'front',
  storage_uri text,
  file_hash text,
  ocr_status text not null default 'not_started',
  ocr_confidence numeric(5, 2),
  extracted_fields jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint identity_documents_side_check check (side in ('front', 'back')),
  constraint identity_documents_ocr_status_check check (ocr_status in ('not_started', 'processing', 'completed', 'partial', 'failed')),
  constraint identity_documents_review_status_check check (review_status in ('pending', 'confirmed', 'corrected', 'manual_review'))
);

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  requirement_type text not null,
  reason text not null,
  status text not null default 'needed',
  created_at timestamptz not null default now(),
  constraint document_requirements_status_check check (status in ('needed', 'provided', 'waived', 'not_applicable'))
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  method text not null,
  branch_code text,
  branch_name text,
  governorate text,
  scheduled_at timestamptz,
  status text not null default 'requested',
  cancellation_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_method_check check (method in ('ebranch', 'branch', 'employee_visit')),
  constraint appointments_status_check check (status in ('requested', 'scheduled', 'completed', 'missed', 'cancelled'))
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  document_name text not null,
  document_version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent_hash text
);

create table if not exists public.status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null,
  customer_message text not null,
  next_action text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  actor_type text not null,
  event_type text not null,
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_actor_type_check check (actor_type in ('customer', 'system', 'bank_user'))
);

-- CRM Audit Trail
create table if not exists public.crm_audit_trail (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  action text not null,
  performed_by text not null,
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_applications_reference_number on public.applications(reference_number);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_assigned_officer on public.applications(assigned_officer);
create index if not exists idx_applicant_profiles_national_id_hash on public.applicant_profiles(national_id_hash);
create index if not exists idx_applicant_profiles_mobile_hash on public.applicant_profiles(mobile_hash);
create index if not exists idx_applicant_profiles_email_hash on public.applicant_profiles(email_hash);
create index if not exists idx_otp_challenges_application_channel on public.otp_challenges(application_id, channel);
create index if not exists idx_identity_documents_application on public.identity_documents(application_id);
create index if not exists idx_document_requirements_application on public.document_requirements(application_id);
create index if not exists idx_appointments_application on public.appointments(application_id);
create index if not exists idx_status_events_application_created on public.status_events(application_id, created_at desc);
create index if not exists idx_audit_events_application_created on public.audit_events(application_id, created_at desc);
create index if not exists idx_crm_audit_trail_application on public.crm_audit_trail(application_id, created_at desc);

-- Triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists trg_applicant_profiles_updated_at on public.applicant_profiles;
create trigger trg_applicant_profiles_updated_at
before update on public.applicant_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();