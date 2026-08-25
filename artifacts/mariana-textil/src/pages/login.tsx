import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BrandLogo } from "@/components/brand-logo";

const loginSchema = z.object({
  usuario: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const INVISIBLE_IDENTIFIER_CHARACTERS =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

function normalizeUsername(value: string) {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE_IDENTIFIER_CHARACTERS, "")
    .trim()
    .toLowerCase();
}

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isChecking } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() }
  });

  const login = useLogin();
  const [passwordVisibilityResetKey, setPasswordVisibilityResetKey] = useState(0);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usuario: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user && !isChecking) {
      setLocation("/");
    }
  }, [user, isChecking, setLocation]);

  const onSubmit = (data: LoginForm) => {
    login.mutate(
      { data: { ...data, usuario: normalizeUsername(data.usuario) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setLocation("/");
        },
        onError: (err: any) => {
          toast.error("Error de acceso", {
            description: err?.error || "Usuario o contraseña incorrectos",
          });
        },
      }
    );
  };

  if (isChecking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_45%)]">
        <BrandLogo variant="mark" className="h-16 w-16 animate-pulse drop-shadow-sm" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_45%)] p-4">
      <Card className="w-full max-w-sm border border-primary/10 border-t-4 border-t-primary shadow-xl shadow-sidebar/10">
        <CardHeader className="space-y-4 items-center text-center pb-7">
          <BrandLogo className="h-44 w-auto max-w-[230px] drop-shadow-sm" />
          <div className="space-y-1">
            <CardTitle className="sr-only">Mariana Textil</CardTitle>
            <CardDescription className="text-base">Sistema de Gestión Interna</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmitCapture={() => setPasswordVisibilityResetKey((current) => current + 1)}
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="usuario.tienda"
                        autoComplete="username"
                        {...field}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        autoComplete="current-password"
                        visibilityResetKey={passwordVisibilityResetKey}
                        toggleTestId="toggle-login-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={login.isPending}>
                {login.isPending ? "Iniciando sesión..." : "Ingresar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
