"use client";

import * as React from "react";
import { getSupabaseClient } from "@/utils/supabase/client";

const supabase = getSupabaseClient();

export default function ProfilePage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pwdSaving, setPwdSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pwdError, setPwdError] = React.useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = React.useState<string | null>(null);

  const [userEmail, setUserEmail] = React.useState<string>("");
  const [userId, setUserId] = React.useState<string>("");

  const [displayName, setDisplayName] = React.useState("");
  const [store, setStore] = React.useState("");
  const [jobRole, setJobRole] = React.useState("");

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // 1) get current auth user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setError("You must be signed in to view your profile.");
        setLoading(false);
        return;
      }

      const user = userData.user;
      setUserEmail(user.email || "");
      setUserId(user.id);

      // 2) load profile row
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("display_name, store, job_role")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        // still let them see the page
        setError("Could not load profile info (profiles table).");
      } else if (prof) {
        setDisplayName(prof.display_name ?? "");
        setStore(prof.store ?? "");
        setJobRole(prof.job_role ?? "");
      }

      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        store,
        job_role: jobRole,
      })
      .eq("id", userId);

    if (updErr) {
      setError(updErr.message);
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!newPassword || !confirmPassword) {
      setPwdError("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }

    setPwdSaving(true);
    const { error: pwdErr } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setPwdSaving(false);

    if (pwdErr) {
      setPwdError(pwdErr.message);
      return;
    }

    setPwdSuccess("Password updated.");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // send them back to the login screen
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "50px auto", padding: 16 }}>
        <p>Loading your profile…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "28px auto",
        padding: 16,
        display: "grid",
        gap: 16,
      }}
    >
      {/* header */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Your Mourne-oids Profile</h1>
          <p style={{ margin: 0, color: "#64748b" }}>
            Signed in as <strong>{userEmail || "(no email)"}</strong>
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "#e11d48",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>

      {/* error (top-level) */}
      {error ? (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 12,
            color: "#7f1d1d",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* profile form */}
      <form
        onSubmit={handleSaveProfile}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Profile details</h2>
        <p style={{ margin: 0, color: "#94a3b8" }}>
          This is just for the hub — job role and store help you filter later.
        </p>

        <label style={{ display: "grid", gap: 4 }}>
          Email (can’t change here)
          <input
            value={userEmail}
            disabled
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#f8fafc",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Damien, Leona, Peter"
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          Store
          <input
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Downpatrick / Kilkeel / Newcastle / Ballynahinch"
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          Job role
          <input
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            placeholder="e.g. Area Manager, Trainer, Store Manager"
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          style={{
            background: "#006491",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "10px 18px",
            fontWeight: 700,
            cursor: "pointer",
            opacity: saving ? 0.6 : 1,
            width: "fit-content",
          }}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      {/* password form */}
      <form
        onSubmit={handleChangePassword}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Change password</h2>
        <p style={{ margin: 0, color: "#94a3b8" }}>
          This updates your Supabase auth password for the hub.
        </p>

        <label style={{ display: "grid", gap: 4 }}>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          />
        </label>

        {pwdError ? (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 10,
              color: "#991b1b",
            }}
          >
            {pwdError}
          </div>
        ) : null}

        {pwdSuccess ? (
          <div
            style={{
              background: "#ecfdf3",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: 10,
              color: "#14532d",
            }}
          >
            {pwdSuccess}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pwdSaving}
          style={{
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "10px 18px",
            fontWeight: 700,
            cursor: "pointer",
            opacity: pwdSaving ? 0.6 : 1,
            width: "fit-content",
          }}
        >
          {pwdSaving ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}
