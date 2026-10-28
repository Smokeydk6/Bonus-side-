(function () {
  const DEMO_PASSWORD = "skift-mig";
  const AUTH_KEY = "bonusblik.admin";

  document.addEventListener("DOMContentLoaded", () => {
    const loginPanel = document.getElementById("login-panel");
    if (!loginPanel) return;

    const dashboard = document.getElementById("admin-dashboard");
    const form = document.getElementById("login-form");
    const password = document.getElementById("admin-password");
    const error = document.getElementById("login-error");
    const logout = document.getElementById("logout-button");

    function showDashboard() {
      loginPanel.hidden = true;
      dashboard.hidden = false;
      document.dispatchEvent(new Event("bonusblik:authenticated"));
    }

    if (sessionStorage.getItem(AUTH_KEY) === "true") showDashboard();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (password.value !== DEMO_PASSWORD) {
        error.hidden = false;
        password.setAttribute("aria-invalid", "true");
        password.focus();
        return;
      }
      sessionStorage.setItem(AUTH_KEY, "true");
      error.hidden = true;
      password.removeAttribute("aria-invalid");
      showDashboard();
    });

    password.addEventListener("input", () => {
      error.hidden = true;
      password.removeAttribute("aria-invalid");
    });

    logout.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEY);
      dashboard.hidden = true;
      loginPanel.hidden = false;
      password.value = "";
      password.focus();
    });
  });
})();