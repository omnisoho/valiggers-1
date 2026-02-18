document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const usernameInput = document.getElementById('registerUsername');
  const emailInput = document.getElementById('registerEmail');
  const passwordInput = document.getElementById('registerPassword');

  const registerBtn = document.getElementById('registerSubmit'); // 👈 FIX

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || !email || !password) {
      alert('Please fill in all fields.');
      return;
    }

    // Start loading animation
    registerBtn.classList.add('loading');

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Registration failed');
        registerBtn.classList.remove('loading'); // remove loading on fail
        return;
      }

      // success
      alert('Registration successful! You can now log in.');
      window.location.href = '/login.html';

    } catch (err) {
      console.error(err);
      alert('Something went wrong. Try again later.');
    } finally {
      registerBtn.classList.remove('loading');
    }
  });
});
