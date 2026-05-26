import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Usuarios
  const adminPass = await bcrypt.hash("admin123", 10);
  const vendedorPass = await bcrypt.hash("vendedor123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@tqdeportes.com" },
    update: {},
    create: {
      email: "admin@tqdeportes.com",
      name: "Admin TQ",
      password: adminPass,
      role: "ADMIN",
    },
  });

  const vendedor = await prisma.user.upsert({
    where: { email: "vendedor@tqdeportes.com" },
    update: {},
    create: {
      email: "vendedor@tqdeportes.com",
      name: "Vendedor Demo",
      password: vendedorPass,
      role: "VENDEDOR",
    },
  });

  console.log("✅ Usuarios creados:", admin.email, vendedor.email);

  // Categorías
  const cats = await Promise.all(
    [
      { name: "Remeras", slug: "remeras" },
      { name: "Pantalones", slug: "pantalones" },
      { name: "Calzado", slug: "calzado" },
      { name: "Buzos", slug: "buzos" },
      { name: "Accesorios", slug: "accesorios" },
    ].map((c) =>
      prisma.category.upsert({
        where: { slug: c.slug },
        update: {},
        create: c,
      })
    )
  );

  // Marcas
  const brands = await Promise.all(
    [
      { name: "TQ Deportes", slug: "tq-deportes" },
      { name: "Nike", slug: "nike" },
      { name: "Adidas", slug: "adidas" },
    ].map((b) =>
      prisma.brand.upsert({
        where: { slug: b.slug },
        update: {},
        create: b,
      })
    )
  );

  console.log("✅ Categorías y marcas creadas");

  // Productos de ejemplo
  const remeraData = {
    name: "Remera Training Pro",
    slug: "remera-training-pro",
    description: "Remera técnica de alto rendimiento. Tejido transpirable con tecnología Dry-Fit. Ideal para entrenamiento, running y actividades de alta intensidad.",
    sku: "REM-TRAINING-PRO",
    categoryId: cats[0].id,
    brandId: brands[0].id,
    gender: "UNISEX",
    isFeatured: true,
    tags: ["training", "running", "dry-fit"],
  };

  const remera = await prisma.product.upsert({
    where: { slug: remeraData.slug },
    update: {},
    create: remeraData,
  });

  // Variantes de remera
  const sizes = ["S", "M", "L", "XL"];
  const colors = [
    { color: "Negro", colorHex: "#1a1a1a" },
    { color: "Azul", colorHex: "#1d4ed8" },
    { color: "Blanco", colorHex: "#ffffff" },
  ];

  let variantCount = 0;
  for (const size of sizes) {
    for (const { color, colorHex } of colors) {
      const sku = `REM-TP-${size.toUpperCase()}-${color.toUpperCase().slice(0, 3)}`;
      await prisma.productVariant.upsert({
        where: { sku },
        update: {},
        create: {
          productId: remera.id,
          sku,
          size,
          color,
          colorHex,
          price: 12990,
          costPrice: 6500,
          stock: Math.floor(Math.random() * 15) + 2,
          stockAlert: 3,
        },
      });
      variantCount++;
    }
  }

  // Producto calzado
  const calzadoData = {
    name: "Calzado Running X200",
    slug: "calzado-running-x200",
    description: "Zapatilla de running con amortiguación superior. Suela de goma de alto rendimiento para máximo agarre y durabilidad.",
    sku: "CAL-RUNNING-X200",
    categoryId: cats[2].id,
    brandId: brands[1].id,
    gender: "UNISEX",
    isFeatured: true,
    tags: ["running", "calzado", "zapatillas"],
  };

  const calzado = await prisma.product.upsert({
    where: { slug: calzadoData.slug },
    update: {},
    create: calzadoData,
  });

  for (const num of [38, 39, 40, 41, 42, 43, 44]) {
    const sku = `CAL-X200-${num}-BL`;
    await prisma.productVariant.upsert({
      where: { sku },
      update: {},
      create: {
        productId: calzado.id,
        sku,
        size: String(num),
        color: "Blanco/Negro",
        colorHex: "#f5f5f5",
        price: 45990,
        costPrice: 22000,
        barcode: `789${num}000001`,
        stock: Math.floor(Math.random() * 8) + 1,
        stockAlert: 2,
      },
    });
    variantCount++;
  }

  console.log(`✅ ${variantCount} variantes creadas`);

  // Configuración del negocio
  const configs = [
    { key: "business_name", value: "TQ Deportes", description: "Nombre del negocio" },
    { key: "business_cuit", value: "20-12345678-9", description: "CUIT" },
    { key: "business_address", value: "Av. Corrientes 1234, CABA", description: "Dirección" },
    { key: "business_phone", value: "+54 9 11 1234-5678", description: "Teléfono" },
    { key: "business_email", value: "info@tqdeportes.com", description: "Email" },
    { key: "invoice_series", value: "0001", description: "Serie de facturas" },
    { key: "stock_alert_default", value: "5", description: "Alerta de stock por defecto" },
    { key: "shipping_free_above", value: "50000", description: "Envío gratis a partir de (ARS)" },
  ];

  for (const config of configs) {
    await prisma.businessConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  // Zona de envío
  await prisma.shippingZone.upsert({
    where: { id: "zone-caba" },
    update: {},
    create: {
      id: "zone-caba",
      name: "CABA y GBA",
      provinces: ["Buenos Aires", "CABA"],
      price: 2500,
      minDays: 1,
      maxDays: 3,
    },
  });

  await prisma.shippingZone.upsert({
    where: { id: "zone-nacional" },
    update: {},
    create: {
      id: "zone-nacional",
      name: "Interior del país",
      provinces: ["Córdoba", "Rosario", "Mendoza", "Tucumán", "Salta", "Santa Fe"],
      price: 5500,
      minDays: 3,
      maxDays: 7,
    },
  });

  console.log("✅ Configuración del negocio creada");
  console.log("\n🎉 Seed completado!\n");
  console.log("Usuarios de prueba:");
  console.log("  Admin:    admin@tqdeportes.com / admin123");
  console.log("  Vendedor: vendedor@tqdeportes.com / vendedor123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
