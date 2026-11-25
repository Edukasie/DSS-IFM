# DSS Frontend – Final Polish Patch

## Confirmed fixes
1. `.auth-loading[hidden] { display: none !important; }` ensures the loading overlay is actually hidden after `setView()` sets the hidden attribute. This addresses the observed permanent loading screen.
2. Employee username input now declares `autocomplete="username"`.
3. Employee creation role selector no longer offers `ADMIN`, because the backend intentionally blocks ADMIN creation through the employee form. The ADMIN role remains in the employee role filter.
4. Initial employee password field now matches backend validation: minimum 8 characters.
5. Service Worker cache updated to `dss-app-v17`.

## Install
1. Back up `DSS-Frontend`.
2. Extract this ZIP into the workspace and overwrite matching files.
3. Restart Live Server.
4. DevTools > Application > Service Workers > Unregister (if old cache persists).
5. Hard refresh with Ctrl+F5.
6. Test: open page without token -> Login; login -> Dashboard; refresh while logged in -> Dashboard; logout -> Login.

This is a local frontend-only patch. It does not touch backend, database, GitHub, or PythonAnywhere.
