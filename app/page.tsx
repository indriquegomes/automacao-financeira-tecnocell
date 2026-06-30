import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CATEGORIAS = ['Alimentacao', 'Transporte', 'Servicos', 'Saude', 'Educacao', 'Outros'] as const;
const COR: Record<string, string> = {
  Alimentacao: 'bg-orange-100 text-orange-700',
  Transporte: 'bg-blue-100 text-blue-700',
  Servicos: 'bg-purple-100 text-purple-700',
  Saude: 'bg-red-100 text-red-700',
  Educacao: 'bg-green-100 text-green-700',
  Outros: 'bg-zinc-100 text-zinc-600',
};

type NF = {
  empresa: string | null;
  valor: string | null;
  data_nf: string | null;
  descricao: string | null;
  categoria: string | null;
  created_at: string;
};

function parseValor(v: string | null): number {
  if (!v) return 0;
  let s = v.replace(/[^\d.,-]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function normalizarCategoria(c: string | null): string {
  return CATEGORIAS.includes(c as typeof CATEGORIAS[number]) ? (c as string) : 'Outros';
}

export default async function Dashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('empresa, valor, data_nf, descricao, categoria, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-semibold text-zinc-900">TecnoCell Finanças</h1>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <p className="font-medium">Tabela indisponível.</p>
          <p className="mt-1 text-sm">
            Crie <code className="rounded bg-amber-100 px-1">notas_fiscais</code> no Supabase
            (migration em <code>supabase/migrations/create_notas_fiscais.sql</code>).
          </p>
          <p className="mt-2 text-xs opacity-70">{error.message}</p>
        </div>
      </main>
    );
  }

  const notas = (data ?? []) as NF[];
  const total = notas.reduce((s, n) => s + parseValor(n.valor), 0);

  const porCategoria = CATEGORIAS.map((cat) => {
    const itens = notas.filter((n) => normalizarCategoria(n.categoria) === cat);
    return { cat, soma: itens.reduce((s, n) => s + parseValor(n.valor), 0), qtd: itens.length };
  }).filter((c) => c.qtd > 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">TecnoCell Finanças</h1>
        <span className="text-sm text-zinc-500">{notas.length} notas</span>
      </header>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-500">Total registrado</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">{brl(total)}</p>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {porCategoria.map(({ cat, soma, qtd }) => (
          <div key={cat} className="rounded-xl border border-zinc-200 bg-white p-4">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR[cat]}`}>{cat}</span>
            <p className="mt-2 text-xl font-semibold text-zinc-900">{brl(soma)}</p>
            <p className="text-xs text-zinc-400">{qtd} {qtd === 1 ? 'nota' : 'notas'}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Últimas notas</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-left text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Nenhuma nota ainda.</td></tr>
              )}
              {notas.slice(0, 50).map((n, i) => {
                const cat = normalizarCategoria(n.categoria);
                return (
                  <tr key={i} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2.5 text-zinc-900">{n.empresa ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR[cat]}`}>{cat}</span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{n.data_nf ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-zinc-900">{brl(parseValor(n.valor))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
