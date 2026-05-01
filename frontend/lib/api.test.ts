import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl, parseApiErrorMessage, wsUrl } from "./api";

describe("parseApiErrorMessage", () => {
  it("devuelve mensaje fijo si la respuesta está vacía", () => {
    expect(parseApiErrorMessage("")).toBe("Error desconocido");
    expect(parseApiErrorMessage("   ")).toBe("Error desconocido");
  });

  it("devuelve texto plano si no es JSON", () => {
    expect(parseApiErrorMessage("servidor caído")).toBe("servidor caído");
  });

  it("extrae detail string de FastAPI", () => {
    const raw = JSON.stringify({ detail: "No autorizado" });
    expect(parseApiErrorMessage(raw)).toBe("No autorizado");
  });

  it("une mensajes de validación tipo lista", () => {
    const raw = JSON.stringify({
      detail: [{ msg: "field required", type: "missing" }],
    });
    expect(parseApiErrorMessage(raw)).toContain("field required");
  });
});

describe("apiUrl y wsUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefija /api y quita barra final de la base", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/v1/");
    expect(apiUrl("/users")).toBe("https://example.com/v1/api/users");
    expect(apiUrl("tickets")).toBe("https://example.com/v1/api/tickets");
  });

  it("usa ws y codifica el token", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    const u = wsUrl("abc=token");
    expect(u.startsWith("ws://localhost:8000/api/ws?token=")).toBe(true);
    expect(u).toContain(encodeURIComponent("abc=token"));
  });

  it("wss cuando la base es https", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    expect(wsUrl("x")).toMatch(/^wss:\/\/api\.example\.com\/api\/ws\?token=/);
  });
});
