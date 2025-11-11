import React, { useState } from "react";
import axios from "axios";
import { Shield, Mail, Lock, LogIn } from "lucide-react";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/admin/login", {
        email,
        password,
      });

      onLogin(response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl">
        <div className="card-body">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="card-title text-center justify-center text-2xl mb-2">
              Admin Login
            </h2>
            <p className="text-sm opacity-70">
              Access the server management dashboard
            </p>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}
          <div className="text-white p-3 rounded-md bg-black md:hidden">
            <span>view project on desktop</span>
          </div>
          <div className="text-white p-3 rounded-md bg-black">
            <span>
              host project locally for proper testing due to sqlite storage
            </span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 hidden md:block">
            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered input-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered input-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {!loading && <LogIn className="w-4 h-4" />}
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
