import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Search, CheckCircle, Upload, Calendar, RotateCcw, TrendingUp, FileText, User, ClipboardList
} from "lucide-react";
import { ProdutividadeItem, ProdutividadeStats } from "./types_produtividade";

const COLORS = ["#1e293b", "#ea580c", "#16a34a", "#0ea5e9", "#eab308", "#9333ea"];

export default function AppProdutividade() {
  const [data, setData] = useState<ProdutividadeItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("produtividade_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setData(parsed);
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      }
    }
  }, []);

  const parseDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day).getTime();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const mapped = results.data.map((row: any) => ({
            id: row["ID"] || row["Código"] || "",
            data: row["Data"] || "",
            analista: row["Analista"] || row["Responsável"] || "",
            tipoEstudo: row["Tipo"] || row["Categoria"] || "",
            status: row["Status"] || row["Situação"] || "",
            descricao: row["Descrição"] || "",
            horas: Number(row["Horas"]) || 0
          })).filter((item: any) => item.id !== "");
          setData(mapped);
          localStorage.setItem("produtividade_data", JSON.stringify(mapped));
          setIsImporting(false);
        }
      });
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    const timestamps = data.map(d => parseDate(d.data));
    const dateRange = data.length > 0 
      ? `${new Date(Math.min(...timestamps)).toLocaleDateString('pt-BR')} a ${new Date(Math.max(...timestamps)).toLocaleDateString('pt-BR')}`
      : "N/A";

    doc.setFontSize(18);
    doc.text("Relatório de Produtividade - Estudos Operacionais", 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Período: ${dateRange}`, 14, 25);
    doc.text(`Total de Tarefas: ${stats.totalTarefas}`, 14, 32);
    doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 39);

    autoTable(doc, {
      startY: 45,
      head: [["ID", "Data", "Analista", "Tipo", "Status"]],
      body: data.map(item => [item.id, item.data, item.analista, item.tipoEstudo, item.status]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save("Relatorio_Produtividade.pdf");
  };

  // Estatísticas
  const stats = useMemo((): ProdutividadeStats => {
    const analistas: Record<string, number> = {};
    const tipos: Record<string, number> = {};
    const status: Record<string, number> = {};

    data.forEach(item => {
      analistas[item.analista] = (analistas[item.analista] || 0) + 1;
      tipos[item.tipoEstudo] = (tipos[item.tipoEstudo] || 0) + 1;
      status[item.status] = (status[item.status] || 0) + 1;
    });

    return {
      totalTarefas: data.length,
      tarefasConcluidas: status["Concluído"] || 0,
      analistasAtivos: Object.keys(analistas).length,
      porAnalista: Object.entries(analistas).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      porTipo: Object.entries(tipos).map(([name, value]) => ({ name, value })),
      porStatus: Object.entries(status).map(([name, value]) => ({ name, value })),
      evolucaoMensal: [] // Implementar conforme necessidade
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Produtividade - Estudos Operacionais</h1>
            <p className="text-sm md:text-base text-slate-500 font-medium">Monitoramento de desempenho e análise de tarefas</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {data.length > 0 && (
              <button 
                onClick={generatePDF}
                className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <FileText size={20} className="text-blue-600" /> Exportar PDF
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Upload size={20} /> Importar Dados
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
        </header>

      {data.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center shadow-sm">
          <div className="inline-flex p-6 bg-blue-50 text-blue-600 rounded-3xl mb-6">
            <ClipboardList size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Aguardando Dados</h2>
          <p className="text-slate-500 mb-8">Importe o arquivo de produtividade da Seção para gerar o Dashboard.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Estudos</p>
              <p className="text-3xl font-black text-slate-800">{stats.totalTarefas}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concluídos</p>
              <p className="text-3xl font-black text-emerald-600">{stats.tarefasConcluidas}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Analistas Ativos</p>
              <p className="text-3xl font-black text-blue-600">{stats.analistasAtivos}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-widest">Produção por Analista</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.porAnalista} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" fill="#1e293b" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-widest">Tipos de Estudos</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.porTipo} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                      {stats.porTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela Simples */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Analista</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item, i) => (
                  <tr key={i} className="text-sm hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{item.id}</td>
                    <td className="px-6 py-4 text-slate-500">{item.data}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{item.analista}</td>
                    <td className="px-6 py-4 text-slate-500">{item.tipoEstudo}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${item.status === 'Concluído' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <footer className="mt-auto py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="text-left space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chefe da PM/3</p>
            <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Ten. Coronel Moreira</p>
          </div>
          
          <div className="self-center md:self-end">
            <p className="text-slate-400 text-[9px] font-bold tracking-[0.5em] uppercase opacity-50">
              Dev.Fiel.26
            </p>
          </div>

          <div className="text-left md:text-right space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left md:text-right">Oficial Encarregado</p>
            <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Major Saldanha</p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
