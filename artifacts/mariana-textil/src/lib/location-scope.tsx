import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";

type LocationScopeContextValue = {
  selectedLocationId: number | null;
  setSelectedLocationId: (locationId: number | null) => void;
};

const LocationScopeContext = createContext<LocationScopeContextValue | null>(
  null,
);

export function LocationScopeProvider({ children }: { children: ReactNode }) {
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const [selectedLocationIdState, setSelectedLocationId] = useState<number | null>(null);

  const selectedLocationId = useMemo(() => {
    if (
      user &&
      (user.alcanceConsulta === "PROPIA" ||
        user.rol === "TERMINAL" ||
        user.rol === "CAJA")
    ) {
      return user.ubicacion?.id ?? null;
    }
    return selectedLocationIdState;
  }, [user, selectedLocationIdState]);

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