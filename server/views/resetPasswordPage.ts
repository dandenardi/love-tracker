export function renderResetPasswordPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Reset Password — Love Tracker</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a0f14; color: #f5e9ee; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
  .card { background: #2a1a20; border: 1px solid #4a2f3a; border-radius: 16px; padding: 32px 24px; max-width: 360px; width: 100%; }
  h1 { font-size: 20px; margin: 0 0 16px; color: #f5e9ee; }
  input { width: 100%; box-sizing: border-box; padding: 12px; margin-bottom: 12px; border-radius: 8px; border: 1px solid #4a2f3a; background: #1a0f14; color: #f5e9ee; font-size: 15px; }
  button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #E94B77; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .msg { margin-top: 14px; font-size: 14px; }
  .msg.error { color: #ff8a9a; }
  .msg.success { color: #7de8a0; }
  #form.hidden, .msg.hidden { display: none; }
</style>
</head>
<body>
  <div class="card">
    <h1>Set a new password</h1>
    <form id="form">
      <input id="password" type="password" placeholder="New password" autocomplete="new-password" />
      <input id="confirm" type="password" placeholder="Confirm new password" autocomplete="new-password" />
      <button id="submit" type="submit">Reset Password</button>
      <div id="msg" class="msg hidden"></div>
    </form>
  </div>
  <script>
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');
    var form = document.getElementById('form');
    var msg = document.getElementById('msg');
    var submitBtn = document.getElementById('submit');

    function showMessage(text, isError) {
      msg.textContent = text;
      msg.className = 'msg ' + (isError ? 'error' : 'success');
    }

    if (!token) {
      showMessage('This reset link is missing its token. Please request a new one from the app.', true);
      form.classList.add('hidden');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var password = document.getElementById('password').value;
      var confirm = document.getElementById('confirm').value;

      if (password.length < 8) {
        showMessage('Password must be at least 8 characters.', true);
        return;
      }
      if (password !== confirm) {
        showMessage('Passwords do not match.', true);
        return;
      }

      submitBtn.disabled = true;
      showMessage('Resetting...', false);

      fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, newPassword: password }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok) {
            showMessage('Password changed! You can now log in in the app.', false);
            form.classList.add('hidden');
          } else {
            showMessage(result.data.error || 'Something went wrong.', true);
            submitBtn.disabled = false;
          }
        })
        .catch(function () {
          showMessage('Network error. Please try again.', true);
          submitBtn.disabled = false;
        });
    });
  </script>
</body>
</html>`;
}
