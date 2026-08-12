import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Loading from '../components/Loading';
import { ArrowRightIcon, ClockIcon } from 'lucide-react';
import isoTimeFormat from '../lib/isoTimeFormat';
import Blurcircle from '../components/Blurcircle';
import toast from 'react-hot-toast';
import { assets } from '../assets/assets';
import { useAuth } from '../context/AuthContext';

const SeatLayout = () => {

    const groupRows = [["A",'B'],['C','D'],['E','F'],['G','H'],['I','J']];

        const {id, date} = useParams()
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [show, setShow] = useState(null);
    const [occupiedSeats, setOccupiedSeats] = useState([]);
    const [lockedSeats, setLockedSeats] = useState([]);
    const [isLoadingSeats, setIsLoadingSeats] = useState(false);
    const navigate = useNavigate()
    const { user } = useAuth();

   const generateDateTimes = () => {
    const dateTime = {};
    for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day);
        const dateKey = date.toISOString().split('T')[0];
        
        dateTime[dateKey] = [
            { time: `${dateKey}T05:45:00.000Z`, showId: `${dateKey}-1` }, // 11:15 AM IST
            { time: `${dateKey}T09:00:00.000Z`, showId: `${dateKey}-2` }, // 2:30 PM IST
            { time: `${dateKey}T12:30:00.000Z`, showId: `${dateKey}-3` }, // 6:00 PM IST
            { time: `${dateKey}T15:30:00.000Z`, showId: `${dateKey}-4` }, // 9:00 PM IST
        ];
    }
    return dateTime;
    };

const getShow = async () => {
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/movies/${id}`);
        const data = await res.json();
        if (data.success) {
            setShow({
                movie: data.movie,
                dateTime: generateDateTimes()
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

const fetchSeatStatus = async (time) => {
    if (!time) return;
    setIsLoadingSeats(true);
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/seats-status?movieId=${id}&showTime=${time}`);
        const data = await res.json();
        if (data.success) {
            setOccupiedSeats(data.occupiedSeats || []);
            setLockedSeats(data.lockedSeats || []);
        }
    } catch (error) {
        console.error('Error fetching seat status:', error);
    } finally {
        setIsLoadingSeats(false);
    }
};

