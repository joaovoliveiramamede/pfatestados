export async function baixarPdf(url: string, nome: string) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não foi possível baixar o PDF.");
  const bytes = await resposta.arrayBuffer();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const objeto = URL.createObjectURL(blob);
  const ancora = document.createElement("a");
  ancora.href = objeto;
  ancora.download = nome;
  document.body.append(ancora);
  ancora.click();
  ancora.remove();
  URL.revokeObjectURL(objeto);
}
