import { QrCode, Store } from "lucide-react";
import Image from "next/image";

type Props = {
  qrDataUrl: string;
  customerName: string;
  qualifyingCount: number;
  nextMilestone: { count: number; discount: number };
};

export function LoyaltyQR({ qrDataUrl, customerName, qualifyingCount, nextMilestone }: Props) {
  return (
    <div className="rounded-xl border bg-white p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="h-5 w-5 text-[#3A3A3A]" />
        <h2 className="font-semibold text-[#3A3A3A]">Mi QR para el showroom</h2>
      </div>

      <div className="flex gap-5 items-center">
        <div className="shrink-0 rounded-xl overflow-hidden border-2 border-[#3A3A3A] p-1 bg-white">
          <Image
            src={qrDataUrl}
            alt="QR Try Club"
            width={110}
            height={110}
            unoptimized
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#3A3A3A] text-base truncate">{customerName}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-semibold text-[#3A3A3A]">{qualifyingCount}</span>{" "}
            {qualifyingCount === 1 ? "compra" : "compras"} Try Club
          </p>
          {qualifyingCount < nextMilestone.count && (
            <p className="text-xs text-gray-400 mt-1">
              {nextMilestone.count - qualifyingCount} más para {nextMilestone.discount}% OFF
            </p>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Store className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Mostráselo al vendedor al hacer una compra física</span>
          </div>
        </div>
      </div>
    </div>
  );
}
