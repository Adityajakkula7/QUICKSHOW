import React, { useEffect, useState } from 'react'
import MovieCard from '../components/MovieCard'
import Blurcircle from '../components/Blurcircle'

const languages = [
    { label: 'All', value: 'all' },
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Telugu', value: 'te' },
    { label: 'Tamil', value: 'ta' },
]

const Movies = () => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLang, setSelectedLang] = useState('all');

    useEffect(() => {
        const fetchMovies = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/movies/now-playing?language=${selectedLang}`);
                const data = await res.json();
                if (data.success) {
                    setMovies(data.movies);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMovies();
    }, [selectedLang]); // refetch when language changes

    return (
        <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>
            <Blurcircle top="150px" left='0px' />
            <Blurcircle bottom='50px' right='50px' />

            <div className='flex items-center justify-between my-4'>
                <h1 className='text-lg font-medium'>Now Showing</h1>
                {/* Language Filter Buttons */}
                <div className='flex gap-2'>
                    {languages.map(lang => (
                        <button
                            key={lang.value}
                            onClick={() => setSelectedLang(lang.value)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition cursor-pointer
                                ${selectedLang === lang.value
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className='flex justify-center items-center h-60'>
                    <p className='text-gray-400'>Loading movies...</p>
                </div>
            ) : movies.length > 0 ? (
                <div className='flex flex-wrap max-sm:justify-center gap-8'>
                    {movies.map((movie) => (
                        <MovieCard movie={movie} key={movie._id} />
                    ))}
                </div>
            ) : (
                <div className='flex justify-center items-center h-60'>
                    <p className='text-gray-400'>No movies available in this language</p>
                </div>
            )}
        </div>
    )
}

export default Movies