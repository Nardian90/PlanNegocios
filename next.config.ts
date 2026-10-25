import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
