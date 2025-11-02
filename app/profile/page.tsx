"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";

const supabase = getSupabaseClient();

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [store, setStore] = useState<"" | string>("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // load current user + their profile
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // get current user (try both getUser and getSession)
      let { data: userData } = await supabase.auth.getUser();
      let user = userData?.user ?? null;

      if (!user) {
        const { data: sessionData } = await supabase.auth.getSession();
        user = sessionData?.session?.user ?? null;
      }

      if (!user) {
        setErrorMsg("Not signed in.");
        setLoading(false);
        return;
      }

      const userId = user.id;
      const userEmail = user.email || "";
      setEmail(userEmail);

      // profiles table uses "id" as PK
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profErr) {
        setErrorMsg(profErr.message);
      } else if (prof) {
        setFullName(prof.full_name || "");
        setJobRole(prof.job_role || "");
        setStore(prof.store || "");
      } else {
        // no profile yet
        setStore("");
      }

      setLoading(false);
    };

    load();
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined") window.history.back();
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setErrorMsg("Not signed in.");
      setSaving(false);
      return;
    }

    const payload = {
      id: user.id, // 👈 use id, not user_id
      email: user.email,
      full_name: fullName,
      job_role: jobRole,
      store: store || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, {
      onConflict: "id", // 👈 conflict on id
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg("Profile updated ✅");
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPwdSaving(true);
    setPwdMsg(null);

    if (!newPassword) {
      setPwdMsg("Please enter a new password.");
      setPwdSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg("Passwords do not match.");
      setPwdSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPwdMsg(error.message);
    } else {
      setPwdMsg("Password updated ✅");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwdSaving(false);
  };

  return (
    <main className="wrap">
      {/* banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* nav */}
      <div className="nav-row">
        <button onClick={handleBack} className="btn btn--ghost">
          ← Back
        </button>
        <a href="/" className="btn btn--brand">
          🏠 Home
        </a>
      </div>

      {/* header */}
      <header className="header">
        <h1>My Mourne-oids Profile</h1>
        <p className="subtitle">
          Update your details so Damien knows who’s in the hub 👋
        </p>
      </header>

      {/* content */}
      <section className="container wide content">
        {loading ? (
          <div className="card">Loading your profile…</div>
        ) : (
          <>
            {errorMsg ? <div className="card error">❌ {errorMsg}</div> : null}
            {successMsg ? <div className="card success">✅ {successMsg}</div> : null}

            {/* PROFILE CARD */}
            <div className="card profile-card">
              <h2>Profile details</h2>
              <p className="section-sub">Who are you and where do you work?</p>

              <div className="form-grid">
                <div className="field">
                  <label>Email (login)</label>
                  <input type="text" value={email} disabled />
                  <p className="hint">This is your Supabase / hub login.</p>
                </div>

                <div className="field">
                  <label>Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Chrissy Graham"
                  />
                </div>

                <div className="field">
                  <label>Job role</label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. Store Manager, ASM, Trainer"
                  />
                </div>

                <div className="field">
                  <label>Store</label>
                  <select
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                  >
                    <option value="">— Select store —</option>
                    {STORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="btn btn--brand mt-btn"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>

            {/* PASSWORD CARD */}
            <div className="card profile-card">
              <h2>Change password</h2>
              <p className="section-sub">Keep your hub secure.</p>

              <div className="form-grid small">
                <div className="field">
                  <label>New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePasswordChange}
                className="btn btn--ghost mt-btn"
                disabled={pwdSaving}
              >
                {pwdSaving ? "Updating…" : "Update password"}
              </button>

              {pwdMsg ? <p className="pwd-msg">{pwdMsg}</p> : null}
            </div>
          </>
        )}
      </section>

      {/* footer */}
      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      {/* styles (same family as your dashboard) */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08),
            0 1px 3px rgba(2, 6, 23, 0.06);
        }

        .wrap {
          background: var(--bg);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: var(--shadow-card);
          width: 100%;
        }

        .banner img {
          max-width: 92%;
          height: auto;
        }

        .nav-row {
          width: 100%;
          max-width: 1100px;
          display: flex;
          gap: 10px;
          justify-content: flex-start;
          margin-top: 16px;
          padding: 0 16px;
        }

        .header {
          text-align: center;
          margin: 16px 16px 8px;
        }

        .header h1 {
          font-size: 26px;
          font-weight: 900;
          color: var(--text);
        }

        .subtitle {
          color: var(--muted);
          font-size: 14px;
          margin-top: 3px;
        }

        .container {
          width: 100%;
          max-width: 420px;
          margin-top: 16px;
          display: flex;
          justify-content: center;
        }

        .container.wide {
          max-width: 1100px;
          flex-direction: column;
          gap: 16px;
        }

        .content {
          gap: 20px;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          border: 1px solid rgba(0, 0, 0, 0.02);
          padding: 16px 18px 20px;
        }

        .card.error {
          border-left: 4px solid #b91c1c;
          color: #b91c1c;
        }

        .card.success {
          border-left: 4px solid #166534;
          color: #166534;
        }

        .profile-card h2 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .section-sub {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 14px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 16px;
        }

        .form-grid.small {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .field label {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }

        .field input,
        .field select {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 13px;
          background: #fff;
        }

        .field input[disabled] {
          background: #e2e8f0;
          cursor: not-allowed;
        }

        .hint {
          font-size: 11.5px;
          color: #94a3b8;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-align: center;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          border: 2px solid transparent;
          transition: background 0.2s, transform 0.1s;
          cursor: pointer;
        }

        .btn--brand {
          background: var(--brand);
          border-color: var(--brand-dark);
          color: #fff;
        }

        .btn--ghost {
          background: #fff;
          border-color: rgba(0, 0, 0, 0.02);
          color: #0f172a;
        }

        .mt-btn {
          margin-top: 16px;
        }

        .pwd-msg {
          margin-top: 10px;
          font-size: 13px;
          color: #0f172a;
        }

        .footer {
          text-align: center;
          margin-top: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .container.wide {
            max-width: 94%;
          }
        }
      `}</style>
    </main>
  );
}
