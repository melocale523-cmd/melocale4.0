import { useState } from 'react';
import { Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

export default function AdminCategorias() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['adminCategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      toast.success('Categoria atualizada');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const insertMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = toSlug(name);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), slug }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      setNewName('');
      toast.success('Categoria criada com sucesso');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    insertMutation.mutate(newName.trim());
  };

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-9">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gerenciamento de Categorias</h1>
          <p className="text-[#94A3B8] mt-6">Ative, desative ou adicione categorias de serviço disponíveis na plataforma.</p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-[#1C3454] border border-slate-800 rounded-2xl p-10 flex flex-col sm:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <input
            type="text"
            placeholder="Nome da nova categoria (ex: Gás e Aquecedor)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={80}
            className="w-full bg-[#0E1C32] border border-slate-800 text-slate-200 text-sm rounded-xl px-9 py-8 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
          />
          {newName.trim() && (
            <p className="text-xs text-[#4A6580] pl-1">
              Slug: <span className="text-emerald-400 font-mono">{toSlug(newName)}</span>
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!newName.trim() || insertMutation.isPending}
          className="flex items-center justify-center gap-7 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-8 rounded-xl font-medium text-sm transition-colors whitespace-nowrap"
        >
          {insertMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Adicionar Categoria
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center p-12 bg-[#1C3454] rounded-2xl border border-slate-800">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : (
        <div className="bg-[#1C3454] border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1C3050] text-xs text-[#94A3B8] font-semibold uppercase tracking-widest">
                <th className="p-9 pl-6">Nome</th>
                <th className="p-9">Slug</th>
                <th className="p-9">Status</th>
                <th className="p-9 pr-6 text-right">Ativar / Desativar</th>
              </tr>
            </thead>
            <tbody>
              {(categories || []).map(cat => (
                <tr key={cat.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors">
                  <td className="p-9 pl-6 text-white font-medium">{cat.name}</td>
                  <td className="p-9 text-[#4A6580] font-mono text-xs">{cat.slug}</td>
                  <td className="p-9">
                    <span className={`px-2.5 py-6 rounded text-xs font-bold ${
                      cat.is_active
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {cat.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-9 pr-6 text-right">
                    <button
                      onClick={() => toggleMutation.mutate({ id: cat.id, is_active: cat.is_active })}
                      disabled={toggleMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors disabled:opacity-40"
                    >
                      {cat.is_active
                        ? <><ToggleRight size={20} className="text-emerald-500" /> Desativar</>
                        : <><ToggleLeft size={20} className="text-red-500" /> Ativar</>}
                    </button>
                  </td>
                </tr>
              ))}
              {(categories || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#4A6580]">Nenhuma categoria cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
