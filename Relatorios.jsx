// src/pages/Relatorios.jsx  — Fase 4 + exclusão + impressão

import { useState, useCallback } from 'react';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { useAuth } from '../contexts/AuthContext';
import { PERFIS } from '../config/constants';
import {
  buscarLancamentosComFiltros,
  excluirLancamento,
  formatarData,
} from '../services/relatoriosService';
import { exportarExcel } from '../utils/exportarExcel';
import { imprimirRelatorio } from '../utils/imprimirRelatorio';

const POR_PAGINA = 50;
const FILTROS_VAZIOS = { dataInicio: '', dataFim: '', frota: '', empresa: '', comboio: '', tipoCombustivel: '' };

function hoje() { return new Date().toISOString().split('T')[0]; }
function nomeMes() { return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }

export default function Relatorios() {
  const { perfilUsuario } = useAuth();
  const ehAdmin = perfilUsuario?.perfil === PERFIS.ADMIN;

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [excluindo, setExcluindo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  function setFiltro(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await buscarLancamentosComFiltros(filtros);
      setResultado(dados);
      setPagina(1);
    } catch (err) {
      setErro('Erro ao buscar dados: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  function limpar() {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setPagina(1);
    setErro('');
  }

  function handleExportar() {
    if (!resultado?.length) return;
    const sufixo = filtros.dataInicio
      ? `${filtros.dataInicio}_${filtros.dataFim || hoje()}`
      : nomeMes().replace(' ', '_');
    exportarExcel(resultado, `Relatorio_Abastecimento_${sufixo}`);
  }

  function handleImprimir(separadoPorDia) {
    if (!resultado?.length) return;
    imprimirRelatorio(resultado, separadoPorDia, filtros);
  }

  async function handleExcluir(id) {
    setExcluindo(id);
    setErro('');
    try {
      await excluirLancamento(id);
      setResultado((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setErro('Erro ao excluir: ' + err.message);
    } finally {
      setExcluindo(null);
      setConfirmar(null);
    }
  }

  const totalLitros = resultado
    ? resultado.reduce((s, l) => s + (Number(l.qtdeLitros) || 0), 0)
    : 0;

  const totalPorCombustivel = resultado
    ? Object.entries(
        resultado.reduce((acc, l) => {
          const tipo = l.tipoCombustivel || 'Não informado';
          acc[tipo] = (acc[tipo] || 0) + (Number(l.qtdeLitros) || 0);
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.length / POR_PAGINA)) : 1;
  const pagAtual = resultado ? resultado.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--renea-space-5)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--renea-fs-xl)' }}>Relatórios</h1>
        <p style={{ color: 'var(--renea-texto-secundario)', marginTop: 'var(--renea-space-1)' }}>
          Consulte e exporte os lançamentos de abastecimento.
        </p>
      </div>

      {erro && <Alert tipo="erro">{erro}</Alert>}

      {/* Filtros */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--renea-space-4)', marginBottom: 'var(--renea-space-5)' }}>
          <Input label="De" type="date" value={filtros.dataInicio} onChange={(e) => setFiltro('dataInicio', e.target.value)} />
          <Input label="Até" type="date" value={filtros.dataFim} onChange={(e) => setFiltro('dataFim', e.target.value)} />
          <Input label="Frota" placeholder="Todas" value={filtros.frota} onChange={(e) => setFiltro('frota', e.target.value)} />
          <Input label="Empresa" placeholder="Todas" value={filtros.empresa} onChange={(e) => setFiltro('empresa', e.target.value)} />
          <Input label="Comboio" placeholder="Todos" value={filtros.comboio} onChange={(e) => setFiltro('comboio', e.target.value)} />
          <Input label="Combustível" placeholder="Todos" value={filtros.tipoCombustivel} onChange={(e) => setFiltro('tipoCombustivel', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--renea-space-3)', flexWrap: 'wrap' }}>
          <Button onClick={buscar} carregando={carregando}>Filtrar</Button>
          <Button variante="secundario" onClick={handleExportar} disabled={!resultado?.length}>
            Exportar Excel
          </Button>
          <Button variante="secundario" onClick={() => handleImprimir(false)} disabled={!resultado?.length}>
            🖨️ Imprimir tudo junto
          </Button>
          <Button variante="secundario" onClick={() => handleImprimir(true)} disabled={!resultado?.length}>
            🖨️ Imprimir por dia
          </Button>
          <Button variante="texto" onClick={limpar} disabled={carregando}>Limpar filtros</Button>
        </div>
      </Card>

      {/* Resultados */}
      {resultado !== null && (
        <Card>
          {/* Cabeçalho com totais */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--renea-space-4)', flexWrap: 'wrap', gap: 'var(--renea-space-3)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{resultado.length}</span>
              <span style={{ color: 'var(--renea-texto-secundario)' }}> registro{resultado.length !== 1 ? 's' : ''} encontrado{resultado.length !== 1 ? 's' : ''}</span>
            </div>

            {resultado.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--renea-space-1)' }}>
                {/* Total por combustível */}
                {totalPorCombustivel.map(([tipo, qtde]) => (
                  <div key={tipo} style={{ display: 'flex', gap: 'var(--renea-space-3)', fontSize: 'var(--renea-fs-sm)' }}>
                    <span style={{ color: 'var(--renea-texto-secundario)' }}>{tipo}</span>
                    <span style={{ fontWeight: 600, color: 'var(--renea-verde-institucional)', minWidth: 70, textAlign: 'right' }}>
                      {qtde.toLocaleString('pt-BR')} L
                    </span>
                  </div>
                ))}
                {/* Linha separadora + total geral */}
                <div style={{ borderTop: '1px solid var(--renea-cinza-borda)', paddingTop: 'var(--renea-space-1)', display: 'flex', gap: 'var(--renea-space-3)', fontSize: 'var(--renea-fs-sm)' }}>
                  <span style={{ fontWeight: 600 }}>Total geral</span>
                  <span style={{ fontWeight: 700, color: 'var(--renea-verde-institucional)', minWidth: 70, textAlign: 'right' }}>
                    {totalLitros.toLocaleString('pt-BR')} L
                  </span>
                </div>
              </div>
            )}
          </div>

          {resultado.length === 0 ? (
            <div style={{ border: '1px dashed var(--renea-cinza-borda)', borderRadius: 'var(--renea-radius-md)', padding: 'var(--renea-space-7)', textAlign: 'center', color: 'var(--renea-texto-secundario)' }}>
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--renea-fs-sm)', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: 'var(--renea-cinza-fundo)', borderBottom: '2px solid var(--renea-cinza-borda)' }}>
                      {['Data','Frota','Descrição','Km','Horímetro','Início Bomba','Fim Bomba','Litros','Hora','Comboio','Combustível','Empresa', ehAdmin ? 'Ação' : null]
                        .filter(Boolean)
                        .map((col) => (
                          <th key={col} style={{ padding: 'var(--renea-space-2) var(--renea-space-3)', textAlign: 'left', fontWeight: 600, color: 'var(--renea-verde-institucional)' }}>
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagAtual.map((l, i) => (
                      <tr key={l.id} style={{ background: i % 2 === 0 ? 'var(--renea-branco)' : 'var(--renea-cinza-fundo)', borderBottom: '1px solid var(--renea-cinza-borda)' }}>
                        <td style={td}>{formatarData(l.data)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{l.frotaCodigo || '—'}</td>
                        <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descricao || '—'}</td>
                        <td style={td}>{l.kmInicial ?? '—'}</td>
                        <td style={td}>{l.horimetroInicial ?? '—'}</td>
                        <td style={td}>{l.inicioBomba ?? '—'}</td>
                        <td style={td}>{l.fimBomba ?? '—'}</td>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--renea-verde-institucional)' }}>{l.qtdeLitros ?? '—'}</td>
                        <td style={td}>{l.hora || '—'}</td>
                        <td style={td}>{l.comboio || '—'}</td>
                        <td style={td}>{l.tipoCombustivel || '—'}</td>
                        <td style={td}>{l.empresa || '—'}</td>
                        {ehAdmin && (
                          <td style={td}>
                            {confirmar === l.id ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleExcluir(l.id)} disabled={excluindo === l.id}
                                  style={{ ...btnExcluir, background: 'var(--renea-erro)', color: '#fff' }}>
                                  {excluindo === l.id ? '...' : 'Confirmar'}
                                </button>
                                <button onClick={() => setConfirmar(null)} style={btnCancelar}>Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmar(l.id)} style={btnExcluir}>Excluir</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--renea-space-3)', marginTop: 'var(--renea-space-5)' }}>
                  <Button variante="secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>← Anterior</Button>
                  <span style={{ color: 'var(--renea-texto-secundario)', fontSize: 'var(--renea-fs-sm)' }}>Página {pagina} de {totalPaginas}</span>
                  <Button variante="secundario" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>Próxima →</Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

const td = { padding: 'var(--renea-space-2) var(--renea-space-3)', verticalAlign: 'middle' };
const btnExcluir = { padding: '3px 10px', fontSize: '0.75rem', border: '1px solid var(--renea-erro)', borderRadius: 'var(--renea-radius-sm)', background: 'transparent', color: 'var(--renea-erro)', cursor: 'pointer', whiteSpace: 'nowrap' };
const btnCancelar = { padding: '3px 10px', fontSize: '0.75rem', border: '1px solid var(--renea-cinza-borda)', borderRadius: 'var(--renea-radius-sm)', background: 'transparent', color: 'var(--renea-texto-secundario)', cursor: 'pointer' };
