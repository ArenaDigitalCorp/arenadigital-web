"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 p-8">
      <h2 className="font-bold">Não foi possível carregar as publicações.</h2>
      <p>Confira sua conexão e suas permissões de acesso.</p>
      <button className="rounded-lg border px-4 py-2" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
