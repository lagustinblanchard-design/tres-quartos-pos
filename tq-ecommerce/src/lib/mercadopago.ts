import MercadoPagoConfig, { Preference, Payment } from "mercadopago";

// Singleton — se inicializa una sola vez con el access token del entorno
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? "",
  options: { timeout: 5000 },
});

export const mpPreference = new Preference(client);
export const mpPayment = new Payment(client);
