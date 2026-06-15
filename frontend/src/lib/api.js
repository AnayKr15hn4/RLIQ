import axios from "axios";
import { supabase } from "./supabaseClient";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export async function api() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const instance = axios.create({ baseURL: BASE });
  if (token) instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  return instance;
}

// public fetch helper (no auth required)
export const publicApi = axios.create({ baseURL: BASE });

export function extractYouTubeId(url) {
  if (!url) return null;
  const re =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const m = url.match(re);
  return m ? m[1] : null;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
