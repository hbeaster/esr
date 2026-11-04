import '../src/index.js';
const component = document.querySelector('esr-workspace');
const selector = document.querySelector('#identity');
try {
  const users = await fetch('/api/demo/users').then(r => { if (!r.ok) throw Error('Start the ASP.NET API on port 5080.'); return r.json(); });
  for (const user of users) { const option = document.createElement('option'); option.value = user.id; option.textContent = `${user.name} · ${user.role} · ${user.site}`; selector.append(option); }
  async function selectUser() {
    const response = await fetch('/api/demo/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selector.value }) });
    const session = await response.json(); component.tokenProvider = () => session.token;
  }
  selector.value = 'engineer'; selector.addEventListener('change', selectUser); await selectUser();
} catch (error) { const message = document.createElement('p'); message.textContent = `Unable to connect to demo API. ${error.message}`; document.body.prepend(message); }
