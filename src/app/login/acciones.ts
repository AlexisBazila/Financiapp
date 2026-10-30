"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { texto } from "@/lib/datos/formularios";
import { crearCliente } from "@/lib/supabase/servidor";

export interface EstadoLogin {
  error?: string;
  aviso?: string;
}

export async function ingresar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const supabase = await crearCliente();
  const { error } = await supabase.auth.signInWithPassword({
    email: texto(form, "email"),
    password: texto(form, "password"),
  });
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Todavía no confirmaste tu email. Buscá el mail de confirmación."
          : "Email o contraseña incorrectos.",
    };
  }
  redirect("/");
}

export async function registrarse(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = texto(form, "email");
  const password = texto(form, "password");
  const invitacion = texto(form, "invitacion");
  if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  if (!invitacion) return { error: "Para crear una cuenta hace falta un código de invitación." };

  const supabase = await crearCliente();
  // La base rechaza igual el registro sin invitación; esto es para dar un mensaje claro.
  const { data: valida } = await supabase.rpc("invitacion_valida", { codigo: invitacion, email });
  if (!valida) return { error: "El código de invitación no es válido, venció o ya se usó." };

  const encabezados = await headers();
  const origen = `${encabezados.get("x-forwarded-proto") ?? "https"}://${encabezados.get("host")}`;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origen}/auth/confirm`, data: { invitacion } },
  });
  if (error) return { error: `No se pudo crear la cuenta: ${error.message}` };
  return { aviso: "Listo. Te mandamos un mail para confirmar tu cuenta; después ingresá desde acá." };
}

export async function salir() {
  const supabase = await crearCliente();
  await supabase.auth.signOut();
  redirect("/login");
}
