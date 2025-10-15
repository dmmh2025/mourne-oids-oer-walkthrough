export const metadata = {
  title: "Mourne-oids OER Walkthrough",
  description: "Be OER-ready every shift.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", margin: 0, background: "#f6f8fb" }}>
        <header style={{
          background: "linear-gradient(90deg,#006491,#e31837)",
          color: "white",
          padding: "10px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,.15)"
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/dominos.png" alt="Domino's" style={{ height: 36 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <img src="/mourneoids.png" alt="Mourne-oids" style={{ height: 36 }} />
            </div>
            <img src="/racz.png" alt="Racz Group" style={{ height: 36 }} />
          </div>
        </header>
        <main style={{ maxWidth: 1100, margin: "24px auto", background: "white", padding: 24, borderRadius: 16, boxShadow: "0 6px 24px rgba(0,0,0,.08)" }}>
          {children}
        </main>
        <footer style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginBottom: 24 }}>
          Mourne-oids • Domino’s NI • {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
