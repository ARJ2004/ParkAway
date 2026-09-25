// React 19's act() warns whenever a state update happens outside a known
// "act environment" — including a component's own async continuation after
// an awaited call (e.g. PersonaScreen's `finally { setLoading(null) }`).
// RNTL's render()/waitFor() toggle this around themselves already; setting it
// globally just keeps that toggle from ever reading as "off" between calls.
global.IS_REACT_ACT_ENVIRONMENT = true;
