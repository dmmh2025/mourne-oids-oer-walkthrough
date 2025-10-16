export default function DeepCleanHome() {
  return (
    <main style={{ padding: 24 }}>
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section style={{ marginTop: 16, padding: 16 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: 22 }}>Autumn Deep Clean</strong>
          <small style={{ color: "var(--muted)" }}>
            Choose your store to open its checklist.
          </small>
        </header>

        <div style={{ display: "grid", gap: 12, maxWidth: 320, marginTop: 12 }}>
          <a href="/deep-clean/downpatrick">
            <button className="brand" style={{ width: "100%" }}>
              Downpatrick
            </button>
          </a>
          <a href="/deep-clean/kilkeel">
            <button className="brand" style={{ width: "100%" }}>
              Kilkeel
            </button>
          </a>
          <a href="/deep-clean/newcastle">
            <button className="brand" style={{ width: "100%" }}>
              Newcastle
            </button>
          </a>
        </div>

        <div style={{ marginTop: 16 }}>
          <a href="/"><button>⬅ Back to Home</button></a>
        </div>
      </section>
    </main>
  );
}
