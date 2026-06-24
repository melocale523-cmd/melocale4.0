import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { type AddressValue, emptyAddress } from '../components/AddressForm';
import { apiFetch } from '../lib/api';

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

export interface AuthFormData {
  email: string;
  password: string;
  name: string;
  phone: string;
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
    category: '',
    customCategory: '',
    bio: '',
  });
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

        const derivedCity = [address.city, address.state].filter(Boolean).join(' - ');

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: selectedRole,
              phone: formData.phone,
              city: derivedCity || null,
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
          city: derivedCity || null,
          role: selectedRole,
          cep: address.cep || null,
          address_zipcode: address.cep || null,
          address_street: address.street || null,
          address_number: address.number || null,
          address_block: address.block || null,
          address_complement: address.complement || null,
          address_neighborhood: address.neighborhood || null,
          address_city: address.city || null,
          address_state: address.state || null,
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

        const getCookie = (name: string) => {
          const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
          return match ? match[2] : undefined;
        };
        apiFetch('/api/track/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole, email: formData.email, phone: formData.phone || undefined, name: formData.name || undefined, city: address.city || undefined, state: address.state || undefined, fbp: getCookie('_fbp'), fbc: getCookie('_fbc') }),
        }).catch(() => {});

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
    address,
    onAddressChange: setAddress,
    isSubmitting,
    error,
    setError,
    showPassword,
    setShowPassword,
    categorias,
    handleForgotPassword,
    handleGoogleLogin,
    handleSubmit,
  };
}
