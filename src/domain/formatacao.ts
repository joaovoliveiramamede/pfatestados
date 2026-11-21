export function formatarBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(kb)} KB`;
  }
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(kb / 1024)} MB`;
}

export function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
