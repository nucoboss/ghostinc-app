// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { causaResponse } from "../../test/fixtures/causas";
import { SearchForm } from "./search-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchForm", () => {
  it("sugiere razones sociales con RUT y permite seleccionar una", async () => {
    const suggestions = {
      data: [
        { nombre: "EMPRESA DEMO SPA", rut: "76123456-7", causas: 12 },
        { nombre: "EMPRESA DEMO SERVICIOS SPA", rut: "76987654-3", causas: 4 },
      ],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(suggestions), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchForm />);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.type(input, "Empresa Demo");

    const option = await screen.findByRole("option", { name: /EMPRESA DEMO SPA.*76123456-7.*12 causas/ });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/causas/sugerencias");
    await user.click(option);
    expect(input.value).toBe("EMPRESA DEMO SPA");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("busca por nombre de empresa y muestra resultados", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(causaResponse()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchForm />);

    await user.type(screen.getByRole("searchbox"), "Empresa Demo SPA");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("link", { name: /O-1-2025/ })).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      kind: "company",
      query: "Empresa Demo SPA",
    });
  });

  it("no permite buscar una persona por nombre y exige RUT válido en ese modo", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchForm />);

    await user.click(screen.getByRole("button", { name: "Por RUT" }));
    await user.type(screen.getByRole("searchbox"), "Juan Pérez");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByRole("alert").textContent).toContain("RUT chileno válido");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra estado vacío como resultado, no como error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(causaResponse(0)), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<SearchForm />);

    await user.type(screen.getByRole("searchbox"), "Empresa Sin Causas");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/No encontramos causas abiertas/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retira resultados anteriores durante una nueva carga", async () => {
    let resolveSecond!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(causaResponse()), { status: 200 }))
      .mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchForm />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "Empresa Uno");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByRole("link", { name: /O-1-2025/ })).toBeTruthy();

    await user.clear(input);
    await user.type(input, "Empresa Dos");
    fireEvent.submit(input.closest("form")!);

    expect(screen.queryByRole("link", { name: /O-1-2025/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Consultando");
    resolveSecond(new Response(JSON.stringify(causaResponse(0)), { status: 200 }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("maneja fechas inválidas sin romper el render", async () => {
    const response = causaResponse();
    response.data.causas[0]!.fecha = "fecha-invalida";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<SearchForm />);

    await user.type(screen.getByRole("searchbox"), "Empresa Demo");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Fecha no informada")).toBeTruthy();
  });
});
