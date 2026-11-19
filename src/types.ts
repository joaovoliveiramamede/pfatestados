export type Arquivo = {
  id: string;
  nome: string;
  tamanho: number;
};

export type Entrega = {
  id: string;
  codigo: string;
  codigoFormatado: string;
  paciente: string;
  observacao: string;
  criadoEm: string;
  link: string;
  arquivos: Arquivo[];
};
