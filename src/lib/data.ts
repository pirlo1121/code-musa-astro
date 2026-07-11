import { API_BASE_URL } from '../config';

const USER_ID = '696c287de69192f9b00097c6';

export interface Profile {
  name: string;
  profession: string;
  bio: string;
  image: string;
  socialLinks: { github?: string; linkedin?: string };
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  image: string;
  repository: string;
  deploy: string;
  stack: string[];
}

// Runs at build time (output: 'static'). If the API is briefly unreachable
// during a build, fall back to null/[] instead of failing the whole build —
// the page still renders, just without live content until the next deploy.

export async function getProfile(): Promise<Profile | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/get/${USER_ID}`);
    const data = await res.json();
    return data.user ?? null;
  } catch (err) {
    console.error('[build] Failed to fetch profile:', err);
    return null;
  }
}

export async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/projects`);
    const data = await res.json();
    if (!data.ok) return [];
    return data.projects.map((p: Project) => ({
      ...p,
      stack: p.stack.flatMap((s: string) => s.split(' ')),
    }));
  } catch (err) {
    console.error('[build] Failed to fetch projects:', err);
    return [];
  }
}
