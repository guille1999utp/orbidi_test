import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantApiPath, assistantBackendBase } from "./assistant-server-fetch";

describe("assistantBackendBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefiere API_URL (servidor Next / Docker) sobre NEXT_PUBLIC", () => {
    vi.stubEnv("API_URL", "http://backend:8000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    expect(assistantBackendBase()).toBe("http://backend:8000");
  });

  it("usa NEXT_PUBLIC si no hay API_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:9999/");
    expect(assistantBackendBase()).toBe("http://127.0.0.1:9999");
  });

  it("fallback localhost:8000", () => {
    expect(assistantBackendBase()).toBe("http://localhost:8000");
  });
});

describe("assistantApiPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("monta /api y normaliza path", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    expect(assistantApiPath("/tickets")).toBe("http://localhost:8000/api/tickets");
    expect(assistantApiPath("users")).toBe("http://localhost:8000/api/users");
  });
});
