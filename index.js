const express = require('express');
const cors = require('cors');
const fetch = require('isomorphic-unfetch');
const { getDetails } = require('spotify-url-info')(fetch);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Spotify Resolver API is running on Vercel!'
    });
});

app.get('/api/download', async (req, res) => {
    const spotifyUrl = req.query.url;

    if (!spotifyUrl) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameter: url'
        });
    }

    try {
        // Lấy thông tin metadata chuẩn từ Spotify URL
        const data = await getDetails(spotifyUrl);

        if (!data || !data.preview) {
            return res.status(404).json({
                success: false,
                message: 'Could not fetch details for this Spotify track.'
            });
        }

        const trackData = data.preview;
        const artists = trackData.artist ? trackData.artist : (trackData.artists ? trackData.artists.join(', ') : 'Unknown Artist');

        return res.json({
            success: true,
            title: trackData.title || 'Unknown Track',
            artist: artists,
            image: trackData.image || '',
            audio_preview: trackData.audio || '',
            url: spotifyUrl
        });

    } catch (error) {
        console.error('Error processing Spotify URL:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to extract Spotify metadata',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
