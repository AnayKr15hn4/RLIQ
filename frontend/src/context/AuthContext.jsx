import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthCtx = createContext({ user: null, session: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password, display_name) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name } },
    });
  const verifyOtp = (email, token, type = "signup") =>
    supabase.auth.verifyOtp({ email, token, type });
  const resendSignupOtp = (email) =>
    supabase.auth.resend({ type: "signup", email });
  const sendRecoveryOtp = (email) =>
    supabase.auth.resetPasswordForEmail(email);
  const verifyRecoveryOtp = (email, token) =>
    supabase.auth.verifyOtp({ email, token, type: "recovery" });
  const updatePassword = (password) =>
    supabase.auth.updateUser({ password });
  const signOut = () => supabase.auth.signOut();

  return (
    <AuthCtx.Provider
      value={{
        user, session, loading,
        signIn, signUp, signOut,
        verifyOtp, resendSignupOtp,
        sendRecoveryOtp, verifyRecoveryOtp, updatePassword,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
