"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Create a Supabase client directly using environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TestConnection() {
  const [message, setMessage] = useState("Connecting to Supabase...");
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("service_shifts")
          .select("*")
          .limit(5);

        if (error) {
          setMessage(`❌ Error: ${error.message}`);
        } else if (data && data.length > 0) {
          setMessage(`✅ Connected! Found ${data.length} rows.`);
          setData(data);
        } else {
          setMessage("✅ Connected! No rows found yet.");
        }
      } catch (e: any) {
        setMessage(`❌ Error: ${e.message}`);
      }
    };
    load();
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Mourne-oids Hub – Supabase Connection Test</h1>
      <p>{message}</p>

      {data.length > 0 && (
        <table
          border={1}
          cellPadding={5}
          style={{ marginTop: "1rem", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Store</th>
              <th>Actual £</th>
              <th>Labour %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.shift_date}</td>
                <td>{row.store}</td>
                <td>{row.actual_sales ?? "-"}</td>
                <td>
                  {row.labour_pct != null
                    ? `${(row.labour_pct * 100).toFixed(1)}%`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
