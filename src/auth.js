import { supabase } from './supabase.js'
import { icon } from './icons.js'

export function renderAuth(onAuthSuccess) {
  const app = document.querySelector('#app')
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">${icon('lock')}</div>
          <h1>Student Digital Locker</h1>
          <p class="auth-subtitle">Securely store your important documents in one place</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login" id="tab-login">Login</button>
          <button class="auth-tab" data-tab="register" id="tab-register">Register</button>
        </div>

        <div class="auth-messages" id="auth-messages"></div>

        <!-- Login Form -->
        <form class="auth-form active" id="login-form">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" placeholder="you@college.edu" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" placeholder="Enter your password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="login-btn">Login to Your Locker</button>
        </form>

        <!-- Register Form -->
        <form class="auth-form" id="register-form">
          <div class="form-group">
            <label for="register-email">Email Address</label>
            <input type="email" id="register-email" placeholder="you@college.edu" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="register-password">Password</label>
            <input type="password" id="register-password" placeholder="At least 6 characters" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label for="register-confirm">Confirm Password</label>
            <input type="password" id="register-confirm" placeholder="Re-enter password" required minlength="6" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="register-btn">Create Your Account</button>
        </form>
      </div>
    </div>
  `

  setupAuthEvents(onAuthSuccess)
}

function setupAuthEvents(onAuthSuccess) {
  const tabLogin = document.getElementById('tab-login')
  const tabRegister = document.getElementById('tab-register')
  const loginForm = document.getElementById('login-form')
  const registerForm = document.getElementById('register-form')

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active')
    tabRegister.classList.remove('active')
    loginForm.classList.add('active')
    registerForm.classList.remove('active')
    clearMessages()
  })

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active')
    tabLogin.classList.remove('active')
    registerForm.classList.add('active')
    loginForm.classList.remove('active')
    clearMessages()
  })

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('login-btn')
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value

    btn.disabled = true
    btn.textContent = 'Logging in...'
    clearMessages()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      showMessage(error.message, 'error')
      btn.disabled = false
      btn.textContent = 'Login to Your Locker'
    } else {
      showMessage('Login successful! Opening your locker...', 'success')
      setTimeout(() => onAuthSuccess(data.user), 600)
    }
  })

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('register-btn')
    const email = document.getElementById('register-email').value.trim()
    const password = document.getElementById('register-password').value
    const confirm = document.getElementById('register-confirm').value

    clearMessages()

    if (password !== confirm) {
      showMessage('Passwords do not match. Please try again.', 'error')
      return
    }

    btn.disabled = true
    btn.textContent = 'Creating account...'
    clearMessages()

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      showMessage(error.message, 'error')
      btn.disabled = false
      btn.textContent = 'Create Your Account'
    } else {
      showMessage('Account created successfully! Logging you in...', 'success')
      setTimeout(() => onAuthSuccess(data.user), 800)
    }
  })
}

function showMessage(text, type) {
  const container = document.getElementById('auth-messages')
  if (!container) return
  container.innerHTML = `<div class="auth-message ${type}">${text}</div>`
}

function clearMessages() {
  const container = document.getElementById('auth-messages')
  if (container) container.innerHTML = ''
}
