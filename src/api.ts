export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { credentials: "same-origin", ...options, headers });
  const data = (await response.json().catch(() => ({}))) as { erro?: string };
  if (!response.ok) {
    throw new Error(data.erro || "Não foi possível concluir essa ação.");
  }
  return data as T;
}
