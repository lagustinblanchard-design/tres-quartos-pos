This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Inventario: fuente única de verdad

Esta base (Postgres/Prisma) es la **única fuente de verdad de stock** para TresQuartos — tienda online y POS Flask incluidos. El Excel de Dropbox y TiendaNube son legado: no se editan a mano para reflejar stock actual.

- Toda mutación de stock pasa por `src/lib/inventory.ts` (descuento condicional atómico + ledger `StockMovement` obligatorio). No escribir `productVariant.stock` directamente en ningún endpoint nuevo.
- El POS Flask consume `/api/integration/*` (autenticado con `INTEGRATION_API_KEY`) cuando corre con `INVENTORY_MODE=api`. Ver `openspec/changes/unify-inventory-source-of-truth/` en la raíz del repo para el diseño completo.
- Importación inicial desde el Excel: `npm run import:inventory -- ruta/archivo.xlsx` (dry-run, genera `import-report.md`) y luego `-- ruta/archivo.xlsx --apply` una vez revisado el reporte y hecho el conteo físico de las diferencias marcadas.
- `npm test` corre la suite de Vitest (lógica de inventario, rutas de integración, importador).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
