import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  despacharCodigoEscaneado,
  type ModoEscaneo,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "itf",
  "upc_a",
  "upc_e",
];

export type CampoEscaneoProps = Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "value"
> & {
  value: string;
  onChange: (value: string) => void;
  onScan: (
    value: string,
    codigo: CodigoEscaneadoInterpretado,
    source: "scanner" | "manual" | "camera",
  ) => void | Promise<void>;
  clearOnScan?: boolean;
  /**
   * Series are the safe default. Use `raw` only for document/quantity inputs
   * whose callback must receive the scanned text unchanged.
   */
  scanMode?: ModoEscaneo;
  /** @deprecated Prefer scanMode. Kept for existing raw document/quantity fields. */
  interpretRollCode?: boolean;
  containerClassName?: string;
  /** Optional content between the input and the camera action. */
  trailingContent?: React.ReactNode;
};

export const CampoEscaneo = forwardRef<HTMLInputElement, CampoEscaneoProps>(
  (
    {
      value,
      onChange,
      onScan,
      clearOnScan = true,
      scanMode,
      interpretRollCode = true,
      containerClassName,
      trailingContent,
      disabled,
      className,
      ...inputProps
    },
    forwardedRef,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fallbackControlsRef = useRef<{ stop: () => void } | null>(null);
    const animationRef = useRef<number | null>(null);
    const sessionRef = useRef(0);
    const typingStartedAtRef = useRef<number | null>(null);
    const lastTypingAtRef = useRef<number | null>(null);
    const largestTypingGapRef = useRef(0);
    const typedCharactersRef = useRef(0);
    const scanQueueRef = useRef<Array<{
      rawValue: string;
      source: "scanner" | "manual" | "camera";
    }>>([]);
    const processingRef = useRef(false);
    const mountedRef = useRef(true);
    const latestRef = useRef({ onScan, disabled, scanMode, interpretRollCode });
    latestRef.current = { onScan, disabled, scanMode, interpretRollCode };
    const [scanError, setScanError] = useState("");
    const [cameraCapable, setCameraCapable] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [startingCamera, setStartingCamera] = useState(false);

    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        scanQueueRef.current = [];
      };
    }, []);

    // The physical input owns the in-flight burst. Async search responses and
    // React renders must never replace characters that the scanner is typing.
    useLayoutEffect(() => {
      if (!processingRef.current && typedCharactersRef.current === 0 && inputRef.current) {
        inputRef.current.value = value;
      }
    }, [value]);

    useEffect(() => {
      let active = true;
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) return;
      if (!mediaDevices.enumerateDevices) {
        setCameraCapable(true);
        return;
      }
      void mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (active) {
            setCameraCapable(devices.some((device) => device.kind === "videoinput"));
          }
        })
        .catch(() => {
          if (active) setCameraCapable(true);
        });
      return () => {
        active = false;
      };
    }, []);

    const stopCamera = useCallback(() => {
      sessionRef.current += 1;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      fallbackControlsRef.current?.stop();
      fallbackControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      setStartingCamera(false);
    }, []);

    const deliver = useCallback(
      async (
        rawValue: string,
        source: "scanner" | "manual" | "camera",
      ) => {
        if (!rawValue.trim()) return;
        scanQueueRef.current.push({ rawValue, source });
        if (processingRef.current) return;
        processingRef.current = true;
        try {
          while (mountedRef.current && scanQueueRef.current.length) {
            const item = scanQueueRef.current.shift()!;
            const { onScan, disabled, scanMode, interpretRollCode } = latestRef.current;
            if (disabled) {
              setScanError("El contexto cambió. Vuelve a escanear: " + item.rawValue);
              continue;
            }
            const modo: ModoEscaneo = scanMode ?? (interpretRollCode ? "serie" : "raw");
            const { codigo, valor: scannedValue } = despacharCodigoEscaneado(item.rawValue, modo);
            try {
              await onScan(scannedValue, codigo, item.source);
            } catch (error) {
              if (mountedRef.current) setScanError(
                `No se pudo procesar ${item.rawValue}: ${error instanceof Error ? error.message : "error de escaneo"}`,
              );
            }
            // Allow the consumer to commit its state before the next callback:
            // draft IDs, accumulated rolls and mutation guards must be fresh.
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          }
        } finally {
          processingRef.current = false;
          if (mountedRef.current) inputRef.current?.focus();
        }
      },
      [],
    );

    useEffect(() => {
      if (!cameraOpen) {
        stopCamera();
        return;
      }

      const session = ++sessionRef.current;
      setCameraError("");
      setStartingCamera(true);

      const detected = (rawValue: string) => {
        if (session !== sessionRef.current) return;
        stopCamera();
        setCameraOpen(false);
        if (clearOnScan) {
          if (inputRef.current) inputRef.current.value = "";
          onChange("");
        }
        void deliver(rawValue, "camera");
      };

      const start = async () => {
        try {
          const Detector = (
            window as typeof window & {
              BarcodeDetector?: BarcodeDetectorConstructor;
            }
          ).BarcodeDetector;

          if (Detector) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: "environment" } },
              audio: false,
            });
            if (session !== sessionRef.current) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) {
              stopCamera();
              return;
            }
            video.srcObject = stream;
            await video.play();
            const supportedFormats = Detector.getSupportedFormats
              ? await Detector.getSupportedFormats()
              : FORMATS;
            const requestedFormats = FORMATS.filter((format) =>
              supportedFormats.includes(format),
            );
            const detector = new Detector(
              requestedFormats.length ? { formats: requestedFormats } : undefined,
            );
            const inspect = async () => {
              if (session !== sessionRef.current || video.readyState < 2) return;
              try {
                const [barcode] = await detector.detect(video);
                if (barcode?.rawValue) {
                  detected(barcode.rawValue);
                  return;
                }
              } catch {
                // A transient frame decode failure is expected while video starts.
              }
              if (session === sessionRef.current) {
                animationRef.current = requestAnimationFrame(inspect);
              }
            };
            setStartingCamera(false);
            animationRef.current = requestAnimationFrame(inspect);
            return;
          }

          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (session !== sessionRef.current) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            {
              video: { facingMode: { ideal: "environment" } },
              audio: false,
            },
            videoRef.current ?? undefined,
            (result) => {
              const text = result?.getText();
              if (text) detected(text);
            },
          );
          if (session !== sessionRef.current) {
            controls.stop();
            return;
          }
          fallbackControlsRef.current = controls;
          streamRef.current =
            (videoRef.current?.srcObject as MediaStream | null) ?? null;
          setStartingCamera(false);
        } catch (error) {
          if (session !== sessionRef.current) return;
          stopCamera();
          const errorName =
            error && typeof error === "object" && "name" in error
              ? String(error.name)
              : "";
          const denied =
            errorName === "NotAllowedError" ||
            errorName === "PermissionDeniedError";
          setCameraError(
            denied
              ? "No se pudo acceder a la cámara. Habilita el permiso de cámara para esta aplicación en los ajustes del teléfono y vuelve a intentar."
              : "No se pudo iniciar la cámara. Verifica que no esté en uso por otra aplicación y vuelve a intentar.",
          );
        }
      };

      void start();
      return stopCamera;
    }, [cameraOpen, deliver, stopCamera, clearOnScan, onChange]);

    const submit = (input: HTMLInputElement, now: number) => {
      if (disabled) return;
      const rawValue = input.value;
      const startedAt = typingStartedAtRef.current;
      const elapsed = startedAt == null ? Number.POSITIVE_INFINITY : now - startedAt;
      const source =
        rawValue.trim().length >= 7 &&
        typedCharactersRef.current >= 7 &&
        elapsed <= Math.max(2000, typedCharactersRef.current * 100) &&
        largestTypingGapRef.current <= 150 &&
        lastTypingAtRef.current != null && now - lastTypingAtRef.current <= 150
          ? "scanner"
          : "manual";
      typingStartedAtRef.current = null;
      lastTypingAtRef.current = null;
      largestTypingGapRef.current = 0;
      typedCharactersRef.current = 0;
      // Clear synchronously, before scheduling ANY processing or React update.
      input.value = "";
      onChange("");
      void deliver(rawValue, source);
    };

    return (
      <>
        <div
          className={cn(
            "flex items-stretch gap-2",
            trailingContent && "min-w-0",
            containerClassName,
          )}
        >
          <Input
            {...inputProps}
            ref={inputRef}
            defaultValue={value}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              inputProps.onKeyDown?.(event);
              if (event.defaultPrevented || event.nativeEvent.isComposing) return;
              const now = performance.now();
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                if (typingStartedAtRef.current == null) typingStartedAtRef.current = now;
                if (lastTypingAtRef.current != null) {
                  largestTypingGapRef.current = Math.max(largestTypingGapRef.current, now - lastTypingAtRef.current);
                }
                lastTypingAtRef.current = now;
                typedCharactersRef.current += 1;
              } else if (["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                largestTypingGapRef.current = Number.POSITIVE_INFINITY;
              }
              if (event.key !== "Enter") return;
              event.preventDefault();
              submit(event.currentTarget, now);
            }}
            className={cn(trailingContent && "min-w-0 flex-1", className)}
          />
          {trailingContent}
          {cameraCapable && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 self-stretch"
              disabled={disabled}
              onClick={() => setCameraOpen(true)}
              aria-label="Escanear con cámara"
              title="Escanear con cámara"
            >
              <Camera className="h-5 w-5" />
            </Button>
          )}
        </div>
        {scanError && <p role="alert" className="text-sm text-destructive">{scanError}</p>}

        <Dialog
          open={cameraOpen}
          onOpenChange={(open) => {
            if (!open) stopCamera();
            setCameraOpen(open);
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                Escanear código
              </DialogTitle>
              <DialogDescription>
                Apunta la cámara al código QR o código de barras. Se leerá
                automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              {startingCamera && !cameraError && (
                <div className="absolute inset-0 grid place-items-center text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
              {cameraError && (
                <div
                  className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-sm text-destructive"
                  role="alert"
                >
                  {cameraError}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

CampoEscaneo.displayName = "CampoEscaneo";