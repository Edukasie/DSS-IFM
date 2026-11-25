// Local development uses Flask on localhost:5000.
// Deployed GitHub Pages continues to use the PythonAnywhere production API.
(() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  window.DSS_CONFIG = {
    API_BASE_URL: isLocal
      ? "http://127.0.0.1:5000/api"
      : "https://singgihedu.pythonanywhere.com/api"
  };
})();
