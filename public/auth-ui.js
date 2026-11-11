(() => {
  const start = () => {
    const loginButton = document.querySelector("#loginBtn");
    if (!loginButton || document.querySelector("#bazaarakAuthDialog")) return;

    const style = document.createElement("style");
    style.textContent = `
      #bazaarakAuthDialog{border:0;border-radius:20px;padding:0;width:min(480px,92vw);max-height:90vh;overflow:auto;box-shadow:0 25px 90px #102b2650}
      #bazaarakAuthDialog::backdrop{background:#142d28a8}
      #bazaarakAuthDialog form{padding:24px;font-family:Tahoma,Arial,sans-serif;color:#20352f}
      #bazaarakAuthDialog .auth-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      #bazaarakAuthDialog h2{font-size:20px;color:#183b35;margin:0 0 12px}
      #bazaarakAuthDialog .auth-close{border:0;background:#f0f3ec;border-radius:50%;width:32px;height:32px;font-size:22px;cursor:pointer}
      #bazaarakAuthDialog p{font-size:12px;color:#718078;margin:4px 0 12px}
      #bazaarakAuthDialog label{display:block;font-size:12px;color:#50665b;margin:12px 0}
      #bazaarakAuthDialog input{display:block;width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #e5e9df;border-radius:10px;padding:11px;font:inherit;font-size:13px;direction:rtl}
      #bazaarakAuthDialog input:focus{outline:2px solid #8cae91;border-color:#8cae91}
      #bazaarakAuthDialog .auth-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #bazaarakAuthDialog .auth-submit{width:100%;border:0;border-radius:12px;padding:12px;background:#245b4b;color:#fff;font:inherit;cursor:pointer;margin-top:8px}
      #bazaarakAuthDialog .auth-switch{border:0;background:transparent;color:#245b4b;font:inherit;font-weight:bold;cursor:pointer}
      #bazaarakAuthDialog .auth-error{min-height:22px;color:#b42318;font-size:11px;margin:7px 0}
      #bazaarakAuthDialog [hidden]{display:none!important}
      @media(max-width:480px){#bazaarakAuthDialog .auth-row{grid-template-columns:1fr}}
    `;
    document.head.append(style);

    const dialog = document.createElement("dialog");
    dialog.id = "bazaarakAuthDialog";
    dialog.dir = "rtl";
    dialog.innerHTML = `
      <form id="bazaarakLoginForm" novalidate>
        <div class="auth-head"><h2>ورود اعضا</h2><button class="auth-close" type="button" aria-label="بستن">×</button></div>
        <p>با شماره موبایل و رمز عبور وارد بازارچه شوید.</p>
        <label>شماره موبایل<input name="phone" required inputmode="tel" autocomplete="username" placeholder="09123456789"></label>
        <label>رمز عبور<input name="password" required type="password" minlength="12" maxlength="128" autocomplete="current-password"></label>
        <div class="auth-error" role="alert"></div>
        <button class="auth-submit" type="submit">ورود</button>
        <p>هنوز عضو نیستید؟ <button class="auth-switch" id="bazaarakShowRegister" type="button">ثبت‌نام با کد دعوت</button></p>
      </form>
      <form id="bazaarakRegisterForm" novalidate hidden>
        <div class="auth-head"><h2>عضویت با دعوت‌نامه</h2><button class="auth-close" type="button" aria-label="بستن">×</button></div>
        <p>برای ساخت حساب، کد دعوت معتبر لازم است.</p>
        <label>کد دعوت<input name="invitation_code" required autocomplete="off"></label>
        <label>نام و نام خانوادگی<input name="display_name" required maxlength="80" autocomplete="name"></label>
        <label>شماره موبایل<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="09123456789"></label>
        <div class="auth-row">
          <label>کد شهر<input name="city_code" required maxlength="20" placeholder="TEH"></label>
          <label>نام شهر<input name="city_name" required maxlength="80" placeholder="تهران"></label>
        </div>
        <label>رمز عبور<input name="password" required type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="حداقل ۱۲ نویسه"></label>
        <div class="auth-error" role="alert"></div>
        <button class="auth-submit" type="submit">ایجاد حساب</button>
        <p>قبلاً عضو شده‌اید؟ <button class="auth-switch" id="bazaarakShowLogin" type="button">ورود به حساب</button></p>
      </form>`;
    document.body.append(dialog);

    let currentUser = null;
    const loginForm = dialog.querySelector("#bazaarakLoginForm");
    const registerForm = dialog.querySelector("#bazaarakRegisterForm");
    const setUser = user => {
      currentUser = user;
      loginButton.textContent = user ? (user.display_name || "حساب کاربری") : "ورود اعضا";
      loginButton.title = user ? "برای خروج کلیک کنید" : "ورود یا ثبت‌نام";
    };
    const show = mode => {
      loginForm.hidden = mode !== "login";
      registerForm.hidden = mode !== "register";
      loginForm.querySelector(".auth-error").textContent = "";
      registerForm.querySelector(".auth-error").textContent = "";
      if (!dialog.open) dialog.showModal();
    };
    const api = async (path, body) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "درخواست ناموفق بود.");
      return data;
    };

    loginButton.onclick = async () => {
      if (!currentUser) return show("login");
      try {
        await api("/api/auth/logout", {});
        setUser(null);
        alert("از حساب خارج شدید.");
      } catch (error) { alert(error.message); }
    };
    dialog.querySelectorAll(".auth-close").forEach(button => button.addEventListener("click", () => dialog.close()));
    dialog.querySelector("#bazaarakShowRegister").addEventListener("click", () => show("register"));
    dialog.querySelector("#bazaarakShowLogin").addEventListener("click", () => show("login"));

    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      const errorBox = loginForm.querySelector(".auth-error");
      errorBox.textContent = "";
      const body = Object.fromEntries(new FormData(loginForm));
      try {
        const result = await api("/api/auth/login", body);
        setUser(result.user);
        loginForm.reset();
        dialog.close();
      } catch (error) { errorBox.textContent = error.message; }
    });
    registerForm.addEventListener("submit", async event => {
      event.preventDefault();
      const errorBox = registerForm.querySelector(".auth-error");
      errorBox.textContent = "";
      const body = Object.fromEntries(new FormData(registerForm));
      try {
        const result = await api("/api/auth/register", body);
        setUser(result.user);
        registerForm.reset();
        dialog.close();
        alert("حساب شما با موفقیت ایجاد شد.");
      } catch (error) { errorBox.textContent = error.message; }
    });

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setUser(data?.user || null))
      .catch(() => setUser(null));
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
