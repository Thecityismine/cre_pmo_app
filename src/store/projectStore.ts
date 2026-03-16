import { create } from 'zustand'
import type { Project } from '@/types'

interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  loading: boolean
  error: string | null
  setProjects: (projects: Project[]) => void
  setSelectedProject: (project: Project | null) => void
  upsertProject: (project: Project) => void
  removeProject: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  setSelectedProject: (project) => set({ selectedProject: project }),
  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.findIndex((p) => p.id === project.id)
      if (exists >= 0) {
        const updated = [...state.projects]
        updated[exists] = project
        return { projects: updated }
      }
      return { projects: [project, ...state.projects] }
    }),
  removeProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
