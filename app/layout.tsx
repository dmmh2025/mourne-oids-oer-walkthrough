export const metadata = {
  title: "Mourne-oids OER Walkthrough",
  description: "Be OER-ready every shift.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, Arial, sans-serif",
          // 🔵🔴 Gradient + soft radial glows (fixed for a premium feel)
          backgroundColor: "#0b5f80",
          backgroundImage: `
            radial-gradient(1200px 520px at 110% -10%, rgba(0,153,204,.18), transparent 60%),
            radial-gradient(900px 480px at -10% 0%, rgba(227,24,55,.12), transparent 60%),
            linear-gradient(180deg, #0b5f80 0%, #0b5f80 20%, #eaf4f8 100%)
          `,
          backgroundAttachment: "fixed, fixed, fixed",
          minHeight: "100dvh",
        }}
      >
        <main
          style={{
            maxWidth: 1100,
            margin: "28px auto",
            background: "white",
            padding: 24,
            borderRadius: 18,
            // Soft glassy card
            boxShadow:
              "0 12px 40px rgba(0,0,0,.18), 0 2px 0 rgba(255,255,255,.6) inset",
            border: "1px solid rgba(255,255,255,.6)",
          }}
        >
          {children}
        </main>

        <footer
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(255,255,255,.85)",
            margin: "0 0 18px",
            textShadow: "0 1px 2px rgba(0,0,0,.25)",
          }}
        >
          Mourne-oids • Domino’s NI • {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
