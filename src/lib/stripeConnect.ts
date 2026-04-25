export const connectProfessionalAccount = async (email: string) => {
  const response = await fetch('/api/create-connected-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json();
};

export const createOnboardingLink = async (accountId: string) => {
  const response = await fetch('/api/create-account-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  return response.json();
};
