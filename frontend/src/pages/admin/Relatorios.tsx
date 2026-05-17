import { useState } from 'react';
import { Download, Users, FileText, DollarSign, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { toast } from 'sonner';

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORTS = [
  {
    id: 'users',
    title: 'Usuários',
    description: 'Nome, e-mail, tipo, cidade, status e categoria de todos os usuários cadastrados.',
    icon: Users,
    endpoint: '/api/admin/reports/users',
    filename: 'melocale_usuarios.csv',
  },
  {
    id: 'leads',
    title: 'Leads',
    description: 'Todos os pedidos: categoria, localização, status, orçamento e moedas.',
    icon: FileText,
    endpoint: '/api/admin/reports/leads',
    filename: 'melocale_leads.csv',
  },
  {
    id: 'transactions',
    title: 'Transações Financeiras',
    description: 'Histórico completo de wallet_transactions com nome e e-mail do usuário.',
    icon: DollarSign,
    endpoint: '/api/admin/reports/transactions',
    filename: 'melocale_transacoes.csv',
  },
] as const;

export default function AdminRelatorios() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (report: typeof REPORTS[number]) => {
    setLoading(report.id);
    try {
      const res = await apiFetch(report.endpoint);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Erro ao buscar dados.');
      }
      const data: Record<string, unknown>[] = await res.json();
      if (!data.length) {
        toast.info('Nenhum dado para exportar.');
        return;
      }
      const csv = jsonToCsv(data);
      downloadCsv(report.filename, csv);
      toast.success(`${report.title} exportado — ${data.length} registros.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Relatórios</h1>
        <p className="text-[#94A3B8] mt-1">Exporte dados da plataforma em CSV para análise externa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REPORTS.map(report => {
          const Icon = report.icon;
          const isLoading = loading === report.id;
          return (
            <div
              key={report.id}
              className="bg-[#1C3454] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Icon size={20} className="text-emerald-400" />
                </div>
                <h2 className="text-white font-bold text-lg">{report.title}</h2>
              </div>

              <p className="text-[#94A3B8] text-sm leading-relaxed flex-1">{report.description}</p>

              <button
                onClick={() => handleExport(report)}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black rounded-xl transition-all text-sm"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {isLoading ? 'Exportando...' : 'Exportar CSV'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
