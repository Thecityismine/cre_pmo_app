import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { AppUser } from '@/types'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Build a base user from Firebase Auth (always available)
        const baseUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'User',
          role: 'project-manager',
          photoURL: firebaseUser.photoURL ?? undefined,
          createdAt: new Date().toISOString(),
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            setUser({ ...baseUser, ...userDoc.data() } as AppUser)
          } else {
            // First login — create the profile doc
            await setDoc(doc(db, 'users', firebaseUser.uid), baseUser)
            setUser(baseUser)
          }
        } catch {
          // Firestore rules not yet configured — still let the user in
          // using their Firebase Auth profile
          console.warn('Firestore user profile unavailable — using Auth profile')
          setUser(baseUser)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [setUser, setLoading])

  return { user, loading }
}
