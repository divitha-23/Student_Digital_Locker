import './src/style.css'
import { supabase } from './src/supabase.js'
import { renderAuth } from './src/auth.js'
import { renderApp } from './src/app.js'

function init() {
  supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      if (session?.user) {
        await renderApp(session.user)
      } else {
        renderAuth((user) => renderApp(user))
      }
    })()
  })
}

init()
