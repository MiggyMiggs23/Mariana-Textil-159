import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2 } from "lucide-react";

const loginSchema = z.object({
  usuario: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isChecking } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() }
  });

  const login = useLogin();

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
      { data },
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30">
        <div className="animate-pulse w-12 h-12 rounded-full bg-sidebar/20" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg shadow-sidebar/5">
        <CardHeader className="space-y-4 items-center text-center pb-8">
          <div className="w-16 h-16 bg-sidebar rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-sidebar">Mariana Textil</CardTitle>
            <CardDescription className="text-base">Sistema de Gestión Interna</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
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
