import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Rocket, LogOut, User2 } from "lucide-react";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 group"
          data-testid="nav-logo"
        >
          <div className="w-9 h-9 hud-clip bg-[#ff6b00] flex items-center justify-center glow-orange">
            <Rocket className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <div className="font-display font-black text-xl uppercase tracking-tight">
            Rocket<span className="text-[#ff6b00]">Sense</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center text-sm font-display uppercase tracking-wider text-zinc-300 hover:text-white px-3"
                data-testid="nav-dashboard-link"
              >
                Dashboard
              </Link>
              <Link
                to="/quizzes/new"
                className="hidden sm:inline-flex"
                data-testid="nav-create-quiz-link"
              >
                <button className="btn-ghost-volt hud-clip px-4 py-2 text-xs">
                  + Create Quiz
                </button>
              </Link>
              <div className="hidden md:flex items-center gap-2 px-3 py-1 border border-white/10">
                <User2 className="w-4 h-4 text-zinc-400" />
                <span className="font-mono-rl text-xs text-zinc-300 truncate max-w-[160px]">
                  {user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
                data-testid="nav-signout-button"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" data-testid="nav-signin-link">
                <button className="btn-ghost-volt hud-clip px-4 py-2 text-xs">
                  Sign In
                </button>
              </Link>
              <Link to="/auth?mode=signup" data-testid="nav-signup-link">
                <button className="btn-boost hud-clip px-4 py-2 text-xs">
                  Get Started
                </button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
