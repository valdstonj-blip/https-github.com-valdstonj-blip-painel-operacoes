export interface ProdutividadeItem {
  id: string;          // Identificador do Estudo/Tarefa
  data: string;        // Data de realização
  analista: string;    // Nome do responsável
  tipoEstudo: string;  // Categoria do estudo (ex: Análise, Planejamento)
  status: string;      // Situação (ex: Concluído, Em Revisão)
  descricao: string;   // Detalhes da tarefa
  horas: number;       // Tempo gasto (opcional)
}

export interface ProdutividadeStats {
  totalTarefas: number;
  tarefasConcluidas: number;
  analistasAtivos: number;
  porAnalista: { name: string; value: number }[];
  porTipo: { name: string; value: number }[];
  porStatus: { name: string; value: number }[];
  evolucaoMensal: { name: string; value: number }[];
}
