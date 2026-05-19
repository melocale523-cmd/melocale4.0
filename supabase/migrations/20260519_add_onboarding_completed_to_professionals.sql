ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark all existing professionals as having completed onboarding so the
-- guard does not redirect users who signed up before this feature.
UPDATE professionals SET onboarding_completed = true;
