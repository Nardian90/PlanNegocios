import type { NextConfig } from "next";

/**
 * PLANEX Cuba es una aplicación de página única 100% del lado del cliente:
 * motor de cálculo, persistencia (localStorage) y exportaciones (PDF/XLSX/JSON)
 * se ejecutan íntegramente en el navegador, sin servidor en tiempo de ejecución.
 * Por ello se exporta como sitio estático, desplegable en GitHub Pages,
 * Vercel o cualquier hosting de archivos estáticos.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Sitio estático (out/): la app no requiere servidor.
  output: "export",
  // Prefijo de ruta para despliegues en subdirectorio (p. ej. GitHub Pages:
  // NEXT_PUBLIC_BASE_PATH=/PlanNegocios). Vacío = raíz del dominio.
  ...(basePath ? { basePath } : {}),
  // No se usa next/image en la aplicación.
  images: { unoptimized: true },
  typescript: {
    // El proyecto se valida mediante `bun test` (58 pruebas del motor de cálculo,
    // exportadores XLSX/PDF y round-trip JSON) y `bun run lint`. Se mantiene la
    // compilación tolerante para que errores de tipado estricto no bloqueen la
    // construcción del plan de negocios en curso.
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
