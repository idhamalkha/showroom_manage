import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaEyeSlash, FaEye, FaCar } from "react-icons/fa";
import { IoPersonCircle } from "react-icons/io5";
import { useAuth } from "../providers/AuthProvider";
import "../styles/Login.css";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    
    // Validasi form
    const emailTrimmed = email.trim();
    const passwordTrimmed = password.trim();
    const newFieldErrors: { username?: string; password?: string } = {};
    
    if (!emailTrimmed && !passwordTrimmed) {
      newFieldErrors.username = "Please fill in username";
      newFieldErrors.password = "Please fill in password";
      setFieldErrors(newFieldErrors);
      setError("Please fill in both username and password");
      return;
    }
    
    if (!emailTrimmed) {
      newFieldErrors.username = "Please fill in username";
      setFieldErrors(newFieldErrors);
      setError("Please fill in username");
      return;
    }
    
    if (!passwordTrimmed) {
      newFieldErrors.password = "Please fill in password";
      setFieldErrors(newFieldErrors);
      setError("Please fill in password");
      return;
    }

    setLoading(true);
    try {
      // Pakai email state sebagai username untuk login
      await login(emailTrimmed, passwordTrimmed);
      // Setelah login sukses, redirect ke home
      nav("/", { replace: true });
    } catch (err: any) {
      // Tampilkan error dari API dengan deteksi password salah
      const errorMessage = err?.message || "Login failed. Please check your credentials.";
      
      // Cek apakah error berkaitan dengan password
      if (errorMessage.toLowerCase().includes("password") || 
          errorMessage.toLowerCase().includes("invalid") ||
          errorMessage.toLowerCase().includes("credential")) {
        newFieldErrors.password = "Password is incorrect";
        setFieldErrors(newFieldErrors);
        setError("Password is incorrect. Please try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-center">
        <div className="login-card" role="presentation">
          <div className="avatar" aria-hidden>
            <FaCar className="avatar-icon" size={40} aria-hidden="true" />
          </div>

          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="login-form"
            noValidate
          >
            <div className="field">
              <div className="field-icon" aria-hidden>
                <IoPersonCircle size={18} color="white" />
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Username"
                className={`input with-icon ${fieldErrors.username ? 'input-error' : ''}`}
                required
                aria-label="Username"
              />
            </div>

            <div className="field">
              <div className="field-icon" aria-hidden>
                <FaLock size={18} color="white" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`input with-icon ${fieldErrors.password ? 'input-error' : ''}`}
                required
                aria-label="Password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <FaEyeSlash size={18} />
                ) : (
                  <FaEye size={18} />
                )}
              </button>
            </div>

            {error && <div className="error">{error}</div>}
          </form>
        </div>

        <button
          form="login-form"
          type="submit"
          className="card-pill"
          aria-label="Login"
          disabled={loading}
        >
          <span className="pill-text">
            {loading ? "Signing in..." : "LOGIN"}
          </span>
        </button>
      </div>
    </div>
  );
}