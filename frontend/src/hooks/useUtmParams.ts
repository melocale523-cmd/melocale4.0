export function useUtmParams() {
  const params = new URLSearchParams(window.location.search);

  const tipo = params.get('tipo') || '';

  return {
    utmContent: params.get('utm_content') || '',
    tipo,
    isProfissional: tipo === 'profissional',
    isCliente: tipo === 'cliente',
  };
}
