export default function Home() {
  return (
    <main>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>🍕 Mourne-oids OER Walkthrough</h1>
      <p>Base app deployed. Choose an option:</p>
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <a href="/walkthrough">👉 Start Walkthrough</a>
        <a href="/admin">🧭 Admin</a>
      </div>
    </main>
  );
}
