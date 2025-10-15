export const metadata = {
  title: "Mourne-oids OER Walkthrough",
  description: "Be OER-ready every shift.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", margin: 0, background: "#f6f8fb" }}>
        {/* No logo header on purpose */}
        <main
          style={{
            maxWidth: 1100,
            margin: "24px auto",
            background: "white",
            padding: 24,
            borderRadius: 16,
            boxShadow: "0 6px 24px rgba(0,0,0,.08)",
          }}
        >
          {children}
        </main>
        <footer style={{ textAlign: "center", fontSize: 12, color: "#6b7280", margin: "12px 0 24px" }}>
          Mourne-oids • Domino’s NI • {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
