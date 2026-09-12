const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const SPOTSAVER_URL = 'https://spotsaver.net';
const DASHCDN_URL = 'https://dashcdn.onrender.com';

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
};

app.get('/api/song', async (req, res) => {
    const spotifyUrl = req.query.url;

    if (!spotifyUrl) {
        return res.status(400).json({ success: false, message: 'Missing spotify url parameter' });
    }

    try {
        console.log('[Spotsaver] Fetching Spotify metadata...');
        const infoRes = await axios.get(`${SPOTSAVER_URL}/api/spotify/?url=${encodeURIComponent(spotifyUrl)}`, {
            headers: { ...COMMON_HEADERS, 'Referer': `${SPOTSAVER_URL}/`, 'Origin': SPOTSAVER_URL },
            timeout: 15000
        });

        const items = infoRes.data?.items;
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Track metadata not found on Spotsaver' });
        }

        const track = items[0];
        const title = track.title || 'Unknown Title';
        const artist = track.artist || 'Unknown Artist';
        const duration = track.duration || 0;

        console.log('[Spotsaver] Resolving Video ID...');
        const idRes = await axios.post(`${SPOTSAVER_URL}/api/get-id/`, {
            title: title,
            artist: artist
        }, {
            headers: { ...COMMON_HEADERS, 'Referer': `${SPOTSAVER_URL}/`, 'Origin': SPOTSAVER_URL },
            timeout: 15000
        });

        const videoId = idRes.data?.videoId;
        if (!videoId) {
            return res.status(404).json({ success: false, message: 'Failed to resolve Video ID from Spotsaver' });
        }


        console.log('[Spotsaver] Generating raw stream link...');
        const dlRes = await axios.post(`${SPOTSAVER_URL}/api/download/`, {
            videoId: videoId,
            candidateIds: [],
            format: 'mp3',
            title: `${title} - ${artist}`
        }, {
            headers: { ...COMMON_HEADERS, 'Referer': `${SPOTSAVER_URL}/`, 'Origin': SPOTSAVER_URL },
            timeout: 15000
        });

        const rawStreamUrl = dlRes.data?.downloadUrl || dlRes.data?.mediaUrl || dlRes.data?.url;
        if (!rawStreamUrl) {
            return res.status(500).json({ success: false, message: 'Failed to get raw stream link from Spotsaver' });
        }

    
        console.log('[DashCDN] Sending stream URL to /api/cache-media...');
        let finalCdnUrl = rawStreamUrl;
        let mediaId = null;

        try {
            const cacheRes = await axios.post(`${DASHCDN_URL}/api/cache-media`, {
                stream_url: rawStreamUrl,
                duration: duration,
                load_as_file: false 
            }, {
                headers: { ...COMMON_HEADERS, 'Referer': `${DASHCDN_URL}/`, 'Origin': DASHCDN_URL },
                timeout: 35000
            });

            if (cacheRes.data?.success && cacheRes.data?.local_stream_url) {
                finalCdnUrl = cacheRes.data.local_stream_url; // Trỏ thẳng về link GET /media/:id
                mediaId = cacheRes.data.media_id;
            }
        } catch (cdnErr) {
            console.warn(`[DashCDN Warning] Cache to DashCDN failed, falling back to Spotsaver raw URL: ${cdnErr.message}`);
        }

        return res.json({
            success: true,
            data: {
                id: track.id || '',
                title: title,
                artist: artist,
                album: track.album || '',
                thumbnail: track.thumbnail || '',
                duration: duration,
                youtube_video_id: videoId,
                preview_url: track.previewUrl || '',
                full_download_url: finalCdnUrl, // Chuỗi có dạng: https://dashcdn.onrender.com/media/<media_id>
                media_id: mediaId
            }
        });

    } catch (error) {
        console.error('[Pipeline Error]:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Pipeline process failed',
            error: error.message
        });
    }
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Audio Resolver API running on port ${PORT}`));
}
