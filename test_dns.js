const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.resolve4('anime.autoembed.cc', (err, addresses) => {
    console.log("anime.autoembed.cc:", err || addresses);
});
dns.resolve4('autoembed.cc', (err, addresses) => {
    console.log("autoembed.cc:", err || addresses);
});
dns.resolve4('embed.su', (err, addresses) => {
    console.log("embed.su:", err || addresses);
});
