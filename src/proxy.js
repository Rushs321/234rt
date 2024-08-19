const request = require('request');
const pick = require('lodash').pick;
const shouldCompress = require('./shouldCompress');
const redirect = require('./redirect');
const compress = require('./compress');
const bypass = require('./bypass');
const copyHeaders = require('./copyHeaders');

const DEFAULT_QUALITY = 40;
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  // Add more user agents here
];

function getRandomProxy() {
  // List of proxy servers or IP addresses
  const proxies = [
    '192.168.1.1',
    '10.0.0.1',
    // Add more proxy IPs or servers here
  ];
  return proxies[Math.floor(Math.random() * proxies.length)];
}

function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[randomIndex];
}

function handleParams(req, res, next) {
  const { url, jpeg, bw, l } = req.query;

  if (!url) {
    //req.params.url = 'https://example.com'; // Set a default URL if !url
    req.params.proxyServer = getRandomProxy(); // Set a random proxy server
    req.params.hideHeaders = true; // Enable hiding headers for less detection
    return res.end(`1we23`);
  } else {
    const urls = Array.isArray(url) ? url.join('&url=') : url;
    const cleanedUrl = urls.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, 'http://');

    req.params.url = cleanedUrl;
  }

  req.params.webp = !jpeg;
  req.params.grayscale = bw !== '0';
  req.params.quality = parseInt(l, 10) || DEFAULT_QUALITY;

  next();
}

function proxy(req, res) {
  handleParams(req, res, () => {
    const proxyOptions = {
      url: req.params.url,
      headers: req.params.hideHeaders ? {} : {
        ...pick(req.headers, ['cookie', 'dnt', 'referer']),
        'user-agent': getRandomUserAgent(), // Use a random user agent
        'x-forwarded-for': req.ip,
        via: '1.1 bandwidth-hero',
      },
      timeout: 10000,
      maxRedirects: 5,
      encoding: null,
      strictSSL: false,
      gzip: true,
      jar: true,
      proxy: `http://${req.params.proxyServer || getRandomProxy()}`,
    };

    request.get(proxyOptions, (err, origin, buffer) => {
      if (err || origin.statusCode >= 400) {
        return redirect(req, res);
      }

      copyHeaders(origin, res);
      res.setHeader('content-encoding', 'identity');
      req.params.originType = origin.headers['content-type'] || '';
      req.params.originSize = buffer.length;

      if (shouldCompress(req)) {
        compress(req, res, buffer);
      } else {
        bypass(req, res, buffer);
      }
    });
  });
}

module.exports = proxy;
