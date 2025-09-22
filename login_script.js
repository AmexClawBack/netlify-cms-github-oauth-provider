const REQUIRED_ORIGIN_PATTERN = 
  /^((\*|([\w_-]{2,}))\.)*(([\w_-]{2,})\.)+(\w{2,})(\,((\*|([\w_-]{2,}))\.)*(([\w_-]{2,})\.)+(\w{2,}))*$/
// normalize ORIGINS / ORIGIN from env into a clean CSV (no spaces, no trailing slashes)
const raw = (process.env.ORIGINS || process.env.ORIGIN || '').toString();

// If you want to see exactly what’s coming in from Render:
console.log('DEBUG RAW ORIGINS JSON:', JSON.stringify(raw));

const origins = raw
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(o => o.endsWith('/') ? o.slice(0, -1) : o);

// Rebuild the env in a canonical, no-space CSV
process.env.ORIGINS = origins.join(',');

// Validate minimally: must all be absolute http(s) origins (protocol + host, no path)
const ok = origins.length > 0 && origins.every(o => /^https?:\/\/[^/]+$/.test(o));
if (!ok) {
  throw new Error('process.env.ORIGINS MUST be comma separated list of absolute origins (e.g., https://example.com,http://127.0.0.1:5501)');
}

if (!process.env.ORIGINS.match(REQUIRED_ORIGIN_PATTERN)) {
  throw new Error('process.env.ORIGINS MUST be comma separated list \
    of origins that login can succeed on.')
}
const origins = process.env.ORIGINS.split(',')


module.exports = (oauthProvider, message, content) => `
<script>
(function() {
  function contains(arr, elem) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].indexOf('*') >= 0) {
        const regex = new RegExp(arr[i].replaceAll('.', '\\\\.').replaceAll('*', '[\\\\w_-]+'))
        console.log(regex)
        if (elem.match(regex) !== null) {
          return true;
        }
      } else {
        if (arr[i] === elem) {
          return true;
        }
      }
    }
    return false;
  }
  function recieveMessage(e) {
    console.log("recieveMessage %o", e)
    if (!contains(${JSON.stringify(origins)}, e.origin.replace('https://', 'http://').replace('http://', ''))) {
      console.log('Invalid origin: %s', e.origin);
      return;
    }
    // send message to main window with da app
    window.opener.postMessage(
      'authorization:${oauthProvider}:${message}:${JSON.stringify(content)}',
      e.origin
    )
  }
  window.addEventListener("message", recieveMessage, false)
  // Start handshare with parent
  console.log("Sending message: %o", "${oauthProvider}")
  window.opener.postMessage("authorizing:${oauthProvider}", "*")
})()
</script>`
