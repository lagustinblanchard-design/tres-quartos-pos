import { Resend } from "resend";

// Lazy init — Resend throws at construction if key is missing
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const FROM_EMAIL = process.env.EMAIL_FROM ?? "TQ Deportes <noreply@tqdeportes.com.ar>";

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

// ─── Order confirmation email ─────────────────────────────────────────────────
export type OrderEmailData = {
  orderNumber: number;
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  shippingAddr?: string;
  shippingCity?: string;
};

const PAY_LABELS: Record<string, string> = {
  MERCADOPAGO: "MercadoPago",
  TRANSFERENCIA: "Transferencia bancaria",
  EFECTIVO: "Efectivo",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
};

function orderConfirmationHtml(data: OrderEmailData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <strong>${item.name}</strong><br>
          <span style="color:#6b7280;font-size:13px;">${item.variant}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;">
          x${item.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">
          ${fmt(item.subtotal)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#3A3A3A;padding:4px 0 0;text-align:center;">
      <div style="background:#F5C200;height:4px;"></div>
      <div style="padding:28px 40px;">
        <div style="display:inline-block;background:#3A3A3A;border:2px solid #F5C200;border-radius:50%;width:44px;height:44px;line-height:44px;text-align:center;margin-bottom:8px;">
          <span style="color:#F5C200;font-size:16px;font-weight:900;">TQ</span>
        </div>
        <h1 style="color:white;margin:8px 0 0;font-size:22px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">TRES QUARTOS</h1>
        <p style="color:#F5C200;margin:4px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Tu pedido fue confirmado</p>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="font-size:16px;margin:0 0 8px;">Hola, <strong>${data.customerName}</strong></p>
      <p style="color:#4b5563;margin:0 0 24px;">Recibimos tu pedido y está siendo procesado. Te avisaremos cuando esté en camino.</p>

      <!-- Order number badge -->
      <div style="background:#fffbeb;border:1px solid #F5C200;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;color:#6b7280;font-size:13px;">Número de pedido</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#3A3A3A;">#${data.orderNumber}</p>
      </div>

      <!-- Items -->
      <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Detalle del pedido</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${itemsHtml}</tbody>
      </table>

      <!-- Totals -->
      <table style="width:100%;margin-top:16px;font-size:14px;">
        <tr>
          <td style="color:#6b7280;padding:4px 0;">Subtotal</td>
          <td style="text-align:right;color:#6b7280;">${fmt(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;padding:4px 0;">Envío</td>
          <td style="text-align:right;color:#6b7280;">${data.shipping === 0 ? "Gratis" : fmt(data.shipping)}</td>
        </tr>
        <tr>
          <td style="font-size:16px;font-weight:700;padding:12px 0 4px;border-top:2px solid #111827;">Total</td>
          <td style="text-align:right;font-size:16px;font-weight:700;padding:12px 0 4px;border-top:2px solid #111827;color:#3A3A3A;">${fmt(data.total)}</td>
        </tr>
      </table>

      <!-- Payment method -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-top:24px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Método de pago</p>
        <p style="margin:4px 0 0;font-weight:600;">${PAY_LABELS[data.paymentMethod] ?? data.paymentMethod}</p>
      </div>

      ${data.shippingAddr ? `
      <!-- Shipping -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Dirección de envío</p>
        <p style="margin:4px 0 0;font-weight:600;">${data.shippingAddr}${data.shippingCity ? `, ${data.shippingCity}` : ""}</p>
      </div>` : ""}

      <!-- CTA -->
      <div style="text-align:center;margin-top:32px;">
        <a href="${process.env.NEXT_PUBLIC_URL ?? "https://tresquartos.com.ar"}/cuenta/pedidos"
           style="display:inline-block;background:#F5C200;color:#3A3A3A;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:800;font-size:15px;letter-spacing:0.5px;">
          Ver mi pedido
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Tres Quartos · Si tenés alguna pregunta, contactanos por WhatsApp o respondé este email.<br>
        <em style="color:#F5C200;">"Jugado. Vendido. Vuelto a jugar."</em>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendOrderConfirmation(data: OrderEmailData) {
  const client = getResend();
  if (!client) {
    console.log("[email] RESEND_API_KEY no configurado, omitiendo envío");
    return;
  }
  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `TQ Deportes — Pedido #${data.orderNumber} confirmado`,
      html: orderConfirmationHtml(data),
    });
  } catch (err) {
    console.error("[email] Error enviando confirmación:", err);
  }
}

export async function sendPaymentApprovedEmail(data: OrderEmailData) {
  const client = getResend();
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `TQ Deportes — ¡Pago recibido! Pedido #${data.orderNumber}`,
      html: orderConfirmationHtml(data),
    });
  } catch (err) {
    console.error("[email] Error enviando pago aprobado:", err);
  }
}
