import express from 'express';
import axios from 'axios';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

const genreMap = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
};

const fetchWithRetry = async (url, params, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(url, { params, timeout: 10000 });
            return data;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retrying... attempt ${i + 2}`);
        }
    }
};

// to get now playing
router.get('/now-playing', async (req, res) => {
    try {
        const { language } = req.query;

        const data = await fetchWithRetry(`${TMDB_BASE_URL}/movie/now_playing`, {
            api_key: API_KEY,
            language: 'en-US',
            region: 'IN',
            page: 1
        });

        let movies = data.results.map(movie => ({
            _id: String(movie.id),
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: `https://image.tmdb.org/t/p/original${movie.poster_path}`,
            backdrop_path: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            original_language: movie.original_language,
            runtime: 120,
            genres: movie.genre_ids.map(id => ({ id, name: genreMap[id] || 'Unknown' })),
        }));

        if (language && language !== 'all') {
            movies = movies.filter(movie => movie.original_language === language);
        }

        res.json({ success: true, movies });
    } catch (error) {
        console.error('TMDB Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

//To get movie detail
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const data = await fetchWithRetry(`${TMDB_BASE_URL}/movie/${id}`, {
            api_key: API_KEY,
            language: 'en-US',
            append_to_response: 'credits'
        });

        const movie = {
            _id: String(data.id),
            id: data.id,
            title: data.title,
            overview: data.overview,
            poster_path: `https://image.tmdb.org/t/p/original${data.poster_path}`,
            backdrop_path: `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            release_date: data.release_date,
            vote_average: data.vote_average,
            vote_count: data.vote_count,
            original_language: data.original_language,
            runtime: data.runtime,
            tagline: data.tagline,
            genres: data.genres,
            casts: data.credits.cast.slice(0, 12).map(cast => ({
                name: cast.name,
                profile_path: cast.profile_path
                ? `https://image.tmdb.org/t/p/original${cast.profile_path}`
                : 'https://placehold.co/150'
            }))
        };

        res.json({ success: true, movie });
    } catch (error) {
        console.error('TMDB Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;