export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-center">
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-primary text-4xl font-bold text-primary-foreground"
      >
        U
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-ink">UstaPlan</h1>
      <p className="max-w-xs text-base text-muted-foreground">
        İşlerin, randevuların ve müşterilerin tek yerde. Yakında burada.
      </p>
    </main>
  );
}
