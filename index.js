const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': 'https://spotsaver.net/',
    'Origin': 'https://spotsaver.net',
    'Content-Type': 'application/json'
};

app.get('/api/song', async (req, res) => {
    const spotifyUrl = req.query.url;

    if (!spotifyUrl) {
        return res.status(400).json({ success: false, message: 'Missing spotify url parameter' });
    }

    try {
        const infoRes = await axios.get(`https://spotsaver.net/api/spotify/?url=${encodeURIComponent(spotifyUrl)}`, {
            headers: HEADERS,
            timeout: 10000
        });

        const items = infoRes.data?.items;
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Track metadata not found' });
        }

        const track = items[0];
        const title = track.title || 'Unknown Title';
        const artist = track.artist || 'Unknown Artist';

        const idRes = await axios.post('https://spotsaver.net/api/get-id/', {
            title: title,
            artist: artist
        }, {
            headers: HEADERS,
            timeout: 10000
        });

        const videoId = idRes.data?.videoId;
        if (!videoId) {
            return res.status(404).json({ success: false, message: 'Failed to resolve Video ID' });
        }

        const dlRes = await axios.post('https://spotsaver.net/api/download/', {
            videoId: videoId,
            candidateIds: [],
            format: 'mp3',
            title: `${title} - ${artist}`
        }, {
            headers: HEADERS,
            timeout: 10000
        });

        const fullDownloadUrl = dlRes.data?.downloadUrl || dlRes.data?.mediaUrl || dlRes.data?.url;

        if (!fullDownloadUrl) {
            return res.status(500).json({ success: false, message: 'Failed to generate MP3 stream URL' });
        }

        return res.json({
            success: true,
            data: {
                id: track.id || '',
                title: title,
                artist: artist,
                album: track.album || '',
                thumbnail: track.thumbnail || '',
                duration: track.duration || 0,
                youtube_video_id: videoId,
                preview_url: track.previewUrl || '',
                full_download_url: fullDownloadUrl
            }
        });

    } catch (error) {
        console.error('[API Error]:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}