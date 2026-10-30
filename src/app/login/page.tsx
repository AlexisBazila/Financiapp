import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { configSupabase } from "@/lib/supabase/config";
import { caja, textoSuave } from "../estilos";
import { FormularioLogin } from "./formulario";

async function AvisoConfirmacion({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  if (error !== "confirmacion") return null;
  return <p className="mb-4 text-sm text-red-600">El link de confirmación venció o ya se usó. Probá ingresar igual.</p>;
}

async function Formulario({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { invitacion } = await searchParams;
  return <FormularioLogin invitacion={typeof invitacion === "string" ? invitacion : undefined} />;
}

export default function Login({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-2 flex justify-center rounded-xl bg-black px-6 py-5">
        <Image src="/logo-blanco.png" alt="Financiapp" width={640} height={123} priority className="h-10 w-auto" />
      </h1>
      <p className={`mb-6 text-center text-sm ${textoSuave}`}>Las finanzas del hogar, mes a mes.</p>
      <Suspense>
        <AvisoConfirmacion searchParams={searchParams} />
      </Suspense>
      <div className={`${caja} p-5`}>
        {configSupabase() ? (
          <Suspense fallback={<FormularioLogin />}>
            <Formulario searchParams={searchParams} />
          </Suspense>
        ) : (
          <p className="text-sm">
            Falta configurar Supabase (variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
          </p>
        )}
      </div>
      <Link href="/ejemplo" className={`mt-6 text-center text-sm underline ${textoSuave}`}>
        Ver un ejemplo con datos de muestra
      </Link>
    </main>
  );
}
