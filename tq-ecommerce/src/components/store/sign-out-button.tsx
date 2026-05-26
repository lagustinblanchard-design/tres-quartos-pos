"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
    >
      <LogOut className="h-4 w-4 mr-1" /> Salir
    </Button>
  );
}
