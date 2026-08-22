import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocationScopeContextValue = {
  selectedLocationId: number | null;
  setSelectedLocationId: (locationId: number | null) => void;
};

const LocationScopeContext = createContext<LocationScopeContextValue | null>(
  null,
);

export function LocationScopeProvider({ children }: { children: ReactNode }) {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const value = useMemo(
    () => ({ selectedLocationId, setSelectedLocationId }),
    [selectedLocationId],
  );

  return (
    <LocationScopeContext.Provider value={value}>
      {children}
    </LocationScopeContext.Provider>
  );
}

export function useLocationScope() {
  const context = useContext(LocationScopeContext);

  if (!context) {
    throw new Error(
      "useLocationScope debe usarse dentro de LocationScopeProvider",
    );
  }

  return context;
}