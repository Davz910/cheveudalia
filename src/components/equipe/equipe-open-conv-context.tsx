"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

type Ctx = {
  openConvIdRef: React.MutableRefObject<string | null>;
  setOpenConvId: (id: string | null) => void;
};

const EquipeOpenConvContext = createContext<Ctx | null>(null);

export function EquipeOpenConvProvider({ children }: { children: ReactNode }) {
  const openConvIdRef = useRef<string | null>(null);
  const setOpenConvId = useCallback((id: string | null) => {
    openConvIdRef.current = id;
  }, []);
  return (
    <EquipeOpenConvContext.Provider value={{ openConvIdRef, setOpenConvId }}>{children}</EquipeOpenConvContext.Provider>
  );
}

export function useEquipeOpenConv() {
  const ctx = useContext(EquipeOpenConvContext);
  if (!ctx) {
    throw new Error("useEquipeOpenConv must be used within EquipeOpenConvProvider");
  }
  return ctx;
}

/** Utilisable hors provider (ex. tests) : ref no-op */
export function useEquipeOpenConvOptional(): Ctx | null {
  return useContext(EquipeOpenConvContext);
}
