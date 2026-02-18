document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginSubmit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      alert('Please enter your username and password.');
      return;
    }

    // Start loading animation
    loginBtn.classList.add('loading');

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        loginBtn.classList.remove('loading');
        alert(data.error || 'Login failed');
        return;
      }

      // Save JWT
      localStorage.setItem('token', data.token);

      // Smooth wait before redirect
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 600);

    } catch (err) {
      console.error(err);
      alert('Something went wrong. Try again later.');
      loginBtn.classList.remove('loading');
    }
  });
});
