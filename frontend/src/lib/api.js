// Cliente HTTP simples. Vazio = mesma origem do site (app e API na mesma porta).
const BASE = "";

function getToken() {
  return localStorage.getItem("fc_token");
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* resposta sem corpo */
  }

  // Sessão expirada/inválida: limpa e volta para o login automaticamente.
  // (Não se aplica às rotas de login/cadastro, onde 401 = senha errada.)
  if (res.status === 401 && token && !path.startsWith("/auth")) {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_user");
    window.location.href = "/";
    throw new Error("Sua sessão expirou — entre novamente.");
  }

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};
