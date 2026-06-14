import { useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Shield, User, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import MeshPanel from "@/components/MeshPanel";

const Users = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [passcodeConfigured, setPasscodeConfigured] = useState(false);
  const [staffPasscode, setStaffPasscode] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");

  const load = useCallback(async () => {
    try {
      const [usersRes, passcodeRes] = await Promise.all([
        api.get("/auth/users"),
        api.get("/auth/staff-passcode"),
      ]);
      setUsers(usersRes.data.filter((u) => u.mobile !== "0000000001"));
      setPasscodeConfigured(passcodeRes.data.configured);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveStaffPasscode = async () => {
    if (!/^\d{4,6}$/.test(staffPasscode)) {
      return toast.error("Passcode must be 4–6 digits");
    }
    setBusy(true);
    try {
      await api.patch("/auth/staff-passcode", { passcode: staffPasscode });
      toast.success("Shared staff passcode updated");
      setStaffPasscode("");
      setPasscodeConfigured(true);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !mobile.trim() || !password.trim()) return toast.error("Fill all fields");
    if (role === "staff" && !/^\d{4,6}$/.test(password)) {
      return toast.error("Staff passcode must be 4–6 digits");
    }
    setBusy(true);
    try {
      await api.post("/auth/users", { mobile, name, password, role });
      toast.success("User added");
      setOpen(false); setMobile(""); setName(""); setPassword(""); setRole("staff");
      await load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}?`)) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Removed");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0">
          <div className="page-eyebrow">the chhaon team</div>
          <h1 className="page-title">team</h1>
        </div>
        <button onClick={() => setOpen(true)} data-testid="add-user-button" className="page-header-actions inline-flex items-center gap-2 h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-ink text-white text-sm font-semibold btn-tactile shadow-soft">
          <Plus className="w-4 h-4" /> Add member
        </button>
      </div>

      {/* Shared staff passcode */}
      <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft mb-6">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-sage inline-flex items-center justify-center text-white">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <div className="font-display text-3xl text-ink leading-none">staff passcode</div>
            <p className="text-sm text-ink2 mt-1">
              One shared PIN for all staff — easy to hand out at shift start.
              {passcodeConfigured ? " Currently set." : " Not configured yet."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            inputMode="numeric"
            value={staffPasscode}
            onChange={(e) => setStaffPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="New 4–6 digit passcode"
            data-testid="shared-staff-passcode-input"
            className="flex-1 h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage tracking-widest"
          />
          <button
            onClick={saveStaffPasscode}
            disabled={busy}
            data-testid="shared-staff-passcode-save"
            className="h-12 px-6 rounded-xl bg-sage text-white font-semibold btn-tactile disabled:opacity-60"
          >
            {busy ? "Saving…" : passcodeConfigured ? "Update passcode" : "Set passcode"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <MeshPanel />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) => (
          <div key={u.id} data-testid={`user-row-${u.id}`} className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className={`w-12 h-12 rounded-full inline-flex items-center justify-center text-white font-display text-2xl leading-none ${u.role === "admin" ? "bg-tan" : "bg-sage"}`}>
                {u.name?.[0] || "?"}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{u.name}</div>
                <div className="text-xs text-ink2 inline-flex items-center gap-1">
                  {u.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  {u.role}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-sm text-ink2 font-mono">+91 {u.mobile}</div>
              {u.id !== me?.id && (
                <button onClick={() => remove(u)} data-testid={`user-remove-${u.id}`} className="w-9 h-9 rounded-lg border border-oat hover:bg-statusNew/5 inline-flex items-center justify-center text-statusNew btn-tactile">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-[480px] bg-white rounded-t-3xl sm:rounded-3xl border border-oat/60 p-5 sm:p-6 shadow-floating animate-fade-up max-h-[min(92vh,100dvh)] overflow-y-auto safe-bottom sm:mt-16">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-4xl text-ink leading-none">add member</h2>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl bg-cream inline-flex items-center justify-center" data-testid="user-modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} data-testid="user-name-input" className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Mobile (10 digits)</label>
                <input inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g,"").slice(0,12))} data-testid="user-mobile-input" className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">
                  {role === "staff" ? "Passcode (4–6 digits)" : "Password"}
                </label>
                <input
                  type={role === "staff" ? "text" : "text"}
                  inputMode={role === "staff" ? "numeric" : "text"}
                  value={password}
                  onChange={(e) => setPassword(role === "staff" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
                  data-testid="user-password-input"
                  className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Role</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {["staff","admin"].map((r) => (
                    <button key={r} onClick={() => setRole(r)} data-testid={`user-role-${r}`} className={`h-12 rounded-xl border font-semibold text-sm btn-tactile ${role===r?"bg-ink text-white border-ink":"bg-white border-oat text-ink2"}`}>
                      {r === "admin" ? "Admin" : "Staff"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={save} disabled={busy} data-testid="user-save-button" className="mt-6 w-full h-12 rounded-xl bg-ink text-white font-semibold btn-tactile disabled:opacity-60">
              {busy ? "Saving…" : "Save member"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
