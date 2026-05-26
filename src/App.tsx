import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
  X,
  Upload,
  Calendar,
  RotateCcw,
  Bell,
  TrendingUp,
  FileText,
  Map,
  MapPin
} from "lucide-react";
import { rawData } from "./data";
import { Operation, DashboardStats } from "./types";

const COLORS = [
  "#1e293b", // Dark Blue
  "#ea580c", // Orange
  "#16a34a", // Green
  "#0ea5e9", // Sky Blue
  "#eab308", // Yellow
  "#9333ea", // Purple
  "#dc2626", // Red
  "#2563eb", // Blue
  "#4f46e5", // Indigo
  "#f97316", // Orange-light
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f43f5e", // Rose
];

const STATUS_COLORS: Record<string, string> = {
  "Finalizado": "#1e293b",
  "Em andamento": "#ea580c",
  "Cancelado": "#dc2626",
  "Pendente": "#eab308"
};

// Helper to parse DD/MM/YYYY to timestamp (local time)
const parseDateToTimestamp = (dateStr: string) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
};

// Helper to normalize IDs for consistent matching
const normalizeId = (id: string) => id.trim().toUpperCase().replace(/\s+/g, '');

export default function App() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUope, setFilterUope] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFinalReport, setFilterFinalReport] = useState("");
  const [filterCircumstance, setFilterCircumstance] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Persistence: Load on mount
  useEffect(() => {
    const saved = localStorage.getItem("dash_pm3_operations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOperations(parsed);
        }
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
      }
    }
  }, []);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterUope("");
    setFilterId("");
    setFilterStatus("");
    setFilterFinalReport("");
    setFilterCircumstance("");
    setStartDate("");
    setEndDate("");
  };

  const filteredData = useMemo(() => {
    return operations.filter((op) => {
      const opTime = parseDateToTimestamp(op.date);
      
      const matchesSearch =
        op.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUope = !filterUope || op.uope === filterUope;
      const matchesId = !filterId || op.id.toLowerCase().includes(filterId.toLowerCase());
      const matchesStatus = !filterStatus || op.status === filterStatus;
      const matchesFinalReport = !filterFinalReport || op.finalReport === filterFinalReport;
      const matchesCircumstance = !filterCircumstance || op.circumstance === filterCircumstance;
      
      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00').getTime();
        matchesDate = matchesDate && opTime >= start;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        matchesDate = matchesDate && opTime <= end;
      }

      return matchesSearch && matchesUope && matchesId && matchesStatus && matchesFinalReport && matchesCircumstance && matchesDate;
    });
  }, [operations, searchTerm, filterUope, filterId, filterStatus, filterFinalReport, filterCircumstance, startDate, endDate]);

  const filteredSummary = useMemo(() => {
    const uopeUniqueIds: Record<string, Set<string>> = {};
    const allUniqueIds = new Set<string>();
    
    filteredData.forEach(op => {
      const nid = normalizeId(op.id);
      allUniqueIds.add(nid);
      
      if (!uopeUniqueIds[op.uope]) uopeUniqueIds[op.uope] = new Set();
      uopeUniqueIds[op.uope].add(nid);
    });

    const uniqueCount = allUniqueIds.size;
    const extraLines = filteredData.length - uniqueCount;

    return {
      uopeList: Object.entries(uopeUniqueIds)
        .map(([name, ids]) => ({ name, total: ids.size }))
        .sort((a, b) => b.total - a.total),
      uniqueCount,
      extraLines,
      activeUnits: Object.keys(uopeUniqueIds).length
    };
  }, [filteredData]);

  // Analysis logic
  const stats = useMemo((): DashboardStats => {
    const idCounts: Record<string, number> = {};
    const uopeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const circumstanceCounts: Record<string, number> = {};
    const dateCounts: Record<string, number> = {};
    const uopeDuplicateCounts: Record<string, number> = {};

    filteredData.forEach((op) => {
      const nid = normalizeId(op.id);
      idCounts[nid] = (idCounts[nid] || 0) + 1;
      uopeCounts[op.uope] = (uopeCounts[op.uope] || 0) + 1;
      statusCounts[op.status] = (statusCounts[op.status] || 0) + 1;
      circumstanceCounts[op.circumstance] = (circumstanceCounts[op.circumstance] || 0) + 1;
      if (op.status === "Finalizado") {
        dateCounts[op.date] = (dateCounts[op.date] || 0) + 1;
      }
    });

    const duplicateIds = Object.keys(idCounts).filter((id) => idCounts[id] > 1);
    
    // Count duplicates per UOpE
    filteredData.forEach((op) => {
      const nid = normalizeId(op.id);
      if (duplicateIds.includes(nid) && op.uope.trim() !== "") {
        uopeDuplicateCounts[op.uope] = (uopeDuplicateCounts[op.uope] || 0) + 1;
      }
    });

    const mostDuplicatedUopeEntry = Object.entries(uopeDuplicateCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      total: filteredData.length,
      uniqueOperations: Object.keys(idCounts).length,
      correctlyLaunched: Object.keys(idCounts).length - duplicateIds.length,
      duplicates: duplicateIds.length,
      byUope: Object.entries(uopeCounts)
        .filter(([name]) => name.trim() !== "")
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      byStatus: Object.entries(statusCounts)
        .filter(([name]) => name.trim() !== "")
        .map(([name, value]) => ({ name, value })),
      byCircumstance: Object.entries(circumstanceCounts)
        .filter(([name]) => name.trim() !== "")
        .map(([name, value]) => ({ name, value })),
      byDate: Object.entries(dateCounts)
        .map(([name, value]) => ({ name, value, timestamp: parseDateToTimestamp(name) }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(({ name, value }) => ({ name, value })),
      duplicateIds,
      mostDuplicatedUope: mostDuplicatedUopeEntry ? { name: mostDuplicatedUopeEntry[0], count: mostDuplicatedUopeEntry[1] } : undefined,
      topDuplicatedUopes: Object.entries(uopeDuplicateCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }, [filteredData]);

  const duplicateAlerts = useMemo(() => {
    const idMap: Record<string, Operation[]> = {};
    operations.forEach(op => {
      const nid = normalizeId(op.id);
      if (!idMap[nid]) idMap[nid] = [];
      idMap[nid].push(op);
    });

    return Object.entries(idMap)
      .filter(([nid, ops]) => ops.length > 1)
      .map(([nid, ops]) => ({
        id: ops[0].id, // Use the original ID format from the first occurrence
        count: ops.length,
        ops
      }));
  }, [operations]);

  const isAnyFilterActive = !!(searchTerm || filterUope || filterId || filterStatus || filterFinalReport || filterCircumstance || startDate || endDate);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
      setImportError(null);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Calculate duplicates within filtered data for highlighting
    const idCounts: Record<string, number> = {};
    filteredData.forEach(op => {
      const nid = normalizeId(op.id);
      idCounts[nid] = (idCounts[nid] || 0) + 1;
    });
    const duplicateIds = Object.entries(idCounts)
      .filter(([_, count]) => count > 1)
      .map(([nid]) => nid);

    // Calculate period range
    const timestamps = filteredData.map(op => parseDateToTimestamp(op.date));
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const dateRangeStr = filteredData.length > 0 
      ? `${new Date(minTimestamp).toLocaleDateString('pt-BR')} a ${new Date(maxTimestamp).toLocaleDateString('pt-BR')}`
      : "N/A";

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("Estado Maior Geral - PM/3", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Dados ADPF - Relatório de Operações", 105, 22, { align: "center" });
    
    // Summary Section
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 28, 196, 28);
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO DA FILTRAGEM:", 14, 36);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Volume Total de Registros: ${filteredData.length}`, 14, 42);
    doc.text(`Período de Referência: ${dateRangeStr}`, 14, 49);
    doc.setTextColor(185, 28, 28); // rose-700
    doc.text(`Total de Linhas em Duplicidade: ${filteredSummary.extraLines}`, 14, 56);
    
    if (filterUope) {
      doc.setTextColor(51, 65, 85);
      doc.text(`Unidade Selecionada: ${filterUope}`, 14, 63);
    }

    // Detailed Duplicate Info if any
    let currentY = filterUope ? 72 : 65;
    if (duplicateIds.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.setFont("helvetica", "bold");
      doc.text("IDs DUPLICADOS NESTE RELATÓRIO:", 14, currentY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const dupText = duplicateIds.map(id => `${id} (${idCounts[id]}x)`).join(", ");
      const splitText = doc.splitTextToSize(dupText, 180);
      doc.text(splitText, 14, currentY + 5);
      currentY += (splitText.length * 4) + 8;
    }

    // Table Data
    const tableRows = filteredData.map(op => {
      const isDuplicate = idCounts[normalizeId(op.id)] > 1;
      return [
        isDuplicate ? `[DUPLICADO] ${op.id}` : op.id,
        `${op.date} ${op.time}`,
        op.uope,
        op.location,
        op.finalReport
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Nº Operação", "Data/Hora", "UOpE", "Local", "Relatório Final"]],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        4: { cellWidth: 25 }
      },
      didParseCell: (data) => {
        // Highlight duplicate rows for B&W visibility (Gray background)
        if (data.section === 'body') {
          const rowText = String(data.cell.raw || "");
          if (rowText.includes("[DUPLICADO]")) {
            data.cell.styles.fillColor = [230, 230, 230]; // Light gray (visible in B&W)
            data.cell.styles.textColor = [0, 0, 0]; // Pure black for contrast
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        // Footer
        const str = "Dev.Fiel.26";
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, 105, pageHeight - 10, { align: "center" });
        doc.text(`Página ${data.pageNumber}`, 196, pageHeight - 10, { align: "right" });
        
        // Legend for duplicates
        if (duplicateIds.length > 0) {
          doc.setFontSize(7);
          doc.setTextColor(180, 83, 9);
          doc.text("(*) Indica registro com ID duplicado (destacado em amarelo)", 14, pageHeight - 10);
        }
      }
    });

    const fileName = filterUope ? `Relatorio_${filterUope}.pdf` : "Relatorio_Operacoes.pdf";
    doc.save(fileName);
  };

  const generateQuantityPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("Estado Maior Geral - PM/3", 105, 15, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(51, 65, 85);
    doc.text("Relatório Geral de Produtividade Operacional", 105, 23, { align: "center" });
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 30, 196, 30);
    
    // Calculate period range
    const timestamps = filteredData.map(op => parseDateToTimestamp(op.date));
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const dateRangeStr = filteredData.length > 0 
      ? `${new Date(minTimestamp).toLocaleDateString('pt-BR')} a ${new Date(maxTimestamp).toLocaleDateString('pt-BR')}`
      : "N/A";

    // Summary Section
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("ESTATÍSTICAS GERAIS DO PERÍODO:", 14, 40);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Volume Total de Registros: ${filteredData.length}`, 14, 48);
    doc.text(`Nº de Operações Realizadas: ${filteredSummary.uniqueCount}`, 14, 55);
    doc.text(`Unidades Operacionais Ativas: ${filteredSummary.activeUnits}`, 14, 62);
    doc.text(`Período do Relatório: ${dateRangeStr}`, 14, 69);
    
    doc.setTextColor(30, 41, 59);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 78);

    // Table Data - Sorted by Total
    // Filter to only show UOpEs with unique operations
    const tableRows = filteredSummary.uopeList.map((item, index) => [
      (index + 1).toString(),
      item.name,
      item.total.toString(),
      `${((item.total / filteredSummary.uniqueCount) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [["Pos.", "Unidade Operacional (UOpE)", "Qtd. Operações", "% do Total"]],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        2: { halign: 'center', cellWidth: 45 },
        3: { halign: 'center', cellWidth: 30 }
      },
      didDrawPage: (data) => {
        const str = "Dev.Fiel.26 - Sistema de Auditoria de Operações";
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, 105, pageHeight - 10, { align: "center" });
        doc.text(`Página ${data.pageNumber}`, 196, pageHeight - 10, { align: "right" });
      }
    });

    doc.save("Relatorio_Produtividade_Geral.pdf");
  };

  const handleImportData = () => {
    if (!importFile) return;

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const newOps: Operation[] = results.data.map((row: any) => {
          // Find keys case-insensitively if needed, but transformHeader helps
          const getVal = (possibleKeys: string[]) => {
            const key = possibleKeys.find(k => row[k] !== undefined);
            return key ? String(row[key]).trim() : "";
          };

          return {
            id: getVal(["N da Operação", "Nº Operação", "N da Operacao", "N da Operação"]),
            date: getVal(["Data"]),
            time: getVal(["Hora"]),
            uope: getVal(["UOpE", "Uope", "Unidade"]),
            location: getVal(["Local"]).replace(/^"|"$/g, ''),
            circumstance: getVal(["Circustância", "Circunstância", "Circustancia"]),
            initialCommunication: getVal(["Comunicação Inicial", "Comunicacao Inicial", "Comunicação Inicial"]),
            finalReport: getVal(["Relatório Final", "Relatorio Final", "Relatório Final"]),
            status: getVal(["Situação", "Situacao", "Status", "Situação"])
          };
        }).filter(op => op.id && op.uope); // Filter out rows without ID or UOpE

        if (newOps.length > 0) {
          // Replace operations with new ones
          setOperations(newOps);
          localStorage.setItem("dash_pm3_operations", JSON.stringify(newOps));
          setIsImporting(false);
          setImportFile(null);
          setImportError(null);
        } else {
          setImportError("Nenhum dado válido encontrado no arquivo. Verifique se os cabeçalhos das colunas estão corretos (N da Operação, Data, UOpE, etc) e se o arquivo não está vazio.");
        }
      },
      error: (err) => {
        setImportError(`Erro ao processar arquivo: ${err.message}`);
      }
    });
  };

  const uniqueUopes = Array.from(new Set(operations.map((op) => op.uope))).sort();
  const uniqueStatuses = Array.from(new Set(operations.map((op) => op.status))).sort();
  const uniqueFinalReports = Array.from(new Set(operations.map((op) => op.finalReport))).sort();
  const uniqueCircumstances = Array.from(new Set(operations.map((op) => op.circumstance))).sort();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 selection:bg-blue-500/10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Painel de Operações Policiais</h1>
          <p className="text-slate-500 font-medium">Análise de dados e detecção de duplicidades operacionais</p>
        </div>
        <div className="flex gap-3">
          {operations.length > 0 && (
            <button 
              onClick={() => {
                setOperations([]);
                localStorage.removeItem("dash_pm3_operations");
                clearFilters();
              }}
              className="px-4 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all flex items-center justify-center shadow-sm"
            >
              <RotateCcw className="mr-2" size={20} />
              Limpar Dados
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {operations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 animate-in fade-in zoom-in duration-700">
          <div className="max-w-2xl w-full px-6 text-center">
            <div className="inline-flex p-5 bg-blue-50 text-blue-600 rounded-3xl mb-8 shadow-inner">
              <Upload size={48} className="animate-bounce" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-800 mb-4">
              Bem-vindo ao Sistema de Auditoria PM/3
            </h2>
            <p className="text-slate-500 mb-12 text-lg leading-relaxed">
              Carregue seu arquivo CSV para iniciar a análise de produtividade, 
              identificar duplicidades e gerar relatórios oficiais.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-3">
                  <CheckCircle size={20} />
                </div>
                <h4 className="font-bold text-slate-700 text-sm mb-1">Auditoria</h4>
                <p className="text-xs text-slate-500">Detecção automática de IDs repetidos.</p>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-3">
                  <TrendingUp size={20} />
                </div>
                <h4 className="font-bold text-slate-700 text-sm mb-1">Gráficos</h4>
                <p className="text-xs text-slate-500">Visualização dinâmica de produtividade.</p>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3">
                  <FileText size={20} />
                </div>
                <h4 className="font-bold text-slate-700 text-sm mb-1">Relatórios</h4>
                <p className="text-xs text-slate-500">Exportação profissional em PDF.</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setIsImporting(true);
                setImportError(null);
                setImportFile(null);
              }}
              className="group relative px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center gap-3 mx-auto"
            >
              <Upload size={24} className="group-hover:rotate-12 transition-transform" />
              IMPORTAR ARQUIVO CSV
              <div className="absolute -inset-1 bg-blue-400/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total de Registros</p>
                <p className="text-3xl font-black text-slate-800">{stats.total}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Operações Únicas</p>
                <p className="text-3xl font-black text-emerald-600">{stats.uniqueOperations}</p>
              </div>
            </div>
          </div>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 mb-10 flex flex-col lg:flex-row justify-between items-center gap-6 md:gap-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 lg:w-3 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
        
        <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
          <div className="p-3 md:p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner shrink-0">
            <TrendingUp size={28} className="md:size-8" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">Central de Relatórios</h2>
            <p className="text-sm text-slate-500 font-medium">Emissão de documentos oficiais e estatísticos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full lg:w-auto">
          <button 
            onClick={generateQuantityPDF} 
            className="group px-6 md:px-8 py-4 bg-slate-50 text-slate-700 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-3 hover:bg-slate-100 hover:scale-[1.02] transition-all duration-300 border border-slate-200 shadow-sm"
          >
            <TrendingUp size={18} className="text-blue-600 group-hover:scale-125 transition-transform" />
            <span className="whitespace-nowrap uppercase tracking-wider">Relatório Produtividade</span>
          </button>
          
          <button 
            onClick={generatePDF} 
            className="group px-6 md:px-8 py-4 bg-blue-600 text-white rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-3 hover:bg-blue-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-300"
          >
            <AlertTriangle size={18} className="text-blue-200 group-hover:rotate-12 transition-transform" />
            <span className="whitespace-nowrap uppercase tracking-wider">Relatório Auditoria</span>
          </button>
        </div>
      </div>

      {/* Alert System Section - Focus on Duplicates */}
      {duplicateAlerts.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <AlertTriangle size={20} className="animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Alerta de Prioridade: Duplicidades Detectadas
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded-lg font-bold uppercase tracking-widest">{filteredSummary.extraLines} Registros Duplicados</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duplicateAlerts.slice(0, 6).map((alert, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm font-bold text-slate-700">{alert.id}</span>
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">
                      {alert.count} duplicidades
                    </span>
                  </div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">UOpEs envolvidas:</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(alert.ops.map(o => o.uope))).map((u, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-100">
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => {
                      clearFilters();
                      setFilterId(alert.id);
                      tableRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Ver Ocorrências
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Distribuição por UOpE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Distribuição por UOpE</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-md uppercase">Ranking (Top 10)</span>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byUope.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#64748b', fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }}>
                  {stats.byUope.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Circunstância */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Distribuição por Circunstância</h2>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byCircumstance}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                  label={({ name, value }) => `${value}`}
                >
                  {stats.byCircumstance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="center"
                  iconType="rect"
                  wrapperStyle={{ paddingBottom: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução de Operações */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Evolução de Operações (Série Temporal)</h2>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.byDate} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e293b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1e293b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 500 }}
                  angle={-45}
                  textAnchor="end"
                  interval={Math.ceil(stats.byDate.length / 10)}
                />
                <YAxis 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 500 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  name="Operações por Dia"
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1e293b" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  dot={{ r: 4, fill: '#1e293b', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Situação */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Distribuição por Situação</h2>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byStatus} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 600 }}
                />
                <YAxis 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" barSize={60} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#1e293b', fontSize: 11, fontWeight: 'bold' }}>
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      {/* Filters & Table Section */}
      <div ref={tableRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-12">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por Local..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1 text-slate-600">
              <Calendar size={16} className="text-blue-500" />
              <input 
                type="date" 
                className="text-sm outline-none bg-transparent py-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-300">|</span>
              <input 
                type="date" 
                className="text-sm outline-none bg-transparent py-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">N. Operação:</span>
              <input
                type="text"
                placeholder="ID..."
                className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UOpE:</span>
              <select
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={filterUope}
                onChange={(e) => setFilterUope(e.target.value)}
              >
                <option value="">Todas</option>
                {uniqueUopes.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <button
              onClick={clearFilters}
              className="px-4 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest"
            >
              <RotateCcw size={14} />
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Filter Summary Card */}
        {isAnyFilterActive && filteredData.length > 0 && (
          <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex flex-col gap-1 shrink-0">
                <div className="flex items-center gap-2 text-blue-600">
                  <Info size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Resumo da Filtragem:</span>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {filteredData.length} Registros
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-h-[600px] overflow-y-auto relative custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-200">
                <th className="px-6 py-4">Nº Operação</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">UOpE</th>
                <th className="px-6 py-4">Local</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((op, idx) => {
                const nid = normalizeId(op.id);
                const isDuplicate = stats.duplicateIds.includes(nid);
                return (
                  <tr 
                    key={idx} 
                    onClick={() => {
                      setSelectedOp(op);
                      setShowMap(false);
                    }}
                    className={`group cursor-pointer transition-colors hover:bg-slate-50/50 ${isDuplicate ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`font-mono text-sm font-bold ${isDuplicate ? 'text-amber-700' : 'text-slate-800'}`}>{op.id}</span>
                        {isDuplicate && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded uppercase tracking-wider">
                            DUPLO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{op.date}</span>
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{op.time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 uppercase tracking-widest">
                        {op.uope}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-[200px]" title={op.location}>
                      {op.location}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        op.status === 'Finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {op.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="p-2 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-all inline-block">
                        <ChevronRight size={18} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="mt-auto py-12 border-t border-slate-200 bg-slate-50">
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
      </>
      )}

      </div>

      {/* Details Modal */}
      {selectedOp && (
        <div 
          onClick={() => {
            setSelectedOp(null);
            setShowMap(false);
          }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`bg-white w-full ${showMap ? 'max-w-xl md:max-w-2xl' : 'max-w-lg'} rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in zoom-in duration-200`}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Detalhes da Operação</h3>
                <p className="text-sm text-slate-500 font-mono">{selectedOp.id}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedOp(null);
                  setShowMap(false);
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Data e Hora</label>
                  <p className="text-slate-700 font-medium">{selectedOp.date} às {selectedOp.time}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">UOpE</label>
                  <p className="text-slate-700 font-medium">{selectedOp.uope}</p>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block">Localização</label>
                  <button
                    onClick={() => setShowMap(!showMap)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors cursor-pointer"
                  >
                    {showMap ? (
                      <>
                        <X size={14} />
                        Ocultar Mapa
                      </>
                    ) : (
                      <>
                        <Map size={14} />
                        Ver no Mapa
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-700 font-medium">{selectedOp.location}</p>

                {showMap && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 relative animate-in fade-in slide-in-from-top-2 duration-300">
                    <iframe
                      width="100%"
                      height="260"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedOp.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-blue-500" />
                        Aproximação baseada em endereço de texto
                      </span>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOp.location)}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                      >
                        Abrir Externo
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Circunstância</label>
                <p className="text-slate-700 font-medium">{selectedOp.circumstance}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Relatório Final</label>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${selectedOp.finalReport === 'Enviado' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <p className="text-slate-700 font-medium">{selectedOp.finalReport}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Situação Atual</label>
                  <p className={`font-bold ${selectedOp.status === 'Finalizado' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {selectedOp.status.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => {
                  setSelectedOp(null);
                  setShowMap(false);
                }}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImporting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Upload size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Importar Arquivo CSV</h3>
              </div>
              <button 
                onClick={() => setIsImporting(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                <Info className="text-blue-500 shrink-0" size={20} />
                <div className="text-sm text-blue-700">
                  <p className="font-bold mb-1">Requisitos do Arquivo:</p>
                  <p>O arquivo deve ser um CSV (separado por vírgula ou ponto e vírgula) contendo as colunas padrão do sistema ADPF.</p>
                </div>
              </div>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  importFile ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
                <div className={`p-4 rounded-full mb-4 ${importFile ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Upload size={32} />
                </div>
                {importFile ? (
                  <div className="text-center">
                    <p className="font-bold text-slate-800">{importFile.name}</p>
                    <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-bold text-slate-700">Clique para selecionar ou arraste o arquivo</p>
                    <p className="text-xs text-slate-400 mt-1">Apenas arquivos .csv</p>
                  </div>
                )}
              </div>

              {importError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                  <p className="text-sm text-rose-700 font-medium">{importError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setIsImporting(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleImportData}
                  disabled={!importFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Processar Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
