import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Se entra con usuario y contraseña. Supabase Auth necesita un email, así que
// cada usuario tiene uno interno que nadie ve (ver migración 010).
const EMAIL_DOMAIN = 'elbaratillo.app'

export const ROLE_LABEL = { owner: 'Dueño/a', admin: 'Admin' }

export function usernameToEmail(username) {
  return `${String(username || '').trim().toLowerCase()}@${EMAIL_DOMAIN}`
}

export async function signIn(username, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Usuario o contraseña incorrectos')
    }
    throw new Error('No se pudo entrar: ' + error.message)
  }
}

export async function signOut() {
  await supabase.auth.signOut()
}

/** Cambia la contraseña del usuario que inició sesión. */
export async function changeMyPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/**
 * La sesión y el perfil (nombre y rol) de quien está usando la app.
 * `loading` es true hasta saber si hay sesión, para no mostrar el login un
 * instante a quien ya había entrado.
 */
export function useSession() {
  // Sin Supabase configurado no hay nada que esperar: la app muestra el aviso.
  const [state, setState] = useState({ loading: Boolean(supabase), session: null, profile: null })

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    async function load(session) {
      if (!session) {
        if (!cancelled) setState({ loading: false, session: null, profile: null })
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!cancelled) setState({ loading: false, session, profile: data })
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // El refresco del token no cambia quién es: no hace falta recargar.
      if (event === 'TOKEN_REFRESHED') return
      // Fuera del callback: supabase-js recomienda no esperar consultas acá.
      setTimeout(() => load(session), 0)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}

// ---------- Usuarios (sólo admin) ----------

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  if (error) throw error
  return data
}

function rpcError(error) {
  // Los mensajes de las funciones de la base ya vienen en castellano.
  return new Error(error.message || 'No se pudo completar.')
}

export async function adminCreateUser({ username, fullName, role, password }) {
  const { error } = await supabase.rpc('admin_create_user', {
    p_username: username,
    p_full_name: fullName,
    p_role: role,
    p_password: password,
  })
  if (error) throw rpcError(error)
}

export async function adminSetPassword(userId, password) {
  const { error } = await supabase.rpc('admin_set_password', { p_user_id: userId, p_password: password })
  if (error) throw rpcError(error)
}

export async function adminUpdateProfile(userId, { fullName, role }) {
  const { error } = await supabase.rpc('admin_update_profile', {
    p_user_id: userId,
    p_full_name: fullName,
    p_role: role,
  })
  if (error) throw rpcError(error)
}

export async function adminDeleteUser(userId) {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
  if (error) throw rpcError(error)
}
