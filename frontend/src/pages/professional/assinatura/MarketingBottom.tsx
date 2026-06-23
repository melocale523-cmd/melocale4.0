interface Props {
  onScrollToPlans: () => void;
  isMobile: boolean;
}

export default function MarketingBottom({ onScrollToPlans, isMobile }: Props) {
  return (
    <>
      {/* Depoimentos */}
      <div style={{ marginTop: '2rem' }}>
        <p style={{ fontSize: 16, fontWeight: 900, color: 'white', marginBottom: 4 }}>⭐ O que dizem os profissionais</p>
        <p style={{ fontSize: 11, color: '#4A6580', marginBottom: '1rem' }}>Resultados reais de quem assinou</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
          {[
            { name: 'Carlos E.', city: 'Jacobina - BA', role: 'Eletricista', text: '"Assine o PRO e na primeira semana fechei 3 clientes. O plano se pagou em 2 dias."', result: 'R$1.800 em 1 semana', stars: 5 },
            { name: 'Marcos S.', city: 'Feira de Santana - BA', role: 'Encanador', text: '"Antes pagava R$59 pelo pacote. Com PRO pago R$35. Economizei mais de R$280 em 4 meses."', result: '-R$280 em moedas', stars: 5 },
            { name: 'Ana P.', city: 'Irecê - BA', role: 'Pintora', text: '"Meu perfil aparece no topo agora. Recebi 2x mais pedidos no mês que assine."', result: '2× mais contatos', stars: 5 },
          ].map((t, i) => (
            <div key={i} style={{ background: 'linear-gradient(145deg,#0a1928,#0d1e35)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 18, padding: '1.25rem', display: 'flex', flexDirection: 'column', transition: 'transform .25s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <p style={{ color: '#f59e0b', letterSpacing: 4, fontSize: 12, marginBottom: 10 }}>{'★'.repeat(t.stars)}</p>
              <p style={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.6, flex: 1, marginBottom: 12 }}>{t.text}</p>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>{t.result}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                  {t.name[0]}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{t.name} · <span style={{ fontWeight: 400 }}>{t.role}</span></p>
                  <p style={{ fontSize: 11, color: '#304F70' }}>{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Garantia */}
      <div style={{ background: 'linear-gradient(135deg,rgba(250,177,68,.06),rgba(217,119,6,.04))', border: '1px solid rgba(250,177,68,.2)', borderRadius: 18, padding: '1.25rem 1.5rem', marginTop: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 32 }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24', marginBottom: 4 }}>Garantia de 7 dias — dinheiro de volta</p>
            <p style={{ fontSize: 12, color: '#4A6580' }}>Se não estiver satisfeito nos primeiros 7 dias, devolvemos 100% do valor sem perguntas. Sem risco.</p>
          </div>
          <button onClick={onScrollToPlans} style={{ height: 40, padding: '0 20px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 12, color: 'black', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,158,11,.25)', whiteSpace: 'nowrap' }}>
            Assinar com garantia →
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: '2rem' }}>
        <p style={{ fontSize: 16, fontWeight: 900, color: 'white', marginBottom: '1rem' }}>❓ Perguntas Frequentes</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
          {[
            { q: 'Quando sou cobrado?', a: 'Na assinatura e todo mês na mesma data. Você pode cancelar a qualquer momento.' },
            { q: 'Posso mudar de plano?', a: 'Sim. Você pode fazer upgrade ou downgrade a qualquer momento pelo painel.' },
            { q: 'As moedas expiram?', a: 'No plano Starter expiram em 90 dias. No PRO e Elite as moedas nunca expiram.' },
            { q: 'Posso cancelar quando quiser?', a: 'Sim. Cancele pelo painel sem burocracia. O acesso continua até o fim do período pago.' },
            { q: 'Tem taxa de adesão?', a: 'Não. Pelo contrário — ao assinar você recebe moedas de boas-vindas grátis.' },
            { q: 'Como fico mais visível?', a: 'Com PRO você aparece 2× mais nas buscas. Com Elite você vai ao topo absoluto da sua região.' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'linear-gradient(145deg,#0a1928,#0d1e35)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#8aafcf', marginBottom: 6 }}>{item.q}</p>
              <p style={{ fontSize: 11, color: '#304F70', lineHeight: 1.65 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap', marginTop: '1rem' }}>
        {[
          { icon: '🔒', text: 'Stripe seguro' },
          { icon: '↩', text: 'Cancele quando quiser' },
          { icon: '🛡️', text: 'Garantia 7 dias' },
          { icon: '✅', text: 'Sem taxa de adesão' },
          { icon: '∞', text: 'Moedas sem prazo no PRO' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#304F70' }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.text}
          </div>
        ))}
      </div>
    </>
  );
}
