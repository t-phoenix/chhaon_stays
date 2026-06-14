import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Phone, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const { login, staffLogin, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("staff");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Chhaon Cafe Ops · Sign in";
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="font-display text-3xl text-sage animate-pulse">brewing your view…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/orders" replace />;

  const submitAdmin = async (e) => {
    e.preventDefault();
    if (!mobile || !password) return;
    setBusy(true);
    try {
      const u = await login(mobile, password);
      toast.success(`Namaste, ${u.name.split(" ")[0]} — welcome home.`);
      navigate("/orders");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitStaff = async (e) => {
    e.preventDefault();
    if (!passcode) return;
    setBusy(true);
    try {
      const u = await staffLogin(passcode);
      toast.success(`Ready to serve, ${u.name.split(" ")[0]}.`);
      navigate("/orders");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid md:grid-cols-2 bg-paper">
      {/* Visual side */}
      <div className="relative hidden md:block overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1631630259742-c0f0b17c6c10?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwxfHxjb3p5JTIwcGluZSUyMHdvb2QlMjBjYWJpbiUyMGludGVyaW9yfGVufDB8fHx8MTc4MTM5MDgzNXww&ixlib=rb-4.1.0&q=85"
          alt="Pine cabin warmth"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/35 to-ink/65" />
        <div className="relative h-full flex flex-col justify-end p-10 text-white">
          <div className="bg-sage/85 inline-flex px-4 py-2 rounded-xl text-xs uppercase tracking-[0.18em] font-semibold mb-4 w-fit">
            chhaon stays · cafe ops
          </div>
          <h1 className="font-display text-6xl leading-none drop-shadow-md">
            Your quiet corner<br/>in the chaos.
          </h1>
          <p className="mt-3 text-white/85 max-w-md text-base">
            A calmer way to take orders, feed the kitchen, and close the day —
            built for the team running the cafe in Shoja.
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-4 sm:p-10 min-h-screen">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-5 sm:mb-8">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sage text-white font-display text-3xl leading-none">C</span>
            <div>
              <div className="font-display text-3xl text-ink leading-none">Chhaon</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink2/80 font-semibold">cafe ops</div>
            </div>
          </div>

          <h2 className="font-display text-3xl sm:text-5xl text-ink leading-none">welcome back.</h2>
          <p className="text-sm text-ink2 mt-1">Sign in to start taking orders.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 p-1 rounded-xl bg-cream border border-oat">
            <button
              type="button"
              onClick={() => { setMode("staff"); setShow(false); }}
              data-testid="login-mode-staff"
              className={`h-10 rounded-lg text-sm font-semibold btn-tactile ${mode === "staff" ? "bg-sage text-white shadow-soft" : "text-ink2 hover:bg-white/60"}`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => { setMode("admin"); setShow(false); }}
              data-testid="login-mode-admin"
              className={`h-10 rounded-lg text-sm font-semibold btn-tactile ${mode === "admin" ? "bg-ink text-white shadow-soft" : "text-ink2 hover:bg-white/60"}`}
            >
              Admin
            </button>
          </div>

          {mode === "staff" ? (
            <form onSubmit={submitStaff} className="mt-6 space-y-4" data-testid="staff-login-form">
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Staff passcode</label>
                <div className="input-icon-wrap">
                  <KeyRound className="input-icon" />
                  <input
                    data-testid="staff-passcode-input"
                    type={show ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="4–6 digit PIN"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input-with-icon pr-12 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink2 hover:bg-cream"
                    data-testid="staff-passcode-toggle"
                    aria-label="Toggle passcode"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-ink2 mt-2">One shared passcode for the whole team — ask admin if you need it.</p>
              </div>

              <button
                type="submit"
                disabled={busy}
                data-testid="staff-login-submit"
                className="group w-full h-12 rounded-xl bg-sage text-white font-semibold inline-flex items-center justify-center gap-2 btn-tactile disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Enter as staff"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={submitAdmin} className="mt-6 space-y-4" data-testid="login-form">
              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Mobile number</label>
                <div className="relative mt-1.5">
                  <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink2/70" />
                  <input
                    data-testid="login-mobile-input"
                    inputMode="numeric"
                    autoComplete="username"
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    className="w-full pl-11 pr-4 h-12 rounded-xl bg-bone border border-oat focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage transition-all text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink2/70" />
                  <input
                    data-testid="login-password-input"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 h-12 rounded-xl bg-bone border border-oat focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage transition-all text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink2 hover:bg-cream"
                    data-testid="login-password-toggle"
                    aria-label="Toggle password"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                data-testid="login-submit-button"
                className="group w-full h-12 rounded-xl bg-ink text-white font-semibold inline-flex items-center justify-center gap-2 btn-tactile disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in as admin"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          )}

          <div className="mt-8 p-4 rounded-xl bg-cream/70 border border-oat">
            <div className="font-display text-xl text-ink leading-none mb-1">
              {mode === "staff" ? "new on the team?" : "first time here?"}
            </div>
            <p className="text-sm text-ink2">
              {mode === "staff"
                ? "Ask admin for the shared staff passcode. Staff can take orders, collect payments, and update the kitchen."
                : "Admin sign-in for menu, reports, and team settings. Ask Amrit if you need access."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