useEffect(() => {
    if (selectedTime) {
        setSelectedSeats([]);
        fetchSeatStatus(selectedTime.time);
    }
}, [selectedTime]);

    const handleSeatClick = (seatId) => {
        if (!selectedTime) {
            return toast("Please select time first")
        }
        if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
            return toast("You can only select 5 seats")
        }
        setSelectedSeats(prev => prev.includes(seatId)
            ? prev.filter(seat => seat !== seatId)
            : [...prev, seatId])
    }

    const renderSeats = (row, count = 9) => (
        <div key={row} className="flex gap-2 mt-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: count }, (_, i) => {
                    const seatId = `${row}${i + 1}`;
                    const isOccupied = occupiedSeats.includes(seatId);
                    const isLocked = lockedSeats.includes(seatId);
                    const isSelected = selectedSeats.includes(seatId);
                    return (
                        <button 
                            key={seatId} 
                            disabled={isOccupied || isLocked}
                            onClick={() => handleSeatClick(seatId)}
                            className={`h-8 w-8 rounded border text-xs cursor-pointer transition-all
                            ${isOccupied 
                                ? "bg-red-950/40 border-red-800/50 text-red-500/50 cursor-not-allowed" 
                                : isLocked 
                                ? "bg-amber-950/40 border-amber-800/50 text-amber-500/50 cursor-not-allowed" 
                                : isSelected
                                ? "bg-primary text-white border-primary"
                                : "border-primary/60 hover:bg-primary/20"}`}
                            title={isOccupied ? "Occupied" : isLocked ? "Temporarily Locked" : `Seat ${seatId}`}
                        >
                            {seatId}
                        </button>
                    );
                })}
            </div>
        </div>
    )

    useEffect(() => {
        getShow()
    }, [])


   const handleCheckout = async () => {
    if (!user) {
        return navigate('/login');
    }
    if (!selectedTime) return toast('Please select a time first');
    if (selectedSeats.length === 0) return toast('Please select at least one seat');

    console.log('Sending:', {
        seats: selectedSeats,
        movieId: show.movie.id,
        movieTitle: show.movie.title,
        moviePoster: show.movie.poster_path,
        showTime: selectedTime.time,
        amount: selectedSeats.length * 150,
        userId: user._id
    });

    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seats: selectedSeats,
                movieId: show.movie.id,
                movieTitle: show.movie.title,
                moviePoster: show.movie.poster_path,
                showTime: selectedTime.time,
                amount: selectedSeats.length * 150,
                userId: user._id
            })
        });

        const data = await res.json();
        console.log('Response:', data);
        
        if (data.success) {
            window.location.href = data.url;
        } else {
            toast(data.message || 'Payment failed. Try again!');
            if (selectedTime) {
                setSelectedSeats([]);
                fetchSeatStatus(selectedTime.time);
            }
        }
    } catch (error) {
        console.error(error);
        toast('Something went wrong!');
    }
};


    const timings = show?.dateTime?.[date] || [];

    return show ? (
        <div className='flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50'>

            {/* Available Timings */}
            <div className='w-60 bg-primary/10 border border-primary/20 rounded-lg py-10 h-max md:sticky md:top-30'>
                <p className='text-lg font-semibold px-6'>Available Timings</p>
                <div className='mt-5 space-y-1'>
                    {timings.length > 0 ? timings.map((item) => (
                        <div key={item.time} onClick={() => setSelectedTime(item)}
                            className={`flex items-center gap-2 px-6 py-2 w-max rounded-r-md
                            cursor-pointer transition ${selectedTime?.time === item.time
                                ? 'bg-primary text-white'
                                : 'hover:bg-primary/20'}`}>
                            <ClockIcon className="w-4 h-4" />
                            <p className='text-sm'>{isoTimeFormat(item.time)}</p>
                        </div>
                    )) : (
                        <p className='px-6 text-sm text-gray-400'>No shows available</p>
                    )}
                </div>
            </div>

            {/* Seats Layout */}
            <div className='relative flex-1 flex flex-col items-center max-md:mt-16'>
                <Blurcircle top="-100px" left="-100px" />
                <Blurcircle bottom="0" right="0" />
                <h1 className='text-2xl font-semibold mb-4'>Select your seat</h1>
                <img src={assets.screenImage} alt="screen" />
                <p className='text-gray-400 text-sm mb-6'>SCREEN SIDE</p>

                {/* Seat status legend */}
                <div className='flex flex-wrap justify-center gap-6 mb-6 text-xs text-gray-400'>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 rounded border border-primary/60'></div>
                        <span>Available</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 rounded bg-primary border border-primary'></div>
                        <span>Selected</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 rounded bg-amber-950/40 border border-amber-800/50'></div>
                        <span>Locked (10m)</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 rounded bg-red-950/40 border border-red-800/50'></div>
                        <span>Booked</span>
                    </div>
                </div>

                <div className='flex flex-col items-center mt-10 text-xs text-gray-300'>
                    <div className='grid grid-cols-2 md:grid-cols-1 gap-8 md:gap-2 mb-6'>
                        {groupRows[0].map(row => renderSeats(row))}
                    </div>
                    <div className='grid grid-cols-2 gap-11'>
                        {groupRows.slice(1).map((group, idx) => (
                            <div key={idx}>
                                {group.map(row => renderSeats(row))}
                            </div>
                        ))}
                    </div>
                </div>
                
                
                <button onClick={handleCheckout}
                    className='flex items-center gap-1 mt-20 px-10 py-3 text-sm bg-primary
                    hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95'>
                    Proceed to Checkout
                    <ArrowRightIcon strokeWidth={3} className='w-4 h-4' />
                </button>
            </div>
        </div>
    ) : (
        <Loading />
    )
}

export default SeatLayout