// Declaración de tipos del módulo 'bun:test' para la comprobación estricta
// con tsc (bun ejecuta las pruebas con su propio cargador).
declare module 'bun:test' {
  export function describe(nombre: string, fn: () => void): void;
  export function test(nombre: string, fn: () => void | Promise<void>): void;
  export function it(nombre: string, fn: () => void | Promise<void>): void;
  export const expect: {
    (actual: unknown): {
      toBe(esperado: unknown): void;
      toEqual(esperado: unknown): void;
      toBeCloseTo(esperado: number, precision?: number): void;
      toBeGreaterThan(esperado: number): void;
      toBeGreaterThanOrEqual(esperado: number): void;
      toBeLessThan(esperado: number): void;
      toBeLessThanOrEqual(esperado: number): void;
      toBeNull(): void;
      toBeDefined(): void;
      toBeUndefined(): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toContain(esperado: unknown): void;
      toHaveLength(largo: number): void;
      toBeNaN(): void;
      toHaveProperty(clave: string | number | symbol, valor?: unknown): void;
      toThrow(mensaje?: string | RegExp): void;
      not: {
        toBe(esperado: unknown): void;
        toEqual(esperado: unknown): void;
        toBeNull(): void;
        toContain(esperado: unknown): void;
        toBeCloseTo(esperado: number, precision?: number): void;
        toBeGreaterThan(esperado: number): void;
        toBeLessThan(esperado: number): void;
        toBeNaN(): void;
        toHaveProperty(clave: string | number | symbol, valor?: unknown): void;
        toThrow(mensaje?: string | RegExp): void;
      };
    };
  };
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}
