const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'streams');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const file = fs.createWriteStream(path.join(dir, 'seven_deadly_sins.mp4'));
https.get('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4', (res) => {
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Sample video downloaded to streams/seven_deadly_sins.mp4');
    });
});
