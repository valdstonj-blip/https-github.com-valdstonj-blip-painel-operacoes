import Papa from "papaparse";
import { DataItem } from "./genericTypes";

/**
 * CONFIGURAÇÃO DE MAPEAMENTO
 * Altere os nomes das colunas abaixo para corresponder ao seu novo CSV
 */
const COLUMN_MAPPING = {
  id: ["ID", "Código", "Nº Operação", "CPF"],
  category: ["Unidade", "Vendedor", "Departamento", "UOpE"],
  subCategory: ["Produto", "Tipo", "Circunstância"],
  date: ["Data", "Data de Emissão"],
  value: ["Quantidade", "Valor", "Total"],
  status: ["Situação", "Status", "Fase"],
  description: ["Local", "Descrição", "Observação"]
};

/**
 * Função para encontrar o valor correto no CSV baseado nos nomes possíveis
 */
const getValueByPossibleKeys = (row: any, possibleKeys: string[]) => {
  const foundKey = Object.keys(row).find(key => 
    possibleKeys.some(pk => key.trim().toLowerCase() === pk.toLowerCase())
  );
  return foundKey ? String(row[foundKey]).trim() : "";
};

/**
 * PROCESSADOR GENÉRICO DE CSV
 */
export const processGenericCSV = (fileOrUrl: File | string, onComplete: (data: DataItem[]) => void) => {
  const config: any = {
    header: true,
    download: typeof fileOrUrl === "string",
    skipEmptyLines: true,
    complete: (results: any) => {
      const mappedData: DataItem[] = results.data.map((row: any) => ({
        id: getValueByPossibleKeys(row, COLUMN_MAPPING.id),
        category: getValueByPossibleKeys(row, COLUMN_MAPPING.category),
        subCategory: getValueByPossibleKeys(row, COLUMN_MAPPING.subCategory),
        date: getValueByPossibleKeys(row, COLUMN_MAPPING.date),
        value: Number(getValueByPossibleKeys(row, COLUMN_MAPPING.value)) || 0,
        status: getValueByPossibleKeys(row, COLUMN_MAPPING.status),
        description: getValueByPossibleKeys(row, COLUMN_MAPPING.description),
        metadata: row // Guarda o resto dos dados originais por segurança
      })).filter((item: any) => item.id !== ""); // Remove linhas vazias

      onComplete(mappedData);
    }
  };
  Papa.parse(fileOrUrl as any, config);
};
