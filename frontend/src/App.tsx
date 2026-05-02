import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div><h1>MeloCalé ✅</h1></div>} />
      <Route path="/checkout/success" element={<div><h1>Pagamento confirmado ✅</h1><a href="/">Voltar</a></div>} />
      <Route path="/checkout/cancel" element={<div><h1>Cancelado ❌</h1><a href="/">Voltar</a></div>} />
      <Route path="*" element={<div><h1>404</h1><a href="/">Voltar</a></div>} />
    </Routes>
  );
}
