/* eslint-disable */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { publicApi } from "@/lib/api";
import LoadingRule from "@/components/LoadingRule";

/**
 * Resolves a share token to a quiz UUID and redirects to /quizzes/:id/play.
 * Reuses the existing QuizPlayer page so we don't duplicate the player UI.
 */
export default function SharedQuizRedirect() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await publicApi.get(`/quizzes/share/${token}`);
        navigate(`/quizzes/${data.id}/play`, { replace: true });
      } catch (e) {
        setError("This share link is invalid or the quiz was deleted.");
      }
    })();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6 text-center">
        <div className="hud-clip border border-[#ff003c]/40 bg-[#ff003c]/10 p-10 max-w-md">
          <div className="font-display font-black uppercase text-2xl mb-2 text-[#ff5577]">Link broken</div>
          <p className="text-zinc-400 text-sm mb-5">{error}</p>
          <a href="/" className="btn-ghost-volt hud-clip px-5 py-2 text-xs inline-block">Go Home</a>
        </div>
      </div>
    );
  }
  return <LoadingRule label="Loading Shared Quiz" />;
}
