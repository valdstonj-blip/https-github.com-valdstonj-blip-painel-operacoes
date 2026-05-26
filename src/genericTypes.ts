export interface DataItem {
  id: string;          // Identificador único (ex: ID, Código, CPF)
  category: string;    // Categoria principal (ex: Unidade, Vendedor, Departamento)
  subCategory: string; // Subcategoria (ex: Tipo, Produto, Setor)
  date: string;        // Data (DD/MM/YYYY)
  value: number;       // Valor numérico para cálculos (ex: Quantidade, Preço)
  status: string;      // Situação (ex: Concluído, Pendente, Ativo)
  description: string; // Informação extra ou local
  metadata: Record<string, any>; // Qualquer outro campo adicional do CSV
}

export interface GenericDashboardStats {
  totalRecords: number;
  uniqueIds: number;
  duplicatesCount: number;
  totalValue: number;
  
  // Dados para Gráficos
  byCategory: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  byDate: { name: string; value: number }[];
  
  // Alertas
  duplicateIds: string[];
}
