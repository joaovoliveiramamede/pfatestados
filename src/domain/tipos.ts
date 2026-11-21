export type Arquivo = {
  id: string;
  nome: string;
  tamanho: number;
  caminho: string;
};

export type Registro = {
  id: string;
  codigo: string;
  paciente: string;
  observacao: string;
  criadoEm: string;
  arquivos: Arquivo[];
};

export type ArquivoEntrega = Arquivo & { url: string };

export type Entrega = Omit<Registro, "arquivos"> & {
  codigoFormatado: string;
  link: string;
  arquivos: ArquivoEntrega[];
};

export type NovaEntrega = {
  paciente: string;
  observacao: string;
  arquivos: File[];
};
