// Blocking inline script that applies the saved theme before first paint, so
// there is no light/dark flash. Reads the same localStorage key the Zustand
// `persist` store uses ('agrisense-settings'). Rendered in <head>.
export function ThemeScript() {
  const js = `(function(){try{var raw=localStorage.getItem('agrisense-settings');var t='dark';if(raw){var p=JSON.parse(raw);t=(p&&p.state&&p.state.theme)||'dark';}var d=document.documentElement;if(t==='dark')d.classList.add('dark');else d.classList.remove('dark');d.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
