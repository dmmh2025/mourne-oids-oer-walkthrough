"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";

const supabase = getSupabaseClient();
const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

type ProfileRow = {
  job_role: string | null;
  store: string | null;
};

export default function MyProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [store, setStore] = useState<string>("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

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

      setEmail(user.email || "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("job_role, store")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (profileError) {
        setErrorMsg(profileError.message);
      } else if (profile) {
        setJobRole(profile.job_role || "");
        setStore(profile.store || "");
      } else {
        setStore("");
      }

      setLoading(false);
    };

    load();
  }, []);

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
      id: user.id,
      email: user.email,
      job_role: jobRole,
      store: store || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, {
      onConflict: "id",
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
    <section className="profile-panel">
      {loading ? (
        <div className="card">Loading your profile…</div>
      ) : (
        <>
          {errorMsg ? <div className="card error">❌ {errorMsg}</div> : null}
          {successMsg ? <div className="card success">✅ {successMsg}</div> : null}

          <div className="card profile-card">
            <h2>Profile details</h2>
            <p className="section-sub">Your hub info</p>

            <div className="form-grid">
              <div className="field">
                <label>Email (login)</label>
                <input type="text" value={email} disabled />
                <p className="hint">This is your hub / Supabase login.</p>
              </div>

              <div className="field">
                <label>Job role</label>
                <input
                  type="text"
                  value={jobRole}
                  onChange={(event) => setJobRole(event.target.value)}
                  placeholder="e.g. Store Manager, ASM, Trainer"
                />
              </div>

              <div className="field">
                <label>Store</label>
                <select
                  value={store}
                  onChange={(event) => setStore(event.target.value)}
                >
                  <option value="">— Select store —</option>
                  {STORES.map((storeName) => (
                    <option key={storeName} value={storeName}>
                      {storeName}
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

          <div className="card profile-card">
            <h2>Change password</h2>
            <p className="section-sub">Keep your account secure.</p>

            <div className="form-grid small">
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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

      <style jsx>{`
        .profile-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.08), 0 1px 3px rgba(2, 6, 23, 0.06);
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
          color: #475569;
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
          background: #006491;
          border-color: #004b75;
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

        @media (max-width: 900px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
