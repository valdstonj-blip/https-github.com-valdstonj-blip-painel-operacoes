# Documentação do Projeto: Dashboard de Produtividade (Estudos Operacionais)

Este documento serve como guia de referência para o AI Studio construir o sistema de monitoramento de desempenho da Seção de Estudos Operacionais.

## 1. Objetivo do Sistema
Criar um dashboard interativo que processe dados de produtividade (via CSV ou Google Sheets) para visualizar o desempenho dos analistas, o volume de estudos realizados e a situação das tarefas em tempo real.

## 2. Estrutura de Dados (Schema do CSV/Planilha)
O sistema deve ser capaz de ler um arquivo com os seguintes cabeçalhos (ou similares):

| Coluna | Descrição | Exemplo |
| :--- | :--- | :--- |
| **ID** | Identificador único da tarefa | EST-2024-001 |
| **Data** | Data de realização (DD/MM/YYYY) | 10/04/2026 |
| **Analista** | Nome do responsável pela tarefa | Sgt Silva |
| **Tipo** | Categoria do estudo | Análise Criminal |
| **Status** | Situação atual | Concluído / Em Revisão |
| **Descrição** | Detalhes do que foi feito | Elaboração de mapa de calor... |
| **Horas** | Tempo gasto (numérico) | 4 |

## 3. Requisitos Funcionais

### A. Importação de Dados
- **Fase 1 (Atual):** Botão de upload para arquivos CSV.
- **Fase 2 (Futura):** Campo para colar link do Google Sheets (publicado como CSV) para atualização automática.
- **Mapeamento Inteligente:** O sistema deve ser flexível para aceitar variações nos nomes das colunas (ex: "Responsável" em vez de "Analista").

### B. Métricas e Estatísticas
- **Total de Estudos:** Contagem total de registros.
- **Taxa de Conclusão:** Porcentagem de tarefas com status "Concluído".
- **Analistas Ativos:** Contagem de nomes únicos na coluna Analista.
- **Carga Horária:** Soma total da coluna Horas.

### C. Visualizações (Gráficos)
- **Produção por Analista (Bar Chart):** Ranking de quem realizou mais tarefas.
- **Distribuição por Tipo (Pie Chart):** Quais categorias de estudos são mais frequentes.
- **Status das Tarefas (Bar Chart):** Comparativo entre Concluídos, Pendentes e Em Revisão.
- **Evolução Mensal (Area Chart):** Volume de tarefas ao longo do tempo.

## 4. Requisitos de Interface (UI/UX)
- **Estilo:** Moderno, limpo e profissional (estilo Dashboard Corporativo).
- **Cores:** Paleta baseada em Azul Marinho (`#1e293b`) e Cinza Slate, com destaques em Esmeralda para sucessos.
- **Componentes:**
  - Cards de resumo no topo com ícones da biblioteca `lucide-react`.
  - Tabela detalhada com busca e filtros por Analista e Data.
  - Botões de exportação para PDF (Relatório de Produtividade).

## 5. Tecnologias Base
- **Frontend:** React + TypeScript.
- **Estilização:** Tailwind CSS.
- **Gráficos:** Recharts.
- **Processamento:** PapaParse (CSV).
- **PDF:** jsPDF + autoTable.

---
*Instrução para a IA: Ao ler este documento, priorize a criação de um código modular onde o mapeamento das colunas do CSV seja fácil de alterar em um único local.*
