// Shows the right message after a confirmation link is opened.
const state = new URLSearchParams(location.search).get('state');
const text = {
  expired: ["That link has expired.", 'Confirmation links work for 48 hours. Request access again on the main page and we will send a fresh one.'],
  error: ["We couldn't confirm that just now.", 'Please try the link again in a minute. If it keeps failing, email rollcfluence@gmail.com and we will sort it out.'],
}[state];
if (text) {
  document.getElementById('title').textContent = text[0];
  document.getElementById('body').textContent = text[1];
}
