export function useUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmContent: params.get('utm_content') || '',
    isProfissional: params.get('utm_content') === 'profissional',
    isCliente: params.get('utm_content') === 'cliente',
  };
}
