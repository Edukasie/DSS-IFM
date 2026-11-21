DSS Admin Dashboard - Frontend replacement

Replace these files in repository edusinggih/DSS-Frontend:
- index.html
- assets/css/style.css
- assets/js/config.js
- assets/js/app.js
- service-worker.js

The dashboard shell:
- Reuses the existing PythonAnywhere API login and /auth/me token verification.
- Displays the Admin dashboard after a verified ADMIN login.
- Uses sessionStorage for the token.
- Provides navigation placeholders for Suggestion, Approval, Employees, and Departments.
- Shows dashes instead of fabricated KPI counts because dashboard data endpoints are not implemented yet.

After commit, wait for GitHub Pages deployment and hard-refresh / use a private window.
