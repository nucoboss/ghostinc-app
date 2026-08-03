import http from "node:http";

export type PjudStubMode = "ok" | "empty" | "not-found" | "server-error";

export type PjudStub = {
  url: string;
  requests: { path: string; query: URLSearchParams }[];
  setMode: (mode: PjudStubMode) => void;
  close: () => void;
};

export function startPjudStub(): Promise<PjudStub> {
  const requests: PjudStub["requests"] = [];
  let mode: PjudStubMode = "ok";

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push({ path: url.pathname, query: url.searchParams });

    res.setHeader("content-type", "application/json");
    if (url.pathname.endsWith("/causas/empresa/sugerencias") && mode === "ok") {
      res.statusCode = 200;
      res.end(JSON.stringify({
        data: [
          { nombre: "EMPRESA DEMO SPA", rut: "76123456-7", causas: 12 },
          { nombre: "EMPRESA DEMO SERVICIOS SPA", rut: "76987654-3", causas: 4 },
        ],
      }));
      return;
    }
    if (mode === "not-found") {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    if (mode === "server-error") {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "boom" }));
      return;
    }
    if (mode === "empty") {
      res.statusCode = 200;
      res.end(JSON.stringify({
        data: {
          summary: {
            total: 0,
            total_demandante: 0,
            total_demandado: 0,
            total_abiertas: 0,
            total_cerradas: 0,
            total_por_competencia: {},
            tribunales: 0,
            fecha_desde: null,
            fecha_hasta: null,
            count: 0,
            limit: 10,
            offset: 0,
          },
          causas: [],
        },
      }));
      return;
    }
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        data: {
          summary: {
            total: 1,
            total_demandante: 0,
            total_demandado: 1,
            total_abiertas: 1,
            total_cerradas: 0,
            total_por_competencia: { laboral: 1 },
            tribunales: 1,
            fecha_desde: "2024-03-15",
            fecha_hasta: "2024-03-15",
            count: 1,
            limit: 10,
            offset: 0,
          },
          causas: [
            {
              id: 1,
              competencia: "laboral",
              rol: "O-123-2024",
              tribunal_id: "T-001",
              tribunal_nombre: "Juzgado de Letras del Trabajo de Santiago",
              fecha: "2024-03-15",
              estado: "Tramitación",
              caratulado: "Fixture con Fixture",
              demandante: "Fixture, Uno",
              demandado: "Fixture, Dos",
            },
          ],
        },
      }),
    );
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Stub PJUD sin dirección de escucha."));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/api/v1`,
        requests,
        setMode: (next) => {
          mode = next;
        },
        close: () => server.close(),
      });
    });
  });
}
