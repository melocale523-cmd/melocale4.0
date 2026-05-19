import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Senha deve ter pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'Senha deve ter pelo menos um número.';
  return null;
}

export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3;
}

async function fetchCepData(cep: string): Promise<{ city: string } | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return { city: `${data.localidade}, ${data.uf}` };
  } catch {
    return null;
  }
}

export interface AuthFormData {
  email: string;
  password: string;
  name: string;
  phone: string;
  cep: string;
  city: string;
  category: string;
  customCategory: string;
  bio: string;
}

interface UseAuthFormParams {
  mode: 'login' | 'signup';
  selectedRole: 'client' | 'professional' | null;
  onClose: () => void;
}

export function useAuthForm({ mode, selectedRole, onClose }: UseAuthFormParams) {
  const navigate = useNavigate();
  const setMode = useAuthStore((state) => state.setMode);

  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: '',
    phone: '',
    cep: '',
    city: '',
    category: '',
    customCategory: '',
    bio: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data?.length) {
          const sorted = [
            ...data.filter((c: { name: string }) => c.name === 'Outro'),
            ...data.filter((c: { name: string }) => c.name !== 'Outro'),
          ];
          setCategorias(sorted.map((c: { name: string }) => c.name));
        }
      });
  }, []);

  const onChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCepChange = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, cep }));
    if (digits.length === 8) {
      setIsFetchingCep(true);
      const result = await fetchCepData(digits);
      setIsFetchingCep(false);
      if (result) {
        setFormData(prev => ({ ...prev, city: result.city }));
      } else {
        toast.error('CEP não encontrado. Preencha a cidade manualmente.');
      }
    }
  };

  const handleForgotPassword = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      setError('Por favor, insira um e-mail válido para recuperar sua senha.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) throw resetError;
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch {
      toast.error('Não encontramos uma conta com este e-mail.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // Persist the role selected before the OAuth redirect so AuthInitializer
      // can assign it on the callback (user_metadata.role is not set by Google).
      if (selectedRole) {
        localStorage.setItem('pending_oauth_role', selectedRole);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?oauth=1`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      localStorage.removeItem('pending_oauth_role');
      toast.error('Erro ao entrar com Google: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      const pwErr = validatePassword(formData.password);
      if (pwErr) { setError(pwErr); return; }
      if (formData.category === 'Outro' && !formData.customCategory.trim()) {
        setError('Por favor, descreva sua profissão.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const finalCategory = formData.category === 'Outro'
          ? formData.customCategory
          : formData.category;

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: selectedRole,
              phone: formData.phone,
              city: formData.city,
              category: finalCategory,
              bio: formData.bio,
            },
          },
        });

        if (signUpError) throw signUpError;

        setMode(selectedRole);

        await supabase.from('profiles').upsert({
          id: signUpData.user?.id,
          full_name: formData.name,
          phone: formData.phone || null,
          city: formData.city || null,
          role: selectedRole,
        }, { onConflict: 'id' });

        if (selectedRole === 'professional' && signUpData.user) {
          await supabase.rpc('save_full_profile', {
            p_user_id: signUpData.user.id,
            p_full_name: formData.name ?? '',
            p_phone: formData.phone ?? '',
            p_bio: formData.bio ?? '',
            p_category: finalCategory ?? '',
            p_service_radius: 50,
          });
        }

        toast.success('Conta criada com sucesso! Verifique seu e-mail.');
        onClose();
        navigate('/login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) throw signInError;

        toast.success('Bem-vindo(a) de volta!');
        onClose();
        // Navigation handled by AuthInitializer → authStore → AuthRedirect using profiles.role
      }
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e clique no link que enviamos.');
      } else if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('E-mail ou senha incorretos. Verifique seus dados e tente novamente.');
      } else if (msg.includes('too many requests')) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    onChange,
    isSubmitting,
    error,
    setError,
    showPassword,
    setShowPassword,
    isFetchingCep,
    categorias,
    handleCepChange,
    handleForgotPassword,
    handleGoogleLogin,
    handleSubmit,
  };
}
