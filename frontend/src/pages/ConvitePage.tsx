import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Gift, Star, Loader2, UserCircle } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface InviteData {
  full_name: string
  avatar_url: string | null
  role: 'client' | 'professional'
  code: string
  link: string
}

export default function ConvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery<InviteData>({
    queryKey: ['invite', code],
    queryFn: async () => {
      const res = await apiFetch(`/api/referrals/invite/${code}`)
      if (!res.ok) throw new Error('not_found')
      return res.json()
    },
    enabled: !!code,
    retry: false,
  })

  function goSignup() {
    navigate(`/login?ref=${code}&mode=signup`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-emerald-400" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex flex-col items-center justify-center gap-9 px-9 text-center">
        <Gift size={48} className="text-slate-600" />
        <h1 className="text-xl font-bold text-white">Link inválido ou expirado</h1>
        <p className="text-slate-400 text-sm">Este link de convite não foi encontrado.</p>
        <button onClick={() => navigate('/login')} className="mt-7 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-11 py-8 rounded-xl transition-colors">
          Criar conta
        </button>
      </div>
    )
  }

  const isPro = data.role === 'professional'
  const firstName = data.full_name.split(' ')[0]
  const benefitText = isPro ? '60 moedas grátis na sua carteira' : 'R$10 de crédito na primeira contratação'
  const roleLabel = isPro ? 'profissional autônomo' : 'cliente'

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col items-center justify-center px-9 py-12">
      <Helmet>
        <title>Você foi convidado para o MeloCalé!</title>
        <meta property="og:title" content="Você foi convidado para o MeloCalé!" />
        <meta property="og:description" content="Encontre profissionais verificados para serviços domésticos. Orçamento grátis, avaliações reais." />
        <meta property="og:image" content="https://www.melocale.com.br/og-convite.png" />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.melocale.com.br/og-convite.png" />
      </Helmet>
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-13 flex flex-col items-center gap-3">
          <img src="/icon-192.png" alt="MeloCalé" className="w-14 h-14 rounded-2xl" />
          <span className="text-2xl font-black tracking-tight uppercase text-emerald-400">MeloCalé</span>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
          {/* Avatar */}
          <div className="flex justify-center mb-10">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt={data.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-emerald-400/40 shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400/40 flex items-center justify-center">
                <UserCircle size={40} className="text-emerald-400" />
              </div>
            )}
          </div>

          {/* Headline */}
          <h1 className="text-xl font-bold text-white mb-6">
            <span className="text-emerald-400">{firstName}</span> te convidou para o MeloCalé
          </h1>
          <p className="text-slate-400 text-sm mb-11">
            {firstName} é {roleLabel} e quer que você conheça a plataforma de serviços domésticos mais completa do Brasil.
          </p>

          {/* Benefit box */}
          <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-2xl p-9 mb-11">
            <div className="flex items-center justify-center gap-7 mb-6">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">Bônus de boas-vindas</span>
            </div>
            <p className="text-white font-bold text-lg">{benefitText}</p>
            <p className="text-slate-400 text-xs mt-6">ao ativar sua conta</p>
          </div>

          {/* CTA */}
          <button
            onClick={goSignup}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base py-9 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest"
          >
            Aceitar convite e criar conta
          </button>

          <p className="text-slate-600 text-xs mt-9">
            Ao criar a conta, o bônus de {firstName} será aplicado automaticamente.
          </p>
        </div>

        {/* Social proof */}
        <div className="mt-11 text-center">
          <p className="text-slate-500 text-xs">
            Mais de 10.000 profissionais e clientes já usam o MeloCalé
          </p>
        </div>
      </div>
    </div>
  )
}
