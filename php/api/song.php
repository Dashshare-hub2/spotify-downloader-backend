<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

$spotifyUrl = isset($_GET['url']) ? trim($_GET['url']) : '';

if (empty($spotifyUrl)) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing required parameter: url'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}


function makeCurlRequest($url, $method = 'GET', $payload = null) {
    $ch = curl_init();
    
    $headers = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer: https://spotsaver.net/',
        'Origin: https://spotsaver.net',
        'Content-Type: application/json'
    ];

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($payload) ? json_encode($payload) : $payload);
    }

    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['error' => $error];
    }

    return json_decode($response, true);
}

try {
    $infoApiUrl = "https://spotsaver.net/api/spotify/?url=" . urlencode($spotifyUrl);
    $infoData = makeCurlRequest($infoApiUrl, 'GET');

    if (!isset($infoData['items']) || empty($infoData['items'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Could not fetch track metadata from Spotsaver.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $track = $infoData['items'][0];
    $title = $track['title'] ?? 'Unknown Title';
    $artist = $track['artist'] ?? 'Unknown Artist';
    $album = $track['album'] ?? '';
    $thumbnail = $track['thumbnail'] ?? '';
    $duration = $track['duration'] ?? 0;
    $previewUrl = $track['previewUrl'] ?? '';

    $getIdApiUrl = "https://spotsaver.net/api/get-id/";
    $getIdPayload = [
        "title" => $title,
        "artist" => $artist
    ];

    $idData = makeCurlRequest($getIdApiUrl, 'POST', $getIdPayload);

    if (!isset($idData['success']) || !$idData['success'] || empty($idData['videoId'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Found track metadata but failed to retrieve full audio download ID.',
            'data' => [
                'title' => $title,
                'artist' => $artist,
                'album' => $album,
                'thumbnail' => $thumbnail,
                'duration' => $duration,
                'preview_url' => $previewUrl,
                'full_download_url' => null
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    $videoId = $idData['videoId'];

    $downloadApiUrl = "https://spotsaver.net/api/download/";
    $downloadPayload = [
        "videoId" => $videoId,
        "candidateIds" => [],
        "format" => "mp3",
        "title" => $title . " - " . $artist
    ];

    $downloadData = makeCurlRequest($downloadApiUrl, 'POST', $downloadPayload);

    $fullDownloadUrl = $downloadData['downloadUrl'] ?? $downloadData['mediaUrl'] ?? $downloadData['url'] ?? null;

    if (!$fullDownloadUrl) {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to generate direct MP3 download URL.',
            'data' => [
                'title' => $title,
                'artist' => $artist,
                'thumbnail' => $thumbnail,
                'preview_url' => $previewUrl,
                'full_download_url' => null
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $track['id'] ?? '',
            'title' => $title,
            'artist' => $artist,
            'album' => $album,
            'thumbnail' => $thumbnail,
            'duration' => $duration,
            'youtube_video_id' => $videoId,
            'preview_url' => $previewUrl,       
            'full_download_url' => $fullDownloadUrl 
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Internal Server Error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>