import type { NovaEntrega, Registro } from "../domain/tipos";

export interface RepositorioEntrega {
  listar(): Promise<Registro[]>;
  obter(codigo: string): Promise<Registro | null>;
  criar(entrega: NovaEntrega, codigoMedico: string): Promise<Registro>;
  excluir(id: string, codigoMedico: string): Promise<void>;
}
