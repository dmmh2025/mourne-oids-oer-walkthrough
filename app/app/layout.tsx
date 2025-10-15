export const metadata = {
  title: "Mourne-oids OER Walkthrough",
  description: "Base app ready for setup",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, Arial, sans-serif', margin: 0 }}>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
