const express = require('express');
const cors = require('cors');
const spotty = require('spottydl');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Spotify Resolver API is running smoothly!'
    });
});

app.get('/api/download', async (req, res) => {
    const spotifyUrl = req.query.url;

    if (!spotifyUrl) {
        return res.status(400).json({
            success: false,
            message: 'Missing required query parameter: url'
        });
    }

    try {
        console.log(`[API] Processing Spotify URL: ${spotifyUrl}`);
        
        const trackData = await spotty.getTrack(spotifyUrl);

        if (!trackData || trackData.error) {
            return res.status(404).json({
                success: false,
                message: 'Could not fetch details for the provided Spotify track.'
            });
        }

        return res.json({
            success: true,
            title: trackData.title || "Unknown Title",
            artist: trackData.artist || "Unknown Artist",
            album: trackData.album || "",
            year: trackData.year || "",
            image: trackData.albumCover || "",
            downloadUrl: trackData.downloadUrl || trackData.streamUrl || null
        });

    } catch (error) {
        console.error('[API Error]:', error.message || error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while resolving Spotify track.',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}/api/download?url=...`);
    console.log(`=================================`);
});
