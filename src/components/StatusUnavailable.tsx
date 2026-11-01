/** Shown when the database can't be read. Says nothing about why: no host, no error text. */
export function StatusUnavailable() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Status</h1>
        <p className="m-0 mt-1 text-sm text-muted">Status data unavailable</p>
      </header>

      <div role="alert" className="rounded-xl border border-down/40 bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="inline-block size-3 shrink-0 rounded-full bg-down" aria-hidden />
          <p className="m-0 text-lg font-medium">Can&apos;t load the status data</p>
        </div>
        <p className="m-0 mt-2 text-sm text-muted">
          The status service could not read its database, so this page can&apos;t tell whether the services are up.
          That is different from no checks having run. It will try again within a minute.
        </p>
      </div>
    </main>
  );
}
