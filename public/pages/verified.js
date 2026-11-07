// Shows the right message after a confirmation link is opened.
const state = new URLSearchParams(location.search).get('state');
const text = {
  expired: ["That link has expired.", 'Confirmation links work for 48 hours. Request access again on the main page and we will send a fresh one.'],
  error: ["We couldn't confirm that just now.", 'Please try the link again in a minute. If it keeps failing, email rollcfluence@gmail.com and we will sort it out.'],
  used: ['That link was already used.', 'Each confirmation link works once, so there is nothing more to do.'],
  alerts: ['Alerts confirmed.', 'This address will now get the Shield security alerts it was signed up for.'],
}[state];
if (text) {
  document.getElementById('title').textContent = text[0];
  document.getElementById('body').textContent = text[1];
}
